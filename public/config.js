// 백야 프로토콜 웹앱 설정

// 릴레이 서버 URL 설정
// 개발 환경: 로컬 서버
// 프로덕션 환경: Railway 배포 서버
window.RELAY_SERVER_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000'  // 개발 환경
  : 'https://baekya-relay-production.up.railway.app'; // Railway 배포된 릴레이 서버

// 기타 설정
window.APP_CONFIG = {
  // 앱 버전
  version: '1.0.0',
  
  // 디버그 모드
  debug: window.location.hostname === 'localhost',
  
  // API 타임아웃 (밀리초)
  apiTimeout: 30000,
  
  // WebSocket 재연결 시도 간격 (밀리초)
  wsReconnectInterval: 5000,
  
  // 최대 재연결 시도 횟수
  maxReconnectAttempts: 10,
  
  // 기본 언어
  language: 'ko',
  
  // 기능 플래그
  features: {
    // P2P 기능 활성화 (모바일 앱에서만)
    p2p: false,
    
    // QR 코드 스캔 (모바일 앱에서만)
    qrScan: false,
    
    // 생체인증 (추후 구현)
    biometric: false,
    
    // 자동 로그인
    autoLogin: true,
    
    // 실시간 업데이트
    realTimeUpdates: true
  }
}; 