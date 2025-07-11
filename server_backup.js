// NODE_ENV가 ?�정?��? ?��? 경우 development�??�정
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('?�� NODE_ENV�?development�??�정?�습?�다.');
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const localtunnel = require('localtunnel');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Firebase Admin SDK 추�?
const admin = require('firebase-admin');

// Firebase Admin SDK 초기화(서비스 계정 키 파일 필요)
try {
  // 실제 운영 환경에서는 서비스 계정 키를 안전하게 관리해야 합니다
  const serviceAccount = {
    type: "service_account",
    project_id: "baekya-protocol",
    private_key_id: "df4e535a76ad6525b31db8f1758ffb8af5cea5a2",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQD2Aa3j9Ox0hSKV\nQ6r0sR6EtEtj9bBaick4Y+hm32a9QzQczCuHFypDTyNyVkmFGJqVdxRT7xYm1ric\nk9hkG7ms9bRihuKxzGx6mU+7ukqQBBv9nVNYrn4Vl7nygzjtngLMKjMoZhrqHYD7\nEObp6G/rDZCTqrZsiBRv8sDu8biOUA4bjBkYznEs68aijThEdciaMWj4+QyugEY1\ngU7BZ0pmaLqhoY0L+VwCGSeUnwUIrU1uPJidswFD2+CsGzohbNhSK5UX2jaXycgK\nnwkZqAR3yo9U44+qOaLhjfhtIxoFSzRdtam3SE9934KApi6Zp5EHJne2wj5nJnn3\nwXq2GMxxAgMBAAECggEAGMUPA/ShiVLtaj+Tu0sJMl3v+Frg3KDifpfKqu8ECnr1\niI/DMzkxI3FYtZa8FNdnGzUP+iqI3bTBhlx5jYzgG2rq9H+13Caj5o1AwrttbgZH\n5jec0IFTRyvNiH5PcVd3WyTFnWP4gkmhtsXbJkKl4DIvtDqcXx2thx8Xb4etqEBz\nPRxMkCOy7Ef6Um7zWoUq4q+rBgfxkFFXsftPmf1ZkbLNaLZQCATZ+Sw1Oca0Ekxd\nK4mZUgTcVyTcvLPdxpSXKhahIAtyB9MY9nZjSh/lZeG/nGyeYtMHtncsN4n8p7sD\nnTWGx+OhaiIJkqM0dcUpO+9Urc99C+f/8CEpSyi4MQKBgQD9p2AZqAzkvIrYHq1K\nPBm9OJcYXyuF9yUTNGMwXrsUQ9RqaRLjmwAppN8fbPzFg1W4iPJcRGlTKGIIBQ8p\njey/J41ABKcVnrOwzJN5PdXPUlYWdpvWvq9GUEFV28M7SfzY53w0ZCR8F5qoqFpc\nYX0l7PeqVYufHd2eepaREOqseQKBgQD4SDItzZotwBPcaTFDN+l3Zw0rb9tVarDZ\nUQ4S2gI6V6z0MDojFKA9VSP7D+JYACaiCpdCbORLUyYhfPDK5G6y569xQz6v1exT\nhx8sQF8DlZY+YLXjhPqVxXRLy0wshu0LpETYV9jo/Q7jdZcg7RoYWSyOs1iXzYkl\nqQ+Bv7cxuQKBgQDvyURdvLHDokEXIZjr7njemhqsHXvFfud7ijCiT0tHUwABQCdt\nJuA2ffe3e45RIWDtu/hxJPL0e96AelflDpfZ9QfglwVkuMxhvGNFYCE5hjp/rcyQ\na17Cd6fsBH5BFCaE3gBafrjG3oGEIvKZFkf6jFNsoMYGu3MAGB8yL+3I8QKBgQDy\n+HwatNVIJmuJTGxIMsRH9FJACuQjMBjHYvoZ2r1JaRm5kiSixgGWY+alQEMqCWPF\nOgYSnEvBpypupT1j4K6wZ+kaN0t2eiwfBeGsxYX2FQKGItB9SlqMDUKlFduCy7vY\no7Y33ahJQbS7Rg1SzJW39DSVpc9yJ1MqxsqFGB/oCQKBgBXPTVUkSPbH/MPPXtqW\nT0k90mUCYyNqni6qSiYTpp19wibsDuYxTMFs0AeZ9VCtQP9+AM+JBsaqfcc6TY8e\nwpYN174h36G+8MZkq75Rzuk2/8/7ApOCXXssv0HKj8Ym86KBD27TV4Nm3ZN+a7/d\nq5Ke/mptBDUF7+nh4vqr674Z\n-----END PRIVATE KEY-----\n",
    client_email: "firebase-adminsdk-fbsvc@baekya-protocol.iam.gserviceaccount.com",
    client_id: "112430965355841449474",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40baekya-protocol.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
  };
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://baekya-protocol.firebaseio.com"
  });
  
  console.log('?�� Firebase Admin SDK 초기???�료');
} catch (error) {
  console.log('?�️  Firebase Admin SDK 초기??건너?� (개발 모드)');
}

const WebSocket = require('ws');
const http = require('http');
const readline = require('readline');
const { Server } = require('socket.io');
// Node.js 18+ 버전?�서??fetch가 ?�장?�어 ?�음

// 백야 프로토콜 컴포넌트
const Protocol = require('./src/index.js');
const Transaction = require('./src/blockchain/Transaction');

const app = express();
const port = process.env.PORT || 3000; // Railway ?�경변???�용
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const io = new Server(server);

// 메인 ?�로?�콜 ?�스?�스
let protocol = null;

// ?�동검�??�스?�들
let githubIntegration = null;
let communityIntegration = null;
let automationSystem = null;

// WebSocket ?�결 관�?const clients = new Map(); // DID -> WebSocket connection (?�일 ?�결)
const clientSessions = new Map(); // WebSocket -> { did, sessionId }

// 검증자 관??변??let validatorDID = null;
let validatorUsername = null;
let blockGenerationTimer = null;
let blocksGenerated = 0;

// ?�널�?관??변??let tunnel = null;
let webhookUrl = null;

// 릴레???�버 ?�결 관??변??let relayConnection = null;
let relayReconnectInterval = null;
let nodeId = uuidv4(); // ???�?�드??고유 ID

// 릴레???�버 ?�정 (?�경변???�는 기본�?
const RELAY_SERVER_URL = process.env.RELAY_SERVER_URL || 'wss://baekya-relay-production.up.railway.app';

// 로컬 직접 ?�결 모드 - 중계 ?�버 ?�용 ?�함

// WebSocket ?�결 ?�들??wss.on('connection', (ws) => {
  let userDID = null;
  let sessionId = null;
  
  console.log('?�� ?�로??WebSocket ?�결 ?�도');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('?�� WebSocket 메시지 ?�신:', data.type, data.did ? `DID: ${data.did.substring(0, 16)}...` : '');
      
      switch (data.type) {
        case 'auth':
          // ?�용???�증
          userDID = data.did;
          sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          console.log(`?�� ?�증 ?�청: ${userDID}`);
          
          // 기존 ?�결???�으�?강제 종료 (1기기 1계정 ?�책)
          if (clients.has(userDID)) {
            const existingWs = clients.get(userDID);
            if (existingWs && existingWs.readyState === WebSocket.OPEN) {
              console.log(`?�️ 기존 ?�결 종료: ${userDID}`);
              existingWs.send(JSON.stringify({
                type: 'session_terminated',
                reason: '?�른 기기?�서 로그?�했?�니??'
              }));
              existingWs.close();
              
              // 기존 ?�션 ?�보 ?�리
              if (clientSessions.has(existingWs)) {
                clientSessions.delete(existingWs);
              }
            }
          }
          
          // ???�결 ?�록
          clients.set(userDID, ws);
          clientSessions.set(ws, { did: userDID, sessionId: sessionId });
          
          console.log(`?????�결 ?�록: ${userDID}, ?�션: ${sessionId}`);
          
          // 즉시 최신 ?�태 ?�송
          protocol.getUserWallet(userDID).then(wallet => {
            const poolStatus = protocol.components.storage.getValidatorPoolStatus();
            
            console.log(`?�� ?�결 ??지�??�보 ?�송: ${userDID} -> B:${wallet.balances?.bToken || 0}B`);
            
            const stateUpdate = {
              type: 'state_update',
              wallet: wallet,
              validatorPool: poolStatus,
              sessionId: sessionId
            };
            
            ws.send(JSON.stringify(stateUpdate));
            
            // ?�결 ?�인 메시지
            ws.send(JSON.stringify({
              type: 'connection_confirmed',
              sessionId: sessionId,
              message: '?�시�??�결???�성?�되?�습?�다.'
            }));
            
          }).catch(error => {
            console.error(`??지�??�보 조회 ?�패: ${userDID}`, error);
            ws.send(JSON.stringify({
              type: 'error',
              message: '지�??�보�?불러?�는???�패?�습?�다.'
            }));
          });
          
          break;
          
        case 'request_state':
          // ?�재 ?�태 ?�청 처리
          if (userDID) {
            console.log(`?�� ?�태 ?�청 처리: ${userDID}`);
            
            protocol.getUserWallet(userDID).then(wallet => {
              const poolStatus = protocol.components.storage.getValidatorPoolStatus();
              
              ws.send(JSON.stringify({
                type: 'state_update',
                wallet: wallet,
                validatorPool: poolStatus,
                sessionId: sessionId
              }));
            }).catch(error => {
              console.error(`???�태 ?�청 처리 ?�패: ${userDID}`, error);
            });
          }
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
          
        default:
          console.log(`???????�는 메시지 ?�?? ${data.type}`);
      }
    } catch (error) {
      console.error('??WebSocket 메시지 처리 ?�류:', error);
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`?�� WebSocket ?�결 종료: ${userDID || '?????�음'}, 코드: ${code}, ?�유: ${reason}`);
    
    if (userDID) {
      // ?�라?�언??맵에???�거 (?�일???�결??경우?�만)
      if (clients.get(userDID) === ws) {
        clients.delete(userDID);
        console.log(`?���??�라?�언??맵에???�거: ${userDID}`);
      }
    }
    
    // ?�션 ?�보 ?�리
    if (clientSessions.has(ws)) {
      clientSessions.delete(ws);
    }
  });
  
  ws.on('error', (error) => {
    console.error(`??WebSocket ?�결 ?�류: ${userDID || '?????�음'}`, error);
  });
});

// ?�정 ?�용?�에�??�태 ?�데?�트 브로?�캐?�트
function broadcastStateUpdate(userDID, updateData) {
  console.log(`?�� ?�태 ?�데?�트 브로?�캐?�트: ${userDID} ->`, updateData);
  
  // 로컬 WebSocket ?�라?�언?�에 ?�송
  if (clients.has(userDID)) {
    const ws = clients.get(userDID);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        type: 'state_update',
        timestamp: Date.now(),
        ...updateData
      });
      
      ws.send(message);
      console.log(`??로컬 ?�라?�언?�에 ?�송 ?�공: ${userDID}`);
    } else {
      console.log(`?�️ 로컬 ?�라?�언???�결 ?�태 불량: ${userDID}`);
    }
  } else {
    console.log(`?�️ 로컬 ?�라?�언???�음: ${userDID}`);
  }
  
  // 릴레???�버?�도 ?�송 (Vercel ?�앱??
  if (relayConnection && relayConnection.readyState === WebSocket.OPEN) {
    relayConnection.send(JSON.stringify({
      type: 'state_update',
      userDID: userDID,
      updateData: updateData,
      timestamp: Date.now()
    }));
    console.log(`??릴레???�버???�송 ?�공: ${userDID}`);
  }
}

// ?�체 ?�용?�에�?검증자 ?� ?�데?�트 브로?�캐?�트
function broadcastPoolUpdate(poolStatus) {
  console.log(`?�� 검증자 ?� ?�데?�트 브로?�캐?�트:`, poolStatus);
  
  const message = JSON.stringify({
    type: 'pool_update',
    validatorPool: poolStatus,
    timestamp: Date.now()
  });
  
  let successCount = 0;
  let totalCount = 0;
  
  // 로컬 WebSocket ?�라?�언?�에 ?�송
  clients.forEach((ws, did) => {
    totalCount++;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      successCount++;
    }
  });
  
  console.log(`??로컬 ?�라?�언???�송: ${successCount}/${totalCount}`);
  
  // 릴레???�버?�도 ?�송 (Vercel ?�앱??
  if (relayConnection && relayConnection.readyState === WebSocket.OPEN) {
    relayConnection.send(JSON.stringify({
      type: 'pool_update',
      validatorPool: poolStatus,
      timestamp: Date.now()
    }));
    console.log(`??릴레???�버???�송 ?�공`);
  }
}

// ?�체 ?�용?�에�?DAO 금고 ?�데?�트 브로?�캐?�트
function broadcastDAOTreasuryUpdate(daoTreasuries) {
  console.log(`?�� DAO 금고 ?�데?�트 브로?�캐?�트:`, daoTreasuries);
  
  const message = JSON.stringify({
    type: 'dao_treasury_update',
    daoTreasuries: daoTreasuries,
    timestamp: Date.now()
  });
  
  let successCount = 0;
  let totalCount = 0;
  
  // 로컬 WebSocket ?�라?�언?�에 ?�송
  clients.forEach((ws, did) => {
    totalCount++;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      successCount++;
    }
  });
  
  console.log(`??로컬 ?�라?�언???�송: ${successCount}/${totalCount}`);
  
  // 릴레???�버?�도 ?�송 (Vercel ?�앱??
  if (relayConnection && relayConnection.readyState === WebSocket.OPEN) {
    relayConnection.send(JSON.stringify({
      type: 'dao_treasury_update',
      daoTreasuries: daoTreasuries,
      timestamp: Date.now()
    }));
    console.log(`??릴레???�버???�송 ?�공`);
  }
}

// ?�버 초기???�수
async function initializeServer() {
  try {
    console.log('?? 백야 ?�로?�콜 ?�버 초기??�?..');
    
    const BaekyaProtocol = require('./src/index');
    protocol = new BaekyaProtocol({
      port: port,
      isProduction: process.env.NODE_ENV === 'production',
      isWebTest: true, // ??UI ?�스??모드
      communicationAddress: '010-0000-0000' // ?�스?�용 기본 ?�신주소
    });
  
  const initialized = await protocol.initialize();
  if (!initialized) {
      throw new Error('?�로?�콜 초기???�패');
  }
    
    // ?�동검�??�스??초기??    console.log('?�� ?�동검�??�스??초기??�?..');
    
    // GitHubIntegration 초기??    const GitHubIntegration = require('./src/automation/GitHubIntegration');
    githubIntegration = new GitHubIntegration(
      protocol.components.daoSystem,
      null, // CVCM ?�스?��? ?�거?�었?��?�?null
      protocol.components.storage // DataStorage ?�스?�스 ?�달
    );
    
    // 블록체인 ?�스?�스 ?�정
    githubIntegration.setBlockchain(protocol.getBlockchain());
    
    // CommunityDAOIntegration 초기??    const CommunityDAOIntegration = require('./src/automation/CommunityDAOIntegration');
    communityIntegration = new CommunityDAOIntegration(
      protocol.components.daoSystem,
      null, // CVCM ?�스?��? ?�거?�었?��?�?null
      null  // ?�동???�스??    );
    
    // AutomationSystem 초기??    const AutomationSystem = require('./src/automation/AutomationSystem');
    automationSystem = new AutomationSystem(protocol);
    
    // ?�동???�스???�작
    automationSystem.start();
    
    console.log('???�동검�??�스??초기???�료');
  
    // ?�버 ?�작 ??검증자 ?� 초기??    console.log('?�� 검증자 ?�??초기?�합?�다.');
    if (protocol.components && protocol.components.storage && typeof protocol.components.storage.resetValidatorPool === 'function') {
      protocol.components.storage.resetValidatorPool();
    } else {
      console.warn('?�️ 검증자 ?� 초기???�수�?찾을 ???�습?�다.');
    }
  
    console.log('??백야 ?�로?�콜 ?�버 초기???�료');
    
    // 릴레???�버???�결
    connectToRelayServer();
    
    return true;
  } catch (error) {
    console.error('???�버 초기???�패:', error);
    throw error;
  }
}

// 릴레???�버 ?�결 ?�수
function connectToRelayServer() {
  if (process.env.DIRECT_MODE === 'true') {
    console.log('?�� 직접 ?�결 모드: 릴레???�버�??�용?��? ?�습?�다');
    return;
  }
  
  console.log(`?�� 릴레???�버???�결 �? ${RELAY_SERVER_URL}`);
  
  try {
    relayConnection = new WebSocket(RELAY_SERVER_URL);
    
    relayConnection.on('open', () => {
      console.log('??릴레???�버???�결??);
      
      // ?�?�드 ?�록
      const nodeInfo = {
        type: 'register_node',
        nodeId: nodeId,
        endpoint: `http://localhost:${port}`,
        version: '1.0.0',
        capabilities: ['transaction', 'validation', 'storage']
      };
      
      relayConnection.send(JSON.stringify(nodeInfo));
      
      // ?�연�??�터�??�리
      if (relayReconnectInterval) {
        clearInterval(relayReconnectInterval);
        relayReconnectInterval = null;
      }
      
      // Ping 주기?�으�??�송 (20초마??
      setInterval(() => {
        if (relayConnection && relayConnection.readyState === WebSocket.OPEN) {
          relayConnection.send(JSON.stringify({ type: 'node_ping' }));
        }
      }, 20000);
    });
    
    relayConnection.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        handleRelayMessage(message);
      } catch (error) {
        console.error('릴레??메시지 ?�싱 ?�류:', error);
      }
    });
    
    relayConnection.on('error', (error) => {
      console.error('릴레???�버 ?�결 ?�류:', error);
    });
    
    relayConnection.on('close', () => {
      console.log('?�� 릴레???�버 ?�결 종료');
      
      // ?�연�??�도
      if (!relayReconnectInterval) {
        relayReconnectInterval = setInterval(() => {
          console.log('?�� 릴레???�버 ?�연�??�도...');
          connectToRelayServer();
        }, 5000);
      }
    });
    
  } catch (error) {
    console.error('릴레???�버 ?�결 ?�패:', error);
  }
}

