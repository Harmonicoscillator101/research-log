# 命令行（CLI）

[English](en/cli.md) | 简体中文

`rlog.cmd` 是与 GUI、MCP 共用同一份数据的命令行入口，适合批处理、脚本和 Agent。

```bat
rlog.cmd <命令> [参数] [--json]
```

- 项目和小目标用**名字**匹配，支持部分名称；重名时会报错并列出候选；
- `--json` 可以写在命令任意位置；
- `--data <目录>` 临时使用另一份数据（测试用）；
- 退出码：`0` 成功，非 `0` 失败（错误信息在 stderr / JSON 的 `error` 字段）；
- 不需要打开窗口；窗口开着时，写入会在约 1 秒内刷新。

## 命令

| 命令 | 说明 |
|---|---|
| `list [--status active\|planned\|paused\|done\|all]` | 列出项目 |
| `show <项目>` | 查看目标、小目标与最近进展 |
| `add-project <标题> [--field 领域] [--goal 大目标] [--criteria 判据] [--target-date YYYY-MM-DD] [--status ...]` | 新建项目 |
| `rename <项目> <新标题>` | 重命名 |
| `status <项目> <planned\|active\|paused\|done>` | 修改状态 |
| `goal <项目> [--text ...] [--criteria ...] [--target-date ...]` | 修改大目标 |
| `add <项目> <小目标> [--due YYYY-MM-DD] [--note 备注]` | 添加小目标 |
| `done <项目> <小目标>` | 勾选小目标 |
| `undone <项目> <小目标>` | 取消勾选 |
| `rm <项目> <小目标>` | 删除小目标 |
| `note <进展文本> [--project 项目] [--global]` | 记录进展 |
| `delete-project <项目> --yes` | 删除项目（不可恢复） |
| `export md\|json [--out 文件路径]` | 导出 |
| `where` | 显示数据文件、数据目录、端口 |

## 示例

```bat
:: 新建项目
rlog.cmd add-project "蛋白质折叠" --field "生物物理" --goal "建立可复现的蛋白质折叠简化模型并投稿" --status active

:: 加目标、打勾
rlog.cmd add "蛋白质折叠" "跑通基线" --due 2026-12-01 --note "先对齐平衡态"
rlog.cmd done "蛋白质折叠" "跑通基线"

:: 记进展（关联项目）
rlog.cmd note "今天把简化模型对上了，误差 0.3%。" --project "蛋白质折叠"

:: 记一条全局进展
rlog.cmd note "读完一篇综述。"

:: 查看与导出
rlog.cmd show "蛋白质折叠"
rlog.cmd list --status active
rlog.cmd export md --out weekly.md
rlog.cmd where
```

## JSON 输出

```bat
rlog.cmd list --json
rlog.cmd show "蛋白质折叠" --json
rlog.cmd add "蛋白质折叠" "新目标" --json
```

成功示例：

```json
{
  "ok": true,
  "project": "蛋白质折叠",
  "milestone": "新目标"
}
```

失败示例：

```json
{
  "ok": false,
  "error": "找到多个项目，请写得更完整：蛋白质折叠 / 蛋白质折叠（旧）"
}
```

## 数据目录

优先级：

1. `--data <目录>`；
2. 环境变量 `RESEARCH_LOG_DATA`；
3. `config.json` 的 `dataDir`；
4. 默认 `data/`。

```bat
rlog.cmd --data .tmp\data list
set RESEARCH_LOG_DATA=.tmp\data
rlog.cmd list
```

## 与 Agent 配合

- 让 Agent 在仓库目录下工作，根目录的 `AGENTS.md` 已经写好了命令速查和写入规则；
- 需要结构化结果时加 `--json`；
- 删除项目必须加 `--yes`，建议先让 Agent 确认；
- 更完整的 Agent 接入方式见 [MCP 文档](mcp.md)。
