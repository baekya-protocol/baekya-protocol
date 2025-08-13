/**
 * BROTHERHOOD 릴레이 매니저 (브라우저 버전)
 * 
 * 역할:
 * 1. 최적의 릴레이 노드 자동 탐색
 * 2. 릴레이 연결 관리 및 자동 재연결
 * 3. 연결 상태 모니터링
 * 4. 장애 복구 및 로드 밸런싱
 */

class RelayManager extends EventTarget {
  constructor(config = {}) {
    super();
    
    this.userDID = config.userDID;
    this.connectionType = config.connectionType || 'client';
    this.region = config.region || 'auto';
    
    // 사용자 지역 좌표 (자동 감지)
    this.userCoordinates = null;
    this.userLocation = null;
    
    // 디스커버리 서버 설정
    this.discoveryServers = config.discoveryServers || [
      'https://brotherhood-relay-discovery.railway.app',
      'https://baekya-protocol-production.up.railway.app'
    ];
    
    // 연결 관리
    this.currentRelay = null;
    this.relaySocket = null;
    this.connectionState = 'disconnected';
    this.availableRelays = [];
    this.failedRelays = new Set();
    
    // 재연결 설정
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.reconnectTimer = null;
    
    // 연결 품질 모니터링
    this.pingInterval = 30000;
    this.pingTimer = null;
    this.lastPingTime = null;
    this.averagePing = 0;
    this.connectionQuality = 'unknown';
    
    // 통계
    this.stats = {
      connectionAttempts: 0,
      successfulConnections: 0,
      disconnections: 0,
      messagesRelayed: 0,
      totalUptime: 0,
      startTime: Date.now()
    };
    
    console.log('🔗 RelayManager 초기화됨 (브라우저 버전)');
  }
  
  async connect() {
    if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
      console.log('⚠️ 이미 연결 중이거나 연결됨');
      return;
    }
    
    this.connectionState = 'connecting';
    this.stats.connectionAttempts++;
    
    // 사용자 위치 감지
    await this.detectUserLocation();
    
