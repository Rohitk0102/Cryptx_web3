@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

set "API_DIR=%PROJECT_ROOT%\apps\api"
set "WEB_DIR=%PROJECT_ROOT%\apps\web"
set "API_ENV=%API_DIR%\.env"
set "API_ENV_EXAMPLE=%API_DIR%\.env.example"
set "WEB_ENV=%WEB_DIR%\.env.local"
set "WEB_ENV_EXAMPLE=%WEB_DIR%\.env.example"
set "BACKEND_PORT=5000"
set "FRONTEND_PORT=3000"
set "LOCAL_DATABASE_URL=postgresql://user:password@localhost:5432/cryptx"
set "LOCAL_REDIS_URL=redis://localhost:6379"
set "API_ENV_BACKUP=%API_DIR%\.env.start-bat.bak"
set "POSTGRES_CONTAINER=cryptx_postgres"
set "REDIS_CONTAINER=cryptx_redis"
set "DOCKER_READY=0"
set "DOCKER_COMPOSE_CMD="

set "COMMAND=%~1"
if "%COMMAND%"=="" set "COMMAND=start"

if /I "%COMMAND%"=="start" goto :start
if /I "%COMMAND%"=="setup" goto :setup
if /I "%COMMAND%"=="check" goto :check
if /I "%COMMAND%"=="help" goto :help
if /I "%COMMAND%"=="--help" goto :help
if /I "%COMMAND%"=="-h" goto :help

echo [ERROR] Unknown command: %COMMAND%
echo.
goto :help

:start
call :bootstrap
if errorlevel 1 goto :fail

call :warn_on_missing_optional_keys
call :require_start_env
if errorlevel 1 goto :fail

echo.
echo [INFO] Starting CryptX...
echo [INFO] Frontend: http://localhost:%FRONTEND_PORT%
echo [INFO] Backend:  http://localhost:%BACKEND_PORT%
echo [INFO] Press Ctrl+C to stop both services.
echo.
cd /d "%PROJECT_ROOT%"
call npm run dev
if errorlevel 1 goto :fail
goto :end

:setup
call :bootstrap
if errorlevel 1 goto :fail

call :warn_on_missing_optional_keys

echo.
echo [SUCCESS] Setup completed.
echo [INFO] Run start.bat to launch the project.
goto :end

:check
call :check_node
if errorlevel 1 goto :fail
call :check_npm
if errorlevel 1 goto :fail
call :detect_docker
call :ensure_env_files
if errorlevel 1 goto :fail
call :print_env_status
call :ensure_local_database_env
if errorlevel 1 goto :fail
goto :end

:help
echo CryptX Windows bootstrap
echo.
echo Usage:
echo   start.bat             Install deps, prepare env, setup DB, and start app
echo   start.bat start       Same as above
echo   start.bat setup       Install deps, prepare env, and setup DB only
echo   start.bat check       Check local prerequisites and fix local DB env values
echo   start.bat help        Show this help
echo.
echo What it does:
echo   1. Checks Node.js and npm
echo   2. Installs workspace dependencies
echo   3. Creates apps\api\.env and apps\web\.env.local if missing
echo   4. Fixes apps\api\.env to local PostgreSQL and Redis endpoints
echo   5. Starts PostgreSQL and Redis with Docker Desktop when available
echo   6. Runs Prisma generate + migrate deploy
echo   7. Starts frontend and backend together
goto :end

:bootstrap
call :print_header CHECKING PREREQUISITES
call :check_node
if errorlevel 1 exit /b 1
call :check_npm
if errorlevel 1 exit /b 1
call :detect_docker

call :print_header INSTALLING DEPENDENCIES
call :install_dependencies
if errorlevel 1 exit /b 1

call :print_header PREPARING ENVIRONMENT FILES
call :ensure_env_files
if errorlevel 1 exit /b 1

call :ensure_local_database_env
if errorlevel 1 exit /b 1

call :print_header STARTING LOCAL SERVICES
call :ensure_local_services
if errorlevel 1 exit /b 1

call :print_header SETTING UP DATABASE
call :setup_database
if errorlevel 1 exit /b 1

exit /b 0

:check_node
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js 18 or newer is required.
    echo [INFO] Install it from https://nodejs.org/
    exit /b 1
)

for /f "delims=" %%V in ('node --version') do set "NODE_VERSION=%%V"
for /f "tokens=1 delims=." %%M in ("!NODE_VERSION:v=!") do set "NODE_MAJOR=%%M"
if !NODE_MAJOR! LSS 18 (
    echo [ERROR] Found Node.js !NODE_VERSION!, but version 18 or newer is required.
    exit /b 1
)

