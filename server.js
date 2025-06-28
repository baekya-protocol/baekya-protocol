const express = require('express');
const path = require('path');
const BaekyaProtocol = require('./src/index');

const app = express();
const port = 3000;

// 메인 프로토콜 인스턴스
let protocol = null;

// 서버 초기화 함수
async function initializeServer() {
  try {
    console.log('🚀 백야 프로토콜 서버 초기화 중...');
    
    const BaekyaProtocol = require('./src/index');
    protocol = new BaekyaProtocol({
      port: port,
      isProduction: process.env.NODE_ENV === 'production',
      isWebTest: true, // 웹 UI 테스트 모드
      communicationAddress: '010-0000-0000' // 테스트용 기본 통신주소
    });
  
  const initialized = await protocol.initialize();
  if (!initialized) {
      throw new Error('프로토콜 초기화 실패');
  }
  
    console.log('✅ 백야 프로토콜 서버 초기화 완료');
    return true;
  } catch (error) {
    console.error('❌ 서버 초기화 실패:', error);
    throw error;
  }
}

// 정적 파일 서빙
app.use(express.static('public'));
app.use(express.json());

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 기본 라우트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API 상태 확인
app.get('/api/status', async (req, res) => {
  try {
    if (!protocol) {
      return res.status(503).json({ error: '프로토콜이 초기화되지 않았습니다' });
    }
    
    const status = await protocol.getStatus();
    res.json(status);
  } catch (error) {
    console.error('프로토콜 상태 조회 실패:', error);
    res.status(500).json({ error: '프로토콜 상태 조회 실패', details: error.message });
  }
});

// 사용자 등록 (아이디/비밀번호 방식)
app.post('/api/register', async (req, res) => {
  try {
    const { userData } = req.body;
    
    if (!userData || !userData.username || !userData.password) {
      return res.status(400).json({ 
        success: false, 
        error: '아이디와 비밀번호가 필요합니다' 
      });
    }

    // 프로토콜 사용자 등록
    const result = await protocol.registerUser(userData);
    
    if (result.success) {
      console.log(`🎉 새로운 사용자 등록: ${result.didHash} (${result.username})`);
      
      if (result.isFounder) {
        console.log(`👑 Founder 계정 등록! 특별 혜택 부여됨`);
      }
      
      if (result.isInitialOP) {
        console.log(`👑 첫 번째 사용자 이니셜 OP 설정 완료: ${result.initialOPResult.totalPTokensGranted}P 지급`);
      }
      
      // 사용자가 소속된 DAO 정보 가져오기
      let userDAOs = [];
      if (result.success && (result.isFounder || result.isInitialOP)) {
        const dashboard = await protocol.getUserDashboard(result.didHash);
        userDAOs = dashboard.daos || [];
      }
      
      res.json({
        success: true,
        didHash: result.didHash,
        username: result.username,
        name: result.name,
        communicationAddress: result.communicationAddress,
        isFirstUser: result.isFirstUser,
        isFounder: result.isFounder,
        isInitialOP: result.isInitialOP,
        initialOPResult: result.initialOPResult,
        founderBenefits: result.founderBenefits,
        daos: userDAOs, // 소속 DAO 정보 추가
        message: result.message
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('사용자 등록 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '사용자 등록 실패', 
      details: error.message 
    });
  }
});

// 사용자 로그인 (새로운 엔드포인트)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: '아이디와 비밀번호가 필요합니다' 
      });
    }

    const result = await protocol.loginUser(username, password);
    
    if (result.success) {
      console.log(`🔐 사용자 로그인: ${result.username}`);
      
      res.json({
        success: true,
        didHash: result.didHash,
        username: result.username,
        name: result.name,
        communicationAddress: result.communicationAddress,
        isFounder: result.isFounder,
        message: result.message
      });
    } else {
      res.status(401).json(result);
    }
  } catch (error) {
    console.error('사용자 로그인 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '사용자 로그인 실패', 
      details: error.message 
    });
  }
});

