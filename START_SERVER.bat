@echo off
title CORE8 - Start Server
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\server.ps1" -Action Start
set "CORE8_EXIT=%ERRORLEVEL%"
echo.
pause
exit /b %CORE8_EXIT%
