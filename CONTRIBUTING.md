# Contributing to ResearchLog

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

Thanks for your interest in ResearchLog. This project cares about three things above all: **data safety, offline availability, and agent-readable data**. Please keep them intact in every change.

## Development environment

- Windows 10 / 11
- Python 3.12+
- Any modern browser (Edge / Chrome)

```bat
git clone https://github.com/Harmonicoscillator101/research-log.git
cd research-log
python -m pip install -r requirements-dev.txt
python -m pytest
```

The runtime has **zero third-party dependencies**; `requirements-dev.txt` only contains test and lint tools.

## Run locally

```bat
:: Start the engine and the desktop window
python launch.py

:: Start the engine only, then open http://127.0.0.1:47823/ in a browser
python app\server.py
```

Always use a temporary data directory for tests. **Do not touch `data/`**:

```bat
python tools\rlog.py --data .tmp-test\data add-project "Test project"
set RESEARCH_LOG_DATA=.tmp-test\data
python app\server.py
```

## Project layout

| Path | Responsibility |
|---|---|
| `app/server.py` | Local HTTP engine, REST, SSE, static files, resource open/read |
| `app/web/` | Vanilla frontend, no build step |
| `app/web/markdown.js` | Markdown renderer + TeX→MathML |
| `app/web/i18n.js` | Chinese/English UI layer (UI only; user data is never translated) |
| `tools/rlog.py` | CLI and `Store` (atomic writes, backups, file lock, `rev`) |
| `tools/mcp_server.py` | MCP stdio server, reuses `Store` |
| `build/` | Optional C# sources for the two native helpers |

When changing `Store` behavior, check all three entry points: GUI, CLI, and MCP.

## Code style

- Python: PEP 8, 4 spaces; `ruff check tools tests`;
- JavaScript / CSS: 2 spaces, no build step, no frontend framework;
- Keep UI copy concise and aimed at researchers;
- UTF-8 everywhere; line endings follow `.gitattributes`;
- Never commit `data/`, `runtime/`, `*.exe`, etc. (see `.gitignore`).

## Commits and pull requests

1. Branch from `main`: `feat/...`, `fix/...`, `docs/...`;
2. Use short imperative commit messages, e.g. `feat: support drag-to-reorder`;
3. PR description: what changed, why, and how you verified it;
4. Changes to the data format must update both `docs/data-format.md` (Chinese) and `docs/en/data-format.md` (English), and stay backward compatible;
5. Changes to MCP tools must update both `docs/mcp.md` and `docs/en/mcp.md`, plus the tool table in the README.

## Tests

```bat
python -m pytest
node --check app\web\app.js
node --check app\web\markdown.js
node --check app\web\i18n.js
```

Tests must only use `tmp_path` or `--data`; never read or write real user data.

## License

By contributing, you agree that your contributions are released under the [MIT](LICENSE) license.
