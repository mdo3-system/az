@echo off
chcp 65001 > nul
echo.
echo ============================================
echo   AZ 斜め壁アシスト - バックエンドサーバー起動
echo ============================================
echo.

cd /d "%~dp0"

REM 仮想環境の確認
if exist ".venv\Scripts\python.exe" (
    echo [OK] 仮想環境 (.venv) を検出しました
    set PYTHON=.venv\Scripts\python.exe
) else if exist ".venv\Scripts\python3.exe" (
    set PYTHON=.venv\Scripts\python3.exe
) else (
    echo [WARNING] 仮想環境が見つかりません。システムのPythonを使用します
    set PYTHON=python
)

REM ポート8000が使用中かチェック
netstat -ano | findstr ":8000" | findstr "LISTENING" > nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo [INFO] ポート8000はすでに使用中です（サーバーが起動している可能性があります）
    echo http://127.0.0.1:8000/api/v1/health でヘルスチェックを確認してください
    echo.
    pause
    exit /b 0
)

echo.
echo [起動中] http://127.0.0.1:8000 でサーバーを開始します...
echo [終了方法] このウィンドウを閉じるか Ctrl+C を押してください
echo.

%PYTHON% -m uvicorn az_bridge.api:app --host 127.0.0.1 --port 8000 --reload

echo.
echo サーバーが停止しました
pause
