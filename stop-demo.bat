@echo off
chcp 65001 >nul
title QuanTik - Dừng Dịch Vụ Demo
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-demo.ps1"
