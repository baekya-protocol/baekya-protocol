// P2P 네트워크 중계 서버 (Railway 클라우드용)
// 풀노드들을 등록하고 관리하며, 사용자 요청을 적절한 풀노드로 라우팅

const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 등록된 풀노드들 관리
const registeredNodes = new Map(); // nodeId -> { ws, info, lastPing }
const userSessions = new Map(); // sessionId -> { nodeId, ws, userDID }
const usersByDID = new Map(); // userDID -> Set of sessionIds

// CORS 설정
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// 중계 서버 상태 확인 (Healthcheck용 - 항상 200 응답)
app.get('/api/relay-status', (req, res) => {
  const onlineNodes = Array.from(registeredNodes.values())
    .filter(node => Date.now() - node.lastPing < 30000);
  
  res.status(200).json({
    success: true,
    relayServer: {
      status: 'online',
      uptime: process.uptime(),
      version: '1.0.0'
    },
    network: {
      totalNodes: registeredNodes.size,
      onlineNodes: onlineNodes.length,
      offlineNodes: registeredNodes.size - onlineNodes.length
    },
    connections: {
      totalSessions: userSessions.size,
      activeConnections: wss.clients.size
    },
    isReady: onlineNodes.length > 0 // 노드 연결 상태만 표시
  });
});

// 풀노드 등록 상태 확인
app.get('/api/nodes', (req, res) => {
  const nodes = Array.from(registeredNodes.values()).map(node => ({
    id: node.info.id,
    endpoint: node.info.endpoint,
    lastPing: node.lastPing,
    status: Date.now() - node.lastPing < 30000 ? 'online' : 'offline'
  }));
  
  res.json({
    success: true,
    nodes: nodes,
    totalNodes: nodes.length,
    onlineNodes: nodes.filter(n => n.status === 'online').length
  });
});

// 사용자 API를 풀노드로 라우팅 (와일드카드는 맨 마지막에)
app.all('/api/*', async (req, res) => {
  try {
    const availableNodes = Array.from(registeredNodes.values())
      .filter(node => Date.now() - node.lastPing < 30000); // 30초 내 ping
    
    if (availableNodes.length === 0) {
      return res.status(503).json({
        success: false,
        error: '사용 가능한 풀노드가 없습니다',
        code: 'NO_NODES_AVAILABLE'
      });
    }
    
    // 로드 밸런싱: 랜덤 노드 선택
    const selectedNode = availableNodes[Math.floor(Math.random() * availableNodes.length)];
    
    // 풀노드에게 요청 전달
    const apiPath = req.path.replace('/api', '');
    const nodeResponse = await forwardToNode(selectedNode, {
      method: req.method,
      path: apiPath,
      headers: req.headers,
      body: req.body,
      query: req.query
    });
    
    // 응답 전달
    const statusCode = nodeResponse.status || 200;
    const responseData = nodeResponse.data || nodeResponse;
    res.status(statusCode).json(responseData);
    
  } catch (error) {
    console.error('API 라우팅 오류:', error);
    res.status(500).json({
      success: false,
      error: '중계 서버 오류',
      details: error.message
    });
  }
});