    try {
      console.log('🔍 최적의 릴레이 노드 탐색 중...');
      
      await this.discoverRelays();
      
      if (this.availableRelays.length === 0) {
        throw new Error('사용 가능한 릴레이 노드가 없습니다');
      }
      
      await this.connectToBestRelay();
      
    } catch (error) {
      console.error('❌ 릴레이 연결 실패:', error.message);
      this.connectionState = 'disconnected';
      this.dispatchEvent(new CustomEvent('connectionFailed', { detail: error }));
      
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
          method: 'GET'
        });
        
        if (response.ok) {
          const relayInfo = await response.json();
          
          // 해당 릴레이에서 전체 활성 릴레이 리스트 가져오기
          const relayListResponse = await fetch(`${relayUrl}/active-relays`, {
            method: 'GET'
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
                score: this.calculateRelayQuality(relay)
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
    // 현재 페이지 호스트 기반으로 목업 릴레이 생성
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseHost = isLocal ? 'localhost' : window.location.hostname;
    
    return [
      {
        nodeId: 'relay_local_001',
        name: 'Local Relay Node 1',
        region: 'local',
        endpoint: `ws://${baseHost}:8080`,
        score: 150,
        reliability: 0.98,
        connections: 5,
        capabilities: ['transaction_relay', 'block_relay']
      },
      {
        nodeId: 'relay_local_002',
        name: 'Local Relay Node 2',
        region: 'local',
        endpoint: `ws://${baseHost}:8081`,
        score: 130,
        reliability: 0.95,
        connections: 3,
        capabilities: ['transaction_relay', 'block_relay']
      },
      {
        nodeId: 'relay_railway_001',
        name: 'Railway Relay Node',
        region: 'cloud',
        endpoint: 'wss://baekya-relay.up.railway.app',
        score: 120,
        reliability: 0.90,
        connections: 45,
        capabilities: ['transaction_relay', 'block_relay']
      }
    ].filter(relay => !this.failedRelays.has(relay.nodeId));
  }
  
  async connectToBestRelay() {
    for (const relay of this.availableRelays) {
      try {
        console.log(`🔗 릴레이 연결 시도: ${relay.name} (${relay.nodeId})`);
        
        await this.connectToRelay(relay);
        
        this.currentRelay = relay;
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.stats.successfulConnections++;
        
        console.log(`✅ 릴레이 연결 성공: ${relay.name}`);
        
        this.startQualityMonitoring();
        
        this.dispatchEvent(new CustomEvent('connected', { detail: relay }));
        return;
        
      } catch (error) {
        console.error(`❌ 릴레이 연결 실패 (${relay.name}):`, error.message);
        this.failedRelays.add(relay.nodeId);
        continue;
      }
    }
    
    throw new Error('모든 릴레이 연결 시도 실패');
  }
  
  async connectToRelay(relay) {
    return new Promise((resolve, reject) => {
      this.relaySocket = new WebSocket(relay.endpoint);
      
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
        console.error('❌ 릴레이 WebSocket 오류:', error);
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
        
        if (this.connectionType === 'client') {
          this.relaySocket.send(JSON.stringify({
            type: 'register_client',
            data: {
              userDID: this.userDID,
              deviceInfo: {
                platform: navigator.platform,
                userAgent: navigator.userAgent
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
        
      case 'pong':
        this.handlePong();
        break;
        
      case 'transaction':
      case 'block':
        this.stats.messagesRelayed++;
        this.dispatchEvent(new CustomEvent('message', { detail: message }));
        break;
        
      case 'error':
        console.error('❌ 릴레이 에러:', data?.error);
        this.dispatchEvent(new CustomEvent('error', { detail: new Error(data?.error) }));
        break;
        
      default:
        console.log(`❓ 알 수 없는 릴레이 메시지: ${type}`);
    }
  }
  
  handleDisconnection() {
    if (this.connectionState === 'connected') {
      this.connectionState = 'disconnected';
      this.stats.disconnections++;
      this.stopQualityMonitoring();
      
      console.log('📡 릴레이 연결이 끊어짐 - 재연결 시도');
      this.dispatchEvent(new CustomEvent('disconnected'));
      
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
      this.dispatchEvent(new CustomEvent('maxReconnectAttemptsReached'));
      return;
    }
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    console.log(`🔄 ${delay}ms 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.connectionState = 'reconnecting';
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
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
    if (this.relaySocket && this.relaySocket.readyState === WebSocket.OPEN) {
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
      
      if (pingTime < 50) this.connectionQuality = 'excellent';
      else if (pingTime < 100) this.connectionQuality = 'good';
      else if (pingTime < 200) this.connectionQuality = 'fair';
      else if (pingTime < 500) this.connectionQuality = 'poor';
      else this.connectionQuality = 'critical';
      
      this.dispatchEvent(new CustomEvent('qualityUpdate', { 
        detail: {
          ping: pingTime,
          averagePing: this.averagePing,
          quality: this.connectionQuality
        }
      }));
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
      ping: Math.round(this.averagePing),
      uptime: Date.now() - this.stats.startTime,
      stats: this.stats,
      availableRelays: this.availableRelays.length,
      failedRelays: this.failedRelays.size
    };
  }
  
  disconnect() {
    console.log('🔌 릴레이 연결 수동 종료');
    
    this.connectionState = 'disconnected';
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopQualityMonitoring();
    
    if (this.relaySocket) {
      this.relaySocket.close(1000, 'Manual disconnect');
      this.relaySocket = null;
    }
    
    this.currentRelay = null;
    this.dispatchEvent(new CustomEvent('disconnected'));
  }
  
  async switchRelay() {
    console.log('🔄 더 나은 릴레이 탐색 중...');
    
    const oldRelay = this.currentRelay;
    this.disconnect();
    
    this.failedRelays.clear();
    
    try {
      await this.connect();
      console.log(`✅ 릴레이 변경 성공: ${oldRelay?.name} → ${this.currentRelay?.name}`);
    } catch (error) {
      console.error('❌ 릴레이 변경 실패:', error.message);
    }
  }
  
  // 사용자 위치 감지
  async detectUserLocation() {
    try {
      console.log('🌍 사용자 위치 감지 중...');
      
      // IP 기반 위치 감지
      const response = await fetch('http://ip-api.com/json/', {
        timeout: 5000
      });
      
      if (response.ok) {
        const locationData = await response.json();
        
        if (locationData.status === 'success') {
          this.userCoordinates = {
            lat: locationData.lat,
            lng: locationData.lon
          };
          this.userLocation = {
            country: locationData.country,
            city: locationData.city,
            region: locationData.regionName
          };
          
          console.log(`📍 사용자 위치: ${this.userLocation.city}, ${this.userLocation.country} (${this.userCoordinates.lat}, ${this.userCoordinates.lng})`);
        } else {
          this.setDefaultUserLocation();
        }
      } else {
        this.setDefaultUserLocation();
      }
    } catch (error) {
      console.warn('⚠️ 위치 감지 실패:', error.message);
      this.setDefaultUserLocation();
    }
  }
  
  // 기본 사용자 위치 설정
  setDefaultUserLocation() {
    this.userCoordinates = {
      lat: 37.5665,
      lng: 126.9780
    };
    this.userLocation = {
      country: 'South Korea',
      city: 'Seoul',
      region: 'Seoul'
    };
    console.log('📍 기본 사용자 위치: Seoul, South Korea');
  }
  
  // 두 좌표 간의 거리 계산 (킬로미터)
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
    if (!this.userCoordinates || !relayList.length) {
      console.log('❌ 사용자 위치 또는 릴레이 리스트 없음 - 기본 방식 사용');
      return relayList[0]; // 첫 번째 릴레이 반환
    }
    
    const userLat = this.userCoordinates.lat;
    const userLng = this.userCoordinates.lng;
    
    // 25km부터 시작해서 점진적으로 범위 확대
    const searchRadii = [25, 50, 100, 200, 500, 1000]; // km
    
    for (const radius of searchRadii) {
      console.log(`🔍 ${radius}km 범위 내 릴레이 탐색 중...`);
      
      // 해당 범위 내의 릴레이들 필터링
      const nearbyRelays = relayList.filter(relay => {
        if (!relay.coordinates) return false;
        
        const distance = this.calculateDistance(
          userLat, userLng,
          relay.coordinates.lat, relay.coordinates.lng
        );
        
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
          userLat, userLng,
          optimalRelay.coordinates.lat, optimalRelay.coordinates.lng
        );
        console.log(`✅ 최적 릴레이 선택: ${optimalRelay.number}번 (${optimalRelay.city}, 거리: ${distance.toFixed(1)}km, 핑: ${optimalRelay.ping}ms)`);
        return optimalRelay;
      }
    }
    
    console.log('⚠️ 모든 범위에서 릴레이를 찾지 못함 - 첫 번째 릴레이 사용');
    return relayList[0];
  }
  
  // 핑 테스트로 가장 빠른 릴레이 선택
  async pingTestRelays(relayList) {
    console.log(`🏓 ${relayList.length}개 릴레이 핑 테스트 시작...`);
    
    const pingResults = [];
    
    // 모든 릴레이에 동시에 핑 테스트
    const pingPromises = relayList.map(async (relay) => {
      try {
        const startTime = Date.now();
        
        // /ping 엔드포인트로 핑 테스트
        const response = await fetch(`${relay.url}/ping`, {
          method: 'GET',
          timeout: 3000
        });
        
        const endTime = Date.now();
        const pingTime = endTime - startTime;
        
        if (response.ok) {
          return {
            ...relay,
            ping: pingTime,
            status: 'reachable'
          };
        } else {
          return {
            ...relay,
            ping: 9999,
            status: 'unreachable'
          };
        }
      } catch (error) {
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
      console.log(`  ${relay.number}번: ${relay.ping}ms (${relay.city})`);
    });
    
    return reachableRelays[0]; // 가장 빠른 릴레이 반환
  }
}

// 전역으로 노출
window.RelayManager = RelayManager;
