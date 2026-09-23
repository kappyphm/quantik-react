$ErrorActionPreference = "SilentlyContinue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "            QUANTIK - DỪNG CÁC DỊCH VỤ DEMO               " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Dừng Frontend Vite (port 5173)
$fe = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($fe) {
    Stop-Process -Id $fe.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "[+] Đã dừng Frontend Vite (Port 5173)" -ForegroundColor Green
}

# 2. Dừng Backend FastAPI (port 8000)
$be = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($be) {
    Stop-Process -Id $be.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "[+] Đã dừng Backend FastAPI (Port 8000)" -ForegroundColor Green
}

# 3. Dừng Quant Worker
Get-CimInstance Win32_Process -Filter "Name LIKE 'python%' AND CommandLine LIKE '%worker.py%'" -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "[+] Đã dừng Quant Worker (PID: $($_.ProcessId))" -ForegroundColor Green
}

# 4. Dừng Ngrok
Get-Process ngrok -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    Write-Host "[+] Đã dừng tiến trình Ngrok" -ForegroundColor Green
}

Write-Host ""
Write-Host "Hoàn tất! Toàn bộ tiến trình demo đã được giải phóng." -ForegroundColor Cyan
Start-Sleep -Seconds 2
