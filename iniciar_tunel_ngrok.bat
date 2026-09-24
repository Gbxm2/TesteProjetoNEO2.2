@echo off
title Industrial Safety Monitor - Tunel ngrok
chcp 65001 >nul
cls

echo =====================================================================
echo           TUNELAMENTO NGROK PARA VERCEL (PORTA 3000)
echo =====================================================================
echo.
echo Certifique-se de que o servidor local (npm run dev) ja esteja rodando!
echo.
echo O ngrok vai gerar uma URL publica (ex: https://xxxx.ngrok-free.app).
echo Copie essa URL https e coloque no Vercel em:
echo   Settings -^> Environment Variables
echo   Nome:  VITE_API_URL
echo   Valor: https://xxxx.ngrok-free.app
echo.
echo =====================================================================
echo.
ngrok http 3000 --region us
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Falha ao conectar pelo ngrok. Tentando tunelamento alternativo (localtunnel)...
    npx localtunnel --port 3000
)
pause