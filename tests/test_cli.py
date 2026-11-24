import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_cli(data_dir: Path, *args: str) -> subprocess.CompletedProcess:
    env = dict(os.environ)
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    return subprocess.run(
        [sys.executable, str(ROOT / "tools" / "rlog.py"), "--data", str(data_dir), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        timeout=30,
    )


def read_doc(data_dir: Path) -> dict:
    return json.loads((data_dir / "research-log.json").read_text("utf-8"))


def test_project_milestone_and_note(tmp_path: Path) -> None:
    data = tmp_path / "data"

    result = run_cli(data, "add-project", "测试项目", "--goal", "验证 CLI")
    assert result.returncode == 0, result.stderr
    doc = read_doc(data)
    assert doc["projects"][0]["title"] == "测试项目"
    assert doc["rev"] >= 1

    result = run_cli(data, "add", "测试项目", "跑通基线", "--due", "2026-12-01")
    assert result.returncode == 0, result.stderr
    doc = read_doc(data)
    milestone = doc["projects"][0]["milestones"][0]
    assert milestone["text"] == "跑通基线"
    assert milestone["due"] == "2026-12-01"

    result = run_cli(data, "done", "测试项目", "跑通基线")
    assert result.returncode == 0, result.stderr
    doc = read_doc(data)
    assert doc["projects"][0]["milestones"][0]["done"] is True

    result = run_cli(data, "note", "今天完成基线", "--project", "测试项目")
    assert result.returncode == 0, result.stderr
    doc = read_doc(data)
    assert any(entry["text"] == "今天完成基线" for entry in doc["entries"])


def test_export_markdown(tmp_path: Path) -> None:
    data = tmp_path / "data"
    assert run_cli(data, "add-project", "导出测试", "--goal", "导出").returncode == 0

    output = tmp_path / "out.md"
    result = run_cli(data, "export", "md", "--out", str(output))
    assert result.returncode == 0, result.stderr
    assert output.exists()
    text = output.read_text("utf-8")
    assert "导出测试" in text


def test_unknown_project_fails(tmp_path: Path) -> None:
    result = run_cli(tmp_path / "data", "show", "不存在的项目")
    assert result.returncode != 0
