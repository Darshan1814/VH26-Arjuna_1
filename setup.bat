@echo off
setlocal EnableDelayedExpansion

echo ====================================================
echo    Machine Troubleshooter - Automated Setup & Run
echo ====================================================
echo.

cd /d "%~dp0"

:: ----------------------------------------------------------------------------
:: 1. Check if Docker CLI is installed
:: ----------------------------------------------------------------------------
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Docker is not found in your PATH.
    echo [INFO] Attempting to install Docker Desktop via Windows Package Manager (winget)...
    where winget >nul 2>&1
    if %errorlevel% equ 0 (
        winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
        if %errorlevel% neq 0 (
            echo [ERROR] Automatic Docker Desktop installation failed.
            echo Please install Docker Desktop manually from: https://www.docker.com/products/docker-desktop/
            pause
            exit /b 1
        )
        echo [INFO] Docker Desktop installed. Updating PATH...
        set "PATH=%ProgramFiles%\Docker\Docker\resources\bin;%PATH%"
    ) else (
        echo [ERROR] winget is not available on this system.
        echo Please download and install Docker Desktop manually: https://www.docker.com/products/docker-desktop/
        pause
        exit /b 1
    )
) else (
    echo [SUCCESS] Docker CLI found.
)

:: ----------------------------------------------------------------------------
:: 2. Ensure Docker Desktop daemon is running
:: ----------------------------------------------------------------------------
echo [INFO] Checking Docker daemon status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Docker daemon is not active. Attempting to start Docker Desktop...
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe" (
        start "" "%LocalAppData%\Programs\Docker\Docker\Docker Desktop.exe"
    ) else (
        echo [WARNING] Could not locate Docker Desktop executable. Please start Docker Desktop manually.
    )

    echo [INFO] Waiting for Docker engine to initialize...
    set ATTEMPTS=0
    :WAIT_DOCKER
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% equ 0 goto DOCKER_READY
    set /a ATTEMPTS+=1
    if !ATTEMPTS! geq 30 (
        echo [ERROR] Timed out waiting for Docker engine. Please ensure Docker Desktop is started and try again.
        pause
        exit /b 1
    )
    goto WAIT_DOCKER
)

:DOCKER_READY
echo [SUCCESS] Docker engine is active and ready.

:: ----------------------------------------------------------------------------
:: 3. Check environment file
:: ----------------------------------------------------------------------------
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy /y ".env.example" ".env" >nul
        echo [SUCCESS] .env created.
    ) else (
        type nul > ".env"
    )
) else (
    echo [SUCCESS] .env file found.
)

:: ----------------------------------------------------------------------------
:: 4. Build and run containers
:: ----------------------------------------------------------------------------
echo [INFO] Building and starting containers in detached mode...
docker compose down >nul 2>&1
docker compose up --build -d
if %errorlevel% neq 0 (
    echo [WARNING] Retrying with docker-compose legacy command...
    docker-compose up --build -d
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to start Docker Compose services.
        pause
        exit /b 1
    )
)

:: ----------------------------------------------------------------------------
:: 5. Success summary
:: ----------------------------------------------------------------------------
echo.
echo ====================================================
echo    All Services Are Up and Running!
echo ====================================================
echo   Frontend:     http://localhost:3000
echo   Backend API:  http://localhost:8000
echo   API Docs:     http://localhost:8000/docs
echo   Health Check: http://localhost:8000/health
echo ====================================================
echo.
echo To view live logs:   docker compose logs -f
echo To stop containers:  docker compose down
echo.
pause
