@echo off
echo ======================================================
echo Precursor Dashboard Offline Setup & Run
echo ======================================================
echo.
echo Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

echo [1/3] Installing dependencies...
call npm install

echo [2/3] Building the application...
call npm run build

echo [3/3] Starting the local server...
echo The dashboard will be available at http://localhost:3000
echo.
echo Press Ctrl+C to stop the server.
echo.
call npm run dev
pause
