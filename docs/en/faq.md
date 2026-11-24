# FAQ

[简体中文](../faq.md) | English

## How is it different from Notion / Obsidian / Excel?

- **Research semantics**: one main goal per project, checkable milestones with due dates and progress — not a generic note app;
- **Local-first**: data is a JSON file; offline, no account, easy to back up and move;
- **Agent-native**: MCP exposes 12 tools; the agent reads and writes the same data instead of copying text into a chat;
- **Research assets**: papers / repositories / notes attached per project, plus a built-in Markdown + LaTeX reader.

## Can I lose data?

- Every write is "temporary file + atomic replace";
- Before the first write of each day, the old file is backed up to `data/backups/` and kept for 14 days;
- You can also use `⋯ → Settings & backup → Export JSON` for a manual snapshot;
- Backups are plain JSON; rename one to `research-log.json` to restore.

## Why not a database?

Personal research data is small (dozens of projects, thousands of entries). Being readable, diffable, and directly back-up-able matters more. Moving to another machine is a folder copy. Concurrent writes are handled by a file lock and read-modify-write.

## Why is the window a browser?

The desktop window is rendered by the system Edge in **app mode** (no address bar or tabs), not a normal browser tab. If Edge is unavailable, it falls back to the default browser. This avoids bundling Chromium, keeping the app small and startup fast while data stays local.

## Does it need the internet?

No. There is no cloud, account, telemetry, or auto-update. Formula rendering uses native browser MathML, with no CDN.

## Which MCP clients are supported?

Any MCP client with stdio transport, such as Codex, Claude Desktop, and Cursor. See [MCP](mcp.md).

## What if multiple agents write at the same time?

Each client starts its own MCP server process, but all writes go through the `Store` file lock and read-modify-write; `rev` increases, and the GUI receives the latest revision over SSE.

## Can I sync across machines?

There is no built-in sync. You can point `dataDir` in `config.json` at a OneDrive / Dropbox folder, but **do not edit from two machines at the same time**; the sync client may create conflict copies.

## Are papers copied into the app directory?

No. Only absolute paths are stored; opening a resource hands it to the system default application. If the original moves or is deleted, the link breaks and can be re-attached.

## Why don't images in notes render?

The current reader renders Markdown text and formulas; local images appear as `[image] alt` placeholders. This avoids extra path and security handling for images; a future version will add support.

## Does uninstalling delete my data?

Data lives in `data/` inside the program directory. Export JSON or back up the directory before uninstalling; deleting the program directory deletes the data too.

## Why does `rlog.cmd` say Python was not found?

Running from source requires Python 3.12+. `rlog.cmd` tries `runtime\python\python.exe`, then `py -3`, then `python`. If none exist, install Python or use a Release build with the bundled runtime.

## How do I switch the UI language?

Use the `EN / 中文` button in the top bar. It defaults to your browser language; only UI copy is translated, while project names, notes, and log content stay as written. The choice is stored in browser local storage.

## Where do I start contributing?

Read [CONTRIBUTING](../../CONTRIBUTING.md); documentation, sample data, or `good first issue` are good starting points.
