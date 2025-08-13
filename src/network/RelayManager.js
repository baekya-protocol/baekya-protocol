/**
 * BROTHERHOOD 릴레이 매니저
 * 
 * 역할:
 * 1. 최적의 릴레이 노드 자동 탐색
 * 2. 릴레이 연결 관리 및 자동 재연결
 * 3. 연결 상태 모니터링
 * 4. 장애 복구 및 로드 밸런싱
 */

const EventEmitter = require('events');

class RelayManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.userDID = config.userDID;
    this.connectionType = config.connectionType || 'client'; // 'client' or 'validator'
    this.region = config.region || 'auto';
    
    // 사용자/풀노드 지역 좌표 (자동 감지)
    this.nodeCoordinates = null;
    this.nodeLocation = null;
    
    // 디스커버리 서버 설정
    this.discoveryServers = config.discoveryServers || [
      'https://brotherhood-relay-discovery.railway.app',
      'http://localhost:3333'
    ];
    
    // 연결 관리
    this.currentRelay = null;
    this.relaySocket = null;
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, reconnecting
    this.availableRelays = [];
    this.failedRelays = new Set(); // 실패한 릴레이들
    
    // 재연결 설정
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 시작 지연 시간 (ms)
    this.maxReconnectDelay = 30000; // 최대 지연 시간
    this.reconnectTimer = null;
    
    // 연결 품질 모니터링
    this.pingInterval = 30000; // 30초
    this.pingTimer = null;
    this.lastPingTime = null;
    this.averagePing = 0;
    this.connectionQuality = 'unknown'; // excellent, good, fair, poor, critical
    
    // 릴레이 운영자 정보 (서버로부터 수신)
    this.relayOperatorDID = null;
    this.relayOperatorUsername = null;
    this.relayNodeId = null;
    
    // 통계
    this.stats = {
      connectionAttempts: 0,
      successfulConnections: 0,
      disconnections: 0,
      messagesRelayed: 0,
      totalUptime: 0,
      startTime: Date.now()
    };
    
    console.log('🔗 RelayManager 초기화됨');
  }
  
  async connect() {
    if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
      console.log('⚠️ 이미 연결 중이거나 연결됨 - 연결 시도 중단');
      return;
    }
    
    // 기존 연결이 있다면 정리
    if (this.relaySocket && this.relaySocket.readyState === 1) { // WebSocket.OPEN
      console.log('🔄 기존 연결 정리 중...');
      this.relaySocket.close(1000, 'Reconnecting');
      this.relaySocket = null;
    }
    
    this.connectionState = 'connecting';
    this.stats.connectionAttempts++;
    
    // 노드 위치 감지
    await this.detectNodeLocation();
    
    try {
      console.log('🔍 지역 기반 최적 릴레이 노드 탐색 중...');
      
      // 디스커버리 서버에서 릴레이 목록 가져오기
      await this.discoverRelays();
      
      if (this.availableRelays.length === 0) {
        throw new Error('사용 가능한 릴레이 노드가 없습니다');
      }
      
      // 최적의 릴레이 선택 및 연결
      await this.connectToBestRelay();
      
    } catch (error) {
      console.error('❌ 릴레이 연결 실패:', error.message);
      this.connectionState = 'disconnected';
      this.emit('connectionFailed', error);
      
      // 자동 재연결 시도
      this.scheduleReconnect();
    }
  }
  
  async discoverRelays() {
    console.log('🔍 릴레이 노드 순차 탐색 중...');
    this.availableRelays = [];
    
    // 1번부터 10번까지 LocalTunnel URL로 순차 시도
    for (let i = 1; i <= 10; i++) {
      try {
        const relayUrl = `https://brotherhood-relay-${i}.loca.lt`;
        console.log(`📡 릴레이 ${i}번 확인: ${relayUrl}`);
        
        const response = await fetch(`${relayUrl}/relay-info`, {
          method: 'GET',
          timeout: 3000
        });
        
        if (response.ok) {
          const relayInfo = await response.json();
          
          // 해당 릴레이에서 전체 활성 릴레이 리스트 가져오기
          const relayListResponse = await fetch(`${relayUrl}/active-relays`, {
            method: 'GET',
            timeout: 3000
          });
          
          if (relayListResponse.ok) {
            const relayListData = await relayListResponse.json();
            console.log(`✅ 릴레이 ${i}번에서 ${relayListData.relays.length}개 릴레이 리스트 확보`);
            
            // 모든 릴레이 정보를 수집
            for (const relay of relayListData.relays) {
              // 실패한 릴레이는 제외
              if (this.failedRelays.has(relay.nodeId)) {
                continue;
              }
              
              this.availableRelays.push({
                nodeId: relay.nodeId,
                relayNumber: relay.number,
                name: relay.name || `Brotherhood-Relay-${relay.number}`,
                url: relay.url,
                endpoint: relay.url.replace('https://', 'wss://'),
                region: 'auto',
                clients: relay.clients,
                validators: relay.validators,
                capacity: relay.capacity,
                latency: 50, // 기본 레이턴시
                score: this.calculateRelayQuality(relay),
                reliability: 0.98,
                capabilities: ['transaction_relay', 'block_relay'],
                // 지역 정보 추가
                coordinates: relay.coordinates,
                city: relay.city,
                country: relay.country,
                region: relay.region
              });
            }
            
            // 첫 번째 성공한 릴레이에서 리스트를 얻었으므로 중단
            break;
          }
        }
      } catch (error) {
        // 해당 번호의 릴레이가 없는 것은 정상
        console.log(`⭕ 릴레이 ${i}번 없음`);
      }
    }
    
    // 실패할 경우 목업 릴레이 사용
    if (this.availableRelays.length === 0) {
      console.log('📝 목업 릴레이 데이터 사용');
      const mockRelays = this.generateMockRelays();
      this.availableRelays = [...this.availableRelays, ...mockRelays];
      console.log(`✅ ${mockRelays.length}개 릴레이 발견 (목업)`);
    }
    
    // 품질에 따라 정렬 (원활한 릴레이 우선, 번호가 낮은 순서)
    this.availableRelays.sort((a, b) => {
      // 우선순위 1: 용량 상태 (smooth > moderate > saturated)
      const capacityOrder = { 'smooth': 3, 'moderate': 2, 'saturated': 1 };
      const capacityDiff = (capacityOrder[b.capacity] || 0) - (capacityOrder[a.capacity] || 0);
      if (capacityDiff !== 0) return capacityDiff;
      
      // 우선순위 2: 릴레이 번호 (낮은 번호 우선)
      return (a.relayNumber || 999) - (b.relayNumber || 999);
    });
    
    console.log(`🎯 총 ${this.availableRelays.length}개 릴레이 발견`);
  }

  // 릴레이 품질 계산
  calculateRelayQuality(relay) {
    let score = 100;
    
    // 용량 상태에 따른 점수
    if (relay.capacity === 'saturated') {
      score -= 50;
    } else if (relay.capacity === 'moderate') {
      score -= 20;
    }
    
    // 사용자 타입에 따른 추가 점수 조정
    if (this.connectionType === 'client') {
      // 클라이언트는 클라이언트 수가 적은 릴레이를 선호
      score -= (relay.clients || 0) * 0.1;
    } else if (this.connectionType === 'validator') {
      // 검증자는 검증자 수가 적은 릴레이를 선호
      score -= (relay.validators || 0) * 0.2;
    }
    
    return Math.max(score, 0);
  }
  
  generateMockRelays() {
    // 개발/테스트용 모킹 릴레이 데이터
    return [
      {
        nodeId: 'relay_test_001',
        name: 'Seoul Relay Node 1',
        region: 'korea',
        endpoint: 'ws://localhost:8080',
        score: 150,
        reliability: 0.98,
        connections: 45,
        capabilities: ['transaction_relay', 'block_relay']
      },
      {
        nodeId: 'relay_test_002', 
        name: 'Tokyo Relay Node 1',
        region: 'asia',
        endpoint: 'ws://localhost:8081',
        score: 130,
        reliability: 0.95,
        connections: 67,
        capabilities: ['transaction_relay', 'block_relay']
      },
      {
        nodeId: 'relay_test_003',
        name: 'US West Relay Node 1', 
        region: 'us-west',
        endpoint: 'ws://localhost:8082',
        score: 110,
        reliability: 0.92,
        connections: 123,
        capabilities: ['transaction_relay']
      }
    ].filter(relay => !this.failedRelays.has(relay.nodeId));
  }
  
  async connectToBestRelay() {
    // 🌍 지역 기반 핑-퐁 방식으로 최적 릴레이 선택
    console.log('🌍 지역 기반 릴레이 선택 시작...');
    
    const optimalRelay = await this.selectOptimalRelayByLocation(this.availableRelays);
    
    if (optimalRelay) {
      // 최적 릴레이를 최우선으로 이동
      this.availableRelays = [optimalRelay, ...this.availableRelays.filter(r => r.nodeId !== optimalRelay.nodeId)];
    }
    
    for (const relay of this.availableRelays) {
      try {
        console.log(`🔗 릴레이 연결 시도: ${relay.name} (${relay.nodeId})`);
        
        await this.connectToRelay(relay);
        
        this.currentRelay = relay;
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.stats.successfulConnections++;
        
        console.log(`✅ 릴레이 연결 성공: ${relay.name}`);
        
        // 연결 품질 모니터링 시작
        this.startQualityMonitoring();
        
        this.emit('connected', relay);
        return;
        
      } catch (error) {
        console.error(`❌ 릴레이 연결 실패 (${relay.name}):`, error.message);
        this.failedRelays.add(relay.nodeId);
        
        // 다음 릴레이 시도
        continue;
      }
    }
    
    throw new Error('모든 릴레이 연결 시도 실패');
  }
  
  async connectToRelay(relay) {
    return new Promise((resolve, reject) => {
      if (typeof WebSocket === 'undefined') {
        // Node.js 환경
        const WebSocket = require('ws');
        this.relaySocket = new WebSocket(relay.endpoint);
      } else {
        // 브라우저 환경
        this.relaySocket = new WebSocket(relay.endpoint);
      }
      
      const connectionTimeout = setTimeout(() => {
        this.relaySocket.close();
        reject(new Error('연결 타임아웃'));
      }, 10000);
      
      this.relaySocket.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log(`🔓 WebSocket 연결 열림: ${relay.endpoint}`);
        
        // 인증 메시지 전송
        this.relaySocket.send(JSON.stringify({
          type: 'auth',
          data: {
            connectionType: this.connectionType,
            credentials: {
              userDID: this.userDID,
              timestamp: Date.now()
            }
          }
        }));
      };
      
      this.relaySocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleRelayMessage(message, resolve, reject);
        } catch (error) {
          console.error('❌ 릴레이 메시지 파싱 오류:', error.message);
        }
      };
      
      this.relaySocket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`🔒 릴레이 연결 종료: ${event.code} - ${event.reason}`);
        this.handleDisconnection();
      };
      
      this.relaySocket.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ 릴레이 WebSocket 오류:', error.message);
        reject(error);
      };
    });
  }
  
  handleRelayMessage(message, resolve, reject) {
    const { type, data } = message;
    
    switch (type) {
      case 'welcome':
        console.log(`👋 릴레이 환영 메시지: ${data?.name || 'Unknown'}`);
        break;
        
      case 'auth_success':
        console.log('✅ 릴레이 인증 성공');
        
        // 클라이언트/검증자 등록
        if (this.connectionType === 'client') {
          this.relaySocket.send(JSON.stringify({
            type: 'register_client',
            data: {
              userDID: this.userDID,
              deviceInfo: {
                platform: typeof navigator !== 'undefined' ? navigator.platform : 'node',
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'BROTHERHOOD-Client'
              }
            }
          }));
        } else if (this.connectionType === 'validator') {
          this.relaySocket.send(JSON.stringify({
            type: 'register_validator',
            data: {
              validatorDID: this.userDID,
              validatorInfo: {
                capabilities: ['transaction_processing', 'block_validation'],
                version: '1.0.0'
              }
            }
          }));
        }
        break;
        
      case 'auth_failed':
        console.error('❌ 릴레이 인증 실패:', data?.error);
        reject(new Error(`인증 실패: ${data?.error}`));
        break;
        
      case 'registration_success':
        console.log('✅ 릴레이 등록 성공');
        if (resolve) resolve();
        break;
        
      case 'relay_operator_info':
        // 릴레이 운영자 정보 수신
        if (data) {
          this.relayOperatorDID = data.operatorDID;
          this.relayOperatorUsername = data.operatorUsername;
          this.relayNodeId = data.relayNodeId;
          console.log(`🏷️  릴레이 운영자 정보 수신: ${data.operatorUsername} (${data.operatorDID?.substring(0, 8)}...)`);
        }
        break;
        
      case 'pong':
        this.handlePong();
        break;
        
      case 'transaction':
      case 'block':
        this.stats.messagesRelayed++;
        this.emit('message', message);
        break;
        
      case 'error':
        console.error('❌ 릴레이 에러:', data?.error);
        this.emit('error', new Error(data?.error));
        break;
        
      default:
        console.log(`❓ 알 수 없는 릴레이 메시지: ${type}`);
    }
  }
  
  handleDisconnection() {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      this.connectionState = 'disconnected';
      this.stats.disconnections++;
      this.stopQualityMonitoring();
      
      // 현재 릴레이를 실패 목록에 추가 (잠시 동안)
      if (this.currentRelay) {
        this.failedRelays.add(this.currentRelay.nodeId);
        console.log(`❌ 릴레이 실패 목록에 추가: ${this.currentRelay.name}`);
        
        // 30초 후 실패 목록에서 제거 (재시도 허용)
        setTimeout(() => {
          this.failedRelays.delete(this.currentRelay.nodeId);
          console.log(`♻️ 릴레이 재시도 허용: ${this.currentRelay.name}`);
        }, 30000);
      }
      
      this.currentRelay = null;
      this.relaySocket = null;
      
      console.log('📡 릴레이 연결이 끊어짐 - 다른 릴레이 탐색');
      this.emit('disconnected');
      
      // 자동 재연결 (3초 지연)
      this.scheduleReconnect();
    }
  }
  
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error('❌ 최대 재연결 시도 횟수 초과');
      this.emit('maxReconnectAttemptsReached');
      return;
    }
    
    // 지수 백오프로 재연결 지연 시간 증가
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    // 최소 3초 지연
    const actualDelay = Math.max(delay, 3000);
    
    console.log(`🔄 ${actualDelay}ms 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.connectionState = 'reconnecting';
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, actualDelay);
  }
  
  startQualityMonitoring() {
    this.pingTimer = setInterval(() => {
      this.sendPing();
    }, this.pingInterval);
    
    console.log('📊 연결 품질 모니터링 시작');
  }
  
  stopQualityMonitoring() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
  
  sendPing() {
    if (this.relaySocket && this.relaySocket.readyState === 1) { // WebSocket.OPEN
      this.lastPingTime = Date.now();
      this.relaySocket.send(JSON.stringify({
        type: 'ping',
        timestamp: this.lastPingTime
      }));
    }
  }
  
  handlePong() {
    if (this.lastPingTime) {
      const pingTime = Date.now() - this.lastPingTime;
      this.averagePing = this.averagePing === 0 ? pingTime : (this.averagePing + pingTime) / 2;
      
      // 연결 품질 평가
      if (pingTime < 50) this.connectionQuality = 'excellent';
      else if (pingTime < 100) this.connectionQuality = 'good';
      else if (pingTime < 200) this.connectionQuality = 'fair';
      else if (pingTime < 500) this.connectionQuality = 'poor';
      else this.connectionQuality = 'critical';
      
      // 이벤트 리스너가 있는 경우에만 emit
      try {
        this.emit('qualityUpdate', {
          ping: pingTime,
          averagePing: this.averagePing,
          quality: this.connectionQuality
        });
      } catch (error) {
        // 이벤트 리스너가 없는 경우 무시
      }
    }
  }
  
  sendMessage(type, data) {
    if (this.connectionState !== 'connected' || !this.relaySocket) {
      throw new Error('릴레이에 연결되지 않음');
    }
    
    this.relaySocket.send(JSON.stringify({
      type: type,
      data: data,
      timestamp: Date.now()
    }));
    
    this.stats.messagesRelayed++;
  }
  
  sendTransaction(transactionData) {
    this.sendMessage('transaction', transactionData);
  }
  
  sendBlock(blockData) {
    this.sendMessage('block', blockData);
  }
  
  getConnectionInfo() {
    return {
      state: this.connectionState,
      currentRelay: this.currentRelay,
      quality: this.connectionQuality,
      ping: this.averagePing,
      uptime: Date.now() - this.stats.startTime,
      stats: this.stats,
      availableRelays: this.availableRelays.length,
      failedRelays: this.failedRelays.size
    };
  }
  
  disconnect() {
    console.log('🔌 릴레이 연결 수동 종료');
    
    this.connectionState = 'disconnected';
    
    // 타이머들 정리
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopQualityMonitoring();
    
    // WebSocket 연결 종료
    if (this.relaySocket) {
      this.relaySocket.close(1000, 'Manual disconnect');
      this.relaySocket = null;
    }
    
    this.currentRelay = null;
    this.emit('disconnected');
  }
  
  // 연결 강제 변경 (더 좋은 릴레이 발견 시)
  async switchRelay() {
    console.log('🔄 더 나은 릴레이 탐색 중...');
    
    const oldRelay = this.currentRelay;
    this.disconnect();
    
    // 실패한 릴레이 목록 초기화 (새로운 기회 제공)
    this.failedRelays.clear();
    
    try {
      await this.connect();
      console.log(`✅ 릴레이 변경 성공: ${oldRelay?.name} → ${this.currentRelay?.name}`);
    } catch (error) {
      console.error('❌ 릴레이 변경 실패:', error.message);
      // 이전 릴레이로 복구 시도할 수도 있음
    }
  }
  // 노드 위치 감지 (Node.js 환경용)
  async detectNodeLocation() {
    try {
      console.log('🌍 노드 위치 감지 중...');
      
      // Node.js 환경에서 http 모듈 사용
      const http = require('http');
      
      const locationData = await new Promise((resolve, reject) => {
        const req = http.get('http://ip-api.com/json/', {
          timeout: 5000
        }, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch (error) {
              reject(error);
            }
          });
        });
        
        req.on('error', (error) => {
          reject(error);
        });
        
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });
      
      if (locationData.status === 'success') {
        this.nodeCoordinates = {
          lat: locationData.lat,
          lng: locationData.lon
        };
        this.nodeLocation = {
          country: locationData.country,
          city: locationData.city,
          region: locationData.regionName
        };
        
        console.log(`📍 노드 위치: ${this.nodeLocation.city}, ${this.nodeLocation.country} (${this.nodeCoordinates.lat}, ${this.nodeCoordinates.lng})`);
      } else {
        this.setDefaultNodeLocation();
      }
    } catch (error) {
      console.warn('⚠️ 위치 감지 실패:', error.message);
      this.setDefaultNodeLocation();
    }
  }
  
  // 기본 노드 위치 설정
  setDefaultNodeLocation() {
    this.nodeCoordinates = {
      lat: 37.5665,
      lng: 126.9780
    };
    this.nodeLocation = {
      country: 'South Korea',
      city: 'Seoul',
      region: 'Seoul'
    };
    console.log('📍 기본 노드 위치: Seoul, South Korea');
  }
  
  // 거리 계산
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  // 지역 기반 릴레이 선택 (핑-퐁 방식)
  async selectOptimalRelayByLocation(relayList) {
    if (!this.nodeCoordinates || !relayList.length) {
      console.log('❌ 노드 위치 또는 릴레이 리스트 없음 - 첫 번째 릴레이 사용');
      return relayList[0];
    }
    
    const nodeLat = this.nodeCoordinates.lat;
    const nodeLng = this.nodeCoordinates.lng;
    
    // 25km부터 시작해서 점진적으로 범위 확대
    const searchRadii = [25, 50, 100, 200, 500, 1000];
    
    for (const radius of searchRadii) {
      console.log(`🔍 ${radius}km 범위 내 릴레이 탐색 중...`);
      
      // 해당 범위 내의 릴레이들 필터링
      const nearbyRelays = relayList.filter(relay => {
        if (!relay.coordinates) {
          console.log(`⚠️ 릴레이 ${relay.name}: 좌표 정보 없음`);
          return false;
        }
        
        const distance = this.calculateDistance(
          nodeLat, nodeLng,
          relay.coordinates.lat, relay.coordinates.lng
        );
        
        console.log(`📍 릴레이 ${relay.name} (${relay.city}): 거리 ${distance.toFixed(1)}km`);
        return distance <= radius;
      });
      
      if (nearbyRelays.length === 0) {
        console.log(`📍 ${radius}km 범위 내 릴레이 없음 - 범위 확대`);
        continue;
      }
      
      console.log(`📍 ${radius}km 범위 내 ${nearbyRelays.length}개 릴레이 발견`);
      
      // 핑-퐁 테스트로 가장 빠른 릴레이 선택
      const optimalRelay = await this.pingTestRelays(nearbyRelays);
      
      if (optimalRelay) {
        const distance = this.calculateDistance(
          nodeLat, nodeLng,
          optimalRelay.coordinates.lat, optimalRelay.coordinates.lng
        );
        console.log(`✅ 최적 릴레이 선택: ${optimalRelay.name} (${optimalRelay.city}, 거리: ${distance.toFixed(1)}km, 핑: ${optimalRelay.ping}ms)`);
        return optimalRelay;
      }
    }
    
    console.log('⚠️ 모든 범위에서 릴레이를 찾지 못함 - 첫 번째 릴레이 사용');
    return relayList[0];
  }
  
  // 핑 테스트로 가장 빠른 릴레이 선택 (Node.js 환경용)
  async pingTestRelays(relayList) {
    console.log(`🏓 ${relayList.length}개 릴레이 핑 테스트 시작...`);
    
    // 모든 릴레이에 동시에 핑 테스트
    const pingPromises = relayList.map(async (relay) => {
      try {
        const startTime = Date.now();
        
        // 릴레이 URL에서 핑 URL 생성 (LocalTunnel 형식)
        const pingUrl = `${relay.url}/ping`;
        console.log(`🏓 핑 테스트: ${relay.name} → ${pingUrl}`);
        
        // Node.js 환경에서 https 모듈 사용
        const https = require('https');
        const http = require('http');
        const url = require('url');
        
        const parsedUrl = url.parse(pingUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const response = await new Promise((resolve, reject) => {
          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.path,
            method: 'GET',
            timeout: 3000,
            headers: {
              'Bypass-Tunnel-Reminder': 'true',
              'Cache-Control': 'no-cache',
              'User-Agent': 'BrotherhoodProtocol/1.0'
            }
          };
          
          const req = client.request(options, (res) => {
            resolve(res);
          });
          
          req.on('error', (error) => {
            reject(error);
          });
          
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });
          
          req.end();
        });
        
        const endTime = Date.now();
        const pingTime = endTime - startTime;
        
        if (response.statusCode === 200) {
          console.log(`✅ 핑 성공: ${relay.name} (${pingTime}ms)`);
          return {
            ...relay,
            ping: pingTime,
            status: 'reachable'
          };
        } else {
          console.log(`❌ 핑 실패: ${relay.name} (상태: ${response.statusCode})`);
          return {
            ...relay,
            ping: 9999,
            status: 'unreachable'
          };
        }
      } catch (error) {
        console.log(`❌ 핑 오류: ${relay.name} (${error.message})`);
        return {
          ...relay,
          ping: 9999,
          status: 'error'
        };
      }
    });
    
    const results = await Promise.all(pingPromises);
    
    // 성공한 릴레이들만 필터링
    const reachableRelays = results.filter(relay => relay.status === 'reachable');
    
    if (reachableRelays.length === 0) {
      console.log('❌ 핑 테스트 통과한 릴레이 없음');
      return null;
    }
    
    // 핑 시간 기준으로 정렬
    reachableRelays.sort((a, b) => a.ping - b.ping);
    
    console.log('🏓 핑 테스트 결과:');
    reachableRelays.forEach(relay => {
      console.log(`  ${relay.name}: ${relay.ping}ms (${relay.city || 'Unknown'})`);
    });
    
    return reachableRelays[0]; // 가장 빠른 릴레이 반환
  }
}

module.exports = RelayManager;
