Write-Host "Starting npm install for Frontend and Backend..." -ForegroundColor Cyan

# Start frontend install
Write-Host "Launching frontend installation..."
$frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install" -WorkingDirectory ".\frontend" -PassThru

# Start backend install
Write-Host "Launching backend installation..."
$backendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm install" -WorkingDirectory ".\backend" -PassThru

# Wait for both to finish
Write-Host "Waiting for processes to complete..."
$frontendProcess | Wait-Process
$backendProcess | Wait-Process

Write-Host "Done installing dependencies!" -ForegroundColor Green