// 릴레???�버 메시지 처리
async function handleRelayMessage(message) {
  switch (message.type) {
    case 'node_registered':
      console.log(`?�� 릴레???�버???�록 ?�료! Node ID: ${message.nodeId}`);
      break;
      
    case 'http_request':
      // HTTP ?�청 처리
      try {
        const { requestId, request } = message;
        const { method, path, headers, body, query } = request;
        
        // Express ?�우?��? ?�해 ?�청 처리
        const response = await processHttpRequest(method, path, headers, body, query);
        
        // ?�답 ?�송
        relayConnection.send(JSON.stringify({
          type: 'http_response',
          requestId: requestId,
          response: response
        }));
      } catch (error) {
        console.error('HTTP ?�청 처리 ?�류:', error);
      }
      break;
      
    case 'user_request':
      // WebSocket ?�용???�청 처리
      const { sessionId, request } = message;
      // ?�요??경우 구현
      break;
      
    case 'pong':
      // Ping ?�답
      break;
  }
}

// HTTP ?�청??Express ?�우?�로 처리
async function processHttpRequest(method, path, headers, body, query) {
  try {
    // 가?�의 ?�청/?�답 객체 ?�성
    const req = {
      method: method,
      path: path,
      url: path + (query ? '?' + new URLSearchParams(query).toString() : ''),
      headers: headers || {},
      body: body,
      query: query || {},
      params: {},
      get: function(name) {
        return this.headers[name.toLowerCase()];
      }
    };
    
    let responseData = null;
    let statusCode = 200;
    
    const res = {
      statusCode: 200,
      locals: {},
      json: function(data) {
        responseData = data;
        return this;
      },
      status: function(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      send: function(data) {
        responseData = data;
        return this;
      },
      end: function(data) {
        if (data) responseData = data;
        return this;
      },
      header: function() { return this; },
      set: function() { return this; }
    };
    
    // API 경로�?직접 처리
    if (path === '/status' && method === 'GET') {
      if (!protocol) {
        return { status: 503, data: { error: '?�로?�콜??초기?�되지 ?�았?�니?? } };
      }
      const status = await protocol.getStatus();
      return { status: 200, data: status };
    }
    
    if (path === '/protocol-status' && method === 'GET') {
      if (!protocol) {
        return { status: 503, data: { success: false, error: '?�로?�콜??초기?�되지 ?�았?�니?? } };
      }
      return {
        status: 200,
        data: {
          success: true,
          status: 'active',
          version: '1.0.0',
          timestamp: Date.now()
        }
      };
    }
    
    if (path === '/check-userid' && method === 'POST') {
      const { userId } = body;
      
      if (!userId) {
        return {
          status: 400,
          data: { success: false, error: '?�이?��? ?�요?�니?? }
        };
      }
      
      const reservedIds = ['founder', 'admin', 'system', 'operator', 'op', 'root', 'test'];
      if (reservedIds.includes(userId.toLowerCase())) {
        return {
          status: 200,
          data: { success: true, isDuplicate: true, reason: 'reserved' }
        };
      }
      
      const isDuplicate = await protocol.checkUserIdExists(userId);
      return {
        status: 200,
        data: { success: true, isDuplicate: isDuplicate }
      };
    }
    
    // ??register 처리??중복?��?�??�거??(?�래 초�?코드 처리 ?�함 버전 ?�용)
    
    if (path === '/login' && method === 'POST') {
      const { username, password, deviceId } = body;
      
      if (!username || !password) {
        return {
          status: 400,
          data: { success: false, error: '?�이?��? 비�?번호가 ?�요?�니?? }
        };
      }
      
      const finalDeviceId = deviceId || headers['x-device-id'] || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const result = await protocol.loginUser(username, password, finalDeviceId);
      
      // 로그???�공 ??WebSocket?�로 즉시 ?�액 ?�보 ?�송
      if (result.success && result.didHash) {
        setTimeout(async () => {
          try {
            const wallet = await protocol.getUserWallet(result.didHash);
            const poolStatus = protocol.components.storage.getValidatorPoolStatus();
            
            console.log(`?�� 로그???�공 ??지�??�보 ?�송: ${result.didHash} -> B:${wallet.balances?.bToken || 0}`);
            
            broadcastStateUpdate(result.didHash, {
              wallet: wallet,
              validatorPool: poolStatus
            });
          } catch (error) {
            console.error(`??로그????지�??�보 ?�송 ?�패: ${result.didHash}`, error);
          }
        }, 1000); // 1�????�송 (WebSocket ?�결 ?�간 고려)
      }
      
      return { status: 200, data: result };
    }
    
    // ?�원가??(초�?코드 처리 ?�함)
    if (path === '/register' && method === 'POST') {
      try {
        console.log('?�� ?�원가???�청 받음');
        console.log('?�� ?�청 본문:', JSON.stringify(body, null, 2));
        
        // ??가지 구조 모두 지?? { userData } ?�는 직접 ?�드??        const userData = body.userData || body;
        const { username, password, communicationAddress, inviteCode, deviceId } = userData;
        
        if (!username || !password) {
          return {
            status: 400,
            data: { success: false, error: '?�이?��? 비�?번호가 ?�요?�니?? }
          };
        }
        
        // ?�원가??처리
        const finalDeviceId = deviceId || headers['x-device-id'] || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // communicationAddress가 ?�으�???구조, ?�으�?userData ?�체 ?�달
        let result;
        if (communicationAddress) {
          result = await protocol.registerUser(username, password, communicationAddress, inviteCode, finalDeviceId);
        } else {
          // userData 구조 ?�용
          userData.deviceId = finalDeviceId;
          result = await protocol.registerUser(userData);
        }
        
        console.log('?�� ?�원가??결과:', result);
        
        // 초�?코드 처리 로직 추�?
        if (result.success && userData.inviteCode) {
          try {
            console.log(`?�� 초�?코드 처리 ?�작: ${userData.inviteCode} -> ${result.didHash}`);
            const inviteResult = await processInviteCode(userData.inviteCode, result.didHash);
            if (inviteResult.success) {
              console.log(`?�� 초�?코드 처리 ?�료: ${inviteResult.inviterDID} -> 30B, ${result.didHash} -> 20B`);
              
              // 결과??초�? 보상 ?�보 추�?
              result.inviteReward = inviteResult;
              
              // ?�용?��? ?�속??DAO ?�보 ?�데?�트
              try {
                const dashboard = await protocol.getUserDashboard(result.didHash);
                const userDAOs = dashboard.daos || [];
                
                // 커�??�티DAO가 ?��? 목록???�는지 ?�인
                const hasCommunityDAO = userDAOs.some(dao => dao.id === 'community-dao');
                
                if (!hasCommunityDAO) {
                  userDAOs.push({
                    id: 'community-dao',
                    name: 'Community DAO',
                    description: '백야 ?�로?�콜 커�??�티 관리�? ?�당?�는 DAO',
                    role: 'Member',
                    joinedAt: Date.now(),
                    contributions: 1,
                    lastActivity: '?�늘'
                  });
                  
                  console.log(`??초�?받�? ?�용??커�??�티DAO ?�속 ?�보 추�?: ${result.didHash}`);
                }
                
                result.daos = userDAOs;
              } catch (error) {
                console.error('DAO ?�보 가?�오�??�패:', error);
              }
              
            } else {
              console.log(`?�️ 초�?코드 처리 ?�패: ${inviteResult.error}`);
            }
          } catch (error) {
            console.error(`??초�?코드 처리 �??�류:`, error);
          }
        }
        
        // ?�원가???�공 ??WebSocket?�로 즉시 ?�액 ?�보 ?�송
        if (result.success && result.didHash) {
          setTimeout(async () => {
            try {
              const wallet = await protocol.getUserWallet(result.didHash);
              const poolStatus = protocol.components.storage.getValidatorPoolStatus();
              
              console.log(`?�� ?�원가???�공 ??지�??�보 ?�송: ${result.didHash} -> B:${wallet.balances?.bToken || 0}`);
              
              broadcastStateUpdate(result.didHash, {
                wallet: wallet,
                validatorPool: poolStatus
              });
            } catch (error) {
              console.error(`???�원가????지�??�보 ?�송 ?�패: ${result.didHash}`, error);
            }
          }, 2000); // 2�????�송 (초�?코드 처리 ?�료 ?��?
        }
        
        return { status: 200, data: result };
        
      } catch (error) {
        console.error('?�원가???�패:', error);
        return {
          status: 500,
          data: { success: false, error: '?�원가???�패', details: error.message }
        };
      }
    }
    
    // 초�?코드 관??API
    if ((path === '/invite-code' || path === '/api/invite-code') && method === 'GET') {
      const session = protocol.components.storage.validateSession(headers['x-session-id']);
      if (!session) {
        return { status: 401, data: { success: false, error: '?�증???�요?�니?? } };
      }
      
      try {
        // ?�?�소?�서 ?�당 ?�용?�의 초�?코드 조회
        const inviteCode = protocol.components.storage.getUserInviteCode(session.did);
        
        if (inviteCode) {
          return {
            status: 200,
            data: {
              success: true,
              inviteCode: inviteCode
            }
          };
        } else {
          return {
            status: 200,
            data: {
              success: false,
              message: '초�?코드가 ?�습?�다'
            }
          };
        }
      } catch (error) {
        console.error('초�?코드 조회 ?�패:', error);
        return {
          status: 500,
          data: { success: false, error: '초�?코드 조회 ?�패', details: error.message }
        };
      }
    }
    
    if ((path === '/invite-code' || path === '/api/invite-code') && method === 'POST') {
      // Authorization ?�더 ?�는 x-session-id ?�더�??�한 ?�증 ?�인
      let session = null;
      let userDID = null;
      
      if (headers['x-session-id']) {
        session = protocol.components.storage.validateSession(headers['x-session-id']);
        userDID = session?.didHash;
      } else if (headers['authorization']) {
        // Authorization: Bearer DID ?�식
        const authHeader = headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          userDID = authHeader.substring(7); // "Bearer " ?�거
          
          // DID�??�효???�용?�인지 ?�인
          const didInfo = protocol.components.authSystem.getDIDInfo(userDID);
          if (didInfo) {
            session = { didHash: userDID, ...didInfo };
          }
        }
      }
      
      if (!session || !userDID) {
        return { status: 401, data: { success: false, error: '?�증???�요?�니?? } };
      }
      
      try {
        const { userDID, communicationAddress } = body;
        const finalUserDID = userDID || session.didHash || session.did;
        
        if (!finalUserDID) {
          return { status: 400, data: { success: false, error: '?�용??DID가 ?�요?�니?? } };
        }

        console.log(`?�� 초�?코드 ?�성 ?�청: ${finalUserDID.substring(0, 16)}...`);

        // 기존 초�?코드가 ?�는지 강화???�인
        let existingCode = protocol.components.storage.getUserInviteCode(finalUserDID);
        
        // 추�?�?블록체인?�서???�인 (?��? ?�록??초�?코드가 ?�는지)
        if (!existingCode) {
          // 블록체인?�서 ?�당 ?�용?�의 초�?코드 ?�록 ?�랜??�� 찾기
          const blockchain = protocol.getBlockchain();
          if (blockchain && blockchain.chain) {
            for (const block of blockchain.chain) {
              for (const tx of block.transactions) {
                if (tx.fromDID === finalUserDID && 
                    tx.data?.type === 'invite_code_registration' && 
                    tx.data?.inviteCode) {
                  existingCode = tx.data.inviteCode;
                  // 로컬 ?�?�소?�도 ?�??                  protocol.components.storage.saveUserInviteCode(finalUserDID, existingCode);
                  break;
                }
              }
              if (existingCode) break;
            }
          }
        }
        
        if (existingCode) {
          console.log(`?�️ 기존 초�?코드 반환: ${existingCode}`);
          return { status: 200, data: { success: true, inviteCode: existingCode } };
        }

        // ?�시 기반 ?�구 초�?코드 ?�성
        const inviteCode = generateHashBasedInviteCode(finalUserDID);
        console.log(`?�� ?�로??초�?코드 ?�성: ${inviteCode}`);

        try {
          // 초�?코드 ?�록 ?�랜??�� ?�성
          const inviteCodeTx = new Transaction(
            finalUserDID,
            'did:baekya:system0000000000000000000000000000000002', // ?�스??주소
            0, // 금액 ?�음
            'B-Token',
            { 
              type: 'invite_code_registration',
              inviteCode: inviteCode,
              communicationAddress: communicationAddress,
              registrationDate: new Date().toISOString()
            }
          );
          
          inviteCodeTx.sign('test-key');
          
          // 블록체인???�랜??�� 추�?
          const addResult = protocol.getBlockchain().addTransaction(inviteCodeTx);
          
          if (!addResult.success) {
            throw new Error(addResult.error || '?�랜??�� 추�? ?�패');
          }
          
          console.log(`?�� 초�?코드 ?�랜??�� ?�성: ${inviteCode}`);
          
          // ?�?�소??초�?코드 ?�??          protocol.components.storage.saveUserInviteCode(finalUserDID, inviteCode);
          
          return {
            status: 200,
            data: {
              success: true,
              inviteCode: inviteCode,
              message: '초�?코드가 ?�성?�었?�니?? 검증자가 블록???�성?�면 ?�구 ?�?�됩?�다.',
              transactionId: inviteCodeTx.hash,
              status: 'pending'
            }
          };
        } catch (error) {
          console.error('초�?코드 블록체인 ?�록 ?�패:', error);
          
          // 블록체인 ?�록???�패?�도 로컬?�는 ?�??          protocol.components.storage.saveUserInviteCode(finalUserDID, inviteCode);
          
          return {
            status: 200,
            data: {
              success: true,
              inviteCode: inviteCode,
              message: '초�?코드가 ?�성?�었?�니??(블록체인 ?�록 지??'
            }
          };
        }
      } catch (error) {
        console.error('초�?코드 ?�성 ?�패:', error);
        return {
          status: 500,
          data: { success: false, error: '초�?코드 ?�성 ?�패', details: error.message }
        };
      }
    }
    
    // 지�??�보 조회
    if (path.startsWith('/wallet/') && method === 'GET') {
      const did = path.split('/wallet/')[1];
      try {
        const wallet = await protocol.getUserWallet(did);
        return { status: 200, data: wallet };
      } catch (error) {
        return {
          status: 500,
          data: { success: false, error: '지�??�보 조회 ?�패', details: error.message }
        };
      }
    }
    
    // 기여 ?�역 조회
    if (path.startsWith('/contributions/') && method === 'GET') {
      const did = path.split('/contributions/')[1];
      try {
        const contributions = await protocol.getUserContributions(did);
        return { status: 200, data: contributions };
      } catch (error) {
        return {
          status: 500,
          data: { success: false, error: '기여 ?�역 조회 ?�패', details: error.message }
        };
      }
    }
    
    // DAO 목록 조회
    if (path === '/daos' && method === 'GET') {
      try {
        const daos = protocol.getDAOs();
        return { status: 200, data: daos };
      } catch (error) {
        return {
          status: 500,
          data: { success: false, error: 'DAO 목록 조회 ?�패', details: error.message }
        };
      }
    }
    
    // DAO ?�성
    if (path === '/daos' && method === 'POST') {
      const session = protocol.components.storage.validateSession(headers['x-session-id']);
      if (!session) {
        return { status: 401, data: { success: false, error: '?�증???�요?�니?? } };
      }
      
      try {
        const { daoData } = body;
        const result = await protocol.createDAO(session.did, daoData);
        return { status: 200, data: result };
      } catch (error) {
        return {
          status: 500,
          data: { success: false, error: 'DAO ?�성 ?�패', details: error.message }
        };
      }
    }
    
    // ?�정 DAO ?�보 조회
    if (path.startsWith('/daos/') && path.split('/').length === 3 && method === 'GET') {
      const daoId = path.split('/daos/')[1];
      try {
        const dao = protocol.getDAO(daoId);
        return { status: 200, data: dao };
      } catch (error) {
        return {
          status: 500,
          data: { success: false, error: 'DAO ?�보 조회 ?�패', details: error.message }
        };
      }
    }
    
    // DAO 가??    if (path.includes('/daos/') && path.endsWith('/join') && method === 'POST') {
      const session = protocol.components.storage.validateSession(headers['x-session-id']);
      if (!session) {
        return { status: 401, data: { success: false, error: '?�증???�요?�니?? } };
      }
      
      const daoId = path.split('/daos/')[1].split('/join')[0];
      try {
        const result = await protocol.joinDAO(session.did, daoId);
        return { status: 200, data: result };
      } catch (error) {
        return {
          status: 500,
          data: { success: false, error: 'DAO 가???�패', details: error.message }
        };
      }
    }
    
    // ?�큰 ?�송
    if (path === '/transfer' && method === 'POST') {
      try {
        console.log('?�� ?�큰 ?�송 ?�청 받음');
        console.log('?�� ?�청 본문:', JSON.stringify(body, null, 2));
        console.log('?�� ?�더:', headers);
        
        const { fromDID, toAddress, amount, tokenType = 'B-Token', authData } = body;
        
        console.log('?�� ?�싱???�이??');
        console.log(`  - fromDID: ${fromDID} (?�?? ${typeof fromDID})`);
        console.log(`  - toAddress: ${toAddress} (?�?? ${typeof toAddress})`);
        console.log(`  - amount: ${amount} (?�?? ${typeof amount})`);
        console.log(`  - tokenType: ${tokenType}`);
        console.log(`  - authData: ${JSON.stringify(authData)}`);
        
        if (!fromDID || !toAddress || !amount || amount <= 0) {
          console.log('???�라미터 검�??�패:');
          console.log(`  - fromDID 존재: ${!!fromDID}`);
          console.log(`  - toAddress 존재: ${!!toAddress}`);
          console.log(`  - amount 존재: ${!!amount}`);
          console.log(`  - amount > 0: ${amount > 0}`);
          
          return {
            status: 400,
            data: {
              success: false,
              error: '발신??DID, 받는 주소, ?�효??금액???�요?�니??
            }
          };
        }
        
        // toAddress가 DID?��?, ?�신주소?��?, ?�이?�인지 ?�인?�고 DID�?변??        let toDID = toAddress;
        
        if (!toAddress.startsWith('did:baekya:')) {
          console.log('?�� ?�신주소 ?�는 ?�이?�로 DID 조회 ?�도:', toAddress);
          
          // ?�신주소�?DID 찾기
          const authSystem = protocol.components.authSystem;
          const didResult = authSystem.getDIDByCommAddress(toAddress);
          
          if (didResult.success) {
            toDID = didResult.did;
            console.log('???�신주소�?DID 찾음:', toDID);
          } else {
            // ?�이?�로 DID 찾기 ?�도
            const userResult = authSystem.getUserByUsername(toAddress);
            if (userResult.success) {
              toDID = userResult.user.did;
              console.log('???�이?�로 DID 찾음:', toDID);
            } else {
              console.log('??받는 주소�?찾을 ???�음:', toAddress);
              return {
                status: 404,
                data: {
                  success: false,
                  error: `받는 주소�?찾을 ???�습?�다: ${toAddress}`
                }
              };
            }
          }
        }
        
        console.log('?�� 최종 ?�송 ?�보:');
        console.log(`  - From: ${fromDID}`);
        console.log(`  - To: ${toDID}`);
        console.log(`  - Amount: ${amount} ${tokenType}`);
        
        // ?�큰 ?�송 ?�행
        const result = await protocol.transferTokens(fromDID, toDID, amount, tokenType, authData);
        
        console.log('?�� ?�큰 ?�송 결과:', result);
        
        return { status: 200, data: result };
        
      } catch (error) {
        console.error('?�큰 ?�송 ?�패:', error);
        return {
          status: 500,
          data: { success: false, error: '?�큰 ?�송 ?�패', details: error.message }
        };
      }
    }
    
    // 초�? ?�성
    if (path === '/invite/create' && method === 'POST') {
      try {
        const { userDID, inviteCode } = body;
        
        if (!userDID || !inviteCode) {
          return {
            status: 400,
            data: { success: false, error: '?�용??DID?� 초�?코드가 ?�요?�니?? }
          };
        }
        
        const result = await protocol.createInvite(userDID, inviteCode);
        return { status: 200, data: result };
        
      } catch (error) {
        console.error('초�? ?�성 ?�패:', error);
        return {
          status: 500,
          data: { success: false, error: '초�? ?�성 ?�패', details: error.message }
        };
      }
    }
    
    // ?�른 ?�우?�들?� Express ?�을 ?�해 처리
    return new Promise((resolve) => {
      // Express??next() ?�수 ?��??�이??      const next = (err) => {
        if (err) {
          resolve({
            status: 500,
            data: { error: 'Internal server error', details: err.message }
          });
        }
      };
      
      // Express 미들?�어 체인 ?�행 ?��??�이??      let middlewareIndex = 0;
      
      const runMiddleware = () => {
        const layer = app._router.stack[middlewareIndex++];
        if (!layer) {
          resolve({
            status: 404,
            data: { error: 'Route not found' }
          });
          return;
        }
        
        try {
          if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
            layer.route.stack[0].handle(req, res, next);
            setTimeout(() => {
              resolve({
                status: statusCode,
                data: responseData
              });
            }, 100);
          } else {
            runMiddleware();
          }
        } catch (error) {
          next(error);
        }
      };
      
      runMiddleware();
    });
    
  } catch (error) {
    console.error('HTTP ?�청 처리 ?�류:', error);
    return {
      status: 500,
      data: { error: 'Internal server error', details: error.message }
    };
  }
}

// ?�적 ?�일 ?�빙
app.use(express.static('public'));
app.use(express.json());

// CORS ?�정
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

// ?�션 검�?미들?�어
const validateSession = (req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  const publicRoutes = ['/api/status', '/api/register', '/api/login', '/api/p2p/find-contact'];
  
  // 공개 ?�우?�는 ?�션 검�?건너?�기
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  if (!sessionId) {
    return next(); // ?�션 ?�어???�단 진행 (?�위 ?�환??
  }
  
  // ?�션 ?�효??검�?  const session = protocol.components.storage.validateSession(sessionId);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: '?�션??만료?�었거나 ?�른 기기?�서 로그?�했?�니??',
      code: 'SESSION_EXPIRED'
    });
  }
  
  req.session = session;
  next();
};

// ?�션 검�?미들?�어 ?�용
app.use(validateSession);

// 기본 ?�우??app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API ?�태 ?�인
app.get('/api/status', async (req, res) => {
  try {
    if (!protocol) {
      return res.status(503).json({ error: '?�로?�콜??초기?�되지 ?�았?�니?? });
    }
    
    const status = await protocol.getStatus();
    res.json(status);
  } catch (error) {
    console.error('?�로?�콜 ?�태 조회 ?�패:', error);
    res.status(500).json({ error: '?�로?�콜 ?�태 조회 ?�패', details: error.message });
  }
});

// ?�로?�콜 ?�태 ?�인 (?�앱 ?�버 검?�용)
app.get('/api/protocol-status', async (req, res) => {
  try {
    if (!protocol) {
      return res.status(503).json({ 
        success: false, 
        error: '?�로?�콜??초기?�되지 ?�았?�니?? 
      });
    }
    
    res.json({
      success: true,
      status: 'active',
      version: '1.0.0',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('?�로?�콜 ?�태 조회 ?�패:', error);
    res.status(500).json({ 
      success: false, 
      error: '?�로?�콜 ?�태 조회 ?�패', 
      details: error.message 
    });
  }
});

// ?�로?�콜 ?�체 ?�태 조회 (검증자 ?�, DAO 금고 ??
app.get('/api/protocol-state', async (req, res) => {
  try {
    if (!protocol) {
      return res.status(503).json({ error: '?�로?�콜??초기?�되지 ?�았?�니?? });
    }
    
    // 검증자 ?� ?�태
    const poolStatus = protocol.components.storage.getValidatorPoolStatus();
    
    // DAO 금고 ?�태
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
    console.error('?�로?�콜 ?�태 조회 ?�패:', error);
    res.status(500).json({ error: '?�로?�콜 ?�태 조회 ?�패', details: error.message });
  }
});

// ?�이??중복 체크
app.post('/api/check-userid', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '?�이?��? ?�요?�니??
      });
    }
    
    // ?�약???�이???�인
    const reservedIds = ['founder', 'admin', 'system', 'operator', 'op', 'root', 'test'];
    if (reservedIds.includes(userId.toLowerCase())) {
      return res.json({
        success: true,
        isDuplicate: true,
        reason: 'reserved'
      });
    }
    
    // ?�로?�콜?�서 ?�이??중복 ?�인
    const isDuplicate = await protocol.checkUserIdExists(userId);
    
    res.json({
      success: true,
      isDuplicate: isDuplicate
    });
    
  } catch (error) {
    console.error('?�이??중복 체크 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '?�이??중복 체크 ?�패',
      details: error.message
    });
  }
});

// ?�용???�록 (?�이??비�?번호 방식)
app.post('/api/register', async (req, res) => {
  try {
    const { userData } = req.body;
    
    if (!userData || !userData.username || !userData.password) {
      return res.status(400).json({ 
        success: false, 
        error: '?�이?��? 비�?번호가 ?�요?�니?? 
      });
    }

    // ?�바?�스 ID 추�?
    if (!userData.deviceId) {
      userData.deviceId = req.headers['x-device-id'] || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ?�로?�콜 ?�용???�록
    const result = await protocol.registerUser(userData);
    
    if (result.success) {
      console.log(`?�� ?�로???�용???�록: ${result.didHash} (${result.username})`);
      
      if (result.isFounder) {
        console.log(`?�� Founder 계정 ?�록! ?�별 ?�택 부?�됨`);
      }
      
      if (result.isInitialOP) {
        console.log(`?�� �?번째 ?�용???�니??OP ?�정 ?�료: ${result.initialOPResult.totalPTokensGranted}P 지�?);
      }
      
      // 초�?코드 처리
      let inviteReward = null;
      if (userData.inviteCode) {
        try {
          const inviteResult = await processInviteCode(userData.inviteCode, result.didHash);
          if (inviteResult.success) {
            inviteReward = inviteResult;
            console.log(`?�� 초�?코드 처리 ?�료: ${inviteResult.inviterDID} -> 30B, ${result.didHash} -> 20B`);
          } else {
            console.log(`?�️ 초�?코드 처리 ?�패: ${inviteResult.error}`);
          }
        } catch (error) {
          console.error(`??초�?코드 처리 �??�류:`, error);
        }
      }
      
      // ?�용?��? ?�속??DAO ?�보 가?�오�?      let userDAOs = [];
      
      // 모든 ?�용?�에 ?�??DAO ?�속 ?�보 ?�인
      try {
        const dashboard = await protocol.getUserDashboard(result.didHash);
        userDAOs = dashboard.daos || [];
        
        // 초�?받�? ?�용?�의 경우 커�??�티DAO ?�속 ?�보 ?�인 �?추�?
        if (userData.inviteCode && inviteReward && inviteReward.success) {
          // 커�??�티DAO가 ?��? 목록???�는지 ?�인
          const hasCommunityDAO = userDAOs.some(dao => dao.id === 'community-dao');
          
          if (!hasCommunityDAO) {
                         // 커�??�티DAO ?�보 추�?
             userDAOs.push({
               id: 'community-dao',
               name: 'Community DAO',
               description: '백야 ?�로?�콜 커�??�티 관리�? ?�당?�는 DAO',
               role: 'Member',
               joinedAt: Date.now(),
               contributions: 1, // 초�? 참여 기여 1�?               lastActivity: '?�늘'
             });
            
            console.log(`??초�?받�? ?�용??커�??�티DAO ?�속 ?�보 추�?: ${result.didHash}`);
          }
        }
        
        // Founder???�니??OP??경우 추�? DAO ?�보
        if (result.isFounder || result.isInitialOP) {
          console.log(`?�� ?�별 ?�용??DAO ?�속 ?�보: ${userDAOs.length}�?DAO`);
        }
        
      } catch (error) {
        console.error('?�용??DAO ?�보 가?�오�??�패:', error);
        
        // 초�?받�? ?�용?�의 경우 최소??커�??�티DAO??추�?
        if (userData.inviteCode && inviteReward && inviteReward.success) {
                     userDAOs = [{
             id: 'community-dao',
             name: 'Community DAO',
             description: '백야 ?�로?�콜 커�??�티 관리�? ?�당?�는 DAO',
             role: 'Member',
             joinedAt: Date.now(),
             contributions: 1,
             lastActivity: '?�늘'
           }];
          
          console.log(`??초�?받�? ?�용??기본 커�??�티DAO ?�속 ?�보 ?�정: ${result.didHash}`);
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
        daos: userDAOs, // ?�속 DAO ?�보 추�?
        inviteReward: inviteReward, // 초�? 보상 ?�보
        message: result.message
      });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('?�용???�록 ?�패:', error);
    res.status(500).json({ 
      success: false, 
      error: '?�용???�록 ?�패', 
      details: error.message 
    });
  }
});

// ?�용??로그??(?�로???�드?�인??
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: '?�이?��? 비�?번호가 ?�요?�니?? 
      });
    }

    // ?�바?�스 ID 추�?
    const deviceId = req.headers['x-device-id'] || req.body.deviceId || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await protocol.loginUser(username, password, deviceId);
    
    if (result.success) {
      console.log(`?�� ?�용??로그?? ${result.username}`);
      
      // 최신 지�??�보 가?�오�?      const wallet = await protocol.getUserWallet(result.didHash);
      
      // ?�로?�콜 ?�체 ?�태 가?�오�?      const poolStatus = protocol.components.storage.getValidatorPoolStatus();
      const daosResult = protocol.getDAOs();
      const daoTreasuries = {};
      
      // �?DAO??금고 ?�태 가?�오�?      if (daosResult.success && daosResult.daos) {
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
        // ?�로?�콜 ?�체 ?�태 추�?
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
    console.error('?�용??로그???�패:', error);
    res.status(500).json({ 
      success: false, 
      error: '?�용??로그???�패', 
      details: error.message 
    });
  }
});

// ?�거??API ?�환??(기존 ?�체?�증 API 리다?�렉??
app.post('/api/auth/generate-did', async (req, res) => {
  // ???�드?�인?�는 ?�거???�환?�을 ?�해 ?��??�되 ?�러 반환
  res.status(410).json({
    success: false,
    error: '??API?????�상 지?�되지 ?�습?�다. /api/register ?�는 /api/login???�용?�세??',
    newEndpoints: {
      register: '/api/register',
      login: '/api/login'
    }
  });
});

// ?�용???�증 (?�거???�환??
app.post('/api/authenticate', async (req, res) => {
  try {
    // �?API 지??중단 ?�내
    res.status(410).json({
      success: false,
      error: '??API?????�상 지?�되지 ?�습?�다. /api/login???�용?�세??',
      newEndpoint: '/api/login'
    });
  } catch (error) {
    console.error('?�용???�증 ?�패:', error);
    res.status(500).json({ 
      success: false, 
      error: '?�용???�증 ?�패', 
      details: error.message 
    });
  }
});

// 기여 ?�출
app.post('/api/contribute', async (req, res) => {
  try {
    const contributionData = req.body;
    
    if (!contributionData.contributorDID || !contributionData.daoId || !contributionData.dcaId) {
      return res.status(400).json({
        success: false,
        error: '기여??DID, DAO ID, DCA ID???�수?�니??
      });
    }

    const result = await protocol.submitContribution(contributionData);
    res.json(result);
  } catch (error) {
    console.error('기여 ?�출 ?�패:', error);
    res.status(500).json({ 
      success: false, 
      error: '기여 ?�출 ?�패', 
      details: error.message 
    });
  }
});

// 기여 검�?app.post('/api/verify-contribution', async (req, res) => {
  try {
    const { contributionId, verifierDID, verified, reason } = req.body;
    const result = await protocol.verifyContribution(contributionId, verifierDID, verified, reason);
    res.json(result);
  } catch (error) {
    console.error('기여 검�??�패:', error);
    res.status(500).json({ 
      success: false, 
      error: '기여 검�??�패', 
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
      res.status(500).json({ error: 'DAO 목록 조회 ?�패', details: result.error });
    }
  } catch (error) {
    console.error('DAO 목록 조회 ?�패:', error);
    res.status(500).json({ error: 'DAO 목록 조회 ?�패', details: error.message });
  }
});

// ?�정 DAO 조회
app.get('/api/daos/:daoId', (req, res) => {
  try {
    const dao = protocol.getDAO(req.params.daoId);
    if (!dao) {
      return res.status(404).json({ error: 'DAO�?찾을 ???�습?�다' });
    }
    res.json(dao);
  } catch (error) {
    console.error('DAO 조회 ?�패:', error);
    res.status(500).json({ error: 'DAO 조회 ?�패', details: error.message });
  }
});

// DAO ?�성
app.post('/api/daos', async (req, res) => {
  try {
    const daoData = req.body;
    
    // ?�니??OP ?�신주소 검�?    if (daoData.initialOPAddress) {
      const authSystem = protocol.components.authSystem;
      const result = authSystem.getDIDByCommAddress(daoData.initialOPAddress);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: `?�니??OP ?�신주소(${daoData.initialOPAddress})�?찾을 ???�습?�다.`
        });
      }
      
      console.log(`???�니??OP ?�신주소 검�??�료: ${daoData.initialOPAddress}`);
    }
    
    const result = await protocol.createDAO(daoData);
    res.json(result);
  } catch (error) {
    console.error('DAO ?�성 ?�패:', error);
    res.status(500).json({ 
      success: false, 
      error: 'DAO ?�성 ?�패', 
      details: error.message 
    });
  }
});

// DAO 가??app.post('/api/daos/:daoId/join', async (req, res) => {
  try {
    const { daoId } = req.params;
    const { userDID, membershipType } = req.body;
    const result = await protocol.joinDAO(daoId, userDID, membershipType);
    res.json(result);
  } catch (error) {
    console.error('DAO 가???�패:', error);
    res.status(500).json({ 
      success: false, 
      error: 'DAO 가???�패', 
      details: error.message 
    });
  }
});

// 초�?코드 조회 (계정�?고유 초�?코드)
app.get('/api/invite-code', async (req, res) => {
  try {
    const userDID = req.headers.authorization?.split(' ')[1];
    
    if (!userDID) {
      return res.status(401).json({
        success: false,
        error: '?�증 ?�보가 ?�요?�니??
      });
    }

    // ?�?�소?�서 ?�당 ?�용?�의 초�?코드 조회
    const inviteCode = protocol.components.storage.getUserInviteCode(userDID);
    
    if (inviteCode) {
      res.json({
        success: true,
        inviteCode: inviteCode
      });
    } else {
      res.json({
        success: false,
        message: '초�?코드가 ?�습?�다'
      });
    }
  } catch (error) {
    console.error('초�?코드 조회 ?�패:', error);
    res.status(500).json({ 
      success: false, 
      error: '초�?코드 조회 ?�패', 
      details: error.message 
    });
  }
});

// 초�?코드 ?�성 (계정�?고유 초�?코드, 블록체인 ?�??
app.post('/api/invite-code', async (req, res) => {
  try {
    const { userDID, communicationAddress } = req.body;
    
    if (!userDID) {
      return res.status(400).json({
        success: false,
        error: '?�용??DID가 ?�요?�니??
      });
    }

    // 기존 초�?코드가 ?�는지 강화???�인
    let existingCode = protocol.components.storage.getUserInviteCode(userDID);
    
    // 추�?�?블록체인?�서???�인 (?��? ?�록??초�?코드가 ?�는지)
    if (!existingCode) {
      const blockchain = protocol.getBlockchain();
      if (blockchain && blockchain.chain) {
        for (const block of blockchain.chain) {
          for (const tx of block.transactions) {
            if (tx.fromDID === userDID && 
                tx.data?.type === 'invite_code_registration' && 
                tx.data?.inviteCode) {
              existingCode = tx.data.inviteCode;
              protocol.components.storage.saveUserInviteCode(userDID, existingCode);
              break;
            }
          }
          if (existingCode) break;
        }
      }
    }
    
    if (existingCode) {
      return res.json({
        success: true,
        inviteCode: existingCode
      });
    }

    // ?�시 기반 ?�구 초�?코드 ?�성
    const inviteCode = generateHashBasedInviteCode(userDID);

    try {
      // 초�?코드 ?�록 ?�랜??�� ?�성
      const inviteCodeTx = new Transaction(
        userDID,
        'did:baekya:system0000000000000000000000000000000002', // ?�스??주소
        0, // 금액 ?�음
        'B-Token',
        { 
          type: 'invite_code_registration',
          inviteCode: inviteCode,
          communicationAddress: communicationAddress,
          registrationDate: new Date().toISOString()
        }
      );
      
      inviteCodeTx.sign('test-key');
      
      // 블록체인???�랜??�� 추�?
      const addResult = protocol.getBlockchain().addTransaction(inviteCodeTx);
      
      if (!addResult.success) {
        throw new Error(addResult.error || '?�랜??�� 추�? ?�패');
      }
      
      console.log(`?�� 초�?코드 ?�랜??�� ?�성: ${inviteCode}`);
      
      // ?�?�소??초�?코드 ?�??      protocol.components.storage.saveUserInviteCode(userDID, inviteCode);
        
      res.json({
        success: true,
        inviteCode: inviteCode,
        message: '초�?코드가 ?�성?�었?�니?? 검증자가 블록???�성?�면 ?�구 ?�?�됩?�다.',
        transactionId: inviteCodeTx.hash,
        status: 'pending'
      });
      
    } catch (error) {
      console.error('초�?코드 블록체인 ?�록 ?�패:', error.message);
      
      // 블록체인 ?�록???�패?�도 로컬?�는 ?�??      protocol.components.storage.saveUserInviteCode(userDID, inviteCode);
      
      res.json({
        success: true,
        inviteCode: inviteCode,
        message: '초�?코드가 ?�성?�었?�니??(블록체인 ?�록 지??'
      });
    }
  } catch (error) {
    console.error('초�?코드 ?�성 ?�패:', error.message);
    res.status(500).json({ 
      success: false, 
      error: '초�?코드 ?�성 ?�패', 
      details: error.message 
    });
  }
});

// ?�시 기반 초�?코드 ?�성 ?�수
function generateHashBasedInviteCode(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 ?�수�?변??  }
  
  // ?�시�?6?�리 ?�문자 ?�숫?�로 변??  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  let num = Math.abs(hash);
  
  for (let i = 0; i < 6; i++) {
    result += chars[num % chars.length];
    num = Math.floor(num / chars.length);
  }
  
  return result;
}

// 초�?코드 처리 ?�수
async function processInviteCode(inviteCode, newUserDID) {
  try {
    // 초�?코드�?초�???찾기
    const inviterDID = protocol.components.storage.findUserByInviteCode(inviteCode);
    
    if (!inviterDID) {
      return {
        success: false,
        error: '?�효?��? ?��? 초�?코드?�니??
      };
    }
    
    // ?�기 ?�신??초�??�는 경우 방�?
    if (inviterDID === newUserDID) {
      return {
        success: false,
        error: '?�기 ?�신??초�??????�습?�다'
      };
    }
    
    // 초�??�에�?30B, ?�성?�에�?20B 지�?    
    // 초�??�에�?30B 지�?    const inviterTx = new Transaction(
      'did:baekya:system0000000000000000000000000000000002', // ?�스??주소
      inviterDID,
      30,
      'B-Token',
      {
        type: 'invite_reward',
        inviteCode: inviteCode,
        newUserDID: newUserDID,
        role: 'inviter',
        description: '초�? 보상 (초�???'
      }
    );
    inviterTx.sign('test-key');
    
    // ?�성?�에�?20B 지�?    const newUserTx = new Transaction(
      'did:baekya:system0000000000000000000000000000000002', // ?�스??주소
      newUserDID,
      20,
      'B-Token',
      {
        type: 'invite_reward',
        inviteCode: inviteCode,
        inviterDID: inviterDID,
        role: 'invitee',
        description: '초�? 보상 (?�성??'
      }
    );
    newUserTx.sign('test-key');
    
    // 블록체인???�랜??�� 추�?
    console.log('?�� 초�????�랜??�� 추�? ?�도...');
    const addResult1 = protocol.getBlockchain().addTransaction(inviterTx);
    console.log('?�� 초�????�랜??�� 결과:', addResult1);
    
    console.log('?�� ?�성???�랜??�� 추�? ?�도...');
    const addResult2 = protocol.getBlockchain().addTransaction(newUserTx);
    console.log('?�� ?�성???�랜??�� 결과:', addResult2);
    
    if (!addResult1.success || !addResult2.success) {
      console.error('???�랜??�� 추�? ?�패 ?�세:');
      console.error('  초�????�랜??��:', addResult1);
      console.error('  ?�성???�랜??��:', addResult2);
      throw new Error('?�랜??�� 추�? ?�패');
    }
    
    // ?�랜??��?� 추�??�었�?검증자가 블록???�성???�정
    console.log(`?�� 초�? 보상 ?�랜??�� 추�???(?��?�?`);
    
    // ?�랜??��??추�??�었?��?�?기여 ?�역?� 바로 처리
    if (true) {
      
      // 커�??�티 DAO??기여 ?�역 추�?
      try {
        // ?�역 communityIntegration ?�용 (?��? 초기?�됨)
        
        // 초�? ?�동??커�??�티 DAO 기여 ?�역??추�?
        const contributionResult = await communityIntegration.handleInviteSuccess(inviteCode, inviterDID, newUserDID);
        console.log(`?�� 커�??�티 DAO 기여 ?�역 추�?: ${JSON.stringify(contributionResult)}`);
        
        // 기여 ?�역???�로?�콜 ?�?�소???�??        if (contributionResult.success) {
          protocol.components.storage.saveContribution(inviterDID, 'community-dao', {
            id: contributionResult.contribution.id,
            type: 'invite_activity',
            title: '초�? ?�동',
            dcaId: 'invite-activity',
            evidence: `초�?코드: ${inviteCode}`,
            description: `?�로???�용??초�? ?�공: ${newUserDID}`,
            bValue: 30, // ?�제 지급된 B-Token (30B)
            verified: true,
            verifiedAt: Date.now(),
            metadata: {
              inviteCode,
              inviteeDID: newUserDID,
              completedAt: Date.now()
            }
          });
          
          console.log(`??초�? ?�동 기여 ?�역 ?�???�료: ${inviterDID}`);
        }

        // 초�?받�? ?�용???�성????커�??�티DAO??추�?
        const inviteeJoinResult = await communityIntegration.handleInviteeJoinCommunityDAO(inviteCode, newUserDID, inviterDID);
        console.log(`?�� 초�?받�? ?�용??커�??�티DAO 가??처리: ${JSON.stringify(inviteeJoinResult)}`);
        
        // ?�성??기여 ?�역???�로?�콜 ?�?�소???�??        if (inviteeJoinResult.success) {
          protocol.components.storage.saveContribution(newUserDID, 'community-dao', {
            id: inviteeJoinResult.contribution.id,
            type: 'invite_join',
            title: '초�? 참여',
            dcaId: 'invite-join',
            evidence: `초�?코드: ${inviteCode}`,
            description: `초�?�??�해 커�??�티??참여 (초�??? ${inviterDID})`,
            bValue: 20, // ?�제 지급받?� B-Token (20B)
            verified: true,
            verifiedAt: Date.now(),
            metadata: {
              inviteCode,
              inviterDID,
              joinedAt: Date.now(),
              description: '초�?�??�해 커�??�티??참여'
            }
          });
          
          console.log(`??초�?받�? ?�용??기여 ?�역 ?�???�료: ${newUserDID}`);
        }
      } catch (error) {
        console.error('?�️ 커�??�티 DAO 기여 ?�역 추�? ?�패:', error);
        // 기여 ?�역 추�? ?�패?�도 ?�큰 지급�? ?��? ?�료?�었?��?�?계속 진행
      }
      
      // 블록 ?�성??기다�????�액 조회 (?�랜??��??체인???�함?�도�?
      // 검증자가 30초마??블록???�성?��?�? 즉시 조회?�면 pending ?�태
      // ?��?�??�라?�언??경험???�해 ?�상 ?�액??먼�? ?�송
      
      // ?�재 블록체인 ?�액 조회 (?�랜??�� ??
      const inviterCurrentBalance = protocol.getBlockchain().getBalance(inviterDID, 'B-Token');
      const newUserCurrentBalance = protocol.getBlockchain().getBalance(newUserDID, 'B-Token');
      
      // ?�상 ?�액 계산 (?�재 ?�액 + 보상)
      const inviterExpectedBalance = inviterCurrentBalance + 30;
      const newUserExpectedBalance = newUserCurrentBalance + 20;
      
      console.log(`?�� 초�????�상 ?�액: ${inviterExpectedBalance}B (?�재: ${inviterCurrentBalance}B + 보상: 30B)`);
      console.log(`?�� ?�성???�상 ?�액: ${newUserExpectedBalance}B (?�재: ${newUserCurrentBalance}B + 보상: 20B)`);
      
      // 초�??�에�??�상 ?�액?�로 즉시 ?�데?�트 ?�송
      broadcastStateUpdate(inviterDID, {
        wallet: { balances: { bToken: inviterExpectedBalance, pToken: 0 } },
        newContribution: {
          dao: 'community-dao',
          type: 'invite_activity',
          title: '초�? ?�동',
          bTokens: 30,
          description: `?�로???�용??초�? ?�공`,
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
            lastActivity: '?�늘',
            joinedAt: Date.now()
          }
        }
      });
      
      // ?�성?�에�??�상 ?�액?�로 즉시 ?�데?�트 ?�송
      broadcastStateUpdate(newUserDID, {
        wallet: { balances: { bToken: newUserExpectedBalance, pToken: 0 } }
      });
      
      // ?�중??블록???�성?�면 ?�제 ?�액?�로 ?�시 ?�데?�트
      setTimeout(async () => {
        const inviterWallet = await protocol.getUserWallet(inviterDID);
        if (inviterWallet.success) {
          console.log(`?�� 초�????�제 ?�액 ?�인: ${inviterWallet.balances.bToken}B`);
          broadcastStateUpdate(inviterDID, {
            wallet: { balances: { bToken: inviterWallet.balances.bToken, pToken: inviterWallet.balances.pToken || 0 } }
          });
        }
        
        const newUserWallet = await protocol.getUserWallet(newUserDID);
        if (newUserWallet.success) {
          console.log(`?�� ?�성???�제 ?�액 ?�인: ${newUserWallet.balances.bToken}B`);
          broadcastStateUpdate(newUserDID, {
            wallet: { balances: { bToken: newUserWallet.balances.bToken, pToken: newUserWallet.balances.pToken || 0 } }
          });
        }
      }, 35000); // 35�???(블록 ?�성 주기 30�?+ ?�유 5�?
      
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
      // ?�랜??��??추�??�었?��?�??�공?�로 처리
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
    console.error('초�?코드 처리 ?�류:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ?�용???�?�보??조회
app.get('/api/dashboard/:did', async (req, res) => {
  try {
    const dashboard = await protocol.getUserDashboard(req.params.did);
    res.json(dashboard);
  } catch (error) {
    console.error('?�?�보??조회 ?�패:', error);
    res.status(500).json({ error: '?�?�보??조회 ?�패', details: error.message });
  }
});

// ?�용??지�??�보 조회
app.get('/api/wallet/:did', async (req, res) => {
  try {
    const wallet = await protocol.getUserWallet(req.params.did);
    res.json(wallet);
  } catch (error) {
    console.error('지�??�보 조회 ?�패:', error);
    res.status(500).json({ error: '지�??�보 조회 ?�패', details: error.message });
  }
});

// ?�큰 ?�송
app.post('/api/transfer', async (req, res) => {
  try {
    console.log('?�� ?�큰 ?�송 ?�청 받음');
    console.log('?�� ?�청 본문:', JSON.stringify(req.body, null, 2));
    console.log('?�� ?�더:', req.headers);
    
    const { fromDID, toAddress, amount, tokenType = 'B-Token', authData } = req.body;
    
    console.log('?�� ?�싱???�이??');
    console.log(`  - fromDID: ${fromDID} (?�?? ${typeof fromDID})`);
    console.log(`  - toAddress: ${toAddress} (?�?? ${typeof toAddress})`);
    console.log(`  - amount: ${amount} (?�?? ${typeof amount})`);
    console.log(`  - tokenType: ${tokenType}`);
    console.log(`  - authData: ${JSON.stringify(authData)}`);
    
    if (!fromDID || !toAddress || !amount || amount <= 0) {
      console.log('???�라미터 검�??�패:');
      console.log(`  - fromDID 존재: ${!!fromDID}`);
      console.log(`  - toAddress 존재: ${!!toAddress}`);
      console.log(`  - amount 존재: ${!!amount}`);
      console.log(`  - amount > 0: ${amount > 0}`);
      
      return res.status(400).json({
        success: false,
        error: '발신??DID, 받는 주소, ?�효??금액???�요?�니??
      });
    }
    
    // toAddress가 DID?��?, ?�신주소?��?, ?�이?�인지 ?�인?�고 DID�?변??    let toDID = toAddress;
    if (!toAddress.startsWith('did:baekya:')) {
      // ?�신주소???�이?�로 DID 찾기
      const authSystem = protocol.components.authSystem;
      
      console.log(`?�� 주소 변???�도: ${toAddress}`);
      
      // ?�이???�는 ?�화번호 ?�식?�면 ?�이??추�?
      let normalizedAddress = toAddress;
      if (/^010\d{8}$/.test(toAddress)) {
        // 01012345678 ??010-1234-5678
        normalizedAddress = `${toAddress.slice(0, 3)}-${toAddress.slice(3, 7)}-${toAddress.slice(7)}`;
        console.log(`?�� ?�화번호 ?�식 변?? ${toAddress} ??${normalizedAddress}`);
      }
      
      // 먼�? ?�신주소�??�도
      const byCommAddress = authSystem.getDIDByCommAddress(normalizedAddress);
      console.log('?�신주소 검??결과:', byCommAddress);
      
      if (byCommAddress.success) {
        toDID = byCommAddress.didHash;
        console.log(`???�신주소�?DID 찾기 ?�공: ${toDID}`);
      } else {
        // ?�이?�로 ?�도 (?�래 주소 그�?�??�용)
        const byUserId = authSystem.getDIDByUsername(toAddress);
        console.log('?�이??검??결과:', byUserId);
        
        if (byUserId.success) {
          toDID = byUserId.didHash;
          console.log(`???�이?�로 DID 찾기 ?�공: ${toDID}`);
        } else {
          console.log(`??주소 찾기 ?�패: ${toAddress}`);
          return res.status(404).json({
            success: false,
            error: `받는 주소�?찾을 ???�습?�다: ${toAddress}`
          });
        }
      }
    }
    
    // ?�합 ?�증 검�?(SimpleAuth ?�용)
    const authResult = protocol.components.authSystem.verifyForAction(fromDID, authData, 'token_transfer');
    if (!authResult.authorized) {
      return res.status(401).json({ 
        success: false, 
        error: '?�증 ?�패', 
        details: authResult.message 
      });
    }
    
    // ?�수�?계산 (0.1%)
    const fee = amount * 0.001; // 0.1%
    const totalAmount = amount + fee;
    const feeToValidator = fee * 1.0; // ?�수료의 100%??검증자 ?��?    const feeToDAO = fee * 0.0; // ?�수료의 0%??DAO 금고�?    
    console.log('?�� ?�수�?계산:');
    console.log(`  - ?�송 금액: ${amount}B`);
    console.log(`  - ?�수�?(0.1%): ${fee}B`);
          console.log(`  - 검증자 ?� (100%): ${feeToValidator}B`);
      console.log(`  - DAO 분배 (0%): ${feeToDAO}B`);
    console.log(`  - ?�용??�?지불액: ${totalAmount}B`);
    
    // ?�액 ?�인
    const currentBalance = protocol.getBlockchain().getBalance(fromDID, tokenType);
    if (currentBalance < totalAmount) {
      return res.status(400).json({
        success: false,
        error: `${tokenType} ?�액??부족합?�다 (?�요: ${totalAmount}, 보유: ${currentBalance})`
      });
    }
    
    try {
      // ?�큰 ?�송 ?�랜??�� ?�성
      const transferTx = new Transaction(
        fromDID,
        toDID,
        amount, // 받는 ?�람??받을 ?�제 금액
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
      
      // ?�수�??�랜??�� ?�성 (발신??-> ?�스??
      const feeTx = new Transaction(
        fromDID,
        'did:baekya:system0000000000000000000000000000000003', // ?�수�??�집 주소
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
      
      // 블록체인???�랜??�� 추�?
      const addResult1 = protocol.getBlockchain().addTransaction(transferTx);
      const addResult2 = protocol.getBlockchain().addTransaction(feeTx);
      
      if (!addResult1.success || !addResult2.success) {
        throw new Error('?�랜??�� 추�? ?�패');
      }
      
      // ?�랜??��?� 추�??�었�?검증자가 블록???�성???�정
      console.log(`?�� ?�큰 ?�송 ?�랜??�� 추�???(?��?�?`);
      
      // ?�랜??��??추�??�었?��?�??�답?� 바로 처리
      if (true) {
        
        // 검증자 ?� ?�데?�트??BlockchainCore??updateStorageFromBlock?�서 처리??        // 직접 ?�데?�트 ?�거
        
        // DAO ?�수�?분배 - 100% 검증자 ?��?변경됨?�로 ?�거??        
        // ?�데?�트??지�??�보 브로?�캐?�트
        const updatedFromWallet = await protocol.getUserWallet(fromDID);
        const updatedToWallet = await protocol.getUserWallet(toDID);
        
        // 발신???�보 가?�오�?        const fromUserInfo = protocol.components.authSystem.getDIDInfo(fromDID);
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
          message: `${amount} ${tokenType} ?�송 ?�랜??��??추�??�었?�니??,
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
        throw new Error('블록 ?�성 ?�패');
      }
    } catch (error) {
      console.error('?�큰 ?�송 블록 ?�성 ?�패:', error);
      res.status(500).json({
        success: false,
        error: '?�큰 ?�송 ?�패',
        details: error.message
      });
    }
  } catch (error) {
    console.error('?�큰 ?�송 ?�패:', error);
    res.status(500).json({ 
      success: false, 
      error: '?�큰 ?�송 ?�패', 
      details: error.message 
    });
  }
});

// 검증자 ?� ?�원
app.post('/api/validator-pool/sponsor', async (req, res) => {
  try {
    const { sponsorDID, amount } = req.body;
    
    if (!sponsorDID || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: '?�원??DID?� ?�효??금액???�요?�니??
      });
    }
    
    // ?�수�?계산 (고정 0B - ?�수�??�음)
    const fee = 0;
    const totalAmount = amount + fee; // ?�용?��? 지불하??총액
    const feeToValidator = fee * 1.0; // ?�수료의 100%??검증자 ?��?(0.001B)
    const feeToDAO = fee * 0.0; // ?�수료의 0%??DAO 금고�?(0B)
    
    // B-?�큰 차감 (?�원�?+ ?�수�?
    const currentBalance = protocol.getBlockchain().getBalance(sponsorDID, 'B-Token');
    if (currentBalance < totalAmount) {
      return res.status(400).json({
        success: false,
        error: `B-?�큰 ?�액??부족합?�다 (?�요: ${totalAmount}B, 보유: ${currentBalance}B)`
      });
    }
    
    // 검증자 ?��??�큰 ?�송 (직접 블록체인??기록)
    const validatorPoolSystemAddress = 'did:baekya:system0000000000000000000000000000000001';
    
    try {
      // 검증자 ?� ?�원 ?�랜??�� ?�성 (?�용?�는 �?10.001B 지�?
      const poolTx = new Transaction(
        sponsorDID,
        validatorPoolSystemAddress,
        totalAmount, // ?�용?��? 지불하??총액 (10.001B)
        'B-Token',
        { 
          type: 'validator_pool_sponsor', 
          actualSponsorAmount: amount, // ?�제 ?�원�?(10B)
          validatorFee: feeToValidator, // 검증자 ?��?가???�수�?(0.0006B)
          daoFee: feeToDAO // DAO�?가???�수�?(0.0004B)
        }
      );
      poolTx.sign('test-key'); // 개발 ?�경???�스???�로 ?�바�??�명 ?�성
      
      // ?�버�? ?�랜??�� ?�보 출력
      console.log('?�� ?�랜??�� ?�버�??�보:');
      console.log(`  NODE_ENV: ${process.env.NODE_ENV || '?�정?��? ?�음'}`);
      console.log(`  발신?? ${sponsorDID}`);
      console.log(`  ?�신?? ${validatorPoolSystemAddress}`);
      console.log(`  ?�랜??�� 금액: ${totalAmount}B (차감?�는 총액)`);
      console.log(`  ?�명: ${poolTx.signature ? '?�음' : '?�음'}`);
      console.log(`  ?�시: ${poolTx.hash}`);
      
      // ?�랜??�� ?�효???�동 검�?      const isValidTx = poolTx.isValid();
      console.log(`  ?�랜??�� ?�효?? ${isValidTx ? '?�효' : '무효'}`);
      
      if (!isValidTx) {
        console.error('???�랜??�� ?�효??검�??�패 - ?��? 검???�작');
        
        // �?검�??�계별로 ?�인
        console.log(`  - fromDID: ${poolTx.fromDID ? '존재' : '?�음'}`);
        console.log(`  - toDID: ${poolTx.toDID ? '존재' : '?�음'}`);
        console.log(`  - amount: ${typeof poolTx.amount} (${poolTx.amount})`);
        console.log(`  - amount > 0: ${poolTx.amount > 0}`);
        console.log(`  - tokenType: ${poolTx.tokenType}`);
        console.log(`  - ?�큰?�???�효: ${['B-Token', 'P-Token'].includes(poolTx.tokenType)}`);
        console.log(`  - fromDID ?�식: ${poolTx.isValidDIDFormat(poolTx.fromDID)}`);
        console.log(`  - toDID ?�식: ${poolTx.isValidDIDFormat(poolTx.toDID)}`);
        console.log(`  - ?�명 존재: ${poolTx.signature ? '?�음' : '?�음'}`);
        
        if (poolTx.signature) {
          console.log(`  - ?�명 검�? ${poolTx.verifySignatureSecure()}`);
        }
      }
      
      // 블록체인???�랜??�� 추�?
      const addResult = protocol.getBlockchain().addTransaction(poolTx);
      console.log(`?�� addTransaction 결과: ${addResult.success ? '?�공' : '?�패'}`);
      if (!addResult.success) {
        console.error(`??addTransaction ?�패 ?�인: ${addResult.error}`);
        throw new Error(addResult.error || '?�랜??�� 추�? ?�패');
      }
      
      // ?�랜??��?� 추�??�었�?검증자가 블록???�성???�정
      console.log(`?�� 검증자 ?� ?�원 ?�랜??�� 추�???(?��?�?`);
      
      // ?�랜??��??추�??�었?��?�??�답?� 바로 처리
      if (true) {
        
        // ?�간??지?�을 ?�어 블록체인 ?�데?�트가 ?�료?�도�???        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 최신 ?� ?�태 가?�오�?(블록체인?�서 ?�데?�트???�태)
        const poolStatus = protocol.components.storage.getValidatorPoolStatus();
        
        console.log(`?�� 검증자 ?� ?�원 ?�세:`);
        console.log(`  - ?�원?? ${sponsorDID.substring(0, 16)}...`);
        console.log(`  - ?�원 금액: ${amount}B`);
        console.log(`  - ?�수�?고정): ${fee}B`);
        console.log(`  - ?�용??지�?총액: ${totalAmount}B`);
        console.log(`?�� 검증자 ?� 총액: ${poolStatus.totalStake}B`);
        
        // 모든 ?�결???�라?�언?�에 검증자 ?� ?�데?�트 브로?�캐?�트
        broadcastPoolUpdate({
          balance: poolStatus.totalStake,
          contributions: poolStatus.contributions
        });
        
        // DAO ?�수�?분배 처리 - 100% 검증자 ?��?변경됨?�로 ?�거??        
        // ?�원?�에�??�데?�트??지�??�보 ?�송
        const updatedWallet = await protocol.getUserWallet(sponsorDID);
        broadcastStateUpdate(sponsorDID, {
          wallet: updatedWallet,
          validatorPool: poolStatus
        });
        
        res.json({
          success: true,
          message: `검증자 ?�??${amount}B ?�원 ?�랜??��??추�??�었?�니??(?�수�?${fee}B 별도)`,
          transactionId: poolTx.hash,
          status: 'pending',
          poolStatus: {
            balance: poolStatus.totalStake,
            contributions: poolStatus.contributions
          }
        });
      } else {
        throw new Error(block?.error || '블록 ?�성 ?�패');
      }
    } catch (error) {
      console.error('검증자 ?� ?�원 블록 ?�성 ?�패:', error);
      res.status(500).json({
        success: false,
        error: '검증자 ?� ?�원 ?�패',
        details: error.message
      });
    }
  } catch (error) {
    console.error('검증자 ?� ?�원 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '검증자 ?� ?�원 ?�패',
      details: error.message 
    });
  }
});

// DAO 금고 ?�원
app.post('/api/dao/treasury/sponsor', async (req, res) => {
  try {
    const { sponsorDID, daoId, amount } = req.body;
    
    if (!sponsorDID || !daoId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: '?�원??DID, DAO ID, ?�효??금액???�요?�니??
      });
    }
    
    // DAO 존재 ?��? ?�인
    const dao = protocol.getDAO(daoId);
    if (!dao || !dao.dao) {
      return res.status(404).json({
        success: false,
        error: '존재?��? ?�는 DAO?�니??
      });
    }
    
    // ?�수�?계산 (고정 0.001B)
    const fee = 0.001;
    const totalAmount = amount + fee; // ?�용?��? 지불하??총액
    const feeToValidator = fee * 1.0; // ?�수료의 100%??검증자 ?��?(0.001B)
    const feeToDAO = fee * 0.0; // ?�수료의 0%??DAO 금고�?(0B) - ?�속 DAO?�에 분배
    
    // B-?�큰 ?�액 ?�인
    const currentBalance = protocol.getBlockchain().getBalance(sponsorDID, 'B-Token');
    if (currentBalance < totalAmount) {
      return res.status(400).json({
        success: false,
        error: `B-?�큰 ?�액??부족합?�다 (?�요: ${totalAmount}B, 보유: ${currentBalance}B)`
      });
    }
    
    // DAO 금고 주소??검증자 ?� 주소?� ?�일???�스??주소 ?�용
    // (?�제 DAO�?구분?� data ?�드??targetDaoId�?처리)
    const daoTreasurySystemAddress = 'did:baekya:system0000000000000000000000000000000002';
    
    try {
      // DAO 금고 ?�원 ?�랜??�� ?�성
      const treasuryTx = new Transaction(
        sponsorDID,
        daoTreasurySystemAddress,
        totalAmount, // ?�용?��? 지불하??총액
        'B-Token',
        { 
          type: 'dao_treasury_sponsor',
          targetDaoId: daoId,
          targetDaoName: dao.dao.name,
          actualSponsorAmount: amount, // ?�제 ?�원�?          validatorFee: feeToValidator, // 검증자 ?��?가???�수�?(0.0006B)
          daoFee: feeToDAO // DAO?�에�?분배???�수�?(0.0004B)
        }
      );
      treasuryTx.sign('test-key');
      
      // ?�랜??�� ?�버�??�보
      console.log('?���?DAO 금고 ?�원 ?�랜??��:');
      console.log(`  발신?? ${sponsorDID.substring(0, 16)}...`);
      console.log(`  ?�??DAO: ${dao.dao.name} (${daoId})`);
      console.log(`  ?�랜??�� 금액: ${totalAmount}B`);
      console.log(`  ?�제 ?�원�? ${amount}B`);
      console.log(`  ?�수�?분배:`);
      console.log(`    - 검증자 ?�(100%): ${feeToValidator}B`);
      console.log(`    - DAO 금고(0%): ${feeToDAO}B`);
      
      // 블록체인???�랜??�� 추�?
      const addResult = protocol.getBlockchain().addTransaction(treasuryTx);
      if (!addResult.success) {
        throw new Error(addResult.error || '?�랜??�� 추�? ?�패');
      }
      
      // ?�랜??��?� 추�??�었�?검증자가 블록???�성???�정
      console.log(`?�� DAO 금고 ?�원 ?�랜??�� 추�???(?��?�?`);
      
      // ?�랜??��??추�??�었?��?�??�답?� 바로 처리
      if (true) {
        
        // DAO 금고?� 검증자 ?� ?�데?�트??BlockchainCore??updateStorageFromBlock?�서 처리??        // ?�기?�는 직접 ?�데?�트?��? ?�음
        
        // DAO ?�수�?분배 처리 - 100% 검증자 ?��?변경됨?�로 ?�거??        const daoTreasuries = {};
        
        // ?�??DAO???�재 ?�액 가?�오�?(블록체인?�서 ?�데?�트????
        // ?�간??지?�을 ?�어 블록체인 ?�데?�트가 ?�료?�도�???        await new Promise(resolve => setTimeout(resolve, 100));
        
        const targetDAOData = protocol.components.storage.getDAO(daoId);
        const newTreasury = targetDAOData ? targetDAOData.treasury : 0;
        daoTreasuries[daoId] = newTreasury;
        
        // 검증자 ?� ?�태 가?�오�?        const poolStatus = protocol.components.storage.getValidatorPoolStatus();
        
        console.log(`\n?���?DAO 금고 ?�원 ?�료:`);
        console.log(`  - ${dao.dao.name} 금고: +${amount}B ??�?${newTreasury}B`);
        console.log(`  - 검증자 ?�: +${feeToValidator}B ??�?${poolStatus.totalStake}B`);
        
        // 모든 ?�결???�라?�언?�에 브로?�캐?�트
        broadcastDAOTreasuryUpdate(daoTreasuries);
        broadcastPoolUpdate({
          balance: poolStatus.totalStake,
          contributions: poolStatus.contributions
        });
        
        // ?�원?�에�??�데?�트??지�??�보 ?�송
        const updatedWallet = await protocol.getUserWallet(sponsorDID);
        broadcastStateUpdate(sponsorDID, {
          wallet: updatedWallet,
          daoTreasuries: daoTreasuries
        });
        
        res.json({
          success: true,
          message: `${dao.dao.name} 금고??${amount}B ?�원 ?�랜??��??추�??�었?�니??(?�수�?${fee}B 별도)`,
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
        throw new Error(block?.error || '블록 ?�성 ?�패');
      }
    } catch (error) {
      console.error('DAO 금고 ?�원 블록 ?�성 ?�패:', error);
      res.status(500).json({
        success: false,
        error: 'DAO 금고 ?�원 ?�패',
        details: error.message
      });
    }
  } catch (error) {
    console.error('DAO 금고 ?�원 ?�패:', error);
    res.status(500).json({
      success: false,
      error: 'DAO 금고 ?�원 ?�패',
      details: error.message 
    });
  }
});

// ?�합 ?�증 검�?(SimpleAuth ?�용)
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { didHash, authData, action } = req.body;
    
    if (!didHash || !authData || !action) {
      return res.status(400).json({
        success: false,
        error: 'DID, ?�증 ?�이?? ?�업 ?�?�이 ?�요?�니??
      });
    }
    
    const authSystem = protocol.components.authSystem; // SimpleAuth ?�용
    const result = authSystem.verifyForAction(didHash, authData, action);
    
    res.json(result);
  } catch (error) {
    console.error('?�합 ?�증 검�??�패:', error);
    res.status(500).json({
      success: false,
      error: '?�증 검�??�패',
      details: error.message
    });
  }
});

// P2P ?�화 ?�청
app.post('/api/p2p/call/initiate', async (req, res) => {
  try {
    const { fromDID, fromCommAddress, toCommAddress, callType } = req.body;
    
    if (!fromDID || !fromCommAddress || !toCommAddress) {
      return res.status(400).json({
        success: false,
        error: '발신??DID, 발신???�신주소, ?�신???�신주소가 ?�요?�니??
      });
    }
    
    const p2pNetwork = protocol.getBlockchain().p2pNetwork;
    const result = p2pNetwork.initiateCall(fromDID, fromCommAddress, toCommAddress, callType);
    
    res.json(result);
  } catch (error) {
    console.error('?�화 ?�청 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '?�화 ?�청 ?�패',
      details: error.message
    });
  }
});

// P2P ?�화 ?�답
app.post('/api/p2p/call/respond', async (req, res) => {
  try {
    const { callId, accepted, reason } = req.body;
    
    if (!callId || typeof accepted !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: '?�화 ID?� ?�락 ?��?가 ?�요?�니??
      });
    }
    
    const p2pNetwork = protocol.getBlockchain().p2pNetwork;
    const result = p2pNetwork.respondToCall(callId, accepted, reason);
    
    res.json(result);
  } catch (error) {
    console.error('?�화 ?�답 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '?�화 ?�답 ?�패',
      details: error.message
    });
  }
});

// P2P ?�화 종료
app.post('/api/p2p/call/end', async (req, res) => {
  try {
    const { callId, endedBy, duration } = req.body;
    
    if (!callId || !endedBy) {
      return res.status(400).json({
        success: false,
        error: '?�화 ID?� 종료???�보가 ?�요?�니??
      });
    }
    
    const p2pNetwork = protocol.getBlockchain().p2pNetwork;
    const result = p2pNetwork.endCall(callId, endedBy, duration || 0);
    
    res.json(result);
  } catch (error) {
    console.error('?�화 종료 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '?�화 종료 ?�패',
      details: error.message
    });
  }
});

// ?�신주소 ?�데?�트
app.post('/api/update-communication-address', async (req, res) => {
  try {
    const { didHash, newAddress } = req.body;
    
    if (!didHash || !newAddress) {
      return res.status(400).json({
        success: false,
        error: 'DID?� ?�로???�신주소가 ?�요?�니??
      });
    }
    
    const authSystem = protocol.components.authSystem;
    const result = authSystem.updateCommunicationAddress(didHash, newAddress);
    
    if (result.success) {
      console.log(`?�� ?�신주소 ?�데?�트 ?�공: ${didHash} ??${newAddress}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error('?�신주소 ?�데?�트 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '?�신주소 ?�데?�트 ?�패',
      details: error.message
    });
  }
});

// ?�용??기여 ?�역 조회
app.get('/api/contributions/:did', async (req, res) => {
  try {
    const { did } = req.params;
    const { daoId } = req.query;
    
    if (!did) {
      return res.status(400).json({
        success: false,
        error: 'DID가 ?�요?�니??
      });
    }
    
    const contributions = protocol.components.storage.getUserContributions(did, daoId);
    
    res.json({
      success: true,
      contributions: contributions,
      totalCount: contributions.length
    });
  } catch (error) {
    console.error('기여 ?�역 조회 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '기여 ?�역 조회 ?�패',
      details: error.message 
    });
  }
});

// DAO 기여 ?�계 조회
app.get('/api/dao/:daoId/contribution-stats', async (req, res) => {
  try {
    const { daoId } = req.params;
    
    const stats = protocol.components.storage.getDAOContributionStats(daoId);
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('DAO 기여 ?�계 조회 ?�패:', error);
    res.status(500).json({ 
      success: false, 
      error: 'DAO 기여 ?�계 조회 ?�패',
      details: error.message 
    });
  }
});

// P2P ?�락�?검??(?�신주소 ?�는 ?�이?�로 DID 찾기)
app.get('/api/p2p/find-contact/:searchTerm', async (req, res) => {
  try {
    const { searchTerm } = req.params;
    
    console.log(`?�� P2P 검???�청: "${searchTerm}"`);
    
    const authSystem = protocol.components.authSystem; // SimpleAuth ?�용
    let result = null;
    let searchType = '';
    
    // 1. 먼�? ?�이?�로 검???�도
    const usernameResult = authSystem.getDIDByUsername(searchTerm);
    if (usernameResult.success) {
      // ?�이?�로 찾�? 경우, ?�당 DID???�신주소�?가?�오�?      const didInfo = authSystem.getDIDInfo(usernameResult.didHash);
      if (didInfo.success) {
        result = {
          success: true,
          communicationAddress: didInfo.didData.communicationAddress
        };
        searchType = 'username';
        console.log(`???�이?�로 ?�용??찾음: ${searchTerm} ??${didInfo.didData.communicationAddress}`);
      }
    }
    
    // 2. ?�이?�로 찾�? 못했?�면 ?�신주소�?검??    if (!result) {
      let commAddress = searchTerm;
      
      // ?�자로만 ?�루?�져 ?�고 11?�리�??�신주소�??�식?�여 ?�이??추�?
      if (/^\d{11}$/.test(searchTerm)) {
        commAddress = `${searchTerm.slice(0, 3)}-${searchTerm.slice(3, 7)}-${searchTerm.slice(7)}`;
        console.log(`?�� ?�이???�는 ?�신주소 감�?: ${searchTerm} ??${commAddress}`);
      }
      
      const commResult = authSystem.getDIDByCommAddress(commAddress);
      if (commResult.success) {
        result = commResult;
        searchType = 'communicationAddress';
        console.log(`???�신주소�??�용??찾음: ${commAddress}`);
      }
    }
    
    if (result && result.success) {
      // DID ?�보�?가?��????�용???�름�??�이???�함
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
      
      // ?�락�??�보 반환 (개인?�보???�외?�되 기본 ?�보???�함)
      res.json({
        success: true,
        found: true,
        communicationAddress: result.communicationAddress,
        username: userInfo ? userInfo.username : null,
        name: userInfo ? userInfo.name : null,
        searchType: searchType, // 검??방식 ?�보 추�?
        isActive: true // ?�제로는 ?�라???�태 체크 ?�요
      });
    } else {
      console.log(`???�용?��? 찾�? 못함: ${searchTerm}`);
      res.json({
        success: true,
        found: false,
        message: '?�당 ?�이???�는 ?�신주소???�용?��? 찾을 ???�습?�다'
      });
    }
  } catch (error) {
    console.error('?�락�?검???�패:', error);
    res.status(500).json({ 
      success: false, 
      error: '?�락�?검???�패',
      details: error.message 
    });
  }
});

// 마이???�태 조회
app.get('/api/mining/:did', async (req, res) => {
  try {
    const miningStatus = await protocol.getMiningStatus(req.params.did);
    res.json(miningStatus);
  } catch (error) {
    console.error('마이???�태 조회 ?�패:', error);
    res.status(500).json({ error: '마이???�태 조회 ?�패', details: error.message });
  }
});

// 블록체인 ?�태 조회
app.get('/api/blockchain/status', (req, res) => {
  try {
    const blockchainStatus = protocol.getBlockchainStatus();
    res.json(blockchainStatus);
  } catch (error) {
    console.error('블록체인 ?�태 조회 ?�패:', error);
    res.status(500).json({ error: '블록체인 ?�태 조회 ?�패', details: error.message });
  }
});

// GitHub 중앙 ?�훅 ?�드?�인??(백야 ?�로?�콜 ?�본 ?�?�소??
app.post('/api/webhook/github/central', async (req, res) => {
  try {
    const payload = req.body;
    const eventType = req.headers['x-github-event'] || 'unknown';
    
    // 불필?�한 ?�션?� 로그 출력?��? ?�고 조용??무시
    const ignoredActions = ['opened', 'synchronize', 'reopened', 'edited'];
    if (ignoredActions.includes(payload.action)) {
      return res.json({
        success: true,
        message: `${payload.action} event ignored`,
        eventType: eventType,
        action: payload.action
      });
    }

    console.log(`?�� GitHub 중앙 ?�훅 ?�신`);
    console.log(`?�� ?�벤???�?? ${eventType}`);
    console.log(`?�� ?�션: ${payload.action || 'none'}`);
    console.log(`?�� ?�?�소: ${payload.repository?.full_name || 'unknown'}`);
    
    // 백야 ?�로?�콜 ?�본 ?�?�소?��? ?�인
    if (payload.repository?.full_name !== 'baekya-protocol/baekya-protocol') {
      console.log(`?�️ 처리 ?�?�이 ?�닌 ?�?�소: ${payload.repository?.full_name}`);
      return res.json({
        success: true,
        message: 'Repository not monitored',
        repository: payload.repository?.full_name
      });
    }
    
    // GitHub ping ?�벤??처리
    if (eventType === 'ping') {
      console.log(`?�� GitHub 중앙 ?�훅 ping ?�벤??처리`);
      return res.json({
        success: true,
        message: 'Central webhook ping received successfully',
        webhookConfigured: true
      });
    }
    
    // 중앙 ?�훅 ?�벤??처리
    if (githubIntegration) {
      const result = await githubIntegration.handleCentralWebhookEvent(payload, eventType);
      
      if (result.success) {
        console.log(`??중앙 ?�훅 ?�벤??처리 ?�료: ${result.message}`);
      } else {
        console.log(`?�️ 중앙 ?�훅 ?�벤??처리 ?�패: ${result.message}`);
      }
      
      res.json(result);
    } else {
      console.error('GitHub ?�합 ?�스?�이 초기?�되지 ?�았?�니??);
      res.status(503).json({
        success: false,
        error: 'GitHub ?�합 ?�스?�이 초기?�되지 ?�았?�니??
      });
    }
  } catch (error) {
    console.error('GitHub 중앙 ?�훅 처리 ?�패:', error);
    res.status(500).json({
      success: false,
      error: 'GitHub 중앙 ?�훅 처리 ?�패',
      details: error.message
    });
  }
});

// GitHub 개별 ?�훅 ?�드?�인??(?�환?�을 ?�해 ?��?)
app.post('/api/webhook/github/:integrationId', async (req, res) => {
  try {
    const { integrationId } = req.params;
    const payload = req.body;
    const eventType = req.headers['x-github-event'] || 'unknown';
    
    console.log(`?�� GitHub 개별 ?�훅 ?�신: ${integrationId}`);
    console.log(`?�� ?�벤???�?? ${eventType}`);
    console.log(`?�� ?�션: ${payload.action || 'none'}`);
    console.log(`?�� ?�?�소: ${payload.repository?.full_name || 'unknown'}`);
    
    // GitHub ping ?�벤??처리
    if (eventType === 'ping') {
      console.log(`?�� GitHub ping ?�벤??처리`);
      return res.json({
        success: true,
        message: 'Ping received successfully',
        webhookConfigured: true
      });
    }
    
    // 중앙 ?�훅?�로 리디?�션 ?�내
    console.log(`?�️ 개별 ?�훅?� ???�상 지?�되지 ?�습?�다. 중앙 ?�훅???�용?�세??`);
    res.json({
      success: true,
      message: '개별 ?�훅?� ???�상 지?�되지 ?�습?�다. 중앙 ?�훅???�용?�세??',
      centralWebhookUrl: getWebhookUrl() ? `${getWebhookUrl()}/api/webhook/github/central` : `https://baekya-node-3000.loca.lt/api/webhook/github/central`
    });
  } catch (error) {
    console.error('GitHub 개별 ?�훅 처리 ?�패:', error);
    res.status(500).json({
      success: false,
      error: 'GitHub 개별 ?�훅 처리 ?�패',
      details: error.message
    });
  }
});

// GitHub ?�훅 ?�벤??처리 ?�수
async function processGitHubWebhook(integrationData, payload, eventType) {
  try {
    const { userDID, repository, dcaTypes } = integrationData;
    
    console.log(`?�� GitHub ?�벤??처리 ?�작: ${eventType}`);
    console.log(`?�� ?�용?? ${userDID.substring(0, 8)}...`);
    console.log(`?�� ?�?�소: ${repository.fullName}`);
    
    // Pull Request ?�벤??처리
    if (eventType === 'pull_request' && payload.pull_request) {
      const pr = payload.pull_request;
      
      console.log(`?�� PR ?�벤?? ${payload.action}, PR #${pr.number}: ${pr.title}`);
      console.log(`?�� PR ?�태: merged=${pr.merged}, state=${pr.state}`);
      
      // PR 병합 처리
      if (payload.action === 'closed' && pr.merged) {
        const reward = dcaTypes.pull_request?.reward || 250;
        
        console.log(`?�� PR 병합 감�?! PR #${pr.number} ??보상: ${reward}B`);
        
        // 블록체인 ?�랜??�� ?�성

        const rewardTransaction = new Transaction(
          'did:baekya:system000000000000000000000000000000000', // ?�스?�에??지�?          userDID, // 기여?�에�?          reward, // 250B
          'B-Token',
          'pr_merged_reward', // 메모
          {
            type: 'dca_reward',
            dcaType: 'pull_request',
            prNumber: pr.number,
            prTitle: pr.title,
            prUrl: pr.html_url,
            repository: repository.fullName,
            mergedAt: pr.merged_at,
            integrationId: integrationData.id
          }
        );
        
        // ?�랜??��???�명 (?�스???�랜??��)
        rewardTransaction.signature = 'system-dca-reward-signature';
        
        // 블록체인???�랜??�� 추�? (pendingTransactions???�어�?
        const blockchain = protocol.getBlockchain();
        const txResult = blockchain.addTransaction(rewardTransaction);
        
        if (txResult.success) {
          console.log(`??PR 병합 보상 ?�랜??�� ?�성 ?�공: ${rewardTransaction.hash}`);
          
          // 기여 ?�역 ?�??(블록 ?�성?�면 ?�동?�로 ?�?�됨)
          const contribution = {
            id: `pr_${pr.number}_${Date.now()}`,
            type: 'pull_request',
            title: pr.title,
            dcaId: 'pull-request',
            evidence: pr.html_url,
            description: `PR #${pr.number}: ${pr.title}`,
            bValue: reward,
            verified: true,
            verifiedAt: Date.now(),
            transactionHash: rewardTransaction.hash,
            metadata: {
              prNumber: pr.number,
              prUrl: pr.html_url,
              repository: repository.fullName,
              mergedAt: pr.merged_at
            }
          };
          
          protocol.components.storage.saveContribution(userDID, 'dev-dao', contribution);
          protocol.components.storage.saveGitHubContribution(userDID, contribution);
          
          // WebSocket ?�데?�트 (?�제 ?�액?� 블록 ?�성 ???�데?�트??
          broadcastStateUpdate(userDID, {
            newContribution: {
              dao: 'dev-dao',
              type: 'pull_request',
              title: pr.title,
              bTokens: reward,
              description: `PR #${pr.number}: ${pr.title}`,
              date: new Date().toISOString().split('T')[0],
              evidence: pr.html_url,
              status: 'pending_block' // 블록 ?�성 ?��?�?            }
          });
          
          return {
            success: true,
            message: 'PR 병합 보상 ?�랜??�� ?�성 ?�료',
            contribution: contribution,
            transactionHash: rewardTransaction.hash
          };
        } else {
          console.error('??PR 병합 보상 ?�랜??�� ?�성 ?�패:', txResult.error);
          return {
            success: false,
            error: 'PR 병합 보상 ?�랜??�� ?�성 ?�패',
            details: txResult.error
          };
        }
      } else {
        console.log(`?�️ PR ?�벤??무시: action=${payload.action}, merged=${pr.merged}`);
      }
    }
    
    // Pull Request Review ?�벤??처리
    if (eventType === 'pull_request_review' && payload.review && payload.action === 'submitted') {
      const review = payload.review;
      const pr = payload.pull_request;
      const reward = dcaTypes.pull_request_review?.reward || 120;
      
      console.log(`?�� PR 리뷰 감�?! PR #${pr.number} 리뷰 ??보상: ${reward}B`);
      
      // 블록체인 ?�랜??�� ?�성

      const rewardTransaction = new Transaction(
        'did:baekya:system000000000000000000000000000000000',
        userDID,
        reward,
        'B-Token',
        'pr_review_reward',
        {
          type: 'dca_reward',
          dcaType: 'pull_request_review',
          reviewId: review.id,
          prNumber: pr.number,
          prTitle: pr.title,
          reviewUrl: review.html_url,
          repository: repository.fullName,
          submittedAt: review.submitted_at,
          integrationId: integrationData.id
        }
      );
      
      rewardTransaction.signature = 'system-dca-reward-signature';
      
      const blockchain = protocol.getBlockchain();
      const txResult = blockchain.addTransaction(rewardTransaction);
      
      if (txResult.success) {
        console.log(`??PR 리뷰 보상 ?�랜??�� ?�성 ?�공: ${rewardTransaction.hash}`);
        
        const contribution = {
          id: `pr_review_${review.id}_${Date.now()}`,
          type: 'pull_request_review',
          title: `PR #${pr.number} 리뷰`,
          dcaId: 'pull-request-review',
          evidence: review.html_url,
          description: `PR #${pr.number} 리뷰: ${pr.title}`,
          bValue: reward,
          verified: true,
          verifiedAt: Date.now(),
          transactionHash: rewardTransaction.hash,
          metadata: {
            reviewId: review.id,
            reviewUrl: review.html_url,
            prNumber: pr.number,
            repository: repository.fullName,
            submittedAt: review.submitted_at
          }
        };
        
        protocol.components.storage.saveContribution(userDID, 'dev-dao', contribution);
        protocol.components.storage.saveGitHubContribution(userDID, contribution);
        
        broadcastStateUpdate(userDID, {
          newContribution: {
            dao: 'dev-dao',
            type: 'pull_request_review',
            title: `PR #${pr.number} 리뷰`,
            bTokens: reward,
            description: `PR #${pr.number} 리뷰: ${pr.title}`,
            date: new Date().toISOString().split('T')[0],
            evidence: review.html_url,
            status: 'pending_block'
          }
        });
        
        return {
          success: true,
          message: 'PR 리뷰 보상 ?�랜??�� ?�성 ?�료',
          contribution: contribution,
          transactionHash: rewardTransaction.hash
        };
      } else {
        console.error('??PR 리뷰 보상 ?�랜??�� ?�성 ?�패:', txResult.error);
        return {
          success: false,
          error: 'PR 리뷰 보상 ?�랜??�� ?�성 ?�패',
          details: txResult.error
        };
      }
    }
    
    // Issues ?�벤??처리
    if (eventType === 'issues' && payload.issue && payload.action === 'closed') {
      const issue = payload.issue;
      const reward = dcaTypes.issue?.reward || 80;
      
      console.log(`?�� Issue ?�결 감�?! Issue #${issue.number} ??보상: ${reward}B`);
      
      // 블록체인 ?�랜??�� ?�성

      const rewardTransaction = new Transaction(
        'did:baekya:system000000000000000000000000000000000',
        userDID,
        reward,
        'B-Token',
        'issue_resolved_reward',
        {
          type: 'dca_reward',
          dcaType: 'issue',
          issueNumber: issue.number,
          issueTitle: issue.title,
          issueUrl: issue.html_url,
          repository: repository.fullName,
          closedAt: issue.closed_at,
          integrationId: integrationData.id
        }
      );
      
      rewardTransaction.signature = 'system-dca-reward-signature';
      
      const blockchain = protocol.getBlockchain();
      const txResult = blockchain.addTransaction(rewardTransaction);
      
      if (txResult.success) {
        console.log(`??Issue ?�결 보상 ?�랜??�� ?�성 ?�공: ${rewardTransaction.hash}`);
        
        const contribution = {
          id: `issue_${issue.number}_${Date.now()}`,
          type: 'issue',
          title: issue.title,
          dcaId: 'issue-report',
          evidence: issue.html_url,
          description: `Issue #${issue.number}: ${issue.title}`,
          bValue: reward,
          verified: true,
          verifiedAt: Date.now(),
          transactionHash: rewardTransaction.hash,
          metadata: {
            issueNumber: issue.number,
            issueUrl: issue.html_url,
            repository: repository.fullName,
            closedAt: issue.closed_at
          }
        };
        
        protocol.components.storage.saveContribution(userDID, 'dev-dao', contribution);
        protocol.components.storage.saveGitHubContribution(userDID, contribution);
        
        broadcastStateUpdate(userDID, {
          newContribution: {
            dao: 'dev-dao',
            type: 'issue',
            title: issue.title,
            bTokens: reward,
            description: `Issue #${issue.number}: ${issue.title}`,
            date: new Date().toISOString().split('T')[0],
            evidence: issue.html_url,
            status: 'pending_block'
          }
        });
        
        return {
          success: true,
          message: 'Issue ?�결 보상 ?�랜??�� ?�성 ?�료',
          contribution: contribution,
          transactionHash: rewardTransaction.hash
        };
      } else {
        console.error('??Issue ?�결 보상 ?�랜??�� ?�성 ?�패:', txResult.error);
        return {
          success: false,
          error: 'Issue ?�결 보상 ?�랜??�� ?�성 ?�패',
          details: txResult.error
        };
      }
    }
    
    // 처리?��? ?��? ?�벤??    console.log(`?�️ 처리?��? ?��? GitHub ?�벤?? ${eventType} (action: ${payload.action})`);
    return {
      success: true,
      message: `?�벤???�신 ?�료 (${eventType} - 처리?��? ?�음)`
    };
    
  } catch (error) {
    console.error('??GitHub ?�훅 처리 �??�류:', error);
    return {
      success: false,
      error: '?�훅 처리 ?�패',
      details: error.message
    };
  }
}

// GitHub PR ?��??�이???�드?�인??(?�스?�용)
app.post('/api/github/simulate-pr', async (req, res) => {
  try {
    const { userDID, action, prNumber, prTitle, repository } = req.body;
    
    if (!userDID || !action || !prNumber || !prTitle || !repository) {
      return res.status(400).json({
        success: false,
        error: '?�수 ?�라미터가 ?�락?�었?�니??(userDID, action, prNumber, prTitle, repository)'
      });
    }
    
    // ?�당 ?�용?�의 GitHub ?�동 ?�보 조회
    const integrations = protocol.components.storage.getGitHubIntegrations(userDID);
    const integration = integrations.find(i => i.repository.fullName === repository);
    
    if (!integration) {
      return res.status(404).json({
        success: false,
        error: `${repository} ?�?�소?� ?�동???�보�?찾을 ???�습?�다`
      });
    }
    
    // 가?�의 PR ?�훅 ?�이로드 ?�성
    const mockPayload = {
      action: action,
      pull_request: {
        number: prNumber,
        title: prTitle,
        html_url: `https://github.com/${repository}/pull/${prNumber}`,
        merged: action === 'closed',
        merged_at: action === 'closed' ? new Date().toISOString() : null,
        state: action === 'closed' ? 'closed' : 'open'
      },
      repository: {
        full_name: repository
      }
    };
    
    console.log(`?�� GitHub PR ?��??�이???�작: ${userDID} ??${repository} PR #${prNumber}`);
    
    // ?�훅 처리 ?�수 ?�출
    const result = await processGitHubWebhook(integration, mockPayload);
    
    if (result.success) {
      console.log(`??GitHub PR ?��??�이???�료: ${result.message}`);
    }
    
    res.json({
      success: true,
      message: 'PR ?��??�이???�료',
      simulation: {
        userDID: userDID,
        repository: repository,
        prNumber: prNumber,
        prTitle: prTitle,
        action: action
      },
      result: result
    });
    
  } catch (error) {
    console.error('GitHub PR ?��??�이???�패:', error);
    res.status(500).json({
      success: false,
      error: 'PR ?��??�이???�패',
      details: error.message
    });
  }
});

// Firebase Auth ?�큰 검�?미들?�어
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    
    // 개발 모드?�서??Firebase 검�?건너?�기
    if (!admin.apps.length) {
      console.log('?�️  개발 모드: Firebase ?�큰 검�?건너?�기');
      req.firebaseUser = {
        uid: 'dev_user',
        email: 'dev@localhost',
        name: req.body.githubUsername || 'dev_user'
      };
      return next();
    }
    
    if (!idToken) {
      return res.status(401).json({
        success: false,
        error: 'Firebase ID ?�큰???�요?�니??
      });
    }
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.firebaseUser = decodedToken;
      next();
    } catch (error) {
      console.error('Firebase ?�큰 검�??�패:', error);
      return res.status(401).json({
        success: false,
        error: 'Firebase ?�큰 검�??�패'
      });
    }
  } catch (error) {
    console.error('Firebase ?�큰 검�?미들?�어 ?�류:', error);
    return res.status(500).json({
      success: false,
      error: '?�큰 검�?�??�류 발생'
    });
  }
};

// GitHub 계정 ?�동 ?�정 (Firebase Auth 방식)
app.post('/api/github/link-account', verifyFirebaseToken, async (req, res) => {
  try {
    const { idToken, accessToken, githubUsername, userDID: clientUserDID } = req.body;
    const firebaseUser = req.firebaseUser;
    
    if (!githubUsername) {
      return res.status(400).json({
        success: false,
        error: 'githubUsername???�요?�니??
      });
    }
    
    // Firebase ?�용???�보 ?�인
    const firebaseUID = firebaseUser.uid;
    const userEmail = firebaseUser.email;
    const displayName = firebaseUser.name || githubUsername;
    
    console.log(`?�� Firebase ?�용???�증: ${displayName} (${githubUsername})`);
    console.log(`?�� ?�메?? ${userEmail}`);
    console.log(`?�� Firebase UID: ${firebaseUID}`);
    
    // 백야 ?�로?�콜 ?�용??DID ?�인
    let userDID = null;
    
    // 1. ?�라?�언?�에???�달??DID ?�용 (최우??
    if (clientUserDID) {
      userDID = clientUserDID;
      console.log(`?�� ?�라?�언??백야 ?�용?��? ?�동: ${userDID}`);
    } 
    // 2. Authorization ?�더?�서 가?�오�?    else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        userDID = authHeader.substring(7);
        console.log(`?�� ?�더 백야 ?�용?��? ?�동: ${userDID}`);
      } else {
        return res.status(400).json({
          success: false,
          error: '백야 ?�로?�콜??먼�? 로그?�해주세??
        });
      }
    }
    
    if (!userDID) {
      return res.status(400).json({
        success: false,
        error: 'userDID 처리 ?�패'
      });
    }
    
    // GitHub 계정 ?�동 ?�정
    if (githubIntegration) {
      try {
        const result = githubIntegration.setupUserGitHubMapping(userDID, githubUsername);
        
        if (result.success) {
          // 중앙 ?�훅 ?�정 (처음 ?�동 ?�에�?
          const centralWebhookUrl = getWebhookUrl() ? `${getWebhookUrl()}/api/webhook/github/central` : `https://baekya-node-3000.loca.lt/api/webhook/github/central`;
          githubIntegration.setupCentralWebhook(centralWebhookUrl);
          
          // GitHub 계정 ?�동 ?�료 ?�랜??�� ?�성
  
          const integrationTransaction = new Transaction(
            'did:baekya:system000000000000000000000000000000000',
            userDID,
            10,
            'B-Token',
            'github_account_linked',
            {
              type: 'github_integration',
              githubUsername: githubUsername,
              targetRepository: 'baekya-protocol/baekya-protocol',
              connectedAt: new Date().toISOString(),
              webhookUrl: centralWebhookUrl
            }
          );
          
          integrationTransaction.signature = 'system-integration-signature';
          
          const blockchain = protocol.getBlockchain();
          const txResult = blockchain.addTransaction(integrationTransaction);
          
          if (txResult.success) {
            console.log(`?�� GitHub 계정 ?�동 보상 ?�랜??�� ?�성: ${userDID} ??+10B (${githubUsername} ?�동)`);
            
            // ?�동 기여 ?�역 ?�??            const integrationContribution = {
              id: `github_account_${Date.now()}`,
              type: 'github_integration',
              title: `GitHub 계정 ?�동: ${githubUsername}`,
              dcaId: 'github-integration',
              evidence: `GitHub Username: ${githubUsername}`,
              description: `${githubUsername} GitHub 계정�??�동?�여 개발DAO DCA ?�행 준�??�료`,
              bValue: 10,
              verified: true,
              verifiedAt: Date.now(),
              transactionHash: integrationTransaction.hash,
              metadata: {
                githubUsername: githubUsername,
                targetRepository: 'baekya-protocol/baekya-protocol',
                webhookUrl: centralWebhookUrl
              }
            };
            
            protocol.components.storage.saveContribution(userDID, 'dev-dao', integrationContribution);
            
            // WebSocket?�로 ?�동 ?�료 ?�림
            broadcastStateUpdate(userDID, {
              newContribution: {
                dao: 'dev-dao',
                type: 'github_integration',
                title: `GitHub 계정 ?�동: ${githubUsername}`,
                bTokens: 10,
                description: `${githubUsername} GitHub 계정�??�동?�여 개발DAO DCA ?�행 준�??�료`,
                date: new Date().toISOString().split('T')[0],
                evidence: `GitHub Username: ${githubUsername}`,
                status: 'pending_block'
              }
            });
          }
          
          console.log(`?�� GitHub 계정 ?�동 ?�료: ${userDID} -> ${githubUsername}`);
          console.log(`?�� 중앙 ?�훅 URL: ${centralWebhookUrl}`);
          
          res.json({
            success: true,
            message: 'GitHub 계정 ?�동???�료?�었?�니??,
            githubUsername: githubUsername,
            targetRepository: 'baekya-protocol/baekya-protocol',
            centralWebhookUrl: centralWebhookUrl,
            integrationBonus: 10
          });
        } else {
          res.status(500).json({ error: result.message });
        }
      } catch (integrationError) {
        console.error('GitHub 계정 ?�동 ?�패:', integrationError);
        res.status(500).json({
          success: false,
          error: 'GitHub 계정 ?�동 ?�패',
          details: integrationError.message
        });
      }
    } else {
      res.status(503).json({
        success: false,
        error: 'GitHub ?�합 ?�스?�이 초기?�되지 ?�았?�니??
      });
    }
  } catch (error) {
    console.error('GitHub 계정 ?�동 ?�정 ?�패:', error);
    res.status(500).json({
      success: false,
      error: 'GitHub 계정 ?�동 ?�정 ?�패',
      details: error.message
    });
  }
});

