#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""科研日志的 MCP 服务端（stdio）。

把 rlog.cmd 的能力暴露成 MCP 工具，供 Codex / Claude 等客户端直接调用。
协议：JSON-RPC 2.0，每行一条消息；stdout 只写协议消息，日志写 stderr。

用法（由 MCP 客户端启动，一般不用手动运行）：
    python tools/mcp_server.py
调试：
    python tools/mcp_server.py < requests.jsonl > responses.jsonl
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import sys
import traceback
from pathlib import Path

if os.name == "nt":
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import rlog  # noqa: E402

SERVER_NAME = "research-log"
SERVER_VERSION = "0.1.0"
SUPPORTED_PROTOCOLS = ("2025-06-18", "2025-03-26", "2024-11-05")
DEFAULT_PROTOCOL = "2025-06-18"


# --------------------------------------------------------------------------- #
# 工具定义
# --------------------------------------------------------------------------- #

TOOLS = [
    {
        "name": "log_list",
        "title": "列出科研项目",
        "description": "列出科研日志中的项目（可按状态筛选），返回标题、状态、大目标和小目标进度。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["all", "active", "planned", "paused", "done"],
                    "description": "筛选状态；active 会同时包含暂停的项目。默认 all。",
                }
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "log_show",
        "title": "查看项目详情",
        "description": "按项目名（可写部分名称）或 id 查看一个项目的大目标、小目标清单和最近的进展记录。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "项目名称或 id，支持部分匹配。"}
            },
            "required": ["project"],
            "additionalProperties": False,
        },
    },
    {
        "name": "log_create_project",
        "title": "新建项目",
        "description": "新建一个科研项目。大目标建议一句话说清要达成什么。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "项目名称，例如「微流控液滴实验」。"},
                "field": {"type": "string", "description": "研究领域或标签，可省略。"},
                "goal": {"type": "string", "description": "大目标，一句话。"},
                "criteria": {"type": "string", "description": "成功判据：怎样算达成。"},
                "target_date": {"type": "string", "description": "目标日期 YYYY-MM-DD，可省略。"},
                "status": {
                    "type": "string",
                    "enum": ["planned", "active", "paused", "done"],
                    "description": "初始状态，默认 active；还没启动的想法用 planned。",
                },
            },
            "required": ["title"],
            "additionalProperties": False,
        },
    },
    {
        "name": "log_add_milestone",
        "title": "添加小目标",
        "description": "给某个项目添加一个小目标（可勾选的任务）。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "项目名称或 id。"},
                "text": {"type": "string", "description": "小目标内容。"},
                "due": {"type": "string", "description": "截止日期 YYYY-MM-DD，可省略。"},
                "note": {"type": "string", "description": "备注，可省略。"},
            },
            "required": ["project", "text"],
            "additionalProperties": False,
        },
    },
    {
        "name": "log_check_milestone",
        "title": "勾选 / 取消小目标",
        "description": "把某个小目标标记为完成，或取消完成。写入后打开着的窗口会自动刷新。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "项目名称或 id。"},
                "milestone": {"type": "string", "description": "小目标名称，支持部分匹配。"},
                "done": {"type": "boolean", "description": "true 表示完成，false 表示取消完成。默认 true。"},
            },
            "required": ["project", "milestone"],
            "additionalProperties": False,
        },
    },
    {
        "name": "log_delete_milestone",
        "title": "删除小目标",
        "description": "从项目中删除一个小目标。删除前请先向用户确认。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "项目名称或 id。"},
                "milestone": {"type": "string", "description": "小目标名称。"},
            },
            "required": ["project", "milestone"],
            "additionalProperties": False,
        },
    },
    {
        "name": "log_add_note",
        "title": "记录一条进展",
        "description": "写一条进展日志；可以挂在某个项目下，也可以作为全局记录。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string", "description": "进展内容，例如「跑通基线，聚类结果和原文一致」。"},
                "project": {"type": "string", "description": "项目名称或 id；省略则记为全局进展。"},
            },
            "required": ["text"],
            "additionalProperties": False,
        },
    },
    {
        "name": "log_set_status",
        "title": "修改项目状态",
        "description": "把项目改为 未来 / 进行中 / 暂停 / 已完成。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "项目名称或 id。"},
                "status": {"type": "string", "enum": ["planned", "active", "paused", "done"]},
            },
            "required": ["project", "status"],
            "additionalProperties": False,
        },
    },
    {
        "name": "log_set_goal",
        "title": "修改大目标",
        "description": "修改项目的大目标文本、成功判据或目标日期（只传要改的字段）。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "项目名称或 id。"},
                "text": {"type": "string", "description": "新的大目标。"},
                "criteria": {"type": "string", "description": "新的成功判据。"},
                "target_date": {"type": "string", "description": "目标日期 YYYY-MM-DD。"},
            },
            "required": ["project"],
            "additionalProperties": False,
        },
    },
    {
        "name": "log_rename_project",
        "title": "重命名项目",
        "description": "修改项目名称。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "项目名称或 id。"},
                "title": {"type": "string", "description": "新名称。"},
            },
            "required": ["project", "title"],
            "additionalProperties": False,
        },
    },
    {
        "name": "log_export",
        "title": "导出科研日志",
        "description": "把整份科研日志导出为 Markdown（适合贴进周报）或 JSON（完整备份）。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "format": {"type": "string", "enum": ["md", "json"], "description": "导出格式。"}
            },
            "required": ["format"],
            "additionalProperties": False,
        },
    },
    {
        "name": "log_delete_project",
        "title": "删除项目",
        "description": "删除项目及其小目标和进展记录。不可恢复，必须先向用户确认再把 confirm 设为 true。",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "项目名称或 id。"},
                "confirm": {"type": "boolean", "description": "必须显式设为 true，否则拒绝执行。"},
            },
            "required": ["project", "confirm"],
            "additionalProperties": False,
        },
    },
]


