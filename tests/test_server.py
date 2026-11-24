import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def test_health_and_state(tmp_path: Path) -> None:
    port = free_port()
    env = dict(os.environ)
    env["RESEARCH_LOG_DATA"] = str(tmp_path / "data")
    env["RESEARCH_LOG_PORT"] = str(port)
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"

    process = subprocess.Popen(
        [sys.executable, str(ROOT / "app" / "server.py")],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        deadline = time.time() + 20
        while time.time() < deadline:
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1) as response:
                    if response.status == 200:
                        break
            except OSError:
                time.sleep(0.3)
        else:
            raise AssertionError("server did not become healthy")

        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/state", timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))

        assert "data" in payload
        assert "projects" in payload["data"]
        assert payload["data"]["schemaVersion"] == 1
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