// 개발DAO DCA ?�태 조회
app.get('/api/dev-dao/contributions/:userDID', async (req, res) => {
  try {
    const { userDID } = req.params;
    
    if (!githubIntegration) {
      return res.status(503).json({
        success: false,
        error: 'GitHub ?�합 ?�스?�이 초기?�되지 ?�았?�니??
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
    console.error('개발DAO 기여 ?�역 조회 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '개발DAO 기여 ?�역 조회 ?�패',
      details: error.message
    });
  }
});

// 커�??�티DAO DCA ?�태 조회
app.get('/api/community-dao/contributions/:userDID', async (req, res) => {
  try {
    const { userDID } = req.params;
    
    if (!communityIntegration) {
      return res.status(503).json({
        success: false,
        error: '커�??�티 ?�합 ?�스?�이 초기?�되지 ?�았?�니??
      });
    }
    
    const contributions = communityIntegration.getUserContributions(userDID);
    
    res.json({
      success: true,
      contributions: contributions
    });
  } catch (error) {
    console.error('커�??�티DAO 기여 ?�역 조회 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '커�??�티DAO 기여 ?�역 조회 ?�패',
      details: error.message
    });
  }
});

// 초�? 링크 ?�성
app.post('/api/invite/create', async (req, res) => {
  try {
    const { inviterDID } = req.body;
    
    if (!inviterDID) {
      return res.status(400).json({
        success: false,
        error: 'inviterDID가 ?�요?�니??
      });
    }
    
    if (!automationSystem) {
      return res.status(503).json({
        success: false,
        error: '?�동???�스?�이 초기?�되지 ?�았?�니??
      });
    }
    
    const result = automationSystem.createInviteLink(inviterDID);
    
    console.log(`?�� 초�? 링크 ?�성: ${inviterDID} -> ${result.inviteLink}`);
    
    res.json(result);
  } catch (error) {
    console.error('초�? 링크 ?�성 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '초�? 링크 ?�성 ?�패',
      details: error.message
    });
  }
});

