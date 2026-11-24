# AGENTS.md — 科研日志

这个目录是一个独立的桌面程序「科研日志」：管理科研项目、每个项目的大目标与小目标、以及进展日志。
如果你是被要求「管理科研日志」的智能体（Codex / Claude / 其他），请只通过 `rlog.cmd` 操作数据。

## 必须遵守的规则

1. **用 `rlog.cmd`，不要直接改 `data/research-log.json`**。命令行已经处理了原子写入、每日备份、版本号和字段补全。
2. 如果用户明确要求直接编辑 JSON：保留 `schemaVersion`、`rev`、`updatedAt`、`projects[].id`、`milestones[].id`，写完整文件并保持 UTF-8；改完把 `rev` 加 1。
3. **不要删除 `rev` 字段**，也不要手动创建新的顶层字段。
4. 项目和小目标用名字匹配；重名时命令会报错并列出候选，改用更完整的名字或 id。
5. `delete-project` 不可逆，必须加 `--yes`；执行前先向用户确认。
6. 程序不需要一直开着。命令行直接写文件；如果窗口正开着，它会在约 1 秒内自动刷新。
7. 时间、id、完成时间都由程序生成，不要自己填。

## 命令

```text
rlog.cmd list [--status active|planned|paused|done|all] [--json]
rlog.cmd show <项目> [--json]
rlog.cmd add-project <标题> [--field 领域] [--goal 大目标] [--criteria 判据] [--target-date YYYY-MM-DD] [--status planned|active|paused|done]
rlog.cmd rename <项目> <新标题>
rlog.cmd status <项目> <planned|active|paused|done>
rlog.cmd goal <项目> [--text ...] [--criteria ...] [--target-date ...]
rlog.cmd add <项目> <小目标> [--due YYYY-MM-DD] [--note 备注]
rlog.cmd done <项目> <小目标>
rlog.cmd undone <项目> <小目标>
rlog.cmd rm <项目> <小目标>
rlog.cmd note <进展文本> [--project 项目] [--global]
rlog.cmd delete-project <项目> --yes
rlog.cmd export md|json [--out 文件路径]
rlog.cmd where
```

- `--json` 可以写在命令任意位置，输出机器可解析的 JSON。
- `--data <目录>` 临时改用另一份数据（测试用）。
- 退出码：0 成功，非 0 失败（错误信息在 stderr / JSON 的 `error` 字段）。

## 常见对话 → 命令

| 用户说 | 执行 |
|---|---|
| 帮我在「单细胞」里加个小目标：跑通基线 | `rlog.cmd add "单细胞" "跑通基线"` |
| 把「单细胞」的「跑通基线」勾掉 | `rlog.cmd done "单细胞" "跑通基线"` |
| 记一条进展：今天把参数调通了 | `rlog.cmd note "今天把参数调通了" --project "单细胞"` |
| 新建一个未来的项目 | `rlog.cmd add-project "肠道菌群" --status planned --goal "……"` |
| 把这个项目标记完成 | `rlog.cmd status "单细胞" done` |
| 这周做了什么 | `rlog.cmd list --json`，再按需 `rlog.cmd show "<项目>" --json` |

## MCP（可选）

`tools/mcp_server.py` 把同一套能力暴露为 MCP 工具：`log_list`、`log_show`、`log_create_project`、`log_add_milestone`、`log_check_milestone`、`log_add_note`、`log_set_status`、`log_set_goal`、`log_rename_project`、`log_delete_milestone`、`log_delete_project`、`log_export`。

如果当前客户端已经接入 `research_log`，优先直接调用这些工具；没有接入就用上面的 `rlog.cmd`。配置方法见 `docs/mcp.md`。

## 数据模型（只读了解用）

```jsonc
{
  "schemaVersion": 1,
  "rev": 12,
  "updatedAt": "2026-10-23T19:34:07+08:00",
  "projects": [{
    "id": "p...", "title": "项目名", "field": "免疫",
    "status": "planned|active|paused|done",
    "goal": { "text": "大目标", "criteria": "成功判据", "targetDate": "" },
    "milestones": [{ "id": "m...", "text": "小目标", "done": false, "doneAt": null, "due": "", "note": "", "order": 0 }],
    "startDate": "", "targetDate": "", "completedAt": null, "archived": false
  }],
  "entries": [{ "id": "e...", "projectId": "p...", "at": "...", "kind": "note|auto", "text": "进展" }]
}
```

## 界面程序

`run.cmd`（源码）或 `科研日志.exe`（Release）启动窗口，会顺带启动本地引擎；不启动窗口也能用命令行。文档入口见 `README.md`。
