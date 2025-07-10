#!/usr/bin/env pwsh

# 백야 프로토콜 웹 인터페이스 Vercel 배포 스크립트

Write-Host "🚀 백야 프로토콜 웹 인터페이스 배포 시작" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan

# 현재 디렉토리 확인
$currentDir = Get-Location
Write-Host "📁 현재 디렉토리: $currentDir" -ForegroundColor Yellow

# webapp 디렉토리 존재 확인
if (!(Test-Path "webapp")) {
    Write-Host "❌ webapp 디렉토리가 없습니다!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ webapp 디렉토리 확인됨" -ForegroundColor Green

# webapp 디렉토리로 이동
Set-Location webapp

# package.json 존재 확인
if (!(Test-Path "package.json")) {
    Write-Host "❌ package.json 파일이 없습니다!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "✅ package.json 확인됨" -ForegroundColor Green

# vercel.json 존재 확인
if (!(Test-Path "vercel.json")) {
    Write-Host "❌ vercel.json 파일이 없습니다!" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "✅ vercel.json 확인됨" -ForegroundColor Green

# 필수 파일들 확인
$requiredFiles = @("index.html", "app.js", "styles.css")
foreach ($file in $requiredFiles) {
    if (!(Test-Path $file)) {
        Write-Host "❌ $file 파일이 없습니다!" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}

Write-Host "✅ 모든 필수 파일 확인됨" -ForegroundColor Green

# Vercel CLI 설치 확인
try {
    $vercelVersion = vercel --version
    Write-Host "✅ Vercel CLI 설치됨: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Vercel CLI가 설치되지 않았습니다. 설치 중..." -ForegroundColor Yellow
    try {
        npm install -g vercel
        Write-Host "✅ Vercel CLI 설치 완료" -ForegroundColor Green
    } catch {
        Write-Host "❌ Vercel CLI 설치 실패!" -ForegroundColor Red
        Set-Location ..
        exit 1
    }
}

Write-Host ""
Write-Host "🔄 배포 시작..." -ForegroundColor Blue
Write-Host "=============================================" -ForegroundColor Cyan

# 배포 명령어 실행
try {
    # 프로덕션 배포
    vercel --prod
    Write-Host ""
    Write-Host "🎉 배포 완료!" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "🌐 배포된 사이트: https://baekya-protocol.vercel.app" -ForegroundColor Cyan
    Write-Host "📊 관리 대시보드: https://vercel.com/dashboard" -ForegroundColor Cyan
} catch {
    Write-Host "❌ 배포 실패!" -ForegroundColor Red
    Write-Host "오류: $($_.Exception.Message)" -ForegroundColor Red
    Set-Location ..
    exit 1
}

# 원래 디렉토리로 복귀
Set-Location ..

Write-Host ""
Write-Host "✅ 배포 스크립트 완료" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "📝 배포 정보:" -ForegroundColor Yellow
Write-Host "   - 웹 인터페이스: https://baekya-protocol.vercel.app" -ForegroundColor White
Write-Host "   - P2P 통신: 모바일 앱 전용" -ForegroundColor White
Write-Host "   - QR 스캔: 모바일 앱 전용" -ForegroundColor White
Write-Host "   - 다른 기능: 웹에서 모두 사용 가능" -ForegroundColor White
Write-Host ""
Write-Host "🚀 배야 프로토콜 웹 인터페이스 배포 완료!" -ForegroundColor Green 