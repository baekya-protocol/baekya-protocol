Write-Host "Testing Baekya Protocol APIs..." -ForegroundColor Yellow

# Test 1: Protocol Status
Write-Host "1. Testing protocol status..." -ForegroundColor Cyan
$status = Invoke-WebRequest -Uri "http://localhost:3000/api/status" -UseBasicParsing
Write-Host "Status: $($status.StatusCode)" -ForegroundColor Green

# Test 2: DAO List
Write-Host "2. Testing DAO list..." -ForegroundColor Cyan
$daos = Invoke-WebRequest -Uri "http://localhost:3000/api/daos" -UseBasicParsing
Write-Host "Status: $($daos.StatusCode)" -ForegroundColor Green
$daoData = $daos.Content | ConvertFrom-Json
Write-Host "DAOs found: $($daoData.Length)" -ForegroundColor White

# Test 3: User Registration
Write-Host "3. Testing user registration..." -ForegroundColor Cyan
$userData = '{"biometricData":{"fingerprint":"test_001","faceprint":"face_001","age":28,"gender":"male"}}'
try {
    $register = Invoke-WebRequest -Uri "http://localhost:3000/api/register" -Method POST -Body $userData -ContentType "application/json" -UseBasicParsing
    Write-Host "Registration Status: $($register.StatusCode)" -ForegroundColor Green
    $registerData = $register.Content | ConvertFrom-Json
    Write-Host "Success: $($registerData.success)" -ForegroundColor White
    if ($registerData.success) {
        Write-Host "User DID: $($registerData.did)" -ForegroundColor White
    }
} catch {
    Write-Host "Registration failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "API tests completed!" -ForegroundColor Green 