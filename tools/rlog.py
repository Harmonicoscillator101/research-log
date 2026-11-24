#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""科研日志的命令行入口（给智能体 / 脚本 / 终端用）。

它直接复用 app/server.py 的数据层：同样的原子写入、每日备份、版本号，
写完后运行中的窗口会通过文件监听自动刷新，不需要重启程序。

用法见 `rlog.cmd --help` 或同目录的 AGENTS.md。
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app"))

import server as engine  # noqa: E402  （复用数据层，避免第二个实现）

STATUS_LABEL = {"planned": "未来", "active": "进行中", "paused": "暂停", "done": "已完成"}
STATUS_ORDER = ("active", "paused", "planned", "done")


# --------------------------------------------------------------------------- #
# 基础设施
# --------------------------------------------------------------------------- #

class Output:
    def __init__(self, as_json: bool):
        self.as_json = as_json

    def emit(self, payload, human: str):
        if self.as_json:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        else:
            print(human)


def resolve_data_dir(args) -> Path:
    if getattr(args, "data", None):
        return Path(args.data).expanduser().resolve()
    env = os.environ.get("RESEARCH_LOG_DATA")
    if env:
        return Path(env).expanduser().resolve()
    cfg_path = ROOT / "config.json"
    try:
        cfg = json.loads(cfg_path.read_text("utf-8-sig"))
    except Exception:
        cfg = {}
    raw = cfg.get("dataDir") if isinstance(cfg, dict) else None
    path = Path(raw or "data")
    return path if path.is_absolute() else (ROOT / path).resolve()


def uid(prefix: str) -> str:
    return prefix + time.strftime("%y%m%d%H%M%S") + os.urandom(2).hex()


class FileLock:
    """同一时间只允许一个 CLI 写入，避免并发覆盖。"""

    def __init__(self, folder: Path):
        self.path = folder / ".rlog.lock"
        self.handle = None

    def __enter__(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = open(self.path, "a+b")
        if os.name == "nt":
            import msvcrt

            deadline = time.time() + 10
            while True:
                try:
                    msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
                    break
                except OSError:
                    if time.time() > deadline:
                        raise SystemExit("另一个命令行进程正在写入，稍后再试")
                    time.sleep(0.2)
        return self

    def __exit__(self, *exc):
        if self.handle:
            try:
                if os.name == "nt":
                    import msvcrt

                    self.handle.seek(0)
                    msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, 1)
            except OSError:
                pass
            self.handle.close()
            self.handle = None


def open_store(folder: Path) -> engine.Store:
    store = engine.Store(folder)
    store.ensure()
    return store


def apply(store: engine.Store, mutate):
    """带重试的写入：文件被别处改动时重新读取再应用一次。"""
    last_error = None
    for attempt in range(4):
        rev, doc = store.snapshot()
        payload = mutate(doc)
        saved = store.save(doc, rev)
        if saved is not None:
            return payload, saved["rev"]
        last_error = "conflict"
        time.sleep(0.15 * (attempt + 1))
    raise SystemExit(f"写入冲突（{last_error}），请重试")


def norm(text: str) -> str:
    return " ".join(str(text).casefold().split())


def find_project(doc, needle: str) -> dict:
    projects = [p for p in doc["projects"] if not p.get("archived")]
    if not needle:
        raise SystemExit("请给出项目名")
    exact_id = [p for p in projects if p.get("id") == needle]
    if len(exact_id) == 1:
        return exact_id[0]
    key = norm(needle)
    exact = [p for p in projects if norm(p.get("title", "")) == key]
    if len(exact) == 1:
        return exact[0]
    partial = [p for p in projects if key in norm(p.get("title", ""))]
    if len(partial) == 1:
        return partial[0]
    if not partial:
        raise SystemExit(f"找不到项目「{needle}」。现有项目：\n" + "\n".join(
            f"  - {p.get('title')}" for p in projects) if projects else f"找不到项目「{needle}」，当前没有项目。")
    raise SystemExit("项目名不唯一，请写完整一些：\n" + "\n".join(
        f"  - {p.get('title')}  ({p.get('id')})" for p in partial))


def find_milestone(project: dict, needle: str) -> dict:
    items = project.get("milestones") or []
    if not items:
        raise SystemExit(f"项目「{project.get('title')}」还没有小目标")
    key = norm(needle)
    exact_id = [m for m in items if m.get("id") == needle]
    if len(exact_id) == 1:
        return exact_id[0]
    exact = [m for m in items if norm(m.get("text", "")) == key]
    if len(exact) == 1:
        return exact[0]
    partial = [m for m in items if key in norm(m.get("text", ""))]
    if len(partial) == 1:
        return partial[0]
    if not partial:
        raise SystemExit(f"找不到小目标「{needle}」。现有：\n" + "\n".join(
            f"  - [{'x' if m.get('done') else ' '}] {m.get('text')}" for m in items))
    raise SystemExit("小目标名不唯一，请写完整一些：\n" + "\n".join(
        f"  - {m.get('text')}  ({m.get('id')})" for m in partial))


