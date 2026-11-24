import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_demo_data_is_valid() -> None:
    for folder in ("demo-data", "demo-data-en"):
        path = ROOT / "examples" / folder / "research-log.json"
        doc = json.loads(path.read_text("utf-8"))

        assert doc["schemaVersion"] == 1
        assert isinstance(doc["rev"], int)
        assert len(doc["projects"]) >= 3

        project_ids = [project["id"] for project in doc["projects"]]
        assert len(project_ids) == len(set(project_ids))

        for project in doc["projects"]:
            assert project["status"] in {"planned", "active", "paused", "done"}
            assert project["title"]
            for milestone in project["milestones"]:
                assert milestone["id"]
                assert isinstance(milestone["done"], bool)
            for resource in project.get("resources", []):
                assert Path(resource["path"]).is_absolute()
                assert resource["category"] in {"ref", "repo", "note"}
