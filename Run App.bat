@echo off
title Easy Chat Maker
cd /d "%~dp0"

echo ============================================
echo   Easy Chat Maker - starting up...
echo ============================================
echo.

echo [1/3] Getting latest changes from GitHub...
git checkout main >nul 2>&1
git pull origin main

echo.
echo [2/3] Installing dependencies (fast if already installed)...
call npm install --ignore-scripts

echo.
echo [3/3] Starting the app...
echo.
echo   Your browser will open automatically in a few seconds.
echo   KEEP THIS WINDOW OPEN while using the app.
echo   Close this window to stop the app.
echo.

start "" cmd /c "timeout /t 6 >nul & start http://localhost:4321/editor"
call npm run dev
