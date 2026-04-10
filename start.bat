@echo off
setlocal

echo ================================
echo CryptX Web3 Portfolio Tracker
echo ================================
echo.

echo ================================
echo CHECKING PREREQUISITES
echo ================================
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 18+
    exit /b 1
) else (
    for /f "tokens=*" %%v in ('node --version') do echo [SUCCESS] Node.js found: %%v
)

npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed.
    exit /b 1
) else (
    for /f "tokens=*" %%v in ('npm --version') do echo [SUCCESS] npm found: %%v
)

if not exist "apps\api\.env" (
    if exist "apps\api\.env.example" (
        copy "apps\api\.env.example" "apps\api\.env" >nul
        echo [SUCCESS] Created backend .env file
    ) else (
        echo [WARNING] Backend .env.example not found!
    )
)

if not exist "apps\web\.env.local" (
    if exist "apps\web\.env.example" (
        copy "apps\web\.env.example" "apps\web\.env.local" >nul
        echo [SUCCESS] Created frontend .env.local file
    ) else (
        echo [WARNING] Frontend .env.example not found!
    )
)

echo.
echo ================================
echo INSTALLING DEPENDENCIES
echo ================================
if not exist "node_modules\" (
    echo Installing root dependencies...
    call npm install
) else (
    echo [SUCCESS] Root dependencies already installed
)

if not exist "apps\api\node_modules\" (
    echo Installing backend dependencies...
    cd apps\api
    call npm install
    cd ..\..
) else (
    echo [SUCCESS] Backend dependencies already installed
)

if not exist "apps\web\node_modules\" (
    echo Installing frontend dependencies...
    cd apps\web
    call npm install
    cd ..\..
) else (
    echo [SUCCESS] Frontend dependencies already installed
)

echo.
echo ================================
echo SETTING UP DATABASE
echo ================================
cd apps\api
echo Generating Prisma client...
call npx prisma generate
echo Running database migrations...
call npx prisma migrate deploy || call npx prisma migrate dev --name init
cd ..\..

echo.
echo ================================
echo STARTING SERVICES
echo ================================
echo Starting both backend and frontend...
echo Backend will run on port 5001
echo Frontend will run on port 3000
echo.

call npm run dev
