#!/usr/bin/env node

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const localtunnel = require('localtunnel');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

// 백야 프로토콜 컴포넌트들
const Protocol = require('./src/index.js');

// fetch polyfill for Node.js (필요한 경우)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

/**
 * BROTHERHOOD 릴레이 노드 서버
 * 
 * 역할:
 * 1. 사용자(D-App)와 검증자 노드 간의 중계 역할
 * 2. 트랜잭션 전달 및 블록 정보 전파
 * 3. 네트워크 상태 모니터링
 * 4. 다른 릴레이 노드들과의 연결 관리
 */

class RelayNode {
  constructor(config = {}) {
    this.nodeId = config.nodeId || this.generateNodeId();
    this.port = config.port || 8080;
    this.name = config.name || `RelayNode-${this.nodeId.substring(0, 8)}`;
    this.region = config.region || 'unknown';
    this.maxConnections = config.maxConnections || 1000;
    
    // 지역 좌표 정보 (자동 감지 또는 설정)
    this.coordinates = config.coordinates || null;
    this.country = config.country || null;
    this.city = config.city || null;
    
    // 서버 정보
    this.startTime = Date.now();
    this.version = '1.0.0';
    this.status = 'starting';
    this.relayNumber = null; // 릴레이 번호 (1, 2, 3, ...)
    this.publicUrl = null; // LocalTunnel URL
    this.tunnelInstance = null;
    
    // 릴레이 네트워크 관리
    this.activeRelayList = new Map(); // RelayNumber -> {nodeId, url, clients, validators, status}
    this.isFirstRelay = false; // 첫 번째 릴레이인지 여부
    
    // 릴레이 운영자 정보
    this.operatorDID = config.operatorDID || null;
    this.operatorUsername = config.operatorUsername || null;
    this.blocksRelayed = 0; // 전파한 블록 수
    this.totalRewards = 0; // 총 보상
    
    // 프로토콜 인스턴스 (웹앱용)
    this.protocol = null;
    this.protocolInitialized = false;
    
    // 연결 관리
    this.clients = new Map(); // DID -> WebSocket
    this.validators = new Map(); // ValidatorDID -> WebSocket  
    this.relayPeers = new Map(); // RelayNodeId -> WebSocket
    this.connectionStats = {
      totalConnections: 0,
      activeClients: 0,
      activeValidators: 0,
      activeRelayPeers: 0,
      messagesRelayed: 0,
      bytesTransferred: 0
    };
    
    // 네트워크 설정 (디스커버리 서버는 사용하지 않음)
    
    // 상태 관리
    
    // Express 앱 설정
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.setupRoutes();
    this.setupWebSocketHandlers();
    this.setupHeartbeat();
    this.setupWebApp();
    
    console.log(`🚀 릴레이 노드 초기화 완료: ${this.name}`);
    console.log(`📍 노드 ID: ${this.nodeId}`);
    console.log(`🌐 포트: ${this.port}`);
  }
  
  generateNodeId() {
    const hash = crypto.createHash('sha256');
    hash.update(`${os.hostname()}-${Date.now()}-${Math.random()}`);
    return `relay_${hash.digest('hex').substring(0, 32)}`;
  }

  // LocalTunnel 시작 및 릴레이 번호 할당
  async startLocalTunnel(retryCount = 0) {
    const maxRetries = 3;
    
    try {
      console.log(`🌍 LocalTunnel 시작 중... (시도 ${retryCount + 1}/${maxRetries + 1})`);
      
      // 사용 가능한 가장 낮은 번호 확인
      const availableNumber = await this.findAvailableRelayNumber();
      this.relayNumber = availableNumber;
      
      // 릴레이 번호를 포함한 서브도메인 생성
      const tunnelSubdomain = `brotherhood-relay-${this.relayNumber}`;
      
      console.log(`🔢 릴레이 번호 할당: ${this.relayNumber}`);
      
      // LocalTunnel 시작
      const tunnel = await localtunnel({ 
        port: this.port,
        subdomain: tunnelSubdomain
      });
      
      this.publicUrl = tunnel.url;
      this.tunnelInstance = tunnel;
      
      console.log(`🌍 공개 URL: ${this.publicUrl}`);
      
      // 첫 번째 릴레이인지 확인
      if (this.relayNumber === 1) {
        this.isFirstRelay = true;
        console.log('👑 첫 번째 릴레이 노드로 시작됨');
        this.initializeRelayNetwork();
      }
      
      // 터널 이벤트 처리
      tunnel.on('close', () => {
        console.log('🌍 LocalTunnel 연결이 끊어짐');
        this.handleTunnelDisconnect();
      });
      
      tunnel.on('error', (err) => {
        console.error('❌ LocalTunnel 오류:', err.message);
        
        // 자동 재연결 시도 (셧다운 중이 아닌 경우)
        if (!this.isShuttingDown) {
          setTimeout(async () => {
            console.log('🔄 LocalTunnel 재연결 시도...');
            try {
              await this.startLocalTunnel();
            } catch (retryError) {
              console.error('❌ LocalTunnel 재연결 실패:', retryError.message);
            }
          }, 10000); // 10초 후 재시도
        }
      });
      
      return this.publicUrl;
      
    } catch (error) {
      console.error(`❌ LocalTunnel 생성 실패 (시도 ${retryCount + 1}):`, error.message);
      
      if (retryCount < maxRetries) {
        console.log(`🔄 ${5}초 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.startLocalTunnel(retryCount + 1);
      } else {
        console.error('❌ LocalTunnel 설정 최종 실패. 로컬 모드로 실행됩니다.');
        this.publicUrl = `http://localhost:${this.port}`;
        this.isLocalMode = true;
        return this.publicUrl;
      }
    }
  }

  // 사용 가능한 릴레이 번호 찾기
  async findAvailableRelayNumber() {
    // 기존 릴레이들에게 활성 리스트 요청
    const existingRelays = await this.discoverExistingRelays();
    
    if (existingRelays.length === 0) {
      return 1; // 첫 번째 릴레이
    }
    
    // 사용 중인 번호들 확인
    const usedNumbers = existingRelays.map(relay => relay.number).sort((a, b) => a - b);
    
    // 빈 번호 찾기 (1부터 시작)
    for (let i = 1; i <= usedNumbers.length + 1; i++) {
      if (!usedNumbers.includes(i)) {
        return i;
      }
    }
    
    return usedNumbers.length + 1;
  }

  // 기존 릴레이 발견
  async discoverExistingRelays() {
    const existingRelays = [];
    
    // 1번부터 10번까지 순차적으로 확인
    for (let i = 1; i <= 10; i++) {
      try {
        const testUrl = `https://brotherhood-relay-${i}.loca.lt`;
        const response = await fetch(`${testUrl}/relay-info`, {
          method: 'GET',
          timeout: 3000
        });
        
        if (response.ok) {
          const relayInfo = await response.json();
          existingRelays.push({
            number: i,
            url: testUrl,
            nodeId: relayInfo.nodeId,
            status: relayInfo.status
          });
          console.log(`✅ 기존 릴레이 발견: ${i}번 (${testUrl})`);
        }
      } catch (error) {
        // 연결 실패는 정상 (해당 번호가 비어있음)
      }
    }
    
    return existingRelays;
  }

  // 릴레이 네트워크 초기화 (첫 번째 릴레이만)
  initializeRelayNetwork() {
    // 자신을 활성 릴레이 리스트에 추가
    this.activeRelayList.set(this.relayNumber, {
      nodeId: this.nodeId,
      url: this.publicUrl,
      clients: 0,
      validators: 0,
      status: 'active',
      coordinates: this.coordinates,
      country: this.country,
      city: this.city,
      region: this.region
    });
    
    console.log('🌐 릴레이 네트워크 초기화 완료');
  }

  // 기존 릴레이들과 연결
  async connectToExistingRelays() {
    console.log('🔗 기존 릴레이들과 연결 시도...');
    
    // 바로 이전 번호의 릴레이에 연결하여 리스트 요청
    const previousRelayNumber = this.relayNumber - 1;
    if (previousRelayNumber >= 1) {
      try {
        const previousRelayUrl = `https://brotherhood-relay-${previousRelayNumber}.loca.lt`;
        
        // 이전 릴레이에게 자신의 정보 전송
        await this.announceToRelay(previousRelayUrl);
        
        // 활성 릴레이 리스트 동기화
        await this.syncActiveRelayList(previousRelayUrl);
        
      } catch (error) {
        console.warn(`⚠️ 이전 릴레이(${previousRelayNumber})와 연결 실패:`, error.message);
      }
    }
  }

  // 다른 릴레이에게 자신을 알림
  async announceToRelay(relayUrl) {
    try {
      const response = await fetch(`${relayUrl}/relay-announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: this.nodeId,
          relayNumber: this.relayNumber,
          url: this.publicUrl,
          clients: this.clients.size,
          validators: this.validators.size,
          status: 'active'
        }),
        timeout: 5000
      });

      if (response.ok) {
        console.log(`✅ 릴레이에 자신을 알림: ${relayUrl}`);
      }
    } catch (error) {
      console.warn(`⚠️ 릴레이 알림 실패: ${relayUrl}`, error.message);
    }
  }

  // 활성 릴레이 리스트 동기화
  async syncActiveRelayList(relayUrl) {
    try {
      const response = await fetch(`${relayUrl}/active-relays`, {
        method: 'GET',
        timeout: 5000
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`📋 릴레이 리스트 동기화: ${data.relays.length}개 릴레이 발견`);
        
        // 기존 리스트 업데이트
        for (const relay of data.relays) {
          this.activeRelayList.set(relay.number, {
            nodeId: relay.nodeId,
            url: relay.url,
            clients: relay.clients,
            validators: relay.validators,
            status: relay.status
          });
        }
        
        // 자신도 추가
        this.activeRelayList.set(this.relayNumber, {
          nodeId: this.nodeId,
          url: this.publicUrl,
          clients: this.clients.size,
          validators: this.validators.size,
          status: 'active',
          coordinates: this.coordinates,
          country: this.country,
          city: this.city,
          region: this.region
        });
      }
    } catch (error) {
      console.warn(`⚠️ 릴레이 리스트 동기화 실패: ${relayUrl}`, error.message);
    }
  }

  // 릴레이 알림 처리 (다른 릴레이가 자신을 알릴 때)
  handleRelayAnnouncement(relayInfo) {
    console.log(`📢 새 릴레이 발견: ${relayInfo.relayNumber}번 (${relayInfo.url})`);
    
    // 활성 릴레이 리스트에 추가
    this.activeRelayList.set(relayInfo.relayNumber, {
      nodeId: relayInfo.nodeId,
      url: relayInfo.url,
      clients: relayInfo.clients,
      validators: relayInfo.validators,
      status: relayInfo.status
    });
    
    // 다른 모든 릴레이에게 전파
    this.propagateRelayList();
  }

  // 릴레이 리스트를 다른 릴레이들에게 전파
  async propagateRelayList() {
    console.log('📡 릴레이 리스트 전파 중...');
    
    const currentList = Array.from(this.activeRelayList.entries()).map(([number, info]) => ({
      number,
      ...info
    }));
    
    // 모든 활성 릴레이에게 전파 (자신 제외)
    for (const [relayNumber, relayInfo] of this.activeRelayList) {
      if (relayNumber !== this.relayNumber) {
        try {
          await fetch(`${relayInfo.url}/relay-list-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              relays: currentList,
              timestamp: Date.now()
            }),
            timeout: 3000
          });
        } catch (error) {
          // 전파 실패는 로그만 남기고 계속 진행
          console.warn(`⚠️ 릴레이 리스트 전파 실패: ${relayNumber}번`);
        }
      }
    }
  }

  // 릴레이 리스트 업데이트 처리
  handleRelayListUpdate(updateData) {
    console.log(`📋 릴레이 리스트 업데이트 수신: ${updateData.relays.length}개`);
    
    // 새로운 정보로 업데이트
    for (const relay of updateData.relays) {
      this.activeRelayList.set(relay.number, {
        nodeId: relay.nodeId,
        url: relay.url,
        clients: relay.clients,
        validators: relay.validators,
        status: relay.status
      });
    }
  }

  // 터널 연결 해제 처리
  handleTunnelDisconnect() {
    this.publicUrl = null;
    this.tunnelInstance = null;
    
    if (this.relayNumber) {
      // 다른 릴레이들에게 종료 알림
      this.notifyRelayShutdown();
    }
  }

  // 릴레이 종료 알림
  async notifyRelayShutdown() {
    console.log('📢 다른 릴레이들에게 종료 알림 전송...');
    
    // 모든 활성 릴레이에게 종료 알림 (자신 제외)
    for (const [relayNumber, relayInfo] of this.activeRelayList) {
      if (relayNumber !== this.relayNumber) {
        try {
          await fetch(`${relayInfo.url}/relay-shutdown`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nodeId: this.nodeId,
              relayNumber: this.relayNumber,
              timestamp: Date.now()
            }),
            timeout: 3000
          });
        } catch (error) {
          // 종료 알림 실패는 무시
        }
      }
    }
  }

  // 다른 릴레이 종료 처리
  handleRelayShutdown(shutdownData) {
    console.log(`📢 릴레이 종료 알림: ${shutdownData.relayNumber}번`);
    
    // 활성 릴레이 리스트에서 제거
    this.activeRelayList.delete(shutdownData.relayNumber);
    
    // 업데이트된 리스트를 다른 릴레이들에게 전파
    this.propagateRelayList();
  }
  
  setupRoutes() {
    this.app.use(express.json());
    
    // CORS 설정 및 LocalTunnel 우회
    this.app.use((req, res, next) => {
      // credentials: 'include' 사용 시 구체적인 origin 지정 필요
      const origin = req.headers.origin;
      const allowedOrigins = [
        'https://baekya-webapp.vercel.app',
        'https://localhost:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500', // Live Server 등
        'http://127.0.0.1:5500'
      ];
      
      if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
      } else {
        res.header('Access-Control-Allow-Origin', 'https://baekya-webapp.vercel.app'); // 기본값
      }
      
      res.header('Access-Control-Allow-Credentials', 'true'); // credentials 허용
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Bypass-Tunnel-Reminder, Cache-Control, Pragma, X-Device-UUID');
      
      // LocalTunnel 우회 헤더 추가
      res.header('Bypass-Tunnel-Reminder', 'true');
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.header('Pragma', 'no-cache');
      res.header('Expires', '0');
      
      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      
      next();
    });
    
    // 릴레이 정보 엔드포인트 (LocalTunnel 발견용)
    this.app.get('/relay-info', (req, res) => {
      res.json({
        nodeId: this.nodeId,
        relayNumber: this.relayNumber,
        name: this.name,
        url: this.publicUrl,
        status: this.status,
        clients: this.clients.size,
        validators: this.validators.size,
        capacity: this.getCapacityStatus()
      });
    });
    
    // 핑 엔드포인트 (지역 기반 릴레이 선택용)
    this.app.get('/ping', (req, res) => {
      res.json({
        pong: true,
        timestamp: Date.now(),
        nodeId: this.nodeId,
        relayNumber: this.relayNumber,
        coordinates: this.coordinates,
        city: this.city,
        country: this.country,
        capacity: this.getCapacityStatus()
      });
    });
    
    // 활성 릴레이 리스트 조회
    this.app.get('/active-relays', (req, res) => {
      const relayList = Array.from(this.activeRelayList.entries()).map(([number, info]) => ({
        number,
        ...info,
        capacity: this.calculateCapacity(info.clients, info.validators)
      }));
      
      res.json({
        relays: relayList,
        timestamp: Date.now()
      });
    });
    
    // 릴레이 알림 엔드포인트
    this.app.post('/relay-announce', (req, res) => {
      try {
        this.handleRelayAnnouncement(req.body);
        res.json({ success: true, message: 'Relay announced successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // 릴레이 리스트 업데이트 엔드포인트
    this.app.post('/relay-list-update', (req, res) => {
      try {
        this.handleRelayListUpdate(req.body);
        res.json({ success: true, message: 'Relay list updated successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // 릴레이 종료 알림 엔드포인트
    this.app.post('/relay-shutdown', (req, res) => {
      try {
        this.handleRelayShutdown(req.body);
        res.json({ success: true, message: 'Relay shutdown processed' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // 릴레이 간 블록 전파 엔드포인트
    this.app.post('/relay-block', (req, res) => {
      try {
        const blockData = req.body;
        console.log(`📦 HTTP를 통한 블록 수신: 블록 #${blockData.block?.index || 'unknown'}`);
        
        // WebSocket이 아닌 HTTP로 받은 블록이므로 직접 처리
        this.handleInterRelayBlock(null, blockData);
        
        res.json({ 
          success: true, 
          message: 'Block received and propagated successfully',
          blockIndex: blockData.block?.index,
          relayId: this.nodeId
        });
      } catch (error) {
        console.error('❌ 릴레이 블록 수신 실패:', error.message);
        res.status(500).json({ 
          success: false, 
          error: 'Block propagation failed', 
          details: error.message 
        });
      }
    });
    
    // 상태 확인 엔드포인트
    this.app.get('/status', (req, res) => {
      res.json({
        nodeId: this.nodeId,
        name: this.name,
        version: this.version,
        status: this.status,
        uptime: Date.now() - this.startTime,
        region: this.region,
        stats: this.connectionStats,
        network: {
          port: this.port,
          maxConnections: this.maxConnections,
          publicIP: this.getPublicIP()
        }
      });
    });
    
    // 헬스체크
    this.app.get('/health', (req, res) => {
      const health = {
        status: this.status,
        uptime: Date.now() - this.startTime,
        connections: {
          clients: this.clients.size,
          validators: this.validators.size,
          relayPeers: this.relayPeers.size
        },
        load: process.cpuUsage(),
        memory: process.memoryUsage()
      };
      
      res.json(health);
    });
    
    // 네트워크 정보
    this.app.get('/network', (req, res) => {
      res.json({
        relayPeers: Array.from(this.relayPeers.keys()),
        connectedValidators: Array.from(this.validators.keys()),
        totalClients: this.clients.size,
        networkTopology: this.getNetworkTopology()
      });
    });
    
    // API 프록시 엔드포인트들 - 백엔드 서버로 요청 전달
    this.app.post('/api/login', async (req, res) => {
      // LocalTunnel 우회를 위한 추가 헤더 설정
      res.header('Bypass-Tunnel-Reminder', 'true');
      // CORS는 이미 전역에서 설정됨 - 중복 설정 제거
      
      console.log('🔐 로그인 API 프록시 요청 수신:', req.body);
      
      try {
        const backendUrl = 'http://localhost:3000';
        console.log(`🔗 백엔드 서버로 요청 전달: ${backendUrl}/api/login`);
        
        // 필드명 매핑: userData 객체에서 추출하거나 직접 추출
        const userData = req.body.userData || req.body;
        const loginData = {
          username: userData.userId || userData.username,
          password: userData.password,
          deviceId: req.headers['x-device-uuid'] || userData.deviceUUID || userData.deviceId
        };
        
        console.log('📦 매핑된 요청 데이터:', loginData);
        
        // Node.js 18+ 내장 fetch 사용
        const response = await fetch(`${backendUrl}/api/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-UUID': req.headers['x-device-uuid'] || ''
          },
          body: JSON.stringify(loginData)
        });
        
        console.log(`📡 백엔드 응답 상태: ${response.status}`);
        const data = await response.json();
        console.log('📦 백엔드 응답 데이터:', data);
        
        res.status(response.status).json(data);
      } catch (error) {
        console.error('❌ 로그인 프록시 오류 (상세):', error);
        console.error('❌ 오류 스택:', error.stack);
        res.status(500).json({ success: false, error: '서버 연결 실패', details: error.message });
      }
    });
    
    this.app.post('/api/register', async (req, res) => {
      // LocalTunnel 우회를 위한 추가 헤더 설정
      res.header('Bypass-Tunnel-Reminder', 'true');
      
      console.log('📝 회원가입 API 프록시 요청 수신:', req.body);
      
      try {
        const backendUrl = 'http://localhost:3000';
        console.log(`🔗 백엔드 서버로 요청 전달: ${backendUrl}/api/register`);
        
        // 필드명 매핑: userData 객체에서 추출하거나 직접 추출
        const userData = req.body.userData || req.body;
        const registerData = {
          username: userData.userId || userData.username,
          password: userData.password,
          name: userData.name,
          isRelayOperator: req.body.isRelayOperator || userData.isRelayOperator,
          deviceId: req.headers['x-device-uuid'] || userData.deviceUUID || userData.deviceId
        };
        
        console.log('📦 매핑된 요청 데이터:', registerData);
        
        // Node.js 18+ 내장 fetch 사용
        const response = await fetch(`${backendUrl}/api/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-UUID': req.headers['x-device-uuid'] || ''
          },
          body: JSON.stringify(registerData)
        });
        
        console.log(`📡 백엔드 응답 상태: ${response.status}`);
        const data = await response.json();
        console.log('📦 백엔드 응답 데이터:', data);
        
        res.status(response.status).json(data);
      } catch (error) {
        console.error('❌ 회원가입 프록시 오류 (상세):', error);
        console.error('❌ 오류 스택:', error.stack);
        res.status(500).json({ success: false, error: '서버 연결 실패', details: error.message });
      }
    });
    
    // 기타 API 엔드포인트들 프록시
    this.app.all('/api/*', async (req, res) => {
      try {
        const backendUrl = 'http://localhost:3000';
        const apiPath = req.path + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
        console.log(`📡 API 프록시 요청: ${req.method} ${apiPath}`);
        
        // Node.js 18+ 내장 fetch 사용
        const response = await fetch(`${backendUrl}${apiPath}`, {
          method: req.method,
          headers: {
            'Content-Type': 'application/json',
            'X-Device-UUID': req.headers['x-device-uuid'] || ''
          },
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
        });
        
        console.log(`📡 백엔드 응답 상태: ${response.status}`);
        const data = await response.json();
        res.status(response.status).json(data);
      } catch (error) {
        console.error(`❌ API 프록시 오류 (${req.path}):`, error);
        res.status(500).json({ success: false, error: '서버 연결 실패', details: error.message });
      }
    });
  }
  
  // 초대코드 생성 요청 처리
  async handleInviteCodeRequest(ws, data) {
    try {
      console.log(`🎫 초대코드 생성 요청: ${ws.connectionId}`);
      
      // 백엔드 서버에 트랜잭션 생성 요청
      const backendUrl = 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/api/invite-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Source': 'true'
        },
        body: JSON.stringify({
          userDID: data.userDID,
          communicationAddress: data.communicationAddress
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // 웹앱에 성공 응답
        ws.send(JSON.stringify({
          type: 'invite_code_response',
          success: true,
          inviteCode: result.inviteCode,
          message: result.message
        }));
        
        // 트랜잭션이 생성되었다면 모든 검증자에게 브로드캐스트
        if (result.transaction) {
          this.broadcastToValidators('transaction', {
            transaction: result.transaction,
            relayedBy: this.nodeId,
            timestamp: Date.now()
          });
          console.log(`📡 초대코드 트랜잭션 브로드캐스트 완료`);
        }
        
      } else {
        throw new Error(`Backend error: ${response.status}`);
      }
      
    } catch (error) {
      console.error(`❌ 초대코드 생성 실패 (${ws.connectionId}):`, error.message);
      
      // 웹앱에 실패 응답
      ws.send(JSON.stringify({
        type: 'invite_code_response',
        success: false,
        error: error.message
      }));
    }
  }
  
  // 상태 업데이트 처리 (백엔드에서 받은 블록 생성, 보상 지급 등)
  handleStateUpdate(ws, data) {
    try {
      console.log(`🔄 상태 업데이트 처리: ${data.userDID?.substring(0, 8)}...`);
      console.log(`🔍 업데이트 데이터:`, data.updateData);
      
      // 해당 사용자(DID)가 연결된 웹앱 클라이언트에게 상태 업데이트 전달
      const walletSentCount = this.broadcastToUser(data.userDID, 'wallet_update', data.updateData);
      console.log(`💰 wallet_update 전송: ${walletSentCount}개 클라이언트`);
      
      // 모든 클라이언트에게 새 블록 정보 브로드캐스트 (선택적)
      if (data.updateData.newBlock) {
        console.log(`🧱 새 블록 브로드캐스트:`, data.updateData.newBlock);
        const blockSentCount = this.broadcastToClients('new_block', {
          block: data.updateData.newBlock,
          timestamp: Date.now()
        });
        console.log(`📡 new_block 브로드캐스트: ${blockSentCount}개 클라이언트`);
      } else {
        console.log(`⚠️ newBlock 데이터 없음`);
      }
      
    } catch (error) {
      console.error(`❌ 상태 업데이트 처리 실패: ${error.message}`);
    }
  }
  
  // 특정 사용자(DID)에게 메시지 전달
  broadcastToUser(userDID, messageType, data) {
    let sentCount = 0;
    
    console.log(`🔍 사용자 ${userDID.substring(0, 8)}...에게 메시지 전송 시도`);
    console.log(`🔍 현재 등록된 클라이언트 수: ${this.clients.size}`);
    console.log(`🔍 등록된 클라이언트 DID 목록:`, Array.from(this.clients.keys()).map(did => did.substring(0, 8) + '...'));
    
    for (const [clientDID, ws] of this.clients) {
      console.log(`🔍 클라이언트 체크: ${clientDID.substring(0, 8)}... (연결상태: ${ws.readyState}, 타입: ${ws.connectionType})`);
      
      if (ws.connectionType === 'client' && 
          clientDID === userDID && 
          ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: messageType,
            data: data,
            timestamp: Date.now()
          }));
          sentCount++;
          console.log(`✅ 사용자 ${userDID.substring(0, 8)}...에게 ${messageType} 전송`);
        } catch (error) {
          console.error(`❌ 사용자 메시지 전송 실패 (${clientDID}):`, error.message);
        }
      }
    }
    
    if (sentCount === 0) {
      console.log(`⚠️ 사용자 ${userDID.substring(0, 8)}...에게 연결된 클라이언트 없음`);
    }
    
    return sentCount;
  }
  
  // 모든 클라이언트에게 메시지 브로드캐스트
  broadcastToClients(messageType, data) {
    let broadcastCount = 0;
    
    for (const [clientDID, ws] of this.clients) {
      if (ws.connectionType === 'client' && 
          ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: messageType,
            data: data
          }));
          broadcastCount++;
        } catch (error) {
          console.error(`❌ 클라이언트 브로드캐스트 실패 (${clientDID}):`, error.message);
        }
      }
    }
    
    console.log(`📡 ${broadcastCount}개 클라이언트에게 ${messageType} 브로드캐스트 완료`);
    return broadcastCount;
  }
  
  // 모든 검증자에게 메시지 브로드캐스트
  broadcastToValidators(messageType, data) {
    let broadcastCount = 0;
    
    for (const [validatorDID, ws] of this.validators) {
      if (ws.connectionType === 'validator' && 
          ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: messageType,
            data: data
          }));
          broadcastCount++;
        } catch (error) {
          console.error(`❌ 검증자 브로드캐스트 실패 (${validatorDID}):`, error.message);
        }
      }
    }
    
    console.log(`📡 ${broadcastCount}개 검증자에게 ${messageType} 브로드캐스트 완료`);
    return broadcastCount;
  }
  
  setupWebApp() {
    // 웹앱 정적 파일 서빙
    this.app.use(express.static(path.join(__dirname, 'webapp')));
    
    // 웹앱 기본 라우트
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'webapp', 'index.html'));
    });
    
    console.log('🌐 웹앱 서빙 설정 완료');
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      const clientIP = req.socket.remoteAddress;
      const connectionId = crypto.randomBytes(16).toString('hex');
      
      console.log(`🔗 새 연결: ${connectionId} (${clientIP})`);
      
      ws.connectionId = connectionId;
      ws.connectedAt = Date.now();
      ws.isAlive = true;
      
      // 연결 타입 확인 대기
      ws.connectionType = 'unknown';
      ws.authenticated = false;
      
      this.connectionStats.totalConnections++;
      
      // 초기 인증 타임아웃 (30초)
      const authTimeout = setTimeout(() => {
        if (!ws.authenticated) {
          console.log(`⏰ 인증 타임아웃: ${connectionId}`);
          ws.close(1008, 'Authentication timeout');
        }
      }, 30000);
      
      // 메시지 핸들러
              ws.on('message', (data) => {
          try {
            console.log(`📨 수신된 원본 메시지 (${connectionId}):`, data.toString());
            const message = JSON.parse(data);
            console.log(`📦 파싱된 메시지 (${connectionId}):`, message);
            this.handleMessage(ws, message, authTimeout);
          } catch (error) {
            console.error(`❌ 메시지 파싱 오류 (${connectionId}):`, error.message);
            console.error(`📨 오류 메시지 원본:`, data.toString());
            ws.send(JSON.stringify({
              type: 'error',
            error: 'Invalid JSON message'
          }));
        }
      });
      
      // 연결 종료 핸들러
      ws.on('close', (code, reason) => {
        clearTimeout(authTimeout);
        this.handleDisconnection(ws, code, reason);
      });
      
      // 에러 핸들러
      ws.on('error', (error) => {
        console.error(`❌ WebSocket 오류 (${connectionId}):`, error.message);
      });
      
      // Ping/Pong for connection health
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      // 환영 메시지
      ws.send(JSON.stringify({
        type: 'welcome',
        nodeId: this.nodeId,
        name: this.name,
        timestamp: Date.now(),
        requiresAuth: true
      }));
    });
  }
  
  handleMessage(ws, message, authTimeout) {
    const { type, data } = message;
    
    switch (type) {
      case 'auth':
        // 웹앱 형식 (직접 속성) 또는 일반 형식 (data 객체) 모두 지원
        const authData = data || { 
          connectionType: message.connectionType, 
          credentials: message.credentials,
          did: message.did  // 웹앱용 DID 인증
        };
        this.handleAuthentication(ws, authData, authTimeout);
        break;
        
      case 'register_client':
        if (ws.authenticated && ws.connectionType === 'client') {
          this.registerClient(ws, data);
        } else {
          ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated or wrong connection type' }));
        }
        break;
        
      case 'register_validator':
        if (ws.authenticated && ws.connectionType === 'validator') {
          this.registerValidator(ws, data);
        } else {
          ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated or wrong connection type' }));
        }
        break;
        
      case 'transaction':
        this.relayTransaction(ws, data);
        break;
        
      // 웹앱 클라이언트용 메시지들
      case 'request_state':
        this.handleStateRequest(ws, data);
        break;
        
      case 'request_wallet':
        this.handleWalletRequest(ws, data);
        break;
        
      case 'create_invite_code':
        this.handleInviteCodeCreation(ws, data);
        break;
        
      case 'transfer_tokens':
        this.handleTokenTransfer(ws, data);
        break;
        
      case 'block':
        this.relayBlock(ws, data);
        break;
        
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
        
      case 'user_connect':
        // 웹앱에서 사용자 연결 시 보내는 메시지
        if (ws.authenticated) {
          console.log(`👤 사용자 연결: ${data || 'anonymous'}`);
          ws.send(JSON.stringify({ 
            type: 'connection_acknowledged', 
            message: 'User connection received',
            timestamp: Date.now() 
          }));
        } else {
          ws.send(JSON.stringify({ type: 'error', error: 'Authentication required' }));
        }
        break;
        
      case 'request_state':
        // 웹앱에서 현재 상태 요청 시 보내는 메시지
        if (ws.authenticated) {
          console.log(`📋 상태 요청: ${ws.connectionId}`);
          ws.send(JSON.stringify({ 
            type: 'state_response', 
            state: 'active',
            timestamp: Date.now(),
            nodeId: this.nodeId
          }));
        } else {
          ws.send(JSON.stringify({ type: 'error', error: 'Authentication required' }));
        }
        break;
        
      case 'create_invite_code':
        // 웹앱에서 초대코드 생성 요청
        if (ws.authenticated && ws.connectionType === 'client') {
          // 웹앱 형식 (직접 속성) 또는 일반 형식 (data 객체) 모두 지원
          const inviteData = data || { userDID: message.userDID, communicationAddress: message.communicationAddress };
          this.handleInviteCodeRequest(ws, inviteData);
        } else {
          ws.send(JSON.stringify({ type: 'error', error: 'Authentication required' }));
        }
        break;
        
      case 'state_update':
        // 백엔드에서 보내는 상태 업데이트 (블록 생성, 보상 지급 등)
        if (ws.authenticated && ws.connectionType === 'validator') {
          console.log(`📊 상태 업데이트 수신: ${ws.connectionId}`);
          this.handleStateUpdate(ws, data);
        } else {
          console.log(`⚠️ 인증되지 않은 상태 업데이트 시도: ${ws.connectionId}`);
        }
        break;
        
      case 'relay_peer_handshake':
        this.handleRelayPeerHandshake(ws, data);
        break;
        
      case 'block_propagation':
        // 검증자에서 보낸 새 블록을 다른 릴레이들과 검증자들에게 전파
        if (ws.authenticated && ws.connectionType === 'validator') {
          console.log(`📦 블록 전파 요청 수신: 블록 #${data.block?.index || 'unknown'}`);
          this.handleBlockPropagation(ws, data);
        } else {
          console.log(`⚠️ 인증되지 않은 블록 전파 시도: ${ws.connectionId}`);
        }
        break;
        
      case 'inter_relay_block':
        // 다른 릴레이에서 받은 블록을 자신의 검증자들에게 전파
        if (ws.authenticated && ws.connectionType === 'relay') {
          console.log(`🔄 다른 릴레이에서 블록 수신: 블록 #${data.block?.index || 'unknown'}`);
          this.handleInterRelayBlock(ws, data);
        } else {
          console.log(`⚠️ 인증되지 않은 릴레이 블록 수신: ${ws.connectionId}`);
        }
        break;
        
      default:
        console.log(`❓ 알 수 없는 메시지 타입: ${type}`);
        ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${type}` }));
    }
  }
  
  handleAuthentication(ws, data, authTimeout) {
    const { connectionType, credentials, did } = data;
    
    // 웹앱 클라이언트 DID 인증 (직접 did 속성이 있는 경우)
    if (did) {
      ws.connectionType = 'client';
      ws.authenticated = true;
      ws.userDID = did;
      ws.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`🌐 웹앱 클라이언트 DID 인증: ${did.substring(0, 16)}...`);
      
      // 기존 동일 DID 연결 종료 (1기기 1계정 정책)
      this.clients.forEach((existingWs, existingDID) => {
        if (existingDID === did && existingWs !== ws && existingWs.readyState === 1) {
          console.log(`⚠️ 기존 연결 종료: ${did.substring(0, 16)}...`);
          existingWs.send(JSON.stringify({
            type: 'session_terminated',
            reason: '다른 기기에서 로그인했습니다.'
          }));
          existingWs.close();
          this.clients.delete(existingDID);
        }
      });
      
      // 새 연결 등록
      this.clients.set(did, ws);
      
      clearTimeout(authTimeout);
      
      ws.send(JSON.stringify({
        type: 'auth_success',
        connectionType: 'client',
        sessionId: ws.sessionId,
        nodeInfo: {
          nodeId: this.nodeId,
          name: this.name,
          region: this.region
        }
      }));
      
      // 즉시 상태 전송
      this.handleStateRequest(ws, {});
      
      return;
    }
    
    // 기존 인증 방식 (validator, relay 등)
    if (['client', 'validator', 'relay'].includes(connectionType)) {
      ws.connectionType = connectionType;
      ws.authenticated = true;
      
      // 클라이언트의 경우 사용자 DID 저장
      if (connectionType === 'client' && credentials && credentials.did) {
        ws.userDID = credentials.did;
        console.log(`👤 클라이언트 DID 저장: ${credentials.did.substring(0, 8)}...`);
      }
      
      clearTimeout(authTimeout);
      
      console.log(`✅ 인증 성공: ${ws.connectionId} (${connectionType})`);
      
      ws.send(JSON.stringify({
        type: 'auth_success',
        connectionType: connectionType,
        nodeInfo: {
          nodeId: this.nodeId,
          name: this.name,
          region: this.region
        }
      }));
      
      // 연결 타입별 후속 처리
      if (connectionType === 'relay') {
        this.handleRelayPeerConnection(ws, credentials);
      }
      
    } else {
      ws.send(JSON.stringify({
        type: 'auth_failed',
        error: 'Invalid connection type'
      }));
      ws.close(1008, 'Authentication failed');
    }
  }
  
  registerClient(ws, data) {
    const { userDID, deviceInfo } = data;
    
    console.log(`🔍 클라이언트 등록 시도: ${userDID?.substring(0, 8)}...`);
    console.log(`🔍 현재 clients 맵 크기: ${this.clients.size}`);
    
    if (!userDID) {
      console.error('❌ userDID 누락');
      ws.send(JSON.stringify({ type: 'error', error: 'Missing userDID' }));
      return;
    }
    
    // 기존 연결이 있다면 정리
    if (this.clients.has(userDID)) {
      console.log(`🔄 기존 클라이언트 연결 정리: ${userDID.substring(0, 8)}...`);
      const oldWs = this.clients.get(userDID);
      if (oldWs.readyState === WebSocket.OPEN) {
        // 세션 종료 메시지 전송
        oldWs.send(JSON.stringify({
          type: 'session_terminated',
          reason: '다른 기기에서 로그인했습니다.'
        }));
        oldWs.close(1000, 'New connection established');
      }
    }
    
    ws.userDID = userDID;
    ws.deviceInfo = deviceInfo;
    this.clients.set(userDID, ws);
    this.connectionStats.activeClients = this.clients.size;
    
    console.log(`✅ 클라이언트 등록 완료: ${userDID.substring(0, 8)}... (${ws.connectionId})`);
    console.log(`📊 총 클라이언트 수: ${this.clients.size}`);
    
    ws.send(JSON.stringify({
      type: 'registration_success',
      userDID: userDID,
      relayNodeId: this.nodeId
    }));
  }
  
  registerValidator(ws, data) {
    console.log('📥 검증자 등록 요청 수신:', JSON.stringify(data, null, 2));
    const { validatorDID, validatorInfo } = data;
    
    if (!validatorDID) {
      ws.send(JSON.stringify({ type: 'error', error: 'Missing validatorDID' }));
      return;
    }
    
    // 이미 등록된 연결인지 확인
    if (ws.validatorDID === validatorDID) {
      console.log(`⚠️ 이미 등록된 검증자: ${validatorDID} - 중복 등록 무시`);
      return;
    }
    
    // 기존 연결이 있다면 정리
    if (this.validators.has(validatorDID)) {
      const oldWs = this.validators.get(validatorDID);
      if (oldWs.readyState === WebSocket.OPEN && oldWs !== ws) {
        console.log(`🔄 기존 검증자 연결 교체: ${validatorDID}`);
        oldWs.close(1000, 'New connection established');
      }
    }
    
    ws.validatorDID = validatorDID;
    ws.validatorInfo = validatorInfo;
    
    // 검증자의 엔드포인트 정보 저장
    if (validatorInfo && validatorInfo.endpoint) {
      ws.validatorEndpoint = validatorInfo.endpoint;
      console.log(`📍 검증자 엔드포인트 저장됨: ${validatorInfo.endpoint}`);
    } else {
      console.log(`⚠️ 검증자 엔드포인트 정보 없음:`, validatorInfo);
    }
    
    this.validators.set(validatorDID, ws);
    this.connectionStats.activeValidators = this.validators.size;
    
    console.log(`⚡ 검증자 등록: ${validatorDID} (${ws.connectionId})`);
    
    ws.send(JSON.stringify({
      type: 'registration_success',
      validatorDID: validatorDID,
      relayNodeId: this.nodeId
    }));
    
    // 릴레이 운영자 정보 전송 (릴레이 보상을 위해)
    if (this.operatorDID && this.operatorUsername) {
      ws.send(JSON.stringify({
        type: 'relay_operator_info',
        data: {
          operatorDID: this.operatorDID,
          operatorUsername: this.operatorUsername,
          relayNodeId: this.nodeId
        }
      }));
      console.log(`📤 릴레이 운영자 정보 전송: ${this.operatorUsername} → ${validatorDID.substring(0, 8)}...`);
    }
  }
  
  relayTransaction(ws, transactionData) {
    this.connectionStats.messagesRelayed++;
    
    // 모든 검증자에게 트랜잭션 전달
    const message = JSON.stringify({
      type: 'transaction',
      data: transactionData,
      relayedBy: this.nodeId,
      timestamp: Date.now()
    });
    
    let relayedCount = 0;
    this.validators.forEach((validatorWs, validatorDID) => {
      if (validatorWs.readyState === WebSocket.OPEN) {
        validatorWs.send(message);
        relayedCount++;
      }
    });
    
    console.log(`📤 트랜잭션 릴레이: ${relayedCount}개 검증자에게 전달`);
    
    // 발신자에게 확인 응답
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'transaction_relayed',
        relayedToValidators: relayedCount,
        timestamp: Date.now()
      }));
    }
  }
  
  relayBlock(ws, blockData) {
    this.connectionStats.messagesRelayed++;
    
    // 모든 클라이언트에게 블록 정보 전달
    const message = JSON.stringify({
      type: 'block',
      data: blockData,
      relayedBy: this.nodeId,
      timestamp: Date.now()
    });
    
    let relayedCount = 0;
    this.clients.forEach((clientWs, userDID) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(message);
        relayedCount++;
      }
    });
    
    console.log(`📥 블록 릴레이: ${relayedCount}개 클라이언트에게 전달`);
  }
  
  handleRelayPeerConnection(ws, credentials) {
    const { peerNodeId, peerName, peerRegion } = credentials;
    
    if (peerNodeId && peerNodeId !== this.nodeId) {
      ws.peerNodeId = peerNodeId;
      ws.peerName = peerName;
      ws.peerRegion = peerRegion;
      
      this.relayPeers.set(peerNodeId, ws);
      this.connectionStats.activeRelayPeers = this.relayPeers.size;
      
      console.log(`🔗 릴레이 피어 연결: ${peerName} (${peerNodeId})`);
    }
  }
  
  handleDisconnection(ws, code, reason) {
    console.log(`🔌 연결 종료: ${ws.connectionId} (${code}: ${reason})`);
    
    // 클라이언트 연결 정리
    if (ws.userDID && this.clients.has(ws.userDID)) {
      this.clients.delete(ws.userDID);
      this.connectionStats.activeClients = this.clients.size;
      console.log(`👤 클라이언트 연결 해제: ${ws.userDID}`);
    }
    
    // 검증자 연결 정리
    if (ws.validatorDID && this.validators.has(ws.validatorDID)) {
      this.validators.delete(ws.validatorDID);
      this.connectionStats.activeValidators = this.validators.size;
      console.log(`⚡ 검증자 연결 해제: ${ws.validatorDID}`);
    }
    
    // 릴레이 피어 연결 정리
    if (ws.peerNodeId && this.relayPeers.has(ws.peerNodeId)) {
      this.relayPeers.delete(ws.peerNodeId);
      this.connectionStats.activeRelayPeers = this.relayPeers.size;
      console.log(`🔗 릴레이 피어 연결 해제: ${ws.peerName}`);
    }
  }
  
  setupHeartbeat() {
    // 30초마다 연결 상태 확인
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          console.log(`💔 연결 끊어짐 감지: ${ws.connectionId}`);
          ws.terminate();
          return;
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
    
    // 5분마다 네트워크 상태 보고
    setInterval(() => {
      this.reportNetworkStatus();
    }, 300000);
  }
  
  reportNetworkStatus() {
    console.log('\n📊 네트워크 상태 보고:');
    console.log(`🔗 활성 연결: 클라이언트 ${this.clients.size}, 검증자 ${this.validators.size}, 릴레이 피어 ${this.relayPeers.size}`);
    console.log(`📈 총 메시지 릴레이: ${this.connectionStats.messagesRelayed}`);
    console.log(`⏱️ 업타임: ${Math.floor((Date.now() - this.startTime) / 60000)}분`);
  }
  
  getPublicIP() {
    // 실제 환경에서는 외부 서비스를 통해 공인 IP 확인
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  }

  // 현재 릴레이의 용량 상태 계산
  getCapacityStatus() {
    const clientLoad = this.clients.size / this.maxConnections;
    const validatorLoad = this.validators.size / (this.maxConnections * 0.1); // 검증자는 최대 10%까지
    
    if (clientLoad > 0.8 || validatorLoad > 0.8) {
      return 'saturated'; // 포화
    } else if (clientLoad > 0.5 || validatorLoad > 0.5) {
      return 'moderate'; // 보통
    } else {
      return 'smooth'; // 원활
    }
  }

  // 다른 릴레이의 용량 상태 계산
  calculateCapacity(clients, validators) {
    const clientLoad = clients / this.maxConnections;
    const validatorLoad = validators / (this.maxConnections * 0.1);
    
    if (clientLoad > 0.8 || validatorLoad > 0.8) {
      return 'saturated';
    } else if (clientLoad > 0.5 || validatorLoad > 0.5) {
      return 'moderate';
    } else {
      return 'smooth';
    }
  }
  
  getNetworkTopology() {
    return {
      connectedRelayPeers: Array.from(this.relayPeers.keys()),
      connectedValidators: Array.from(this.validators.keys()),
      totalClients: this.clients.size,
      nodeCapacity: this.maxConnections,
      utilization: ((this.clients.size + this.validators.size + this.relayPeers.size) / this.maxConnections * 100).toFixed(2)
    };
    }

  // 사용 가능한 포트 찾기
  async findAvailablePort(startPort = 8080) {
    const portOptions = [
      startPort,           // 기본 포트 (8080)
      8081, 8082, 8083,   // 인접 포트들
      3001, 3002, 3003,   // 대체 포트들
      9000, 9001, 9002    // 추가 대체 포트들
    ];
    
    for (const port of portOptions) {
      try {
        await this.testPort(port);
        console.log(`✅ 포트 ${port} 사용 가능`);
        return port;
      } catch (error) {
        console.log(`❌ 포트 ${port} 사용 중`);
      }
    }
    
    throw new Error('사용 가능한 포트를 찾을 수 없습니다');
  }
  
  // 포트 사용 가능 여부 테스트
  testPort(port) {
    return new Promise((resolve, reject) => {
      const testServer = require('http').createServer();
      
      testServer.listen(port, () => {
        testServer.close(() => {
          resolve(port);
        });
      });
      
      testServer.on('error', (err) => {
        reject(err);
      });
    });
  }

  // 지역 좌표 자동 감지
  async detectGeoLocation() {
    try {
      console.log('🌍 지역 좌표 감지 중...');
      
      // IP 기반 지역 감지 API 사용
      const response = await fetch('http://ip-api.com/json/', {
        timeout: 5000
      });
      
      if (response.ok) {
        const locationData = await response.json();
        
        if (locationData.status === 'success') {
          this.coordinates = {
            lat: locationData.lat,
            lng: locationData.lon
          };
          this.country = locationData.country;
          this.city = locationData.city;
          this.region = locationData.regionName;
          
          console.log(`📍 지역 감지 완료: ${this.city}, ${this.country} (${this.coordinates.lat}, ${this.coordinates.lng})`);
        } else {
          console.warn('⚠️ 지역 감지 실패 - 기본값 사용');
          this.setDefaultLocation();
        }
      } else {
        console.warn('⚠️ 지역 감지 API 응답 실패 - 기본값 사용');
        this.setDefaultLocation();
      }
    } catch (error) {
      console.warn('⚠️ 지역 감지 오류:', error.message, '- 기본값 사용');
      this.setDefaultLocation();
    }
  }
  
  // 기본 위치 설정 (Seoul, Korea)
  setDefaultLocation() {
    this.coordinates = {
      lat: 37.5665,
      lng: 126.9780
    };
    this.country = 'South Korea';
    this.city = 'Seoul';
    this.region = 'Seoul';
    console.log('📍 기본 위치 설정: Seoul, South Korea');
  }
  
  async start() {
    try {
      // 지역 좌표 자동 감지
      await this.detectGeoLocation();
      
      // 사용 가능한 포트 찾기
      console.log(`🔍 포트 ${this.port}에서 시작 시도 중...`);
      const availablePort = await this.findAvailablePort(this.port);
      
      // 포트가 변경되었다면 업데이트
      if (availablePort !== this.port) {
        console.log(`🔄 포트 변경: ${this.port} → ${availablePort}`);
        this.port = availablePort;
      }
      
      this.server.listen(this.port, async () => {
        this.status = 'running';
        console.log(`\n🚀 BROTHERHOOD 릴레이 노드가 시작되었습니다!`);
        console.log(`📍 노드 ID: ${this.nodeId}`);
        console.log(`🌐 로컬 서버 주소: http://localhost:${this.port}`);
        console.log(`📊 상태 확인: http://localhost:${this.port}/status`);
        
        // 프로토콜 초기화
        await this.initializeProtocol();
        console.log(`🏥 헬스체크: http://localhost:${this.port}/health`);
        
        if (this.coordinates) {
          console.log(`📍 지역 좌표: ${this.coordinates.lat}, ${this.coordinates.lng} (${this.city}, ${this.country})`);
        }
        
        // LocalTunnel 시작
        try {
          await this.startLocalTunnel();
          console.log(`\n💡 이 릴레이 노드가 BROTHERHOOD 네트워크의 일부가 되었습니다!`);
          console.log(`📡 사용자와 검증자 간의 트랜잭션을 중계합니다.`);
          console.log(`🌐 웹앱에서 접근 가능: ${this.publicUrl}`);
          
          // 기존 릴레이들과 연결 및 리스트 동기화
          if (!this.isFirstRelay) {
            await this.connectToExistingRelays();
          }
          
        } catch (error) {
          console.warn('⚠️ LocalTunnel 시작 실패:', error.message);
          console.log('🔧 로컬 서버로만 동작합니다.');
        }
        

      });
      
      // 서버 listen 에러 처리
      this.server.on('error', async (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ 포트 ${this.port} 이미 사용 중`);
          try {
            console.log('🔄 다른 포트 찾는 중...');
            const newPort = await this.findAvailablePort(this.port + 1);
            console.log(`🔄 새 포트로 재시도: ${newPort}`);
            this.port = newPort;
            this.server.listen(this.port);
          } catch (retryError) {
            console.error('❌ 대체 포트를 찾을 수 없습니다:', retryError.message);
            process.exit(1);
          }
        } else {
          console.error('❌ 서버 에러:', error.message);
          process.exit(1);
        }
      });
      
    } catch (error) {
      console.error('❌ 릴레이 노드 시작 실패:', error.message);
      process.exit(1);
    }
  }
  
  // 프로토콜 초기화 (웹앱용)
  async initializeProtocol() {
    try {
      console.log('🚀 백야 프로토콜 초기화 중...');
      
      // 프로토콜 인스턴스 생성 
      this.protocol = new Protocol();
      
      // 프로토콜 초기화 (정적 데이터 경로 사용)
      await this.protocol.initialize('./baekya_data');
      
      this.protocolInitialized = true;
      console.log('✅ 백야 프로토콜 초기화 완료');
      
      // 웹앱용 API 추가 설정
      this.setupWebAppAPIs();
      
    } catch (error) {
      console.error('❌ 프로토콜 초기화 실패:', error.message);
      this.protocolInitialized = false;
      throw error;
    }
  }
  
  // 웹앱용 API 설정
  setupWebAppAPIs() {
    console.log('🌐 웹앱 API 설정 중...');
    
    // API 상태 확인
    this.app.get('/api/status', async (req, res) => {
      try {
        if (!this.protocol) {
          return res.status(503).json({ error: '프로토콜이 초기화되지 않았습니다' });
        }
        
        const blockchainStatus = this.protocol.getBlockchainStatus();
        res.json(blockchainStatus);
      } catch (error) {
        console.error('상태 조회 실패:', error);
        res.status(500).json({ error: '상태 조회 실패' });
      }
    });
    
    // 사용자 등록
    this.app.post('/api/register', async (req, res) => {
      try {
        const userData = req.body.userData || req.body;
        const { username, password, name, communicationAddress, deviceId } = userData;
        
        if (!username || !password) {
          return res.status(400).json({ 
            success: false, 
            error: '아이디와 비밀번호가 필요합니다' 
          });
        }

        const finalDeviceId = deviceId || req.headers['x-device-id'] || `relay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const registerData = {
          username,
          password,
          name: name || username,
          communicationAddress: communicationAddress || `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`,
          deviceId: finalDeviceId,
          inviteCode: userData.inviteCode || null
        };

        const result = await this.protocol.registerUser(registerData);
        
        // 회원가입 트랜잭션이 생성되었다면 검증자들에게 전송
        if (result.success && result.transaction) {
          const sentCount = this.broadcastTransactionToValidators(result.transaction);
          console.log(`👤 회원가입 트랜잭션 브로드캐스트: ${result.userDID} (${sentCount}개 검증자)`);
        }
        
        res.json(result);
      } catch (error) {
        console.error('회원가입 실패:', error);
        res.status(500).json({ success: false, error: '회원가입 실패', details: error.message });
      }
    });

    // 사용자 로그인
    this.app.post('/api/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        
        if (!username || !password) {
          return res.status(400).json({ 
            success: false, 
            error: '아이디와 비밀번호가 필요합니다' 
          });
        }

        const result = await this.protocol.loginUser(username, password);
        res.json(result);
      } catch (error) {
        console.error('로그인 실패:', error);
        res.status(500).json({ success: false, error: '로그인 실패', details: error.message });
      }
    });

    // 토큰 전송
    this.app.post('/api/transfer', async (req, res) => {
      try {
        const result = await this.protocol.transferTokens(req.body);
        
        // 트랜잭션이 성공적으로 생성되었다면 검증자들에게 전송
        if (result.success && result.transaction) {
          const sentCount = this.broadcastTransactionToValidators(result.transaction);
          console.log(`💸 API 토큰 전송 트랜잭션 브로드캐스트: ${result.transactionId} (${sentCount}개 검증자)`);
        }
        
        res.json(result);
      } catch (error) {
        console.error('토큰 전송 실패:', error);
        res.status(500).json({ success: false, error: '토큰 전송 실패', details: error.message });
      }
    });

    // 사용자 지갑 정보 조회
    this.app.get('/api/wallet/:did', async (req, res) => {
      try {
        const wallet = await this.protocol.getUserWallet(req.params.did);
        res.json(wallet);
      } catch (error) {
        console.error('지갑 정보 조회 실패:', error);
        res.status(500).json({ error: '지갑 정보 조회 실패' });
      }
    });

    // 사용자 대시보드 조회
    this.app.get('/api/dashboard/:did', async (req, res) => {
      try {
        const dashboard = await this.protocol.getUserDashboard(req.params.did);
        res.json(dashboard);
      } catch (error) {
        console.error('대시보드 조회 실패:', error);
        res.status(500).json({ error: '대시보드 조회 실패' });
      }
    });

    // DAO 목록 조회
    this.app.get('/api/daos', (req, res) => {
      try {
        const result = this.protocol.getDAOs();
        if (result.success) {
          res.json(result.daos);
        } else {
          res.status(500).json({ error: result.error });
        }
      } catch (error) {
        console.error('DAO 목록 조회 실패:', error);
        res.status(500).json({ error: 'DAO 목록 조회 실패' });
      }
    });

    // 거버넌스 제안 생성
    this.app.post('/api/governance/proposals', async (req, res) => {
      try {
        console.log('🏛️ 거버넌스 제안 생성 요청 수신');
        
        const { title, description, label, hasStructure, structureFiles, authorDID } = req.body;
        const cost = 5; // 제안 생성 비용 고정: 5B
        
        if (!title || !description || !label || !authorDID) {
          return res.status(400).json({ success: false, error: '필수 필드가 누락되었습니다' });
        }
        
        // 코어구조 파일 필수 검증
        if (!hasStructure || !structureFiles || structureFiles.length === 0) {
          return res.status(400).json({ 
            success: false, 
            error: '코어구조 파일을 업로드해주세요. 제안에는 반드시 코어구조가 포함되어야 합니다.' 
          });
        }
        
        // B-토큰 잔액 확인
        const currentBalance = this.protocol.getBlockchain().getBalance(authorDID, 'B-Token');
        if (currentBalance < cost) {
          return res.status(400).json({ 
            success: false, 
            error: `B-토큰 잔액이 부족합니다 (필요: ${cost}B, 보유: ${currentBalance}B)` 
          });
        }
        
        // 제안 ID 생성
        const proposalId = `GP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        // 사용자 정보 조회
        const userInfo = this.protocol.components.storage.getUserInfo(authorDID);
        let username = 'Unknown';
        
        if (userInfo && userInfo.username) {
          username = userInfo.username;
        } else {
          const didInfo = this.protocol.components.authSystem.getDIDInfo(authorDID);
          if (didInfo.success && didInfo.didData) {
            username = didInfo.didData.username;
          }
        }
        
        // 제안 데이터 구성
        const proposalData = {
          id: proposalId,
          title: title,
          description: description,
          label: label,
          author: { did: authorDID, username: username },
          authorDID: authorDID,
          status: 'active',
          votes: { yes: 0, no: 0, abstain: 0 },
          voters: [],
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          hasStructure: hasStructure,
          structureFiles: structureFiles || [],
          cost: cost,
          reports: []
        };
        
        // 제안 비용을 트랜잭션으로 처리
        const Transaction = require('./src/blockchain/Transaction');
        const proposalCostTx = new Transaction(
          authorDID,
          'did:baekya:system0000000000000000000000000000000002',
          cost,
          'B-Token',
          { 
            type: 'governance_proposal_cost',
            description: `거버넌스 제안 생성 비용: ${title}`,
            proposalId: proposalId
          }
        );
        proposalCostTx.sign('test-key');
        
        // 블록체인에 트랜잭션 추가
        const addResult = this.protocol.getBlockchain().addTransaction(proposalCostTx);
        if (!addResult.success) {
          return res.status(400).json({ 
            success: false, 
            error: `제안 비용 처리 실패: ${addResult.error}` 
          });
        }
        
        // 트랜잭션을 검증자들에게 전송
        const sentCount = this.broadcastTransactionToValidators(proposalCostTx);
        console.log(`🏛️ 거버넌스 제안 비용 트랜잭션 브로드캐스트: ${proposalCostTx.hash} (${sentCount}개 검증자)`);
        
        // 제안 저장
        this.protocol.components.storage.addGovernanceProposal(proposalData);
        console.log(`✅ 거버넌스 제안 생성됨: ${proposalId} by ${username}`);
        
        res.json({ 
          success: true, 
          proposalId: proposalId,
          message: `제안이 성공적으로 생성되었습니다. 비용 ${cost}B가 차감되었습니다.`
        });
      } catch (error) {
        console.error('거버넌스 제안 생성 실패:', error);
        res.status(500).json({ success: false, error: '서버 오류가 발생했습니다' });
      }
    });

    // 거버넌스 제안 목록 조회
    this.app.get('/api/governance/proposals', async (req, res) => {
      try {
        const allProposals = this.protocol.components.storage.getGovernanceProposals() || [];
        const sortedProposals = allProposals.sort((a, b) => b.createdAt - a.createdAt);
        
        res.json({
          success: true,
          proposals: sortedProposals,
          total: sortedProposals.length
        });
      } catch (error) {
        console.error('거버넌스 제안 목록 조회 실패:', error);
        res.status(500).json({ success: false, error: '서버 오류가 발생했습니다' });
      }
    });

    // 거버넌스 제안 투표
    this.app.post('/api/governance/proposals/:proposalId/vote', async (req, res) => {
      try {
        const { proposalId } = req.params;
        const { voteType, voterDID } = req.body;
        
        if (!proposalId || !voteType || !voterDID) {
          return res.status(400).json({ 
            success: false, 
            error: '필수 정보가 누락되었습니다.' 
          });
        }
        
        if (!['yes', 'no', 'abstain'].includes(voteType)) {
          return res.status(400).json({ 
            success: false, 
            error: '유효하지 않은 투표 타입입니다.' 
          });
        }
        
        // 제안 존재 확인
        const proposal = this.protocol.components.storage.getGovernanceProposal(proposalId);
        if (!proposal) {
          return res.status(404).json({ 
            success: false, 
            error: '제안을 찾을 수 없습니다.' 
          });
        }
        
        // 중복 투표 확인
        const hasVoted = proposal.voters && proposal.voters.includes(voterDID);
        if (hasVoted) {
          return res.status(400).json({ 
            success: false, 
            error: '이미 투표하셨습니다.' 
          });
        }
        
        // 투표 처리
        if (!proposal.votes) {
          proposal.votes = { yes: 0, no: 0, abstain: 0 };
        }
        if (!proposal.voters) {
          proposal.voters = [];
        }
        
        proposal.votes[voteType]++;
        proposal.voters.push(voterDID);
        proposal.lastUpdated = Date.now();
        
        // 제안 업데이트
        this.protocol.components.storage.updateGovernanceProposal(proposalId, proposal);
        
        console.log(`✅ 투표 완료: ${proposalId} - ${voteType} by ${voterDID}`);
        
        res.json({ 
          success: true, 
          message: '투표가 성공적으로 처리되었습니다.',
          proposal: proposal
        });
        
      } catch (error) {
        console.error('거버넌스 투표 실패:', error);
        res.status(500).json({ success: false, error: '서버 오류가 발생했습니다' });
      }
    });

    // 거버넌스 투표 정보 조회
    this.app.get('/api/governance/proposals/:proposalId/vote/:voterDID', async (req, res) => {
      try {
        const { proposalId, voterDID } = req.params;
        
        const proposal = this.protocol.components.storage.getGovernanceProposal(proposalId);
        if (!proposal) {
          return res.status(404).json({ 
            success: false, 
            error: '제안을 찾을 수 없습니다.' 
          });
        }
        
        const hasVoted = proposal.voters && proposal.voters.includes(voterDID);
        
        res.json({ 
          success: true, 
          hasVoted: hasVoted,
          vote: hasVoted ? 'voted' : null
        });
        
      } catch (error) {
        console.error('투표 정보 조회 실패:', error);
        res.status(500).json({ success: false, error: '서버 오류가 발생했습니다' });
      }
    });

    // 활성 계정 수 조회
    this.app.get('/api/governance/active-accounts', async (req, res) => {
      try {
        const allProposals = this.protocol.components.storage.getGovernanceProposals() || [];
        const uniqueVoters = new Set();
        
        allProposals.forEach(proposal => {
          if (proposal.voters) {
            proposal.voters.forEach(voter => uniqueVoters.add(voter));
          }
        });
        
        const activeAccounts = Math.max(uniqueVoters.size, 1);
        
        res.json({
          success: true,
          activeAccounts: activeAccounts
        });
      } catch (error) {
        console.error('활성 계정 수 조회 실패:', error);
        res.status(500).json({ success: false, error: '서버 오류가 발생했습니다' });
      }
    });

    // 활성 투표 제안 조회
    this.app.get('/api/governance/collaboration/active', async (req, res) => {
      try {
        const allProposals = this.protocol.components.storage.getGovernanceProposals() || [];
        const activeVotingProposal = allProposals.find(proposal => proposal.status === 'collaboration');
        
        if (activeVotingProposal) {
          const completedCount = allProposals.filter(p => p.status === 'completed').length;
          
          res.json({
            success: true,
            proposal: activeVotingProposal,
            completedCount: completedCount
          });
        } else {
          res.json({
            success: true,
            proposal: null,
            message: '현재 투표 진행 중인 제안이 없습니다.'
          });
        }
      } catch (error) {
        console.error('활성 투표 제안 조회 실패:', error);
        res.status(500).json({ success: false, error: '서버 오류가 발생했습니다' });
      }
    });

    // 기여 제출
    this.app.post('/api/contribute', async (req, res) => {
      try {
        const contributionData = req.body;
        
        if (!contributionData.contributorDID || !contributionData.daoId || !contributionData.dcaId) {
          return res.status(400).json({
            success: false,
            error: '기여자 DID, DAO ID, DCA ID는 필수입니다'
          });
        }

        const result = await this.protocol.submitContribution(contributionData);
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
    this.app.post('/api/verify-contribution', async (req, res) => {
      try {
        const { contributionId, verifierDID, verified, reason } = req.body;
        const result = await this.protocol.verifyContribution(contributionId, verifierDID, verified, reason);
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

    // 특정 DAO 조회
    this.app.get('/api/daos/:daoId', (req, res) => {
      try {
        const dao = this.protocol.getDAO(req.params.daoId);
        if (!dao) {
          return res.status(404).json({ error: 'DAO를 찾을 수 없습니다' });
        }
        res.json(dao);
      } catch (error) {
        console.error('DAO 조회 실패:', error);
        res.status(500).json({ error: 'DAO 조회 실패' });
      }
    });

    // DAO 생성
    this.app.post('/api/daos', async (req, res) => {
      try {
        const daoData = req.body;
        
        // 이니셜 OP 통신주소 검증
        if (daoData.initialOPAddress) {
          // 통신주소 유효성 검증 로직 (간단한 형태)
          const addressPattern = /^010-\d{4}-\d{4}$/;
          if (!addressPattern.test(daoData.initialOPAddress)) {
            return res.status(400).json({
              success: false,
              error: '올바른 통신주소 형식이 아닙니다 (예: 010-1234-5678)'
            });
          }
        }
        
        const result = await this.protocol.createDAO(daoData);
        res.json(result);
      } catch (error) {
        console.error('DAO 생성 실패:', error);
        res.status(500).json({ success: false, error: 'DAO 생성 실패', details: error.message });
      }
    });

    // DAO 가입
    this.app.post('/api/daos/:daoId/join', async (req, res) => {
      try {
        const { daoId } = req.params;
        const { userDID, membershipType } = req.body;
        const result = await this.protocol.joinDAO(daoId, userDID, membershipType);
        res.json(result);
      } catch (error) {
        console.error('DAO 가입 실패:', error);
        res.status(500).json({ success: false, error: 'DAO 가입 실패', details: error.message });
      }
    });

    // DAO 금고 후원
    this.app.post('/api/dao/treasury/sponsor', async (req, res) => {
      try {
        const { sponsorDID, daoId, amount } = req.body;
        
        if (!sponsorDID || !daoId || !amount || amount <= 0) {
          return res.status(400).json({
            success: false,
            error: '후원자 DID, DAO ID, 후원 금액은 필수이며 금액은 0보다 커야 합니다'
          });
        }

        // 후원 트랜잭션 생성
        const Transaction = require('./src/blockchain/Transaction');
        const sponsorTx = new Transaction(
          sponsorDID,
          'did:baekya:system0000000000000000000000000000000002', // DAO 시스템 주소
          amount,
          'B-Token',
          { 
            type: 'dao_treasury_sponsor',
            daoId: daoId,
            description: `${daoId} DAO 금고 후원`
          }
        );
        sponsorTx.sign('test-key');

        // 블록체인에 트랜잭션 추가
        const addResult = this.protocol.getBlockchain().addTransaction(sponsorTx);
        if (!addResult.success) {
          return res.status(400).json({ 
            success: false, 
            error: `후원 트랜잭션 처리 실패: ${addResult.error}` 
          });
        }

        // 트랜잭션을 검증자들에게 전송
        const sentCount = this.broadcastTransactionToValidators(sponsorTx);
        console.log(`💰 DAO 금고 후원 트랜잭션 브로드캐스트: ${sponsorTx.hash} (${sentCount}개 검증자)`);

        res.json({
          success: true,
          message: `${daoId} DAO에 ${amount}B가 후원되었습니다`,
          transactionId: sponsorTx.hash
        });
      } catch (error) {
        console.error('DAO 금고 후원 실패:', error);
        res.status(500).json({ 
          success: false, 
          error: 'DAO 금고 후원 실패', 
          details: error.message 
        });
      }
    });

    // 사용자 기여 내역 조회
    this.app.get('/api/contributions/:did', async (req, res) => {
      try {
        const { did } = req.params;
        const { daoId } = req.query;
        
        if (!did) {
          return res.status(400).json({
            success: false,
            error: 'DID는 필수입니다'
          });
        }

        const contributions = this.protocol.components.storage.getUserContributions(did, daoId);
        
        res.json({
          success: true,
          contributions: contributions || [],
          did: did,
          daoId: daoId || 'all'
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
    this.app.get('/api/dao/:daoId/contribution-stats', async (req, res) => {
      try {
        const { daoId } = req.params;
        
        const stats = this.protocol.components.storage.getDAOContributionStats(daoId);
        
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

    // 초대코드 조회 (계정별 고유 초대코드)
    this.app.get('/api/invite-code', async (req, res) => {
      try {
        const userDID = req.headers.authorization?.split(' ')[1];
        
        if (!userDID) {
          return res.status(401).json({
            success: false,
            error: '인증 정보가 필요합니다'
          });
        }

        // 저장소에서 해당 사용자의 초대코드 조회
        const inviteCode = this.protocol.components.storage.getUserInviteCode(userDID);
        
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
    this.app.post('/api/invite-code', async (req, res) => {
      try {
        const { userDID, communicationAddress } = req.body;
        
        if (!userDID) {
          return res.status(400).json({
            success: false,
            error: '사용자 DID가 필요합니다'
          });
        }

        // 기존 초대코드가 있는지 확인
        let existingCode = this.protocol.components.storage.getUserInviteCode(userDID);
        
        // 추가로 블록체인에서도 확인
        if (!existingCode) {
          const blockchain = this.protocol.getBlockchain();
          if (blockchain && blockchain.chain) {
            for (const block of blockchain.chain) {
              for (const tx of block.transactions) {
                if (tx.fromDID === userDID && 
                    tx.data?.type === 'invite_code_registration' && 
                    tx.data?.inviteCode) {
                  existingCode = tx.data.inviteCode;
                  this.protocol.components.storage.saveUserInviteCode(userDID, existingCode);
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
        function generateHashBasedInviteCode(did) {
          const crypto = require('crypto');
          const salt = 'baekya-protocol-invite-2024';
          return crypto.createHash('sha256').update(did + salt).digest('hex').substring(0, 8).toUpperCase();
        }
        
        const inviteCode = generateHashBasedInviteCode(userDID);

        const Transaction = require('./src/blockchain/Transaction');
        
        // 초대코드 등록 트랜잭션 생성
        const inviteCodeTx = new Transaction(
          userDID,
          'did:baekya:system0000000000000000000000000000000002',
          0,
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
        const addResult = this.protocol.getBlockchain().addTransaction(inviteCodeTx);
        if (addResult.success) {
          // 저장소에 초대코드 저장
          this.protocol.components.storage.saveUserInviteCode(userDID, inviteCode);
          
          // 트랜잭션을 검증자들에게 전송
          const sentCount = this.broadcastTransactionToValidators(inviteCodeTx);
          console.log(`🎫 초대코드 트랜잭션 브로드캐스트: ${inviteCode} (${sentCount}개 검증자)`);
          
          res.json({
            success: true,
            inviteCode: inviteCode,
            message: '초대코드가 생성되었습니다',
            transactionId: inviteCodeTx.hash
          });
        } else {
          res.status(500).json({
            success: false,
            error: `트랜잭션 추가 실패: ${addResult.error}`
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

    // 아이디 중복 체크
    this.app.post('/api/check-userid', async (req, res) => {
      try {
        const { userId } = req.body;
        
        if (!userId) {
          return res.status(400).json({
            success: false,
            error: '사용자 ID가 필요합니다'
          });
        }

        // 간단한 중복 체크 (실제로는 더 복잡한 로직이 필요)
        const existingUser = this.protocol.components.storage.getUserByUsername(userId);
        
        res.json({
          success: true,
          available: !existingUser,
          message: existingUser ? '이미 사용 중인 아이디입니다' : '사용 가능한 아이디입니다'
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

    // 프로토콜 상태 확인
    this.app.get('/api/protocol-status', async (req, res) => {
      try {
        if (!this.protocol) {
          return res.status(503).json({ 
            success: false,
            error: '프로토콜이 초기화되지 않았습니다' 
          });
        }

        const blockchain = this.protocol.getBlockchain();
        res.json({
          success: true,
          status: 'active',
          blockCount: blockchain ? blockchain.chain.length : 0,
          isReady: true
        });
      } catch (error) {
        console.error('프로토콜 상태 확인 실패:', error);
        res.status(500).json({ 
          success: false,
          error: '프로토콜 상태 확인 실패' 
        });
      }
    });

    // 프로토콜 전체 상태 조회
    this.app.get('/api/protocol-state', async (req, res) => {
      try {
        if (!this.protocol) {
          return res.status(503).json({ error: '프로토콜이 초기화되지 않았습니다' });
        }

        const blockchain = this.protocol.getBlockchain();
        const status = {
          blockCount: blockchain ? blockchain.chain.length : 0,
          validators: this.validators.size,
          clients: this.clients.size,
          isActive: true,
          relayInfo: {
            nodeId: this.nodeId,
            connectedValidators: this.validators.size,
            connectedClients: this.clients.size
          }
        };

        res.json(status);
      } catch (error) {
        console.error('프로토콜 상태 조회 실패:', error);
        res.status(500).json({ error: '프로토콜 상태 조회 실패' });
      }
    });

    console.log('✅ 웹앱 API 설정 완료');
  }
  
  // 웹앱 클라이언트용 핸들러 메서드들
  handleStateRequest(ws, data) {
    try {
      if (!this.protocol || !this.protocolInitialized) {
        ws.send(JSON.stringify({
          type: 'error',
          error: '프로토콜이 초기화되지 않았습니다'
        }));
        return;
      }

      if (!ws.userDID) {
        ws.send(JSON.stringify({
          type: 'error',
          error: '인증이 필요합니다'
        }));
        return;
      }

      // 사용자 지갑 정보와 검증자 풀 상태 조회
      this.protocol.getUserWallet(ws.userDID).then(wallet => {
        const poolStatus = this.protocol.components.storage.getValidatorPoolStatus();
        
        ws.send(JSON.stringify({
          type: 'state_update',
          wallet: wallet,
          validatorPool: poolStatus,
          sessionId: ws.sessionId
        }));
      }).catch(error => {
        console.error(`❌ 상태 요청 처리 실패: ${error.message}`);
        ws.send(JSON.stringify({
          type: 'error',
          error: '상태 조회 실패'
        }));
      });
    } catch (error) {
      console.error(`❌ 상태 요청 처리 오류: ${error.message}`);
      ws.send(JSON.stringify({
        type: 'error',
        error: '처리 중 오류 발생'
      }));
    }
  }

  handleWalletRequest(ws, data) {
    try {
      if (!this.protocol || !this.protocolInitialized) {
        ws.send(JSON.stringify({
          type: 'error',
          error: '프로토콜이 초기화되지 않았습니다'
        }));
        return;
      }

      if (!ws.userDID) {
        ws.send(JSON.stringify({
          type: 'error',
          error: '인증이 필요합니다'
        }));
        return;
      }

      this.protocol.getUserWallet(ws.userDID).then(wallet => {
        ws.send(JSON.stringify({
          type: 'wallet_update',
          wallet: wallet,
          timestamp: Date.now()
        }));
      }).catch(error => {
        console.error(`❌ 지갑 요청 처리 실패: ${error.message}`);
        ws.send(JSON.stringify({
          type: 'error',
          error: '지갑 정보 조회 실패'
        }));
      });
    } catch (error) {
      console.error(`❌ 지갑 요청 처리 오류: ${error.message}`);
      ws.send(JSON.stringify({
        type: 'error',
        error: '처리 중 오류 발생'
      }));
    }
  }

  async handleInviteCodeCreation(ws, data) {
    try {
      if (!this.protocol || !this.protocolInitialized) {
        ws.send(JSON.stringify({
          type: 'invite_code_response',
          success: false,
          error: '프로토콜이 초기화되지 않았습니다'
        }));
        return;
      }

      if (!ws.userDID) {
        ws.send(JSON.stringify({
          type: 'invite_code_response',
          success: false,
          error: '로그인이 필요합니다'
        }));
        return;
      }

      // 기존 초대코드 확인
      let existingCode = this.protocol.components.storage.getUserInviteCode(ws.userDID);
      
      if (existingCode) {
        ws.send(JSON.stringify({
          type: 'invite_code_response',
          success: true,
          inviteCode: existingCode,
          message: '기존 초대코드를 반환합니다'
        }));
        return;
      }

      // 새 초대코드 생성 (server.js의 로직 사용)
      function generateHashBasedInviteCode(did) {
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(did + Date.now()).digest('hex');
        return hash.substring(0, 8).toUpperCase();
      }

      const inviteCode = generateHashBasedInviteCode(ws.userDID);
      const Transaction = require('./src/blockchain/Transaction');
      
      // 초대코드 등록 트랜잭션 생성
      const inviteCodeTx = new Transaction(
        ws.userDID,
        'did:baekya:system0000000000000000000000000000000002',
        0,
        'B-Token',
        { 
          type: 'invite_code_registration',
          inviteCode: inviteCode,
          registrationDate: new Date().toISOString()
        }
      );
      
      inviteCodeTx.sign('test-private-key');
      
      const blockchain = this.protocol.getBlockchain();
      const addResult = blockchain.addTransaction(inviteCodeTx);
      
      if (addResult.success) {
        // 저장소에 초대코드 저장
        this.protocol.components.storage.saveUserInviteCode(ws.userDID, inviteCode);
        
        // 초대코드 트랜잭션을 검증자들에게 전송
        const sentCount = this.broadcastTransactionToValidators(inviteCodeTx);
        
        console.log(`✅ 초대코드 트랜잭션 추가 및 브로드캐스트: ${inviteCode} (${sentCount}개 검증자)`);
        
        ws.send(JSON.stringify({
          type: 'invite_code_response',
          success: true,
          inviteCode: inviteCode,
          message: '초대코드가 생성되었습니다. 검증자가 블록을 생성하면 영구 저장됩니다.',
          transactionId: inviteCodeTx.hash
        }));
      } else {
        throw new Error(addResult.error);
      }
    } catch (error) {
      console.error('❌ 초대코드 생성 실패:', error);
      ws.send(JSON.stringify({
        type: 'invite_code_response',
        success: false,
        error: '초대코드 생성 실패',
        details: error.message
      }));
    }
  }

  async handleTokenTransfer(ws, data) {
    try {
      if (!this.protocol || !this.protocolInitialized) {
        ws.send(JSON.stringify({
          type: 'transfer_response',
          success: false,
          error: '프로토콜이 초기화되지 않았습니다'
        }));
        return;
      }

      if (!ws.userDID) {
        ws.send(JSON.stringify({
          type: 'transfer_response',
          success: false,
          error: '로그인이 필요합니다'
        }));
        return;
      }

      // 토큰 전송 처리 (data에 from, to, amount, tokenType 등이 포함됨)
      const transferData = {
        ...data,
        from: ws.userDID  // 보내는 사람은 현재 로그인한 사용자
      };

      const result = await this.protocol.transferTokens(transferData);
      
      // 트랜잭션이 성공적으로 생성되었다면 검증자들에게 전송
      if (result.success && result.transaction) {
        const sentCount = this.broadcastTransactionToValidators(result.transaction);
        console.log(`💸 토큰 전송 트랜잭션 생성 및 브로드캐스트: ${result.transactionId} (${sentCount}개 검증자)`);
      }
      
      ws.send(JSON.stringify({
        type: 'transfer_response',
        success: result.success,
        message: result.message,
        transactionId: result.transactionId,
        error: result.error
      }));

    } catch (error) {
      console.error('❌ 토큰 전송 실패:', error);
      ws.send(JSON.stringify({
        type: 'transfer_response',
        success: false,
        error: '토큰 전송 실패',
        details: error.message
      }));
    }
  }
  
  // 트랜잭션을 연결된 검증자들에게 브로드캐스트
  broadcastTransactionToValidators(transaction) {
    if (this.validators.size === 0) {
      console.log('⚠️ 연결된 검증자가 없어 트랜잭션을 전송할 수 없습니다');
      return 0;
    }
    
    const transactionData = {
      type: 'transaction',
      transaction: transaction.toJSON ? transaction.toJSON() : transaction,
      timestamp: Date.now(),
      sourceRelay: this.nodeId
    };
    
    let sentCount = 0;
    
    this.validators.forEach((validatorWs, validatorDID) => {
      if (validatorWs.readyState === 1) { // WebSocket.OPEN
        try {
          validatorWs.send(JSON.stringify(transactionData));
          sentCount++;
          console.log(`📤 트랜잭션 전송: ${validatorDID.substring(0, 8)}... → ${transaction.id || transaction.hash || 'unknown'}`);
        } catch (error) {
          console.error(`❌ 검증자 ${validatorDID.substring(0, 8)}... 트랜잭션 전송 실패:`, error.message);
        }
      }
    });
    
    console.log(`📡 트랜잭션을 ${sentCount}개 검증자에게 전송 완료`);
    return sentCount;
  }
  
  async stop() {
    console.log('🛑 릴레이 노드 종료 중...');
    this.status = 'stopping';
    
    // 다른 릴레이들에게 종료 알림
    if (this.relayNumber) {
      await this.notifyRelayShutdown();
    }
    
    // LocalTunnel 종료
    if (this.tunnelInstance) {
      try {
        this.tunnelInstance.close();
        console.log('🌍 LocalTunnel 종료됨');
      } catch (error) {
        console.warn('⚠️ LocalTunnel 종료 실패:', error.message);
      }
    }
    
    // 모든 연결 정리
    this.wss.clients.forEach((ws) => {
      ws.close(1001, 'Server shutting down');
    });
    
    this.server.close(() => {
      console.log('✅ 릴레이 노드가 정상적으로 종료되었습니다.');
      process.exit(0);
    });
  }

  // 블록 전파 처리 (검증자 → 이 릴레이 → 다른 릴레이들)
  handleBlockPropagation(ws, blockData) {
    try {
      const { block, validatorDID, timestamp, relayId } = blockData;
      
      console.log(`📦 블록 #${block.index} 전파 시작 (검증자: ${validatorDID?.substring(0, 8)}...)`);
      
      // 1. 자신의 모든 검증자들에게 블록 전파 (동일 릴레이 내 동기화)
      this.broadcastToValidators('new_block_received', {
        block: block,
        source: 'local',
        relayId: this.nodeId,
        timestamp: Date.now()
      });
      
      // 2. 다른 릴레이들에게 블록 전파
      this.broadcastBlockToOtherRelays(blockData);
      
      // 3. 웹앱 클라이언트들에게도 블록 정보 전송 (실시간 UI 업데이트용)
      this.broadcastToClients('block_update', {
        blockIndex: block.index,
        validatorDID: validatorDID,
        timestamp: timestamp
      });
      
      console.log(`✅ 블록 #${block.index} 네트워크 전파 완료`);
      
    } catch (error) {
      console.error('❌ 블록 전파 처리 실패:', error.message);
    }
  }

  // 다른 릴레이에서 받은 블록 처리 (다른 릴레이 → 이 릴레이 → 자신의 검증자들)
  handleInterRelayBlock(ws, blockData) {
    try {
      const { block, sourceRelayId, originalValidatorDID } = blockData;
      
      console.log(`🔄 다른 릴레이(${sourceRelayId?.substring(0, 8)}...)에서 블록 #${block.index} 수신`);
      
      // 자신의 검증자들에게 블록 전파 (외부 블록으로 표시)
      this.broadcastToValidators('new_block_received', {
        block: block,
        source: 'external',
        sourceRelayId: sourceRelayId,
        originalValidatorDID: originalValidatorDID,
        timestamp: Date.now()
      });
      
      // 웹앱 클라이언트들에게도 알림
      this.broadcastToClients('block_update', {
        blockIndex: block.index,
        validatorDID: originalValidatorDID,
        source: 'external',
        timestamp: Date.now()
      });
      
      console.log(`✅ 외부 블록 #${block.index} 로컬 네트워크에 전파 완료`);
      
    } catch (error) {
      console.error('❌ 외부 블록 처리 실패:', error.message);
    }
  }

  // 다른 릴레이들에게 블록 브로드캐스트
  async broadcastBlockToOtherRelays(blockData) {
    const { block, validatorDID, timestamp } = blockData;
    
    // 활성 릴레이 리스트에서 다른 릴레이들에게 전송
    const relayPromises = [];
    
    for (const [relayNumber, relayInfo] of this.activeRelayList.entries()) {
      // 자신을 제외하고 전송
      if (relayNumber !== this.relayNumber && relayInfo.status === 'active') {
        relayPromises.push(this.sendBlockToRelay(relayInfo.url, {
          type: 'inter_relay_block',
          block: block,
          sourceRelayId: this.nodeId,
          sourceRelayNumber: this.relayNumber,
          originalValidatorDID: validatorDID,
          timestamp: timestamp
        }));
      }
    }
    
    // 모든 릴레이에 병렬로 전송
    const results = await Promise.allSettled(relayPromises);
    
    let successCount = 0;
    let failCount = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failCount++;
        console.warn(`⚠️ 릴레이 전송 실패:`, result.reason?.message);
      }
    });
    
    console.log(`📡 블록 #${block.index} → ${successCount}개 릴레이 전송 성공, ${failCount}개 실패`);
    
    // 릴레이 보상은 이제 검증자 블록 생성 시 자동으로 처리됨
    if (successCount > 0) {
      console.log(`🎉 블록 #${block.index} 전파 완료: ${successCount}개 릴레이로 성공 전송`);
    }
  }

  // 특정 릴레이에게 블록 전송
  async sendBlockToRelay(relayUrl, blockData) {
    try {
      const response = await fetch(`${relayUrl}/relay-block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `Brotherhood-Relay/${this.version}`
        },
        body: JSON.stringify(blockData),
        timeout: 5000 // 5초 타임아웃
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ 릴레이 ${relayUrl}에 블록 전송 성공`);
      return result;
      
    } catch (error) {
      console.error(`❌ 릴레이 ${relayUrl}에 블록 전송 실패:`, error.message);
      throw error;
    }
  }

  // 연결된 검증자의 엔드포인트 가져오기
  // 사용하지 않는 함수들 제거됨 (릴레이 보상은 이제 검증자에서 직접 처리)
}