# --------------------------------------------------------------------------- #
# 调用 rlog（复用同一套命令逻辑）
# --------------------------------------------------------------------------- #

def call_rlog(argv, json_mode=True):
    buffer = io.StringIO()
    code = 0
    try:
        with contextlib.redirect_stdout(buffer):
            code = rlog.main(list(argv) + (["--json"] if json_mode else []))
    except SystemExit as exc:
        code = exc.code if isinstance(exc.code, int) else 1
    text = buffer.getvalue().strip()
    payload = None
    if text.startswith(("{", "[")):
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            payload = None
    return code, text, payload


def require_text(args, key):
    value = str(args.get(key) or "").strip()
    if not value:
        raise ValueError(f"缺少参数 {key}")
    return value


def tool_call(name, arguments):
    args = arguments or {}
    if name == "log_list":
        status = args.get("status") or "all"
        code, text, payload = call_rlog(["list", "--status", str(status)])
        return code, payload if payload is not None else text

    if name == "log_show":
        code, text, payload = call_rlog(["show", require_text(args, "project")])
        return code, payload if payload is not None else text

    if name == "log_create_project":
        argv = ["add-project", require_text(args, "title")]
        for key, flag in (("field", "--field"), ("goal", "--goal"), ("criteria", "--criteria"),
                          ("target_date", "--target-date"), ("status", "--status")):
            value = args.get(key)
            if value:
                argv += [flag, str(value)]
        code, text, payload = call_rlog(argv)
        return code, payload if payload is not None else text

    if name == "log_add_milestone":
        argv = ["add", require_text(args, "project"), require_text(args, "text")]
        if args.get("due"):
            argv += ["--due", str(args["due"])]
        if args.get("note"):
            argv += ["--note", str(args["note"])]
        code, text, payload = call_rlog(argv)
        return code, payload if payload is not None else text

    if name == "log_check_milestone":
        done = args.get("done", True)
        command = "done" if done else "undone"
        code, text, payload = call_rlog([command, require_text(args, "project"), require_text(args, "milestone")])
        return code, payload if payload is not None else text

    if name == "log_delete_milestone":
        code, text, payload = call_rlog(["rm", require_text(args, "project"), require_text(args, "milestone")])
        return code, payload if payload is not None else text

    if name == "log_add_note":
        argv = ["note", require_text(args, "text")]
        if args.get("project"):
            argv += ["--project", str(args["project"])]
        else:
            argv += ["--global"]
        code, text, payload = call_rlog(argv)
        return code, payload if payload is not None else text

    if name == "log_set_status":
        code, text, payload = call_rlog(["status", require_text(args, "project"), require_text(args, "status")])
        return code, payload if payload is not None else text

    if name == "log_set_goal":
        argv = ["goal", require_text(args, "project")]
        for key, flag in (("text", "--text"), ("criteria", "--criteria"), ("target_date", "--target-date")):
            if args.get(key) is not None:
                argv += [flag, str(args[key])]
        if len(argv) == 2:
            raise ValueError("至少要提供 text / criteria / target_date 之一")
        code, text, payload = call_rlog(argv)
        return code, payload if payload is not None else text

    if name == "log_rename_project":
        code, text, payload = call_rlog(["rename", require_text(args, "project"), require_text(args, "title")])
        return code, payload if payload is not None else text

    if name == "log_export":
        fmt = require_text(args, "format")
        if fmt not in ("md", "json"):
            raise ValueError("format 只能是 md 或 json")
        code, text, payload = call_rlog(["export", fmt], json_mode=False)
        return code, text

    if name == "log_delete_project":
        if args.get("confirm") is not True:
            raise ValueError("删除项目不可恢复：请先向用户确认，再把 confirm 设为 true")
        code, text, payload = call_rlog(["delete-project", require_text(args, "project"), "--yes"])
        return code, payload if payload is not None else text

    raise ValueError(f"未知工具：{name}")


