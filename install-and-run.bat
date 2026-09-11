@echo off
title VARUNA-AI | Reliance KG-D6 Subsea Digital Twin Launcher
color 0B
cls

echo ==============================================================================
echo   RELIANCE OFFSHORE CYBER-PHYSICAL SUITE : KG-D6 SUBSEA DIGITAL TWIN
echo                          "VARUNA-AI"
echo ==============================================================================
echo.

:: 1. Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js 18+ from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detected:
node -v
echo.

:: 2. Check and Install Dependencies
if not exist "node_modules\" (
    echo [SETUP] Installing production dependencies (first-time setup)...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully.
    echo.
)

:: 3. Check and Build Production Assets
if not exist "dist\" (
    echo [BUILD] Compiling production bundle & Three.js shaders...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Production build failed!
        pause
        exit /b 1
    )
    echo [OK] Production build complete.
    echo.
)

:: 4. Start Server and Launch Browser
echo [LAUNCH] Starting local subsea server at http://localhost:1420 ...
start http://localhost:1420
node start-desktop.js

pause