// 레거시 API 호환성 (기존 생체인증 API 리다이렉트)
app.post('/api/auth/generate-did', async (req, res) => {
  // 이 엔드포인트는 레거시 호환성을 위해 유지하되 에러 반환
  res.status(410).json({
    success: false,
    error: '이 API는 더 이상 지원되지 않습니다. /api/register 또는 /api/login을 사용하세요.',
    newEndpoints: {
      register: '/api/register',
      login: '/api/login'
    }
  });
});

// 사용자 인증 (레거시 호환성)
app.post('/api/authenticate', async (req, res) => {
  try {
    // 구 API 지원 중단 안내
    res.status(410).json({
      success: false,
      error: '이 API는 더 이상 지원되지 않습니다. /api/login을 사용하세요.',
      newEndpoint: '/api/login'
    });
  } catch (error) {
    console.error('사용자 인증 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '사용자 인증 실패', 
      details: error.message 
    });
  }
});

// 기여 제출
app.post('/api/contribute', async (req, res) => {
  try {
    const contributionData = req.body;
    
    if (!contributionData.contributorDID || !contributionData.daoId || !contributionData.dcaId) {
      return res.status(400).json({
        success: false,
        error: '기여자 DID, DAO ID, DCA ID는 필수입니다'
      });
    }

    const result = await protocol.submitContribution(contributionData);
    res.json(result);
  } catch (error) {
    console.error('기여 제출 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '기여 제출 실패', 
      details: error.message 
    });
  }
});

// 기여 검증
app.post('/api/verify-contribution', async (req, res) => {
  try {
    const { contributionId, verifierDID, verified, reason } = req.body;
    const result = await protocol.verifyContribution(contributionId, verifierDID, verified, reason);
    res.json(result);
  } catch (error) {
    console.error('기여 검증 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '기여 검증 실패', 
      details: error.message 
    });
  }
});

// DAO 목록 조회
app.get('/api/daos', (req, res) => {
  try {
    const daos = protocol.getDAOs();
    res.json(daos);
  } catch (error) {
    console.error('DAO 목록 조회 실패:', error);
    res.status(500).json({ error: 'DAO 목록 조회 실패', details: error.message });
  }
});

// 특정 DAO 조회
app.get('/api/daos/:daoId', (req, res) => {
  try {
    const dao = protocol.getDAO(req.params.daoId);
    if (!dao) {
      return res.status(404).json({ error: 'DAO를 찾을 수 없습니다' });
    }
    res.json(dao);
  } catch (error) {
    console.error('DAO 조회 실패:', error);
    res.status(500).json({ error: 'DAO 조회 실패', details: error.message });
  }
});

// DAO 생성
app.post('/api/daos', async (req, res) => {
  try {
    const daoData = req.body;
    const result = await protocol.createDAO(daoData);
    res.json(result);
  } catch (error) {
    console.error('DAO 생성 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: 'DAO 생성 실패', 
      details: error.message 
    });
  }
});

// DAO 가입
app.post('/api/daos/:daoId/join', async (req, res) => {
  try {
    const { daoId } = req.params;
    const { userDID, membershipType } = req.body;
    const result = await protocol.joinDAO(daoId, userDID, membershipType);
    res.json(result);
  } catch (error) {
    console.error('DAO 가입 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: 'DAO 가입 실패', 
      details: error.message 
    });
  }
});

// 사용자 대시보드 조회
app.get('/api/dashboard/:did', async (req, res) => {
  try {
    const dashboard = await protocol.getUserDashboard(req.params.did);
    res.json(dashboard);
  } catch (error) {
    console.error('대시보드 조회 실패:', error);
    res.status(500).json({ error: '대시보드 조회 실패', details: error.message });
  }
});

// 사용자 지갑 정보 조회
app.get('/api/wallet/:did', async (req, res) => {
  try {
    const wallet = await protocol.getUserWallet(req.params.did);
    res.json(wallet);
  } catch (error) {
    console.error('지갑 정보 조회 실패:', error);
    res.status(500).json({ error: '지갑 정보 조회 실패', details: error.message });
  }
});

