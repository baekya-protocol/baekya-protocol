# 백야 프로토콜 홈페이지 배포 스크립트

param(
    [string]$Platform = "vercel",
    [switch]$Production = $false
)

Write-Host "🌐 백야 프로토콜 홈페이지 배포 시작..." -ForegroundColor Green
Write-Host "📋 배포 플랫폼: $Platform" -ForegroundColor Cyan

# website 디렉토리로 이동
Set-Location "website"

# 배포 플랫폼별 처리
switch ($Platform.ToLower()) {
    "vercel" {
        Write-Host "🚀 Vercel 배포 중..." -ForegroundColor Yellow
        
        # Vercel CLI 설치 확인
        $vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
        if (-not $vercelInstalled) {
            Write-Host "📦 Vercel CLI 설치 중..." -ForegroundColor Yellow
            npm install -g vercel
        }
        
        if ($Production) {
            Write-Host "🏭 프로덕션 배포..." -ForegroundColor Green
            vercel --prod
        } else {
            Write-Host "🧪 개발 배포..." -ForegroundColor Yellow
            vercel
        }
        
        Write-Host "✅ Vercel 배포 완료!" -ForegroundColor Green
        Write-Host "🔗 URL: https://baekya-protocol.vercel.app" -ForegroundColor Cyan
    }
    
    "netlify" {
        Write-Host "🌊 Netlify 배포 중..." -ForegroundColor Yellow
        
        # Netlify CLI 설치 확인
        $netlifyInstalled = Get-Command netlify -ErrorAction SilentlyContinue
        if (-not $netlifyInstalled) {
            Write-Host "📦 Netlify CLI 설치 중..." -ForegroundColor Yellow
            npm install -g netlify-cli
        }
        
        if ($Production) {
            netlify deploy --prod --dir=.
        } else {
            netlify deploy --dir=.
        }
        
        Write-Host "✅ Netlify 배포 완료!" -ForegroundColor Green
    }
    
    "github" {
        Write-Host "🐙 GitHub Pages 배포 중..." -ForegroundColor Yellow
        
        # GitHub Pages 설정 파일 생성
        @"
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>백야 프로토콜</title>
    <meta http-equiv="refresh" content="0; url=./index.html">
</head>
<body>
    <p>Redirecting to <a href="./index.html">백야 프로토콜</a>...</p>
</body>
</html>
"@ | Out-File -FilePath "404.html" -Encoding UTF8
        
        Write-Host "📋 GitHub Pages 설정:" -ForegroundColor Yellow
        Write-Host "1. GitHub 저장소의 Settings > Pages로 이동" -ForegroundColor White
        Write-Host "2. Source를 'Deploy from a branch'로 설정" -ForegroundColor White
        Write-Host "3. Branch를 'main'으로 설정" -ForegroundColor White
        Write-Host "4. Folder를 '/website'로 설정" -ForegroundColor White
        Write-Host "5. Save 클릭" -ForegroundColor White
        
        Write-Host "✅ GitHub Pages 설정 완료!" -ForegroundColor Green
        Write-Host "🔗 URL: https://username.github.io/baekya-protocol" -ForegroundColor Cyan
    }
    
    "firebase" {
        Write-Host "🔥 Firebase Hosting 배포 중..." -ForegroundColor Yellow
        
        # Firebase CLI 설치 확인
        $firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue
        if (-not $firebaseInstalled) {
            Write-Host "📦 Firebase CLI 설치 중..." -ForegroundColor Yellow
            npm install -g firebase-tools
        }
        
        # firebase.json 생성
        @"
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
"@ | Out-File -FilePath "firebase.json" -Encoding UTF8
        
        Write-Host "🔐 Firebase 로그인 필요..." -ForegroundColor Yellow
        firebase login
        
        Write-Host "🏗️ Firebase 프로젝트 초기화..." -ForegroundColor Yellow
        firebase init hosting
        
        firebase deploy
        
        Write-Host "✅ Firebase Hosting 배포 완료!" -ForegroundColor Green
    }
    
    "local" {
        Write-Host "🏠 로컬 서버 시작..." -ForegroundColor Yellow
        
        # Python 간단 서버 시작
        $pythonInstalled = Get-Command python -ErrorAction SilentlyContinue
        if ($pythonInstalled) {
            Write-Host "🐍 Python 서버 시작 중..." -ForegroundColor Green
            Write-Host "🔗 URL: http://localhost:8000" -ForegroundColor Cyan
            python -m http.server 8000
        } else {
            # Node.js 서버 시작
            $nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
            if ($nodeInstalled) {
                Write-Host "📦 http-server 설치 중..." -ForegroundColor Yellow
                npm install -g http-server
                
                Write-Host "🟢 Node.js 서버 시작 중..." -ForegroundColor Green
                Write-Host "🔗 URL: http://localhost:8080" -ForegroundColor Cyan
                http-server -p 8080
            } else {
                Write-Host "❌ Python 또는 Node.js가 필요합니다." -ForegroundColor Red
            }
        }
    }
    
    default {
        Write-Host "❌ 지원되지 않는 플랫폼: $Platform" -ForegroundColor Red
        Write-Host "📋 지원 플랫폼: vercel, netlify, github, firebase, local" -ForegroundColor Yellow
        exit 1
    }
}

# 원래 디렉토리로 복귀
Set-Location ".."

Write-Host "🎉 홈페이지 배포 완료!" -ForegroundColor Green

# 사용법 안내
Write-Host "`n📋 사용법:" -ForegroundColor Yellow
Write-Host ".\deploy-website.ps1 -Platform vercel -Production" -ForegroundColor Gray
Write-Host ".\deploy-website.ps1 -Platform netlify" -ForegroundColor Gray
Write-Host ".\deploy-website.ps1 -Platform local" -ForegroundColor Gray 