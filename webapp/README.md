# 백야 프로토콜 웹 인터페이스 (Vercel 배포용)

이 폴더는 백야 프로토콜의 웹 인터페이스를 Vercel에 배포하기 위한 별도 버전입니다.

## 웹 버전 특징

### 💻 웹에서 사용 가능한 기능
- ✅ 토큰 관리 및 전송
- ✅ DAO 참여 및 거버넌스
- ✅ 네트워크 검증자 참여
- ✅ 프로토콜 정보 확인
- ✅ 아이디 생성 및 로그인

### 📱 모바일 앱에서만 사용 가능한 기능
- ❌ P2P 통신 (실시간 메시징, 음성/영상 통화)
- ❌ QR 코드 스캔 기능
- ❌ 고급 보안 기능

## 네트워크 연결

### RPC 서버 설정
- **메인넷 RPC**: `https://rpc.baekya-protocol.com/api`
- **WebSocket**: `wss://rpc.baekya-protocol.com/ws`

### 백업 노드 (필요 시)
- RPC: `https://node1.baekya-protocol.com/api`
- WebSocket: `wss://node1.baekya-protocol.com/ws`

## 배포 방법

### 1. Vercel CLI 사용
```bash
# Vercel CLI 설치
npm install -g vercel

# 프로젝트 루트에서 배포
vercel --cwd webapp
```

### 2. GitHub 연동
1. GitHub에 webapp 폴더 push
2. Vercel 대시보드에서 프로젝트 import
3. Root Directory를 `webapp`으로 설정
4. 배포 실행

### 3. 설정 파일
- `vercel.json`: Vercel 배포 설정
- 정적 파일 서빙 + SPA 라우팅 지원

## 보안 설정

### CSP (Content Security Policy)
```
default-src 'self' 'unsafe-inline' 'unsafe-eval' https:; 
img-src 'self' data: https:; 
font-src 'self' data: https:; 
connect-src 'self' https: wss: ws:;
```

### 보안 헤더
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

## 사용자 안내

### P2P 통신 기능
웹 버전에서는 P2P 통신 탭 클릭 시 모바일 앱 다운로드 안내가 표시됩니다.

### QR 코드 스캔
토큰 전송 시 QR 스캔 버튼 대신 "QR 스캔은 앱에서 이용 가능" 안내가 표시됩니다.

## 기술 스택

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **라이브러리**: QRCode.js, jsQR, Font Awesome
- **배포**: Vercel (Static Site)
- **네트워크**: WebSocket + REST API

## 환경 변수

현재 하드코딩된 RPC 서버 주소를 환경변수로 변경하려면:

```javascript
// app.js에서
this.apiBase = process.env.VITE_RPC_URL || 'https://rpc.baekya-protocol.com/api';
this.wsUrl = process.env.VITE_WS_URL || 'wss://rpc.baekya-protocol.com/ws';
```

## 라이선스

MIT License - 백야 프로토콜 프로젝트 