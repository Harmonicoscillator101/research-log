# Command Line (CLI)

[简体中文](../cli.md) | English

`rlog.cmd` is the command-line entry point that shares the same data as the GUI and MCP. It is useful for scripts, batch jobs, and agents.

```bat
rlog.cmd <command> [arguments] [--json]
```

- Projects and milestones are matched by **name**, including partial names; ambiguous names report candidates;
- `--json` can appear anywhere;
- `--data <dir>` temporarily uses another data directory (for tests);
- Exit code: `0` on success, non-zero on failure (error in stderr or the JSON `error` field);
- The window does not need to be open; changes refresh an open window within about one second.

## Commands

| Command | Purpose |
|---|---|
| `list [--status active\|planned\|paused\|done\|all]` | List projects |
| `show <project>` | Show goals, milestones, and recent progress |
| `add-project <title> [--field field] [--goal goal] [--criteria criteria] [--target-date YYYY-MM-DD] [--status ...]` | Create a project |
| `rename <project> <new title>` | Rename |
| `status <project> <planned\|active\|paused\|done>` | Change status |
| `goal <project> [--text ...] [--criteria ...] [--target-date ...]` | Update the main goal |
| `add <project> <milestone> [--due YYYY-MM-DD] [--note note]` | Add a milestone |
| `done <project> <milestone>` | Check a milestone |
| `undone <project> <milestone>` | Uncheck a milestone |
| `rm <project> <milestone>` | Delete a milestone |
| `note <text> [--project project] [--global]` | Record progress |
| `delete-project <project> --yes` | Delete a project (irreversible) |
| `export md\|json [--out file]` | Export |
| `where` | Show data file, data directory, and port |

## Examples

```bat
:: Create a project
rlog.cmd add-project "Protein folding" --field "Biophysics" --goal "Build a reproducible simplified model" --status active

:: Add a milestone and check it
rlog.cmd add "Protein folding" "Reproduce the baseline" --due 2026-12-01 --note "Align the equilibrium state first"
rlog.cmd done "Protein folding" "Reproduce the baseline"

:: Record progress (linked to a project)
rlog.cmd note "Checked the simplified model against the literature; error 0.3%." --project "Protein folding"

:: Record a global entry
rlog.cmd note "Read a review paper."

:: Query and export
rlog.cmd show "Protein folding"
rlog.cmd list --status active
rlog.cmd export md --out weekly.md
rlog.cmd where
```

## JSON output

```bat
rlog.cmd list --json
rlog.cmd show "Protein folding" --json
rlog.cmd add "Protein folding" "New milestone" --json
```

Success:

```json
{
  "ok": true,
  "project": "Protein folding",
  "milestone": "New milestone"
}
```

Failure:

```json
{
  "ok": false,
  "error": "Multiple projects match; please be more specific: Protein folding / Protein folding (old)"
}
```

## Data directory

Priority:

1. `--data <dir>`;
2. `RESEARCH_LOG_DATA` environment variable;
3. `dataDir` in `config.json`;
4. Default `data/`.

```bat
rlog.cmd --data .tmp\data list
set RESEARCH_LOG_DATA=.tmp\data
rlog.cmd list
```

## Working with agents

- Let the agent work in the repository directory; `AGENTS.md` at the root contains the command reference and write rules;
- Add `--json` for structured results;
- Deleting a project requires `--yes`; ask the agent to confirm first;
- For a fuller agent integration, see [MCP](mcp.md).
