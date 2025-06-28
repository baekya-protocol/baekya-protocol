#!/usr/bin/env pwsh

<#
.SYNOPSIS
    백야 프로토콜 웹 인터페이스 시작 스크립트

.DESCRIPTION
    백야 프로토콜 메인넷과 웹 인터페이스를 함께 시작합니다.

.EXAMPLE
    .\start-web.ps1
#>

Write-Host @"

🌟 백야 프로토콜 웹 인터페이스 시작
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 메인넷과 웹 인터페이스를 함께 시작합니다
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"@ -ForegroundColor Cyan

# Node.js 및 npm 설치 확인
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 버전: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js가 설치되지 않았습니다. Node.js를 먼저 설치하세요." -ForegroundColor Red
    exit 1
}

# 패키지 설치 상태 확인
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 의존성 패키지 설치 중..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 패키지 설치에 실패했습니다." -ForegroundColor Red
        exit 1
    }
}

Write-Host @"

🚀 백야 프로토콜 메인넷 시작 중...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"@ -ForegroundColor Green

# 환경 변수 설정
$env:NODE_ENV = 'production'

# 메인넷 실행
Write-Host "📋 실행 명령어: npm run mainnet" -ForegroundColor Cyan
Write-Host ""

# 메인넷 실행
npm run mainnet 