@echo off
title Gestao Integrada FCM - PCP
cd /d "%~dp0"

echo ===================================================
echo     INICIANDO PAINEL DE GESTAO INTEGRADA FCM
echo ===================================================
echo.

:: Inicia o Streamlit abrindo apenas uma aba sem duplicidade
python -m streamlit run app.py --server.port 8501 --server.headless false --browser.gatherUsageStats false

echo.
echo Ocorreu um erro ou o Streamlit foi encerrado.
pause