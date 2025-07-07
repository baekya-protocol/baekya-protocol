#!/usr/bin/env pwsh

<#
.SYNOPSIS
    백야 프로토콜 모바일/경량 클라이언트 서버 시작

.DESCRIPTION
    메인넷 노드에 연결하는 경량 클라이언트 서버를 시작합니다.
    풀노드를 실행하지 않고도 백야 프로토콜을 사용할 수 있습니다.

.EXAMPLE
    .\start-mobile.ps1
#>

Write-Host @"

📱 백야 프로토콜 경량 클라이언트 시작
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 풀노드 없이도 백야 프로토콜을 사용할 수 있는 경량 클라이언트
📞 메인넷 노드들과 자동 연결되어 모든 기능을 제공합니다
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

Write-Host @"

🚀 경량 클라이언트 서버 시작!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 이 서버는 메인넷 노드들과 자동으로 연결됩니다
🔗 로컬에 메인넷 노드가 있으면 우선 연결됩니다
🌐 없으면 다른 활성 노드들을 찾아 연결합니다

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"@ -ForegroundColor Green

# 경량 클라이언트 서버 실행
try {
    npm run mobile
} catch {
    Write-Host "❌ 경량 클라이언트 서버 시작 중 오류가 발생했습니다: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host @"

🎉 백야 프로토콜 경량 클라이언트가 성공적으로 시작되었습니다!

💡 메인넷 노드 연결 방법:
   1. 같은 컴퓨터에서: .\start-mainnet.ps1 실행
   2. 다른 컴퓨터에서: 브라우저에서 노드 주소 추가
   
🌟 이제 풀노드 없이도 백야 프로토콜을 사용할 수 있습니다!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"@ -ForegroundColor Green 