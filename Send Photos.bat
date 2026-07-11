@echo off
title Send Photos to Claude
cd /d "%~dp0"

echo Sending any images in this folder to GitHub...
git add *.png *.jpg *.jpeg *.webp 2>nul
git commit -m "Add photos from my machine"
if errorlevel 1 (
  echo.
  echo No new images found in this folder.
  echo Drop your photos into this folder first, then run me again.
  pause
  exit /b
)
git push origin main
echo.
echo Done! Tell Claude the photos are pushed.
pause