// 터미널 인터페이스 관련
let relayNode = null;
let operatorDID = null;
let operatorUsername = null;

// 연결된 풀노드 URL 가져오기
function getConnectedValidatorUrl() {
  if (relayNode && relayNode.validators.size > 0) {
    // 첫 번째 연결된 검증자의 엔드포인트 사용
    for (const [validatorDID, ws] of relayNode.validators.entries()) {
      if (ws.validatorEndpoint) {
        console.log(`🔗 검증자 엔드포인트 사용: ${ws.validatorEndpoint}`);
        return ws.validatorEndpoint;
      }
    }
  }
  
  // 기본값으로 여러 포트 시도
  console.log('⚠️ 검증자 엔드포인트를 찾을 수 없음. 기본 포트 사용');
  return 'http://localhost:3000';
}

// 여러 포트를 시도해서 로그인하는 함수
async function tryLoginMultiplePorts(userId, password) {
  // 1. 먼저 실행 중인 서버 찾기
  const runningServer = await findRunningServer();
  if (runningServer) {
    try {
      console.log(`🔄 발견된 서버에서 로그인 시도: ${runningServer}`);
      const response = await fetch(`${runningServer}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ 발견된 서버에서 로그인 성공`);
        return { result, url: runningServer };
      }
    } catch (error) {
      console.log(`❌ 발견된 서버 로그인 실패: ${error.message}`);
    }
  }
  
  // 2. 연결된 검증자의 엔드포인트 시도
  if (relayNode) {
    // 검증자 엔드포인트는 더 이상 사용하지 않음 (직접 포트 시도)
  }
  
  // 3. 일반 포트들 시도
  const ports = [3000, 3001, 8080, 3002, 8081];
  
  for (const port of ports) {
    try {
      const url = `http://localhost:${port}/api/login`;
      console.log(`🔄 포트 ${port} 시도 중...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ 포트 ${port}에서 응답 수신`);
        return { result, url: `http://localhost:${port}` };
      }
    } catch (error) {
      console.log(`❌ 포트 ${port} 실패: ${error.message}`);
    }
  }
  
  throw new Error('모든 포트에서 연결 실패');
}

