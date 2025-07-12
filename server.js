// NODE_ENV가 설정되지 않은 경우 development로 설정
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('📌 NODE_ENV를 development로 설정했습니다.');
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const localtunnel = require('localtunnel');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Firebase Admin SDK 추가
const admin = require('firebase-admin');

// Firebase Admin SDK 초기화 (서비스 계정 키 파일 필요)
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
  
  console.log('🔥 Firebase Admin SDK 초기화 완료');
} catch (error) {
  console.log('⚠️  Firebase Admin SDK 초기화 건너뜀 (개발 모드)');
}

const WebSocket = require('ws');
const http = require('http');
const readline = require('readline');
const { Server } = require('socket.io');
// Node.js 18+ 버전에서는 fetch가 내장되어 있음

// 백야 프로토콜 컴포넌트들
const Protocol = require('./src/index.js');

const app = express();
const port = process.env.PORT || 3000; // Railway 환경변수 사용
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const io = new Server(server);

// 메인 프로토콜 인스턴스
let protocol = null;

// 자동검증 시스템들
let githubIntegration = null;
let communityIntegration = null;
let automationSystem = null;

// WebSocket 연결 관리
const clients = new Map(); // DID -> WebSocket connection (단일 연결)
const clientSessions = new Map(); // WebSocket -> { did, sessionId }

// 검증자 관련 변수
let validatorDID = null;
let validatorUsername = null;
let blockGenerationTimer = null;
let blocksGenerated = 0;

// 터널링 관련 변수
let tunnel = null;
let webhookUrl = null;

// 릴레이 서버 연결 관련 변수
let relayConnection = null;
let relayReconnectInterval = null;
let nodeId = uuidv4(); // 이 풀노드의 고유 ID

// 릴레이 서버 설정 (환경변수 또는 기본값)
const RELAY_SERVER_URL = process.env.RELAY_SERVER_URL || 'wss://baekya-relay-production.up.railway.app';

// 로컬 직접 연결 모드 - 중계 서버 사용 안함

// WebSocket 연결 핸들러
wss.on('connection', (ws) => {
  let userDID = null;
  let sessionId = null;
  
  console.log('🔌 새로운 WebSocket 연결 시도');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 WebSocket 메시지 수신:', data.type, data.did ? `DID: ${data.did.substring(0, 16)}...` : '');
      
      switch (data.type) {
        case 'auth':
          // 사용자 인증
          userDID = data.did;
          sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          console.log(`🔐 인증 요청: ${userDID}`);
          
          // 기존 연결이 있으면 강제 종료 (1기기 1계정 정책)
          if (clients.has(userDID)) {
            const existingWs = clients.get(userDID);
            if (existingWs && existingWs.readyState === WebSocket.OPEN) {
              console.log(`⚠️ 기존 연결 종료: ${userDID}`);
              existingWs.send(JSON.stringify({
                type: 'session_terminated',
                reason: '다른 기기에서 로그인했습니다.'
              }));
              existingWs.close();
              
              // 기존 세션 정보 정리
              if (clientSessions.has(existingWs)) {
                clientSessions.delete(existingWs);
              }
            }
          }
          
          // 새 연결 등록
          clients.set(userDID, ws);
          clientSessions.set(ws, { did: userDID, sessionId: sessionId });
          
          console.log(`✅ 새 연결 등록: ${userDID}, 세션: ${sessionId}`);
          
          // 즉시 최신 상태 전송
          protocol.getUserWallet(userDID).then(wallet => {
            const poolStatus = protocol.components.storage.getValidatorPoolStatus();
            
            console.log(`💰 연결 시 지갑 정보 전송: ${userDID} -> B:${wallet.balances?.bToken || 0}B`);
            
            const stateUpdate = {
              type: 'state_update',
              wallet: wallet,
              validatorPool: poolStatus,
              sessionId: sessionId
            };
            
            ws.send(JSON.stringify(stateUpdate));
            
            // 연결 확인 메시지
            ws.send(JSON.stringify({
              type: 'connection_confirmed',
              sessionId: sessionId,
              message: '실시간 연결이 활성화되었습니다.'
            }));
            
          }).catch(error => {
            console.error(`❌ 지갑 정보 조회 실패: ${userDID}`, error);
            ws.send(JSON.stringify({
              type: 'error',
              message: '지갑 정보를 불러오는데 실패했습니다.'
            }));
          });
          
          break;
          
        case 'request_state':
          // 현재 상태 요청 처리
          if (userDID) {
            console.log(`📋 상태 요청 처리: ${userDID}`);
            
            protocol.getUserWallet(userDID).then(wallet => {
              const poolStatus = protocol.components.storage.getValidatorPoolStatus();
              
              ws.send(JSON.stringify({
                type: 'state_update',
                wallet: wallet,
                validatorPool: poolStatus,
                sessionId: sessionId
              }));
            }).catch(error => {
              console.error(`❌ 상태 요청 처리 실패: ${userDID}`, error);
            });
          }
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
          
        default:
          console.log(`❓ 알 수 없는 메시지 타입: ${data.type}`);
      }
    } catch (error) {
      console.error('❌ WebSocket 메시지 처리 오류:', error);
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log(`🔌 WebSocket 연결 종료: ${userDID || '알 수 없음'}, 코드: ${code}, 이유: ${reason}`);
    
    if (userDID) {
      // 클라이언트 맵에서 제거 (동일한 연결인 경우에만)
      if (clients.get(userDID) === ws) {
        clients.delete(userDID);
        console.log(`🗑️ 클라이언트 맵에서 제거: ${userDID}`);
      }
    }
    
    // 세션 정보 정리
    if (clientSessions.has(ws)) {
      clientSessions.delete(ws);
    }
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket 연결 오류: ${userDID || '알 수 없음'}`, error);
  });
});

// 특정 사용자에게 상태 업데이트 브로드캐스트
function broadcastStateUpdate(userDID, updateData) {
  console.log(`📤 상태 업데이트 브로드캐스트: ${userDID} ->`, updateData);
  
  // 로컬 WebSocket 클라이언트에 전송
  if (clients.has(userDID)) {
    const ws = clients.get(userDID);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({
        type: 'state_update',
        timestamp: Date.now(),
        ...updateData
      });
      
      ws.send(message);
      console.log(`✅ 로컬 클라이언트에 전송 성공: ${userDID}`);
    } else {
      console.log(`⚠️ 로컬 클라이언트 연결 상태 불량: ${userDID}`);
    }
  } else {
    console.log(`⚠️ 로컬 클라이언트 없음: ${userDID}`);
  }
  
  // 릴레이 서버에도 전송 (Vercel 웹앱용)
  if (relayConnection && relayConnection.readyState === WebSocket.OPEN) {
    relayConnection.send(JSON.stringify({
      type: 'state_update',
      userDID: userDID,
      updateData: updateData,
      timestamp: Date.now()
    }));
    console.log(`✅ 릴레이 서버에 전송 성공: ${userDID}`);
  }
}

// 전체 사용자에게 검증자 풀 업데이트 브로드캐스트
function broadcastPoolUpdate(poolStatus) {
  console.log(`📤 검증자 풀 업데이트 브로드캐스트:`, poolStatus);
  
  const message = JSON.stringify({
    type: 'pool_update',
    validatorPool: poolStatus,
    timestamp: Date.now()
  });
  
  let successCount = 0;
  let totalCount = 0;
  
  // 로컬 WebSocket 클라이언트에 전송
  clients.forEach((ws, did) => {
    totalCount++;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      successCount++;
    }
  });
  
  console.log(`✅ 로컬 클라이언트 전송: ${successCount}/${totalCount}`);
  
  // 릴레이 서버에도 전송 (Vercel 웹앱용)
  if (relayConnection && relayConnection.readyState === WebSocket.OPEN) {
    relayConnection.send(JSON.stringify({
      type: 'pool_update',
      validatorPool: poolStatus,
      timestamp: Date.now()
    }));
    console.log(`✅ 릴레이 서버에 전송 성공`);
  }
}

// 전체 사용자에게 DAO 금고 업데이트 브로드캐스트
function broadcastDAOTreasuryUpdate(daoTreasuries) {
  console.log(`📤 DAO 금고 업데이트 브로드캐스트:`, daoTreasuries);
  
  const message = JSON.stringify({
    type: 'dao_treasury_update',
    daoTreasuries: daoTreasuries,
    timestamp: Date.now()
  });
  
  let successCount = 0;
  let totalCount = 0;
  
  // 로컬 WebSocket 클라이언트에 전송
  clients.forEach((ws, did) => {
    totalCount++;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      successCount++;
    }
  });
  
  console.log(`✅ 로컬 클라이언트 전송: ${successCount}/${totalCount}`);
  
  // 릴레이 서버에도 전송 (Vercel 웹앱용)
  if (relayConnection && relayConnection.readyState === WebSocket.OPEN) {
    relayConnection.send(JSON.stringify({
      type: 'dao_treasury_update',
      daoTreasuries: daoTreasuries,
      timestamp: Date.now()
    }));
    console.log(`✅ 릴레이 서버에 전송 성공`);
  }
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
      null, // CVCM 시스템은 제거되었으므로 null
      protocol.components.storage // DataStorage 인스턴스 전달
    );
    
    // 블록체인 인스턴스 설정
    githubIntegration.setBlockchain(protocol.getBlockchain());
    
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
    
    // 릴레이 서버에 연결
    connectToRelayServer();
    
    return true;
  } catch (error) {
    console.error('❌ 서버 초기화 실패:', error);
    throw error;
  }
}

// 릴레이 서버 연결 함수
function connectToRelayServer() {
  if (process.env.DIRECT_MODE === 'true') {
    console.log('🔗 직접 연결 모드: 릴레이 서버를 사용하지 않습니다');
    return;
  }
  
  console.log(`🌐 릴레이 서버에 연결 중: ${RELAY_SERVER_URL}`);
  
  try {
    relayConnection = new WebSocket(RELAY_SERVER_URL);
    
    relayConnection.on('open', () => {
      console.log('✅ 릴레이 서버에 연결됨');
      
      // 풀노드 등록
      const nodeInfo = {
        type: 'register_node',
        nodeId: nodeId,
        endpoint: `http://localhost:${port}`,
        version: '1.0.0',
        capabilities: ['transaction', 'validation', 'storage']
      };
      
      relayConnection.send(JSON.stringify(nodeInfo));
      
      // 재연결 인터벌 정리
      if (relayReconnectInterval) {
        clearInterval(relayReconnectInterval);
        relayReconnectInterval = null;
      }
      
      // Ping 주기적으로 전송 (20초마다)
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
        console.error('릴레이 메시지 파싱 오류:', error);
      }
    });
    
    relayConnection.on('error', (error) => {
      console.error('릴레이 서버 연결 오류:', error);
    });
    
    relayConnection.on('close', () => {
      console.log('🔌 릴레이 서버 연결 종료');
      
      // 재연결 시도
      if (!relayReconnectInterval) {
        relayReconnectInterval = setInterval(() => {
          console.log('🔄 릴레이 서버 재연결 시도...');
          connectToRelayServer();
        }, 5000);
      }
    });
    
  } catch (error) {
    console.error('릴레이 서버 연결 실패:', error);
  }
}

