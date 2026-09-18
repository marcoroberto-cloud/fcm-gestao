@echo off
title Enviar FCM para o GitHub
cd /d "%~dp0"

echo ================================================================
echo       ENVIANDO PROJETO FCM GESTAO PARA O SEU GITHUB
echo ================================================================
echo.
echo 1. Solicitando login da sua conta atual (marcoroberto-cloud)...
echo    Uma janela do navegador vai se abrir. Basta clicar em "Authorize"!
echo.

git credential-manager github login

echo.
echo 2. Enviando arquivos para https://github.com/marcoroberto-cloud/fcm-gestao...
git push -u origin main

echo.
echo ================================================================
echo Concluido com sucesso!
echo ================================================================
pause
