# 백야 프로토콜 웹앱 배포 가이드

## 🚀 Vercel 배포 방법

### 1. Vercel 계정 생성/로그인
```bash
vercel login
```

### 2. 프로젝트 배포
```bash
vercel
```

### 3. 프로덕션 배포
```bash
vercel --prod
```

## 📁 파일 구조
- `index.html` - 메인 웹앱 파일
- `app.js` - 백야 프로토콜 메인 로직
- `styles.css` - 스타일시트
- `service-worker.js` - PWA 서비스 워커
- `manifest.json` - PWA 매니페스트
- `vercel.json` - Vercel 배포 설정

## 🌐 배포 완료 후 확인사항
1. PWA 설치 가능
2. 서비스 워커 작동
3. 아이디/비밀번호 로그인 기능
4. 토큰 시스템 작동
5. DAO 기능 작동

## 📱 주요 기능
- **아이디/비밀번호 기반 인증**
- **B-Token & P-Token 시스템**
- **DAO 거버넌스**
- **P2P 통신**
- **Founder 특별 혜택**
- **완전한 PWA 지원**

배포 후 URL: `https://your-project-name.vercel.app` 