// 릴레이 서버 메시지 처리
async function handleRelayMessage(message) {
  switch (message.type) {
    case 'node_registered':
      console.log(`🎉 릴레이 서버에 등록 완료! Node ID: ${message.nodeId}`);
      break;
      
    case 'http_request':
      // HTTP 요청 처리
      try {
        const { requestId, request } = message;
        const { method, path, headers, body, query } = request;
        
        // Express 라우터를 통해 요청 처리
        const response = await processHttpRequest(method, path, headers, body, query);
        
        // 응답 전송
        relayConnection.send(JSON.stringify({
          type: 'http_response',
          requestId: requestId,
          response: response
        }));
      } catch (error) {
        console.error('HTTP 요청 처리 오류:', error);
      }
      break;
      
    case 'user_request':
      // WebSocket 사용자 요청 처리
      const { sessionId, request } = message;
      // 필요한 경우 구현
      break;
      
    case 'pong':
      // Ping 응답
      break;
  }
}

// HTTP 요청을 Express 라우터로 처리
async function processHttpRequest(method, path, headers, body, query) {
  try {
    // 가상의 요청/응답 객체 생성
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
    
    // API 경로별 직접 처리
    if (path === '/status' && method === 'GET') {
      if (!protocol) {
        return { status: 503, data: { error: '프로토콜이 초기화되지 않았습니다' } };
      }
      const status = await protocol.getStatus();
      return { status: 200, data: status };
    }
    
    if (path === '/protocol-status' && method === 'GET') {
      if (!protocol) {
        return { status: 503, data: { success: false, error: '프로토콜이 초기화되지 않았습니다' } };
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
          data: { success: false, error: '아이디가 필요합니다' }
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
    
    // 이 register 처리는 중복이므로 제거됨 (아래 초대코드 처리 포함 버전 사용)
    
    if (path === '/login' && method === 'POST') {
      const { username, password, deviceId } = body;
      
      if (!username || !password) {
        return {
          status: 400,
          data: { success: false, error: '아이디와 비밀번호가 필요합니다' }
        };
      }
      
      const finalDeviceId = deviceId || headers['x-device-id'] || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const result = await protocol.loginUser(username, password, finalDeviceId);
      
      // 로그인 성공 후 WebSocket으로 즉시 잔액 정보 전송
      if (result.success && result.didHash) {
        setTimeout(async () => {
          try {
            const wallet = await protocol.getUserWallet(result.didHash);
            const poolStatus = protocol.components.storage.getValidatorPoolStatus();
            
            console.log(`💰 로그인 성공 후 지갑 정보 전송: ${result.didHash} -> B:${wallet.balances?.bToken || 0}`);
            
            broadcastStateUpdate(result.didHash, {
              wallet: wallet,
              validatorPool: poolStatus
            });
          } catch (error) {
            console.error(`❌ 로그인 후 지갑 정보 전송 실패: ${result.didHash}`, error);
          }
        }, 1000); // 1초 후 전송 (WebSocket 연결 시간 고려)
      }
      
      return { status: 200, data: result };
    }
    
    // 회원가입 (초대코드 처리 포함)
    if (path === '/register' && method === 'POST') {
      try {
        console.log('🔍 회원가입 요청 받음');
        console.log('📦 요청 본문:', JSON.stringify(body, null, 2));
        
        // 두 가지 구조 모두 지원: { userData } 또는 직접 필드들
        const userData = body.userData || body;
        const { username, password, communicationAddress, inviteCode, deviceId } = userData;
        
        if (!username || !password) {
          return {
            status: 400,
            data: { success: false, error: '아이디와 비밀번호가 필요합니다' }
          };
        }
        
        // 회원가입 처리
        const finalDeviceId = deviceId || headers['x-device-id'] || `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // communicationAddress가 있으면 새 구조, 없으면 userData 전체 전달
        let result;
        if (communicationAddress) {
          result = await protocol.registerUser(username, password, communicationAddress, inviteCode, finalDeviceId);
        } else {
          // userData 구조 사용
          userData.deviceId = finalDeviceId;
          result = await protocol.registerUser(userData);
        }
        
        console.log('🎉 회원가입 결과:', result);
        
        // 초대코드 처리 로직 추가
        if (result.success && userData.inviteCode) {
          try {
            console.log(`🔍 초대코드 처리 시작: ${userData.inviteCode} -> ${result.didHash}`);
            const inviteResult = await processInviteCode(userData.inviteCode, result.didHash);
            if (inviteResult.success) {
              console.log(`🎉 초대코드 처리 완료: ${inviteResult.inviterDID} -> 30B, ${result.didHash} -> 20B`);
              
              // 결과에 초대 보상 정보 추가
              result.inviteReward = inviteResult;
              
              // 사용자가 소속된 DAO 정보 업데이트
              try {
                const dashboard = await protocol.getUserDashboard(result.didHash);
                const userDAOs = dashboard.daos || [];
                
                // 커뮤니티DAO가 이미 목록에 있는지 확인
                const hasCommunityDAO = userDAOs.some(dao => dao.id === 'community-dao');
                
                if (!hasCommunityDAO) {
                  userDAOs.push({
                    id: 'community-dao',
                    name: 'Community DAO',
                    description: '백야 프로토콜 커뮤니티 관리를 담당하는 DAO',
                    role: 'Member',
                    joinedAt: Date.now(),
                    contributions: 1,
                    lastActivity: '오늘'
                  });
                  
                  console.log(`✅ 초대받은 사용자 커뮤니티DAO 소속 정보 추가: ${result.didHash}`);
                }
                
                result.daos = userDAOs;
              } catch (error) {
                console.error('DAO 정보 가져오기 실패:', error);
              }
              
            } else {
              console.log(`⚠️ 초대코드 처리 실패: ${inviteResult.error}`);
            }
          } catch (error) {
            console.error(`❌ 초대코드 처리 중 오류:`, error);
          }
        }
        
        // 회원가입 성공 후 WebSocket으로 즉시 잔액 정보 전송
        if (result.success && result.didHash) {
          setTimeout(async () => {
            try {
              const wallet = await protocol.getUserWallet(result.didHash);
              const poolStatus = protocol.components.storage.getValidatorPoolStatus();
              
              console.log(`💰 회원가입 성공 후 지갑 정보 전송: ${result.didHash} -> B:${wallet.balances?.bToken || 0}`);
              
              broadcastStateUpdate(result.didHash, {
                wallet: wallet,
                validatorPool: poolStatus
              });
            } catch (error) {
              console.error(`❌ 회원가입 후 지갑 정보 전송 실패: ${result.didHash}`, error);
            }
          }, 2000); // 2초 후 전송 (초대코드 처리 완료 대기)
        }
        
        return { status: 200, data: result };
        
      } catch (error) {
        console.error('회원가입 실패:', error);
        return {
          status: 500,
          data: { success: false, error: '회원가입 실패', details: error.message }
        };
      }
    }
    
    // 초대코드 관련 API
    if ((path === '/invite-code' || path === '/api/invite-code') && method === 'GET') {
      const session = protocol.components.storage.validateSession(headers['x-session-id']);
      if (!session) {
        return { status: 401, data: { success: false, error: '인증이 필요합니다' } };
      }
      
      try {
        // 저장소에서 해당 사용자의 초대코드 조회
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
              message: '초대코드가 없습니다'
            }
          };
        }
      } catch (error) {
        console.error('초대코드 조회 실패:', error);
        return {
          status: 500,
          data: { success: false, error: '초대코드 조회 실패', details: error.message }
        };
      }
    }
    
    if ((path === '/invite-code' || path === '/api/invite-code') && method === 'POST') {
      // Authorization 헤더 또는 x-session-id 헤더를 통한 인증 확인
      let session = null;
      let userDID = null;
      
      if (headers['x-session-id']) {
        session = protocol.components.storage.validateSession(headers['x-session-id']);
        userDID = session?.didHash;
      } else if (headers['authorization']) {
        // Authorization: Bearer DID 형식
        const authHeader = headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          userDID = authHeader.substring(7); // "Bearer " 제거
          
          // DID로 유효한 사용자인지 확인
          const didInfo = protocol.components.authSystem.getDIDInfo(userDID);
          if (didInfo) {
            session = { didHash: userDID, ...didInfo };
          }
        }
      }
      
      if (!session || !userDID) {
        return { status: 401, data: { success: false, error: '인증이 필요합니다' } };
      }
      
      try {
        const { userDID, communicationAddress } = body;
        const finalUserDID = userDID || session.didHash || session.did;
        
        if (!finalUserDID) {
          return { status: 400, data: { success: false, error: '사용자 DID가 필요합니다' } };
        }

        console.log(`🔍 초대코드 생성 요청: ${finalUserDID.substring(0, 16)}...`);

        // 기존 초대코드가 있는지 강화된 확인
        let existingCode = protocol.components.storage.getUserInviteCode(finalUserDID);
        
        // 추가로 블록체인에서도 확인 (이미 등록된 초대코드가 있는지)
        if (!existingCode) {
          // 블록체인에서 해당 사용자의 초대코드 등록 트랜잭션 찾기
          const blockchain = protocol.getBlockchain();
          if (blockchain && blockchain.chain) {
            for (const block of blockchain.chain) {
              for (const tx of block.transactions) {
                if (tx.fromDID === finalUserDID && 
                    tx.data?.type === 'invite_code_registration' && 
                    tx.data?.inviteCode) {
                  existingCode = tx.data.inviteCode;
                  // 로컬 저장소에도 저장
                  protocol.components.storage.saveUserInviteCode(finalUserDID, existingCode);
                  break;
                }
              }
              if (existingCode) break;
            }
          }
        }
        
        if (existingCode) {
          console.log(`♻️ 기존 초대코드 반환: ${existingCode}`);
          return { status: 200, data: { success: true, inviteCode: existingCode } };
        }

        // 해시 기반 영구 초대코드 생성
        const inviteCode = generateHashBasedInviteCode(finalUserDID);
        console.log(`🎫 새로운 초대코드 생성: ${inviteCode}`);

        try {
          const Transaction = require('./src/blockchain/Transaction');
          
          // 초대코드 등록 트랜잭션 생성
          const inviteCodeTx = new Transaction(
            finalUserDID,
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
          
          console.log(`🎫 초대코드 트랜잭션 생성: ${inviteCode}`);
          
          // 저장소에 초대코드 저장
          protocol.components.storage.saveUserInviteCode(finalUserDID, inviteCode);
          
          return {
            status: 200,
            data: {
              success: true,
              inviteCode: inviteCode,
              message: '초대코드가 생성되었습니다. 검증자가 블록을 생성하면 영구 저장됩니다.',
              transactionId: inviteCodeTx.hash,
              status: 'pending'
            }
          };
        } catch (error) {
          console.error('초대코드 블록체인 등록 실패:', error);
          
          // 블록체인 등록에 실패해도 로컬에는 저장
          protocol.components.storage.saveUserInviteCode(finalUserDID, inviteCode);
          
          return {
            status: 200,
            data: {
              success: true,
              inviteCode: inviteCode,
              message: '초대코드가 생성되었습니다 (블록체인 등록 지연)'
            }
          };
        }
      } catch (error) {
        console.error('초대코드 생성 실패:', error);
        return {
          status: 500,
          data: { success: false, error: '초대코드 생성 실패', details: error.message }
        };
      }
    }
    
    // 지갑 정보 조회
    if (path.startsWith('/wallet/') && method === 'GET') {
      const did = path.split('/wallet/')[1];
      try {
        const wallet = await protocol.getUserWallet(did);
        return { status: 200, data: wallet };
      } catch (error) {
        return {
          status: 500,
          data: { success: false, error: '지갑 정보 조회 실패', details: error.message }
        };
      }
    }
    
    // 기여 내역 조회
    if (path.startsWith('/contributions/') && method === 'GET') {
      const did = path.split('/contributions/')[1];
      try {
        const contributions = await protocol.getUserContributions(did);
        return { status: 200, data: contributions };
      } catch (error) {
        return {
          status: 500,
          data: { success: false, error: '기여 내역 조회 실패', details: error.message }
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
          data: { success: false, error: 'DAO 목록 조회 실패', details: error.message }
        };
      }
    }
    
    // DAO 생성
    if (path === '/daos' && method === 'POST') {
      const session = protocol.components.storage.validateSession(headers['x-session-id']);
      if (!session) {
        return { status: 401, data: { success: false, error: '인증이 필요합니다' } };
      }
      
      try {
        const { daoData } = body;
        const result = await protocol.createDAO(session.did, daoData);
        return { status: 200, data: result };
      } catch (error) {
        return {
          status: 500,
          data: { success: false, error: 'DAO 생성 실패', details: error.message }
        };
      }
    }
    
    // 특정 DAO 정보 조회
    if (path.startsWith('/daos/') && path.split('/').length === 3 && method === 'GET') {
      const daoId = path.split('/daos/')[1];
      try {
        const dao = protocol.getDAO(daoId);
        return { status: 200, data: dao };
      } catch (error) {
        return {
          status: 500,
          data: { success: false, error: 'DAO 정보 조회 실패', details: error.message }
        };
      }
    }
    
    // DAO 가입
    if (path.includes('/daos/') && path.endsWith('/join') && method === 'POST') {
      const session = protocol.components.storage.validateSession(headers['x-session-id']);
      if (!session) {
        return { status: 401, data: { success: false, error: '인증이 필요합니다' } };
      }
      
      const daoId = path.split('/daos/')[1].split('/join')[0];
      try {
        const result = await protocol.joinDAO(session.did, daoId);
        return { status: 200, data: result };
      } catch (error) {
        return {
          status: 500,
          data: { success: false, error: 'DAO 가입 실패', details: error.message }
        };
      }
    }
    
    // 토큰 전송
    if (path === '/transfer' && method === 'POST') {
      try {
        console.log('🔍 토큰 전송 요청 받음');
        console.log('📦 요청 본문:', JSON.stringify(body, null, 2));
        console.log('🔐 헤더:', headers);
        
        const { fromDID, toAddress, amount, tokenType = 'B-Token', authData } = body;
        
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
          
          return {
            status: 400,
            data: {
              success: false,
              error: '발신자 DID, 받는 주소, 유효한 금액이 필요합니다'
            }
          };
        }
        
        // toAddress가 DID인지, 통신주소인지, 아이디인지 확인하고 DID로 변환
        let toDID = toAddress;
        
        if (!toAddress.startsWith('did:baekya:')) {
          console.log('🔍 통신주소 또는 아이디로 DID 조회 시도:', toAddress);
          
          // 통신주소로 DID 찾기
          const authSystem = protocol.components.authSystem;
          const didResult = authSystem.getDIDByCommAddress(toAddress);
          
          if (didResult.success) {
            toDID = didResult.did;
            console.log('✅ 통신주소로 DID 찾음:', toDID);
          } else {
            // 아이디로 DID 찾기 시도
            const userResult = authSystem.getDIDByUsername(toAddress);
            if (userResult.success) {
              toDID = userResult.didHash;
              console.log('✅ 아이디로 DID 찾음:', toDID);
            } else {
              console.log('❌ 받는 주소를 찾을 수 없음:', toAddress);
              return {
                status: 404,
                data: {
                  success: false,
                  error: `받는 주소를 찾을 수 없습니다: ${toAddress}`
                }
              };
            }
          }
        }
        
        console.log('📤 최종 전송 정보:');
        console.log(`  - From: ${fromDID}`);
        console.log(`  - To: ${toDID}`);
        console.log(`  - Amount: ${amount} ${tokenType}`);
        
        // 토큰 전송 실행
        const result = await protocol.transferTokens(fromDID, toDID, amount, tokenType, authData);
        
        console.log('💸 토큰 전송 결과:', result);
        
        return { status: 200, data: result };
        
      } catch (error) {
        console.error('토큰 전송 실패:', error);
        return {
          status: 500,
          data: { success: false, error: '토큰 전송 실패', details: error.message }
        };
      }
    }
    
    // 초대 생성
    if (path === '/invite/create' && method === 'POST') {
      try {
        const { userDID, inviteCode } = body;
        
        if (!userDID || !inviteCode) {
          return {
            status: 400,
            data: { success: false, error: '사용자 DID와 초대코드가 필요합니다' }
          };
        }
        
        const result = await protocol.createInvite(userDID, inviteCode);
        return { status: 200, data: result };
        
      } catch (error) {
        console.error('초대 생성 실패:', error);
        return {
          status: 500,
          data: { success: false, error: '초대 생성 실패', details: error.message }
        };
      }
    }
    
    // 검증자 풀 후원 (릴레이 서버 전용)
    if (path === '/validator-pool/sponsor' && method === 'POST') {
      try {
        const { sponsorDID, amount } = body;
        
        if (!sponsorDID || !amount || amount <= 0) {
          return {
            status: 400,
            data: { success: false, error: '후원자 DID와 유효한 금액이 필요합니다' }
          };
        }
        
        // 수수료 계산 (고정 0B - 수수료 없음)
        const fee = 0;
        const totalAmount = amount + fee;
        
        // B-토큰 차감
        const currentBalance = protocol.getBlockchain().getBalance(sponsorDID, 'B-Token');
        if (currentBalance < totalAmount) {
          return {
            status: 400,
            data: { success: false, error: `B-토큰 잔액이 부족합니다 (필요: ${totalAmount}B, 보유: ${currentBalance}B)` }
          };
        }
        
        // 검증자 풀 후원 트랜잭션 생성
        const Transaction = require('./src/blockchain/Transaction');
        const validatorPoolSystemAddress = 'did:baekya:system0000000000000000000000000000000001';
        
        const poolTx = new Transaction(
          sponsorDID,
          validatorPoolSystemAddress,
          totalAmount,
          'B-Token',
          { 
            type: 'validator_pool_sponsor', 
            actualSponsorAmount: amount,
            validatorFee: fee,
            daoFee: 0
          }
        );
        poolTx.sign('test-key');
        
        // 블록체인에 트랜잭션 추가
        const addResult = protocol.getBlockchain().addTransaction(poolTx);
        if (!addResult.success) {
          throw new Error(addResult.error || '트랜잭션 추가 실패');
        }
        
        console.log(`💰 검증자 풀 후원 트랜잭션 추가됨: ${sponsorDID} -> ${amount}B`);
        
        // 약간의 지연을 두어 블록체인 업데이트 완료 대기
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 최신 풀 상태 가져오기
        const poolStatus = protocol.components.storage.getValidatorPoolStatus();
        
        // 모든 클라이언트에 검증자 풀 업데이트 브로드캐스트
        broadcastPoolUpdate({
          balance: poolStatus.totalStake,
          contributions: poolStatus.contributions
        });
        
        // 후원자에게 업데이트된 지갑 정보 전송
        const updatedWallet = await protocol.getUserWallet(sponsorDID);
        broadcastStateUpdate(sponsorDID, {
          wallet: updatedWallet,
          validatorPool: poolStatus
        });
        
        return {
          status: 200,
          data: {
            success: true,
            message: `검증자 풀에 ${amount}B 후원 트랜잭션이 추가되었습니다`,
            transactionId: poolTx.hash,
            status: 'pending',
            poolStatus: {
              balance: poolStatus.totalStake,
              contributions: poolStatus.contributions
            }
          }
        };
        
      } catch (error) {
        console.error('검증자 풀 후원 실패:', error);
        return {
          status: 500,
          data: { success: false, error: '검증자 풀 후원 실패', details: error.message }
        };
      }
    }
    
    // DAO 금고 후원 (릴레이 서버 전용)
    if (path === '/dao/treasury/sponsor' && method === 'POST') {
      try {
        const { sponsorDID, daoId, amount } = body;
        
        if (!sponsorDID || !daoId || !amount || amount <= 0) {
          return {
            status: 400,
            data: { success: false, error: '후원자 DID, DAO ID, 유효한 금액이 필요합니다' }
          };
        }
        
        // DAO 존재 여부 확인
        const dao = protocol.getDAO(daoId);
        if (!dao || !dao.dao) {
          return {
            status: 404,
            data: { success: false, error: '존재하지 않는 DAO입니다' }
          };
        }
        
        // 수수료 계산 (고정 0.001B)
        const fee = 0.001;
        const totalAmount = amount + fee;
        
        // B-토큰 잔액 확인
        const currentBalance = protocol.getBlockchain().getBalance(sponsorDID, 'B-Token');
        if (currentBalance < totalAmount) {
          return {
            status: 400,
            data: { success: false, error: `B-토큰 잔액이 부족합니다 (필요: ${totalAmount}B, 보유: ${currentBalance}B)` }
          };
        }
        
        // DAO 금고 후원 트랜잭션 생성
        const Transaction = require('./src/blockchain/Transaction');
        const daoTreasurySystemAddress = 'did:baekya:system0000000000000000000000000000000002';
        
        const treasuryTx = new Transaction(
          sponsorDID,
          daoTreasurySystemAddress,
          totalAmount,
          'B-Token',
          { 
            type: 'dao_treasury_sponsor',
            targetDaoId: daoId,
            targetDaoName: dao.dao.name,
            actualSponsorAmount: amount,
            validatorFee: fee,
            daoFee: 0
          }
        );
        treasuryTx.sign('test-key');
        
        // 블록체인에 트랜잭션 추가
        const addResult = protocol.getBlockchain().addTransaction(treasuryTx);
        if (!addResult.success) {
          throw new Error(addResult.error || '트랜잭션 추가 실패');
        }
        
        console.log(`🏛️ DAO 금고 후원 트랜잭션 추가됨: ${sponsorDID} -> ${dao.dao.name} (${amount}B)`);
        
        // 약간의 지연을 두어 블록체인 업데이트 완료 대기
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 대상 DAO의 현재 잔액 가져오기
        const targetDAOData = protocol.components.storage.getDAO(daoId);
        const newTreasury = targetDAOData ? targetDAOData.treasury : 0;
        const daoTreasuries = {};
        daoTreasuries[daoId] = newTreasury;
        
        // 검증자 풀 상태 가져오기
        const poolStatus = protocol.components.storage.getValidatorPoolStatus();
        
        // 모든 클라이언트에 브로드캐스트
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
        
        return {
          status: 200,
          data: {
            success: true,
            message: `${dao.dao.name} 금고에 ${amount}B 후원 트랜잭션이 추가되었습니다`,
            transactionId: treasuryTx.hash,
            status: 'pending',
            daoTreasury: {
              daoId: daoId,
              daoName: dao.dao.name,
              newBalance: newTreasury,
              contribution: amount
            },
            feeDistribution: {
              validatorPool: fee,
              daoFee: 0,
              perDAO: 0
            }
          }
        };
        
      } catch (error) {
        console.error('DAO 금고 후원 실패:', error);
        return {
          status: 500,
          data: { success: false, error: 'DAO 금고 후원 실패', details: error.message }
        };
      }
    }
    
    // 다른 라우트들은 Express 앱을 통해 처리
    return new Promise((resolve) => {
      // Express의 next() 함수 시뮬레이션
      const next = (err) => {
        if (err) {
          resolve({
            status: 500,
            data: { error: 'Internal server error', details: err.message }
          });
        }
      };
      
      // Express 미들웨어 체인 실행 시뮬레이션
      let middlewareIndex = 0;
      
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
    console.error('HTTP 요청 처리 오류:', error);
    return {
      status: 500,
      data: { error: 'Internal server error', details: error.message }
    };
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

// 프로토콜 상태 확인 (웹앱 서버 검색용)
app.get('/api/protocol-status', async (req, res) => {
  try {
    if (!protocol) {
      return res.status(503).json({ 
        success: false, 
        error: '프로토콜이 초기화되지 않았습니다' 
      });
    }
    
    res.json({
      success: true,
      status: 'active',
      version: '1.0.0',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('프로토콜 상태 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '프로토콜 상태 조회 실패', 
      details: error.message 
    });
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

    // 기존 초대코드가 있는지 강화된 확인
    let existingCode = protocol.components.storage.getUserInviteCode(userDID);
    
    // 추가로 블록체인에서도 확인 (이미 등록된 초대코드가 있는지)
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
      
      console.log(`🎫 초대코드 트랜잭션 생성: ${inviteCode}`);
      
      // 저장소에 초대코드 저장
      protocol.components.storage.saveUserInviteCode(userDID, inviteCode);
        
      res.json({
        success: true,
        inviteCode: inviteCode,
        message: '초대코드가 생성되었습니다. 검증자가 블록을 생성하면 영구 저장됩니다.',
        transactionId: inviteCodeTx.hash,
        status: 'pending'
      });
      
    } catch (error) {
      console.error('초대코드 블록체인 등록 실패:', error.message);
      
      // 블록체인 등록에 실패해도 로컬에는 저장
      protocol.components.storage.saveUserInviteCode(userDID, inviteCode);
      
      res.json({
        success: true,
        inviteCode: inviteCode,
        message: '초대코드가 생성되었습니다 (블록체인 등록 지연)'
      });
    }
  } catch (error) {
    console.error('초대코드 생성 실패:', error.message);
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
      
      // 블록 생성을 기다린 후 잔액 조회 (트랜잭션이 체인에 포함되도록)
      // 검증자가 30초마다 블록을 생성하므로, 즉시 조회하면 pending 상태
      // 하지만 클라이언트 경험을 위해 예상 잔액을 먼저 전송
      
      // 현재 블록체인 잔액 조회 (트랜잭션 전)
      const inviterCurrentBalance = protocol.getBlockchain().getBalance(inviterDID, 'B-Token');
      const newUserCurrentBalance = protocol.getBlockchain().getBalance(newUserDID, 'B-Token');
      
      // 예상 잔액 계산 (현재 잔액 + 보상)
      const inviterExpectedBalance = inviterCurrentBalance + 30;
      const newUserExpectedBalance = newUserCurrentBalance + 20;
      
      console.log(`💰 초대자 예상 잔액: ${inviterExpectedBalance}B (현재: ${inviterCurrentBalance}B + 보상: 30B)`);
      console.log(`💰 생성자 예상 잔액: ${newUserExpectedBalance}B (현재: ${newUserCurrentBalance}B + 보상: 20B)`);
      
      // 초대자에게 예상 잔액으로 즉시 업데이트 전송
      broadcastStateUpdate(inviterDID, {
        wallet: { balances: { bToken: inviterExpectedBalance, pToken: 0 } },
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
      
      // 생성자에게 예상 잔액으로 즉시 업데이트 전송
      broadcastStateUpdate(newUserDID, {
        wallet: { balances: { bToken: newUserExpectedBalance, pToken: 0 } }
      });
      
      // 나중에 블록이 생성되면 실제 잔액으로 다시 업데이트
      setTimeout(async () => {
        const inviterWallet = await protocol.getUserWallet(inviterDID);
        if (inviterWallet.success) {
          console.log(`💰 초대자 실제 잔액 확인: ${inviterWallet.balances.bToken}B`);
          broadcastStateUpdate(inviterDID, {
            wallet: { balances: { bToken: inviterWallet.balances.bToken, pToken: inviterWallet.balances.pToken || 0 } }
          });
        }
        
        const newUserWallet = await protocol.getUserWallet(newUserDID);
        if (newUserWallet.success) {
          console.log(`💰 생성자 실제 잔액 확인: ${newUserWallet.balances.bToken}B`);
          broadcastStateUpdate(newUserDID, {
            wallet: { balances: { bToken: newUserWallet.balances.bToken, pToken: newUserWallet.balances.pToken || 0 } }
          });
        }
      }, 35000); // 35초 후 (블록 생성 주기 30초 + 여유 5초)
      
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

// GitHub 중앙 웹훅 엔드포인트 (백야 프로토콜 원본 저장소용)
app.post('/api/webhook/github/central', async (req, res) => {
  try {
    const payload = req.body;
    const eventType = req.headers['x-github-event'] || 'unknown';
    
    // 불필요한 액션은 로그 출력하지 않고 조용히 무시
    const ignoredActions = ['opened', 'synchronize', 'reopened', 'edited'];
    if (ignoredActions.includes(payload.action)) {
      return res.json({
        success: true,
        message: `${payload.action} event ignored`,
        eventType: eventType,
        action: payload.action
      });
    }

    console.log(`🔔 GitHub 중앙 웹훅 수신`);
    console.log(`📦 이벤트 타입: ${eventType}`);
    console.log(`📦 액션: ${payload.action || 'none'}`);
    console.log(`📦 저장소: ${payload.repository?.full_name || 'unknown'}`);
    
    // 백야 프로토콜 원본 저장소인지 확인
    if (payload.repository?.full_name !== 'baekya-protocol/baekya-protocol') {
      console.log(`⚠️ 처리 대상이 아닌 저장소: ${payload.repository?.full_name}`);
      return res.json({
        success: true,
        message: 'Repository not monitored',
        repository: payload.repository?.full_name
      });
    }
    
    // GitHub ping 이벤트 처리
    if (eventType === 'ping') {
      console.log(`🏓 GitHub 중앙 웹훅 ping 이벤트 처리`);
      return res.json({
        success: true,
        message: 'Central webhook ping received successfully',
        webhookConfigured: true
      });
    }
    
    // 중앙 웹훅 이벤트 처리
    if (githubIntegration) {
      const result = await githubIntegration.handleCentralWebhookEvent(payload, eventType);
      
      if (result.success) {
        console.log(`✅ 중앙 웹훅 이벤트 처리 완료: ${result.message}`);
      } else {
        console.log(`⚠️ 중앙 웹훅 이벤트 처리 실패: ${result.message}`);
      }
      
      res.json(result);
    } else {
      console.error('GitHub 통합 시스템이 초기화되지 않았습니다');
      res.status(503).json({
        success: false,
        error: 'GitHub 통합 시스템이 초기화되지 않았습니다'
      });
    }
  } catch (error) {
    console.error('GitHub 중앙 웹훅 처리 실패:', error);
    res.status(500).json({
      success: false,
      error: 'GitHub 중앙 웹훅 처리 실패',
      details: error.message
    });
  }
});

// GitHub 개별 웹훅 엔드포인트 (호환성을 위해 유지)
app.post('/api/webhook/github/:integrationId', async (req, res) => {
  try {
    const { integrationId } = req.params;
    const payload = req.body;
    const eventType = req.headers['x-github-event'] || 'unknown';
    
    console.log(`🔔 GitHub 개별 웹훅 수신: ${integrationId}`);
    console.log(`📦 이벤트 타입: ${eventType}`);
    console.log(`📦 액션: ${payload.action || 'none'}`);
    console.log(`📦 저장소: ${payload.repository?.full_name || 'unknown'}`);
    
    // GitHub ping 이벤트 처리
    if (eventType === 'ping') {
      console.log(`🏓 GitHub ping 이벤트 처리`);
      return res.json({
        success: true,
        message: 'Ping received successfully',
        webhookConfigured: true
      });
    }
    
    // 중앙 웹훅으로 리디렉션 안내
    console.log(`ℹ️ 개별 웹훅은 더 이상 지원되지 않습니다. 중앙 웹훅을 사용하세요.`);
    res.json({
      success: true,
      message: '개별 웹훅은 더 이상 지원되지 않습니다. 중앙 웹훅을 사용하세요.',
      centralWebhookUrl: getWebhookUrl() ? `${getWebhookUrl()}/api/webhook/github/central` : `https://baekya-node-3000.loca.lt/api/webhook/github/central`
    });
  } catch (error) {
    console.error('GitHub 개별 웹훅 처리 실패:', error);
    res.status(500).json({
      success: false,
      error: 'GitHub 개별 웹훅 처리 실패',
      details: error.message
    });
  }
});

// GitHub 웹훅 이벤트 처리 함수
async function processGitHubWebhook(integrationData, payload, eventType) {
  try {
    const { userDID, repository, dcaTypes } = integrationData;
    
    console.log(`🔍 GitHub 이벤트 처리 시작: ${eventType}`);
    console.log(`👤 사용자: ${userDID.substring(0, 8)}...`);
    console.log(`📂 저장소: ${repository.fullName}`);
    
    // Pull Request 이벤트 처리
    if (eventType === 'pull_request' && payload.pull_request) {
      const pr = payload.pull_request;
      
      console.log(`🔍 PR 이벤트: ${payload.action}, PR #${pr.number}: ${pr.title}`);
      console.log(`🔍 PR 상태: merged=${pr.merged}, state=${pr.state}`);
      
      // PR 병합 처리
      if (payload.action === 'closed' && pr.merged) {
        const reward = dcaTypes.pull_request?.reward || 250;
        
        console.log(`🎉 PR 병합 감지! PR #${pr.number} → 보상: ${reward}B`);
        
        // 블록체인 트랜잭션 생성
        const Transaction = require('./src/blockchain/Transaction');
        const rewardTransaction = new Transaction(
          'did:baekya:system000000000000000000000000000000000', // 시스템에서 지급
          userDID, // 기여자에게
          reward, // 250B
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
        
        // 트랜잭션에 서명 (시스템 트랜잭션)
        rewardTransaction.signature = 'system-dca-reward-signature';
        
        // 블록체인에 트랜잭션 추가 (pendingTransactions에 들어감)
        const blockchain = protocol.getBlockchain();
        const txResult = blockchain.addTransaction(rewardTransaction);
        
        if (txResult.success) {
          console.log(`✅ PR 병합 보상 트랜잭션 생성 성공: ${rewardTransaction.hash}`);
          
          // 기여 내역 저장 (블록 생성되면 자동으로 저장됨)
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
          
          // WebSocket 업데이트 (실제 잔액은 블록 생성 후 업데이트됨)
          broadcastStateUpdate(userDID, {
            newContribution: {
              dao: 'dev-dao',
              type: 'pull_request',
              title: pr.title,
              bTokens: reward,
              description: `PR #${pr.number}: ${pr.title}`,
              date: new Date().toISOString().split('T')[0],
              evidence: pr.html_url,
              status: 'pending_block' // 블록 생성 대기 중
            }
          });
          
          return {
            success: true,
            message: 'PR 병합 보상 트랜잭션 생성 완료',
            contribution: contribution,
            transactionHash: rewardTransaction.hash
          };
        } else {
          console.error('❌ PR 병합 보상 트랜잭션 생성 실패:', txResult.error);
          return {
            success: false,
            error: 'PR 병합 보상 트랜잭션 생성 실패',
            details: txResult.error
          };
        }
      } else {
        console.log(`ℹ️ PR 이벤트 무시: action=${payload.action}, merged=${pr.merged}`);
      }
    }
    
    // Pull Request Review 이벤트 처리
    if (eventType === 'pull_request_review' && payload.review && payload.action === 'submitted') {
      const review = payload.review;
      const pr = payload.pull_request;
      const reward = dcaTypes.pull_request_review?.reward || 120;
      
      console.log(`🎉 PR 리뷰 감지! PR #${pr.number} 리뷰 → 보상: ${reward}B`);
      
      // 블록체인 트랜잭션 생성
      const Transaction = require('./src/blockchain/Transaction');
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
        console.log(`✅ PR 리뷰 보상 트랜잭션 생성 성공: ${rewardTransaction.hash}`);
        
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
          message: 'PR 리뷰 보상 트랜잭션 생성 완료',
          contribution: contribution,
          transactionHash: rewardTransaction.hash
        };
      } else {
        console.error('❌ PR 리뷰 보상 트랜잭션 생성 실패:', txResult.error);
        return {
          success: false,
          error: 'PR 리뷰 보상 트랜잭션 생성 실패',
          details: txResult.error
        };
      }
    }
    
    // Issues 이벤트 처리
    if (eventType === 'issues' && payload.issue && payload.action === 'closed') {
      const issue = payload.issue;
      const reward = dcaTypes.issue?.reward || 80;
      
      console.log(`🎉 Issue 해결 감지! Issue #${issue.number} → 보상: ${reward}B`);
      
      // 블록체인 트랜잭션 생성
      const Transaction = require('./src/blockchain/Transaction');
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
        console.log(`✅ Issue 해결 보상 트랜잭션 생성 성공: ${rewardTransaction.hash}`);
        
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
          message: 'Issue 해결 보상 트랜잭션 생성 완료',
          contribution: contribution,
          transactionHash: rewardTransaction.hash
        };
      } else {
        console.error('❌ Issue 해결 보상 트랜잭션 생성 실패:', txResult.error);
        return {
          success: false,
          error: 'Issue 해결 보상 트랜잭션 생성 실패',
          details: txResult.error
        };
      }
    }
    
    // 처리되지 않은 이벤트
    console.log(`⚠️ 처리되지 않은 GitHub 이벤트: ${eventType} (action: ${payload.action})`);
    return {
      success: true,
      message: `이벤트 수신 완료 (${eventType} - 처리하지 않음)`
    };
    
  } catch (error) {
    console.error('❌ GitHub 웹훅 처리 중 오류:', error);
    return {
      success: false,
      error: '웹훅 처리 실패',
      details: error.message
    };
  }
}