// ?�동???�스???�태 조회
app.get('/api/automation/status', async (req, res) => {
  try {
    if (!automationSystem) {
      return res.status(503).json({
        success: false,
        error: '?�동???�스?�이 초기?�되지 ?�았?�니??
      });
    }
    
    const status = automationSystem.getAutomationStatus();
    
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('?�동???�스???�태 조회 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '?�동???�스???�태 조회 ?�패',
      details: error.message
    });
  }
});

// ?�동검�??�스???�계 조회
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
    console.error('?�동검�??�스???�계 조회 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '?�동검�??�스???�계 조회 ?�패',
      details: error.message
    });
  }
});

// ?�버그용 - ?�록???�용??목록 조회
app.get('/api/debug/users', (req, res) => {
  try {
    const authSystem = protocol.components.authSystem;
    const users = authSystem.getAllUsers();
    
    console.log(`?�� ?�록???�용???? ${users.length}`);
    users.forEach(user => {
      console.log(`  - ${user.username} (${user.communicationAddress})`);
    });
    
    res.json({
      success: true,
      count: users.length,
      users: users
    });
  } catch (error) {
    console.error('?�용??목록 조회 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '?�용??목록 조회 ?�패',
      details: error.message
    });
  }
});

// ?�러 ?�들�?미들?�어
app.use((error, req, res, next) => {
  console.error('?�버 ?�러:', error);
  res.status(500).json({ 
    error: '?��? ?�버 ?�류', 
    details: process.env.NODE_ENV === 'development' ? error.message : '?�버?�서 ?�류가 발생?�습?�다' 
  });
});

