// NODE_ENV가 설정되지 않은 경우 development로 설정
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('📌 NODE_ENV를 development로 설정했습니다.');
}

const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const readline = require('readline');
const BaekyaProtocol = require('./src/index');

const app = express();
const port = 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 메인 프로토콜 인스턴스
let protocol = null;

// 자동검증 시스템들
let githubIntegration = null;
let communityIntegration = null;
let automationSystem = null;

// WebSocket 연결 관리
const clients = new Map(); // DID -> WebSocket connections

// 검증자 관련 변수
let validatorDID = null;
let validatorUsername = null;
let blockGenerationTimer = null;
let blocksGenerated = 0;

// WebSocket 연결 핸들러
wss.on('connection', (ws) => {
  let userDID = null;
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'auth':
          // 사용자 인증
          userDID = data.did;
          if (!clients.has(userDID)) {
            clients.set(userDID, new Set());
          }
          
          // 기존 연결이 있으면 종료 (다중 로그인 방지)
          const existingConnections = clients.get(userDID);
          existingConnections.forEach(existingWs => {
            if (existingWs !== ws && existingWs.readyState === WebSocket.OPEN) {
              existingWs.send(JSON.stringify({
                type: 'session_terminated',
                reason: '다른 기기에서 로그인했습니다'
              }));
              existingWs.close();
            }
          });
          
          // 새 연결 추가
          existingConnections.clear();
          existingConnections.add(ws);
          
          // 최신 상태 전송
          protocol.getUserWallet(userDID).then(wallet => {
            const poolStatus = protocol.components.storage.getValidatorPoolStatus();
            
            ws.send(JSON.stringify({
              type: 'state_update',
              wallet: wallet,
              validatorPool: poolStatus
            }));
          });
          
          console.log(`🔌 WebSocket 연결: ${userDID}`);
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (error) {
      console.error('WebSocket 메시지 처리 오류:', error);
    }
  });
  
  ws.on('close', () => {
    if (userDID && clients.has(userDID)) {
      clients.get(userDID).delete(ws);
      if (clients.get(userDID).size === 0) {
        clients.delete(userDID);
      }
      console.log(`🔌 WebSocket 연결 종료: ${userDID}`);
    }
  });
});

// 모든 클라이언트에 상태 업데이트 브로드캐스트
function broadcastStateUpdate(userDID, updateData) {
  if (clients.has(userDID)) {
    const userConnections = clients.get(userDID);
    userConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'state_update',
          ...updateData
        }));
      }
    });
  }
}

// 전체 사용자에게 검증자 풀 업데이트 브로드캐스트
function broadcastPoolUpdate(poolStatus) {
  const message = JSON.stringify({
    type: 'pool_update',
    validatorPool: poolStatus
  });
  
  clients.forEach((connections, did) => {
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  });
}

// 전체 사용자에게 DAO 금고 업데이트 브로드캐스트
function broadcastDAOTreasuryUpdate(daoTreasuries) {
  const message = JSON.stringify({
    type: 'dao_treasury_update',
    daoTreasuries: daoTreasuries
  });
  
  clients.forEach((connections, did) => {
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  });
}

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
    
    // 자동검증 시스템 초기화
    console.log('🤖 자동검증 시스템 초기화 중...');
    
    // GitHubIntegration 초기화
    const GitHubIntegration = require('./src/automation/GitHubIntegration');
    githubIntegration = new GitHubIntegration(
      protocol.components.daoSystem,
      null // CVCM 시스템은 제거되었으므로 null
    );
    
    // CommunityDAOIntegration 초기화
    const CommunityDAOIntegration = require('./src/automation/CommunityDAOIntegration');
    communityIntegration = new CommunityDAOIntegration(
      protocol.components.daoSystem,
      null, // CVCM 시스템은 제거되었으므로 null
      null  // 자동화 시스템
    );
    
    // AutomationSystem 초기화
    const AutomationSystem = require('./src/automation/AutomationSystem');
    automationSystem = new AutomationSystem(protocol);
    
    // 자동화 시스템 시작
    automationSystem.start();
    
    console.log('✅ 자동검증 시스템 초기화 완료');
    
    // 서버 시작 시 검증자 풀 초기화
    console.log('🔄 검증자 풀을 초기화합니다.');
    if (protocol.components && protocol.components.storage && typeof protocol.components.storage.resetValidatorPool === 'function') {
      protocol.components.storage.resetValidatorPool();
    } else {
      console.warn('⚠️ 검증자 풀 초기화 함수를 찾을 수 없습니다.');
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
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Session-ID, X-Device-ID');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 세션 검증 미들웨어
const validateSession = (req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  const publicRoutes = ['/api/status', '/api/register', '/api/login', '/api/p2p/find-contact'];
  
  // 공개 라우트는 세션 검증 건너뛰기
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  if (!sessionId) {
    return next(); // 세션 없어도 일단 진행 (하위 호환성)
  }
  
  // 세션 유효성 검증
  const session = protocol.components.storage.validateSession(sessionId);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: '세션이 만료되었거나 다른 기기에서 로그인했습니다.',
      code: 'SESSION_EXPIRED'
    });
  }
  
  req.session = session;
  next();
};

// 세션 검증 미들웨어 적용
app.use(validateSession);

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

