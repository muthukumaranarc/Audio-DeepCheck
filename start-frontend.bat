@echo off
title Audio DeepCheck - Frontend Dashboard (Port 3000)
color 0B
cd /d "%~dp0Frontend"

echo ========================================================================
echo       Starting Audio DeepCheck - Frontend Dashboard (Vite/React)
echo ========================================================================
echo Port: 3000
echo Directory: %CD%
echo.

if not exist "%~dp0Frontend\node_modules" (
    echo Installing dependencies first...
    call npm install
)

call npm run dev

echo.
echo Frontend service stopped.
pause
