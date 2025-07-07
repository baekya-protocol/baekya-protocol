// Mobile API Server for BaekYa Protocol
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const port = 3000;

// 알려진 메인넷 노드들 (실제로는 Discovery 서비스에서 가져와야 함)
let knownNodes = [
  'http://localhost:9080', // 메인넷 API 포트 (8080 + 1000)
  'http://localhost:4001', // 테스트넷 API 포트 (3001 + 1000) 
  'http://localhost:4000', // 로컬 개발 API 포트 (3000 + 1000)
  // 실제 메인넷 노드들이 여기에 추가됨
];

// 현재 연결된 노드
let activeNode = null;

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

// 활성 노드 찾기
async function findActiveNode() {
  for (const nodeUrl of knownNodes) {
    try {
      const response = await axios.get(`${nodeUrl}/api/status`, { timeout: 5000 });
      if (response.status === 200) {
        activeNode = nodeUrl;
        console.log(`✅ 활성 노드 연결: ${nodeUrl}`);
        return nodeUrl;
      }
    } catch (error) {
      // 노드가 응답하지 않음
    }
  }
  
  activeNode = null;
  console.log('❌ 사용 가능한 노드를 찾을 수 없습니다');
  return null;
}

// 노드 상태 확인
app.get('/api/node-status', async (req, res) => {
  const node = await findActiveNode();
  res.json({
    connected: !!node,
    activeNode: node,
    knownNodes: knownNodes
  });
});

// 수동 노드 추가
app.post('/api/add-node', (req, res) => {
  const { nodeUrl } = req.body;
  if (nodeUrl && !knownNodes.includes(nodeUrl)) {
    knownNodes.push(nodeUrl);
    console.log(`🔗 새 노드 추가: ${nodeUrl}`);
  }
  res.json({ success: true, knownNodes });
});

// API 프록시 함수
async function proxyToNode(req, res, apiPath) {
  try {
    console.log(`📡 API 요청: ${req.method} ${apiPath}`);
    
    if (!activeNode) {
      console.log('🔍 활성 노드가 없습니다. 노드를 찾는 중...');
      const node = await findActiveNode();
      if (!node) {
        console.log('❌ 사용 가능한 메인넷 노드를 찾을 수 없습니다');
        return res.status(503).json({
          success: false,
          error: '사용 가능한 메인넷 노드가 없습니다',
          suggestion: '로컬에서 메인넷 노드를 실행하거나 다른 노드 주소를 추가하세요',
          knownNodes: knownNodes,
          checkedNodes: knownNodes.map(url => ({ url, status: 'not_responding' }))
        });
      }
    }

    const targetUrl = `${activeNode}${apiPath}`;
    const method = req.method.toLowerCase();
    
    console.log(`🔗 프록시 요청: ${method.toUpperCase()} ${targetUrl}`);
    console.log(`📝 요청 데이터:`, req.body);
    
    let response;
    const config = {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BaekyaProtocol-MobileClient/1.0'
      }
    };
    
    if (method === 'get') {
      response = await axios.get(targetUrl, {
        params: req.query,
        ...config
      });
    } else if (method === 'post') {
      response = await axios.post(targetUrl, req.body, config);
    } else {
      response = await axios[method](targetUrl, req.body, config);
    }
    
    console.log(`✅ 프록시 응답 성공: ${response.status}`);
    console.log(`📋 응답 데이터:`, response.data);
    
    res.json(response.data);
  } catch (error) {
    console.error(`❌ 프록시 오류 (${apiPath}):`, error.message);
    console.error('📊 에러 세부정보:', {
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data
    });
    
    // 연결 실패 시 다른 노드 시도
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.log('🔄 연결 실패, 다른 노드 시도 중...');
      activeNode = null;
      const newNode = await findActiveNode();
      if (newNode && newNode !== activeNode) {
        console.log(`🔀 새 노드로 재시도: ${newNode}`);
        return proxyToNode(req, res, apiPath); // 재시도
      }
    }
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: '메인넷 노드 통신 실패',
      details: error.message,
      suggestion: '메인넷 노드가 실행 중인지 확인하세요',
      activeNode: activeNode,
      knownNodes: knownNodes,
      errorInfo: {
        code: error.code,
        status: error.response?.status,
        message: error.message
      }
    });
  }
}

// 모든 API 요청을 메인넷 노드로 프록시
app.all('/api/*', (req, res) => {
  const apiPath = req.originalUrl;
  proxyToNode(req, res, apiPath);
});

// 서버 시작
app.listen(port, '0.0.0.0', () => {
  console.log(`
🌅 백야 프로토콜 경량 클라이언트 서버 시작!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 폰에서 http://[PC의 IP주소]:${port} 로 접속하세요
🖥️  PC에서 http://localhost:${port} 로 접속하세요
💡 PC의 IP 주소 확인: Windows - ipconfig | Linux/Mac - ifconfig

🔗 메인넷 노드 연결 방법:
   1. 로컬: start-mainnet.ps1 실행 (자동 연결)
   2. 원격: /api/add-node로 노드 주소 추가
   
📊 노드 상태: http://localhost:${port}/api/node-status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  // 시작 시 활성 노드 찾기
  findActiveNode();
});

module.exports = app;