def add_entry(doc, project_id, text, kind="auto"):
    doc["entries"].insert(0, {
        "id": uid("e"), "projectId": project_id, "at": engine.now_iso(),
        "kind": kind, "text": text,
    })


def progress(project):
    items = project.get("milestones") or []
    done = sum(1 for m in items if m.get("done"))
    return done, len(items)


def human_project_line(project) -> str:
    done, total = progress(project)
    pct = f"{done}/{total}" if total else "—"
    goal = (project.get("goal") or {}).get("text") or ""
    return (f"{project.get('title')}  [{STATUS_LABEL.get(project.get('status'), project.get('status'))}]"
            f"  {pct}" + (f"  · {goal[:40]}" if goal else ""))


# --------------------------------------------------------------------------- #
# 子命令
# --------------------------------------------------------------------------- #

def cmd_list(args, store, out):
    projects = [p for p in store.snapshot()[1]["projects"] if not p.get("archived")]
    if args.status and args.status != "all":
        if args.status == "active":
            projects = [p for p in projects if p.get("status") in ("active", "paused")]
        else:
            projects = [p for p in projects if p.get("status") == args.status]
    projects.sort(key=lambda p: STATUS_ORDER.index(p.get("status", "active"))
                  if p.get("status") in STATUS_ORDER else 9)
    if out.as_json:
        out.emit({"projects": [{
            "id": p["id"], "title": p.get("title"), "status": p.get("status"),
            "goal": (p.get("goal") or {}).get("text", ""),
            "done": progress(p)[0], "total": progress(p)[1],
            "milestones": [{"id": m["id"], "text": m.get("text"), "done": m.get("done"),
                            "due": m.get("due", "")} for m in p.get("milestones") or []],
        } for p in projects]}, "")
        return
    if not projects:
        print("没有项目。用 add-project 先建一个。")
        return
    for status in STATUS_ORDER:
        group = [p for p in projects if p.get("status") == status]
        if not group:
            continue
        print(f"\n{STATUS_LABEL[status]} ({len(group)})")
        for p in group:
            print("  " + human_project_line(p))


def cmd_show(args, store, out):
    _, doc = store.snapshot()
    p = find_project(doc, args.project)
    data = {
        "id": p["id"], "title": p.get("title"), "status": p.get("status"),
        "field": p.get("field", ""), "goal": p.get("goal"),
        "milestones": p.get("milestones"),
        "startDate": p.get("startDate"), "targetDate": p.get("targetDate"),
        "completedAt": p.get("completedAt"),
        "entries": [e for e in doc["entries"] if e.get("projectId") == p.get("id")],
    }
    if out.as_json:
        out.emit(data, "")
        return
    goal = p.get("goal") or {}
    print(f"{p.get('title')}   [{STATUS_LABEL.get(p.get('status'), p.get('status'))}]")
    if p.get("field"):
        print(f"领域：{p['field']}")
    if goal.get("text"):
        print(f"大目标：{goal['text']}")
    if goal.get("criteria"):
        print(f"成功判据：{goal['criteria']}")
    if goal.get("targetDate"):
        print(f"目标日期：{goal['targetDate']}")
    items = p.get("milestones") or []
    done, total = progress(p)
    print(f"\n小目标 {done}/{total}")
    for m in items:
        mark = "x" if m.get("done") else " "
        extra = []
        if m.get("due"):
            extra.append(f"截止 {m['due']}")
        if m.get("note"):
            extra.append("备注")
        print(f"  [{mark}] {m.get('text')}" + (f"  ({'; '.join(extra)})" if extra else ""))
    entries = [e for e in doc["entries"] if e.get("projectId") == p.get("id")][:8]
    if entries:
        print("\n最近进展")
        for e in entries:
            print(f"  {str(e.get('at'))[:16].replace('T', ' ')}  {e.get('text')}")


def cmd_add_project(args, store, out):
    def mutate(doc):
        project = {
            "id": uid("p"), "title": args.title, "field": args.field or "",
            "status": args.status, "goal": {"text": args.goal or "", "criteria": args.criteria or "",
                                             "targetDate": args.target_date or ""},
            "milestones": [], "notes": "", "createdAt": engine.now_iso(),
            "updatedAt": engine.now_iso(),
            "startDate": engine.today_tag() if args.status in ("active", "done") else "",
            "targetDate": "", "completedAt": engine.now_iso() if args.status == "done" else None,
            "archived": False, "order": -int(time.time()),
        }
        doc["projects"].append(project)
        add_entry(doc, project["id"], "创建项目（命令行）")
        return project
    project, rev = apply(store, mutate)
    out.emit({"id": project["id"], "title": project["title"], "rev": rev},
             f"已创建项目「{project['title']}」 ({project['id']})")


