@echo off
chcp 65001 >nul
title QuanTik - Ngrok Demo Launcher
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-ngrok-demo.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Đã dừng lại hoặc có lỗi xảy ra.
    pause
)
