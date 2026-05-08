@echo off
cd /d "%~dp0"
echo Checking Python environment...

REM 1. 仮想環境があれば使用、なければシステムのPythonを使用
if exist ".venv\Scripts\python.exe" (
    set PY=.venv\Scripts\python.exe
) else (
    set PY=python
)

echo Using: %PY%
echo Starting FastAPI server at http://127.0.0.1:8000 ...

REM 2. サーバー起動 (reloadなしで安定性を優先)
%PY% -m uvicorn az_bridge.api:app --host 127.0.0.1 --port 8000

pause
