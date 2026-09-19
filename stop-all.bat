@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Audio DeepCheck - System Shutdown Script (Windows)
:: ============================================================================

title Audio DeepCheck - Stopping Services
color 0C
cd /d "%~dp0"

cls
echo ========================================================================
echo                 AUDIO DEEPCHECK - STOPPING ALL SERVICES
echo ========================================================================
echo.
echo Terminating processes on ports 8000, 8080, 3000, and 5174...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports = @(8000, 8080, 3000, 5174); " ^
  "$found = $false; " ^
  "foreach ($p in $ports) { " ^
  "  $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue; " ^
  "  if ($conns) { " ^
  "    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique; " ^
  "    foreach ($procId in $pids) { " ^
  "      try { " ^
  "        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue; " ^
  "        $name = if ($proc) { $proc.ProcessName } else { 'process' }; " ^
  "        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue; " ^
  "        Write-Host ('  [OK] Terminated ' + $name + ' (PID ' + $procId + ') on port ' + $p) -ForegroundColor Green; " ^
  "        $found = $true; " ^
  "      } catch {} " ^
  "    } " ^
  "  } else { " ^
  "    Write-Host ('  [--] Port ' + $p + ' is already free.') -ForegroundColor DarkGray; " ^
  "  } " ^
  "}; " ^
  "if (-not $found) { Write-Host '  No active services were detected on Audio DeepCheck ports.' -ForegroundColor Yellow; }"

echo.
echo ========================================================================
echo All Audio DeepCheck services have been cleanly shut down.
echo ========================================================================
echo.
pause
