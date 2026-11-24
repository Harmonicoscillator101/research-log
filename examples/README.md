# 示例数据

- `demo-data/research-log.json`：虚构的科研日志，4 个项目，覆盖三种状态、若干小目标和进展；
- `demo-data-en/research-log.json`：英文版示例数据，适合英文界面截图或国际用户；
- 所有标题、备注、时间均为演示用途，不包含任何真实研究数据或本机路径。

## 使用方式

**方式一：导入**

打开程序 → 右上角 `⋯` →「设置与备份」→「导入 JSON」，选择本文件。

**方式二：直接替换**

```bat
copy examples\demo-data\research-log.json data\research-log.json
```

替换前请先备份自己的 `data/`。

**方式三：只读体验**

```bat
set RESEARCH_LOG_DATA=examples\demo-data
python app\server.py
```

然后访问 http://127.0.0.1:47823/ 。注意：直接以示例目录作为数据目录时，修改会写回示例文件，体验完请恢复。
