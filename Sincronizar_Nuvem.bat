@echo off
title Sincronizar FCM Metalicos com a Nuvem (Supabase)
cd /d "%~dp0"

echo ================================================================
echo    FCM METALICOS - SINCRONIZADOR PARA A NUVEM SUPABASE
echo ================================================================
echo.
echo Processando planilhas locais e enviando dados para a nuvem...
echo.

python backend\sincronizar_supabase.py

echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul
