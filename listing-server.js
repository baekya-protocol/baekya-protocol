const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 4000;

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 데이터 저장 파일
const DATA_FILE = path.join(__dirname, 'relay-listing-data.json');

// 메모리 데이터 구조
let relayServers = new Map(); // url -> { url, location, nodeInfo, lastUpdate, registeredAt }

// 데이터 로드
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    relayServers = new Map(Object.entries(parsed.relayServers || {}));
    console.log(`📊 ${relayServers.size}개 중계서버 데이터 로드 완료`);
  } catch (error) {
    console.log('📝 새 데이터 파일 생성');
    await saveData();
  }
}

// 데이터 저장
async function saveData() {
  try {
    const data = {
      relayServers: Object.fromEntries(relayServers),
      lastUpdated: Date.now()
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ 데이터 저장 실패:', error.message);
  }
}

// 중계서버 등록 API
app.post('/api/register-relay', async (req, res) => {
  try {
    const { url, location, nodeInfo, timestamp } = req.body;
    
    if (!url || !location) {
      return res.status(400).json({
        success: false,
        error: '중계서버 URL과 위치 정보가 필요합니다'
      });
    }
    
    // 중계서버 등록/업데이트
    const existingRelay = relayServers.get(url);
    const relayData = {
      url: url,
      location: location,
      nodeInfo: nodeInfo || {},
      lastUpdate: Date.now(),
      registeredAt: existingRelay ? existingRelay.registeredAt : Date.now()
    };
    
    relayServers.set(url, relayData);
    await saveData();
    
    console.log(`📡 중계서버 등록: ${url} (위치: ${location})`);
    
    // 모든 중계서버에 리스트 업데이트 전파
    await propagateListToAllRelays();
    
    res.json({
      success: true,
      message: '중계서버가 등록되었습니다',
      totalRelays: relayServers.size,
      relayData: relayData
    });
    
  } catch (error) {
    console.error('❌ 중계서버 등록 실패:', error.message);
    res.status(500).json({
      success: false,
      error: '중계서버 등록 중 오류가 발생했습니다'
    });
  }
});

// 중계서버 리스트 조회 API
app.get('/api/relay-list', (req, res) => {
  const activeThreshold = 600000; // 10분
  const relayList = Array.from(relayServers.values()).map(relay => ({
    url: relay.url,
    location: relay.location,
    nodeInfo: relay.nodeInfo,
    lastUpdate: relay.lastUpdate,
    registeredAt: relay.registeredAt,
    status: Date.now() - relay.lastUpdate < activeThreshold ? 'online' : 'offline'
  }));
  
  res.json({
    success: true,
    relays: relayList,
    totalCount: relayList.length,
    onlineCount: relayList.filter(r => r.status === 'online').length,
    lastUpdated: Date.now()
  });
});

// 중계서버 상태 업데이트 API
app.post('/api/update-relay', async (req, res) => {
  try {
    const { url, nodeInfo } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: '중계서버 URL이 필요합니다'
      });
    }
    
    const existingRelay = relayServers.get(url);
    if (!existingRelay) {
      return res.status(404).json({
        success: false,
        error: '등록되지 않은 중계서버입니다'
      });
    }
    
    // 정보 업데이트
    existingRelay.nodeInfo = { ...existingRelay.nodeInfo, ...nodeInfo };
    existingRelay.lastUpdate = Date.now();
    
    await saveData();
    
    res.json({
      success: true,
      message: '중계서버 정보가 업데이트되었습니다'
    });
    
  } catch (error) {
    console.error('❌ 중계서버 업데이트 실패:', error.message);
    res.status(500).json({
      success: false,
      error: '중계서버 업데이트 중 오류가 발생했습니다'
    });
  }
});

