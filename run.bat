@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo Python is required to launch the local server.
    echo Install Python from https://www.python.org/downloads/
    echo During install, check "Add Python to PATH".
    pause
    exit /b 1
)

python serve.py
pause
