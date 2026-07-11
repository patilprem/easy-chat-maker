@echo off
title Send Photos to Claude
cd /d "%~dp0"

echo ============================================
echo   Sending images from this folder to GitHub
echo ============================================
echo.

echo Images found in this folder:
dir /b *.png *.jpg *.jpeg *.webp 2>nul
echo.

rem One-time identity so commits never fail on a fresh machine
git config user.name >nul 2>&1 || git config user.name "Photo Upload"
git config user.email >nul 2>&1 || git config user.email "photos@local"

git checkout main
git pull origin main
for %%f in (*.png *.jpg *.jpeg *.webp) do git add "%%f"
git commit -m "Add photos from my machine"
git push origin main

echo.
echo ============================================
echo   If you see 'main -^> main' above, it worked.
echo   Otherwise, screenshot this window for Claude.
echo ============================================
pause
