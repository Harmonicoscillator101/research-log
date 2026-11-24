# Sample data

[简体中文](README.md) | English

- `demo-data/research-log.json`: fictional research log with 4 projects, covering all three statuses, milestones and progress;
- `demo-data-en/research-log.json`: English version of the sample data, useful for English screenshots or international users;
- All titles, notes and timestamps are for demonstration only; they contain no real research data or local paths.

## Usage

**Option 1: Import**

Open the app → top-right `⋯` → "Settings & backup" → "Import JSON", then select this file.

**Option 2: Replace directly**

```bat
copy examples\demo-data\research-log.json data\research-log.json
```

Back up your own `data/` first.

**Option 3: Read-only demo**

```bat
set RESEARCH_LOG_DATA=examples\demo-data
python app\server.py
```

Then open http://127.0.0.1:47823/. Note: changes will be written back to the sample file; restore it after experimenting.
