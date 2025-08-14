# Baekya Protocol Listing Server Deployment Script for Render.com

# Set UTF-8 encoding
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Baekya Protocol Listing Server Deployment (Render.com)" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green

# Check if git is available
$gitInstalled = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitInstalled) {
    Write-Host "ERROR: Git is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Git: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

Write-Host "Git found" -ForegroundColor Green

# Check if we're in a git repository
try {
    git status 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Initializing Git repository..." -ForegroundColor Yellow
        git init
        git add .
        git commit -m "Initial commit for listing server"
    }
} catch {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
    git add .
    git commit -m "Initial commit for listing server"
}

Write-Host "Git repository ready" -ForegroundColor Green

Write-Host ""
Write-Host "Listing Server Configuration:" -ForegroundColor Cyan
Write-Host "  Platform: Render.com" -ForegroundColor Cyan
Write-Host "  Type: Web Service" -ForegroundColor Cyan
Write-Host "  Role: Relay server registry management" -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host "Proceed with Render deployment setup? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

try {
    Write-Host "Preparing Render deployment..." -ForegroundColor Green
    
    # Create render.yaml configuration
    Write-Host "Creating Render configuration..." -ForegroundColor Yellow
    
    $renderConfig = @"
services:
  - type: web
    name: baekya-listing-server
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
    autoDeploy: true
"@
    
    Set-Content -Path "render.yaml" -Value $renderConfig -Encoding UTF8
    
    # Backup and replace package.json
    Write-Host "Preparing deployment configuration..." -ForegroundColor Yellow
    Copy-Item "package.json" "package.json.backup" -Force
    Copy-Item "railway-listing.json" "package.json" -Force
    
    # Create deployment branch
    Write-Host "Creating deployment branch..." -ForegroundColor Yellow
    git checkout -b render-listing-deploy 2>$null
    git add .
    git commit -m "Render listing server deployment configuration" 2>$null
    
    # Restore package.json
    Move-Item "package.json.backup" "package.json" -Force
    
    Write-Host ""
    Write-Host "Render Deployment Setup Complete!" -ForegroundColor Green
    Write-Host "=================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Go to https://render.com and sign up/login" -ForegroundColor Yellow
    Write-Host "2. Click 'New +' > 'Web Service'" -ForegroundColor Yellow
    Write-Host "3. Connect your GitHub repository" -ForegroundColor Yellow
    Write-Host "4. Select branch: render-listing-deploy" -ForegroundColor Yellow
    Write-Host "5. Render will auto-detect the configuration" -ForegroundColor Yellow
    Write-Host "6. Click 'Create Web Service'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Configuration Details:" -ForegroundColor Cyan
    Write-Host "  Name: baekya-listing-server" -ForegroundColor White
    Write-Host "  Build Command: npm install" -ForegroundColor White
    Write-Host "  Start Command: npm start" -ForegroundColor White
    Write-Host "  Environment: NODE_ENV=production" -ForegroundColor White
    Write-Host ""
    Write-Host "Your listing server will be available at:" -ForegroundColor Green
    Write-Host "https://baekya-listing-server.onrender.com" -ForegroundColor Green
    Write-Host ""
    Write-Host "Files created:" -ForegroundColor Cyan
    Write-Host "  - render.yaml (Render configuration)" -ForegroundColor White
    Write-Host "  - render-listing-deploy branch" -ForegroundColor White
    
} catch {
    Write-Host "ERROR during setup: $($_.Exception.Message)" -ForegroundColor Red
    
    # Restore package.json on error
    if (Test-Path "package.json.backup") {
        Move-Item "package.json.backup" "package.json" -Force
    }
    
    exit 1
}

Write-Host ""
Write-Host "Render deployment setup completed successfully!" -ForegroundColor Green
Write-Host "Visit https://render.com to complete the deployment." -ForegroundColor Yellow