def cmd_rename(args, store, out):
    def mutate(doc):
        p = find_project(doc, args.project)
        old = p.get("title")
        p["title"] = args.title
        p["updatedAt"] = engine.now_iso()
        return old, p["id"]
    (old, _), rev = apply(store, mutate)
    out.emit({"from": old, "to": args.title, "rev": rev}, f"「{old}」已改名为「{args.title}」")


def cmd_status(args, store, out):
    def mutate(doc):
        p = find_project(doc, args.project)
        p["status"] = args.status
        p["updatedAt"] = engine.now_iso()
        if args.status == "done":
            p["completedAt"] = engine.now_iso()
        else:
            p["completedAt"] = None
        if args.status == "active" and not p.get("startDate"):
            p["startDate"] = engine.today_tag()
        add_entry(doc, p["id"], f"状态改为「{STATUS_LABEL[args.status]}」（命令行）")
        return p["title"]
    title, rev = apply(store, mutate)
    out.emit({"title": title, "status": args.status, "rev": rev},
             f"「{title}」状态改为 {STATUS_LABEL[args.status]}")


def cmd_goal(args, store, out):
    def mutate(doc):
        p = find_project(doc, args.project)
        goal = p.setdefault("goal", {})
        if args.text is not None:
            goal["text"] = args.text
        if args.criteria is not None:
            goal["criteria"] = args.criteria
        if args.target_date is not None:
            goal["targetDate"] = args.target_date
        p["updatedAt"] = engine.now_iso()
        return p["title"]
    title, rev = apply(store, mutate)
    out.emit({"title": title, "goal": args.text, "rev": rev}, f"已更新「{title}」的大目标")


def cmd_add(args, store, out):
    def mutate(doc):
        p = find_project(doc, args.project)
        item = {
            "id": uid("m"), "text": args.text, "done": False, "doneAt": None,
            "due": args.due or "", "note": args.note or "",
            "order": len(p.get("milestones") or []),
        }
        p.setdefault("milestones", []).append(item)
        p["updatedAt"] = engine.now_iso()
        return p["title"], item["id"]
    (title, mid), rev = apply(store, mutate)
    out.emit({"project": title, "id": mid, "text": args.text, "rev": rev},
             f"已给「{title}」添加小目标：{args.text}")


def cmd_done(args, store, out, done=True):
    def mutate(doc):
        p = find_project(doc, args.project)
        m = find_milestone(p, args.milestone)
        m["done"] = done
        m["doneAt"] = engine.now_iso() if done else None
        p["updatedAt"] = engine.now_iso()
        add_entry(doc, p["id"], ("完成" if done else "重新打开") + f"「{m['text']}」")
        return p["title"], m["text"]
    (title, text), rev = apply(store, mutate)
    out.emit({"project": title, "milestone": text, "done": done, "rev": rev},
             f"「{title}」{('已完成' if done else '已重新打开')}：{text}")


def cmd_rm(args, store, out):
    def mutate(doc):
        p = find_project(doc, args.project)
        m = find_milestone(p, args.milestone)
        p["milestones"] = [x for x in p["milestones"] if x["id"] != m["id"]]
        p["updatedAt"] = engine.now_iso()
        return p["title"], m["text"]
    (title, text), rev = apply(store, mutate)
    out.emit({"project": title, "removed": text, "rev": rev},
             f"已从「{title}」删除小目标：{text}")


def cmd_note(args, store, out):
    def mutate(doc):
        if args.global_entry or not args.project:
            add_entry(doc, None, args.text, "note")
            return None
        p = find_project(doc, args.project)
        add_entry(doc, p["id"], args.text, "note")
        return p["title"]
    title, rev = apply(store, mutate)
    where = f"「{title}」" if title else "全局"
    out.emit({"project": title, "text": args.text, "rev": rev}, f"已记录到{where}：{args.text}")


def cmd_delete_project(args, store, out):
    if not args.yes:
        raise SystemExit("删除项目是不可逆操作，请加 --yes 确认")
    def mutate(doc):
        p = find_project(doc, args.project)
        doc["projects"] = [x for x in doc["projects"] if x["id"] != p["id"]]
        doc["entries"] = [e for e in doc["entries"] if e.get("projectId") != p["id"]]
        return p["title"]
    title, rev = apply(store, mutate)
    out.emit({"deleted": title, "rev": rev}, f"已删除项目「{title}」")


def cmd_export(args, store, out):
    _, doc = store.snapshot()
    if args.format == "md":
        text = engine.export_markdown(doc)
    else:
        text = json.dumps(doc, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"已写入 {args.out}")
    else:
        print(text)


