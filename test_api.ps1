# 백야 프로토콜 API 테스트 스크립트

Write-Host "🌅 백야 프로토콜 API 테스트 시작..." -ForegroundColor Yellow

# 1. 프로토콜 상태 확인
Write-Host "`n📊 1. 프로토콜 상태 확인..." -ForegroundColor Cyan
try {
    $status = Invoke-WebRequest -Uri "http://localhost:3000/api/status" -UseBasicParsing
    Write-Host "✅ 상태: $($status.StatusCode)" -ForegroundColor Green
    $statusData = $status.Content | ConvertFrom-Json
    Write-Host "   - 총 DAO 수: $($statusData.network.totalDAOs)" -ForegroundColor White
    Write-Host "   - 총 구성원: $($statusData.network.totalMembers)" -ForegroundColor White
} catch {
    Write-Host "❌ 프로토콜 상태 확인 실패: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. DAO 목록 확인
Write-Host "`n🏛️ 2. DAO 목록 확인..." -ForegroundColor Cyan
try {
    $daos = Invoke-WebRequest -Uri "http://localhost:3000/api/daos" -UseBasicParsing
    Write-Host "✅ 상태: $($daos.StatusCode)" -ForegroundColor Green
    $daoData = $daos.Content | ConvertFrom-Json
    Write-Host "   - 등록된 DAO 수: $($daoData.Length)" -ForegroundColor White
    foreach ($dao in $daoData) {
        Write-Host "   - $($dao.name): $($dao.memberCount)명" -ForegroundColor White
    }
} catch {
    Write-Host "❌ DAO 목록 확인 실패: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. 사용자 등록 테스트
Write-Host "`n👤 3. 사용자 등록 테스트..." -ForegroundColor Cyan
try {
    $userData = @{
        biometricData = @{
            fingerprint = "test_fingerprint_001"
            faceprint = "test_faceprint_001"
            age = 28
            gender = "male"
        }
    } | ConvertTo-Json -Depth 3

    $register = Invoke-WebRequest -Uri "http://localhost:3000/api/register" -Method POST -Body $userData -ContentType "application/json" -UseBasicParsing
    Write-Host "✅ 상태: $($register.StatusCode)" -ForegroundColor Green
    $registerData = $register.Content | ConvertFrom-Json
    if ($registerData.success) {
        Write-Host "   - 사용자 DID: $($registerData.did)" -ForegroundColor White
        Write-Host "   - 통신 주소: $($registerData.communicationAddress)" -ForegroundColor White
        
        # 등록된 사용자 DID 저장
        $global:testUserDID = $registerData.did
    } else {
        Write-Host "   - 등록 실패: $($registerData.error)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ 사용자 등록 실패: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. 사용자 대시보드 확인 (등록이 성공한 경우)
if ($global:testUserDID) {
    Write-Host "`n📈 4. 사용자 대시보드 확인..." -ForegroundColor Cyan
    try {
        $dashboard = Invoke-WebRequest -Uri "http://localhost:3000/api/dashboard/$($global:testUserDID)" -UseBasicParsing
        Write-Host "✅ 상태: $($dashboard.StatusCode)" -ForegroundColor Green
        $dashboardData = $dashboard.Content | ConvertFrom-Json
        Write-Host "   - B-token 잔액: $($dashboardData.balances.bToken)" -ForegroundColor White
        Write-Host "   - P-token 잔액: $($dashboardData.balances.pToken)" -ForegroundColor White
        Write-Host "   - 가입 DAO 수: $($dashboardData.joinedDAOs.Length)" -ForegroundColor White
    } catch {
        Write-Host "❌ 대시보드 확인 실패: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎉 API 테스트 완료!" -ForegroundColor Green
Write-Host "브라우저에서 http://localhost:3000 을 열어 웹 인터페이스를 확인하세요." -ForegroundColor Yellow 