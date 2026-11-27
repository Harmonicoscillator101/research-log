#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""科研日志 —— 本地数据引擎。

只用 Python 标准库：HTTP 服务、JSON 原子写入、每日备份、导出、文件监听。
只监听 127.0.0.1，不对外网开放。
"""

from __future__ import annotations

import datetime as dt
import json
import mimetypes
import os
import queue
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = Path(__file__).resolve().parent / "web"
CONFIG_PATH = APP_ROOT / "config.json"
RUNTIME_PATH = APP_ROOT / "runtime.json"
DEFAULT_PORT = 47823
PORT_TRIES = 12
IDLE_EXIT_SECONDS = 3 * 3600
BYE_GRACE_SECONDS = 8
BACKUP_KEEP = 14
MAX_BODY = 16 * 1024 * 1024

STATUSES = ("planned", "active", "paused", "done")


# --------------------------------------------------------------------------- #
# 基础工具
# --------------------------------------------------------------------------- #

def now_iso() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def today_tag() -> str:
    return dt.date.today().strftime("%Y-%m-%d")


def read_json(path: Path):
    return json.loads(path.read_text("utf-8-sig"))


def write_json_atomic(path: Path, obj) -> None:
    tmp = path.with_name(path.name + ".tmp")
    text = json.dumps(obj, ensure_ascii=False, indent=2)
    with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


def empty_doc() -> dict:
    return {
        "schemaVersion": 1,
        "rev": 1,
        "updatedAt": now_iso(),
        "projects": [],
        "entries": [],
    }


def normalize(doc) -> dict:
    """宽容地补全字段：即使外部编辑器/助手只写了一部分，也能正常显示。"""
    if not isinstance(doc, dict):
        raise ValueError("数据必须是一个 JSON 对象")
    if not isinstance(doc.get("projects"), list):
        doc["projects"] = []
    if not isinstance(doc.get("entries"), list):
        doc["entries"] = []
    doc.setdefault("schemaVersion", 1)
    try:
        doc["rev"] = int(doc.get("rev") or 1)
    except Exception:
        doc["rev"] = 1
    doc.setdefault("updatedAt", now_iso())

    for index, project in enumerate(doc["projects"]):
        if not isinstance(project, dict):
            continue
        project.setdefault("id", f"p_{index}")
        project.setdefault("title", "未命名项目")
        project.setdefault("field", "")
        project.setdefault("status", "active")
        if project["status"] not in STATUSES:
            project["status"] = "active"
        goal = project.get("goal")
        if not isinstance(goal, dict):
            goal = {"text": "", "criteria": "", "targetDate": ""}
        goal.setdefault("text", "")
        goal.setdefault("criteria", "")
        goal.setdefault("targetDate", "")
        project["goal"] = goal
        milestones = project.get("milestones")
        if not isinstance(milestones, list):
            milestones = []
        cleaned = []
        for mi, item in enumerate(milestones):
            if not isinstance(item, dict):
                continue
            item.setdefault("id", f"m_{index}_{mi}")
            item.setdefault("text", "")
            item["done"] = bool(item.get("done"))
            item.setdefault("doneAt", None)
            item.setdefault("due", "")
            item.setdefault("note", "")
            item.setdefault("order", mi)
            cleaned.append(item)
        project["milestones"] = cleaned
        resources = project.get("resources")
        if not isinstance(resources, list):
            resources = []
        cleaned_resources = []
        for ri, item in enumerate(resources):
            if not isinstance(item, dict):
                continue
            path = str(item.get("path") or "")
            item.setdefault("id", f"r_{index}_{ri}")
            item["path"] = path
            item["kind"] = "dir" if item.get("kind") == "dir" else "file"
            item["category"] = item.get("category") if item.get("category") in ("ref", "repo", "note") else "ref"
            if not item.get("label"):
                item["label"] = Path(path).name if path else "资料"
            item.setdefault("addedAt", now_iso())
            cleaned_resources.append(item)
        project["resources"] = cleaned_resources
        project.setdefault("notes", "")
        project.setdefault("createdAt", now_iso())
        project.setdefault("updatedAt", now_iso())
        project.setdefault("startDate", "")
        project.setdefault("targetDate", "")
        project.setdefault("completedAt", None)
        project.setdefault("archived", False)
        project.setdefault("order", index)

    for entry in doc["entries"]:
        if isinstance(entry, dict):
            entry.setdefault("id", "e_" + os.urandom(4).hex())
            entry.setdefault("at", now_iso())
            entry.setdefault("kind", "note")
            entry.setdefault("text", "")
    return doc


# --------------------------------------------------------------------------- #
# 数据仓库
# --------------------------------------------------------------------------- #

class Store:
    def __init__(self, data_dir: Path):
        self.dir = Path(data_dir)
        self.path = self.dir / "research-log.json"
        self.backup_dir = self.dir / "backups"
        self.lock = threading.RLock()
        self.listeners: set[queue.Queue] = set()
        self.rev = 0
        self.mtime_ns = 0
        self.size = -1
        self.stop_event = threading.Event()

    # -- 生命周期 ---------------------------------------------------------- #

    def ensure(self) -> None:
        self.dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            write_json_atomic(self.path, empty_doc())
        self.reload()

    def reload(self) -> dict:
        with self.lock:
            doc = normalize(read_json(self.path))
            self.rev = doc["rev"]
            stat = self.path.stat()
            self.mtime_ns = stat.st_mtime_ns
            self.size = stat.st_size
            return doc

    def snapshot(self) -> tuple[int, dict]:
        with self.lock:
            return self.rev, normalize(read_json(self.path))

    # -- 写入 -------------------------------------------------------------- #

    def _backup_if_needed(self) -> None:
        target = self.backup_dir / f"research-log-{today_tag()}.json"
        if target.exists() or not self.path.exists():
            return
        try:
            shutil.copy2(self.path, target)
        except OSError:
            pass
        backups = sorted(self.backup_dir.glob("research-log-*.json"))
        for old in backups[:-BACKUP_KEEP]:
            try:
                old.unlink()
            except OSError:
                pass

    def _commit(self, doc: dict) -> dict:
        doc = normalize(doc)
        doc["rev"] = self.rev + 1
        doc["updatedAt"] = now_iso()
        self._backup_if_needed()
        write_json_atomic(self.path, doc)
        self.rev = doc["rev"]
        stat = self.path.stat()
        self.mtime_ns = stat.st_mtime_ns
        self.size = stat.st_size
        return doc

    def save(self, doc: dict, base_rev) -> dict | None:
        with self.lock:
            if base_rev is not None and int(base_rev) != self.rev:
                return None
            saved = self._commit(doc)
            self._notify({"rev": self.rev, "external": False})
            return saved

    def delete_project(self, project_id: str) -> dict | None:
        """Atomically delete one project, so a stale full-document save cannot resurrect it."""
        with self.lock:
            doc = normalize(read_json(self.path))
            before = len(doc["projects"])
            doc["projects"] = [p for p in doc["projects"] if p.get("id") != project_id]
            if len(doc["projects"]) == before:
                return None
            saved = self._commit(doc)
            self._notify({"rev": self.rev, "external": False})
            return saved

    def replace(self, doc: dict) -> dict:
        with self.lock:
            saved = self._commit(doc)
            self._notify({"rev": self.rev, "external": False})
            return saved

    # -- 监听 -------------------------------------------------------------- #

    def add_listener(self, q: queue.Queue) -> None:
        self.listeners.add(q)

    def remove_listener(self, q: queue.Queue) -> None:
        self.listeners.discard(q)

    def _notify(self, payload: dict) -> None:
        for q in list(self.listeners):
            try:
                q.put_nowait(payload)
            except Exception:
                pass

    def notify_external(self, kind: str = "external") -> None:
        """让打开着的窗口把这次外部写入读进来。"""
        self._notify({"rev": self.rev, "external": True, "kind": kind})

    def start_watcher(self) -> None:
        threading.Thread(target=self._watch_loop, name="file-watch", daemon=True).start()

    def _watch_loop(self) -> None:
        while not self.stop_event.wait(0.9):
            try:
                stat = self.path.stat()
            except OSError:
                continue
            if stat.st_mtime_ns == self.mtime_ns and stat.st_size == self.size:
                continue
            try:
                doc = normalize(read_json(self.path))
            except Exception:
                continue
            with self.lock:
                self.rev = doc["rev"]
                self.mtime_ns = stat.st_mtime_ns
                self.size = stat.st_size
            self._notify({"rev": self.rev, "external": True})


# --------------------------------------------------------------------------- #
# Markdown 导出
# --------------------------------------------------------------------------- #

STATUS_LABEL = {"planned": "未来", "active": "进行中", "paused": "暂停", "done": "已完成"}
STATUS_ORDER = ("active", "paused", "planned", "done")


def export_markdown(doc: dict) -> str:
    lines = ["# 科研日志", "", f"> 导出时间：{now_iso()}", ""]
    projects = [p for p in doc["projects"] if not p.get("archived")]
    for status in STATUS_ORDER:
        group = [p for p in projects if p.get("status") == status]
        if not group:
            continue
        lines.append(f"## {STATUS_LABEL[status]}（{len(group)}）")
        lines.append("")
        for project in group:
            lines.append(f"### {project.get('title') or '未命名项目'}")
            if project.get("field"):
                lines.append(f"- 领域：{project['field']}")
            if project.get("startDate"):
                lines.append(f"- 开始：{project['startDate']}")
            if project.get("targetDate"):
                lines.append(f"- 目标日期：{project['targetDate']}")
            if project.get("completedAt"):
                lines.append(f"- 完成于：{str(project['completedAt'])[:10]}")
            goal = project.get("goal") or {}
            if goal.get("text"):
                lines.append("")
                lines.append(f"**大目标**：{goal['text']}")
            if goal.get("criteria"):
                lines.append(f"**成功判据**：{goal['criteria']}")
            items = project.get("milestones") or []
            if items:
                lines.append("")
                done = sum(1 for m in items if m.get("done"))
                lines.append(f"**小目标**（{done}/{len(items)}）")
                for item in items:
                    mark = "x" if item.get("done") else " "
                    suffix = ""
                    if item.get("done") and item.get("doneAt"):
                        suffix = f" —— {str(item['doneAt'])[:10]}"
                    elif item.get("due"):
                        suffix = f" —— 截止 {item['due']}"
                    lines.append(f"- [{mark}] {item.get('text')}{suffix}")
            entries = [e for e in doc["entries"] if e.get("projectId") == project.get("id")]
            if entries:
                lines.append("")
                lines.append("**进展**")
                for entry in sorted(entries, key=lambda e: e.get("at", "")):
                    day = str(entry.get("at", ""))[:10]
                    lines.append(f"- {day} {entry.get('text')}")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


# --------------------------------------------------------------------------- #
# 项目资料（文件夹 / 文件引用）
# --------------------------------------------------------------------------- #

PICKER_SCRIPT = r'''
import json
import sys
import tkinter as tk
from tkinter import filedialog

mode = sys.argv[1] if len(sys.argv) > 1 else "files"
root = tk.Tk()
root.withdraw()
root.attributes("-topmost", True)
root.update_idletasks()
try:
    if mode == "folder":
        path = filedialog.askdirectory(parent=root, title="选择要挂到项目上的文件夹")
        result = [path] if path else []
    else:
        paths = filedialog.askopenfilenames(
            parent=root,
            title="选择要挂到项目上的文件",
            filetypes=[("PDF", "*.pdf"), ("所有文件", "*.*")],
        )
        result = list(paths)
finally:
    root.destroy()
print(json.dumps(result, ensure_ascii=False))
'''


def resource_add(project_id, paths, category="ref"):
    if not project_id:
        raise HttpError(400, "缺少项目")
    if category not in ("ref", "repo", "note"):
        category = "ref"
    with APP.store.lock:
        rev, doc = APP.store.snapshot()
        project = next((p for p in doc["projects"] if p.get("id") == project_id), None)
        if project is None:
            raise HttpError(404, "项目不存在")
        existing = {str(r.get("path", "")).casefold() for r in project.get("resources", [])}
        added = []
        for raw in paths or []:
            text = str(raw or "").strip().strip('"')
            if not text:
                continue
            target = Path(text).expanduser()
            try:
                exists = target.exists()
            except OSError:
                exists = False
            if not exists:
                continue
            key = str(target).casefold()
            if key in existing:
                continue
            item = {
                "id": "r_" + os.urandom(4).hex(),
                "path": str(target),
                "kind": "dir" if target.is_dir() else "file",
                "category": category,
                "label": target.name or str(target),
                "addedAt": now_iso(),
            }
            project.setdefault("resources", []).append(item)
            existing.add(key)
            added.append(item)
        if not added:
            return {"ok": True, "added": [], "rev": APP.store.rev}
        project["updatedAt"] = now_iso()
        saved = APP.store.save(doc, rev)
        if saved is None:
            raise HttpError(409, "数据刚被修改过，请重试")
        APP.store.notify_external("resources")
        return {"ok": True, "added": added, "rev": saved["rev"]}


def _find_resource(doc, project_id, resource_id):
    project = next((p for p in doc["projects"] if p.get("id") == project_id), None)
    if project is None:
        raise HttpError(404, "项目不存在")
    item = next((r for r in project.get("resources", []) if r.get("id") == resource_id), None)
    if item is None:
        raise HttpError(404, "资料不存在")
    return project, item


def resource_open(project_id, resource_id):
    _, doc = APP.store.snapshot()
    _, item = _find_resource(doc, project_id, resource_id)
    path = Path(str(item.get("path") or ""))
    try:
        exists = path.exists()
    except OSError:
        exists = False
    if not exists:
        raise HttpError(404, "路径不存在，可能被移动或删除了")
    try:
        if path.is_dir():
            # ShellExecute on a directory can fail inside a packaged/sandboxed
            # Python (WinError 5). Explorer itself is allowed, and is what
            # users expect for a project folder anyway.
            subprocess.Popen(["explorer.exe", str(path)], close_fds=True)
        else:
            try:
                os.startfile(str(path))  # noqa: S606 - 用户明确添加过的本地路径
            except OSError:
                subprocess.Popen(["cmd.exe", "/c", "start", "", str(path)], close_fds=True)
    except Exception as exc:  # pragma: no cover
        raise HttpError(500, f"打不开：{exc}")
    return {"ok": True, "name": path.name, "kind": "dir" if path.is_dir() else "file"}


TEXT_SUFFIXES = {".md", ".markdown", ".txt", ".tex", ".bib"}


def resource_read(project_id, resource_id):
    """读取项目里的 Markdown / 文本文件，供内置阅读器显示。"""
    _, doc = APP.store.snapshot()
    _, item = _find_resource(doc, project_id, resource_id)
    path = Path(str(item.get("path") or ""))
    if not path.is_file():
        raise HttpError(400, "这个资料不是文件，无法在线阅读")
    if path.suffix.lower() not in TEXT_SUFFIXES:
        raise HttpError(400, "只支持 Markdown / 文本文件")
    try:
        size = path.stat().st_size
    except OSError:
        raise HttpError(404, "文件不存在，可能被移动或删除了")
    if size > 4 * 1024 * 1024:
        raise HttpError(413, "文件超过 4 MB，暂不支持在线阅读")
    raw = path.read_bytes()
    text = None
    for encoding in ("utf-8-sig", "utf-8", "gb18030"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise HttpError(400, "无法识别文件编码")
    return {
        "ok": True,
        "name": path.name,
        "path": str(path),
        "text": text,
        "mtime": int(path.stat().st_mtime),
        "size": size,
    }


def resource_reveal(project_id, resource_id):
    """在资源管理器里定位：文件则选中它，文件夹则打开它。"""
    _, doc = APP.store.snapshot()
    _, item = _find_resource(doc, project_id, resource_id)
    path = Path(str(item.get("path") or ""))
    try:
        exists = path.exists()
    except OSError:
        exists = False
    if not exists:
        raise HttpError(404, "路径不存在，可能被移动或删除了")
    try:
        if path.is_dir():
            os.startfile(str(path))  # noqa: S606
        else:
            subprocess.Popen(f'explorer.exe /select,"{path}"', close_fds=True)
    except Exception as exc:  # pragma: no cover
        raise HttpError(500, f"打不开：{exc}")
    return {"ok": True}


def resource_remove(project_id, resource_id):
    with APP.store.lock:
        rev, doc = APP.store.snapshot()
        project, _ = _find_resource(doc, project_id, resource_id)
        project["resources"] = [r for r in project["resources"] if r.get("id") != resource_id]
        project["updatedAt"] = now_iso()
        saved = APP.store.save(doc, rev)
        if saved is None:
            raise HttpError(409, "数据刚被修改过，请重试")
        APP.store.notify_external()
        return {"ok": True, "rev": saved["rev"]}


def pick_paths(mode):
    python = Path(sys.executable)
    if python.name.lower() == "pythonw.exe":
        python = python.with_name("python.exe")
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    flags = 0x08000000 if os.name == "nt" else 0  # CREATE_NO_WINDOW
    try:
        proc = subprocess.run(
            [str(python), "-X", "utf8", "-c", PICKER_SCRIPT, mode],
            capture_output=True, text=True, encoding="utf-8", timeout=300, env=env,
            creationflags=flags,
        )
    except subprocess.TimeoutExpired:
        raise HttpError(408, "选择框超时")
    except OSError as exc:
        raise HttpError(500, f"无法打开选择框：{exc}")
    if proc.returncode != 0:
        lines = [line for line in (proc.stderr or "").strip().splitlines() if line.strip()]
        raise HttpError(500, lines[-1] if lines else "选择框启动失败")
    lines = [line for line in (proc.stdout or "").strip().splitlines() if line.strip()]
    if not lines:
        return []
    try:
        data = json.loads(lines[-1])
    except json.JSONDecodeError:
        return []
    return [str(item) for item in data if item]


def launch_drop_window(project_id, category="ref"):
    if not project_id:
        raise HttpError(400, "缺少项目")
    if category not in ("ref", "repo", "note"):
        category = "ref"
    exe = APP_ROOT / "添加资料.exe"
    if not exe.exists():
        raise HttpError(500, "缺少 添加资料.exe，请重新安装程序")
    try:
        flags = 0x00000008 if os.name == "nt" else 0  # DETACHED_PROCESS
        subprocess.Popen(
            [str(exe), "--project", str(project_id), "--port", str(APP.port), "--category", category],
            close_fds=True, creationflags=flags,
        )
    except OSError as exc:
        raise HttpError(500, f"无法启动接收窗口：{exc}")
    return {"ok": True}


# --------------------------------------------------------------------------- #
# HTTP 服务
# --------------------------------------------------------------------------- #

class App:
    def __init__(self, store: Store, port: int):
        self.store = store
        self.port = port
        self.last_activity = time.time()
        self.bye_at: float | None = None
        self.sse_clients = 0
        self.started = time.time()


APP: App | None = None


class Handler(BaseHTTPRequestHandler):
    server_version = "ResearchLog/1.0"
    protocol_version = "HTTP/1.1"

    # -- 输出工具 ---------------------------------------------------------- #

    def log_message(self, fmt, *args):  # 静默
        return

    def _json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _text(self, text, status=200, content_type="text/plain; charset=utf-8", extra=None):
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return None
        if length > MAX_BODY:
            raise ValueError("请求体过大")
        return json.loads(self.rfile.read(length).decode("utf-8"))

    # -- 路由 -------------------------------------------------------------- #

    def do_GET(self):
        route({"GET"}, self, self._get)

    def do_PUT(self):
        route({"PUT"}, self, self._put)

    def do_POST(self):
        route({"POST"}, self, self._post)

    def do_DELETE(self):
        route({"DELETE"}, self, self._delete)

    def _touch(self):
        APP.last_activity = time.time()
        APP.bye_at = None

    def _get(self, path, query):
        self._touch()
        if path == "/api/health":
            return self._json({"ok": True, "rev": APP.store.rev, "started": APP.started})
        if path == "/api/state":
            rev, doc = APP.store.snapshot()
            return self._json({"rev": rev, "data": doc, "dataPath": str(APP.store.path)})
        if path == "/api/events":
            return self._sse()
        if path == "/api/export":
            fmt = (query.get("format") or ["md"])[0]
            if fmt == "json":
                rev, doc = APP.store.snapshot()
                return self._text(
                    json.dumps(doc, ensure_ascii=False, indent=2),
                    content_type="application/json; charset=utf-8",
                    extra={"Content-Disposition": "attachment; filename=research-log.json"},
                )
            rev, doc = APP.store.snapshot()
            return self._text(
                export_markdown(doc),
                content_type="text/markdown; charset=utf-8",
                extra={"Content-Disposition": "attachment; filename=research-log.md"},
            )
        return self._static(path)

    def _put(self, path, query):
        self._touch()
        if path == "/api/state":
            payload = self._read_body() or {}
            doc = payload.get("data")
            base_rev = payload.get("rev")
            saved = APP.store.save(doc, base_rev)
            if saved is None:
                rev, current = APP.store.snapshot()
                return self._json({"ok": False, "error": "conflict", "rev": rev, "data": current}, 409)
            return self._json({"ok": True, "rev": saved["rev"]})
        raise HttpError(404, "未知接口")

    def _delete(self, path, query):
        self._touch()
        prefix = "/api/projects/"
        if path.startswith(prefix):
            project_id = urllib.parse.unquote(path[len(prefix):].strip("/"))
            if not project_id:
                raise HttpError(400, "缺少项目")
            saved = APP.store.delete_project(project_id)
            if saved is None:
                raise HttpError(404, "项目不存在")
            return self._json({"ok": True, "rev": saved["rev"]})
        raise HttpError(404, "未知接口")

    def _post(self, path, query):
        self._touch()
        if path == "/api/resources/add":
            payload = self._read_body() or {}
            return self._json(resource_add(
                payload.get("projectId"), payload.get("paths") or [], payload.get("category") or "ref",
            ))
        if path == "/api/resources/open":
            payload = self._read_body() or {}
            return self._json(resource_open(payload.get("projectId"), payload.get("resourceId")))
        if path == "/api/resources/read":
            payload = self._read_body() or {}
            return self._json(resource_read(payload.get("projectId"), payload.get("resourceId")))
        if path == "/api/resources/reveal":
            payload = self._read_body() or {}
            return self._json(resource_reveal(payload.get("projectId"), payload.get("resourceId")))
        if path == "/api/resources/remove":
            payload = self._read_body() or {}
            return self._json(resource_remove(payload.get("projectId"), payload.get("resourceId")))
        if path == "/api/resources/pick":
            payload = self._read_body() or {}
            return self._json({"ok": True, "paths": pick_paths(payload.get("mode") or "files")})
        if path == "/api/resources/drop-window":
            payload = self._read_body() or {}
            return self._json(launch_drop_window(
                payload.get("projectId"), payload.get("category") or "ref",
            ))
        if path == "/api/import":
            payload = self._read_body() or {}
            doc = payload.get("data") or payload
            saved = APP.store.replace(doc)
            return self._json({"ok": True, "rev": saved["rev"]})
        if path == "/api/reveal":
            try:
                os.startfile(str(APP.store.dir))  # noqa: S606 - 本地程序，打开数据目录
            except Exception as exc:  # pragma: no cover
                return self._json({"ok": False, "error": str(exc)}, 500)
            return self._json({"ok": True})
        if path == "/api/bye":
            APP.bye_at = time.time() + BYE_GRACE_SECONDS
            return self._json({"ok": True})
        if path == "/api/quit":
            threading.Timer(0.4, lambda: os._exit(0)).start()
            return self._json({"ok": True})
        if path == "/api/hello":
            return self._json({"ok": True, "rev": APP.store.rev})
        raise HttpError(404, "未知接口")

    def _sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        q: queue.Queue = queue.Queue()
        APP.store.add_listener(q)
        APP.sse_clients += 1
        try:
            self.wfile.write(b": connected\n\n")
            self.wfile.flush()
            while True:
                try:
                    item = q.get(timeout=20)
                except queue.Empty:
                    item = None
                if item is None:
                    self.wfile.write(b": ping\n\n")
                else:
                    self.wfile.write(("data: " + json.dumps(item) + "\n\n").encode("utf-8"))
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            APP.sse_clients -= 1
            APP.store.remove_listener(q)
        return None

    def _static(self, path):
        rel = path.lstrip("/") or "index.html"
        if rel == "":
            rel = "index.html"
        target = (WEB_DIR / rel).resolve()
        if not str(target).startswith(str(WEB_DIR.resolve())) or not target.is_file():
            target = WEB_DIR / "index.html"
            if not target.is_file():
                return self._text("界面文件缺失", 500)
        data = target.read_bytes()
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        if target.suffix == ".js":
            ctype = "text/javascript; charset=utf-8"
        elif target.suffix in (".css",):
            ctype = "text/css; charset=utf-8"
        elif target.suffix == ".html":
            ctype = "text/html; charset=utf-8"
        elif target.suffix == ".svg":
            ctype = "image/svg+xml"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)
        return None


class HttpError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def route(methods: set[str], handler: Handler, fn) -> None:
    try:
        parsed = urllib.parse.urlparse(handler.path)
        query = urllib.parse.parse_qs(parsed.query)
        fn(parsed.path, query)
    except HttpError as exc:
        try:
            handler._json({"ok": False, "error": exc.message}, exc.status)
        except Exception:
            pass
    except (BrokenPipeError, ConnectionResetError):
        pass
    except Exception as exc:  # pragma: no cover - 兜底
        try:
            handler._json({"ok": False, "error": f"{type(exc).__name__}: {exc}"}, 500)
        except Exception:
            pass


# --------------------------------------------------------------------------- #
# 启动
# --------------------------------------------------------------------------- #

def load_config() -> dict:
    cfg = {}
    if CONFIG_PATH.exists():
        try:
            cfg = read_json(CONFIG_PATH)
        except Exception:
            cfg = {}
    if not isinstance(cfg, dict):
        cfg = {}
    # 默认放在程序目录下，整个文件夹可以整体拷走；以后可在 config.json 里改成任意目录。
    cfg.setdefault("dataDir", "data")
    cfg.setdefault("port", DEFAULT_PORT)
    override = os.environ.get("RESEARCH_LOG_DATA")
    if override:
        cfg["dataDir"] = override
    port_override = os.environ.get("RESEARCH_LOG_PORT")
    if port_override:
        cfg["port"] = int(port_override)
    if not override and not port_override:
        write_json_atomic(CONFIG_PATH, cfg)
    return cfg


def bind_server(preferred: int) -> tuple[ThreadingHTTPServer, int]:
    last_error = None
    for offset in range(PORT_TRIES):
        port = preferred + offset
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            httpd.daemon_threads = True
            return httpd, port
        except OSError as exc:
            last_error = exc
            continue
    raise SystemExit(f"无法监听本地端口：{last_error}")


def watchdog(app: App) -> None:
    while True:
        time.sleep(2)
        now = time.time()
        if app.bye_at and now > app.bye_at and app.sse_clients == 0:
            time.sleep(0.5)
            if app.sse_clients == 0:
                os._exit(0)
        if now - app.last_activity > IDLE_EXIT_SECONDS and app.sse_clients == 0:
            os._exit(0)


def main() -> None:
    global APP
    cfg = load_config()
    data_dir = Path(cfg["dataDir"])
    if not data_dir.is_absolute():
        data_dir = (APP_ROOT / data_dir).resolve()
    store = Store(data_dir)
    store.ensure()
    store.start_watcher()

    httpd, port = bind_server(int(cfg.get("port") or DEFAULT_PORT))
    APP = App(store, port)

    runtime = {"port": port, "url": f"http://127.0.0.1:{port}/", "pid": os.getpid(), "startedAt": now_iso()}
    write_json_atomic(RUNTIME_PATH, runtime)
    threading.Thread(target=watchdog, args=(APP,), daemon=True).start()

    try:
        print(f"[research-log] {runtime['url']} -> {store.path}", flush=True)
    except Exception:
        pass
    httpd.serve_forever(poll_interval=0.5)


if __name__ == "__main__":
    main()