// GitHub PR 시뮬레이션 엔드포인트 (테스트용)
app.post('/api/github/simulate-pr', async (req, res) => {
  try {
    const { userDID, action, prNumber, prTitle, repository } = req.body;
    
    if (!userDID || !action || !prNumber || !prTitle || !repository) {
      return res.status(400).json({
        success: false,
        error: '필수 파라미터가 누락되었습니다 (userDID, action, prNumber, prTitle, repository)'
      });
    }
    
    // 해당 사용자의 GitHub 연동 정보 조회
    const integrations = protocol.components.storage.getGitHubIntegrations(userDID);
    const integration = integrations.find(i => i.repository.fullName === repository);
    
    if (!integration) {
      return res.status(404).json({
        success: false,
        error: `${repository} 저장소와 연동된 정보를 찾을 수 없습니다`
      });
    }
    
    // 가상의 PR 웹훅 페이로드 생성
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
    
    console.log(`🎭 GitHub PR 시뮬레이션 시작: ${userDID} → ${repository} PR #${prNumber}`);
    
    // 웹훅 처리 함수 호출
    const result = await processGitHubWebhook(integration, mockPayload);
    
    if (result.success) {
      console.log(`✅ GitHub PR 시뮬레이션 완료: ${result.message}`);
    }
    
    res.json({
      success: true,
      message: 'PR 시뮬레이션 완료',
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
    console.error('GitHub PR 시뮬레이션 실패:', error);
    res.status(500).json({
      success: false,
      error: 'PR 시뮬레이션 실패',
      details: error.message
    });
  }
});

// Firebase Auth 토큰 검증 미들웨어
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    
    // 개발 모드에서는 Firebase 검증 건너뛰기
    if (!admin.apps.length) {
      console.log('⚠️  개발 모드: Firebase 토큰 검증 건너뛰기');
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
        error: 'Firebase ID 토큰이 필요합니다'
      });
    }
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.firebaseUser = decodedToken;
      next();
    } catch (error) {
      console.error('Firebase 토큰 검증 실패:', error);
      return res.status(401).json({
        success: false,
        error: 'Firebase 토큰 검증 실패'
      });
    }
  } catch (error) {
    console.error('Firebase 토큰 검증 미들웨어 오류:', error);
    return res.status(500).json({
      success: false,
      error: '토큰 검증 중 오류 발생'
    });
  }
};