// 여러 포트를 시도해서 가입하는 함수
async function tryRegisterMultiplePorts(userId, password, name) {
  // 먼저 연결된 검증자의 엔드포인트 시도
  if (relayNode) {
    // 검증자 엔드포인트는 더 이상 사용하지 않음 (직접 포트 시도)
  }
  
  // 검증자 엔드포인트 실패시 일반 포트들 시도
  const ports = [3000, 3001, 8080, 3002, 8081];
  
  for (const port of ports) {
    try {
      const url = `http://localhost:${port}/api/register`;
      console.log(`🔄 포트 ${port} 시도 중...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          password, 
          name,
          isRelayOperator: true 
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ 포트 ${port}에서 응답 수신`);
        return { result, url: `http://localhost:${port}` };
      }
    } catch (error) {
      console.log(`❌ 포트 ${port} 실패: ${error.message}`);
    }
  }
  
  throw new Error('모든 포트에서 연결 실패');
}

// 실제 실행 중인 서버 포트 찾기
async function findRunningServer() {
  const commonPorts = [3000, 3001, 3002, 8000, 8001, 8080, 8081, 5000, 5001];
  
  console.log('🔍 실행 중인 서버 포트를 찾는 중...');
  
  for (const port of commonPorts) {
    try {
      const response = await fetch(`http://localhost:${port}/api/status`, {
        method: 'GET',
        timeout: 2000
      });
      
      if (response.ok) {
        console.log(`✅ 포트 ${port}에서 백엔드 서버 발견!`);
        return `http://localhost:${port}`;
      }
    } catch (error) {
      // 포트 체크이므로 조용히 실패
    }
  }
  
  console.log('❌ 실행 중인 백엔드 서버를 찾을 수 없음');
  return null;
}

