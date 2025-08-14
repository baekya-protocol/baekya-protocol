# Baekya Protocol Relay Server Deployment Script

param(
    [string]$RelayPassword
)

# Set UTF-8 encoding
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Baekya Protocol Relay Server Deployment Started" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Check Railway CLI installation
$railwayInstalled = Get-Command railway -ErrorAction SilentlyContinue
if (-not $railwayInstalled) {
    Write-Host "ERROR: Railway CLI is not installed." -ForegroundColor Red
    Write-Host "Install with: npm install -g @railway/cli" -ForegroundColor Yellow
    Write-Host "Or PowerShell: iwr -useb https://railway.app/install.ps1 | iex" -ForegroundColor Yellow
    exit 1
}

Write-Host "Railway CLI found" -ForegroundColor Green

# Check Railway login
try {
    $loginStatus = railway whoami 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Railway login required." -ForegroundColor Red
        Write-Host "Please run: railway login" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "ERROR: Railway login required." -ForegroundColor Red
    Write-Host "Please run: railway login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Railway authentication verified" -ForegroundColor Green

# Get relay password if not provided
if (-not $RelayPassword) {
    $RelayPassword = Read-Host "Enter relay server password (8+ characters, alphanumeric)"
    if ($RelayPassword.Length -lt 8) {
        Write-Host "ERROR: Password must be at least 8 characters." -ForegroundColor Red
        exit 1
    }
}

# Set default location (Seoul, Korea)
$RelayLocation = "37.5665,126.9780"

Write-Host ""
Write-Host "Deployment Configuration:" -ForegroundColor Cyan
Write-Host "  Password: $('*' * $RelayPassword.Length)" -ForegroundColor Cyan
Write-Host "  Location: Seoul, Korea (default)" -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host "Proceed with deployment? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

try {
    Write-Host "Starting relay server deployment..." -ForegroundColor Green
    
    # Initialize Railway project
    Write-Host "Initializing Railway project..." -ForegroundColor Yellow
    railway init --name "baekya-relay-$(Get-Random -Maximum 9999)"
    
    # Set environment variables
    Write-Host "Setting environment variables..." -ForegroundColor Yellow
    railway variables --set "RELAY_PASSWORD=$RelayPassword"
    railway variables --set "RELAY_LOCATION=$RelayLocation"
    railway variables --set "NODE_ENV=production"
    
    # Backup and replace package.json
    Write-Host "Preparing deployment configuration..." -ForegroundColor Yellow
    Copy-Item "package.json" "package.json.backup"
    Copy-Item "railway-relay.json" "package.json"
    
    # Deploy
    Write-Host "Deploying to Railway..." -ForegroundColor Yellow
    railway up
    
    # Restore package.json
    Move-Item "package.json.backup" "package.json" -Force
    
    # Check deployment status
    Start-Sleep -Seconds 5
    Write-Host "Checking deployment status..." -ForegroundColor Yellow
    $deployInfo = railway status
    
    Write-Host ""
    Write-Host "Relay Server Deployment Complete!" -ForegroundColor Green
    Write-Host "=================================" -ForegroundColor Green
    Write-Host "Deployment Info:" -ForegroundColor Cyan
    Write-Host $deployInfo
    Write-Host ""
    Write-Host "IMPORTANT: Copy the relay server URL for full node connection!" -ForegroundColor Yellow
    Write-Host "Railway Dashboard: https://railway.app/dashboard" -ForegroundColor Yellow
    
} catch {
    Write-Host "ERROR during deployment: $($_.Exception.Message)" -ForegroundColor Red
    
    # Restore package.json on error
    if (Test-Path "package.json.backup") {
        Move-Item "package.json.backup" "package.json" -Force
    }
    
    exit 1
}

Write-Host ""
Write-Host "Deployment script completed successfully" -ForegroundColor Green