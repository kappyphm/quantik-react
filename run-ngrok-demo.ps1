<#
.SYNOPSIS
    QuanTik Demo Launcher via Ngrok
#>

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "            QUANTIK - NGROK DEMO LAUNCHER                 " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Tìm file ngrok
$ngrokPath = if (Get-Command ngrok -ErrorAction SilentlyContinue) {
    (Get-Command ngrok).Source
} elseif (Test-Path "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ngrok.exe") {
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ngrok.exe"
} else {
    $null
}

if (-not $ngrokPath) {
    Write-Host "[!] Không tìm thấy ngrok.exe. Đang cài đặt qua winget..." -ForegroundColor Yellow
    winget install --id Ngrok.Ngrok --accept-source-agreements --accept-package-agreements
    $ngrokPath = "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ngrok.exe"
}

# 2. Kiểm tra Authtoken
$configPath = "$env:LOCALAPPDATA\ngrok\ngrok.yml"
$hasToken = $false
if (Test-Path $configPath) {
    $content = Get-Content $configPath -Raw -ErrorAction SilentlyContinue
    if ($content -match "authtoken:") {
        $hasToken = $true
    }
}

if (-not $hasToken) {
    Write-Host "[*] Ngrok yêu cầu Authtoken để mở cổng ra ngoài Internet." -ForegroundColor Yellow
    Write-Host "    (Lấy mã miễn phí tại: https://dashboard.ngrok.com/get-started/your-authtoken)" -ForegroundColor Gray
    Write-Host ""
    $token = Read-Host "Nhập Ngrok Authtoken của bạn"
    if ([string]::IsNullOrWhiteSpace($token)) {
        Write-Host "[-] Bạn chưa nhập token. Không thể tiếp tục." -ForegroundColor Red
        pause
        exit 1
    }
    & $ngrokPath config add-authtoken $token.Trim()
    Write-Host "[+] Đã lưu token thành công!" -ForegroundColor Green
    Write-Host ""
}

# 3. Kiểm tra Backend (Port 8000)
$backendRunning = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if (-not $backendRunning) {
    Write-Host "[*] Đang khởi động Backend FastAPI (cổng 8000)..." -ForegroundColor Cyan
    Start-Process -FilePath "$PSScriptRoot\backend\.venv\Scripts\python.exe" -ArgumentList "-m uvicorn server:app --host 127.0.0.1 --port 8000" -WorkingDirectory "$PSScriptRoot\backend" -WindowStyle Minimized
    Start-Sleep -Seconds 2
} else {
    Write-Host "[+] Backend FastAPI đang chạy sẵn sàng tại cổng 8000." -ForegroundColor Green
}

# 4. Kiểm tra Frontend (Port 5173)
$frontendRunning = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if (-not $frontendRunning) {
    Write-Host "[*] Đang khởi động Frontend Vite (cổng 5173)..." -ForegroundColor Cyan
    Start-Process -FilePath "pnpm.cmd" -ArgumentList "dev" -WorkingDirectory $PSScriptRoot -WindowStyle Minimized
    Start-Sleep -Seconds 2
} else {
    Write-Host "[+] Frontend Vite đang chạy sẵn sàng tại cổng 5173." -ForegroundColor Green
}

Write-Host ""
Write-Host "[*] Đang khởi tạo đường hầm Ngrok trỏ tới http://localhost:5173..." -ForegroundColor Cyan
Write-Host "    (Nhấn Ctrl + C trong cửa sổ Ngrok để đóng đường hầm khi kết thúc cuộc họp)" -ForegroundColor Gray
Write-Host ""

# 5. Khởi chạy Ngrok
& $ngrokPath http 5173
