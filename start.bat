@echo off
setlocal EnableExtensions

:: ============================================================================
:: Audio DeepCheck - Unified System Launcher (Windows)
:: ============================================================================

title Audio DeepCheck - System Launcher
color 0B
cd /d "%~dp0"

cls
echo ========================================================================
echo                    AUDIO DEEPCHECK - SYSTEM LAUNCHER
echo          AI-Powered Real-Time Voice Deepfake Detection Platform
echo ========================================================================
echo.

:: ---------------------------------------------------------------------------
:: 1. Pre-flight Checks
:: ---------------------------------------------------------------------------
echo [1/3] Checking prerequisites...

where node >nul 2>&1
if errorlevel 1 goto ERR_NODE

where npm >nul 2>&1
if errorlevel 1 goto ERR_NPM

where mvn >nul 2>&1
if errorlevel 1 goto ERR_MVN

if exist "%~dp0AI-Model\.venv\Scripts\python.exe" goto PREREQS_OK
where python >nul 2>&1
if errorlevel 1 goto ERR_PYTHON

:PREREQS_OK
echo   [OK] Node.js, npm, Maven, and Python are ready.
echo.

:: ---------------------------------------------------------------------------
:: 2. Launch Services in Dedicated Windows
:: ---------------------------------------------------------------------------
echo [2/3] Launching microservices in separate console windows...

echo   -- Starting AI Model Service on port 8000...
start "Audio DeepCheck - AI Model :8000" "%~dp0start-ai.bat"

echo   -- Starting Spring Boot Backend on port 8080...
start "Audio DeepCheck - Backend :8080" "%~dp0start-backend.bat"

echo   -- Starting Frontend Dashboard on port 3000...
start "Audio DeepCheck - Frontend :3000" "%~dp0start-frontend.bat"

echo   -- Starting Call Simulator on port 5174...
start "Audio DeepCheck - Call Simulator :5174" "%~dp0start-simulator.bat"

echo.
echo [3/3] Waiting 6 seconds for services to initialize...
ping 127.0.0.1 -n 7 >nul

:: ---------------------------------------------------------------------------
:: 3. Launch Browser
:: ---------------------------------------------------------------------------
echo Launching web interfaces in default browser...
start http://localhost:3000
start http://localhost:5174?user=A
start http://localhost:5174?user=B

:: ---------------------------------------------------------------------------
:: 4. Status Banner & Interactive Menu
:: ---------------------------------------------------------------------------
:MENU
cls
echo ========================================================================
echo             AUDIO DEEPCHECK - ALL SERVICES ARE RUNNING!
echo ========================================================================
echo.
echo   Microservice Endpoints:
echo   ----------------------------------------------------------------------
echo   [1] Frontend Dashboard    : http://localhost:3000
echo   [2] Call Simulator User A : http://localhost:5174?user=A
echo   [3] Call Simulator User B : http://localhost:5174?user=B
echo   [4] Backend Health API    : http://localhost:8080/api/v1/health
echo   [5] AI Model API Docs     : http://localhost:8000/docs
echo   ----------------------------------------------------------------------
echo.
echo   Management Actions:
echo   [O] Re-open Dashboard and Simulator tabs in browser
echo   [S] Stop all services and exit
echo   [X] Exit this launcher window (services keep running)
echo.
echo ========================================================================
choice /c OSX /n /m "Choose an action [O = Browser, S = Stop All, X = Exit Launcher]: "

if errorlevel 3 goto EXIT_LAUNCHER
if errorlevel 2 goto STOP_SERVICES
if errorlevel 1 goto OPEN_BROWSER

goto MENU

:OPEN_BROWSER
start http://localhost:3000
start http://localhost:5174?user=A
start http://localhost:5174?user=B
goto MENU

:STOP_SERVICES
call "%~dp0stop-all.bat"
exit /b 0

:EXIT_LAUNCHER
exit /b 0

:: ---------------------------------------------------------------------------
:: Error Handlers
:: ---------------------------------------------------------------------------
:ERR_NODE
echo.
echo [ERROR] Node.js was not found in your system PATH!
echo Please install Node.js (v18+) from https://nodejs.org/
echo.
pause
exit /b 1

:ERR_NPM
echo.
echo [ERROR] npm was not found in your system PATH!
echo Please ensure npm is installed alongside Node.js.
echo.
pause
exit /b 1

:ERR_MVN
echo.
echo [ERROR] Apache Maven ('mvn') was not found in your system PATH!
echo Please install Maven and JDK (v17+) from https://maven.apache.org/
echo.
pause
exit /b 1

:ERR_PYTHON
echo.
echo [ERROR] Python was not found in PATH or in AI-Model\.venv!
echo Please install Python 3.10+ or set up the virtual environment.
echo.
pause
exit /b 1
