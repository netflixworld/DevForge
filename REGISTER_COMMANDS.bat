@echo off
setlocal
title DevForge Command Registration
cd /d "%~dp0"
call npm run deploy:commands
if errorlevel 1 (
  echo.
  echo Registration failed. Check the values in .env.
  pause
  exit /b 1
)
echo.
echo Commands synchronized successfully.
echo If Discord was already open, press Ctrl+R to refresh the command list.
pause