// 프로토콜 전체 상태 조회 (검증자 풀, DAO 금고 등)
app.get('/api/protocol-state', async (req, res) => {
  try {
    if (!protocol) {
      return res.status(503).json({ error: '프로토콜이 초기화되지 않았습니다' });
    }
    
    // 검증자 풀 상태
    const poolStatus = protocol.components.storage.getValidatorPoolStatus();
    
    // DAO 금고 상태
    const daosResult = protocol.getDAOs();
    const daoTreasuries = {};
    
    if (daosResult.success && daosResult.daos) {
      for (const dao of daosResult.daos) {
        daoTreasuries[dao.id] = dao.treasury || 0;
      }
    }
    
    res.json({
      success: true,
      validatorPool: poolStatus.totalStake || 0,
      daoTreasuries: daoTreasuries,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('프로토콜 상태 조회 실패:', error);
    res.status(500).json({ error: '프로토콜 상태 조회 실패', details: error.message });
  }
});

// 아이디 중복 체크
app.post('/api/check-userid', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '아이디가 필요합니다'
      });
    }
    
    // 예약된 아이디 확인
    const reservedIds = ['founder', 'admin', 'system', 'operator', 'op', 'root', 'test'];
    if (reservedIds.includes(userId.toLowerCase())) {
      return res.json({
        success: true,
        isDuplicate: true,
        reason: 'reserved'
      });
    }
    
    // 프로토콜에서 아이디 중복 확인
    const isDuplicate = await protocol.checkUserIdExists(userId);
    
    res.json({
      success: true,
      isDuplicate: isDuplicate
    });
    
  } catch (error) {
    console.error('아이디 중복 체크 실패:', error);
    res.status(500).json({
      success: false,
      error: '아이디 중복 체크 실패',
      details: error.message
    });
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

    // 디바이스 ID 추가
    if (!userData.deviceId) {
      userData.deviceId = req.headers['x-device-id'] || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      
      // 초대코드 처리
      let inviteReward = null;
      if (userData.inviteCode) {
        try {
          const inviteResult = await processInviteCode(userData.inviteCode, result.didHash);
          if (inviteResult.success) {
            inviteReward = inviteResult;
            console.log(`🎉 초대코드 처리 완료: ${inviteResult.inviterDID} -> 30B, ${result.didHash} -> 20B`);
          } else {
            console.log(`⚠️ 초대코드 처리 실패: ${inviteResult.error}`);
          }
        } catch (error) {
          console.error(`❌ 초대코드 처리 중 오류:`, error);
        }
      }
      
      // 사용자가 소속된 DAO 정보 가져오기
      let userDAOs = [];
      
      // 모든 사용자에 대해 DAO 소속 정보 확인
      try {
        const dashboard = await protocol.getUserDashboard(result.didHash);
        userDAOs = dashboard.daos || [];
        
        // 초대받은 사용자의 경우 커뮤니티DAO 소속 정보 확인 및 추가
        if (userData.inviteCode && inviteReward && inviteReward.success) {
          // 커뮤니티DAO가 이미 목록에 있는지 확인
          const hasCommunityDAO = userDAOs.some(dao => dao.id === 'community-dao');
          
          if (!hasCommunityDAO) {
                         // 커뮤니티DAO 정보 추가
             userDAOs.push({
               id: 'community-dao',
               name: 'Community DAO',
               description: '백야 프로토콜 커뮤니티 관리를 담당하는 DAO',
               role: 'Member',
               joinedAt: Date.now(),
               contributions: 1, // 초대 참여 기여 1건
               lastActivity: '오늘'
             });
            
            console.log(`✅ 초대받은 사용자 커뮤니티DAO 소속 정보 추가: ${result.didHash}`);
          }
        }
        
        // Founder나 이니셜 OP의 경우 추가 DAO 정보
        if (result.isFounder || result.isInitialOP) {
          console.log(`👑 특별 사용자 DAO 소속 정보: ${userDAOs.length}개 DAO`);
        }
        
      } catch (error) {
        console.error('사용자 DAO 정보 가져오기 실패:', error);
        
        // 초대받은 사용자의 경우 최소한 커뮤니티DAO는 추가
        if (userData.inviteCode && inviteReward && inviteReward.success) {
                     userDAOs = [{
             id: 'community-dao',
             name: 'Community DAO',
             description: '백야 프로토콜 커뮤니티 관리를 담당하는 DAO',
             role: 'Member',
             joinedAt: Date.now(),
             contributions: 1,
             lastActivity: '오늘'
           }];
          
          console.log(`✅ 초대받은 사용자 기본 커뮤니티DAO 소속 정보 설정: ${result.didHash}`);
        }
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
        inviteReward: inviteReward, // 초대 보상 정보
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

    // 디바이스 ID 추가
    const deviceId = req.headers['x-device-id'] || req.body.deviceId || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await protocol.loginUser(username, password, deviceId);
    
    if (result.success) {
      console.log(`🔐 사용자 로그인: ${result.username}`);
      
      // 최신 지갑 정보 가져오기
      const wallet = await protocol.getUserWallet(result.didHash);
      
      // 프로토콜 전체 상태 가져오기
      const poolStatus = protocol.components.storage.getValidatorPoolStatus();
      const daosResult = protocol.getDAOs();
      const daoTreasuries = {};
      
      // 각 DAO의 금고 상태 가져오기
      if (daosResult.success && daosResult.daos) {
        for (const dao of daosResult.daos) {
          daoTreasuries[dao.id] = dao.treasury || 0;
        }
      }
      
      res.json({
        success: true,
        didHash: result.didHash,
        username: result.username,
        name: result.name,
        communicationAddress: result.communicationAddress,
        isFounder: result.isFounder,
        sessionId: result.sessionId,
        tokenBalances: result.tokenBalances || {
          bToken: wallet.balances?.bToken || 0,
          pToken: wallet.balances?.pToken || 0
        },
        // 프로토콜 전체 상태 추가
        protocolState: {
          validatorPool: poolStatus.totalStake || 0,
          daoTreasuries: daoTreasuries
        },
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
    const result = protocol.getDAOs();
    if (result.success) {
      res.json(result.daos);
    } else {
      res.status(500).json({ error: 'DAO 목록 조회 실패', details: result.error });
    }
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
    
    // 이니셜 OP 통신주소 검증
    if (daoData.initialOPAddress) {
      const authSystem = protocol.components.authSystem;
      const result = authSystem.getDIDByCommAddress(daoData.initialOPAddress);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: `이니셜 OP 통신주소(${daoData.initialOPAddress})를 찾을 수 없습니다.`
        });
      }
      
      console.log(`✅ 이니셜 OP 통신주소 검증 완료: ${daoData.initialOPAddress}`);
    }
    
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

// 초대코드 조회 (계정별 고유 초대코드)
app.get('/api/invite-code', async (req, res) => {
  try {
    const userDID = req.headers.authorization?.split(' ')[1];
    
    if (!userDID) {
      return res.status(401).json({
        success: false,
        error: '인증 정보가 필요합니다'
      });
    }

    // 저장소에서 해당 사용자의 초대코드 조회
    const inviteCode = protocol.components.storage.getUserInviteCode(userDID);
    
    if (inviteCode) {
      res.json({
        success: true,
        inviteCode: inviteCode
      });
    } else {
      res.json({
        success: false,
        message: '초대코드가 없습니다'
      });
    }
  } catch (error) {
    console.error('초대코드 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '초대코드 조회 실패', 
      details: error.message 
    });
  }
});

// 초대코드 생성 (계정별 고유 초대코드, 블록체인 저장)
app.post('/api/invite-code', async (req, res) => {
  try {
    const { userDID, communicationAddress } = req.body;
    
    if (!userDID) {
      return res.status(400).json({
        success: false,
        error: '사용자 DID가 필요합니다'
      });
    }

    // 기존 초대코드가 있는지 확인
    const existingCode = protocol.components.storage.getUserInviteCode(userDID);
    if (existingCode) {
      return res.json({
        success: true,
        inviteCode: existingCode
      });
    }

    // 해시 기반 영구 초대코드 생성
    const inviteCode = generateHashBasedInviteCode(userDID);

    try {
      const Transaction = require('./src/blockchain/Transaction');
      
      // 초대코드 등록 트랜잭션 생성
      const inviteCodeTx = new Transaction(
        userDID,
        'did:baekya:system0000000000000000000000000000000002', // 시스템 주소
        0, // 금액 없음
        'B-Token',
        { 
          type: 'invite_code_registration',
          inviteCode: inviteCode,
          communicationAddress: communicationAddress,
          registrationDate: new Date().toISOString()
        }
      );
      inviteCodeTx.sign('test-key');
      
      // 블록체인에 트랜잭션 추가
      const addResult = protocol.getBlockchain().addTransaction(inviteCodeTx);
      
      if (!addResult.success) {
        throw new Error(addResult.error || '트랜잭션 추가 실패');
      }
      
      // 트랜잭션은 추가되었고 검증자가 블록을 생성할 예정
      console.log(`🎫 초대코드 트랜잭션 추가됨 (대기 중), 코드: ${inviteCode}`);
      
      // 저장소에 초대코드 저장 (트랜잭션은 이미 추가됨)
        protocol.components.storage.saveUserInviteCode(userDID, inviteCode);
        
      // 블록체인 등록 상태는 대기 중으로 표시
      // protocol.components.storage.markInviteCodeRegistered(userDID); // 블록 생성 후 처리
        
        res.json({
          success: true,
          inviteCode: inviteCode,
        message: '초대코드가 생성되었습니다. 검증자가 블록을 생성하면 영구 저장됩니다.',
          transactionId: inviteCodeTx.hash,
        status: 'pending'
        });
    } catch (error) {
      console.error('초대코드 블록체인 등록 실패:', error);
      
      // 블록체인 등록에 실패해도 로컬에는 저장
      protocol.components.storage.saveUserInviteCode(userDID, inviteCode);
      
      res.json({
        success: true,
        inviteCode: inviteCode,
        message: '초대코드가 생성되었습니다 (블록체인 등록 지연)'
      });
    }
  } catch (error) {
    console.error('초대코드 생성 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '초대코드 생성 실패', 
      details: error.message 
    });
  }
});

// 해시 기반 초대코드 생성 함수
function generateHashBasedInviteCode(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }
  
  // 해시를 6자리 대문자 영숫자로 변환
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  let num = Math.abs(hash);
  
  for (let i = 0; i < 6; i++) {
    result += chars[num % chars.length];
    num = Math.floor(num / chars.length);
  }
  
  return result;
}

