// BROTHERHOOD 웹앱 설정

// 릴레이 서버 URL 설정
// Capacitor 환경 감지
const isCapacitor = window.Capacitor && window.Capacitor.isNativePlatform();

if (isCapacitor) {
  // 모바일 앱 - PC의 IP 주소로 접근
  window.RELAY_SERVER_URL = 'http://192.168.219.103:3000';
  console.log('📱 모바일 앱 - PC 서버 접근:', window.RELAY_SERVER_URL);
} else {
  // 웹 브라우저 - localhost 사용
  window.RELAY_SERVER_URL = 'http://localhost:3000';
  console.log('🌐 웹 브라우저 - 로컬 서버 사용:', window.RELAY_SERVER_URL);
}

window.USE_RELAY_NODES = false;

// 기타 설정
window.APP_CONFIG = {
  // 앱 버전
  version: '1.0.0',
  
  // 디버그 모드
  debug: true,
  
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
    p2p: isCapacitor,
    
    // 생체인증 (추후 구현)
    biometric: isCapacitor,
    
    // 자동 로그인
    autoLogin: true,
    
    // 실시간 업데이트
    realTimeUpdates: true
  }
}; 