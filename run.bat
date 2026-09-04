@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

where docker >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Docker detected. Running setup via Docker...
    call "%~dp0setup.bat"
) else (
    echo [INFO] Docker not detected in PATH.
    echo [INFO] Running in local development mode...
    call "%~dp0run_local.bat"
)
