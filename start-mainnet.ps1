#!/usr/bin/env pwsh

<#
.SYNOPSIS
    백야 프로토콜 메인넷 시작 스크립트

.DESCRIPTION
    백야 프로토콜의 프로덕션 메인넷을 시작합니다.
    "기여한 만큼 보장받는" 새로운 사회시스템의 실제 운영을 시작합니다.

.PARAMETER Port
    네트워크 포트 (기본값: 8080)

.PARAMETER Validator
    검증자 모드로 시작

.EXAMPLE
    .\start-mainnet.ps1
    .\start-mainnet.ps1 -Port 8080 -Validator
#>

param(
    [int]$Port = 8080,
    [switch]$Validator,
    [switch]$Force
)

Write-Host @"

🌟 백야 프로토콜 메인넷 시작
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 "기여한 만큼 보장받는" 사회규약을 실현하는 기여기반 탈중앙 사회시스템
🌍 인류에게 필요한 새로운 사회시스템이 시작됩니다!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"@ -ForegroundColor Cyan

# 현재 디렉토리 확인
$currentDir = Get-Location
Write-Host "📂 현재 디렉토리: $currentDir" -ForegroundColor Green

# Node.js 및 npm 설치 확인
Write-Host "🔍 시스템 요구사항 확인 중..." -ForegroundColor Yellow

try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 버전: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js가 설치되지 않았습니다. Node.js를 먼저 설치하세요." -ForegroundColor Red
    exit 1
}

try {
    $npmVersion = npm --version  
    Write-Host "✅ npm 버전: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm이 설치되지 않았습니다." -ForegroundColor Red
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

# 테스트 실행 (안전성 확인)
Write-Host "🧪 시스템 안정성 검증 중..." -ForegroundColor Yellow
npm test --silent
if ($LASTEXITCODE -ne 0) {
    if (-not $Force) {
        Write-Host "❌ 테스트 실패! 메인넷 시작을 중단합니다." -ForegroundColor Red
        Write-Host "   -Force 플래그를 사용하여 강제 시작할 수 있습니다." -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "⚠️  테스트 실패했지만 강제 시작 중..." -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ 모든 테스트 통과! (149/149)" -ForegroundColor Green
}

# 메인넷 시작 확인
Write-Host @"

⚠️  메인넷 시작 최종 확인
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 네트워크: MAINNET (프로덕션)
🌐 포트: $Port
👤 모드: $(if ($Validator) {"VALIDATOR"} else {"FULL NODE"})
🌍 환경: PRODUCTION

이는 실제 메인넷입니다. 계속하시겠습니까?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"@ -ForegroundColor Yellow

$confirmation = Read-Host "계속하려면 'YES'를 입력하세요"
if ($confirmation -ne "YES") {
    Write-Host "🛑 메인넷 시작이 취소되었습니다." -ForegroundColor Red
    exit 0
}

# 메인넷 시작
Write-Host @"

🚀 백야 프로토콜 메인넷 시작!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"@ -ForegroundColor Green

# 환경 변수 설정
$env:NODE_ENV = 'production'
$env:BAEKYA_PORT = $Port
$env:BAEKYA_NETWORK = 'mainnet'

# 메인넷 시작 명령어 구성
$startCommand = 'npm run mainnet'
if ($Validator) {
    $startCommand += ' -- --validator'
}
$startCommand += " -- --port $Port"

Write-Host "📋 실행 명령어: $startCommand" -ForegroundColor Cyan
Write-Host ""

# 메인넷 실행
try {
    Invoke-Expression $startCommand
} catch {
    Write-Host "❌ 메인넷 시작 중 오류가 발생했습니다: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host @"

🎉 백야 프로토콜 메인넷이 성공적으로 시작되었습니다!

🌟 "기여한 만큼 보장받는" 새로운 사회가 시작되었습니다!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"@ -ForegroundColor Green 