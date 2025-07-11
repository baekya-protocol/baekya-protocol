#!/usr/bin/env pwsh

# Baekya Protocol P2P Relay Server Railway Deployment Script

Write-Host "Starting Baekya Protocol P2P Relay Server Deployment" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan

# Check Railway CLI
try {
    $railwayVersion = railway version
    Write-Host "Railway CLI installed: $railwayVersion" -ForegroundColor Green
} catch {
    Write-Host "Railway CLI is not installed!" -ForegroundColor Red
    Write-Host "Install from: https://docs.railway.app/develop/cli" -ForegroundColor Yellow
    exit 1
}

# Check Railway login
Write-Host "`nChecking Railway login..." -ForegroundColor Blue
try {
    railway whoami
    Write-Host "Logged in to Railway" -ForegroundColor Green
} catch {
    Write-Host "Railway login required" -ForegroundColor Yellow
    railway login
}

# Check project connection
Write-Host "`nChecking Railway project connection..." -ForegroundColor Blue
$projectLinked = $false
try {
    railway status
    $projectLinked = $true
    Write-Host "Connected to Railway project" -ForegroundColor Green
} catch {
    Write-Host "Railway project connection required" -ForegroundColor Yellow
}

if (-not $projectLinked) {
    Write-Host "`nRailway Project Selection:" -ForegroundColor Cyan
    Write-Host "1. Create new project" -ForegroundColor White
    Write-Host "2. Link existing project" -ForegroundColor White
    
    $choice = Read-Host "Select (1 or 2)"
    
    if ($choice -eq "1") {
        Write-Host "`nCreating new Railway project..." -ForegroundColor Blue
        railway init
    } else {
        Write-Host "`nLinking to existing project..." -ForegroundColor Blue
        railway link
    }
}

# Set environment variables
Write-Host "`nSetting environment variables..." -ForegroundColor Blue

# PORT is automatically set by Railway
Write-Host "PORT: Automatically set by Railway" -ForegroundColor Green

# Set NODE_ENV
railway variables set NODE_ENV=production
Write-Host "NODE_ENV: production" -ForegroundColor Green

# Service name
$serviceName = "baekya-relay"
Write-Host "`nService name: $serviceName" -ForegroundColor Cyan

# Deployment settings
Write-Host "`nDeployment settings:" -ForegroundColor Cyan
Write-Host "   Start command: node p2p-relay-server.js" -ForegroundColor White
Write-Host "   Health check: /api/relay-status" -ForegroundColor White

# Start deployment
Write-Host "`nStarting Railway deployment..." -ForegroundColor Blue
Write-Host "=============================================" -ForegroundColor Cyan

try {
    # Deploy to Railway
    railway up --service $serviceName
    
    Write-Host "`nDeployment started!" -ForegroundColor Green
    Write-Host "Check deployment status: railway logs -f" -ForegroundColor Yellow
    
    # Get deployment URL
    Write-Host "`nGetting deployment URL..." -ForegroundColor Blue
    Start-Sleep -Seconds 5
    
    try {
        $status = railway status --json | ConvertFrom-Json
        $deployUrl = $status.domains[0]
        
        if ($deployUrl) {
            Write-Host "Relay server URL: https://$deployUrl" -ForegroundColor Green
            Write-Host "`nUpdate webapp config:" -ForegroundColor Yellow
            Write-Host "   window.RELAY_SERVER_URL = 'https://$deployUrl';" -ForegroundColor White
        }
    } catch {
        Write-Host "Cannot get URL automatically" -ForegroundColor Yellow
        Write-Host "   Check Railway dashboard" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Deployment failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=============================================" -ForegroundColor Cyan
Write-Host "Relay server deployment complete!" -ForegroundColor Green
Write-Host "`nMonitoring:" -ForegroundColor Yellow
Write-Host "   - Logs: railway logs -f" -ForegroundColor White
Write-Host "   - Dashboard: https://railway.app/dashboard" -ForegroundColor White
Write-Host "   - Health check: https://[your-domain]/api/relay-status" -ForegroundColor White
Write-Host "`nFullnode connection:" -ForegroundColor Yellow
Write-Host "   Set env: RELAY_SERVER_URL=https://[your-domain]" -ForegroundColor White
Write-Host "   Or direct mode: DIRECT_MODE=true" -ForegroundColor White 