// 404 ?�들�?app.use((req, res) => {
  res.status(404).json({ error: '?�청??리소?��? 찾을 ???�습?�다' });
});

// ?�버 ?�작 ?�수
async function startServer() {
  try {
    // ?�로?�콜 초기??    await initializeServer();
    
    // ?�버 ?�작 - 모든 ?�트?�크 ?�터?�이?�에???�속 가?�하?�록 0.0.0.0?�로 바인??    server.listen(port, '0.0.0.0', async () => {
      console.log(`\n?�� 백야 ?�로?�콜 ??DApp???�행 중입?�다!`);
      console.log(`?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━`);
      console.log(`?�� PC?�서 http://localhost:${port} �??�속?�세??);
      console.log(`?�� ?�에??http://[PC??IP주소]:${port} �??�속?�세??);
      console.log(`?�� PC??IP 주소 ?�인: Windows - ipconfig | Linux/Mac - ifconfig`);
      console.log(`?�� API: http://localhost:${port}/api/status`);
      console.log(`?�� ?�용???�록: http://localhost:${port}/api/register`);
      console.log(`?�� ?�용??로그?? http://localhost:${port}/api/login`);
      console.log(`?�� ?�?�보?? http://localhost:${port}/api/dashboard/[DID]`);
      console.log(`?�� 지�? http://localhost:${port}/api/wallet/[DID]`);
      console.log(`?���?DAO: http://localhost:${port}/api/daos`);
      console.log(`?�� P2P ?�화: http://localhost:${port}/api/p2p/call/*`);
      console.log(`?�� ?�합 ?�증: http://localhost:${port}/api/auth/verify`);
      console.log(`?�� WebSocket: ws://localhost:${port}`);
      console.log(`?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━\n`);
      
      // ?�동 ?�널 ?�성 (GitHub ?�훅??
      console.log('?? GitHub ?�훅 ?�동 ?�널 ?�정 ?�작...');
      await setupAutoTunnel();
    });
  } catch (error) {
    console.error('???�버 ?�작 ?�패:', error);
    process.exit(1);
  }
}