// GitHub 계정 연동 설정 (Firebase Auth 방식)
app.post('/api/github/link-account', verifyFirebaseToken, async (req, res) => {
  try {
    const { idToken, accessToken, githubUsername, userDID: clientUserDID } = req.body;
    const firebaseUser = req.firebaseUser;
    
    if (!githubUsername) {
      return res.status(400).json({
        success: false,
        error: 'githubUsername이 필요합니다'
      });
    }
    
    // Firebase 사용자 정보 확인
    const firebaseUID = firebaseUser.uid;
    const userEmail = firebaseUser.email;
    const displayName = firebaseUser.name || githubUsername;
    
    console.log(`🔥 Firebase 사용자 인증: ${displayName} (${githubUsername})`);
    console.log(`📧 이메일: ${userEmail}`);
    console.log(`🆔 Firebase UID: ${firebaseUID}`);
    
    // 백야 프로토콜 사용자 DID 확인
    let userDID = null;
    
    // 1. 클라이언트에서 전달된 DID 사용 (최우선)
    if (clientUserDID) {
      userDID = clientUserDID;
      console.log(`🔗 클라이언트 백야 사용자와 연동: ${userDID}`);
    } 
    // 2. Authorization 헤더에서 가져오기
    else {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        userDID = authHeader.substring(7);
        console.log(`🔗 헤더 백야 사용자와 연동: ${userDID}`);
      } else {
        return res.status(400).json({
          success: false,
          error: '백야 프로토콜에 먼저 로그인해주세요'
        });
      }
    }
    
    if (!userDID) {
      return res.status(400).json({
        success: false,
        error: 'userDID 처리 실패'
      });
    }
    
    // GitHub 계정 연동 설정
    if (githubIntegration) {
      try {
        const result = githubIntegration.setupUserGitHubMapping(userDID, githubUsername);
        
        if (result.success) {
          // 중앙 웹훅 설정 (처음 연동 시에만)
          const centralWebhookUrl = getWebhookUrl() ? `${getWebhookUrl()}/api/webhook/github/central` : `https://baekya-node-3000.loca.lt/api/webhook/github/central`;
          githubIntegration.setupCentralWebhook(centralWebhookUrl);
          
          // GitHub 계정 연동 완료 트랜잭션 생성
          const Transaction = require('./src/blockchain/Transaction');
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
            console.log(`🎉 GitHub 계정 연동 보상 트랜잭션 생성: ${userDID} → +10B (${githubUsername} 연동)`);
            
            // 연동 기여 내역 저장
            const integrationContribution = {
              id: `github_account_${Date.now()}`,
              type: 'github_integration',
              title: `GitHub 계정 연동: ${githubUsername}`,
              dcaId: 'github-integration',
              evidence: `GitHub Username: ${githubUsername}`,
              description: `${githubUsername} GitHub 계정과 연동하여 개발DAO DCA 수행 준비 완료`,
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
            
            // WebSocket으로 연동 완료 알림
            broadcastStateUpdate(userDID, {
              newContribution: {
                dao: 'dev-dao',
                type: 'github_integration',
                title: `GitHub 계정 연동: ${githubUsername}`,
                bTokens: 10,
                description: `${githubUsername} GitHub 계정과 연동하여 개발DAO DCA 수행 준비 완료`,
                date: new Date().toISOString().split('T')[0],
                evidence: `GitHub Username: ${githubUsername}`,
                status: 'pending_block'
              }
            });
          }
          
          console.log(`🎉 GitHub 계정 연동 완료: ${userDID} -> ${githubUsername}`);
          console.log(`📡 중앙 웹훅 URL: ${centralWebhookUrl}`);
          
          res.json({
            success: true,
            message: 'GitHub 계정 연동이 완료되었습니다',
            githubUsername: githubUsername,
            targetRepository: 'baekya-protocol/baekya-protocol',
            centralWebhookUrl: centralWebhookUrl,
            integrationBonus: 10
          });
        } else {
          res.status(500).json({ error: result.message });
        }
      } catch (integrationError) {
        console.error('GitHub 계정 연동 실패:', integrationError);
        res.status(500).json({
          success: false,
          error: 'GitHub 계정 연동 실패',
          details: integrationError.message
        });
      }
    } else {
      res.status(503).json({
        success: false,
        error: 'GitHub 통합 시스템이 초기화되지 않았습니다'
      });
    }
  } catch (error) {
    console.error('GitHub 계정 연동 설정 실패:', error);
    res.status(500).json({
      success: false,
      error: 'GitHub 계정 연동 설정 실패',
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
    server.listen(port, '0.0.0.0', async () => {
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
      
      // 자동 터널 생성 (GitHub 웹훅용)
      console.log('🚀 GitHub 웹훅 자동 터널 설정 시작...');
      await setupAutoTunnel();
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
              // 검증자 풀 인센티브를 현재 블록에 트랜잭션으로 직접 추가
              const Transaction = require('./src/blockchain/Transaction');
              const incentiveTransaction = new Transaction(
                'did:baekya:system0000000000000000000000000000000001', // 검증자 풀 시스템
                validatorDID,
                actualWithdrawn,
                'B-Token',
                { 
                  type: 'validator_pool_incentive', 
                  blockIndex: block.index, 
                  description: `검증자 풀 인센티브 (블록 #${block.index})`,
                  poolBalanceBefore: poolBalance,
                  poolBalanceAfter: poolBalance - actualWithdrawn
                }
              );
              
              // 현재 블록에 직접 추가
              block.transactions.push(incentiveTransaction);
              block.merkleRoot = block.calculateMerkleRoot();
              block.hash = block.calculateHash();
              
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
      
      // 블록에 포함된 모든 트랜잭션 관련 사용자에게 업데이트 브로드캐스트
      const affectedUsers = new Set();
      for (const tx of pendingTransactions) {
        // 토큰 전송 트랜잭션인 경우
        if (tx.data?.type === 'token_transfer') {
          affectedUsers.add(tx.fromDID);
          affectedUsers.add(tx.toDID);
        }
        // 기타 트랜잭션들도 추가 가능
        else if (!tx.fromDID.includes('system') && !tx.fromDID.includes('genesis')) {
          affectedUsers.add(tx.fromDID);
        }
        if (!tx.toDID.includes('system') && !tx.toDID.includes('genesis')) {
          affectedUsers.add(tx.toDID);
        }
      }
      
      // 영향 받은 모든 사용자에게 업데이트된 지갑 정보 브로드캐스트
      for (const userDID of affectedUsers) {
        if (userDID !== validatorDID) { // 검증자는 이미 위에서 처리됨
          const userWallet = await protocol.getUserWallet(userDID);
          broadcastStateUpdate(userDID, {
            wallet: userWallet,
            blockUpdate: {
              height: block.index,
              transactionCount: pendingTransactions.length,
              timestamp: block.timestamp
            }
          });
        }
      }
      
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

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n\n서버를 종료합니다...');
  if (blockGenerationTimer) {
    clearInterval(blockGenerationTimer);
  }
  closeTunnel();
  process.exit(0);
});

// GitHub 웹훅 자동 설정 (GitHub API 사용)
app.post('/api/github/setup-webhook', async (req, res) => {
  try {
    const { integrationId, githubToken } = req.body;
    
    if (!integrationId || !githubToken) {
      return res.status(400).json({
        success: false,
        error: 'integrationId와 githubToken이 필요합니다'
      });
    }
    
    // 체인에서 연동 정보 조회
    const integrationData = protocol.components.storage.getGitHubIntegration(integrationId);
    
    if (!integrationData) {
      return res.status(404).json({
        success: false,
        error: '연동 정보를 찾을 수 없습니다'
      });
    }
    
    const { repository, webhookUrl } = integrationData;
    
    // GitHub API를 통해 웹훅 설정
    const webhookConfig = {
      name: 'web',
      active: true,
      events: ['pull_request', 'pull_request_review', 'issues'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        insecure_ssl: '1' // localhost 테스트용
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
        
        console.log(`✅ GitHub 웹훅 자동 설정 완료: ${repository.fullName} → ${webhookUrl}`);
        
        // 연동 정보에 웹훅 ID 저장
        integrationData.githubWebhookId = webhookData.id;
        integrationData.webhookConfigured = true;
        
        // 체인에 업데이트된 정보 저장
        const userIntegrations = protocol.components.storage.getGitHubIntegrations(integrationData.userDID);
        const updatedIntegrations = userIntegrations.map(integration => 
          integration.id === integrationId ? integrationData : integration
        );
        protocol.components.storage.saveGitHubIntegrations(integrationData.userDID, updatedIntegrations);
        
        res.json({
          success: true,
          message: 'GitHub 웹훅이 자동으로 설정되었습니다',
          webhookId: webhookData.id,
          webhookUrl: webhookUrl
        });
        
      } else {
        const errorData = await response.json();
        console.error('GitHub 웹훅 설정 실패:', errorData);
        
        res.status(response.status).json({
          success: false,
          error: 'GitHub 웹훅 설정 실패',
          details: errorData.message || '권한이 없거나 저장소를 찾을 수 없습니다'
        });
      }
      
    } catch (fetchError) {
      console.error('GitHub API 호출 실패:', fetchError);
      res.status(500).json({
        success: false,
        error: 'GitHub API 호출 실패',
        details: fetchError.message
      });
    }
    
  } catch (error) {
    console.error('웹훅 설정 처리 실패:', error);
    res.status(500).json({
      success: false,
      error: '웹훅 설정 처리 실패',
      details: error.message
    });
  }
});

// GitHub 웹훅 확인 엔드포인트
app.get('/api/github/verify-webhook/:integrationId', async (req, res) => {
  try {
    const { integrationId } = req.params;
    
    // 체인에서 연동 정보 조회
    const integrationData = protocol.components.storage.getGitHubIntegration(integrationId);
    
    if (!integrationData) {
      return res.status(404).json({
        success: false,
        error: '연동 정보를 찾을 수 없습니다'
      });
    }
    
    // 웹훅 상태 확인 (실제로는 GitHub API로 확인해야 하지만, 여기서는 단순화)
    const webhookActive = integrationData.webhookConfigured || false;
    const lastPing = integrationData.lastWebhookPing || null;
    
    console.log(`🔍 웹훅 상태 확인: ${integrationId} → 활성화: ${webhookActive}`);
    
    res.json({
      success: true,
      webhookActive: webhookActive,
      webhookUrl: integrationData.webhookUrl,
      repository: integrationData.repository.fullName,
      lastPing: lastPing,
      integrationId: integrationId
    });
    
  } catch (error) {
    console.error('웹훅 확인 실패:', error);
    res.status(500).json({
      success: false,
      error: '웹훅 확인 실패',
      details: error.message
    });
  }
});

// GitHub 중앙 웹훅 자동 설정
async function setupGitHubCentralWebhook() {
  try {
    if (!githubIntegration) {
      console.log('⚠️ GitHub 통합 시스템이 초기화되지 않았습니다.');
      return;
    }

    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      console.log('⚠️ 웹훅 URL을 얻을 수 없습니다.');
      return;
    }

    const centralWebhookUrl = `${webhookUrl}/api/webhook/github/central`;
    const isLocalMode = webhookUrl.includes('localhost');
    
    console.log('🔗 GitHub 중앙 웹훅 설정 중...');
    console.log(`📡 중앙 웹훅 URL: ${centralWebhookUrl}`);
    
    // GitHub Integration 시스템에 중앙 웹훅 설정
    const result = githubIntegration.setupCentralWebhook(centralWebhookUrl);
    
    if (result.success) {
      console.log('✅ GitHub 중앙 웹훅 설정 완료');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      if (isLocalMode) {
        console.log('⚠️  로컬 모드 - GitHub 웹훅 수동 설정 필요:');
        console.log('💡 외부 터널 서비스를 사용하세요 (ngrok, cloudflared 등)');
        console.log('   예시: ngrok http 3000');
        console.log('   그 후 ngrok URL로 웹훅을 설정하세요.');
      } else {
        console.log('📋 GitHub 원본 저장소 웹훅 설정 안내:');
        console.log(`   1. https://github.com/baekya-protocol/baekya-protocol/settings/hooks 접속`);
        console.log(`   2. "Add webhook" 클릭`);
        console.log(`   3. Payload URL: ${centralWebhookUrl}`);
        console.log(`   4. Content type: application/json`);
        console.log(`   5. Events: Pull requests, Pull request reviews, Issues 선택`);
        console.log(`   6. Active 체크 후 "Add webhook" 클릭`);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
      console.error('❌ GitHub 중앙 웹훅 설정 실패:', result.message);
    }
    
  } catch (error) {
    console.error('❌ GitHub 중앙 웹훅 설정 중 오류:', error);
  }
}

// 자동 터널 생성 및 웹훅 URL 설정
let tunnelRetryCount = 0;
const MAX_TUNNEL_RETRIES = 3;
let tunnelSetupInProgress = false;

async function setupAutoTunnel() {
  // 이미 터널 설정이 진행 중이면 중복 실행 방지
  if (tunnelSetupInProgress) {
    console.log('⚠️ 터널 설정이 이미 진행 중입니다.');
    return;
  }

  tunnelSetupInProgress = true;

  try {
    console.log('🚇 GitHub 웹훅용 터널 생성 중...');
    
    // 기존 터널이 있으면 정리
    if (tunnel) {
      try {
        tunnel.close();
        tunnel = null;
        webhookUrl = null;
      } catch (err) {
        console.log('기존 터널 정리 중 오류 (무시됨):', err.message);
      }
    }
    
    // 노드별 고유 서브도메인 생성 (포트 기반)
    const port = process.env.PORT || 3000;
    const subdomain = `baekya-node-${port}`;
    
    // 터널 생성 시도
    tunnel = await localtunnel({
      port: port,
      subdomain: subdomain
    });
    
    webhookUrl = tunnel.url;
    tunnelRetryCount = 0; // 성공 시 재시도 카운트 초기화
    
    console.log(`✅ 터널 생성 완료: ${webhookUrl}`);
    console.log(`🔗 GitHub 중앙 웹훅 URL: ${webhookUrl}/api/webhook/github/central`);
    
    // GitHub 중앙 웹훅 설정
    await setupGitHubCentralWebhook();
    
    // 터널 이벤트 리스너 설정 (한 번만)
    tunnel.removeAllListeners(); // 기존 리스너 제거
    
    tunnel.on('error', (err) => {
      console.error('❌ 터널 오류:', err.message);
      handleTunnelReconnect('오류 발생');
    });
    
    tunnel.on('close', () => {
      console.log('⚠️ 터널 연결이 종료되었습니다.');
      handleTunnelReconnect('연결 종료');
    });
    
    tunnelSetupInProgress = false;
    return webhookUrl;
    
  } catch (error) {
    console.error('❌ 터널 생성 실패:', error.message);
    tunnelSetupInProgress = false;
    
    // 재시도 횟수 체크
    if (tunnelRetryCount < MAX_TUNNEL_RETRIES) {
      tunnelRetryCount++;
      console.log(`🔄 터널 재시도 (${tunnelRetryCount}/${MAX_TUNNEL_RETRIES}) - 10초 후...`);
      setTimeout(setupAutoTunnel, 10000);
    } else {
      console.log('⚠️ 터널 재시도 횟수 초과. 로컬 모드로 계속 진행합니다.');
      console.log('💡 GitHub 웹훅을 사용하려면 수동으로 ngrok 등을 설정하세요.');
      
      // 로컬 모드 웹훅 URL 설정
      webhookUrl = `http://localhost:${process.env.PORT || 3000}`;
      await setupGitHubCentralWebhook();
      
      // 30초 후 한 번 더 시도
      setTimeout(() => {
        tunnelRetryCount = 0;
        setupAutoTunnel();
      }, 30000);
    }
    
    return null;
  }
}

// 터널 재연결 처리 함수
function handleTunnelReconnect(reason) {
  if (tunnelSetupInProgress) {
    return; // 이미 재연결 시도 중
  }

  console.log(`🔄 터널 재연결 필요 (${reason})`);
  
  // 잠시 대기 후 재연결 시도
  setTimeout(() => {
    if (!tunnelSetupInProgress) {
      setupAutoTunnel();
    }
  }, 5000);
}

// 웹훅 URL 가져오기 (API에서 사용)
function getWebhookUrl() {
  return webhookUrl;
}

// 터널 종료
function closeTunnel() {
  if (tunnel) {
    tunnel.close();
    tunnel = null;
    webhookUrl = null;
    console.log('🚇 터널이 종료되었습니다.');
  }
}

// 중계 서버 관련 함수들 제거됨 - 로컬 직접 연결 모드 사용

// 서버 시작 후 터미널 인터페이스 시작
startServer().then(() => {
  // 서버가 완전히 시작된 후 터미널 인터페이스 시작
  setTimeout(() => {
    setupTerminalInterface();
  }, 2000); // 2초 대기 후 터미널 인터페이스 시작
});

module.exports = app; 