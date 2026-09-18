@echo off
title FCM Metalicos - Gestao Integrada (Web App)
cd /d "%~dp0"

echo ================================================================
echo       PAINEL DE GESTAO INTEGRADA FCM - SISTEMA WEB MODERNO
echo ================================================================
echo.
echo  Iniciando servidor local de alta performance...
echo.

:: Detecta IP local para orientar acesso em rede
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" /c:"Endereco IPv4"') do (
    set IP_LOCAL=%%a
    goto :ip_encontrado
)
:ip_encontrado
set IP_LOCAL=%IP_LOCAL: =%

echo  -------------------------------------------------------------
echo   [+] Acesso neste computador:           http://localhost:8000
if not "%IP_LOCAL%"=="" (
echo   [+] Acesso para colegas na mesma rede: http://%IP_LOCAL%:8000
)
echo  -------------------------------------------------------------
echo.
echo  Pressione Ctrl+C para encerrar o painel quando desejar.
echo.

:: Abre o navegador padrao no link local
start "" "http://localhost:8000"

:: Executa o servidor FastAPI com Uvicorn (modo otimizado de alta velocidade)
python -m uvicorn backend.server:app --host 0.0.0.0 --port 8000

echo.
echo O servidor foi finalizado.
pause