// 초대코드 처리 함수
async function processInviteCode(inviteCode, newUserDID) {
  try {
    // 초대코드로 초대자 찾기
    const inviterDID = protocol.components.storage.findUserByInviteCode(inviteCode);
    
    if (!inviterDID) {
      return {
        success: false,
        error: '유효하지 않은 초대코드입니다'
      };
    }
    
    // 자기 자신을 초대하는 경우 방지
    if (inviterDID === newUserDID) {
      return {
        success: false,
        error: '자기 자신을 초대할 수 없습니다'
      };
    }
    
    // 초대자에게 30B, 생성자에게 20B 지급
    const Transaction = require('./src/blockchain/Transaction');
    
    // 초대자에게 30B 지급
    const inviterTx = new Transaction(
      'did:baekya:system0000000000000000000000000000000002', // 시스템 주소
      inviterDID,
      30,
      'B-Token',
      {
        type: 'invite_reward',
        inviteCode: inviteCode,
        newUserDID: newUserDID,
        role: 'inviter',
        description: '초대 보상 (초대자)'
      }
    );
    inviterTx.sign('test-key');
    
    // 생성자에게 20B 지급
    const newUserTx = new Transaction(
      'did:baekya:system0000000000000000000000000000000002', // 시스템 주소
      newUserDID,
      20,
      'B-Token',
      {
        type: 'invite_reward',
        inviteCode: inviteCode,
        inviterDID: inviterDID,
        role: 'invitee',
        description: '초대 보상 (생성자)'
      }
    );
    newUserTx.sign('test-key');
    
    // 블록체인에 트랜잭션 추가
    console.log('🔄 초대자 트랜잭션 추가 시도...');
    const addResult1 = protocol.getBlockchain().addTransaction(inviterTx);
    console.log('💰 초대자 트랜잭션 결과:', addResult1);
    
    console.log('🔄 생성자 트랜잭션 추가 시도...');
    const addResult2 = protocol.getBlockchain().addTransaction(newUserTx);
    console.log('💰 생성자 트랜잭션 결과:', addResult2);
    
    if (!addResult1.success || !addResult2.success) {
      console.error('❌ 트랜잭션 추가 실패 상세:');
      console.error('  초대자 트랜잭션:', addResult1);
      console.error('  생성자 트랜잭션:', addResult2);
      throw new Error('트랜잭션 추가 실패');
    }
    
    // 트랜잭션은 추가되었고 검증자가 블록을 생성할 예정
    console.log(`💰 초대 보상 트랜잭션 추가됨 (대기 중)`);
    
    // 트랜잭션이 추가되었으므로 기여 내역은 바로 처리
    if (true) {
      
      // 커뮤니티 DAO에 기여 내역 추가
      try {
        // 전역 communityIntegration 사용 (이미 초기화됨)
        
        // 초대 활동을 커뮤니티 DAO 기여 내역에 추가
        const contributionResult = await communityIntegration.handleInviteSuccess(inviteCode, inviterDID, newUserDID);
        console.log(`🎉 커뮤니티 DAO 기여 내역 추가: ${JSON.stringify(contributionResult)}`);
        
        // 기여 내역을 프로토콜 저장소에 저장
        if (contributionResult.success) {
          protocol.components.storage.saveContribution(inviterDID, 'community-dao', {
            id: contributionResult.contribution.id,
            type: 'invite_activity',
            title: '초대 활동',
            dcaId: 'invite-activity',
            evidence: `초대코드: ${inviteCode}`,
            description: `새로운 사용자 초대 성공: ${newUserDID}`,
            bValue: 30, // 실제 지급된 B-Token (30B)
            verified: true,
            verifiedAt: Date.now(),
            metadata: {
              inviteCode,
              inviteeDID: newUserDID,
              completedAt: Date.now()
            }
          });
          
          console.log(`✅ 초대 활동 기여 내역 저장 완료: ${inviterDID}`);
        }

        // 초대받은 사용자(생성자)도 커뮤니티DAO에 추가
        const inviteeJoinResult = await communityIntegration.handleInviteeJoinCommunityDAO(inviteCode, newUserDID, inviterDID);
        console.log(`🎉 초대받은 사용자 커뮤니티DAO 가입 처리: ${JSON.stringify(inviteeJoinResult)}`);
        
        // 생성자 기여 내역을 프로토콜 저장소에 저장
        if (inviteeJoinResult.success) {
          protocol.components.storage.saveContribution(newUserDID, 'community-dao', {
            id: inviteeJoinResult.contribution.id,
            type: 'invite_join',
            title: '초대 참여',
            dcaId: 'invite-join',
            evidence: `초대코드: ${inviteCode}`,
            description: `초대를 통해 커뮤니티에 참여 (초대자: ${inviterDID})`,
            bValue: 20, // 실제 지급받은 B-Token (20B)
            verified: true,
            verifiedAt: Date.now(),
            metadata: {
              inviteCode,
              inviterDID,
              joinedAt: Date.now(),
              description: '초대를 통해 커뮤니티에 참여'
            }
          });
          
          console.log(`✅ 초대받은 사용자 기여 내역 저장 완료: ${newUserDID}`);
        }
      } catch (error) {
        console.error('⚠️ 커뮤니티 DAO 기여 내역 추가 실패:', error);
        // 기여 내역 추가 실패해도 토큰 지급은 이미 완료되었으므로 계속 진행
      }
      
      // 초대자에게 업데이트된 지갑 정보 전송
      const inviterWallet = await protocol.getUserWallet(inviterDID);
      if (inviterWallet.success) {
        console.log(`💰 초대자 잔액 업데이트: ${inviterWallet.balances.bToken}B`);
        
        // 초대자에게 커뮤니티DAO 소속 정보와 함께 업데이트 전송
        broadcastStateUpdate(inviterDID, {
          wallet: { balances: { bToken: inviterWallet.balances.bToken, pToken: inviterWallet.balances.pToken || 0 } },
          newContribution: {
            dao: 'community-dao',
            type: 'invite_activity',
            title: '초대 활동',
            bTokens: 30,
            description: `새로운 사용자 초대 성공`,
            date: new Date().toISOString().split('T')[0]
          },
          daoMembership: {
            action: 'join',
            dao: {
              id: 'community-dao',
              name: 'Community DAO',
              icon: 'fa-users',
              role: 'Member',
              contributions: 1,
              lastActivity: '오늘',
              joinedAt: Date.now()
            }
          }
        });
      }
      
      // 생성자에게 업데이트된 지갑 정보 전송
      const newUserWallet = await protocol.getUserWallet(newUserDID);
      if (newUserWallet.success) {
        console.log(`💰 생성자 잔액 업데이트: ${newUserWallet.balances.bToken}B`);
        broadcastStateUpdate(newUserDID, {
          wallet: { balances: { bToken: newUserWallet.balances.bToken, pToken: newUserWallet.balances.pToken || 0 } }
        });
      }
      
      return {
        success: true,
        inviterDID: inviterDID,
        newUserDID: newUserDID,
        inviterReward: 30,
        newUserReward: 20,
        transactionIds: [inviterTx.hash, newUserTx.hash],
        status: 'pending'
      };
    } else {
      // 트랜잭션이 추가되었으므로 성공으로 처리
      return {
        success: true,
        inviterDID: inviterDID,
        newUserDID: newUserDID,
        inviterReward: 30,
        newUserReward: 20,
        transactionIds: [inviterTx.hash, newUserTx.hash],
        status: 'pending'
      };
    }
    
  } catch (error) {
    console.error('초대코드 처리 오류:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

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
    console.log('🔍 토큰 전송 요청 받음');
    console.log('📦 요청 본문:', JSON.stringify(req.body, null, 2));
    console.log('🔐 헤더:', req.headers);
    
    const { fromDID, toAddress, amount, tokenType = 'B-Token', authData } = req.body;
    
    console.log('📋 파싱된 데이터:');
    console.log(`  - fromDID: ${fromDID} (타입: ${typeof fromDID})`);
    console.log(`  - toAddress: ${toAddress} (타입: ${typeof toAddress})`);
    console.log(`  - amount: ${amount} (타입: ${typeof amount})`);
    console.log(`  - tokenType: ${tokenType}`);
    console.log(`  - authData: ${JSON.stringify(authData)}`);
    
    if (!fromDID || !toAddress || !amount || amount <= 0) {
      console.log('❌ 파라미터 검증 실패:');
      console.log(`  - fromDID 존재: ${!!fromDID}`);
      console.log(`  - toAddress 존재: ${!!toAddress}`);
      console.log(`  - amount 존재: ${!!amount}`);
      console.log(`  - amount > 0: ${amount > 0}`);
      
      return res.status(400).json({
        success: false,
        error: '발신자 DID, 받는 주소, 유효한 금액이 필요합니다'
      });
    }
    
    // toAddress가 DID인지, 통신주소인지, 아이디인지 확인하고 DID로 변환
    let toDID = toAddress;
    if (!toAddress.startsWith('did:baekya:')) {
      // 통신주소나 아이디로 DID 찾기
      const authSystem = protocol.components.authSystem;
      
      console.log(`🔍 주소 변환 시도: ${toAddress}`);
      
      // 하이픈 없는 전화번호 형식이면 하이픈 추가
      let normalizedAddress = toAddress;
      if (/^010\d{8}$/.test(toAddress)) {
        // 01012345678 → 010-1234-5678
        normalizedAddress = `${toAddress.slice(0, 3)}-${toAddress.slice(3, 7)}-${toAddress.slice(7)}`;
        console.log(`📱 전화번호 형식 변환: ${toAddress} → ${normalizedAddress}`);
      }
      
      // 먼저 통신주소로 시도
      const byCommAddress = authSystem.getDIDByCommAddress(normalizedAddress);
      console.log('통신주소 검색 결과:', byCommAddress);
      
      if (byCommAddress.success) {
        toDID = byCommAddress.didHash;
        console.log(`✅ 통신주소로 DID 찾기 성공: ${toDID}`);
      } else {
        // 아이디로 시도 (원래 주소 그대로 사용)
        const byUserId = authSystem.getDIDByUsername(toAddress);
        console.log('아이디 검색 결과:', byUserId);
        
        if (byUserId.success) {
          toDID = byUserId.didHash;
          console.log(`✅ 아이디로 DID 찾기 성공: ${toDID}`);
        } else {
          console.log(`❌ 주소 찾기 실패: ${toAddress}`);
          return res.status(404).json({
            success: false,
            error: `받는 주소를 찾을 수 없습니다: ${toAddress}`
          });
        }
      }
    }
    
    // 통합 인증 검증 (SimpleAuth 사용)
    const authResult = protocol.components.authSystem.verifyForAction(fromDID, authData, 'token_transfer');
    if (!authResult.authorized) {
      return res.status(401).json({ 
        success: false, 
        error: '인증 실패', 
        details: authResult.message 
      });
    }
    
    // 수수료 계산 (0.1%)
    const fee = amount * 0.001; // 0.1%
    const totalAmount = amount + fee;
    const feeToValidator = fee * 1.0; // 수수료의 100%는 검증자 풀로
    const feeToDAO = fee * 0.0; // 수수료의 0%는 DAO 금고로
    
    console.log('💰 수수료 계산:');
    console.log(`  - 전송 금액: ${amount}B`);
    console.log(`  - 수수료 (0.1%): ${fee}B`);
          console.log(`  - 검증자 풀 (100%): ${feeToValidator}B`);
      console.log(`  - DAO 분배 (0%): ${feeToDAO}B`);
    console.log(`  - 사용자 총 지불액: ${totalAmount}B`);
    
    // 잔액 확인
    const currentBalance = protocol.getBlockchain().getBalance(fromDID, tokenType);
    if (currentBalance < totalAmount) {
      return res.status(400).json({
        success: false,
        error: `${tokenType} 잔액이 부족합니다 (필요: ${totalAmount}, 보유: ${currentBalance})`
      });
    }
    
    try {
      const Transaction = require('./src/blockchain/Transaction');
      
      // 토큰 전송 트랜잭션 생성
      const transferTx = new Transaction(
        fromDID,
        toDID,
        amount, // 받는 사람이 받을 실제 금액
        tokenType,
        { 
          type: 'token_transfer',
          fee: fee,
          validatorFee: feeToValidator,
          daoFee: feeToDAO,
          memo: req.body.memo || ''
        }
      );
      transferTx.sign('test-key');
      
      // 수수료 트랜잭션 생성 (발신자 -> 시스템)
      const feeTx = new Transaction(
        fromDID,
        'did:baekya:system0000000000000000000000000000000003', // 수수료 수집 주소
        fee,
        tokenType,
        { 
          type: 'transfer_fee',
          validatorFee: feeToValidator,
          daoFee: feeToDAO,
          originalTransfer: transferTx.hash
        }
      );
      feeTx.sign('test-key');
      
      // 블록체인에 트랜잭션 추가
      const addResult1 = protocol.getBlockchain().addTransaction(transferTx);
      const addResult2 = protocol.getBlockchain().addTransaction(feeTx);
      
      if (!addResult1.success || !addResult2.success) {
        throw new Error('트랜잭션 추가 실패');
      }
      
      // 트랜잭션은 추가되었고 검증자가 블록을 생성할 예정
      console.log(`💸 토큰 전송 트랜잭션 추가됨 (대기 중)`);
      
      // 트랜잭션이 추가되었으므로 응답은 바로 처리
      if (true) {
        
        // 검증자 풀 업데이트는 BlockchainCore의 updateStorageFromBlock에서 처리됨
        // 직접 업데이트 제거
        
        // DAO 수수료 분배 - 100% 검증자 풀로 변경됨으로 제거됨
        
        // 업데이트된 지갑 정보 브로드캐스트
        const updatedFromWallet = await protocol.getUserWallet(fromDID);
        const updatedToWallet = await protocol.getUserWallet(toDID);
        
        // 발신자 정보 가져오기
        const fromUserInfo = protocol.components.authSystem.getDIDInfo(fromDID);
        const fromDisplayName = fromUserInfo?.didData?.username || fromUserInfo?.didData?.communicationAddress || fromDID.substring(0, 16) + '...';
        
        broadcastStateUpdate(fromDID, { wallet: updatedFromWallet });
        broadcastStateUpdate(toDID, { 
          wallet: updatedToWallet,
          newTransaction: {
            type: 'received',
            from: fromDID,
            fromAddress: fromDisplayName,
            amount: amount,
            tokenType: tokenType,
            memo: req.body.memo || '',
            timestamp: new Date().toISOString(),
            transactionId: transferTx.hash,
            status: 'pending'
          }
        });
        
        res.json({
          success: true,
          message: `${amount} ${tokenType} 전송 트랜잭션이 추가되었습니다`,
          transactionId: transferTx.hash,
          status: 'pending',
          fee: fee,
          feeDistribution: {
            validatorPool: feeToValidator,
            dao: feeToDAO
          },
          recipient: {
            did: toDID,
            address: toAddress
          }
        });
      } else {
        throw new Error('블록 생성 실패');
      }
    } catch (error) {
      console.error('토큰 전송 블록 생성 실패:', error);
      res.status(500).json({
        success: false,
        error: '토큰 전송 실패',
        details: error.message
      });
    }
  } catch (error) {
    console.error('토큰 전송 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '토큰 전송 실패', 
      details: error.message 
    });
  }
});

