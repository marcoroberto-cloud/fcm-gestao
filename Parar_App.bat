@echo off
title Encerrar FCM Metalicos
cd /d "%~dp0"
echo ============================================
echo   Encerrando Servidor FCM Metalicos (Porta 8000)
echo ============================================
echo.

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Finalizando processo PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Servidor encerrado com sucesso!
timeout /t 2 >nul
