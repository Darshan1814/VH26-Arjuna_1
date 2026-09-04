@echo off
setlocal EnableDelayedExpansion

echo ====================================================
echo    Machine Troubleshooter - Local Development Server
echo ====================================================
echo.

cd /d "%~dp0"

:: 1. Check environment file
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy /y ".env.example" ".env" >nul
        echo [SUCCESS] .env created.
    ) else (
        type nul > ".env"
    )
)

:: Ensure frontend has .env.local
if not exist "frontend\.env.local" (
    copy /y ".env" "frontend\.env.local" >nul
)

:: 2. Start Backend FastAPI Server
echo [INFO] Starting Backend API on port 8000...
start "Machine Troubleshooter - Backend (8000)" cmd /k "cd /d %~dp0backend && call .venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: 3. Start Frontend Next.js Dev Server
echo [INFO] Starting Frontend Dev Server on port 3000...
start "Machine Troubleshooter - Frontend (3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ====================================================
echo    Services Started in Separate Windows!
echo ====================================================
echo   Frontend:     http://localhost:3000
echo   Backend API:  http://localhost:8000
echo   API Docs:     http://localhost:8000/docs
echo   Health Check: http://localhost:8000/health
echo ====================================================
echo.
pause
