# Build and Packaging

[简体中文](../build.md) | English

The main application needs no build step: Python source plus a vanilla frontend run directly. Only the two optional Windows helpers need compiling.

## Requirements

- Windows 10 / 11;
- `csc.exe` from .NET Framework 4.8 (`%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe`);
- Python 3.12+ (for icon scripts and running the app).

## Build the launcher `科研日志.exe`

`build/launcher.cs` starts `runtime\python\pythonw.exe` and loads `launch.py`:

```bat
"%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:anycpu ^
  /win32icon:app\web\icon.ico ^
  /out:科研日志.exe ^
  build\launcher.cs ^
  /r:System.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll
```

> Running from source only needs `run.cmd`; compiling the exe is optional. `launcher.cs` assumes the release contains `runtime\python`. Without a bundled runtime, change `FileName` to `py`, add `-3` to the arguments, or simply ship `run.cmd`.

## Build the drop window `添加资料.exe`

```bat
"%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /platform:anycpu ^
  /win32icon:app\web\icon.ico ^
  /out:添加资料.exe ^
  build\resource-drop.cs ^
  /r:System.dll /r:System.Core.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll
```

The `.cs` files contain Chinese and `csc` expects a UTF-8 BOM. If compilation reports encoding errors, save them as UTF-8 with BOM.

## Icons

`build/build_icon.py` and `build/build_icon2.py` generate `app/web/icon.ico` / `icon.png` and require Pillow:

```bat
python -m pip install pillow
python build\build_icon.py
```

## Bundling the runtime

To ship a "download and run" Release:

1. Prepare a full Python 3.12 runtime (**including tkinter / tcl-tk**, required by the file/folder pickers);
2. Copy it to `runtime\python\`;
3. Keep `runtime\python\LICENSE.txt` and `tcl\tk8.6\license.terms`;
4. Make sure `runtime\python\pythonw.exe` exists.

> The official Python embeddable package does **not** include tkinter and is not suitable as the runtime; copy from a full installation or use `actions/setup-python` in CI and copy the installation.

## Suggested release layout

```
ResearchLog-0.1.0-win64/
├─ app/
├─ tools/
├─ build/
├─ docs/
├─ examples/
├─ runtime/python/          # optional
├─ launch.py
├─ run.cmd
├─ rlog.cmd
├─ config.json
├─ 科研日志.exe             # optional
├─ 添加资料.exe             # optional
├─ LICENSE
└─ THIRD_PARTY_NOTICES.md
```

Zip it and publish a SHA-256 checksum. Do not include `data/`, `profile/`, `runtime.json`, `.rlog.lock`, or any real user data.

## Pre-release checks

```bat
python -m pytest
node --check app\web\app.js
node --check app\web\markdown.js
node --check app\web\i18n.js
python tools\rlog.py --data .tmp\data list
python launch.py
```

Confirm:

- first launch creates `data/`;
- board, detail, weekly review, resources, and reader work;
- closing the window exits the engine as expected;
- the new directory contains no personal paths or real project names.