// WebSocket 연결 처리
wss.on('connection', (ws, req) => {
  const connectionId = uuidv4();
  let connectionType = null; // 'node' 또는 'user'
  let nodeId = null;
  let sessionId = null;
  
  console.log(`🔌 새로운 WebSocket 연결: ${connectionId}`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'register_node':
          // 풀노드 등록
          connectionType = 'node';
          nodeId = data.nodeId || uuidv4();
          
          registeredNodes.set(nodeId, {
            ws: ws,
            info: {
              id: nodeId,
              endpoint: data.endpoint,
              version: data.version,
              capabilities: data.capabilities || []
            },
            lastPing: Date.now()
          });
          
          console.log(`🟢 풀노드 등록됨: ${nodeId}`);
          
          ws.send(JSON.stringify({
            type: 'node_registered',
            nodeId: nodeId,
            success: true
          }));
          
          // 다른 노드들에게 새 노드 알림
          broadcastToNodes({
            type: 'node_joined',
            nodeId: nodeId,
            nodeInfo: registeredNodes.get(nodeId).info
          }, nodeId);
          
          break;
          
        case 'user_connect':
          // 사용자 연결
          connectionType = 'user';
          sessionId = data.sessionId || uuidv4();
          const userDID = data.did; // 사용자 DID 저장
          
          // 이중 접속 방지: 기존 세션이 있으면 종료
          if (userDID && usersByDID.has(userDID)) {
            const existingSessions = usersByDID.get(userDID);
            
            // 기존 세션들에게 종료 메시지 전송
            existingSessions.forEach(existingSessionId => {
              const existingSession = userSessions.get(existingSessionId);
              if (existingSession && existingSession.ws.readyState === WebSocket.OPEN) {
                existingSession.ws.send(JSON.stringify({
                  type: 'session_terminated',
                  reason: '다른 기기에서 로그인했습니다.',
                  newSession: sessionId
                }));
                existingSession.ws.close();
              }
              
              // 기존 세션 정리
              userSessions.delete(existingSessionId);
            });
            
            // 기존 DID 매핑 정리
            usersByDID.delete(userDID);
            
            console.log(`🔄 이중 접속 방지: ${userDID?.substring(0, 8)}... 기존 세션 ${existingSessions.size}개 종료`);
          }
          
          // 사용 가능한 노드 찾기
          const availableNodes = Array.from(registeredNodes.keys())
            .filter(id => Date.now() - registeredNodes.get(id).lastPing < 30000);
          
          if (availableNodes.length > 0) {
            const assignedNodeId = availableNodes[Math.floor(Math.random() * availableNodes.length)];
            
            userSessions.set(sessionId, {
              nodeId: assignedNodeId,
              ws: ws,
              userDID: userDID
            });
            
            // DID별 세션 추적
            if (userDID) {
              if (!usersByDID.has(userDID)) {
                usersByDID.set(userDID, new Set());
              }
              usersByDID.get(userDID).add(sessionId);
            }
            
            ws.send(JSON.stringify({
              type: 'user_connected',
              sessionId: sessionId,
              assignedNode: assignedNodeId,
              success: true
            }));
            
            console.log(`👤 사용자 연결됨: ${sessionId} (DID: ${userDID?.substring(0, 8)}...) -> 노드 ${assignedNodeId}`);
          } else {
            ws.send(JSON.stringify({
              type: 'user_connect_failed',
              error: '사용 가능한 노드가 없습니다'
            }));
          }
          
          break;
          
        case 'node_ping':
          // 노드 상태 업데이트
          if (nodeId && registeredNodes.has(nodeId)) {
            registeredNodes.get(nodeId).lastPing = Date.now();
            
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now()
            }));
          }
          break;
          
        case 'user_request':
          // 사용자 요청을 노드로 전달
          if (sessionId && userSessions.has(sessionId)) {
            const session = userSessions.get(sessionId);
            const targetNode = registeredNodes.get(session.nodeId);
            
            if (targetNode && targetNode.ws.readyState === WebSocket.OPEN) {
              targetNode.ws.send(JSON.stringify({
                type: 'user_request',
                sessionId: sessionId,
                request: data.request
              }));
            }
          }
          break;
          
        case 'node_response':
          // 노드 응답을 사용자에게 전달
          if (data.sessionId && userSessions.has(data.sessionId)) {
            const session = userSessions.get(data.sessionId);
            
            if (session.ws.readyState === WebSocket.OPEN) {
              session.ws.send(JSON.stringify({
                type: 'node_response',
                response: data.response
              }));
            }
          }
          break;
          
        case 'state_update':
          // 풀노드에서 보낸 실시간 상태 업데이트를 해당 사용자에게 전달
          if (data.userDID) {
            broadcastToUser(data.userDID, {
              type: 'state_update',
              ...data.updateData
            });
            console.log(`📤 상태 업데이트 전달: ${data.userDID} -> ${JSON.stringify(data.updateData).substring(0, 100)}...`);
          }
          break;
          
        case 'pool_update':
          // 검증자 풀 업데이트를 모든 사용자에게 브로드캐스트
          broadcastToAllUsers({
            type: 'pool_update',
            validatorPool: data.validatorPool
          });
          console.log(`📤 검증자 풀 업데이트 전달: ${JSON.stringify(data.validatorPool)}`);
          break;
          
        case 'dao_treasury_update':
          // DAO 금고 업데이트를 모든 사용자에게 브로드캐스트
          broadcastToAllUsers({
            type: 'dao_treasury_update',
            daoTreasuries: data.daoTreasuries
          });
          console.log(`📤 DAO 금고 업데이트 전달: ${JSON.stringify(data.daoTreasuries)}`);
          break;
      }
    } catch (error) {
      console.error('WebSocket 메시지 처리 오류:', error);
    }
  });
  
  ws.on('close', () => {
    console.log(`🔌 WebSocket 연결 종료: ${connectionId}`);
    
    if (connectionType === 'node' && nodeId) {
      registeredNodes.delete(nodeId);
      console.log(`🔴 풀노드 해제됨: ${nodeId}`);
      
      // 다른 노드들에게 노드 이탈 알림
      broadcastToNodes({
        type: 'node_left',
        nodeId: nodeId
      }, nodeId);
      
    } else if (connectionType === 'user' && sessionId) {
      const session = userSessions.get(sessionId);
      
      // DID별 세션 추적에서 제거
      if (session && session.userDID) {
        const userSessions = usersByDID.get(session.userDID);
        if (userSessions) {
          userSessions.delete(sessionId);
          if (userSessions.size === 0) {
            usersByDID.delete(session.userDID);
          }
        }
      }
      
      userSessions.delete(sessionId);
      console.log(`👤 사용자 연결 종료: ${sessionId} (DID: ${session?.userDID?.substring(0, 8)}...)`);
    }
  });
});