// ?��????�터?�이???�정
function setupTerminalInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━');
  console.log('?�️  검증자 모드 ?�작?�기');
  console.log('?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━');
  console.log('1. 로그??);
  console.log('2. 가??);
  console.log('3. 종료');
  console.log('?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━\n');

  rl.question('?�택?�세??(1/2/3): ', async (choice) => {
    switch (choice) {
      case '1':
        await handleValidatorLogin(rl);
        break;
      case '2':
        await handleValidatorSignup(rl);
        break;
      case '3':
        console.log('?�버�?종료?�니??..');
        process.exit(0);
        break;
      default:
        console.log('?�못???�택?�니?? ?�시 ?�도?�세??');
        rl.close();
        setupTerminalInterface();
    }
  });
}

// 검증자 로그??처리
async function handleValidatorLogin(rl) {
  rl.question('?�이?? ', (username) => {
    rl.question('비�?번호: ', async (password) => {
      try {
        const result = await protocol.loginUser(username, password, `validator_${Date.now()}`);
        
        if (result.success) {
          validatorDID = result.didHash;
          validatorUsername = result.username;
          
          console.log('\n??로그???�공!');
          console.log(`?�� ?�용?? ${result.username}`);
          console.log(`?�� ?�재 ?�액: ${result.tokenBalances.bToken}B`);
          console.log('\n?�️  검증자 모드 ?�작 - 30초마??블록 ?�성');
          console.log('?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━\n');
          
          rl.close();
          startBlockGeneration();
        } else {
          console.log(`\n??로그???�패: ${result.error}`);
          rl.close();
          setupTerminalInterface();
        }
      } catch (error) {
        console.error('\n??로그??처리 �??�류:', error.message);
        rl.close();
        setupTerminalInterface();
      }
    });
  });
}

// 검증자 가??처리
async function handleValidatorSignup(rl) {
  console.log('\n??검증자 계정 ?�성');
  console.log('?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━\n');
  
  rl.question('?�이?? ', (username) => {
    rl.question('비�?번호: ', (password) => {
      rl.question('?�름: ', async (name) => {
        try {
          // ?�신주소 ?�동 ?�성
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
            
            console.log('\n??가???�공!');
            console.log(`?�� ?�용?? ${result.username}`);
            console.log(`?�� ?�신주소: ${result.communicationAddress} (?�동 ?�성)`);
            console.log(`?�� DID: ${result.didHash}`);
            console.log('\n?�️  검증자 모드 ?�작 - 30초마??블록 ?�성');
            console.log('?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━\n');
            
            rl.close();
            startBlockGeneration();
          } else {
            console.log(`\n??가???�패: ${result.error}`);
            rl.close();
            setupTerminalInterface();
          }
        } catch (error) {
          console.error('\n??가??처리 �??�류:', error.message);
          rl.close();
          setupTerminalInterface();
        }
      });
    });
  });
}