echo [OK] Node.js !NODE_VERSION!
exit /b 0

:check_npm
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm is not installed or not on PATH.
    exit /b 1
)

for /f "delims=" %%V in ('npm --version') do set "NPM_VERSION=%%V"
echo [OK] npm !NPM_VERSION!
exit /b 0

:detect_docker
set "DOCKER_READY=0"
set "DOCKER_COMPOSE_CMD="

where docker >nul 2>nul
if errorlevel 1 (
    echo [WARN] Docker Desktop not found. start.bat will not auto-start PostgreSQL/Redis.
    echo [WARN] Install Docker Desktop or provide your own PostgreSQL and Redis instances.
    exit /b 0
)

docker info >nul 2>nul
if errorlevel 1 (
    echo [WARN] Docker is installed but not running. Start Docker Desktop for full one-click setup.
    exit /b 0
)

docker compose version >nul 2>nul
if not errorlevel 1 (
    set "DOCKER_READY=1"
    set "DOCKER_COMPOSE_CMD=docker compose"
    echo [OK] Docker Desktop detected (using docker compose)
    exit /b 0
)

where docker-compose >nul 2>nul
if not errorlevel 1 (
    set "DOCKER_READY=1"
    set "DOCKER_COMPOSE_CMD=docker-compose"
    echo [OK] Docker Desktop detected (using docker-compose)
    exit /b 0
)

echo [WARN] Docker is installed, but no compose command was found.
echo [WARN] Install Docker Compose or run PostgreSQL and Redis manually.
exit /b 0

:install_dependencies
cd /d "%PROJECT_ROOT%"

if exist "%PROJECT_ROOT%\node_modules" (
    echo [INFO] node_modules already exists. Skipping npm install.
    exit /b 0
)

echo [INFO] Installing npm workspace dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed.
    exit /b 1
)

echo [OK] Dependencies installed.
exit /b 0

:ensure_env_files
if not exist "%API_ENV%" (
    if not exist "%API_ENV_EXAMPLE%" (
        echo [ERROR] Missing template: %API_ENV_EXAMPLE%
        exit /b 1
    )

    copy "%API_ENV_EXAMPLE%" "%API_ENV%" >nul
    echo [OK] Created apps\api\.env
    echo [INFO] Review apps\api\.env if you want to add real Clerk, CoinDCX, or AI API keys.
)
if exist "%API_ENV%" (
    echo [INFO] Backend env ready: apps\api\.env
)

if not exist "%WEB_ENV%" (
    if not exist "%WEB_ENV_EXAMPLE%" (
        echo [ERROR] Missing template: %WEB_ENV_EXAMPLE%
        exit /b 1
    )

    copy "%WEB_ENV_EXAMPLE%" "%WEB_ENV%" >nul
    echo [OK] Created apps\web\.env.local
    echo [INFO] Update apps\web\.env.local with your Clerk keys before using authentication.
)
if exist "%WEB_ENV%" (
    echo [INFO] Frontend env ready: apps\web\.env.local
)

exit /b 0

:ensure_local_services
if not "%DOCKER_READY%"=="1" (
    echo [WARN] Skipping Docker service startup.
    echo [WARN] Make sure PostgreSQL is reachable at localhost:5432 and Redis at localhost:6379.
    exit /b 0
)

cd /d "%PROJECT_ROOT%"
echo [INFO] Starting PostgreSQL and Redis containers...
call %DOCKER_COMPOSE_CMD% up -d postgres redis
if errorlevel 1 (
    echo [ERROR] Failed to start Docker services.
    exit /b 1
)

call :wait_for_postgres
exit /b 0

:wait_for_postgres
set "POSTGRES_READY=0"

for /L %%I in (1,1,30) do (
    docker exec "%POSTGRES_CONTAINER%" pg_isready -U user -d cryptx >nul 2>nul
    if !errorlevel! equ 0 (
        set "POSTGRES_READY=1"
        goto :postgres_ready
    )

    echo [INFO] Waiting for PostgreSQL... attempt %%I/30
    timeout /t 2 /nobreak >nul
)

:postgres_ready
if "%POSTGRES_READY%"=="1" (
    echo [OK] PostgreSQL is ready.
) else (
    echo [WARN] PostgreSQL did not report ready in time. Prisma will try anyway.
)

exit /b 0

:setup_database
cd /d "%API_DIR%"

echo [INFO] Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] prisma generate failed.
    exit /b 1
)

