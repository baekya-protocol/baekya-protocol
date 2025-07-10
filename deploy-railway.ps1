# Railway 배포 스크립트
# 백야 프로토콜 Railway 배포 자동화

param(
    [string]$RailwayUrl = "",
    [switch]$UpdateWebapp = $false,
    [switch]$Help = $false
)

if ($Help) {
    Write-Host "Railway 배포 스크립트 사용법:" -ForegroundColor Green
    Write-Host "  .\deploy-railway.ps1 -RailwayUrl <URL> [-UpdateWebapp]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "옵션:" -ForegroundColor Green
    Write-Host "  -RailwayUrl    : Railway 배포 URL (예: https://baekya-protocol-production.up.railway.app)" -ForegroundColor Yellow
    Write-Host "  -UpdateWebapp  : 웹앱의 RPC URL을 Railway URL로 업데이트" -ForegroundColor Yellow
    Write-Host "  -Help         : 이 도움말 표시" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "예시:" -ForegroundColor Green
    Write-Host "  .\deploy-railway.ps1 -RailwayUrl https://baekya-protocol-production.up.railway.app -UpdateWebapp" -ForegroundColor Yellow
    exit 0
}

Write-Host "🚀 백야 프로토콜 Railway 배포 스크립트" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Railway CLI 설치 확인
Write-Host "🔍 Railway CLI 확인 중..." -ForegroundColor Yellow
$railwayExists = Get-Command railway -ErrorAction SilentlyContinue

if (-not $railwayExists) {
    Write-Host "❌ Railway CLI가 설치되지 않았습니다." -ForegroundColor Red
    Write-Host "💡 Railway CLI 설치 방법:" -ForegroundColor Yellow
    Write-Host "   npm install -g @railway/cli" -ForegroundColor Cyan
    Write-Host "   또는 https://railway.app/cli 참조" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Railway CLI 설치 확인됨" -ForegroundColor Green

# Git 상태 확인
Write-Host "🔍 Git 상태 확인 중..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "⚠️  커밋되지 않은 변경사항이 있습니다:" -ForegroundColor Yellow
    Write-Host $gitStatus -ForegroundColor Cyan
    
    $commit = Read-Host "변경사항을 커밋하시겠습니까? (y/N)"
    if ($commit -eq 'y' -or $commit -eq 'Y') {
        Write-Host "📝 변경사항 커밋 중..." -ForegroundColor Yellow
        git add .
        git commit -m "Railway 배포 준비"
        git push origin main
        Write-Host "✅ 변경사항 커밋 완료" -ForegroundColor Green
    }
}

# Railway 프로젝트 연결 확인
Write-Host "🔍 Railway 프로젝트 연결 확인 중..." -ForegroundColor Yellow
$railwayProject = railway status 2>&1
if ($railwayProject -match "No project linked") {
    Write-Host "❌ Railway 프로젝트가 연결되지 않았습니다." -ForegroundColor Red
    Write-Host "💡 Railway 프로젝트 연결 방법:" -ForegroundColor Yellow
    Write-Host "   railway login" -ForegroundColor Cyan
    Write-Host "   railway link" -ForegroundColor Cyan
    exit 1
}

Write-Host "✅ Railway 프로젝트 연결 확인됨" -ForegroundColor Green

# 환경변수 확인
Write-Host "🔍 환경변수 확인 중..." -ForegroundColor Yellow
$envVars = railway variables
if ($envVars -notmatch "NODE_ENV") {
    Write-Host "⚠️  NODE_ENV 환경변수가 설정되지 않았습니다." -ForegroundColor Yellow
    Write-Host "💡 환경변수 설정:" -ForegroundColor Yellow
    Write-Host "   railway variables set NODE_ENV=production" -ForegroundColor Cyan
}

