# 数据格式

科研日志的全部数据保存在一个 UTF-8 JSON 文件里，默认路径 `data/research-log.json`。文件由程序原子写入，**不建议手工编辑**；如果必须编辑，请先备份，并遵守本文的不变量。

## 顶层结构

```jsonc
{
  "schemaVersion": 1,
  "rev": 12,
  "updatedAt": "2026-11-24T20:00:00+08:00",
  "projects": [],
  "entries": []
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `schemaVersion` | number | 数据结构版本，当前为 `1` |
| `rev` | number | 每次写入递增；用于前端判断是否有新版本 |
| `updatedAt` | string | ISO 8601 时间，带时区 |
| `projects` | array | 项目列表 |
| `entries` | array | 进展记录（可关联项目，也可全局） |

## 项目 `projects[]`

```jsonc
{
  "id": "pabc123",
  "title": "示例：蛋白质折叠模型",
  "field": "生物物理",
  "status": "active",
  "goal": {
    "text": "建立可复现的蛋白质折叠简化模型并整理成论文",
    "criteria": "论文投稿并被接收",
    "targetDate": "2027-06-30"
  },
  "milestones": [],
  "notes": "",
  "createdAt": "2026-11-01T09:00:00+08:00",
  "updatedAt": "2026-11-24T20:00:00+08:00",
  "startDate": "2026-11-01",
  "targetDate": "",
  "completedAt": null,
  "archived": false,
  "order": 0,
  "resources": []
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 项目 id，程序生成，稳定不变 |
| `title` | string | 项目名，可重名（CLI 会用更完整的名字或 id 区分） |
| `field` | string | 领域标签，可空 |
| `status` | enum | `planned` / `active` / `paused` / `done` |
| `goal.text` | string | 大目标，一句话 |
| `goal.criteria` | string | 成功判据，可空 |
| `goal.targetDate` | string | 目标日期 `YYYY-MM-DD`，可空 |
| `milestones` | array | 小目标列表 |
| `notes` | string | 项目级备注，可空 |
| `createdAt` / `updatedAt` | string | ISO 时间 |
| `startDate` | string | 开始日期，可空 |
| `targetDate` | string | 项目级目标日期，可空 |
| `completedAt` | string/null | 完成时间 |
| `archived` | bool | 归档标记（当前 UI 未使用） |
| `order` | number | 看板排序；数值越小越靠前 |
| `resources` | array | 挂载的资源 |

## 小目标 `projects[].milestones[]`

```jsonc
{
  "id": "mabc123",
  "text": "跑通基线算例",
  "done": false,
  "doneAt": null,
  "due": "2026-12-01",
  "note": "先对齐平衡态，再加扰动",
  "order": 0
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 小目标 id |
| `text` | string | 内容 |
| `done` | bool | 是否完成 |
| `doneAt` | string/null | 完成时间 |
| `due` | string | 截止日期 `YYYY-MM-DD`，可空 |
| `note` | string | 备注，可空 |
| `order` | number | 项目内排序，越小越靠前 |

## 进展 `entries[]`

```jsonc
{
  "id": "eabc123",
  "projectId": "pabc123",
  "at": "2026-11-24T19:30:00+08:00",
  "kind": "note",
  "text": "今天把碰撞算子对上了，基线误差 0.3%。"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 进展 id |
| `projectId` | string/null | 关联项目；`null` 表示全局进展 |
| `at` | string | 发生时间 |
| `kind` | enum | `note`（用户记录）/ `auto`（程序生成，如"完成小目标"） |
| `text` | string | 内容，纯文本（界面可复制） |

## 资源 `projects[].resources[]`

```jsonc
{
  "id": "rabc123",
  "path": "D:\\papers\\example.pdf",
  "kind": "file",
  "label": "example.pdf",
  "addedAt": "2026-11-24T19:00:00+08:00",
  "category": "ref"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 资源 id |
| `path` | string | **绝对路径**；程序不复制文件 |
| `kind` | enum | `file` / `dir` |
| `label` | string | 显示名，默认取文件名 |
| `addedAt` | string | 挂载时间 |
| `category` | enum | `ref`（文献）/ `repo`（项目库）/ `note`（笔记）；旧数据缺省视为 `ref` |

## 不变量

1. `schemaVersion`、`rev`、`updatedAt` 必须存在；写入时 `rev` 加 1；
2. 所有 `id` 在文件内唯一且稳定；不要复用已删除的 id；
3. `status` 只能是四个枚举值；`category` 只能是三个枚举值；
4. 时间统一用 ISO 8601 带时区字符串，日期用 `YYYY-MM-DD`；
5. 资源 `path` 必须是绝对路径；相对路径会在读取时被规范化；
6. 文件必须是 UTF-8（可带 BOM），且是一个完整的 JSON 对象。

## 版本迁移

`schemaVersion` 目前为 `1`。未来若修改结构：

- 在 `Store.normalize()` 中做向后兼容的字段补全；
- 保留旧字段的读取逻辑至少一个大版本；
- 在 `CHANGELOG.md` 和本文档中记录迁移说明；
- 迁移前自动备份到 `data/backups/`。

## 备份

- 每天第一次写入前，旧文件复制到 `data/backups/research-log-YYYY-MM-DD.json`；
- 保留最近 14 天，更早的自动清理；
- 备份文件与主文件格式相同，可直接改名恢复。
