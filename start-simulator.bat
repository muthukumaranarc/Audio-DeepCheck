@echo off
title Audio DeepCheck - Call Simulator (Port 5174)
color 0D
cd /d "%~dp0CallSimulator"

echo ========================================================================
echo       Starting Audio DeepCheck - Call Simulator (Vite/React)
echo ========================================================================
echo Port: 5174
echo Directory: %CD%
echo.

if not exist "%~dp0CallSimulator\node_modules" (
    echo Installing dependencies first...
    call npm install
)

call npm run dev

echo.
echo Call Simulator service stopped.
pause
