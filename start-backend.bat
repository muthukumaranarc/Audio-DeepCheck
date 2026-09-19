@echo off
title Audio DeepCheck - Backend API (Port 8080)
color 0E
cd /d "%~dp0Backend"

echo ========================================================================
echo       Starting Audio DeepCheck - Backend Service (Spring Boot)
echo ========================================================================
echo Port: 8080
echo Directory: %CD%
echo.

call mvn spring-boot:run

echo.
echo Backend service stopped.
pause
