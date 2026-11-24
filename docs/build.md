# 构建与打包

主程序不需要构建：Python 源码 + 原生前端直接运行。只有两个可选的 Windows 小工具需要编译。

## 环境

- Windows 10 / 11；
- .NET Framework 4.8 自带的 `csc.exe`（路径：`%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe`）；
- Python 3.12+（用于图标脚本和运行主程序）。

## 编译启动器 `科研日志.exe`

`build/launcher.cs` 会启动 `runtime\python\pythonw.exe` 并加载 `launch.py`：

```bat
"%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:anycpu ^
  /win32icon:app\web\icon.ico ^
  /out:科研日志.exe ^
  build\launcher.cs ^
  /r:System.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll
```

> 源码运行时可以直接用 `run.cmd`，不必编译 exe。`launcher.cs` 假设发布包内含 `runtime\python`；如果不带运行时，请把 `FileName` 改为 `py` 并把参数改成 `-3 launch.py`，或直接分发 `run.cmd`。

## 编译拖拽小窗 `添加资料.exe`

```bat
"%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:anycpu ^
  /win32icon:app\web\icon.ico ^
  /out:添加资料.exe ^
  build\resource-drop.cs ^
  /r:System.dll /r:System.Core.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll
```

`.cs` 文件包含中文，`csc` 需要 UTF-8 BOM；如果编译报编码错误，用支持 BOM 的编辑器另存为 UTF-8 with BOM。

## 图标

`build/build_icon.py` 与 `build/build_icon2.py` 用于生成 `app/web/icon.ico` / `icon.png`，需要 Pillow：

```bat
python -m pip install pillow
python build\build_icon.py
```

## 运行时打包

如果要提供"下载即用"的 Release：

1. 准备 Python 3.12 的完整运行时（**需要包含 tkinter / tcl-tk**，文件/文件夹选择框依赖它）；
2. 复制到 `runtime\python\`；
3. 保留 `runtime\python\LICENSE.txt` 与 `tcl\tk8.6\license.terms`；
4. 确认 `runtime\python\pythonw.exe` 存在。

> Python 官方的 embeddable 包不带 tkinter，不适合直接用作运行时；建议从完整安装复制，或在 CI 中使用 `actions/setup-python` 后再拷贝。

## Release 目录建议

```
ResearchLog-0.1.0-win64/
├─ app/
├─ tools/
├─ build/
├─ docs/
├─ examples/
├─ runtime/python/          # 可选
├─ launch.py
├─ run.cmd
├─ rlog.cmd
├─ config.json
├─ 科研日志.exe             # 可选
├─ 添加资料.exe             # 可选
├─ LICENSE
└─ THIRD_PARTY_NOTICES.md
```

压缩为 zip，附 SHA-256 校验值。不要包含 `data/`、`profile/`、`runtime.json`、`.rlog.lock` 或任何真实数据。

## 发布前检查

```bat
python -m pytest
node --check app\web\app.js
node --check app\web\markdown.js
python tools\rlog.py --data .tmp\data list
python launch.py
```

确认：

- 首次启动自动创建 `data/`；
- 看板、详情、周报、资源、阅读器可用；
- 关闭窗口后引擎按预期退出；
- 新目录中不含任何个人路径或真实项目名。