// 토큰 전송
app.post('/api/transfer', async (req, res) => {
  try {
    const { fromDID, toDID, amount, tokenType, authData } = req.body;
    
    // 통합 인증 검증 (SimpleAuth 사용)
    const authResult = await protocol.verifyBiometricAuth(fromDID, authData, 'token_transfer');
    if (!authResult.authorized) {
      return res.status(401).json({ 
        success: false, 
        error: '인증 실패', 
        details: authResult.message 
      });
    }
    
    const result = await protocol.transferTokens(fromDID, toDID, amount, tokenType);
    res.json(result);
  } catch (error) {
    console.error('토큰 전송 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '토큰 전송 실패', 
      details: error.message 
    });
  }
});

// 통합 인증 검증 (SimpleAuth 사용)
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { didHash, authData, action } = req.body;
    
    if (!didHash || !authData || !action) {
      return res.status(400).json({
        success: false,
        error: 'DID, 인증 데이터, 작업 타입이 필요합니다'
      });
    }
    
    const authSystem = protocol.components.authSystem; // SimpleAuth 사용
    const result = authSystem.verifyForAction(didHash, authData, action);
    
    res.json(result);
  } catch (error) {
    console.error('통합 인증 검증 실패:', error);
    res.status(500).json({
      success: false,
      error: '인증 검증 실패',
      details: error.message
    });
  }
});

// P2P 전화 요청
app.post('/api/p2p/call/initiate', async (req, res) => {
  try {
    const { fromDID, fromCommAddress, toCommAddress, callType } = req.body;
    
    if (!fromDID || !fromCommAddress || !toCommAddress) {
      return res.status(400).json({
        success: false,
        error: '발신자 DID, 발신자 통신주소, 수신자 통신주소가 필요합니다'
      });
    }
    
    const p2pNetwork = protocol.getBlockchain().p2pNetwork;
    const result = p2pNetwork.initiateCall(fromDID, fromCommAddress, toCommAddress, callType);
    
    res.json(result);
  } catch (error) {
    console.error('전화 요청 실패:', error);
    res.status(500).json({
      success: false,
      error: '전화 요청 실패',
      details: error.message
    });
  }
});

// P2P 전화 응답
app.post('/api/p2p/call/respond', async (req, res) => {
  try {
    const { callId, accepted, reason } = req.body;
    
    if (!callId || typeof accepted !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: '통화 ID와 수락 여부가 필요합니다'
      });
    }
    
    const p2pNetwork = protocol.getBlockchain().p2pNetwork;
    const result = p2pNetwork.respondToCall(callId, accepted, reason);
    
    res.json(result);
  } catch (error) {
    console.error('전화 응답 실패:', error);
    res.status(500).json({
      success: false,
      error: '전화 응답 실패',
      details: error.message
    });
  }
});

// P2P 전화 종료
app.post('/api/p2p/call/end', async (req, res) => {
  try {
    const { callId, endedBy, duration } = req.body;
    
    if (!callId || !endedBy) {
      return res.status(400).json({
        success: false,
        error: '통화 ID와 종료자 정보가 필요합니다'
      });
    }
    
    const p2pNetwork = protocol.getBlockchain().p2pNetwork;
    const result = p2pNetwork.endCall(callId, endedBy, duration || 0);
    
    res.json(result);
  } catch (error) {
    console.error('전화 종료 실패:', error);
    res.status(500).json({
      success: false,
      error: '전화 종료 실패',
      details: error.message
    });
  }
});

// P2P 연락처 검색 (통신주소로 DID 찾기)
app.get('/api/p2p/find-contact/:commAddress', async (req, res) => {
  try {
    const { commAddress } = req.params;
    
    const authSystem = protocol.components.authSystem; // SimpleAuth 사용
    const result = authSystem.getDIDByCommAddress(commAddress);
    
    if (result.success) {
      // 연락처 정보 반환 (개인정보는 제외)
      res.json({
        success: true,
        found: true,
        communicationAddress: result.communicationAddress,
        isActive: true // 실제로는 온라인 상태 체크 필요
      });
    } else {
      res.json({
        success: true,
        found: false,
        message: '해당 통신주소의 사용자를 찾을 수 없습니다'
      });
    }
  } catch (error) {
    console.error('연락처 검색 실패:', error);
    res.status(500).json({
      success: false,
      error: '연락처 검색 실패',
      details: error.message
    });
  }
});

