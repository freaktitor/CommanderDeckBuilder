# Commander Deck Builder - Development Startup Script for Windows

# Set environment variables
$env:NEXT_TELEMETRY_DISABLED = "1"

Write-Host "`n[INFO] Commander Deck Builder - Starting Development Environment" -ForegroundColor Cyan
Write-Host "-----------------------------------------------------------`n"

# Check if we're in the right directory
if (-not (Test-Path "frontend")) {
    Write-Host "[ERROR] Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Function to stop process on a specific port
function Stop-ProcessOnPort {
    param($port)
    $process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($process) {
        Write-Host "[WARN] Port $port is already in use (PID: $($process.OwningProcess))" -ForegroundColor Yellow
        Write-Host "Stopping process..." -NoNewline
        try {
            Stop-Process -Id $process.OwningProcess -Force
            Write-Host " Done." -ForegroundColor Green
        } catch {
            Write-Host " Failed to stop process. You may need to run as administrator." -ForegroundColor Red
        }
    }
}

# Check and clear ports
Write-Host "Checking ports..."
Stop-ProcessOnPort 3000
Stop-ProcessOnPort 3001
Write-Host ""

# Clean stale cache (common issue on OneDrive/Windows)
if (Test-Path "frontend\.next") {
    Write-Host "[INFO] Cleaning build cache..." -ForegroundColor Gray
    Remove-Item -Path "frontend\.next" -Recurse -Force -ErrorAction SilentlyContinue
}

# Start frontend
Write-Host "[INFO] Starting Frontend (port 3000)..." -ForegroundColor Magenta
Set-Location frontend

if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing frontend dependencies..." -ForegroundColor Cyan
    npm install
}

# Start the dev server and redirect logs
# Using Start-Process for better background management on Windows
$job = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    $env:NEXT_TELEMETRY_DISABLED = "1"
    npm run dev > "..\\frontend.log" 2>&1
} -ArgumentList $PWD.Path

Write-Host "[SUCCESS] Frontend started" -ForegroundColor Green
Set-Location ..

Write-Host "`n-----------------------------------------------------------"
Write-Host "[DONE] Commander Deck Builder is running!" -ForegroundColor Cyan
Write-Host "-----------------------------------------------------------"
Write-Host "`nURL: http://localhost:3000" -ForegroundColor Green
Write-Host "Note: If localhost doesn't load, try http://127.0.0.1:3000" -ForegroundColor Gray
Write-Host "`nLogs:"
Write-Host "   Get-Content -Wait frontend.log"
Write-Host "`nTo stop: Press Ctrl+C"
Write-Host "-----------------------------------------------------------`n"

# Cleanup logic on exit
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host "`n[INFO] Stopping services..." -ForegroundColor Yellow
    if ($job) {
        Stop-Job $job -ErrorAction SilentlyContinue
        Remove-Job $job -ErrorAction SilentlyContinue
    }
    
    # Final cleanup of any stray node processes
    $processes = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
    if ($processes) {
        foreach ($p in $processes) {
            Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
    
    Write-Host "[INFO] Servers stopped" -ForegroundColor Cyan
    exit 0
}