// 검증자 풀 후원
app.post('/api/validator-pool/sponsor', async (req, res) => {
  try {
    const { sponsorDID, amount } = req.body;
    
    if (!sponsorDID || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: '후원자 DID와 유효한 금액이 필요합니다'
      });
    }
    
    // 수수료 계산 (고정 0B - 수수료 없음)
    const fee = 0;
    const totalAmount = amount + fee; // 사용자가 지불하는 총액
    const feeToValidator = fee * 1.0; // 수수료의 100%는 검증자 풀로 (0.001B)
    const feeToDAO = fee * 0.0; // 수수료의 0%는 DAO 금고로 (0B)
    
    // B-토큰 차감 (후원금 + 수수료)
    const currentBalance = protocol.getBlockchain().getBalance(sponsorDID, 'B-Token');
    if (currentBalance < totalAmount) {
      return res.status(400).json({
        success: false,
        error: `B-토큰 잔액이 부족합니다 (필요: ${totalAmount}B, 보유: ${currentBalance}B)`
      });
    }
    
    // 검증자 풀로 토큰 전송 (직접 블록체인에 기록)
    const validatorPoolSystemAddress = 'did:baekya:system0000000000000000000000000000000001';
    
    try {
      const Transaction = require('./src/blockchain/Transaction');
      
      // 검증자 풀 후원 트랜잭션 생성 (사용자는 총 10.001B 지불)
      const poolTx = new Transaction(
        sponsorDID,
        validatorPoolSystemAddress,
        totalAmount, // 사용자가 지불하는 총액 (10.001B)
        'B-Token',
        { 
          type: 'validator_pool_sponsor', 
          actualSponsorAmount: amount, // 실제 후원금 (10B)
          validatorFee: feeToValidator, // 검증자 풀로 가는 수수료 (0.0006B)
          daoFee: feeToDAO // DAO로 가는 수수료 (0.0004B)
        }
      );
      poolTx.sign('test-key'); // 개발 환경용 테스트 키로 올바른 서명 생성
      
      // 디버깅: 트랜잭션 정보 출력
      console.log('🔍 트랜잭션 디버깅 정보:');
      console.log(`  NODE_ENV: ${process.env.NODE_ENV || '설정되지 않음'}`);
      console.log(`  발신자: ${sponsorDID}`);
      console.log(`  수신자: ${validatorPoolSystemAddress}`);
      console.log(`  트랜잭션 금액: ${totalAmount}B (차감되는 총액)`);
      console.log(`  서명: ${poolTx.signature ? '있음' : '없음'}`);
      console.log(`  해시: ${poolTx.hash}`);
      
      // 트랜잭션 유효성 수동 검증
      const isValidTx = poolTx.isValid();
      console.log(`  트랜잭션 유효성: ${isValidTx ? '유효' : '무효'}`);
      
      if (!isValidTx) {
        console.error('❌ 트랜잭션 유효성 검증 실패 - 세부 검사 시작');
        
        // 각 검증 단계별로 확인
        console.log(`  - fromDID: ${poolTx.fromDID ? '존재' : '없음'}`);
        console.log(`  - toDID: ${poolTx.toDID ? '존재' : '없음'}`);
        console.log(`  - amount: ${typeof poolTx.amount} (${poolTx.amount})`);
        console.log(`  - amount > 0: ${poolTx.amount > 0}`);
        console.log(`  - tokenType: ${poolTx.tokenType}`);
        console.log(`  - 토큰타입 유효: ${['B-Token', 'P-Token'].includes(poolTx.tokenType)}`);
        console.log(`  - fromDID 형식: ${poolTx.isValidDIDFormat(poolTx.fromDID)}`);
        console.log(`  - toDID 형식: ${poolTx.isValidDIDFormat(poolTx.toDID)}`);
        console.log(`  - 서명 존재: ${poolTx.signature ? '있음' : '없음'}`);
        
        if (poolTx.signature) {
          console.log(`  - 서명 검증: ${poolTx.verifySignatureSecure()}`);
        }
      }
      
      // 블록체인에 트랜잭션 추가
      const addResult = protocol.getBlockchain().addTransaction(poolTx);
      console.log(`🔍 addTransaction 결과: ${addResult.success ? '성공' : '실패'}`);
      if (!addResult.success) {
        console.error(`❌ addTransaction 실패 원인: ${addResult.error}`);
        throw new Error(addResult.error || '트랜잭션 추가 실패');
      }
      
      // 트랜잭션은 추가되었고 검증자가 블록을 생성할 예정
      console.log(`💰 검증자 풀 후원 트랜잭션 추가됨 (대기 중)`);
      
      // 트랜잭션이 추가되었으므로 응답은 바로 처리
      if (true) {
        
        // 약간의 지연을 두어 블록체인 업데이트가 완료되도록 함
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 최신 풀 상태 가져오기 (블록체인에서 업데이트된 상태)
        const poolStatus = protocol.components.storage.getValidatorPoolStatus();
        
        console.log(`💰 검증자 풀 후원 상세:`);
        console.log(`  - 후원자: ${sponsorDID.substring(0, 16)}...`);
        console.log(`  - 후원 금액: ${amount}B`);
        console.log(`  - 수수료(고정): ${fee}B`);
        console.log(`  - 사용자 지불 총액: ${totalAmount}B`);
        console.log(`🏦 검증자 풀 총액: ${poolStatus.totalStake}B`);
        
        // 모든 연결된 클라이언트에 검증자 풀 업데이트 브로드캐스트
        broadcastPoolUpdate({
          balance: poolStatus.totalStake,
          contributions: poolStatus.contributions
        });
        
        // DAO 수수료 분배 처리 - 100% 검증자 풀로 변경됨으로 제거됨
        
        // 후원자에게 업데이트된 지갑 정보 전송
        const updatedWallet = await protocol.getUserWallet(sponsorDID);
        broadcastStateUpdate(sponsorDID, {
          wallet: updatedWallet,
          validatorPool: poolStatus
        });
        
        res.json({
          success: true,
          message: `검증자 풀에 ${amount}B 후원 트랜잭션이 추가되었습니다 (수수료 ${fee}B 별도)`,
          transactionId: poolTx.hash,
          status: 'pending',
          poolStatus: {
            balance: poolStatus.totalStake,
            contributions: poolStatus.contributions
          }
        });
      } else {
        throw new Error(block?.error || '블록 생성 실패');
      }
    } catch (error) {
      console.error('검증자 풀 후원 블록 생성 실패:', error);
      res.status(500).json({
        success: false,
        error: '검증자 풀 후원 실패',
        details: error.message
      });
    }
  } catch (error) {
    console.error('검증자 풀 후원 실패:', error);
    res.status(500).json({
      success: false,
      error: '검증자 풀 후원 실패',
      details: error.message 
    });
  }
});

