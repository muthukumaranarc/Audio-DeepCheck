@echo off
title Audio DeepCheck - AI Model (Port 8000)
color 0A
cd /d "%~dp0AI-Model"

echo ========================================================================
echo       Starting Audio DeepCheck - AI Model Service (FastAPI)
echo ========================================================================
echo Port: 8000
echo Directory: %CD%
echo.

if exist "%~dp0AI-Model\.venv\Scripts\python.exe" (
    echo Using virtualenv Python: %~dp0AI-Model\.venv\Scripts\python.exe
    "%~dp0AI-Model\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
) else (
    echo Using system Python
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
)

echo.
echo AI Model service stopped.
pause