// 노드들에게 메시지 브로드캐스트
function broadcastToNodes(message, excludeNodeId = null) {
  registeredNodes.forEach((node, nodeId) => {
    if (nodeId !== excludeNodeId && node.ws.readyState === WebSocket.OPEN) {
      node.ws.send(JSON.stringify(message));
    }
  });
}

// 특정 사용자에게 메시지 전달
function broadcastToUser(userDID, message) {
  const sessionIds = usersByDID.get(userDID);
  if (sessionIds) {
    sessionIds.forEach(sessionId => {
      const session = userSessions.get(sessionId);
      if (session && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify(message));
      }
    });
  }
}

// 모든 사용자에게 메시지 브로드캐스트
function broadcastToAllUsers(message) {
  userSessions.forEach((session, sessionId) => {
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify(message));
    }
  });
}

// 풀노드에게 HTTP 요청 전달
async function forwardToNode(node, request) {
  return new Promise((resolve, reject) => {
    const requestId = uuidv4();
    const timeout = setTimeout(() => {
      reject(new Error('Node request timeout'));
    }, 10000);
    
    // 응답 대기
    const responseHandler = (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'http_response' && data.requestId === requestId) {
          clearTimeout(timeout);
          node.ws.removeListener('message', responseHandler);
          resolve(data.response);
        }
      } catch (error) {
        // 다른 메시지 무시
      }
    };
    
    node.ws.on('message', responseHandler);
    
    // 요청 전달
    node.ws.send(JSON.stringify({
      type: 'http_request',
      requestId: requestId,
      request: request
    }));
  });
}

// 오프라인 노드 정리 (5분마다)
setInterval(() => {
  const now = Date.now();
  const offlineNodes = [];
  
  registeredNodes.forEach((node, nodeId) => {
    if (now - node.lastPing > 300000) { // 5분 이상 무응답
      offlineNodes.push(nodeId);
    }
  });
  
  offlineNodes.forEach(nodeId => {
    registeredNodes.delete(nodeId);
    console.log(`🧹 오프라인 노드 정리: ${nodeId}`);
  });
  
  if (offlineNodes.length > 0) {
    broadcastToNodes({
      type: 'nodes_cleanup',
      removedNodes: offlineNodes
    });
  }
}, 300000);

// 서버 시작
server.listen(port, () => {
  console.log('🚀 백야 프로토콜 P2P 네트워크 중계 서버 시작');
  console.log(`🌐 포트: ${port}`);
  console.log(`🔗 풀노드 등록: ws://localhost:${port}/`);
  console.log(`🔗 사용자 API: http://localhost:${port}/api/`);
  console.log(`📊 네트워크 상태: http://localhost:${port}/api/relay-status`);
  console.log(`📊 등록된 노드 확인: http://localhost:${port}/api/nodes`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 풀노드 연결을 기다리는 중...');
  
  // 주기적으로 중계 서버 상태 출력 (30초마다)
  setInterval(() => {
    const onlineNodes = Array.from(registeredNodes.values())
      .filter(node => Date.now() - node.lastPing < 30000);
    
    console.log(`\n📊 [중계 서버 상태] ${new Date().toLocaleTimeString()}`);
    console.log(`   • 등록된 노드: ${registeredNodes.size}개`);
    console.log(`   • 온라인 노드: ${onlineNodes.length}개`);
    console.log(`   • 활성 세션: ${userSessions.size}개`);
    console.log(`   • WebSocket 연결: ${wss.clients.size}개`);
    
    if (onlineNodes.length > 0) {
      console.log(`   • 노드 목록:`);
      onlineNodes.forEach(node => {
        console.log(`     - ${node.info.id} (${node.info.endpoint})`);
      });
    } else {
      console.log(`   ⚠️ 연결된 풀노드가 없습니다`);
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }, 30000);
});

module.exports = app; 