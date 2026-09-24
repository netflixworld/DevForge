@echo off
setlocal
title DevForge Installer
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install Node.js 24 LTS or newer, then run this file again.
  echo https://nodejs.org/
  pause
  exit /b 1
)

node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>24||(major===24&&minor>=17)?0:1)"
if errorlevel 1 (
  echo [ERROR] DevForge requires Node.js 24.17.0 or newer.
  node --version
  pause
  exit /b 1
)

if not exist ".env" copy ".env.example" ".env" >nul

echo Installing DevForge dependencies...
call npm install
if errorlevel 1 (
  echo [ERROR] Dependency installation failed.
  pause
  exit /b 1
)

echo Building DevForge 2.0...
call npm run build
if errorlevel 1 (
  echo [ERROR] DevForge build failed.
  pause
  exit /b 1
)

echo.
echo Installation complete.
echo 1. Open .env and add your Discord token, application ID, and test server ID.
echo 2. Run REGISTER_COMMANDS.bat.
echo 3. Run START_BOT.bat.
echo.
start "" notepad ".env"
pause