// DAO 금고 후원
app.post('/api/dao/treasury/sponsor', async (req, res) => {
  try {
    const { sponsorDID, daoId, amount } = req.body;
    
    if (!sponsorDID || !daoId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: '후원자 DID, DAO ID, 유효한 금액이 필요합니다'
      });
    }
    
    // DAO 존재 여부 확인
    const dao = protocol.getDAO(daoId);
    if (!dao || !dao.dao) {
      return res.status(404).json({
        success: false,
        error: '존재하지 않는 DAO입니다'
      });
    }
    
    // 수수료 계산 (고정 0.001B)
    const fee = 0.001;
    const totalAmount = amount + fee; // 사용자가 지불하는 총액
    const feeToValidator = fee * 1.0; // 수수료의 100%는 검증자 풀로 (0.001B)
    const feeToDAO = fee * 0.0; // 수수료의 0%는 DAO 금고로 (0B) - 소속 DAO들에 분배
    
    // B-토큰 잔액 확인
    const currentBalance = protocol.getBlockchain().getBalance(sponsorDID, 'B-Token');
    if (currentBalance < totalAmount) {
      return res.status(400).json({
        success: false,
        error: `B-토큰 잔액이 부족합니다 (필요: ${totalAmount}B, 보유: ${currentBalance}B)`
      });
    }
    
    // DAO 금고 주소는 검증자 풀 주소와 동일한 시스템 주소 사용
    // (실제 DAO별 구분은 data 필드의 targetDaoId로 처리)
    const daoTreasurySystemAddress = 'did:baekya:system0000000000000000000000000000000002';
    
    try {
      const Transaction = require('./src/blockchain/Transaction');
      
      // DAO 금고 후원 트랜잭션 생성
      const treasuryTx = new Transaction(
        sponsorDID,
        daoTreasurySystemAddress,
        totalAmount, // 사용자가 지불하는 총액
        'B-Token',
        { 
          type: 'dao_treasury_sponsor',
          targetDaoId: daoId,
          targetDaoName: dao.dao.name,
          actualSponsorAmount: amount, // 실제 후원금
          validatorFee: feeToValidator, // 검증자 풀로 가는 수수료 (0.0006B)
          daoFee: feeToDAO // DAO들에게 분배될 수수료 (0.0004B)
        }
      );
      treasuryTx.sign('test-key');
      
      // 트랜잭션 디버깅 정보
      console.log('🏛️ DAO 금고 후원 트랜잭션:');
      console.log(`  발신자: ${sponsorDID.substring(0, 16)}...`);
      console.log(`  대상 DAO: ${dao.dao.name} (${daoId})`);
      console.log(`  트랜잭션 금액: ${totalAmount}B`);
      console.log(`  실제 후원금: ${amount}B`);
      console.log(`  수수료 분배:`);
      console.log(`    - 검증자 풀(100%): ${feeToValidator}B`);
      console.log(`    - DAO 금고(0%): ${feeToDAO}B`);
      
      // 블록체인에 트랜잭션 추가
      const addResult = protocol.getBlockchain().addTransaction(treasuryTx);
      if (!addResult.success) {
        throw new Error(addResult.error || '트랜잭션 추가 실패');
      }
      
      // 트랜잭션은 추가되었고 검증자가 블록을 생성할 예정
      console.log(`💎 DAO 금고 후원 트랜잭션 추가됨 (대기 중)`);
      
      // 트랜잭션이 추가되었으므로 응답은 바로 처리
      if (true) {
        
        // DAO 금고와 검증자 풀 업데이트는 BlockchainCore의 updateStorageFromBlock에서 처리됨
        // 여기서는 직접 업데이트하지 않음
        
        // DAO 수수료 분배 처리 - 100% 검증자 풀로 변경됨으로 제거됨
        const daoTreasuries = {};
        
        // 대상 DAO의 현재 잔액 가져오기 (블록체인에서 업데이트된 후)
        // 약간의 지연을 두어 블록체인 업데이트가 완료되도록 함
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const targetDAOData = protocol.components.storage.getDAO(daoId);
        const newTreasury = targetDAOData ? targetDAOData.treasury : 0;
        daoTreasuries[daoId] = newTreasury;
        
        // 검증자 풀 상태 가져오기
        const poolStatus = protocol.components.storage.getValidatorPoolStatus();
        
        console.log(`\n🏛️ DAO 금고 후원 완료:`);
        console.log(`  - ${dao.dao.name} 금고: +${amount}B → 총 ${newTreasury}B`);
        console.log(`  - 검증자 풀: +${feeToValidator}B → 총 ${poolStatus.totalStake}B`);
        
        // 모든 연결된 클라이언트에 브로드캐스트
        broadcastDAOTreasuryUpdate(daoTreasuries);
        broadcastPoolUpdate({
          balance: poolStatus.totalStake,
          contributions: poolStatus.contributions
        });
        
        // 후원자에게 업데이트된 지갑 정보 전송
        const updatedWallet = await protocol.getUserWallet(sponsorDID);
        broadcastStateUpdate(sponsorDID, {
          wallet: updatedWallet,
          daoTreasuries: daoTreasuries
        });
        
        res.json({
          success: true,
          message: `${dao.dao.name} 금고에 ${amount}B 후원 트랜잭션이 추가되었습니다 (수수료 ${fee}B 별도)`,
          transactionId: treasuryTx.hash,
          status: 'pending',
          daoTreasury: {
            daoId: daoId,
            daoName: dao.dao.name,
            newBalance: newTreasury,
            contribution: amount
          },
          feeDistribution: {
            validatorPool: feeToValidator,
            daoFee: feeToDAO,
            perDAO: 0
          }
        });
      } else {
        throw new Error(block?.error || '블록 생성 실패');
      }
    } catch (error) {
      console.error('DAO 금고 후원 블록 생성 실패:', error);
      res.status(500).json({
        success: false,
        error: 'DAO 금고 후원 실패',
        details: error.message
      });
    }
  } catch (error) {
    console.error('DAO 금고 후원 실패:', error);
    res.status(500).json({
      success: false,
      error: 'DAO 금고 후원 실패',
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

// 통신주소 업데이트
app.post('/api/update-communication-address', async (req, res) => {
  try {
    const { didHash, newAddress } = req.body;
    
    if (!didHash || !newAddress) {
      return res.status(400).json({
        success: false,
        error: 'DID와 새로운 통신주소가 필요합니다'
      });
    }
    
    const authSystem = protocol.components.authSystem;
    const result = authSystem.updateCommunicationAddress(didHash, newAddress);
    
    if (result.success) {
      console.log(`📱 통신주소 업데이트 성공: ${didHash} → ${newAddress}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error('통신주소 업데이트 실패:', error);
    res.status(500).json({
      success: false,
      error: '통신주소 업데이트 실패',
      details: error.message
    });
  }
});

// 사용자 기여 내역 조회
app.get('/api/contributions/:did', async (req, res) => {
  try {
    const { did } = req.params;
    const { daoId } = req.query;
    
    if (!did) {
      return res.status(400).json({
        success: false,
        error: 'DID가 필요합니다'
      });
    }
    
    const contributions = protocol.components.storage.getUserContributions(did, daoId);
    
    res.json({
      success: true,
      contributions: contributions,
      totalCount: contributions.length
    });
  } catch (error) {
    console.error('기여 내역 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '기여 내역 조회 실패',
      details: error.message 
    });
  }
});

// DAO 기여 통계 조회
app.get('/api/dao/:daoId/contribution-stats', async (req, res) => {
  try {
    const { daoId } = req.params;
    
    const stats = protocol.components.storage.getDAOContributionStats(daoId);
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('DAO 기여 통계 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: 'DAO 기여 통계 조회 실패',
      details: error.message 
    });
  }
});

// P2P 연락처 검색 (통신주소 또는 아이디로 DID 찾기)
app.get('/api/p2p/find-contact/:searchTerm', async (req, res) => {
  try {
    const { searchTerm } = req.params;
    
    console.log(`🔍 P2P 검색 요청: "${searchTerm}"`);
    
    const authSystem = protocol.components.authSystem; // SimpleAuth 사용
    let result = null;
    let searchType = '';
    
    // 1. 먼저 아이디로 검색 시도
    const usernameResult = authSystem.getDIDByUsername(searchTerm);
    if (usernameResult.success) {
      // 아이디로 찾은 경우, 해당 DID의 통신주소를 가져오기
      const didInfo = authSystem.getDIDInfo(usernameResult.didHash);
      if (didInfo.success) {
        result = {
          success: true,
          communicationAddress: didInfo.didData.communicationAddress
        };
        searchType = 'username';
        console.log(`✅ 아이디로 사용자 찾음: ${searchTerm} → ${didInfo.didData.communicationAddress}`);
      }
    }
    
    // 2. 아이디로 찾지 못했으면 통신주소로 검색
    if (!result) {
      let commAddress = searchTerm;
      
      // 숫자로만 이루어져 있고 11자리면 통신주소로 인식하여 하이픈 추가
      if (/^\d{11}$/.test(searchTerm)) {
        commAddress = `${searchTerm.slice(0, 3)}-${searchTerm.slice(3, 7)}-${searchTerm.slice(7)}`;
        console.log(`📱 하이픈 없는 통신주소 감지: ${searchTerm} → ${commAddress}`);
      }
      
      const commResult = authSystem.getDIDByCommAddress(commAddress);
      if (commResult.success) {
        result = commResult;
        searchType = 'communicationAddress';
        console.log(`✅ 통신주소로 사용자 찾음: ${commAddress}`);
      }
    }
    
    if (result && result.success) {
      // DID 정보를 가져와서 사용자 이름과 아이디 포함
      let userInfo = null;
      if (searchType === 'username') {
        const didInfo = authSystem.getDIDInfo(usernameResult.didHash);
        userInfo = didInfo.success ? didInfo.didData : null;
      } else {
        const didHash = authSystem.communicationRegistry.get(result.communicationAddress);
        if (didHash) {
          const didInfo = authSystem.getDIDInfo(didHash);
          userInfo = didInfo.success ? didInfo.didData : null;
        }
      }
      
      // 연락처 정보 반환 (개인정보는 제외하되 기본 정보는 포함)
      res.json({
        success: true,
        found: true,
        communicationAddress: result.communicationAddress,
        username: userInfo ? userInfo.username : null,
        name: userInfo ? userInfo.name : null,
        searchType: searchType, // 검색 방식 정보 추가
        isActive: true // 실제로는 온라인 상태 체크 필요
      });
    } else {
      console.log(`❌ 사용자를 찾지 못함: ${searchTerm}`);
      res.json({
        success: true,
        found: false,
        message: '해당 아이디 또는 통신주소의 사용자를 찾을 수 없습니다'
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

// GitHub 웹훅 엔드포인트 
app.post('/api/webhook/github/:integrationId', async (req, res) => {
  try {
    const { integrationId } = req.params;
    const payload = req.body;
    
    console.log(`🔔 GitHub 웹훅 수신: ${integrationId}, 이벤트: ${payload.action}`);
    
    if (!githubIntegration) {
      return res.status(503).json({
        success: false,
        error: 'GitHub 통합 시스템이 초기화되지 않았습니다'
      });
    }
    
    // 웹훅 이벤트 처리
    const result = await githubIntegration.handleWebhookEvent(integrationId, payload);
    
    if (result.success) {
      console.log(`✅ GitHub 웹훅 처리 완료: ${result.message}`);
      
      // 기여 내역이 있으면 저장소에 기록
      if (result.contribution) {
        const contrib = result.contribution;
        protocol.components.storage.saveContribution(contrib.userDID, 'dev-dao', {
          id: contrib.id,
          type: contrib.type,
          title: contrib.title,
          dcaId: contrib.type === 'pull_request' ? 'pull-request' : 
                 contrib.type === 'pull_request_review' ? 'pull-request-review' : 
                 'issue-report',
          evidence: contrib.url,
          description: contrib.title,
          bValue: contrib.bValue,
          verified: true,
          verifiedAt: contrib.verifiedAt,
          metadata: contrib.githubData
        });
        
        // 개발DAO 기여자 WebSocket 업데이트
        const updatedWallet = await protocol.getUserWallet(contrib.userDID);
        broadcastStateUpdate(contrib.userDID, {
          wallet: updatedWallet,
          newContribution: {
            dao: 'dev-dao',
            type: contrib.type,
            title: contrib.title,
            bTokens: contrib.bValue,
            description: contrib.title,
            date: new Date().toISOString().split('T')[0]
          }
        });
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('GitHub 웹훅 처리 실패:', error);
    res.status(500).json({
      success: false,
      error: 'GitHub 웹훅 처리 실패',
      details: error.message
    });
  }
});

// GitHub 통합 설정
app.post('/api/github/setup', async (req, res) => {
  try {
    const { userDID, repoOwner, repoName, accessToken } = req.body;
    
    if (!userDID || !repoOwner || !repoName) {
      return res.status(400).json({
        success: false,
        error: 'userDID, repoOwner, repoName이 필요합니다'
      });
    }
    
    if (!githubIntegration) {
      return res.status(503).json({
        success: false,
        error: 'GitHub 통합 시스템이 초기화되지 않았습니다'
      });
    }
    
    const result = githubIntegration.setupUserIntegration(userDID, repoOwner, repoName, accessToken);
    
    console.log(`🔗 GitHub 통합 설정: ${userDID} -> ${repoOwner}/${repoName}`);
    
    res.json(result);
  } catch (error) {
    console.error('GitHub 통합 설정 실패:', error);
    res.status(500).json({
      success: false,
      error: 'GitHub 통합 설정 실패',
      details: error.message
    });
  }
});

// 개발DAO DCA 상태 조회
app.get('/api/dev-dao/contributions/:userDID', async (req, res) => {
  try {
    const { userDID } = req.params;
    
    if (!githubIntegration) {
      return res.status(503).json({
        success: false,
        error: 'GitHub 통합 시스템이 초기화되지 않았습니다'
      });
    }
    
    const contributions = githubIntegration.getUserContributions(userDID);
    const integrationStatus = githubIntegration.getIntegrationStatus(userDID);
    
    res.json({
      success: true,
      contributions: contributions,
      integrationStatus: integrationStatus
    });
  } catch (error) {
    console.error('개발DAO 기여 내역 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '개발DAO 기여 내역 조회 실패',
      details: error.message
    });
  }
});

// 커뮤니티DAO DCA 상태 조회
app.get('/api/community-dao/contributions/:userDID', async (req, res) => {
  try {
    const { userDID } = req.params;
    
    if (!communityIntegration) {
      return res.status(503).json({
        success: false,
        error: '커뮤니티 통합 시스템이 초기화되지 않았습니다'
      });
    }
    
    const contributions = communityIntegration.getUserContributions(userDID);
    
    res.json({
      success: true,
      contributions: contributions
    });
  } catch (error) {
    console.error('커뮤니티DAO 기여 내역 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '커뮤니티DAO 기여 내역 조회 실패',
      details: error.message
    });
  }
});

// 초대 링크 생성
app.post('/api/invite/create', async (req, res) => {
  try {
    const { inviterDID } = req.body;
    
    if (!inviterDID) {
      return res.status(400).json({
        success: false,
        error: 'inviterDID가 필요합니다'
      });
    }
    
    if (!automationSystem) {
      return res.status(503).json({
        success: false,
        error: '자동화 시스템이 초기화되지 않았습니다'
      });
    }
    
    const result = automationSystem.createInviteLink(inviterDID);
    
    console.log(`🔗 초대 링크 생성: ${inviterDID} -> ${result.inviteLink}`);
    
    res.json(result);
  } catch (error) {
    console.error('초대 링크 생성 실패:', error);
    res.status(500).json({
      success: false,
      error: '초대 링크 생성 실패',
      details: error.message
    });
  }
});

// 자동화 시스템 상태 조회
app.get('/api/automation/status', async (req, res) => {
  try {
    if (!automationSystem) {
      return res.status(503).json({
        success: false,
        error: '자동화 시스템이 초기화되지 않았습니다'
      });
    }
    
    const status = automationSystem.getAutomationStatus();
    
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('자동화 시스템 상태 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '자동화 시스템 상태 조회 실패',
      details: error.message
    });
  }
});

// 자동검증 시스템 통계 조회
app.get('/api/automation/stats', async (req, res) => {
  try {
    let stats = {
      github: { totalContributions: 0, totalBTokensIssued: 0, contributionsByType: {} },
      community: { totalContributions: 0, totalBTokensIssued: 0, contributionsByType: {} },
      automation: { totalInvites: 0, successfulInvites: 0 }
    };
    
    if (githubIntegration) {
      stats.github = githubIntegration.getStatistics();
    }
    
    if (communityIntegration) {
      stats.community = communityIntegration.getStatistics();
    }
    
    if (automationSystem) {
      const automationStatus = automationSystem.getAutomationStatus();
      stats.automation = {
        totalInvites: automationStatus.totalInvites,
        activeInvites: automationStatus.activeInvites
      };
    }
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('자동검증 시스템 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '자동검증 시스템 통계 조회 실패',
      details: error.message
    });
  }
});

// 디버그용 - 등록된 사용자 목록 조회
app.get('/api/debug/users', (req, res) => {
  try {
    const authSystem = protocol.components.authSystem;
    const users = authSystem.getAllUsers();
    
    console.log(`📋 등록된 사용자 수: ${users.length}`);
    users.forEach(user => {
      console.log(`  - ${user.username} (${user.communicationAddress})`);
    });
    
    res.json({
      success: true,
      count: users.length,
      users: users
    });
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: '사용자 목록 조회 실패',
      details: error.message
    });
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
    
    // 서버 시작 - 모든 네트워크 인터페이스에서 접속 가능하도록 0.0.0.0으로 바인딩
    server.listen(port, '0.0.0.0', () => {
      console.log(`\n🌅 백야 프로토콜 웹 DApp이 실행 중입니다!`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🌐 PC에서 http://localhost:${port} 로 접속하세요`);
      console.log(`📱 폰에서 http://[PC의 IP주소]:${port} 로 접속하세요`);
      console.log(`💡 PC의 IP 주소 확인: Windows - ipconfig | Linux/Mac - ifconfig`);
      console.log(`🔗 API: http://localhost:${port}/api/status`);
      console.log(`👤 사용자 등록: http://localhost:${port}/api/register`);
      console.log(`🔐 사용자 로그인: http://localhost:${port}/api/login`);
      console.log(`📊 대시보드: http://localhost:${port}/api/dashboard/[DID]`);
      console.log(`💰 지갑: http://localhost:${port}/api/wallet/[DID]`);
      console.log(`🏛️ DAO: http://localhost:${port}/api/daos`);
      console.log(`🔗 P2P 전화: http://localhost:${port}/api/p2p/call/*`);
      console.log(`🔐 통합 인증: http://localhost:${port}/api/auth/verify`);
      console.log(`🔌 WebSocket: ws://localhost:${port}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    });
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// 터미널 인터페이스 설정
function setupTerminalInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⛏️  검증자 모드 시작하기');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. 로그인');
  console.log('2. 가입');
  console.log('3. 종료');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  rl.question('선택하세요 (1/2/3): ', async (choice) => {
    switch (choice) {
      case '1':
        await handleValidatorLogin(rl);
        break;
      case '2':
        await handleValidatorSignup(rl);
        break;
      case '3':
        console.log('서버를 종료합니다...');
        process.exit(0);
        break;
      default:
        console.log('잘못된 선택입니다. 다시 시도하세요.');
        rl.close();
        setupTerminalInterface();
    }
  });
}

// 검증자 로그인 처리
async function handleValidatorLogin(rl) {
  rl.question('아이디: ', (username) => {
    rl.question('비밀번호: ', async (password) => {
      try {
        const result = await protocol.loginUser(username, password, `validator_${Date.now()}`);
        
        if (result.success) {
          validatorDID = result.didHash;
          validatorUsername = result.username;
          
          console.log('\n✅ 로그인 성공!');
          console.log(`👤 사용자: ${result.username}`);
          console.log(`💰 현재 잔액: ${result.tokenBalances.bToken}B`);
          console.log('\n⛏️  검증자 모드 시작 - 30초마다 블록 생성');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          
          rl.close();
          startBlockGeneration();
        } else {
          console.log(`\n❌ 로그인 실패: ${result.error}`);
          rl.close();
          setupTerminalInterface();
        }
      } catch (error) {
        console.error('\n❌ 로그인 처리 중 오류:', error.message);
        rl.close();
        setupTerminalInterface();
      }
    });
  });
}

// 검증자 가입 처리
async function handleValidatorSignup(rl) {
  console.log('\n새 검증자 계정 생성');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  rl.question('아이디: ', (username) => {
    rl.question('비밀번호: ', (password) => {
      rl.question('이름: ', async (name) => {
        try {
          // 통신주소 자동 생성
          const communicationAddress = `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`;
          
          const userData = {
            username,
            password,
            name,
            communicationAddress,
            deviceId: `validator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };
          
          const result = await protocol.registerUser(userData);
          
          if (result.success) {
            validatorDID = result.didHash;
            validatorUsername = result.username;
            
            console.log('\n✅ 가입 성공!');
            console.log(`👤 사용자: ${result.username}`);
            console.log(`📱 통신주소: ${result.communicationAddress} (자동 생성)`);
            console.log(`🆔 DID: ${result.didHash}`);
            console.log('\n⛏️  검증자 모드 시작 - 30초마다 블록 생성');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            rl.close();
            startBlockGeneration();
          } else {
            console.log(`\n❌ 가입 실패: ${result.error}`);
            rl.close();
            setupTerminalInterface();
          }
        } catch (error) {
          console.error('\n❌ 가입 처리 중 오류:', error.message);
          rl.close();
          setupTerminalInterface();
        }
      });
    });
  });
}

