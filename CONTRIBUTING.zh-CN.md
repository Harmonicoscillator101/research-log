# 贡献指南

[English](CONTRIBUTING.md) | 简体中文

感谢你愿意参与科研日志。这个项目优先保证三件事：**数据安全、离线可用、Agent 可读写**。任何改动都不要破坏它们。

## 开发环境

- Windows 10 / 11
- Python 3.12+
- 任意现代浏览器（Edge / Chrome）

```bat
git clone https://github.com/Harmonicoscillator101/research-log.git
cd research-log
python -m pip install -r requirements-dev.txt
python -m pytest
```

运行时零第三方依赖；`requirements-dev.txt` 只包含测试和 lint 工具。

## 本地运行

```bat
:: 启动引擎 + 桌面窗口
python launch.py

:: 只启动引擎，浏览器访问 http://127.0.0.1:47823/
python app\server.py
```

测试时请使用独立的临时数据目录，**不要动 `data/`**：

```bat
python tools\rlog.py --data .tmp-test\data add-project "测试项目"
set RESEARCH_LOG_DATA=.tmp-test\data
python app\server.py
```

## 目录与职责

| 路径 | 职责 |
|---|---|
| `app/server.py` | 本地 HTTP 引擎、REST、SSE、静态资源、资源打开/读取 |
| `app/web/` | 原生前端，无构建步骤 |
| `app/web/markdown.js` | Markdown 渲染 + TeX→MathML |
| `tools/rlog.py` | CLI 与 `Store`（原子写、备份、文件锁、rev） |
| `tools/mcp_server.py` | MCP stdio 服务端，复用 `Store` |
| `build/` | 两个原生小工具的 C# 源码（可选） |

修改 `Store` 的行为时，请同时检查 GUI、CLI、MCP 三条路径是否一致。

## 代码风格

- Python：PEP 8，4 空格；`ruff check tools tests`；
- JavaScript / CSS：2 空格，不加构建步骤，不引入前端框架；
- 中文文案保持简洁，面向科研用户；
- 文件编码 UTF-8，换行遵循 `.gitattributes`；
- 不要提交 `data/`、`runtime/`、`*.exe` 等（见 `.gitignore`）。

## 提交与 PR

1. 从 `main` 开分支：`feat/...`、`fix/...`、`docs/...`；
2. 提交信息用简短祈使句，例如 `feat: 支持拖拽排序`；
3. PR 描述写清楚：改了什么、为什么、怎么验证；
4. 涉及数据格式的改动必须更新 `docs/data-format.md`，并保证旧数据可读；
5. 涉及 MCP 工具的改动必须更新 `docs/mcp.md` 和 README 的工具表。

## 测试

```bat
python -m pytest
node --check app\web\app.js
node --check app\web\markdown.js
```

测试只使用 `tmp_path` 或 `--data`，不得读写仓库外的真实数据。

## 许可证

提交代码即表示你同意以 [MIT](LICENSE) 许可证发布你的贡献。