// 터미널 인터페이스 설정
function setupRelayTerminalInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n🌟 백야 프로토콜 릴레이 노드');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. 로그인');
  console.log('2. 가입');
  console.log('3. 종료');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  rl.question('선택하세요 (1-3): ', async (choice) => {
    switch (choice) {
      case '1':
        await handleRelayLogin(rl);
        break;
      case '2':
        await handleRelayRegister(rl);
        break;
      case '3':
        console.log('릴레이 노드를 종료합니다...');
        process.exit(0);
        break;
      default:
        console.log('잘못된 선택입니다. 다시 시도하세요.');
        rl.close();
        setupRelayTerminalInterface();
    }
  });
}

// 릴레이 운영자 로그인
async function handleRelayLogin(rl) {
  console.log('\n🔐 브라더후드 계정 로그인 (풀노드 서버 연결)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  rl.question('아이디: ', (userId) => {
    rl.question('비밀번호: ', async (password) => {
      try {
        // 풀노드 서버에 직접 로그인 시도
        const result = await tryLoginToValidator(userId, password);
        
        if (result.success) {
          operatorDID = result.didHash;
          operatorUsername = result.username;
          
          console.log(`\n✅ 로그인 성공!`);
          console.log(`👤 사용자: ${operatorUsername}`);
          console.log(`💰 현재 잔액: ${result.tokenBalances.bToken}B`);
          console.log('\n⛏️  릴레이 노드 모드 시작 - 블록 전파시 보상 획득');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
          
          rl.close();
          setRelayOperator();
        } else {
          console.log(`\n❌ 로그인 실패: ${result.error}`);
          rl.close();
          setupRelayTerminalInterface();
        }
      } catch (error) {
        console.error('❌ 로그인 요청 실패:', error.message);
        rl.close();
        setupRelayTerminalInterface();
      }
    });
  });
}

