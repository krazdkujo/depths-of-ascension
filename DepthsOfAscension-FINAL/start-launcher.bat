@echo off
echo 🎮 Starting Depths of Ascension Secure Launcher...
echo.
echo Checking Node.js installation...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found!
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo Then run this script again.
    pause
    exit /b 1
)

echo ✅ Node.js found
echo Installing launcher dependencies...
cd launcher-app
if not exist node_modules (
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

echo 🚀 Launching secure configuration interface...
npm start
pause