@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

if exist "%ROOT%runtime\python\python.exe" goto :bundled
where py >nul 2>nul
if not errorlevel 1 goto :py
where python >nul 2>nul
if not errorlevel 1 goto :python

echo [research-log] Python 3.12+ not found.
echo Install Python, or use a Release build with bundled runtime.
pause
exit /b 1

:bundled
"%ROOT%runtime\python\python.exe" "%ROOT%launch.py" %*
exit /b %errorlevel%

:py
py -3 "%ROOT%launch.py" %*
exit /b %errorlevel%

:python
python "%ROOT%launch.py" %*
exit /b %errorlevel%