// 블록 생성 시작
function startBlockGeneration() {
  // 검증자로 등록
  const blockchain = protocol.getBlockchain();
  blockchain.registerValidator(validatorDID, 100);
  
  console.log('🔗 검증자로 등록되었습니다.');
  console.log('⏱️  30초마다 블록을 생성합니다...\n');
  
  // 즉시 첫 블록 생성
  generateBlock();
  
  // 30초마다 블록 생성
  blockGenerationTimer = setInterval(() => {
    generateBlock();
  }, 30000);
}

// 블록 생성 및 DCA 처리
async function generateBlock() {
  try {
    const blockchain = protocol.getBlockchain();
    const pendingTransactions = blockchain.pendingTransactions || [];
    
    // 대기 중인 트랜잭션이 있거나 30초가 지났으면 블록 생성
    const shouldCreateBlock = pendingTransactions.length > 0 || true; // 항상 생성 (빈 블록도 허용)
    
    if (!shouldCreateBlock) {
      console.log('⏳ 대기 중인 트랜잭션이 없어 블록 생성을 건너뜁니다.');
      return;
    }
    
    // 블록 생성 (대기 중인 모든 트랜잭션 포함)
    const block = blockchain.mineBlock(pendingTransactions, validatorDID);
    
    if (block && !block.error) {
      blocksGenerated++;
      
      // 검증자 풀 인센티브 지급
      let poolIncentive = 0;
      if (protocol.components && protocol.components.storage) {
        try {
          // 검증자 풀 잔액 조회
          const poolStatus = protocol.components.storage.getValidatorPoolStatus();
          const poolBalance = poolStatus.totalStake || 0;
          
          // 최대 0.25B 또는 풀 잔액 중 작은 값
          const maxIncentive = 0.25;
          poolIncentive = Math.min(maxIncentive, poolBalance);
          
          if (poolIncentive > 0) {
            // 검증자 풀에서 차감
            const actualWithdrawn = protocol.components.storage.withdrawFromValidatorPool(poolIncentive);
            
            if (actualWithdrawn > 0) {
              // 검증자에게 지급
              const currentValidatorBalance = blockchain.getBalance(validatorDID, 'B-Token');
              blockchain.setBalance(validatorDID, currentValidatorBalance + actualWithdrawn, 'B-Token');
              poolIncentive = actualWithdrawn;
              
              console.log(`🎁 검증자 풀 인센티브: ${actualWithdrawn}B (풀 잔액: ${poolBalance}B → ${poolBalance - actualWithdrawn}B)`);
            }
          }
        } catch (error) {
          console.warn('⚠️ 검증자 풀 인센티브 처리 실패:', error.message);
        }
      }
      
      // DCA 자동 인정 - 블록 생성 기여 (보상은 BlockchainCore에서 자동 처리됨)
      // 기여 내역은 storage에 별도 저장 (기존 함수 사용)
      if (protocol.components && protocol.components.storage) {
        try {
          protocol.components.storage.saveContribution(validatorDID, 'validator-dao', {
            id: `block_generation_${block.index}_${Date.now()}`,
            type: 'network_validation',
            title: '블록생성',
            dcaId: 'block-generation',
            evidence: `Block ${block.index} validated`,
            description: `블록 #${block.index} 생성 및 검증`,
            bValue: 5, // BlockchainCore에서 자동 지급됨
            verified: true,
            verifiedAt: Date.now(),
            metadata: {
              blockIndex: block.index,
              blockHash: block.hash,
              transactionCount: pendingTransactions.length,
              completedAt: Date.now()
            }
          });
        } catch (error) {
          console.warn('⚠️ 기여 내역 저장 실패:', error.message);
        }
      }
      
      // 총 보상 계산
      const dcaReward = 5; // DCA 자동검증 보상
      const totalReward = dcaReward + poolIncentive;
      
      // 로그 출력
      const now = new Date();
      console.log(`\n⛏️  [검증자] 블록 #${block.index} 생성 완료 [${now.toLocaleTimeString()}]`);
      console.log(`👤 검증자: ${validatorUsername} (${validatorDID.substring(0, 8)}...)`);
      console.log(`📦 트랜잭션: ${pendingTransactions.length}개 처리`);
      console.log(`💎 보상: +${totalReward}B (DCA: ${dcaReward}B + 풀 인센티브: ${poolIncentive}B)`);
      console.log(`📊 총 생성 블록: ${blocksGenerated}개`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // WebSocket으로 상태 업데이트 브로드캐스트
      const wallet = await protocol.getUserWallet(validatorDID);
      broadcastStateUpdate(validatorDID, {
        wallet: wallet,
        newBlock: {
          height: block.index,
          reward: totalReward,
          dcaReward: dcaReward,
          poolIncentive: poolIncentive,
          validator: validatorDID,
          validatorName: validatorUsername,
          transactionCount: pendingTransactions.length
        }
      });
      
      // 검증자 풀 상태 업데이트 브로드캐스트 (인센티브 지급으로 풀 잔액 변경)
      if (poolIncentive > 0) {
        const updatedPoolStatus = protocol.components.storage.getValidatorPoolStatus();
        broadcastPoolUpdate(updatedPoolStatus);
      }
      
      // 모든 클라이언트에 새 블록 알림
      const blockNotification = {
        type: 'new_block',
        block: {
          height: block.index,
          validator: validatorUsername,
          transactionCount: pendingTransactions.length,
          timestamp: block.timestamp,
          reward: totalReward,
          dcaReward: dcaReward,
          poolIncentive: poolIncentive
        }
      };
      
      clients.forEach((connections) => {
        connections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(blockNotification));
          }
        });
      });
    } else {
      console.error('❌ 블록 생성 실패:', block?.error || '알 수 없는 오류');
    }
  } catch (error) {
    console.error('❌ 블록 생성 중 오류:', error.message);
  }
}

// 서버 시작
startServer().then(() => {
  // 서버가 시작된 후 터미널 인터페이스 시작
  setTimeout(() => {
    setupTerminalInterface();
  }, 1000);
});

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n\n서버를 종료합니다...');
  if (blockGenerationTimer) {
    clearInterval(blockGenerationTimer);
  }
  process.exit(0);
});

module.exports = app; 