// 릴레이 운영자 가입
async function handleRelayRegister(rl) {
  console.log('\n📝 브라더후드 계정 가입 (풀노드 서버 연결)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  rl.question('아이디: ', (userId) => {
    rl.question('비밀번호: ', (password) => {
      rl.question('이름: ', async (name) => {
        try {
          // 풀노드 서버에 직접 가입 시도
          const result = await tryRegisterToValidator(userId, password, name);
          
          if (result.success) {
            operatorDID = result.didHash;
            operatorUsername = name;
            
            console.log(`\n✅ 가입 성공!`);
            console.log(`👤 사용자: ${operatorUsername}`);
            console.log(`🆔 DID: ${operatorDID.substring(0, 16)}...`);
            console.log(`📱 통신주소: ${result.communicationAddress} (자동 생성)`);
            console.log('\n⛏️  릴레이 노드 모드 시작 - 블록 전파시 보상 획득');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            rl.close();
            setRelayOperator();
          } else {
            console.log(`\n❌ 가입 실패: ${result.error}`);
            rl.close();
            setupRelayTerminalInterface();
          }
        } catch (error) {
          console.error('❌ 가입 요청 실패:', error.message);
          rl.close();
          setupRelayTerminalInterface();
        }
      });
    });
  });
}

// 릴레이 운영자 정보 설정
function setRelayOperator() {
  if (relayNode) {
    // 기존 릴레이 노드에 운영자 정보 설정
    relayNode.operatorDID = operatorDID;
    relayNode.operatorUsername = operatorUsername;
    
    console.log(`\n🎉 릴레이 노드 활성화 완료!`);
    console.log(`👤 사용자: ${operatorUsername}`);
    console.log(`📊 연결된 풀노드: ${relayNode.validators.size}개`);
    console.log(`🔗 연결된 클라이언트: ${relayNode.clients.size}개\n`);
    
    // 연결된 모든 검증자들에게 운영자 정보 전송
    if (relayNode.validators.size > 0) {
      console.log('📤 연결된 검증자들에게 운영자 정보 전송 중...');
      
      for (const [validatorDID, ws] of relayNode.validators.entries()) {
        if (ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.send(JSON.stringify({
              type: 'relay_operator_info',
              data: {
                operatorDID: operatorDID,
                operatorUsername: operatorUsername,
                relayNodeId: relayNode.nodeId
              }
            }));
            console.log(`  → ${validatorDID.substring(0, 8)}... ✅`);
          } catch (error) {
            console.log(`  → ${validatorDID.substring(0, 8)}... ❌ ${error.message}`);
          }
        }
      }
    }
    
    console.log('⚡ 블록 전파 보상 시스템이 활성화되었습니다!');
  } else {
    console.error('❌ 릴레이 노드가 초기화되지 않았습니다.');
    setupRelayTerminalInterface();
  }
}

