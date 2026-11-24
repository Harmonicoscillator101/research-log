# 第三方组件与许可证

[English](THIRD_PARTY_NOTICES.md) | 简体中文

科研日志自身以 [MIT](LICENSE) 发布。发布包或运行环境中可能包含以下第三方组件，它们各自遵循原许可证。

## Python 运行时（可选，随 Release 提供）

- 组件：Python 3.12（含标准库）
- 许可证：Python Software Foundation License Version 2（PSF-2.0）
- 来源：https://www.python.org/
- 说明：如果发布包内包含 `runtime/python/`，必须同时保留其中的 `LICENSE.txt`，并附上本文件。

## Tcl/Tk（随 Python 运行时提供）

- 组件：Tcl/Tk 8.6（用于文件/文件夹选择对话框）
- 许可证：BSD 风格的 Tcl/Tk License
- 说明：许可证文本随 Python 运行时位于 `runtime/python/tcl/tk8.6/license.terms`。

## Microsoft Edge / Chromium（系统依赖，不随包分发）

- 用途：作为桌面窗口的渲染运行时；程序通过系统已安装的 Edge 打开本地页面。
- 许可证：Chromium 项目使用 BSD 风格许可证，Edge 还包含 Microsoft 的附加条款。
- 说明：本项目**不复制、不修改、不重新分发** Edge/Chromium 的任何文件；用户使用的是系统中已有的浏览器。

## 前端

- 原生 JavaScript / CSS，无框架、无打包器、无 npm 运行时依赖。
- 公式排版使用浏览器内置的 MathML，不包含 KaTeX/MathJax 代码或字体。

## 图标与素材

- `app/web/icon.ico`、`app/web/icon.png`、`app/web/icon.svg`：项目自有素材，随本项目以 MIT 许可。
- 文档截图中的界面元素由项目自身渲染，示例数据为虚构。

## 开发依赖（不随运行时分发）

- pytest（MIT）
- ruff（MIT）

如在发布包中新增任何第三方代码、字体或图标，请在此文件中补充来源与许可证，并保留对应的许可证原文。
