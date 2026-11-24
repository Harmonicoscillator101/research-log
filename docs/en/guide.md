# User Guide

[简体中文](../guide.zh.md) | English

A local-first research project and progress manager: organize projects by **planned / active / done**, give each project one main goal plus checkable milestones, and keep a daily progress log.

## Starting

**Release build**

- Double-click `科研日志.exe`, or run `run.cmd`;
- The first launch creates `data/`; wait a few seconds for the window;
- To pin it to the taskbar: right-click the taskbar icon → **Pin to taskbar**.

**From source**

```bat
run.cmd
:: Start the engine only, no window (for scripts/remote use)
run.cmd --no-window
```

`run.cmd` tries `runtime\python\python.exe`, then `py -3`, then `python`, and then calls `launch.py`.

You can also start the engine only and use a browser:

```bat
python app\server.py
:: open http://127.0.0.1:47823/
```

> The window is rendered by the system Edge in app mode (no address bar or tabs); if Edge is unavailable, the default browser is used.

## Interface

- **Left**: project list, filterable by status; the bar shows milestone completion;
- **Center**: the board by default, with columns for planned / active / done; drag cards between columns. Opening a project shows its main goal, success criteria, target date, and milestones;
- **Right**: progress log for the project; `Ctrl + Enter` sends;
- **Language**: the `EN / 中文` button in the top bar switches the UI; it follows the browser language by default and only translates the interface, never project names or notes.

Common actions:

| Action | How |
|---|---|
| New project | Top-right "New project" or `Ctrl + N` |
| Search | `Ctrl + F` across project names, goals, milestones, notes |
| Add milestone | Input at the bottom of the list; press Enter to add another |
| Check / edit | Click the checkbox; click the text to edit |
| Note / due date | Hover the note / calendar icons on the milestone row |
| Reorder milestones | Drag the six-dot handle; or focus it and press `Alt + ↑ / ↓` |
| Change status | Status dropdown on the detail page, or drag on the board |
| Back | `Esc` or "All projects" |
| Undo delete | Click "Undo" in the toast, or `Ctrl + Z` |
| Copy one entry | Select text and `Ctrl + C`; or hover the entry and click the copy icon |
| Copy the log | Click the copy icon next to "Recent progress" (ordered, with dates and project names) |

The first launch is empty; click "Load sample" to explore the structure, or import `examples/demo-data-en/research-log.json`.

## Resources, repositories, and notes

The "Resources & repositories" section groups attachments into three categories, each with multiple entries:

- **Papers**: PDFs or folders; opens with the system default reader; the folder icon reveals it in Explorer;
- **Repositories**: code/data directories; opens in Explorer at the project root;
- **Notes**: Markdown files; opens in the built-in reader with headings, lists, tables, code, task lists, and formulas.

Each category's plus button offers "Drop folder / file…", "Choose folder…", and "Choose file…"; the three buttons only preset the category. Resources attached before categories existed are treated as papers.

### Built-in Markdown reader

Notes (`.md` / `.markdown` / `.txt`) open inside the window:

- Inline `$...$` and block `$$...$$` formulas render with native browser MathML (fractions, scripts, roots, sums/integrals, matrices);
- Headings, lists, task lists, tables, code blocks, quotes, links;
- The header shows the file path and update time, with "Show in folder";
- Close with `Esc` or by clicking the backdrop;
- Local images are not supported yet (shown as `[image] alt`); external links open in the browser.

## Weekly view and review

"Week" in the left rail aggregates time-sensitive items:

- **Overdue / Today / Next 7 days** from milestone due dates; overdue is highlighted;
- **Completed this week**: milestones checked in the last 7 days;
- **Progress this week**: entries recorded in the last 7 days;
- **Stale**: projects not updated for 14+ days.

Click any row to jump to the project and highlight the milestone. "Copy review" produces a Markdown weekly report ready for a group meeting or email.

## Data and backups

- `data/research-log.json`: all data, plain JSON, editable or backup-able with any editor;
- `data/backups/`: a copy before the first change of each day, kept for 14 days;
- `⋯ → Settings & backup`: export **Markdown** (project reports / weekly review) or **JSON**, and import JSON;
- Moving machines: copy the whole program directory; data travels with it.

## Configuration

`config.json`:

```json
{
  "dataDir": "data",
  "port": 47823
}
```

- `dataDir`: data directory. `data` is relative to the program directory; an absolute path is also allowed, e.g. `D:\\research\\log`;
- `port`: local port; if occupied, the engine picks the next free one.

## Managing with agents (optional)

The CLI `rlog.cmd` uses the same `data/research-log.json`:

```text
rlog.cmd list
rlog.cmd show "Sample: Protein folding model"
rlog.cmd add "Sample: Protein folding model" "Measure low-temperature mobility"
rlog.cmd done "Sample: Protein folding model" "Measure low-temperature mobility"
rlog.cmd note "Mounted the sample today" --project "Sample: Protein folding model"
rlog.cmd add-project "New project" --status planned --goal "..."
rlog.cmd export md
```

- No window needed; an open window refreshes within about one second;
- `--json` prints machine-readable results;
- Deleting a project requires `--yes`; ambiguous names list candidates;
- For Codex/Claude, open the repository directory; `AGENTS.md` contains the rules and commands;
- MCP clients can call the `log_*` tools directly; see [MCP](mcp.md);
- Full commands: `rlog.cmd --help`.

## FAQ

- **Nothing happens after double-clicking**: the first launch starts the local engine; wait a few seconds and try again. `pythonw.exe` in Task Manager means the engine is running.
- **Edge reports an instance with different privileges**: a system Edge instance is running as administrator. Click "Yes" to restart it with normal privileges; the app itself does not need administrator rights.
- **Change the data location**: edit `dataDir` in `config.json` (relative or absolute) and restart.
- **Change the port**: edit `port` in `config.json` and restart.
- More: [FAQ](faq.md).

## Notes

- The window uses the system Edge engine in app mode, so no extra browser engine is installed;
- After closing the window, the local engine exits after about 8 seconds;
- Data is local only; for multi-device use, point `dataDir` at a OneDrive/Dropbox folder and avoid editing from two machines at once;
- Uninstall: close the window and delete the program directory (data is inside; export a backup first).