// CLI 실행
if (require.main === module) {
  startRelayServerFirst();
}

// 릴레이 서버 먼저 시작
async function startRelayServerFirst() {
  try {
    console.log('\n🌟 BROTHERHOOD 릴레이 노드 시작...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 릴레이 서버 구동 중...');
    
    // 명령줄 인자 파싱
    const args = process.argv.slice(2);
    const config = {};
    
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i]?.replace(/^--/, '');
      const value = args[i + 1];
      
      if (key && value) {
        if (key === 'port') config.port = parseInt(value);
        else if (key === 'name') config.name = value;
        else if (key === 'region') config.region = value;
        else if (key === 'max-connections') config.maxConnections = parseInt(value);
      }
    }
    
    // 임시 릴레이 노드 생성 (운영자 정보 없이)
    relayNode = new RelayNode(config);
    
    // 종료 신호 처리
    process.on('SIGINT', () => {
      if (relayNode) relayNode.stop();
    });
    process.on('SIGTERM', () => {
      if (relayNode) relayNode.stop();
    });
    
    // 릴레이 서버 시작
    await relayNode.start();
    
    console.log('✅ 릴레이 서버 구동 완료');
    console.log('🔍 풀노드 연결 대기 중...');
    
    // 풀노드 연결 감지 시작
    waitForValidatorConnection();
    
  } catch (error) {
    console.error('❌ 릴레이 서버 시작 실패:', error.message);
    process.exit(1);
  }
}

