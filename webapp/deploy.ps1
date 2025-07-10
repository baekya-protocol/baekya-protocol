# Vercel 배포 자동화 스크립트
Write-Host "🚀 백야 프로토콜 웹앱 Vercel 배포 시작..." -ForegroundColor Green

# 현재 위치 확인
$currentPath = Get-Location
Write-Host "📍 현재 경로: $currentPath" -ForegroundColor Yellow

# webapp 폴더인지 확인
if (-not (Test-Path "app.js")) {
    Write-Host "❌ webapp 폴더가 아닙니다. webapp 폴더에서 실행해주세요." -ForegroundColor Red
    exit 1
}

# Vercel CLI 설치 확인
$vercelExists = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelExists) {
    Write-Host "❌ Vercel CLI가 설치되지 않았습니다." -ForegroundColor Red
    Write-Host "💡 설치 방법: npm install -g vercel" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Vercel CLI 확인됨" -ForegroundColor Green

# app.js에서 API URL 확인
$appJsContent = Get-Content "app.js" -Raw
if ($appJsContent -match "localhost:3000") {
    Write-Host "✅ 로컬 풀노드 연결 설정 확인됨" -ForegroundColor Green
} else {
    Write-Host "⚠️  로컬 풀노드 연결 설정이 확인되지 않았습니다" -ForegroundColor Yellow
}

# Vercel 배포 실행
Write-Host "🚀 Vercel 프로덕션 배포 시작..." -ForegroundColor Green
try {
    vercel --prod
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "🎉 배포 완료!" -ForegroundColor Green
        Write-Host "📋 확인사항:" -ForegroundColor Yellow
        Write-Host "  1. 새로운 Vercel URL로 접속" -ForegroundColor Cyan
        Write-Host "  2. 개발자 도구 → Console 확인" -ForegroundColor Cyan
        Write-Host "  3. localhost:3000 API 호출 여부 확인" -ForegroundColor Cyan
        Write-Host "  4. CORS 오류 발생 시 localhost:8080 사용" -ForegroundColor Cyan
    } else {
        Write-Host "❌ 배포 실패" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ 배포 중 오류 발생: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "🔗 로컬 풀노드: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔗 로컬 웹앱: http://localhost:8080" -ForegroundColor Cyan 