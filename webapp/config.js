// 백야 프로토콜 웹앱 설정

// 릴레이 서버 URL 설정
// APK는 무조건 릴레이 서버 사용, 웹앱은 localhost에서만 로컬 서버 사용
if (window.Capacitor && window.Capacitor.isNativePlatform()) {
  // APK 환경에서는 무조건 릴레이 서버 사용
  window.RELAY_SERVER_URL = 'https://baekya-relay-production.up.railway.app';
  console.log('🔥 APK 환경 감지 - 릴레이 서버 사용:', window.RELAY_SERVER_URL);
} else {
  // 웹앱 환경
  window.RELAY_SERVER_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'  // 개발 환경 (웹앱 테스트용)
    : 'https://baekya-relay-production.up.railway.app'; // Railway 릴레이 서버
  console.log('🌐 웹앱 환경 - 서버 URL:', window.RELAY_SERVER_URL);
}

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