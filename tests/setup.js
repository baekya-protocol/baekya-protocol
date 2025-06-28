// 전역 테스트 설정
global.console = {
  ...console,
  // 테스트 중 불필요한 로그 숨기기
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error
};

// 테스트 시작 전 초기화
beforeEach(() => {
  jest.clearAllMocks();
});

// 비동기 테스트를 위한 유틸리티
global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); 