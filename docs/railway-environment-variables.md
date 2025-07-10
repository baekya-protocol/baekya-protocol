# Railway 환경변수 설정 가이드

## 필수 환경변수

Railway 대시보드의 Variables 탭에서 다음 환경변수들을 설정해주세요:

### 1. NODE_ENV
```
NODE_ENV=production
```
- 프로덕션 환경 설정
- 최적화된 성능과 보안 설정 활성화

### 2. PORT
```
PORT=3000
```
- 서버 실행 포트 설정
- Railway가 자동으로 할당하는 포트와 연결

## 자동 설정 변수

다음 변수들은 Railway가 자동으로 설정하므로 수동 설정이 불필요합니다:

```
RAILWAY_STATIC_URL=https://baekya-protocol-production.up.railway.app
RAILWAY_GIT_COMMIT_SHA=abc123def456
RAILWAY_ENVIRONMENT=production
```

## 선택적 환경변수

필요에 따라 설정할 수 있는 환경변수들:

### GitHub 통합 (선택사항)
```
GITHUB_TOKEN=ghp_your_github_token_here
WEBHOOK_SECRET=your_webhook_secret_here
```

### Firebase 설정 (선택사항)
```
FIREBASE_PROJECT_ID=baekya-protocol
FIREBASE_PRIVATE_KEY=your_private_key_here
FIREBASE_CLIENT_EMAIL=your_client_email_here
```

### 로그 설정
```
LOG_LEVEL=info
```

### 백야 프로토콜 설정
```
PROTOCOL_MODE=production
COMMUNICATION_ADDRESS=010-0000-0000
```

## 환경변수 설정 방법

### 1. Railway 대시보드 사용
1. https://railway.app 로그인
2. 프로젝트 선택
3. Variables 탭 클릭
4. 변수 추가 (Key-Value 형태)

### 2. Railway CLI 사용
```bash
railway variables set NODE_ENV=production
railway variables set PORT=3000
```

### 3. 환경변수 확인
```bash
railway variables
```

## 보안 주의사항

- 민감한 정보 (API 키, 토큰 등)는 반드시 환경변수로 설정
- GitHub 등 공개 저장소에 민감한 정보 커밋 금지
- 프로덕션과 개발 환경의 환경변수 분리 관리

## 문제 해결

### 환경변수가 적용되지 않는 경우
1. Railway 대시보드에서 변수 설정 확인
2. 배포 재실행: `railway deploy`
3. 로그 확인: `railway logs`

### 환경변수 값 확인
```bash
railway shell
echo $NODE_ENV
echo $PORT
``` 