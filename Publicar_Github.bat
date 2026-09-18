@echo off
title Enviar FCM para o GitHub
cd /d "%~dp0"

echo ================================================================
echo       ENVIANDO PROJETO FCM GESTAO PARA O SEU GITHUB
echo ================================================================
echo.
echo Se for a primeira vez, pode abrir uma janelinha no seu navegador
echo pedindo para autorizar o acesso com 1 clique ("Sign in with browser").
echo.

git push -u origin main

echo.
echo ================================================================
echo Concluido!
echo ================================================================
pause
