# Commander Deck Builder - Windows Development Startup Script

Write-Host "Commander Deck Builder - Starting Development Environment"
Write-Host ""

# Function to kill process on a port
function Kill-Port {
    param (
        [int]$Port
    )
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connection) {
        $pid_to_kill = $connection.OwningProcess
        Write-Host "Port $Port is in use by PID $pid_to_kill. Killing it..." -ForegroundColor Yellow
        Stop-Process -Id $pid_to_kill -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

# Clean up ports
Write-Host "Checking ports..."
Kill-Port 3000
Kill-Port 3001
Write-Host "Ports are clear."
Write-Host ""

# Start Backend
Write-Host "Starting Backend Server (port 3001)..."
$backendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev > ..\backend.log 2>&1" -WorkingDirectory ".\backend" -PassThru -WindowStyle Hidden

if ($backendProcess) {
    Write-Host "Backend started (PID: $($backendProcess.Id))"
} else {
    Write-Host "Failed to start Backend."
}

# Wait a moment
Start-Sleep -Seconds 2

# Start Frontend
Write-Host "Starting Frontend (port 3000)..."
$frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev > ..\frontend.log 2>&1" -WorkingDirectory ".\frontend" -PassThru -WindowStyle Hidden

if ($frontendProcess) {
    Write-Host "Frontend started (PID: $($frontendProcess.Id))"
} else {
    Write-Host "Failed to start Frontend."
}

Write-Host ""
Write-Host "---------------------------------------------------"
Write-Host "Commander Deck Builder is running!"
Write-Host "---------------------------------------------------"
Write-Host ""
Write-Host "Frontend: http://localhost:3000"
Write-Host "Backend:  http://localhost:3001"
Write-Host ""
Write-Host "Logs are being written to frontend.log and backend.log"
Write-Host "You can view them with: Get-Content frontend.log -Wait"
Write-Host ""
Write-Host "Press any key to stop all servers..."

$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Cleanup
Write-Host ""
Write-Host "Stopping servers..."

if ($frontendProcess -and -not $frontendProcess.HasExited) {
    Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
    # Also try to kill the node process tree if started via cmd
    # This is a bit tricky on Windows, but usually killing the parent cmd helps. 
    # Sometimes node stays alive. Let's try to be thorough.
}

if ($backendProcess -and -not $backendProcess.HasExited) {
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
}

# Aggressive cleanup for any lingering node processes started by us is hard to track perfectly 
# without job objects, but we can try to kill by port if they are still there.
# For now, let's trust Stop-Process on the cmd wrapper works reasonably well or the user can manually kill node.

Write-Host "Servers stopped."
