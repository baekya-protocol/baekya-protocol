# 🛠️ 수동 배포 가이드 (스크립트 실패 시)

스크립트가 작동하지 않을 때 수동으로 배포하는 방법입니다.

## 🚀 리스팅 서버 배포

### 1단계: Railway CLI 설치 및 로그인
```bash
# Railway CLI 설치 (npm)
npm install -g @railway/cli

# 또는 PowerShell (Windows)
iwr -useb https://railway.app/install.ps1 | iex

# Railway 로그인
railway login
```

### 2단계: 리스팅 서버 배포
```bash
# 새 프로젝트 생성
railway project create

# 프로젝트 이름 입력 (예: baekya-listing-server)

# package.json 임시 교체
cp package.json package.json.backup
cp railway-listing.json package.json

# 환경 변수 설정
railway variables set NODE_ENV=production

# 배포
railway deploy

# package.json 복원
mv package.json.backup package.json
```

### 3단계: 배포 URL 확인
```bash
railway status
```

---

## 🚀 중계서버 배포

### 1단계: 새 프로젝트 생성
```bash
# 새 프로젝트 생성
railway project create

# 프로젝트 이름 입력 (예: baekya-relay-1234)
```

### 2단계: 환경 변수 설정
```bash
# 중계서버 비밀번호 설정
railway variables set RELAY_PASSWORD="your-secure-password"

# 중계서버 위치 설정 (예: 서울)
railway variables set RELAY_LOCATION="37.5665,126.9780"

# 환경 설정
railway variables set NODE_ENV=production
```

### 3단계: 배포
```bash
# package.json 임시 교체
cp package.json package.json.backup
cp railway-relay.json package.json

# 배포
railway deploy

# package.json 복원
mv package.json.backup package.json
```

### 4단계: 배포 URL 확인
```bash
railway status
```

---

## 📋 확인 사항

### ✅ 리스팅 서버 확인
- 브라우저에서 `https://your-listing-server.railway.app/api/status` 접속
- JSON 응답이 나오면 성공

### ✅ 중계서버 확인
- 브라우저에서 `https://your-relay-server.railway.app/api/relay-status` 접속
- JSON 응답이 나오면 성공

---

## 🔧 문제 해결

### Railway CLI 명령어가 안 될 때
```bash
# 최신 버전으로 업데이트
npm update -g @railway/cli

# 또는 재설치
npm uninstall -g @railway/cli
npm install -g @railway/cli
```

### 로그인이 안 될 때
```bash
# 로그아웃 후 재로그인
railway logout
railway login
```

### 배포가 실패할 때
```bash
# 로그 확인
railway logs

# 환경 변수 확인
railway variables

# 프로젝트 상태 확인
railway status
```

---

## 💡 팁

1. **프로젝트 이름**을 구분 가능하게 설정
2. **비밀번호**는 안전하게 설정 (8자 이상)
3. **위치 좌표**는 정확하게 입력
4. **Railway 대시보드**에서 실시간 모니터링 가능

---

## 🎯 다음 단계

배포 완료 후:
1. 리스팅 서버 URL 확인
2. 중계서버 URL과 비밀번호 기록
3. 풀노드에서 중계서버 연결 테스트

```bash
# 풀노드 실행
node server.js

# 중계서버 정보 입력:
# - URL: https://your-relay-server.railway.app
# - 비밀번호: your-secure-password
# - 위치: 37.5665,126.9780
```