# --------------------------------------------------------------------------- #
# JSON-RPC
# --------------------------------------------------------------------------- #

def write_message(message):
    sys.stdout.write(json.dumps(message, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def result(request_id, payload):
    write_message({"jsonrpc": "2.0", "id": request_id, "result": payload})


def error(request_id, code, message):
    write_message({"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}})


def handle_initialize(request_id, params):
    requested = (params or {}).get("protocolVersion")
    version = requested if requested in SUPPORTED_PROTOCOLS else DEFAULT_PROTOCOL
    result(request_id, {
        "protocolVersion": version,
        "capabilities": {"tools": {"listChanged": False}},
        "serverInfo": {"name": SERVER_NAME, "title": "科研日志", "version": SERVER_VERSION},
    })


def handle_tools_call(request_id, params):
    name = (params or {}).get("name")
    arguments = (params or {}).get("arguments") or {}
    try:
        code, payload = tool_call(name, arguments)
    except Exception as exc:
        print(f"[research-log] tool {name} failed: {exc}", file=sys.stderr)
        result(request_id, {
            "content": [{"type": "text", "text": f"执行失败：{exc}"}],
            "isError": True,
        })
        return

    if code != 0:
        if isinstance(payload, dict) and payload.get("error"):
            message = str(payload["error"])
        elif isinstance(payload, str) and payload:
            message = payload
        else:
            message = "命令执行失败（退出码 %s）" % code
        result(request_id, {
            "content": [{"type": "text", "text": message}],
            "isError": True,
        })
        return

    if isinstance(payload, str):
        text = payload
    else:
        text = json.dumps(payload, ensure_ascii=False, indent=2)
    result(request_id, {"content": [{"type": "text", "text": text}], "isError": False})


def dispatch(message):
    method = message.get("method")
    request_id = message.get("id")
    params = message.get("params")

    if method == "initialize":
        return handle_initialize(request_id, params)
    if method == "ping":
        return result(request_id, {})
    if method == "tools/list":
        return result(request_id, {"tools": TOOLS})
    if method == "tools/call":
        return handle_tools_call(request_id, params)
    if method in ("notifications/initialized", "notifications/cancelled"):
        return None
    if method == "resources/list":
        return result(request_id, {"resources": []})
    if method == "prompts/list":
        return result(request_id, {"prompts": []})
    if request_id is None:
        return None
    return error(request_id, -32601, f"Method not found: {method}")


def main() -> int:
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    except Exception:
        pass

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError:
            error(None, -32700, "Parse error")
            continue
        if isinstance(message, list):
            for item in message:
                if isinstance(item, dict):
                    dispatch(item)
            continue
        if not isinstance(message, dict):
            error(None, -32600, "Invalid Request")
            continue
        try:
            dispatch(message)
        except Exception as exc:  # pragma: no cover - 兜底，避免服务端退出
            print(f"[research-log] dispatch failed: {exc}\n{traceback.format_exc()}", file=sys.stderr)
            if message.get("id") is not None:
                error(message.get("id"), -32603, f"Internal error: {exc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