// 블록 ?�성 ?�작
function startBlockGeneration() {
  // 검증자�??�록
  const blockchain = protocol.getBlockchain();
  blockchain.registerValidator(validatorDID, 100);
  
  console.log('?�� 검증자�??�록?�었?�니??');
  console.log('?�️  30초마??블록???�성?�니??..\n');
  
  // 즉시 �?블록 ?�성
  generateBlock();
  
  // 30초마??블록 ?�성
  blockGenerationTimer = setInterval(() => {
    generateBlock();
  }, 30000);
}

// 블록 ?�성 �?DCA 처리
async function generateBlock() {
  try {
    const blockchain = protocol.getBlockchain();
    const pendingTransactions = blockchain.pendingTransactions || [];
    
    // ?��?중인 ?�랜??��???�거??30초�? 지?�으�?블록 ?�성
    const shouldCreateBlock = pendingTransactions.length > 0 || true; // ??�� ?�성 (�?블록???�용)
    
    if (!shouldCreateBlock) {
      console.log('???��?중인 ?�랜??��???�어 블록 ?�성??건너?�니??');
      return;
    }
    
    // 블록 ?�성 (?��?중인 모든 ?�랜??�� ?�함)
    const block = blockchain.mineBlock(pendingTransactions, validatorDID);
    
    if (block && !block.error) {
      blocksGenerated++;
      
      // 검증자 ?� ?�센?�브 지�?      let poolIncentive = 0;
      if (protocol.components && protocol.components.storage) {
        try {
          // 검증자 ?� ?�액 조회
          const poolStatus = protocol.components.storage.getValidatorPoolStatus();
          const poolBalance = poolStatus.totalStake || 0;
          
          // 최�? 0.25B ?�는 ?� ?�액 �??��? �?          const maxIncentive = 0.25;
          poolIncentive = Math.min(maxIncentive, poolBalance);
          
          if (poolIncentive > 0) {
            // 검증자 ?�?�서 차감
            const actualWithdrawn = protocol.components.storage.withdrawFromValidatorPool(poolIncentive);
            
            if (actualWithdrawn > 0) {
              // 검증자 ?� ?�센?�브�??�재 블록???�랜??��?�로 직접 추�?
      
              const incentiveTransaction = new Transaction(
                'did:baekya:system0000000000000000000000000000000001', // 검증자 ?� ?�스??                validatorDID,
                actualWithdrawn,
                'B-Token',
                { 
                  type: 'validator_pool_incentive', 
                  blockIndex: block.index, 
                  description: `검증자 ?� ?�센?�브 (블록 #${block.index})`,
                  poolBalanceBefore: poolBalance,
                  poolBalanceAfter: poolBalance - actualWithdrawn
                }
              );
              
              // ?�재 블록??직접 추�?
              block.transactions.push(incentiveTransaction);
              block.merkleRoot = block.calculateMerkleRoot();
              block.hash = block.calculateHash();
              
              poolIncentive = actualWithdrawn;
              
              console.log(`?�� 검증자 ?� ?�센?�브: ${actualWithdrawn}B (?� ?�액: ${poolBalance}B ??${poolBalance - actualWithdrawn}B)`);
            }
          }
        } catch (error) {
          console.warn('?�️ 검증자 ?� ?�센?�브 처리 ?�패:', error.message);
        }
      }
      
      // DCA ?�동 ?�정 - 블록 ?�성 기여 (보상?� BlockchainCore?�서 ?�동 처리??
      // 기여 ?�역?� storage??별도 ?�??(기존 ?�수 ?�용)
      if (protocol.components && protocol.components.storage) {
        try {
          protocol.components.storage.saveContribution(validatorDID, 'validator-dao', {
            id: `block_generation_${block.index}_${Date.now()}`,
            type: 'network_validation',
            title: '블록?�성',
            dcaId: 'block-generation',
            evidence: `Block ${block.index} validated`,
            description: `블록 #${block.index} ?�성 �?검�?,
            bValue: 5, // BlockchainCore?�서 ?�동 지급됨
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
          console.warn('?�️ 기여 ?�역 ?�???�패:', error.message);
        }
      }
      
      // �?보상 계산
      const dcaReward = 5; // DCA ?�동검�?보상
      const totalReward = dcaReward + poolIncentive;
      
      // 로그 출력
      const now = new Date();
      console.log(`\n?�️  [검증자] 블록 #${block.index} ?�성 ?�료 [${now.toLocaleTimeString()}]`);
      console.log(`?�� 검증자: ${validatorUsername} (${validatorDID.substring(0, 8)}...)`);
      console.log(`?�� ?�랜??��: ${pendingTransactions.length}�?처리`);
      console.log(`?�� 보상: +${totalReward}B (DCA: ${dcaReward}B + ?� ?�센?�브: ${poolIncentive}B)`);
      console.log(`?�� �??�성 블록: ${blocksGenerated}�?);
      console.log('?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━\n');
      
      // WebSocket?�로 ?�태 ?�데?�트 브로?�캐?�트
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
      
      // 검증자 ?� ?�태 ?�데?�트 브로?�캐?�트 (?�센?�브 지급으�??� ?�액 변�?
      if (poolIncentive > 0) {
        const updatedPoolStatus = protocol.components.storage.getValidatorPoolStatus();
        broadcastPoolUpdate(updatedPoolStatus);
      }
      
      // 모든 ?�라?�언?�에 ??블록 ?�림
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
      console.error('??블록 ?�성 ?�패:', block?.error || '?????�는 ?�류');
    }
  } catch (error) {
    console.error('??블록 ?�성 �??�류:', error.message);
  }
}

// ?�로?�스 종료 ???�리
process.on('SIGINT', () => {
  console.log('\n\n?�버�?종료?�니??..');
  if (blockGenerationTimer) {
    clearInterval(blockGenerationTimer);
  }
  closeTunnel();
  process.exit(0);
});

// GitHub ?�훅 ?�동 ?�정 (GitHub API ?�용)
app.post('/api/github/setup-webhook', async (req, res) => {
  try {
    const { integrationId, githubToken } = req.body;
    
    if (!integrationId || !githubToken) {
      return res.status(400).json({
        success: false,
        error: 'integrationId?� githubToken???�요?�니??
      });
    }
    
    // 체인?�서 ?�동 ?�보 조회
    const integrationData = protocol.components.storage.getGitHubIntegration(integrationId);
    
    if (!integrationData) {
      return res.status(404).json({
        success: false,
        error: '?�동 ?�보�?찾을 ???�습?�다'
      });
    }
    
    const { repository, webhookUrl } = integrationData;
    
    // GitHub API�??�해 ?�훅 ?�정
    const webhookConfig = {
      name: 'web',
      active: true,
      events: ['pull_request', 'pull_request_review', 'issues'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        insecure_ssl: '1' // localhost ?�스?�용
      }
    };
    
    try {
      const response = await fetch(`https://api.github.com/repos/${repository.fullName}/hooks`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Baekya-Protocol-Bot'
        },
        body: JSON.stringify(webhookConfig)
      });
      
      if (response.ok) {
        const webhookData = await response.json();
        
        console.log(`??GitHub ?�훅 ?�동 ?�정 ?�료: ${repository.fullName} ??${webhookUrl}`);
        
        // ?�동 ?�보???�훅 ID ?�??        integrationData.githubWebhookId = webhookData.id;
        integrationData.webhookConfigured = true;
        
        // 체인???�데?�트???�보 ?�??        const userIntegrations = protocol.components.storage.getGitHubIntegrations(integrationData.userDID);
        const updatedIntegrations = userIntegrations.map(integration => 
          integration.id === integrationId ? integrationData : integration
        );
        protocol.components.storage.saveGitHubIntegrations(integrationData.userDID, updatedIntegrations);
        
        res.json({
          success: true,
          message: 'GitHub ?�훅???�동?�로 ?�정?�었?�니??,
          webhookId: webhookData.id,
          webhookUrl: webhookUrl
        });
        
      } else {
        const errorData = await response.json();
        console.error('GitHub ?�훅 ?�정 ?�패:', errorData);
        
        res.status(response.status).json({
          success: false,
          error: 'GitHub ?�훅 ?�정 ?�패',
          details: errorData.message || '권한???�거???�?�소�?찾을 ???�습?�다'
        });
      }
      
    } catch (fetchError) {
      console.error('GitHub API ?�출 ?�패:', fetchError);
      res.status(500).json({
        success: false,
        error: 'GitHub API ?�출 ?�패',
        details: fetchError.message
      });
    }
    
  } catch (error) {
    console.error('?�훅 ?�정 처리 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '?�훅 ?�정 처리 ?�패',
      details: error.message
    });
  }
});

