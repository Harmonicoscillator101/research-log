#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""科研日志 —— 启动器。

双击快捷方式时：确保本地引擎在运行，然后打开一个独立的桌面窗口。
再次双击不会重复启动，只会把已有窗口带到前台。
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.json"
RUNTIME_PATH = ROOT / "runtime.json"
SERVER = ROOT / "app" / "server.py"
DEFAULT_PORT = 47823


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text("utf-8-sig"))
    except Exception:
        return {}


def port_to_check() -> int:
    cfg = read_json(CONFIG_PATH)
    try:
        return int(cfg.get("port") or DEFAULT_PORT)
    except Exception:
        return DEFAULT_PORT


def healthy(port: int, timeout: float = 0.8) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=timeout) as resp:
            return resp.status == 200
    except Exception:
        return False


def live_url() -> str | None:
    """优先按配置端口探活；失败则读引擎写下的 runtime.json。"""
    port = port_to_check()
    if healthy(port):
        return f"http://127.0.0.1:{port}/"
    runtime = read_json(RUNTIME_PATH)
    try:
        candidate = int(runtime.get("port") or 0)
    except Exception:
        candidate = 0
    if candidate and candidate != port and healthy(candidate):
        return f"http://127.0.0.1:{candidate}/"
    return None


def edge_path() -> str | None:
    candidates = [
        Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Microsoft/Edge/Application/msedge.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft/Edge/Application/msedge.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    try:
        import winreg

        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe",
        )
        with key:
            value, _ = winreg.QueryValueEx(key, "")
            if Path(value).is_file():
                return value
    except Exception:
        pass
    return None


def launch_window(url: str) -> None:
    edge = edge_path()
    if edge:
        args = [
            edge,
            f"--app={url}",
            "--window-size=1320,860",
            "--window-position=140,70",
            "--no-first-run",
            "--no-default-browser-check",
        ]
        debug_port = os.environ.get("RESEARCH_LOG_DEBUG_PORT")
        if debug_port:
            args.append(f"--remote-debugging-port={debug_port}")
        try:
            subprocess.Popen(args, close_fds=True)
            return
        except OSError:
            pass
    webbrowser.open(url)


def start_engine() -> None:
    runtime = RUNTIME_PATH
    if runtime.exists():
        try:
            runtime.unlink()
        except OSError:
            pass
    flags = 0
    if os.name == "nt":
        flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    subprocess.Popen(
        [sys.executable, str(SERVER)],
        cwd=str(ROOT),
        close_fds=True,
        creationflags=flags,
    )


def fail(message: str) -> None:
    try:
        import ctypes

        ctypes.windll.user32.MessageBoxW(0, message, "科研日志", 0x10)
    except Exception:
        print(message, file=sys.stderr)


def main() -> int:
    url = live_url()
    if url is None:
        start_engine()
        for _ in range(80):
            time.sleep(0.2)
            url = live_url()
            if url:
                break
    if not url:
        fail("本地引擎没有启动成功。\n请检查程序目录是否完整，或手动运行 app\\server.py 查看报错。")
        return 1
    if "--no-window" in sys.argv[1:]:
        return 0
    launch_window(url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
