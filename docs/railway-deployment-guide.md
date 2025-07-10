# Railway 배포 가이드

## 1. Railway 계정 생성
1. https://railway.app 접속
2. GitHub 계정으로 로그인
3. 새 프로젝트 생성

## 2. 프로젝트 배포
1. "Deploy from GitHub repo" 선택
2. baekya-protocol 리포지토리 선택
3. 자동 배포 시작

## 3. 환경변수 설정
Railway 대시보드에서 다음 환경변수들을 설정:

### 필수 환경변수
- `NODE_ENV=production`
- `PORT=3000`

### 선택적 환경변수
- `RAILWAY_STATIC_URL` (자동 설정됨)
- `RAILWAY_GIT_COMMIT_SHA` (자동 설정됨)

## 4. 도메인 설정
1. Railway 대시보드에서 "Settings" → "Domains" 
2. 자동 생성된 도메인 확인 (예: `baekya-protocol-production.up.railway.app`)
3. 커스텀 도메인 설정 (선택사항)

## 5. 웹앱 RPC URL 업데이트
배포 완료 후 webapp/app.js의 RPC URL을 Railway URL로 업데이트:

```javascript
// Railway 배포 URL로 변경
const RPC_URL = 'https://baekya-protocol-production.up.railway.app/api';
const WS_URL = 'wss://baekya-protocol-production.up.railway.app/ws';
```

## 6. 배포 확인
1. Railway 도메인 접속
2. `/api/status` 엔드포인트 확인
3. 웹앱에서 실제 서버 연결 테스트

## 7. 모니터링
- Railway 대시보드에서 로그 확인
- 메모리 및 CPU 사용량 모니터링
- 자동 스케일링 설정 (필요시)

## 8. 비용 관리
- 무료 플랜: 월 $5 크레딧 제공
- 사용량 모니터링 권장
- 필요시 Pro 플랜 업그레이드

## 9. 자동 배포 설정
- GitHub push 시 자동 배포
- 브랜치별 배포 환경 설정 가능
- 배포 히스토리 관리

## 10. 문제 해결
- 배포 실패 시 Build Logs 확인
- 런타임 오류 시 Deploy Logs 확인
- 환경변수 설정 재확인 