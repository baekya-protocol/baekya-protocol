# 백야 프로토콜 전체 플랫폼 배포 스크립트

param(
    [string]$Platform = "all",
    [switch]$Production = $false
)

Write-Host "🚀 백야 프로토콜 배포 시작..." -ForegroundColor Green
Write-Host "📋 배포 플랫폼: $Platform" -ForegroundColor Cyan
Write-Host "🏷️ 배포 모드: $(if($Production) {'Production'} else {'Development'})" -ForegroundColor Cyan

# 공통 준비 작업
Write-Host "📦 의존성 설치 중..." -ForegroundColor Yellow
npm install

Write-Host "🧪 테스트 실행 중..." -ForegroundColor Yellow
npm test

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 테스트 실패! 배포를 중단합니다." -ForegroundColor Red
    exit 1
}

# 플랫폼별 배포
switch ($Platform.ToLower()) {
    "android" {
        Write-Host "📱 Android 배포 중..." -ForegroundColor Green
        if ($Production) {
            .\build-android-aab.ps1
        } else {
            .\build-android-apk.ps1
        }
    }
    
    "ios" {
        Write-Host "🍎 iOS 배포 중..." -ForegroundColor Green
        .\build-ios.ps1
    }
    
    "desktop" {
        Write-Host "💻 데스크탑 배포 중..." -ForegroundColor Green
        .\build-desktop.ps1
    }
    
    "web" {
        Write-Host "🌐 웹 배포 중..." -ForegroundColor Green
        .\build-web.ps1
        
        if ($Production) {
            Write-Host "🚀 프로덕션 배포 중..." -ForegroundColor Yellow
            # Vercel 배포
            vercel --prod
        }
    }
    
    "docker" {
        Write-Host "🐳 Docker 배포 중..." -ForegroundColor Green
        docker build -t baekya-protocol:latest .
        
        if ($Production) {
            docker tag baekya-protocol:latest baekya-protocol:v1.0.0
            # Docker Hub 푸시
            # docker push baekya-protocol:latest
            # docker push baekya-protocol:v1.0.0
        }
    }
    
    "all" {
        Write-Host "🌟 모든 플랫폼 배포 중..." -ForegroundColor Green
        
        # Android
        Write-Host "📱 Android..." -ForegroundColor Cyan
        .\build-android-apk.ps1
        
        # 데스크탑
        Write-Host "💻 데스크탑..." -ForegroundColor Cyan
        .\build-desktop.ps1
        
        # 웹
        Write-Host "🌐 웹..." -ForegroundColor Cyan
        .\build-web.ps1
        
        # Docker
        Write-Host "🐳 Docker..." -ForegroundColor Cyan
        docker build -t baekya-protocol:latest .
    }
    
    default {
        Write-Host "❌ 지원되지 않는 플랫폼: $Platform" -ForegroundColor Red
        Write-Host "📋 지원 플랫폼: android, ios, desktop, web, docker, all" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "✅ 배포 완료!" -ForegroundColor Green
Write-Host "📊 배포 결과:" -ForegroundColor Yellow

# 배포 결과 확인
if (Test-Path "mobile-app/BaekyaProtocol/android/app/build/outputs/apk") {
    Write-Host "✅ Android APK: 생성됨" -ForegroundColor Green
}

if (Test-Path "desktop-app/dist") {
    Write-Host "✅ 데스크탑 앱: 생성됨" -ForegroundColor Green
}

if (Test-Path "public") {
    Write-Host "✅ 웹 앱: 생성됨" -ForegroundColor Green
}

Write-Host "🎉 백야 프로토콜 배포 프로세스 완료!" -ForegroundColor Green

# 사용법 안내
Write-Host "`n📋 사용법:" -ForegroundColor Yellow
Write-Host ".\deploy-all.ps1 -Platform android" -ForegroundColor Gray
Write-Host ".\deploy-all.ps1 -Platform web -Production" -ForegroundColor Gray
Write-Host ".\deploy-all.ps1 -Platform all" -ForegroundColor Gray 