echo [INFO] Applying Prisma migrations...
call npx prisma migrate deploy
if errorlevel 1 (
    echo [WARN] prisma migrate deploy failed. Trying prisma db push for local dev bootstrap...
    call npx prisma db push
    if errorlevel 1 (
        echo [ERROR] Prisma database setup failed.
        echo [INFO] Check apps\api\.env DATABASE_URL and ensure PostgreSQL is running.
        exit /b 1
    )
)

echo [OK] Database ready.
exit /b 0

:warn_on_missing_optional_keys
call :check_env_value "%WEB_ENV%" "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=" WEB_CLERK_PK
call :check_env_value "%WEB_ENV%" "CLERK_SECRET_KEY=" WEB_CLERK_SK
call :check_env_value "%WEB_ENV%" "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=" WEB_WC_ID
call :check_env_value "%API_ENV%" "CLERK_SECRET_KEY=" API_CLERK_SK

if /I "!WEB_CLERK_PK!"=="missing" echo [WARN] apps\web\.env.local is missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.
if /I "!WEB_CLERK_PK!"=="empty" echo [WARN] apps\web\.env.local has an empty NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.
if /I "!WEB_CLERK_SK!"=="missing" echo [WARN] apps\web\.env.local is missing CLERK_SECRET_KEY.
if /I "!WEB_CLERK_SK!"=="empty" echo [WARN] apps\web\.env.local has an empty CLERK_SECRET_KEY.
if /I "!WEB_WC_ID!"=="missing" echo [WARN] apps\web\.env.local is missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
if /I "!WEB_WC_ID!"=="empty" echo [WARN] apps\web\.env.local has an empty NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
if /I "!API_CLERK_SK!"=="missing" echo [WARN] apps\api\.env is missing CLERK_SECRET_KEY.
if /I "!API_CLERK_SK!"=="empty" echo [WARN] apps\api\.env has an empty CLERK_SECRET_KEY.

if /I "!WEB_CLERK_PK!"=="missing" goto :warn_summary
if /I "!WEB_CLERK_PK!"=="empty" goto :warn_summary
if /I "!WEB_CLERK_SK!"=="missing" goto :warn_summary
if /I "!WEB_CLERK_SK!"=="empty" goto :warn_summary
if /I "!API_CLERK_SK!"=="missing" goto :warn_summary
if /I "!API_CLERK_SK!"=="empty" goto :warn_summary
exit /b 0

:warn_summary
echo [INFO] Local setup can complete, but Clerk-powered authentication still needs real keys.
echo [INFO] Update apps\api\.env and apps\web\.env.local before starting the full app on a new device.
exit /b 0

:require_start_env
set "START_ENV_OK=1"

if /I "!WEB_CLERK_PK!"=="missing" set "START_ENV_OK=0"
if /I "!WEB_CLERK_PK!"=="empty" set "START_ENV_OK=0"
if /I "!WEB_CLERK_SK!"=="missing" set "START_ENV_OK=0"
if /I "!WEB_CLERK_SK!"=="empty" set "START_ENV_OK=0"
if /I "!API_CLERK_SK!"=="missing" set "START_ENV_OK=0"
if /I "!API_CLERK_SK!"=="empty" set "START_ENV_OK=0"

if "%START_ENV_OK%"=="1" exit /b 0

echo.
echo [ERROR] Required Clerk environment values are not configured yet.
echo [INFO] Fill these files and run start.bat again:
echo [INFO]   - apps\web\.env.local
echo [INFO]   - apps\api\.env
echo [INFO] Use start.bat setup if you only want to install dependencies and prepare the database.
exit /b 1

:backup_api_env_if_needed
if not exist "%API_ENV%" exit /b 0
if exist "%API_ENV_BACKUP%" exit /b 0

copy "%API_ENV%" "%API_ENV_BACKUP%" >nul
if errorlevel 1 (
    echo [ERROR] Failed to create backup file: apps\api\.env.start-bat.bak
    exit /b 1
)

echo [INFO] Backed up original apps\api\.env to apps\api\.env.start-bat.bak
exit /b 0

:ensure_local_database_env
call :read_env_value "%API_ENV%" "DATABASE_URL=" DATABASE_URL_VALUE
call :read_env_value "%API_ENV%" "REDIS_URL=" REDIS_URL_VALUE
call :read_env_value "%API_ENV%" "DISABLE_REDIS=" DISABLE_REDIS_VALUE

if "!DATABASE_URL_VALUE!"=="" (
    echo [WARN] apps\api\.env is missing DATABASE_URL. Fixing it for local PostgreSQL.
    call :backup_api_env_if_needed
    call :upsert_env_value "%API_ENV%" "DATABASE_URL" "\"%LOCAL_DATABASE_URL%\""
    if errorlevel 1 exit /b 1
    set "DATABASE_URL_VALUE=%LOCAL_DATABASE_URL%"
)