def cmd_where(args, store, out):
    print(f"数据文件：{store.path}")
    print(f"备份目录：{store.backup_dir}")
    print(f"当前版本：{store.rev}")


# --------------------------------------------------------------------------- #
# 参数
# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="rlog", description="科研日志命令行（智能体友好）")
    parser.add_argument("--data", help="临时指定数据目录（默认读 config.json）")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出，便于程序解析")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("list", help="列出项目")
    p.add_argument("--status", choices=["all", "active", "planned", "paused", "done"], default="all")

    p = sub.add_parser("show", help="查看一个项目")
    p.add_argument("project")

    p = sub.add_parser("add-project", help="新建项目")
    p.add_argument("title")
    p.add_argument("--field", default="")
    p.add_argument("--goal", default="")
    p.add_argument("--criteria", default="")
    p.add_argument("--target-date", default="")
    p.add_argument("--status", choices=list(STATUS_LABEL), default="active")

    p = sub.add_parser("rename", help="重命名项目")
    p.add_argument("project")
    p.add_argument("title")

    p = sub.add_parser("status", help="修改项目状态")
    p.add_argument("project")
    p.add_argument("status", choices=list(STATUS_LABEL))

    p = sub.add_parser("goal", help="设置大目标")
    p.add_argument("project")
    p.add_argument("--text")
    p.add_argument("--criteria")
    p.add_argument("--target-date")

    p = sub.add_parser("add", help="添加小目标")
    p.add_argument("project")
    p.add_argument("text")
    p.add_argument("--due", default="")
    p.add_argument("--note", default="")

    p = sub.add_parser("done", help="把某个小目标打勾")
    p.add_argument("project")
    p.add_argument("milestone")

    p = sub.add_parser("undone", help="取消某个小目标的勾")
    p.add_argument("project")
    p.add_argument("milestone")

    p = sub.add_parser("rm", help="删除某个小目标")
    p.add_argument("project")
    p.add_argument("milestone")

    p = sub.add_parser("note", help="记一条进展")
    p.add_argument("text")
    p.add_argument("--project", default="")
    p.add_argument("--global", dest="global_entry", action="store_true")

    p = sub.add_parser("delete-project", help="删除项目（需要 --yes）")
    p.add_argument("project")
    p.add_argument("--yes", action="store_true")

    p = sub.add_parser("export", help="导出 Markdown 或 JSON")
    p.add_argument("format", choices=["md", "json"])
    p.add_argument("--out", default="")

    sub.add_parser("where", help="显示数据文件位置")
    return parser


def normalize_argv(argv):
    """允许 --json / --data 写在命令后面，智能体拼命令时更省心。"""
    flags, rest = [], []
    index = 0
    while index < len(argv):
        item = argv[index]
        if item == "--json":
            flags.append(item)
            index += 1
        elif item == "--data" and index + 1 < len(argv):
            flags.extend([item, argv[index + 1]])
            index += 2
        elif item.startswith("--data="):
            flags.append(item)
            index += 1
        else:
            rest.append(item)
            index += 1
    return flags + rest


def main(argv=None) -> int:
    raw = list(sys.argv[1:] if argv is None else argv)
    parser = build_parser()
    args = parser.parse_args(normalize_argv(raw))
    out = Output(args.json)
    store = open_store(resolve_data_dir(args))

    try:
        if args.command == "list":
            cmd_list(args, store, out)
        elif args.command == "show":
            cmd_show(args, store, out)
        elif args.command == "add-project":
            with FileLock(ROOT):
                cmd_add_project(args, store, out)
        elif args.command == "rename":
            with FileLock(ROOT):
                cmd_rename(args, store, out)
        elif args.command == "status":
            with FileLock(ROOT):
                cmd_status(args, store, out)
        elif args.command == "goal":
            with FileLock(ROOT):
                cmd_goal(args, store, out)
        elif args.command == "add":
            with FileLock(ROOT):
                cmd_add(args, store, out)
        elif args.command == "done":
            with FileLock(ROOT):
                cmd_done(args, store, out, True)
        elif args.command == "undone":
            with FileLock(ROOT):
                cmd_done(args, store, out, False)
        elif args.command == "rm":
            with FileLock(ROOT):
                cmd_rm(args, store, out)
        elif args.command == "note":
            with FileLock(ROOT):
                cmd_note(args, store, out)
        elif args.command == "delete-project":
            with FileLock(ROOT):
                cmd_delete_project(args, store, out)
        elif args.command == "export":
            cmd_export(args, store, out)
        elif args.command == "where":
            cmd_where(args, store, out)
    except SystemExit as exc:
        if exc.code not in (0, None) and args.json:
            print(json.dumps({"ok": False, "error": str(exc.code)}, ensure_ascii=False))
        raise
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
