# MCP Integration

[简体中文](../mcp.md) | English

ResearchLog ships a [Model Context Protocol](https://modelcontextprotocol.io/) server: `tools/mcp_server.py`. It exposes the same `Store` as 12 tools, so Codex, Claude Desktop, Cursor, and other clients can read and write your research log directly.

## How it works

- Transport: **stdio** (the client starts a subprocess and exchanges JSON-RPC 2.0 line by line);
- No port, no network, no account;
- Sharing the same `Store` as the GUI and CLI: atomic writes, backups, and `rev` increments;
- Supported protocol versions: `2025-06-18`, `2025-03-26`, `2024-11-05` (latest by default).

```
MCP client ──stdio──> tools/mcp_server.py ──> Store ──> data/research-log.json
```

## Configuration

Replace `<REPO>` with the absolute path to this repository (for example `D:\tools\research-log`).

### Codex

Edit `~/.codex/config.toml`:

```toml
[mcp_servers.research_log]
command = "python"
args = ["<REPO>/tools/mcp_server.py"]
startup_timeout_sec = 30
```

If `python` is not on PATH, use Windows' `py`:

```toml
command = "py"
args = ["-3", "<REPO>/tools/mcp_server.py"]
```

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "research-log": {
      "command": "python",
      "args": ["<REPO>/tools/mcp_server.py"]
    }
  }
}
```

### Cursor / other clients

Most clients use the same JSON structure:

```json
{
  "mcpServers": {
    "research-log": {
      "command": "python",
      "args": ["<REPO>/tools/mcp_server.py"]
    }
  }
}
```

Restart the client after editing. The first start launches a `python` subprocess; allow a few seconds.

> If the client uses a virtual environment or a specific interpreter, set `command` to its absolute path.

## Tools

| Tool | Arguments | Purpose |
|---|---|---|
| `log_list` | `status?` | List projects; `active` also includes paused ones |
| `log_show` | `project` | Show goals, milestones, and recent progress by name/id/partial match |
| `log_create_project` | `title`, `field?`, `goal?`, `criteria?`, `status?` | Create a project |
| `log_add_milestone` | `project`, `text`, `due?`, `note?` | Add a milestone |
| `log_check_milestone` | `project`, `milestone`, `done?` | Check or uncheck a milestone |
| `log_delete_milestone` | `project`, `milestone` | Delete a milestone |
| `log_add_note` | `text`, `project?`, `global?` | Record progress; without a project it is global |
| `log_set_status` | `project`, `status` | Change project status |
| `log_set_goal` | `project`, `text?`, `criteria?`, `targetDate?` | Update the main goal / criteria / target date |
| `log_rename_project` | `project`, `title` | Rename a project |
| `log_export` | `format` (`md`/`json`), `out?` | Export; without `out` returns the content |
| `log_delete_project` | `project`, `confirm: true` | Delete a project; explicit confirmation required |

Tools return JSON text (`content[].text`); errors include readable messages, e.g. candidate names when a project name is ambiguous.

## Examples

Say to the agent:

> Open the "Protein folding" project, record today's baseline verification, and check off the corresponding milestone.

The agent will typically call:

1. `log_show({ "project": "Protein folding" })` to find the project and milestone;
2. `log_add_note({ "project": "Protein folding", "text": "Baseline verified; error 0.3%." })`;
3. `log_check_milestone({ "project": "Protein folding", "milestone": "Reproduce the baseline case" })`.

If the window is open, the log and board refresh within about one second.

More examples:

| You say | Agent calls |
|---|---|
| What did I do this week? | `log_list` → several `log_show` calls |
| Add a milestone "measure diffusion" to "Microfluidics" | `log_add_milestone` |
| Mark "Review" as done | `log_set_status` |
| Export a Markdown weekly report | `log_export` |

## Security boundaries

- The server communicates with the client over **stdio** and opens no network port;
- It reads/writes the `dataDir` from `config.json` (default `data/`);
- `log_delete_project` requires `confirm: true` and is irreversible;
- `log_export` only writes a file when the user supplies `out`;
- Resource paths are written only by the GUI attach flow; MCP tools never execute arbitrary paths;
- Multiple clients each start their own server process; the `Store` file lock serializes writes.

## Debugging

Run the server manually and send JSON-RPC:

```bat
echo {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}} | python tools\mcp_server.py
```

List tools:

```bat
echo {"jsonrpc":"2.0","id":2,"method":"tools/list"} | python tools\mcp_server.py
```

Use a separate data directory for testing:

```bat
set RESEARCH_LOG_DATA=%CD%\.tmp\data
python tools\mcp_server.py < requests.jsonl
```

You can also verify the same data via the CLI:

```bat
python tools\rlog.py --data .tmp\data list
```

## Compatibility

- Python 3.12+;
- stdio transport, compatible with any MCP client;
- No HTTP/SSE transport (keeps it local and port-free);
- Tool names start with `log_` to avoid collisions with client built-ins.