# 배포 실행
Write-Host "🚀 Railway 배포 시작..." -ForegroundColor Yellow
railway deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Railway 배포 완료!" -ForegroundColor Green
    
    # 배포 URL 가져오기
    if (-not $RailwayUrl) {
        Write-Host "🔍 배포 URL 확인 중..." -ForegroundColor Yellow
        $domains = railway domain
        if ($domains -match "https://.*\.railway\.app") {
            $RailwayUrl = $matches[0]
            Write-Host "✅ 배포 URL: $RailwayUrl" -ForegroundColor Green
        } else {
            Write-Host "⚠️  배포 URL을 자동으로 찾을 수 없습니다." -ForegroundColor Yellow
            $RailwayUrl = Read-Host "배포 URL을 입력하세요 (예: https://baekya-protocol-production.up.railway.app)"
        }
    }
    
    # 웹앱 업데이트
    if ($UpdateWebapp -and $RailwayUrl) {
        Write-Host "🔄 웹앱 RPC URL 업데이트 중..." -ForegroundColor Yellow
        
        if (Test-Path "webapp/app.js") {
            $appJs = Get-Content "webapp/app.js" -Raw
            
            # RPC URL 업데이트
            $appJs = $appJs -replace "const RPC_URL = '[^']*';", "const RPC_URL = '$RailwayUrl/api';"
            $appJs = $appJs -replace "const WS_URL = '[^']*';", "const WS_URL = '$($RailwayUrl -replace 'https:', 'wss:')/ws';"
            
            Set-Content "webapp/app.js" -Value $appJs
            Write-Host "✅ 웹앱 RPC URL 업데이트 완료" -ForegroundColor Green
            
            # Vercel 재배포
            Write-Host "🔄 Vercel 재배포 중..." -ForegroundColor Yellow
            Set-Location webapp
            if (Get-Command vercel -ErrorAction SilentlyContinue) {
                vercel --prod
                Write-Host "✅ Vercel 재배포 완료" -ForegroundColor Green
            } else {
                Write-Host "⚠️  Vercel CLI가 설치되지 않았습니다. 수동으로 배포해주세요." -ForegroundColor Yellow
            }
            Set-Location ..
        } else {
            Write-Host "⚠️  webapp/app.js 파일을 찾을 수 없습니다." -ForegroundColor Yellow
        }
    }
    
    # 배포 확인
    Write-Host "🔍 배포 상태 확인 중..." -ForegroundColor Yellow
    if ($RailwayUrl) {
        try {
            $response = Invoke-RestMethod -Uri "$RailwayUrl/api/status" -Method GET -TimeoutSec 10
            if ($response) {
                Write-Host "✅ 서버 상태 확인 완료" -ForegroundColor Green
                Write-Host "📊 서버 정보:" -ForegroundColor Cyan
                Write-Host "   - 버전: $($response.version)" -ForegroundColor Cyan
                Write-Host "   - 상태: $($response.status)" -ForegroundColor Cyan
                Write-Host "   - 업타임: $($response.uptime)" -ForegroundColor Cyan
            }
        } catch {
            Write-Host "⚠️  서버 상태 확인 실패: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "🎉 배포 완료!" -ForegroundColor Green
    Write-Host "🔗 배포 URL: $RailwayUrl" -ForegroundColor Yellow
    Write-Host "🔗 API 상태: $RailwayUrl/api/status" -ForegroundColor Yellow
    Write-Host "🔗 웹앱: https://webapp-ci8zk3clm-vialucis1597s-projects.vercel.app" -ForegroundColor Yellow
    
} else {
    Write-Host "❌ Railway 배포 실패" -ForegroundColor Red
    Write-Host "💡 문제 해결:" -ForegroundColor Yellow
    Write-Host "   - railway logs 로그 확인" -ForegroundColor Cyan
    Write-Host "   - 환경변수 설정 확인" -ForegroundColor Cyan
    Write-Host "   - railway.json 설정 확인" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "📚 추가 정보:" -ForegroundColor Green
Write-Host "   - Railway 대시보드: https://railway.app" -ForegroundColor Cyan
Write-Host "   - 배포 가이드: docs/railway-deployment-guide.md" -ForegroundColor Cyan
Write-Host "   - 로그 확인: railway logs" -ForegroundColor Cyan 