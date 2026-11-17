@echo off
title CORE8 - Stop Server
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server.ps1" -Action Stop
set "CORE8_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %CORE8_EXIT%
