# VARUNA-AI: Reliance KG-D6 Subsea Digital Twin Installer & Launcher
# PowerShell Execution Script

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  RELIANCE OFFSHORE CYBER-PHYSICAL SUITE : KG-D6 SUBSEA DIGITAL TWIN" -ForegroundColor Cyan
Write-Host "                         ""VARUNA-AI""" -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found in PATH." -ForegroundColor Red
    Write-Host "Please download and install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Exit 1
}

$nodeVersion = node -v
Write-Host "[OK] Node.js runtime active: $nodeVersion" -ForegroundColor Green

# 2. Check Node Modules
if (-not (Test-Path "node_modules")) {
    Write-Host "[SETUP] First-time setup: Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm install failed." -ForegroundColor Red
        Exit 1
    }
}

# 3. Check Production Build
if (-not (Test-Path "dist")) {
    Write-Host "[BUILD] Compiling production shaders and Three.js bundle..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] npm run build failed." -ForegroundColor Red
        Exit 1
    }
}

# 4. Launch Desktop Application
Write-Host "[LAUNCH] Launching VARUNA-AI Native Desktop Window..." -ForegroundColor Cyan
node start-desktop.js
