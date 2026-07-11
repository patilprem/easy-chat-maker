@echo off
title Easy Chat Maker
cd /d "%~dp0"

echo ============================================
echo   Easy Chat Maker - starting up...
echo ============================================
echo.

echo [1/5] Getting latest changes from GitHub...
git checkout main >nul 2>&1
git checkout -- package-lock.json >nul 2>&1
git pull origin main

echo.
echo [2/5] Installing dependencies (fast if already installed)...
call npm install
if errorlevel 1 (
  echo Full install had trouble, retrying in safe mode...
  call npm install --ignore-scripts
)

echo.
echo [3/5] Preparing the video exporter...
if not exist "node_modules\ffmpeg-static\ffmpeg.exe" call npm rebuild ffmpeg-static
call npx playwright install chromium

echo.
echo [4/5] Starting the video exporter in the background...
start "Easy Chat Maker - Video Exporter" /min cmd /c "npm run record:server"

echo.
echo [5/5] Starting the app...
echo.
echo   Your browser will open automatically in a few seconds.
echo   KEEP THIS WINDOW OPEN while using the app.
echo   Close this window (and the minimized exporter window)
echo   to stop the app.
echo.

start "" cmd /c "timeout /t 6 >nul & start http://localhost:4321/editor"
call npm run dev