// 풀노드 연결 대기
function waitForValidatorConnection() {
  const checkInterval = setInterval(() => {
    if (relayNode && relayNode.validators.size > 0) {
      clearInterval(checkInterval);
      
      console.log(`\n✅ 풀노드 연결 완료! (${relayNode.validators.size}개 연결됨)`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      // 이제 터미널 인터페이스 시작
      setupRelayTerminalInterface();
    }
  }, 1000); // 1초마다 체크
  
  // 30초 후에도 연결이 없으면 안내 메시지
  setTimeout(() => {
    if (relayNode && relayNode.validators.size === 0) {
      console.log('\n⚠️  풀노드 연결이 없습니다.');
      console.log('💡 다음 단계를 확인해주세요:');
      console.log('   1. 풀노드(node server.js)를 실행하세요');
      console.log('   2. 릴레이 서버 URL을 확인하세요');
      console.log('   3. 네트워크 연결을 확인하세요\n');
      console.log('🔄 풀노드 연결을 계속 기다리는 중...');
    }
  }, 30000);
}

// 풀노드 서버에 직접 로그인하는 함수 (새 버전)
async function tryLoginToValidator(userId, password) {
  const ports = [3000, 3001, 8080, 3002, 8081];
  
  for (const port of ports) {
    try {
      const url = `http://localhost:${port}/api/login`;
      console.log(`🔄 풀노드 포트 ${port} 로그인 시도 중...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: userId, 
          password: password 
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ 풀노드 포트 ${port}에서 로그인 성공`);
        return result;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log(`❌ 포트 ${port} 로그인 실패: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ 포트 ${port} 연결 실패: ${error.message}`);
    }
  }
  
  throw new Error('모든 포트에서 로그인 실패');
}

// 풀노드 서버에 직접 가입하는 함수 (새 버전)
async function tryRegisterToValidator(userId, password, name) {
  const ports = [3000, 3001, 8080, 3002, 8081];
  
  for (const port of ports) {
    try {
      const url = `http://localhost:${port}/api/register`;
      console.log(`🔄 풀노드 포트 ${port} 가입 시도 중...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: userId, 
          password: password,
          name: name,
          communicationAddress: `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`,
          deviceId: `relay_operator_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ 풀노드 포트 ${port}에서 가입 성공`);
        return result;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.log(`❌ 포트 ${port} 가입 실패: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ 포트 ${port} 연결 실패: ${error.message}`);
    }
  }
  
  throw new Error('모든 포트에서 가입 실패');
}

module.exports = RelayNode;