// PoliticalDAO DCA 상태 조회
app.get('/api/dao/political/dca-status', async (req, res) => {
  try {
    const automationSystem = protocol.getAutomationSystem();
    const status = automationSystem.getAutomationStatus();
    
    res.json({
      success: true,
      politicalDAOMonitoring: {
        active: !!automationSystem.politicalDAOMonitor,
        lastCheck: automationSystem.lastPoliticalDAOCheck || null
      },
      automationStatus: status
    });
  } catch (error) {
    console.error('PoliticalDAO DCA 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'DCA 상태 조회 실패',
      details: error.message 
    });
  }
});

// 기여 이력 조회
app.get('/api/contributions/:did', async (req, res) => {
  try {
    const contributions = await protocol.getContributionHistory(req.params.did);
    res.json(contributions);
  } catch (error) {
    console.error('기여 이력 조회 실패:', error);
    res.status(500).json({ error: '기여 이력 조회 실패', details: error.message });
  }
});

// 거버넌스 제안 목록 조회
app.get('/api/proposals', async (req, res) => {
  try {
    const proposals = await protocol.getProposals();
    res.json(proposals);
  } catch (error) {
    console.error('제안 목록 조회 실패:', error);
    res.status(500).json({ error: '제안 목록 조회 실패', details: error.message });
  }
});

// 거버넌스 제안 생성
app.post('/api/proposals', async (req, res) => {
  try {
    const proposalData = req.body;
    const result = await protocol.createProposal(proposalData);
    res.json(result);
  } catch (error) {
    console.error('제안 생성 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '제안 생성 실패', 
      details: error.message 
    });
  }
});

// 거버넌스 투표
app.post('/api/proposals/:proposalId/vote', async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { voterDID, voteType, reason } = req.body;
    const result = await protocol.vote(proposalId, voterDID, voteType, reason);
    res.json(result);
  } catch (error) {
    console.error('투표 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '투표 실패', 
      details: error.message 
    });
  }
});

// 마이닝 상태 조회
app.get('/api/mining/:did', async (req, res) => {
  try {
    const miningStatus = await protocol.getMiningStatus(req.params.did);
    res.json(miningStatus);
  } catch (error) {
    console.error('마이닝 상태 조회 실패:', error);
    res.status(500).json({ error: '마이닝 상태 조회 실패', details: error.message });
  }
});

// 블록체인 상태 조회
app.get('/api/blockchain/status', (req, res) => {
  try {
    const blockchainStatus = protocol.getBlockchainStatus();
    res.json(blockchainStatus);
  } catch (error) {
    console.error('블록체인 상태 조회 실패:', error);
    res.status(500).json({ error: '블록체인 상태 조회 실패', details: error.message });
  }
});

// 에러 핸들링 미들웨어
app.use((error, req, res, next) => {
  console.error('서버 에러:', error);
  res.status(500).json({ 
    error: '내부 서버 오류', 
    details: process.env.NODE_ENV === 'development' ? error.message : '서버에서 오류가 발생했습니다' 
  });
});

// 404 핸들링
app.use((req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다' });
});

// 서버 시작 함수
async function startServer() {
  try {
    // 프로토콜 초기화
    await initializeServer();
    
    // 서버 시작
app.listen(port, () => {
  console.log(`\n🌅 백야 프로토콜 웹 DApp이 실행 중입니다!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🌐 브라우저에서 http://localhost:${port} 로 접속하세요`);
  console.log(`🔗 API: http://localhost:${port}/api/status`);
  console.log(`👤 사용자 등록: http://localhost:${port}/api/register`);
  console.log(`🔐 사용자 로그인: http://localhost:${port}/api/login`);
  console.log(`📊 대시보드: http://localhost:${port}/api/dashboard/[DID]`);
  console.log(`💰 지갑: http://localhost:${port}/api/wallet/[DID]`);
  console.log(`🏛️ DAO: http://localhost:${port}/api/daos`);
  console.log(`🗳️ 거버넌스: http://localhost:${port}/api/proposals`);
      console.log(`🔗 P2P 전화: http://localhost:${port}/api/p2p/call/*`);
      console.log(`🔐 통합 인증: http://localhost:${port}/api/auth/verify`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// 서버 시작
startServer();

module.exports = app; 