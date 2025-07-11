#!/usr/bin/env pwsh

# 백야 프로토콜 검증자 노드 시작 스크립트

Write-Host "🚀 백야 프로토콜 검증자 노드 시작" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan

# 릴레이 서버 설정
Write-Host "`n🔗 릴레이 서버 설정" -ForegroundColor Blue

# 릴레이 서버 URL 확인
if ($env:RELAY_SERVER_URL) {
    Write-Host "✅ 릴레이 서버 URL: $env:RELAY_SERVER_URL" -ForegroundColor Green
} else {
    # 기본 릴레이 서버 URL 설정
    $env:RELAY_SERVER_URL = "wss://baekya-relay.up.railway.app"
    Write-Host "📌 기본 릴레이 서버 URL 사용: $env:RELAY_SERVER_URL" -ForegroundColor Yellow
}

# 직접 연결 모드 확인
if ($env:DIRECT_MODE -eq "true") {
    Write-Host "🔗 직접 연결 모드 활성화 (릴레이 서버 사용 안함)" -ForegroundColor Yellow
} else {
    Write-Host "🌐 릴레이 서버를 통한 연결 모드" -ForegroundColor Green
}

# Node.js 버전 확인
Write-Host "`n🔍 Node.js 버전 확인..." -ForegroundColor Blue
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 버전: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js가 설치되지 않았습니다!" -ForegroundColor Red
    Write-Host "📥 https://nodejs.org 에서 Node.js를 설치하세요." -ForegroundColor Yellow
    exit 1
}

# 의존성 설치 확인
if (!(Test-Path "node_modules")) {
    Write-Host "`n📦 의존성 설치 중..." -ForegroundColor Blue
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 의존성 설치 실패!" -ForegroundColor Red
        exit 1
    }
}

# 환경 변수 설정
Write-Host "`n⚙️ 환경 변수 설정..." -ForegroundColor Blue
$env:NODE_ENV = "production"
Write-Host "✅ NODE_ENV: production" -ForegroundColor Green

# 포트 설정
if (!$env:PORT) {
    $env:PORT = "3000"
}
Write-Host "✅ PORT: $env:PORT" -ForegroundColor Green

# 검증자 노드 시작
Write-Host "`n🌟 검증자 노드 시작 중..." -ForegroundColor Blue
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "📊 대시보드: http://localhost:$env:PORT" -ForegroundColor Cyan

if ($env:DIRECT_MODE -eq "true") {
    Write-Host "🔗 직접 연결 주소: http://localhost:$env:PORT" -ForegroundColor Cyan
} else {
    Write-Host "🌐 릴레이 서버: $env:RELAY_SERVER_URL" -ForegroundColor Cyan
}

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "⚡ Ctrl+C를 눌러 종료하세요" -ForegroundColor Yellow
Write-Host ""

# 서버 시작
node server.js 