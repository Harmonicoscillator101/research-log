# MCP 接入

科研日志自带一个 [Model Context Protocol](https://modelcontextprotocol.io/) 服务端：`tools/mcp_server.py`。它把同一套 `Store` 暴露成 12 个工具，让 Codex、Claude Desktop、Cursor 等客户端直接读写你的科研日志。

## 工作方式

- 传输：**stdio**（客户端拉起子进程，逐行 JSON-RPC 2.0）；
- 不监听端口、不联网、不需要账号；
- 与 GUI / CLI 共用 `tools/rlog.py` 的 `Store`，写入同样原子、备份、递增 `rev`；
- 支持的协议版本：`2025-06-18`、`2025-03-26`、`2024-11-05`（默认最新）。

```
MCP 客户端 ──stdio──> tools/mcp_server.py ──> Store ──> data/research-log.json
```

## 配置

把 `<REPO>` 换成本仓库的绝对路径（例如 `D:\tools\research-log`）。

### Codex

编辑 `~/.codex/config.toml`：

```toml
[mcp_servers.research_log]
command = "python"
args = ["<REPO>/tools/mcp_server.py"]
startup_timeout_sec = 30
```

如果 `python` 不在 PATH，用 Windows 的 `py`：

```toml
command = "py"
args = ["-3", "<REPO>/tools/mcp_server.py"]
```

### Claude Desktop

编辑 `claude_desktop_config.json`：

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

### Cursor / 其它客户端

大多数客户端使用同一种 JSON 结构：

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

修改后重启客户端。首次启动会拉起 `python` 子进程，稍等几秒。

> 如果客户端使用虚拟环境或指定的 Python，把 `command` 换成该解释器的绝对路径即可。

## 工具

| 工具 | 参数 | 作用 |
|---|---|---|
| `log_list` | `status?` | 列出项目；`active` 会同时包含暂停的项目 |
| `log_show` | `project` | 按名称/id/部分匹配查看大目标、小目标、最近进展 |
| `log_create_project` | `title`、`field?`、`goal?`、`criteria?`、`status?` | 新建项目 |
| `log_add_milestone` | `project`、`text`、`due?`、`note?` | 添加小目标 |
| `log_check_milestone` | `project`、`milestone`、`done?` | 勾选或取消小目标 |
| `log_delete_milestone` | `project`、`milestone` | 删除小目标 |
| `log_add_note` | `text`、`project?`、`global?` | 记录进展；不写项目则记为全局 |
| `log_set_status` | `project`、`status` | 修改项目状态 |
| `log_set_goal` | `project`、`text?`、`criteria?`、`targetDate?` | 修改大目标/判据/目标日期 |
| `log_rename_project` | `project`、`title` | 重命名项目 |
| `log_export` | `format`（`md`/`json`）、`out?` | 导出；不写 `out` 则返回内容 |
| `log_delete_project` | `project`、`confirm: true` | 删除项目，必须显式确认 |

工具返回 JSON 文本（`content[].text`），错误会带可读信息，例如项目重名时列出候选。

## 使用示例

对 Agent 说：

> 看一下「蛋白质折叠」项目，把今天跑通的基线验证记进去，并勾掉对应的小目标。

Agent 通常会依次调用：

1. `log_show({ "project": "蛋白质折叠" })` → 找到项目 id 和小目标名称；
2. `log_add_note({ "project": "蛋白质折叠", "text": "完成基线验证，误差 0.3%。" })`；
3. `log_check_milestone({ "project": "蛋白质折叠", "milestone": "跑通基线" })`。

如果窗口开着，右侧日志和看板会在约 1 秒内刷新。

更多对话示例：

| 你说 | Agent 调用 |
|---|---|
| 这周做了什么？ | `log_list` → 多次 `log_show` |
| 给「微流控液滴」加个目标：测扩散系数 | `log_add_milestone` |
| 把「综述」标记完成 | `log_set_status` |
| 导出一份 Markdown 周报 | `log_export` |

## 安全与边界

- 服务端只通过 **stdio** 与客户端通信，不开放网络端口；
- 读取/写入的是 `config.json` 指定的 `dataDir`（默认 `data/`）；
- `log_delete_project` 需要 `confirm: true`，且不可恢复；
- `log_export` 只在用户指定 `out` 时写文件；
- 资源路径只由 GUI 的挂载流程写入，MCP 工具不会执行任意路径；
- 多个客户端同时运行时会各自拉起一个 server 进程，`Store` 的文件锁保证写入串行。

## 调试

直接运行服务端，手动发送 JSON-RPC：

```bat
echo {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}} | python tools\mcp_server.py
```

查看工具列表：

```bat
echo {"jsonrpc":"2.0","id":2,"method":"tools/list"} | python tools\mcp_server.py
```

测试时使用独立数据目录，避免碰真实数据：

```bat
set RESEARCH_LOG_DATA=%CD%\.tmp\data
python tools\mcp_server.py < requests.jsonl
```

也可以先用 CLI 验证同一份数据：

```bat
python tools\rlog.py --data .tmp\data list
```

## 兼容性

- Python 3.12+；
- stdio 传输，任何支持 MCP 的客户端均可；
- 不支持 HTTP/SSE 传输（保持本地、无端口）；
- 工具名以 `log_` 开头，避免与客户端内置工具冲突。