set "DATABASE_URL_IS_LOCAL=0"
echo !DATABASE_URL_VALUE! | findstr /i /c:"@localhost:5432/cryptx" /c:"@127.0.0.1:5432/cryptx" >nul
if not errorlevel 1 set "DATABASE_URL_IS_LOCAL=1"

if "!DATABASE_URL_IS_LOCAL!"=="0" (
    echo [WARN] DATABASE_URL is not using the local PostgreSQL endpoint. Rewriting it now.
    call :backup_api_env_if_needed
    call :upsert_env_value "%API_ENV%" "DATABASE_URL" "\"%LOCAL_DATABASE_URL%\""
    if errorlevel 1 exit /b 1
    set "DATABASE_URL_IS_LOCAL=1"
)
if "!DATABASE_URL_IS_LOCAL!"=="1" (
    echo [OK] DATABASE_URL points to local PostgreSQL.
)

if "!REDIS_URL_VALUE!"=="" (
    echo [WARN] apps\api\.env is missing REDIS_URL. Fixing it for local Redis.
    call :backup_api_env_if_needed
    call :upsert_env_value "%API_ENV%" "REDIS_URL" "\"%LOCAL_REDIS_URL%\""
    if errorlevel 1 exit /b 1
    set "REDIS_URL_VALUE=%LOCAL_REDIS_URL%"
)

set "REDIS_URL_IS_LOCAL=0"
echo !REDIS_URL_VALUE! | findstr /i /c:"redis://localhost:6379" /c:"redis://127.0.0.1:6379" >nul
if not errorlevel 1 set "REDIS_URL_IS_LOCAL=1"

if "!REDIS_URL_IS_LOCAL!"=="0" (
    echo [WARN] REDIS_URL is not using the local Redis endpoint. Rewriting it now.
    call :backup_api_env_if_needed
    call :upsert_env_value "%API_ENV%" "REDIS_URL" "\"%LOCAL_REDIS_URL%\""
    if errorlevel 1 exit /b 1
    set "REDIS_URL_IS_LOCAL=1"
)
if "!REDIS_URL_IS_LOCAL!"=="1" (
    echo [OK] REDIS_URL points to local Redis.
)

if /I "!DISABLE_REDIS_VALUE!"=="true" (
    echo [INFO] DISABLE_REDIS=true in apps\api\.env. Redis is configured locally but the app will not use it.
)

exit /b 0

:check_env_value
set "%~3=missing"
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:%2 "%~1" 2^>nul`) do (
    if "%%B"=="" (
        set "%~3=empty"
    ) else (
        set "%~3=configured"
    )
)
exit /b 0

:read_env_value
set "%~3="
for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:%2 "%~1" 2^>nul`) do (
    set "%~3=%%B"
)
call set "%~3=%%%~3:"=%"
exit /b 0

:upsert_env_value
set "UPSERT_ENV_FILE=%~1"
set "UPSERT_ENV_KEY=%~2"
set "UPSERT_ENV_VALUE=%~3"

set "TARGET_FILE=%UPSERT_ENV_FILE%"
set "TARGET_KEY=%UPSERT_ENV_KEY%"
set "TARGET_VALUE=%UPSERT_ENV_VALUE%"

node -e "const fs=require('fs'); const file=process.env.TARGET_FILE; const key=process.env.TARGET_KEY; const value=process.env.TARGET_VALUE; let lines=fs.existsSync(file)?fs.readFileSync(file,'utf8').split(/\r?\n/):[]; let replaced=false; lines=lines.map((line)=>{ if(line.startsWith(key+'=')){ replaced=true; return key+'='+value; } return line; }); while(lines.length && lines[lines.length-1]==='') lines.pop(); if(!replaced) lines.push(key+'='+value); fs.writeFileSync(file, lines.join('\n')+'\n');"
if errorlevel 1 (
    echo [ERROR] Failed to update %UPSERT_ENV_KEY% in %UPSERT_ENV_FILE%.
    exit /b 1
)

exit /b 0

:print_env_status
if exist "%API_ENV%" (
    echo [OK] Found apps\api\.env
) else (
    echo [WARN] Missing apps\api\.env
)

if exist "%WEB_ENV%" (
    echo [OK] Found apps\web\.env.local
) else (
    echo [WARN] Missing apps\web\.env.local
)
exit /b 0

:print_header
echo.
echo ==================================================
echo %*
echo ==================================================
exit /b 0

:fail
echo.
echo [ERROR] start.bat could not complete successfully.
exit /b 1

:end
endlocal