// 중계서버 제거 API
app.delete('/api/remove-relay', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: '중계서버 URL이 필요합니다'
      });
    }
    
    if (!relayServers.has(url)) {
      return res.status(404).json({
        success: false,
        error: '등록되지 않은 중계서버입니다'
      });
    }
    
    relayServers.delete(url);
    await saveData();
    
    console.log(`🗑️ 중계서버 제거: ${url}`);
    
    // 모든 중계서버에 리스트 업데이트 전파
    await propagateListToAllRelays();
    
    res.json({
      success: true,
      message: '중계서버가 제거되었습니다',
      totalRelays: relayServers.size
    });
    
  } catch (error) {
    console.error('❌ 중계서버 제거 실패:', error.message);
    res.status(500).json({
      success: false,
      error: '중계서버 제거 중 오류가 발생했습니다'
    });
  }
});

// 모든 중계서버에 리스트 업데이트 전파
async function propagateListToAllRelays() {
  const activeThreshold = 600000; // 10분
  const activeRelays = Array.from(relayServers.values()).filter(relay => 
    Date.now() - relay.lastUpdate < activeThreshold
  );
  
  if (activeRelays.length === 0) {
    console.log('📡 활성 중계서버가 없습니다 - 리스트 전파 생략');
    return;
  }
  
  const listData = {
    type: 'relay_list_update',
    relays: activeRelays,
    timestamp: Date.now(),
    source: 'listing_server'
  };
  
  console.log(`📡 ${activeRelays.length}개 중계서버에 리스트 업데이트 전파 중...`);
  
  const promises = activeRelays.map(async (relay) => {
    try {
      const response = await fetch(`${relay.url}/api/relay-list-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(listData),
        timeout: 5000
      });
      
      if (response.ok) {
        console.log(`✅ 리스트 업데이트 전송 성공: ${relay.url}`);
      } else {
        console.log(`❌ 리스트 업데이트 전송 실패: ${relay.url} (${response.status})`);
      }
    } catch (error) {
      console.log(`❌ 리스트 업데이트 전송 오류: ${relay.url} (${error.message})`);
    }
  });
  
  await Promise.all(promises);
  console.log('📡 리스트 업데이트 전파 완료');
}

// 상태 API
app.get('/api/status', (req, res) => {
  const activeThreshold = 600000; // 10분
  const relayList = Array.from(relayServers.values());
  const onlineCount = relayList.filter(relay => 
    Date.now() - relay.lastUpdate < activeThreshold
  ).length;
  
  res.json({
    success: true,
    status: 'running',
    totalRelays: relayServers.size,
    onlineRelays: onlineCount,
    offlineRelays: relayServers.size - onlineCount,
    uptime: process.uptime(),
    lastUpdated: Date.now()
  });
});

// 헬스체크 API
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});

// 404 핸들링
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: '요청한 리소스를 찾을 수 없습니다' 
  });
});

// 서버 시작
async function startServer() {
  try {
    // 데이터 로드
    await loadData();
    
    // 서버 시작
    app.listen(port, '0.0.0.0', () => {
      console.log(`\n🌟 백야 프로토콜 중계서버 리스팅 서버 시작!`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🌐 API 서버: http://localhost:${port}`);
      console.log(`📡 등록 API: http://localhost:${port}/api/register-relay`);
      console.log(`📋 리스트 API: http://localhost:${port}/api/relay-list`);
      console.log(`📊 상태 API: http://localhost:${port}/api/status`);
      console.log(`❤️ 헬스체크: http://localhost:${port}/health`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      
      console.log(`📊 현재 등록된 중계서버: ${relayServers.size}개`);
    });
    
  } catch (error) {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  }
}

// 정리 작업
process.on('SIGINT', async () => {
  console.log('\n🛑 서버 종료 중...');
  await saveData();
  console.log('✅ 데이터 저장 완료');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 서버 종료 중...');
  await saveData();
  console.log('✅ 데이터 저장 완료');
  process.exit(0);
});

// 서버 시작
startServer();

module.exports = app;
