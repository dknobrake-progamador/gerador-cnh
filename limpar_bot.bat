@echo off
setlocal enabledelayedexpansion

:: PEGA O NOME DA PASTA ATUAL PARA PERSONALIZAR A MENSAGEM
for %%I in ("%cd%") do set "NOME_BOT=%%~nxI"

:: Define o título da janela
title RESET - !NOME_BOT!

:: Verifica se está como Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    set "STATUS_ADMIN=[!] RODANDO SEM ADMIN (Limpeza Parcial)"
) else (
    set "STATUS_ADMIN=[OK] RODANDO COMO ADMIN (Limpeza Total)"
)

echo ============================================================
echo   RESET UNIVERSAL: !NOME_BOT!
echo   STATUS: !STATUS_ADMIN!
echo ============================================================
echo.

:: 1. Finaliza os processos (Chrome, Driver e Node)
echo [1/3] Finalizando processos (Chrome/Node/Driver)...
taskkill /F /IM chrome.exe /T >nul 2>&1
taskkill /F /IM chromedriver.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
echo --- Processos encerrados.

:: 2. Limpa ficheiros temporários que travam o bot
echo [2/3] Removendo lixo temporario (Scoped Dir)...
del /q /s /f %temp%\scoped_dir* >nul 2>&1
del /q /s /f %temp%\chrome_url_fetcher* >nul 2>&1
echo --- Temporarios limpos.

:: 3. Limpa cache de rede
echo [3/3] Resetando cache de DNS...
ipconfig /flushdns >nul 2>&1
echo --- Rede limpa.

echo.
echo ============================================================
echo    LIMPEZA CONCLUIDA NO BOT: !NOME_BOT!
echo    Agora voce pode rodar o comando: node index.js
echo ============================================================
echo.
pause