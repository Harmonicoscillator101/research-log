import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_mcp_initialize_and_tools(tmp_path: Path) -> None:
    env = dict(os.environ)
    env["RESEARCH_LOG_DATA"] = str(tmp_path / "data")
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"

    requests = [
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "pytest", "version": "1.0"},
            },
        },
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "log_list", "arguments": {}},
        },
    ]
    payload = "\n".join(json.dumps(item, ensure_ascii=False) for item in requests) + "\n"

    result = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "mcp_server.py")],
        input=payload,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        timeout=30,
    )

    assert result.returncode == 0, result.stderr
    responses = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
    by_id = {item.get("id"): item for item in responses}

    assert by_id[1]["result"]["serverInfo"]["name"] == "research-log"
    tools = by_id[2]["result"]["tools"]
    names = {tool["name"] for tool in tools}
    assert "log_list" in names
    assert "log_add_note" in names
    assert len(names) >= 12

    content = by_id[3]["result"]["content"][0]["text"]
    assert "projects" in json.loads(content)
