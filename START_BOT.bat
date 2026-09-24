@echo off
setlocal
title DevForge
cd /d "%~dp0"
if not exist "dist\src\index.js" (
  echo Building DevForge...
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm start
echo.
echo DevForge stopped. Review the error above if this was unexpected.
pause
