@echo off
setlocal EnableDelayedExpansion

REM CryptX Web3 Portfolio Tracker - Windows Startup Script

REM Configuration
set "PROJECT_ROOT=%~dp0"
set "API_DIR=%PROJECT_ROOT%apps\api"
set "WEB_DIR=%PROJECT_ROOT%apps\web"

REM Check for arguments
if "%1"=="setup" goto setup
if "%1"=="start" goto start
if "%1"=="help" goto help
if "%1"=="" goto start

:setup
echo [INFO] Starting setup process...

REM Check prereqs (Node/npm)
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js v18+
    exit /b 1
)

REM Install dependencies
echo [INFO] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    exit /b 1
)

REM Setup Environment
echo [INFO] Setting up environment files...
if not exist "%API_DIR%\.env" (
    if exist "%API_DIR%\.env.example" (
        copy "%API_DIR%\.env.example" "%API_DIR%\.env" >nul
        echo [SUCCESS] Created backend .env file.
        echo [IMPORTANT] Please update apps\api\.env with your database credentials!
    ) else (
        echo [ERROR] Backend .env.example not found!
    )
) else (
    echo [INFO] Backend .env already exists.
)

if not exist "%WEB_DIR%\.env.local" (
    if exist "%WEB_DIR%\.env.example" (
        copy "%WEB_DIR%\.env.example" "%WEB_DIR%\.env.local" >nul
        echo [SUCCESS] Created frontend .env.local file.
    ) else (
        echo [ERROR] Frontend .env.example not found!
    )
) else (
    echo [INFO] Frontend .env.local already exists.
)

REM Setup Database
echo [INFO] Setting up database...
cd "%API_DIR%"
call npx prisma generate
call npx prisma migrate dev --name init_windows
if %errorlevel% neq 0 (
    echo [ERROR] Database migration failed. Ensure PostgreSQL is running and .env is configured.
    cd "%PROJECT_ROOT%"
    exit /b 1
)
cd "%PROJECT_ROOT%"

echo [SUCCESS] Setup completed successfully!
echo [INFO] You can now run "start.bat" to start the application.
goto end

:start
echo [INFO] Starting CryptX Web3...
call npm run dev
goto end

:help
echo Usage:
echo   start.bat setup    - Install dependencies and setup database
echo   start.bat start    - Start the application (default)
echo   start.bat help     - Show this help message
goto end

:end
endlocal
