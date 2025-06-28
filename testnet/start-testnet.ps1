#!/usr/bin/env pwsh

Write-Host "🚀 백야 프로토콜 테스트넷 시작..." -ForegroundColor Green

# 테스트넷 디렉토리가 없으면 생성
if (!(Test-Path "testnet")) {
    New-Item -ItemType Directory -Name "testnet"
}

# 로그 디렉토리 생성
if (!(Test-Path "testnet/logs")) {
    New-Item -ItemType Directory -Path "testnet/logs"
}

Write-Host "📋 테스트넷 구성:" -ForegroundColor Yellow
Write-Host "- 노드 1: 메인 검증자 (포트 3001)" -ForegroundColor Cyan
Write-Host "- 노드 2: 보조 검증자 (포트 3002)" -ForegroundColor Cyan  
Write-Host "- 노드 3: 일반 사용자 (포트 3003)" -ForegroundColor Cyan
Write-Host ""

# 각 노드를 별도 터미널에서 실행
try {
    Write-Host "🟢 노드 1 시작 중..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; node testnet/node1.js 2>&1 | Tee-Object testnet/logs/node1.log"
    Start-Sleep 3

    Write-Host "🟡 노드 2 시작 중..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; node testnet/node2.js 2>&1 | Tee-Object testnet/logs/node2.log"
    Start-Sleep 3

    Write-Host "🔵 노드 3 시작 중..." -ForegroundColor Blue
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; node testnet/node3.js 2>&1 | Tee-Object testnet/logs/node3.log"
    Start-Sleep 3

    Write-Host ""
    Write-Host "✅ 테스트넷 시작 완료!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 모니터링:" -ForegroundColor Yellow
    Write-Host "- 로그 파일: testnet/logs/" -ForegroundColor Gray
    Write-Host "- 각 노드는 별도 터미널에서 실행됩니다" -ForegroundColor Gray
    Write-Host "- Ctrl+C로 개별 노드를 종료할 수 있습니다" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🔧 테스트 명령:" -ForegroundColor Yellow
    Write-Host "- 테스트넷 상태 확인: ./testnet/check-testnet.ps1" -ForegroundColor Gray
    Write-Host "- 테스트넷 중지: ./testnet/stop-testnet.ps1" -ForegroundColor Gray
    Write-Host ""

} catch {
    Write-Host "❌ 테스트넷 시작 실패: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "⏳ 네트워크 초기화 대기 중 (30초)..." -ForegroundColor Yellow
Start-Sleep 30

Write-Host "🔍 초기 네트워크 상태 확인 중..." -ForegroundColor Green

# 간단한 상태 확인
try {
    Write-Host "📡 포트 확인:" -ForegroundColor Cyan
    $port3001 = Test-NetConnection -ComputerName localhost -Port 3001 -WarningAction SilentlyContinue
    $port3002 = Test-NetConnection -ComputerName localhost -Port 3002 -WarningAction SilentlyContinue
    $port3003 = Test-NetConnection -ComputerName localhost -Port 3003 -WarningAction SilentlyContinue

    Write-Host "- 포트 3001 (노드 1): $(if($port3001.TcpTestSucceeded) { '✅ 활성' } else { '❌ 비활성' })" -ForegroundColor $(if($port3001.TcpTestSucceeded) { 'Green' } else { 'Red' })
    Write-Host "- 포트 3002 (노드 2): $(if($port3002.TcpTestSucceeded) { '✅ 활성' } else { '❌ 비활성' })" -ForegroundColor $(if($port3002.TcpTestSucceeded) { 'Green' } else { 'Red' })
    Write-Host "- 포트 3003 (노드 3): $(if($port3003.TcpTestSucceeded) { '✅ 활성' } else { '❌ 비활성' })" -ForegroundColor $(if($port3003.TcpTestSucceeded) { 'Green' } else { 'Red' })

} catch {
    Write-Host "⚠️ 포트 확인 중 오류 발생" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 백야 프로토콜 테스트넷이 실행 중입니다!" -ForegroundColor Green
Write-Host "노드들이 서로 연결되고 블록을 생성하는 것을 관찰하세요." -ForegroundColor Gray 