// GitHub ?�훅 ?�인 ?�드?�인??app.get('/api/github/verify-webhook/:integrationId', async (req, res) => {
  try {
    const { integrationId } = req.params;
    
    // 체인?�서 ?�동 ?�보 조회
    const integrationData = protocol.components.storage.getGitHubIntegration(integrationId);
    
    if (!integrationData) {
      return res.status(404).json({
        success: false,
        error: '?�동 ?�보�?찾을 ???�습?�다'
      });
    }
    
    // ?�훅 ?�태 ?�인 (?�제로는 GitHub API�??�인?�야 ?��?�? ?�기?�는 ?�순??
    const webhookActive = integrationData.webhookConfigured || false;
    const lastPing = integrationData.lastWebhookPing || null;
    
    console.log(`?�� ?�훅 ?�태 ?�인: ${integrationId} ???�성?? ${webhookActive}`);
    
    res.json({
      success: true,
      webhookActive: webhookActive,
      webhookUrl: integrationData.webhookUrl,
      repository: integrationData.repository.fullName,
      lastPing: lastPing,
      integrationId: integrationId
    });
    
  } catch (error) {
    console.error('?�훅 ?�인 ?�패:', error);
    res.status(500).json({
      success: false,
      error: '?�훅 ?�인 ?�패',
      details: error.message
    });
  }
});

// GitHub 중앙 ?�훅 ?�동 ?�정
async function setupGitHubCentralWebhook() {
  try {
    if (!githubIntegration) {
      console.log('?�️ GitHub ?�합 ?�스?�이 초기?�되지 ?�았?�니??');
      return;
    }

    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      console.log('?�️ ?�훅 URL???�을 ???�습?�다.');
      return;
    }

    const centralWebhookUrl = `${webhookUrl}/api/webhook/github/central`;
    const isLocalMode = webhookUrl.includes('localhost');
    
    console.log('?�� GitHub 중앙 ?�훅 ?�정 �?..');
    console.log(`?�� 중앙 ?�훅 URL: ${centralWebhookUrl}`);
    
    // GitHub Integration ?�스?�에 중앙 ?�훅 ?�정
    const result = githubIntegration.setupCentralWebhook(centralWebhookUrl);
    
    if (result.success) {
      console.log('??GitHub 중앙 ?�훅 ?�정 ?�료');
      console.log('?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━');
      
      if (isLocalMode) {
        console.log('?�️  로컬 모드 - GitHub ?�훅 ?�동 ?�정 ?�요:');
        console.log('?�� ?��? ?�널 ?�비?��? ?�용?�세??(ngrok, cloudflared ??');
        console.log('   ?�시: ngrok http 3000');
        console.log('   �???ngrok URL�??�훅???�정?�세??');
      } else {
        console.log('?�� GitHub ?�본 ?�?�소 ?�훅 ?�정 ?�내:');
        console.log(`   1. https://github.com/baekya-protocol/baekya-protocol/settings/hooks ?�속`);
        console.log(`   2. "Add webhook" ?�릭`);
        console.log(`   3. Payload URL: ${centralWebhookUrl}`);
        console.log(`   4. Content type: application/json`);
        console.log(`   5. Events: Pull requests, Pull request reviews, Issues ?�택`);
        console.log(`   6. Active 체크 ??"Add webhook" ?�릭`);
      }
      console.log('?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━?�━');
    } else {
      console.error('??GitHub 중앙 ?�훅 ?�정 ?�패:', result.message);
    }
    
  } catch (error) {
    console.error('??GitHub 중앙 ?�훅 ?�정 �??�류:', error);
  }
}

// ?�동 ?�널 ?�성 �??�훅 URL ?�정
let tunnelRetryCount = 0;
const MAX_TUNNEL_RETRIES = 3;
let tunnelSetupInProgress = false;

async function setupAutoTunnel() {
  // ?��? ?�널 ?�정??진행 중이�?중복 ?�행 방�?
  if (tunnelSetupInProgress) {
    console.log('?�️ ?�널 ?�정???��? 진행 중입?�다.');
    return;
  }

  tunnelSetupInProgress = true;

  try {
    console.log('?�� GitHub ?�훅???�널 ?�성 �?..');
    
    // 기존 ?�널???�으�??�리
    if (tunnel) {
      try {
        tunnel.close();
        tunnel = null;
        webhookUrl = null;
      } catch (err) {
        console.log('기존 ?�널 ?�리 �??�류 (무시??:', err.message);
      }
    }
    
    // ?�드�?고유 ?�브?�메???�성 (?�트 기반)
    const port = process.env.PORT || 3000;
    const subdomain = `baekya-node-${port}`;
    
    // ?�널 ?�성 ?�도
    tunnel = await localtunnel({
      port: port,
      subdomain: subdomain
    });
    
    webhookUrl = tunnel.url;
    tunnelRetryCount = 0; // ?�공 ???�시??카운??초기??    
    console.log(`???�널 ?�성 ?�료: ${webhookUrl}`);
    console.log(`?�� GitHub 중앙 ?�훅 URL: ${webhookUrl}/api/webhook/github/central`);
    
    // GitHub 중앙 ?�훅 ?�정
    await setupGitHubCentralWebhook();
    
    // ?�널 ?�벤??리스???�정 (??번만)
    tunnel.removeAllListeners(); // 기존 리스???�거
    
    tunnel.on('error', (err) => {
      console.error('???�널 ?�류:', err.message);
      handleTunnelReconnect('?�류 발생');
    });
    
    tunnel.on('close', () => {
      console.log('?�️ ?�널 ?�결??종료?�었?�니??');
      handleTunnelReconnect('?�결 종료');
    });
    
    tunnelSetupInProgress = false;
    return webhookUrl;
    
  } catch (error) {
    console.error('???�널 ?�성 ?�패:', error.message);
    tunnelSetupInProgress = false;
    
    // ?�시???�수 체크
    if (tunnelRetryCount < MAX_TUNNEL_RETRIES) {
      tunnelRetryCount++;
      console.log(`?�� ?�널 ?�시??(${tunnelRetryCount}/${MAX_TUNNEL_RETRIES}) - 10�???..`);
      setTimeout(setupAutoTunnel, 10000);
    } else {
      console.log('?�️ ?�널 ?�시???�수 초과. 로컬 모드�?계속 진행?�니??');
      console.log('?�� GitHub ?�훅???�용?�려�??�동?�로 ngrok ?�을 ?�정?�세??');
      
      // 로컬 모드 ?�훅 URL ?�정
      webhookUrl = `http://localhost:${process.env.PORT || 3000}`;
      await setupGitHubCentralWebhook();
      
      // 30�?????�????�도
      setTimeout(() => {
        tunnelRetryCount = 0;
        setupAutoTunnel();
      }, 30000);
    }
    
    return null;
  }
}

// ?�널 ?�연�?처리 ?�수
function handleTunnelReconnect(reason) {
  if (tunnelSetupInProgress) {
    return; // ?��? ?�연�??�도 �?  }

  console.log(`?�� ?�널 ?�연�??�요 (${reason})`);
  
  // ?�시 ?��????�연�??�도
  setTimeout(() => {
    if (!tunnelSetupInProgress) {
      setupAutoTunnel();
    }
  }, 5000);
}

// ?�훅 URL 가?�오�?(API?�서 ?�용)
function getWebhookUrl() {
  return webhookUrl;
}

// ?�널 종료
function closeTunnel() {
  if (tunnel) {
    tunnel.close();
    tunnel = null;
    webhookUrl = null;
    console.log('?�� ?�널??종료?�었?�니??');
  }
}

// 중계 ?�버 관???�수???�거??- 로컬 직접 ?�결 모드 ?�용

// ?�버 ?�작 ???��????�터?�이???�작
startServer().then(() => {
  // ?�버가 ?�전???�작?????��????�터?�이???�작
  setTimeout(() => {
    setupTerminalInterface();
  }, 2000); // 2�??��????��????�터?�이???�작
});

module.exports = app; 
