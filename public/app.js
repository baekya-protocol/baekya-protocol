// 백야 프로토콜 DApp - 메인 애플리케이션 로직

class BaekyaProtocolDApp {
  constructor() {
    this.currentUser = null;
    this.protocol = null;
    this.isAuthenticated = false;
    this.currentTab = 'dashboard';
    
    // 프로토콜 API 설정
    // 로컬 서버 직접 연결 모드
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const localServerUrl = `http://${window.location.hostname}:3000`;
    this.relayServerUrl = isLocal ? localServerUrl : (window.RELAY_SERVER_URL || 'https://baekya-relay.up.railway.app');
    this.apiBase = isLocal ? `${localServerUrl}/api` : `${this.relayServerUrl}/api`;
    this.isDecentralized = true;
    
    // WebSocket 연결
    this.ws = null;
    this.wsReconnectInterval = null;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.wsUrl = isLocal ? `ws://${window.location.hostname}:3000` : this.relayServerUrl.replace('https:', 'wss:').replace('http:', 'ws:');
    
    // 데이터 캐싱으로 성능 향상
    this.dataCache = {
      protocolStatus: null,
      contributions: null,
      daos: null,
      proposals: null,
      lastUpdate: null
    };
    
    // 토큰 발행 시스템
    this.miningSystem = {
      currentHourlyRate: 0,
      lastMiningTime: null,
      nextMiningTimer: null,
      isActive: false
    };
    
    // 아이디 인증 데이터 (생체인증 대신)
    this.authData = {
      userId: null,  // 고유 아이디
      password: null,
      did: null,
      communicationAddress: null,
      deviceId: null,  // 기기 고유 번호
      createdAt: null,
      hasSetCommunicationAddress: false  // 통신주소 설정 여부
    };
    
    // 호환성을 위한 임시 객체 (기존 코드와의 호환성)
    this.biometricData = {
      fingerprint: null,
      faceprint: null,
      password: null,
      did: null,
      communicationAddress: null,
      personalInfo: null,
      inviteCode: null
    };

    // QR 코드 관련
    this.qrType = 'did'; // 'did' 또는 'comm'
    
    // 채팅 필터링
    this.currentChatFilter = 'all'; // 기본값: 전체 채팅
    
    // 거래내역 관련
    this.transactions = [];
    this.currentTransactionFilter = 'all'; // 기본값: 전체 거래
    this.unreadTransactionCount = 0;

    // 커뮤니티 글 필터링
    this.showingMyPostsOnly = false;

    // 인증 관련
    this.authSettings = {
      isFirstLogin: true,
      lastLoginDate: null,
      requireFullAuth: true, // 첫 로그인 또는 다른 날 로그인 시 전체 인증 필요
      authMethods: {
        fingerprint: false,
        face: false,
        password: false
      },
      loginRequiredMethods: 2 // 로그인 시 필요한 인증 방법 수
    };
    
    // 알림 시스템
    this.notifications = {
      dao: {}, // DAO별 알림 상태 { daoId: { contribution: count, participation: count } }
      totalUnread: 0, // 전체 읽지 않은 알림 수
      lastUpdate: null
    };
    
    this.init();
  }

  async init() {
    console.log('🌅 백야 프로토콜 DApp 초기화 중...');
    
    // Capacitor 환경 감지 및 설정
    this.detectCapacitorEnvironment();
    
    // 채팅 화면 초기 상태 강제 리셋
    this.resetChatScreens();
    
    // 탭 네비게이션 설정
    this.setupTabNavigation();
    
    // 윈도우 리사이즈 이벤트로 모바일 헤더 상태 업데이트
    window.addEventListener('resize', () => {
      this.switchMobileHeader(this.currentTab || 'dashboard');
    });
    
    // 스크롤 효과 설정 (현재는 사용하지 않음)
    // this.setupScrollEffect();
    
    // 저장된 사용자 인증 정보 확인 - 즉시 처리
    this.checkStoredAuth();
    
    // 프로토콜 상태 로드 - 백그라운드에서 처리
    this.loadProtocolStatus();
    
    // 초기 대시보드 로드
    this.loadDashboard();
    
    // 새로운 채팅 기능 설정
    this.setupModalCloseHandlers();
    
    // 노드 연결 상태 모니터링 시작
    this.startNodeMonitoring();
    
    // 투표 상태 자동 체크 시스템 시작
    this.startVotingStatusChecker();
    
    // 초기 프로필 상태 설정
    this.updateProfileStatus('offline');
    
    console.log('✅ 백야 프로토콜 DApp 초기화 완료');
  }

  // WebSocket 연결 관리
  connectWebSocket() {
    if (!this.isAuthenticated || !this.currentUser) return;
    
    try {
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => {
        console.log('🔌 서버에 연결됨');
        
        // 로컬 서버에 맞는 인증 메시지 전송
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal) {
          // 로컬 서버용 메시지
        this.ws.send(JSON.stringify({
          type: 'auth',
          did: this.currentUser.did
        }));
        } else {
          // 릴레이 서버용 메시지
          this.ws.send(JSON.stringify({
            type: 'user_connect',
            sessionId: this.generateSessionId(),
            did: this.currentUser.did
          }));
        }
        
        // 재연결 인터벌 정리
        if (this.wsReconnectInterval) {
          clearInterval(this.wsReconnectInterval);
          this.wsReconnectInterval = null;
        }
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('WebSocket 메시지 파싱 오류:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket 오류:', error);
      };
      
      this.ws.onclose = () => {
        console.log('🔌 WebSocket 연결 종료');
        
        // 세션이 종료된 경우가 아니면 재연결 시도
        if (this.isAuthenticated && !this.wsReconnectInterval) {
          this.wsReconnectInterval = setInterval(() => {
            console.log('🔄 WebSocket 재연결 시도...');
            this.connectWebSocket();
          }, 5000);
        }
      };
    } catch (error) {
      console.error('WebSocket 연결 실패:', error);
    }
  }
  
  // 세션 ID 생성
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // WebSocket 메시지 처리
  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'user_connected':
        // 릴레이 서버가 풀노드를 할당함
        console.log('✅ 풀노드 할당됨:', data.assignedNode);
        this.assignedNode = data.assignedNode;
        this.sessionId = data.sessionId;
        break;
        
      case 'user_connect_failed':
        // 연결 실패
        console.error('❌ 풀노드 연결 실패:', data.error);
        this.showErrorMessage(data.error);
        break;
        
      case 'node_response':
        // 풀노드로부터의 응답
        this.handleNodeResponse(data.response);
        break;
        
      case 'session_terminated':
        // 다른 기기에서 로그인으로 인한 세션 종료
        console.log('⚠️ 세션 종료:', data.reason);
        this.handleSessionTermination(data.reason);
        break;
        
      case 'state_update':
        // 상태 업데이트
        this.handleStateUpdate(data);
        break;
        
      case 'pool_update':
        // 검증자 풀 업데이트
        this.handlePoolUpdate(data.validatorPool);
        break;
        
      case 'dao_treasury_update':
        // DAO 금고 업데이트
        this.handleDAOTreasuryUpdate(data.daoTreasuries);
        break;
        
      case 'pong':
        // ping-pong 응답
        console.log('🏓 Pong received');
        break;
    }
  }
  
  // 풀노드 응답 처리
  handleNodeResponse(response) {
    // 기존의 state_update와 유사하게 처리
    if (response.type === 'state_update') {
      this.handleStateUpdate(response);
    }
  }
  
  // 세션 종료 처리
  handleSessionTermination(reason) {
    this.showErrorMessage(reason || '다른 기기에서 로그인했습니다.');
    
    // 로그아웃 처리
    this.logout();
    
    // WebSocket 정리
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // 재연결 중지
    if (this.wsReconnectInterval) {
      clearInterval(this.wsReconnectInterval);
      this.wsReconnectInterval = null;
    }
  }
  
  // 상태 업데이트 처리
  handleStateUpdate(data) {
    console.log('📊 상태 업데이트:', data);
    
    // 지갑 정보 업데이트
    if (data.wallet && data.wallet.balances) {
      const walletData = data.wallet;
      
      // B-토큰 잔액 업데이트
        const bTokenAmount = walletData.balances.bToken || 0;
      const pTokenAmount = walletData.balances.pToken || 0;
      
      console.log(`💰 지갑 잔액 업데이트: B-Token ${bTokenAmount}, P-Token ${pTokenAmount}`);
      
        localStorage.setItem('currentBalance', bTokenAmount.toString());
        
        // userTokens 업데이트
        if (!this.userTokens) {
          this.userTokens = { B: 0, P: 0 };
        }
        this.userTokens.B = bTokenAmount;
      this.userTokens.P = pTokenAmount;
      
      // currentUser 잔액도 업데이트
      if (this.currentUser) {
        this.currentUser.bTokenBalance = bTokenAmount;
        this.currentUser.pTokenBalance = pTokenAmount;
        localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
      }
        
        // UI 업데이트
        this.updateTokenBalances();
      
      // 보상 알림 표시
      this.showSuccessMessage(`💰 지갑이 업데이트되었습니다!\nB-Token: ${bTokenAmount}`);
    }
    
    // 새로운 거래 처리
    if (data.newTransaction) {
      const tx = data.newTransaction;
      console.log('💸 새로운 거래 수신:', tx);
      
      // 거래내역에 추가
      this.addTransaction(
        tx.type,
        tx.fromAddress,
        tx.amount,
        tx.memo || '',
        'confirmed',
        tx.fromAddress,
        tx.transactionId
      );
      
      // 받은 거래인 경우 알림 표시
      if (tx.type === 'received') {
        this.showSuccessMessage(
          `${tx.fromAddress}님으로부터 ${tx.amount} ${tx.tokenType}을 받았습니다.`
        );
      }
    }
    
    // 검증자 풀 정보 업데이트
    if (data.validatorPool) {
      this.handlePoolUpdate(data.validatorPool);
    }
    
    // 새로운 기여 내역 처리
    if (data.newContribution) {
      const contribution = data.newContribution;
      console.log('🎉 새로운 기여 내역 수신:', contribution);
      
      // 로컬 스토리지에 기여 내역 저장
      if (this.currentUser && this.currentUser.did) {
        const contributionsKey = `baekya_contributions_${this.currentUser.did}`;
        const existingContributions = JSON.parse(localStorage.getItem(contributionsKey) || '[]');
        
        const contributionRecord = {
          id: `${contribution.type}_${Date.now()}`,
          type: contribution.type,
          title: contribution.title,
          dao: contribution.dao,
          date: contribution.date,
          status: 'verified',
          bTokens: contribution.bTokens,
          description: contribution.description,
          evidence: contribution.evidence || `${contribution.title} 완료`,
          metadata: {
            receivedAt: Date.now()
          }
        };
        
        existingContributions.push(contributionRecord);
        localStorage.setItem(contributionsKey, JSON.stringify(existingContributions));
        
        console.log('✅ 새로운 기여 내역 저장 완료:', contributionRecord);
      }
    }
    
    // DAO 소속 업데이트 처리
    if (data.daoMembership) {
      const membership = data.daoMembership;
      console.log('🏛️ DAO 소속 업데이트 수신:', membership);
      
      if (membership.action === 'join' && membership.dao) {
        // 기존 DAO 목록 가져오기
        const existingDAOs = JSON.parse(localStorage.getItem('userDAOs') || '[]');
        
        // 이미 소속된 DAO인지 확인
        const isAlreadyMember = existingDAOs.some(dao => dao.id === membership.dao.id);
        
        if (!isAlreadyMember) {
          // 새로운 DAO 추가
          existingDAOs.push(membership.dao);
          localStorage.setItem('userDAOs', JSON.stringify(existingDAOs));
          
          console.log('✅ 새로운 DAO 소속 추가:', membership.dao);
          
          // DAO 목록 UI 새로고침
          if (this.currentTab === 'dao') {
            this.loadMyDAOs();
          }
          
          // 성공 알림 표시
          this.showSuccessMessage(`🎉 ${membership.dao.name}에 가입했습니다!`);
        }
      }
    }
  }
  
  // 검증자 풀 업데이트 처리
  handlePoolUpdate(poolData) {
    console.log('💰 검증자 풀 업데이트:', poolData);
    
    // 서버에서 오는 데이터 형식 처리 (balance 또는 totalStake)
    let balance = 0;
    if (poolData) {
      if (poolData.balance !== undefined) {
        balance = poolData.balance;
      } else if (poolData.totalStake !== undefined) {
        balance = poolData.totalStake;
      }
    }
    
    if (balance !== undefined && balance !== null) {
      // localStorage 업데이트
      localStorage.setItem('baekya_validator_pool', balance.toString());
      
      // UI 업데이트
      const validatorPool = document.getElementById('validatorPoolMain');
      if (validatorPool) {
        validatorPool.textContent = `${balance.toFixed(3)} B`;
      }
      
      // 대시보드의 검증자 풀 표시도 업데이트
      const validatorPoolDashboard = document.getElementById('validatorPool');
      if (validatorPoolDashboard) {
        validatorPoolDashboard.textContent = `${balance.toFixed(3)} B`;
      }
      
      console.log(`💰 검증자 풀 UI 업데이트 완료: ${balance.toFixed(3)}B`);
    }
  }
  
  // DAO 금고 업데이트 처리
  handleDAOTreasuryUpdate(daoTreasuries) {
    console.log('💰 DAO 금고 업데이트:', daoTreasuries);
    
    if (daoTreasuries) {
      // localStorage 업데이트
      localStorage.setItem('baekya_dao_treasuries', JSON.stringify(daoTreasuries));
      
      // 각 DAO의 금고 UI 업데이트
      Object.keys(daoTreasuries).forEach(daoId => {
        const treasuryAmount = daoTreasuries[daoId] || 0;
        const treasuryElement = document.querySelector(`[data-dao-treasury="${daoId}"]`);
        if (treasuryElement) {
          treasuryElement.textContent = `${treasuryAmount.toFixed(3)} B`;
        }
      });
      
      // 토큰 잔액 업데이트를 트리거하여 DAO 금고 표시 갱신
      this.updateTokenBalances();
    }
  }
  
  // WebSocket 연결 종료
  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.wsReconnectInterval) {
      clearInterval(this.wsReconnectInterval);
      this.wsReconnectInterval = null;
    }
  }
  
  // 프로토콜 상태 주기적 동기화
  startProtocolStateSync() {
    // 기존 interval이 있으면 정리
    if (this.protocolSyncInterval) {
      clearInterval(this.protocolSyncInterval);
    }
    
    // 즉시 한 번 실행
    this.syncProtocolState();
    
    // 30초마다 동기화
    this.protocolSyncInterval = setInterval(() => {
      this.syncProtocolState();
    }, 30000);
  }
  
  // 프로토콜 상태 동기화
  async syncProtocolState() {
    if (!this.isAuthenticated) return;
    
    try {
      const response = await fetch(`${this.apiBase}/protocol-state`);
      if (response.ok) {
        const state = await response.json();
        
        if (state.success) {
          // 검증자 풀 업데이트
          if (state.validatorPool !== undefined) {
            localStorage.setItem('baekya_validator_pool', state.validatorPool.toString());
            this.handlePoolUpdate({ balance: state.validatorPool });
          }
          
          // DAO 금고 업데이트
          if (state.daoTreasuries) {
            localStorage.setItem('baekya_dao_treasuries', JSON.stringify(state.daoTreasuries));
            
            // UI 업데이트 (각 DAO 금고 표시)
            Object.keys(state.daoTreasuries).forEach(daoId => {
              const treasuryAmount = state.daoTreasuries[daoId] || 0;
              const treasuryElement = document.querySelector(`[data-dao-treasury="${daoId}"]`);
              if (treasuryElement) {
                treasuryElement.textContent = `${treasuryAmount.toFixed(6)} B`;
              }
            });
          }
          
          console.log('🔄 프로토콜 상태 동기화 완료');
        }
      }
    } catch (error) {
      console.error('프로토콜 상태 동기화 실패:', error);
    }
  }

  // Capacitor 환경 감지
  detectCapacitorEnvironment() {
    // Capacitor 환경인지 확인
    if (window.Capacitor) {
      document.body.classList.add('capacitor');
      console.log('📱 Capacitor 모바일 앱 환경 감지됨');
      
      // 웹 전용 요소들 숨기기
      this.hideWebOnlyElements();
    } else {
      document.body.classList.add('web-browser');
      console.log('🌐 웹 브라우저 환경 감지됨');
    }
  }

  // 웹 전용 요소들 숨기기
  hideWebOnlyElements() {
    const webOnlyElements = document.querySelectorAll('.web-only');
    webOnlyElements.forEach(element => {
      element.style.display = 'none';
    });
  }

  // 채팅 화면 초기 상태 리셋
  resetChatScreens() {
    const chatScreen = document.getElementById('chatScreen');
    if (chatScreen) {
      chatScreen.classList.remove('active');
    }
    
    // 현재 채팅 정보 초기화
    this.currentChatContact = null;
    this.currentChatId = null;
    
    console.log('🔄 채팅 화면 상태가 리셋되었습니다.');
  }

  setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        
        // 활성 탭 변경 - 즉시 처리
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        this.currentTab = tabId;
        
        // 모바일 헤더 전환
        this.switchMobileHeader(tabId);
        
        // 탭 콘텐츠 로드를 백그라운드에서 처리
        setTimeout(() => this.loadTabContent(tabId), 0);
        
        // 지갑 탭 진입 시 처리
        if (tabId === 'wallet') {
          setTimeout(() => {
            this.loadTransactionHistory();
            // 지갑 탭 진입 시 모든 받은 거래를 읽음 처리
            this.markAllReceivedTransactionsAsRead();
          }, 100);
        }
      });
    });
    
    // 초기 로드 시 헤더 설정
    this.switchMobileHeader('dashboard');
  }

  // 헤더 전환 함수 (PC/모바일 공통)
  switchMobileHeader(tabId) {
    // PC와 모바일 모두에서 실행
    
    const mobileHeaderTabs = document.querySelectorAll('.mobile-header-tab');
    
    // 모든 헤더 탭 숨기기
    mobileHeaderTabs.forEach(tab => tab.classList.remove('active'));
    
    // 해당 탭의 헤더 표시
    const targetHeader = document.getElementById(`mobile-header-${tabId}`);
    if (targetHeader) {
      targetHeader.classList.add('active');
    }
    
    // 각 탭별 헤더 데이터 업데이트
    this.updateMobileHeaderData(tabId);
  }

  // 모바일 헤더 데이터 업데이트
  updateMobileHeaderData(tabId) {
    switch(tabId) {
      case 'dashboard':
        this.updateMobileProfileHeader();
        break;
      case 'wallet':
        // 지갑 헤더는 정적이므로 업데이트 불필요
        break;
      case 'dao':
        // DAO 헤더는 정적이므로 업데이트 불필요
        break;

      case 'p2p':
        this.updateMobileP2PHeader('contacts'); // 기본값으로 연락처 설정
        break;
    }
  }

  // 모바일 프로필 헤더 업데이트
  updateMobileProfileHeader() {
    const avatar = document.getElementById('mobile-profile-avatar');
    const name = document.getElementById('mobile-profile-name');
    const status = document.getElementById('mobile-verification-status');
    
    if (this.currentUser) {
      // 아바타 업데이트 (이름 첫 글자 또는 기본값)
      if (avatar) {
        const userName = this.currentUser.name || '미설정';
        avatar.textContent = userName !== '미설정' ? userName.charAt(0).toUpperCase() : 'U';
      }
      
      // 이름 업데이트
      if (name) {
        name.textContent = this.currentUser.name || '미설정';
      }
      
      // 인증 상태 업데이트
      if (status) {
        if (this.currentUser.did) {
          status.textContent = '인증 완료';
          status.className = 'mobile-verification-badge verified';
        } else {
          status.textContent = '인증 대기';
          status.className = 'mobile-verification-badge pending';
        }
      }
    } else {
      // 로그인되지 않은 상태
      if (avatar) avatar.textContent = 'U';
      if (name) name.textContent = '미설정';
      if (status) {
        status.textContent = '인증 대기';
        status.className = 'mobile-verification-badge pending';
      }
    }
  }

  setupScrollEffect() {
    let ticking = false;
    
    const updateHeader = () => {
      const header = document.querySelector('.header');
      if (!header) return;
      
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      if (scrollTop > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      
      ticking = false;
    };
    
    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    };
    
    // 초기 상태 설정
    updateHeader();
    
    window.addEventListener('scroll', requestTick, { passive: true });
  }

  async loadTabContent(tabId) {
    // 캐시된 데이터 사용으로 빠른 로딩
    switch(tabId) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'wallet':
        this.loadWallet();
        break;
      case 'dao':
        this.loadDAOs();
        break;

      case 'p2p':
        this.loadP2P();
        break;
    }
  }

  async loadProtocolStatus() {
    // 캐시 확인
    const now = Date.now();
    if (this.dataCache.protocolStatus && this.dataCache.lastUpdate && 
        (now - this.dataCache.lastUpdate) < 30000) { // 30초 캐시
      this.protocol = this.dataCache.protocolStatus;
      this.updateNetworkStatus(this.protocol);
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/status`);
      const status = await response.json();
      
      this.protocol = status;
      this.dataCache.protocolStatus = status;
      this.dataCache.lastUpdate = now;
      this.updateNetworkStatus(status);
      
      console.log('📊 프로토콜 상태 로드됨:', status);
    } catch (error) {
      console.error('❌ 프로토콜 상태 로드 실패:', error);
      // 시뮬레이션 데이터 사용
      this.protocol = {
        network: { totalDAOs: 3, totalMembers: 175, totalPTokenSupply: 4200 },
        mining: { totalMiners: 89 }
      };
      this.dataCache.protocolStatus = this.protocol;
      this.updateNetworkStatus(this.protocol);
    }
  }

  updateNetworkStatus(status) {
    // 네트워크 현황 요소들
    const totalDAOs = document.getElementById('totalDAOs');
    const totalMembers = document.getElementById('totalMembers');
    const validatorPool = document.getElementById('validatorPool');
    const validatorPoolMain = document.getElementById('validatorPoolMain');
    const totalMiners = document.getElementById('totalMiners');

    if (this.isAuthenticated) {
      // 로그인된 경우 실제 데이터 표시 (현재는 모두 0으로 시작)
      if (totalDAOs) totalDAOs.textContent = '0';
      if (totalMembers) totalMembers.textContent = '0';
      if (validatorPool) validatorPool.textContent = '0 B';
      if (validatorPoolMain) validatorPoolMain.textContent = '0 B';
      if (totalMiners) totalMiners.textContent = '0';
    } else {
      // 로그인하지 않은 경우 "-" 표시
      if (totalDAOs) totalDAOs.textContent = '-';
      if (totalMembers) totalMembers.textContent = '-';
      if (validatorPool) validatorPool.textContent = '- B';
      if (validatorPoolMain) validatorPoolMain.textContent = '- B';
      if (totalMiners) totalMiners.textContent = '-';
    }
  }

  checkStoredAuth() {
    const storedAuth = localStorage.getItem('baekya_auth');
    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth);
        
        // 기본 정보 검증 (name과 birthDate가 없으면 불완전한 데이터)
        if (!authData.name && !authData.username) {
          console.error('❌ 불완전한 사용자 데이터 발견, 재등록이 필요합니다.');
          localStorage.removeItem('baekya_auth');
          this.showWelcomeScreen();
          return;
        }
        
        // 사용자 데이터 설정
        this.currentUser = authData;
        
        // name이 없지만 username이 있는 경우 (기존 사용자 호환성)
        if (!this.currentUser.name && this.currentUser.username) {
          this.currentUser.name = this.currentUser.username;
        }
        
        // birthDate가 없는 경우 기본값 설정 (기존 사용자 호환성)
        if (!this.currentUser.birthDate) {
          this.currentUser.birthDate = '1990-01-01';
        }
        
        this.userCommunicationAddress = this.currentUser.communicationAddress;
        this.isAuthenticated = true;
        
        console.log('✅ 저장된 인증 정보 로드 성공:', this.currentUser.name || this.currentUser.username);
        
        // UI 업데이트
        this.updateUserInterface();
        
        // WebSocket 연결 시작
        this.connectWebSocket();
        
        // 프로토콜 상태 주기적 동기화 (30초마다)
        this.startProtocolStateSync();
        
        // 프로필 사진 UI 업데이트
        if (typeof this.updateProfilePhotoInUI === 'function') {
          setTimeout(() => {
            this.updateProfilePhotoInUI();
          }, 100);
        }
        
        // 로그인 유지를 위해 데이터 재저장
        localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
        
      } catch (error) {
        console.error('❌ 저장된 인증 정보 로드 실패:', error);
        localStorage.removeItem('baekya_auth');
        this.showWelcomeScreen();
      }
    } else {
      // 저장된 인증 정보가 없으면 생체인증 등록 필요
      this.showWelcomeScreen();
    }
  }
  
  // 환영 화면 표시 (실제 첫 시작) - 팝업 제거
  showWelcomeScreen() {
    console.log('🌅 백야 프로토콜에 오신 것을 환영합니다!');
    console.log('👤 첫 번째 사용자가 되어 모든 DAO의 이니셜 OP가 될 수 있습니다!');
    // 생체인증 등록을 위해 지갑 탭으로 이동하고 인증되지 않은 상태로 설정
    this.isAuthenticated = false;
    this.updateUserInterface();
    
    // 환영 팝업 제거됨 - 바로 지갑 탭으로 이동
  }

  // 아이디 인증 관련 메서드
  async startUserAuth() {
    console.log('🔐 아이디 인증 시작...');
    
    const modal = document.getElementById('biometricModal');
    
    // 기존 모달 내용 초기화
    this.resetBiometricModal();
    
    modal.classList.add('active');
    
    try {
      // 로그인/회원가입 선택 화면 표시
      const authMode = await this.showAuthModeSelection();
      
      if (authMode === 'login') {
        // 로그인 모드
        await this.showLoginForm();
      } else if (authMode === 'register') {
        // 회원가입 모드
      // 기기 체크 - 이미 등록된 기기인지 확인
      const deviceCheck = await this.checkDeviceRegistration();
      
      // 탈퇴 후 제한 확인
      if (deviceCheck.isRestricted) {
        this.showErrorMessage(deviceCheck.restrictionMessage);
        this.closeBiometricModal();
        return;
      }
      
      if (deviceCheck.hasAccount && !deviceCheck.isLoggedIn) {
        // 이미 계정이 있는 기기 - 로그인 필요
          this.showErrorMessage('이 기기에는 이미 계정이 있습니다. 로그인해주세요.');
          this.closeBiometricModal();
          return;
      } else if (deviceCheck.hasAccount && deviceCheck.isLoggedIn) {
        // 이미 로그인된 상태
        this.closeBiometricModal();
        this.showErrorMessage('이미 로그인되어 있습니다.');
        return;
      } else {
        // 신규 기기 - 아이디 생성
        await this.createNewUser();
        }
      }
    } catch (error) {
      console.error('❌ 아이디 인증 프로세스 오류:', error);
      this.closeBiometricModal();
      this.showErrorMessage('아이디 인증 프로세스가 중단되었습니다. 다시 시도해주세요.');
    }
  }

  // 생체인증 모달 초기화
  resetBiometricModal() {
    const modalBody = document.querySelector('#biometricModal .modal-body');
    
    // 동적으로 추가된 모든 요소 제거
    const dynamicElements = modalBody.querySelectorAll('.password-setup, .invite-code-setup, .personal-info-setup, .user-id-setup, .auth-mode-selection');
    dynamicElements.forEach(element => element.remove());
    
    // 모든 step 초기화
    const steps = document.querySelectorAll('.step');
    steps.forEach(step => step.classList.remove('active'));
    
    // 첫 번째 step 활성화
    const stepFingerprint = document.getElementById('stepFingerprint');
    if (stepFingerprint) stepFingerprint.classList.add('active');
    
    // 진행 메시지 초기화
    const progressMessage = document.getElementById('progressMessage');
    if (progressMessage) progressMessage.textContent = '아이디 인증을 시작합니다...';
  }

  // 로그인/회원가입 선택 화면
  async showAuthModeSelection() {
    return new Promise((resolve) => {
      const progressMessage = document.getElementById('progressMessage');
      const modalBody = document.querySelector('#biometricModal .modal-body');
      
      progressMessage.textContent = '백야 프로토콜에 오신 것을 환영합니다!';
      
      // 선택 UI 추가
      const authSelection = document.createElement('div');
      authSelection.className = 'auth-mode-selection';
      authSelection.innerHTML = `
        <div class="auth-selection-form" style="color: var(--text-primary); background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px;">
          <h4 style="color: var(--text-primary); text-align: center; margin-bottom: 1.5rem;">
            <i class="fas fa-shield-alt"></i> 시작하기
          </h4>
          
          <div class="auth-mode-buttons" style="display: flex; flex-direction: column; gap: 1rem;">
            <button class="btn-primary" id="selectLoginBtn" style="padding: 1rem;">
              <i class="fas fa-sign-in-alt"></i> 로그인
              <small style="display: block; font-weight: normal; opacity: 0.8;">기존 계정으로 로그인</small>
            </button>
            
            <button class="btn-secondary" id="selectRegisterBtn" style="padding: 1rem;">
              <i class="fas fa-user-plus"></i> 회원가입
              <small style="display: block; font-weight: normal; opacity: 0.8;">새 계정 만들기</small>
            </button>
          </div>
          
          <div style="text-align: center; margin-top: 1.5rem; color: var(--text-secondary); font-size: 0.9rem;">
            <i class="fas fa-info-circle"></i> 1기기 1계정 정책이 적용됩니다
          </div>
        </div>
      `;
      
      modalBody.appendChild(authSelection);
      
      const loginBtn = document.getElementById('selectLoginBtn');
      const registerBtn = document.getElementById('selectRegisterBtn');
      
      loginBtn.addEventListener('click', () => {
        authSelection.remove();
        resolve('login');
      });
      
      registerBtn.addEventListener('click', () => {
        authSelection.remove();
        resolve('register');
      });
    });
  }

  // 로그인 폼 표시
  async showLoginForm() {
    return new Promise((resolve) => {
      const progressMessage = document.getElementById('progressMessage');
      const modalBody = document.querySelector('#biometricModal .modal-body');
      
      progressMessage.textContent = '로그인 정보를 입력해주세요...';
      
      // 로그인 UI 추가
      const loginSetup = document.createElement('div');
      loginSetup.className = 'password-setup';
      loginSetup.innerHTML = `
        <div class="password-form" style="color: var(--text-primary); background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px;">
          <h4 style="color: var(--text-primary);"><i class="fas fa-sign-in-alt"></i> 로그인</h4>
          
          <div class="form-group">
            <label for="loginUserId" style="color: var(--text-primary);">아이디</label>
            <input type="text" id="loginUserId" placeholder="아이디를 입력하세요" style="background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; font-size: 1rem;">
          </div>
          
          <div class="form-group">
            <label for="loginPassword" style="color: var(--text-primary);">비밀번호</label>
            <input type="password" id="loginPassword" placeholder="비밀번호를 입력하세요" style="background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; font-size: 1rem;">
          </div>
          
          <button class="btn-primary" id="loginBtn">로그인</button>
        </div>
      `;
      
      modalBody.appendChild(loginSetup);
      
      const loginBtn = document.getElementById('loginBtn');
      const userIdInput = document.getElementById('loginUserId');
      const passwordInput = document.getElementById('loginPassword');
      
      // 엔터키 이벤트
      [userIdInput, passwordInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            loginBtn.click();
          }
        });
      });
      
      loginBtn.addEventListener('click', async () => {
        const userId = userIdInput.value.trim();
        const password = passwordInput.value;
        
        if (!userId) {
          alert('아이디를 입력해주세요.');
          return;
        }
        
        if (!password) {
          alert('비밀번호를 입력해주세요.');
          return;
        }
        
        try {
          // 서버 API로 로그인 요청
          const response = await fetch(`${this.apiBase}/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              username: userId,
              password: password
            })
          });

          const result = await response.json();
          
          if (result.success) {
            console.log('🔐 서버 로그인 성공:', result);
            
            // 사용자 데이터 설정
            this.currentUser = {
              userId: result.username,
              username: result.username,
              did: result.didHash,
              communicationAddress: result.communicationAddress,
              name: result.name,
              isFounder: result.isFounder,
              bTokenBalance: parseFloat(localStorage.getItem('currentBalance') || '0'),
              pTokenBalance: result.isFounder ? 120 : 0,
              passwordHash: this.hashPassword(password),
              deviceId: this.getDeviceId(),
              createdAt: Date.now()
            };
            
            this.isAuthenticated = true;
            
            // authData도 업데이트
            this.authData = {
              userId: result.username,
              password: this.hashPassword(password),
              did: result.didHash,
              communicationAddress: result.communicationAddress,
              deviceId: this.getDeviceId(),
              createdAt: Date.now(),
              hasSetCommunicationAddress: !!result.communicationAddress
            };
            
            // 로컬 스토리지에 저장
            localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
            
            // baekya_users에도 추가
            const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
            const deviceId = this.getDeviceId();
            const userIndex = storedUsers.findIndex(user => user.deviceId === deviceId);
            
            if (userIndex === -1) {
              storedUsers.push(this.currentUser);
              localStorage.setItem('baekya_users', JSON.stringify(storedUsers));
            }
            
            // founder 계정인 경우 DAO 정보 가져오기
            if (result.isFounder) {
              try {
                const dashboardResponse = await fetch(`${this.apiBase}/dashboard/${result.didHash}`);
                if (dashboardResponse.ok) {
                  const dashboard = await dashboardResponse.json();
                  if (dashboard.daos && dashboard.daos.length > 0) {
                    // DAO 정보를 localStorage에 저장
                    const founderDAOMapping = {};
                    const userDAOs = dashboard.daos.map(dao => {
                      // 짧은 ID 생성
                      let shortId = 'ops-dao';
                      if (dao.name.includes('Operations')) shortId = 'ops-dao';
                      else if (dao.name.includes('Development')) shortId = 'dev-dao';
                      else if (dao.name.includes('Community')) shortId = 'community-dao';
                      else if (dao.name.includes('Political')) shortId = 'political-dao';
                      
                      // UUID 매핑 저장
                      founderDAOMapping[shortId] = dao.id;
                      
                      return {
                        id: shortId,
                        uuid: dao.id, // UUID도 저장
                        name: dao.name,
                        icon: dao.name.includes('Operations') ? 'fa-cogs' :
                              dao.name.includes('Development') ? 'fa-code' :
                              dao.name.includes('Community') ? 'fa-users' :
                              dao.name.includes('Political') ? 'fa-landmark' : 'fa-building',
                        role: dao.role,
                        joinedAt: dao.joinedAt || Date.now()
                      };
                    });
                    localStorage.setItem('userDAOs', JSON.stringify(userDAOs));
                    localStorage.setItem('baekya_founder_dao_uuids', JSON.stringify(founderDAOMapping));
                    console.log('🏛️ Founder DAO 정보 로드:', userDAOs);
                    console.log('🗺️ DAO UUID 매핑:', founderDAOMapping);
                  }
                }
              } catch (error) {
                console.error('DAO 정보 로드 실패:', error);
              }
            }
            
            // UI 정리
            loginSetup.remove();
            
            const stepComplete = document.getElementById('stepComplete');
            stepComplete.classList.add('active');
            progressMessage.textContent = '로그인 성공!';
            
            this.completeBiometricAuth();
            
            // 로그인 후 즉시 프로토콜 상태 동기화
            setTimeout(() => {
              this.syncProtocolState();
              this.updateTokenBalances();
            }, 100);
            
            resolve();
            
          } else {
            throw new Error(result.error || '로그인에 실패했습니다');
          }
          
        } catch (error) {
          console.error('❌ 로그인 실패:', error);
          alert(error.message || '로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.');
          passwordInput.value = '';
          passwordInput.focus();
        }
      });
    });
  }

  // 기기 등록 확인
  async checkDeviceRegistration() {
    const deviceId = this.getDeviceId();
    
    // 탈퇴 제한 없음 - 바로 계정 생성 가능
    
    // 로컬 스토리지에서 기기별 계정 정보 확인
    const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
    const deviceUser = storedUsers.find(user => user.deviceId === deviceId);
    
    // 현재 로그인 상태 확인
    const currentAuth = localStorage.getItem('baekya_auth');
    const isLoggedIn = !!currentAuth;
    
    return {
      hasAccount: !!deviceUser,
      isLoggedIn: isLoggedIn,
      userData: deviceUser || null,
      isRestricted: false
    };
  }

  // 기존 사용자 로그인
  async loginExistingUser(userData) {
    return new Promise((resolve) => {
      const progressMessage = document.getElementById('progressMessage');
      const modalBody = document.querySelector('#biometricModal .modal-body');
      
      progressMessage.textContent = '로그인 정보를 입력해주세요...';
      
      // 로그인 UI 추가
      const loginSetup = document.createElement('div');
      loginSetup.className = 'password-setup';
      loginSetup.innerHTML = `
        <div class="password-form" style="color: var(--text-primary); background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px;">
          <h4 style="color: var(--text-primary);"><i class="fas fa-sign-in-alt"></i> 로그인</h4>
          <p style="color: var(--text-secondary);">안녕하세요, <strong>${userData.name}</strong>님!</p>
          
          <div class="form-group">
            <label for="loginUserId" style="color: var(--text-primary);">아이디</label>
            <input type="text" id="loginUserId" value="${userData.userId}" readonly style="background: var(--bg-disabled); color: var(--text-secondary); border: 1px solid var(--border-color); padding: 0.75rem; font-size: 1rem;">
          </div>
          
          <div class="form-group">
            <label for="loginPassword" style="color: var(--text-primary);">비밀번호</label>
            <input type="password" id="loginPassword" placeholder="비밀번호를 입력하세요" style="background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; font-size: 1rem;">
          </div>
          
          <button class="btn-primary" id="loginBtn">로그인</button>
        </div>
      `;
      
      modalBody.appendChild(loginSetup);
      
      const loginBtn = document.getElementById('loginBtn');
      const passwordInput = document.getElementById('loginPassword');
      
      // 엔터키 이벤트
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          loginBtn.click();
        }
      });
      
      loginBtn.addEventListener('click', async () => {
        const password = passwordInput.value;
        
        if (!password) {
          alert('비밀번호를 입력해주세요.');
          return;
        }
        
        try {
          // 서버 API로 로그인 요청
          const response = await fetch(`${this.apiBase}/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Device-Id': this.getDeviceId()
            },
            body: JSON.stringify({
              username: userData.userId || userData.username,
              password: password,
              deviceId: this.getDeviceId()
            })
          });

          const result = await response.json();
          
          if (result.success) {
            console.log('🔐 서버 로그인 성공:', result);
            
            // 다른 기기에서 로그아웃되었다면 알림
            if (result.otherSessionsTerminated) {
              console.log('⚠️ 다른 기기에서 로그아웃됨:', result.terminatedDevices);
            }
            
            // 서버에서 받은 정보로 사용자 데이터 업데이트
            this.currentUser = {
              ...userData,
              did: result.didHash,
              username: result.username,
              name: result.name,
              communicationAddress: result.communicationAddress,
              isFounder: result.isFounder,
              bTokenBalance: result.tokenBalances?.bToken || 0,
              pTokenBalance: result.tokenBalances?.pToken || 0,
              passwordHash: this.hashPassword(password)
            };
            
            // 서버에서 받은 실제 잔액으로 localStorage 업데이트
            if (result.tokenBalances) {
              localStorage.setItem('currentBalance', result.tokenBalances.bToken.toString());
              
              // userTokens 객체도 업데이트
              this.userTokens = {
                B: result.tokenBalances.bToken,
                P: result.tokenBalances.pToken
              };
            }
            
            // 프로토콜 상태 업데이트 (검증자 풀, DAO 금고)
            if (result.protocolState) {
              // 검증자 풀 상태 업데이트
              if (result.protocolState.validatorPool !== undefined) {
                localStorage.setItem('baekya_validator_pool', result.protocolState.validatorPool.toString());
                console.log('🏦 검증자 풀 동기화:', result.protocolState.validatorPool);
              }
              
              // DAO 금고 상태 업데이트
              if (result.protocolState.daoTreasuries) {
                localStorage.setItem('baekya_dao_treasuries', JSON.stringify(result.protocolState.daoTreasuries));
                console.log('💰 DAO 금고 동기화:', result.protocolState.daoTreasuries);
              }
            }
            
            this.isAuthenticated = true;
            
            // authData도 업데이트
            this.authData = {
              userId: result.username,
              password: this.hashPassword(password),
              did: result.didHash,
              communicationAddress: result.communicationAddress,
              deviceId: userData.deviceId || this.getDeviceId(),
              createdAt: userData.createdAt || Date.now(),
              hasSetCommunicationAddress: !!result.communicationAddress
            };
            
            // 로컬 스토리지에 저장
            localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
            
            // baekya_users에도 업데이트
            const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
            const deviceId = this.getDeviceId();
            const userIndex = storedUsers.findIndex(user => user.deviceId === deviceId);
            
            if (userIndex !== -1) {
              storedUsers[userIndex] = {...storedUsers[userIndex], ...this.currentUser};
              localStorage.setItem('baekya_users', JSON.stringify(storedUsers));
            }
            
            // UI 정리
            loginSetup.remove();
            
            const stepComplete = document.getElementById('stepComplete');
            stepComplete.classList.add('active');
            progressMessage.textContent = '로그인 성공!';
            
            this.completeBiometricAuth();
            
            // 로그인 후 즉시 프로토콜 상태 동기화
            setTimeout(() => {
              this.syncProtocolState();
              this.updateTokenBalances();
            }, 100);
            
            resolve();
            
          } else {
            throw new Error(result.error || '로그인에 실패했습니다');
          }
          
        } catch (error) {
          console.error('❌ 서버 로그인 실패, 로컬 검증 시도:', error);
          
          // 서버 연결 실패 시 로컬 비밀번호 검증
        const isPasswordCorrect = this.verifyPassword(password, userData);
        
        if (isPasswordCorrect) {
            // 로컬 로그인 성공
          this.currentUser = userData;
          this.isAuthenticated = true;
          
          // passwordHash가 없는 경우 생성하여 저장
          if (!this.currentUser.passwordHash) {
            this.currentUser.passwordHash = this.hashPassword(password);
          }
          
          // authData도 업데이트
          this.authData = {
            userId: userData.userId,
            password: this.hashPassword(password),
            did: userData.did,
            communicationAddress: userData.communicationAddress,
            deviceId: userData.deviceId || this.getDeviceId(),
            createdAt: userData.createdAt || Date.now(),
            hasSetCommunicationAddress: userData.hasSetCommunicationAddress || false
          };
          
          // 로컬 스토리지에 저장
          localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
          
          // baekya_users에도 업데이트
          const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
          const deviceId = this.getDeviceId();
          const userIndex = storedUsers.findIndex(user => user.deviceId === deviceId);
          
          if (userIndex !== -1) {
            storedUsers[userIndex] = {...storedUsers[userIndex], ...this.currentUser};
            localStorage.setItem('baekya_users', JSON.stringify(storedUsers));
          }
          
          // UI 정리
          loginSetup.remove();
          
          const stepComplete = document.getElementById('stepComplete');
          stepComplete.classList.add('active');
          progressMessage.textContent = '로그인 성공!';
          
          this.completeBiometricAuth();
          resolve();
        } else {
          alert('비밀번호가 일치하지 않습니다.');
          passwordInput.value = '';
          passwordInput.focus();
          }
        }
      });
    });
  }

  // 신규 사용자 생성
  async createNewUser() {
    try {
    // 아이디 입력
    await this.enterUserId();
    
    // 비밀번호 설정
    await this.setupNewPassword();
    
    // 초대코드 입력 (선택사항)
    await this.enterInviteCode();
    
    // 개인정보 입력
    await this.enterPersonalInfo();
    
    // DID 생성
    await this.generateDID();
    
    // 신규 사용자 데이터 저장
    this.saveNewUserData();
    
    // 완료 처리
    this.completeBiometricAuth();
    } catch (error) {
      console.error('❌ 신규 사용자 생성 실패:', error);
      
      // 진행 상태 초기화
      const progressMessage = document.getElementById('progressMessage');
      const modalBody = document.querySelector('#biometricModal .modal-body');
      
      // 기존 UI 요소들 제거
      const existingForms = modalBody.querySelectorAll('.user-id-setup, .password-setup, .invite-code-setup, .personal-info-setup');
      existingForms.forEach(form => form.remove());
      
      // 에러 메시지 표시
      progressMessage.textContent = '계정 생성에 실패했습니다.';
      progressMessage.style.color = 'var(--error, #ef4444)';
      
      // 사용자에게 알림
      if (error.message.includes('이미 사용 중인 아이디')) {
        alert('이미 사용 중인 아이디입니다. 다른 아이디를 선택해주세요.');
      } else {
        alert(`계정 생성 중 오류가 발생했습니다: ${error.message}`);
      }
      
      // 2초 후 모달 닫기
      setTimeout(() => {
        this.closeBiometricModal();
      }, 2000);
    }
  }

  // 아이디 입력
  async enterUserId() {
    return new Promise((resolve) => {
      const progressMessage = document.getElementById('progressMessage');
      const modalBody = document.querySelector('#biometricModal .modal-body');
      
      progressMessage.textContent = '사용할 아이디를 입력해주세요...';
      
      // 아이디 입력 UI 추가
      const userIdSetup = document.createElement('div');
      userIdSetup.className = 'user-id-setup';
      userIdSetup.innerHTML = `
        <div class="user-id-form" style="color: var(--text-primary); background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px;">
          <h4 style="color: var(--text-primary);"><i class="fas fa-user"></i> 아이디 생성</h4>
          <p style="color: var(--text-secondary);">백야 프로토콜에서 사용할 고유한 아이디를 만들어주세요.</p>
          
          <div class="form-group">
            <label for="newUserId" style="color: var(--text-primary);">아이디 (4-20자, 영문/숫자)</label>
            <input type="text" id="newUserId" placeholder="아이디를 입력하세요" maxlength="20" pattern="[a-zA-Z0-9]+" style="background: #ffffff !important; color: #000000 !important; border: 2px solid #3b82f6 !important; padding: 0.75rem; font-size: 1rem; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
            <small id="userIdHelp" style="color: var(--text-secondary); display: block; margin-top: 0.5rem;">• 영문, 숫자만 사용 가능<br>• 최소 4자, 최대 20자</small>
          </div>
          
          <button class="btn-primary" id="checkUserIdBtn">중복 확인 및 계속</button>
        </div>
      `;
      
      modalBody.appendChild(userIdSetup);
      
      const checkBtn = document.getElementById('checkUserIdBtn');
      const userIdInput = document.getElementById('newUserId');
      const helpText = document.getElementById('userIdHelp');
      
      // 실시간 유효성 검사
      userIdInput.addEventListener('input', () => {
        const userId = userIdInput.value;
        const isValid = /^[a-zA-Z0-9]+$/.test(userId);
        
        if (userId.length < 4) {
          helpText.innerHTML = '• <span style="color: var(--error);">최소 4자 이상 입력해주세요</span>';
        } else if (!isValid) {
          helpText.innerHTML = '• <span style="color: var(--error);">영문과 숫자만 사용 가능합니다</span>';
        } else {
          helpText.innerHTML = '• 영문, 숫자만 사용 가능<br>• 최소 4자, 최대 20자';
        }
      });
      
      checkBtn.addEventListener('click', async () => {
        const userId = userIdInput.value.trim();
        
        if (userId.length < 4) {
          alert('아이디는 최소 4자 이상이어야 합니다.');
          return;
        }
        
        if (!/^[a-zA-Z0-9]+$/.test(userId)) {
          alert('아이디는 영문과 숫자만 사용할 수 있습니다.');
          return;
        }
        
        // 중복 확인
        const isDuplicate = await this.checkUserIdDuplicate(userId);
        
        if (isDuplicate) {
          alert('이미 사용 중인 아이디입니다. 다른 아이디를 선택해주세요.');
          userIdInput.focus();
          return;
        }
        
        // 아이디 저장
        this.authData.userId = userId;
        
        // UI 정리
        userIdSetup.remove();
        progressMessage.textContent = '비밀번호를 설정해주세요...';
        
        resolve();
      });
    });
  }

  // 아이디 중복 확인
  async checkUserIdDuplicate(userId) {
    try {
      console.log(`🔍 아이디 중복 확인 시작: ${userId}`);
      
      // 서버 API 호출
      const response = await fetch(`${this.apiBase}/check-userid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
      const result = await response.json();
        console.log('서버 중복 확인 결과:', result);
        
        if (result.reason === 'reserved') {
          console.log(`❌ 예약된 아이디: ${userId}`);
          return true;
        }
        
      return result.isDuplicate;
      }
      
      throw new Error('서버 API 응답 오류');
      
    } catch (error) {
      console.log('서버 API 호출 실패, 로컬 시뮬레이션 사용:', error.message);
      
      // 로컬 시뮬레이션
      const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
      const currentAuth = localStorage.getItem('baekya_auth');
      
      console.log('저장된 사용자 수:', storedUsers.length);
      console.log('현재 로그인된 사용자:', currentAuth ? 'true' : 'false');
      
      // baekya_users에서 중복 확인
      const isDuplicateInUsers = storedUsers.some(user => {
        const match = user.userId === userId || user.username === userId;
        if (match) {
          console.log(`❌ 로컬 저장소에서 중복 발견: ${user.userId || user.username}`);
        }
        return match;
      });
      
      // 현재 로그인된 사용자 확인
      let isDuplicateInAuth = false;
      if (currentAuth) {
        const authData = JSON.parse(currentAuth);
        isDuplicateInAuth = authData.userId === userId || authData.username === userId;
        if (isDuplicateInAuth) {
          console.log(`❌ 현재 로그인된 사용자와 중복: ${authData.userId || authData.username}`);
        }
      }
      
      // 예약된 아이디 확인
      const reservedIds = ['founder', 'admin', 'system', 'operator', 'op'];
      const isReserved = reservedIds.includes(userId.toLowerCase());
      if (isReserved) {
        console.log(`❌ 예약된 아이디: ${userId}`);
      }
      
      const finalResult = isDuplicateInUsers || isDuplicateInAuth || isReserved;
      console.log(`최종 중복 확인 결과: ${finalResult ? '중복' : '사용가능'}`);
      
      return finalResult;
    }
  }

  // 새 비밀번호 설정
  async setupNewPassword() {
    return new Promise((resolve) => {
      const progressMessage = document.getElementById('progressMessage');
      const modalBody = document.querySelector('#biometricModal .modal-body');
      
      // 비밀번호 설정 UI 추가
      const passwordSetup = document.createElement('div');
      passwordSetup.className = 'password-setup';
      passwordSetup.innerHTML = `
        <div class="password-form" style="color: var(--text-primary); background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px;">
          <h4 style="color: var(--text-primary);"><i class="fas fa-lock"></i> 비밀번호 설정</h4>
          <p style="color: var(--text-secondary);">계정 보안을 위한 비밀번호를 설정하세요.</p>
          
          <div class="form-group">
            <label for="newPassword" style="color: var(--text-primary);">비밀번호 (최소 8자)</label>
            <input type="password" id="newPassword" placeholder="비밀번호를 입력하세요" minlength="8" style="background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; font-size: 1rem;">
          </div>
          
          <div class="form-group">
            <label for="confirmPassword" style="color: var(--text-primary);">비밀번호 확인</label>
            <input type="password" id="confirmPassword" placeholder="비밀번호를 다시 입력하세요" style="background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; font-size: 1rem;">
          </div>
          
          <div class="password-requirements">
            <small style="color: var(--text-secondary);">
              • 최소 8자 이상<br>
              • <strong style="color: var(--warning-color);">영어 대문자 1개 이상 필수</strong><br>
              • <strong style="color: var(--warning-color);">특수문자 (!@#$%^&*) 1개 이상 필수</strong><br>
              • 영문 소문자, 숫자 포함 권장
            </small>
          </div>
          
          <button class="btn-primary" id="setPasswordBtn">비밀번호 설정</button>
        </div>
      `;
      
      modalBody.appendChild(passwordSetup);
      
      const setPasswordBtn = document.getElementById('setPasswordBtn');
      const newPassword = document.getElementById('newPassword');
      const confirmPassword = document.getElementById('confirmPassword');
      
      setPasswordBtn.addEventListener('click', () => {
        const password = newPassword.value;
        const confirm = confirmPassword.value;
        
        if (password.length < 8) {
          alert('비밀번호는 최소 8자 이상이어야 합니다.');
          return;
        }
        
        // 대문자 확인
        if (!/[A-Z]/.test(password)) {
          alert('비밀번호에 영어 대문자가 최소 1개 이상 포함되어야 합니다.');
          return;
        }
        
        // 특수문자 확인
        if (!/[!@#$%^&*]/.test(password)) {
          alert('비밀번호에 특수문자(!@#$%^&*)가 최소 1개 이상 포함되어야 합니다.');
          return;
        }
        
        if (password !== confirm) {
          alert('비밀번호가 일치하지 않습니다.');
          return;
        }
        
        // 비밀번호 저장 (원본과 해시 둘 다)
        this.authData.password = password; // 원본 비밀번호 (서버 전송용)
        this.authData.passwordHash = this.hashPassword(password); // 해시 (클라이언트 저장용)
        
        // UI 정리
        passwordSetup.remove();
        progressMessage.textContent = '계정 정보를 입력해주세요...';
        
        resolve();
      });
    });
  }

  async simulateFingerprint() {
    const stepFingerprint = document.getElementById('stepFingerprint');
    const progressMessage = document.getElementById('progressMessage');
    
    stepFingerprint.classList.add('active');
    progressMessage.textContent = '지문을 스캔하여 주세요...';
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        // 실제 생체인증 실행
        await this.performBiometricAuth('fingerprint');
      
        // 지문 데이터 생성 (해시 생성)
        this.biometricData.fingerprint = this.generateBiometricHash('fingerprint');
        
        // 기존 사용자 확인 (서버 API 호출 시뮬레이션)
        const existingUser = await this.checkExistingBiometric(this.biometricData.fingerprint);
        
        if (existingUser) {
          // 기존 사용자인 경우 - 비밀번호 입력 모드로 전환
          console.log('🔐 기존 사용자 확인됨 - 비밀번호 입력 필요');
          stepFingerprint.classList.remove('active');
          stepFingerprint.classList.add('completed');
          progressMessage.textContent = '비밀번호를 입력해주세요...';
          
          // 기존 사용자 플래그 설정
          this.isExistingUser = true;
          this.existingUserData = existingUser;
        } else {
          // 신규 사용자인 경우 - 비밀번호 설정 모드
          console.log('👤 신규 사용자 - 비밀번호 설정 필요');
          stepFingerprint.classList.remove('active');
          stepFingerprint.classList.add('completed');
          progressMessage.textContent = '비밀번호를 설정해주세요...';
          
          this.isExistingUser = false;
        }
        
        return; // 성공적으로 완료
      } catch (error) {
        attempts++;
        console.error(`❌ 지문 인증 실패 (${attempts}/${maxAttempts}):`, error);
        
        if (attempts < maxAttempts) {
          progressMessage.textContent = `인식되지 않았습니다. 다시 시도해주세요. (${attempts}/${maxAttempts})`;
          // 잠시 대기 후 재시도
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          progressMessage.textContent = '지문 인증에 실패했습니다.';
          // 프로세스 중단
          throw error;
        }
      }
    }
  }



  async setupPassword() {
    return new Promise((resolve) => {
      const progressMessage = document.getElementById('progressMessage');
      const modalBody = document.querySelector('#biometricModal .modal-body');
      
      // 기존 사용자인지에 따라 다른 UI 표시
      const isExisting = this.isExistingUser;
      
      // 비밀번호 설정/입력 UI 추가
      const passwordSetup = document.createElement('div');
      passwordSetup.className = 'password-setup';
      
      if (isExisting) {
        // 기존 사용자 - 비밀번호 입력
        passwordSetup.innerHTML = `
          <div class="password-form" style="color: var(--text-primary); background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px;">
            <h4 style="color: var(--text-primary);"><i class="fas fa-lock"></i> 비밀번호 입력</h4>
            <p style="color: var(--text-secondary);">반갑습니다, <strong>${this.existingUserData?.name || '사용자'}</strong>님!<br>계속하려면 비밀번호를 입력해주세요.</p>
            <div class="form-group">
              <label for="existingPassword" style="color: var(--text-primary);">비밀번호</label>
              <input type="password" id="existingPassword" placeholder="비밀번호를 입력하세요" style="background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; font-size: 1rem;">
            </div>
            <button class="btn-primary" id="verifyPasswordBtn">로그인</button>
          </div>
        `;
        
        modalBody.appendChild(passwordSetup);
        
        const verifyBtn = document.getElementById('verifyPasswordBtn');
        const passwordInput = document.getElementById('existingPassword');
        
        // 엔터키 이벤트 추가
        passwordInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            verifyBtn.click();
          }
        });
        
        verifyBtn.addEventListener('click', () => {
          const password = passwordInput.value;
          
          if (!password) {
            alert('비밀번호를 입력해주세요.');
            return;
          }
          
          // 비밀번호 확인
          const hashedPassword = this.hashPassword(password);
          
          // 저장된 비밀번호와 비교
          const isPasswordCorrect = this.verifyPassword(password, this.existingUserData);
          
          if (isPasswordCorrect) {
            // 비밀번호가 맞으면 로그인 성공
            this.currentUser = this.existingUserData;
            this.isAuthenticated = true;
            
            // passwordHash가 없는 기존 사용자의 경우 업데이트
            if (!this.existingUserData.passwordHash) {
              console.log('🔐 기존 사용자의 passwordHash 업데이트');
              const hashedPassword = this.hashPassword(password);
              this.currentUser.passwordHash = hashedPassword;
              
              // baekya_users에도 업데이트
              const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
              const deviceId = this.getDeviceId();
              const userIndex = storedUsers.findIndex(user => user.deviceId === deviceId);
              
              if (userIndex !== -1) {
                storedUsers[userIndex].passwordHash = hashedPassword;
                localStorage.setItem('baekya_users', JSON.stringify(storedUsers));
              }
            }
            
            // 로컬 스토리지에 저장
            localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
            
            // UI 정리
            passwordSetup.remove();
            
            const stepComplete = document.getElementById('stepComplete');
            stepComplete.classList.add('active');
            progressMessage.textContent = '로그인 성공!';
            
            resolve();
          } else {
            // 비밀번호가 틀리면 에러 메시지
            alert('비밀번호가 일치하지 않습니다.');
            passwordInput.value = '';
            passwordInput.focus();
          }
        });
        
      } else {
        // 신규 사용자 - 비밀번호 설정
        passwordSetup.innerHTML = `
          <div class="password-form" style="color: var(--text-primary); background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px;">
            <h4 style="color: var(--text-primary);">보안 비밀번호 설정</h4>
            <p style="color: var(--text-secondary);">토큰 전송 및 중요한 작업 시 사용할 비밀번호를 설정하세요.</p>
            <div class="form-group">
              <label for="newPassword" style="color: var(--text-primary);">비밀번호 (최소 8자)</label>
              <input type="password" id="newPassword" placeholder="비밀번호를 입력하세요" minlength="8" style="background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; font-size: 1rem;">
            </div>
            <div class="form-group">
              <label for="confirmPassword" style="color: var(--text-primary);">비밀번호 확인</label>
              <input type="password" id="confirmPassword" placeholder="비밀번호를 다시 입력하세요" style="background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; font-size: 1rem;">
            </div>
            <div class="password-requirements">
              <small style="color: var(--text-secondary);">
                • 최소 8자 이상<br>
                • <strong style="color: var(--warning-color);">영어 대문자 1개 이상 필수</strong><br>
                • <strong style="color: var(--warning-color);">특수문자 (!@#$%^&*) 1개 이상 필수</strong><br>
                • 영문 소문자, 숫자 포함 권장
              </small>
            </div>
            <button class="btn-primary" id="setPasswordBtn">비밀번호 설정</button>
          </div>
        `;
        
        modalBody.appendChild(passwordSetup);
        
        const setPasswordBtn = document.getElementById('setPasswordBtn');
        const newPassword = document.getElementById('newPassword');
        const confirmPassword = document.getElementById('confirmPassword');
        
        setPasswordBtn.addEventListener('click', () => {
          const password = newPassword.value;
          const confirm = confirmPassword.value;
          
          if (password.length < 8) {
            alert('비밀번호는 최소 8자 이상이어야 합니다.');
            return;
          }
          
          // 대문자 확인
          if (!/[A-Z]/.test(password)) {
            alert('비밀번호에 영어 대문자가 최소 1개 이상 포함되어야 합니다.');
            return;
          }
          
          // 특수문자 확인
          if (!/[!@#$%^&*]/.test(password)) {
            alert('비밀번호에 특수문자(!@#$%^&*)가 최소 1개 이상 포함되어야 합니다.');
            return;
          }
          
          if (password !== confirm) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
          }
          
          // 비밀번호 저장 (실제로는 해싱 처리)
          this.biometricData.password = this.hashPassword(password);
          
          // UI 정리
          passwordSetup.remove();
          
          const stepComplete = document.getElementById('stepComplete');
          stepComplete.classList.add('active');
          progressMessage.textContent = 'DID를 생성하고 있습니다...';
          
          resolve();
        });
      }
    });
  }

  hashPassword(password) {
    // 간단한 해싱 시뮬레이션 (실제로는 bcrypt 등 사용)
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    return `hashed_${Math.abs(hash)}`;
  }
  
  // 비밀번호 검증
  verifyPassword(inputPassword, userData) {
    if (!userData || !userData.passwordHash) {
      console.error('저장된 비밀번호가 없습니다. userData:', userData);
      return false;
    }
    
    // 입력된 비밀번호를 해싱하여 저장된 해시와 비교
    const inputHash = this.hashPassword(inputPassword);
    console.log('비밀번호 검증 - 입력 해시:', inputHash);
    console.log('비밀번호 검증 - 저장된 해시:', userData.passwordHash);
    return inputHash === userData.passwordHash;
  }

  generateBiometricHash(type) {
    // 실제로는 생체인증 데이터를 해싱 처리
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `${type}_${timestamp}_${random}`;
  }

  // 기존 생체인증 사용자 확인
  async checkExistingBiometric(fingerprintHash) {
    try {
      // 서버 API 호출 시뮬레이션
      const response = await fetch(`${this.apiBase}/check-biometric`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fingerprintHash: fingerprintHash
        })
      });

      const result = await response.json();
      
      if (result.exists) {
        return result.userData;
      }
      
      return null;
    } catch (error) {
      console.log('🔍 기존 사용자 확인 중 오류 (로컬 시뮬레이션):', error);
      
      // 먼저 baekya_auth에서 현재 사용자 정보 확인
      const storedAuth = localStorage.getItem('baekya_auth');
      if (storedAuth) {
        const authData = JSON.parse(storedAuth);
        console.log('✅ baekya_auth에서 기존 사용자 발견:', authData.name);
        
        // baekya_users에서 해당 사용자의 추가 정보(passwordHash 등) 가져오기
        const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
        const deviceId = this.getDeviceId();
        const userWithPassword = storedUsers.find(user => user.deviceId === deviceId);
        
        if (userWithPassword && userWithPassword.passwordHash) {
          // passwordHash를 authData에 추가
          authData.passwordHash = userWithPassword.passwordHash;
        }
        
        return authData;
      }
      
      // baekya_auth가 없으면 baekya_users에서 확인
      const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
      const deviceId = this.getDeviceId();
      const existingUser = storedUsers.find(user => user.deviceId === deviceId);
      
      if (existingUser) {
        console.log('✅ baekya_users에서 기존 사용자 발견:', existingUser.name);
        return existingUser;
      }
      
      return null;
    }
  }
  
  // 디바이스 ID 가져오기 (고유 식별자)
  getDeviceId() {
    let deviceId = localStorage.getItem('baekya_device_id');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('baekya_device_id', deviceId);
    }
    return deviceId;
  }

  // 실제 생체인증 실행
  async performBiometricAuth(type) {
    try {
      // Capacitor 환경에서 생체인증 플러그인 사용
      if (window.Capacitor) {
        // capacitor-biometric-auth 플러그인 사용
        const { BiometricAuth } = window.Capacitor.Plugins;
        
        if (!BiometricAuth) {
          console.error('❌ BiometricAuth 플러그인을 찾을 수 없습니다');
          throw new Error('생체인증 플러그인이 설치되지 않았습니다');
        }
        
        // 생체인증 가능 여부 먼저 확인
        try {
          const isAvailable = await BiometricAuth.isAvailable();
          console.log('🔍 생체인증 가능 여부:', isAvailable);
          
          if (!isAvailable || isAvailable.has === false) {
            throw new Error('이 기기는 생체인증을 지원하지 않습니다');
          }
        } catch (checkError) {
          console.log('⚠️ 생체인증 확인 건너뛰기:', checkError);
        }
        
        // 생체인증 실행
        const result = await BiometricAuth.verify({
          title: '백야 프로토콜',
          subtitle: '지문 인증',
          reason: '본인 확인을 위해 생체인증이 필요합니다',
          cancelTitle: '취소',
          fallbackTitle: '비밀번호 사용'
        });
        
        console.log('🔐 생체인증 결과:', result);
        
        if (result && result.verified) {
          console.log(`✅ ${type} 인증 성공`);
          return true;
        } else {
          throw new Error(`${type} 인증 실패 - 결과: ${JSON.stringify(result)}`);
        }
      } else {
        // 웹 브라우저 환경에서는 시뮬레이션
        console.log(`🌐 웹 환경에서 ${type} 인증 시뮬레이션`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      }
    } catch (error) {
      console.error(`❌ ${type} 인증 오류:`, error);
      throw error;
    }
  }

  // 생체인증 등록용 (검증 없이)
  async performBiometricAuthForRegistration(type) {
    try {
      // Capacitor 환경에서 생체인증 플러그인 사용
      if (window.Capacitor) {
        // capacitor-biometric-auth 플러그인 사용
        const { BiometricAuth } = window.Capacitor.Plugins;
        
        if (!BiometricAuth) {
          console.error('❌ BiometricAuth 플러그인을 찾을 수 없습니다');
          throw new Error('생체인증 플러그인이 설치되지 않았습니다');
        }
        
        // 새로운 지문 등록을 위한 생체인증 (검증 없이)
        const result = await BiometricAuth.verify({
          title: '백야 프로토콜',
          subtitle: '새로운 지문 등록',
          reason: '새로운 지문을 등록해주세요',
          cancelTitle: '취소',
          fallbackTitle: '취소'
        });
        
        console.log('🔐 새 지문 등록 결과:', result);
        
        if (result && result.verified) {
          console.log(`✅ ${type} 등록 성공`);
          return true;
        } else {
          throw new Error(`${type} 등록 실패 - 결과: ${JSON.stringify(result)}`);
        }
      } else {
        // 웹 브라우저 환경에서는 시뮬레이션
        console.log(`🌐 웹 환경에서 ${type} 등록 시뮬레이션`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      }
    } catch (error) {
      console.error(`❌ ${type} 등록 오류:`, error);
      throw error;
    }
  }

  // 지문 재인증 (신규 사용자 등록 시 보안 강화)
  async simulateFingerprintReauth() {
    const progressMessage = document.getElementById('progressMessage');
    const biometricProgress = document.querySelector('.biometric-progress');
    
    // 지문 재인증 단계 추가
    const stepReauth = document.createElement('div');
    stepReauth.className = 'step active';
    stepReauth.id = 'stepReauth';
    stepReauth.innerHTML = '<i class="fas fa-fingerprint"></i><span>지문 재인증</span>';
    
    const stepComplete = document.getElementById('stepComplete');
    biometricProgress.insertBefore(stepReauth, stepComplete);
    
    progressMessage.textContent = '보안을 위해 지문을 다시 인증해주세요...';
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        // 실제 지문 재인증 실행
        await this.performBiometricAuth('fingerprint');
        
        // 영지식 증명 생성 (protocol_overview.md에 따라)
        progressMessage.textContent = '영지식 증명을 생성하는 중...';
        await this.generateZKProof();
        
        stepReauth.classList.remove('active');
        stepReauth.classList.add('completed');
        progressMessage.textContent = '지문 재인증이 완료되었습니다...';
        
        console.log('✅ 지문 재인증 및 영지식 증명 생성 완료');
        return; // 성공적으로 완료
      } catch (error) {
        attempts++;
        console.error(`❌ 지문 재인증 실패 (${attempts}/${maxAttempts}):`, error);
        
        if (attempts < maxAttempts) {
          progressMessage.textContent = `인식되지 않았습니다. 다시 시도해주세요. (${attempts}/${maxAttempts})`;
          // 잠시 대기 후 재시도
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          progressMessage.textContent = '지문 재인증에 실패했습니다.';
          throw error;
        }
      }
    }
  }

  async simulateFaceRecognition() {
    const progressMessage = document.getElementById('progressMessage');
    const biometricProgress = document.querySelector('.biometric-progress');
    
    // 얼굴 인증 단계 추가
    const stepFace = document.createElement('div');
    stepFace.className = 'step active';
    stepFace.id = 'stepFace';
    stepFace.innerHTML = '<i class="fas fa-user-circle"></i><span>얼굴 인증</span>';
    
    const stepComplete = document.getElementById('stepComplete');
    biometricProgress.insertBefore(stepFace, stepComplete);
    
    progressMessage.textContent = '얼굴을 인식시켜 주세요...';
    
    try {
      // 실제 얼굴 인증 실행
      await this.performBiometricAuth('face');
      
      // 얼굴 데이터 생성 (해시 생성)
      this.biometricData.faceprint = this.generateBiometricHash('face');
      
      // 영지식 증명 생성 (protocol_overview.md에 따라)
      progressMessage.textContent = '영지식 증명을 생성하는 중...';
      await this.generateZKProof();
      
      stepFace.classList.remove('active');
      stepFace.classList.add('completed');
      progressMessage.textContent = '인증이 완료되었습니다...';
      
      console.log('✅ 얼굴 인증 및 영지식 증명 생성 완료');
    } catch (error) {
      console.error('❌ 얼굴 인증 실패:', error);
      progressMessage.textContent = '얼굴 인증에 실패했습니다.';
      throw error;
    }
  }
  
  // 영지식 증명 생성 (시뮬레이션)
  async generateZKProof() {
    console.log('🔐 영지식 증명 생성 중...');
    
    // 실제로는 zk-SNARK 라이브러리를 사용하여 생성
    // 여기서는 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const proof = {
      pi_a: [Math.random().toString(), Math.random().toString()],
      pi_b: [[Math.random().toString(), Math.random().toString()], [Math.random().toString(), Math.random().toString()]],
      pi_c: [Math.random().toString(), Math.random().toString()],
      protocol: "groth16",
      curve: "bn128"
    };
    
    this.biometricData.zkProof = proof;
    console.log('✅ 영지식 증명 생성 완료');
    return proof;
  }

  async enterInviteCode() {
    return new Promise((resolve) => {
      const progressMessage = document.getElementById('progressMessage');
      const modalBody = document.querySelector('#biometricModal .modal-body');
      
      // 초대코드 입력 UI 추가
      const inviteCodeSetup = document.createElement('div');
      inviteCodeSetup.className = 'invite-code-setup';
      inviteCodeSetup.innerHTML = `
        <div class="invite-code-form" style="color: var(--text-primary); background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px;">
          <h4 style="color: var(--text-primary);">초대코드 입력 (선택사항)</h4>
          <p style="color: var(--text-secondary);">초대코드가 있으신 경우 입력해주세요.</p>
          <div class="form-group">
            <label for="inviteCodeInput" style="color: var(--text-primary);">초대코드</label>
            <input type="text" id="inviteCodeInput" placeholder="초대코드를 입력하세요 (선택)" maxlength="20" style="background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; font-size: 1rem; letter-spacing: 2px; font-family: monospace;">
          </div>
          <div class="invite-code-notice">
            <small style="color: var(--text-secondary);">
              • 초대코드는 기존 구성원으로부터 받을 수 있습니다<br>
              • 초대코드가 없어도 가입이 가능합니다<br>
              • 영어와 숫자만 입력 가능합니다 (자동 대문자 변환)
            </small>
          </div>
          <button class="btn-primary" id="submitInviteCodeBtn">다음 단계</button>
          <button class="btn-secondary" id="skipInviteCodeBtn" style="margin-top: 10px;">건너뛰기</button>
        </div>
      `;
      
      modalBody.appendChild(inviteCodeSetup);
      progressMessage.textContent = '초대코드를 입력하거나 건너뛰기를 선택하세요...';
      
      const submitBtn = document.getElementById('submitInviteCodeBtn');
      const skipBtn = document.getElementById('skipInviteCodeBtn');
      const inviteCodeInput = document.getElementById('inviteCodeInput');
      
      // 초대코드 입력 시 자동 대문자 변환 및 영어/숫자만 입력 제한
      inviteCodeInput.addEventListener('input', (e) => {
        let value = e.target.value;
        // 영어(대소문자)와 숫자만 허용
        value = value.replace(/[^a-zA-Z0-9]/g, '');
        // 자동으로 대문자로 변환
        value = value.toUpperCase();
        e.target.value = value;
      });
      
      const handleSubmit = () => {
        const inviteCode = inviteCodeInput.value.trim();
        
        if (inviteCode) {
          if (inviteCode.length < 6) {
          alert('올바른 초대코드를 입력해주세요.');
          return;
          }
          
          // 확인 창 표시
          const isConfirmed = confirm(`입력한 초대코드: ${inviteCode}\n\n확실한가요? 오입력시 혜택이 제공되지 않습니다.`);
          if (!isConfirmed) {
            return; // 사용자가 취소를 선택한 경우 다시 입력할 수 있도록
          }
        }
        
        // 초대코드 저장 (없으면 null)
        this.biometricData.inviteCode = inviteCode || null;
        
        // UI 정리
        inviteCodeSetup.remove();
        progressMessage.textContent = '개인정보를 입력해주세요...';
        
        resolve();
      };
      
      submitBtn.addEventListener('click', handleSubmit);
      skipBtn.addEventListener('click', () => {
        inviteCodeInput.value = '';
        handleSubmit();
      });
      
      // Enter 키 처리
      inviteCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleSubmit();
        }
      });
    });
  }

  async enterPersonalInfo() {
    return new Promise((resolve) => {
      const progressMessage = document.getElementById('progressMessage');
      const modalBody = document.querySelector('#biometricModal .modal-body');
      
      // 개인정보 입력 UI 추가 (이름만)
      const personalInfoSetup = document.createElement('div');
      personalInfoSetup.className = 'personal-info-setup';
      personalInfoSetup.innerHTML = `
        <div class="personal-info-form" style="color: var(--text-primary); background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px;">
          <h4 style="color: var(--text-primary);">개인정보 입력</h4>
          <p style="color: var(--text-secondary);">백야 프로토콜 가입을 위한 기본 정보를 입력하세요.</p>
          
          <div class="form-group">
            <label for="userNameInput" style="color: var(--text-primary);">이름</label>
            <input type="text" id="userNameInput" placeholder="실명을 입력하세요" maxlength="20" style="background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); padding: 0.75rem; font-size: 1rem;">
          </div>
          
          <button class="btn-primary" id="submitPersonalInfoBtn">DID 생성하기</button>
        </div>
      `;
      
      modalBody.appendChild(personalInfoSetup);
      progressMessage.textContent = '개인정보를 입력해주세요...';
      
      const submitBtn = document.getElementById('submitPersonalInfoBtn');
      const nameInput = document.getElementById('userNameInput');
      
      // 이름 입력 필드에 실시간 검증 추가 (IME 고려)
      let isComposing = false;
      
      nameInput.addEventListener('compositionstart', () => {
        isComposing = true;
      });
      
      nameInput.addEventListener('compositionend', () => {
        isComposing = false;
        // composition이 끝난 후 검증
        const value = nameInput.value;
        const filteredValue = value.replace(/[^가-힣a-zA-Z\s]/g, '');
        if (value !== filteredValue) {
          nameInput.value = filteredValue;
        }
      });
      
      nameInput.addEventListener('input', (e) => {
        // IME 입력 중에는 필터링하지 않음
        if (!isComposing) {
        const value = e.target.value;
        // 한글, 영어, 공백만 허용
        const filteredValue = value.replace(/[^가-힣a-zA-Z\s]/g, '');
        if (value !== filteredValue) {
          e.target.value = filteredValue;
          }
        }
      });
      
      submitBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        
        if (!name) {
          alert('이름을 입력해주세요.');
          return;
        }
        
        if (name.length < 2) {
          alert('이름은 최소 2자 이상 입력해주세요.');
          return;
        }
        
        // 한글과 영어만 허용 (공백 포함)
        const nameRegex = /^[가-힣a-zA-Z\s]+$/;
        if (!nameRegex.test(name)) {
          alert('이름은 한글과 영어만 입력 가능합니다.');
          return;
        }
        
        // 개인정보 저장 (이름만)
        this.biometricData.personalInfo = {
          name,
          registeredAt: Date.now()
        };
        
        // UI 정리
        personalInfoSetup.remove();
        
        const stepComplete = document.getElementById('stepComplete');
        stepComplete.classList.add('active');
        progressMessage.textContent = 'DID를 생성하고 있습니다...';
        
        resolve();
      });
    });
  }

  async generateDID() {
    try {
      // 아이디/비밀번호 데이터를 기반으로 DID 생성 요청 (새로운 SimpleAuth API)
      const userData = {
        username: this.authData.userId,
        password: this.authData.password, // 원본 비밀번호 (서버 검증용)
        name: this.biometricData.personalInfo?.name || '미설정',
        inviteCode: this.biometricData.inviteCode // 초대코드 추가
      };

      console.log('📤 사용자 등록 데이터 전송:', { 
        username: userData.username, 
        name: userData.name
      });

      const response = await fetch(`${this.apiBase}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userData })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('🎉 사용자 등록 성공:', result);
        
        // 초대코드 보상 정보 저장
        this.inviteRewardInfo = result.inviteReward;
        
        // DID 및 통신주소 저장
        this.biometricData.did = result.didHash;
        this.biometricData.communicationAddress = result.communicationAddress;
        
        // 사용자 데이터 설정
        this.currentUser = {
          userId: result.username,
          username: result.username,
          did: result.didHash,
          communicationAddress: result.communicationAddress,
          hasSetCommunicationAddress: !!result.communicationAddress,
          bTokenBalance: result.inviteReward?.newUserReward || parseFloat(localStorage.getItem('currentBalance') || '0'),
          pTokenBalance: result.isInitialOP ? 120 : 0, // 이니셜 OP면 120P
          name: result.name,
          inviteCode: this.biometricData.inviteCode,
          createdAt: Date.now(),
          nameChangeHistory: [],
          isInitialOP: result.isInitialOP || false,
          isFounder: result.isFounder || false,
          initialOPResult: result.initialOPResult || null,
          founderBenefits: result.founderBenefits || null,
          passwordHash: this.authData.passwordHash || this.hashPassword(userData.password), // 클라이언트 측에서 해시 저장
          deviceId: this.getDeviceId()
        };
        
        this.isAuthenticated = true;
        
        // 로컬 스토리지에 저장
        localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
        
        console.log('🆔 DID 생성 성공:', result.didHash);
        console.log('📞 통신주소 할당:', result.communicationAddress);
        
        // Founder 혜택 메시지
        if (result.isFounder) {
          console.log('👑 Founder 계정! 특별 혜택:', result.founderBenefits);
        }
        
        // 이니셜 OP 메시지
        if (result.isInitialOP) {
          console.log('👑 이니셜 OP 설정:', result.initialOPResult);
        }
        
        // 초대코드 보상 메시지
        if (result.inviteReward && result.inviteReward.success) {
          console.log('🎉 초대코드 보상:', result.inviteReward);
          
          // 초대받은 사용자(생성자)의 기여 내역 저장
          if (this.biometricData.inviteCode) {
            this.saveInviteContribution(result.inviteReward);
          }
        }
        
        // 소속 DAO 정보 저장
        if (result.daos && result.daos.length > 0) {
          // 기본 DAO 목록을 localStorage에 저장
          const existingDAOs = JSON.parse(localStorage.getItem('userDAOs') || '[]');
          
          // 중복 제거하면서 새로운 DAO 추가
          result.daos.forEach(dao => {
            if (!existingDAOs.find(d => d.id === dao.id)) {
              existingDAOs.push({
                id: dao.id,
                name: dao.name,
                icon: dao.name.includes('Operations') ? 'fa-cogs' :
                      dao.name.includes('Development') ? 'fa-code' :
                      dao.name.includes('Community') ? 'fa-users' :
                      dao.name.includes('Political') ? 'fa-landmark' : 'fa-building',
                role: dao.role,
                joinedAt: dao.joinedAt || Date.now()
              });
            }
          });
          
          localStorage.setItem('userDAOs', JSON.stringify(existingDAOs));
          console.log('🏛️ 소속 DAO 정보 저장:', existingDAOs);
        }
      } else {
        throw new Error(result.error || '사용자 등록에 실패했습니다');
      }
    } catch (error) {
      console.error('❌ DID 생성 실패:', error);
      
      // 중복 아이디 에러인 경우 시뮬레이션 데이터를 생성하지 않음
      if (error.message.includes('이미 사용 중인 아이디') || 
          error.message.includes('already in use') ||
          error.message.includes('duplicate')) {
        console.log('❌ 중복 아이디로 인한 가입 실패');
        throw error; // 에러를 다시 던져서 호출자가 처리하도록 함
      }
      
      // 네트워크 연결 실패인 경우만 시뮬레이션 데이터 생성
      if (error.message.includes('fetch') || 
          error.message.includes('network') ||
          error.message.includes('connection')) {
        console.log('🌐 네트워크 연결 실패, 시뮬레이션 모드로 전환');
      
      // 시뮬레이션용 더미 데이터 생성 (서버 연결 실패 시)
      const didHash = this.generateBiometricHash('did');
      const commAddress = this.generateCommunicationAddress();
      
      this.biometricData.did = didHash;
      this.biometricData.communicationAddress = commAddress;
      
      this.currentUser = {
        userId: this.authData.userId,
        username: this.authData.userId,
        did: didHash,
        communicationAddress: commAddress,
        hasSetCommunicationAddress: true,
        bTokenBalance: 0,
        pTokenBalance: 0,
        name: this.biometricData.personalInfo?.name || '미설정',
        inviteCode: this.biometricData.inviteCode,
        createdAt: Date.now(),
        nameChangeHistory: [],
        isFounder: false,
        passwordHash: this.authData.passwordHash || this.hashPassword(this.authData.password),
        deviceId: this.getDeviceId()
      };
      
      this.isAuthenticated = true;
      localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
      
      console.log('🆔 DID 시뮬레이션 생성:', didHash);
      } else {
        throw error; // 다른 에러는 다시 던져서 호출자가 처리
      }
    }
  }

  // 초대받은 사용자 기여 내역 저장
  saveInviteContribution(inviteReward) {
    if (!this.currentUser || !this.currentUser.did) return;
    
    const contributionId = `invite_join_${this.biometricData.inviteCode}_${Date.now()}`;
    
    const contribution = {
      id: contributionId,
      type: 'invite_join',
      title: '초대 참여',
      dao: 'community-dao',
      date: new Date().toISOString().split('T')[0],
      status: 'verified',
      bTokens: inviteReward.newUserReward || 20,
      description: `초대를 통해 커뮤니티에 참여`,
      evidence: `초대코드: ${this.biometricData.inviteCode}`,
      metadata: {
        inviteCode: this.biometricData.inviteCode,
        inviterReward: inviteReward.inviterReward,
        joinedAt: Date.now()
      }
    };
    
    // 로컬 스토리지에 기여 내역 저장
    const contributionsKey = `baekya_contributions_${this.currentUser.did}`;
    const existingContributions = JSON.parse(localStorage.getItem(contributionsKey) || '[]');
    
    existingContributions.push(contribution);
    localStorage.setItem(contributionsKey, JSON.stringify(existingContributions));
    
    console.log('✅ 초대 참여 기여 내역 저장:', contribution);
  }

  generateCommunicationAddress() {
    // USIM 2.0 통신주소 생성 (010-XXXX-XXXX 형태)
    const middle = Math.floor(Math.random() * 9000) + 1000;
    const last = Math.floor(Math.random() * 9000) + 1000;
    return `010-${middle}-${last}`;
  }

  // 신규 사용자 데이터 저장 (시뮬레이션)
  saveNewUserData() {
    // 로컬 스토리지에 사용자 리스트 저장 (시뮬레이션)
    const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
    
    const newUser = {
      ...this.currentUser,
      fingerprintHash: this.biometricData.fingerprint,
      passwordHash: this.biometricData.password || this.authData.password,
      deviceId: this.getDeviceId() // 디바이스 ID 추가
    };
    
    storedUsers.push(newUser);
    localStorage.setItem('baekya_users', JSON.stringify(storedUsers));
    
    // baekya_auth에도 저장 (로그인 유지용)
    localStorage.setItem('baekya_auth', JSON.stringify(newUser));
    
    console.log('✅ 신규 사용자 데이터 저장 완료');
    console.log('저장된 사용자 데이터:', newUser);
  }

  completeBiometricAuth() {
    const progressMessage = document.getElementById('progressMessage');
    
    if (this.isExistingUser) {
      progressMessage.textContent = '로그인이 완료되었습니다!';
    } else {
      progressMessage.textContent = '인증이 완료되었습니다!';
      // 신규 사용자 데이터 저장
      this.saveNewUserData();
    }
    
    setTimeout(() => {
      this.closeBiometricModal();
      this.updateUserInterface();
      
      // WebSocket 연결 시작
      this.connectWebSocket();
      
      // 프로토콜 상태 주기적 동기화 시작
      this.startProtocolStateSync();
      
      // 즉시 프로토콜 상태 동기화
      this.syncProtocolState();
      
      // 현재 지갑 탭에 있다면 지갑 UI 업데이트
      if (this.currentTab === 'wallet') {
        this.loadWallet();
      }
      
      // 회원가입 완료 후 지갑 잔액 강제 새로고침
      if (!this.isExistingUser) {
        setTimeout(() => {
          this.updateTokenBalances(true); // 강제 새로고침
        }, 2000); // 2초 후 새로고침 (서버 처리 시간 고려)
      }
      
      if (this.isExistingUser) {
        this.showSuccessMessage(`환영합니다, ${this.currentUser.name}님!`);
      } else {
        let successMessage = 'DID가 성공적으로 생성되었습니다!';
        
        // 초대코드 보상 메시지 추가
        if (this.inviteRewardInfo && this.inviteRewardInfo.success) {
          successMessage += `\n\n🎉 초대코드 보상!\n생성자(본인): ${this.inviteRewardInfo.newUserReward}B 지급\n초대자: ${this.inviteRewardInfo.inviterReward}B 지급`;
        }
        
        this.showSuccessMessage(successMessage);
      }
    }, 1500);
  }

  closeBiometricModal() {
    const modal = document.getElementById('biometricModal');
    modal.classList.remove('active');
    
    // 상태 리셋
    const steps = document.querySelectorAll('.step');
    steps.forEach(step => step.classList.remove('active'));
    document.getElementById('stepFingerprint').classList.add('active');
  }

  updateUserInterface() {
    this.updateUserProfile();
    this.updateTokenBalances();
    this.updateNetworkStatus(); // 네트워크 상태 업데이트
    this.updateProfileStatus('online'); // 로그인 시 온라인 상태로 변경
    
    // 프로필 사진 강제 업데이트 (새로고침 시 초기화 방지)
    setTimeout(() => {
      if (this.currentUser && this.currentUser.profilePhoto) {
        this.updateProfilePhotoInUI();
      }
    }, 50);
    
    // 현재 탭에 따라 콘텐츠 새로고침
    if (this.currentTab === 'dao') {
      this.loadDAOs();
    
    }
  }

  updateUserProfile() {
    const userId = document.getElementById('userId');
    const userName = document.getElementById('userName');
    const userDID = document.getElementById('userDID');
    const commAddress = document.getElementById('commAddress');
    const verificationBadge = document.getElementById('verificationBadge');

    if (this.isAuthenticated && this.currentUser) {
      if (userId) userId.textContent = this.currentUser.userId || '미설정';
      if (userName) userName.textContent = this.currentUser.name || '미설정';

      if (verificationBadge) {
        verificationBadge.style.display = 'none';
      }
      
      // 통신주소 버튼 표시
      const commAddressButton = document.getElementById('commAddressButton');
      if (commAddressButton) {
        commAddressButton.style.display = 'inline-flex';
      }
      
      // P2P 버튼 표시
      const p2pButton = document.getElementById('p2pButton');
      if (p2pButton) {
        p2pButton.style.display = 'inline-flex';
      }
    } else {
      if (userName) userName.textContent = '미설정';

      if (verificationBadge) {
        verificationBadge.textContent = '인증 대기';
        verificationBadge.className = 'badge';
        verificationBadge.style.display = 'inline-block';
      }
      
      // 통신주소 버튼 숨기기
      const commAddressButton = document.getElementById('commAddressButton');
      if (commAddressButton) {
        commAddressButton.style.display = 'none';
      }
      
      // P2P 버튼 숨기기
      const p2pButton = document.getElementById('p2pButton');
      if (p2pButton) {
        p2pButton.style.display = 'none';
      }
    }
    
    // 프로필 사진 업데이트
    if (typeof this.updateProfilePhotoInUI === 'function') {
      this.updateProfilePhotoInUI();
    }
    
    // 모바일 헤더도 업데이트
    this.updateMobileProfileHeader();
    
    // 상태메시지 업데이트
    this.updateStatusMessageInUI();
  }

  // 통신주소 모달 표시
  showCommunicationAddressModal() {
    if (!this.currentUser) return;
    
    // 통신주소가 이미 설정된 경우
    if (this.currentUser.communicationAddress) {
      const canChange = this.canChangeCommunicationAddress();
      const daysLeft = this.getDaysUntilCommunicationAddressChange();
      
      const modal = document.createElement('div');
      modal.className = 'modal active';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
          <div class="modal-header">
            <h3><i class="fas fa-phone"></i> 통신주소 정보</h3>
            <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="current-comm-address-info" style="text-align: center; padding: 2rem;">
              <h4 style="margin-bottom: 1rem;">현재 통신주소</h4>
              <div style="font-size: 2rem; font-weight: bold; color: var(--primary-color); margin-bottom: 1.5rem;">
                ${this.currentUser.communicationAddress}
              </div>
              <div class="change-status" style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
                ${canChange ? 
                  `<span style="color: #10b981;"><i class="fas fa-check-circle"></i> 변경 가능</span>` :
                  `<span style="color: #ef4444;"><i class="fas fa-times-circle"></i> ${daysLeft}일 후에 변경 가능</span>`
                }
                <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">
                  3개월마다 변경 가능합니다
                </div>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">닫기</button>
              ${canChange ? `
                <button type="button" class="btn-primary" onclick="window.dapp.showChangeCommunicationAddressModal()">
                  <i class="fas fa-edit"></i> 통신주소 변경
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
    } else {
      // 통신주소가 설정되지 않은 경우 생성 모달 표시
      this.showCreateCommunicationAddressModal();
    }
  }
  
  // 통신주소 생성 모달 표시
  showCreateCommunicationAddressModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 450px;">
        <div class="modal-header">
          <h3><i class="fas fa-phone"></i> 통신주소 생성</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
            원하는 통신주소를 선택하세요. 한 번 설정하면 3개월 후에만 변경 가능합니다.
          </p>
          <div class="comm-address-input-container">
            <div class="comm-address-format">
              <span class="prefix">010-</span>
              <input type="text" id="commMiddle" placeholder="0000" maxlength="4" pattern="[0-9]{4}" 
                style="width: 80px; text-align: center; font-size: 1.2rem; padding: 8px;">
              <span class="separator">-</span>
              <input type="text" id="commLast" placeholder="0000" maxlength="4" pattern="[0-9]{4}" 
                style="width: 80px; text-align: center; font-size: 1.2rem; padding: 8px;">
            </div>
            <div id="commAddressAvailability" style="margin-top: 10px; font-size: 0.9rem;"></div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
            <button type="button" class="btn-primary" onclick="window.dapp.createCommunicationAddress()">
              <i class="fas fa-check"></i> 생성하기
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 입력 이벤트 리스너 추가
    const middleInput = document.getElementById('commMiddle');
    const lastInput = document.getElementById('commLast');
    
    const checkAvailability = () => {
      const middle = middleInput.value;
      const last = lastInput.value;
      const availabilityDiv = document.getElementById('commAddressAvailability');
      
      if (middle.length === 4 && last.length === 4) {
        // 중복 확인 시뮬레이션
        const isAvailable = Math.random() > 0.3; // 70% 확률로 사용 가능
        if (isAvailable) {
          availabilityDiv.innerHTML = '<span style="color: #10b981;"><i class="fas fa-check-circle"></i> 사용 가능한 번호입니다</span>';
        } else {
          availabilityDiv.innerHTML = '<span style="color: #ef4444;"><i class="fas fa-times-circle"></i> 이미 사용 중인 번호입니다</span>';
        }
      } else {
        availabilityDiv.innerHTML = '';
      }
    };
    
    middleInput.addEventListener('input', checkAvailability);
    lastInput.addEventListener('input', checkAvailability);
    
    // 숫자만 입력 가능하도록 처리
    [middleInput, lastInput].forEach(input => {
      input.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length === 4 && this.nextElementSibling?.nextElementSibling?.tagName === 'INPUT') {
          this.nextElementSibling.nextElementSibling.focus();
        }
      });
    });
  }
  
  // 통신주소 생성 처리
  async createCommunicationAddress() {
    const middle = document.getElementById('commMiddle').value;
    const last = document.getElementById('commLast').value;
    
    if (middle.length !== 4 || last.length !== 4) {
      this.showErrorMessage('4자리 숫자를 모두 입력해주세요.');
      return;
    }
    
    const newAddress = `010-${middle}-${last}`;
    
    // 중복 확인 (실제로는 서버 API 호출)
    const isAvailable = Math.random() > 0.3;
    if (!isAvailable) {
      this.showErrorMessage('이미 사용 중인 번호입니다. 다른 번호를 선택해주세요.');
      return;
    }
    
    // 통신주소 설정
    const previousAddress = this.currentUser.communicationAddress;
    this.currentUser.communicationAddress = newAddress;
    this.currentUser.hasSetCommunicationAddress = true;
    this.currentUser.communicationAddressSetAt = Date.now();
    
    // 서버에 통신주소 설정 요청
    if (this.currentUser.did) {
      fetch('/api/update-communication-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionId}`
        },
        body: JSON.stringify({
          didHash: this.currentUser.did,
          newAddress: newAddress
        })
      })
      .then(response => response.json())
      .then(result => {
        if (!result.success) {
          // 서버 업데이트 실패 시 롤백
          this.currentUser.communicationAddress = previousAddress;
          this.currentUser.hasSetCommunicationAddress = false;
          this.showErrorMessage(result.error || '서버 통신주소 설정 실패');
          // 로컬 스토리지도 롤백
          localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
          return;
        }
        console.log('✅ 서버 통신주소 설정 성공');
      })
      .catch(error => {
        console.error('서버 통신주소 설정 실패:', error);
        // 실패 시 롤백
        this.currentUser.communicationAddress = previousAddress;
        this.currentUser.hasSetCommunicationAddress = false;
        this.showErrorMessage('서버와의 통신 중 오류가 발생했습니다');
        // 로컬 스토리지도 롤백
        localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
      });
    }
    
    // 로컬 스토리지에 저장
    localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
    
    // baekya_users에도 업데이트
    const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
    const deviceId = this.getDeviceId();
    const userIndex = storedUsers.findIndex(user => user.deviceId === deviceId);
    
    if (userIndex !== -1) {
      storedUsers[userIndex].communicationAddress = newAddress;
      storedUsers[userIndex].hasSetCommunicationAddress = true;
      storedUsers[userIndex].communicationAddressSetAt = Date.now();
      localStorage.setItem('baekya_users', JSON.stringify(storedUsers));
    }
    
    // UI 업데이트
    this.updateUserProfile();
    this.updateAddressDisplay();
    
    // 모달 닫기
    document.querySelector('.modal.active').remove();
    
    this.showSuccessMessage(`통신주소가 설정되었습니다: ${newAddress}`);
  }

  // 통신주소 변경 모달
  showChangeCommunicationAddressModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'changeCommAddressModal';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3><i class="fas fa-edit"></i> 통신주소 변경</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>새로운 통신주소</label>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="text" value="010" disabled style="width: 60px; text-align: center;">
              <span>-</span>
              <input type="text" id="newCommMiddle" maxlength="4" placeholder="0000" style="width: 80px; text-align: center;" onkeyup="if(this.value.length==4) document.getElementById('newCommLast').focus()">
              <span>-</span>
              <input type="text" id="newCommLast" maxlength="4" placeholder="0000" style="width: 80px; text-align: center;">
            </div>
          </div>
          <div class="form-help" style="background: #f0f9ff; padding: 0.75rem; border-radius: 6px; margin-top: 1rem;">
            <i class="fas fa-info-circle" style="color: #0284c7;"></i>
            <span style="color: #0369a1;">통신주소는 3개월에 한 번만 변경할 수 있습니다.</span>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
          <button type="button" class="btn-primary" onclick="window.dapp.confirmChangeCommAddress()">변경</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 숫자만 입력 가능하도록 설정
    const middleInput = modal.querySelector('#newCommMiddle');
    const lastInput = modal.querySelector('#newCommLast');
    
    [middleInput, lastInput].forEach(input => {
      input.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9]/g, '');
      });
    });
  }

  // 통신주소 변경 확인
  async confirmChangeCommAddress() {
    const middle = document.getElementById('newCommMiddle').value;
    const last = document.getElementById('newCommLast').value;
    
    if (middle.length !== 4 || last.length !== 4) {
      this.showErrorMessage('통신주소는 각각 4자리 숫자여야 합니다.');
      return;
    }
    
    const newAddress = `010-${middle}-${last}`;
    
    // 현재 주소와 동일한지 확인
    if (this.currentUser.communicationAddress === newAddress) {
      this.showErrorMessage('현재 통신주소와 동일합니다.');
      return;
    }
    
    // 중복 확인
    const isDuplicate = await this.checkCommAddressDuplicate(newAddress);
    if (isDuplicate) {
      this.showErrorMessage('이미 사용 중인 통신주소입니다. 다른 번호를 선택해주세요.');
      return;
    }
    
    // 통신주소 업데이트
    const previousAddress = this.currentUser.communicationAddress;
    this.currentUser.communicationAddress = newAddress;
    this.currentUser.communicationAddressSetAt = Date.now();
    
    // 서버에 통신주소 업데이트 요청
    if (this.currentUser.did) {
      fetch('/api/update-communication-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionId}`
        },
        body: JSON.stringify({
          didHash: this.currentUser.did,
          newAddress: newAddress
        })
      })
      .then(response => response.json())
      .then(result => {
        if (!result.success) {
          // 서버 업데이트 실패 시 롤백
          this.currentUser.communicationAddress = previousAddress;
          this.showErrorMessage(result.error || '서버 통신주소 업데이트 실패');
          // 로컬 스토리지도 롤백
          localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
          return;
        }
        console.log('✅ 서버 통신주소 업데이트 성공');
      })
      .catch(error => {
        console.error('서버 통신주소 업데이트 실패:', error);
        // 실패 시 롤백
        this.currentUser.communicationAddress = previousAddress;
        this.showErrorMessage('서버와의 통신 중 오류가 발생했습니다');
        // 로컬 스토리지도 롤백
        localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
      });
    }
    
    // 로컬 스토리지 업데이트
    localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
    
    // baekya_users에도 업데이트
    const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
    const deviceId = this.getDeviceId();
    const userIndex = storedUsers.findIndex(user => user.deviceId === deviceId);
    
    if (userIndex !== -1) {
      storedUsers[userIndex].communicationAddress = newAddress;
      storedUsers[userIndex].communicationAddressSetAt = Date.now();
      localStorage.setItem('baekya_users', JSON.stringify(storedUsers));
    }
    
    // UI 업데이트
    this.updateAddressDisplay();
    
    // 모달 닫기
    document.getElementById('changeCommAddressModal').remove();
    const commModal = document.getElementById('communicationAddressModal');
    if (commModal) commModal.remove();
    
    this.showSuccessMessage('통신주소가 변경되었습니다.');
  }

  // 통신주소 변경까지 남은 일수 계산
  getDaysUntilCommunicationAddressChange() {
    if (!this.currentUser || !this.currentUser.communicationAddressSetAt) {
      return 0;
    }
    
    const nextChangeDate = new Date(this.currentUser.communicationAddressSetAt + (3 * 30 * 24 * 60 * 60 * 1000));
    const today = new Date();
    const timeDiff = nextChangeDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return Math.max(0, daysDiff);
  }

  formatDID(did) {
    if (!did) return '연결되지 않음';
    return `${did.substring(0, 8)}...${did.substring(did.length - 8)}`;
  }

  async updateTokenBalances(forceRefresh = false) {
    // 대시보드 토큰 표시 요소들
    const bTokenBalance = document.getElementById('bTokenBalance');
    const hourlyRate = document.getElementById('hourlyRate');
    
    // 지갑 페이지 토큰 표시 요소들
    const bTokenMain = document.getElementById('bTokenMain');
    const currentMiningRate = document.getElementById('currentMiningRate');
    const pTokenMain = document.getElementById('pTokenMain');

    if (this.isAuthenticated && this.currentUser) {
      let bTokenAmount = '0.000000';
      let pTokenAmount = 0;
      
      // forceRefresh가 true이거나 localStorage에 값이 없을 때만 서버에서 가져오기
      const savedBalance = localStorage.getItem('currentBalance');
      if (!forceRefresh && savedBalance !== null) {
        // localStorage에 저장된 값이 있으면 그것을 사용
        bTokenAmount = parseFloat(savedBalance).toFixed(3);
        if (!this.userTokens) {
          this.userTokens = { B: 0, P: 0 };
        }
        this.userTokens.B = parseFloat(savedBalance);
      } else {
      try {
          // forceRefresh가 true이거나 localStorage에 값이 없을 때 서버에서 가져오기
        const response = await fetch(`${this.apiBase}/wallet/${this.currentUser.did}`);
        if (response.ok) {
          const walletData = await response.json();
          if (walletData.success) {
            bTokenAmount = walletData.balances.bToken.toFixed(3);
            pTokenAmount = walletData.balances.pToken || 0;
            
            // userTokens 객체 업데이트
            if (!this.userTokens) {
              this.userTokens = { B: 0, P: 0 };
            }
            this.userTokens.B = walletData.balances.bToken;
            this.userTokens.P = pTokenAmount;
            
              // localStorage에 저장
            localStorage.setItem('currentBalance', bTokenAmount);
            
            if (forceRefresh) {
              console.log(`💰 지갑 강제 새로고침 완료: ${bTokenAmount} B`);
            }
          }
        }
      } catch (error) {
        console.error('서버에서 지갑 정보를 가져올 수 없습니다:', error);
          // 기본값 설정
          bTokenAmount = '0.000000';
        if (!this.userTokens) {
            this.userTokens = { B: 0, P: 0 };
          } else {
            this.userTokens.B = 0;
        }
          localStorage.setItem('currentBalance', bTokenAmount);
        }
        
        // Founder 계정인 경우 P토큰만 보장 (B토큰은 사용 가능)
        if (this.currentUser.isFounder) {
          if (pTokenAmount < 120) {
            pTokenAmount = 120;
          }
          
        if (!this.userTokens) {
            this.userTokens = { B: parseFloat(bTokenAmount), P: pTokenAmount };
        } else {
            this.userTokens.B = parseFloat(bTokenAmount);
            this.userTokens.P = pTokenAmount;
          }
        }
      }
      
      // BMR 그래프에서 계산된 시간당 발행량 사용
      let hourlyBMR = '0.000000'; // 기본값 0으로 변경
      
      // Founder 계정은 BMR 없음 (토큰 사용만 가능)
      if (this.currentUser.isFounder) {
        hourlyBMR = '0.000000';
      }
      // 기여가치가 바로 입금되는 단순한 시스템으로 변경
      // BMR 계산 제거
      
      // 대시보드 업데이트
      if (bTokenBalance) bTokenBalance.textContent = `${bTokenAmount} B`;
      if (hourlyRate) hourlyRate.textContent = hourlyBMR;
      
      // 지갑 페이지 업데이트
      if (bTokenMain) bTokenMain.textContent = `${bTokenAmount} B`;
      if (currentMiningRate) currentMiningRate.textContent = `${hourlyBMR} B/시간`;
      if (pTokenMain) pTokenMain.textContent = `${pTokenAmount} P`;
      
      // 토큰 발행 시스템 시작
      this.startMiningSystem(parseFloat(hourlyBMR));
      
      // 검증자 풀 금액 로드
      const savedPoolAmount = localStorage.getItem('baekya_validator_pool');
      
      // 초기 로드 시 서버에서 프로토콜 전체 상태 가져오기
      if (this.currentUser && this.currentUser.did) {
        // 검증자 풀이나 DAO 금고 정보가 없으면 서버에서 가져오기
        if (!savedPoolAmount || !localStorage.getItem('baekya_dao_treasuries')) {
          try {
            const stateResponse = await fetch(`${this.apiBase}/protocol-state`);
            if (stateResponse.ok) {
              const state = await stateResponse.json();
              
              if (state.success) {
                // 검증자 풀 업데이트
                if (state.validatorPool !== undefined) {
                  localStorage.setItem('baekya_validator_pool', state.validatorPool.toString());
                  console.log('🏦 검증자 풀 초기 동기화:', state.validatorPool);
                }
                
                // DAO 금고 업데이트
                if (state.daoTreasuries) {
                  localStorage.setItem('baekya_dao_treasuries', JSON.stringify(state.daoTreasuries));
                  console.log('💰 DAO 금고 초기 동기화:', state.daoTreasuries);
                }
              }
            }
          } catch (error) {
            console.error('프로토콜 상태 초기 조회 실패:', error);
          }
        }
      }
      
      // localStorage에서 최신 값 다시 읽기 (서버 동기화 후 업데이트된 값)
      const updatedPoolAmount = localStorage.getItem('baekya_validator_pool');
      const poolAmount = parseFloat(updatedPoolAmount || savedPoolAmount || '0');
      const validatorPool = document.getElementById('validatorPoolMain');
      if (validatorPool) {
        validatorPool.textContent = `${poolAmount.toFixed(3)} B`;
      }
      
      // 대시보드의 검증자 풀 표시도 업데이트
      const validatorPoolDashboard = document.getElementById('validatorPool');
      if (validatorPoolDashboard) {
        validatorPoolDashboard.textContent = `${poolAmount.toFixed(3)} B`;
      }
      
      // DAO 금고 정보 업데이트
      const savedDaoTreasuries = localStorage.getItem('baekya_dao_treasuries');
      if (savedDaoTreasuries) {
        try {
          const daoTreasuries = JSON.parse(savedDaoTreasuries);
          
          // 각 DAO의 금고 업데이트
          Object.keys(daoTreasuries).forEach(daoId => {
            const treasuryAmount = daoTreasuries[daoId] || 0;
            const treasuryElement = document.querySelector(`[data-dao-treasury="${daoId}"]`);
            if (treasuryElement) {
              treasuryElement.textContent = `${treasuryAmount.toFixed(6)} B`;
            }
          });
          
          // 대시보드의 DAO 금고 총액 표시
          const totalTreasury = Object.values(daoTreasuries).reduce((sum, val) => sum + (val || 0), 0);
          const daoTreasuryTotal = document.getElementById('daoTreasuryTotal');
          if (daoTreasuryTotal) {
            daoTreasuryTotal.textContent = `${totalTreasury.toFixed(6)} B`;
          }
        } catch (error) {
          console.error('DAO 금고 정보 파싱 오류:', error);
        }
      }
    } else {
      // 대시보드 리셋
      if (bTokenBalance) bTokenBalance.textContent = '0 B';
      if (hourlyRate) hourlyRate.textContent = '0';
      
      // 지갑 페이지 리셋
      if (bTokenMain) bTokenMain.textContent = '0 B';
      if (currentMiningRate) currentMiningRate.textContent = '0 B/시간';
      if (pTokenMain) pTokenMain.textContent = '0 P';
      
      // 토큰 발행 시스템 중지
      this.stopMiningSystem();
    }
  }



  // 특정 DAO의 거버넌스 탭으로 이동
  goToDAOGovernance(daoId) {
    // 거버넌스 탭으로 전환
    document.querySelector('.tab-btn[data-tab="governance"]').click();
    
    // 해당 DAO 필터로 설정
    setTimeout(() => {
      this.switchDAOFilter(daoId);
    }, 100);
  }

  // 소속 DAO 카드 토글
  async toggleMyDAOCard() {
    const content = document.getElementById('daoCardContent');
    const icon = document.getElementById('daoToggleIcon');
    
    if (content.style.display === 'none') {
      // 기여내역 확인하기를 클릭할 때 검증자 DAO 상태 업데이트
      await this.updateValidatorDAOStatus();
      this.loadMyDAOs(); // DAO 목록 로드
      content.style.display = 'block';
      content.classList.remove('hiding');
      content.classList.add('showing');
      icon.classList.remove('fa-chevron-down');
      icon.classList.add('fa-chevron-up');
      icon.classList.add('rotated');
    } else {
      content.style.display = 'none';
      content.classList.remove('showing');
      content.classList.add('hiding');
      icon.classList.remove('fa-chevron-up');
      icon.classList.add('fa-chevron-down');
      icon.classList.remove('rotated');
    }
  }

  getContributionIcon(type) {
    const icons = {
      'code': 'fas fa-code',
      'community': 'fas fa-users',
      'marketing': 'fas fa-bullhorn',
      'opinion_proposal': 'fa-lightbulb',
      'pull_request': 'fa-code-branch',
      'code_review': 'fa-search',
      'bug_report': 'fa-bug',
      'invite_link': 'fa-user-plus',
      'github_integration': 'fa-github',
      'final_rejection': 'fa-gavel',
      'invitation': 'fa-user-plus'
    };
    return icons[type] || 'fas fa-star';
  }

  getContributionTypeName(type) {
    const names = {
      'code': '코드 기여',
      'community': '커뮤니티 기여',
      'marketing': '마케팅 기여',
      'opinion_proposal': '의견 제안',
      'pull_request': '풀 리퀘스트',
      'code_review': '코드 리뷰',
      'bug_report': '버그 리포트',
      'invite_link': '초대 링크',
      'github_integration': 'GitHub 연동',
      'final_rejection': '최종 거부',
      'invitation': '멤버 초대'
    };
    return names[type] || '기여';
  }

  async loadDashboard() {
    // 즉시 기본 데이터 표시
    this.updateUserProfile();
    this.updateTokenBalances();
    this.initializeMyDAOCard(); // 초기 상태를 닫힌 상태로 설정
    
    // 백그라운드에서 추가 데이터 로드
    setTimeout(() => {
      this.loadContributionHistory();
    }, 100);
    
    // BMR 시스템 제거로 해당 코드 삭제
  }

  // 대시보드 로드 시 DAO 카드는 닫힌 상태로 유지
  initializeMyDAOCard() {
    const content = document.getElementById('daoCardContent');
    const icon = document.getElementById('daoToggleIcon');
    
    if (content && icon) {
      content.style.display = 'none';
      icon.classList.remove('fa-chevron-up', 'rotated');
      icon.classList.add('fa-chevron-down');
    }
  }

  // 검증자 DAO 상태 업데이트
  async updateValidatorDAOStatus() {
    if (!this.isAuthenticated) return;
    
    try {
      // 서버에서 최신 기여내역 가져오기
      await this.loadServerContributions();
      
      const contributions = this.getUserContributions();
      const hasValidatorContributions = contributions.some(contrib => contrib.dao === 'validator-dao');
      
      if (hasValidatorContributions) {
        const dynamicDAOs = JSON.parse(localStorage.getItem('userDAOs') || '[]');
        const hasValidatorDAO = dynamicDAOs.some(dao => dao.id === 'validator-dao');
        
        if (!hasValidatorDAO) {
          const validatorDAO = {
            id: 'validator-dao',
            name: 'Validator DAO',
            icon: 'fa-shield-alt',
            role: 'Member',
            contributions: this.getDAOContributionCount('validator-dao'),
            lastActivity: this.getLastActivityTime('validator-dao'),
            joinedAt: Date.now()
          };
          
          dynamicDAOs.push(validatorDAO);
          localStorage.setItem('userDAOs', JSON.stringify(dynamicDAOs));
          
          console.log('✅ 검증자DAO 업데이트:', validatorDAO);
        }
      }
    } catch (error) {
      console.error('검증자 DAO 상태 업데이트 실패:', error);
    }
  }

  // 서버에서 기여내역 로드
  async loadServerContributions() {
    if (!this.currentUser || !this.currentUser.did) return;
    
    try {
      const response = await fetch(`/api/contributions/${this.currentUser.did}`);
      const result = await response.json();
      
      if (result.success && result.contributions.length > 0) {
        // 서버에서 가져온 기여내역을 로컬 스토리지 형식으로 변환
        const formattedContributions = result.contributions.map(contrib => ({
          id: contrib.id,
          type: contrib.type,
          title: contrib.title,
          dao: contrib.daoId,
          date: new Date(contrib.verifiedAt || contrib.createdAt).toISOString().split('T')[0],
          bTokens: contrib.bValue || 0,
          status: contrib.verified ? 'verified' : 'pending',
          description: contrib.description
        }));
        
        // 로컬 스토리지에 저장
        const contributionsKey = `baekya_contributions_${this.currentUser.did}`;
        localStorage.setItem(contributionsKey, JSON.stringify(formattedContributions));
        
        console.log(`✅ 서버에서 기여내역 ${formattedContributions.length}건 로드됨`);
      }
    } catch (error) {
      console.error('서버 기여내역 로드 실패:', error);
    }
  }

  loadContributionHistory() {
    const historyContainer = document.getElementById('contributionHistory');
    if (!historyContainer) return;

    // 로그인하지 않은 경우 빈 상태 표시
    if (!this.isAuthenticated) {
      historyContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-sign-in-alt"></i>
          <p>로그인이 필요합니다</p>
                          <small>기여 내역을 확인하려면 로그인을 완료하세요</small>
        </div>
      `;
      return;
    }
    
    // 캐시 확인
    if (this.dataCache.contributions) {
      this.renderContributionHistory(this.dataCache.contributions);
      return;
    }

    // 실제 기여 내역 가져오기
    const contributions = this.getUserContributions();

    this.dataCache.contributions = contributions;
    this.renderContributionHistory(contributions);
  }
  
  // 사용자 기여 내역 가져오기
  getUserContributions() {
    if (!this.currentUser || !this.currentUser.did) return [];
    
    // 로컬 스토리지에서 사용자별 기여 내역 가져오기
    const contributionsKey = `baekya_contributions_${this.currentUser.did}`;
    const storedContributions = localStorage.getItem(contributionsKey);
    
    if (storedContributions) {
      return JSON.parse(storedContributions);
    }
    
    // 초기 상태는 빈 배열
    return [];
  }

  renderContributionHistory(contributions) {
    const container = document.getElementById('contributionHistory');
    if (!container) return;

    if (contributions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>아직 기여 내역이 없습니다</p>
          <small>프로토콜에 첫 기여를 해보세요!</small>
        </div>
      `;
      return;
    }

    container.innerHTML = contributions.map(contribution => `
      <div class="contribution-item">
        <div class="contribution-header">
          <div class="contribution-type">
            <i class="fas ${this.getContributionIcon(contribution.type)}"></i>
            <span>${this.getContributionTypeName(contribution.type)}</span>
          </div>
          ${contribution.dao ? `<div class="contribution-dao">${contribution.dao}</div>` : ''}
        </div>
        <div class="contribution-content">
          <h4>${contribution.title}</h4>
          <div class="contribution-meta">
            <span class="contribution-date">${contribution.date}</span>
            ${contribution.status === 'verified' ? `
              <span class="contribution-rewards">
                <span class="b-token-reward">+${contribution.bTokens} B</span>
              </span>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  loadMyDAOs() {
    const myDAOList = document.getElementById('myDAOList');
    if (!myDAOList) return;

    // 중앙집중화된 사용자 DAO 데이터 가져오기
    const myDAOs = this.getUserMyDAOsData();

    if (myDAOs.length === 0) {
      myDAOList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users" style="font-size: 2rem; color: var(--text-tertiary); margin-bottom: 0.5rem;"></i>
          <p>소속된 DAO가 없습니다.</p>
        </div>
      `;
      return;
    }

    myDAOList.innerHTML = myDAOs.map(dao => {
      const daoNotifications = this.notifications?.dao?.[dao.id] || { contribution: 0, participation: 0 };
      const totalNotifications = daoNotifications.contribution + daoNotifications.participation;
      
      // undefined 방지를 위한 기본값 설정
      const contributions = dao.contributions !== undefined ? dao.contributions : this.getDAOContributionCount(dao.id);
      const lastActivity = dao.lastActivity || this.getLastActivityTime(dao.id);
      
      return `
        <div class="my-dao-item" data-dao-id="${dao.id}">
          <div class="dao-info" onclick="window.dapp.showDAODetail('${dao.id}')" style="cursor: pointer;">
          <div class="dao-name">${dao.name}</div>
          <div class="dao-role">${dao.role}</div>
            ${totalNotifications > 0 ? `<div class="dao-card-notification">${totalNotifications > 99 ? '99+' : totalNotifications}</div>` : ''}
        </div>
        <div class="dao-stats">
          <div class="dao-stat">
            <span class="stat-label">기여</span>
            <span class="stat-value">${contributions}건</span>
          </div>
          <div class="dao-stat">
            <span class="stat-label">최근 활동</span>
            <span class="stat-value">${lastActivity}</span>
          </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async loadWallet() {
    const biometricSection = document.getElementById('biometricSection');
    const walletInfo = document.getElementById('walletInfo');
    
    // 먼저 모든 요소 숨기기
    if (biometricSection) biometricSection.style.display = 'none';
    if (walletInfo) {
      walletInfo.style.display = 'none';
      walletInfo.classList.remove('authenticated');
    }
    
    if (!this.isAuthenticated) {
      // 비인증 상태에서는 생체인증 섹션만 표시
      if (biometricSection) biometricSection.style.display = 'block';
    } else {
      // 인증 완료 후에는 지갑 정보 표시
      if (walletInfo) {
        walletInfo.classList.add('authenticated');
        walletInfo.style.display = 'block';
      }
      
      await this.updateTokenBalances();
      this.updateAddressDisplay();
      this.setupTransferForm();
      
      // 기여 데이터 로드
      this.loadUserContributions();
      
      // BMR 시스템 제거로 해당 코드 삭제
    }
  }





  setupTransferForm() {
    const transferForm = document.getElementById('transferForm');
    const transferAmount = document.getElementById('transferAmount');
    
    if (transferForm && !transferForm.hasAttribute('data-setup')) {
      transferForm.setAttribute('data-setup', 'true');
      transferForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleTokenTransfer();
      });
    }

    // 전송 금액 입력 시 수수료 계산 표시
    if (transferAmount && !transferAmount.hasAttribute('data-setup')) {
      transferAmount.setAttribute('data-setup', 'true');
      transferAmount.addEventListener('input', (e) => {
        this.updateTransferSummary(e.target.value);
      });
    }
  }

  updateTransferSummary(amount) {
    const transferSummary = document.getElementById('transferSummary');
    const transferAmountDisplay = document.getElementById('transferAmountDisplay');
    const transferFeeDisplay = document.getElementById('transferFeeDisplay');
    const totalAmountDisplay = document.getElementById('totalAmountDisplay');
    
    if (!transferSummary || !transferAmountDisplay || !totalAmountDisplay) return;
    
    const amountNum = parseFloat(amount) || 0;
    const fee = amountNum * 0.001; // 0.1% 수수료
    const total = amountNum + fee;
    
    if (amountNum > 0) {
      transferSummary.style.display = 'block';
      transferAmountDisplay.textContent = `${amountNum.toFixed(3)} B`;
      if (transferFeeDisplay) {
        transferFeeDisplay.textContent = `${fee.toFixed(3)} B`;
      }
      totalAmountDisplay.textContent = `${total.toFixed(3)} B`;
    } else {
      transferSummary.style.display = 'none';
    }
  }

  async handleTokenTransfer() {
    const recipientAddress = document.getElementById('recipientAddress').value;
    const transferAmount = document.getElementById('transferAmount').value;
    const transferMemo = document.getElementById('transferMemo').value;

    if (!recipientAddress || !transferAmount) {
      alert('받는 주소와 전송량을 입력해주세요.');
      return;
    }

    const amount = parseFloat(transferAmount);
    if (amount <= 0) {
      alert('전송량은 0보다 커야 합니다.');
      return;
    }

    // 수수료 계산 (0.1%)
    const fee = amount * 0.001; // 0.1%
    const totalRequired = amount + fee;
    
    // 잔액 확인
    const currentBalance = this.userTokens?.B || 0;
    if (totalRequired > currentBalance) {
      alert(`잔액이 부족합니다.\n필요: ${totalRequired.toFixed(3)} B\n보유: ${currentBalance.toFixed(3)} B`);
      return;
    }

    // 본인 인증 (지문/얼굴/비밀번호 중 택1)
    const authConfirmed = await this.requestAuthentication('토큰 전송');
    if (!authConfirmed) {
      return;
    }

    try {
      // 디버깅 로그
      console.log('토큰 전송 시도:');
      console.log('- currentUser.did:', this.currentUser?.did);
      console.log('- sessionId:', this.sessionId);
      console.log('- recipientAddress:', recipientAddress);
      console.log('- amount:', amount);
      console.log('- lastAuthPassword 존재:', !!this.lastAuthPassword);
      
      if (!this.currentUser || !this.currentUser.did) {
        alert('로그인이 필요합니다. 다시 로그인해주세요.');
        return;
      }
      
      // 서버 API 호출
      const response = await fetch('/api/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionId}`
        },
        body: JSON.stringify({
          fromDID: this.currentUser.did,
          toAddress: recipientAddress, // DID, 통신주소, 아이디 모두 가능
          amount: amount,
          tokenType: 'B-Token',
          memo: transferMemo,
          authData: {
            password: this.lastAuthPassword || '' // 인증 시 입력한 비밀번호
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        // 성공 메시지 표시
        this.showSuccessMessage(
          `${amount.toFixed(3)} B-Token이 ${recipientAddress}로 전송되었습니다.\n` +
          `수수료: ${fee.toFixed(3)} B (검증자 풀: ${result.feeDistribution.validatorPool.toFixed(3)}B, DAO: ${result.feeDistribution.dao.toFixed(3)}B)\n` +
          `블록 #${result.blockNumber}`
        );
        
        // 거래내역에 기록
        const recipientDisplay = result.recipient.address;
        this.addTransaction('sent', recipientDisplay, amount, transferMemo, 'confirmed', recipientDisplay);
    
    // 폼 리셋
    document.getElementById('transferForm').reset();
    this.updateTransferSummary(0);
    
        // 잔액 업데이트 (서버에서 받은 데이터로)
      this.updateTokenBalances();
      } else {
        this.showErrorMessage(result.error || '토큰 전송에 실패했습니다.');
      }
    } catch (error) {
      console.error('토큰 전송 오류:', error);
      this.showErrorMessage('토큰 전송 중 오류가 발생했습니다.');
    }
  }

  async confirmPassword(message) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal active password-confirm-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fas fa-lock"></i> 비밀번호 확인</h3>
          </div>
          <div class="modal-body">
            <p>${message}</p>
            <div class="form-group">
              <label for="passwordConfirm">비밀번호</label>
              <input type="password" id="passwordConfirm" placeholder="비밀번호를 입력하세요" autofocus>
            </div>
            <div class="modal-actions">
              <button class="btn-secondary" id="cancelPasswordBtn">취소</button>
              <button class="btn-primary" id="confirmPasswordBtn">확인</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const passwordInput = document.getElementById('passwordConfirm');
      const confirmBtn = document.getElementById('confirmPasswordBtn');
      const cancelBtn = document.getElementById('cancelPasswordBtn');
      
      const cleanup = () => {
        modal.remove();
      };
      
      confirmBtn.addEventListener('click', () => {
        const password = passwordInput.value;
        if (!password) {
          alert('비밀번호를 입력해주세요.');
          return;
        }
        
        // 비밀번호 검증
        // 현재 로그인된 사용자 또는 기존 사용자 데이터 찾기
        let userData = this.currentUser;
        if (!userData && this.existingUserData) {
          userData = this.existingUserData;
        }
        
        if (!userData) {
          // 로컬 스토리지에서 사용자 데이터 찾기
          const users = JSON.parse(localStorage.getItem('baekya_users') || '[]');
          if (users.length > 0) {
            userData = users[0]; // 첫 번째 사용자 (데모에서는 단일 사용자)
          }
        }
        
        if (userData && this.verifyPassword(password, userData)) {
          cleanup();
          resolve(true);
        } else {
          alert('비밀번호가 올바르지 않습니다.');
          passwordInput.value = '';
          passwordInput.focus();
        }
      });
      
      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
      
      // Enter 키 처리
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          confirmBtn.click();
        }
      });
    });
  }



  // 비밀번호 인증 시스템
  async requestAuthentication(purpose = '본인 확인') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal active auth-password-modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
          <div class="modal-header">
            <h3><i class="fas fa-shield-alt"></i> 본인 인증</h3>
          </div>
          <div class="modal-body">
            <p>${purpose}을 위해 비밀번호 인증이 필요합니다.</p>
            <div class="form-group">
              <label for="authPassword">비밀번호</label>
              <input type="password" id="authPassword" placeholder="비밀번호를 입력하세요" autocomplete="current-password" autofocus>
            </div>
            <div class="modal-actions" style="margin-top: 1.5rem;">
              <button class="btn-secondary" id="cancelAuthBtn">취소</button>
              <button class="btn-primary" id="confirmAuthBtn">확인</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const passwordInput = document.getElementById('authPassword');
      const cancelBtn = document.getElementById('cancelAuthBtn');
      const confirmBtn = document.getElementById('confirmAuthBtn');
      
      const cleanup = () => {
        modal.remove();
      };
      
      const handleAuth = async () => {
        const password = passwordInput.value;
        if (!password) {
          this.showErrorMessage('비밀번호를 입력해주세요.');
          return;
        }
        
        const success = await this.performAuthentication('password', password);
        if (success) {
          this.lastAuthPassword = password; // 인증된 비밀번호 저장
        }
          cleanup();
          resolve(success);
      };
      
      confirmBtn.addEventListener('click', handleAuth);
      
      // Enter 키로도 인증 가능
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleAuth();
        }
      });
      
      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
    });
  }

  async performAuthentication(method, password = null) {
    switch (method) {
      case 'fingerprint':
        return await this.authenticateFingerprint();
      case 'password':
        return await this.authenticatePassword(password);
      default:
        return false;
    }
  }

  async authenticateFingerprint() {
    // 실제 지문 인증
    return new Promise(async (resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal active fingerprint-auth-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fas fa-fingerprint"></i> 지문 인증</h3>
          </div>
          <div class="modal-body">
            <div class="auth-animation">
              <i class="fas fa-fingerprint fingerprint-icon"></i>
              <p>지문을 스캔해주세요...</p>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      try {
        // 실제 생체인증 실행
        const result = await this.performBiometricAuth('fingerprint');
        modal.remove();
        resolve(result);
      } catch (error) {
        console.error('지문 인증 실패:', error);
        modal.remove();
        this.showErrorMessage('지문 인증에 실패했습니다.');
        resolve(false);
      }
    });
  }



  async authenticatePassword(password) {
    // 비밀번호 인증
    if (!password) {
      return false;
    }
    
    // 현재 로그인된 사용자 또는 기존 사용자 데이터 찾기
    let userData = this.currentUser;
    if (!userData && this.existingUserData) {
      userData = this.existingUserData;
    }
    
    if (!userData) {
      // 로컬 스토리지에서 사용자 데이터 찾기
      const authData = localStorage.getItem('baekya_auth');
      if (authData) {
        userData = JSON.parse(authData);
      }
    }
    
    if (!userData) {
      // baekya_users에서 찾기
      const users = JSON.parse(localStorage.getItem('baekya_users') || '[]');
      if (users.length > 0) {
        userData = users[0]; // 첫 번째 사용자 (데모에서는 단일 사용자)
      }
    }
    
    if (userData && this.verifyPassword(password, userData)) {
      return true;
    } else {
      this.showErrorMessage('비밀번호가 올바르지 않습니다.');
      return false;
    }
  }

  async loadDAOs() {
    // 기본 DAO 데이터 (커뮤니티와 개발 DAO, 검증자 DAO)
    const defaultDAOs = [
      {
        id: 'dev-dao',
        name: 'Development DAO',
        description: '프로토콜 개발 및 개선을 담당하는 거버넌스형 컨소시엄',
        memberCount: 28,
        totalContributions: 456,
        isDefault: true
      },
      {
        id: 'community-dao',
        name: 'Community DAO',
        description: '사용자 참여를 도모하는 프로토콜 증진 컨소시엄',
        memberCount: 142,
        totalContributions: 234,
        isDefault: true
      },
      {
        id: 'validator-dao',
        name: 'Validator DAO',
        description: '블록 생성 및 검증의 네트워크 보안/유지 컨소시엄',
        memberCount: 5,
        totalContributions: 720,
        isDefault: true,
        isValidator: true
      }
    ];
    
    // localStorage에서 사용자가 생성한 DAO 로드
    const userCreatedDAOs = this.loadUserCreatedDAOs();
    
    // 기본 DAO와 사용자 생성 DAO 합치기
    const allDAOs = [...defaultDAOs, ...userCreatedDAOs];
    
    this.renderDAOGrid(allDAOs);
    
    // DAO 필터 버튼 업데이트
    this.updateDAOListButtons();
    
    // TOP-OP DAO 생성 섹션 표시 확인
    this.checkTopOPDAOCreationAccess();
  }

  // 사용자가 생성한 DAO 로드
  loadUserCreatedDAOs() {
    try {
      const stored = localStorage.getItem('baekya_user_created_daos');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('사용자 생성 DAO 로드 실패:', error);
    }
    return [];
  }

  // 새 DAO를 저장소에 추가
  saveUserCreatedDAO(dao) {
    try {
      const userDAOs = this.loadUserCreatedDAOs();
      userDAOs.push(dao);
      localStorage.setItem('baekya_user_created_daos', JSON.stringify(userDAOs));
    } catch (error) {
      console.error('DAO 저장 실패:', error);
    }
  }

  renderDAOGrid(daos) {
    const daoGrid = document.getElementById('daoGrid');
    if (!daoGrid) return;

    daoGrid.innerHTML = '';

    daos.forEach(dao => {
      const daoCard = this.createDAOCard(dao);
      daoGrid.appendChild(daoCard);
    });
  }

  createDAOCard(dao) {
    const card = document.createElement('div');
    card.className = 'status-card dao-card my-dao-card';
    card.setAttribute('data-dao-id', dao.id);
    
    const dcaCount = this.getUserDCACount(dao.id);
    
    card.innerHTML = `
      <div class="card-header">
        <h3><i class="fas fa-users"></i> ${dao.name}</h3>
      </div>
      <div class="card-content">
        <p class="dao-description">${dao.description}</p>
        <div class="dao-actions">
          <button class="btn-primary" onclick="window.dapp.joinDAO('${dao.id}')">
            <i class="fas fa-plus"></i> 참여하기
          </button>
          <button class="btn-secondary" onclick="window.dapp.showDAODetail('${dao.id}')">
            <i class="fas fa-history"></i> 기여내역 보기
          </button>
        </div>
      </div>
    `;

    return card;
  }



  async joinDAO(daoId) {
    if (!this.isAuthenticated) {
              alert('DAO 참여를 위해서는 먼저 로그인이 필요합니다.');
      return;
    }

    // DAO별 참여 옵션 표시
    this.showDAOJoinOptions(daoId);
  }

  // DAO별 참여 안내문 가져오기
  getDAOJoinGuideText(daoId) {
    switch(daoId) {
      case 'dev-dao':
        return '개발DAO는 누구나 접근가능한 이슈리폿(안건제안)과 PR(피드백)을 지원함으로써 탈중앙화 거버넌스를 실현합니다.';
      case 'community-dao':
        return '사용자 네트워크 형성 기여에 필수적인 탈중앙화 조직으로, 누구나 아래의 지정기여활동(DCA)에 따라 기여할 수 있습니다.';
      case 'validator-dao':
        return '프로토콜 네트워크 형성 기여에 필수적인 탈중앙화 조직으로, 누구나 아래의 지정기여활동(DCA)에 따라 기여할 수 있습니다.';
              default:
          return '누구나 아래의 지정기여활동(DCA)에 따라 기여할 수 있습니다.';
    }
  }

  showDAOJoinOptions(daoId) {
    // 기존 DAO 참여 모달이 있다면 제거
    const existingModal = document.querySelector('.dao-participate-modal');
    if (existingModal) {
      existingModal.closest('.modal').remove();
    }
    
    // 모든 DAO 목록에서 현재 DAO 찾기
    const allDAOs = [...this.loadUserCreatedDAOs()];
    const defaultDAOs = {
      'dev-dao': 'Development DAO',
      'community-dao': 'Community DAO',
      'validator-dao': 'Validator DAO'
    };
    
    // DAO 이름 가져오기
    let daoName = defaultDAOs[daoId];
    if (!daoName) {
      const userDAO = allDAOs.find(dao => dao.id === daoId);
      daoName = userDAO ? userDAO.name : 'Unknown DAO';
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    modal.innerHTML = `
      <div class="modal-content dao-participate-modal">
        <div class="modal-header">
          <h3>${daoName} 참여하기</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <!-- 1. 안내창 -->
          <div class="dao-info-section">
            <div class="dao-info">
                <i class="fas fa-info-circle"></i>
                <p>${this.getDAOJoinGuideText(daoId)}</p>
            </div>
          </div>

          <!-- 2. DCA 리스트 -->
          <div class="dca-list-section">
            <div class="dca-header">
              <h4><i class="fas fa-tasks"></i> 지정기여활동 (DCA) 목록</h4>
              ${this.getUserOPRole().isTopOP ? `
                <div class="dca-management">
                  <button class="btn-secondary btn-small" onclick="window.dapp.addDCA('${daoId}')">
                    <i class="fas fa-plus"></i> 추가
                  </button>
                  <button class="btn-secondary btn-small" onclick="window.dapp.editDCAList('${daoId}')">
                    <i class="fas fa-edit"></i> 편집
                  </button>
                </div>
              ` : ''}
            </div>
            <div class="dca-list" id="dcaList-${daoId}">
              ${this.renderDCAList(daoId)}
            </div>
          </div>

          <!-- 3. 기여하러가기 박스 -->
          <div class="contribution-action-section">
            ${this.renderContributionActions(daoId)}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  async setupGitHubIntegration(daoId) {
    // Firebase Auth GitHub 연동 모달 표시
    this.showFirebaseGitHubIntegrationModal(daoId);
  }

  showFirebaseGitHubIntegrationModal(daoId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>GitHub 계정 연동</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="github-integration-form">
            <div class="integration-info">
              <h4>🎯 백야 프로토콜 개발 참여 방법</h4>
              <ol>
                <li><strong>GitHub 계정 연동:</strong> 아래 버튼을 클릭하여 안전하게 계정을 연동합니다</li>
                <li><strong>저장소 포크:</strong> <code>baekya-protocol/baekya-protocol</code> 저장소를 포크합니다</li>
                <li><strong>코드 수정:</strong> 포크한 저장소에서 원하는 기능을 개발합니다</li>
                <li><strong>PR 생성:</strong> 원본 저장소에 Pull Request를 생성합니다</li>
                <li><strong>자동 보상:</strong> PR이 병합되면 자동으로 250B가 지급됩니다</li>
              </ol>
            </div>
            
            <div class="integration-preview">
              <h4>DCA 보상 체계:</h4>
              <ul>
                <li>Pull Request (자기 이슈): <strong>250B</strong></li>
                <li>Pull Request (남의 이슈): <strong>280B</strong></li>
                <li>Issue 리포트: <strong>80B</strong></li>
              </ul>
              <div class="reward-explanation">
                <p><small>💡 <strong>자기 이슈</strong>: 본인이 작성한 이슈에 대한 PR<br>
                <strong>남의 이슈</strong>: 다른 사용자가 작성한 이슈 해결 PR (+30B 보너스)</small></p>
              </div>
            </div>
            
            <div class="firebase-auth-info">
              <div class="security-note">
                <i class="fas fa-shield-alt"></i>
                <span>Firebase Authentication을 통해 안전하게 GitHub 계정을 연동합니다.</span>
              </div>
            </div>
            
            <div class="form-actions">
              <button class="btn-primary" id="connectGitHub" onclick="window.dapp.processFirebaseGitHubIntegration('${daoId}')">
                <i class="fab fa-github"></i> GitHub 계정 연결
              </button>
              <button class="btn-secondary" onclick="this.closest('.modal').remove()">
                취소
              </button>
            </div>
            
            <div class="user-info" id="userInfo">
              <!-- GitHub 사용자 정보가 여기에 표시됩니다 -->
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

    async processFirebaseGitHubIntegration(daoId) {
    // 먼저 기존 연동 상태 확인 (모바일에서도 확인 가능)
    const existingIntegration = await this.checkGitHubIntegrationStatus(daoId);
    
    if (existingIntegration) {
      // 이미 연동되어 있으면 성공 모달 바로 표시
      console.log('🔗 기존 GitHub 연동 정보 발견:', existingIntegration);
      
      // 기존 연동 정보로 성공 모달 표시
      const mockResult = {
        user: {
          displayName: existingIntegration.displayName || existingIntegration.githubUsername,
          photoURL: existingIntegration.photoURL || '/icons/icon-192x192.png',
          reloadUserInfo: {
            screenName: existingIntegration.githubUsername
          },
          email: `${existingIntegration.githubUsername}@github.local`
        }
      };
      
      this.showFirebaseGitHubIntegrationSuccess(mockResult, daoId, true);
      
      // GitHub 연동 모달 닫기
      const githubModal = document.querySelector('.modal');
      if (githubModal) {
        githubModal.remove();
      }
  
      // DAO 참여 모달 닫기
      const daoModal = document.querySelector('.dao-participate-modal');
      if (daoModal) {
        daoModal.closest('.modal').remove();
      }
      
      return; // 기존 연동이므로 여기서 종료
    }
    
    // 기존 연동이 없고 모바일인 경우 PC 진행 안내
    if (this.isMobile()) {
      this.showMobileGitHubWarning();
      return;
    }

    this.showLoadingMessage('GitHub 계정 연동 중...');
    
    try {
      // Firebase Auth를 통한 GitHub 로그인
      const result = await signInWithGitHub();
      

      
      if (result && result.user) {
        this.hideLoadingMessage();
        this.showFirebaseGitHubIntegrationSuccess(result, daoId, false);
        
        // GitHub 연동 모달 닫기
        const githubModal = document.querySelector('.modal');
        if (githubModal) {
          githubModal.remove();
        }
    
    // DAO 참여 모달 닫기
    const daoModal = document.querySelector('.dao-participate-modal');
    if (daoModal) {
      daoModal.closest('.modal').remove();
    }
        
        // 연동 상태를 로컬 스토리지에 저장
        this.saveFirebaseGitHubIntegration(daoId, {
          githubUsername: result.user.reloadUserInfo?.screenName || extractUsernameFromEmail(result.user.email),
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          targetRepository: 'baekya-protocol/baekya-protocol',
          connectedAt: new Date().toISOString(),
          uid: result.user.uid
        });
        
      } else {
        this.hideLoadingMessage();
        this.showErrorMessage('GitHub 계정 연동이 취소되었습니다.');
      }
      
    } catch (error) {
      this.hideLoadingMessage();
      if (error.code === 'auth/popup-closed-by-user') {
        this.showErrorMessage('GitHub 로그인이 취소되었습니다.');
      } else if (error.code === 'auth/popup-blocked') {
        this.showErrorMessage('팝업이 차단되었습니다. 팝업을 허용하고 다시 시도해주세요.');
      } else {
        this.showErrorMessage('GitHub 계정 연동 중 오류가 발생했습니다.');
      }
      console.error('Firebase GitHub 연동 오류:', error);
    }
  }

  saveGitHubIntegration(daoId, integrationData) {
    try {
      const key = `github_integration_${this.currentUser.did}`;
      const existing = JSON.parse(localStorage.getItem(key) || '{}');
      existing[daoId] = integrationData;
      localStorage.setItem(key, JSON.stringify(existing));
      
      console.log('GitHub 연동 정보 저장됨:', integrationData);
    } catch (error) {
      console.error('GitHub 연동 정보 저장 실패:', error);
    }
  }

  // 모바일 기기 감지
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  }

  // 모바일 GitHub 연동 경고 모달
  showMobileGitHubWarning() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📱 모바일 환경 안내</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="mobile-warning-content">
            <div class="warning-icon">
              <i class="fas fa-desktop"></i>
            </div>
            <h4>PC에서 GitHub 연동을 진행해주세요</h4>
            
            <div class="warning-reasons">
              <p><strong>모바일에서 GitHub 연동이 제한되는 이유:</strong></p>
              <ul>
                <li>📱 모바일 브라우저의 팝업 차단</li>
                <li>🔐 OAuth 인증 프로세스 복잡성</li>
                <li>💻 개발 도구 접근성 제한</li>
                <li>🔗 GitHub 웹 인터페이스 최적화</li>
              </ul>
            </div>
            
            <div class="pc-instructions">
              <h5>🖥️ PC에서 진행 방법:</h5>
              <ol>
                <li>PC 브라우저에서 <code>localhost:3000</code> 접속</li>
                <li>백야 프로토콜에 로그인</li>
                <li>DAO 탭 → 개발DAO 참여하기 → GitHub 계정 연동</li>
                <li>연동 완료 후 모바일에서도 이용 가능</li>
              </ol>
            </div>
            
            <div class="alternative-info">
              <p><strong>💡 참고:</strong> GitHub 연동은 한 번만 하면 되며, 연동 후에는 모바일에서도 개발DAO 활동을 확인할 수 있습니다.</p>
            </div>
            
            <div class="warning-actions">
              <button class="btn-primary" onclick="this.closest('.modal').remove()">
                <i class="fas fa-check"></i> 확인했습니다
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  saveFirebaseGitHubIntegration(daoId, integrationData) {
    try {
      const key = `github_integration_${this.currentUser.did}`;
      const existing = JSON.parse(localStorage.getItem(key) || '{}');
      existing[daoId] = integrationData;
      localStorage.setItem(key, JSON.stringify(existing));
      
      console.log('Firebase GitHub 연동 정보 저장됨:', integrationData);
    } catch (error) {
      console.error('Firebase GitHub 연동 정보 저장 실패:', error);
    }
  }

  showFirebaseGitHubIntegrationSuccess(result, daoId, isExisting = false) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    const githubUsername = result.user.reloadUserInfo?.screenName || 
                          result.user.providerData?.[0]?.displayName || 
                          (result.user.email ? result.user.email.split('@')[0] : 'unknown');
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${isExisting ? '✅ GitHub 계정 연동됨' : '🎉 GitHub 계정 연동 완료'}</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="success-message">
            <div class="success-icon">
              <i class="fas fa-check-circle"></i>
            </div>
            <div class="user-profile">
              <img src="${result.user.photoURL || '/icons/icon-192x192.png'}" alt="프로필" class="profile-image">
              <div class="user-details">
                <h4>${result.user.displayName || '사용자'}</h4>
                <p>@${githubUsername}</p>
              </div>
            </div>
            <p class="bonus-info">${isExisting ? '🔗 이미 연동된 GitHub 계정입니다!' : '🎁 GitHub 계정 연동 보너스 10B가 지급됩니다!'}</p>
            ${isExisting ? `
            <div class="existing-integration-info">
              <p><strong>타겟 저장소:</strong> baekya-protocol/baekya-protocol</p>
              <p><strong>연동 상태:</strong> 활성</p>
            </div>
            ` : ''}
          </div>
          
                      <div class="integration-guide">
              <h5>📋 개발 참여 방법</h5>
              <div class="step-guide">
                <div class="step">
                  <span class="step-number">1</span>
                  <div class="step-content">
                    <strong>저장소 포크</strong><br>
                    <code>${githubUsername}/baekya-protocol</code>로 포크 후 코드 수정
                  </div>
                </div>
                <div class="step">
                  <span class="step-number">2</span>
                  <div class="step-content">
                    <strong>Pull Request 생성</strong><br>
                    자기 이슈: 250B, 남의 이슈: 280B 자동 지급
                  </div>
                </div>
              </div>
              
              <div class="reward-details">
                <h6>🎁 보상 안내</h6>
                <ul>
                  <li><strong>자기 이슈</strong>: 본인이 작성한 이슈에 대한 PR (250B)</li>
                  <li><strong>남의 이슈</strong>: 다른 사용자가 작성한 이슈 해결 (+30B 보너스로 280B)</li>
                  <li><strong>이슈 리포트</strong>: 버그나 개선사항 리포트 (80B)</li>
                </ul>
              </div>
              
              <div class="quick-actions">
                <button class="btn-primary" onclick="window.dapp.openTargetRepository(); this.closest('.modal').remove();">
                  <i class="fab fa-github"></i> 백야 프로토콜 저장소 바로가기
                </button>
              </div>
            </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 5초 후 자동으로 모달 닫기
    setTimeout(() => {
      const modal = document.querySelector('.modal');
      if (modal) {
        modal.remove();
      }
    }, 5000);
  }

  showGitHubIntegrationSuccess(result, githubUsername, daoId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>🎉 GitHub 계정 연동 완료</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="success-message">
            <div class="success-icon">
              <i class="fas fa-check-circle"></i>
            </div>
            <h4>${githubUsername} 계정 연동이 완료되었습니다!</h4>
            <p class="bonus-info">🎁 GitHub 계정 연동 보너스 ${result.integrationBonus || 10}B가 지급됩니다!</p>
          </div>
          
          <div class="integration-guide">
            <h5>📋 개발 참여 방법</h5>
            <div class="step-guide">
              <div class="step">
                <span class="step-number">1</span>
                <div class="step-content">
                  <strong>저장소 포크</strong><br>
                  <code>${githubUsername}/baekya-protocol</code>로 포크 후 코드 수정
                </div>
              </div>
              <div class="step">
                <span class="step-number">2</span>
                <div class="step-content">
                  <strong>Pull Request 생성</strong><br>
                  원본 저장소로 PR 생성하면 자동으로 250B 지급
                </div>
              </div>
            </div>
            
            <div class="reward-info">
              <h6>🎁 보상 안내</h6>
              <ul>
                <li><strong>자기 이슈</strong>: 본인이 작성한 이슈에 대한 PR (250B)</li>
                <li><strong>남의 이슈</strong>: 다른 사용자가 작성한 이슈 해결 (+30B 보너스로 280B)</li>
                <li><strong>이슈 리포트</strong>: 버그나 개선사항 리포트 (80B)</li>
              </ul>
            </div>
            
            <div class="quick-actions">
              <button class="btn-primary" onclick="window.dapp.openTargetRepository(); this.closest('.modal').remove();">
                <i class="fab fa-github"></i> 백야 프로토콜 저장소 바로가기
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 3초 후 자동으로 모달 닫기
    setTimeout(() => {
      const modal = document.querySelector('.modal');
      if (modal) {
        modal.remove();
      }
    }, 5000);
  }

  openTargetRepository() {
    const targetRepoUrl = 'https://github.com/baekya-protocol/baekya-protocol';
    window.open(targetRepoUrl, '_blank');
    this.showSuccessMessage('백야 프로토콜 저장소를 새 탭에서 열었습니다. 포크하여 개발을 시작하세요!');
  }

  openGitHubProfile(githubUsername) {
    const profileUrl = `https://github.com/${githubUsername}`;
    window.open(profileUrl, '_blank');
    this.showSuccessMessage(`${githubUsername}의 GitHub 프로필을 새 탭에서 열었습니다.`);
  }

  // 기여 가이드 열기
  openContributionGuide(daoId) {
    if (daoId === 'dev-dao') {
      // 새 탭에서 DevDAO 기여 가이드 열기 (GitHub 저장소)
      window.open('https://github.com/baekya-protocol/baekya-protocol/blob/main/docs/devdao-contribution-guide.md', '_blank');
    }
  }

  // 기여 활동 섹션 렌더링
  renderContributionActions(daoId) {
    if (daoId === 'dev-dao') {
      // GitHub 연동 상태 확인
      const integrationStatus = this.checkGitHubIntegrationStatus(daoId);
      
      if (integrationStatus) {
        // 이미 연동된 경우
        return `
          <div class="contribution-action-box connected">
            <div class="action-header">
              <h4><i class="fas fa-check-circle"></i> GitHub 계정 연동 완료</h4>
            </div>
            <div class="connected-info">
              <p><strong>연동 계정:</strong> ${integrationStatus.githubUsername}</p>
              <p><strong>타겟 저장소:</strong> ${integrationStatus.targetRepository}</p>
              <p><strong>연동 일시:</strong> ${new Date(integrationStatus.connectedAt).toLocaleString()}</p>
            </div>
            <div class="dca-guide">
              <h5>DCA 수행 방법:</h5>
              <ol>
                <li>백야 프로토콜 저장소를 Fork하여 개인 계정으로 복사</li>
                <li>포크한 저장소에서 코드 수정 후 커밋</li>
                <li>원본 저장소로 Pull Request 생성</li>
                <li>PR이 Merge되면 자기 이슈: 250B, 남의 이슈: 280B 자동 지급</li>
              </ol>
            </div>
            <div class="action-buttons">
              <button class="btn-primary" onclick="window.dapp.openTargetRepository()">
                <i class="fab fa-github"></i> 백야 프로토콜 저장소
              </button>
              <button class="btn-secondary" onclick="window.dapp.openGitHubProfile('${integrationStatus.githubUsername}')">
                <i class="fas fa-user"></i> 내 GitHub 프로필
              </button>
            </div>
          </div>
        `;
      } else {
        // 연동되지 않은 경우
        return `
          <div class="contribution-action-box">
            <div class="action-header">
              <h4><i class="fab fa-github"></i> GitHub 계정 연동 필요</h4>
            </div>
            <div class="action-content">
              <p>개발DAO DCA를 수행하려면 먼저 GitHub 계정과 연동해야 합니다.</p>
              <div class="action-buttons">
                <button class="btn-primary" onclick="window.dapp.setupGitHubIntegration('${daoId}')">
                  <i class="fab fa-github"></i> GitHub 계정 연동
                </button>
                <button class="btn-secondary" onclick="window.dapp.openContributionGuide('${daoId}')">
                  <i class="fas fa-book"></i> 기여 가이드
                </button>
              </div>
            </div>
          </div>
        `;
      }
    }
    
    // 다른 DAO들은 기본 처리
    return `
      <div class="contribution-action-box">
        <div class="action-header">
          <h4><i class="fas fa-hands-helping"></i> 기여하러 가기</h4>
        </div>
        <div class="action-content">
          <div class="action-buttons">
            <button class="btn-primary" onclick="window.dapp.goToProposalCreation('${daoId}')">
              <i class="fas fa-lightbulb"></i> 제안 생성
            </button>
            <button class="btn-secondary" onclick="window.dapp.createInviteCode('${daoId}')">
              <i class="fas fa-user-plus"></i> 초대하기
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // PR 시뮬레이션 테스트
  async testPRSimulation() {
    const prNumber = prompt('테스트할 PR 번호를 입력하세요:', '1');
    const prTitle = prompt('PR 제목을 입력하세요:', 'Test PR for DCA');
    
    if (!prNumber || !prTitle) {
      alert('PR 번호와 제목을 모두 입력해주세요.');
      return;
    }
    
    const integrationStatus = await this.checkGitHubIntegrationStatus('dev-dao');
    if (!integrationStatus) {
      alert('GitHub 연동 정보를 찾을 수 없습니다.');
      return;
    }
    
    this.showLoadingMessage('PR 시뮬레이션 실행 중...');
    
    try {
      const response = await fetch(`${this.apiBase}/github/simulate-pr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userDID: this.currentUser.did,
          action: 'closed',
          prNumber: parseInt(prNumber),
          prTitle: prTitle,
          repository: integrationStatus.repository
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.hideLoadingMessage();
        this.showSuccessMessage(`🎉 PR 시뮬레이션 완료!\n\nPR #${prNumber} "${prTitle}"이 병합되었습니다.\n보상이 지급되었습니다. (자기 이슈: 250B, 남의 이슈: 280B)`);
      } else {
        this.hideLoadingMessage();
        this.showErrorMessage(`PR 시뮬레이션 실패: ${result.error}`);
      }
      
    } catch (error) {
      this.hideLoadingMessage();
      this.showErrorMessage('PR 시뮬레이션 중 오류가 발생했습니다.');
      console.error('PR 시뮬레이션 오류:', error);
    }
  }

  // 제안 생성 페이지로 이동
  goToProposalCreation(daoId) {
    // DAO 참여 모달 닫기
    const daoModal = document.querySelector('.dao-participate-modal');
    if (daoModal) {
      daoModal.closest('.modal').remove();
  }

    // 거버넌스 탭으로 이동
    const governanceTab = document.querySelector('[data-tab="governance"]');
    if (governanceTab) {
      governanceTab.click();
      
      setTimeout(() => {
        // 제안 과정으로 전환
        this.switchGovernanceProcess('proposal');
        
        // 제안 생성 버튼 강조 애니메이션
        this.highlightProposalButton();
      }, 200);
    }
  }

  // 제안 생성 버튼 강조 애니메이션
  highlightProposalButton() {
    // 모바일과 데스크톱 모두에서 제안 버튼 찾기
    const mobileProposalButton = document.querySelector('.mobile-proposal-btn');
    const desktopProposalButton = document.querySelector('.create-proposal-btn');
    
    // 모바일 제안 버튼 애니메이션
    if (mobileProposalButton) {
      mobileProposalButton.classList.add('highlight-animation');
      setTimeout(() => {
        mobileProposalButton.classList.remove('highlight-animation');
      }, 3000);
    }
    
    // 데스크톱 제안 버튼 애니메이션 (있는 경우)
    if (desktopProposalButton) {
      desktopProposalButton.classList.add('highlight-animation');
      setTimeout(() => {
        desktopProposalButton.classList.remove('highlight-animation');
      }, 3000);
    }
  }

  // GitHub 연동 상태 확인
  async checkGitHubIntegrationStatus(daoId) {
    try {
      const key = `github_integration_${this.currentUser.did}`;
      const integrations = JSON.parse(localStorage.getItem(key) || '{}');
      
      return integrations[daoId] ? integrations[daoId] : null;
    } catch (error) {
      console.error('GitHub 연동 상태 확인 실패:', error);
      return null;
    }
  }

  async createInviteCode(daoId) {
    // 계정에 귀속된 영구적인 초대코드 생성 (블록체인에서 조회/생성)
    try {
      this.showLoadingMessage('초대코드를 불러오는 중...');
      const inviteCode = await this.getOrCreatePermanentInviteCode();
      this.hideLoadingMessage();
    this.showInviteCodeModal(inviteCode, daoId);
    } catch (error) {
      this.hideLoadingMessage();
      this.showErrorMessage('초대코드 생성에 실패했습니다.');
      console.error('초대코드 생성 오류:', error);
    }
  }

  // 계정에 귀속된 영구적인 초대코드 생성/조회 (블록체인 저장)
  async getOrCreatePermanentInviteCode() {
    try {
      // 서버에서 현재 계정의 초대코드 조회
      const response = await fetch(`${this.apiBase}/invite-code`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentUser?.did}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.inviteCode) {
          // 기존 초대코드가 있으면 반환
          return result.inviteCode;
        }
      }

      // 초대코드가 없으면 새로 생성
      return await this.createPermanentInviteCode();
    } catch (error) {
      console.error('초대코드 조회 실패:', error);
      // 서버 연결 실패 시 임시 코드 생성
      return this.generateHashBasedInviteCode(this.currentUser?.did || 'default');
    }
  }

  // 새로운 영구 초대코드 생성 및 블록체인 저장
  async createPermanentInviteCode() {
    try {
      const response = await fetch(`${this.apiBase}/invite-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentUser?.did}`
        },
        body: JSON.stringify({
          userDID: this.currentUser?.did,
          communicationAddress: this.currentUser?.communicationAddress
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.inviteCode) {
          console.log('새로운 초대코드가 블록체인에 저장되었습니다:', result.inviteCode);
          return result.inviteCode;
        }
      }

      throw new Error('서버에서 초대코드 생성 실패');
    } catch (error) {
      console.error('초대코드 생성 실패:', error);
      // 서버 실패 시 임시 코드 생성
      return this.generateHashBasedInviteCode(this.currentUser?.did || 'default');
    }
  }

  // 해시 기반 초대코드 생성
  generateHashBasedInviteCode(seed) {
    // 간단한 해시 함수로 영구적인 초대코드 생성
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

  showInviteCodeModal(inviteCode, daoId) {
    // 기존 초대코드 모달이 있다면 제거
    const existingModal = document.querySelector('.modal .modal-content:has(.invite-code-info)');
    if (existingModal) {
      existingModal.closest('.modal').remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>초대코드가 생성되었습니다</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="invite-code-info">
            <label>초대코드</label>
            <div class="link-container">
              <input type="text" value="${inviteCode}" readonly>
              <button class="btn-secondary" onclick="navigator.clipboard.writeText('${inviteCode}'); window.dapp.showSuccessMessage('초대코드가 복사되었습니다!')">
                <i class="fas fa-copy"></i> 복사
              </button>
            </div>
            <div class="invite-notice">
              <i class="fas fa-info-circle"></i>
              <span>이 초대코드는 영구적입니다.</span>
            </div>
            <div class="invite-usage-guide">
              <h4>초대코드 사용 방법</h4>
              <p>1. 초대받을 사람에게 이 코드를 전달하세요</p>
              <p>2. 생체인증 → 비밀번호 설정 후 초대코드 입력 단계에서 사용</p>
              <p>3. 초대받은 사용자가 DID생성을 완료하면 초대자와 생성자에게 3:2의 비율로 분배됩니다.(30B:20B)</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // DCA 리스트 렌더링
  renderDCAList(daoId) {
    const dcaData = this.getDCAData(daoId);
    
    if (!dcaData || dcaData.length === 0) {
      return `
        <div class="empty-dca">
          <i class="fas fa-tasks"></i>
          <p>아직 지정기여활동이 설정되지 않았습니다.</p>
        </div>
      `;
    }

    return dcaData.map(dca => `
      <div class="dca-card" data-dca-id="${dca.id}">
        <div class="dca-info">
          <div class="dca-title">DCA: ${dca.title}</div>
          <div class="dca-criteria">검증기준: ${dca.criteria}</div>
          <div class="dca-value">기여가치: ${dca.value}B</div>
        </div>
        ${this.getUserOPRole().isTopOP ? `
          <div class="dca-actions" style="display: none;">
            <button class="btn-small btn-edit" onclick="window.dapp.editDCA('${daoId}', '${dca.id}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn-small btn-delete" onclick="window.dapp.deleteDCA('${daoId}', '${dca.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

    // DCA 데이터 가져오기 (330B 예시에 맞춘 DCA 구성)
  getDCAData(daoId) {
    // 기본 DAO의 DCA (개발DAO, 커뮤니티DAO, 검증자DAO)
    const defaultDCAs = {
      'dev-dao': [
        { id: 'dca1', title: 'Pull Request (자기 이슈)', criteria: 'Closed(merged)', value: '250' },
        { id: 'dca2', title: 'Pull Request (남의 이슈)', criteria: 'Closed(merged)', value: '280' },
        { id: 'dca3', title: 'Issue Report', criteria: 'Closed(merged)', value: '80' }
      ],
      'community-dao': [
        { id: 'dca1', title: '초대 활동', criteria: '초대 받은 사용자가 DID생성', value: '50' }
      ],
      'validator-dao': [
        { id: 'dca1', title: '블록생성', criteria: '자동검증', value: '5' }
      ]
    };

    // 기본 DAO의 DCA 반환
    if (defaultDCAs[daoId]) {
      return defaultDCAs[daoId];
    }
    
    // 사용자 생성 DAO의 DCA 찾기
    const userDAOs = this.loadUserCreatedDAOs();
    const userDAO = userDAOs.find(dao => dao.id === daoId);
    
    if (userDAO && userDAO.dcas) {
      // DCA 포맷 맞추기
      return userDAO.dcas.map((dca, index) => ({
        id: `dca${index + 1}`,
        title: dca.title,
        criteria: dca.criteria,
        value: dca.value.toString()
      }));
    }

    return [];
  }

  // DCA 추가
  addDCA(daoId) {
    this.showDCAModal(daoId, null);
  }

  // DCA 편집
  editDCA(daoId, dcaId) {
    const dcaData = this.getDCAData(daoId);
    const dca = dcaData.find(d => d.id === dcaId);
    this.showDCAModal(daoId, dca);
  }

  // DCA 삭제
  deleteDCA(daoId, dcaId) {
    if (confirm('이 DCA를 삭제하시겠습니까?')) {
      // 실제로는 서버에서 삭제
      this.showSuccessMessage('DCA가 삭제되었습니다.');
      // DCA 리스트 새로고침
      this.refreshDCAList(daoId);
    }
  }

  // DCA 리스트 편집 모드 토글
  editDCAList(daoId) {
    const dcaList = document.getElementById(`dcaList-${daoId}`);
    if (!dcaList) return;

    const dcaActions = dcaList.querySelectorAll('.dca-actions');
    const editButton = document.querySelector(`[onclick*="editDCAList('${daoId}')"]`);
    
    // 현재 편집 모드 상태 확인
    const isEditMode = dcaActions[0]?.style.display !== 'none';
    
    if (isEditMode) {
      // 편집 모드 종료
      dcaActions.forEach(action => {
        action.style.display = 'none';
      });
      editButton.innerHTML = '<i class="fas fa-edit"></i> 편집';
      editButton.classList.remove('editing');
    } else {
      // 편집 모드 시작
      dcaActions.forEach(action => {
        action.style.display = 'flex';
      });
      editButton.innerHTML = '<i class="fas fa-check"></i> 완료';
      editButton.classList.add('editing');
    }
  }

  // DCA 모달 표시
  showDCAModal(daoId, existingDCA = null) {
    const isEdit = existingDCA !== null;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${isEdit ? 'DCA 수정' : 'DCA 추가'}</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="dcaForm">
            <div class="form-group">
              <label>제목</label>
              <input type="text" id="dcaTitle" value="${existingDCA?.title || ''}" placeholder="예: Pull Request" required>
            </div>
            <div class="form-group">
              <label>검증기준</label>
              <input type="text" id="dcaCriteria" value="${existingDCA?.criteria || ''}" placeholder="예: merged" required>
            </div>
            <div class="form-group">
              <label>B 가치</label>
              <input type="number" id="dcaValue" value="${existingDCA?.value || ''}" placeholder="예: 250" required>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
              <button type="submit" class="btn-primary">${isEdit ? '수정' : '추가'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 폼 제출 처리
    document.getElementById('dcaForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveDCA(daoId, existingDCA?.id);
    });
  }

  // DCA 저장
  saveDCA(daoId, dcaId = null) {
    const title = document.getElementById('dcaTitle').value;
    const criteria = document.getElementById('dcaCriteria').value;
    const value = document.getElementById('dcaValue').value;

    if (!title || !criteria || !value) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    // 실제로는 서버에 저장
    const action = dcaId ? '수정' : '추가';
    this.showSuccessMessage(`DCA가 ${action}되었습니다.`);
    
    // DCA 모달 닫기
    const dcaModal = document.querySelector('.modal .modal-content:has(.form-group)');
    if (dcaModal) {
      dcaModal.closest('.modal').remove();
    }
    
    // DCA 리스트 새로고침
    this.refreshDCAList(daoId);
  }

  // DCA 리스트 새로고침
  refreshDCAList(daoId) {
    const dcaListElement = document.getElementById(`dcaList-${daoId}`);
    const editButton = document.querySelector(`[onclick*="editDCAList('${daoId}')"]`);
    
    if (dcaListElement) {
      // 현재 편집 모드 상태 저장
      const wasInEditMode = editButton?.classList.contains('editing');
      
      // 리스트 새로고침
      dcaListElement.innerHTML = this.renderDCAList(daoId);
      
      // 편집 모드 상태 복원
      if (wasInEditMode) {
        const dcaActions = dcaListElement.querySelectorAll('.dca-actions');
        dcaActions.forEach(action => {
          action.style.display = 'flex';
        });
      }
    }
  }

  // OP 검토 페이지로 이동
  goToOPReview() {
    // DAO 참여 모달 닫기
    const daoModal = document.querySelector('.dao-participate-modal');
    if (daoModal) {
      daoModal.closest('.modal').remove();
    }
    // 거버넌스 탭으로 이동
    const governanceTab = document.querySelector('[data-tab="governance"]');
    if (governanceTab) {
      governanceTab.click();
      setTimeout(() => {
        // 검토 과정으로 전환
        this.switchGovernanceProcess('review');
      }, 200);
    }
  }

  joinDAOAsMember(daoId) {
    const daoNames = {
      'ops-dao': 'Operations DAO',
      'dev-dao': 'Development DAO',
      'community-dao': 'Community DAO',
      'political-dao': 'Political DAO'
    };

    this.showSuccessMessage(`${daoNames[daoId]}에 구성원으로 참여했습니다!`);
    
    // DAO 참여 모달 닫기
    const daoModal = document.querySelector('.dao-participate-modal');
    if (daoModal) {
      daoModal.closest('.modal').remove();
    }
  }

  // 기여하러가기 액션 렌더링
  renderContributionActions(daoId) {
    // 기본 DAO들의 액션
    if (daoId === 'ops-dao') {
      return `
        <div class="op-actions">
          <h4><i class="fas fa-gavel"></i> OP 검토 활동</h4>
          <div class="op-action-cards">
            <div class="action-card">
              <div class="action-info">
                <h5>OP 검토</h5>
                <p>제안 검토, 승인/거부, 이의제기 등의 운영 활동을 수행합니다</p>
                <ul class="action-details">
                  <li>제안서 검토 및 평가</li>
                  <li>승인/거부 결정</li>
                  <li>이의신청</li>
                </ul>
              </div>
              <button class="btn-primary" onclick="window.dapp.goToOPReview()">
                <i class="fas fa-search"></i> OP 검토하기
              </button>
            </div>
          </div>
        </div>
      `;
    }
    
    // 사용자 생성 DAO의 경우 설정된 기여 옵션 표시
    const userDAOs = this.loadUserCreatedDAOs();
    const userDAO = userDAOs.find(dao => dao.id === daoId);
    
    if (userDAO && userDAO.contributionOptions) {
      return `
        <div class="contribution-actions">
          <h4><i class="fas fa-rocket"></i> 기여하러가기</h4>
          <div class="join-options">
            ${userDAO.contributionOptions.map(option => `
              <div class="option-card">
                <h4><i class="${option.icon}"></i> ${option.title}</h4>
                <p>${option.description}</p>
                <button class="btn-primary" onclick="window.dapp.handleContributionAction('${daoId}', '${option.actionType}', ${JSON.stringify(option).replace(/"/g, '&quot;')})">
                  <i class="${option.icon}"></i> ${option.buttonText}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // 기본 DAO들의 기여 액션
    return `
      <div class="contribution-actions">
        <h4><i class="fas fa-rocket"></i> 기여하러가기</h4>
        <div class="join-options">
          ${daoId === 'dev-dao' ? `
            <div class="option-card">
              <h4><i class="fab fa-github"></i> GitHub 연동</h4>
              <p>GitHub 레포지토리와 연동하여 자동으로 기여가 반영됩니다.</p>
              <button class="btn-primary" onclick="window.dapp.setupGitHubIntegration('${daoId}')">
                <i class="fab fa-github"></i> GitHub 연동하기
              </button>
            </div>
            <div class="option-card">
              <h4><i class="fas fa-book-open"></i> 기여 가이드</h4>
              <p>DevDAO 기여 방법과 DCA 활동에 대한 상세한 가이드를 확인하세요.</p>
              <button class="btn-secondary" onclick="window.dapp.openContributionGuide('${daoId}')">
                <i class="fas fa-external-link-alt"></i> 기여 가이드 보기
              </button>
            </div>
          ` : ''}
          ${daoId === 'community-dao' ? `
            <div class="option-card">
              <h4><i class="fas fa-key"></i> 초대코드 생성</h4>
              <p>새로운 구성원을 초대할 수 있는 코드를 생성합니다.</p>
              <button class="btn-primary" onclick="window.dapp.createInviteCode('${daoId}')">
                <i class="fas fa-key"></i> 초대코드 만들기
              </button>
            </div>
          ` : ''}
          ${daoId === 'political-dao' ? `
            <div class="option-card">
              <h4><i class="fas fa-lightbulb"></i> 제안하러가기</h4>
              <p>프로토콜 거버넌스를 위한 제안을 생성하고 B 토큰을 획득하세요.</p>
              <button class="btn-primary" onclick="window.dapp.goToProposalCreation('${daoId}')">
                <i class="fas fa-plus"></i> 제안하러가기
              </button>
            </div>
          ` : ''}
          ${daoId === 'validator-dao' ? `
            <div class="option-card">
              <h4><i class="fas fa-shield-alt"></i> 검증자 참여 가이드</h4>
              <p>네트워크 검증자로 참여하여 블록 생성 기여를 시작하세요.</p>
              <button class="btn-primary" onclick="window.open('https://github.com/baekya-protocol/baekya-protocol/blob/main/docs/validator-guide.md', '_blank')">
                <i class="fas fa-external-link-alt"></i> 검증자 참여하기
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 사용자 생성 DAO의 기여 액션 처리
  handleContributionAction(daoId, actionType, option) {
    switch(actionType) {
      case 'external':
        window.open(option.externalUrl, '_blank');
        break;
      case 'github':
        this.setupGitHubIntegration(daoId, option.githubRepo);
        break;
      case 'modal':
        this.showCustomModal(option.modalTitle, option.modalContent);
        break;
      case 'custom':
        // 커스텀 함수 실행
        if (typeof this[option.customFunction] === 'function') {
          this[option.customFunction](JSON.parse(option.customParams || '{}'));
        }
        break;
    }
  }

  // 커스텀 모달 표시
  showCustomModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  viewDAO(daoId) {
    alert(`${daoId} 상세 정보 (추후 구현)`);
  }

  async loadGovernance() {
    // 기본적으로 제안과정을 활성화하고 해당 과정의 콘텐츠를 로드
    this.currentGovernanceProcess = 'proposal';
    
    // DAO 필터 버튼 로드
    this.loadDAOFilterButtons();
    
    // OP 권한 확인 및 OP 버튼 표시
    this.checkOPAccess();
    
    // 제안과정 탭을 활성화
    this.switchGovernanceProcess('proposal');
  }

  // OP 권한 확인 및 버튼 표시
  checkOPAccess() {
    const opSection = document.getElementById('opAccessSection');
    if (!opSection) return;
    
    // 데모: 사용자가 OpsDAO의 최상위 OP라고 가정
    const userOPRole = this.getUserOPRole();
    
    if (userOPRole.isOP) {
      opSection.style.display = 'block';
    } else {
      opSection.style.display = 'none';
    }
  }

  // 사용자의 OP 역할 정보 반환 (실제 로그인 상태 확인)
  getUserOPRole() {
    // 생체인증이 완료되어야 OP 권한 확인 가능
    if (!this.isAuthenticated || !this.currentUser) {
      return {
        isOP: false,
        isTopOP: false,
        opDAOs: [],
        opsDAOMember: false
      };
    }

    // 첫 번째 사용자(Initial OP) 또는 Founder인 경우 모든 DAO의 OP
    if (this.currentUser.isInitialOP || this.currentUser.isFounder) {
    return {
      isOP: true,
      isTopOP: true,
        opDAOs: ['dev-dao', 'community-dao', 'ops-dao', 'political-dao'],
        opsDAOMember: true
      };
    }

    // 일반 사용자는 OP가 아님
    return {
      isOP: false,
      isTopOP: false,
      opDAOs: [],
      opsDAOMember: false
    };
  }

  // 거버넌스 과정 전환 함수
  switchGovernanceProcess(processType) {
    console.log(`🔄 거버넌스 과정 전환: ${processType}`);
    
    // 현재 과정 저장
    this.currentGovernanceProcess = processType;
    
    // 모든 버튼에서 active 클래스 제거
    const processButtons = document.querySelectorAll('.process-nav-btn');
    processButtons.forEach(btn => btn.classList.remove('active'));
    
    // 선택된 버튼에 active 클래스 추가
    const activeButton = document.querySelector(`[data-process="${processType}"]`);
    if (activeButton) {
      activeButton.classList.add('active');
    }
    
    // 제목 업데이트
    this.updateGovernanceSectionTitle(processType);
    
    // DAO 필터 초기화
    this.currentDAOFilter = 'all';
    this.updateDAOFilterButtons();
    
    // 해당 과정의 콘텐츠 로드
    this.loadGovernanceProcessContent(processType);
  }

  updateGovernanceSectionTitle(processType) {
    const titleElement = document.getElementById('governance-section-title');
    if (!titleElement) return;
    
    const titles = {
      'proposal': '모금 진행 중인 제안',
      'voting': '투표 진행 중인 제안', 
              'review': '검토 진행 중인 제안'
    };
    
    titleElement.textContent = titles[processType] || '활성 제안';
  }

  // DAO 필터 기능
  switchDAOFilter(daoFilter) {
    this.currentDAOFilter = daoFilter;
    
    // 모든 DAO 필터 버튼에서 active 클래스 제거
    document.querySelectorAll('.dao-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // 선택된 DAO 필터 버튼에 active 클래스 추가
    const activeBtn = document.querySelector(`[data-dao="${daoFilter}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
    
    // 현재 거버넌스 과정의 컨텐츠를 필터링하여 다시 로드
    const currentProcess = this.currentGovernanceProcess || 'proposal';
    this.loadGovernanceProcessContent(currentProcess);
  }

  loadDAOFilterButtons() {
    const daoFilterContainer = document.getElementById('daoFilterButtons');
    if (!daoFilterContainer) return;
    
    // 사용자가 소속된 DAO 목록 가져오기 (시뮬레이션)
    const userDAOs = this.getUserDAOList();
    
    // DAO 필터 버튼들 생성
    daoFilterContainer.innerHTML = userDAOs.map(dao => `
      <button class="dao-filter-btn" data-dao="${dao.id}" onclick="window.dapp.switchDAOFilter('${dao.id}')">
        <i class="${dao.icon}"></i>
        <span>${dao.name}</span>
      </button>
    `).join('');
  }

  updateDAOFilterButtons() {
    // 전체 버튼 활성화
    document.querySelectorAll('.dao-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    
    const allBtn = document.querySelector('[data-dao="all"]');
    if (allBtn) {
      allBtn.classList.add('active');
    }
  }

  // DAO별 기여 건수 조회
  getDAOContributionCount(daoId) {
    if (!this.currentUser || !this.currentUser.did) {
      return 0;
    }
    
    // 로컬 스토리지에서 직접 기여 내역 확인
    const contributions = this.getUserContributions();
    const daoContributions = contributions.filter(contrib => contrib.dao === daoId);
    
    return daoContributions.length;
  }
  
  // 최근 활동 시간 계산
  getLastActivityTime(daoId) {
    if (!this.currentUser || !this.currentUser.did) {
      return '활동 없음';
    }
    
    const contributions = this.getUserContributions();
    const daoContributions = contributions.filter(contrib => contrib.dao === daoId);
    
    if (daoContributions.length === 0) {
      return '활동 없음';
    }
    
    // 가장 최근 기여 찾기
    const latestContribution = daoContributions.reduce((latest, contrib) => {
      const contribDate = new Date(contrib.date);
      const latestDate = new Date(latest.date);
      return contribDate > latestDate ? contrib : latest;
    });
    
    // 상대 시간 계산
    const now = new Date();
    const contribDate = new Date(latestContribution.date);
    const diffMs = now - contribDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return '오늘';
    } else if (diffDays === 1) {
      return '어제';
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks}주 전`;
    } else {
      const months = Math.floor(diffDays / 30);
      return `${months}개월 전`;
    }
  }
  
  // 서버에서 기여 데이터 로드
  async loadContributionData(daoId) {
    if (!this.currentUser || !this.currentUser.did) return;
    
    try {
      const response = await fetch(`${this.apiBase}/contributions/${this.currentUser.did}?daoId=${daoId}`);
      const result = await response.json();
      
      if (result.success) {
        // 캐시에 저장
        if (!this.contributionCache) this.contributionCache = {};
        this.contributionCache[daoId] = result.contributions;
        
        // UI 업데이트
        this.loadMyDAOs();
        this.loadPTokenDetails();
      }
    } catch (error) {
      console.error(`DAO ${daoId} 기여 데이터 로드 실패:`, error);
    }
  }

  // 사용자의 모든 기여 데이터 로드
  async loadUserContributions() {
    if (!this.currentUser || !this.currentUser.did) return;
    
    const daoIds = ['community-dao', 'dev-dao', 'ops-dao', 'political-dao'];
    
    // 병렬로 모든 DAO의 기여 데이터 로드
    await Promise.all(daoIds.map(daoId => this.loadContributionData(daoId)));
  }

  // 사용자의 소속 DAO 원본 데이터 (중앙집중화)
  getUserMyDAOsData() {
    // 로그인하지 않은 경우 빈 배열 반환
    if (!this.isAuthenticated) {
      return [];
    }
    
    // Founder 계정은 4개 기본 DAO의 OP
    if (this.currentUser && this.currentUser.isFounder) {
      return [
        {
          id: 'ops-dao',
          name: 'Operations DAO',
          icon: 'fa-cogs',
          role: 'OP',
          contributions: 0,
          lastActivity: '방금',
          joinedAt: Date.now()
        },
        {
          id: 'dev-dao',
          name: 'Development DAO',
          icon: 'fa-code',
          role: 'OP',
          contributions: 0,
          lastActivity: '방금',
          joinedAt: Date.now()
        },
        {
          id: 'community-dao',
          name: 'Community DAO',
          icon: 'fa-users',
          role: 'OP',
          contributions: this.getDAOContributionCount('community-dao'),
          lastActivity: '방금',
          joinedAt: Date.now()
        },
        {
          id: 'political-dao',
          name: 'Political DAO',
          icon: 'fa-landmark',
          role: 'OP',
          contributions: 0,
          lastActivity: '방금',
          joinedAt: Date.now()
        },
        {
          id: 'validator-dao',
          name: 'Validator DAO',
          icon: 'fa-shield-alt',
          role: 'OP',
          contributions: this.getDAOContributionCount('validator-dao'),
          lastActivity: '방금',
          joinedAt: Date.now()
        }
      ];
    }
    
    // 로컬 스토리지에서 동적으로 생성된 DAO 목록 가져오기
    const dynamicDAOs = JSON.parse(localStorage.getItem('userDAOs') || '[]');
    
    // 커뮤니티DAO 기여 내역이 있는지 확인 (소급 적용)
    const contributions = this.getUserContributions();
    const hasCommunityContributions = contributions.some(contrib => contrib.dao === 'community-dao');
    const hasCommunityDAO = dynamicDAOs.some(dao => dao.id === 'community-dao');
    
    // 커뮤니티DAO 기여 내역이 있지만 소속 DAO 목록에 없는 경우 추가
    if (hasCommunityContributions && !hasCommunityDAO) {
      const communityDAO = {
        id: 'community-dao',
        name: 'Community DAO',
        icon: 'fa-users',
        role: 'Member',
        contributions: this.getDAOContributionCount('community-dao'),
        lastActivity: this.getLastActivityTime('community-dao'),
        joinedAt: Date.now()
      };
      
      dynamicDAOs.push(communityDAO);
      
      // localStorage에 업데이트된 목록 저장 (소급 적용)
      localStorage.setItem('userDAOs', JSON.stringify(dynamicDAOs));
      
      console.log('✅ 커뮤니티DAO 소급 적용:', communityDAO);
    }
    
    // 검증자DAO 기여 내역이 있는지 확인 (소급 적용)
    const hasValidatorContributions = contributions.some(contrib => contrib.dao === 'validator-dao');
    const hasValidatorDAO = dynamicDAOs.some(dao => dao.id === 'validator-dao');
    
    // 검증자DAO 기여 내역이 있지만 소속 DAO 목록에 없는 경우 추가
    if (hasValidatorContributions && !hasValidatorDAO) {
      const validatorDAO = {
        id: 'validator-dao',
        name: 'Validator DAO',
        icon: 'fa-shield-alt',
        role: 'Member',
        contributions: this.getDAOContributionCount('validator-dao'),
        lastActivity: this.getLastActivityTime('validator-dao'),
        joinedAt: Date.now()
      };
      
      dynamicDAOs.push(validatorDAO);
      
      // localStorage에 업데이트된 목록 저장 (소급 적용)
      localStorage.setItem('userDAOs', JSON.stringify(dynamicDAOs));
      
      console.log('✅ 검증자DAO 소급 적용:', validatorDAO);
    }
    
    // 기본 DAO 목록 (초기에는 비어있음)
    const defaultDAOs = [];
    
    // 기본 DAO와 동적 DAO 합치기
    return [...defaultDAOs, ...dynamicDAOs];
  }

  // DAO 필터용으로 변환된 데이터
  getUserDAOList() {
    const myDAOs = this.getUserMyDAOsData();
    
    // DAO 필터용으로 간소화된 형태로 반환
    return myDAOs.map(dao => ({
      id: dao.id,
      name: dao.name.replace(' DAO', ''), // "Development DAO" -> "Development"로 단축
      icon: dao.icon
    }));
  }

  // 거버넌스 과정별 콘텐츠 로드
  loadGovernanceProcessContent(processType) {
    const proposalsSection = document.querySelector('.proposals-section');
    const votingHistory = document.querySelector('.voting-history');
    
    if (!proposalsSection || !votingHistory) return;
    
    switch(processType) {
      case 'proposal':
        // 제안과정: 모금 중인 제안들 (active 상태의 제안들)
        this.renderProposalsByStatus(['active']);
        votingHistory.style.display = 'block';
        break;
        
      case 'voting':
        // 투표과정: 투표 진행 중인 제안들
        this.renderProposalsByStatus(['voting']);
        votingHistory.style.display = 'block';
        break;
        
      case 'review':
        // 검토과정: 검토 단계에 있는 제안들
        this.renderReviewProposals();
        votingHistory.style.display = 'none'; // 검토 단계에서는 투표 내역 숨김
        break;
        
      default:
        // 기본값: 모든 제안 표시
        this.renderProposals(this.loadAllProposals());
    }
  }

  // 모든 제안 로드 (기존 loadGovernance 로직을 별도 함수로 분리)
  loadAllProposals() {
    const allProposals = [];
    
    // 사용자가 실제로 소속된 DAO 목록 가져오기
    const userDAOs = this.getUserMyDAOsData().map(dao => dao.id);
    
    // 각 DAO의 제안들을 가져와서 통합
    userDAOs.forEach(daoId => {
      const daoProposals = this.getDAOProposals(daoId);
      allProposals.push(...daoProposals);
    });
    
    // 최신순으로 정렬
    allProposals.sort((a, b) => new Date(b.votingStartDate) - new Date(a.votingStartDate));
    
    return allProposals;
  }

  // 상태별 제안 렌더링
  renderProposalsByStatus(statusList) {
    const allProposals = this.loadAllProposals();
    let filteredProposals = allProposals.filter(proposal => 
      statusList.includes(proposal.status)
    );
    
    // DAO 필터 적용
    if (this.currentDAOFilter && this.currentDAOFilter !== 'all') {
      filteredProposals = filteredProposals.filter(proposal => 
        proposal.daoId === this.currentDAOFilter
      );
    }
    
    // 결과가 없으면 모든 제안 표시
    if (filteredProposals.length === 0) {
      // DAO 필터가 적용된 경우에도 해당 DAO의 모든 제안을 표시
      if (this.currentDAOFilter && this.currentDAOFilter !== 'all') {
        const daoProposals = allProposals.filter(proposal => 
          proposal.daoId === this.currentDAOFilter
        );
        this.renderProposals(daoProposals);
      } else {
    this.renderProposals(allProposals);
      }
    } else {
      this.renderProposals(filteredProposals);
    }
  }

  // 검토과정 제안 렌더링
  renderReviewProposals() {
    const allProposals = this.loadAllProposals();
    let reviewProposals = allProposals.filter(proposal => 
      ['dao-review', 'ops-dao-review', 'final-review'].includes(proposal.status)
    );
    
    // DAO 필터 적용
    if (this.currentDAOFilter && this.currentDAOFilter !== 'all') {
      reviewProposals = reviewProposals.filter(proposal => 
        proposal.daoId === this.currentDAOFilter
      );
    }
    
    const proposalsContainer = document.querySelector('.proposals-grid');
    if (!proposalsContainer) return;
    
    if (reviewProposals.length === 0) {
      const daoFilterText = this.currentDAOFilter !== 'all' ? 
        ` ${this.getDAOName(this.currentDAOFilter)}의` : '';
      proposalsContainer.innerHTML = `
        <div class="no-proposals">
          <p>현재${daoFilterText} 검토과정에 있는 제안이 없습니다.</p>
        </div>
      `;
      return;
    }
    
    proposalsContainer.innerHTML = '';
    reviewProposals.forEach(proposal => {
      const card = this.createReviewStageCard(proposal);
      proposalsContainer.appendChild(card);
    });
  }

  // DAO별 제안 데이터를 반환하는 중앙화된 함수 (데모 데이터 제거됨)
  getDAOProposals(daoId) {
    // 실제 블록체인에서 제안 데이터를 가져와야 함
    // 현재는 사용자가 생성한 동적 제안만 반환
    const dynamicProposals = this.dynamicProposals?.[daoId] || [];
    
    return dynamicProposals;
  }

  // 새 제안을 중앙화된 데이터에 추가
  addNewProposal(daoId, proposal) {
    // 실제로는 이 데이터가 블록체인이나 데이터베이스에 저장되어야 함
    // 여기서는 시뮬레이션을 위해 메모리에만 저장
    if (!this.dynamicProposals) {
      this.dynamicProposals = {};
    }
    if (!this.dynamicProposals[daoId]) {
      this.dynamicProposals[daoId] = [];
    }
    this.dynamicProposals[daoId].push(proposal);
  }

  // 데모 데이터 제거를 위한 빈 함수
  getDAOProposalsDemo(daoId) {
    const proposalData = {
      'dev-dao': [
        {
          id: 'dev-prop-1',
          title: 'DCA 기여도 평가 기준 개선',
          description: '코드 리뷰의 품질을 더 정확히 평가할 수 있는 새로운 기준을 제안합니다.',
          proposer: '김개발',
          status: 'active',
          votesFor: 23,
          votesAgainst: 5,
          abstentions: 2,
          votingStartDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3일 전
          votingEndDate: '2024-01-25',
          daoName: 'Development DAO',
          daoId: 'dev-dao'
        },
        {
          id: 'dev-prop-2',
          title: 'DAO 운영 예산 증액',
          description: '증가하는 구성원 수에 맞춰 운영 예산을 20% 증액하는 것을 제안합니다.',
          proposer: '이운영',
          status: 'voting',
          votesFor: 34,
          votesAgainst: 12,
          abstentions: 6,
          votingStartDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1일 전
          votingEndDate: '2024-01-22',
          daoName: 'Development DAO',
          daoId: 'dev-dao'
        },
        {
          id: 'dev-prop-3',
          title: 'API 성능 최적화',
          description: '시스템 응답속도 개선을 위한 API 성능 최적화 작업을 제안합니다.',
          proposer: '박성능',
          status: 'dao-review',
          votesFor: 42,
          votesAgainst: 8,
          abstentions: 3,
          votingStartDate: '2024-01-01',
          votingEndDate: '2024-01-15',
          reviewStartDate: '2024-01-16',
          daoName: 'Development DAO',
          daoId: 'dev-dao',
          reviewStage: 'dao-op', // dao-op, ops-dao-objection, top-op
          opDecision: null, // null, approved, rejected
          opReviewComment: null, // OP 검토 중이므로 아직 의견 없음
          opApprovedDate: null,
          opReviewer: null
        },
        {
          id: 'dev-prop-4',
          title: '새로운 프로그래밍 언어 지원',
          description: 'Rust 언어 지원을 위한 컴파일러 추가 개발을 제안합니다.',
          proposer: '러스트개발자',
          status: 'proposal',
          proposalFunding: 28,
          proposalTarget: 45,
          proposalStartDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          proposalEndDate: '2024-01-30',
          daoName: 'Development DAO',
          daoId: 'dev-dao'
        }
      ],
      'community-dao': [
        {
          id: 'comm-prop-1',
          title: '커뮤니티 DAO 신규 DCA 추가',
          description: '튜토리얼 번역 활동을 새로운 DCA로 추가하는 제안입니다.',
          proposer: '박커뮤',
          status: 'active',
          votesFor: 45,
          votesAgainst: 12,
          abstentions: 8,
          votingStartDate: '2024-01-09',
          votingEndDate: '2024-01-23',
          daoName: 'Community DAO',
          daoId: 'community-dao'
        },
        {
          id: 'comm-prop-2',
          title: '한국어 컨텐츠 확장',
          description: '한국어 사용자를 위한 교육 컨텐츠를 확장하는 제안입니다.',
          proposer: '김한글',
          status: 'ops-dao-review',
          votesFor: 38,
          votesAgainst: 6,
          abstentions: 4,
          votingStartDate: '2023-12-20',
          votingEndDate: '2024-01-03',
          reviewStartDate: '2024-01-04',
          daoName: 'Community DAO',
          daoId: 'community-dao',
          reviewStage: 'ops-dao-objection',
          opDecision: 'approved',
          opReviewComment: '한국어 사용자층 확대는 프로토콜 글로벌 확산에 중요합니다. 제안된 컨텐츠 계획이 구체적이고 현지화 전략이 적절합니다. 승인하여 한국 시장 진출을 지원하겠습니다.',
          opApprovedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          opReviewer: 'Community DAO OP',
          objectionStartDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1일 전
          objectionDeadline: '2024-01-18',
          objections: []
        },
        {
          id: 'comm-prop-3',
          title: '글로벌 번역 봉사단 운영',
          description: '다국어 번역 봉사단을 구성하여 백야 프로토콜 글로벌화를 추진합니다.',
          proposer: '글로벌매니저',
          status: 'proposal',
          proposalFunding: 15,
          proposalTarget: 25,
          proposalStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          proposalEndDate: '2024-01-28',
          daoName: 'Community DAO',
          daoId: 'community-dao'
        }
      ],
      'ops-dao': [
        {
          id: 'ops-prop-1',
          title: '프로토콜 보안 감사',
          description: '외부 보안 업체를 통한 전체 프로토콜 보안 감사를 진행하여 취약점을 점검하고 보안을 강화하는 제안입니다.',
          proposer: '최보안',
          status: 'voting',
          votesFor: 28,
          votesAgainst: 4,
          abstentions: 2,
          votingStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2일 전
          votingEndDate: '2024-01-20',
          daoName: 'Operations DAO',
          daoId: 'ops-dao'
        },
        {
          id: 'ops-prop-2',
          title: '네트워크 인프라 업그레이드',
          description: '증가하는 트랜잭션 처리량에 대비하여 네트워크 인프라를 확장하고 성능을 최적화하는 제안입니다.',
          proposer: '이인프라',
          status: 'active',
          votesFor: 32,
          votesAgainst: 3,
          abstentions: 1,
          votingStartDate: '2024-01-10',
          votingEndDate: '2024-01-24',
          daoName: 'Operations DAO',
          daoId: 'ops-dao'
        },
        {
          id: 'ops-prop-3',
          title: 'OP 권한 체계 개선',
          description: 'OP들의 권한과 책임을 더 명확히 정의하고, 의사결정 프로세스를 개선하는 제안입니다.',
          proposer: '정권한',
          status: 'dao-review',
          votesFor: 25,
          votesAgainst: 2,
          abstentions: 1,
          votingStartDate: '2024-01-01',
          votingEndDate: '2024-01-14',
          reviewStartDate: '2024-01-15',
          daoName: 'Operations DAO',
          daoId: 'ops-dao',
          reviewStage: 'dao-op',
          opDecision: null,
          opReviewComment: null, // OP 검토 중
          opApprovedDate: null,
          opReviewer: null
        },
        {
          id: 'ops-prop-4',
          title: '노드 운영 보상 체계 개선',
          description: '노드 운영자들의 안정적인 네트워크 기여를 위한 보상 체계를 개선합니다.',
          proposer: '노드운영자',
          status: 'proposal',
          proposalFunding: 35,
          proposalTarget: 50,
          proposalStartDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          proposalEndDate: '2024-01-29',
          daoName: 'Operations DAO',
          daoId: 'ops-dao'
        }
      ],
      'political-dao': [
        {
          id: 'pol-prop-1',
          title: '거버넌스 투표권 확대 제안',
          description: '구성원들의 거버넌스 참여를 확대하기 위한 투표권 배분 방식 개선을 제안합니다.',
          proposer: '정치활동가',
          status: 'active',
          votesFor: 67,
          votesAgainst: 23,
          abstentions: 10,
          votingStartDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          votingEndDate: '2024-01-26',
          daoName: 'Political DAO',
          daoId: 'political-dao'
        },
        {
          id: 'pol-prop-2',
          title: 'DAO 간 협업 체계 구축',
          description: 'DAO 간 원활한 협업과 의사결정을 위한 표준 프로세스를 제안합니다.',
          proposer: '협업전문가',
          status: 'voting',
          votesFor: 89,
          votesAgainst: 12,
          abstentions: 8,
          votingStartDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          votingEndDate: '2024-01-21',
          daoName: 'Political DAO',
          daoId: 'political-dao'
        },
        {
          id: 'pol-prop-3',
          title: '탄핵 프로세스 명확화',
          description: 'OP 탄핵 절차와 기준을 더욱 명확히 정의하여 공정성을 확보하는 제안입니다.',
          proposer: '법률전문가',
          status: 'dao-review',
          votesFor: 78,
          votesAgainst: 5,
          abstentions: 3,
          votingStartDate: '2023-12-28',
          votingEndDate: '2024-01-11',
          reviewStartDate: '2024-01-12',
          daoName: 'Political DAO',
          daoId: 'political-dao',
          reviewStage: 'dao-op',
          opDecision: null,
          opReviewComment: null, // OP 검토 중
          opApprovedDate: null,
          opReviewer: null
        },
        {
          id: 'pol-prop-4',
          title: '정치적 중립성 가이드라인',
          description: '프로토콜의 정치적 중립성 유지를 위한 가이드라인을 제정합니다.',
          proposer: '중립성옹호자',
          status: 'proposal',
          proposalFunding: 42,
          proposalTarget: 60,
          proposalStartDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          proposalEndDate: '2024-01-27',
          daoName: 'Political DAO',
          daoId: 'political-dao'
        },
        {
          id: 'pol-prop-5',
          title: '분쟁 해결 중재 시스템',
          description: 'DAO 간 또는 구성원 간 분쟁 발생 시 중재할 수 있는 시스템을 구축합니다.',
          proposer: '중재전문가',
          status: 'ops-dao-review',
          votesFor: 52,
          votesAgainst: 8,
          abstentions: 6,
          votingStartDate: '2023-12-15',
          votingEndDate: '2023-12-29',
          reviewStartDate: '2023-12-30',
          daoName: 'Political DAO',
          daoId: 'political-dao',
          reviewStage: 'ops-dao-objection',
          opDecision: 'approved',
          opReviewComment: '분쟁 해결 시스템은 DAO 생태계의 안정성을 위해 필수적입니다. 제안된 중재 프로세스가 공정하고 투명하며, 기존 거버넌스 구조와 잘 통합될 것으로 판단됩니다. 다만 중재자 선정 기준을 더 명확히 할 필요가 있지만, 전반적으로 승인할 만한 제안입니다.',
          opApprovedDate: '2023-12-31',
          opReviewer: 'Political DAO OP',
          objectionStartDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          objectionDeadline: '2024-01-19',
          objections: []
        },
        {
          id: 'pol-prop-6',
          title: 'Innovation DAO 생성 제안',
          description: '혁신적인 기술 연구와 실험을 전담할 새로운 DAO 설립을 제안합니다.',
          proposer: '혁신연구자',
          status: 'voting',
          votesFor: 143,
          votesAgainst: 27,
          abstentions: 15,
          votingStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          votingEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          daoName: 'Political DAO',
          daoId: 'political-dao',
          specialType: 'dao-creation', // DAO 생성 제안임을 식별
          
          // DAO 생성 제안 특화 데이터
          proposalType: 'dao-creation',
          proposedDAOName: 'Innovation DAO',
          proposedDAODescription: '백야 프로토콜의 기술적 발전을 이끌어갈 혁신적인 연구와 실험을 전담하는 DAO입니다. 새로운 합의 알고리즘, 확장성 솔루션, 사용자 경험 개선 등 프로토콜의 미래를 설계합니다.',
          proposedDAOJustification: '현재 Development DAO는 일반적인 개발 업무에 집중하고 있어 혁신적이고 실험적인 연구에는 한계가 있습니다. 별도의 Innovation DAO를 통해 장기적 비전과 실험적 프로젝트를 추진할 필요가 있습니다.',
          proposedDCAs: [
            {
              title: '혁신 아이디어 제출',
              criteria: '기술적 타당성 검토 통과',
              value: 80,
              details: '프로토콜 발전에 기여할 수 있는 혁신적인 아이디어를 제출하고 기술적 타당성 검토를 통과하는 활동'
            },
            {
              title: '연구 논문 작성',
              criteria: 'DAO 내부 검토 승인',
              value: 150,
              details: '블록체인, 합의 알고리즘, 확장성 등 관련 분야의 연구 논문을 작성하고 DAO 내부 검토를 통과하는 활동'
            },
            {
              title: '프로토타입 개발',
              criteria: 'MVP 구현 완료',
              value: 200,
              details: '혁신적인 아이디어를 실제 구현 가능한 프로토타입으로 개발하여 MVP를 완성하는 활동'
            },
            {
              title: '기술 발표 및 세미나',
              criteria: '커뮤니티 피드백 긍정적',
              value: 100,
              details: '연구 성과나 혁신 아이디어를 커뮤니티에 발표하고 긍정적인 피드백을 받는 활동'
            }
          ],
          proposedInitialOP: 'innovation-researcher-did-12345',
          proposedOPQualification: '블록체인 연구 5년 경력, 다수의 혁신 프로젝트 리딩 경험, 백야 프로토콜 핵심 기여자로서 기술적 비전과 실행력을 겸비한 적합한 후보',
          collateralPaid: 30,
          targetDAO: 'Political DAO',
          eligibleVoters: 'political-dao-members',
          quorumRequired: 40
        },
        {
          id: 'pol-prop-7',
          title: 'Finance DAO 생성 제안',
          description: '프로토콜의 재정 관리와 토큰 이코노믹스를 전담할 Finance DAO 설립을 제안합니다.',
          proposer: '재정관리자',
          status: 'proposal',
          proposalFunding: 22,
          proposalTarget: 35,
          proposalStartDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          proposalEndDate: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          daoName: 'Political DAO',
          daoId: 'political-dao',
          specialType: 'dao-creation', // DAO 생성 제안임을 식별
          
          // DAO 생성 제안 특화 데이터
          proposalType: 'dao-creation',
          proposedDAOName: 'Finance DAO',
          proposedDAODescription: '백야 프로토콜의 재정 건전성을 유지하고 토큰 이코노믹스를 관리하는 전문 DAO입니다. B토큰과 P토큰의 가치 안정성, 프로토콜 수익 분배, 장기적 재정 계획 등을 담당합니다.',
          proposedDAOJustification: '현재 각 DAO가 개별적으로 재정을 관리하고 있어 전체적인 토큰 이코노믹스 조율에 어려움이 있습니다. 전문적인 Finance DAO를 통해 체계적이고 투명한 재정 관리가 필요합니다.',
          proposedDCAs: [
            {
              title: '재정 보고서 작성',
              criteria: 'DAO 승인 및 공개',
              value: 120,
              details: '월간/분기별 프로토콜 재정 현황을 분석하고 투명한 보고서를 작성하여 커뮤니티에 공개하는 활동'
            },
            {
              title: '토큰 가치 분석',
              criteria: '정확성 검증 통과',
              value: 100,
              details: 'B토큰과 P토큰의 시장 가치 동향을 분석하고 가격 안정성을 위한 방안을 제시하는 활동'
            },
            {
              title: '예산 계획 수립',
              criteria: '타당성 검토 승인',
              value: 150,
              details: '각 DAO의 예산 요청을 검토하고 프로토콜 전체의 균형잡힌 예산 계획을 수립하는 활동'
            }
          ],
          proposedInitialOP: 'finance-expert-did-67890',
          proposedOPQualification: '금융 분야 10년 경력, DeFi 프로젝트 재정 관리 경험, 토큰 이코노믹스 설계 전문가로서 프로토콜의 재정 건전성을 책임질 수 있는 전문가'
        },
        {
          id: 'pol-prop-8',
          title: 'Security DAO 생성 제안',
          description: '프로토콜 보안 강화와 감사를 전담할 Security DAO 설립을 제안합니다.',
          proposer: '보안전문가',
          status: 'final-review',
          votesFor: 187,
          votesAgainst: 23,
          abstentions: 15,
          votingStartDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          votingEndDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          reviewStartDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          objectionPeriodEnded: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          daoName: 'Political DAO',
          daoId: 'political-dao',
          specialType: 'dao-creation', // DAO 생성 제안임을 식별
          reviewStage: 'top-op', // 3단계: 최종검토
          opDecision: 'approved',
          opReviewComment: '보안 전문 DAO의 필요성은 매우 높으며, 제안자의 전문성과 경험이 충분합니다. 제안된 DCA들이 체계적이고 프로토콜 보안 강화에 실질적으로 기여할 것으로 판단됩니다. Security DAO 설립을 통해 보안 업무의 전문성과 독립성을 확보할 수 있을 것입니다.',
          opApprovedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          opReviewer: 'Political DAO OP',
          objectionStartDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          objectionDeadline: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          objections: [
            {
              id: 'obj-1',
              objector: 'Operations DAO OP',
              objectorName: '김운영',
              objectorRole: 'Operations DAO OP',
              date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              reason: '보안 업무가 기존 Operations DAO와 중복될 우려가 있습니다.',
              details: 'Operations DAO에서도 보안 관련 업무를 수행하고 있는데, 별도의 Security DAO를 만들면 업무 중복과 혼란이 발생할 수 있습니다. 기존 Ops DAO 내에서 보안 전문 그룹을 만드는 것이 더 효율적일 것 같습니다.',
              response: '보안 업무의 전문성과 독립성을 고려할 때 전용 DAO가 필요하며, Operations DAO와의 역할 분담을 명확히 하겠습니다.',
              resolved: true
            }
          ],
          
          // DAO 생성 제안 특화 데이터
          proposalType: 'dao-creation',
          proposedDAOName: 'Security DAO',
          proposedDAODescription: '백야 프로토콜의 보안을 전담하는 전문 DAO입니다. 스마트 컨트랙트 감사, 취약점 분석, 보안 업데이트, 침입 탐지 등 프로토콜의 전반적인 보안 강화를 담당합니다.',
          proposedDAOJustification: '분산형 시스템의 보안은 매우 중요하며, 전문적인 보안 관리가 필요합니다. 기존 Operations DAO는 일반적인 운영 업무에 집중하고 있어, 보안 전문 DAO를 통한 체계적인 보안 관리가 필요합니다.',
          proposerCommunicationAddress: '010-9990-4718', // 제안자 통신주소 (전화번호)
          proposedDCAs: [
            {
              title: '보안 감사 수행',
              criteria: '감사 보고서 승인',
              value: 200,
              details: '스마트 컨트랙트와 시스템의 보안 취약점을 전문적으로 감사하고 상세한 보고서를 작성하는 활동'
            },
            {
              title: '취약점 발견 및 보고',
              criteria: '취약점 검증 완료',
              value: 180,
              details: '시스템의 잠재적 보안 위험을 발견하고 해결 방안과 함께 보고하는 활동'
            },
            {
              title: '보안 업데이트 개발',
              criteria: '업데이트 테스트 통과',
              value: 250,
              details: '발견된 보안 이슈에 대한 패치나 업데이트를 개발하고 안전성을 검증하는 활동'
            },
            {
              title: '보안 교육 및 가이드 작성',
              criteria: '커뮤니티 승인',
              value: 120,
              details: '구성원들을 위한 보안 교육 자료와 가이드라인을 작성하여 전체적인 보안 의식을 높이는 활동'
            }
          ],
          proposedInitialOP: 'security-specialist-did-11111',
          proposedOPQualification: '사이버 보안 분야 12년 경력, 블록체인 보안 감사 전문가, 다수의 DeFi 프로토콜 보안 컨설팅 경험, CISSP 자격증 보유로 프로토콜 보안을 책임질 최적의 전문가',
          collateralPaid: 30,
          targetDAO: 'Political DAO',
          eligibleVoters: 'political-dao-members',
          quorumRequired: 40
        }
      ]

    };
    
    const staticProposals = proposalData[daoId] || [];
    const dynamicProposals = this.dynamicProposals?.[daoId] || [];
    
    return [...staticProposals, ...dynamicProposals];
  }

  // 새 제안을 중앙화된 데이터에 추가
  addNewProposal(daoId, proposal) {
    // 실제로는 이 데이터가 블록체인이나 데이터베이스에 저장되어야 함
    // 여기서는 시뮬레이션을 위해 메모리에만 저장
    if (!this.dynamicProposals) {
      this.dynamicProposals = {};
    }
    if (!this.dynamicProposals[daoId]) {
      this.dynamicProposals[daoId] = [];
    }
    this.dynamicProposals[daoId].push(proposal);
  }

  // DAO 이름 반환
  getDAOName(daoId) {
    // 기본 DAO 이름 매핑
    const allDAONames = {
      'dev-dao': 'Development DAO',
      'community-dao': 'Community DAO',
      'ops-dao': 'Operations DAO',
      'political-dao': 'Political DAO',
      'marketing': 'Marketing DAO',
      'research': 'Research DAO'
    };
    
    // 동적 DAO 매핑 확인 (새로 생성된 DAO들)
    if (this.dynamicDAONames && this.dynamicDAONames[daoId]) {
      return this.dynamicDAONames[daoId];
    }
    
    // 기본 매핑에서 찾기
    if (allDAONames[daoId]) {
      return allDAONames[daoId];
    }
    
    // 사용자 소속 DAO에서도 찾기 (백업)
    const userDAOs = this.getUserMyDAOsData();
    const dao = userDAOs.find(dao => dao.id === daoId);
    return dao ? dao.name : 'Unknown DAO';
  }

  // DAO 이름을 ID로 변환
  getDAOIdFromName(daoName) {
    // 실제 사용자 소속 DAO에서 검색
    const userDAOs = this.getUserMyDAOsData();
    
    // 정확한 이름 매치
    let dao = userDAOs.find(dao => dao.name.toLowerCase() === daoName.toLowerCase());
    if (dao) return dao.id;
    
    // 부분 매치 (예: "dev" -> "dev-dao")
    dao = userDAOs.find(dao => 
      dao.name.toLowerCase().includes(daoName.toLowerCase()) ||
      dao.id.includes(daoName.toLowerCase())
    );
    
    return dao ? dao.id : null;
  }

  renderProposals(proposals) {
    const proposalsGrid = document.getElementById('activeProposals');
    if (!proposalsGrid) return;

    proposalsGrid.innerHTML = '';

    if (proposals.length === 0) {
      proposalsGrid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-vote-yea" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;"></i>
          <p>현재 활성 제안이 없습니다.</p>
        </div>
      `;
      return;
    }

    proposals.forEach(proposal => {
      let proposalCard;
      
      // 현재 거버넌스 과정에 따라 다른 카드 렌더링
      if (this.currentGovernanceProcess === 'proposal') {
        proposalCard = this.createProposalStageCard(proposal);
      } else {
        proposalCard = this.createProposalCard(proposal);
      }
      
      proposalsGrid.appendChild(proposalCard);
    });
  }

  // 제안과정 전용 카드 (모금 중심의 컴팩트 디자인)
  createProposalStageCard(proposal) {
    const card = document.createElement('div');
    card.className = 'proposal-card proposal-stage-card';
    card.setAttribute('data-proposal-id', proposal.id);
    
    // 시뮬레이션 데이터 - 프로토콜 기준으로 수정
    const daoMemberCount = Math.floor(Math.random() * 1000) + 500; // 500-1500명 DAO 구성원
    // 탄핵안은 10% 또는 최소 30P 중 더 큰 값, 일반제안은 1%
    let targetAmount;
    if (proposal.isImpeachment) {
      const tenPercent = Math.ceil(daoMemberCount * 0.1);
      targetAmount = Math.max(tenPercent, 30); // 최소 30P 보장
    } else {
      targetAmount = Math.ceil(daoMemberCount * 0.01);
    }
    const currentAmount = Math.floor(Math.random() * targetAmount * 0.8); // 현재 모금액 (80% 미만)
    const remainingAmount = targetAmount - currentAmount; // 남은 모금 필요량
    const daysLeft = Math.floor(Math.random() * 14) + 1; // 남은 일수
    
    card.onclick = () => window.dapp.showProposalDetailModal(proposal, currentAmount, targetAmount, daysLeft, daoMemberCount);
    
    card.innerHTML = `
      <div class="proposal-compact-header">
        <div class="proposal-status-badge funding">
          💰 모금중
        </div>
        <div class="proposal-time-left">
          ${daysLeft}일 남음
        </div>
      </div>
      
      <div class="proposal-compact-content">
        <div class="proposal-title-row">
          <h3 class="proposal-compact-title" onclick="event.stopPropagation(); window.dapp.showProposalDetailModal(${JSON.stringify(proposal)}, ${currentAmount}, ${targetAmount}, ${daysLeft}, ${daoMemberCount});">
            ${proposal.title}
          </h3>
          <div class="dao-mini-tag">${proposal.daoName}</div>
        </div>
        
        <div class="proposer-row">
          <div class="proposer-compact">
            👤 ${proposal.proposer}
          ${this.isAuthenticated ? `
              <button class="mini-support-btn" onclick="event.stopPropagation(); window.dapp.showSupportModal('${proposal.id}');" title="지지하기">
                지지하기 👍
            </button>
          ` : ''}
        </div>
      </div>
        
        <p class="proposal-compact-description">${proposal.description}</p>
        
        <div class="funding-progress-compact">
          <div class="funding-bar">
            <div class="funding-fill" style="width: ${Math.min((currentAmount / targetAmount) * 100, 100)}%"></div>
          </div>
          <div class="funding-stats">
            <span>${currentAmount}P / ${targetAmount}P</span>
            <span>${Math.round((currentAmount / targetAmount) * 100)}%</span>
          </div>
        </div>
        
        <div class="proposal-actions-compact">
          <button class="btn-primary-compact" onclick="event.stopPropagation(); window.dapp.showFundingModal('${proposal.id}', ${remainingAmount});">
            P토큰 모금하기
          </button>
        </div>
      </div>
    `;

    return card;
  }

  // 투표과정 상세 모달 표시
  showVotingDetailModal(proposal) {
    // DAO 생성 제안인 경우 특별한 모달 표시
    if (proposal.specialType === 'dao-creation') {
      this.showDAOCreationVotingModal(proposal);
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'votingDetailModal';
    
    // 마감일 계산
    const deadline = new Date(proposal.votingEndDate || proposal.deadline);
    const daysLeft = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
    
    const totalVotes = (proposal.votesFor || 0) + (proposal.votesAgainst || 0) + (proposal.abstentions || 0);
    const forPercentage = totalVotes > 0 ? ((proposal.votesFor || 0) / totalVotes * 100).toFixed(1) : 0;
    const againstPercentage = totalVotes > 0 ? ((proposal.votesAgainst || 0) / totalVotes * 100).toFixed(1) : 0;
    const abstainPercentage = totalVotes > 0 ? ((proposal.abstentions || 0) / totalVotes * 100).toFixed(1) : 0;
    
    modal.innerHTML = `
      <div class="modal-content voting-detail-modal">
        <div class="modal-header">
          <h3>${proposal.title}</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="proposal-detail-header">
            <div class="proposal-meta-info">
              <div class="meta-item">
                <i class="fas fa-building"></i>
                <span>${proposal.daoName}</span>
              </div>
              <div class="meta-item">
                <i class="fas fa-user"></i>
          <span>제안자: ${proposal.proposer}</span>
        </div>
              <div class="meta-item">
                <i class="fas fa-clock"></i>
                <span>투표 마감: ${daysLeft > 0 ? `${daysLeft}일 남음` : '마감'}</span>
          </div>
          </div>
            <div class="proposal-status-info">
              <div class="status-badge ${proposal.status}">
                <i class="fas fa-vote-yea"></i>
                <span>${proposal.status === 'active' ? '투표중' : '대기중'}</span>
        </div>
            </div>
          </div>
          
          <div class="proposal-description-full">
            <h4>제안 내용</h4>
            <p>${proposal.description}</p>
            <div class="proposal-details">
              <h5>상세 설명</h5>
              <p>이 제안은 ${proposal.daoName}에서 정식으로 투표 단계에 진입한 안건입니다. ${proposal.isImpeachment ? 'OP 탄핵안으로 특별한 투표 규칙이 적용됩니다.' : '모든 DAO 구성원이 투표에 참여할 수 있습니다.'}</p>
              <ul>
                <li>투표 방식: 찬성/반대/기권</li>
                <li>투표 기간: ${proposal.votingStartDate || '진행중'} ~ ${proposal.votingEndDate || '미정'}</li>
                ${proposal.isImpeachment ? `
                <li class="impeachment-rule"><strong>탄핵안 특별 규칙:</strong></li>
                <li class="impeachment-rule">- 정족수: <strong>60%</strong> (일반제안: 40%)</li>
                <li class="impeachment-rule">- 통과 기준: 찬성 <strong>60%</strong> 이상 (일반제안: 50%)</li>
                ` : `
                <li>결정 기준: 과반수 찬성 시 통과</li>
                `}
                <li>투표 후 진행: 검토과정 또는 실행단계</li>
              </ul>
            </div>
          </div>

          <div class="proposal-attachments-section">
            <h4><i class="fas fa-paperclip"></i> 첨부파일</h4>
            <div class="attachments-list">
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-pdf text-red-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">개발_로드맵_2024.pdf</div>
                  <div class="attachment-size">3.2 MB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-alt text-gray-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">제안_상세내용.txt</div>
                  <div class="attachment-size">156 KB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-image text-green-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">시스템_아키텍처.jpg</div>
                  <div class="attachment-size">2.8 MB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
            </div>
          </div>
          
          <div class="voting-status-detail">
            <h4>투표 현황</h4>
            <div class="voting-progress-detail">
              <div class="vote-summary-large">
                <div class="vote-option">
                  <div class="vote-label">찬성</div>
                  <div class="vote-count">${proposal.votesFor || 0}표</div>
                  <div class="vote-percentage">${forPercentage}%</div>
                </div>
                <div class="vote-option">
                  <div class="vote-label">반대</div>
                  <div class="vote-count">${proposal.votesAgainst || 0}표</div>
                  <div class="vote-percentage">${againstPercentage}%</div>
                </div>
                <div class="vote-option">
                  <div class="vote-label">기권</div>
                  <div class="vote-count">${proposal.abstentions || 0}표</div>
                  <div class="vote-percentage">${abstainPercentage}%</div>
                </div>
              </div>
              <div class="progress-bar-large">
                <div class="progress-for" style="width: ${forPercentage}%"></div>
                <div class="progress-against" style="width: ${againstPercentage}%"></div>
                <div class="progress-abstain" style="width: ${abstainPercentage}%"></div>
              </div>
              <div class="voting-explanation">
                <p><strong>총 ${totalVotes}표</strong>가 투표에 참여했습니다.</p>
                ${proposal.hasVoted ? 
                  '<p class="voted-notice">✅ 이미 투표에 참여하셨습니다.</p>' : 
                  '<p class="vote-encourage">아직 투표하지 않으셨다면 아래에서 투표해주세요.</p>'
                }
              </div>
            </div>
          </div>
          
          ${this.isAuthenticated && !proposal.hasVoted ? `
            <div class="voting-actions-modal">
              <h4>투표하기</h4>
              <div class="fee-info">
                <div class="fee-notice">
                  <i class="fas fa-info-circle"></i>
                  <span>투표 참여 수수료: <strong>0.001 B</strong> (0.1P 소모)</span>
                </div>

              </div>
              <div class="vote-buttons-large">
                <button type="button" class="vote-btn-large vote-for" onclick="window.dapp.vote('${proposal.id}', 'for'); this.closest('.modal').remove();">
                  <i class="fas fa-thumbs-up"></i>
                  <span>찬성</span>
                </button>
                <button type="button" class="vote-btn-large vote-against" onclick="window.dapp.vote('${proposal.id}', 'against'); this.closest('.modal').remove();">
                  <i class="fas fa-thumbs-down"></i>
                  <span>반대</span>
                </button>
                <button type="button" class="vote-btn-large abstain" onclick="window.dapp.vote('${proposal.id}', 'abstain'); this.closest('.modal').remove();">
                  <i class="fas fa-minus"></i>
                  <span>기권</span>
                </button>
              </div>
            </div>
          ` : ''}
          
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">닫기</button>
        ${this.isAuthenticated ? `
              <button type="button" class="btn-primary" onclick="window.dapp.showSupportModal('${proposal.id}'); this.closest('.modal').remove();">
                <i class="fas fa-heart"></i>
                지지하기
            </button>
            ` : `
              <button type="button" class="btn-primary" onclick="document.querySelector('[data-tab=wallet]').click(); this.closest('.modal').remove();">
                <i class="fas fa-fingerprint"></i>
                인증 후 투표 참여
            </button>
            `}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // DAO 생성 제안 투표 모달 표시
  showDAOCreationVotingModal(proposal) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'daoCreationVotingModal';
    
    // 마감일 계산
    const deadline = new Date(proposal.votingEndDate || proposal.deadline);
    const daysLeft = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24));
    
    const totalVotes = (proposal.votesFor || 0) + (proposal.votesAgainst || 0) + (proposal.abstentions || 0);
    const forPercentage = totalVotes > 0 ? ((proposal.votesFor || 0) / totalVotes * 100).toFixed(1) : 0;
    const againstPercentage = totalVotes > 0 ? ((proposal.votesAgainst || 0) / totalVotes * 100).toFixed(1) : 0;
    const abstainPercentage = totalVotes > 0 ? ((proposal.abstentions || 0) / totalVotes * 100).toFixed(1) : 0;
    
    modal.innerHTML = `
      <div class="modal-content dao-creation-voting-modal">
        <div class="modal-header">
          <h3><i class="fas fa-plus-circle"></i> ${proposal.title}</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <!-- DAO 생성 제안 뱃지 -->
          <div class="dao-creation-badge">
            <i class="fas fa-building"></i>
            <span>DAO 생성 제안</span>
          </div>

          <!-- 제안 기본 정보 -->
          <div class="dao-creation-section">
            <div class="proposal-meta-info">
              <div class="meta-item">
                <i class="fas fa-user"></i>
                <span>제안자: ${proposal.proposer}</span>
              </div>
              <div class="meta-item">
                <i class="fas fa-clock"></i>
                <span>투표 마감: ${daysLeft > 0 ? `${daysLeft}일 남음` : '마감'}</span>
              </div>
              <div class="meta-item">
                <i class="fas fa-coins"></i>
                <span>담보: Political DAO 30P 지급완료</span>
              </div>
            </div>
            
            <div class="proposal-description">
              <h4><i class="fas fa-info-circle"></i> 제안 요약</h4>
              <p>${proposal.description}</p>
            </div>
          </div>

          <!-- 생성될 DAO 정보 -->
          <div class="dao-creation-section">
            <h4><i class="fas fa-building"></i> 생성될 DAO 정보</h4>
            <div class="dao-info-grid">
              <div class="dao-info-item">
                <label>DAO 이름</label>
                <div class="dao-name-display">${proposal.proposedDAOName}</div>
              </div>
              <div class="dao-info-item full-width">
                <label>DAO 목적 및 설명</label>
                <div class="dao-description-display">${proposal.proposedDAODescription}</div>
              </div>
              <div class="dao-info-item full-width">
                <label>DAO 필요성</label>
                <div class="dao-justification-display">${proposal.proposedDAOJustification}</div>
              </div>
            </div>
          </div>

          <!-- 예상 DCA 목록 -->
          <div class="dao-creation-section">
            <h4><i class="fas fa-tasks"></i> 예상 지정기여활동 (DCA)</h4>
            <div class="proposed-dca-list">
              ${proposal.proposedDCAs.map((dca, index) => `
                <div class="proposed-dca-item">
                  <div class="dca-header">
                    <h5>DCA ${index + 1}: ${dca.title}</h5>
                    <div class="dca-value">${dca.value}B</div>
                  </div>
                  <div class="dca-criteria">
                    <strong>검증기준:</strong> ${dca.criteria}
                  </div>
                  <div class="dca-details">
                    <strong>상세내용:</strong> ${dca.details}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 이니셜 OP 후보 정보 -->
          <div class="dao-creation-section">
            <h4><i class="fas fa-crown"></i> 이니셜 OP 후보</h4>
            <div class="initial-op-info">
              <div class="op-candidate-clickable" onclick="window.dapp.showProposerProfile('${proposal.proposer}', '${proposal.proposerDID}')" style="cursor: pointer;">
                <div class="op-candidate-profile">
                  <div class="op-avatar">${proposal.proposer?.charAt(0) || 'U'}</div>
                  <div class="op-details">
                    <div class="op-name">${proposal.proposer} (제안자)</div>
                    <div class="op-address">${this.maskAddress(proposal.proposerCommunicationAddress || '010-9990-4718')}</div>
                  </div>
                </div>
                <div class="op-view-badge">프로필 보기 →</div>
              </div>
              <div class="op-description">
                <small>제안자가 DAO 승인 시 이니셜 OP로 임명됩니다. 클릭하여 제안자의 상세 프로필을 확인하세요.</small>
              </div>
            </div>
          </div>

          <!-- 첨부파일 -->
          <div class="dao-creation-section">
            <h4><i class="fas fa-paperclip"></i> 첨부파일</h4>
            <div class="attachments-list">
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-word text-blue-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">DAO_운영계획서.docx</div>
                  <div class="attachment-size">1.2 MB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-pdf text-red-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">예산계획_및_자금운용방안.pdf</div>
                  <div class="attachment-size">4.1 MB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-image text-green-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">조직도_및_역할분담.png</div>
                  <div class="attachment-size">967 KB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- 투표 현황 -->
          <div class="dao-creation-section">
            <h4><i class="fas fa-chart-bar"></i> 투표 현황</h4>
            <div class="voting-progress-detail">
              <div class="vote-summary-large">
                <div class="vote-option">
                  <div class="vote-label">찬성</div>
                  <div class="vote-count">${proposal.votesFor || 0}표</div>
                  <div class="vote-percentage">${forPercentage}%</div>
                </div>
                <div class="vote-option">
                  <div class="vote-label">반대</div>
                  <div class="vote-count">${proposal.votesAgainst || 0}표</div>
                  <div class="vote-percentage">${againstPercentage}%</div>
                </div>
                <div class="vote-option">
                  <div class="vote-label">기권</div>
                  <div class="vote-count">${proposal.abstentions || 0}표</div>
                  <div class="vote-percentage">${abstainPercentage}%</div>
                </div>
              </div>
              <div class="progress-bar-large">
                <div class="progress-for" style="width: ${forPercentage}%"></div>
                <div class="progress-against" style="width: ${againstPercentage}%"></div>
                <div class="progress-abstain" style="width: ${abstainPercentage}%"></div>
              </div>
              <div class="voting-explanation">
                <p><strong>총 ${totalVotes}표</strong>가 투표에 참여했습니다.</p>
                ${proposal.hasVoted ? 
                  '<p class="voted-notice">✅ 이미 투표에 참여하셨습니다.</p>' : 
                  '<p class="vote-encourage">아직 투표하지 않으셨다면 아래에서 투표해주세요.</p>'
                }
              </div>
              <div class="dao-creation-voting-info">
                <i class="fas fa-info-circle"></i>
                이 투표는 Political DAO 구성원만 참여할 수 있으며, 정족수 40% 달성 시 조기 종료됩니다.
              </div>
            </div>
          </div>

          ${this.isAuthenticated && !proposal.hasVoted ? `
            <div class="voting-actions-modal">
              <h4><i class="fas fa-vote-yea"></i> DAO 생성 제안 투표</h4>
              <div class="fee-info">
                <div class="fee-notice">
                  <i class="fas fa-info-circle"></i>
                  <span>투표 참여 수수료: <strong>0.001 B</strong> (0.1P 소모)</span>
                </div>

              </div>
              <div class="vote-buttons-large">
                <button type="button" class="vote-btn-large vote-for" onclick="window.dapp.vote('${proposal.id}', 'for'); this.closest('.modal').remove();">
                  <i class="fas fa-thumbs-up"></i>
                  <span>찬성</span>
                  <small>DAO 생성 찬성</small>
                </button>
                <button type="button" class="vote-btn-large vote-against" onclick="window.dapp.vote('${proposal.id}', 'against'); this.closest('.modal').remove();">
                  <i class="fas fa-thumbs-down"></i>
                  <span>반대</span>
                  <small>DAO 생성 반대</small>
                </button>
                <button type="button" class="vote-btn-large abstain" onclick="window.dapp.vote('${proposal.id}', 'abstain'); this.closest('.modal').remove();">
                  <i class="fas fa-minus"></i>
                  <span>기권</span>
                  <small>투표 기권</small>
                </button>
              </div>
            </div>
          ` : ''}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">닫기</button>
          ${this.isAuthenticated ? `
            <button type="button" class="btn-primary" onclick="window.dapp.showSupportModal('${proposal.id}'); this.closest('.modal').remove();">
              <i class="fas fa-heart"></i>
              지지하기
            </button>
          ` : `
            <button type="button" class="btn-primary" onclick="document.querySelector('[data-tab=wallet]').click(); this.closest('.modal').remove();">
              <i class="fas fa-fingerprint"></i>
              인증 후 투표 참여
            </button>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // 제안 상세 모달 표시 (제안과정용)
  showProposalDetailModal(proposal, currentAmount, targetAmount, daysLeft, daoMemberCount) {
    // DAO 생성 제안인 경우 특별한 모달 표시
    if (proposal.specialType === 'dao-creation') {
      this.showDAOCreationProposalModal(proposal, currentAmount, targetAmount, daysLeft, daoMemberCount);
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'proposalDetailModal';
    
    const fundingProgress = (currentAmount / targetAmount * 100).toFixed(1);
    const remainingAmount = targetAmount - currentAmount;
    
    modal.innerHTML = `
      <div class="modal-content proposal-detail-modal">
        <div class="modal-header">
          <h3>${proposal.title}</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="proposal-detail-header">
            <div class="proposal-meta-info">
              <div class="meta-item">
                <i class="fas fa-building"></i>
                <span>${proposal.daoName}</span>
              </div>
              <div class="meta-item">
                <i class="fas fa-user"></i>
                <span>제안자: ${proposal.proposer}</span>
              </div>
              <div class="meta-item">
                <i class="fas fa-clock"></i>
                <span>마감: ${daysLeft}일 남음</span>
              </div>
            </div>
            <div class="proposal-status-info">
              <div class="status-badge funding">
                <i class="fas fa-coins"></i>
                <span>모금중</span>
              </div>
            </div>
          </div>
          
          <div class="proposal-description-full">
            <h4>제안 내용</h4>
            <p>${proposal.description}</p>
            <div class="proposal-details">
              <h5>상세 설명</h5>
              <p>이 제안은 ${proposal.daoName}의 발전을 위한 중요한 안건입니다. 구성원들의 적극적인 참여와 P-Token 모금을 통해 투표 단계로 진입할 수 있습니다.</p>
              <ul>
                <li>목표: DAO 구성원의 ${proposal.isImpeachment ? '10% 또는 최소 30P' : '1%'} 지지 확보${proposal.isImpeachment ? ' (탄핵안)' : ''}</li>
                <li>필요 모금량: ${targetAmount}P</li>
                <li>현재 진행률: ${fundingProgress}%</li>
                <li>투표 진입 시 혜택: 제안 실현 가능성 확보</li>
              </ul>
            </div>
          </div>

          <div class="proposal-attachments-section">
            <h4><i class="fas fa-paperclip"></i> 첨부파일</h4>
            <div class="attachments-list">
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-pdf text-red-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">프로젝트_기획서_v2.1.pdf</div>
                  <div class="attachment-size">2.3 MB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-image text-green-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">UI_mockup_design.png</div>
                  <div class="attachment-size">1.7 MB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-word text-blue-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">예산계획서.docx</div>
                  <div class="attachment-size">845 KB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
            </div>
          </div>
          
          <div class="funding-status-detail">
            <h4>모금 현황</h4>
            <div class="funding-progress-detail">
              <div class="progress-numbers">
                <span class="current">${currentAmount}P</span>
                <span class="separator">/</span>
                <span class="target">${targetAmount}P</span>
                <span class="percentage">(${fundingProgress}%)</span>
              </div>
              <div class="progress-bar-large">
                <div class="progress-fill-large" style="width: ${fundingProgress}%"></div>
              </div>
              <div class="funding-explanation">
                <p>DAO 구성원 ${daoMemberCount}명의 ${proposal.isImpeachment ? '10% 또는 최소 30P' : '1%'} (${targetAmount}P) 달성 시 투표 단계로 진입합니다.${proposal.isImpeachment ? ' (탄핵안 특별 기준)' : ''}</p>
                <p><strong>남은 모금 필요량: ${remainingAmount}P</strong></p>
              </div>
            </div>
          </div>
          
          ${this.isAuthenticated ? `
            <div class="modal-actions">
              <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">닫기</button>
              <button type="button" class="btn-primary" onclick="window.dapp.showFundingModal('${proposal.id}', ${remainingAmount}); this.closest('.modal').remove();">
                <i class="fas fa-coins"></i>
                P토큰으로 모금하기
            </button>
          </div>
          ` : `
            <div class="modal-actions">
              <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">닫기</button>
              <button type="button" class="btn-primary" onclick="document.querySelector('[data-tab=wallet]').click(); this.closest('.modal').remove();">
                <i class="fas fa-fingerprint"></i>
                인증 후 모금 참여
              </button>
            </div>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // 모금하기 모달 표시 (모바일 최적화)
  showFundingModal(proposalId, maxAmount = null) {
    if (!this.isAuthenticated) {
      alert('모금 참여를 위해서는 먼저 로그인이 필요합니다.');
      return;
    }

    // 제안의 DAO ID 찾기
    const proposal = this.findProposalById(proposalId);
    const daoId = proposal ? proposal.daoId : 'unknown';
    const daoName = this.getDAOName(daoId);

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'fundingModal';
    
    // 해당 DAO의 P토큰 보유량 가져오기
    const currentPTokens = this.getDAOPTokenBalance(daoId);
    const actualMaxAmount = maxAmount ? Math.min(maxAmount, currentPTokens) : Math.min(50, currentPTokens);
    
    modal.innerHTML = `
      <div class="modal-content funding-modal">
        <div class="modal-header">
          <h3>P토큰으로 모금하기</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="funding-form">
            <div class="dao-info-section">
              <div class="dao-tag">${daoName}</div>
              <p class="funding-notice">이 안건은 ${daoName}에 제안되었습니다. ${daoName}의 P토큰으로만 모금에 참여할 수 있습니다.</p>
            </div>
            <div class="funding-summary">
              <div class="summary-item">
                <span class="label">투표 진입까지 필요:</span>
                <span class="value">${maxAmount || '알 수 없음'}P</span>
              </div>
              <div class="summary-item">
                <span class="label">내 ${daoName} P토큰:</span>
                <span class="value">${currentPTokens}P</span>
              </div>
              <div class="summary-item highlight">
                <span class="label">참여 가능 최대량:</span>
                <span class="value">${actualMaxAmount}P</span>
              </div>
            </div>
            
            <div class="amount-input-section">
              <label for="fundingAmount">모금 참여량</label>
              <div class="amount-input-wrapper">
                <input type="number" id="fundingAmount" min="1" max="${actualMaxAmount}" step="1" placeholder="1~${actualMaxAmount}">
                <span class="input-suffix">P</span>
              </div>
              <div class="amount-buttons">
                <button type="button" class="amount-preset" onclick="document.getElementById('fundingAmount').value = 1">1P</button>
                <button type="button" class="amount-preset" onclick="document.getElementById('fundingAmount').value = ${Math.min(5, actualMaxAmount)}">${Math.min(5, actualMaxAmount)}P</button>
                <button type="button" class="amount-preset" onclick="document.getElementById('fundingAmount').value = ${Math.min(10, actualMaxAmount)}">${Math.min(10, actualMaxAmount)}P</button>
                <button type="button" class="amount-preset" onclick="document.getElementById('fundingAmount').value = ${actualMaxAmount}">최대</button>
              </div>
            </div>
            
            <div class="fee-info">
              <div class="fee-notice">
                <i class="fas fa-info-circle"></i>
                <span>모금 참여 수수료: <strong>0.001 B</strong></span>
              </div>

            </div>
            

          </div>
          
          <div class="modal-actions mobile-optimized">
            <button type="button" class="btn-secondary mobile-btn" onclick="this.closest('.modal').remove()">취소</button>
            <button type="button" class="btn-primary mobile-btn" onclick="window.dapp.submitFunding('${proposalId}', ${actualMaxAmount})">
              <i class="fas fa-coins"></i>
              모금 참여
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // 모금 참여 제출
  async submitFunding(proposalId, maxAmount = null) {
    const authConfirmed = await this.requestAuthentication('모금 참여');
    if (!authConfirmed) {
      return;
    }

    // 제안의 DAO ID 찾기
    const proposal = this.findProposalById(proposalId);
    const daoId = proposal ? proposal.daoId : 'unknown';
    const daoName = this.getDAOName(daoId);

    const fundingAmount = parseFloat(document.getElementById('fundingAmount').value);
    const currentPTokens = this.getDAOPTokenBalance(daoId);
    const actualMaxAmount = maxAmount ? Math.min(maxAmount, currentPTokens) : Math.min(50, currentPTokens);

    if (!fundingAmount || fundingAmount < 1) {
      alert('모금 참여량은 최소 1P 이상이어야 합니다.');
      return;
    }

    if (fundingAmount > actualMaxAmount) {
      alert(`모금 참여량이 한도를 초과했습니다. 최대 참여 가능량: ${actualMaxAmount}P`);
      return;
    }

    if (currentPTokens < fundingAmount) {
      alert(`P-Token이 부족합니다. 현재 보유량: ${currentPTokens}P, 참여량: ${fundingAmount}P`);
      return;
    }

    if (confirm(`${daoName}의 ${fundingAmount}P로 모금에 참여하시겠습니까?\n\n투표 진입까지 필요한 모금량에 기여하게 됩니다.`)) {
      // DAO별 P-Token 차감 시뮬레이션
      const balances = this.getDAOPTokenBalances();
      balances[daoId] = Math.max(0, (balances[daoId] || 0) - fundingAmount);
      
      this.showSuccessMessage(`${daoName}의 ${fundingAmount}P로 모금에 참여했습니다!\n제안이 투표 단계로 진입하는데 기여하셨습니다.`);
      
      // 모달 닫기
      document.getElementById('fundingModal').remove();
      
      // 거버넌스 목록 새로고침
      this.loadGovernance();
    }
  }

  // 제안 공유 기능
  shareProposal(proposalId) {
    const shareText = `백야 프로토콜에서 진행중인 제안을 확인해보세요!\n제안 ID: ${proposalId}`;
    
    if (navigator.share) {
      // 웹 공유 API 사용 (모바일에서 지원)
      navigator.share({
        title: '백야 프로토콜 제안',
        text: shareText,
        url: window.location.href
      }).catch(console.error);
    } else {
      // 클립보드에 복사
      navigator.clipboard.writeText(shareText).then(() => {
        this.showSuccessMessage('제안 정보가 클립보드에 복사되었습니다.');
      }).catch(() => {
        // 클립보드 API를 지원하지 않는 경우
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showSuccessMessage('제안 정보가 클립보드에 복사되었습니다.');
      });
    }
  }

  createProposalCard(proposal) {
    const card = document.createElement('div');
    card.className = 'proposal-card';
    card.setAttribute('data-proposal-id', proposal.id);
    card.onclick = () => this.showVotingDetailModal(proposal);
    
    // 투표과정 마감일 계산 (투표 시작일로부터 2주)
    let daysLeft;
    let timeLeftText;
    
    if (proposal.votingStartDate) {
      const votingStart = new Date(proposal.votingStartDate);
      const votingEnd = new Date(votingStart.getTime() + (14 * 24 * 60 * 60 * 1000)); // 2주 후
      daysLeft = Math.ceil((votingEnd - new Date()) / (1000 * 60 * 60 * 24));
      timeLeftText = daysLeft > 0 ? `${daysLeft}일 남음` : '마감';
    } else {
      // 기본값: 현재로부터 14일 후
      daysLeft = 14;
      timeLeftText = '14일 남음';
    }
    
          card.innerHTML = `
        <div class="proposal-compact-header">
          <div class="proposal-status-badge ${proposal.status}">
            🗳️ 투표중
          </div>
        <div class="proposal-time-left">
          ${timeLeftText}
        </div>
      </div>
      
      <div class="proposal-compact-content">
        <div class="proposal-title-row">
          <h3 class="proposal-compact-title" onclick="event.stopPropagation(); window.dapp.showVotingDetailModal(${JSON.stringify(proposal)});">
            ${proposal.title}
          </h3>
          <div class="dao-mini-tag">${proposal.daoName}</div>
        </div>
        
        <div class="proposer-row">
          <div class="proposer-compact">
            👤 ${proposal.proposer}
            ${this.isAuthenticated ? `
              <button class="mini-support-btn" onclick="event.stopPropagation(); window.dapp.showSupportModal('${proposal.id}');" title="지지하기">
                지지하기 👍
              </button>
        ` : ''}
          </div>
        </div>
        
        <p class="proposal-compact-description">
          ${proposal.description}
        </p>
        
        <div class="vote-progress">
          <div class="vote-bar">
            <div class="vote-for" style="width: ${proposal.votesFor / (proposal.votesFor + proposal.votesAgainst + proposal.abstentions) * 100 || 0}%"></div>
            <div class="vote-against" style="width: ${proposal.votesAgainst / (proposal.votesFor + proposal.votesAgainst + proposal.abstentions) * 100 || 0}%"></div>
            <div class="vote-abstain" style="width: ${proposal.abstentions / (proposal.votesFor + proposal.votesAgainst + proposal.abstentions) * 100 || 0}%"></div>
          </div>
          <div class="vote-counts">
            <span class="votes-for">찬성 ${proposal.votesFor || 0}</span>
            <span class="votes-against">반대 ${proposal.votesAgainst || 0}</span>
            <span class="abstentions">기권 ${proposal.abstentions || 0}</span>
          </div>
        </div>
        
        <div class="vote-actions">
          <button class="vote-btn vote-for" onclick="event.stopPropagation(); window.dapp.vote('${proposal.id}', 'for')" ${proposal.hasVoted ? 'disabled' : ''}>
            찬성
          </button>
          <button class="vote-btn vote-against" onclick="event.stopPropagation(); window.dapp.vote('${proposal.id}', 'against')" ${proposal.hasVoted ? 'disabled' : ''}>
            반대  
          </button>
          <button class="vote-btn abstain" onclick="event.stopPropagation(); window.dapp.vote('${proposal.id}', 'abstain')" ${proposal.hasVoted ? 'disabled' : ''}>
            기권
          </button>
        </div>
      </div>
    `;

    return card;
  }

  // 검토과정 카드 생성
  createReviewStageCard(proposal) {
    const stageLabels = {
      'dao-op': 'OP검토',
      'ops-dao-objection': 'Ops검토', 
      'top-op': '최종검토'
    };
    
    const stageName = stageLabels[proposal.reviewStage] || 'OP검토';
    
    const card = document.createElement('div');
    card.className = 'proposal-card review-stage-card';
    card.setAttribute('data-proposal-id', proposal.id);
    card.onclick = () => window.dapp.showReviewDetailModal(proposal.id);
    
    // 검토과정별 마감일 계산
    let timeLeftText;
    
    switch (proposal.reviewStage) {
      case 'dao-op':
        // OP검토: 제한없음
        timeLeftText = '제한없음';
        break;
        
      case 'ops-dao-objection':
        // Ops검토: 2일
        if (proposal.objectionStartDate) {
          const objectionStart = new Date(proposal.objectionStartDate);
          const objectionEnd = new Date(objectionStart.getTime() + (2 * 24 * 60 * 60 * 1000)); // 2일 후
          const remainingTime = Math.ceil((objectionEnd - new Date()) / (1000 * 60 * 60 * 24));
          timeLeftText = remainingTime > 0 ? `${remainingTime}일 남음` : '마감';
        } else {
          timeLeftText = '2일 남음';
        }
        break;
        
      case 'top-op':
        // 최종검토: 제한없음
        timeLeftText = '제한없음';
        break;
        
      default:
        timeLeftText = '검토중';
        break;
    }
    
    card.innerHTML = `
      <div class="proposal-compact-header">
        <div class="proposal-status-badge ${proposal.reviewStage}">
          📋 ${stageName}
        </div>
        <div class="proposal-time-left">
          ${timeLeftText}
        </div>
      </div>
      
      <div class="proposal-compact-content">
        <div class="proposal-title-row">
          <h3 class="proposal-compact-title" onclick="event.stopPropagation(); window.dapp.showReviewDetailModal('${proposal.id}');">
            ${proposal.title}
          </h3>
          <div class="dao-mini-tag">${proposal.daoName}</div>
        </div>
        
        <div class="proposer-row">
          <div class="proposer-compact">
            👤 ${proposal.proposer}
          </div>
        </div>
        
        <p class="proposal-compact-description">
          ${proposal.description}
        </p>
      </div>
    `;
    
    return card;
  }

  // 검토 단계별 상태 정보 생성
  getReviewStageInfo(proposal) {
    switch (proposal.reviewStage) {
      case 'dao-op':
        return {
          stageName: '1단계: DAO-OP 검토',
          stageClass: 'stage-dao-op',
          statusHtml: `
            <div class="review-progress">
              <div class="progress-item active">
                <div class="progress-dot"></div>
                <span>DAO-OP 검토중</span>
              </div>
              <div class="progress-item">
                <div class="progress-dot"></div>
                <span>Ops-DAO 이의신청</span>
              </div>
              <div class="progress-item">
                <div class="progress-dot"></div>
                <span>최상위 OP 최종검토</span>
              </div>
            </div>
            <div class="review-detail">
              <p>현재 ${proposal.daoName}의 OP가 제안을 검토하고 있습니다.</p>
            </div>
          `,
          actionsHtml: `
            <button class="btn-secondary" onclick="window.dapp.showReviewDetailModal('${proposal.id}')">
              검토 상세보기
            </button>
          `
        };
        
      case 'ops-dao-objection':
        const daysLeft = this.calculateDaysLeft(proposal.objectionDeadline);
        return {
          stageName: '2단계: Ops-DAO 이의신청',
          stageClass: 'stage-ops-dao',
          statusHtml: `
            <div class="review-progress">
              <div class="progress-item completed">
                <div class="progress-dot"></div>
                <span>DAO-OP 승인완료</span>
              </div>
              <div class="progress-item active">
                <div class="progress-dot"></div>
                <span>Ops-DAO 이의신청기간</span>
              </div>
              <div class="progress-item">
                <div class="progress-dot"></div>
                <span>최상위 OP 최종검토</span>
              </div>
            </div>
            <div class="review-detail">
              <p>모든 DAO OP들의 이의신청 기간입니다.</p>
              <div class="deadline-info">
                <span class="deadline">이의신청 마감: ${daysLeft > 0 ? `${daysLeft}일 남음` : '오늘 마감'}</span>
              </div>
              ${proposal.objections && proposal.objections.length > 0 ? 
                `<div class="objections-count">현재 ${proposal.objections.length}건의 이의신청</div>` : 
                '<div class="no-objections">아직 이의신청이 없습니다</div>'
              }
            </div>
          `,
          actionsHtml: `
            <button class="btn-secondary" onclick="window.dapp.showReviewDetailModal('${proposal.id}')">
              이의신청 상세보기
            </button>
          `
        };
        
      case 'top-op':
        return {
          stageName: '3단계: 최상위 OP 최종검토',
          stageClass: 'stage-top-op',
          statusHtml: `
            <div class="review-progress">
              <div class="progress-item completed">
                <div class="progress-dot"></div>
                <span>DAO-OP 승인완료</span>
              </div>
              <div class="progress-item completed">
                <div class="progress-dot"></div>
                <span>Ops-DAO 이의신청완료</span>
              </div>
              <div class="progress-item active">
                <div class="progress-dot"></div>
                <span>최상위 OP 최종검토</span>
              </div>
            </div>
            <div class="review-detail">
              <p>Ops-DAO의 최상위 OP가 최종 검토 중입니다.</p>
              ${proposal.finalDecisionPending ? 
                '<div class="pending-decision">최종 결정을 기다리고 있습니다</div>' : 
                '<div class="decision-made">최종 결정이 완료되었습니다</div>'
              }
            </div>
          `,
          actionsHtml: `
            <button class="btn-secondary" onclick="window.dapp.showReviewDetailModal('${proposal.id}')">
              최종검토 상세보기
            </button>
          `
        };
        
      default:
        return {
          stageName: '검토중',
          stageClass: 'stage-unknown',
          statusHtml: '<div class="review-detail"><p>검토 정보를 불러오는 중입니다.</p></div>',
          actionsHtml: ''
        };
    }
  }

  // 검토 상세 모달 표시
  showReviewDetailModal(proposalId) {
    // 제안 정보 찾기
    const allProposals = this.loadAllProposals();
    const proposal = allProposals.find(p => p.id === proposalId);
    
    if (!proposal) {
      this.showErrorMessage('제안 정보를 찾을 수 없습니다.');
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'reviewDetailModal';
    
    modal.innerHTML = `
      <div class="modal-content review-detail-modal">
        <div class="modal-header">
          <h3>검토과정 상세정보</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="proposal-summary">
            <h4>${proposal.title}</h4>
            <div class="meta-info">
              <span class="dao-name">${proposal.daoName}</span>
              <span class="proposer">제안자: ${proposal.proposer}</span>
            </div>
            <p class="description">${proposal.description}</p>
          </div>
          
          <div class="voting-summary">
            <h5>투표 결과</h5>
            <div class="vote-details">
              <div class="vote-item">
                <span class="vote-type votes-for">찬성</span>
                <span class="vote-count">${proposal.votesFor}표</span>
              </div>
              <div class="vote-item">
                <span class="vote-type votes-against">반대</span>
                <span class="vote-count">${proposal.votesAgainst}표</span>
              </div>
              <div class="vote-item">
                <span class="vote-type abstentions">기권</span>
                <span class="vote-count">${proposal.abstentions}표</span>
              </div>
            </div>
            <div class="vote-total">총 ${proposal.votesFor + proposal.votesAgainst + proposal.abstentions}표 참여</div>
          </div>
          
          <div class="review-timeline">
            <h5>검토 진행 현황</h5>
            ${this.generateReviewTimeline(proposal)}
          </div>
        </div>
        
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">닫기</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // 검토 타임라인 생성
  generateReviewTimeline(proposal) {
    let timeline = '';
    
    // DAO 생성 제안도 일반 제안과 동일한 3단계 프로세스를 따름
    {
      // 일반 제안의 경우 기존 3단계 구성
      
      // 1단계: DAO-OP 검토 (Political DAO OP 검토)
      const stage1Status = proposal.reviewStage === 'dao-op' ? 'active' : 'completed';
      const daoOPLabel = proposal.specialType === 'dao-creation' ? 'Political DAO OP 검토' : 'DAO-OP 검토';
      
      timeline += `
        <div class="timeline-item ${stage1Status}">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <h6>1단계: ${daoOPLabel}</h6>
            <p>
              ${proposal.reviewStage === 'dao-op' ? 
                `${proposal.specialType === 'dao-creation' ? 'Political DAO' : proposal.daoName}의 OP가 검토 중입니다.` : 
                `${proposal.opDecision === 'approved' ? '승인됨' : '거부됨'} (${this.formatDate(proposal.opApprovedDate || proposal.reviewStartDate)})`
              }
            </p>
            ${proposal.opReviewComment && proposal.reviewStage !== 'dao-op' ? `
              <div class="review-comment-section">
                <div class="review-comment-header">
                  <strong>OP 검토 의견</strong>
                  <span class="reviewer-info">${proposal.opReviewer || 'DAO OP'} · ${this.formatDate(proposal.opApprovedDate)}</span>
                </div>
                <div class="review-comment-content">
                  ${proposal.opReviewComment}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
      
      // 2단계: Ops-DAO 이의신청 (OP 승인 시에만)
      if (proposal.opDecision === 'approved' || proposal.reviewStage === 'ops-dao-objection') {
        const stage2Status = proposal.reviewStage === 'ops-dao-objection' ? 'active' : 
                            proposal.reviewStage === 'top-op' ? 'completed' : 'pending';
        
        timeline += `
          <div class="timeline-item ${stage2Status}">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <h6>2단계: Ops-DAO 이의신청 기간</h6>
              <p>
                ${proposal.reviewStage === 'ops-dao-objection' ? 
                  `이의신청 기간 진행 중 (마감: ${this.formatDate(proposal.objectionDeadline)})` :
                  proposal.reviewStage === 'top-op' ? 
                  `이의신청 기간 완료` :
                  '대기 중'
                }
              </p>
              ${proposal.reviewStage === 'ops-dao-objection' || (proposal.reviewStage === 'top-op' && proposal.objectionPeriodEnded) ? `
                ${proposal.objections && proposal.objections.length > 0 ? 
                  `<div class="objections-list">
                    <strong>이의신청 ${proposal.objections.length}건</strong>
                    ${proposal.objections.map(obj => `
                      <div class="objection-detail-item">
                        <div class="objection-header">
                          <span class="objector-name">
                            <strong>${obj.objectorName || obj.objector || obj}</strong>
                            <span class="objector-role">(${obj.objectorRole || 'OP'})</span>
                          </span>
                          <span class="objection-date">${this.formatDate(obj.date || '')}</span>
                        </div>
                        ${obj.reason ? `
                          <div class="objection-reason">
                            <strong>이의신청 사유:</strong> ${obj.reason}
                          </div>
                        ` : ''}
                        ${obj.details ? `
                          <div class="objection-details">
                            ${obj.details}
                          </div>
                        ` : ''}
                        ${obj.response ? `
                          <div class="objection-response">
                            <strong>제안자 응답:</strong> ${obj.response}
                          </div>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>` : 
                  proposal.reviewStage === 'ops-dao-objection' ? 
                  '<div class="no-objections">아직 이의신청이 없습니다</div>' : 
                  '<div class="no-objections">이의신청이 없었습니다</div>'
                }
              ` : ''}
            </div>
          </div>
        `;
      }
      
      // 3단계: 최상위 OP 최종검토
      if (proposal.reviewStage === 'top-op') {
        timeline += `
          <div class="timeline-item active">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <h6>3단계: 최상위 OP 최종검토</h6>
              <p>
                ${proposal.status === 'final-review' ? 
                  'Ops-DAO 최상위 OP가 최종 검토 중입니다.' :
                  proposal.finalDecisionPending ? 
                  'Ops-DAO 최상위 OP가 최종 검토 중입니다.' :
                  '최종 결정이 완료되었습니다.'
                }
              </p>
              <div class="final-review-info">
                <i class="fas fa-crown"></i>
                <span>이의신청 기간이 종료되어 최종 검토 단계입니다.</span>
                ${proposal.objectionPeriodEnded ? 
                  `(종료일: ${this.formatDate(proposal.objectionPeriodEnded)})` : ''
                }
              </div>
            </div>
          </div>
        `;
      }
    }
    
    return timeline;
  }

  // 날짜 포맷팅 유틸리티
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  // 마감일까지 남은 일수 계산
  calculateDaysLeft(deadline) {
    if (!deadline) return 0;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const timeDiff = deadlineDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  async vote(proposalId, voteType) {
    if (!this.isAuthenticated) {
              alert('투표를 위해서는 먼저 로그인이 필요합니다.');
      return;
    }

    const voteTypeKorean = {
      'for': '찬성',
      'support': '찬성',
      'against': '반대', 
      'abstain': '기권'
    };
    
          // 본인 인증 (지문/얼굴/비밀번호 중 택1)
      const authConfirmed = await this.requestAuthentication('투표');
      if (!authConfirmed) {
        return;
      }

      // B-Token 잔액 확인 (투표 수수료)
      const currentBTokens = parseFloat(document.getElementById('bTokenBalance').textContent.replace(' B', '')) || 0;
      const votingFee = 0.001;
      
      if (currentBTokens < votingFee) {
        alert(`B-Token이 부족합니다. 현재 보유량: ${currentBTokens}B, 필요량: ${votingFee}B`);
        return;
      }

      if (confirm(`이 제안에 ${voteTypeKorean[voteType]} 투표하시겠습니까?\n- P-Token 소모: 0.1P\n- 네트워크 수수료: ${votingFee}B`)) {
        // 수수료 차감
        const newBBalance = currentBTokens - votingFee;
        document.getElementById('bTokenBalance').textContent = `${newBBalance.toFixed(3)} B`;

        // 투표 후 해당 제안의 투표 수 증가 시뮬레이션
        this.updateProposalVotes(proposalId, voteType);

        // 트랜잭션 기록
        const transaction = {
          type: 'governance_vote',
          amount: votingFee,
          timestamp: new Date().toISOString(),
          description: `거버넌스 투표 수수료 (${voteTypeKorean[voteType]})`
        };

        this.showSuccessMessage(`${voteTypeKorean[voteType]} 투표가 완료되었습니다. (수수료: ${votingFee}B)`);
      
      // 투표 후 제안 목록 새로고침
      setTimeout(() => {
        this.loadGovernance();
      }, 1000);
    }
  }

  // 투표 수 업데이트 및 상태 체크
  updateProposalVotes(proposalId, voteType) {
    // 모든 제안 데이터에서 해당 제안 찾기
    const allProposals = [
      ...this.proposalStageProposals,
      ...this.votingStageProposals,
      ...this.reviewStageProposals
    ];

    const proposal = allProposals.find(p => p.id === proposalId);
    if (proposal) {
      // 투표 수 증가
      if (voteType === 'for' || voteType === 'support') {
        proposal.votesFor = (proposal.votesFor || 0) + 1;
      } else if (voteType === 'against') {
        proposal.votesAgainst = (proposal.votesAgainst || 0) + 1;
      } else if (voteType === 'abstain') {
        proposal.abstentions = (proposal.abstentions || 0) + 1;
      }
      
      proposal.hasVoted = true;
      
      // 투표 상태 체크
      this.checkVotingStatus(proposal);
    }
  }

  // 투표 상태 체크 함수
  checkVotingStatus(proposal) {
    if (proposal.status !== 'voting') return;
    
    const totalVotes = (proposal.votesFor || 0) + (proposal.votesAgainst || 0) + (proposal.abstentions || 0);
    
    // 탄핵제안은 정족수 60%, 일반제안은 40%
    const quorumRequired = proposal.isImpeachment ? 60 : (proposal.quorumRequired || 40);
    
    // 탄핵제안은 찬성 비율 60%, 일반제안은 50%
    const approvalThreshold = proposal.isImpeachment ? 0.6 : 0.5;
    
    // DAO별 구성원 수 (시뮬레이션)
    const daoMemberCounts = {
      'Development DAO': 250,
      'Operations DAO': 180,
      'Community DAO': 320,
      'Political DAO': 285,
      '개발 DAO': 250,
      '커뮤니티 DAO': 320,
      '연구 DAO': 200
    };
    
    const memberCount = daoMemberCounts[proposal.daoName] || 200;
    const quorumVotes = Math.ceil(memberCount * (quorumRequired / 100));
    
    // 투표 기간 체크
    const votingEndDate = new Date(proposal.votingEndDate);
    const now = new Date();
    const isExpired = now > votingEndDate;
    
    console.log(`투표 상태 체크 - ${proposal.title}:`, {
      totalVotes,
      quorumVotes,
      memberCount,
      isExpired,
      votingEndDate: proposal.votingEndDate,
      isImpeachment: proposal.isImpeachment,
      quorumRequired,
      approvalThreshold
    });
    
    // 1. 14일 기간 만료 체크
    if (isExpired && totalVotes < quorumVotes) {
      proposal.status = 'failed';
      proposal.failReason = `투표 기간 만료 (정족수 ${quorumRequired}% 미달성)`;
      this.moveProposalToFailed(proposal);
      return;
    }
    
    // 2. 정족수 달성 시 조기 종료
    if (totalVotes >= quorumVotes) {
      const approveVotes = proposal.votesFor || 0;
      const rejectVotes = proposal.votesAgainst || 0;
      const totalDecisionVotes = approveVotes + rejectVotes; // 기권 제외
      
      // 찬성표가 설정된 임계점 이상이면 통과
      if (totalDecisionVotes > 0 && approveVotes / totalDecisionVotes >= approvalThreshold) {
        proposal.status = 'passed';
        this.moveProposalToReview(proposal);
      } else {
        proposal.status = 'rejected';
        const requiredPercentage = Math.round(approvalThreshold * 100);
        proposal.failReason = `찬성표 부족 (${requiredPercentage}% 미달)`;
        this.moveProposalToFailed(proposal);
      }
    }
  }

  // 통과된 제안을 검토 단계로 이동
  moveProposalToReview(proposal) {
    // voting 단계에서 제거
    const votingIndex = this.votingStageProposals.findIndex(p => p.id === proposal.id);
    if (votingIndex !== -1) {
      this.votingStageProposals.splice(votingIndex, 1);
    }
    
    // 탄핵안 투표 통과 시 특별 처리
    if (proposal.isImpeachment) {
      this.processImpeachmentPassed(proposal);
      return; // 탄핵안은 검토 단계로 가지 않고 즉시 처리
    }
    
    // 일반 제안은 검토 단계로 이동
    proposal.status = proposal.daoName === 'Political DAO' ? 'ops-dao-review' : 'dao-review';
    this.reviewStageProposals.push(proposal);
    
    console.log(`제안 "${proposal.title}" 이/가 투표 통과하여 검토 단계로 이동했습니다.`);
  }

  // 실패한 제안 처리
  moveProposalToFailed(proposal) {
    // voting 단계에서 제거
    const votingIndex = this.votingStageProposals.findIndex(p => p.id === proposal.id);
    if (votingIndex !== -1) {
      this.votingStageProposals.splice(votingIndex, 1);
    }
    
    console.log(`제안 "${proposal.title}" 이/가 실패했습니다. 사유: ${proposal.failReason}`);
  }

  // 탄핵안 통과 처리
  processImpeachmentPassed(proposal) {
    console.log(`탄핵안 "${proposal.title}" 통과 - OP 탄핵 프로세스 시작`);
    
    // 탄핵된 OP 정보
    const impeachedDAO = proposal.daoName;
    const impeachedOPName = this.getCurrentOP(impeachedDAO);
    
    // 1. 탄핵된 OP의 P토큰 전체 소각
    this.burnImpeachedOPTokens(impeachedDAO, impeachedOPName);
    
    // 2. OP 직책 제거
    this.removeOPPosition(impeachedDAO, impeachedOPName);
    
    // 3. P토큰 보유자 순위에 따른 OP 승계 시작
    this.startOPSuccessionProcess(impeachedDAO);
    
    // 4. 성공 메시지 표시
    this.showSuccessMessage(`${impeachedDAO} OP 탄핵이 완료되었습니다. 새로운 OP 선정 프로세스를 시작합니다.`);
  }

  // 현재 OP 조회
  getCurrentOP(daoName) {
    // 실제로는 블록체인에서 조회하지만 시뮬레이션
    const daoOPs = {
      'Development DAO': '김개발',
      'Operations DAO': '이운영', 
      'Community DAO': '박커뮤니티',
      '개발 DAO': '김개발',
      '커뮤니티 DAO': '박커뮤니티',
      '연구 DAO': '최연구'
    };
    return daoOPs[daoName] || '알수없음';
  }

  // 탄핵된 OP의 P토큰 소각
  burnImpeachedOPTokens(daoName, opName) {
    console.log(`${daoName}의 OP ${opName}의 모든 P토큰을 소각합니다.`);
    // 실제로는 블록체인 트랜잭션으로 처리
    
    // 시뮬레이션: 탄핵된 OP가 현재 사용자인 경우 P토큰 소각
    if (this.isCurrentUserOP(daoName)) {
      const pTokenElement = document.getElementById('pTokenBalance');
      if (pTokenElement) {
        pTokenElement.textContent = '0 P';
      }
      this.showErrorMessage(`탄핵으로 인해 ${daoName}의 모든 P토큰이 소각되었습니다.`);
    }
  }

  // 현재 사용자가 해당 DAO의 OP인지 확인
  isCurrentUserOP(daoName) {
    // 시뮬레이션: 사용자가 해당 DAO의 OP인 경우를 가정
    const userOPRole = this.getUserOPRole();
    return userOPRole.opDAOs && userOPRole.opDAOs.includes(daoName);
  }

  // OP 직책 제거
  removeOPPosition(daoName, opName) {
    console.log(`${daoName}에서 ${opName}의 OP 직책을 제거합니다.`);
    // 실제로는 스마트 컨트랙트에서 처리
  }

  // OP 승계 프로세스 시작
  startOPSuccessionProcess(daoName) {
    // P토큰 보유자 순위 조회
    const tokenHolders = this.getPTokenHolders(daoName);
    
    if (tokenHolders.length === 0) {
      console.log(`${daoName}에 P토큰 보유자가 없습니다.`);
      return;
    }
    
    // 순위별로 OP 승계 제안
    this.currentSuccessionProcess = {
      daoName: daoName,
      tokenHolders: tokenHolders,
      currentRank: 0,
      startTime: Date.now()
    };
    
    this.showOPSuccessionPopup();
  }

  // P토큰 보유자 순위 조회 (시뮬레이션)
  getPTokenHolders(daoName) {
    // 실제로는 블록체인에서 조회하지만 시뮬레이션
    const holders = [
      { name: '홍길동', tokens: 150, did: 'did:baekya:hong123' },
      { name: '김철수', tokens: 120, did: 'did:baekya:kim456' },
      { name: '이영희', tokens: 100, did: 'did:baekya:lee789' },
      { name: '박민수', tokens: 90, did: 'did:baekya:park012' },
      { name: '최지영', tokens: 80, did: 'did:baekya:choi345' }
    ];
    
    // 토큰 보유량 순으로 정렬 (내림차순)
    return holders.sort((a, b) => b.tokens - a.tokens);
  }

  // OP 승계 팝업 표시
  showOPSuccessionPopup() {
    if (!this.currentSuccessionProcess) return;
    
    const { daoName, tokenHolders, currentRank } = this.currentSuccessionProcess;
    const currentCandidate = tokenHolders[currentRank];
    
    if (!currentCandidate) {
      console.log(`${daoName}의 모든 P토큰 보유자가 OP 승계를 거부했습니다.`);
      return;
    }
    
    // 삭제 불가능한 전체화면 모달 생성
    const modal = document.createElement('div');
    modal.className = 'modal active op-succession-modal';
    modal.id = 'opSuccessionModal';
    
    // 남은 후보자 수 계산
    const remainingCandidates = tokenHolders.length - currentRank - 1;
    
    modal.innerHTML = `
      <div class="modal-content op-succession-content">
        <div class="succession-header">
          <div class="succession-icon">
            <i class="fas fa-crown"></i>
          </div>
          <h2>OP 승계 제안</h2>
        </div>
        
        <div class="succession-body">
          <div class="impeachment-notice">
            <p><strong>기존의 OP가 탄핵되었습니다.</strong></p>
            <h3>${daoName}의 OP가 되시겠습니까?</h3>
          </div>
          
          <div class="candidate-info">
            <div class="candidate-rank">
              <span class="rank-badge">P토큰 보유 ${currentRank + 1}위</span>
              <span class="token-amount">${currentCandidate.tokens}P 보유</span>
            </div>
            <div class="candidate-details">
              <div class="candidate-name">${currentCandidate.name}</div>
              <div class="candidate-did">${currentCandidate.did}</div>
            </div>
          </div>
          
          <div class="succession-rules">
            <h4><i class="fas fa-info-circle"></i> OP 승계 규칙</h4>
            <ul>
              <li>이 제안은 <strong>24시간</strong> 동안 유효합니다</li>
              <li>거부 또는 미응답 시 다음 순위자에게 넘어갑니다</li>
              ${remainingCandidates > 0 ? 
                `<li>현재 대기 중인 후보자: <strong>${remainingCandidates}명</strong></li>` : 
                '<li>마지막 후보자입니다</li>'
              }
              <li>수락 시 즉시 OP 권한을 획득합니다</li>
            </ul>
          </div>
          
          <div class="op-responsibilities">
            <h4><i class="fas fa-tasks"></i> OP 주요 역할</h4>
            <ul>
              <li>DAO 거버넌스 제안 검토 및 승인</li>
              <li>커뮤니티 운영 및 중재</li>
              <li>DAO 전략 수립 및 실행</li>
              <li>구성원 기여도 평가 및 보상 분배</li>
            </ul>
          </div>
          
          <div class="succession-timer">
            <div class="timer-display">
              <i class="fas fa-clock"></i>
              <span id="successionTimer">24:00:00</span>
            </div>
            <small>남은 시간</small>
          </div>
        </div>
        
        <div class="succession-actions">
          <button class="btn-danger succession-btn" onclick="window.dapp.rejectOPSuccession()">
            <i class="fas fa-times"></i>
            거부
          </button>
          <button class="btn-primary succession-btn" onclick="window.dapp.acceptOPSuccession()">
            <i class="fas fa-crown"></i>
            OP 수락
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 24시간 타이머 시작
    this.startSuccessionTimer();
    
    // 클릭으로 닫기 방지
    modal.onclick = (e) => {
      e.stopPropagation();
    };
    
    // ESC 키로 닫기 방지
    document.addEventListener('keydown', this.preventModalClose);
  }

  // OP 승계 타이머 시작
  startSuccessionTimer() {
    const duration = 24 * 60 * 60 * 1000; // 24시간
    const startTime = Date.now();
    
    this.successionTimerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = duration - elapsed;
      
      if (remaining <= 0) {
        // 시간 만료 - 자동으로 다음 후보자에게
        this.rejectOPSuccession();
        return;
      }
      
      // 시간 표시 업데이트
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
      
      const timerElement = document.getElementById('successionTimer');
      if (timerElement) {
        timerElement.textContent = 
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  // OP 승계 수락
  acceptOPSuccession() {
    if (!this.currentSuccessionProcess) return;
    
    const { daoName, tokenHolders, currentRank } = this.currentSuccessionProcess;
    const newOP = tokenHolders[currentRank];
    
    // 타이머 정리
    if (this.successionTimerInterval) {
      clearInterval(this.successionTimerInterval);
    }
    
    // 모달 제거
    const modal = document.getElementById('opSuccessionModal');
    if (modal) {
      modal.remove();
    }
    
    // 키보드 이벤트 제거
    document.removeEventListener('keydown', this.preventModalClose);
    
    // OP 임명 처리
    this.appointNewOP(daoName, newOP);
    
    // 승계 프로세스 종료
    this.currentSuccessionProcess = null;
    
    this.showSuccessMessage(`축하합니다! ${daoName}의 새로운 OP로 임명되었습니다.`);
  }

  // OP 승계 거부
  rejectOPSuccession() {
    if (!this.currentSuccessionProcess) return;
    
    const { daoName, tokenHolders, currentRank } = this.currentSuccessionProcess;
    
    // 타이머 정리
    if (this.successionTimerInterval) {
      clearInterval(this.successionTimerInterval);
    }
    
    // 모달 제거
    const modal = document.getElementById('opSuccessionModal');
    if (modal) {
      modal.remove();
    }
    
    // 키보드 이벤트 제거
    document.removeEventListener('keydown', this.preventModalClose);
    
    // 다음 후보자로 이동
    this.currentSuccessionProcess.currentRank++;
    
    // 다음 후보자가 있으면 계속 진행
    if (this.currentSuccessionProcess.currentRank < tokenHolders.length) {
      setTimeout(() => {
        this.showOPSuccessionPopup();
      }, 1000);
    } else {
      // 모든 후보자가 거부한 경우
      console.log(`${daoName}의 모든 P토큰 보유자가 OP 승계를 거부했습니다.`);
      this.currentSuccessionProcess = null;
      this.showErrorMessage(`${daoName}의 모든 후보자가 OP 승계를 거부했습니다. 임시 운영 상태로 전환됩니다.`);
    }
  }

  // 새로운 OP 임명
  appointNewOP(daoName, newOP) {
    console.log(`${daoName}의 새로운 OP로 ${newOP.name}을 임명합니다.`);
    // 실제로는 스마트 컨트랙트에서 처리
    
    // 현재 사용자가 새로운 OP인 경우 UI 업데이트
    if (this.isCurrentUser(newOP)) {
      this.refreshUserOPStatus();
    }
  }

  // 현재 사용자인지 확인
  isCurrentUser(candidate) {
    // 시뮬레이션: 첫 번째 후보자를 현재 사용자로 가정
    return this.currentSuccessionProcess && 
           this.currentSuccessionProcess.currentRank === 0;
  }

  // 사용자 OP 상태 새로고침
  refreshUserOPStatus() {
    // OP 검토 탭 등 UI 업데이트
    if (this.currentTab === 'op-review') {
      this.loadOPReview();
    }
  }

  // 모달 닫기 방지
  preventModalClose(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // 주기적인 투표 상태 체크 (앱 시작 시 호출)
  startVotingStatusChecker() {
    // 1분마다 모든 투표 중인 제안들의 상태 체크
    setInterval(() => {
      this.votingStageProposals.forEach(proposal => {
        this.checkVotingStatus(proposal);
      });
    }, 60000); // 1분마다
    
    // 앱 시작 시 즉시 한 번 체크
    setTimeout(() => {
      this.votingStageProposals.forEach(proposal => {
        this.checkVotingStatus(proposal);
      });
    }, 1000);
  }

  // 지지하기 모달 표시
  showSupportModal(proposalId) {
    if (!this.isAuthenticated) {
              alert('지지하기를 위해서는 먼저 로그인이 필요합니다.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'supportModal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>제안 지지하기</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="support-info">
            <p>제안자에게 P-Token을 양도하여 지지를 표현할 수 있습니다.</p>
            <div class="form-group">
              <label for="supportAmount">지지 토큰량 (최대 30P)</label>
              <input type="number" id="supportAmount" min="1" max="30" step="0.1" placeholder="1-30 P">
              <small>1명당 최대 30P까지 양도 가능합니다</small>
            </div>
            <div class="current-balance">
              <span>현재 P-Token 보유량: <strong id="currentPBalance">${document.getElementById('pTokenBalance')?.textContent || '0 P'}</strong></span>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
            <button type="button" class="btn-primary" onclick="window.dapp.submitSupport('${proposalId}')">지지하기</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // 지지하기 제출
  async submitSupport(proposalId) {
        // 본인 인증 (지문/얼굴/비밀번호 중 택1)
    const authConfirmed = await this.requestAuthentication('제안 지지');
    if (!authConfirmed) {
      return;
    }

    const supportAmount = parseFloat(document.getElementById('supportAmount').value);

    if (!supportAmount || supportAmount < 1 || supportAmount > 30) {
      alert('지지 토큰량은 1P 이상 30P 이하여야 합니다.');
      return;
    }

    // P-Token 잔액 확인
    const currentPTokens = parseFloat(document.getElementById('pTokenBalance').textContent.replace(' P', '')) || 0;
    if (currentPTokens < supportAmount) {
      alert(`P-Token이 부족합니다. 현재 보유량: ${currentPTokens}P, 필요량: ${supportAmount}P`);
      return;
    }

    if (confirm(`${supportAmount}P를 제안자에게 양도하여 지지하시겠습니까?`)) {
      // P-Token 차감 시뮬레이션
      const newBalance = currentPTokens - supportAmount;
      document.getElementById('pTokenBalance').textContent = `${newBalance.toFixed(1)} P`;
      
      this.showSuccessMessage(`${supportAmount}P로 제안을 지지했습니다!`);
      
      // 모달 닫기
      document.getElementById('supportModal').remove();
    }
  }

  // 유틸리티 메서드
  showSuccessMessage(message) {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    // 새 토스트 생성
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.innerHTML = `
      <i class="fas fa-check-circle"></i>
      <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 3000);
  }

  closeAllModals() {
    // 정적 모달들 (HTML에 미리 정의된 것들)은 숨기기만 함
    const staticModals = [
      'profileSettingsModal',
      'opReviewModal', 
      'profilePhotoModal',
      'biometricModal'
    ];
    
    staticModals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('active');
      }
    });
    
    // 동적으로 생성된 모달들만 완전히 제거
    const dynamicModals = document.querySelectorAll('.modal:not(#profileSettingsModal):not(#opReviewModal):not(#profilePhotoModal):not(#biometricModal)');
    dynamicModals.forEach(modal => modal.remove());
  }

  async refreshWallet() {
    if (this.isAuthenticated) {
      await this.updateTokenBalances();
      this.showSuccessMessage('지갑 정보가 새로고침되었습니다.');
    }
  }

  // 전역 함수들
  createDAO() {
    if (!this.isAuthenticated) {
              alert('DAO 생성을 위해서는 먼저 로그인이 필요합니다.');
      return;
    }
    this.showDAOCreationModal();
  }

  showDAOCreationModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'daoCreationModal';
    
    modal.innerHTML = `
      <div class="modal-content dao-creation-modal">
        <div class="modal-header">
          <h3><i class="fas fa-building"></i> DAO 설립 제안</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="dao-creation-notice">
            <div class="notice-card-compact">
              <div class="notice-icon-small">
                <i class="fas fa-info-circle"></i>
              </div>
              <div class="notice-content-compact">
                <strong>담보 30P</strong> • Ops-DAO 검토 • 승인시 Initial-OP • 거부시 15P 반환
              </div>
            </div>
          </div>

          <form id="daoCreationForm" onsubmit="window.dapp.handleDAOCreation(event)">
            <div class="form-group">
              <label for="daoName">DAO 이름 *</label>
              <input type="text" id="daoName" name="daoName" required 
                     placeholder="예: AI Research DAO" maxlength="50">
              <small>DAO의 정식 명칭을 입력해주세요</small>
            </div>

            <div class="form-group">
              <label for="daoPurpose">설립 목적 *</label>
              <textarea id="daoPurpose" name="daoPurpose" required rows="4" 
                        placeholder="이 DAO가 달성하고자 하는 목표와 비전을 구체적으로 설명해주세요" 
                        maxlength="1000"></textarea>
              <small>DAO의 존재 이유와 추구하는 가치를 명확히 기술해주세요</small>
            </div>

            <div class="form-group">
              <label for="dcaDescription">DCA (기여도 평가 기준) *</label>
              <textarea id="dcaDescription" name="dcaDescription" required rows="5" 
                        placeholder="구성원의 기여도를 어떻게 측정하고 평가할지 구체적인 기준을 제시해주세요&#10;예시:&#10;- 코드 커밋 수와 품질&#10;- 리뷰 참여도&#10;- 문서화 기여도&#10;- 커뮤니티 활동 참여도" 
                        maxlength="2000"></textarea>
              <small>객관적이고 공정한 평가 기준을 제시해주세요</small>
            </div>

            <div class="form-group">
              <label for="validationCriteria">검증 기준 *</label>
              <textarea id="validationCriteria" name="validationCriteria" required rows="4" 
                        placeholder="DCA 평가의 정확성을 보장하기 위한 검증 절차와 기준을 설명해주세요&#10;예시:&#10;- 피어 리뷰 과정&#10;- 정기적인 평가 주기&#10;- 이의제기 절차&#10;- 투명성 보장 방안" 
                        maxlength="1500"></textarea>
              <small>DCA 평가의 신뢰성을 확보할 수 있는 검증 체계를 제시해주세요</small>
            </div>

            <div class="form-group">
              <label for="initialMembers">초기 구성원 계획</label>
              <textarea id="initialMembers" name="initialMembers" rows="3" 
                        placeholder="DAO 설립 후 참여할 예정인 구성원들과 역할 분담 계획을 설명해주세요 (선택사항)" 
                        maxlength="1000"></textarea>
              <small>구체적인 구성원 모집 계획이 있다면 기재해주세요</small>
            </div>

            <!-- 첨부파일 섹션 -->
            <div class="form-group">
              <label for="daoAttachments">첨부파일</label>
              <div class="file-upload-area" onclick="document.getElementById('daoFileInput').click()">
                <div class="file-upload-content">
                  <i class="fas fa-cloud-upload-alt"></i>
                  <p>클릭하여 파일을 선택하거나 드래그하여 업로드하세요</p>
                  <small>지원 형식: PDF, DOC, DOCX, TXT, JPG, PNG (최대 10MB)</small>
                </div>
                <input type="file" id="daoFileInput" multiple accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" style="display: none;" onchange="window.dapp.handleDAOFileUpload(this)">
              </div>
              <div class="uploaded-files-list" id="daoUploadedFiles"></div>
            </div>

            <div class="dao-creation-summary-compact">
              <div class="summary-highlight">
                <span class="stake-amount">담보: <strong>30 P</strong></span>
                <span class="risk-warning">거부시 15P만 반환</span>
              </div>
            </div>

            <div class="balance-check">
              <div class="current-balance">
                <i class="fas fa-wallet"></i>
                <span>현재 P-token: <strong id="currentPTokens">${document.getElementById('pTokenBalance')?.textContent || '0 P'}</strong></span>
              </div>
              ${parseFloat(document.getElementById('pTokenBalance')?.textContent || '0') < 30 ? `
                <div class="insufficient-balance">
                  <i class="fas fa-exclamation-triangle"></i>
                  <span>P-token이 부족합니다. 최소 30P가 필요합니다.</span>
                </div>
              ` : ''}
            </div>
          </form>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
            취소
          </button>
          <button type="submit" form="daoCreationForm" class="btn-primary" 
                  ${parseFloat(document.getElementById('pTokenBalance')?.textContent || '0') < 30 ? 'disabled' : ''}>
            <i class="fas fa-rocket"></i>
            DAO 설립 제안 (30P 담보)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  async handleDAOCreation(event) {
    event.preventDefault();
    
    // 각 필드를 개별적으로 가져와서 디버깅
    const daoName = document.getElementById('daoName')?.value?.trim() || '';
    const daoPurpose = document.getElementById('daoPurpose')?.value?.trim() || '';
    const dcaDescription = document.getElementById('dcaDescription')?.value?.trim() || '';
    const validationCriteria = document.getElementById('validationCriteria')?.value?.trim() || '';
    const initialMembers = document.getElementById('initialMembers')?.value?.trim() || '';
    
    console.log('입력된 필드 값들:', {
      daoName,
      daoPurpose,
      dcaDescription,
      validationCriteria,
      initialMembers
    });
    
    const daoData = {
      name: daoName,
      purpose: daoPurpose,
      dca: dcaDescription,
      validation: validationCriteria,
      initialMembers: initialMembers
    };

    // 유효성 검사 - 더 자세한 디버깅
    const missingFields = [];
    if (!daoData.name || daoData.name.length === 0) missingFields.push('DAO 이름');
    if (!daoData.purpose || daoData.purpose.length === 0) missingFields.push('설립 목적');
    if (!daoData.dca || daoData.dca.length === 0) missingFields.push('DCA (기여도 평가 기준)');
    if (!daoData.validation || daoData.validation.length === 0) missingFields.push('검증 기준');
    
    if (missingFields.length > 0) {
      console.error('누락된 필수 항목:', missingFields);
      console.error('입력된 데이터:', daoData);
      console.error('Form 요소 확인:', {
        daoName: document.getElementById('daoName'),
        daoPurpose: document.getElementById('daoPurpose'),
        dcaDescription: document.getElementById('dcaDescription'),
        validationCriteria: document.getElementById('validationCriteria')
      });
      this.showErrorMessage(`다음 필수 항목을 입력해주세요: ${missingFields.join(', ')}`);
      return;
    }

    if (daoData.name.length < 3) {
      this.showErrorMessage('DAO 이름은 최소 3글자 이상이어야 합니다.');
      return;
    }

    // P-token 잔액 확인
    const currentPTokens = parseFloat(document.getElementById('pTokenBalance')?.textContent || '0');
    if (currentPTokens < 30) {
      this.showErrorMessage(`P-token이 부족합니다. 현재: ${currentPTokens}P, 필요: 30P`);
      return;
    }

    try {
      // 본인 인증 요청
      const authConfirmed = await this.requestAuthentication('DAO 설립 제안');
      if (!authConfirmed) {
        return;
      }

      // 최종 확인
      const confirmed = confirm(
        `DAO 설립 제안을 제출하시겠습니까?\n\n` +
        `DAO 이름: ${daoData.name}\n` +
        `담보: 30P\n` +
        `검토기관: Ops-DAO\n\n` +
        `⚠️ 거부 시 15P만 반환됩니다.`
      );

      if (!confirmed) {
        return;
      }

      // DAO 설립 제안 제출
      await this.submitDAOCreation(daoData);
      
      // 모달 닫기
      document.getElementById('daoCreationModal').remove();
      
      this.showSuccessMessage('DAO 설립 제안이 성공적으로 제출되었습니다! Ops-DAO 검토 단계로 진입했습니다.');
      
    } catch (error) {
      console.error('DAO 설립 제안 실패:', error);
      this.showErrorMessage(error.message || 'DAO 설립 제안 중 오류가 발생했습니다.');
    }
  }

  async submitDAOCreation(daoData) {
    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // P-token 담보 차감
    const currentPTokens = parseFloat(document.getElementById('pTokenBalance')?.textContent || '0');
    const newPBalance = currentPTokens - 30;
    
    // 토큰 잔액 업데이트
    document.getElementById('pTokenBalance').textContent = `${newPBalance.toFixed(1)} P`;
    const walletPBalance = document.getElementById('walletPTokenBalance');
    if (walletPBalance) walletPBalance.textContent = `${newPBalance.toFixed(1)} P`;
    
    // DAO 설립 제안을 Ops 검토 시스템에 추가
    const proposalId = `dao-creation-${Date.now()}`;
    const daoCreationProposal = {
      id: proposalId,
      type: 'dao-creation',
      title: `${daoData.name} 설립 제안`,
      description: `새로운 DAO "${daoData.name}" 설립을 제안합니다.`,
      proposer: this.userProfile?.name || '사용자',
      status: 'ops-dao-review',
      reviewStage: 'ops-dao',
      submissionDate: new Date().toISOString(),
      daoData: daoData,
      stakeAmount: 30,
      votesFor: 0,
      votesAgainst: 0,
      abstentions: 0
    };
    
    // Ops 검토 목록에 추가 (실제로는 블록체인에 저장)
    if (!this.pendingDAOCreations) {
      this.pendingDAOCreations = [];
    }
    this.pendingDAOCreations.push(daoCreationProposal);
    
    return {
      success: true,
      proposalId: proposalId,
      transactionHash: `0x${Math.random().toString(16).substring(2)}`
    };
  }

  showProposalGuide() {
    alert('제안 가이드는 추후 업데이트 예정입니다.');
  }

  // 제안하기 관련 함수들
  showCreateProposal() {
    if (!this.isAuthenticated) {
              alert('제안 작성을 위해서는 먼저 로그인이 필요합니다.');
      return;
    }

    const modal = document.getElementById('createProposalModal');
    modal.classList.add('active');
    
    // 사용자의 소속 DAO 목록으로 대상 DAO 옵션 생성
    this.populateProposalDAOOptions();
    
    // 폼 이벤트 리스너 설정
    const form = document.getElementById('createProposalForm');
    form.onsubmit = (e) => this.handleCreateProposal(e);
  }

  // 제안 유형 변경 처리
  handleProposalTypeChange() {
    const proposalType = document.querySelector('input[name="proposalType"]:checked').value;
    const generalForm = document.getElementById('generalProposalForm');
    const daoCreationForm = document.getElementById('daoCreationProposalForm');
    
    if (proposalType === 'general') {
      // 일반제안 표시
      generalForm.style.display = 'block';
      daoCreationForm.style.display = 'none';
    } else if (proposalType === 'dao_creation') {
      // DAO생성제안 표시
      generalForm.style.display = 'none';
      daoCreationForm.style.display = 'block';
      
      // 첫 번째 기여하러가기 옵션 자동 추가
      setTimeout(() => {
        if (document.getElementById('contributionOptionsList').children.length === 0) {
          this.addContributionOption();
        }
      }, 100);
    }
  }

  closeCreateProposalModal() {
    const modal = document.getElementById('createProposalModal');
    modal.classList.remove('active');
    
    // 폼 초기화
    const form = document.getElementById('createProposalForm');
    form.reset();
    
    // 탄핵제안 관련 UI 초기화
    this.resetImpeachmentUI();
    
    // DAO 생성 양식 초기화
    this.resetDAOCreationForm();
  }

  // DAO 생성 양식 초기화
  resetDAOCreationForm() {
    // DCA 목록 초기화
    const dcaList = document.getElementById('newDAODCAList');
    if (dcaList) {
      dcaList.innerHTML = '';
    }
    
    // 기여하러가기 옵션 목록 초기화
    const contributionList = document.getElementById('contributionOptionsList');
    if (contributionList) {
      contributionList.innerHTML = '';
    }
    
    // 첨부파일 목록 초기화
    const uploadedFiles = document.getElementById('daoUploadedFiles');
    if (uploadedFiles) {
      uploadedFiles.innerHTML = '';
    }
    
    // 제안 유형을 일반제안으로 초기화
    const generalRadio = document.getElementById('generalProposal');
    if (generalRadio) {
      generalRadio.checked = true;
      this.handleProposalTypeChange();
    }
  }

  // DAO 첨부파일 업로드 처리
  handleDAOFileUpload(inputElement) {
    const files = Array.from(inputElement.files);
    const uploadedFilesContainer = document.getElementById('daoUploadedFiles');
    
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) { // 10MB 제한
        alert(`파일 "${file.name}"의 크기가 10MB를 초과합니다.`);
        return;
      }
      
      const fileItem = document.createElement('div');
      fileItem.className = 'uploaded-file-item';
      fileItem.innerHTML = `
        <div class="file-info">
          <i class="fas fa-file"></i>
          <span class="file-name">${file.name}</span>
          <span class="file-size">(${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
        </div>
        <button type="button" class="remove-file-btn" onclick="this.closest('.uploaded-file-item').remove()">
          <i class="fas fa-times"></i>
        </button>
      `;
      
      uploadedFilesContainer.appendChild(fileItem);
    });
  }

  // DAO 선택 시 호출되는 함수
  handleDAOSelection() {
    const daoSelect = document.getElementById('proposalDAO');
    const impeachmentOption = document.getElementById('impeachmentOption');
    
    if (daoSelect.value && daoSelect.value !== '') {
      // DAO가 선택되면 탄핵제안 체크박스 표시
      impeachmentOption.style.display = 'block';
    } else {
      // DAO가 선택되지 않으면 탄핵제안 체크박스 숨기기
      impeachmentOption.style.display = 'none';
      this.resetImpeachmentUI();
    }
  }

  // 탄핵제안 체크박스 토글 시 호출되는 함수
  handleImpeachmentToggle() {
    const isImpeachment = document.getElementById('isImpeachmentProposal').checked;
    const titleInput = document.getElementById('proposalTitle');
    const daoSelect = document.getElementById('proposalDAO');
    const requirementsTitle = document.getElementById('requirementsTitle');
    const normalRequirements = document.getElementById('requirementsList');
    const impeachmentRequirements = document.getElementById('impeachmentRequirementsList');
    
    if (isImpeachment) {
      // 탄핵제안 모드
      const daoName = this.getDAONameFromValue(daoSelect.value);
      titleInput.value = `${daoName} OP 탄핵안`;
      titleInput.readOnly = true;
      requirementsTitle.textContent = '탄핵안 요구사항';
      normalRequirements.style.display = 'none';
      impeachmentRequirements.style.display = 'block';
    } else {
      // 일반제안 모드
      titleInput.value = '';
      titleInput.readOnly = false;
      requirementsTitle.textContent = '제안 요구사항';
      normalRequirements.style.display = 'block';
      impeachmentRequirements.style.display = 'none';
    }
  }

  // 탄핵제안 UI 초기화
  resetImpeachmentUI() {
    const impeachmentOption = document.getElementById('impeachmentOption');
    const isImpeachmentCheckbox = document.getElementById('isImpeachmentProposal');
    const titleInput = document.getElementById('proposalTitle');
    const requirementsTitle = document.getElementById('requirementsTitle');
    const normalRequirements = document.getElementById('requirementsList');
    const impeachmentRequirements = document.getElementById('impeachmentRequirementsList');
    
    // UI 상태 초기화
    impeachmentOption.style.display = 'none';
    isImpeachmentCheckbox.checked = false;
    titleInput.readOnly = false;
    titleInput.value = '';
    requirementsTitle.textContent = '제안 요구사항';
    normalRequirements.style.display = 'block';
    impeachmentRequirements.style.display = 'none';
  }

  // 제안 모달의 DAO 선택 옵션 생성
  populateProposalDAOOptions() {
    const daoSelect = document.getElementById('proposalDAO');
    if (!daoSelect) return;
    
    // 기존 옵션들 제거 (첫 번째 "DAO를 선택하세요" 옵션은 유지)
    while (daoSelect.children.length > 1) {
      daoSelect.removeChild(daoSelect.lastChild);
    }
    
    // 사용자의 소속 DAO 목록 가져오기
    const userDAOs = this.getUserMyDAOsData();
    
    // 각 DAO에 대해 옵션 추가
    userDAOs.forEach(dao => {
      const option = document.createElement('option');
      option.value = dao.id;
      option.textContent = dao.name;
      daoSelect.appendChild(option);
    });
    
    console.log('✅ 제안 대상 DAO 옵션이 사용자 소속 DAO로 업데이트됨:', userDAOs.map(dao => dao.name));
  }

  // DAO 값에서 이름 가져오기 (동적으로 업데이트)
  getDAONameFromValue(value) {
    const userDAOs = this.getUserMyDAOsData();
    const dao = userDAOs.find(dao => dao.id === value);
    return dao ? dao.name : value;
  }

  async handleCreateProposal(event) {
    event.preventDefault();
    
    // 제안 유형 확인
    const proposalType = document.querySelector('input[name="proposalType"]:checked').value;
    
    if (proposalType === 'general') {
      // 일반제안 처리
      await this.handleGeneralProposal(event);
    } else if (proposalType === 'dao_creation') {
      // DAO생성제안 처리
      await this.handleDAOCreationProposal(event);
    }
  }

  // 제안 수수료 업데이트 함수
  updateProposalFee() {
    const stakeAmount = parseFloat(document.getElementById('proposalStake').value) || 0;
    const proposalFee = stakeAmount * 0.01; // 1% 수수료
    
    const feeDisplay = document.getElementById('proposalFeeAmount');
    if (feeDisplay) {
      if (stakeAmount > 0) {
        feeDisplay.textContent = `${proposalFee.toFixed(2)} B (1%)`;
      } else {
        feeDisplay.textContent = '0.00 B (1%)';
      }
    }
  }

  // 일반제안 처리
  async handleGeneralProposal(event) {
    const isImpeachment = document.getElementById('isImpeachmentProposal').checked;
    const stakeAmount = parseFloat(document.getElementById('proposalStake').value);
    const proposalFee = stakeAmount * 0.01; // 1% 수수료
    
    const proposalData = {
      dao: document.getElementById('proposalDAO').value,
      title: document.getElementById('proposalTitle').value,
      description: document.getElementById('proposalDescription').value,
      stake: stakeAmount,
      proposalFee: proposalFee,
      fundingEndDate: document.getElementById('proposalFundingEndDate').value,
      isImpeachment: isImpeachment,
      type: 'general'
    };

    // 유효성 검사
    if (!proposalData.dao || !proposalData.title || !proposalData.description || !proposalData.stake || !proposalData.fundingEndDate) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    if (proposalData.stake < 50) {
      alert('모금액은 최소 50B 이상이어야 합니다.');
      return;
    }

    // 모금 종료일 검증
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 시간을 00:00:00으로 설정
    const endDate = new Date(proposalData.fundingEndDate);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 14);

    if (endDate < today) {
      alert('모금 종료일은 오늘 이후여야 합니다.');
      return;
    }

    if (endDate > maxDate) {
      alert('모금 종료일은 최대 14일 후까지 설정할 수 있습니다.');
      return;
    }

    try {
      // 제안 제출 시뮬레이션
      await this.submitProposal(proposalData);
      
      const fundingDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      this.showSuccessMessage(`일반제안이 성공적으로 제출되었습니다! 수수료: ${proposalData.proposalFee.toFixed(2)}B, 모금액: ${proposalData.stake}B (모금 종료: ${proposalData.fundingEndDate}, ${fundingDays}일간)`);
      this.closeCreateProposalModal();
      
      // 거버넌스 탭 새로고침
      if (this.currentTab === 'governance') {
        await this.loadGovernance();
      }
      
    } catch (error) {
      console.error('제안 제출 실패:', error);
      alert(error.message || '제안 제출 중 오류가 발생했습니다.');
    }
  }

  // DAO생성제안 처리
  async handleDAOCreationProposal(event) {
    const daoData = {
      title: document.getElementById('daoTitle').value,
      description: document.getElementById('daoDescription').value,
      participationGuide: document.getElementById('daoParticipationGuide').value,
      initialOPAddress: document.getElementById('initialOPAddress').value,
      dcas: [],
      contributionOptions: [],
      type: 'dao_creation'
    };

    // DCA 데이터 수집
    const dcaTitles = document.querySelectorAll('input[name="dcaTitle[]"]');
    const dcaCriterias = document.querySelectorAll('input[name="dcaCriteria[]"]');
    const dcaValues = document.querySelectorAll('input[name="dcaValue[]"]');
    
    for (let i = 0; i < dcaTitles.length; i++) {
      if (dcaTitles[i].value && dcaCriterias[i].value && dcaValues[i].value) {
        daoData.dcas.push({
          title: dcaTitles[i].value,
          criteria: dcaCriterias[i].value,
          value: parseInt(dcaValues[i].value)
        });
      }
    }

    // 기여하러가기 옵션 데이터 수집
    const contributionTitles = document.querySelectorAll('input[name="contributionTitle[]"]');
    const contributionDescriptions = document.querySelectorAll('textarea[name="contributionDescription[]"]');
    const contributionButtonTexts = document.querySelectorAll('input[name="contributionButtonText[]"]');
    const contributionIcons = document.querySelectorAll('select[name="contributionIcon[]"]');
    const contributionActionTypes = document.querySelectorAll('select[name="contributionActionType[]"]');
    
    for (let i = 0; i < contributionTitles.length; i++) {
      if (contributionTitles[i].value && contributionDescriptions[i].value && 
          contributionButtonTexts[i].value && contributionIcons[i].value && 
          contributionActionTypes[i].value) {
        const option = {
          title: contributionTitles[i].value,
          description: contributionDescriptions[i].value,
          buttonText: contributionButtonTexts[i].value,
          icon: contributionIcons[i].value,
          actionType: contributionActionTypes[i].value
        };
        
        // 액션 타입별 추가 데이터
        switch(contributionActionTypes[i].value) {
          case 'external':
            const externalUrl = document.querySelector(`input[name="contributionExternalUrl[]"]:nth-of-type(${i+1})`);
            option.externalUrl = externalUrl ? externalUrl.value : '';
            break;
          case 'github':
            const githubRepo = document.querySelector(`input[name="contributionGithubRepo[]"]:nth-of-type(${i+1})`);
            option.githubRepo = githubRepo ? githubRepo.value : '';
            break;
        }
        
        daoData.contributionOptions.push(option);
      }
    }

    // 유효성 검사
    const missingFields = [];
    if (!daoData.title) missingFields.push('DAO 이름');
    if (!daoData.description) missingFields.push('DAO 설명');
    if (!daoData.participationGuide) missingFields.push('참여하기 안내 내용');
    if (!daoData.initialOPAddress) missingFields.push('이니셜 OP 통신주소');
    
    if (missingFields.length > 0) {
      alert(`다음 필수 항목을 입력해주세요: ${missingFields.join(', ')}`);
      return;
    }
    
    if (daoData.dcas.length === 0) {
      alert('최소 1개의 DCA를 추가해주세요.');
      return;
    }
    
    if (daoData.contributionOptions.length === 0) {
      alert('최소 1개의 기여하러가기 옵션을 추가해주세요.');
      return;
    }

    try {
      // DAO생성제안 제출
      await this.submitDAOCreationProposal(daoData);
      
      this.showSuccessMessage(`DAO생성제안이 성공적으로 제출되었습니다! 수수료: 0.05B`);
      this.closeCreateProposalModal();
      
      // 거버넌스 탭 새로고침
      if (this.currentTab === 'governance') {
        await this.loadGovernance();
      }
      
    } catch (error) {
      console.error('DAO생성제안 제출 실패:', error);
      alert(error.message || 'DAO생성제안 제출 중 오류가 발생했습니다.');
    }
  }

  // DAO생성제안 제출
  async submitDAOCreationProposal(daoData) {
    // 본인 인증
    const authConfirmed = await this.requestAuthentication('DAO생성제안 제출');
    if (!authConfirmed) {
      throw new Error('인증이 취소되었습니다.');
    }

    // B-Token 잔액 확인
    const currentBTokens = parseFloat(document.getElementById('bTokenBalance').textContent.replace(' B', '')) || 0;
    const proposalFee = 0.05; // DAO생성제안 수수료
    
    if (currentBTokens < proposalFee) {
      throw new Error(`B-Token이 부족합니다. 현재 보유량: ${currentBTokens}B, 필요량: ${proposalFee}B`);
    }

    if (!confirm(`DAO생성제안 수수료 ${proposalFee}B를 사용하여 "${daoData.title}" DAO 생성제안을 제출하시겠습니까?`)) {
      throw new Error('제안 제출이 취소되었습니다.');
    }
    
    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // B-Token 수수료 차감
    const newBBalance = currentBTokens - proposalFee;
    document.getElementById('bTokenBalance').textContent = `${newBBalance.toFixed(3)} B`;
    
    // 지갑 페이지의 토큰 잔액도 업데이트
    const walletBBalance = document.getElementById('walletBTokenBalance');
    if (walletBBalance) walletBBalance.textContent = `${newBBalance.toFixed(3)} B`;
    
    console.log('DAO생성제안 제출:', daoData);
    
    return {
      success: true,
      proposalId: `dao-prop-${Date.now()}`,
      transactionHash: `0x${Math.random().toString(16).substring(2)}`
    };
  }

  async submitProposal(proposalData) {
    // 본인 인증 (지문/얼굴/비밀번호 중 택1)
    const authConfirmed = await this.requestAuthentication('제안 제출');
    if (!authConfirmed) {
      throw new Error('인증이 취소되었습니다.');
    }

    // B-Token 잔액 확인
    const currentBTokens = parseFloat(document.getElementById('bTokenBalance').textContent.replace(' B', '')) || 0;
    const proposalFee = proposalData.proposalFee || (proposalData.stake * 0.01);
    const totalRequired = proposalFee + proposalData.stake;
    
    if (currentBTokens < totalRequired) {
      throw new Error(`B-Token이 부족합니다. 현재 보유량: ${currentBTokens}B, 필요량: ${totalRequired.toFixed(2)}B (수수료 ${proposalFee.toFixed(2)}B + 모금액 ${proposalData.stake}B)`);
    }

    if (!confirm(`제안 수수료 ${proposalFee.toFixed(2)}B와 모금액 ${proposalData.stake}B를 사용하여 "${proposalData.title}" 제안을 제출하시겠습니까?`)) {
      throw new Error('제안 제출이 취소되었습니다.');
    }
    
    // 실제로는 블록체인에 제안을 제출
    console.log('제안 제출:', proposalData);
    
    // 시뮬레이션 지연
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // B-Token 수수료 + 모금액 차감 시뮬레이션
    const newBBalance = currentBTokens - totalRequired;
    document.getElementById('bTokenBalance').textContent = `${newBBalance.toFixed(3)} B`;
    
    // 지갑 페이지의 토큰 잔액도 업데이트
    const walletBBalance = document.getElementById('walletBTokenBalance');
    if (walletBBalance) walletBBalance.textContent = `${newBBalance.toFixed(3)} B`;
    
    // 새 제안을 해당 DAO에 추가
    const targetDAOId = this.getDAOIdFromName(proposalData.dao);
    if (targetDAOId) {
      this.addNewProposal(targetDAOId, {
        id: `${targetDAOId}-prop-${Date.now()}`,
        title: proposalData.title,
        description: proposalData.description,
        proposer: '사용자', // 실제로는 현재 사용자 이름
        status: 'active',
        votesFor: 0,
        votesAgainst: 0,
        abstentions: 0,
        votingStartDate: new Date().toISOString().split('T')[0],
        votingEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2주 후
        daoName: this.getDAOName(targetDAOId),
        daoId: targetDAOId,
        isImpeachment: proposalData.isImpeachment // 탄핵제안 플래그 추가
      });
    }
    
    return {
      success: true,
      proposalId: `prop-${Date.now()}`,
      transactionHash: `0x${Math.random().toString(16).substring(2)}`
    };
  }

  // ===== 새로운 기능들 =====

  // 검증자 가이드 열기
  openValidatorGuide() {
    // 검증자 가이드 모달 표시
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'validatorGuideModal';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 90vw; max-height: 90vh; width: 1200px;">
        <div class="modal-header">
          <h3><i class="fas fa-shield-alt"></i> 백야 프로토콜 검증자 가이드</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body" style="max-height: 80vh; overflow-y: auto; padding: 0;">
          <iframe 
            src="docs/validator-guide.md" 
            style="width: 100%; height: 80vh; border: none; background: white;"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          </iframe>
          <div style="display: none; padding: 2rem; text-align: center;">
            <div style="margin-bottom: 2rem;">
              <i class="fas fa-file-alt" style="font-size: 3rem; color: var(--primary-color); margin-bottom: 1rem;"></i>
              <h4>검증자 가이드를 확인하세요</h4>
              <p>백야 프로토콜 풀노드 및 검증자 운영에 대한 완전한 가이드입니다.</p>
            </div>
            <div style="display: flex; gap: 1rem; justify-content: center;">
              <a href="docs/validator-guide.md" target="_blank" class="btn-primary">
                <i class="fas fa-external-link-alt"></i> 새 창에서 보기
              </a>
              <a href="https://github.com/baekya-protocol/baekya-protocol/blob/main/docs/validator-guide.md" target="_blank" class="btn-secondary">
                <i class="fab fa-github"></i> GitHub에서 보기
              </a>
            </div>
            <div style="margin-top: 2rem; text-align: left; background: #f8f9fa; padding: 1.5rem; border-radius: 8px;">
              <h5><i class="fas fa-rocket"></i> 빠른 시작 가이드</h5>
              <ol style="margin: 0; padding-left: 1.5rem;">
                <li><strong>풀노드 실행:</strong> <code>node src/index.js --testnet --address 010-XXXX-XXXX</code></li>
                <li><strong>검증자 등록:</strong> <code>node src/index.js --testnet --validator --address 010-XXXX-XXXX</code></li>
                <li><strong>보상 확인:</strong> 10분마다 자동 분배, 웹 대시보드에서 확인</li>
                <li><strong>모니터링:</strong> 로그 파일 및 웹 인터페이스 활용</li>
              </ol>
              <div style="margin-top: 1rem; padding: 1rem; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
                <strong>💡 팁:</strong> 안정적인 인터넷 연결과 충분한 하드웨어 리소스가 필요합니다. 
                최소 요구사항: CPU 2코어, RAM 4GB, Storage 100GB
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // 검증자 풀 후원 모달 표시
  showValidatorSponsorModal() {
    if (!this.isAuthenticated) {
              alert('검증자 풀 후원을 위해서는 먼저 로그인이 필요합니다.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'validatorSponsorModal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-heart"></i> 검증자 풀 후원하기</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="sponsor-info">
            <p>검증자 풀에 B-Token을 후원하여 네트워크 보안에 기여하세요.</p>
            <div class="sponsor-benefits">
              <h4><i class="fas fa-star"></i> 후원 혜택</h4>
              <ul>
                <li>네트워크 보안 강화에 기여</li>
                <li>검증자들의 안정적인 운영 지원</li>
                <li>백야 프로토콜 생태계 발전에 참여</li>
                <li>후원 내역은 투명하게 공개됩니다</li>
              </ul>
            </div>
            <div class="form-group">
              <label for="sponsorAmount">후원 금액 (B-Token)</label>
              <div class="amount-input">
                <input type="number" id="sponsorAmount" min="0.001" step="0.001" placeholder="0.001">
                <span class="token-suffix">B</span>
              </div>
              <small>최소 후원 금액: 0.001 B</small>
            </div>
            <div class="current-balance">
              <span>현재 B-Token 보유량: <strong id="currentBBalance">${document.getElementById('bTokenBalance')?.textContent || '0 B'}</strong></span>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
            <button type="button" class="btn-primary" onclick="window.dapp.submitValidatorSponsor()">후원하기</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // 수수료 분배 함수 (100% 검증자 풀로 변경)
  distributeFees(totalFee) {
    const VALIDATOR_POOL_RATIO = 1.0;
    const DAO_TREASURY_RATIO = 0.0;
    
    // 검증자 풀 할당 (60%)
    const validatorPoolFee = totalFee * VALIDATOR_POOL_RATIO;
    
    // DAO 금고 할당 (40%)
    const daoTreasuryFee = totalFee * DAO_TREASURY_RATIO;
    
    // 검증자 풀에 수수료의 60%만 추가 (후원금과 별도)
    const validatorPool = document.getElementById('validatorPoolMain');
    if (validatorPool) {
      const currentPool = parseFloat(validatorPool.textContent.replace(' B', '')) || 0;
      const newPool = currentPool + validatorPoolFee;
      validatorPool.textContent = `${newPool.toFixed(6)} B`;
      localStorage.setItem('baekya_validator_pool', newPool.toFixed(6));
    }
    
    // DAO 금고에 수수료 분배 (기여량에 비례)
    this.distributeDAOTreasuryFees(daoTreasuryFee);
    
    console.log(`수수료 분배 완료: 검증자 풀 +${validatorPoolFee.toFixed(6)}B, DAO 금고 총 ${daoTreasuryFee.toFixed(6)}B`);
    
    return {
      validatorPool: validatorPoolFee,
      daoTreasury: daoTreasuryFee
    };
  }

  // DAO 금고 수수료 분배 (기여량에 비례)
  distributeDAOTreasuryFees(totalDAOFee) {
    // Founder 계정의 경우 소속 4개 DAO에 동일하게 분배
    if (this.currentUser && this.currentUser.isFounder) {
      const founderDAOs = ['community-dao', 'dev-dao', 'ops-dao', 'political-dao'];
      const feePerDAO = totalDAOFee / founderDAOs.length; // 0.0004B / 4 = 0.0001B
      
      founderDAOs.forEach(daoId => {
        this.addToDAOTreasury(daoId, feePerDAO);
      });
      
      console.log(`Founder 계정: ${founderDAOs.length}개 DAO에 각각 ${feePerDAO.toFixed(6)}B씩 분배`);
      return;
    }
    
    // 사용자의 기여량 가져오기
    const userContributions = this.getUserContributions();
    
    if (!userContributions || userContributions.length === 0) {
      // 기여 내역이 없으면 Community DAO에 모든 수수료 할당
      this.addToDAOTreasury('community-dao', totalDAOFee);
      return;
    }
    
    // DAO별 기여량 계산
    const daoContributions = {};
    let totalContributions = 0;
    
    userContributions.forEach(contribution => {
      const daoId = contribution.dao || 'community-dao';
      const contributionValue = contribution.bTokens || 0;
      
      if (!daoContributions[daoId]) {
        daoContributions[daoId] = 0;
      }
      daoContributions[daoId] += contributionValue;
      totalContributions += contributionValue;
    });
    
    // 기여량에 비례하여 DAO 금고에 분배
    if (totalContributions > 0) {
      Object.entries(daoContributions).forEach(([daoId, contribution]) => {
        const daoFeeShare = totalDAOFee * (contribution / totalContributions);
        this.addToDAOTreasury(daoId, daoFeeShare);
      });
    } else {
      // 기여량이 0인 경우 Community DAO에 할당
      this.addToDAOTreasury('community-dao', totalDAOFee);
    }
  }

  // 특정 DAO 금고에 수수료 추가
  addToDAOTreasury(daoId, amount) {
    const treasuryKey = `baekya_dao_treasury_${daoId}`;
    const currentTreasury = parseFloat(localStorage.getItem(treasuryKey) || '0');
    const newTreasury = currentTreasury + amount;
    
    localStorage.setItem(treasuryKey, newTreasury.toFixed(6));
    
    // 현재 표시 중인 DAO 금고 UI 업데이트
    const treasuryBalance = document.getElementById('treasuryBalance');
    if (treasuryBalance && this.currentDAOId === daoId) {
      treasuryBalance.textContent = `${newTreasury.toFixed(6)} B`;
    }
    
    console.log(`${daoId} 금고에 ${amount.toFixed(6)}B 수수료 추가 (총 ${newTreasury.toFixed(6)}B)`);
  }

  // 검증자 풀 후원 제출
  async submitValidatorSponsor() {
    const sponsorAmount = parseFloat(document.getElementById('sponsorAmount').value);

    if (!sponsorAmount || sponsorAmount < 0.001) {
      alert('후원 금액은 최소 0.001 B 이상이어야 합니다.');
      return;
    }

    // B-Token 잔액 확인
    const currentBTokens = parseFloat(document.getElementById('bTokenBalance').textContent.replace(' B', '')) || 0;
    const transactionFee = 0; // 수수료 없음
    const totalRequired = sponsorAmount + transactionFee;
    
    if (currentBTokens < totalRequired) {
      alert(`B-Token이 부족합니다. 현재 보유량: ${currentBTokens}B, 필요량: ${totalRequired}B (후원 ${sponsorAmount}B + 수수료 ${transactionFee}B)`);
      return;
    }

    // 본인 인증 (지문/얼굴/비밀번호 중 택1)
    const authConfirmed = await this.requestAuthentication('검증자 풀 후원');
    if (!authConfirmed) {
      return;
    }

    if (confirm(`검증자 풀에 ${sponsorAmount}B를 후원하시겠습니까? (수수료 ${transactionFee}B 별도)`)) {
      try {
        // 서버 API로 검증자 풀 후원 요청
        const sponsorResponse = await fetch(`${this.apiBase}/validator-pool/sponsor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sponsorDID: this.currentUser.did,
            amount: sponsorAmount
          })
        });
        
        if (sponsorResponse.ok) {
          const result = await sponsorResponse.json();
          
          if (result.success) {
            // 검증자 풀 상태 업데이트
            if (result.poolStatus) {
              const validatorPool = document.getElementById('validatorPoolMain');
              const newPool = result.poolStatus.balance || 0;
              validatorPool.textContent = `${newPool.toFixed(6)} B`;
              localStorage.setItem('baekya_validator_pool', newPool.toFixed(6));
              
              // 대시보드의 검증자 풀 표시도 업데이트
              const validatorPoolDashboard = document.getElementById('validatorPool');
              if (validatorPoolDashboard) {
                validatorPoolDashboard.textContent = `${newPool.toFixed(6)} B`;
              }
            }
            
            this.showSuccessMessage(`검증자 풀에 ${sponsorAmount}B를 성공적으로 후원했습니다!`);
            
            // 모달 닫기
            document.getElementById('validatorSponsorModal').remove();
            
          } else {
            throw new Error(result.error || '트랜잭션 처리 실패');
          }
        } else {
          const errorData = await sponsorResponse.json();
          throw new Error(errorData.error || '트랜잭션 처리 실패');
        }
      
      // 모달 닫기
      document.getElementById('validatorSponsorModal').remove();
      
      } catch (error) {
        console.error('검증자 풀 후원 오류:', error);
        alert('검증자 풀 후원 중 오류가 발생했습니다: ' + error.message);
      }
     }
   }

   // DAO 금고 후원 모달 표시
   showDAOSponsorModal() {
     if (!this.isAuthenticated) {
               alert('DAO 금고 후원을 위해서는 먼저 로그인이 필요합니다.');
       return;
     }

     if (!this.currentDAOId) {
       alert('DAO를 선택해주세요.');
       return;
     }

     const daoName = this.getDAOName(this.currentDAOId);
     const modal = document.createElement('div');
     modal.className = 'modal active';
     modal.id = 'daoSponsorModal';
     
     modal.innerHTML = `
       <div class="modal-content">
         <div class="modal-header">
           <h3><i class="fas fa-heart"></i> ${daoName} 금고 후원하기</h3>
           <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
         </div>
         <div class="modal-body">
           <div class="sponsor-info">
             <p>${daoName}의 금고에 B-Token을 후원하여 DAO 활동을 지원하세요.</p>
             <div class="sponsor-benefits">
               <h4><i class="fas fa-star"></i> 후원 혜택</h4>
               <ul>
                 <li>DAO 구성원들의 기여 활동 지원</li>
                 <li>프로젝트 개발 및 운영 자금 지원</li>
                 <li>DAO 생태계 발전에 기여</li>
                 <li>후원 내역은 투명하게 공개됩니다</li>
               </ul>
             </div>
             <div class="form-group">
               <label for="daoSponsorAmount">후원 금액 (B-Token)</label>
               <div class="amount-input">
                 <input type="number" id="daoSponsorAmount" min="0.001" step="0.001" placeholder="0.001">
                 <span class="token-suffix">B</span>
               </div>
               <small>최소 후원 금액: 0.001 B</small>
             </div>
             <div class="current-balance">
               <span>현재 B-Token 보유량: <strong id="currentBBalanceDAO">${document.getElementById('bTokenBalance')?.textContent || '0 B'}</strong></span>
             </div>
             <div class="fee-info">
               <div class="fee-detail">
                 <span class="fee-label">트랜잭션 수수료:</span>
                 <span class="fee-amount">0.001 B</span>
               </div>
               <small>후원 시 별도의 트랜잭션 수수료가 발생합니다</small>
             </div>
           </div>
           <div class="modal-actions">
             <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
             <button type="button" class="btn-primary" onclick="window.dapp.submitDAOSponsor()">후원하기</button>
           </div>
         </div>
       </div>
     `;

     document.body.appendChild(modal);
   }

   // DAO 금고 후원 제출
   async submitDAOSponsor() {
     const sponsorAmount = parseFloat(document.getElementById('daoSponsorAmount').value);

     if (!sponsorAmount || sponsorAmount < 0.001) {
       alert('후원 금액은 최소 0.001 B 이상이어야 합니다.');
       return;
     }

     // B-Token 잔액 확인
     const currentBTokens = parseFloat(document.getElementById('bTokenBalance').textContent.replace(' B', '')) || 0;
     const transactionFee = 0.001;
     const totalRequired = sponsorAmount + transactionFee;
     
     if (currentBTokens < totalRequired) {
       alert(`B-Token이 부족합니다. 현재 보유량: ${currentBTokens}B, 필요량: ${totalRequired}B (후원 ${sponsorAmount}B + 수수료 ${transactionFee}B)`);
       return;
     }

     // 본인 인증 (지문/얼굴/비밀번호 중 택1)
     const authConfirmed = await this.requestAuthentication('DAO 금고 후원');
     if (!authConfirmed) {
       return;
     }

     const daoName = this.getDAOName(this.currentDAOId);
     if (confirm(`${daoName} 금고에 ${sponsorAmount}B를 후원하시겠습니까? (수수료 ${transactionFee}B 별도)`)) {
       try {
         // 현재 DAO의 실제 ID 가져오기
         let daoUUID = null;
         
         // founder 계정인 경우 UUID 매핑에서 가져오기
         if (this.currentUser && this.currentUser.isFounder) {
           const daoUUIDs = localStorage.getItem('baekya_founder_dao_uuids');
           if (daoUUIDs) {
             const uuidMapping = JSON.parse(daoUUIDs);
             daoUUID = uuidMapping[this.currentDAOId];
           }
         } else {
           // 일반 사용자의 경우 userDAOs에서 UUID 찾기
           const userDAOs = JSON.parse(localStorage.getItem('userDAOs') || '[]');
           const userDAO = userDAOs.find(dao => dao.id === this.currentDAOId);
           if (userDAO && userDAO.uuid) {
             daoUUID = userDAO.uuid;
           }
         }
         
         if (!daoUUID) {
           alert('DAO 정보를 찾을 수 없습니다.');
           return;
         }
         
         // 서버 API 호출
         const response = await fetch('/api/dao/treasury/sponsor', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             sponsorDID: this.currentUser.did,
             daoId: daoUUID,
             amount: sponsorAmount
           })
         });
         
         const result = await response.json();
         
         if (result.success) {
           // 성공 메시지 표시
           const feeInfo = result.feeDistribution;
           this.showSuccessMessage(
             `${daoName} 금고에 ${sponsorAmount}B를 성공적으로 후원했습니다! ` +
             `수수료 ${transactionFee}B 중 ${feeInfo.validatorPool.toFixed(4)}B는 검증자 풀로, ` +
             `${feeInfo.daoFee.toFixed(4)}B는 사용자 소속 DAO들에게 분배되었습니다. ` +
             `(블록 #${result.blockNumber})`
           );
       
       // 모달 닫기
       document.getElementById('daoSponsorModal').remove();
           
           // UI 업데이트는 웹소켓을 통해 자동으로 처리됨
         } else {
           alert(`후원 실패: ${result.error || '알 수 없는 오류'}`);
         }
       } catch (error) {
         console.error('DAO 금고 후원 오류:', error);
         alert('후원 처리 중 오류가 발생했습니다.');
       }
     }
   }

  // DAO 컨소시엄 열기
  openDAOConsortium(daoId) {
    if (!this.isAuthenticated) {
      alert('DAO 컨소시엄 접속을 위해서는 먼저 로그인이 필요합니다.');
      return;
    }
    
    // DAO 소속 여부 확인
    if (!this.checkDAOMembership(daoId)) {
      let errorMessage = '';
      if (daoId === 'ops-dao') {
        errorMessage = 'Operations DAO 컨소시엄은 OP(운영자)만 접근할 수 있습니다.';
      } else {
        errorMessage = `이 DAO 컨소시엄에 접근하려면 해당 DAO의 구성원이어야 합니다.\n(DCA를 1회 이상 진행한 구성원만 접근 가능)`;
      }
      alert(errorMessage);
      return;
    }
    
    this.currentDAOId = daoId;
    const modal = document.getElementById('daoConsortiumModal');
    const title = document.getElementById('consortiumTitle');
    
    const daoNames = {
      'ops-dao': 'Operations DAO',
      'dev-dao': 'Development DAO',
      'community-dao': 'Community DAO'
    };
    
    title.innerHTML = `<i class="fas fa-building"></i> ${daoNames[daoId]} 컨소시엄`;
    
    // 탭 상태 초기화 - DAO 금고 탭을 기본으로 설정
    this.resetConsortiumTabs();
    
    modal.classList.add('active');
    
    // 컨소시엄 탭 네비게이션 설정
    this.setupConsortiumNavigation();
    
    // 기본 DAO 금고 탭 로드
    this.loadDAOTreasury(daoId);
  }

  // 컨소시엄 탭 상태 초기화
  resetConsortiumTabs() {
    // 모든 탭 비활성화
    const tabs = document.querySelectorAll('.consortium-tab');
    const contents = document.querySelectorAll('.consortium-tab-content');
    
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    
    // DAO 금고 탭을 기본으로 활성화
    const treasuryTab = document.querySelector('[data-consortium-tab="treasury"]');
    const treasuryContent = document.getElementById('consortium-treasury');
    
    if (treasuryTab) treasuryTab.classList.add('active');
    if (treasuryContent) treasuryContent.classList.add('active');
  }

  setupConsortiumNavigation() {
    const tabs = document.querySelectorAll('.consortium-tab');
    const contents = document.querySelectorAll('.consortium-tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // 모든 탭 비활성화
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        
        // 선택된 탭 활성화
        tab.classList.add('active');
        const targetTab = tab.getAttribute('data-consortium-tab');
        const targetContent = document.getElementById(`consortium-${targetTab}`);
        if (targetContent) {
          targetContent.classList.add('active');
          
          // 탭별 데이터 로드
          this.loadConsortiumTabContent(targetTab, this.currentDAOId);
        }
      });
    });
  }

  loadConsortiumTabContent(tabId, daoId) {
    switch(tabId) {
      case 'treasury':
        this.loadDAOTreasury(daoId);
        break;
      case 'announcements':
        this.loadDAOAnnouncements(daoId);
        break;
      case 'community':
        this.loadCommunityPosts(daoId);
        break;
    }
  }



  loadDAOTreasury(daoId) {
    // 실제 금고 데이터 로드
    const treasuryData = this.getDAOTreasuryData(daoId);
    
    document.getElementById('treasuryBalance').textContent = `${treasuryData.balance || 0} B`;
    document.getElementById('treasuryIncome').textContent = `${treasuryData.monthlyIncome || 0} B`;
    
    const usageList = document.getElementById('treasuryUsage');
    
    if (treasuryData.usage && treasuryData.usage.length > 0) {
      usageList.innerHTML = treasuryData.usage.map(item => `
        <div class="usage-item">
          <div class="usage-info">
            <div class="usage-type">${item.type}</div>
            <div class="usage-date">${item.date}</div>
          </div>
          <div class="usage-amount">-${item.amount} B</div>
        </div>
      `).join('');
    } else {
      usageList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-receipt"></i>
          <p>아직 사용 내역이 없습니다</p>
        </div>
      `;
    }
  }
  
  // DAO 금고 데이터 가져오기
  getDAOTreasuryData(daoId) {
    // 수수료로 축적된 금고 잔액 가져오기
    const allTreasuries = localStorage.getItem('baekya_dao_treasuries');
    let treasuryBalance = 0;
    
    if (allTreasuries) {
      try {
        const treasuriesData = JSON.parse(allTreasuries);
        
        // founder 계정인 경우 UUID 매핑
        if (this.currentUser && this.currentUser.isFounder) {
          const daoUUIDs = localStorage.getItem('baekya_founder_dao_uuids');
          if (daoUUIDs) {
            const uuidMapping = JSON.parse(daoUUIDs);
            const daoUUID = uuidMapping[daoId];
            if (daoUUID) {
              treasuryBalance = treasuriesData[daoUUID] || 0;
            }
          }
        } else {
          // 일반 사용자의 경우 userDAOs에서 UUID 찾기
          const userDAOs = JSON.parse(localStorage.getItem('userDAOs') || '[]');
          const userDAO = userDAOs.find(dao => dao.id === daoId);
          if (userDAO && userDAO.uuid) {
            treasuryBalance = treasuriesData[userDAO.uuid] || 0;
          } else {
            // UUID가 없는 경우 - 기존 사용자 호환성을 위해 모든 DAO의 금고 합계
            console.warn(`DAO UUID를 찾을 수 없음: ${daoId}`);
            treasuryBalance = 0;
          }
        }
      } catch (error) {
        console.error('DAO 금고 정보 파싱 오류:', error);
      }
    }
    
    // 월간 수입 계산 (로그가 있다면 활용, 없으면 0)
    const monthlyIncome = this.getDAOMonthlyIncome(daoId);
    
    // 금고 사용 내역 가져오기
    const usage = this.getDAOTreasuryUsage(daoId);
    
    return {
      balance: treasuryBalance,
      monthlyIncome: monthlyIncome,
      usage: usage
    };
  }

  // DAO 월간 수입 계산
  getDAOMonthlyIncome(daoId) {
    // TODO: 실제로는 지난 30일간의 수수료 분배 로그를 계산
    // 현재는 0으로 반환
    return 0;
  }

  // DAO 금고 사용 내역 가져오기
  getDAOTreasuryUsage(daoId) {
    const usageKey = `baekya_dao_treasury_usage_${daoId}`;
    const storedUsage = localStorage.getItem(usageKey);
    
    if (storedUsage) {
      return JSON.parse(storedUsage);
    }
    
    return [];
  }

  // DAO 공지사항 로드
  loadDAOAnnouncements(daoId) {
    const announcements = this.getDAOAnnouncements(daoId);
    this.renderDAOAnnouncements(announcements);
    this.checkOPAnnouncementAccess(daoId);
  }

  // OP 공지 작성 권한 체크
  checkOPAnnouncementAccess(daoId) {
    const opButton = document.querySelector('.op-announcement-btn');
    if (!opButton) return;

    // 현재 사용자가 해당 DAO의 OP인지 확인
    const userRole = this.getUserDAORole(daoId);
    if (userRole === 'OP' || userRole === 'TOP-OP') {
      opButton.style.display = 'flex';
      // 현재 DAO ID 저장
      this.currentAnnouncementDAOId = daoId;
    } else {
      opButton.style.display = 'none';
    }
  }

  // 사용자의 DAO 내 역할 확인
  getUserDAORole(daoId) {
    // 실제 사용자의 역할을 확인
    if (!this.isAuthenticated || !this.currentUser) return null;
    
    // 사용자의 OP 역할 정보 가져오기
    const userOPRole = this.getUserOPRole();
    
    // Operations DAO의 경우
    if (daoId === 'ops-dao') {
      // OpsDAO의 OP인 경우
      if (userOPRole.opsDAOMember && userOPRole.isOP) {
        return 'OP';
      }
      return null;
    }
    
    // 해당 DAO의 OP인지 확인
    if (userOPRole.opDAOs && userOPRole.opDAOs.includes(daoId)) {
      // OpsDAO의 OP이면 TOP-OP, 아니면 OP
      return userOPRole.isTopOP ? 'TOP-OP' : 'OP';
    }
    
    // 사용자가 생성한 DAO의 이니셜 OP인지 확인
    const userCreatedDAOs = this.loadUserCreatedDAOs();
    const userCreatedDAO = userCreatedDAOs.find(dao => dao.id === daoId);
    if (userCreatedDAO && this.currentUser && userCreatedDAO.initialOP === this.currentUser.communicationAddress) {
      return 'OP'; // 사용자가 생성한 DAO의 이니셜 OP
    }
    
    // OP가 아닌 경우 일반 구성원
    const dcaCount = this.getUserDCACount(daoId);
    return dcaCount > 0 ? 'member' : null;
  }

  // DAO 소속 여부 확인
  checkDAOMembership(daoId) {
    if (!this.isAuthenticated) return false;
    
    // OP 권한 확인
    const userRole = this.getUserDAORole(daoId);
    if (userRole === 'OP' || userRole === 'TOP-OP') {
      return true; // OP는 모든 DAO 컨소시엄 접근 가능
    }
    
    // Operations DAO는 OP만 접근 가능
    if (daoId === 'ops-dao') {
      return false; // 이미 위에서 OP 체크를 했으므로 여기까지 왔다면 OP가 아님
    }
    
    // 사용자가 생성한 DAO 확인
    const userCreatedDAOs = this.loadUserCreatedDAOs();
    const userCreatedDAO = userCreatedDAOs.find(dao => dao.id === daoId);
    if (userCreatedDAO) {
      // 사용자가 생성한 DAO의 이니셜 OP인지 확인
      if (this.currentUser && userCreatedDAO.initialOP === this.currentUser.communicationAddress) {
        return true; // 이니셜 OP는 자신이 생성한 DAO 컨소시엄에 접근 가능
      }
    }
    
    // 커뮤니티DAO의 경우 기여 내역 확인
    if (daoId === 'community-dao') {
      const contributions = this.getUserContributions();
      const communityDAOContributions = contributions.filter(contrib => contrib.dao === 'community-dao');
      
      // 커뮤니티DAO에 기여 내역이 하나라도 있으면 소속으로 인정
      if (communityDAOContributions.length > 0) {
        return true;
      }
    }
    
    // 다른 DAO는 DCA 1회 이상 진행한 구성원만 접근 가능
    const userDCACount = this.getUserDCACount(daoId);
    return userDCACount >= 1;
  }

  // 사용자의 DAO별 DCA 횟수 확인
  getUserDCACount(daoId) {
    // 데모 데이터 - 실제로는 블록체인에서 DCA 기록을 조회
    if (!this.isAuthenticated) return 0;
    
    // 사용자의 실제 DCA 기록 확인
    const userDCAData = this.getUserDCAData();
    
    // 신규 사용자이거나 DCA 데이터가 없으면 0 반환
    if (!userDCAData || !userDCAData[daoId]) {
      return 0;
    }
    
    return userDCAData[daoId] || 0;
  }
  
  // 사용자의 DCA 데이터 가져오기
  getUserDCAData() {
    // 로컬 스토리지에서 사용자별 DCA 데이터 가져오기
    if (!this.currentUser || !this.currentUser.did) return null;
    
    const dcaDataKey = `baekya_dca_${this.currentUser.did}`;
    const storedData = localStorage.getItem(dcaDataKey);
    
    if (storedData) {
      return JSON.parse(storedData);
    }
    
    // 초기 사용자는 모든 DAO의 DCA 카운트가 0
    return {
      'dev-dao': 0,
      'community-dao': 0,
      'political-dao': 0,
      'research-dao': 0,
      'nft-dao': 0,
      'ops-dao': 0
    };
  }

  // 거버넌스 탭으로 이동하는 함수
  goToGovernanceTab() {
    // 컨소시엄 모달 닫기
    this.closeConsortiumModal();
    
    // 현재 활성 탭과 컨텐트 비활성화
    document.querySelectorAll('.tab-btn, .tab-content').forEach(el => {
      el.classList.remove('active');
    });
    
    // 거버넌스 탭 활성화
    const governanceTab = document.querySelector('[data-tab="governance"]');
    const governanceContent = document.getElementById('governance');
    
    if (governanceTab && governanceContent) {
      governanceTab.classList.add('active');
      governanceContent.classList.add('active');
      
      // 거버넌스 콘텐츠 로드
      this.loadGovernance();
    }
    
    // 모바일 헤더도 업데이트
    document.querySelectorAll('.mobile-header-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    const mobileGovernanceHeader = document.getElementById('mobile-header-governance');
    if (mobileGovernanceHeader) {
      mobileGovernanceHeader.classList.add('active');
    }
    
    // 성공 메시지 표시
    this.showSuccessMessage('거버넌스 탭으로 이동했습니다.');
  }

  // OP 공지 작성 모달 열기
  showCreateAnnouncementModal() {
    const modal = document.getElementById('createAnnouncementModal');
    if (!modal) return;

    // 폼 초기화
    const form = document.getElementById('createAnnouncementForm');
    if (form) form.reset();

    modal.classList.add('active');
  }

  // OP 공지 작성 모달 닫기
  closeCreateAnnouncementModal() {
    const modal = document.getElementById('createAnnouncementModal');
    if (!modal) return;

    modal.classList.remove('active');
  }

  // 공지 작성 처리
  async handleCreateAnnouncement(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const announcementData = {
      title: formData.get('title'),
      type: formData.get('type'),
      content: formData.get('content'),
      pinned: formData.get('pinned') === 'on',
      daoId: this.currentAnnouncementDAOId
    };

    try {
      // 생체인증 요구
      const authenticated = await this.requestAuthentication('공지사항 게시');
      if (!authenticated) return;

      // 공지사항 저장
      await this.submitAnnouncement(announcementData);
      
      // 모달 닫기
      this.closeCreateAnnouncementModal();
      
      // 공지사항 목록 새로고침
      this.loadDAOAnnouncements(this.currentAnnouncementDAOId);
      
      // 성공 메시지
      this.showSuccessMessage('공지사항이 성공적으로 게시되었습니다. (수수료: 0.001B)');
      
    } catch (error) {
      console.error('공지사항 게시 실패:', error);
      this.showErrorMessage('공지사항 게시에 실패했습니다.');
    }
  }

  // 공지사항 제출
  async submitAnnouncement(announcementData) {
    // B-Token 잔액 확인
    const currentBTokens = parseFloat(document.getElementById('bTokenBalance').textContent.replace(' B', '')) || 0;
    const announcementFee = 0.001;
    
    if (currentBTokens < announcementFee) {
      throw new Error(`B-Token이 부족합니다. 현재 보유량: ${currentBTokens}B, 필요량: ${announcementFee}B`);
    }

    // 수수료 차감
    const newBalance = currentBTokens - announcementFee;
    document.getElementById('bTokenBalance').textContent = `${newBalance.toFixed(3)} B`;

    // 공지사항 ID 생성
    const announcementId = `op-ann-${Date.now()}`;
    
    // 새 공지사항 생성
    const newAnnouncement = {
      id: announcementId,
      proposalId: null, // OP 직접 작성 공지는 제안과 무관
      proposalTitle: announcementData.title,
      type: 'op-announcement',
      customType: announcementData.type,
      reason: announcementData.content,
      date: new Date().toISOString().split('T')[0],
      author: this.currentUser?.name || 'OP',
      pinned: announcementData.pinned
    };

    // 공지사항 저장
    const announcementsKey = `baekya_announcements_${announcementData.daoId}`;
    const existingAnnouncements = JSON.parse(localStorage.getItem(announcementsKey) || '[]');

    // 고정 공지는 맨 앞에, 일반 공지는 맨 앞에 추가
    if (newAnnouncement.pinned) {
      existingAnnouncements.unshift(newAnnouncement);
    } else {
      // 고정되지 않은 공지 중 맨 앞에 삽입
      const pinnedCount = existingAnnouncements
        .filter(ann => ann.pinned).length;
      existingAnnouncements
        .splice(pinnedCount, 0, newAnnouncement);
    }
    
    // 로컬 스토리지에 저장
    localStorage.setItem(announcementsKey, JSON.stringify(existingAnnouncements));

    // 트랜잭션 기록
    const transaction = {
      type: 'announcement',
      amount: announcementFee,
      timestamp: new Date().toISOString(),
      description: `DAO 공지사항 작성 수수료`
    };
  }

  // DAO 공지사항 가져오기
  getDAOAnnouncements(daoId) {
    // 로컬 스토리지에서 공지사항 데이터 가져오기
    const storedAnnouncements = localStorage.getItem(`baekya_announcements_${daoId}`);
    
    if (storedAnnouncements) {
      return JSON.parse(storedAnnouncements);
    }
    
    // 초기 상태는 빈 배열
    return [];
  }

  // DAO 공지사항 렌더링
  renderDAOAnnouncements(announcements) {
    const container = document.getElementById('daoAnnouncements');
    if (!container) return;

    if (announcements.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-bullhorn"></i>
          <h3>공지사항이 없습니다</h3>
          <p>아직 게시된 공지사항이 없습니다.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = announcements.map(announcement => this.createAnnouncementCard(announcement)).join('');
  }

  // 공지사항 카드 생성
  createAnnouncementCard(announcement) {
    const typeLabels = {
      'rejected': '제안 거부',
      'final-approved': '최종 승인',
      'final-rejected': '최종 거부',
      'op-announcement': 'OP 공지'
    };

    const typeIcons = {
      'rejected': 'fas fa-times-circle',
      'final-approved': 'fas fa-check-circle',
      'final-rejected': 'fas fa-ban',
      'op-announcement': 'fas fa-bullhorn'
    };

    // OP 공지의 경우 사용자 정의 타입 레이블 사용
    const customTypeLabels = {
      'general': '일반 공지',
      'important': '중요 공지',
      'event': '이벤트 공지',
      'maintenance': '점검 공지',
      'policy': '정책 변경'
    };

    // 표시할 타입 레이블 결정
    let displayTypeLabel = typeLabels[announcement.type];
    if (announcement.type === 'op-announcement' && announcement.customType) {
      displayTypeLabel = customTypeLabels[announcement.customType] || displayTypeLabel;
    }

    // 고정 표시
    const pinnedBadge = announcement.pinned ? 
      '<span class="pinned-badge"><i class="fas fa-thumbtack"></i> 고정</span>' : '';

    return `
      <div class="announcement-card ${announcement.type} ${announcement.pinned ? 'pinned' : ''}">
        <div class="announcement-header">
          <div class="announcement-type">
            <i class="${typeIcons[announcement.type]}"></i>
            <span class="type-label">${displayTypeLabel}</span>
            ${pinnedBadge}
          </div>
          <div class="announcement-date">${announcement.date}</div>
        </div>
        
        <div class="announcement-content">
          <h4 class="announcement-title">
            <i class="${announcement.type === 'op-announcement' ? 'fas fa-bullhorn' : 'fas fa-file-alt'}"></i>
            ${announcement.proposalTitle}
          </h4>
          <div class="announcement-meta">
            ${announcement.proposalId ? `
              <span class="meta-info"><i class="fas fa-hashtag"></i> ${announcement.proposalId}</span>
            ` : ''}
            <span class="meta-info"><i class="fas fa-user"></i> ${announcement.author}</span>
          </div>
        </div>
        
        <div class="announcement-actions">
          ${announcement.proposalId ? `
            <button class="btn-secondary view-proposal-btn" 
                    onclick="window.dapp.viewProposalDetail('${announcement.proposalId}')">
              <i class="fas fa-eye"></i>
              제안 상세보기
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderDAOProposals(proposals) {
    const proposalsContainer = document.getElementById('daoProposals');
    if (!proposalsContainer) return;

    proposalsContainer.innerHTML = '';

    if (proposals.length === 0) {
      proposalsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-vote-yea" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;"></i>
          <p>현재 활성 제안이 없습니다.</p>
        </div>
      `;
      return;
    }

    proposals.forEach(proposal => {
      const proposalCard = this.createDAOProposalCard(proposal);
      proposalsContainer.appendChild(proposalCard);
    });
  }

  createDAOProposalCard(proposal) {
    const card = document.createElement('div');
    card.className = 'dao-proposal-card proposal-card';
    card.setAttribute('data-proposal-id', proposal.id);
    
    card.innerHTML = `
      <div class="card-header">
        <h3>${proposal.title}</h3>
        <div class="header-actions">
          ${this.isAuthenticated ? `
            <button class="btn-support" onclick="window.dapp.showSupportModal('${proposal.id}')">
              <i class="fas fa-heart"></i> 지지하기
            </button>
          ` : ''}
          <span class="badge ${proposal.status}">${proposal.status === 'active' ? '진행중' : proposal.status === 'voting' ? '투표중' : proposal.status}</span>
        </div>
      </div>
      <div class="card-content">
        <p class="proposal-description">${proposal.description}</p>
        <div class="proposal-meta">
          <span class="dao-name">${proposal.daoName}</span>
          <span>제안자: ${proposal.proposer}</span>
        </div>
        <div class="proposal-dates">
          <div class="date-item">
            <span class="date-label">투표 시작</span>
            <span class="date-value">${proposal.votingStartDate}</span>
          </div>
          <div class="date-item">
            <span class="date-label">투표 종료</span>
            <span class="date-value">${proposal.votingEndDate}</span>
          </div>
        </div>
                  <div class="proposal-votes">
            <div class="vote-item">
              <span class="vote-label">찬성</span>
              <span class="vote-count">${proposal.votesFor || proposal.votes?.for || 0}</span>
            </div>
            <div class="vote-item">
              <span class="vote-label">반대</span>
              <span class="vote-count">${proposal.votesAgainst || proposal.votes?.against || 0}</span>
            </div>
            <div class="vote-item">
              <span class="vote-label">기권</span>
              <span class="vote-count">${proposal.abstentions || proposal.votes?.abstain || 0}</span>
            </div>
          </div>
        ${this.isAuthenticated ? `
          <div class="proposal-actions">
            <button class="btn-primary" onclick="window.dapp.vote('${proposal.id}', 'support')">
              <i class="fas fa-thumbs-up"></i> 찬성
            </button>
            <button class="btn-secondary" onclick="window.dapp.vote('${proposal.id}', 'against')">
              <i class="fas fa-thumbs-down"></i> 반대
            </button>
            <button class="btn-tertiary" onclick="window.dapp.vote('${proposal.id}', 'abstain')">
              <i class="fas fa-minus"></i> 기권
            </button>
          </div>
        ` : ''}
      </div>
    `;

    return card;
  }



  loadCommunityPosts(daoId, showMyPostsOnly = false) {
    // 현재 사용자 이름
    const currentUserName = this.currentUser?.name || '사용자';
    
    // 실제 커뮤니티 데이터 가져오기
    const allPosts = this.getDAOCommunityPosts(daoId);

    // 필터링된 게시글 결정
    const posts = showMyPostsOnly 
      ? allPosts.filter(post => post.author === currentUserName)
      : allPosts;
    
    const postsContainer = document.getElementById('communityPosts');
    postsContainer.innerHTML = posts.map(post => `
      <div class="community-post">
        <div class="post-header">
          <div class="post-author">
            <div class="author-avatar" style="background: linear-gradient(135deg, var(--primary-light) 0%, var(--secondary-color) 100%); color: white; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; font-weight: 600;">
              ${post.author.charAt(0).toUpperCase()}
            </div>
            <div class="author-info">
              <div class="author-name">${post.author}</div>
              <div class="post-time">${post.timestamp}</div>
            </div>
          </div>
          <div class="post-type">
            <i class="fas ${post.type === 'text' ? 'fa-align-left' : post.type === 'image' ? 'fa-image' : 'fa-video'}"></i>
          </div>
        </div>
        <div class="post-content">
          <p>${post.content}</p>
          ${post.type === 'image' ? '<div class="post-media"><div class="image-placeholder">이미지 미리보기</div></div>' : ''}
          ${post.type === 'video' ? '<div class="post-media"><div class="video-placeholder">비디오 미리보기</div></div>' : ''}
        </div>
        <div class="post-actions">
          <button class="post-action" onclick="window.dapp.likePost(${post.id})">
            <i class="fas fa-heart"></i> ${post.likes}
          </button>
          <button class="post-action" onclick="window.dapp.commentPost(${post.id})">
            <i class="fas fa-comment"></i> ${post.comments}
          </button>
          <button class="post-action">
            <i class="fas fa-share"></i> 공유
          </button>
        </div>
      </div>
    `).join('');

    // 빈 상태 표시
    if (posts.length === 0) {
      postsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-edit"></i>
          <h3>${showMyPostsOnly ? '작성한 글이 없습니다' : '게시글이 없습니다'}</h3>
          <p>${showMyPostsOnly ? '아직 작성한 글이 없습니다. 첫 번째 글을 작성해보세요!' : '아직 게시된 글이 없습니다.'}</p>
        </div>
      `;
    }
  }
  
  // DAO 커뮤니티 게시글 가져오기
  getDAOCommunityPosts(daoId) {
    // 로컬 스토리지에서 커뮤니티 게시글 가져오기
    const postsKey = `baekya_community_${daoId}`;
    const storedPosts = localStorage.getItem(postsKey);
    
    if (storedPosts) {
      return JSON.parse(storedPosts);
    }
    
    // 초기 상태는 빈 배열
    return [];
  }

  // 나의 글 토글 기능
  toggleMyPosts() {
    // 현재 상태 토글
    this.showingMyPostsOnly = !this.showingMyPostsOnly;
    
    // 버튼 상태 업데이트
    const myPostsBtn = document.getElementById('myPostsBtn');
    if (this.showingMyPostsOnly) {
      myPostsBtn.classList.remove('btn-secondary');
      myPostsBtn.classList.add('btn-primary');
      myPostsBtn.innerHTML = '<i class="fas fa-list"></i> 전체 글';
    } else {
      myPostsBtn.classList.remove('btn-primary');
      myPostsBtn.classList.add('btn-secondary');
      myPostsBtn.innerHTML = '<i class="fas fa-user-edit"></i> 나의 글';
    }
    
    // 게시글 다시 로드
    if (this.currentDAOId) {
      this.loadCommunityPosts(this.currentDAOId, this.showingMyPostsOnly);
    }
  }

  closeConsortiumModal() {
    const modal = document.getElementById('daoConsortiumModal');
    modal.classList.remove('active');
  }

  createDAOProposal() {
    this.showDAOProposalModal();
  }

  showDAOProposalModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-plus-circle"></i> DAO 제안 작성</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="daoProposalForm">
            <div class="form-group">
              <label for="proposalTitle">제안 제목</label>
              <input type="text" id="proposalTitle" placeholder="제안 제목을 입력하세요" required>
            </div>
            <div class="form-group">
              <label for="proposalDescription">제안 내용</label>
              <textarea id="proposalDescription" rows="6" placeholder="제안 내용을 상세히 작성하세요" required></textarea>
            </div>
            <div class="form-group">
              <label for="proposalCategory">제안 카테고리</label>
              <select id="proposalCategory" required>
                <option value="">카테고리를 선택하세요</option>
                <option value="governance">거버넌스 개선</option>
                <option value="treasury">금고 운영</option>
                <option value="technical">기술 개선</option>
                <option value="community">커뮤니티 활동</option>
                <option value="partnership">파트너십</option>
              </select>
            </div>
            <div class="form-group">
              <label for="proposalStake">담보 P-Token</label>
              <input type="number" id="proposalStake" min="1" step="0.1" placeholder="최소 1P" required>
              <small>제안을 위해 최소 1P를 담보로 제공해야 합니다</small>
            </div>
            <div class="fee-info">
                             <div class="fee-detail">
                 <span class="fee-label">제안 수수료:</span>
                            <span class="fee-amount">0.01 B</span>
               </div>
                        <small>제안 생성 시 0.01 B-Token이 수수료로 차감됩니다</small>
            </div>
            <div class="proposal-info">
              <h4><i class="fas fa-info-circle"></i> 제안 규칙</h4>
              <ul>
                <li>DAO 내 전체 구성원의 1%만큼의 P-token이 모이면 투표 진입</li>
                <li>2주 내 투표 진입 실패시 제안 및 담보 소각</li>
                <li>투표 통과시 담보 반환, 실패시 담보 소각</li>
              </ul>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
              <button type="submit" class="btn-primary">제안 제출</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 폼 이벤트 처리
    const form = modal.querySelector('#daoProposalForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = {
        title: form.querySelector('#proposalTitle').value,
        description: form.querySelector('#proposalDescription').value,
        category: form.querySelector('#proposalCategory').value,
        stake: parseFloat(form.querySelector('#proposalStake').value)
      };
      this.submitDAOProposal(data);
      modal.remove();
    });
  }

  async submitDAOProposal(data) {
    if (!this.isAuthenticated) {
      alert('제안 제출을 위해서는 먼저 로그인이 필요합니다.');
      return;
    }

    // 본인 인증 (지문/얼굴/비밀번호 중 택1)
    const authConfirmed = await this.requestAuthentication('제안 제출');
    if (!authConfirmed) {
      return;
    }

    // B-Token 잔액 확인
    const currentBTokens = parseFloat(document.getElementById('bTokenBalance').textContent.replace(' B', '')) || 0;
    const proposalFee = 0.01;
    
    if (currentBTokens < proposalFee) {
      alert(`B-Token이 부족합니다. 현재 보유량: ${currentBTokens}B, 필요량: ${proposalFee}B`);
      return;
    }

    // P-Token 잔액 확인
    const currentPTokens = parseFloat(document.getElementById('pTokenBalance').textContent.replace(' P', '')) || 0;
    if (currentPTokens < data.stake) {
      alert(`P-Token이 부족합니다. 현재 보유량: ${currentPTokens}P, 필요량: ${data.stake}P`);
      return;
    }

    if (confirm(`제안 수수료 ${proposalFee}B와 담보 ${data.stake}P를 사용하여 "${data.title}" 제안을 제출하시겠습니까?`)) {
      // 토큰 차감 시뮬레이션
      const newBBalance = currentBTokens - proposalFee;
      const newPBalance = currentPTokens - data.stake;
      
      document.getElementById('bTokenBalance').textContent = `${newBBalance.toFixed(1)} B`;
      document.getElementById('pTokenBalance').textContent = `${newPBalance.toFixed(1)} P`;
      
      // 지갑 페이지의 토큰 잔액도 업데이트
      const walletBBalance = document.getElementById('walletBTokenBalance');
      const walletPBalance = document.getElementById('walletPTokenBalance');
      if (walletBBalance) walletBBalance.textContent = `${newBBalance.toFixed(1)} B`;
      if (walletPBalance) walletPBalance.textContent = `${newPBalance.toFixed(1)} P`;
      
      // 새 제안을 중앙화된 데이터에 추가
      this.addNewProposal(this.currentDAOId, {
        id: `${this.currentDAOId}-prop-${Date.now()}`,
        title: data.title,
        description: data.description,
        proposer: '사용자', // 실제로는 현재 사용자 이름
        status: 'active',
        votesFor: 0,
        votesAgainst: 0,
        abstentions: 0,
        votingStartDate: new Date().toISOString().split('T')[0],
        votingEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2주 후
        daoName: this.getDAOName(this.currentDAOId),
        daoId: this.currentDAOId
      });
      
      this.showSuccessMessage(`"${data.title}" 제안이 성공적으로 제출되었습니다. 수수료 ${proposalFee}B와 담보 ${data.stake}P가 차감되었습니다.`);
      
      // DAO 거버넌스 페이지 새로고침
      if (this.currentDAOId) {
        setTimeout(() => {
          this.loadDAOGovernance(this.currentDAOId);
        }, 1000);
      }
      
      // 메인 거버넌스 탭도 새로고침 (사용자가 거버넌스 탭에 있다면)
      if (this.currentTab === 'governance') {
        setTimeout(() => {
          this.loadGovernance();
        }, 1000);
      }
    }
  }

  createCommunityPost() {
    this.showCreatePostModal();
  }

  showCreatePostModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-edit"></i> 커뮤니티 글 작성</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="post-type-tabs">
            <button class="post-type-tab active" data-type="text">
              <i class="fas fa-align-left"></i> 텍스트
            </button>
            <button class="post-type-tab" data-type="image">
              <i class="fas fa-image"></i> 이미지
            </button>
            <button class="post-type-tab" data-type="video">
              <i class="fas fa-video"></i> 동영상
            </button>
          </div>
          
          <form id="createPostForm">
            <div class="form-group">
              <label for="postContent">내용</label>
              <textarea id="postContent" rows="6" placeholder="여러분의 의견을 자유롭게 표현해보세요..." required></textarea>
            </div>
            
            <div id="mediaUpload" style="display: none;">
              <div class="form-group">
                <label for="mediaFile">파일 선택</label>
                <div class="file-upload">
                  <input type="file" id="mediaFile" accept="image/*,video/*">
                  <div class="file-upload-placeholder">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <span>파일을 선택하거나 드래그하세요</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="post-options">
              <label class="checkbox-wrapper">
                <input type="checkbox" id="allowComments" checked>
                <span class="checkmark"></span>
                댓글 허용
              </label>
              <label class="checkbox-wrapper">
                <input type="checkbox" id="pinPost">
                <span class="checkmark"></span>
                상단 고정 (OP 전용)
              </label>
            </div>
            
            <div class="posting-fee-info">
              <div class="fee-notice">
                <i class="fas fa-info-circle"></i>
                <span>게시 수수료: <strong>0.001 B</strong></span>
              </div>
              <div class="fee-breakdown">
                <small>블록체인 기록 비용으로 사용됩니다</small>
              </div>
            </div>
            
            <div class="posting-rules">
              <h4><i class="fas fa-exclamation-triangle"></i> 게시 규칙</h4>
              <ul>
                <li>건설적인 토론과 상호 존중을 지켜주세요</li>
                <li>부적절한 내용은 DAO 구성원의 신고로 제재될 수 있습니다</li>
                <li>질 높은 콘텐츠는 기여 활동으로 B-Token을 획득할 수 있습니다</li>
              </ul>
            </div>
            
            <div class="modal-actions">
              <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
              <button type="submit" class="btn-primary">게시하기</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 탭 전환 기능
    const tabs = modal.querySelectorAll('.post-type-tab');
    const mediaUpload = modal.querySelector('#mediaUpload');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const type = tab.getAttribute('data-type');
        if (type === 'text') {
          mediaUpload.style.display = 'none';
        } else {
          mediaUpload.style.display = 'block';
          const fileInput = modal.querySelector('#mediaFile');
          if (type === 'image') {
            fileInput.setAttribute('accept', 'image/*');
          } else if (type === 'video') {
            fileInput.setAttribute('accept', 'video/*');
          }
        }
      });
    });

    // 폼 이벤트 처리
    const form = modal.querySelector('#createPostForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeTab = modal.querySelector('.post-type-tab.active');
      const data = {
        type: activeTab.getAttribute('data-type'),
        content: form.querySelector('#postContent').value,
        allowComments: form.querySelector('#allowComments').checked,
        pinPost: form.querySelector('#pinPost').checked
      };
      this.submitCommunityPost(data);
      modal.remove();
    });
  }

  async submitCommunityPost(data) {
    try {
      // B-Token 잔액 확인
      const currentBTokens = parseFloat(document.getElementById('bTokenBalance').textContent.replace(' B', '')) || 0;
      const postingFee = 0.001;
      
      if (currentBTokens < postingFee) {
        throw new Error(`B-Token이 부족합니다. 현재 보유량: ${currentBTokens}B, 필요량: ${postingFee}B`);
      }

      // 수수료 차감
      const newBalance = currentBTokens - postingFee;
      document.getElementById('bTokenBalance').textContent = `${newBalance.toFixed(3)} B`;

      // 트랜잭션 기록
      const transaction = {
        type: 'community_post',
        amount: postingFee,
        timestamp: new Date().toISOString(),
        description: `커뮤니티 글 작성 수수료`
      };

    // 시뮬레이션 처리
    const typeText = data.type === 'text' ? '텍스트' : data.type === 'image' ? '이미지' : '동영상';
      this.showSuccessMessage(`${typeText} 게시글이 성공적으로 작성되었습니다! (수수료: ${postingFee}B)`);
    
          // 커뮤니티 페이지 새로고침 (현재 필터 상태 유지)
    if (this.currentDAOId) {
        this.loadCommunityPosts(this.currentDAOId, this.showingMyPostsOnly);
      }
    } catch (error) {
      console.error('커뮤니티 글 작성 실패:', error);
      this.showErrorMessage(error.message);
    }
  }



  likePost(postId) {
    this.showSuccessMessage('게시글에 좋아요를 눌렀습니다.');
  }

  commentPost(postId) {
    this.showCommentsModal(postId);
  }

  showCommentsModal(postId) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content comments-modal">
        <div class="modal-header">
          <h3><i class="fas fa-comments"></i> 댓글</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="comments-container">
            <div class="comments-list" id="commentsList">
              <!-- 댓글 목록이 동적으로 생성됩니다 -->
            </div>
            
            <div class="comment-form">
              <div class="comment-input">
                <div class="user-avatar">
                  <i class="fas fa-user"></i>
                </div>
                <textarea id="commentText" placeholder="댓글을 작성하세요..." rows="3"></textarea>
              </div>
              <div class="comment-actions">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
                <button class="btn-primary" onclick="window.dapp.submitComment(${postId})">
                  <i class="fas fa-paper-plane"></i> 댓글 작성
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // 기존 댓글 로드
    this.loadComments(postId);
  }

  loadComments(postId) {
    // 시뮬레이션 댓글 데이터
    const comments = [
      {
        id: 1,
        author: '김토론',
        content: '좋은 의견이네요! 저도 동감합니다.',
        timestamp: '5분 전',
        likes: 3
      },
      {
        id: 2,
        author: '이의견',
        content: '다른 관점에서 보면, 이런 방법도 있을 것 같은데요. 어떻게 생각하시나요?',
        timestamp: '10분 전',
        likes: 1
      },
      {
        id: 3,
        author: '박질문',
        content: '혹시 구체적인 실행 방안에 대해서도 더 자세히 설명해주실 수 있나요?',
        timestamp: '15분 전',
        likes: 2
      }
    ];

    const commentsList = document.getElementById('commentsList');
    if (commentsList) {
      commentsList.innerHTML = comments.map(comment => `
        <div class="comment-item">
          <div class="comment-header">
            <div class="comment-author">
              <div class="author-avatar">
                <i class="fas fa-user"></i>
              </div>
              <div class="author-info">
                <span class="author-name">${comment.author}</span>
                <span class="comment-time">${comment.timestamp}</span>
              </div>
            </div>
            <div class="comment-actions">
              <button class="like-btn" onclick="window.dapp.likeComment(${comment.id})">
                <i class="fas fa-heart"></i> ${comment.likes}
              </button>
            </div>
          </div>
          <div class="comment-content">
            <p>${comment.content}</p>
          </div>
        </div>
      `).join('');
    }
  }

  submitComment(postId) {
    const commentText = document.getElementById('commentText');
    if (!commentText || !commentText.value.trim()) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    // 시뮬레이션 처리
    this.showSuccessMessage('댓글이 성공적으로 작성되었습니다!');
    
    // 댓글 입력 초기화
    commentText.value = '';
    
    // 댓글 목록 새로고침
    this.loadComments(postId);
  }

  likeComment(commentId) {
    this.showSuccessMessage('댓글에 좋아요를 눌렀습니다.');
  }

  // P2P 통신 관련 함수들
  async loadP2P() {
    if (!this.isAuthenticated) {
      const authRequired = document.getElementById('p2pAuthRequired');
      if (authRequired) {
        authRequired.style.display = 'block';
      }
      // 모든 P2P 화면 숨기기
      document.querySelectorAll('.p2p-screen').forEach(screen => {
        screen.style.display = 'none';
      });
      return;
    } else {
      const authRequired = document.getElementById('p2pAuthRequired');
      if (authRequired) {
        authRequired.style.display = 'none';
      }
    }
    
    // 채팅 화면이 활성화되어 있다면 숨기기
    const chatScreen = document.getElementById('chatScreen');
    if (chatScreen) {
      chatScreen.classList.remove('active');
    }
    
    // 기본적으로 연락처 화면 표시
    this.switchP2PTab('contacts');
    this.loadContacts();
    this.loadChats();
    this.updateMobileP2PHeader('contacts');
  }

  // P2P 탭 전환
  switchP2PTab(tabType) {
    // 데스크톱 탭 버튼 업데이트
    const navTabs = document.querySelectorAll('.p2p-nav-tab');
    navTabs.forEach(tab => {
      if (tab.dataset.tab === tabType) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // 모바일 탭 버튼 업데이트
    const mobileTabs = document.querySelectorAll('.mobile-p2p-tab');
    mobileTabs.forEach(tab => {
      if (tab.dataset.tab === tabType) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // 채팅 화면 강제로 숨기기
    const chatScreen = document.getElementById('chatScreen');
    if (chatScreen) {
      chatScreen.classList.remove('active');
    }

    // 화면 전환 (채팅 화면 제외)
    const screens = document.querySelectorAll('.p2p-screen:not(.chat-screen)');
    screens.forEach(screen => {
      screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(tabType + 'Screen');
    if (targetScreen) {
      targetScreen.classList.add('active');
    }

    // 탭별 데이터 로드
    if (tabType === 'contacts') {
      this.loadContacts();
    } else if (tabType === 'chats') {
      this.loadChats();
    } else if (tabType === 'public') {
      this.loadPublicChats();
    }

    // 모바일 헤더 액션 버튼 업데이트
    this.updateMobileP2PHeader(tabType);
  }

  // 모바일 P2P 헤더 업데이트
  updateMobileP2PHeader(tabType) {
    const actionBtn = document.getElementById('mobileP2PActionBtn');
    if (actionBtn) {
      if (tabType === 'contacts') {
        actionBtn.onclick = () => this.showAddContact();
        actionBtn.innerHTML = '<i class="fas fa-user-plus"></i>';
        actionBtn.title = '연락처 추가';
      } else if (tabType === 'chats') {
        actionBtn.onclick = () => this.showCreateGroupChat();
        actionBtn.innerHTML = '<i class="fas fa-users"></i>';
        actionBtn.title = '그룹채팅 생성';
      } else if (tabType === 'public') {
        actionBtn.onclick = () => this.showCreatePublicChatModal();
        actionBtn.innerHTML = '<i class="fas fa-plus"></i>';
        actionBtn.title = '공개 채팅방 만들기';
      }
    }
  }

  loadContacts() {
    const contactsList = document.getElementById('contactsList');
    if (!contactsList) return;
    
    // 연락처 데이터 가져오기
    const contacts = this.getContactsData();
    
    // 삭제된 연락처 제외
    const visibleContacts = contacts.filter(contact => !this.isContactDeleted(contact.id));
    
    if (visibleContacts.length === 0) {
      contactsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-address-book" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;"></i>
          <p>연락처가 없습니다</p>
          <small>연락처 추가 버튼을 눌러 백야 네트워크에서 친구를 찾아보세요</small>
        </div>
      `;
      return;
    }
    
    contactsList.innerHTML = visibleContacts.map(contact => {
      const contactInfo = this.getContactInfo(contact.id);
      const statusMessage = contact.statusMessage || '';
      const isBlocked = this.isUserBlocked(contact.id);
      
      return `
        <div class="contact-item ${isBlocked ? 'blocked' : ''}" data-contact-id="${contact.id}">
          <div class="contact-clickable-area" onclick="window.dapp.showProfileView('${contact.id}')" style="cursor: pointer;">
            ${this.generateAvatarHTML(contactInfo, 'contact-simple')}
            <div class="contact-info">
                <div class="contact-name">${contactInfo.name} ${isBlocked ? '<i class="fas fa-ban" style="color: #f59e0b; margin-left: 0.5rem;" title="차단된 사용자"></i>' : ''}</div>
                ${statusMessage && !isBlocked ? `<div class="contact-status-message">${statusMessage}</div>` : ''}
                ${isBlocked ? '<div class="contact-status-message" style="color: #f59e0b;">차단된 사용자</div>' : ''}
            </div>
          </div>

        </div>
      `;
    }).join('');
  }



  loadChats() {
    const chatsList = document.getElementById('chatsList');
    if (!chatsList) return;
    
    // 채팅방 데이터 (초기에는 비어있음)
    const chats = [];
    
    // 현재 필터 적용
    const currentFilter = this.currentChatFilter || 'all';
    const filteredChats = this.filterChatsByType(chats, currentFilter);
    
    console.log('🔍 채팅 리스트 로딩 중...', filteredChats.length, '개의 채팅방 (전체:', chats.length, ', 필터:', currentFilter, ')');
    
    // 필터 결과가 없는 경우 처리
    if (filteredChats.length === 0) {
      this.checkChatFilterResults(currentFilter, 0);
      return;
    }
    
    chatsList.innerHTML = filteredChats.map(chat => {
      // 채팅 데이터에서 직접 이름 사용, 아바타용으로만 contactInfo 사용
      const contactInfo = this.getContactInfo(chat.id);
      const chatContact = {
        id: chat.id,
        name: chat.name, // 채팅 데이터의 이름 직접 사용
        avatar: contactInfo.avatar || null
      };
      
      // 안읽은 메시지 개수 계산
      const unreadCount = this.getUnreadMessageCount(chat.id);
      const unreadBadge = unreadCount > 0 ? `<div class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</div>` : '';
      
      console.log(`📱 채팅방 ${chat.id}: 이름="${chat.name}", 타입="${chat.type}", 안읽음=${unreadCount}`);
      
      return `
      <div class="chat-item" onclick="window.dapp.openChat('${chat.id}')">
          <div class="chat-avatar-wrapper">
            ${this.generateAvatarHTML(chatContact, 'chat-simple')}
            ${unreadBadge}
        </div>
        <div class="chat-info">
            <div class="chat-item-header">
              <div class="chat-name" style="color: #333 !important; font-weight: bold !important; font-size: 16px !important;">${chat.name}</div>
              ${chat.type === 'group' ? `<span class="member-count">${chat.memberCount}명</span>` : ''}
            </div>
          <div class="chat-preview">${chat.lastMessage}</div>
        </div>
        <div class="chat-meta">
          <div class="chat-time">${chat.timestamp}</div>
        </div>
      </div>
      `;
    }).join('');
  }

  // 연락처 추가 기능 (백야 네트워크 검색으로 변경)
  showAddContact() {
    // 로그인 체크
    if (!this.isAuthenticated) {
      this.showErrorMessage('로그인이 필요합니다. 로그인을 완료해주세요.');
      // 지갑 탭으로 이동
      document.querySelector('.tab-btn[data-tab="wallet"]').click();
      return;
    }
    
    console.log('🔍 백야 네트워크 친구 검색 모달 표시');
    const modal = document.getElementById('friendSearchModal');
    if (modal) {
      // 모달 초기화
      this.resetFriendSearchModal();
      modal.classList.add('active');
      
      // 검색 입력창에 포커스
      setTimeout(() => {
        const searchInput = document.getElementById('networkSearchInput');
        if (searchInput) {
          searchInput.focus();
        }
      }, 300);
    }
  }

  closeFriendSearchModal() {
    console.log('🔍 백야 네트워크 친구 검색 모달 닫기');
    const modal = document.getElementById('friendSearchModal');
    if (modal) {
      modal.classList.remove('active');
      this.resetFriendSearchModal();
    }
  }

  resetFriendSearchModal() {
    // 검색 입력창 초기화
    const searchInput = document.getElementById('networkSearchInput');
    if (searchInput) {
      searchInput.value = '';
    }
    
    // 상태 초기화
    const searchStatus = document.getElementById('searchStatus');
    const searchResults = document.getElementById('searchResultsSection');
    const noResults = document.getElementById('noResults');
    
    if (searchStatus) searchStatus.style.display = 'none';
    if (searchResults) searchResults.style.display = 'none';
    if (noResults) noResults.style.display = 'none';
  }

  // 백야 네트워크 사용자 검색
  async searchNetworkUsers() {
    const searchInput = document.getElementById('networkSearchInput');
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    
    if (!searchTerm) {
      this.showErrorMessage('검색어를 입력해주세요');
      return;
    }
    
    console.log('🔍 백야 네트워크 검색:', searchTerm);
    
    // UI 상태 업데이트
    this.showSearchStatus(true);
    
    try {
      // 시뮬레이션: 실제로는 백야 네트워크 API 호출
      await this.simulateNetworkSearch(searchTerm);
    } catch (error) {
      console.error('🚨 네트워크 검색 오류:', error);
      this.showErrorMessage('검색 중 오류가 발생했습니다');
      this.showSearchStatus(false);
    }
  }

  showSearchStatus(isSearching) {
    const searchStatus = document.getElementById('searchStatus');
    const searchResults = document.getElementById('searchResultsSection');
    const noResults = document.getElementById('noResults');
    
    if (isSearching) {
      if (searchStatus) searchStatus.style.display = 'block';
      if (searchResults) searchResults.style.display = 'none';
      if (noResults) noResults.style.display = 'none';
    } else {
      if (searchStatus) searchStatus.style.display = 'none';
    }
  }

  // 네트워크 검색 시뮬레이션
  async simulateNetworkSearch(searchTerm) {
    try {
      console.log('🔍 서버 API 호출 시작:', searchTerm);
      
      // 실제 서버 API 호출
      const response = await fetch(`${this.apiBase}/p2p/find-contact/${encodeURIComponent(searchTerm)}`);
      
      console.log('📡 서버 응답 상태:', response.status);
      
      const result = await response.json();
      console.log('📋 서버 응답 데이터:', result);
      
      let networkUsers = [];
      
      if (result.success && result.found) {
        console.log('✅ 사용자 찾음:', result.communicationAddress);
        console.log('📋 서버 응답 상세:', result);
        
        // 서버에서 찾은 사용자 정보를 클라이언트 형식으로 변환
        let displayName;
        if (result.name && result.name !== `사용자 ${result.communicationAddress}`) {
          displayName = result.name;
        } else if (result.username) {
          displayName = result.username; // 아이디를 이름으로 사용
        } else {
          displayName = `사용자 ${result.communicationAddress}`;
        }
        
        const searchInfo = result.searchType === 'username' ? 
          `아이디: ${result.username}` : 
          `통신주소: ${result.communicationAddress}`;
        
        networkUsers = [{
          id: result.communicationAddress, // 통신주소를 ID로 사용
          name: displayName,
          username: result.username || null,
          commAddress: result.communicationAddress,
          searchType: result.searchType,
          searchInfo: searchInfo,
          isOnline: result.isActive || false,
          reputation: 85, // 기본 신뢰도
          lastSeen: result.isActive ? '온라인' : '최근 접속',
          avatar: null // 기본 아바타 사용
        }];
        
        console.log('👤 생성된 사용자 목록:', networkUsers);
      } else {
        console.log('❌ 사용자를 찾지 못함:', result.message || '알 수 없는 오류');
      }
    
    this.showSearchStatus(false);
      this.displaySearchResults(networkUsers);
      
      console.log('🎯 검색 결과 표시 완료, 결과 수:', networkUsers.length);
      
    } catch (error) {
      console.error('🚨 네트워크 검색 오류:', error);
      this.showSearchStatus(false);
      this.displaySearchResults([]);
      this.showErrorMessage('검색 중 오류가 발생했습니다: ' + error.message);
    }
  }

  displaySearchResults(results) {
    const searchResults = document.getElementById('searchResultsSection');
    const noResults = document.getElementById('noResults');
    const usersList = document.getElementById('networkUsersList');
    
    if (results.length === 0) {
      if (searchResults) searchResults.style.display = 'none';
      if (noResults) noResults.style.display = 'block';
      return;
    }
    
    if (noResults) noResults.style.display = 'none';
    if (searchResults) searchResults.style.display = 'block';
    
    if (usersList) {
      usersList.innerHTML = results.map(user => this.generateNetworkUserHTML(user)).join('');
    }
  }

  generateNetworkUserHTML(user) {
    const isAlreadyFriend = this.isUserAlreadyFriend(user.id);
    
    return `
      <div class="network-user-item" data-user-id="${user.id}">
        <div class="network-user-avatar">
          ${user.avatar ? 
            `<img src="${user.avatar}" alt="${user.name}">` : 
            `<i class="fas fa-user"></i>`
          }
        </div>
        <div class="network-user-info">
          <div class="network-user-header">
            <div class="network-user-name">${user.name}</div>
          </div>
          <div class="network-user-address">
            <i class="fas fa-phone"></i>
            <span>통신주소: ${user.commAddress}</span>
          </div>
        </div>
        <div class="network-user-actions">
          ${isAlreadyFriend ? 
            `<button class="btn-secondary already-friend" disabled>
              <i class="fas fa-check"></i>
              이미 친구
            </button>` :
            `<button class="btn-primary add-friend-btn" onclick="window.dapp.addNetworkFriend('${user.id}')">
              <i class="fas fa-user-plus"></i>
              친구 추가
            </button>`
          }
        </div>
      </div>
    `;
  }

  isUserAlreadyFriend(userId) {
    // 기존 연락처에서 해당 네트워크 사용자가 이미 있는지 확인
    const savedContacts = JSON.parse(localStorage.getItem('baekya_contacts') || '[]');
    
    // 통신주소 또는 ID로 기존 연락처 확인
    return savedContacts.some(contact => 
      contact.address === userId || 
      contact.commAddress === userId ||
      contact.id === userId
    );
  }

  // 네트워크 친구 추가
  async addNetworkFriend(networkUserId) {
    console.log('👥 네트워크 친구 추가:', networkUserId);
    
    try {
      // 버튼 상태 업데이트
      const addButton = document.querySelector(`[data-user-id="${networkUserId}"] .add-friend-btn`);
      if (addButton) {
        addButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 추가 중...';
        addButton.disabled = true;
      }
      
      // 시뮬레이션: 네트워크에서 사용자 정보 가져오기
      const networkUser = await this.getNetworkUserDetails(networkUserId);
      
      if (networkUser) {
        // 내 연락처에 추가 (신규 표시)
        await this.addToMyContacts(networkUser);
        
        // UI 업데이트
        if (addButton) {
          addButton.innerHTML = '<i class="fas fa-check"></i> 추가 완료';
          addButton.classList.remove('btn-primary');
          addButton.classList.add('btn-secondary', 'already-friend');
        }
        
        this.showSuccessMessage(`${networkUser.name}님이 연락처에 추가되었습니다`);
        
        // 연락처 리스트 새로고침
        if (this.currentTab === 'p2p') {
          this.loadContacts();
        }
      }
    } catch (error) {
      console.error('🚨 친구 추가 오류:', error);
      this.showErrorMessage('친구 추가 중 오류가 발생했습니다');
      
      // 버튼 상태 복원
      const addButton = document.querySelector(`[data-user-id="${networkUserId}"] .add-friend-btn`);
      if (addButton) {
        addButton.innerHTML = '<i class="fas fa-user-plus"></i> 친구 추가';
        addButton.disabled = false;
      }
    }
  }

  async getNetworkUserDetails(networkUserId) {
    try {
      // 실제 서버 API 호출 (통신주소로 사용자 정보 조회)
      const response = await fetch(`${this.apiBase}/p2p/find-contact/${encodeURIComponent(networkUserId)}`);
      const result = await response.json();
      
      console.log('🔍 사용자 정보 조회 결과:', result);
      
      if (result.success && result.found) {
        // 서버에서 받은 실제 사용자 정보 사용
        let displayName;
        if (result.name && result.name !== `사용자 ${result.communicationAddress}`) {
          displayName = result.name;
        } else if (result.username) {
          displayName = result.username; // 아이디를 이름으로 사용
        } else {
          displayName = `사용자 ${result.communicationAddress}`;
        }
        
        console.log('👤 getNetworkUserDetails - 최종 이름:', displayName);
        
        return {
          id: result.communicationAddress,
          name: displayName,
          username: result.username || null,
          commAddress: result.communicationAddress,
          isOnline: result.isActive || false,
          reputation: 85,
          lastSeen: result.isActive ? '온라인' : '최근 접속',
          avatar: null,
          // 연락처 추가를 위한 추가 정보
          address: result.communicationAddress,
          status: result.isActive ? 'online' : 'offline'
        };
      }
      
      return null;
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error);
    return null;
    }
  }

  async addToMyContacts(networkUser) {
    // 기존 연락처 데이터에 새 친구 추가
    console.log('📇 연락처 추가 시작:', networkUser);
    
    // 로컬 스토리지에서 기존 연락처 가져오기
    const savedContacts = JSON.parse(localStorage.getItem('baekya_contacts') || '[]');
    console.log('📋 기존 저장된 연락처 수:', savedContacts.length);
    
    // 중복 확인
    const isDuplicate = savedContacts.some(contact => 
      contact.commAddress === networkUser.commAddress ||
      contact.address === networkUser.commAddress ||
      contact.id === networkUser.commAddress
    );
    
    if (isDuplicate) {
      console.log('⚠️ 이미 존재하는 연락처입니다:', networkUser.commAddress);
      return;
    }
    
    // 기존 연락처 시스템과 일치하는 형식으로 변환
    const contactData = {
      id: networkUser.commAddress, // 통신주소를 ID로 사용
      name: networkUser.name,
      address: networkUser.commAddress,
      commAddress: networkUser.commAddress,
      status: networkUser.status || 'offline',
      isOnline: networkUser.isOnline || false,
      reputation: networkUser.reputation || 85,
      avatar: networkUser.avatar || null,
      username: networkUser.username || null, // 아이디 정보 추가
      addedAt: Date.now(),
      isNew: true, // 새로 추가된 연락처 표시
      source: 'network_search' // 검색을 통해 추가됨
    };
    
    console.log('💾 저장할 연락처 데이터:', contactData);
    
    // 새 연락처 추가
    savedContacts.push(contactData);
    
    // 로컬 스토리지에 저장
    localStorage.setItem('baekya_contacts', JSON.stringify(savedContacts));
    
    console.log('✅ 연락처가 로컬 스토리지에 저장되었습니다. 총 연락처 수:', savedContacts.length);
    
    // 저장 후 확인
    const verifyContacts = JSON.parse(localStorage.getItem('baekya_contacts') || '[]');
    const addedContact = verifyContacts.find(c => c.commAddress === networkUser.commAddress);
    console.log('🔍 저장 확인 - 추가된 연락처:', addedContact);
  }

  addContact() {
    const address = document.getElementById('contactAddress').value;
    const name = document.getElementById('contactName').value || address;
    
    if (!address.match(/^010-\d{4}-\d{4}$/)) {
      alert('올바른 통신주소 형식이 아닙니다. (010-XXXX-XXXX)');
      return;
    }
    
    this.showSuccessMessage(`${name} (${address})가 연락처에 추가되었습니다.`);
    this.loadContacts();
  }

  startChat(contactId) {
    // 연락처 정보 가져오기
    const contactInfo = this.getContactInfo(contactId);
    
    // 현재 채팅 상대 정보 저장
    this.currentChatContact = contactInfo;
    this.currentChatId = contactId;
    
    // 모든 P2P 화면 숨기기
    const screens = document.querySelectorAll('.p2p-screen');
    screens.forEach(screen => {
      screen.classList.remove('active');
    });
    
    // 채팅 화면 표시
    const chatScreen = document.getElementById('chatScreen');
    if (chatScreen) {
      chatScreen.classList.add('active');
      
      // 채팅 헤더 정보 업데이트
      const chatUserName = document.getElementById('chatUserName');
      const chatUserStatus = document.getElementById('chatUserStatus');
      const chatAvatar = document.querySelector('.chat-user-info .chat-avatar');
      
      if (chatUserName) {
        chatUserName.textContent = contactInfo.name;
      }
      
      if (chatUserStatus) {
        chatUserStatus.textContent = '';
        chatUserStatus.className = 'chat-status';
      }
      
      // 아바타 업데이트 - 완전한 아바타 HTML 사용
      if (chatAvatar) {
        const avatarHTML = this.generateAvatarHTML(contactInfo, 'chat-header-simple');
        // 외부 div 제거하고 내부 내용만 사용
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = avatarHTML;
        const innerContent = tempDiv.firstChild;
        chatAvatar.innerHTML = innerContent.innerHTML;
        
        // 배경과 색상을 명시적으로 설정
        chatAvatar.style.background = 'linear-gradient(135deg, var(--primary-light) 0%, var(--secondary-color) 100%)';
        chatAvatar.style.color = 'white';
      }
      
      // 채팅 메시지 로드
    this.loadChatMessages(contactId);
    }
    
    // 모바일 헤더 업데이트
    this.updateMobileP2PHeader('chat');
  }

  loadChatMessages(contactId) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // 연락처 정보 가져오기
    const contact = this.getContactInfo(contactId);
    
    // 시뮬레이션 메시지 데이터
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 채팅 타입에 따라 다른 메시지 생성
    let messages = [];
    
    // 저장된 메시지가 있는지 확인
    const savedMessages = this.getChatMessages(contactId);
    
    if (savedMessages && savedMessages.length > 0) {
      messages = savedMessages;
    } else {
      // 기존 하드코딩된 연락처들에 대해서만 예시 메시지 생성
      const isDefaultContact = ['1', '2', '3', '4', '5', '6', '7', 
                               'chat_1', 'chat_2', 'chat_3', 'chat_4',
                               'chat_group_1', 'chat_group_2', 'chat_group_3'].includes(contactId);
      
      if (isDefaultContact) {
        if (contactId.includes('group') || contactId.includes('public')) {
      // 그룹/공개 채팅 메시지 (여러 발신자)
      messages = [
        { 
          id: 1, 
          sender: 'other',
          senderName: '이기여',
          senderId: '2',
          text: '안녕하세요! 새로운 프로젝트 제안이 있습니다.', 
          timestamp: '14:30',
          date: yesterday.toISOString().split('T')[0],
          read: true,
          readBy: ['me']
        },
        { 
          id: 2, 
          sender: 'other',
          senderName: '박검증',
          senderId: '3',
          text: '좋은 아이디어네요! 구체적인 계획이 있나요?', 
          timestamp: '14:32',
          date: yesterday.toISOString().split('T')[0],
          read: true,
          readBy: ['me']
        },
        { 
          id: 3, 
          sender: 'me', 
          text: '네, 문서를 준비해서 공유하겠습니다.', 
          timestamp: '14:35',
          date: yesterday.toISOString().split('T')[0],
          read: true,
          readBy: ['2', '3', '4', '5'] // 그룹 멤버들이 읽음
        },
        { 
          id: 4, 
          sender: 'other',
          senderName: '최채굴',
          senderId: '4',
          text: '기대되네요! 기술 스택은 어떻게 구성하실 예정인가요?', 
          timestamp: '10:15',
          date: today.toISOString().split('T')[0],
          read: false,
          readBy: []
        },
        { 
          id: 5, 
          sender: 'other',
          senderName: '정토큰',
          senderId: '5',
          text: '저도 참여하고 싶습니다!', 
          timestamp: '10:20',
          date: today.toISOString().split('T')[0],
          read: false,
          readBy: []
        }
      ];
    } else {
      // 개인 채팅 메시지
      messages = [
        { 
          id: 1, 
          sender: 'other', 
          text: 'DAO 참여 관련해서 문의드릴 게 있습니다.', 
          timestamp: '14:30',
          date: yesterday.toISOString().split('T')[0],
          read: true,
          readBy: ['me']
        },
        { 
          id: 2, 
          sender: 'me', 
          text: '네, 무엇을 도와드릴까요?', 
          timestamp: '14:31',
          date: yesterday.toISOString().split('T')[0],
          read: true,
          readBy: [contactId]
        },
        { 
          id: 3, 
          sender: 'other', 
          text: 'Development DAO에서 어떤 기여 활동을 할 수 있나요?', 
          timestamp: '14:32',
          date: yesterday.toISOString().split('T')[0],
          read: true,
          readBy: ['me']
        },
        { 
          id: 4, 
          sender: 'me', 
          text: '개발, 디자인, 마케팅 등 다양한 분야에서 기여할 수 있습니다.', 
          timestamp: '10:15',
          date: today.toISOString().split('T')[0],
          read: false,
          readBy: []
        },
        { 
          id: 5, 
          sender: 'other', 
          text: '감사합니다! 참여 신청은 어떻게 하나요?', 
          timestamp: '10:20',
          date: today.toISOString().split('T')[0],
          read: false,
          readBy: []
        }
      ];
        }
      } else {
        // 새로 추가된 친구들은 빈 메시지 리스트로 시작
        messages = [];
      }
    }
    
    // 현재 채팅방에 들어왔으므로 안읽은 메시지들을 읽음 처리
    this.markMessagesAsRead(contactId, messages);
    
    // 메시지 렌더링
    let messagesHtml = '';
    let lastDate = '';
    
    messages.forEach(msg => {
      // 날짜가 바뀌면 날짜 구분선 추가
      if (msg.date !== lastDate) {
        const dateLabel = this.formatDateLabel(msg.date);
        messagesHtml += `
          <div class="message-date-divider">
            <span class="date-label">${dateLabel}</span>
          </div>
        `;
        lastDate = msg.date;
      }
      
      // 메시지 추가
      if (msg.sender === 'me') {
        // 내 메시지 - 읽음 표시 추가
        const readStatus = this.getReadStatus(msg, contactId);
        
        if (msg.type === 'call-record') {
          // 통화 기록 메시지
          messagesHtml += `
            <div class="chat-message own">
              <div class="message-bubble call-record-bubble">
                ${msg.text}
                <div class="message-time">${msg.timestamp}</div>
              </div>
            </div>
          `;
        } else {
          // 일반 메시지
          messagesHtml += `
            <div class="chat-message own">
              <div class="message-bubble">
                <div class="message-text">${msg.text}</div>
                <div class="message-meta">
                  <span class="message-time">${msg.timestamp}</span>
                  ${readStatus}
                </div>
              </div>
            </div>
          `;
        }
      } else {
        // 상대방 메시지
        // 그룹/공개 채팅인 경우 발신자별 정보 사용
        let senderInfo = contact;
        let senderName = contact.name;
        
        if (msg.senderId && msg.senderName) {
          // 그룹/공개 채팅의 경우 각 발신자 정보 사용
          senderInfo = this.getContactInfo(msg.senderId);
          senderName = msg.senderName;
        }
        
        messagesHtml += `
          <div class="chat-message">
            ${this.generateAvatarHTML(senderInfo, 'message')}
            <div class="message-content">
              <div class="message-sender">${senderName}</div>
          <div class="message-bubble">
            <div class="message-text">${msg.text}</div>
            <div class="message-time">${msg.timestamp}</div>
              </div>
          </div>
        </div>
      `;
      }
    });
    
    chatMessages.innerHTML = messagesHtml;
    
    // 스크롤을 맨 아래로 (채팅방 열릴 때)
    this.scrollToBottom();
  }

  // 메시지 읽음 상태 가져오기
  getReadStatus(message, contactId) {
    if (message.sender !== 'me') return '';
    
    const isGroup = contactId.includes('group') || contactId.includes('public');
    
    if (isGroup) {
      // 그룹 채팅 - 읽지 않은 사람 수 표시 (없으면 표시 안함)
      const totalMembers = 5; // 그룹 멤버 수 (시뮬레이션)
      const readCount = message.readBy ? message.readBy.length : 0;
      const unreadCount = totalMembers - readCount;
      
      if (unreadCount > 0) {
        return `<span class="read-count">${unreadCount}</span>`;
      } else {
        return ''; // 모두 읽으면 아무것도 표시하지 않음
      }
    } else {
      // 개인 채팅 - 안읽으면 1, 읽으면 아무것도 표시 안함
      if (message.read && message.readBy && message.readBy.length > 0) {
        return ''; // 읽음 상태일 때는 아무것도 표시하지 않음
      } else {
        return `<span class="read-count">1</span>`;
      }
    }
  }

  // 메시지를 읽음으로 처리
  markMessagesAsRead(contactId, messages) {
    let updated = false;
    
    messages.forEach(msg => {
      if (msg.sender === 'other' && !msg.read) {
        msg.read = true;
        if (!msg.readBy) msg.readBy = [];
        if (!msg.readBy.includes('me')) {
          msg.readBy.push('me');
        }
        updated = true;
      }
    });
    
    if (updated) {
      // 메시지 저장
      this.saveChatMessages(contactId, messages);
      
      // 채팅 목록 업데이트 (안읽은 메시지 개수 변경)
      this.updateChatListUnreadCount();
    }
  }

  // 채팅 메시지 저장
  saveChatMessages(contactId, messages) {
    const chatMessages = JSON.parse(localStorage.getItem('chatMessages') || '{}');
    chatMessages[contactId] = messages;
    localStorage.setItem('chatMessages', JSON.stringify(chatMessages));
  }

  // 채팅 메시지 가져오기
  getChatMessages(contactId) {
    const chatMessages = JSON.parse(localStorage.getItem('chatMessages') || '{}');
    return chatMessages[contactId] || null;
  }

  // 안읽은 메시지 개수 계산
  getUnreadMessageCount(contactId) {
    const messages = this.getChatMessages(contactId);
    if (!messages) return 0;
    
    return messages.filter(msg => msg.sender === 'other' && !msg.read).length;
  }

  // 채팅 목록의 안읽은 메시지 개수 업데이트
  updateChatListUnreadCount() {
    // 채팅 목록 다시 로드
    if (document.getElementById('chatsScreen').classList.contains('active')) {
      this.loadChats();
    }
    // P2P 탭 알림 업데이트
    this.updateP2PTabNotification();
  }

  // P2P 탭 알림 업데이트
  updateP2PTabNotification() {
    const badge = document.getElementById('p2pNotificationBadge');
    if (!badge) return;

    // 전체 안읽은 메시지 개수 계산
    let totalUnreadCount = 0;
    const chatContacts = ['chat_1', 'chat_2', 'chat_3', 'chat_4'];
    
    chatContacts.forEach(contactId => {
      totalUnreadCount += this.getUnreadMessageCount(contactId);
    });

    // 알림 표시/숨기기
    if (totalUnreadCount > 0) {
      badge.style.display = 'flex';
      badge.textContent = totalUnreadCount > 99 ? '99+' : totalUnreadCount;
    } else {
      badge.style.display = 'none';
    }
  }

  // P2P 탭 알림 숨기기 (메시지를 읽었을 때)
  hideP2PTabNotification() {
    const badge = document.getElementById('p2pNotificationBadge');
    if (badge) {
      badge.style.display = 'none';
    }
  }

  // 지갑 탭 알림 업데이트
  updateWalletTabNotification() {
    const badge = document.getElementById('walletNotificationBadge');
    if (!badge) return;

    // 안읽은 거래내역 개수 계산
    const unreadCount = this.getUnreadTransactionCount();

    // 알림 표시/숨기기
    if (unreadCount > 0) {
      badge.style.display = 'flex';
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
    } else {
      badge.style.display = 'none';
    }
  }

  // 거래내역 알림 업데이트
  updateTransactionNotification() {
    const badge = document.getElementById('transactionNotificationBadge');
    if (!badge) return;

    const unreadCount = this.getUnreadTransactionCount();

    // 알림 표시/숨기기
    if (unreadCount > 0) {
      badge.style.display = 'flex';
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
    } else {
      badge.style.display = 'none';
    }
  }

  // 안읽은 거래내역 개수 조회
  getUnreadTransactionCount() {
    return this.transactions.filter(tx => !tx.read && tx.type === 'received').length;
  }

  // 거래내역 로드
  loadTransactionHistory() {
    const savedTransactions = localStorage.getItem('transactionHistory');
    if (savedTransactions) {
      this.transactions = JSON.parse(savedTransactions);
    }
    
    // 로그인한 경우에만 거래내역 처리
    if (this.isAuthenticated) {
    // 기존 거래내역의 통신주소 형태 업데이트 제거 - 통신주소를 보존해야 함
    // this.updateExistingTransactionsFormat();
    
    // 샘플 거래내역 추가 (최초 실행 시만)
    this.addSampleTransactions();
    } else {
      // 로그인하지 않은 경우 거래내역 초기화
      this.transactions = [];
    }
    
    this.renderTransactionHistory();
    this.updateTransactionNotification();
    this.updateWalletTabNotification();
  }

  // 기존 거래내역의 통신주소 형태 업데이트 - 사용하지 않음 (통신주소 보존)
  // updateExistingTransactionsFormat() {
  //   let updated = false;
  //   this.transactions.forEach(tx => {
  //     // 통신주소가 없거나 전화번호 형태가 아닌 경우 업데이트
  //     if (!tx.communicationAddress || !/^010-\d{4}-\d{4}$/.test(tx.communicationAddress)) {
  //       // 기본 전화번호 할당 (실제로는 더 정교한 매핑이 필요)
  //       tx.communicationAddress = '010-0000-0000';
  //       updated = true;
  //     }
  //   });
  //   
  //   if (updated) {
  //     this.saveTransactionHistory();
  //   }
  // }

  // 샘플 거래내역 추가 (비활성화 - 예시 데이터 제거)
  addSampleTransactions() {
    // 샘플 거래내역을 추가하지 않음
    return;
  }

  // 거래내역 저장
  saveTransactionHistory() {
    localStorage.setItem('transactionHistory', JSON.stringify(this.transactions));
  }

  // 거래내역 렌더링
  renderTransactionHistory() {
    const transactionList = document.getElementById('transactionList');
    if (!transactionList) return;

    // 현재 필터 적용
    const filteredTransactions = this.filterTransactionsByType(this.transactions, this.currentTransactionFilter);

    if (filteredTransactions.length === 0) {
      transactionList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-history"></i>
          <p>거래내역이 없습니다</p>
        </div>
      `;
      return;
    }

    // 시간순으로 정렬 (최신 순)
    const sortedTransactions = filteredTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    transactionList.innerHTML = sortedTransactions.map(transaction => {
      const isReceived = transaction.type === 'received';
      const contactInfo = this.getContactInfo(transaction.address);
      
      // 연락처 이름 또는 통신주소 표시 (DID는 노출하지 않음)
      let contactName;
      if (contactInfo && contactInfo.name !== '알 수 없음') {
        contactName = contactInfo.name;
      } else {
        // 연락처에 없으면 통신주소 표시 (통신주소가 없으면 기본값)
        contactName = transaction.communicationAddress || transaction.address || '알 수 없음';
      }
      
      return `
        <div class="transaction-item ${!transaction.read && isReceived ? 'unread' : ''}" onclick="window.dapp.showTransactionDetail('${transaction.id}')">
          <div class="transaction-icon ${transaction.type}">
            <i class="fas ${isReceived ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
            ${!transaction.read && isReceived ? '<div class="transaction-new-badge">NEW</div>' : ''}
          </div>
          <div class="transaction-details">
            <div class="transaction-header">
              <div class="transaction-type">
                ${isReceived ? '받은 거래' : '보낸 거래'}
                ${!transaction.read && isReceived ? '<span class="new-indicator">●</span>' : ''}
              </div>
              <div class="transaction-amount ${transaction.type}">
                ${isReceived ? '+' : '-'}${transaction.amount.toFixed(2)} B
              </div>
            </div>
            <div class="transaction-info">
              <div class="transaction-address">
                ${isReceived ? '보낸이' : '받는이'}: ${contactName}
              </div>
              ${transaction.memo ? `<div class="transaction-memo">"${transaction.memo}"</div>` : ''}
              <div class="transaction-time">${this.formatTransactionTime(transaction.timestamp)}</div>
            </div>
          </div>
          <div class="transaction-status">
            <div class="status-indicator ${transaction.status || 'confirmed'}"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // 거래내역 필터링
  filterTransactionsByType(transactions, filterType) {
    switch (filterType) {
      case 'sent':
        return transactions.filter(tx => tx.type === 'sent');
      case 'received':
        return transactions.filter(tx => tx.type === 'received');
      case 'all':
      default:
        return transactions;
    }
  }

  // 거래내역 필터 변경
  filterTransactionHistory(filterType) {
    this.currentTransactionFilter = filterType;
    
    // 필터 버튼 상태 업데이트
    const filterButtons = document.querySelectorAll('.transaction-filter-tab');
    filterButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.filter === filterType) {
        btn.classList.add('active');
      }
    });
    
    // 거래내역 다시 렌더링
    this.renderTransactionHistory();
  }

  // 거래내역 새로고침
  refreshTransactionHistory() {
    this.loadTransactionHistory();
    this.showSuccessMessage('거래내역이 새로고침되었습니다.');
  }

  // 거래내역 읽음 처리
  markTransactionAsRead(transactionId) {
    const transaction = this.transactions.find(tx => tx.id === transactionId);
    if (transaction && !transaction.read) {
      transaction.read = true;
      this.saveTransactionHistory();
      this.updateTransactionNotification();
      this.updateWalletTabNotification();
      this.renderTransactionHistory();
    }
  }

  // 거래 상세정보 모달 표시
  showTransactionDetail(transactionId) {
    const transaction = this.transactions.find(tx => tx.id === transactionId);
    if (!transaction) return;

    // 읽음 처리
    if (!transaction.read && transaction.type === 'received') {
      this.markTransactionAsRead(transactionId);
    }

    const isReceived = transaction.type === 'received';
    const contactInfo = this.getContactInfo(transaction.address);
    
    // 연락처 이름 또는 통신주소 표시 (DID는 노출하지 않음)
    let contactName;
    if (contactInfo && contactInfo.name !== '알 수 없음') {
      contactName = contactInfo.name;
    } else {
      // 연락처에 없으면 통신주소 표시 (통신주소가 없으면 기본값)
      contactName = transaction.communicationAddress || transaction.address || '알 수 없음';
    }

    const modal = document.createElement('div');
    modal.className = 'modal active transaction-detail-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-receipt"></i> 거래 상세정보</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="transaction-detail-content">
            <!-- 거래 상태 -->
            <div class="detail-section">
              <div class="detail-header">
                <div class="transaction-type-badge ${transaction.type}">
                  <i class="fas ${isReceived ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
                  ${isReceived ? '받은 거래' : '보낸 거래'}
                </div>
                <div class="transaction-status-badge ${transaction.status || 'confirmed'}">
                  <div class="status-indicator ${transaction.status || 'confirmed'}"></div>
                  ${this.getStatusText(transaction.status || 'confirmed')}
                </div>
              </div>
              <div class="transaction-amount-large ${transaction.type}">
                ${isReceived ? '+' : '-'}${transaction.amount.toFixed(4)} B
              </div>
            </div>

            <!-- 거래 정보 -->
            <div class="detail-section">
              <h4>거래 정보</h4>
              <div class="detail-info-grid">
                <div class="detail-info-item">
                  <label>${isReceived ? '보낸이' : '받는이'}</label>
                  <div class="detail-value">
                    <div class="contact-name">${contactName}</div>
                    ${transaction.communicationAddress && transaction.communicationAddress !== contactName ? 
                      `<div class="communication-address">${transaction.communicationAddress}</div>` : ''}
                  </div>
                </div>
                <div class="detail-info-item">
                  <label>거래주소(통신주소)</label>
                  <div class="detail-value address-value">
                    <span class="address-text">${transaction.communicationAddress || transaction.address || '알 수 없음'}</span>
                    ${(transaction.communicationAddress || transaction.address) ? `
                      <button class="copy-btn-small" onclick="window.dapp.copyToClipboard('${transaction.communicationAddress || transaction.address}', '거래주소')" title="거래주소 복사">
                        <i class="fas fa-copy"></i>
                      </button>
                    ` : ''}
                  </div>
                </div>
                ${transaction.memo ? `
                  <div class="detail-info-item">
                    <label>메모</label>
                    <div class="detail-value memo-value">"${transaction.memo}"</div>
                  </div>
                ` : ''}
                <div class="detail-info-item">
                  <label>거래 시간</label>
                  <div class="detail-value">${this.formatDetailTime(transaction.timestamp)}</div>
                </div>
                <div class="detail-info-item">
                  <label>거래 ID</label>
                  <div class="detail-value address-value">
                    <span class="address-text">${transaction.id}</span>
                    <button class="copy-btn-small" onclick="window.dapp.copyToClipboard('${transaction.id}', '거래 ID')" title="ID 복사">
                      <i class="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 네트워크 정보 -->
            <div class="detail-section">
              <h4>네트워크 정보</h4>
              <div class="detail-info-grid">
                <div class="detail-info-item">
                  <label>네트워크</label>
                  <div class="detail-value">백야 프로토콜</div>
                </div>
                <div class="detail-info-item">
                  <label>확인 상태</label>
                  <div class="detail-value">
                    <span class="confirmation-status confirmed">✓ 확인 완료</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="this.closest('.modal').remove()">
            <i class="fas fa-times"></i> 닫기
          </button>
          ${!isReceived ? `
            <button class="btn-primary" onclick="window.dapp.repeatTransaction('${transaction.id}')">
              <i class="fas fa-redo"></i> 다시 보내기
            </button>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // 상태 텍스트 반환
  getStatusText(status) {
    switch (status) {
      case 'confirmed': return '확인됨';
      case 'pending': return '대기중';
      case 'failed': return '실패';
      default: return '확인됨';
    }
  }

  // 상세 시간 포맷팅
  formatDetailTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long'
    });
  }

  // 거래 반복 (다시 보내기)
  repeatTransaction(transactionId) {
    const transaction = this.transactions.find(tx => tx.id === transactionId);
    if (!transaction || transaction.type !== 'sent') return;

    // 모달 닫기
    document.querySelector('.transaction-detail-modal').closest('.modal').remove();

    // 지갑 탭으로 이동하고 전송 폼 채우기
    const walletTab = document.querySelector('[data-tab="wallet"]');
    if (walletTab) {
      walletTab.click();
      
      setTimeout(() => {
        const recipientInput = document.getElementById('recipientAddress');
        const amountInput = document.getElementById('transferAmount');
        const memoInput = document.getElementById('transferMemo');
        
        if (recipientInput) recipientInput.value = transaction.communicationAddress || transaction.address;
        if (amountInput) amountInput.value = transaction.amount;
        if (memoInput) memoInput.value = transaction.memo || '';
        
        // 스크롤하여 전송 폼 보이기
        const transferSection = document.querySelector('.transaction-section');
        if (transferSection) {
          transferSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }

  // 모든 받은 거래 읽음 처리
  markAllReceivedTransactionsAsRead() {
    let updated = false;
    this.transactions.forEach(tx => {
      if (tx.type === 'received' && !tx.read) {
        tx.read = true;
        updated = true;
      }
    });
    
    if (updated) {
      this.saveTransactionHistory();
      this.updateTransactionNotification();
      this.updateWalletTabNotification();
      this.renderTransactionHistory();
    }
  }

  // 거래 추가
  addTransaction(type, address, amount, memo = '', status = 'confirmed', communicationAddress = '') {
    const transaction = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type: type, // 'sent' or 'received'
      address: address,
      communicationAddress: communicationAddress || address, // 통신주소가 없으면 주소 사용
      amount: amount,
      memo: memo,
      timestamp: new Date().toISOString(),
      status: status,
      read: type === 'sent' // 보낸 거래는 자동으로 읽음 처리
    };
    
    this.transactions.unshift(transaction); // 최신 거래를 맨 앞에 추가
    this.saveTransactionHistory();
    
    // 받은 거래인 경우 알림 업데이트
    if (type === 'received') {
      this.updateTransactionNotification();
      this.updateWalletTabNotification();
    }
    
    // 현재 거래내역 화면이 보이는 경우 즉시 업데이트
    if (document.getElementById('transactionList')) {
      this.renderTransactionHistory();
    }
    
    return transaction;
  }

  // 주소 포맷팅
  formatAddress(address) {
    if (address.length > 20) {
      return address.substring(0, 8) + '...' + address.substring(address.length - 8);
    }
    return address;
  }

  // 거래 시간 포맷팅
  formatTransactionTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) {
      return '방금 전';
    } else if (diffMins < 60) {
      return `${diffMins}분 전`;
    } else if (diffHours < 24) {
      return `${diffHours}시간 전`;
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  getContactInfo(contactId) {
    
    // localStorage에 저장된 연락처에서 먼저 확인
    const savedContacts = JSON.parse(localStorage.getItem('baekya_contacts') || '[]');
    const savedContact = savedContacts.find(contact => 
      contact.id === contactId || 
      contact.address === contactId || 
      contact.commAddress === contactId
    );
    
    if (savedContact) {
      console.log('📇 저장된 연락처 찾음:', savedContact);
      return {
        id: savedContact.id,
        name: savedContact.name,
        status: savedContact.status || 'offline',
        avatar: savedContact.avatar || null,
        address: savedContact.address || savedContact.commAddress,
        commAddress: savedContact.commAddress || savedContact.address,
        username: savedContact.username || null  // 아이디 정보 추가
      };
    }
    
    // 통합된 연락처 정보 (김개발만 실제 프로필 사진, 나머지는 기본 아이콘)
    const allContacts = {
      // 기본 연락처 - 김개발만 실제 프로필 사진
      '1': { id: '1', name: '김개발', status: 'online', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' },
      '2': { id: '2', name: '이기여', status: 'offline', avatar: null },
      '3': { id: '3', name: '박검증', status: 'online', avatar: null },
      '4': { id: '4', name: '최채굴', status: 'online', avatar: null },
      '5': { id: '5', name: '정토큰', status: 'offline', avatar: null },
      '6': { id: '6', name: '송보안', status: 'online', avatar: null },
      '7': { id: '7', name: '한합의', status: 'offline', avatar: null },
      
      // 거래내역용 연락처 매핑
      'contact_1': { id: 'contact_1', name: '김개발', status: 'online', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' },
      'contact_2': { id: 'contact_2', name: '이기여', status: 'offline', avatar: null },
      'contact_3': { id: 'contact_3', name: '박검증', status: 'online', avatar: null },
      
      // 채팅방 ID들도 동일한 정보 사용
      'chat_1': { id: 'chat_1', name: '김개발', status: 'online', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' },
      'chat_2': { id: 'chat_2', name: '이기여', status: 'offline', avatar: null },
      'chat_3': { id: 'chat_3', name: '박검증', status: 'online', avatar: null },
      'chat_4': { id: 'chat_4', name: '최채굴', status: 'online', avatar: null },
      
      // 그룹 채팅방도 기본 아이콘
      'chat_group_1': { id: 'chat_group_1', name: 'Development DAO', status: 'online', avatar: null },
      'chat_group_2': { id: 'chat_group_2', name: 'Governance DAO', status: 'online', avatar: null },
      'chat_group_3': { id: 'chat_group_3', name: 'Mining Pool', status: 'online', avatar: null }
    };
    
    // 하드코딩된 연락처에서 확인
    if (allContacts[contactId]) {
      return allContacts[contactId];
    }
    
    // 전화번호 형태(010-xxxx-xxxx)인 경우 기본값으로 처리
    if (/^010-\d{4}-\d{4}$/.test(contactId)) {
      return { id: contactId, name: '알 수 없음', status: 'offline', avatar: null, address: contactId, commAddress: contactId };
    }
    
    return { id: contactId, name: '알 수 없음', status: 'offline', avatar: null };
  }

  // 완전히 새로운 통합 아바타 생성 함수
  generateAvatarHTML(contact, context = 'contact') {
    let avatarClass;
    
    // 컨텍스트별 클래스 설정
    switch(context) {
      case 'contact':
        avatarClass = 'contact-avatar';
        break;
      case 'contact-simple':
        avatarClass = 'contact-avatar';
        break;
      case 'chat':
        avatarClass = 'chat-avatar';
        break;
      case 'chat-simple':
        avatarClass = 'chat-avatar';
        break;
      case 'chat-header':
        avatarClass = 'chat-avatar';
        break;
      case 'chat-header-simple':
        avatarClass = 'chat-avatar';
        break;
      case 'message':
        avatarClass = 'message-avatar';
        break;
      default:
        avatarClass = 'contact-avatar';
    }
    
    // 아바타 내용 생성
    let avatarContent;
    let isClickable = false;
    
    if (contact.avatar && contact.avatar.startsWith('http')) {
      // 실제 프로필 사진 - 클릭 가능
      avatarContent = `<img src="${contact.avatar}" alt="${contact.name}" class="avatar-image" onerror="this.style.display='none'; this.parentElement.innerHTML='<i class=\\"fas fa-user\\"></i>';">`;
      isClickable = true;
    } else {
      // 기본 아이콘 - 연락처에서는 클릭 가능
      avatarContent = `<i class="fas fa-user" style="color: white;"></i>`;
      // 연락처 컨텍스트에서는 기본 아이콘도 클릭 가능하게 설정
      isClickable = (context === 'contact-simple' || context === 'contact');
    }
    
    // 상태 표시 추가 (메시지 아바타나 간단 모드는 제외)
    const statusIndicator = (context !== 'message' && context !== 'contact-simple' && context !== 'chat-simple' && context !== 'chat-header-simple') ? 
      `<div class="status-indicator ${contact.status}"></div>` : '';
    
    // 클릭 가능한 아바타인 경우 onclick 이벤트 추가
    const clickHandler = isClickable ? `onclick="window.dapp.showProfileView('${contact.id}')"` : '';
    const clickableClass = isClickable ? ' avatar-clickable' : '';
    
    return `<div class="${avatarClass}${clickableClass}" ${clickHandler}>${avatarContent}${statusIndicator}</div>`;
  }

  // P2P 리스트로 돌아가기
  backToP2PList() {
    // 채팅 화면 숨기기
    const chatScreen = document.getElementById('chatScreen');
    if (chatScreen) {
      chatScreen.classList.remove('active');
    }
    
    // 현재 채팅 정보 초기화
    this.currentChatContact = null;
    this.currentChatId = null;
    
    // 마지막에 활성화된 탭으로 돌아가기
    const activeTab = document.querySelector('.p2p-nav-tab.active');
    if (activeTab) {
      const tabType = activeTab.dataset.tab;
      // 탭 전환 시스템을 사용하여 올바른 화면과 데이터 로드
      this.switchP2PTab(tabType);
    } else {
      // 기본적으로 연락처 탭으로
      this.switchP2PTab('contacts');
    }
    
    // 모바일 헤더 업데이트
    const currentTabType = activeTab ? activeTab.dataset.tab : 'contacts';
    this.updateMobileP2PHeader(currentTabType);
  }

  // 채팅 메시지 영역을 맨 아래로 스크롤
  scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // 확실한 스크롤을 위해 여러 번 시도
    const forceScroll = () => {
      chatMessages.scrollTop = chatMessages.scrollHeight + 1000; // 여유분 추가
    };
    
    // 즉시 스크롤
    forceScroll();
    
    // 여러 단계로 스크롤 보장
    setTimeout(forceScroll, 10);
    setTimeout(forceScroll, 50);
    setTimeout(forceScroll, 100);
    setTimeout(forceScroll, 200);
    setTimeout(forceScroll, 500);
    
    // 마지막 메시지로 확실히 스크롤
    setTimeout(() => {
      const lastMessage = chatMessages.lastElementChild;
      if (lastMessage) {
        lastMessage.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end',
          inline: 'nearest'
        });
        // 추가 여유분으로 스크롤
        setTimeout(() => {
          chatMessages.scrollTop = chatMessages.scrollHeight + 1000;
        }, 100);
      }
    }, 300);
  }

  // 메시지 전송
  sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const chatMessages = document.getElementById('chatMessages');
    
    if (!messageInput || !chatMessages) return;
    
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    
    // 현재 시간 구하기
    const now = new Date();
    const timeString = now.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    // 새 메시지 객체 생성
    const newMessage = {
      id: Date.now(),
      sender: 'me',
      text: messageText,
      timestamp: timeString,
      date: new Date().toISOString().split('T')[0],
      read: false,
      readBy: []
    };
    
    // 메시지 저장
    let messages = this.getChatMessages(this.currentChatId) || [];
    messages.push(newMessage);
    this.saveChatMessages(this.currentChatId, messages);
    
    // 읽음 상태 표시
    const readStatus = this.getReadStatus(newMessage, this.currentChatId);
    
    // 새 메시지 HTML 생성
    const messageHtml = `
      <div class="chat-message own">
      <div class="message-bubble">
        <div class="message-text">${messageText}</div>
          <div class="message-meta">
            <span class="message-time">${timeString}</span>
            ${readStatus}
          </div>
        </div>
      </div>
    `;
    
    // 메시지 추가
    chatMessages.insertAdjacentHTML('beforeend', messageHtml);
    
    // 입력창 초기화
    messageInput.value = '';
    
    // 스크롤을 맨 아래로 (강제)
    this.scrollToBottom();
    
    // 기존 하드코딩된 연락처들에 대해서만 자동 응답 (새로 추가된 친구들은 자동 응답 없음)
    const isDefaultContact = ['1', '2', '3', '4', '5', '6', '7', 
                             'chat_1', 'chat_2', 'chat_3', 'chat_4',
                             'chat_group_1', 'chat_group_2', 'chat_group_3'].includes(this.currentChatId);
    
    if (isDefaultContact) {
    // 시뮬레이션: 상대방 자동 응답 (3초 후)
    setTimeout(() => {
      const responses = [
        '네, 알겠습니다!',
        '좋은 아이디어네요.',
        '더 자세히 설명해주세요.',
        '감사합니다!',
        '확인했습니다.',
        '백야 프로토콜 정말 혁신적이네요! 🚀',
        'DAO 참여에 관심이 많아요',
        '언제 한번 만나서 이야기해보면 좋겠어요'
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      const responseTime = new Date().toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      
      // 그룹/공개 채팅인 경우 랜덤한 참여자가 응답
      let responder = this.getContactInfo(this.currentChatId);
      let responderName = responder.name;
      
      if (this.currentChatId.includes('group') || this.currentChatId.includes('public')) {
        // 그룹/공개 채팅 참여자 목록
        const groupMembers = [
          { id: '2', name: '이기여' },
          { id: '3', name: '박검증' },
          { id: '4', name: '최채굴' },
          { id: '5', name: '정토큰' },
          { id: '6', name: '송보안' },
          { id: '7', name: '한합의' }
        ];
        
        const randomMember = groupMembers[Math.floor(Math.random() * groupMembers.length)];
        responder = this.getContactInfo(randomMember.id);
        responderName = randomMember.name;
      }
      
      // 응답 메시지 객체 생성
      const responseMessage = {
        id: Date.now() + 1,
        sender: 'other',
        senderName: responderName,
        senderId: responder.id,
        text: randomResponse,
        timestamp: responseTime,
        date: new Date().toISOString().split('T')[0],
        read: false,
        readBy: []
      };
      
      // 응답 메시지 저장
      messages.push(responseMessage);
      this.saveChatMessages(this.currentChatId, messages);
      
      const responseHtml = `
        <div class="chat-message">
          ${this.generateAvatarHTML(responder, 'message')}
          <div class="message-content">
            <div class="message-sender">${responderName}</div>
      <div class="message-bubble">
              <div class="message-text">${randomResponse}</div>
              <div class="message-time">${responseTime}</div>
            </div>
          </div>
      </div>
    `;
    
      chatMessages.insertAdjacentHTML('beforeend', responseHtml);
      this.scrollToBottom();
      
      // 채팅 목록의 안읽은 메시지 표시 업데이트
      this.updateChatListUnreadCount();
    }, 3000);
    }
  }

  // 채팅방 열기 (채팅 리스트에서)
  openChat(chatId) {
    // 채팅 ID에 해당하는 연락처 정보 가져오기
    this.startChat(chatId);
  }

  formatDateLabel(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 오늘인지 확인
    if (date.toDateString() === today.toDateString()) {
      return '오늘';
    }
    
    // 어제인지 확인
    if (date.toDateString() === yesterday.toDateString()) {
      return '어제';
    }
    
    // 올해인지 확인
    if (date.getFullYear() === today.getFullYear()) {
      return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    }
    
    // 다른 년도
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  }



  isToday(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  confirmCall(contactId) {
    const contact = this.getContactInfo(contactId);
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>전화 걸기</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="call-confirm-content">
            <div class="call-confirm-avatar">
              ${this.generateAvatarHTML(contact, 'contact-simple')}
            </div>
            <div class="call-confirm-info">
              <h4>${contact.name}</h4>
              <p>전화를 거시겠습니까?</p>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
          <button type="button" class="btn-primary" onclick="window.dapp.startCall('${contactId}'); this.closest('.modal').remove();">
            <i class="fas fa-phone"></i> 전화걸기
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  startCall(contactId) {
    console.log(`📞 ${contactId}에게 전화 걸기 시작`);
    
    // 음성 통화 모달 표시
    this.showVoiceCallModal(contactId);
  }

  showVoiceCallModal(contactId) {
    // 연락처 정보 가져오기
    const contact = this.getContactInfo(contactId);
    
    const modal = document.createElement('div');
    modal.className = 'modal active voice-call-modal';
    
    // 아바타 HTML 생성
    const avatarHTML = this.generateAvatarHTML(contact, 'contact');
    
    modal.innerHTML = `
      <div class="modal-content call-modal-content">
        <div class="call-content">
          <div class="call-info">
            <div class="caller-avatar">
              ${avatarHTML}
            </div>
            <div class="caller-name">${contact.name}</div>
            <div class="call-status" id="callStatus">연결 중...</div>
            <div class="call-duration" id="callDuration">00:00</div>
          </div>
          <div class="call-actions">
            <button class="call-btn mute-btn" onclick="window.dapp.toggleMute()" title="음소거">
              <i class="fas fa-microphone"></i>
            </button>
            <button class="call-btn end-btn" onclick="window.dapp.endCall()" title="통화 종료">
              <i class="fas fa-phone-slash"></i>
            </button>
            <button class="call-btn speaker-btn" onclick="window.dapp.toggleSpeaker()" title="스피커">
              <i class="fas fa-volume-up"></i>
            </button>
          </div>
          <div class="call-quality">
            <div class="quality-indicator">
              <span>통화 품질: </span>
              <div class="quality-bars">
                <div class="quality-bar active"></div>
                <div class="quality-bar active"></div>
                <div class="quality-bar active"></div>
                <div class="quality-bar"></div>
              </div>
              <span>좋음</span>
            </div>
            <div class="encryption-status">
              <i class="fas fa-shield-alt"></i>
              <span>엔드투엔드 암호화</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.currentCallModal = modal;
    
    // 통화 시뮬레이션
    setTimeout(() => {
      const callStatus = document.getElementById('callStatus');
      if (callStatus) {
        callStatus.textContent = '통화 중...';
        this.startCallTimer();
      }
    }, 2000);
  }

  startCallTimer() {
    let seconds = 0;
    const callDuration = document.getElementById('callDuration');
    
    this.callTimer = setInterval(() => {
      seconds++;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      if (callDuration) {
        callDuration.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  endCall() {
    // 통화 시간 정보 가져오기
    const callDurationElement = document.getElementById('callDuration');
    const callDuration = callDurationElement ? callDurationElement.textContent : '00:00';
    
    // 통화 타이머 정지
    if (this.callTimer) {
      clearInterval(this.callTimer);
      this.callTimer = null;
    }
    
    // 모달 제거
    if (this.currentCallModal) {
      this.currentCallModal.remove();
      this.currentCallModal = null;
    }
    
    // 통화 기록을 채팅방에 추가
    this.addCallRecordToChat('voice', callDuration);
    
    this.showSuccessMessage('통화가 종료되었습니다.');
  }

  toggleMute() {
    const muteBtn = document.querySelector('.mute-btn i');
    if (muteBtn.classList.contains('fa-microphone')) {
      muteBtn.className = 'fas fa-microphone-slash';
    } else {
      muteBtn.className = 'fas fa-microphone';
    }
  }

  toggleSpeaker() {
    const speakerBtn = document.querySelector('.speaker-btn i');
    if (speakerBtn.classList.contains('fa-volume-up')) {
      speakerBtn.className = 'fas fa-volume-mute';
    } else {
      speakerBtn.className = 'fas fa-volume-up';
    }
  }

  showCreateGroupChat() {
    // 로그인 체크
    if (!this.isAuthenticated) {
      this.showErrorMessage('로그인이 필요합니다. 로그인을 완료해주세요.');
      // 지갑 탭으로 이동
      document.querySelector('.tab-btn[data-tab="wallet"]').click();
      return;
    }
    
    this.showCreateGroupModal();
  }

  showCreateGroupModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-users"></i> 단톡방 만들기</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createGroupForm">
            <div class="form-group">
              <label for="groupName">단톡방 이름</label>
              <input type="text" id="groupName" placeholder="단톡방 이름을 입력하세요" required>
            </div>
            
            <div class="form-group">
              <label for="groupDescription">설명 (선택사항)</label>
              <textarea id="groupDescription" rows="3" placeholder="단톡방에 대한 간단한 설명을 입력하세요"></textarea>
            </div>
            
            <div class="form-group">
              <label>참여할 연락처 선택</label>
              <div class="contact-selection" id="groupContactSelection">
                <!-- 실제 연락처가 동적으로 로드됩니다 -->
              </div>
            </div>
            
            <div class="group-settings">
              <h4><i class="fas fa-cog"></i> 단톡방 설정</h4>
              <label class="checkbox-wrapper">
                <input type="checkbox" id="allowInvites" checked>
                <span class="checkmark"></span>
                구성원이 다른 사람 초대 허용
              </label>
              <label class="checkbox-wrapper">
                <input type="checkbox" id="adminApproval">
                <span class="checkmark"></span>
                관리자 승인 후 입장
              </label>
            </div>
            
            <div class="modal-actions">
              <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
              <button type="submit" class="btn-primary">단톡방 만들기</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 실제 연락처 목록 로드
    const contactSelection = document.getElementById('groupContactSelection');
    if (contactSelection) {
      const contacts = this.getContactsList();
      
      if (contacts.length === 0) {
        contactSelection.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-user-friends"></i>
            <p>아직 연락처가 없습니다</p>
            <small>먼저 친구를 추가해주세요</small>
          </div>
        `;
      } else {
        contactSelection.innerHTML = contacts.map((contact, index) => `
          <div class="contact-item">
            <input type="checkbox" id="contact-${index}" value="${contact.id}">
            <label for="contact-${index}">
              <div class="contact-avatar">${contact.name.charAt(0)}</div>
              <div class="contact-info">
                <span class="contact-name">${contact.name}</span>
                <span class="contact-address">${contact.address}</span>
              </div>
            </label>
          </div>
        `).join('');
      }
    }

    // 폼 이벤트 처리
    const form = modal.querySelector('#createGroupForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const selectedContacts = [];
      const checkboxes = form.querySelectorAll('input[type="checkbox"]:checked');
      checkboxes.forEach(checkbox => {
        if (checkbox.value) {
          selectedContacts.push(checkbox.value);
        }
      });
      
      const data = {
        name: form.querySelector('#groupName').value,
        description: form.querySelector('#groupDescription').value,
        members: selectedContacts,
        allowInvites: form.querySelector('#allowInvites').checked,
        adminApproval: form.querySelector('#adminApproval').checked
      };
      
      this.createGroupChat(data);
      modal.remove();
    });
  }

  createGroupChat(data) {
    // 시뮬레이션 처리
    this.showSuccessMessage(`"${data.name}" 단톡방이 성공적으로 생성되었습니다! ${data.members.length}명이 초대되었습니다.`);
    
    // 채팅 목록 새로고침
    this.loadChats();
  }

  switchToP2P() {
    // P2P 탭으로 전환
    const p2pTab = document.querySelector('[data-tab="p2p"]');
    if (p2pTab) {
      p2pTab.click();
    }
  }

  // QR 코드 관련 메서드들
  updateAddressDisplay() {
    if (!this.isAuthenticated || !this.currentUser) return;

    const didAddress = document.getElementById('myDIDAddress');
    const commAddress = document.getElementById('myCommAddress');



    if (commAddress && this.currentUser.communicationAddress) {
      commAddress.textContent = this.currentUser.communicationAddress;
    }

    // QR 코드 생성
    this.generateQRCode();
  }

  generateQRCode() {
    const canvas = document.getElementById('qrCanvas');
    if (!canvas || !this.currentUser) return;

    const ctx = canvas.getContext('2d');
    // 통신주소만 표시
    const address = this.currentUser.communicationAddress;
    
    if (!address) {
      // 통신주소가 없는 경우 안내 메시지 표시
    ctx.clearRect(0, 0, 150, 150);
      ctx.fillStyle = '#999';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('통신주소를', 75, 70);
      ctx.fillText('설정해주세요', 75, 85);
      return;
    }

    // QRCode.js 라이브러리 사용
    try {
      // 기존 QR 코드 제거
      canvas.style.display = 'none';
      const qrContainer = canvas.parentElement;
      
      // 기존 QR 코드 요소가 있으면 제거
      const existingQR = qrContainer.querySelector('.qr-code-generated');
      if (existingQR) {
        existingQR.remove();
      }
      
      // 새 QR 코드 생성을 위한 div
      const qrDiv = document.createElement('div');
      qrDiv.className = 'qr-code-generated';
      qrDiv.style.width = '150px';
      qrDiv.style.height = '150px';
      qrContainer.appendChild(qrDiv);
      
      // QRCode 생성
      new QRCode(qrDiv, {
        text: address,
        width: 150,
        height: 150,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    } catch (error) {
      // QRCode 라이브러리가 없는 경우 폴백
      console.warn('QRCode 라이브러리를 찾을 수 없습니다. 간단한 표시로 대체합니다.');
      ctx.clearRect(0, 0, 150, 150);
      ctx.fillStyle = '#000';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(address, 75, 75);
    }
  }

  drawCornerMarker(ctx, x, y, moduleSize) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, 7 * moduleSize, 7 * moduleSize);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + moduleSize, y + moduleSize, 5 * moduleSize, 5 * moduleSize);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 2 * moduleSize, y + 2 * moduleSize, 3 * moduleSize, 3 * moduleSize);
  }

  toggleQRType() {
    // 통신주소만 표시하도록 변경
    this.qrType = 'comm';
    const label = document.getElementById('qrTypeLabel');
    if (label) {
      label.textContent = '통신 주소';
    }
    this.generateQRCode();
  }

  copyAddress(type) {
    if (!this.currentUser) return;

    const address = type === 'did' ? this.currentUser.did : this.currentUser.communicationAddress;
    if (!address) return;

    navigator.clipboard.writeText(address).then(() => {
      this.showSuccessMessage(`${type === 'did' ? 'DID' : '통신'} 주소가 복사되었습니다`);
    }).catch(() => {
      // 폴백: 텍스트 선택
      const textArea = document.createElement('textarea');
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      this.showSuccessMessage(`${type === 'did' ? 'DID' : '통신'} 주소가 복사되었습니다`);
    });
  }

  downloadQR() {
    const canvas = document.getElementById('qrCanvas');
    const qrContainer = canvas ? canvas.parentElement : null;

    // QRCode.js로 생성된 canvas 찾기
    const qrGenerated = qrContainer ? qrContainer.querySelector('.qr-code-generated canvas') : null;
    
    if (qrGenerated) {
      // QRCode.js로 생성된 canvas 다운로드
    const link = document.createElement('a');
      link.download = `baekya-communication-address-qr.png`;
      link.href = qrGenerated.toDataURL('image/png');
    link.click();
      this.showSuccessMessage('QR 코드가 다운로드되었습니다.');
    } else if (qrContainer) {
      // QRCode.js로 생성된 img 태그 찾기 (일부 버전에서는 img로 생성됨)
      const qrImg = qrContainer.querySelector('.qr-code-generated img');
      if (qrImg) {
        // img를 canvas로 변환하여 다운로드
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 150;
        tempCanvas.height = 150;
        const ctx = tempCanvas.getContext('2d');
        
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 150, 150);
          const link = document.createElement('a');
          link.download = `baekya-communication-address-qr.png`;
          link.href = tempCanvas.toDataURL('image/png');
          link.click();
          this.showSuccessMessage('QR 코드가 다운로드되었습니다.');
        };
        img.src = qrImg.src;
      } else if (canvas && canvas.style.display !== 'none') {
        // 폴백: 원래 canvas로 그려진 경우
        const link = document.createElement('a');
        link.download = `baekya-communication-address-qr.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        this.showSuccessMessage('QR 코드가 다운로드되었습니다.');
      } else {
        this.showErrorMessage('다운로드할 QR 코드가 없습니다.');
      }
    } else {
      this.showErrorMessage('QR 코드를 찾을 수 없습니다.');
    }
  }

  async scanQRCode() {
    const input = document.getElementById('recipientAddress');
    if (!input) return;

    try {
      // 카메라 권한 확인
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      // QR 스캔 모달 생성
      const modal = document.createElement('div');
      modal.className = 'qr-scan-modal';
      modal.innerHTML = `
        <div class="qr-scan-container">
          <div class="qr-scan-header">
            <h3>QR 코드 스캔</h3>
            <button class="qr-scan-close" onclick="window.dapp.closeScanModal()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <video id="qrVideo" autoplay playsinline></video>
          <canvas id="qrCanvas" style="display: none;"></canvas>
          <div class="qr-scan-overlay"></div>
          <p class="qr-scan-hint">QR 코드를 카메라에 비춰주세요</p>
          <p class="qr-scan-note">5초 후 수동 입력 옵션이 나타납니다</p>
        </div>
      `;
      document.body.appendChild(modal);
      
      const video = document.getElementById('qrVideo');
      const canvas = document.getElementById('qrCanvas');
      const ctx = canvas.getContext('2d');
      
      video.srcObject = stream;
      
      let isScanning = true;
      let scanTimeout;
      
      // 5초 후 수동 입력 버튼 표시
      scanTimeout = setTimeout(() => {
        if (isScanning) {
          const manualBtn = document.createElement('button');
          manualBtn.className = 'qr-manual-input-btn';
          manualBtn.innerHTML = '<i class="fas fa-keyboard"></i> 수동 입력';
          manualBtn.onclick = () => this.showManualInput(input, stream, modal);
          
          const container = document.querySelector('.qr-scan-container');
          container.appendChild(manualBtn);
        }
      }, 5000);
      
      // 비디오가 로드되면 QR 스캔 시작
      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // QR 코드 스캔 루프
        const scanLoop = () => {
          if (!isScanning) return;
          
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // 비디오 프레임을 캔버스에 그리기
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // 캔버스에서 이미지 데이터 가져오기
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // jsQR로 QR 코드 디코딩
            if (typeof jsQR !== 'undefined') {
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              
              if (code) {
                // QR 코드 인식 성공!
                isScanning = false;
                clearTimeout(scanTimeout);
                
                console.log('QR 코드 인식됨:', code.data);
                
                // 통신주소 형식 확인 (010-XXXX-XXXX)
                const commAddressRegex = /^010-\d{4}-\d{4}$/;
                if (commAddressRegex.test(code.data)) {
                  input.value = code.data;
                  this.showSuccessMessage('QR 코드를 성공적으로 인식했습니다!');
                } else {
                  // 다른 형식의 QR 코드인 경우
                  input.value = code.data;
                  this.showInfoMessage('QR 코드를 인식했습니다. 내용을 확인해주세요.');
                }
                
                // 카메라 정지 및 모달 닫기
                stream.getTracks().forEach(track => track.stop());
                modal.remove();
                return;
              }
            } else {
              console.warn('jsQR 라이브러리가 로드되지 않았습니다.');
            }
          }
          
          // 다음 프레임에서 다시 시도
          requestAnimationFrame(scanLoop);
        };
        
        // 스캔 시작
        scanLoop();
      });
      
      // 스캔 모달 닫기 함수
      window.dapp.closeScanModal = () => {
        isScanning = false;
        clearTimeout(scanTimeout);
        stream.getTracks().forEach(track => track.stop());
        modal.remove();
      };
      
    } catch (error) {
      console.error('카메라 접근 실패:', error);
      
      // 대안: 파일 입력으로 QR 이미지 업로드
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          this.processQRImageFile(file, input);
        }
      };
      fileInput.click();
    }
  }
  
  // 수동 입력 모달 표시
  showManualInput(input, stream, modal) {
    const manualInput = prompt('QR 코드를 인식할 수 없습니다. 통신주소를 직접 입력하세요 (010-XXXX-XXXX):');
    if (manualInput && /^010-\d{4}-\d{4}$/.test(manualInput)) {
      input.value = manualInput;
      this.showSuccessMessage('통신주소가 입력되었습니다');
    } else if (manualInput) {
      this.showErrorMessage('올바른 통신주소 형식이 아닙니다 (010-XXXX-XXXX)');
    }
    
    // 카메라 정지 및 모달 닫기
    stream.getTracks().forEach(track => track.stop());
    modal.remove();
  }
  
  // QR 이미지 파일 처리
  processQRImageFile(file, input) {
    this.showInfoMessage('QR 코드 이미지 처리 중...');
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      // 이미지 데이터 가져오기
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // jsQR로 QR 코드 디코딩
      if (typeof jsQR !== 'undefined') {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          console.log('QR 코드 인식됨:', code.data);
          
          // 통신주소 형식 확인
          const commAddressRegex = /^010-\d{4}-\d{4}$/;
          if (commAddressRegex.test(code.data)) {
            input.value = code.data;
            this.showSuccessMessage('QR 코드를 성공적으로 인식했습니다!');
          } else {
            input.value = code.data;
            this.showInfoMessage('QR 코드를 인식했습니다. 내용을 확인해주세요.');
          }
        } else {
          this.showErrorMessage('QR 코드를 인식할 수 없습니다. 수동으로 입력해주세요.');
          
          // 수동 입력 폴백
          setTimeout(() => {
            const manualInput = prompt('통신주소를 직접 입력하세요 (010-XXXX-XXXX):');
            if (manualInput && /^010-\d{4}-\d{4}$/.test(manualInput)) {
              input.value = manualInput;
              this.showSuccessMessage('통신주소가 입력되었습니다');
            } else if (manualInput) {
              this.showErrorMessage('올바른 통신주소 형식이 아닙니다 (010-XXXX-XXXX)');
            }
          }, 1000);
        }
      } else {
        this.showErrorMessage('QR 코드 라이브러리가 로드되지 않았습니다.');
      }
    };
    
    img.onerror = () => {
      this.showErrorMessage('이미지를 로드할 수 없습니다.');
    };
    
    // 파일을 이미지로 로드
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // 통신주소 설정 표시
  showCommAddressSetup() {
    const setupArea = document.getElementById('commAddressSetupArea');
    const setupBtn = document.getElementById('setupCommAddressBtn');
    
    if (setupArea && setupBtn) {
      setupArea.style.display = 'block';
      setupBtn.innerHTML = '<i class="fas fa-check"></i> 통신주소 확인 및 설정';
      
      // 입력 필드에 이벤트 리스너 추가
      const middleInput = document.getElementById('commAddressMiddle');
      const lastInput = document.getElementById('commAddressLast');
      
      if (middleInput && !middleInput.hasAttribute('data-setup')) {
        middleInput.setAttribute('data-setup', 'true');
        middleInput.addEventListener('input', (e) => {
          // 숫자만 입력 가능
          e.target.value = e.target.value.replace(/[^0-9]/g, '');
          if (e.target.value.length === 4) {
            lastInput.focus();
          }
        });
      }
      
      if (lastInput && !lastInput.hasAttribute('data-setup')) {
        lastInput.setAttribute('data-setup', 'true');
        lastInput.addEventListener('input', (e) => {
          // 숫자만 입력 가능
          e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
      }
      
      // 버튼 클릭 이벤트 변경
      setupBtn.onclick = () => this.confirmCommAddress();
    }
  }

  // 통신주소 확인 및 설정
  async confirmCommAddress() {
    const middleInput = document.getElementById('commAddressMiddle');
    const lastInput = document.getElementById('commAddressLast');
    
    if (!middleInput || !lastInput) return;
    
    const middle = middleInput.value;
    const last = lastInput.value;
    
    if (middle.length !== 4 || last.length !== 4) {
      alert('통신주소는 각각 4자리 숫자여야 합니다.');
      return;
    }
    
    const newCommAddress = `010-${middle}-${last}`;
    
    // 중복 확인 (시뮬레이션)
    const isDuplicate = await this.checkCommAddressDuplicate(newCommAddress);
    
    if (isDuplicate) {
      alert('이미 사용 중인 통신주소입니다. 다른 번호를 선택해주세요.');
      return;
    }
    
    // 통신주소 설정
    this.currentUser.communicationAddress = newCommAddress;
    this.userCommunicationAddress = newCommAddress;
    
    // 로컬 스토리지 업데이트
    localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
    
    // 사용자 목록도 업데이트
    const users = JSON.parse(localStorage.getItem('baekya_users') || '[]');
    const userIndex = users.findIndex(u => u.deviceId === this.currentUser.deviceId);
    if (userIndex !== -1) {
      users[userIndex].communicationAddress = newCommAddress;
      localStorage.setItem('baekya_users', JSON.stringify(users));
    }
    
    // UI 업데이트
    const currentCommAddressEl = document.getElementById('currentCommAddress');
    if (currentCommAddressEl) {
      currentCommAddressEl.textContent = newCommAddress;
    }
    
    // 설정 영역 숨기기
    const setupArea = document.getElementById('commAddressSetupArea');
    const setupBtn = document.getElementById('setupCommAddressBtn');
    if (setupArea) setupArea.style.display = 'none';
    if (setupBtn) setupBtn.style.display = 'none';
    
    // 변경 상태 표시
    const changeStatus = document.getElementById('commAddressChangeStatus');
    if (changeStatus) {
      changeStatus.style.display = 'block';
    }
    
    this.showSuccessMessage('통신주소가 설정되었습니다!');
    
    // 주소 표시 업데이트
    this.updateAddressDisplay();
  }

  // 통신주소 중복 확인
  async checkCommAddressDuplicate(address) {
    // 로컬 스토리지에서 모든 사용자의 통신주소 확인
    const users = JSON.parse(localStorage.getItem('baekya_users') || '[]');
    return users.some(user => 
      user.communicationAddress === address && 
      user.deviceId !== this.currentUser.deviceId
    );
  }

  // 프로필 설정 관련 메서드들
  openProfileSettingsModal() {
    // 로그인 확인
    if (!this.isAuthenticated || !this.currentUser) {
      this.showErrorMessage('로그인 후 이용 가능합니다.');
      return;
    }
    
    const modal = document.getElementById('profileSettingsModal');
    const photoPreview = document.getElementById('photoPreview');
    const statusInput = document.getElementById('statusMessageInput');
    const charCount = document.getElementById('statusCharCount');
    
    // 현재 프로필 사진 로드
    this.loadCurrentPhoto(photoPreview);
    
    // 현재 상태메시지 로드
    const currentStatus = this.currentUser?.statusMessage || '';
    statusInput.value = currentStatus;
    charCount.textContent = currentStatus.length;
    
    // 상태메시지 입력 이벤트 리스너 추가
    statusInput.addEventListener('input', function() {
      charCount.textContent = this.value.length;
    });
    
    // 이름 변경 필드 업데이트
    const nameChangeInput = document.getElementById('nameChangeInput');
    const nameChangeStatus = document.getElementById('nameChangeStatus');
    if (nameChangeInput && nameChangeStatus) {
      nameChangeInput.placeholder = `현재: ${this.currentUser?.name || '미설정'}`;
      
      // 이름 입력 필드에 실시간 검증 추가 (IME 고려)
      let isComposing = false;
      
      nameChangeInput.addEventListener('compositionstart', () => {
        isComposing = true;
      });
      
      nameChangeInput.addEventListener('compositionend', () => {
        isComposing = false;
        // composition이 끝난 후 검증
        const value = nameChangeInput.value;
        const filteredValue = value.replace(/[^가-힣a-zA-Z\s]/g, '');
        if (value !== filteredValue) {
          nameChangeInput.value = filteredValue;
        }
      });
      
      nameChangeInput.addEventListener('input', (e) => {
        // IME 입력 중에는 필터링하지 않음
        if (!isComposing) {
        const value = e.target.value;
        // 한글, 영어, 공백만 허용
        const filteredValue = value.replace(/[^가-힣a-zA-Z\s]/g, '');
        if (value !== filteredValue) {
          e.target.value = filteredValue;
          }
        }
      });
      
      if (this.canChangeName()) {
        nameChangeStatus.innerHTML = '<span class="status-available">✓ 변경 가능 <small>(3개월에 한 번 가능)</small></span><br><small style="color: var(--text-secondary);">※ 한글/영문만 입력 가능합니다.</small>';
        nameChangeInput.disabled = false;
      } else {
        const daysLeft = this.getDaysUntilNameChange();
        nameChangeStatus.innerHTML = `<span class="status-unavailable">✗ ${daysLeft}일 후에 변경 가능 <small>(3개월에 한 번 가능)</small></span><br><small style="color: var(--text-secondary);">※ 한글/영문만 입력 가능합니다.</small>`;
        nameChangeInput.disabled = true;
      }
    }
    
    modal.classList.add('active');
  }

  closeProfileSettingsModal() {
    const modal = document.getElementById('profileSettingsModal');
    modal.classList.remove('active');
    
    // 선택된 사진 초기화
    this.selectedPhoto = null;
    const photoInput = document.getElementById('photoInput');
    if (photoInput) photoInput.value = '';
  }

  setStatusPreset(message) {
    const statusInput = document.getElementById('statusMessageInput');
    const charCount = document.getElementById('statusCharCount');
    
    statusInput.value = message;
    charCount.textContent = message.length;
  }

  saveProfileSettings() {
    try {
      if (!this.currentUser) {
        this.showErrorMessage('로그인이 필요합니다.');
        return;
      }

      const statusInput = document.getElementById('statusMessageInput');
      const newStatus = statusInput.value.trim();
      
      // 이름 변경 처리
      const nameInput = document.getElementById('nameChangeInput');
      if (nameInput && nameInput.value.trim()) {
        const newName = nameInput.value.trim();
        
        // 한글과 영어만 허용 (공백 포함)
        const nameRegex = /^[가-힣a-zA-Z\s]+$/;
        if (!nameRegex.test(newName)) {
          this.showErrorMessage('이름은 한글과 영어만 입력 가능합니다.');
          return;
        }
        
        if (this.canChangeName()) {
          this.currentUser.name = newName;
          this.currentUser.nameChangeHistory = this.currentUser.nameChangeHistory || [];
          this.currentUser.nameChangeHistory.push({
            previousName: this.currentUser.name,
            newName: newName,
            changedAt: Date.now()
          });
        } else {
          const daysLeft = this.getDaysUntilNameChange();
          this.showErrorMessage(`이름은 3개월에 한 번만 변경 가능합니다. ${daysLeft}일 후에 변경 가능합니다.`);
          return;
        }
      }

      // 프로필 사진 데이터 업데이트
      if (this.selectedPhoto === 'reset') {
        this.currentUser.profilePhoto = null;
      } else if (this.selectedPhoto) {
        this.currentUser.profilePhoto = this.selectedPhoto;
      }

      // 상태메시지 업데이트
      this.currentUser.statusMessage = newStatus;

      // 로컬 스토리지에 저장
      localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));

      // UI 업데이트
      this.updateProfilePhotoInUI();
      this.updateStatusMessageInUI();
      this.updateUserProfile();

      // P2P 연락처 목록 새로고침 (상태메시지 반영)
      this.loadContacts();

      // 성공 메시지
      this.showSuccessMessage('프로필이 업데이트되었습니다.');

      // 모달 닫기
      this.closeProfileSettingsModal();

    } catch (error) {
      console.error('프로필 설정 저장 실패:', error);
      this.showErrorMessage('프로필 설정 저장에 실패했습니다.');
    }
  }

  updateStatusMessageInUI() {
    const statusElement = document.getElementById('userStatusMessage');
    if (statusElement) {
      const status = this.currentUser?.statusMessage || '';
      if (status) {
        statusElement.textContent = status;
        statusElement.style.color = 'var(--text-primary)';
        statusElement.style.fontStyle = 'normal';
      } else {
        statusElement.textContent = '';
        statusElement.style.color = 'var(--text-secondary)';
        statusElement.style.fontStyle = 'italic';
      }
    }
  }

  // 이름 변경 가능 여부 확인 (3개월에 한 번)
  canChangeName() {
    if (!this.currentUser || !this.currentUser.nameChangeHistory) {
      return true;
    }
    
    const lastChange = this.currentUser.nameChangeHistory[this.currentUser.nameChangeHistory.length - 1];
    if (!lastChange) {
      return true;
    }
    
    const threeMonthsAgo = Date.now() - (3 * 30 * 24 * 60 * 60 * 1000); // 3개월
    return lastChange.changedAt < threeMonthsAgo;
  }

  // 통신주소 변경 가능 여부 확인 (3개월에 한 번)
  canChangeCommunicationAddress() {
    if (!this.currentUser || !this.currentUser.communicationAddressSetAt) {
      return true;
    }
    
    const threeMonthsAgo = Date.now() - (3 * 30 * 24 * 60 * 60 * 1000); // 3개월
    return this.currentUser.communicationAddressSetAt < threeMonthsAgo;
  }
  
  // 통신주소 변경까지 남은 일수 계산
  getDaysUntilCommunicationAddressChange() {
    if (!this.currentUser || !this.currentUser.communicationAddressSetAt) {
      return 0;
    }
    
    const nextChangeDate = new Date(this.currentUser.communicationAddressSetAt + (3 * 30 * 24 * 60 * 60 * 1000));
    const today = new Date();
    const timeDiff = nextChangeDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return Math.max(0, daysDiff);
  }
  
  // 다음 변경 가능 날짜 계산
  getNextNameChangeDate() {
    if (!this.currentUser || !this.currentUser.nameChangeHistory || this.currentUser.nameChangeHistory.length === 0) {
      return null;
    }
    
    const lastChange = this.currentUser.nameChangeHistory[this.currentUser.nameChangeHistory.length - 1];
    const nextChangeDate = new Date(lastChange.changedAt + (3 * 30 * 24 * 60 * 60 * 1000));
    return nextChangeDate;
  }

  // 이름 변경까지 남은 일수 계산
  getDaysUntilNameChange() {
    const nextChangeDate = this.getNextNameChangeDate();
    if (!nextChangeDate) {
      return 0;
    }
    
    const today = new Date();
    const timeDiff = nextChangeDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return Math.max(0, daysDiff);
  }

  // 지문 재등록
  async reRegisterBiometric() {
    const confirmed = confirm('지문을 재등록하시겠습니까?\n기존 지문과 비밀번호를 먼저 확인합니다.');
    if (!confirmed) return;

    try {
      // 1. 기존 지문 인증
      const fingerprintVerified = await this.verifyCurrentFingerprint();
      if (!fingerprintVerified) {
        this.showErrorMessage('기존 지문 인증에 실패했습니다.');
        return;
      }

      // 2. 기존 비밀번호 확인
      const password = prompt('기존 비밀번호를 입력하세요:');
      if (!password) return;

      // 현재 사용자 데이터로 비밀번호 확인
      const userData = this.currentUser || JSON.parse(localStorage.getItem('baekya_auth') || '{}');
      const passwordVerified = this.verifyPassword(password, userData);
      if (!passwordVerified) {
        this.showErrorMessage('비밀번호가 일치하지 않습니다.');
        return;
      }

      // 3. 새로운 지문 등록 안내
      this.showSuccessMessage('이제 새로운 지문을 등록하세요.');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 4. 새로운 지문 등록
      let attempts = 0;
      const maxAttempts = 3;
      let newFingerprintRegistered = false;
      
      // 임시로 지문 검증 비활성화 (새 지문 등록 모드)
      this.isRegisteringNewFingerprint = true;
      
      while (attempts < maxAttempts && !newFingerprintRegistered) {
        try {
          // 새 지문 등록을 위한 생체인증 (검증 없이)
          await this.performBiometricAuthForRegistration('fingerprint');
          const newFingerprint = this.generateBiometricHash('fingerprint');
          
          // 5. 사용자 데이터 업데이트
          this.biometricData.fingerprint = newFingerprint;
          this.currentUser.fingerprintHash = newFingerprint;
          this.currentUser.lastBiometricUpdate = Date.now();
          
          // baekya_auth에 저장
          localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
          
          // baekya_users에도 업데이트
          const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
          const deviceId = this.getDeviceId();
          const userIndex = storedUsers.findIndex(user => user.deviceId === deviceId);
          
          if (userIndex !== -1) {
            storedUsers[userIndex].fingerprintHash = newFingerprint;
            storedUsers[userIndex].lastBiometricUpdate = Date.now();
            localStorage.setItem('baekya_users', JSON.stringify(storedUsers));
          }
          
          newFingerprintRegistered = true;
          this.showSuccessMessage('지문이 성공적으로 재등록되었습니다.');
        } catch (error) {
          attempts++;
          console.error(`❌ 새 지문 등록 실패 (${attempts}/${maxAttempts}):`, error);
          
          if (attempts < maxAttempts) {
            this.showErrorMessage(`인식되지 않았습니다. 다시 시도해주세요. (${attempts}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // 지문 등록 모드 해제
      this.isRegisteringNewFingerprint = false;
      
      if (!newFingerprintRegistered) {
        this.showErrorMessage('지문 재등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('지문 재등록 실패:', error);
      this.showErrorMessage('지문 재등록에 실패했습니다.');
    }
  }

  // 비밀번호 재설정
  async resetPassword() {
    const confirmed = confirm('비밀번호를 재설정하시겠습니까?');
    if (!confirmed) return;

    try {
      // 1. 기존 비밀번호 확인
      const oldPassword = prompt('기존 비밀번호를 입력하세요:');
      if (!oldPassword) return;

      // 현재 사용자 데이터로 비밀번호 확인
      const userData = this.currentUser || JSON.parse(localStorage.getItem('baekya_auth') || '{}');
      
      // passwordHash가 없으면 baekya_users에서 가져오기
      if (!userData.passwordHash) {
        const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
        const deviceId = this.getDeviceId();
        const userFromUsers = storedUsers.find(user => user.deviceId === deviceId);
        if (userFromUsers && userFromUsers.passwordHash) {
          userData.passwordHash = userFromUsers.passwordHash;
        }
      }
      
      console.log('🔐 비밀번호 재설정 - 현재 사용자 데이터:', userData);
      console.log('🔐 비밀번호 재설정 - 입력된 비번:', oldPassword);
      const passwordVerified = this.verifyPassword(oldPassword, userData);
      if (!passwordVerified) {
        console.error('❌ 비밀번호 검증 실패');
        this.showErrorMessage('비밀번호가 일치하지 않습니다.');
        return;
      }

      // 2. 새 비밀번호 입력
      const newPassword = prompt('새 비밀번호를 입력하세요 (최소 8자):');
      if (!newPassword) return;
      
      if (newPassword.length < 8) {
        this.showErrorMessage('비밀번호는 최소 8자 이상이어야 합니다.');
        return;
      }

      const confirmPassword = prompt('새 비밀번호를 다시 입력하세요:');
      if (newPassword !== confirmPassword) {
        this.showErrorMessage('비밀번호가 일치하지 않습니다.');
        return;
      }

      // 3. 비밀번호 업데이트
      const newPasswordHash = this.hashPassword(newPassword);
      this.biometricData.password = newPasswordHash;
      this.currentUser.passwordHash = newPasswordHash;
      this.currentUser.lastPasswordUpdate = Date.now();
      
      // baekya_auth에 저장
      localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
      
      // baekya_users에도 업데이트
      const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
      const deviceId = this.getDeviceId();
      const userIndex = storedUsers.findIndex(user => user.deviceId === deviceId);
      
      if (userIndex !== -1) {
        storedUsers[userIndex].passwordHash = newPasswordHash;
        storedUsers[userIndex].lastPasswordUpdate = Date.now();
        localStorage.setItem('baekya_users', JSON.stringify(storedUsers));
      }
      
      this.showSuccessMessage('비밀번호가 성공적으로 재설정되었습니다.');
    } catch (error) {
      console.error('비밀번호 재설정 실패:', error);
      this.showErrorMessage('비밀번호 재설정에 실패했습니다.');
    }
  }

  // 로그아웃 확인
  confirmLogout() {
    const confirmed = confirm('정말 로그아웃하시겠습니까?\n모든 세션이 종료됩니다.');
    if (confirmed) {
      this.logout();
    }
  }
  
  // 계정 탈퇴
  async deleteAccount() {
    if (!this.isAuthenticated || !this.currentUser) {
      this.showErrorMessage('로그인이 필요합니다.');
      return;
    }
    
    // 탈퇴 확인
    const firstConfirm = confirm('정말로 계정을 탈퇴하시겠습니까?\n모든 데이터가 삭제되며 복구할 수 없습니다.');
    if (!firstConfirm) return;
    
    // 2차 확인
    const secondConfirm = confirm('정말로 탈퇴하시겠습니까?\n탈퇴 후에도 언제든지 새로운 계정을 생성할 수 있습니다.');
    if (!secondConfirm) return;
    
    // 비밀번호 확인
    const password = prompt('보안을 위해 비밀번호를 입력해주세요:');
    if (!password) return;
    
    // 비밀번호 검증
    const isPasswordCorrect = this.verifyPassword(password, this.currentUser);
    if (!isPasswordCorrect) {
      this.showErrorMessage('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    try {
      // 기기 ID 가져오기
      const deviceId = this.getDeviceId();
      
      // 탈퇴 기록 저장 없음 - 바로 재가입 가능
      
      // baekya_users에서 현재 사용자 제거
      const storedUsers = JSON.parse(localStorage.getItem('baekya_users') || '[]');
      const updatedUsers = storedUsers.filter(user => user.deviceId !== deviceId);
      localStorage.setItem('baekya_users', JSON.stringify(updatedUsers));
      
      // 사용자별 데이터 삭제
      if (this.currentUser.did) {
        localStorage.removeItem(`baekya_contributions_${this.currentUser.did}`);
      }
      
      // 현재 세션 데이터 삭제
      localStorage.removeItem('baekya_auth');
      localStorage.removeItem('currentBalance');
      localStorage.removeItem('lastMiningTime');
      localStorage.removeItem('miningHistory');
      
      // 세션 초기화
      this.currentUser = null;
      this.isAuthenticated = false;
      this.authData = {
        userId: null,
        password: null,
        did: null,
        communicationAddress: null,
        deviceId: null,
        createdAt: null,
        hasSetCommunicationAddress: false
      };
      
      // 프로필 설정 모달 닫기
      this.closeProfileSettingsModal();
      
      // UI 초기화
      this.updateUserInterface();
      
      // 대시보드로 이동
      const dashboardTab = document.querySelector('[data-tab="dashboard"]');
      if (dashboardTab) dashboardTab.click();
      
      this.showSuccessMessage('계정이 성공적으로 탈퇴되었습니다.');
      
      // 앱 재시작
      setTimeout(() => {
        location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('계정 탈퇴 실패:', error);
      this.showErrorMessage('계정 탈퇴 중 오류가 발생했습니다.');
    }
  }

  // 로그아웃
  logout() {
    // WebSocket 연결 종료
    this.disconnectWebSocket();
    
    // 로컬 데이터 완전 삭제 (앱 초기화)
    localStorage.removeItem('baekya_auth');
    localStorage.removeItem('currentBalance');
    localStorage.removeItem('lastMiningTime');
    localStorage.removeItem('miningHistory');
    
    // 세션 초기화
    this.currentUser = null;
    this.isAuthenticated = false;
    this.biometricData = {
      fingerprint: null,
      faceprint: null,
      password: null,
      did: null,
      communicationAddress: null
    };
    
    // UI 초기화
    this.updateUserInterface();
    
    // 대시보드로 이동
    const dashboardTab = document.querySelector('[data-tab="dashboard"]');
    if (dashboardTab) dashboardTab.click();
    
    // 프로필 설정 모달 닫기
    this.closeProfileSettingsModal();
    
    this.showSuccessMessage('로그아웃되었습니다.');
    
    // 앱 종료 시뮬레이션 (실제로는 Capacitor API 사용)
    setTimeout(() => {
      location.reload(); // 웹에서는 새로고침으로 대체
    }, 1500);
  }

  // 완전 초기화 (개발자용)
  resetAll() {
    console.log('🔄 백야 프로토콜 완전 초기화 시작...');
    
    // 모든 로컬 저장소 데이터 삭제
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('baekya_')) {
        localStorage.removeItem(key);
        console.log(`🗑️ 삭제: ${key}`);
      }
    });
    
    // 기본 앱 데이터도 삭제
    localStorage.removeItem('currentBalance');
    localStorage.removeItem('lastMiningTime');
    localStorage.removeItem('miningHistory');
    localStorage.removeItem('user_profile');
    localStorage.removeItem('transaction_history');
    localStorage.removeItem('dao_proposals');
    localStorage.removeItem('mining_data');
    localStorage.removeItem('notifications');
    
    // 세션 완전 초기화
    this.currentUser = null;
    this.isAuthenticated = false;
    this.biometricData = {
      fingerprint: null,
      faceprint: null,
      password: null,
      did: null,
      communicationAddress: null
    };
    
    console.log('✅ 완전 초기화 완료! 페이지를 새로고침합니다...');
    
    // 즉시 새로고침
    location.reload();
  }

  // 프로필 상태 업데이트
  updateProfileStatus(status = 'offline') {
    const statusIndicator = document.getElementById('profileStatusIndicator');
    const statusDot = document.getElementById('profileStatusDot');
    const statusText = document.getElementById('profileStatusText');
    
    if (!statusIndicator || !statusDot || !statusText) return;
    
    // 로그인된 경우에만 상태 표시
    if (this.isAuthenticated) {
      statusIndicator.style.display = 'flex';
      
      // 기존 클래스 제거
      statusDot.classList.remove('online', 'offline', 'connecting');
      statusText.classList.remove('online', 'offline', 'connecting');
      
      // 새 상태 적용
      statusDot.classList.add(status);
      statusText.classList.add(status);
      
      // 텍스트 업데이트
      switch(status) {
        case 'online':
          statusText.textContent = '온라인';
          break;
        case 'connecting':
          statusText.textContent = '연결 중';
          break;
        default:
          statusText.textContent = '오프라인';
      }
    } else {
      statusIndicator.style.display = 'none';
    }
  }

  // 기존 지문 인증 확인
  async verifyCurrentFingerprint() {
    try {
      return await this.performBiometricAuth('fingerprint');
    } catch (error) {
      console.error('지문 인증 실패:', error);
      return false;
    }
  }







  // OP 검토 모달 열기
  openOPReviewModal() {
    const modal = document.getElementById('opReviewModal');
    if (modal) {
      modal.classList.add('active');
      // 탭 접근 권한 설정
      this.setupOPReviewTabAccess();
      this.currentOPReviewTab = 'my-dao';
      this.switchOPReviewTab('my-dao');
    }
  }

  // OP 검토 탭 접근 권한 설정
  setupOPReviewTabAccess() {
    const userOPRole = this.getUserOPRole();
    
    // 최종검토 탭 접근 권한 설정
    const finalTab = document.querySelector('.op-review-tab[data-tab="final"]');
    if (finalTab) {
      if (userOPRole.isTopOP && userOPRole.opsDAOMember) {
        finalTab.style.display = 'block';
        finalTab.disabled = false;
        finalTab.style.opacity = '1';
        finalTab.style.pointerEvents = 'auto';
        finalTab.title = '';
      } else {
        finalTab.style.opacity = '0.5';
        finalTab.style.pointerEvents = 'none';
        finalTab.title = 'OpsDAO의 OP만 접근 가능합니다';
      }
    }
    
    // Ops검토 탭은 모든 OP가 접근 가능
    const opsTab = document.querySelector('.op-review-tab[data-tab="ops"]');
    if (opsTab) {
      if (userOPRole.isOP) {
        opsTab.style.display = 'block';
        opsTab.disabled = false;
        opsTab.style.opacity = '1';
        opsTab.style.pointerEvents = 'auto';
        opsTab.title = '';
      } else {
        opsTab.style.opacity = '0.5';
        opsTab.style.pointerEvents = 'none';
        opsTab.title = 'OP 권한이 필요합니다';
      }
    }
  }

  // OP 검토 모달 닫기
  closeOPReviewModal() {
    const modal = document.getElementById('opReviewModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // OP 검토 탭 전환
  switchOPReviewTab(tabType) {
    console.log(`🔄 OP검토 탭 전환: ${tabType}`);
    this.currentOPReviewTab = tabType;
    
    // OP 검토 모달 내의 탭들에서만 active 클래스 제거
    document.querySelectorAll('.op-review-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // 선택된 탭에 active 클래스 추가 (더 구체적인 selector 사용)
    const activeTab = document.querySelector(`.op-review-tab[data-tab="${tabType}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
      console.log(`✅ 탭 활성화 완료: ${tabType}`);
    } else {
      console.error(`❌ 탭을 찾을 수 없음: ${tabType}`);
    }
    
    // 해당 탭의 콘텐츠 로드
    this.loadOPReviewContent(tabType);
  }

  // OP 검토 콘텐츠 로드
  loadOPReviewContent(tabType) {
    console.log(`📄 OP검토 콘텐츠 로드 시작: ${tabType}`);
    const contentArea = document.getElementById('op-review-content');
    if (!contentArea) {
      console.error('❌ op-review-content 요소를 찾을 수 없음');
      return;
    }
    
    const userOPRole = this.getUserOPRole();
    console.log('👤 사용자 OP 권한:', userOPRole);
    
    switch(tabType) {
      case 'my-dao':
        console.log('🏠 내DAO검토 로드');
        this.loadMyDAOReviews();
        break;
      case 'ops':
        console.log('⚡ Ops검토 로드');
        // 모든 OP가 접근 가능
        if (userOPRole.isOP) {
        this.loadOpsReviews();
        } else {
          contentArea.innerHTML = `
            <div class="empty-state">
              <i class="fas fa-lock" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;"></i>
              <p>OP 권한이 필요합니다.</p>
            </div>
          `;
        }
        break;
      case 'final':
        console.log('👑 최종검토 로드 시도');
        // OpsDAO의 OP(최상위 OP)만 접근 가능
        if (userOPRole.isTopOP && userOPRole.opsDAOMember) {
          console.log('✅ 최종검토 권한 확인됨, loadFinalReviews 호출');
          this.loadFinalReviews();
        } else {
          console.log('❌ 최종검토 권한 없음');
          contentArea.innerHTML = `
            <div class="empty-state">
              <i class="fas fa-crown" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;"></i>
              <p>최상위 OP 권한이 필요합니다.</p>
              <small>OpsDAO의 OP만 접근할 수 있습니다.</small>
            </div>
          `;
        }
        break;
    }
  }

  // 내 DAO 검토 콘텐츠 로드
  loadMyDAOReviews() {
    const contentArea = document.getElementById('op-review-content');
    const userOPRole = this.getUserOPRole();
    
    // 사용자가 OP인 DAO들의 통과된 제안들 가져오기
    const reviewProposals = this.getProposalsForOPReview(userOPRole.opDAOs);
    
    if (reviewProposals.length === 0) {
      contentArea.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-gavel" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;"></i>
          <p>현재 OP 검토 대기 중인 제안이 없습니다.</p>
        </div>
      `;
      return;
    }
    
    contentArea.innerHTML = reviewProposals.map(proposal => this.createOPReviewCard(proposal, 'my-dao')).join('');
  }

  // Ops 검토 콘텐츠 로드
  loadOpsReviews() {
    const contentArea = document.getElementById('op-review-content');
    
    // OP 검토를 통과한 제안들 (이의신청 기간)
    const objectionProposals = this.getProposalsForObjection();
    
    if (objectionProposals.length === 0) {
      contentArea.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;"></i>
          <p>현재 이의신청 기간 중인 제안이 없습니다.</p>
        </div>
      `;
      return;
    }
    
    contentArea.innerHTML = objectionProposals.map(proposal => this.createOPReviewCard(proposal, 'ops')).join('');
  }

  // 최종 검토 콘텐츠 로드
  loadFinalReviews() {
    console.log('🔥 loadFinalReviews 함수 시작');
    const contentArea = document.getElementById('op-review-content');
    
    // 이의신청 기간을 거친 제안들 (TOP-OP 최종 결정 대기)
    const finalProposals = this.getProposalsForFinalReview();
    console.log('📋 최종검토 제안들:', finalProposals);
    
    if (finalProposals.length === 0) {
      console.log('📭 최종검토 제안 없음, 빈 상태 표시');
      contentArea.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-crown" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;"></i>
          <p>현재 최종 검토 대기 중인 제안이 없습니다.</p>
        </div>
      `;
      return;
    }
    
    console.log(`✅ 최종검토 제안 ${finalProposals.length}개 렌더링 시작`);
    contentArea.innerHTML = finalProposals.map(proposal => this.createOPReviewCard(proposal, 'final')).join('');
    console.log('🎉 최종검토 콘텐츠 렌더링 완료');
  }

  // OP 검토 대상 제안들 가져오기
  getProposalsForOPReview(opDAOs) {
    // 실제 제안들을 블록체인/서버에서 가져와야 함
    const result = [];
    
    // 각 DAO에서 dao-review 상태인 제안들 가져오기
    opDAOs.forEach(daoId => {
      const daoProposals = this.getDAOProposals(daoId);
      const reviewProposals = daoProposals.filter(proposal => 
        proposal.status === 'dao-review' && proposal.reviewStage === 'dao-op'
      );
      result.push(...reviewProposals);
    });
    
    return result;
  }

  // 이의신청 대상 제안들 가져오기 (데모 데이터 제거됨)
  getProposalsForObjection() {
    // DAO 설립 제안들만 실제 데이터로 반환
    const daoCreationProposals = (this.pendingDAOCreations || []).map(proposal => ({
      ...proposal,
      reviewType: 'dao-creation'
    }));
    
    // 실제 블록체인에서 이의신청 기간 제안들을 가져와야 함
    return daoCreationProposals;
  }

  // 최종 검토 대상 제안들 가져오기 (데모 데이터 제거됨)
  getProposalsForFinalReview() {
    console.log('🔍 getProposalsForFinalReview 시작');
    // 모든 DAO에서 final-review 상태인 제안들 수집
    const allDAOs = ['dev-dao', 'community-dao', 'ops-dao', 'political-dao'];
    const finalReviewProposals = [];
    
    allDAOs.forEach(daoId => {
      const daoProposals = this.getDAOProposals(daoId);
      console.log(`📂 ${daoId} 제안들:`, daoProposals);
      const finalProposals = daoProposals.filter(proposal => 
        proposal.status === 'final-review' && proposal.reviewStage === 'top-op'
      );
      console.log(`🎯 ${daoId} final-review 제안들:`, finalProposals);
      finalReviewProposals.push(...finalProposals);
    });
    
    console.log('📊 실제 final-review 제안들:', finalReviewProposals);
    
    // 실제 블록체인에서 최종 검토 제안들을 가져와야 함
    return finalReviewProposals;
  }

  // OP 검토 카드 생성
  createOPReviewCard(proposal, reviewType) {
    const statusBadge = this.getOPReviewStatusBadge(proposal, reviewType);
    const actions = this.getOPReviewActions(proposal, reviewType);
    
    // DAO 생성 제안인 경우에도 동일한 디자인 사용, 제목에만 뱃지 추가
    const isDAOCreation = proposal.type === 'dao-creation' || proposal.specialType === 'dao-creation';
    const titleWithBadge = isDAOCreation ? 
      `<span class="dao-creation-badge-inline" style="background: #FF6B35; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; margin-right: 8px;">DAO 생성</span> ${proposal.title}` : 
      proposal.title;
    
    return `
      <div class="op-review-card" onclick="window.dapp.showOPReviewDetailModal('${proposal.id}', '${reviewType}')">
        <div class="op-review-header">
          <div>
            <h4 class="op-review-title">${titleWithBadge}</h4>
            <div class="op-review-meta">
              <div class="meta-item">
                <i class="fas fa-building"></i>
                <span>${proposal.daoName}</span>
              </div>
              <div class="meta-item">
                <i class="fas fa-user"></i>
                <span>제안자: ${proposal.proposer}</span>
              </div>
              ${this.getOPReviewDateInfo(proposal, reviewType)}
            </div>
          </div>
          ${statusBadge}
        </div>
        
        <div class="op-review-description">
          ${proposal.description}
        </div>
        
        <div class="op-review-attachments">
          <h5><i class="fas fa-paperclip"></i> 첨부파일</h5>
          <div class="attachments-list">
            <div class="attachment-item">
              <div class="attachment-icon">
                <i class="fas fa-file-pdf text-red-500"></i>
              </div>
              <div class="attachment-details">
                <div class="attachment-name">검토요청서.pdf</div>
                <div class="attachment-size">1.8 MB</div>
              </div>
              <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                <i class="fas fa-download"></i>
              </button>
            </div>
            <div class="attachment-item">
              <div class="attachment-icon">
                <i class="fas fa-file-alt text-gray-500"></i>
              </div>
              <div class="attachment-details">
                <div class="attachment-name">실행계획.txt</div>
                <div class="attachment-size">78 KB</div>
              </div>
              <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                <i class="fas fa-download"></i>
              </button>
            </div>
          </div>
        </div>
        
        <div class="op-voting-results">
          <h5>투표 결과</h5>
          <div class="op-vote-summary">
            <div class="op-vote-item for">
              <i class="fas fa-thumbs-up"></i>
              <span>찬성: ${proposal.votesFor}표</span>
            </div>
            <div class="op-vote-item against">
              <i class="fas fa-thumbs-down"></i>
              <span>반대: ${proposal.votesAgainst}표</span>
            </div>
            <div class="op-vote-item abstain">
              <i class="fas fa-minus"></i>
              <span>기권: ${proposal.abstentions}표</span>
            </div>
          </div>
        </div>
        
        <div class="op-review-actions" onclick="event.stopPropagation()">
          ${actions}
        </div>
      </div>
    `;
  }

  // DAO 설립 제안 검토 카드 생성
  createDAOCreationReviewCard(proposal, reviewType) {
    const userOPRole = this.getUserOPRole();
    
    // reviewType에 따른 상태 표시
    let statusBadge, actionButtons;
    
    switch(reviewType) {
      case 'ops':
        statusBadge = '<div class="status-badge ops-review">Ops-DAO 이의신청</div>';
        actionButtons = `
          <button class="op-action-btn op-objection-btn" onclick="window.dapp.showObjectionModal('${proposal.id}')">
            <i class="fas fa-exclamation-triangle"></i>
            이의신청
          </button>
        `;
        break;
      case 'final':
        statusBadge = '<div class="status-badge final-review">최종 검토 중</div>';
        if (userOPRole.isTopOP) {
          actionButtons = `
            <button class="op-action-btn op-approve-btn" onclick="window.dapp.showFinalDecisionModal('${proposal.id}', 'approve')">
              <i class="fas fa-crown"></i>
              최종 승인
            </button>
            <button class="op-action-btn op-reject-btn" onclick="window.dapp.showFinalDecisionModal('${proposal.id}', 'reject')">
              <i class="fas fa-ban"></i>
              최종 거부
            </button>
          `;
        } else {
          actionButtons = '<p style="color: var(--text-secondary); font-style: italic;">TOP-OP 권한이 필요합니다.</p>';
        }
        break;
      default:
        statusBadge = '<div class="status-badge ops-review">Ops-DAO 검토중</div>';
        actionButtons = `
          <button class="op-action-btn op-approve-btn" onclick="window.dapp.approveDAOCreation('${proposal.id}')">
            <i class="fas fa-check"></i>
            DAO 설립 승인
          </button>
          <button class="op-action-btn op-reject-btn" onclick="window.dapp.rejectDAOCreation('${proposal.id}')">
            <i class="fas fa-times"></i>
            DAO 설립 거부
          </button>
        `;
    }
    
    // DAO 이름과 목적 추출 (데이터 구조에 따라 다르게 처리)
    const daoName = proposal.daoData?.name || proposal.proposedDAOName || '알 수 없음';
    const daoPurpose = proposal.daoData?.purpose || proposal.proposedDAODescription || proposal.description;
    const collateralAmount = proposal.stakeAmount || proposal.collateralPaid || 30;
    
    return `
      <div class="op-review-card dao-creation-review" onclick="window.dapp.showDAOCreationReviewModal('${proposal.id}')">
        <div class="dao-creation-header">
          <div class="dao-creation-icon">
            <i class="fas fa-building"></i>
          </div>
          <div class="dao-creation-info">
            <h4 class="dao-creation-title">
              <span class="dao-creation-badge">DAO 생성</span>
              ${proposal.title}
            </h4>
            <div class="dao-creation-meta">
              <div class="meta-item">
                <i class="fas fa-user"></i>
                <span>제안자: ${proposal.proposer}</span>
              </div>
              <div class="meta-item">
                <i class="fas fa-calendar"></i>
                <span>제출일: ${this.formatDate(proposal.submissionDate || proposal.reviewStartDate || proposal.votingEndDate)}</span>
              </div>
              <div class="meta-item">
                <i class="fas fa-coins"></i>
                <span>담보: ${collateralAmount}P</span>
              </div>
            </div>
          </div>
          <div class="dao-creation-status">
            ${statusBadge}
          </div>
        </div>
        
        <div class="dao-creation-content">
          <div class="dao-creation-summary">
            <div class="summary-item">
              <strong>생성할 DAO:</strong> ${daoName}
            </div>
            <div class="summary-item">
              <strong>DAO 목적:</strong> ${daoPurpose.substring(0, 100)}${daoPurpose.length > 100 ? '...' : ''}
            </div>
          </div>
          
          <div class="dao-creation-attachments">
            <h5><i class="fas fa-paperclip"></i> 첨부파일</h5>
            <div class="attachments-list">
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-word text-blue-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">DAO_운영계획서.docx</div>
                  <div class="attachment-size">1.2 MB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-pdf text-red-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">예산계획_및_자금운용방안.pdf</div>
                  <div class="attachment-size">4.1 MB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
              <div class="attachment-item">
                <div class="attachment-icon">
                  <i class="fas fa-file-image text-green-500"></i>
                </div>
                <div class="attachment-details">
                  <div class="attachment-name">조직도_및_역할분담.png</div>
                  <div class="attachment-size">967 KB</div>
                </div>
                <button class="attachment-download-btn" onclick="event.stopPropagation(); alert('다운로드 기능은 데모입니다.')">
                  <i class="fas fa-download"></i>
                </button>
              </div>
            </div>
          </div>
          
          <div class="dao-creation-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <span>승인 시 제안자가 Initial-OP가 됩니다. 거부 시 담보의 절반(15P)만 반환됩니다.</span>
          </div>
        </div>
        
        <div class="dao-creation-actions" onclick="event.stopPropagation()">
          ${actionButtons}
        </div>
      </div>
    `;
  }

  // OP 검토 상태 배지
  getOPReviewStatusBadge(proposal, reviewType) {
    switch(reviewType) {
      case 'my-dao':
        return '<div class="op-status-badge pending">OP 검토 대기</div>';
      case 'ops':
        const objectionDaysLeft = this.calculateDaysLeft(proposal.objectionDeadline);
        return `<div class="op-status-badge objection-period">이의신청 ${objectionDaysLeft}일 남음</div>`;
      case 'final':
        return '<div class="op-status-badge pending">최종 검토 대기</div>';
      default:
        return '';
    }
  }

  // OP 검토 날짜 정보
  getOPReviewDateInfo(proposal, reviewType) {
    switch(reviewType) {
      case 'my-dao':
        return `
          <div class="meta-item">
            <i class="fas fa-calendar"></i>
            <span>투표 종료: ${proposal.votingEndDate}</span>
          </div>
        `;
      case 'ops':
        return `
          <div class="meta-item">
            <i class="fas fa-clock"></i>
            <span>이의신청 마감: ${proposal.objectionDeadline}</span>
          </div>
        `;
      case 'final':
        return `
          <div class="meta-item">
            <i class="fas fa-check"></i>
            <span>이의신청 종료: ${proposal.objectionPeriodEnded}</span>
          </div>
        `;
      default:
        return '';
    }
  }

  // OP 검토 액션 버튼들
  getOPReviewActions(proposal, reviewType) {
    const isDAOCreation = proposal.type === 'dao-creation' || proposal.specialType === 'dao-creation';
    
    switch(reviewType) {
      case 'my-dao':
        if (isDAOCreation) {
          return `
            <button class="op-action-btn op-approve-btn" onclick="window.dapp.approveDAOCreation('${proposal.id}')">
              <i class="fas fa-check"></i>
              DAO 설립 승인
            </button>
            <button class="op-action-btn op-reject-btn" onclick="window.dapp.rejectDAOCreation('${proposal.id}')">
              <i class="fas fa-times"></i>
              DAO 설립 거부
            </button>
          `;
        } else {
          return `
            <button class="op-action-btn op-approve-btn" onclick="window.dapp.showOPDecisionModal('${proposal.id}', 'approve')">
              <i class="fas fa-check"></i>
              승인
            </button>
            <button class="op-action-btn op-reject-btn" onclick="window.dapp.showOPDecisionModal('${proposal.id}', 'reject')">
              <i class="fas fa-times"></i>
              거부
            </button>
          `;
        }
      case 'ops':
        return `
          <button class="op-action-btn op-objection-btn" onclick="window.dapp.showObjectionModal('${proposal.id}')">
            <i class="fas fa-exclamation-triangle"></i>
            이의신청
          </button>
        `;
      case 'final':
        const userOPRole = this.getUserOPRole();
        if (userOPRole.isTopOP) {
          return `
            <button class="op-action-btn op-approve-btn" onclick="window.dapp.showFinalDecisionModal('${proposal.id}', 'approve')">
              <i class="fas fa-crown"></i>
              최종 승인
            </button>
            <button class="op-action-btn op-reject-btn" onclick="window.dapp.showFinalDecisionModal('${proposal.id}', 'reject')">
              <i class="fas fa-ban"></i>
              최종 거부
            </button>
          `;
        } else {
          return '<p style="color: var(--text-secondary); font-style: italic;">TOP-OP 권한이 필요합니다.</p>';
        }
      default:
        return '';
    }
  }



  // OP 검토 상세 모달 표시
  showOPReviewDetailModal(proposalId, reviewType) {
    // 이벤트 전파 방지
    event.stopPropagation();
    
    // 제안 데이터 찾기
    let proposal = null;
    const userOPRole = this.getUserOPRole();
    
    if (reviewType === 'my-dao') {
      const proposals = this.getProposalsForOPReview(userOPRole.opDAOs);
      proposal = proposals.find(p => p.id === proposalId);
    } else if (reviewType === 'ops') {
      const proposals = this.getProposalsForObjection();
      proposal = proposals.find(p => p.id === proposalId);
    } else if (reviewType === 'final') {
      const proposals = this.getProposalsForFinalReview();
      proposal = proposals.find(p => p.id === proposalId);
    }
    
    if (!proposal) {
      this.showErrorMessage('제안을 찾을 수 없습니다.');
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'opReviewDetailModal';
    
    const reviewTypeText = {
      'my-dao': 'DAO OP 검토',
      'ops': 'Ops 이의신청',
      'final': '최종 검토'
    };
    
    modal.innerHTML = `
      <div class="modal-content op-review-detail-content">
        <div class="modal-header">
          <h3><i class="fas fa-shield-alt"></i> ${reviewTypeText[reviewType]} - 상세 정보</h3>
          <button class="modal-close" onclick="window.dapp.closeOPReviewDetailModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="op-review-detail-main">
            <!-- 제안 기본 정보 -->
            <div class="proposal-summary-section">
              <h4>${proposal.title}</h4>
              <div class="proposal-meta-grid">
                <div class="meta-item">
                  <i class="fas fa-building"></i>
                  <span><strong>DAO:</strong> ${proposal.daoName}</span>
                </div>
                <div class="meta-item">
                  <i class="fas fa-user"></i>
                  <span><strong>제안자:</strong> ${proposal.proposer}</span>
                </div>
                <div class="meta-item">
                  <i class="fas fa-calendar"></i>
                  <span><strong>투표 종료:</strong> ${proposal.votingEndDate}</span>
                </div>
                ${this.getOPReviewDetailDateInfo(proposal, reviewType)}
              </div>
              
              <!-- 최종검토 단계에서 TOP-OP에게만 제안자 통신정보 표시 -->
              ${reviewType === 'final' && this.getUserOPRole().isTopOP ? this.getProposerContactInfo(proposal) : ''}
              
              <!-- DAO 생성 제안인 경우 특별한 정보 표시 -->
              ${this.isDAOCreationProposal(proposal) ? this.getDAOCreationDetailInfo(proposal) : `
              <div class="proposal-description-section">
                <h5>제안 내용</h5>
                <p>${proposal.description}</p>
              </div>
              `}
            </div>
            
            <!-- 투표 결과 -->
            <div class="voting-results-section">
              <h5>투표 결과</h5>
              <div class="vote-results-grid">
                <div class="vote-result-item for">
                  <i class="fas fa-thumbs-up"></i>
                  <div class="vote-details">
                    <span class="vote-count">${proposal.votesFor}</span>
                    <span class="vote-label">찬성</span>
                  </div>
                </div>
                <div class="vote-result-item against">
                  <i class="fas fa-thumbs-down"></i>
                  <div class="vote-details">
                    <span class="vote-count">${proposal.votesAgainst}</span>
                    <span class="vote-label">반대</span>
                  </div>
                </div>
                <div class="vote-result-item abstain">
                  <i class="fas fa-minus"></i>
                  <div class="vote-details">
                    <span class="vote-count">${proposal.abstentions}</span>
                    <span class="vote-label">기권</span>
                  </div>
                </div>
                <div class="vote-result-item total">
                  <i class="fas fa-users"></i>
                  <div class="vote-details">
                    <span class="vote-count">${proposal.votesFor + proposal.votesAgainst + proposal.abstentions}</span>
                    <span class="vote-label">총 투표</span>
                  </div>
                </div>
              </div>
              <div class="vote-percentage-bar">
                <div class="vote-bar-section for" style="width: ${((proposal.votesFor / (proposal.votesFor + proposal.votesAgainst + proposal.abstentions)) * 100)}%"></div>
                <div class="vote-bar-section against" style="width: ${((proposal.votesAgainst / (proposal.votesFor + proposal.votesAgainst + proposal.abstentions)) * 100)}%"></div>
                <div class="vote-bar-section abstain" style="width: ${((proposal.abstentions / (proposal.votesFor + proposal.votesAgainst + proposal.abstentions)) * 100)}%"></div>
              </div>
            </div>
            
            <!-- OP 검토 의견 표시 (ops, final 단계에서만) -->
            ${(reviewType === 'ops' || reviewType === 'final') && proposal.opDecision === 'approved' && proposal.opReviewComment ? `
              <div class="op-review-opinion-section">
                <h5><i class="fas fa-user-check"></i> OP 검토 의견</h5>
                <div class="review-comment-section">
                  <div class="review-comment-header">
                    <strong>${this.isDAOCreationProposal(proposal) ? 'Political DAO OP 승인 의견' : 'DAO OP 검토 의견'}</strong>
                    <span class="reviewer-info">${proposal.opReviewer || 'DAO OP'} · ${this.formatDate(proposal.opApprovedDate)}</span>
                  </div>
                  <div class="review-comment-content">
                    ${proposal.opReviewComment}
                  </div>
                </div>
              </div>
            ` : ''}
            
            <!-- 이의신청 내용 표시 (ops, final 단계에서) -->
            ${(reviewType === 'ops' || reviewType === 'final') ? `
              <div class="op-objections-section">
                <h5><i class="fas fa-exclamation-triangle"></i> 이의신청 내용</h5>
                ${proposal.objections && proposal.objections.length > 0 ? `
                  <div class="objections-list">
                    ${proposal.objections.map(obj => `
                      <div class="objection-detail-item">
                        <div class="objection-header">
                          <span class="objector-name">
                            <strong>${obj.objectorName || obj.objector || obj}</strong>
                            <span class="objector-role">(${obj.objectorRole || 'OP'})</span>
                          </span>
                          <span class="objection-date">${this.formatDate(obj.date || '')}</span>
                        </div>
                        ${obj.reason ? `
                          <div class="objection-reason">
                            <strong>이의신청 사유:</strong> ${obj.reason}
                          </div>
                        ` : ''}
                        ${obj.details ? `
                          <div class="objection-details">
                            ${obj.details}
                          </div>
                        ` : ''}
                        ${obj.response ? `
                          <div class="objection-response">
                            <strong>제안자 응답:</strong> ${obj.response}
                          </div>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>
                ` : `
                  <div class="no-objections-final">
                    <i class="fas fa-check-circle"></i>
                    <span>${reviewType === 'ops' ? '아직 이의신청이 없습니다.' : '이의신청 기간 동안 이의신청이 없었습니다.'}</span>
                  </div>
                `}
              </div>
            ` : ''}
            
            <!-- 검토 과정별 추가 정보 -->
            ${this.getOPReviewDetailExtraInfo(proposal, reviewType)}
            
            <!-- 액션 버튼들 -->
            <div class="op-review-detail-actions">
              ${this.getOPReviewDetailActions(proposal, reviewType)}
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // OP 검토 상세 모달 닫기
  closeOPReviewDetailModal() {
    const modal = document.getElementById('opReviewDetailModal');
    if (modal) {
      modal.remove();
    }
  }

  // DAO 생성 제안인지 확인
  isDAOCreationProposal(proposal) {
    return proposal.type === 'dao-creation' || proposal.specialType === 'dao-creation';
  }

  // DAO 생성 제안 상세 정보
  getDAOCreationDetailInfo(proposal) {
    // Security DAO의 경우 실제 제안 양식에 맞춘 데이터 사용
    if (proposal.id === 'pol-prop-8') {
      return `
        <!-- 제안 기본 정보 -->
        <div class="dao-creation-section">
          <div class="proposal-description">
            <h4><i class="fas fa-info-circle"></i> 제안 요약</h4>
            <p>${proposal.description}</p>
          </div>
        </div>

        <!-- 생성될 DAO 정보 -->
        <div class="dao-creation-section">
          <h4><i class="fas fa-building"></i> 생성될 DAO 정보</h4>
          <div class="dao-info-grid">
            <div class="dao-info-item">
              <label>DAO 이름</label>
              <div class="dao-name-display">Security DAO</div>
            </div>
            <div class="dao-info-item full-width">
              <label>DAO 목적 및 설명</label>
              <div class="dao-description-display">백야 프로토콜의 보안 강화와 감사를 전담하는 전문 DAO입니다. 시스템 보안 취약점 점검, 스마트 컨트랙트 감사, 보안 가이드라인 수립 등을 통해 안전한 블록체인 환경을 구축하고 유지합니다.</div>
            </div>
            <div class="dao-info-item full-width">
              <label>DAO 필요성</label>
              <div class="dao-justification-display">백야 프로토콜의 성장과 함께 보안 위협도 증가하고 있습니다. 기존 DAO들은 각각 운영, 개발, 커뮤니티, 정치 영역을 담당하지만, 보안 전문성을 가진 별도의 조직이 필요합니다. Security DAO는 전문적인 보안 감사와 지속적인 보안 모니터링을 통해 프로토콜의 신뢰성을 높이고 사용자 자산을 보호할 것입니다.</div>
            </div>
          </div>
        </div>

        <!-- 예상 DCA 목록 -->
        <div class="dao-creation-section">
          <h4><i class="fas fa-tasks"></i> 예상 지정기여활동 (DCA)</h4>
          <div class="proposed-dca-list">
            <div class="proposed-dca-item">
              <div class="dca-header">
                <h5>DCA 1: 보안 감사 수행</h5>
                <div class="dca-value">300B</div>
              </div>
              <div class="dca-criteria">
                <strong>검증기준:</strong> 감사 보고서 제출 및 승인
              </div>
              <div class="dca-details">
                <strong>상세내용:</strong> 스마트 컨트랙트 및 시스템 보안 감사를 수행하고 상세한 보고서를 작성합니다.
              </div>
            </div>
            <div class="proposed-dca-item">
              <div class="dca-header">
                <h5>DCA 2: 취약점 발견 및 신고</h5>
                <div class="dca-value">200B</div>
              </div>
              <div class="dca-criteria">
                <strong>검증기준:</strong> 유효한 취약점 신고 및 수정 완료
              </div>
              <div class="dca-details">
                <strong>상세내용:</strong> 시스템 취약점을 발견하고 신고하여 보안 개선에 기여합니다.
              </div>
            </div>
            <div class="proposed-dca-item">
              <div class="dca-header">
                <h5>DCA 3: 보안 가이드라인 작성</h5>
                <div class="dca-value">150B</div>
              </div>
              <div class="dca-criteria">
                <strong>검증기준:</strong> 가이드라인 승인 및 배포
              </div>
              <div class="dca-details">
                <strong>상세내용:</strong> 개발자 및 사용자를 위한 보안 가이드라인을 작성합니다.
              </div>
            </div>
            <div class="proposed-dca-item">
              <div class="dca-header">
                <h5>DCA 4: 보안 교육 진행</h5>
                <div class="dca-value">100B</div>
              </div>
              <div class="dca-criteria">
                <strong>검증기준:</strong> 교육 세션 완료 및 참여자 평가
              </div>
              <div class="dca-details">
                <strong>상세내용:</strong> 커뮤니티 구성원들을 대상으로 보안 교육을 진행합니다.
              </div>
            </div>
          </div>
        </div>

        <!-- 이니셜 OP 후보 정보 -->
        <div class="dao-creation-section">
          <h4><i class="fas fa-crown"></i> 이니셜 OP 후보</h4>
          <div class="initial-op-info">
                         <div class="op-candidate-clickable" onclick="window.dapp.showProposerProfile('보안전문가', 'did:baekya:security-expert')" style="cursor: pointer;">
               <div class="op-candidate-profile">
                 <div class="op-avatar">보</div>
                 <div class="op-details">
                   <div class="op-name">보안전문가 (제안자)</div>
                   <div class="op-address">${this.maskAddress('010-9990-4718')}</div>
                 </div>
               </div>
               <div class="op-view-badge">프로필 보기 →</div>
             </div>
            <div class="op-description">
              <small>제안자가 DAO 승인 시 이니셜 OP로 임명됩니다. 클릭하여 제안자의 상세 프로필을 확인하세요.</small>
            </div>
            <div class="op-qualification-detail">
              <label>OP 후보 자격 설명</label>
              <div class="qualification-text">10년간 사이버보안 분야에서 활동한 전문가로, 다수의 블록체인 프로젝트 보안 감사 경험을 보유하고 있습니다. CISSP, CEH 등의 보안 자격증을 보유하고 있으며, 백야 프로토콜의 보안 강화를 위해 헌신할 의지가 있습니다.</div>
            </div>
          </div>
        </div>
      `;
    }
    
    // 일반적인 DAO 생성 제안 템플릿 (투표 상세 레이아웃 적용)
    return `
      <!-- 제안 기본 정보 -->
      <div class="dao-creation-section">
        <div class="proposal-description">
          <h4><i class="fas fa-info-circle"></i> 제안 요약</h4>
          <p>${proposal.description}</p>
        </div>
      </div>

      <!-- 생성될 DAO 정보 -->
      <div class="dao-creation-section">
        <h4><i class="fas fa-building"></i> 생성될 DAO 정보</h4>
        <div class="dao-info-grid">
          <div class="dao-info-item">
            <label>DAO 이름</label>
            <div class="dao-name-display">${proposal.daoName || '새로운 DAO'}</div>
          </div>
          <div class="dao-info-item full-width">
            <label>DAO 목적 및 설명</label>
            <div class="dao-description-display">${proposal.daoDescription || '설명이 제공되지 않았습니다.'}</div>
          </div>
          <div class="dao-info-item full-width">
            <label>DAO 필요성</label>
            <div class="dao-justification-display">${proposal.daoJustification || '필요성 설명이 제공되지 않았습니다.'}</div>
          </div>
        </div>
      </div>

      <!-- 예상 DCA 목록 -->
      <div class="dao-creation-section">
        <h4><i class="fas fa-tasks"></i> 예상 지정기여활동 (DCA)</h4>
        <div class="proposed-dca-list">
          ${proposal.proposedDCAs ? proposal.proposedDCAs.map((dca, index) => `
            <div class="proposed-dca-item">
              <div class="dca-header">
                <h5>DCA ${index + 1}: ${dca.title}</h5>
                <div class="dca-value">${dca.value}B</div>
              </div>
              <div class="dca-criteria">
                <strong>검증기준:</strong> ${dca.criteria}
              </div>
              <div class="dca-details">
                <strong>상세내용:</strong> ${dca.details || '상세내용이 제공되지 않았습니다.'}
              </div>
            </div>
          `).join('') : '<p style="text-align: center; color: #666; padding: 20px;">DCA 정보가 제공되지 않았습니다.</p>'}
        </div>
      </div>

      <!-- 이니셜 OP 후보 정보 -->
      <div class="dao-creation-section">
        <h4><i class="fas fa-crown"></i> 이니셜 OP 후보</h4>
        <div class="initial-op-info">
                     <div class="op-candidate-clickable" onclick="window.dapp.showProposerProfile('${proposal.proposer}', '${proposal.proposerDID || 'unknown'}')" style="cursor: pointer;">
             <div class="op-candidate-profile">
               <div class="op-avatar">${proposal.proposer?.charAt(0) || 'U'}</div>
               <div class="op-details">
                 <div class="op-name">${proposal.proposer || '제안자'} (제안자)</div>
                 <div class="op-address">${this.maskAddress(proposal.proposerCommunicationAddress || '010-9990-4718')}</div>
               </div>
             </div>
             <div class="op-view-badge">프로필 보기 →</div>
           </div>
          <div class="op-description">
            <small>제안자가 DAO 승인 시 이니셜 OP로 임명됩니다. 클릭하여 제안자의 상세 프로필을 확인하세요.</small>
          </div>
          <div class="op-qualification-detail">
            <label>OP 후보 자격 설명</label>
            <div class="qualification-text">${proposal.opQualification || '자격 설명이 제공되지 않았습니다.'}</div>
          </div>
        </div>
      </div>
    `;
  }

  // 제안자 연락처 정보 (TOP-OP만 볼 수 있음)
  getProposerContactInfo(proposal) {
    return `
      <div class="dao-creation-section">
        <h4><i class="fas fa-shield-alt"></i> 제안자 연락처 정보 (TOP-OP 전용)</h4>
        <div class="dao-info-grid">
          <div class="dao-info-item">
            <label>제안자 이름</label>
            <div class="dao-name-display">${proposal.proposer || '제안자'}</div>
          </div>
          <div class="dao-info-item full-width">
            <label>제안자 DID</label>
            <div class="dao-description-display did-masked">${this.maskAddress(proposal.proposerDID || 'did:baekya:1a2b3c4d5e6f')}</div>
          </div>
        </div>
        <div class="dao-creation-voting-info">
          <i class="fas fa-exclamation-triangle"></i>
          이 정보는 TOP-OP에게만 표시되며 최종 검토 목적으로 제공됩니다.
        </div>
      </div>
    `;
  }

  // OP 검토 상세 날짜 정보
  getOPReviewDetailDateInfo(proposal, reviewType) {
    switch(reviewType) {
      case 'my-dao':
        return `
          <div class="meta-item">
            <i class="fas fa-clock"></i>
            <span><strong>통과일:</strong> ${proposal.passedDate}</span>
          </div>
        `;
      case 'ops':
        return `
          <div class="meta-item">
            <i class="fas fa-clock"></i>
            <span><strong>OP 승인일:</strong> ${proposal.opApprovedDate}</span>
          </div>
          <div class="meta-item">
            <i class="fas fa-exclamation-triangle"></i>
            <span><strong>이의신청 마감:</strong> ${proposal.objectionDeadline}</span>
          </div>
        `;
      case 'final':
        return `
          <div class="meta-item">
            <i class="fas fa-check"></i>
            <span><strong>이의신청 종료:</strong> ${proposal.objectionPeriodEnded}</span>
          </div>
        `;
      default:
        return '';
    }
  }

  // OP 검토 상세 추가 정보
  getOPReviewDetailExtraInfo(proposal, reviewType) {
    switch(reviewType) {
      case 'my-dao':
        return `
          <div class="review-status-section">
            <h5>검토 상태</h5>
            <div class="status-info">
              <i class="fas fa-hourglass-half"></i>
              <span>OP 검토 대기 중입니다. 제안 내용을 신중히 검토하여 승인 또는 거부를 결정해주세요.</span>
            </div>
          </div>
        `;
      case 'ops':
        const objectionDaysLeft = this.calculateDaysLeft(proposal.objectionDeadline);
        const myObjection = this.objections?.[proposal.id];
        return `
          <div class="objection-status-section">
            <h5>이의신청 정보</h5>
            <div class="objection-info">
              <div class="objection-time">
                <i class="fas fa-clock"></i>
                <span>이의신청 기간: <strong>${objectionDaysLeft}일 남음</strong></span>
              </div>
              <div class="objection-current">
                <i class="fas fa-list"></i>
                <span>현재 이의신청: <strong>${proposal.objections?.length || 0}건</strong></span>
              </div>
              ${myObjection ? `
                <div class="my-objection">
                  <h6>내 이의신청</h6>
                  <div class="objection-item">
                    <div class="objection-header">
                      <strong>${myObjection.objector}</strong>
                      <span class="objection-date">${myObjection.date}</span>
                    </div>
                    <div class="objection-reason">${myObjection.reason}</div>
                  </div>
                </div>
              ` : ''}
              ${proposal.objections?.length > 0 ? `
                <div class="objections-list">
                  <h6>이의신청 내역</h6>
                  ${proposal.objections.map(obj => `
                    <div class="objection-item">
                      <strong>${obj.objector}</strong>: ${obj.reason} (${obj.date})
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      case 'final':
        const finalObjection = this.objections?.[proposal.id];
        const finalDecision = this.finalDecisions?.[proposal.id];
        return `
          <div class="final-review-section">
            <h5>최종 검토 정보</h5>
            <div class="final-info">
              <i class="fas fa-crown"></i>
              <span>이의신청 기간이 종료되어 최종 검토 단계입니다. TOP-OP 권한으로 최종 승인 또는 거부를 결정해주세요.</span>
            </div>
            ${finalObjection ? `
              <div class="objection-detail">
                <h6>이의신청 내용</h6>
                <div class="objection-item">
                  <div class="objection-header">
                    <strong>${finalObjection.objector}</strong>
                    <span class="objection-date">${finalObjection.date}</span>
                  </div>
                  <div class="objection-reason">${finalObjection.reason}</div>
                </div>
              </div>
            ` : ''}
            ${proposal.objections?.length > 0 ? `
              <div class="objections-summary">
                <h6>이의신청 요약 (${proposal.objections.length}건)</h6>
                ${proposal.objections.map(obj => `
                  <div class="objection-item">
                    <strong>${obj.objector}</strong>: ${obj.reason}
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${finalDecision ? `
              <div class="final-decision-summary">
                <h6>최종 결정 내용</h6>
                <div class="decision-badge ${finalDecision.decision}">
                  <i class="fas fa-${finalDecision.decision === 'approve' ? 'crown' : 'ban'}"></i>
                  ${finalDecision.decision === 'approve' ? '최종 승인' : '최종 거부'}
                </div>
                <div class="decision-details">
                  <div class="detail-row">
                    <span>결정자:</span>
                    <span>${finalDecision.reviewer}</span>
                  </div>
                  <div class="detail-row">
                    <span>결정일:</span>
                    <span>${finalDecision.date}</span>
                  </div>
                  <div class="decision-reason">
                    <p>${finalDecision.reason}</p>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      default:
        return '';
    }
  }

  // OP 검토 상세 액션 버튼들
  getOPReviewDetailActions(proposal, reviewType) {
    const isDAOCreation = this.isDAOCreationProposal(proposal);
    
    switch(reviewType) {
      case 'my-dao':
        if (isDAOCreation) {
          return `
            <div class="action-buttons-row">
              <button class="btn-secondary modal-close-btn" onclick="window.dapp.closeOPReviewDetailModal()">
                <i class="fas fa-times"></i>
                닫기
              </button>
              <button class="op-action-btn op-reject-btn" onclick="event.stopPropagation(); window.dapp.rejectDAOCreation('${proposal.id}');">
                <i class="fas fa-times"></i>
                DAO 설립 거부
              </button>
              <button class="op-action-btn op-approve-btn" onclick="event.stopPropagation(); window.dapp.approveDAOCreation('${proposal.id}');">
                <i class="fas fa-check"></i>
                DAO 설립 승인
              </button>
            </div>
          `;
        } else {
          return `
            <div class="action-buttons-row">
              <button class="btn-secondary modal-close-btn" onclick="window.dapp.closeOPReviewDetailModal()">
                <i class="fas fa-times"></i>
                닫기
              </button>
              <button class="op-action-btn op-reject-btn" onclick="event.stopPropagation(); window.dapp.showOPDecisionModal('${proposal.id}', 'reject');">
                <i class="fas fa-times"></i>
                거부
              </button>
              <button class="op-action-btn op-approve-btn" onclick="event.stopPropagation(); window.dapp.showOPDecisionModal('${proposal.id}', 'approve');">
                <i class="fas fa-check"></i>
                승인
              </button>
            </div>
          `;
        }
      case 'ops':
        return `
          <div class="action-buttons-row">
            <button class="btn-secondary modal-close-btn" onclick="window.dapp.closeOPReviewDetailModal()">
              <i class="fas fa-times"></i>
              닫기
            </button>
            <button class="op-action-btn op-objection-btn" onclick="event.stopPropagation(); window.dapp.showObjectionModal('${proposal.id}');">
              <i class="fas fa-exclamation-triangle"></i>
              이의신청
            </button>
          </div>
        `;
      case 'final':
        const userOPRole = this.getUserOPRole();
        if (userOPRole.isTopOP) {
          return `
            <div class="action-buttons-row">
              <button class="btn-secondary modal-close-btn" onclick="window.dapp.closeOPReviewDetailModal()">
                <i class="fas fa-times"></i>
                닫기
              </button>
              <button class="op-action-btn op-reject-btn" onclick="event.stopPropagation(); window.dapp.showFinalDecisionModal('${proposal.id}', 'reject');">
                <i class="fas fa-ban"></i>
                최종 거부
              </button>
              <button class="op-action-btn op-approve-btn" onclick="event.stopPropagation(); window.dapp.showFinalDecisionModal('${proposal.id}', 'approve');">
                <i class="fas fa-crown"></i>
                최종 승인
              </button>
            </div>
          `;
        } else {
          return `
            <div class="action-buttons-row">
              <button class="btn-secondary modal-close-btn" onclick="window.dapp.closeOPReviewDetailModal()">
                <i class="fas fa-times"></i>
                닫기
              </button>
              <div class="permission-notice">
                <i class="fas fa-info-circle"></i>
                <span>TOP-OP 권한이 필요합니다.</span>
              </div>
            </div>
          `;
        }
      default:
        return `
          <button class="btn-secondary" onclick="window.dapp.closeOPReviewDetailModal()">
            <i class="fas fa-times"></i>
            닫기
          </button>
        `;
    }
  }

  // 이의신청 모달 표시
  showObjectionModal(proposalId) {
    this.closeOPReviewDetailModal(); // 기존 모달 닫기
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'objectionModal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-exclamation-triangle"></i> 이의신청 제출</h3>
          <button class="modal-close" onclick="window.dapp.closeObjectionModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="objection-form">
            <div class="b-value-notice">
              <div class="b-value-highlight">
                <i class="fas fa-coins"></i>
                                  <span>획득 기여가치: <strong>160B</strong></span>
              </div>
            </div>
            <div class="form-group">
              <label for="objectionReason">이의신청 사유</label>
              <textarea id="objectionReason" placeholder="이의신청 사유를 간략히 작성해주세요..." rows="3"></textarea>
            </div>
            <div class="form-group">
              <label for="objectionDetails">상세 내용</label>
              <textarea id="objectionDetails" placeholder="이의신청의 구체적인 근거와 상세한 내용을 작성해주세요..." rows="5"></textarea>
            </div>
            <div class="objection-notice">
              <i class="fas fa-info-circle"></i>
              <p>이의신청은 신중히 검토된 후 제출해주세요. 허위 또는 부당한 이의신청은 제재를 받을 수 있습니다.</p>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="window.dapp.closeObjectionModal()">
            <i class="fas fa-times"></i>
            취소
          </button>
          <button class="btn-primary" onclick="window.dapp.submitObjection('${proposalId}')">
            <i class="fas fa-exclamation-triangle"></i>
            이의신청 제출
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // 이의신청 모달 닫기
  closeObjectionModal() {
    const modal = document.getElementById('objectionModal');
    if (modal) {
      modal.remove();
    }
  }

  // 이의신청 제출
  async submitObjection(proposalId) {
    const reason = document.getElementById('objectionReason')?.value?.trim();
    const details = document.getElementById('objectionDetails')?.value?.trim();
    
    if (!reason) {
      this.showErrorMessage('이의신청 사유를 입력해주세요.');
      return;
    }
    
    if (!details) {
      this.showErrorMessage('상세 내용을 입력해주세요.');
      return;
    }
    
    const authConfirmed = await this.requestAuthentication('이의신청 제출');
    if (!authConfirmed) return;
    
    // 이의신청 데이터 저장
    this.saveObjection(proposalId, reason, details);
    
    // 실제 워크플로우에 이의신청 반영
    this.updateProposalWithObjection(proposalId);
    
    this.showSuccessMessage(`제안 ${proposalId}에 대한 이의신청을 제출했습니다.`);
    this.closeObjectionModal();
    
    // 콘텐츠 새로고침
    setTimeout(() => {
      this.loadOpsReviews();
    }, 1000);
  }

  // 이의신청 저장 (시뮬레이션)
  saveObjection(proposalId, reason, details) {
    if (!this.objections) {
      this.objections = {};
    }
    this.objections[proposalId] = {
      reason,
      details,
      date: new Date().toISOString().split('T')[0],
      objector: '데모 사용자'
    };
  }

  // OP 결정 모달 표시 (내 DAO 검토)
  showOPDecisionModal(proposalId, decision) {
    this.closeOPReviewDetailModal(); // 기존 모달 닫기
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'opDecisionModal';
    
    const title = decision === 'approve' ? 'OP 승인' : 'OP 거부';
    const buttonText = decision === 'approve' ? 'Ops 제출' : '거부 공지';
    const placeholder = decision === 'approve' 
      ? '승인 이유와 의견을 작성해주세요...' 
      : '거부 이유와 의견을 작성해주세요...';
    const bValue = decision === 'approve' ? '120B' : '150B';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-gavel"></i> ${title}</h3>
          <button class="modal-close" onclick="window.dapp.closeOPDecisionModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="decision-form">
            <div class="b-value-notice">
              <div class="b-value-highlight">
                <i class="fas fa-coins"></i>
                <span>획득 기여가치: <strong>${bValue}</strong></span>
              </div>
            </div>
            <div class="form-group">
              <label for="decisionReason">${decision === 'approve' ? '승인 이유 및 의견' : '거부 이유 및 의견'}</label>
              <textarea id="decisionReason" placeholder="${placeholder}" rows="5"></textarea>
            </div>
            <div class="decision-notice">
              <i class="fas fa-info-circle"></i>
              <p>${decision === 'approve' 
                ? '승인 의견은 이후 검토 과정에서 참고 자료로 활용됩니다.' 
                : '거부 내용은 해당 DAO 컨소시엄의 공지사항에 게시됩니다.'}</p>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="window.dapp.closeOPDecisionModal()">
            <i class="fas fa-times"></i>
            취소
          </button>
          <button class="btn-primary" onclick="window.dapp.submitOPDecision('${proposalId}', '${decision}')">
            <i class="fas fa-${decision === 'approve' ? 'check' : 'times'}"></i>
            ${buttonText}
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // OP 결정 모달 닫기
  closeOPDecisionModal() {
    const modal = document.getElementById('opDecisionModal');
    if (modal) {
      modal.remove();
    }
  }

  // OP 결정 제출
  async submitOPDecision(proposalId, decision) {
    const reason = document.getElementById('decisionReason')?.value?.trim();
    
    if (!reason) {
      this.showErrorMessage(`${decision === 'approve' ? '승인' : '거부'} 이유를 입력해주세요.`);
      return;
    }
    
    const authConfirmed = await this.requestAuthentication(`OP ${decision === 'approve' ? '승인' : '거부'}`);
    if (!authConfirmed) return;
    
    // OP 결정 데이터 저장 (실제로는 블록체인에 저장)
    this.saveOPDecision(proposalId, decision, reason);
    
    // 실제 워크플로우 진행: 제안 상태 업데이트
    this.updateProposalWorkflowStatus(proposalId, decision);
    
    if (decision === 'approve') {
      this.showSuccessMessage(`제안 ${proposalId}를 승인하고 Ops 검토로 전송했습니다.`);
    } else {
      this.showSuccessMessage(`제안 ${proposalId}를 거부했습니다. 공지사항에 게시됩니다.`);
      // 거부 공지를 DAO 컨소시엄에 추가
      this.addDAOAnnouncement(proposalId, 'rejected', reason);
    }
    
    this.closeOPDecisionModal();
    
    // 콘텐츠 새로고침
    setTimeout(() => {
      this.loadMyDAOReviews();
    }, 1000);
  }

  // DAO 생성 제안 승인
  async approveDAOCreation(proposalId) {
    const authConfirmed = await this.requestAuthentication('DAO 설립 승인');
    if (!authConfirmed) return;
    
    this.showSuccessMessage(`DAO 생성 제안 ${proposalId}을 승인했습니다. Ops 검토로 전송됩니다.`);
    this.closeOPReviewDetailModal();
    
    // 콘텐츠 새로고침
    setTimeout(() => {
      this.loadMyDAOReviews();
    }, 1000);
  }

  // DAO 생성 제안 거부
  async rejectDAOCreation(proposalId) {
    const authConfirmed = await this.requestAuthentication('DAO 설립 거부');
    if (!authConfirmed) return;
    
    this.showSuccessMessage(`DAO 생성 제안 ${proposalId}을 거부했습니다. 공지사항에 게시됩니다.`);
    this.closeOPReviewDetailModal();
    
    // 콘텐츠 새로고침
    setTimeout(() => {
      this.loadMyDAOReviews();
    }, 1000);
  }

  // 최종 결정 모달 표시
  showFinalDecisionModal(proposalId, decision) {
    this.closeOPReviewDetailModal(); // 기존 모달 닫기
    
    const proposal = this.findProposalById(proposalId);
    if (!proposal) {
      this.showErrorMessage('제안을 찾을 수 없습니다.');
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'finalDecisionModal';
    
    const title = decision === 'approve' ? '최종 승인' : '최종 거부';
    const buttonText = decision === 'approve' ? '최종 승인' : '최종 거부';
    const placeholder = decision === 'approve' 
      ? '최종 승인 이유와 의견을 작성해주세요...' 
      : '최종 거부 이유와 의견을 작성해주세요...';
    const bValue = decision === 'approve' ? '120B' : '150B';
    
    // 최종거부 시 이의신청 목록 표시
    const objectionsSection = decision === 'reject' ? `
      <div class="objections-adoption-section">
        <h5><i class="fas fa-gavel"></i> 이의신청 채택</h5>
        ${proposal.objections && proposal.objections.length > 0 ? `
          <p class="adoption-description">채택할 이의신청을 선택하세요. 채택된 이의신청자에게는 "이의신청 채택" DCA(160B)가 자동으로 검증됩니다.</p>
          <div class="objections-list-selection">
            ${proposal.objections.map((objection, index) => `
              <div class="objection-selection-item">
                <label class="objection-checkbox-label">
                  <input type="checkbox" class="objection-checkbox" data-objection-id="${objection.id || index}" data-objector="${objection.objector}">
                  <div class="objection-content">
                    <div class="objection-header">
                      <strong>${objection.objectorName || objection.objector}</strong>
                      <span class="objector-role">(${objection.objectorRole || 'OP'})</span>
                      <span class="objection-date">${this.formatDate(objection.date)}</span>
                    </div>
                    <div class="objection-reason">
                      <strong>사유:</strong> ${objection.reason}
                    </div>
                    ${objection.details ? `
                      <div class="objection-details">
                        ${objection.details}
                      </div>
                    ` : ''}
                    ${objection.response ? `
                      <div class="objection-response">
                        <strong>제안자 응답:</strong> ${objection.response}
                      </div>
                    ` : ''}
                  </div>
                </label>
              </div>
            `).join('')}
          </div>
          <div class="adoption-notice">
            <i class="fas fa-info-circle"></i>
            <small>채택하지 않은 이의신청자에게는 DCA가 검증되지 않습니다.</small>
          </div>
        ` : `
          <div class="no-objections-notice">
            <i class="fas fa-info-circle"></i>
            <p>이의신청 기간 동안 이의신청이 없었습니다.</p>
            <small>이의신청 채택 DCA는 발생하지 않습니다.</small>
          </div>
        `}
      </div>
    ` : '';
    
    modal.innerHTML = `
      <div class="modal-content final-decision-modal">
        <div class="modal-header">
          <h3><i class="fas fa-crown"></i> ${title}</h3>
          <button class="modal-close" onclick="window.dapp.closeFinalDecisionModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="decision-form">
            <div class="b-value-notice">
              <div class="b-value-highlight">
                <i class="fas fa-coins"></i>
                <span>획득 기여가치: <strong>${bValue}</strong></span>
              </div>
            </div>
            <div class="form-group">
              <label for="finalDecisionReason">${decision === 'approve' ? '최종 승인 이유 및 의견' : '최종 거부 이유 및 의견'}</label>
              <textarea id="finalDecisionReason" placeholder="${placeholder}" rows="5"></textarea>
            </div>
            
            ${objectionsSection}
            
            <div class="decision-notice">
              <i class="fas fa-info-circle"></i>
              <p>최종 결정 내용은 해당 DAO 컨소시엄의 공지사항에 게시됩니다.</p>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="window.dapp.closeFinalDecisionModal()">
            <i class="fas fa-times"></i>
            취소
          </button>
          <button class="btn-primary" onclick="window.dapp.submitFinalDecision('${proposalId}', '${decision}')">
            <i class="fas fa-${decision === 'approve' ? 'crown' : 'ban'}"></i>
            ${buttonText}
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // 최종 결정 모달 닫기
  closeFinalDecisionModal() {
    const modal = document.getElementById('finalDecisionModal');
    if (modal) {
      modal.remove();
    }
  }

  // 최종 결정 제출
  async submitFinalDecision(proposalId, decision) {
    const reason = document.getElementById('finalDecisionReason')?.value?.trim();
    
    if (!reason) {
      this.showErrorMessage(`최종 ${decision === 'approve' ? '승인' : '거부'} 이유를 입력해주세요.`);
      return;
    }
    
    // 최종거부 시 이의신청 채택 처리
    let adoptedObjections = [];
    if (decision === 'reject') {
      const selectedCheckboxes = document.querySelectorAll('.objection-checkbox:checked');
      adoptedObjections = Array.from(selectedCheckboxes).map(checkbox => ({
        objectionId: checkbox.dataset.objectionId,
        objector: checkbox.dataset.objector
      }));
    }
    
    const authConfirmed = await this.requestAuthentication(`최종 ${decision === 'approve' ? '승인' : '거부'}`);
    if (!authConfirmed) return;
    
    // 최종 결정 데이터 저장
    this.saveFinalDecision(proposalId, decision, reason, adoptedObjections);
    
    // DCA 자동 검증 처리 (이의신청 채택 시)
    if (decision === 'reject' && adoptedObjections.length > 0) {
      this.processObjectionAdoptionDCA(adoptedObjections);
    }
    
    const adoptionMessage = adoptedObjections.length > 0 ? 
      ` (${adoptedObjections.length}건의 이의신청 채택, DCA 자동 검증 완료)` : '';
    
    this.showSuccessMessage(`제안 ${proposalId}를 최종 ${decision === 'approve' ? '승인' : '거부'}했습니다.${adoptionMessage}`);
    
    // 최종 결정 공지를 DAO 컨소시엄에 추가
    this.addDAOAnnouncement(proposalId, decision === 'approve' ? 'final-approved' : 'final-rejected', reason, adoptedObjections);
    
    this.closeFinalDecisionModal();
    
    // 콘텐츠 새로고침
    setTimeout(() => {
      this.loadFinalReviews();
    }, 1000);
  }

  // OP 결정 저장 (시뮬레이션)
  saveOPDecision(proposalId, decision, reason) {
    if (!this.opDecisions) {
      this.opDecisions = {};
    }
    this.opDecisions[proposalId] = {
      decision,
      reason,
      date: new Date().toISOString().split('T')[0],
      reviewer: '데모 OP'
    };
  }

  // 최종 결정 저장 (시뮬레이션)
  saveFinalDecision(proposalId, decision, reason, adoptedObjections = []) {
    if (!this.finalDecisions) {
      this.finalDecisions = {};
    }
    this.finalDecisions[proposalId] = {
      decision,
      reason,
      adoptedObjections,
      date: new Date().toISOString().split('T')[0],
      reviewer: 'TOP-OP'
    };
  }

  // DAO 공지사항 추가
  addDAOAnnouncement(proposalId, type, reason, adoptedObjections = []) {
    if (!this.daoAnnouncements) {
      this.daoAnnouncements = {};
    }

    // 제안 정보 찾기
    const proposal = this.findProposalById(proposalId);
    if (!proposal) return;

    const daoId = proposal.daoId;
    if (!this.daoAnnouncements[daoId]) {
      this.daoAnnouncements[daoId] = [];
    }

    const announcement = {
      id: `ann-${Date.now()}`,
      proposalId,
      proposalTitle: proposal.title,
      type, // 'rejected', 'final-approved', 'final-rejected'
      reason,
      adoptedObjections,
      date: new Date().toISOString().split('T')[0],
      author: type === 'rejected' ? '데모 OP' : 'TOP-OP'
    };

    this.daoAnnouncements[daoId].unshift(announcement);
  }

  // 이의신청 채택 DCA 자동 검증 처리
  processObjectionAdoptionDCA(adoptedObjections) {
    if (!this.contributionHistory) {
      this.contributionHistory = [];
    }

    adoptedObjections.forEach(adoption => {
      // 이의신청 채택 DCA 자동 검증
      const dcaVerification = {
        id: `dca-adoption-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'ops-review',
        title: 'Ops검토: 이의신청 채택',
        description: `이의신청이 TOP-OP에 의해 채택되어 자동으로 검증되었습니다.`,
        bValue: 160, // DCA 가치 160B
        pValue: 0.16, // P-Token 0.16P
        date: new Date().toISOString().split('T')[0],
        status: 'verified',
        verifiedBy: 'System (TOP-OP 이의신청 채택)',
        contributor: adoption.objector,
        dao: 'Operations DAO',
        autoVerified: true,
        adoptionReason: `TOP-OP 최종거부 시 이의신청이 채택됨`
      };

      this.contributionHistory.unshift(dcaVerification);

      // 사용자 토큰 잔액 업데이트 (시뮬레이션)
              if (adoption.objector === '김한글' || adoption.objector === 'Community DAO OP' || adoption.objector === 'Operations DAO OP' || adoption.objector === '김운영') {
        // 현재 사용자가 이의신청자인 경우 실제 토큰 증가
        this.updateUserTokensFromDCA(dcaVerification.bValue, dcaVerification.pValue);
      }
    });

    console.log(`${adoptedObjections.length}건의 이의신청 채택 DCA가 자동 검증되었습니다.`);
  }

  // DCA 검증으로 인한 토큰 업데이트
  updateUserTokensFromDCA(bValue, pValue) {
    // B-Token 업데이트
    const currentBToken = parseFloat(document.getElementById('bTokenBalance')?.textContent?.replace(' B', '') || '0');
    const newBToken = currentBToken + bValue;
    if (document.getElementById('bTokenBalance')) {
      document.getElementById('bTokenBalance').textContent = `${newBToken.toFixed(3)} B`;
    }
    if (document.getElementById('bTokenMain')) {
      document.getElementById('bTokenMain').textContent = `${newBToken.toFixed(3)} B`;
    }

    // P-Token 업데이트 (Operations DAO)
    const ptokenElements = document.querySelectorAll('[data-dao="ops-dao"] .ptoken-balance');
    ptokenElements.forEach(element => {
      const currentPToken = parseFloat(element.textContent.replace(' P', '') || '0');
      const newPToken = currentPToken + pValue;
      element.textContent = `${newPToken.toFixed(2)} P`;
    });

    console.log(`DCA 검증: B-Token +${bValue}B, P-Token +${pValue}P (Operations DAO)`);
  }

  // 제안 ID로 제안 찾기
  findProposalById(proposalId) {
    console.log(`🔍 findProposalById 시작: ${proposalId}`);
    
    // 최종 검토 제안들에서 먼저 찾기 (더 완전한 데이터)
    const finalProposals = this.getProposalsForFinalReview();
    let proposal = finalProposals.find(p => p.id === proposalId);
    if (proposal) {
      console.log(`✅ 최종검토에서 발견:`, proposal);
      console.log(`📋 이의신청 데이터:`, proposal.objections);
      // 실제 OP 결정 데이터로 업데이트
      proposal = this.enrichProposalWithOPData(proposal);
      return proposal;
    }
    
    // OP 검토 제안들에서도 찾기
    const userOPRole = this.getUserOPRole();
    const myDAOProposals = this.getProposalsForOPReview(userOPRole.opDAOs);
    proposal = myDAOProposals.find(p => p.id === proposalId);
    if (proposal) {
      console.log(`✅ OP검토에서 발견:`, proposal);
      proposal = this.enrichProposalWithOPData(proposal);
      return proposal;
    }
    
    // Ops 검토 제안들에서 찾기
    const opsProposals = this.getProposalsForObjection();
    proposal = opsProposals.find(p => p.id === proposalId);
    if (proposal) {
      console.log(`✅ Ops검토에서 발견:`, proposal);
      proposal = this.enrichProposalWithOPData(proposal);
      return proposal;
    }
    
    // 모든 DAO의 모든 제안에서 찾기 (마지막 순서로 변경)
    const allProposals = this.loadAllProposals();
    proposal = allProposals.find(p => p.id === proposalId);
    if (proposal) {
      console.log(`✅ 전체제안에서 발견:`, proposal);
      return proposal;
    }
    
    console.log(`❌ 제안을 찾을 수 없음: ${proposalId}`);
    return null;
  }

  // 제안에 실제 OP 결정 데이터 반영
  enrichProposalWithOPData(proposal) {
    if (!proposal) return proposal;
    
    // 저장된 OP 결정 확인
    const opDecision = this.opDecisions?.[proposal.id];
    if (opDecision) {
      console.log(`🔄 OP 결정 데이터 동기화:`, opDecision);
      
      // OP 결정 데이터를 제안에 반영
      proposal.opDecision = opDecision.decision;
      proposal.opReviewComment = opDecision.reason;
      proposal.opApprovedDate = opDecision.date;
      proposal.opReviewer = opDecision.reviewer;
      
      // 승인된 경우에만 Ops 검토 단계로 진행
      if (opDecision.decision === 'approve') {
        proposal.status = 'ops-dao-review';
        proposal.reviewStage = 'ops-dao-objection';
      }
    }
    
    // 저장된 이의신청 확인
    const objection = this.objections?.[proposal.id];
    if (objection) {
      console.log(`🔄 이의신청 데이터 동기화:`, objection);
      
      // 기존 이의신청 배열에 실제 사용자 이의신청 추가
      if (!proposal.objections) {
        proposal.objections = [];
      }
      
      // 중복 방지: 이미 동일한 이의신청이 있는지 확인
      const existingObjection = proposal.objections.find(obj => 
        obj.objector === objection.objector && obj.reason === objection.reason
      );
      
      if (!existingObjection) {
        proposal.objections.push({
          id: `obj-user-${Date.now()}`,
          objector: objection.objector,
          objectorName: objection.objector,
          objectorRole: this.getUserOPRole().opDAOs.length > 0 ? `${this.getUserOPRole().opDAOs[0]} OP` : 'OP',
          date: objection.date,
          reason: objection.reason,
          details: objection.details,
          response: null, // 제안자 응답은 별도 처리
          resolved: false
        });
      }
    }
    
        return proposal;
  }

  // 제안 워크플로우 상태 업데이트
  updateProposalWorkflowStatus(proposalId, decision) {
    console.log(`🔄 워크플로우 업데이트: ${proposalId} → ${decision}`);
    
    // 모든 DAO에서 해당 제안 찾기 및 상태 업데이트
    const allDAOs = ['dev-dao', 'community-dao', 'ops-dao', 'political-dao'];
    
    for (const daoId of allDAOs) {
      const daoProposals = this.getDAOProposals(daoId);
      const proposalIndex = daoProposals.findIndex(p => p.id === proposalId);
      
      if (proposalIndex !== -1) {
        const proposal = daoProposals[proposalIndex];
        console.log(`📝 ${daoId}에서 제안 발견, 상태 업데이트 중...`);
        
        if (decision === 'approve') {
          // OP 승인: Ops 검토 단계로 이동
          proposal.status = 'ops-dao-review';
          proposal.reviewStage = 'ops-dao-objection';
          proposal.opDecision = 'approved';
          proposal.objectionStartDate = new Date().toISOString().split('T')[0];
          proposal.objectionDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 7일 후
          
          console.log(`✅ 제안 ${proposalId}이 Ops 검토 단계로 이동`);
        } else {
          // OP 거부: 거부 상태로 설정
          proposal.status = 'rejected';
          proposal.opDecision = 'rejected';
          
          console.log(`❌ 제안 ${proposalId}이 거부됨`);
        }
        
        // 동적 제안 데이터에도 반영
        if (!this.dynamicProposals) {
          this.dynamicProposals = {};
        }
        if (!this.dynamicProposals[daoId]) {
          this.dynamicProposals[daoId] = [];
        }
        
        // 기존 동적 제안 업데이트 또는 새로 추가
        const dynamicIndex = this.dynamicProposals[daoId].findIndex(p => p.id === proposalId);
        if (dynamicIndex !== -1) {
          this.dynamicProposals[daoId][dynamicIndex] = proposal;
        } else {
          this.dynamicProposals[daoId].push(proposal);
        }
        
        break; // 제안을 찾았으므로 더 이상 검색하지 않음
      }
        }
  }

  // 제안에 이의신청 반영
  updateProposalWithObjection(proposalId) {
    console.log(`🔄 이의신청 반영: ${proposalId}`);
    
    const objection = this.objections?.[proposalId];
    if (!objection) return;
    
    // 모든 데이터 소스에서 제안 찾기 및 업데이트
    const allDAOs = ['dev-dao', 'community-dao', 'ops-dao', 'political-dao'];
    
    for (const daoId of allDAOs) {
      const daoProposals = this.getDAOProposals(daoId);
      const proposal = daoProposals.find(p => p.id === proposalId);
      
      if (proposal) {
        console.log(`📝 ${daoId}에서 제안 발견, 이의신청 추가 중...`);
        
        if (!proposal.objections) {
          proposal.objections = [];
        }
        
        // 중복 방지
        const existingObjection = proposal.objections.find(obj => 
          obj.objector === objection.objector && obj.reason === objection.reason
        );
        
        if (!existingObjection) {
          proposal.objections.push({
            id: `obj-user-${Date.now()}`,
            objector: objection.objector,
            objectorName: objection.objector,
            objectorRole: this.getUserOPRole().opDAOs.length > 0 ? `${this.getUserOPRole().opDAOs[0]} OP` : 'OP',
            date: objection.date,
            reason: objection.reason,
            details: objection.details,
            response: null,
            resolved: false
          });
          
          console.log(`✅ 이의신청이 제안 ${proposalId}에 추가됨`);
        }
        
        break;
      }
    }
  }
   
      // 제안 상세보기 (공지사항에서 호출)
  viewProposalDetail(proposalId) {
    const proposal = this.findProposalById(proposalId);
    if (!proposal) {
      this.showErrorMessage('제안 정보를 찾을 수 없습니다.');
      return;
    }
    
    // 제안 상세 모달 표시
    this.showProposalDetailModal(proposal, 0, 100000, 0, 50);
  }

  // DAO 검색 기능
  searchDAOs(searchTerm) {
    const clearBtn = document.querySelector('.clear-search-btn');
    
    // 검색어가 있으면 X 버튼 표시
    if (searchTerm.trim()) {
      clearBtn.style.display = 'block';
    } else {
      clearBtn.style.display = 'none';
    }

    // 검색 결과 필터링
    this.filterDAOsBySearch(searchTerm);
  }

  // 검색어 초기화
  clearDAOSearch() {
    const searchInput = document.getElementById('daoSearchInput');
    const clearBtn = document.querySelector('.clear-search-btn');
    
    searchInput.value = '';
    clearBtn.style.display = 'none';
    
    // 모든 DAO 표시
    this.filterDAOsBySearch('');
  }

  // 검색어로 DAO 필터링
  filterDAOsBySearch(searchTerm) {
    const allCards = document.querySelectorAll('#daoGrid .my-dao-card');
    const searchLower = searchTerm.toLowerCase();

    allCards.forEach(card => {
      const daoName = card.querySelector('h4')?.textContent.toLowerCase() || '';
      const daoDescription = card.querySelector('p')?.textContent.toLowerCase() || '';
      
      const isMatch = !searchTerm || 
                     daoName.includes(searchLower) || 
                     daoDescription.includes(searchLower);
      
      if (isMatch) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });

    // 검색 결과가 없는 경우 메시지 표시
    this.checkDAOSearchResults(searchTerm);
  }

  // 검색 결과 확인
  checkDAOSearchResults(searchTerm) {
    const visibleCards = document.querySelectorAll('#daoGrid .my-dao-card[style*="block"], #daoGrid .my-dao-card:not([style*="none"])');
    const grid = document.getElementById('daoGrid');
    
    // 기존 검색 결과 메시지 제거
    const existingMessage = grid.querySelector('.dao-search-empty');
    if (existingMessage) {
      existingMessage.remove();
    }

    // 검색어가 있고 결과가 없는 경우
    if (searchTerm.trim() && visibleCards.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'dao-search-empty empty-state';
      emptyMessage.innerHTML = `
        <i class="fas fa-search"></i>
        <h3>"${searchTerm}"에 대한 검색 결과가 없습니다</h3>
        <p>다른 검색어로 시도해보세요</p>
      `;
      grid.appendChild(emptyMessage);
    }
  }

  // DAO 리스트 필터 전환
  switchDAOListFilter(filterType) {
    // 활성 버튼 업데이트
    document.querySelectorAll('.dao-nav-filter .dao-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const targetBtn = document.querySelector(`.dao-nav-filter [data-dao="${filterType}"]`);
    if (targetBtn) {
      targetBtn.classList.add('active');
    }

    // 필터링 적용
    this.applyDAOListFilter(filterType);
  }

  // DAO 리스트 필터 적용
  applyDAOListFilter(filterType) {
    const allCards = document.querySelectorAll('#daoGrid .my-dao-card');
    
    allCards.forEach(card => {
      const daoId = card.getAttribute('data-dao-id') || '';
      let shouldShow = false;

      switch (filterType) {
        case 'all':
          shouldShow = true;
          break;
        case 'my':
          // 사용자가 속한 DAO만 표시
          shouldShow = this.isUserMemberOfDAO(daoId);
          break;
        case 'popular':
          // 인기 DAO (멤버 수 기준)
          shouldShow = this.isPopularDAO(daoId);
          break;
        case 'recent':
          // 최근 생성된 DAO
          shouldShow = this.isRecentDAO(daoId);
          break;
        default:
          // 특정 DAO로 스크롤
          if (filterType !== 'all') {
            this.scrollToDAOCard(filterType);
            return;
          }
          shouldShow = true;
      }

      card.style.display = shouldShow ? 'block' : 'none';
    });

    // 필터 결과 확인
    this.checkDAOFilterResults(filterType);
  }

  // 사용자가 DAO 멤버인지 확인
  isUserMemberOfDAO(daoId) {
    const userDAOs = this.getUserDAOList();
    return userDAOs.includes(daoId);
  }

  // 인기 DAO 확인 (임시 로직)
  isPopularDAO(daoId) {
    const popularDAOs = ['dev-dao', 'community-dao', 'ops-dao'];
    return popularDAOs.includes(daoId);
  }

  // 최근 생성 DAO 확인 (임시 로직)
  isRecentDAO(daoId) {
    const recentDAOs = ['defi-dao', 'art-dao'];
    return recentDAOs.includes(daoId);
  }

  // DAO 카드로 스크롤
  scrollToDAOCard(daoId) {
    const targetCard = document.querySelector(`[data-dao-id="${daoId}"]`);
    if (targetCard) {
      targetCard.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // 강조 효과
      targetCard.style.transform = 'scale(1.02)';
      targetCard.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.3)';
      
      setTimeout(() => {
        targetCard.style.transform = '';
        targetCard.style.boxShadow = '';
      }, 2000);
    }
  }

  // 필터 결과 확인
  checkDAOFilterResults(filterType) {
    const visibleCards = document.querySelectorAll('#daoGrid .my-dao-card[style*="block"], #daoGrid .my-dao-card:not([style*="none"])');
    const grid = document.getElementById('daoGrid');
    
    // 기존 필터 결과 메시지 제거
    const existingMessage = grid.querySelector('.dao-filter-empty');
    if (existingMessage) {
      existingMessage.remove();
    }

    // 결과가 없는 경우
    if (visibleCards.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'dao-filter-empty empty-state';
      
      const filterLabels = {
        'my': '내가 속한 DAO',
        'popular': '인기 DAO',
        'recent': '최근 생성된 DAO'
      };
      
      const filterLabel = filterLabels[filterType] || 'DAO';
      
      emptyMessage.innerHTML = `
        <i class="fas fa-users"></i>
        <h3>${filterLabel}가 없습니다</h3>
        <p>조건에 해당하는 DAO가 없습니다</p>
      `;
      grid.appendChild(emptyMessage);
    }
  }

  // 개별 DAO 필터 버튼 업데이트
  updateDAOListButtons() {
    const container = document.getElementById('daoListButtons');
    if (!container) return;

    const userDAOs = this.getUserDAOList();
    const daoData = this.getUserMyDAOsData();
    
    container.innerHTML = userDAOs.map(daoId => {
      const dao = daoData[daoId];
      if (!dao) return '';
      
      return `
        <button class="dao-filter-btn" data-dao="${daoId}" onclick="window.dapp.switchDAOListFilter('${daoId}')">
          <i class="${dao.icon}"></i>
          <span>${dao.name}</span>
        </button>
      `;
    }).join('');
  }

  // 제안 검색 기능
  searchProposals(searchTerm) {
    const clearBtn = document.querySelector('#proposalSearchInput + .clear-search-btn');
    
    // 검색어가 있으면 X 버튼 표시
    if (searchTerm.trim()) {
      clearBtn.style.display = 'block';
    } else {
      clearBtn.style.display = 'none';
    }

    // 검색 결과 필터링
    this.filterProposalsBySearch(searchTerm);
  }

  // 제안 검색어 초기화
  clearProposalSearch() {
    const searchInput = document.getElementById('proposalSearchInput');
    const clearBtn = document.querySelector('#proposalSearchInput + .clear-search-btn');
    
    searchInput.value = '';
    clearBtn.style.display = 'none';
    
    // 모든 제안 표시
    this.filterProposalsBySearch('');
  }

  // 검색어로 제안 필터링
  filterProposalsBySearch(searchTerm) {
    const allCards = document.querySelectorAll('#activeProposals .proposal-card, #activeProposals .proposal-stage-card');
    const searchLower = searchTerm.toLowerCase();

    allCards.forEach(card => {
      const proposalTitle = card.querySelector('.proposal-compact-title, .proposal-title')?.textContent.toLowerCase() || '';
      const proposalDescription = card.querySelector('.proposal-compact-description, .proposal-description')?.textContent.toLowerCase() || '';
      const proposer = card.querySelector('.proposer-compact')?.textContent.toLowerCase() || '';
      const daoName = card.querySelector('.dao-mini-tag, .dao-name')?.textContent.toLowerCase() || '';
      
      const isMatch = !searchTerm || 
                     proposalTitle.includes(searchLower) || 
                     proposalDescription.includes(searchLower) ||
                     proposer.includes(searchLower) ||
                     daoName.includes(searchLower);
      
      if (isMatch) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });

    // 검색 결과가 없는 경우 메시지 표시
    this.checkProposalSearchResults(searchTerm);
  }

  // 제안 검색 결과 확인
  checkProposalSearchResults(searchTerm) {
    const visibleCards = document.querySelectorAll('#activeProposals .proposal-card[style*="block"], #activeProposals .proposal-stage-card[style*="block"], #activeProposals .proposal-card:not([style*="none"]), #activeProposals .proposal-stage-card:not([style*="none"])');
    const container = document.getElementById('activeProposals');
    
    // 기존 검색 결과 메시지 제거
    const existingMessage = container.querySelector('.proposal-search-empty');
    if (existingMessage) {
      existingMessage.remove();
    }

    // 검색어가 있고 결과가 없는 경우
    if (searchTerm.trim() && visibleCards.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'proposal-search-empty empty-state';
      emptyMessage.innerHTML = `
        <i class="fas fa-search"></i>
        <h3>"${searchTerm}"에 대한 검색 결과가 없습니다</h3>
        <p>다른 검색어로 시도해보세요</p>
      `;
      container.appendChild(emptyMessage);
    }
  }

  // 로딩 메시지 표시
  showLoadingMessage(message) {
    this.hideLoadingMessage(); // 기존 로딩 메시지 제거
    
    const loading = document.createElement('div');
    loading.id = 'loadingMessage';
    loading.className = 'loading-overlay';
    loading.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(loading);
  }

  // 로딩 메시지 숨기기
  hideLoadingMessage() {
    const loading = document.getElementById('loadingMessage');
    if (loading && loading.parentNode) {
      document.body.removeChild(loading);
    }
  }

  showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.innerHTML = `
      <i class="fas fa-exclamation-circle"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  // 대시보드 카드 필터 관련 메서드들
  switchDashboardFilter(cardType) {
    // 필터 버튼 활성화 상태 업데이트
    const buttons = document.querySelectorAll('.dashboard-filter-btn');
    buttons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.card === cardType) {
        btn.classList.add('active');
      }
    });

    // 카드 필터링 적용
    this.applyDashboardFilter(cardType);
  }

  applyDashboardFilter(cardType) {
    const cards = document.querySelectorAll('.dashboard-grid > div[data-card]');
    
    cards.forEach(card => {
      if (cardType === 'all' || card.dataset.card === cardType) {
        card.style.display = 'block';
        // 부드러운 나타나기 애니메이션
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        setTimeout(() => {
          card.style.transition = 'all 0.3s ease';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, 50);
      } else {
        card.style.display = 'none';
      }
    });

    // 필터 결과가 없을 때 메시지 표시
    this.checkDashboardFilterResults(cardType);
  }

  checkDashboardFilterResults(cardType) {
    const visibleCards = document.querySelectorAll(`.dashboard-grid > div[data-card="${cardType}"]`);
    const container = document.querySelector('.dashboard-grid');
    
    // 기존 빈 상태 메시지 제거
    const existingEmptyState = container.querySelector('.empty-dashboard-state');
    if (existingEmptyState) {
      existingEmptyState.remove();
    }

    if (cardType !== 'all' && visibleCards.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-dashboard-state empty-state';
      emptyState.innerHTML = `
        <i class="fas fa-search"></i>
        <p>선택한 카드가 없습니다</p>
        <small>다른 필터를 선택해보세요</small>
      `;
      container.appendChild(emptyState);
    }
  }

  // 기여 유형에 따른 아이콘 반환
  getContributionIcon(description) {
    const desc = description.toLowerCase();
    
    if (desc.includes('풀리퀘스트') || desc.includes('코드') || desc.includes('리뷰')) {
      return 'fas fa-code';
    } else if (desc.includes('초대') || desc.includes('구성원')) {
      return 'fas fa-user-plus';
    } else if (desc.includes('ops') || desc.includes('검토') || desc.includes('이의신청')) {
      return 'fas fa-shield-alt';
    } else if (desc.includes('제안') || desc.includes('투표')) {
      return 'fas fa-vote-yea';
    } else if (desc.includes('문서') || desc.includes('가이드')) {
      return 'fas fa-file-alt';
    } else if (desc.includes('번역') || desc.includes('언어')) {
      return 'fas fa-language';
    } else if (desc.includes('보안') || desc.includes('감사')) {
      return 'fas fa-lock';
    } else if (desc.includes('마케팅') || desc.includes('홍보')) {
      return 'fas fa-bullhorn';
    } else {
      return 'fas fa-tasks'; // 기본 아이콘
    }
  }

  // 검증자 DAO 이동 및 강조
  navigateToValidatorDAO() {
    // 1. DAO 탭으로 이동
    const daoTab = document.querySelector('.tab-btn[data-tab="dao"]');
    if (daoTab) {
      daoTab.click();
    }
    
    // 2. 잠시 후 검증자 DAO 카드 찾기 및 강조
    setTimeout(() => {
      this.findAndHighlightValidatorDAO();
    }, 300);
  }

  // 검증자 DAO 찾기 및 강조
  findAndHighlightValidatorDAO() {
    // 검증자 DAO 카드 찾기
    const validatorDAOCard = document.querySelector('.dao-card[data-dao-id="validator-dao"]');
    
    if (validatorDAOCard) {
      // 검증자 DAO로 스크롤
      validatorDAOCard.scrollIntoView({ 
        behavior: 'smooth',
        block: 'center'
      });
      
      // 강조 애니메이션 적용
      validatorDAOCard.classList.add('highlight-animation');
      setTimeout(() => {
        validatorDAOCard.classList.remove('highlight-animation');
      }, 3000);
      
      this.showSuccessMessage('검증자 DAO로 이동했습니다. 기여하러가기 버튼을 클릭하여 참여하세요!');
    } else {
      // 검증자 DAO 카드가 없으면 메시지 표시
      this.showErrorMessage('검증자 DAO를 찾을 수 없습니다. 먼저 검증자 활동을 시작해보세요.');
    }
  }

  // DAO 상세 정보 모달 관련 기능들
  showDAODetail(daoId) {
    const modal = document.getElementById('daoDetailModal');
    if (!modal) return;

    // DAO 기본 정보 로드
    this.loadDAODetailData(daoId);
    
    // 기본적으로 기여내역 탭 활성화
    this.switchDAODetailTab('contribution');
    
    // DAO 세부 모달 탭에 알림 표시
    this.updateDAODetailTabNotifications(daoId);
    
    modal.classList.add('active');
  }

  closeDAODetailModal() {
    const modal = document.getElementById('daoDetailModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  switchDAODetailTab(tabType) {
    // 탭 버튼 활성화 상태 변경
    const tabBtns = document.querySelectorAll('.dao-detail-tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabType) {
        btn.classList.add('active');
      }
    });

    // 탭 콘텐츠 표시/숨김
    const tabContents = document.querySelectorAll('.dao-detail-tab-content');
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `daoDetail${tabType.charAt(0).toUpperCase() + tabType.slice(1)}`) {
        content.classList.add('active');
      }
    });

    // 각 탭별 데이터 로드 및 해당 타입 알림 클리어
    const currentDAOId = this.getCurrentDAOId();
    if (currentDAOId) {
      switch(tabType) {
        case 'contribution':
          this.loadDAOContributions(currentDAOId);
          // 기여내역 알림 클리어
          this.clearDAONotification(currentDAOId, 'contribution');
          break;
        case 'participation':
          this.loadDAOParticipation(currentDAOId);
          // 참정내역 알림 클리어
          this.clearDAONotification(currentDAOId, 'participation');
          break;
      }
      
      // 탭 알림 다시 업데이트
      this.updateDAODetailTabNotifications(currentDAOId);
    }
  }

  loadDAODetailData(daoId) {
    const dao = this.getDAOData(daoId);
    if (!dao) return;

    // 제목 업데이트
    const titleElement = document.getElementById('daoDetailTitle');
    if (titleElement) {
      titleElement.textContent = `${dao.name} 상세 정보`;
    }

    // 현재 DAO ID 저장
    this.currentDAOId = daoId;
  }

  async loadDAOContributions(daoId) {
    const contributionList = document.getElementById('daoContributionList');

    if (!contributionList) return;

    // 먼저 로딩 표시
    contributionList.innerHTML = `
      <div class="dao-contribution-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>기여 내역을 불러오는 중...</p>
      </div>
    `;

    // 서버에서 최신 기여 데이터 로드
    await this.loadContributionData(daoId);

    // 기여내역 데이터 가져오기
    const contributions = this.getDAOContributionsData(daoId);

    // 기여내역 리스트 렌더링
    if (contributions.length === 0) {
      contributionList.innerHTML = `
        <div class="dao-contribution-empty">
          <div class="empty-icon">
            <i class="fas fa-tasks"></i>
          </div>
          <div class="empty-content">
            <h4>아직 기여내역이 없습니다</h4>
            <p>이 DAO에서 DCA를 완료하면 기여내역이 여기에 표시됩니다.</p>
          </div>
        </div>
      `;
    } else {
      contributionList.innerHTML = contributions.map((contrib, index) => {
        const daoNotifications = this.notifications?.dao?.[daoId] || { contribution: 0, participation: 0 };
        const hasNewContribution = index < daoNotifications.contribution;
        
        return `
          <div class="dao-contribution-item ${hasNewContribution ? 'new-item' : ''}">
          <div class="contribution-icon">
            <i class="${this.getContributionIcon(contrib.description)}"></i>
              ${hasNewContribution ? '<div class="item-notification-badge">NEW</div>' : ''}
          </div>
          <div class="contribution-details">
            <div class="contribution-description">${contrib.description}</div>
            <div class="contribution-date">${this.formatDate(contrib.date)}</div>
          </div>
          <div class="contribution-value-section">
            <div class="contribution-b-value">+${contrib.value}B</div>
          </div>
        </div>
        `;
      }).join('');
    }
  }

  loadDAOParticipation(daoId) {
    const participationList = document.getElementById('daoParticipationList');

    if (!participationList) return;

    // 모의 참정내역 데이터
    const participation = this.getDAOParticipationData(daoId);

    // 참정내역 리스트 렌더링
    if (participation.length === 0) {
      participationList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-vote-yea" style="font-size: 2rem; color: var(--text-tertiary); margin-bottom: 0.5rem;"></i>
          <p>참정내역이 없습니다.</p>
        </div>
      `;
    } else {
      participationList.innerHTML = participation.map((part, index) => {
        const daoNotifications = this.notifications?.dao?.[daoId] || { contribution: 0, participation: 0 };
        const hasNewParticipation = index < daoNotifications.participation;
        
        return `
          <div class="dao-participation-item ${hasNewParticipation ? 'new-item' : ''}" onclick="window.navigateToProposal('${part.proposalId}')" style="cursor: pointer;">
          <div class="participation-icon">
            <i class="${this.getParticipationIcon(part.type)}"></i>
              ${hasNewParticipation ? '<div class="item-notification-badge">NEW</div>' : ''}
          </div>
          <div class="participation-details">
            <div class="participation-type">${this.getParticipationTypeName(part.type)}</div>
            <div class="participation-title">${part.title}</div>
            <div class="participation-date">${this.formatDate(part.date)}</div>
            <div class="participation-status" data-status="${part.currentStatus}">현재상태: ${part.currentStatus}</div>
          </div>
          <div class="participation-result">
            ${part.vote ? `<div class="participation-vote ${part.vote}">${this.getVoteDisplayName(part.vote)}</div>` : ''}
            <div class="participation-impact">${part.impact}</div>
          </div>
        </div>
        `;
      }).join('');
    }
  }

  getCurrentDAOId() {
    return this.currentDAOId;
  }

  getDAOData(daoId) {
    const myDAOs = this.getUserMyDAOsData();
    return myDAOs.find(dao => dao.id === daoId) || {
      id: daoId,
      name: 'DAO',
      description: '기본 DAO 설명',
      members: 50,
      treasury: 1000,
      proposals: 12,
      ranking: 3
    };
  }

  getDAOContributionsData(daoId) {
    // 캐시된 기여 데이터 반환
    if (this.contributionCache && this.contributionCache[daoId]) {
      return this.contributionCache[daoId].map(contribution => ({
        id: contribution.id,
        description: contribution.title || contribution.description,
        date: contribution.verifiedAt || contribution.savedAt,
        value: contribution.bValue || 0
      }));
    }
    
    // 캐시가 없으면 서버에서 로드
    this.loadContributionData(daoId);
    
    return [];
  }

  getDAOParticipationData(daoId) {
    // 실제 사용자의 참정내역만 표시 (예시 데이터 제거)
    // 로그인된 사용자의 실제 참정내역을 API에서 가져와야 함
    return [];
  }



  getParticipationIcon(type) {
    const icons = {
      'vote': 'fas fa-vote-yea',
      'proposal': 'fas fa-lightbulb',
      'comment': 'fas fa-comment'
    };
    return icons[type] || 'fas fa-circle';
  }

  getParticipationTypeName(type) {
    const names = {
      'vote': '투표 참여',
      'proposal': '제안 작성',
      'comment': '댓글 작성'
    };
    return names[type] || '기타 활동';
  }

  getVoteDisplayName(vote) {
    const names = {
      'agree': '찬성',
      'disagree': '반대',
      'abstain': '기권'
    };
    return names[vote] || vote;
  }

  // 참정내역에서 해당 제안으로 이동하는 함수
  navigateToProposal(proposalId) {
    // 1. DAO 상세 모달 닫기
    this.closeDAODetailModal();
    
    // 2. 거버넌스 탭으로 전환
    const governanceTab = document.querySelector('[data-tab="governance"]');
    if (governanceTab) {
      governanceTab.click();
    }
    
    // 3. 잠시 후 해당 제안 찾기 및 강조
    setTimeout(() => {
      this.findAndHighlightProposal(proposalId);
    }, 500);
  }

  // 제안 찾기 및 강조 함수
  findAndHighlightProposal(proposalId) {
    // 현재 거버넌스 데이터에서 해당 제안 찾기
    const allProposals = this.getAllGovernanceProposals();
    const targetProposal = allProposals.find(p => p.id === proposalId);
    
    if (!targetProposal) {
      console.log('제안을 찾을 수 없습니다:', proposalId);
      this.showErrorMessage('해당 제안을 찾을 수 없습니다.');
      return;
    }

    // 제안의 현재 단계에 따라 적절한 거버넌스 과정으로 이동
    const processType = this.getProposalProcessType(targetProposal);
    this.switchGovernanceProcess(processType);
    
    // 잠시 후 제안 카드 찾기 및 강조
    setTimeout(() => {
      const proposalElement = document.querySelector(`[data-proposal-id="${proposalId}"]`);
      if (proposalElement) {
        // 해당 제안으로 스크롤
        proposalElement.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
        
        // 제안 강조 애니메이션
        proposalElement.classList.add('highlight-animation');
        setTimeout(() => {
          proposalElement.classList.remove('highlight-animation');
        }, 3000);
        
        this.showSuccessMessage('해당 제안으로 이동했습니다.');
      } else {
        // 제안 카드가 없으면 제안 상세 모달 열기
        this.showProposalDetailModal(targetProposal);
      }
    }, 300);
  }

  // 모든 거버넌스 제안 가져오기 (기존 데이터와 연동)
  getAllGovernanceProposals() {
    const devProposals = this.getDAOProposals('dev-dao');
    const commProposals = this.getDAOProposals('community-dao');
    const opsProposals = this.getDAOProposals('ops-dao');
    
    return [...devProposals, ...commProposals, ...opsProposals];
  }

  // 제안의 현재 단계에 따른 거버넌스 과정 결정
  getProposalProcessType(proposal) {
    const status = proposal.status;
    
    // 모금 중이면 proposal 과정
    if (status === 'active' || status === 'funding') {
      return 'proposal';
    }
    
    // 투표 중이면 voting 과정
    if (status === 'voting') {
      return 'voting';
    }
    
    // 검토 단계면 review 과정
    if (status === 'dao-op' || status === 'ops-dao' || status === 'top-op') {
      return 'review';
    }
    
    // 기본값은 proposal
    return 'proposal';
  }

  // DAO 설립 상세 모달 표시
  showDAOCreationReviewModal(proposalId) {
    const proposal = this.pendingDAOCreations?.find(p => p.id === proposalId);
    if (!proposal) return;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'daoCreationReviewModal';
    
    modal.innerHTML = `
      <div class="modal-content dao-creation-review-modal">
        <div class="modal-header">
          <h3><i class="fas fa-building"></i> DAO 설립 제안 검토</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="dao-creation-review-header">
            <div class="proposal-basic-info">
              <h4>${proposal.title}</h4>
              <div class="proposal-meta">
                <span><i class="fas fa-user"></i> 제안자: ${proposal.proposer}</span>
                <span><i class="fas fa-calendar"></i> 제출일: ${this.formatDate(proposal.submissionDate)}</span>
                <span><i class="fas fa-coins"></i> 담보: ${proposal.stakeAmount}P</span>
              </div>
            </div>
          </div>

          <div class="dao-creation-details">
            <div class="detail-section">
              <h5><i class="fas fa-tag"></i> DAO 이름</h5>
              <p>${proposal.daoData.name}</p>
            </div>

            <div class="detail-section">
              <h5><i class="fas fa-bullseye"></i> 설립 목적</h5>
              <p>${proposal.daoData.purpose}</p>
            </div>

            <div class="detail-section">
              <h5><i class="fas fa-chart-line"></i> DCA (기여도 평가 기준)</h5>
              <p>${proposal.daoData.dca}</p>
            </div>

            <div class="detail-section">
              <h5><i class="fas fa-shield-alt"></i> 검증 기준</h5>
              <p>${proposal.daoData.validation}</p>
            </div>

            ${proposal.daoData.initialMembers ? `
              <div class="detail-section">
                <h5><i class="fas fa-users"></i> 초기 구성원 계획</h5>
                <p>${proposal.daoData.initialMembers}</p>
              </div>
            ` : ''}
          </div>

          <div class="dao-creation-protocol-info">
            <h5><i class="fas fa-info-circle"></i> 프로토콜 규정</h5>
            <div class="protocol-rules">
              <div class="rule-item">
                <i class="fas fa-check-circle"></i>
                <span>승인 시 제안자가 <strong>Initial-OP</strong>가 됩니다</span>
              </div>
              <div class="rule-item">
                <i class="fas fa-exclamation-triangle"></i>
                <span>거부 시 담보의 <strong>절반(15P)</strong>만 반환됩니다</span>
              </div>
              <div class="rule-item">
                <i class="fas fa-gavel"></i>
                <span>Ops-DAO의 검토를 통해 결정됩니다</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
            닫기
          </button>
          <button type="button" class="btn-danger" onclick="window.dapp.rejectDAOCreation('${proposalId}')">
            <i class="fas fa-times"></i>
            거부 (15P 반환)
          </button>
          <button type="button" class="btn-primary" onclick="window.dapp.approveDAOCreation('${proposalId}')">
            <i class="fas fa-check"></i>
            승인 (Initial-OP 부여)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // DAO 설립 승인
  async approveDAOCreation(proposalId) {
    const proposal = this.pendingDAOCreations?.find(p => p.id === proposalId);
    if (!proposal) return;

    const confirmed = confirm(
      `"${proposal.daoData.name}" DAO 설립을 승인하시겠습니까?\n\n` +
      `• 제안자 "${proposal.proposer}"가 Initial-OP가 됩니다\n` +
      `• 새로운 DAO가 정식으로 설립됩니다\n` +
      `• 담보 30P는 반환되지 않습니다`
    );

    if (!confirmed) return;

    try {
      // 모달 닫기
      const modal = document.getElementById('daoCreationReviewModal');
      if (modal) modal.remove();

      // 시뮬레이션 지연
      await new Promise(resolve => setTimeout(resolve, 1000));

      // DAO 설립 처리
      this.processDAOCreationApproval(proposal);
      
      // 성공 메시지
      this.showSuccessMessage(`"${proposal.daoData.name}" DAO 설립이 승인되었습니다! 제안자가 Initial-OP로 임명되었습니다.`);
      
      // OP 검토 목록 새로고침
      this.loadOpsReviews();
      
    } catch (error) {
      console.error('DAO 설립 승인 실패:', error);
      this.showErrorMessage('DAO 설립 승인 중 오류가 발생했습니다.');
    }
  }

  // DAO 설립 거부
  async rejectDAOCreation(proposalId) {
    const proposal = this.pendingDAOCreations?.find(p => p.id === proposalId);
    if (!proposal) return;

    const confirmed = confirm(
      `"${proposal.daoData.name}" DAO 설립을 거부하시겠습니까?\n\n` +
      `• 담보 30P 중 15P만 반환됩니다\n` +
      `• DAO 설립이 취소됩니다\n` +
      `• 이 결정은 되돌릴 수 없습니다`
    );

    if (!confirmed) return;

    try {
      // 모달 닫기
      const modal = document.getElementById('daoCreationReviewModal');
      if (modal) modal.remove();

      // 시뮬레이션 지연
      await new Promise(resolve => setTimeout(resolve, 1000));

      // DAO 설립 거부 처리
      this.processDAOCreationRejection(proposal);
      
      // 성공 메시지
      this.showSuccessMessage(`"${proposal.daoData.name}" DAO 설립이 거부되었습니다. 제안자에게 15P가 반환됩니다.`);
      
      // OP 검토 목록 새로고침
      this.loadOpsReviews();
      
    } catch (error) {
      console.error('DAO 설립 거부 실패:', error);
      this.showErrorMessage('DAO 설립 거부 중 오류가 발생했습니다.');
    }
  }

  // DAO 설립 승인 처리
  processDAOCreationApproval(proposal) {
    // DAO 설립 제안 목록에서 제거
    this.pendingDAOCreations = this.pendingDAOCreations.filter(p => p.id !== proposal.id);
    
    // 새로운 DAO ID 생성
    const newDAOId = proposal.daoData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-dao';
    
    // 새 DAO 객체 생성
    const newDAO = {
      id: newDAOId,
      name: proposal.daoData.name,
      description: proposal.daoData.description || '새로운 DAO입니다.',
      memberCount: 1, // 이니셜 OP
      totalContributions: 0,
      participationGuide: '이 DAO에 참여하여 기여해보세요.',
      contributionType: 'custom',
      contributionButtonText: '기여하기',
      contributionGuide: '기여 방법은 DAO 운영진에게 문의해주세요.',
      dcas: proposal.daoData.proposedDCAs || [],
      initialOP: proposal.proposer,
      createdAt: new Date().toISOString(),
      createdBy: proposal.proposer
    };
    
    // 새로운 DAO를 사용자 DAO 목록에 추가
    this.addNewDAOToUserList(newDAO);
    
    // 새 DAO를 DAO 목록에 추가 (실제로는 블록체인에 저장)
    console.log(`새 DAO 설립: ${proposal.daoData.name} (ID: ${newDAOId})`);
    console.log(`Initial-OP: ${proposal.proposer}`);
    console.log('DAO 데이터:', proposal.daoData);
    console.log('생성된 DAO 객체:', newDAO);
  }

  // DAO 설립 거부 처리
  processDAOCreationRejection(proposal) {
    // DAO 설립 제안 목록에서 제거
    this.pendingDAOCreations = this.pendingDAOCreations.filter(p => p.id !== proposal.id);
    
    // 담보의 절반(15P) 반환 (실제로는 블록체인 트랜잭션)
    console.log(`DAO 설립 거부: ${proposal.daoData.name}`);
    console.log(`담보 반환: 15P → ${proposal.proposer}`);
  }

  // 프로필 사진 보기 모달 표시
  showProfileView(contactId) {
    const contact = this.getContactInfo(contactId);
    
    const modal = document.getElementById('profileViewModal');
    const imageContainer = document.querySelector('.profile-view-body');
    const name = document.getElementById('profileViewName');
    const address = document.getElementById('profileViewAddress');
    
    if (modal && imageContainer && name && address) {
      // 기존 이미지/아바타 제거
      const existingImage = document.getElementById('profileViewImage');
      const existingAvatar = document.querySelector('.profile-view-avatar');
      if (existingImage) existingImage.remove();
      if (existingAvatar) existingAvatar.remove();
      
      // 프로필 사진이 있으면 이미지, 없으면 기본 아바타
      if (contact.avatar && contact.avatar.startsWith('http')) {
        // 실제 프로필 사진
        const image = document.createElement('img');
        image.id = 'profileViewImage';
        image.className = 'profile-view-image';
        image.src = contact.avatar;
        image.alt = contact.name;
        imageContainer.insertBefore(image, imageContainer.firstChild);
      } else {
        // 기본 아바타
        const avatar = document.createElement('div');
        avatar.className = 'profile-view-avatar';
        avatar.innerHTML = '<i class="fas fa-user"></i>';
        imageContainer.insertBefore(avatar, imageContainer.firstChild);
      }
      
      // 이름 설정
      name.textContent = contact.name;
      
      // 실제 저장된 통신주소 표시
      const communicationAddress = contact.commAddress || contact.address || this.generatePhoneAddress(contact);
      address.textContent = communicationAddress;
      
      // 아이디 정보 표시
      const usernameContainer = document.getElementById('profileViewUsernameContainer');
      const username = document.getElementById('profileViewUsername');
      
      if (contact.username && contact.username !== null) {
        // 아이디가 있는 경우 표시
        username.textContent = contact.username;
        usernameContainer.style.display = 'block';
        this.currentProfileUsername = contact.username;
      } else {
        // 아이디가 없는 경우 숨기기
        usernameContainer.style.display = 'none';
        this.currentProfileUsername = null;
      }
      
      console.log('📱 프로필 표시:', contact.name, '통신주소:', communicationAddress, '아이디:', contact.username);
      
      // 현재 보고 있는 연락처 ID 저장 (주소 복사용)
      this.currentProfileContactId = contactId;
      this.currentProfileAddress = communicationAddress;
      
      // 버튼 이벤트 연결
      const phoneBtn = document.getElementById('profilePhoneBtn');
      const videoBtn = document.getElementById('profileVideoBtn');
      const chatBtn = document.getElementById('profileChatBtn');
      
      if (phoneBtn) {
        phoneBtn.onclick = () => {
          this.closeProfileView();
          this.confirmCall(contactId);
        };
      }
      
      if (videoBtn) {
        videoBtn.onclick = () => {
          this.closeProfileView();
          this.confirmVideoCall(contactId);
        };
      }
      
      if (chatBtn) {
        chatBtn.onclick = () => {
          this.closeProfileView();
          this.startChat(contactId);
        };
      }
      
      // 차단 및 삭제 버튼 이벤트 연결
      const blockBtn = document.getElementById('profileBlockBtn');
      const deleteBtn = document.getElementById('profileDeleteBtn');
      
      if (blockBtn) {
        blockBtn.onclick = () => {
          this.closeProfileView();
          this.showBlockConfirmModal(contactId);
        };
      }
      
      if (deleteBtn) {
        deleteBtn.onclick = () => {
          this.closeProfileView();
          this.showDeleteContactModal(contactId);
        };
      }
      
      // 모달 표시
      modal.classList.add('active');
      
      // 모달 바깥 클릭 시 닫기
      modal.onclick = (e) => {
        if (e.target === modal) {
          this.closeProfileView();
        }
      };
    }
  }

  // 연락처별 고유 통신 주소 생성
  generateContactAddress(contact) {
    // 연락처 이름을 기반으로 고유한 주소 생성
    const baseAddress = 'baekya://p2p/';
    const nameHash = this.simpleHash(contact.name);
    const contactHash = this.simpleHash(contact.id);
    return `${baseAddress}${nameHash}${contactHash}`;
  }

  // 전화번호 형식의 통신 주소 생성
  generatePhoneAddress(contact) {
    // 연락처별로 고유한 전화번호 형식 주소 생성
    const nameHash = this.simpleHash(contact.name);
    const idHash = this.simpleHash(contact.id);
    
    // 해시를 숫자로 변환하고 전화번호 형식으로 포맷
    const phoneNumber = (parseInt(nameHash, 16) % 9000 + 1000).toString() + 
                       (parseInt(idHash, 16) % 9000 + 1000).toString();
    
    // 010-XXXX-XXXX 형식으로 포맷
    return `010-${phoneNumber.substring(0, 4)}-${phoneNumber.substring(4, 8)}`;
  }

  // 간단한 해시 함수
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit integer로 변환
    }
    return Math.abs(hash).toString(16).substring(0, 8);
  }

  // 프로필 주소 복사
  copyProfileAddress() {
    if (!this.currentProfileAddress) return;
    
    // 클립보드에 복사
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.currentProfileAddress).then(() => {
        this.showProfileCopySuccess('통신 주소');
      }).catch(() => {
        this.fallbackCopyProfileAddress();
      });
    } else {
      this.fallbackCopyProfileAddress();
    }
  }

  // 프로필 아이디 복사
  copyProfileUsername() {
    if (!this.currentProfileUsername) return;
    
    // 클립보드에 복사
    if (navigator.clipboard) {
      navigator.clipboard.writeText(this.currentProfileUsername).then(() => {
        this.showProfileCopySuccess('아이디');
      }).catch(() => {
        this.fallbackCopyProfileUsername();
      });
    } else {
      this.fallbackCopyProfileUsername();
    }
  }

  // 프로필 주소 복사 성공 표시
  showProfileCopySuccess(copyType) {
    const copyBtn = document.querySelector('.profile-copy-btn');
    if (copyBtn) {
      const icon = copyBtn.querySelector('i');
      const originalClass = icon.className;
      
      copyBtn.classList.add('copied');
      icon.className = 'fas fa-check';
      
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        icon.className = originalClass;
      }, 2000);
    }
    
    // 토스트 메시지
    this.showSuccessMessage(`${copyType}가 클립보드에 복사되었습니다.`);
  }

  // 폴백 복사 방법
  fallbackCopyProfileAddress() {
    const textArea = document.createElement('textarea');
    textArea.value = this.currentProfileAddress;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.showProfileCopySuccess('통신 주소');
      }
    } catch (err) {
      console.error('복사 실패:', err);
    }
    
    document.body.removeChild(textArea);
  }

  // 아이디 복사 폴백 방법
  fallbackCopyProfileUsername() {
    const textArea = document.createElement('textarea');
    textArea.value = this.currentProfileUsername;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this.showProfileCopySuccess('아이디');
      }
    } catch (err) {
      console.error('복사 실패:', err);
    }
    
    document.body.removeChild(textArea);
  }

  // 프로필 사진 보기 모달 닫기
  closeProfileView() {
    const modal = document.getElementById('profileViewModal');
    if (modal) {
      modal.classList.remove('active');
      modal.onclick = null;
    }
  }

  // 새로운 채팅 기능들

  // 채팅방 메뉴 열기
  openChatMenu() {
    const modal = document.getElementById('chatMenuModal');
    if (modal) {
      modal.classList.add('active');
    }
  }

  // 채팅방 메뉴 닫기
  closeChatMenu() {
    const modal = document.getElementById('chatMenuModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // 첨부 메뉴 열기
  openAttachmentMenu() {
    const modal = document.getElementById('attachmentMenuModal');
    if (modal) {
      modal.classList.add('active');
      
      // 그룹채팅일 때 송금 버튼 숨기기
      const moneyButton = modal.querySelector('.attachment-menu-item[onclick*="attachMoney"]');
      if (moneyButton) {
        const isGroupChat = this.isGroupChat(this.currentChatId);
        console.log('Current chat ID:', this.currentChatId, 'Is group chat:', isGroupChat); // 디버깅용
        moneyButton.style.display = isGroupChat ? 'none' : 'flex';
      }
    }
  }

  // 첨부 메뉴 닫기
  closeAttachmentMenu() {
    const modal = document.getElementById('attachmentMenuModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // 대화정보 표시
  showChatInfo() {
    this.closeChatMenu();
    this.showChatRoomInfo();
  }
  
  // 채팅방 정보 표시 (상단바 클릭 또는 메뉴에서 접근)
  showChatRoomInfo() {
    const isGroupChat = this.isGroupChat(this.currentChatId);
    const chatInfo = isGroupChat ? this.getGroupChatInfo(this.currentChatId) : this.getContactInfo(this.currentChatId);
      
    if (!chatInfo) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content chat-room-info-content">
        <div class="modal-header">
          <h3><i class="fas fa-info-circle"></i> ${isGroupChat ? '채팅방 정보' : '대화 정보'}</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="chat-room-info-section">
            <!-- 프로필 섹션 -->
            <div class="chat-room-profile">
              <div class="chat-room-avatar">
                ${this.generateAvatarHTML(chatInfo, 'chat-info')}
              </div>
              <div class="chat-room-details">
                <h4>${chatInfo.name}</h4>
                ${isGroupChat ? 
                  `<p class="member-count"><i class="fas fa-users"></i> ${this.getChatMemberCount(this.currentChatId)}명</p>` : 
                  `<p class="status ${chatInfo.isOnline ? 'online' : 'offline'}">
                    <i class="fas fa-circle"></i> ${chatInfo.isOnline ? '온라인' : '오프라인'}
                  </p>`
                }
                ${chatInfo.statusMessage ? `<p class="status-message">"${chatInfo.statusMessage}"</p>` : ''}
              </div>
            </div>
            
            ${isGroupChat ? `
              <!-- 그룹 채팅방 참여자 목록 -->
              <div class="chat-room-members">
                <h5><i class="fas fa-users"></i> 참여자</h5>
                <div class="members-list">
                  ${this.getGroupMembers(this.currentChatId).map(member => `
                    <div class="member-item" onclick="window.dapp.showProfileView('${member.id}')">
                      ${this.generateAvatarHTML(member, 'member-small')}
                      <div class="member-info">
                        <span class="member-name">${member.name}</span>
                        ${member.role ? `<span class="member-role">${member.role}</span>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            
            <!-- 채팅 통계 -->
            <div class="chat-room-stats">
              <h5><i class="fas fa-chart-bar"></i> 대화 통계</h5>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-label">총 메시지</span>
                  <span class="stat-value">${Math.floor(Math.random() * 500) + 50}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">첫 대화</span>
                  <span class="stat-value">2024.01.15</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">공유 파일</span>
                  <span class="stat-value">${Math.floor(Math.random() * 20) + 1}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">공유 미디어</span>
                  <span class="stat-value">${Math.floor(Math.random() * 30) + 5}</span>
                </div>
              </div>
            </div>
            
            <!-- 채팅방 설정 -->
            <div class="chat-room-settings">
              <h5><i class="fas fa-cog"></i> 설정</h5>
              <div class="settings-list">
                <div class="setting-item" onclick="window.dapp.showNotificationSettings()">
                  <i class="fas fa-bell"></i>
                  <span>알림 설정</span>
                  <i class="fas fa-chevron-right"></i>
                </div>
                ${isGroupChat ? `
                  <div class="setting-item" onclick="window.dapp.showChatAnnouncement()">
                    <i class="fas fa-bullhorn"></i>
                    <span>공지사항 관리</span>
                    <i class="fas fa-chevron-right"></i>
                  </div>
                ` : ''}
                <div class="setting-item" onclick="window.dapp.showChatSearch()">
                  <i class="fas fa-search"></i>
                  <span>대화 검색</span>
                  <i class="fas fa-chevron-right"></i>
                </div>
              </div>
            </div>
            
            <!-- 액션 버튼들 -->
            <div class="chat-room-actions">
              ${!isGroupChat ? `
                <button class="action-btn block-btn" onclick="window.dapp.toggleBlockUser('${chatInfo.id}')">
                  <i class="fas fa-ban"></i>
                  <span>${this.isUserBlocked(chatInfo.id) ? '차단 해제' : '사용자 차단'}</span>
                </button>
              ` : ''}
              <button class="action-btn danger-btn" onclick="window.dapp.leaveChatRoom()">
                <i class="fas fa-sign-out-alt"></i>
                <span>${isGroupChat ? '채팅방 나가기' : '대화 나가기'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }
  
  // 그룹 채팅 정보 가져오기
  getGroupChatInfo(chatId) {
    // 실제로는 서버에서 가져와야 함
    return {
      id: chatId,
      name: '백야 프로토콜 개발팀',
      type: 'group',
      memberCount: 5,
      createdAt: '2024-01-01',
      avatar: '👥'
    };
  }
  
  // 채팅방이 그룹 채팅인지 확인 (그룹채팅과 공개채팅 포함)
  isGroupChat(chatId) {
    // 실제로는 채팅방 타입을 확인해야 함
    return chatId && (chatId.includes('group') || chatId.includes('public'));
      }
  
  // 채팅방 멤버 수 가져오기
  getChatMemberCount(chatId) {
    if (this.isGroupChat(chatId)) {
      return Math.floor(Math.random() * 20) + 2;
    }
    return 2;
  }
  
  // 그룹 채팅 멤버 목록 가져오기
  getGroupMembers(chatId) {
    // 실제로는 서버에서 가져와야 함
    const members = [
      { id: 'user1', name: '김개발', role: '관리자', avatar: '👨‍💻' },
      { id: 'user2', name: '이디자인', role: '멤버', avatar: '👩‍🎨' },
      { id: 'user3', name: '박기획', role: '멤버', avatar: '👨‍💼' },
      { id: 'user4', name: '최테스트', role: '멤버', avatar: '👩‍🔬' },
      { id: 'user5', name: '정운영', role: '멤버', avatar: '👨‍🔧' }
    ];
    
    return members.slice(0, this.getChatMemberCount(chatId));
      }

  // 사용자 차단 토글
  toggleBlockUser(userId) {
    if (this.isUserBlocked(userId)) {
      // 차단 해제
      const blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '[]');
      const index = blockedUsers.indexOf(userId);
      if (index > -1) {
        blockedUsers.splice(index, 1);
        localStorage.setItem('blockedUsers', JSON.stringify(blockedUsers));
        this.showSuccessMessage('사용자 차단이 해제되었습니다.');
      }
    } else {
      // 차단
      this.showBlockConfirmModal(userId);
    }
    
    // 모달 닫기
    const modal = document.querySelector('.modal.active');
    if (modal) modal.remove();
  }

  // 채팅 통계 업데이트
  updateChatStats() {
    const totalMessages = document.getElementById('totalMessages');
    const firstChatDate = document.getElementById('firstChatDate');
    const sharedFiles = document.getElementById('sharedFiles');

    if (totalMessages) totalMessages.textContent = Math.floor(Math.random() * 500) + 50;
    if (firstChatDate) firstChatDate.textContent = '2024.01.15';
    if (sharedFiles) sharedFiles.textContent = Math.floor(Math.random() * 20) + 1;
  }

  // 대화정보 닫기
  closeChatInfo() {
    const modal = document.getElementById('chatInfoModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // 알림설정 표시
  showNotificationSettings() {
    this.closeChatMenu();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>알림 설정</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="notification-settings">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-title">메시지 알림</div>
                <div class="setting-desc">새 메시지가 도착할 때 알림을 받습니다</div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-title">소리 알림</div>
                <div class="setting-desc">알림음을 재생합니다</div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-title">진동</div>
                <div class="setting-desc">메시지 수신 시 진동합니다</div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-title">미리보기</div>
                <div class="setting-desc">알림에서 메시지 내용을 표시합니다</div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" onclick="window.dapp.saveNotificationSettings(); this.closest('.modal').remove();">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 알림 설정 저장
  saveNotificationSettings() {
    this.showSuccessMessage('알림 설정이 저장되었습니다.');
  }

  // 일정 표시
  showChatSchedule() {
    this.closeChatMenu();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>공유된 일정</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="schedule-list">
            <div class="schedule-item">
              <div class="schedule-date">2024년 1월 15일</div>
              <div class="schedule-event">
                <div class="event-title">백야 프로토콜 회의</div>
                <div class="event-time">오후 2:00 - 4:00</div>
                <div class="event-location">온라인 회의실</div>
              </div>
            </div>
            <div class="schedule-item">
              <div class="schedule-date">2024년 1월 20일</div>
              <div class="schedule-event">
                <div class="event-title">커뮤니티 모임</div>
                <div class="event-time">오후 7:00 - 9:00</div>
                <div class="event-location">강남역 스타벅스</div>
              </div>
            </div>
          </div>
          <div class="empty-state" style="display: none;">
            <i class="fas fa-calendar-alt"></i>
            <p>공유된 일정이 없습니다</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 공지사항 표시
  showChatAnnouncement() {
    this.closeChatMenu();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>공지사항</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="announcement-list">
            <div class="announcement-item">
              <div class="announcement-header">
                <div class="announcement-title">📢 중요 공지</div>
                <div class="announcement-date">2024.01.10</div>
              </div>
              <div class="announcement-content">
                백야 프로토콜 업데이트 안내입니다. 새로운 기능들이 추가되었으니 확인해주세요.
              </div>
            </div>
            <div class="announcement-item">
              <div class="announcement-header">
                <div class="announcement-title">💡 팁</div>
                <div class="announcement-date">2024.01.05</div>
              </div>
              <div class="announcement-content">
                P2P 채팅에서 다양한 파일을 공유할 수 있습니다. + 버튼을 눌러보세요!
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" onclick="window.dapp.createAnnouncement()">공지 작성</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 공지사항 작성
  createAnnouncement() {
    document.querySelector('.modal').remove();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>공지사항 작성</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>제목</label>
            <input type="text" id="announcementTitle" placeholder="공지사항 제목을 입력하세요">
          </div>
          <div class="form-group">
            <label>내용</label>
            <textarea id="announcementContent" placeholder="공지사항 내용을 입력하세요" rows="5"></textarea>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="pinAnnouncement"> 상단 고정
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
          <button class="btn-primary" onclick="window.dapp.publishAnnouncement()">게시</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 공지사항 게시
  publishAnnouncement() {
    const title = document.getElementById('announcementTitle').value;
    const content = document.getElementById('announcementContent').value;
    const isPinned = document.getElementById('pinAnnouncement').checked;

    if (!title || !content) {
      this.showErrorMessage('제목과 내용을 입력해주세요.');
      return;
    }

    const announcementMessage = `
      <div class="announcement-message ${isPinned ? 'pinned' : ''}">
        <div class="announcement-icon">📢</div>
        <div class="announcement-body">
          <div class="announcement-title">${title}</div>
          <div class="announcement-text">${content}</div>
          ${isPinned ? '<div class="pin-indicator">📌 고정됨</div>' : ''}
        </div>
      </div>
    `;

    this.addMessageToChat(announcementMessage, true);
    this.scrollToBottom();
    document.querySelector('.modal').remove();
    this.showSuccessMessage('공지사항이 게시되었습니다.');
  }

  // 투표 표시
  showChatVote() {
    this.closeChatMenu();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>진행 중인 투표</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="vote-list">
            <div class="vote-item">
              <div class="vote-title">다음 모임 장소는?</div>
              <div class="vote-progress">
                <div class="vote-option">
                  <span>강남역</span>
                  <span class="vote-count">3표 (60%)</span>
                </div>
                <div class="vote-bar">
                  <div class="vote-fill" style="width: 60%"></div>
                </div>
                <div class="vote-option">
                  <span>홍대입구</span>
                  <span class="vote-count">2표 (40%)</span>
                </div>
                <div class="vote-bar">
                  <div class="vote-fill" style="width: 40%"></div>
                </div>
              </div>
              <div class="vote-status">마감: 2024.01.15 18:00</div>
            </div>
          </div>
          <div class="empty-state" style="display: none;">
            <i class="fas fa-vote-yea"></i>
            <p>진행 중인 투표가 없습니다</p>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" onclick="this.closest('.modal').remove(); window.dapp.createVoting();">새 투표 만들기</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 사진/동영상 표시
  showChatPhotos() {
    this.closeChatMenu();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>사진/동영상</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="media-tabs">
            <button class="media-tab active" onclick="window.dapp.switchMediaTab('photos', this)">사진</button>
            <button class="media-tab" onclick="window.dapp.switchMediaTab('videos', this)">동영상</button>
          </div>
          <div class="media-grid" id="mediaGrid">
            <div class="media-item">
              <img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e5e7eb'/><text x='50' y='50' text-anchor='middle' dy='.3em' font-family='Arial' font-size='12' fill='%236b7280'>사진 1</text></svg>" alt="사진">
              <div class="media-overlay">
                <button class="media-download" onclick="window.dapp.downloadMedia('photo1')">⬇️</button>
              </div>
            </div>
            <div class="media-item">
              <img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e5e7eb'/><text x='50' y='50' text-anchor='middle' dy='.3em' font-family='Arial' font-size='12' fill='%236b7280'>사진 2</text></svg>" alt="사진">
              <div class="media-overlay">
                <button class="media-download" onclick="window.dapp.downloadMedia('photo2')">⬇️</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 미디어 탭 전환
  switchMediaTab(type, button) {
    document.querySelectorAll('.media-tab').forEach(tab => tab.classList.remove('active'));
    button.classList.add('active');
    
    const mediaGrid = document.getElementById('mediaGrid');
    if (type === 'photos') {
      mediaGrid.innerHTML = `
        <div class="media-item">
          <img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e5e7eb'/><text x='50' y='50' text-anchor='middle' dy='.3em' font-family='Arial' font-size='12' fill='%236b7280'>사진 1</text></svg>" alt="사진">
          <div class="media-overlay">
            <button class="media-download" onclick="window.dapp.downloadMedia('photo1')">⬇️</button>
          </div>
        </div>
        <div class="media-item">
          <img src="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%23e5e7eb'/><text x='50' y='50' text-anchor='middle' dy='.3em' font-family='Arial' font-size='12' fill='%236b7280'>사진 2</text></svg>" alt="사진">
          <div class="media-overlay">
            <button class="media-download" onclick="window.dapp.downloadMedia('photo2')">⬇️</button>
          </div>
        </div>
      `;
    } else {
      mediaGrid.innerHTML = `
        <div class="media-item video-item">
          <div class="video-thumbnail">
            <div class="play-button">▶️</div>
            <span class="video-duration">0:45</span>
          </div>
          <div class="media-overlay">
            <button class="media-download" onclick="window.dapp.downloadMedia('video1')">⬇️</button>
          </div>
        </div>
        <div class="media-item video-item">
          <div class="video-thumbnail">
            <div class="play-button">▶️</div>
            <span class="video-duration">1:23</span>
          </div>
          <div class="media-overlay">
            <button class="media-download" onclick="window.dapp.downloadMedia('video2')">⬇️</button>
          </div>
        </div>
      `;
    }
  }

  // 미디어 다운로드
  downloadMedia(mediaId) {
    this.showSuccessMessage(`${mediaId} 다운로드를 시작합니다.`);
  }

  // 파일 표시
  showChatFiles() {
    this.closeChatMenu();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>파일</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="file-list">
            <div class="file-item">
              <div class="file-icon">📄</div>
              <div class="file-info">
                <div class="file-name">백야프로토콜_개요.pdf</div>
                <div class="file-meta">2.5MB • 2024.01.10</div>
              </div>
              <button class="file-download" onclick="window.dapp.downloadChatFile('protocol.pdf')">⬇️</button>
            </div>
            <div class="file-item">
              <div class="file-icon">📊</div>
              <div class="file-info">
                <div class="file-name">토큰경제_분석.xlsx</div>
                <div class="file-meta">1.8MB • 2024.01.08</div>
              </div>
              <button class="file-download" onclick="window.dapp.downloadChatFile('analysis.xlsx')">⬇️</button>
            </div>
            <div class="file-item">
              <div class="file-icon">📝</div>
              <div class="file-info">
                <div class="file-name">회의록.docx</div>
                <div class="file-meta">856KB • 2024.01.05</div>
              </div>
              <button class="file-download" onclick="window.dapp.downloadChatFile('meeting.docx')">⬇️</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 채팅 파일 다운로드
  downloadChatFile(fileName) {
    this.showSuccessMessage(`${fileName} 다운로드를 시작합니다.`);
  }

  // 링크 표시
  showChatLinks() {
    this.closeChatMenu();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>링크</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="link-list">
            <div class="link-item">
              <div class="link-preview">
                <div class="link-favicon">🌐</div>
                <div class="link-info">
                  <div class="link-title">백야 프로토콜 공식 문서</div>
                  <div class="link-url">https://baekya-protocol.org/docs</div>
                  <div class="link-date">2024.01.10 공유됨</div>
                </div>
              </div>
              <button class="link-open" onclick="window.open('https://baekya-protocol.org/docs', '_blank')">열기</button>
            </div>
            <div class="link-item">
              <div class="link-preview">
                <div class="link-favicon">📺</div>
                <div class="link-info">
                  <div class="link-title">백야 프로토콜 소개 영상</div>
                  <div class="link-url">https://youtube.com/watch?v=example</div>
                  <div class="link-date">2024.01.08 공유됨</div>
                </div>
              </div>
              <button class="link-open" onclick="window.open('https://youtube.com/watch?v=example', '_blank')">열기</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 대화검색 표시
  showChatSearch() {
    this.closeChatMenu();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>대화 검색</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="search-input-wrapper">
            <input type="text" id="chatSearchInput" placeholder="메시지 검색..." onkeyup="window.dapp.searchChatMessages(this.value)">
            <i class="fas fa-search"></i>
          </div>
          <div class="search-filters">
            <button class="filter-btn active" onclick="window.dapp.setChatSearchFilter('all', this)">전체</button>
            <button class="filter-btn" onclick="window.dapp.setChatSearchFilter('text', this)">텍스트</button>
            <button class="filter-btn" onclick="window.dapp.setChatSearchFilter('files', this)">파일</button>
            <button class="filter-btn" onclick="window.dapp.setChatSearchFilter('links', this)">링크</button>
          </div>
          <div class="search-results" id="chatSearchResults">
            <div class="search-hint">
              <i class="fas fa-search"></i>
              <p>검색어를 입력하세요</p>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 채팅 메시지 검색
  searchChatMessages(query) {
    const resultsContainer = document.getElementById('chatSearchResults');
    
    if (!query.trim()) {
      resultsContainer.innerHTML = `
        <div class="search-hint">
          <i class="fas fa-search"></i>
          <p>검색어를 입력하세요</p>
        </div>
      `;
      return;
    }

    // 모의 검색 결과
    const mockResults = [
      { type: 'text', content: '안녕하세요! 백야 프로토콜에 대해 논의해봐요', date: '2024.01.10 14:30' },
      { type: 'file', content: '백야프로토콜_개요.pdf', date: '2024.01.10 15:45' },
      { type: 'text', content: '새로운 기능들이 정말 인상적이네요', date: '2024.01.09 16:20' }
    ];

    const filteredResults = mockResults.filter(result => 
      result.content.toLowerCase().includes(query.toLowerCase())
    );

    if (filteredResults.length === 0) {
      resultsContainer.innerHTML = `
        <div class="search-no-results">
          <i class="fas fa-search"></i>
          <p>검색 결과가 없습니다</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = filteredResults.map(result => `
      <div class="search-result-item">
        <div class="result-icon">${result.type === 'text' ? '💬' : result.type === 'file' ? '📎' : '🔗'}</div>
        <div class="result-content">
          <div class="result-text">${result.content}</div>
          <div class="result-date">${result.date}</div>
        </div>
      </div>
    `).join('');
  }

  // 채팅 검색 필터 설정
  setChatSearchFilter(filter, button) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    const query = document.getElementById('chatSearchInput').value;
    if (query) {
      this.searchChatMessages(query);
    }
  }

  // 채팅방 기록 삭제 (채팅방은 유지하되 기록만 삭제)
  deleteChatHistory() {
    const chatName = this.currentChatContact ? this.currentChatContact.name : '현재 채팅방';
    
    // 확인 대화상자
    const confirmed = confirm(`${chatName}의 대화 기록을 삭제하시겠습니까?\n\n주의: 삭제된 대화 기록은 복구할 수 없습니다.\n채팅방은 유지되며 새로운 메시지는 계속 받을 수 있습니다.`);
    
    if (confirmed) {
      // 채팅 기록 삭제 로직 (실제로는 서버 API 호출)
      const chatId = this.currentChatId;
      
      // 로컬 스토리지에서 해당 채팅의 메시지 기록 삭제
      const deletedChatHistories = JSON.parse(localStorage.getItem('deletedChatHistories') || '[]');
      if (!deletedChatHistories.includes(chatId)) {
        deletedChatHistories.push(chatId);
        localStorage.setItem('deletedChatHistories', JSON.stringify(deletedChatHistories));
      }
      
      // 채팅 화면의 메시지들 클리어
      const messagesContainer = document.getElementById('chatMessages');
      if (messagesContainer) {
        messagesContainer.innerHTML = `
          <div class="empty-state" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
            <i class="fas fa-comment" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
            <p>대화 기록이 삭제되었습니다.</p>
            <small>새로운 메시지를 보내면 대화가 시작됩니다.</small>
          </div>
        `;
      }
      
      this.showSuccessMessage('대화 기록이 삭제되었습니다.');
      this.closeChatMenu();
    }
  }

  // 채팅방 나가기
  leaveChatRoom() {
    this.closeChatMenu();
    if (confirm('정말 이 채팅방을 나가시겠습니까?')) {
      this.showSuccessMessage('채팅방을 나갔습니다.');
      this.backToP2PList();
    }
  }

  // 영상통화 확인
  confirmVideoCall(contactId) {
    const contact = this.getContactInfo(contactId);
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>영상통화 걸기</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="call-confirm-content">
            <div class="call-confirm-avatar">
              ${this.generateAvatarHTML(contact, 'contact-simple')}
            </div>
            <div class="call-confirm-info">
              <h4>${contact.name}</h4>
              <p>영상통화를 거시겠습니까?</p>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
          <button type="button" class="btn-primary" onclick="window.dapp.startVideoCall('${contactId}'); this.closest('.modal').remove();">
            <i class="fas fa-video"></i> 영상통화
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // 영상통화 시작
  startVideoCall(contactId) {
    console.log(`📹 ${contactId}에게 영상통화 시작`);
    this.showVideoCallModal(contactId);
  }

  showVideoCallModal(contactId) {
    // 연락처 정보 가져오기
    const contact = this.getContactInfo(contactId);
    
    const modal = document.createElement('div');
    modal.className = 'modal active video-call-modal';
    
    // 아바타 HTML 생성
    const avatarHTML = this.generateAvatarHTML(contact, 'contact');
    
    modal.innerHTML = `
      <div class="modal-content video-call-modal-content">
        <div class="video-call-content">
          <div class="video-screens">
            <div class="main-video-screen">
              <div class="video-placeholder">
                ${avatarHTML}
                <div class="video-status" id="videoStatus">연결 중...</div>
              </div>
              <div class="video-info">
                <div class="caller-name">${contact.name}</div>
                <div class="call-duration" id="videoCallDuration">00:00</div>
              </div>
            </div>
            <div class="self-video-screen">
              <div class="self-video-placeholder">
                <i class="fas fa-user"></i>
                <span>나</span>
              </div>
            </div>
          </div>
          <div class="video-call-actions">
            <button class="video-call-btn camera-btn" onclick="window.dapp.toggleCamera()" title="카메라">
              <i class="fas fa-video"></i>
            </button>
            <button class="video-call-btn mute-btn" onclick="window.dapp.toggleVideoMute()" title="음소거">
              <i class="fas fa-microphone"></i>
            </button>
            <button class="video-call-btn end-btn" onclick="window.dapp.endVideoCall()" title="통화 종료">
              <i class="fas fa-phone-slash"></i>
            </button>
            <button class="video-call-btn speaker-btn" onclick="window.dapp.toggleVideoSpeaker()" title="스피커">
              <i class="fas fa-volume-up"></i>
            </button>
            <button class="video-call-btn fullscreen-btn" onclick="window.dapp.toggleFullscreen()" title="전체화면">
              <i class="fas fa-expand"></i>
            </button>
          </div>
          <div class="video-call-quality">
            <div class="quality-indicator">
              <span>연결 품질: </span>
              <div class="quality-bars">
                <div class="quality-bar active"></div>
                <div class="quality-bar active"></div>
                <div class="quality-bar active"></div>
                <div class="quality-bar active"></div>
              </div>
              <span>매우 좋음</span>
            </div>
            <div class="encryption-status">
              <i class="fas fa-shield-alt"></i>
              <span>엔드투엔드 암호화</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.currentVideoCallModal = modal;
    
    // 영상통화 시뮬레이션
    setTimeout(() => {
      const videoStatus = document.getElementById('videoStatus');
      if (videoStatus) {
        videoStatus.textContent = '영상통화 중...';
        this.startVideoCallTimer();
      }
    }, 2000);
  }

  startVideoCallTimer() {
    let seconds = 0;
    const callDuration = document.getElementById('videoCallDuration');
    
    this.videoCallTimer = setInterval(() => {
      seconds++;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      if (callDuration) {
        callDuration.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  endVideoCall() {
    // 영상통화 시간 정보 가져오기
    const videoDurationElement = document.getElementById('videoCallDuration');
    const videoDuration = videoDurationElement ? videoDurationElement.textContent : '00:00';
    
    // 영상통화 타이머 정지
    if (this.videoCallTimer) {
      clearInterval(this.videoCallTimer);
      this.videoCallTimer = null;
    }
    
    // 모달 제거
    if (this.currentVideoCallModal) {
      this.currentVideoCallModal.remove();
      this.currentVideoCallModal = null;
    }
    
    // 영상통화 기록을 채팅방에 추가
    this.addCallRecordToChat('video', videoDuration);
    
    this.showSuccessMessage('영상통화가 종료되었습니다.');
  }

  toggleCamera() {
    const cameraBtn = document.querySelector('.camera-btn i');
    if (cameraBtn.classList.contains('fa-video')) {
      cameraBtn.className = 'fas fa-video-slash';
      this.showSuccessMessage('카메라가 꺼졌습니다.');
    } else {
      cameraBtn.className = 'fas fa-video';
      this.showSuccessMessage('카메라가 켜졌습니다.');
    }
  }

  toggleVideoMute() {
    const muteBtn = document.querySelector('.video-call-modal .mute-btn i');
    if (muteBtn.classList.contains('fa-microphone')) {
      muteBtn.className = 'fas fa-microphone-slash';
      this.showSuccessMessage('음소거되었습니다.');
    } else {
      muteBtn.className = 'fas fa-microphone';
      this.showSuccessMessage('음소거가 해제되었습니다.');
    }
  }

  toggleVideoSpeaker() {
    const speakerBtn = document.querySelector('.video-call-modal .speaker-btn i');
    if (speakerBtn.classList.contains('fa-volume-up')) {
      speakerBtn.className = 'fas fa-volume-mute';
      this.showSuccessMessage('스피커가 꺼졌습니다.');
    } else {
      speakerBtn.className = 'fas fa-volume-up';
      this.showSuccessMessage('스피커가 켜졌습니다.');
    }
  }

  toggleFullscreen() {
    const modal = document.querySelector('.video-call-modal');
    if (modal) {
      if (modal.classList.contains('fullscreen')) {
        modal.classList.remove('fullscreen');
        const fullscreenBtn = document.querySelector('.fullscreen-btn i');
        if (fullscreenBtn) fullscreenBtn.className = 'fas fa-expand';
      } else {
        modal.classList.add('fullscreen');
        const fullscreenBtn = document.querySelector('.fullscreen-btn i');
        if (fullscreenBtn) fullscreenBtn.className = 'fas fa-compress';
      }
    }
  }

  // 통화 기록을 채팅방에 추가
  addCallRecordToChat(callType, duration) {
    // 현재 채팅방에 있지 않으면 기록하지 않음
    if (!this.currentChatId) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    // 통화 기록 메시지 생성
    const callIcon = callType === 'video' ? '📹' : '📞';
    const callTypeName = callType === 'video' ? '영상통화' : '음성통화';
    
    const messageContent = `
      <div class="call-record-message">
        <div class="call-record-icon">${callIcon}</div>
        <div class="call-record-details">
          <div class="call-record-type">${callTypeName}</div>
          <div class="call-record-duration">통화시간: ${duration}</div>
        </div>
      </div>
    `;
    
    // 새 메시지 객체 생성
    const callRecord = {
      id: Date.now(),
      sender: 'me',
      type: 'call-record',
      callType: callType,
      duration: duration,
      text: messageContent,
      timestamp: timeString,
      date: new Date().toISOString().split('T')[0],
      read: true,
      readBy: ['me', this.currentChatId]
    };
    
    // 메시지 저장
    let messages = this.getChatMessages(this.currentChatId) || [];
    messages.push(callRecord);
    this.saveChatMessages(this.currentChatId, messages);
    
    // 채팅 화면이 열려있으면 즉시 표시
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
      const messageHtml = `
        <div class="chat-message own">
          <div class="message-bubble call-record-bubble">
            ${messageContent}
            <div class="message-time">${timeString}</div>
          </div>
        </div>
      `;
      
      chatMessages.insertAdjacentHTML('beforeend', messageHtml);
      this.scrollToBottom();
    }
  }

  // 첨부 기능들
  attachPhoto() {
    this.closeAttachmentMenu();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          this.sendFileMessage(file, 'image');
        }
      });
    };
    input.click();
  }

  attachVideo() {
    this.closeAttachmentMenu();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        if (file.type.startsWith('video/')) {
          this.sendFileMessage(file, 'video');
        }
      });
    };
    input.click();
  }

  attachFile() {
    this.closeAttachmentMenu();
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        this.sendFileMessage(file, 'file');
      });
    };
    input.click();
  }

  // 파일 메시지 전송
  sendFileMessage(file, type) {
    if (!file) return;

    const reader = new FileReader();
    const fileSize = this.formatFileSize(file.size);
    const fileName = file.name;

    reader.onload = (e) => {
      const fileData = e.target.result;
      const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      
      let messageContent = '';
      
      if (type === 'image') {
        messageContent = `
          <div class="file-message image-message">
            <img src="${fileData}" alt="${fileName}" style="max-width: 300px; max-height: 200px; border-radius: 8px; cursor: pointer;" onclick="window.dapp.viewImage('${fileData}', '${fileName}')">
            <div class="file-info">
              <span class="file-name">${fileName}</span>
              <span class="file-size">${fileSize}</span>
            </div>
          </div>
        `;
      } else if (type === 'video') {
        messageContent = `
          <div class="file-message video-message">
            <video controls style="max-width: 300px; max-height: 200px; border-radius: 8px;">
              <source src="${fileData}" type="${file.type}">
              브라우저가 비디오를 지원하지 않습니다.
            </video>
            <div class="file-info">
              <span class="file-name">${fileName}</span>
              <span class="file-size">${fileSize}</span>
            </div>
          </div>
        `;
      } else {
        const fileIcon = this.getFileIcon(file.type);
        messageContent = `
          <div class="file-message document-message" onclick="window.dapp.downloadFile('${fileData}', '${fileName}', '${file.type}')">
            <div class="file-icon">${fileIcon}</div>
            <div class="file-details">
              <div class="file-name">${fileName}</div>
              <div class="file-size">${fileSize}</div>
              <div class="file-action">클릭하여 다운로드</div>
            </div>
          </div>
        `;
      }

      this.addMessageToChat(messageContent, true, messageId);
      this.scrollToBottom();
      this.showSuccessMessage(`${type === 'image' ? '사진' : type === 'video' ? '동영상' : '파일'}이 전송되었습니다.`);
    };

    if (type === 'image' || type === 'video') {
      reader.readAsDataURL(file);
    } else {
      reader.readAsDataURL(file);
    }
  }

  // 파일 크기 포맷팅
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 파일 아이콘 가져오기
  getFileIcon(mimeType) {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return '📋';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) return '📦';
    if (mimeType.includes('audio')) return '🎵';
    if (mimeType.includes('text')) return '📄';
    return '📁';
  }

  // 이미지 뷰어
  viewImage(src, fileName) {
    const modal = document.createElement('div');
    modal.className = 'modal active image-viewer-modal';
    modal.innerHTML = `
      <div class="modal-content image-viewer-content">
        <div class="modal-header">
          <h3>${fileName}</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <img src="${src}" alt="${fileName}" style="max-width: 100%; max-height: 80vh; object-fit: contain;">
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="window.dapp.downloadImageFile('${src}', '${fileName}')">
            <i class="fas fa-download"></i> 다운로드
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // 모달 외부 클릭으로 닫기
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // 파일 다운로드
  downloadFile(dataUrl, fileName, mimeType) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  }

  // 이미지 파일 다운로드
  downloadImageFile(src, fileName) {
    const link = document.createElement('a');
    link.href = src;
    link.download = fileName;
    link.click();
  }

  attachContact() {
    this.closeAttachmentMenu();
    this.showContactPicker();
  }

  attachLocation() {
    this.closeAttachmentMenu();
    this.shareLocation();
  }

  attachMoney() {
    this.closeAttachmentMenu();
    this.showMoneyTransfer();
  }

  attachVote() {
    this.closeAttachmentMenu();
    this.createVoting();
  }

  attachSchedule() {
    this.closeAttachmentMenu();
    this.createSchedule();
  }

  // 연락처 선택기
  showContactPicker() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>연락처 공유</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="contact-picker-list">
            <div class="contact-picker-item" onclick="window.dapp.shareContact('본인', '${this.currentUser?.address || 'baekya_user_123'}')">
              <div class="contact-avatar">
                <span class="avatar-emoji">👤</span>
              </div>
              <div class="contact-info">
                <div class="contact-name">본인</div>
                <div class="contact-address">${this.currentUser?.address || 'baekya_user_123'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 연락처 공유
  shareContact(name, address) {
    const messageContent = `
      <div class="contact-share-message">
        <div class="shared-contact">
          <div class="contact-avatar">
            <span class="avatar-emoji">👤</span>
          </div>
          <div class="contact-details">
            <div class="contact-name">${name}</div>
            <div class="contact-address">${address}</div>
            <button class="btn-secondary" onclick="window.dapp.addSharedContact('${name}', '${address}')">
              연락처 추가
            </button>
          </div>
        </div>
      </div>
    `;
    this.addMessageToChat(messageContent, true);
    this.scrollToBottom();
    document.querySelector('.modal').remove();
    this.showSuccessMessage('연락처가 공유되었습니다.');
  }

  // 공유된 연락처 추가
  addSharedContact(name, address) {
    this.showSuccessMessage(`${name}님이 연락처에 추가되었습니다.`);
  }

  // 위치 공유
  shareLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const messageContent = `
            <div class="location-share-message">
              <div class="location-info">
                <div class="location-icon">📍</div>
                <div class="location-details">
                  <div class="location-title">현재 위치</div>
                  <div class="location-coords">위도: ${lat.toFixed(6)}, 경도: ${lng.toFixed(6)}</div>
                  <button class="btn-secondary" onclick="window.dapp.openLocation(${lat}, ${lng})">
                    지도에서 보기
                  </button>
                </div>
              </div>
            </div>
          `;
          this.addMessageToChat(messageContent, true);
          this.scrollToBottom();
          this.showSuccessMessage('위치가 공유되었습니다.');
        },
        (error) => {
          this.showErrorMessage('위치 정보를 가져올 수 없습니다.');
        }
      );
    } else {
      this.showErrorMessage('이 브라우저는 위치 서비스를 지원하지 않습니다.');
    }
  }

  // 지도에서 위치 열기
  openLocation(lat, lng) {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, '_blank');
  }

  // 송금 기능
  showMoneyTransfer() {
    // 현재 채팅방이 단체방인지 확인
    const isGroupChat = this.isGroupChat(this.currentChatId);
    // 실시간 B토큰 잔액 가져오기
    const savedBalance = localStorage.getItem('currentBalance');
    const currentBalance = savedBalance ? parseFloat(savedBalance) : (this.userTokens?.B || 0);
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>B토큰 송금</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="transfer-form">
            ${isGroupChat ? `
            <div class="form-group">
                <label>받는 사람 선택</label>
                <select id="transferRecipient" class="form-select" onchange="window.dapp.updateTransferFee()">
                  <option value="">받는 사람을 선택하세요</option>
                  ${this.getGroupMembers(this.currentChatId).map(member => 
                    `<option value="${member.id}">${member.name}</option>`
                  ).join('')}
                </select>
              </div>
            ` : ''}
            <div class="form-group">
              <label>송금 금액 (B토큰)</label>
              <input type="number" id="transferAmount" placeholder="0" min="0.01" step="0.01" onkeyup="window.dapp.updateTransferFee()">
            </div>
            <div class="form-group">
              <label>메모 (선택사항)</label>
              <input type="text" id="transferMemo" placeholder="송금 메모를 입력하세요">
            </div>
            <div class="transfer-summary">
              <div class="summary-row">
                <span>송금액:</span>
                <span id="transferAmountDisplay">0.00 B</span>
              </div>
              <div class="summary-row">
                <span>수수료 (0.1%):</span>
                <span id="transferFeeDisplay">0.00 B</span>
              </div>
              <div class="summary-row total">
                <span>총 차감액:</span>
                <span id="transferTotalDisplay">0.00 B</span>
              </div>
            </div>
            <div class="balance-info">
              <small>보유 B토큰: ${currentBalance.toFixed(2)} B</small>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
          <button class="btn-primary" onclick="window.dapp.sendMoney()">송금하기</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // 송금 실행
  async sendMoney() {
    const amountInput = document.getElementById('transferAmount');
    const amount = parseFloat(amountInput.value);
    const memo = document.getElementById('transferMemo').value;
    const isGroupChat = this.isGroupChat(this.currentChatId);
    
    // 단체방인 경우 수신자 확인
    let recipientId = this.currentChatContact?.id;
    let recipientName = this.currentChatContact?.name;
    
    if (isGroupChat) {
      const recipientSelect = document.getElementById('transferRecipient');
      recipientId = recipientSelect.value;
      recipientName = recipientSelect.options[recipientSelect.selectedIndex].text;
      
      if (!recipientId) {
        this.showErrorMessage('받는 사람을 선택해주세요.');
        return;
      }
    }
    
    if (!amount || amount <= 0) {
      this.showErrorMessage('올바른 금액을 입력해주세요.');
      return;
    }

    // 수수료 계산 (0.1%)
    const fee = amount * 0.001;
    const totalAmount = amount + fee;
    // 실시간 B토큰 잔액 가져오기
    const savedBalance = localStorage.getItem('currentBalance');
    const currentBalance = savedBalance ? parseFloat(savedBalance) : (this.userTokens?.B || 0);
    
    if (totalAmount > currentBalance) {
      this.showErrorMessage(`잔액이 부족합니다. (필요: ${totalAmount.toFixed(2)} B, 보유: ${currentBalance.toFixed(2)} B)`);
      return;
    }
    
    // 비밀번호 확인
    const passwordVerified = await this.confirmPassword('송금을 진행하시려면 비밀번호를 입력해주세요.');
    if (!passwordVerified) {
      return;
    }
    
    // 송금 처리 (실제로는 블록체인 트랜잭션)
    try {
      // 잔액 차감
      const newBalance = currentBalance - totalAmount;
      this.userTokens.B = newBalance;
      // localStorage에 업데이트된 잔액 저장
      localStorage.setItem('currentBalance', newBalance.toString());
      
      // 송금 트랜잭션 기록
      const transactionId = 'tx_' + Date.now();
      const transaction = {
        id: transactionId,
        type: 'transfer',
        from: this.userDID,
        to: recipientId,
        amount: amount,
        fee: fee,
        memo: memo,
        timestamp: new Date().toISOString(),
        status: 'completed'
      };
      
      // 로컬 스토리지에 트랜잭션 저장
      const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
      transactions.push(transaction);
      localStorage.setItem('transactions', JSON.stringify(transactions));
      
      // 토큰 잔액 업데이트
      await this.updateTokenBalances();
      
      // 채팅에 송금 메시지 추가
    const messageContent = `
      <div class="money-transfer-message">
        <div class="transfer-info">
          <div class="transfer-icon">💰</div>
          <div class="transfer-details">
              <div class="transfer-title">B토큰 송금</div>
              ${isGroupChat ? `<div class="transfer-recipient">받는 사람: ${recipientName}</div>` : ''}
              <div class="transfer-amount">${amount.toFixed(2)} B</div>
            ${memo ? `<div class="transfer-memo">"${memo}"</div>` : ''}
              <div class="transfer-fee">수수료: ${fee.toFixed(4)} B</div>
              <div class="transfer-status success">
                <i class="fas fa-check-circle"></i> 전송 완료
              </div>
              <div class="transfer-tx">TX: ${transactionId.substring(0, 10)}...</div>
          </div>
        </div>
      </div>
    `;
    
    this.addMessageToChat(messageContent, true);
    this.scrollToBottom();
    document.querySelector('.modal').remove();
      this.showSuccessMessage(`${amount.toFixed(2)} B토큰이 ${recipientName}님에게 송금되었습니다.`);
      
    } catch (error) {
      console.error('송금 오류:', error);
      this.showErrorMessage('송금 처리 중 오류가 발생했습니다.');
    }
  }
  
  // 송금 수수료 업데이트
  updateTransferFee() {
    const amountInput = document.getElementById('transferAmount');
    const amount = parseFloat(amountInput.value) || 0;
    const fee = amount * 0.001; // 0.1% 수수료
    const total = amount + fee;
    
    document.getElementById('transferAmountDisplay').textContent = `${amount.toFixed(2)} B`;
    document.getElementById('transferFeeDisplay').textContent = `${fee.toFixed(4)} B`;
    document.getElementById('transferTotalDisplay').textContent = `${total.toFixed(2)} B`;
  }
  
  // 그룹 채팅 여부 확인
  isGroupChat(chatId) {
    // 채팅 ID가 그룹채팅이나 공개채팅인 경우
    return chatId && (chatId.includes('group') || chatId.includes('public'));
  }
  
  // 그룹 멤버 가져오기
  getGroupMembers(chatId) {
    // 실제로는 서버에서 가져와야 하지만, 여기서는 시뮬레이션
    if (!this.isGroupChat(chatId)) {
      return [];
    }
    
    // 예시 그룹 멤버들
    return [
      { id: 'user_2', name: '김철수' },
      { id: 'user_3', name: '이영희' },
      { id: 'user_4', name: '박민수' },
      { id: 'user_5', name: '정수진' }
    ].filter(member => member.id !== this.userDID); // 본인 제외
  }
  
  // 채팅방 멤버 수 가져오기
  getChatMemberCount(chatId) {
    // 실제로는 서버에서 가져와야 함
    if (chatId?.startsWith('group_')) {
      return 5; // 예시로 5명
    }
    return 2; // 1:1 채팅
  }

  // 투표 생성
  createVoting() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>투표 생성</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="voting-form">
            <div class="form-group">
              <label>투표 제목</label>
              <input type="text" id="votingTitle" placeholder="투표 제목을 입력하세요">
            </div>
            <div class="form-group">
              <label>투표 옵션 (줄바꿈으로 구분)</label>
              <textarea id="votingOptions" placeholder="옵션 1&#10;옵션 2&#10;옵션 3" rows="4"></textarea>
            </div>
            <div class="form-group">
              <label>투표 마감 시간</label>
              <input type="datetime-local" id="votingDeadline">
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
          <button class="btn-primary" onclick="window.dapp.publishVoting()">투표 생성</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // 기본 마감시간을 24시간 후로 설정
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('votingDeadline').value = tomorrow.toISOString().slice(0, 16);
  }

  // 투표 발행
  publishVoting() {
    const title = document.getElementById('votingTitle').value;
    const options = document.getElementById('votingOptions').value.split('\n').filter(opt => opt.trim());
    const deadline = document.getElementById('votingDeadline').value;

    if (!title || options.length < 2) {
      this.showErrorMessage('제목과 최소 2개의 옵션을 입력해주세요.');
      return;
    }

    const votingId = 'vote_' + Date.now();
    const messageContent = `
      <div class="voting-message" data-voting-id="${votingId}">
        <div class="voting-header">
          <div class="voting-icon">🗳️</div>
          <div class="voting-title">${title}</div>
        </div>
        <div class="voting-options">
          ${options.map((option, index) => `
            <button class="voting-option" onclick="window.dapp.voteChatPoll('${votingId}', ${index}, '${option}')">
              <span class="option-text">${option}</span>
              <span class="vote-count" id="vote-${votingId}-${index}">0표</span>
            </button>
          `).join('')}
        </div>
        <div class="voting-info">
          <small>마감: ${new Date(deadline).toLocaleString()}</small>
        </div>
      </div>
    `;

    this.addMessageToChat(messageContent, true);
    this.scrollToBottom();
    document.querySelector('.modal').remove();
    this.showSuccessMessage('투표가 생성되었습니다.');
  }

  // 채팅 투표하기
  voteChatPoll(votingId, optionIndex, optionText) {
    // 이미 투표했는지 확인
    const votingElement = document.querySelector(`[data-voting-id="${votingId}"]`);
    if (votingElement.classList.contains('voted')) {
      this.showErrorMessage('이미 투표하셨습니다.');
      return;
    }

    // 투표 처리
    const voteCountElement = document.getElementById(`vote-${votingId}-${optionIndex}`);
    const currentCount = parseInt(voteCountElement.textContent) || 0;
    voteCountElement.textContent = `${currentCount + 1}표`;

    // 투표 완료 표시
    votingElement.classList.add('voted');
    votingElement.querySelectorAll('.voting-option').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.6';
    });

    this.showSuccessMessage(`"${optionText}"에 투표했습니다.`);
  }

  // 일정 생성
  createSchedule() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>일정 공유</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="schedule-form">
            <div class="form-group">
              <label>일정 제목</label>
              <input type="text" id="scheduleTitle" placeholder="일정 제목을 입력하세요">
            </div>
            <div class="form-group">
              <label>일정 설명</label>
              <textarea id="scheduleDescription" placeholder="일정에 대한 설명을 입력하세요" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>시작 시간</label>
              <input type="datetime-local" id="scheduleStart">
            </div>
            <div class="form-group">
              <label>종료 시간</label>
              <input type="datetime-local" id="scheduleEnd">
            </div>
            <div class="form-group">
              <label>위치 (선택사항)</label>
              <input type="text" id="scheduleLocation" placeholder="모임 장소">
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
          <button class="btn-primary" onclick="window.dapp.shareSchedule()">일정 공유</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // 기본 시간을 현재 시간으로 설정
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    document.getElementById('scheduleStart').value = now.toISOString().slice(0, 16);
    document.getElementById('scheduleEnd').value = oneHourLater.toISOString().slice(0, 16);
  }

  // 일정 공유
  shareSchedule() {
    const title = document.getElementById('scheduleTitle').value;
    const description = document.getElementById('scheduleDescription').value;
    const start = document.getElementById('scheduleStart').value;
    const end = document.getElementById('scheduleEnd').value;
    const location = document.getElementById('scheduleLocation').value;

    if (!title || !start || !end) {
      this.showErrorMessage('제목, 시작시간, 종료시간을 입력해주세요.');
      return;
    }

    const messageContent = `
      <div class="schedule-message">
        <div class="schedule-header">
          <div class="schedule-icon">📅</div>
          <div class="schedule-title">${title}</div>
        </div>
        <div class="schedule-details">
          ${description ? `<div class="schedule-description">${description}</div>` : ''}
          <div class="schedule-time">
            <strong>시작:</strong> ${new Date(start).toLocaleString()}
          </div>
          <div class="schedule-time">
            <strong>종료:</strong> ${new Date(end).toLocaleString()}
          </div>
          ${location ? `<div class="schedule-location"><strong>장소:</strong> ${location}</div>` : ''}
        </div>
        <div class="schedule-actions">
          <button class="btn-secondary" onclick="window.dapp.addToCalendar('${title}', '${start}', '${end}', '${description}', '${location}')">
            캘린더에 추가
          </button>
        </div>
      </div>
    `;

    this.addMessageToChat(messageContent, true);
    this.scrollToBottom();
    document.querySelector('.modal').remove();
    this.showSuccessMessage('일정이 공유되었습니다.');
  }

  // 캘린더에 추가
  addToCalendar(title, start, end, description, location) {
    // Google Calendar URL 생성
    const startDate = new Date(start).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endDate = new Date(end).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startDate}/${endDate}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;
    
    window.open(calendarUrl, '_blank');
    this.showSuccessMessage('캘린더 앱이 열렸습니다.');
  }

  // 이모지 피커 열기
  openEmojiPicker() {
    const modal = document.getElementById('emojiPickerModal');
    if (modal) {
      this.loadEmojiGrid();
      modal.classList.add('active');
    }
  }

  // 이모지 피커 닫기
  closeEmojiPicker() {
    const modal = document.getElementById('emojiPickerModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // 이모지 그리드 로드
  loadEmojiGrid() {
    const emojiGrid = document.getElementById('emojiGrid');
    if (!emojiGrid) return;

    // 모든 이모지를 한번에 표시
    const allEmojis = [
      // 최근 사용한 이모지
      ...this.getRecentEmojis(),
      // 사람
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
      '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
      '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
      '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
      // 자연
      '🌱', '🌿', '🍀', '🌳', '🌲', '🌴', '🌵', '🌷', '🌸', '🌹', '🌺', '🌻', '🌼', '🌽', '🍄', '🌰',
      '🌾', '💐', '🌊', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️',
      '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌙', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '⭐', '🌟',
      // 음식
      '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆',
      '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥖', '🍞', '🥨', '🥯',
      '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙',
      // 활동
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🥍', '🏏',
      '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬',
      '🎤', '🎧', '🎼', '🎵', '🎶', '🥽', '🥼', '🦺', '👑', '👒', '🎩', '🎓', '🧢', '⛑️', '📿', '💄',
      // 여행
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵',
      '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚀', '🛰️', '🚢', '⛵',
      '🚤', '🛥️', '🛳️', '⛴️', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇', '🚈', '🚉', '🚊', '🚝', '🚞', '🚋',
      // 사물
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼',
      '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭',
      '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸',
      // 기호
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈',
      '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳'
    ];

    // 중복 제거
    const uniqueEmojis = [...new Set(allEmojis)];
    
    emojiGrid.innerHTML = uniqueEmojis.map(emoji => 
      `<button class="emoji-item" onclick="window.dapp.insertEmoji('${emoji}')">${emoji}</button>`
    ).join('');
  }

  // 최근 사용한 이모지 가져오기
  getRecentEmojis() {
    const recentEmojis = localStorage.getItem('recentEmojis');
    if (recentEmojis) {
      return JSON.parse(recentEmojis);
    }
    // 기본 최근 이모지
    return ['😀', '😂', '😍', '😭', '😊', '😎', '🤔', '😴', '😋', '😘', '😢', '😡', '👍', '👎', '👏', '🙏'];
  }

  // 최근 사용한 이모지에 추가
  addToRecentEmojis(emoji) {
    let recentEmojis = this.getRecentEmojis();
    
    // 이미 있으면 제거 후 맨 앞에 추가
    recentEmojis = recentEmojis.filter(e => e !== emoji);
    recentEmojis.unshift(emoji);
    
    // 최대 24개까지만 저장
    if (recentEmojis.length > 24) {
      recentEmojis = recentEmojis.slice(0, 24);
    }
    
    localStorage.setItem('recentEmojis', JSON.stringify(recentEmojis));
  }

  // 이모지 삽입
  insertEmoji(emoji) {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      const currentValue = messageInput.value;
      const cursorPosition = messageInput.selectionStart || messageInput.value.length;
      const newValue = currentValue.slice(0, cursorPosition) + emoji + currentValue.slice(cursorPosition);
      messageInput.value = newValue;
      messageInput.focus();
      messageInput.setSelectionRange(cursorPosition + emoji.length, cursorPosition + emoji.length);
      
      // 최근 사용한 이모지에 추가
      this.addToRecentEmojis(emoji);
    }
    this.closeEmojiPicker();
  }

  // 음성메시지 토글
  toggleVoiceMessage() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  // 음성 녹음 시작
  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.isRecording = true;

      // 녹음 버튼 상태 변경
      const voiceBtn = document.querySelector('.input-extra-btn[onclick*="toggleVoiceMessage"]');
      if (voiceBtn) {
        voiceBtn.innerHTML = '⏹️';
        voiceBtn.style.background = '#ef4444';
        voiceBtn.style.color = 'white';
      }

      // 녹음 시작
      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.sendVoiceMessage(audioBlob);
        
        // 스트림 정리
        stream.getTracks().forEach(track => track.stop());
        
        // 버튼 상태 복원
        if (voiceBtn) {
          voiceBtn.innerHTML = '🎤';
          voiceBtn.style.background = '';
          voiceBtn.style.color = '';
        }
        
        this.isRecording = false;
      };

      this.mediaRecorder.start();
      this.showSuccessMessage('음성 녹음을 시작했습니다. 다시 누르면 전송됩니다.');

    } catch (error) {
      this.showErrorMessage('마이크 접근 권한이 필요합니다.');
      console.error('Recording error:', error);
    }
  }

  // 음성 녹음 중지
  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
    }
  }

  // 음성 메시지 전송
  sendVoiceMessage(audioBlob) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const audioData = e.target.result;
      const duration = Math.floor(Math.random() * 30) + 5; // 임시 시간 (5-35초)
      
      const messageContent = `
        <div class="voice-message">
          <div class="voice-player">
            <button class="voice-play-btn" onclick="window.dapp.playVoiceMessage(this, '${audioData}')">
              ▶️
            </button>
            <div class="voice-waveform">
              <div class="voice-duration">${duration}초</div>
              <div class="voice-progress">
                <div class="voice-progress-bar"></div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      this.addMessageToChat(messageContent, true);
      this.scrollToBottom();
      this.showSuccessMessage('음성 메시지가 전송되었습니다.');
    };
    
    reader.readAsDataURL(audioBlob);
  }

  // 음성 메시지 재생
  playVoiceMessage(button, audioData) {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }

    const audio = new Audio(audioData);
    this.currentAudio = audio;
    
    button.innerHTML = '⏸️';
    
    audio.onended = () => {
      button.innerHTML = '▶️';
      this.currentAudio = null;
    };
    
    audio.onerror = () => {
      button.innerHTML = '▶️';
      this.currentAudio = null;
      this.showErrorMessage('음성 재생 중 오류가 발생했습니다.');
    };
    
    audio.play().catch(() => {
      button.innerHTML = '▶️';
      this.currentAudio = null;
      this.showErrorMessage('음성 재생에 실패했습니다.');
    });
  }

  // 사용자 차단
  blockUser() {
    this.closeChatInfo();
    if (confirm('이 사용자를 차단하시겠습니까?')) {
      this.showSuccessMessage('사용자를 차단했습니다.');
    }
  }

  // 사용자 신고
  reportUser() {
    this.closeChatInfo();
    if (confirm('이 사용자를 신고하시겠습니까?')) {
      this.showSuccessMessage('신고가 접수되었습니다.');
    }
  }



  // 모달 외부 클릭 시 닫기 기능 추가
  setupModalCloseHandlers() {
    const modals = ['chatMenuModal', 'attachmentMenuModal', 'chatInfoModal', 'emojiPickerModal'];
    
    modals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.remove('active');
          }
        });
      }
    });
  }

  // P2P 검색 기능들

  // 연락처 검색
  searchContacts(searchTerm) {
    const clearBtn = document.querySelector('#contactsScreen .clear-search-btn');
    
    if (searchTerm.trim() === '') {
      if (clearBtn) clearBtn.style.display = 'none';
      this.loadContacts();
      return;
    }
    
    if (clearBtn) clearBtn.style.display = 'block';
    
    const contacts = this.getContactsList();
    const filteredContacts = contacts.filter(contact => 
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.address.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    this.renderFilteredContacts(filteredContacts);
  }

  // 연락처 검색 초기화
  clearContactSearch() {
    const searchInput = document.getElementById('contactSearchInput');
    const clearBtn = document.querySelector('#contactsScreen .clear-search-btn');
    
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    
    this.loadContacts();
  }

  // 채팅방 검색
  searchChats(searchTerm) {
    const clearBtn = document.querySelector('#chatsScreen .clear-search-btn');
    
    if (searchTerm.trim() === '') {
      if (clearBtn) clearBtn.style.display = 'none';
      this.loadChats();
      return;
    }
    
    if (clearBtn) clearBtn.style.display = 'block';
    
    const chats = this.getChatsList();
    const filteredChats = chats.filter(chat => 
      chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    this.renderFilteredChats(filteredChats);
  }

  // 채팅방 검색 초기화
  clearChatSearch() {
    const searchInput = document.getElementById('chatSearchInput');
    const clearBtn = document.querySelector('#chatsScreen .clear-search-btn');
    
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    
    this.loadChats();
  }

  // 연락처 목록 가져오기
  getContactsList() {
    // 로컬 스토리지에서 실제 연락처 데이터 가져오기
    const contacts = JSON.parse(localStorage.getItem('baekya_contacts') || '[]');
    
    console.log('📋 저장된 연락처 목록 로드:', contacts);
    
    // 연락처가 없으면 빈 배열 반환
    return contacts.map(contact => {
      const mappedContact = {
        id: contact.id || contact.commAddress || contact.address || `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: contact.name || '알 수 없음',
        address: contact.commAddress || contact.address,
        commAddress: contact.commAddress || contact.address,
        avatar: contact.avatar, // 실제 아바타 정보 사용
        username: contact.username,
        status: contact.status || 'offline',
        source: contact.source || 'unknown'
      };
      
      console.log('📇 매핑된 연락처:', mappedContact);
      return mappedContact;
    });
  }

  // 채팅방 목록 가져오기
  getChatsList() {
    return [
      { id: 'chat_1', name: '김개발', type: 'private', lastMessage: '백야 프로토콜 정말 흥미롭네요!', timestamp: '14:32', avatar: 'K' },
      { id: 'chat_group_1', name: 'Development DAO', type: 'group', lastMessage: '새로운 PR이 올라왔습니다', timestamp: '12:15', memberCount: 12, avatar: 'D' },
      { id: 'chat_2', name: '이기여', type: 'private', lastMessage: 'P-Token 전송 완료했습니다', timestamp: '11:45', avatar: 'L' },
      { id: 'chat_group_2', name: 'Governance DAO', type: 'group', lastMessage: '[공지] 새로운 제안 투표가 시작되었습니다', timestamp: '어제', memberCount: 28, avatar: 'G' },
      { id: 'chat_3', name: '박검증', type: 'private', lastMessage: '블록 검증 완료 알림 📦', timestamp: '어제', avatar: 'P' },
      { id: 'chat_group_3', name: 'Mining Pool', type: 'group', lastMessage: '오늘 채굴 수익률이 좋네요', timestamp: '2일 전', memberCount: 45, avatar: 'M' },
      { id: 'chat_4', name: '최채굴', type: 'private', lastMessage: '채굴 장비 관련 문의드려요', timestamp: '3일 전', avatar: 'C' }
    ];
  }

  // 필터된 연락처 렌더링
  renderFilteredContacts(contacts) {
    const contactsList = document.getElementById('contactsList');
    if (!contactsList) return;
    
    if (contacts.length === 0) {
      contactsList.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>검색 결과가 없습니다</p><small>다른 검색어를 시도해보세요</small></div>`;
      return;
    }
    
    contactsList.innerHTML = contacts.map(contact => {
      const contactInfo = { id: contact.id, name: contact.name, avatar: contact.avatar };
      const isFavorite = contact.isFavorite || false;
      const isBlocked = this.isContactBlocked(contact.id);
      
      return `
        <div class="contact-item ${isBlocked ? 'blocked' : ''}" data-contact-id="${contact.id}">
          <div class="contact-clickable-area" onclick="window.dapp.showProfileView('${contact.id}')" style="cursor: pointer;">
            ${this.generateAvatarHTML(contactInfo, 'contact-simple')}
            <div class="contact-info">
              <div class="contact-name">${contact.name}</div>
            </div>
          </div>

        </div>`;
    }).join('');
  }

  // 필터된 채팅방 렌더링
  renderFilteredChats(chats) {
    const chatsList = document.getElementById('chatsList');
    if (!chatsList) return;
    
    if (chats.length === 0) {
      chatsList.innerHTML = `<div class="empty-state"><i class="fas fa-search"></i><p>검색 결과가 없습니다</p><small>다른 검색어를 시도해보세요</small></div>`;
      return;
    }
    
    chatsList.innerHTML = chats.map(chat => {
      const contactInfo = this.getContactInfo(chat.id);
      const chatContact = { id: chat.id, name: chat.name, avatar: contactInfo.avatar || null };
      
      return `
        <div class="chat-item" onclick="window.dapp.openChat('${chat.id}')">
          <div class="chat-avatar-wrapper">${this.generateAvatarHTML(chatContact, 'chat-simple')}</div>
          <div class="chat-info">
            <div class="chat-item-header">
              <div class="chat-name" style="color: #333 !important; font-weight: bold !important; font-size: 16px !important;">${chat.name}</div>
              ${chat.type === 'group' ? `<span class="member-count">${chat.memberCount}명</span>` : ''}
            </div>
            <div class="chat-preview">${chat.lastMessage}</div>
          </div>
          <div class="chat-meta">
            <div class="chat-time">${chat.timestamp}</div>
          </div>
        </div>`;
    }).join('');
  }





  // 채팅 필터링 관련 함수들
  filterChats(filterType) {
    console.log('🔄 채팅 필터 변경:', filterType);
    
    // 현재 필터 업데이트
    this.currentChatFilter = filterType;
    
    // 필터 버튼 UI 업데이트
    this.updateChatFilterButtons(filterType);
    
    // 채팅 리스트 새로고침
    this.loadChats();
  }

  updateChatFilterButtons(activeFilter) {
    const filterButtons = document.querySelectorAll('.chat-filter-nav .dao-filter-btn');
    filterButtons.forEach(btn => {
      const filter = btn.getAttribute('data-filter');
      if (filter === activeFilter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  filterChatsByType(chats, filterType) {
    switch (filterType) {
      case 'individual':
        return chats.filter(chat => chat.type === 'private');
      case 'group':
        return chats.filter(chat => chat.type === 'group');
      case 'public':
        return chats.filter(chat => chat.type === 'public');
      case 'all':
      default:
        return chats;
    }
  }

  checkChatFilterResults(filterType, resultCount) {
    const filterName = this.getChatFilterName(filterType);
    
    if (resultCount === 0) {
      document.getElementById('chatsList').innerHTML = `
        <div class="empty-state">
          <i class="fas fa-comments"></i>
          <p>${filterName} 채팅이 없습니다</p>
          <small>새로운 대화를 시작해보세요</small>
        </div>
      `;
    }
  }

  getChatFilterName(filterType) {
    switch (filterType) {
      case 'individual': return '개인';
      case 'group': return '단체';
      case 'all':
      default: return '전체';
    }
  }

  // 공개 채팅 관련 함수들
  loadPublicChats() {
    const publicChatsList = document.getElementById('publicChatsList');
    if (!publicChatsList) return;
    
    // 공개 채팅방 데이터 (초기에는 비어있음)
    const publicChats = [];
    
    // 공개 채팅방이 없을 때 빈 상태 표시
    if (publicChats.length === 0) {
      publicChatsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-comments"></i>
          <p>공개 채팅방이 없습니다</p>
          <small>첫 번째 공개 채팅방을 만들어보세요!</small>
        </div>
      `;
      return;
    }
    
    // 모든 공개 채팅방 표시 (필터 제거됨)
    publicChatsList.innerHTML = publicChats.map(chat => this.createPublicChatItem(chat)).join('');
  }

  createPublicChatItem(chat) {
    const isFull = chat.memberCount >= chat.maxMembers;
    
    return `
      <div class="public-chat-item" onclick="window.dapp.joinPublicChat('${chat.id}')">
        <div class="public-chat-avatar">
          ${chat.name.charAt(0).toUpperCase()}
        </div>
        <div class="public-chat-info">
          <div class="public-chat-header-row">
            <div class="public-chat-name">${chat.name}</div>
          </div>
          <div class="public-chat-description">${chat.description}</div>
          <div class="public-chat-meta">
            <div class="public-chat-members">
              <i class="fas fa-users"></i>
              <span>${chat.memberCount}/${chat.maxMembers}</span>
            </div>
            <div class="public-chat-tags">
              ${chat.tags.map(tag => `<span class="public-chat-tag">${tag}</span>`).join(' ')}
            </div>
          </div>
        </div>
        <div class="public-chat-stats">
          <div class="public-chat-member-count ${isFull ? 'full' : ''}">
            <i class="fas fa-${isFull ? 'lock' : 'users'}"></i>
            <span>${isFull ? '만석' : `${chat.memberCount}명`}</span>
          </div>
          <div class="public-chat-activity">
            <div class="activity-indicator ${chat.activity}"></div>
            <span>${this.getActivityText(chat.activity)}</span>
          </div>
        </div>
      </div>
    `;
  }

  getCategoryName(category) {
    const categories = {
      'dao': 'DAO',
      'tech': '기술',
      'community': '커뮤니티',
      'trading': '트레이딩',
      'general': '일반'
    };
    return categories[category] || category;
  }

  getActivityText(activity) {
    const activities = {
      'high': '활발',
      'medium': '보통',
      'low': '조용'
    };
    return activities[activity] || activity;
  }

  filterPublicChats(filterType) {
    this.currentPublicChatFilter = filterType;
    
    // 필터 버튼 업데이트
    const filterButtons = document.querySelectorAll('#publicScreen .dao-filter-btn');
    filterButtons.forEach(btn => {
      if (btn.getAttribute('data-filter') === filterType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // 채팅방 목록 새로고침
    this.loadPublicChats();
  }

  filterPublicChatsByType(chats, filterType) {
    // 카테고리 필터가 제거되었으므로 모든 채팅방을 반환
    return chats;
  }

  searchPublicChats(searchTerm) {
    const clearBtn = document.querySelector('#publicScreen .clear-search-btn');
    if (clearBtn) {
      clearBtn.style.display = searchTerm ? 'block' : 'none';
    }
    
    // 검색 구현 (실제로는 서버에서 검색)
    console.log('공개 채팅방 검색:', searchTerm);
    this.loadPublicChats(); // 임시로 전체 목록 새로고침
  }

  clearPublicChatSearch() {
    const searchInput = document.getElementById('publicChatSearchInput');
    if (searchInput) {
      searchInput.value = '';
      this.searchPublicChats('');
    }
  }

  showCreatePublicChatModal() {
    // 로그인 확인
    if (!this.isAuthenticated || !this.currentUser) {
      this.showErrorMessage('로그인 후 이용 가능합니다.');
      return;
    }
    
    const modal = document.getElementById('createPublicChatModal');
    if (modal) {
      modal.classList.add('active');
      
      // 폼 초기화
      const form = document.getElementById('createPublicChatForm');
      if (form) form.reset();
    }
  }

  closeCreatePublicChatModal() {
    const modal = document.getElementById('createPublicChatModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  async handleCreatePublicChat(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const chatData = {
      name: formData.get('name'),
      description: formData.get('description'),
      maxMembers: parseInt(formData.get('maxMembers')),
      tags: formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag)
    };
    
    // 본인 인증
    const authConfirmed = await this.requestAuthentication('공개 채팅방 생성');
    if (!authConfirmed) {
      return;
    }
    
    // 수수료 차감 시뮬레이션
    this.showSuccessMessage(`'${chatData.name}' 공개 채팅방이 생성되었습니다. (수수료: 0.01 B)`);
    
    // 모달 닫기
    this.closeCreatePublicChatModal();
    
    // 공개 채팅방 목록 새로고침
    this.loadPublicChats();
    
    // 생성된 채팅방으로 자동 입장
    setTimeout(() => {
      this.joinPublicChat('new_public_chat_' + Date.now());
    }, 500);
  }

  async joinPublicChat(chatId) {
    // 공개 채팅방 입장
    console.log('공개 채팅방 입장:', chatId);
    
    // 일반 채팅방처럼 처리하되, 공개 채팅방임을 표시
    this.openChat(chatId);
  }





  // 연락처 차단 관련 메서드
  isContactBlocked(contactId) {
    const blockedContacts = JSON.parse(localStorage.getItem('blockedContacts') || '[]');
    return blockedContacts.includes(contactId);
  }

  toggleBlockContact(contactId) {
    const blockedContacts = JSON.parse(localStorage.getItem('blockedContacts') || '[]');
    const contact = this.getContactInfo(contactId);
    
    if (this.isContactBlocked(contactId)) {
      // 차단 해제
      const index = blockedContacts.indexOf(contactId);
      if (index > -1) {
        blockedContacts.splice(index, 1);
      }
      localStorage.setItem('blockedContacts', JSON.stringify(blockedContacts));
      this.showSuccessMessage(`${contact.name}님의 차단이 해제되었습니다.`);
    } else {
      // 차단
      blockedContacts.push(contactId);
      localStorage.setItem('blockedContacts', JSON.stringify(blockedContacts));
      this.showSuccessMessage(`${contact.name}님이 차단되었습니다.`);
    }

    // 연락처 목록 새로고침
    this.loadContacts();
  }

  async deleteContact(contactId) {
    const contact = this.getContactInfo(contactId);
    
    // 확인 대화상자
    const confirmed = confirm(`정말로 ${contact.name}님을 연락처에서 삭제하시겠습니까?`);
    
    if (confirmed) {
      // 연락처 삭제 로직 (실제로는 서버 API 호출)
      this.showSuccessMessage(`${contact.name}님이 연락처에서 삭제되었습니다.`);
      
      // 연락처 목록 새로고침
      this.loadContacts();
    }
  }

  async deleteChat(chatId) {
    const chat = this.getChatInfo(chatId);
    
    // 확인 대화상자
    const confirmed = confirm(`'${chat.name}' 채팅을 삭제하시겠습니까?\n채팅 내역은 유지되며, 채팅 목록에서만 제거됩니다.`);
    
    if (confirmed) {
      // 채팅 삭제 로직 (실제로는 서버 API 호출)
      this.showSuccessMessage(`채팅이 삭제되었습니다.`);
      
      // 채팅 목록 새로고침
      this.loadChats();
    }
  }

  async deleteChatAndLeave(chatId) {
    const chat = this.getChatInfo(chatId);
    
    // 확인 대화상자
    const confirmed = confirm(`'${chat.name}' 채팅방을 나가시겠습니까?\n채팅 내역이 모두 삭제되며 복구할 수 없습니다.`);
    
    if (confirmed) {
      // 채팅방 나가기 로직 (실제로는 서버 API 호출)
      this.showSuccessMessage(`채팅방을 나갔습니다.`);
      
      // 채팅 화면이 열려있다면 닫기
      if (this.currentChatId === chatId) {
        this.backToP2PList();
      }
      
      // 채팅 목록 새로고침
      this.loadChats();
    }
  }

  getChatInfo(chatId) {
    // 채팅 정보 가져오기 (시뮬레이션)
    const chats = this.getChatsList();
    const chat = chats.find(c => c.id === chatId);
    return chat || { id: chatId, name: '알 수 없는 채팅' };
  }

  // 사용자 차단 확인 모달 표시
  showBlockConfirmModal(contactId) {
    const contact = this.getContactInfo(contactId);
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-ban"></i> 사용자 차단</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="call-confirm-content">
            <div class="call-confirm-avatar">
              ${this.generateAvatarHTML(contact, 'contact-simple')}
            </div>
            <div class="call-confirm-info">
              <h4>${contact.name}</h4>
              <p>이 사용자를 차단하시겠습니까?</p>
              <small style="color: var(--text-secondary);">
                차단된 사용자로부터 메시지를 받을 수 없으며, 연락처 목록에서 별도로 표시됩니다.
              </small>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
          <button type="button" class="btn-primary" onclick="window.dapp.confirmBlockUser('${contactId}'); this.closest('.modal').remove();" style="background: #f59e0b;">
            <i class="fas fa-ban"></i> 차단하기
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // 사용자 차단 실행
  confirmBlockUser(contactId) {
    const contact = this.getContactInfo(contactId);
    
    // 실제 차단 로직 구현 (예: 로컬 스토리지나 서버에 상태 저장)
    const blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '[]');
    if (!blockedUsers.includes(contactId)) {
      blockedUsers.push(contactId);
      localStorage.setItem('blockedUsers', JSON.stringify(blockedUsers));
    }
    
    // UI 업데이트
    this.updateContactsAfterBlock(contactId);
    
    this.showSuccessMessage(`${contact.name}님이 차단되었습니다.`);
  }

  // 연락처 삭제 확인 모달 표시
  showDeleteContactModal(contactId) {
    const contact = this.getContactInfo(contactId);
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-trash"></i> 연락처 삭제</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="call-confirm-content">
            <div class="call-confirm-avatar">
              ${this.generateAvatarHTML(contact, 'contact-simple')}
            </div>
            <div class="call-confirm-info">
              <h4>${contact.name}</h4>
              <p>이 연락처를 삭제하시겠습니까?</p>
              <small style="color: var(--text-secondary);">
                삭제된 연락처는 복구할 수 없으며, 대화 기록은 유지됩니다.
              </small>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
          <button type="button" class="btn-primary" onclick="window.dapp.confirmDeleteContact('${contactId}'); this.closest('.modal').remove();" style="background: #dc2626;">
            <i class="fas fa-trash"></i> 삭제하기
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  // 연락처 삭제 실행
  confirmDeleteContact(contactId) {
    const contact = this.getContactInfo(contactId);
    
    // 실제 삭제 로직 구현 (예: 로컬 스토리지에서 제거)
    const deletedContacts = JSON.parse(localStorage.getItem('deletedContacts') || '[]');
    if (!deletedContacts.includes(contactId)) {
      deletedContacts.push(contactId);
      localStorage.setItem('deletedContacts', JSON.stringify(deletedContacts));
    }
    
    // UI 업데이트
    this.updateContactsAfterDelete(contactId);
    
    this.showSuccessMessage(`${contact.name}님이 연락처에서 삭제되었습니다.`);
  }

  // 차단 후 연락처 목록 업데이트
  updateContactsAfterBlock(contactId) {
    // 연락처 목록 다시 로드
    this.loadContacts();
    
    // 현재 채팅 중인 사용자가 차단된 경우 채팅 화면 닫기
    if (this.currentChatId === contactId) {
      this.backToP2PList();
    }
  }

  // 삭제 후 연락처 목록 업데이트
  updateContactsAfterDelete(contactId) {
    // 연락처 목록 다시 로드
    this.loadContacts();
    
    // 현재 채팅 중인 사용자가 삭제된 경우 채팅 화면 닫기
    if (this.currentChatId === contactId) {
      this.backToP2PList();
    }
  }

  // 차단된 사용자인지 확인
  isUserBlocked(contactId) {
    const blockedUsers = JSON.parse(localStorage.getItem('blockedUsers') || '[]');
    return blockedUsers.includes(contactId);
  }

  // 연락처 데이터 가져오기
  getContactsData() {
    // 로컬 스토리지에서 저장된 연락처 가져오기
    const savedContacts = JSON.parse(localStorage.getItem('baekya_contacts') || '[]');
    return savedContacts;
  }

  // 삭제된 연락처인지 확인
  isContactDeleted(contactId) {
    const deletedContacts = JSON.parse(localStorage.getItem('deletedContacts') || '[]');
    return deletedContacts.includes(contactId);
  }

  // BMR 시스템 제거됨
  

  
  calculateTotalContributionValue() {
    // 기여 내역에서 총 B토큰 가치 계산 (시뮬레이션)
    const contributions = this.dataCache.contributions || [];
    let totalValue = 0;
    
    contributions.forEach(contribution => {
      if (contribution.status === 'verified') {
        totalValue += contribution.bTokens || 0;
      }
    });
    
    // 실제 기여가치만 계산 (예시 데이터 제거)
    // totalValue += 0;
    
    return totalValue;
  }
  

  

  

  








  // 토큰 발행 시스템 관련 메서드들
  startMiningSystem(hourlyRate) {
    if (!this.isAuthenticated || !hourlyRate || hourlyRate <= 0) {
      return;
    }
    
    // 기존 타이머 정리
    this.stopMiningSystem();
    
    // 발행률 설정
    this.miningSystem.currentHourlyRate = hourlyRate;
    this.miningSystem.isActive = true;
    
    // 지난 발행 시간 확인 및 누락된 토큰 발행
    this.catchUpMissedTokens();
    
    // 다음 발행까지 카운트다운 시작
    this.startMiningTimer();
    
    console.log(`🪙 토큰 발행 시스템 시작: ${hourlyRate.toFixed(6)} B/시간`);
  }
  
  stopMiningSystem() {
    if (this.miningSystem.nextMiningTimer) {
      clearInterval(this.miningSystem.nextMiningTimer);
      this.miningSystem.nextMiningTimer = null;
    }
    if (this.miningSystem.countdownTimer) {
      clearInterval(this.miningSystem.countdownTimer);
      this.miningSystem.countdownTimer = null;
    }
    this.miningSystem.isActive = false;
    
    // 다음 발행 타이머 리셋
    const nextMiningTime = document.getElementById('nextMiningTime');
    if (nextMiningTime) {
      nextMiningTime.textContent = '00:00:00';
    }
  }
  
  startMiningTimer() {
    // 다음 정시까지 남은 시간 계산
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    
    // 첫 번째 발행까지 남은 시간
    const timeUntilNextHour = nextHour - now;
    
    // 첫 번째 발행 예약
    setTimeout(() => {
      this.mineTokens();
      // 이후 매시간 발행
      this.miningSystem.nextMiningTimer = setInterval(() => {
        this.mineTokens();
      }, 60 * 60 * 1000); // 1시간마다
    }, timeUntilNextHour);
    
    // 카운트다운 타이머 시작
    this.updateMiningCountdown();
    this.miningSystem.countdownTimer = setInterval(() => {
      this.updateMiningCountdown();
    }, 1000);
  }
  
  updateMiningCountdown() {
    const nextMiningTime = document.getElementById('nextMiningTime');
    if (!nextMiningTime) return;
    
    // 다음 정시까지 남은 시간 계산
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    
    const timeLeft = Math.max(0, nextHour - now);
    
    if (timeLeft === 0) {
      nextMiningTime.textContent = '발행 중...';
      return;
    }
    
    // 시:분:초 형식으로 표시
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    nextMiningTime.textContent = timeString;
  }
  
  mineTokens() {
    if (!this.miningSystem.isActive || !this.miningSystem.currentHourlyRate) {
      return;
    }
    
    const minedAmount = this.miningSystem.currentHourlyRate;
    
    // 현재 B토큰 잔액 증가
    if (!this.userTokens) {
      this.userTokens = { B: 0 };
    }
    
    this.userTokens.B = (this.userTokens.B || 0) + minedAmount;
    
    // 발행 시간 기록
    const now = new Date();
    this.miningSystem.lastMiningTime = now.toISOString();
    
    // 로컬 스토리지에 발행 기록 저장
    const miningHistory = JSON.parse(localStorage.getItem('miningHistory') || '[]');
    miningHistory.push({
      timestamp: now.toISOString(),
      amount: minedAmount,
      hourlyRate: this.miningSystem.currentHourlyRate
    });
    
    // 최근 24시간 기록만 유지
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentHistory = miningHistory.filter(record => new Date(record.timestamp) > oneDayAgo);
    localStorage.setItem('miningHistory', JSON.stringify(recentHistory));
    
    // 마지막 발행 시간 저장
    localStorage.setItem('lastMiningTime', this.miningSystem.lastMiningTime);
    localStorage.setItem('currentBalance', this.userTokens.B.toString());
    
    // UI 업데이트
    this.updateTokenBalances();
    
    // 성공 메시지 표시
    this.showSuccessMessage(`⏰ 시간당 토큰 발행: +${minedAmount.toFixed(6)} B`);
    
    console.log(`🪙 토큰 발행 완료: +${minedAmount.toFixed(6)} B (잔액: ${this.userTokens.B.toFixed(6)} B)`);
  }
  
  catchUpMissedTokens() {
    // 로컬 스토리지에서 마지막 발행 시간 확인
    const lastMiningTime = localStorage.getItem('lastMiningTime');
    const savedBalance = localStorage.getItem('currentBalance');
    
    if (savedBalance) {
      this.userTokens = { B: parseFloat(savedBalance) || 0 };
    }
    
    if (!lastMiningTime) {
      // 첫 로그인인 경우 현재 시간을 마지막 발행 시간으로 설정
      this.miningSystem.lastMiningTime = new Date().toISOString();
      localStorage.setItem('lastMiningTime', this.miningSystem.lastMiningTime);
      return;
    }
    
    const lastTime = new Date(lastMiningTime);
    const now = new Date();
    
    // 마지막 발행 시간 이후 경과된 완전한 시간 수 계산
    const hoursPassed = Math.floor((now - lastTime) / (1000 * 60 * 60));
    
    if (hoursPassed > 0) {
      const missedTokens = hoursPassed * this.miningSystem.currentHourlyRate;
      
      if (!this.userTokens) {
        this.userTokens = { B: 0 };
      }
      
      this.userTokens.B = (this.userTokens.B || 0) + missedTokens;
      
      // 새로운 마지막 발행 시간 설정 (현재 시간에서 정시로 맞춤)
      const adjustedTime = new Date(now);
      adjustedTime.setMinutes(0, 0, 0);
      this.miningSystem.lastMiningTime = adjustedTime.toISOString();
      
      // 저장
      localStorage.setItem('lastMiningTime', this.miningSystem.lastMiningTime);
      localStorage.setItem('currentBalance', this.userTokens.B.toString());
      
      console.log(`🔄 누락 토큰 발행: ${hoursPassed}시간 × ${this.miningSystem.currentHourlyRate.toFixed(6)} B = +${missedTokens.toFixed(6)} B`);
      
      if (hoursPassed > 0) {
        this.showSuccessMessage(`⏰ 오프라인 중 발행된 토큰: +${missedTokens.toFixed(6)} B (${hoursPassed}시간)`);
      }
    }
  }

  // TOP-OP DAO 생성 권한 확인
  checkTopOPDAOCreationAccess() {
    const userOPRole = this.getUserOPRole();
    const daoTopOPSection = document.getElementById('daoTopOPSection');
    
    if (daoTopOPSection) {
      if (userOPRole.isTopOP && this.isAuthenticated) {
        daoTopOPSection.style.display = 'block';
      } else {
        daoTopOPSection.style.display = 'none';
      }
    }
  }

  // DAO 생성 모달 표시
  showCreateDAOModal() {
    // 권한 재확인
    const userOPRole = this.getUserOPRole();
    if (!userOPRole.isTopOP) {
      this.showErrorMessage('TOP-OP 권한이 필요합니다.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'createDAOModal';
    
    modal.innerHTML = `
      <div class="modal-content create-dao-modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-plus"></i> 새 DAO 생성</h3>
          <button class="modal-close" onclick="window.dapp.closeCreateDAOModal()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createDAOForm">
            <!-- 기본 정보 섹션 -->
            <div class="dao-form-section">
              <h4><i class="fas fa-info-circle"></i> 기본 정보</h4>
              <div class="form-group">
                <label for="daoTitle">DAO 이름</label>
                <input type="text" id="daoTitle" placeholder="예: Innovation DAO" required>
              </div>
              <div class="form-group">
                <label for="daoDescription">DAO 설명</label>
                <textarea id="daoDescription" placeholder="DAO의 목적과 역할을 설명해주세요..." rows="3" required></textarea>
              </div>
            </div>

            <!-- 참여 안내 섹션 -->
            <div class="dao-form-section">
              <h4><i class="fas fa-users"></i> 참여 안내</h4>
              <div class="form-group">
                <label for="daoParticipationGuide">참여하기 안내 내용</label>
                <textarea id="daoParticipationGuide" placeholder="사용자가 '참여하기' 버튼을 눌렀을 때 보여질 안내 내용을 작성해주세요..." rows="4" required></textarea>
              </div>
            </div>

            <!-- DCA 설정 섹션 -->
            <div class="dao-form-section">
              <h4><i class="fas fa-tasks"></i> 지정기여활동 (DCA) 설정</h4>
              <div class="dca-setup-area">
                <div class="dca-list" id="newDAODCAList">
                  <!-- DCA 항목들이 동적으로 추가됩니다 -->
                </div>
                <button type="button" class="btn-secondary add-dca-btn" onclick="window.dapp.addNewDAODCA()">
                  <i class="fas fa-plus"></i> DCA 추가
                </button>
              </div>
            </div>

            <!-- 기여하러가기 설정 섹션 -->
            <div class="dao-form-section">
              <h4><i class="fas fa-rocket"></i> 기여하러가기 설정</h4>
              <div class="contribution-setup">
                <div class="contribution-options-list" id="contributionOptionsList">
                  <!-- 기여 옵션들이 동적으로 추가됩니다 -->
                </div>
                <button type="button" class="btn-secondary add-contribution-btn" onclick="window.dapp.addContributionOption()">
                  <i class="fas fa-plus"></i> 기여하러가기 옵션 추가
                </button>
                <div class="form-help">
                  <i class="fas fa-info-circle"></i>
                  DevDAO처럼 여러 개의 기여하러가기 버튼을 설정할 수 있습니다. (예: GitHub 연동, 기여 가이드 등)
                </div>
              </div>
            </div>

            <!-- 이니셜 OP 설정 섹션 -->
            <div class="dao-form-section">
              <h4><i class="fas fa-crown"></i> 이니셜 OP 설정</h4>
              <div class="form-group">
                <label for="initialOPAddress">이니셜 OP 통신주소</label>
                <input type="text" id="initialOPAddress" placeholder="OP가 될 사용자의 통신주소 (DID)를 입력하세요" required>
                <small class="form-help">
                  <i class="fas fa-info-circle"></i>
                  이니셜 OP에게는 DAO 생성과 동시에 해당 DAO의 P토큰 30개가 지급됩니다.
                </small>
              </div>
            </div>

            <!-- 첨부파일 섹션 -->
            <div class="dao-form-section">
              <h4><i class="fas fa-paperclip"></i> 첨부파일</h4>
              <div class="form-group">
                <label for="topOPDAOAttachments">첨부파일</label>
                <div class="file-upload-area" onclick="document.getElementById('topOPDAOFileInput').click()">
                  <div class="file-upload-content">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>클릭하여 파일을 선택하거나 드래그하여 업로드하세요</p>
                    <small>지원 형식: PDF, DOC, DOCX, TXT, JPG, PNG (최대 10MB)</small>
                  </div>
                  <input type="file" id="topOPDAOFileInput" multiple accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" style="display: none;" onchange="window.dapp.handleTopOPDAOFileUpload(this)">
                </div>
                <div class="uploaded-files-list" id="topOPDAOUploadedFiles"></div>
              </div>
            </div>

            <!-- TOP-OP 특권 안내 -->
            <div class="dao-form-section dao-privilege-info">
              <div class="privilege-notice">
                <i class="fas fa-crown"></i>
                <div class="privilege-details">
                  <strong>TOP-OP 특권: 수수료 없이 즉시 생성</strong>
                  <small>최상위 OP는 수수료 없이 DAO를 즉시 생성할 수 있습니다.</small>
                </div>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="window.dapp.closeCreateDAOModal()">
            <i class="fas fa-times"></i> 취소
          </button>
          <button type="submit" form="createDAOForm" class="btn-primary" onclick="window.dapp.handleCreateDAO(event)">
            <i class="fas fa-plus"></i> DAO 생성
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // 첫 번째 기여하러가기 옵션 자동 추가
    setTimeout(() => {
      this.addContributionOption();
    }, 100);
    
    // 폼 제출 이벤트 리스너
    document.getElementById('createDAOForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateDAO(e);
    });
  }

  // DAO 생성 모달 닫기
  closeCreateDAOModal() {
    const modal = document.getElementById('createDAOModal');
    if (modal) {
      modal.remove();
    }
  }

  // 새 DAO에 DCA 추가
  addNewDAODCA() {
    const dcaList = document.getElementById('newDAODCAList');
    const dcaIndex = dcaList.children.length;
    
    const dcaItem = document.createElement('div');
    dcaItem.className = 'dca-form-item';
    dcaItem.innerHTML = `
      <div class="dca-form-header">
        <h5>DCA ${dcaIndex + 1}</h5>
        <button type="button" class="btn-small btn-delete" onclick="this.closest('.dca-form-item').remove()">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div class="dca-form-fields">
        <div class="form-group">
          <label>제목</label>
          <input type="text" name="dcaTitle[]" placeholder="예: Pull Request" required>
        </div>
        <div class="form-group">
          <label>검증기준</label>
          <input type="text" name="dcaCriteria[]" placeholder="예: merged" required>
        </div>
        <div class="form-group">
          <label>기여가치</label>
          <input type="number" name="dcaValue[]" placeholder="예: 250" min="1" required>
        </div>
      </div>
    `;
    
    dcaList.appendChild(dcaItem);
  }

  // 기여하러가기 옵션 추가
  addContributionOption() {
    const optionsList = document.getElementById('contributionOptionsList');
    const optionIndex = optionsList.children.length;
    
    const optionItem = document.createElement('div');
    optionItem.className = 'contribution-option-item';
    optionItem.innerHTML = `
      <div class="contribution-option-header">
        <h5>기여하러가기 옵션 ${optionIndex + 1}</h5>
        <button type="button" class="btn-small btn-delete" onclick="this.closest('.contribution-option-item').remove()">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div class="contribution-option-fields">
        <div class="form-group">
          <label>제목</label>
          <input type="text" name="contributionTitle[]" placeholder="예: GitHub 연동" required>
        </div>
        <div class="form-group">
          <label>설명</label>
          <textarea name="contributionDescription[]" placeholder="예: GitHub 저장소와 연동하여 자동으로 기여가 반영됩니다." rows="2" required></textarea>
        </div>
        <div class="form-group">
          <label>버튼 텍스트</label>
          <input type="text" name="contributionButtonText[]" placeholder="예: GitHub 연동하기" required>
        </div>
        <div class="form-group">
          <label>아이콘</label>
          <select name="contributionIcon[]" required>
            <option value="">아이콘 선택</option>
            <option value="fab fa-github">GitHub</option>
            <option value="fas fa-book-open">가이드/문서</option>
            <option value="fas fa-external-link-alt">외부 링크</option>
            <option value="fas fa-key">초대/액세스</option>
            <option value="fas fa-lightbulb">제안/아이디어</option>
            <option value="fas fa-code">코드/개발</option>
            <option value="fas fa-users">커뮤니티</option>
            <option value="fas fa-rocket">시작하기</option>
            <option value="fas fa-tasks">작업/활동</option>
            <option value="fas fa-cogs">설정/도구</option>
          </select>
        </div>
        <div class="form-group">
          <label>액션 타입</label>
          <select name="contributionActionType[]" onchange="window.dapp.onContributionActionTypeChange(this)" required>
            <option value="">액션 타입 선택</option>
            <option value="internal">내부 시스템 (DCA 완료)</option>
            <option value="external">외부 링크 연결</option>
            <option value="github">GitHub 연동</option>
            <option value="modal">모달/팝업 표시</option>
            <option value="custom">커스텀 액션</option>
          </select>
        </div>
        <div class="contribution-action-config" data-config-for="option-${optionIndex}">
          <!-- 액션 타입별 추가 설정이 여기에 표시됩니다 -->
        </div>
      </div>
    `;
    
    optionsList.appendChild(optionItem);
  }

  // 기여 액션 타입 변경 시 추가 설정 표시
  onContributionActionTypeChange(selectElement) {
    const actionType = selectElement.value;
    const optionItem = selectElement.closest('.contribution-option-item');
    const configArea = optionItem.querySelector('.contribution-action-config');
    
    // 기존 설정 제거
    configArea.innerHTML = '';
    
    switch(actionType) {
      case 'external':
        configArea.innerHTML = `
          <div class="form-group">
            <label style="color: var(--primary-color); font-weight: 600;">외부 링크 URL</label>
            <input type="url" name="contributionExternalUrl[]" placeholder="https://example.com" required>
          </div>
        `;
        break;
      case 'github':
        configArea.innerHTML = `
          <div class="form-group">
            <label style="color: var(--primary-color); font-weight: 600;">GitHub 저장소</label>
            <input type="text" name="contributionGithubRepo[]" placeholder="owner/repository" required>
          </div>
        `;
        break;
      case 'modal':
        configArea.innerHTML = `
          <div class="form-group">
            <label style="color: var(--primary-color); font-weight: 600;">모달 제목</label>
            <input type="text" name="contributionModalTitle[]" placeholder="기여 방법 안내" required>
          </div>
          <div class="form-group">
            <label style="color: var(--primary-color); font-weight: 600;">모달 내용</label>
            <textarea name="contributionModalContent[]" placeholder="사용자에게 보여줄 상세 내용을 입력하세요..." rows="3" required></textarea>
          </div>
        `;
        break;
      case 'custom':
        configArea.innerHTML = `
          <div class="form-group">
            <label style="color: var(--primary-color); font-weight: 600;">커스텀 함수명</label>
            <input type="text" name="contributionCustomFunction[]" placeholder="customActionFunction" required>
          </div>
          <div class="form-group">
            <label style="color: var(--primary-color); font-weight: 600;">함수 매개변수 (JSON)</label>
            <textarea name="contributionCustomParams[]" placeholder='{"param1": "value1", "param2": "value2"}' rows="2"></textarea>
          </div>
        `;
        break;
      case 'internal':
        configArea.innerHTML = `
          <div class="form-help" style="background: rgba(16, 185, 129, 0.1); border-color: #10b981; color: #065f46;">
            <i class="fas fa-info-circle" style="color: #10b981;"></i>
            내부 시스템 방식은 추가 설정이 필요하지 않습니다. 사용자가 이 버튼을 클릭하면 해당 DAO의 DCA 목록을 확인할 수 있습니다.
          </div>
        `;
        break;
    }
  }

  // DAO 생성 처리
  async handleCreateDAO(event) {
    event.preventDefault();
    
    // 본인인증 요구
    const authenticated = await this.requestAuthentication('DAO 생성');
    if (!authenticated) {
      this.showErrorMessage('인증이 취소되었습니다.');
      return;
    }
    
    // 폼 데이터 수집
    const formData = new FormData(document.getElementById('createDAOForm'));
    const daoData = {
      title: document.getElementById('daoTitle').value.trim(),
      description: document.getElementById('daoDescription').value.trim(),
      participationGuide: document.getElementById('daoParticipationGuide').value.trim(),
      initialOPAddress: document.getElementById('initialOPAddress').value.trim(),
      dcas: [],
      contributionOptions: []
    };
    
    // DCA 데이터 수집
    const dcaTitles = formData.getAll('dcaTitle[]');
    const dcaCriterias = formData.getAll('dcaCriteria[]');
    const dcaValues = formData.getAll('dcaValue[]');
    
    for (let i = 0; i < dcaTitles.length; i++) {
      if (dcaTitles[i] && dcaCriterias[i] && dcaValues[i]) {
        daoData.dcas.push({
          title: dcaTitles[i],
          criteria: dcaCriterias[i],
          value: parseInt(dcaValues[i])
        });
      }
    }
    
    // 기여하러가기 옵션 데이터 수집
    const contributionTitles = formData.getAll('contributionTitle[]');
    const contributionDescriptions = formData.getAll('contributionDescription[]');
    const contributionButtonTexts = formData.getAll('contributionButtonText[]');
    const contributionIcons = formData.getAll('contributionIcon[]');
    const contributionActionTypes = formData.getAll('contributionActionType[]');
    const contributionExternalUrls = formData.getAll('contributionExternalUrl[]');
    const contributionGithubRepos = formData.getAll('contributionGithubRepo[]');
    const contributionModalTitles = formData.getAll('contributionModalTitle[]');
    const contributionModalContents = formData.getAll('contributionModalContent[]');
    const contributionCustomFunctions = formData.getAll('contributionCustomFunction[]');
    const contributionCustomParams = formData.getAll('contributionCustomParams[]');
    
    for (let i = 0; i < contributionTitles.length; i++) {
      if (contributionTitles[i] && contributionDescriptions[i] && contributionButtonTexts[i] && contributionIcons[i] && contributionActionTypes[i]) {
        const option = {
          title: contributionTitles[i],
          description: contributionDescriptions[i],
          buttonText: contributionButtonTexts[i],
          icon: contributionIcons[i],
          actionType: contributionActionTypes[i]
        };
        
        // 액션 타입별 추가 데이터
        switch(contributionActionTypes[i]) {
          case 'external':
            option.externalUrl = contributionExternalUrls[i] || '';
            break;
          case 'github':
            option.githubRepo = contributionGithubRepos[i] || '';
            break;
          case 'modal':
            option.modalTitle = contributionModalTitles[i] || '';
            option.modalContent = contributionModalContents[i] || '';
            break;
          case 'custom':
            option.customFunction = contributionCustomFunctions[i] || '';
            option.customParams = contributionCustomParams[i] || '{}';
            break;
        }
        
        daoData.contributionOptions.push(option);
      }
    }
    
    // 유효성 검사 - 더 자세한 디버깅
    const missingFields = [];
    if (!daoData.title) missingFields.push('DAO 이름');
    if (!daoData.description) missingFields.push('DAO 설명');
    if (!daoData.participationGuide) missingFields.push('참여하기 안내 내용');
    if (!daoData.initialOPAddress) missingFields.push('이니셜 OP 통신주소');
    
    if (missingFields.length > 0) {
      console.error('누락된 필수 항목:', missingFields);
      console.error('입력된 데이터:', daoData);
      this.showErrorMessage(`다음 필수 항목을 입력해주세요: ${missingFields.join(', ')}`);
      return;
    }
    
    if (daoData.dcas.length === 0) {
      this.showErrorMessage('최소 1개의 DCA를 추가해주세요.');
      return;
    }
    
    if (daoData.contributionOptions.length === 0) {
      this.showErrorMessage('최소 1개의 기여하러가기 옵션을 추가해주세요.');
      return;
    }
    
    // TOP-OP는 수수료 없이 DAO 생성 가능
    
    try {
      // DAO 생성 처리
      await this.createDAO(daoData);
      
      this.showSuccessMessage(`${daoData.title}이(가) 성공적으로 생성되었습니다! (TOP-OP 특권으로 수수료 없음)`);
      this.closeCreateDAOModal();
      
      // DAO 목록 새로고침
      setTimeout(() => {
        this.loadDAOs();
      }, 1000);
      
    } catch (error) {
      console.error('DAO 생성 실패:', error);
      this.showErrorMessage('DAO 생성에 실패했습니다.');
    }
  }

  // DAO 생성 처리 (실제 생성 로직)
  async createDAO(daoData) {
    // DAO ID 생성
    const daoId = daoData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-dao';
    
    // 새 DAO 객체 생성
    const newDAO = {
      id: daoId,
      name: daoData.title,
      description: daoData.description,
      memberCount: 1, // 이니셜 OP
      totalContributions: 0,
      participationGuide: daoData.participationGuide,
      contributionOptions: daoData.contributionOptions,
      dcas: daoData.dcas,
      initialOP: daoData.initialOPAddress,
      createdAt: new Date().toISOString(),
      createdBy: this.currentUser?.name || 'TOP-OP',
      isUserCreated: true
    };
    
    // localStorage에 저장
    this.saveUserCreatedDAO(newDAO);
    
    // 서버 API 호출 (있다면)
    try {
      const response = await fetch(`${this.apiBase}/daos`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentUser.did}` 
        },
        body: JSON.stringify({
          ...daoData,
          creatorDID: this.currentUser.did,
          id: daoId
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ 서버에 DAO 생성 성공:', result);
      }
    } catch (error) {
      console.log('서버 연결 실패, 로컬에만 저장:', error);
    }
    
    // 이니셜 OP에게 P토큰 30개 지급 (시뮬레이션)
    console.log(`${daoData.initialOPAddress}에게 ${daoId} P토큰 30개 지급`);
    
    return newDAO;
  }

  // 새로운 DAO를 사용자 DAO 목록에 추가
  addNewDAOToUserList(newDAO) {
    // 로컬 스토리지에서 현재 동적 DAO 목록 가져오기
    const dynamicDAOs = JSON.parse(localStorage.getItem('userDAOs') || '[]');
    
    // 새 DAO를 사용자 DAO 형식으로 변환
    const userDAO = {
      id: newDAO.id,
      name: newDAO.name,
      role: 'OP', // 이니셜 OP
      contributions: 0,
      lastActivity: new Date().toISOString().split('T')[0],
      icon: this.getDAOIcon(newDAO.name) // DAO 이름에 맞는 아이콘 선택
    };
    
    // 중복 체크 후 추가
    const existingDAO = dynamicDAOs.find(dao => dao.id === newDAO.id);
    if (!existingDAO) {
      dynamicDAOs.push(userDAO);
      localStorage.setItem('userDAOs', JSON.stringify(dynamicDAOs));
      
      console.log('새 DAO가 사용자 DAO 목록에 추가됨:', userDAO);
      
      // 거버넌스 탭의 DAO 필터 버튼 업데이트
      this.loadDAOFilterButtons();
      
      // getDAOName 함수가 새 DAO를 인식할 수 있도록 전역 DAO 이름 매핑 업데이트
      this.updateGlobalDAOMapping(newDAO.id, newDAO.name);
    }
  }

  // DAO 이름에 맞는 아이콘 선택
  getDAOIcon(daoName) {
    const name = daoName.toLowerCase();
    
    if (name.includes('dev') || name.includes('development') || name.includes('tech')) {
      return 'fas fa-code';
    } else if (name.includes('community') || name.includes('social')) {
      return 'fas fa-users';
    } else if (name.includes('ops') || name.includes('operation')) {
      return 'fas fa-cogs';
    } else if (name.includes('political') || name.includes('governance')) {
      return 'fas fa-balance-scale';
    } else if (name.includes('marketing') || name.includes('promotion')) {
      return 'fas fa-bullhorn';
    } else if (name.includes('research') || name.includes('science')) {
      return 'fas fa-flask';
    } else if (name.includes('finance') || name.includes('treasury')) {
      return 'fas fa-coins';
    } else if (name.includes('security') || name.includes('audit')) {
      return 'fas fa-shield-alt';
    } else {
      return 'fas fa-sitemap'; // 기본 아이콘
    }
  }

  // 전역 DAO 이름 매핑 업데이트
  updateGlobalDAOMapping(daoId, daoName) {
    // 런타임에서 사용할 수 있도록 동적 매핑 객체 생성
    if (!this.dynamicDAONames) {
      this.dynamicDAONames = {};
    }
    this.dynamicDAONames[daoId] = daoName;
  }

  // 구성원용 DAO 생성 제안 모달 표시
  showCreateDAOProposalModal() {
    if (!this.isAuthenticated) {
                this.showErrorMessage('DAO 생성 제안을 위해서는 먼저 로그인이 필요합니다.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'createDAOProposalModal';
    
    modal.innerHTML = `
      <div class="modal-content create-dao-proposal-modal-content">
        <div class="modal-header">
          <h3><i class="fas fa-lightbulb"></i> 새 DAO 생성 제안</h3>
          <button class="modal-close" onclick="window.dapp.closeCreateDAOProposalModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="proposal-info-notice">
            <div class="notice-content">
              <i class="fas fa-info-circle"></i>
              <div class="notice-text">
                <h4>DAO 생성 제안 과정</h4>
                <p>새로운 DAO 생성을 제안하고 Political DAO의 승인을 받는 과정입니다.</p>
                <ul>
                  <li>제안서 작성 및 제출 (담보: Political DAO 30P)</li>
                  <li>Political DAO 구성원 전용 투표 (14일간, 정족수 40% 달성 시 조기 종료)</li>
                  <li>투표 통과시, Ops검토(이의신청)단계로 넘어가고 최종검토</li>
                  <li>승인 시 DAO 생성 및 이니셜 OP 권한 부여</li>
                </ul>
                <div style="margin-top: 0.75rem; padding: 0.5rem; background: rgba(59, 130, 246, 0.1); border-radius: 6px; font-size: 0.875rem;">
                  <strong>💡 참고:</strong> Political DAO 구성원만 투표에 참여할 수 있습니다.<br>
                  투표는 최대 14일간 진행되며, Political DAO 정족수 40% 달성 시 조기 종료됩니다.
                </div>
              </div>
            </div>
          </div>

          <form id="createDAOProposalForm">
            <!-- 기본 정보 섹션 -->
            <div class="dao-proposal-section">
              <h4><i class="fas fa-info-circle"></i> 제안 기본 정보</h4>
              <div class="form-group">
                <label for="daoProposalTitle">제안 제목</label>
                <input type="text" id="daoProposalTitle" placeholder="예: Innovation DAO 생성 제안" required>
              </div>
              <div class="form-group">
                <label for="daoProposalDescription">제안 요약</label>
                <textarea id="daoProposalDescription" placeholder="DAO 생성이 필요한 이유와 기대 효과를 간략히 설명해주세요..." rows="3" required></textarea>
              </div>
            </div>

            <!-- DAO 상세 정보 섹션 -->
            <div class="dao-proposal-section">
              <h4><i class="fas fa-users"></i> DAO 상세 정보</h4>
              <div class="form-group">
                <label for="proposedDAOName">생성할 DAO 이름</label>
                <input type="text" id="proposedDAOName" placeholder="예: Innovation DAO" required>
              </div>
              <div class="form-group">
                <label for="proposedDAODescription">DAO 목적 및 설명</label>
                <textarea id="proposedDAODescription" placeholder="새로운 DAO의 목적, 역할, 활동 범위를 상세히 설명해주세요..." rows="4" required></textarea>
              </div>
              <div class="form-group">
                <label for="proposedDAOJustification">DAO 필요성</label>
                <textarea id="proposedDAOJustification" placeholder="왜 이 DAO가 백야 프로토콜에 필요한지, 기존 DAO들과 어떻게 차별화되는지 설명해주세요..." rows="4" required></textarea>
              </div>
            </div>

            <!-- 예상 DCA 섹션 -->
            <div class="dao-proposal-section">
              <h4><i class="fas fa-tasks"></i> 예상 지정기여활동 (DCA)</h4>
              <div class="dca-proposal-area">
                <div class="dca-proposal-list" id="proposalDCAList">
                  <!-- DCA 항목들이 동적으로 추가됩니다 -->
                </div>
                <button type="button" class="btn-secondary add-proposal-dca-btn" onclick="window.dapp.addProposalDCA()">
                  <i class="fas fa-plus"></i> DCA 추가
                </button>
              </div>
            </div>

            <!-- 이니셜 OP 후보 섹션 -->
            <div class="dao-proposal-section">
              <h4><i class="fas fa-crown"></i> 이니셜 OP 후보</h4>
              <div class="form-group">
                <label>이니셜 OP 후보</label>
                <div class="initial-op-candidate-card">
                  <div class="op-candidate-profile">
                    <div class="candidate-avatar">${this.currentUser?.name?.charAt(0) || 'U'}</div>
                    <div class="candidate-info">
                      <div class="candidate-name">${this.currentUser?.name || '김백야'}</div>
                      <div class="candidate-address">${this.maskAddress(this.currentUser?.communicationAddress || '010-9990-4718')}</div>
                    </div>
                  </div>
                  <div class="op-candidate-badge">제안자 (본인)</div>
                </div>
                <input type="hidden" id="proposedInitialOP" value="${this.currentUser?.communicationAddress || this.currentUser?.did || '010-9990-4718'}">
                <small>DAO 승인 시 제안자(본인)가 자동으로 이니셜 OP로 임명됩니다</small>
              </div>
              <div class="form-group">
                <label for="opQualification">OP 후보 자격 설명</label>
                <textarea id="opQualification" placeholder="해당 후보가 이 DAO의 OP로 적합한 이유를 설명해주세요..." rows="3" required></textarea>
              </div>
            </div>

            <!-- 첨부파일 섹션 -->
            <div class="dao-proposal-section">
              <h4><i class="fas fa-paperclip"></i> 첨부파일</h4>
              <div class="form-group">
                <label for="daoProposalAttachments">첨부파일</label>
                <div class="file-upload-area" onclick="document.getElementById('daoProposalFileInput').click()">
                  <div class="file-upload-content">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <p>클릭하여 파일을 선택하거나 드래그하여 업로드하세요</p>
                    <small>지원 형식: PDF, DOC, DOCX, TXT, JPG, PNG (최대 10MB)</small>
                  </div>
                  <input type="file" id="daoProposalFileInput" multiple accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" style="display: none;" onchange="window.dapp.handleDAOProposalFileUpload(this)">
                </div>
                <div class="uploaded-files-list" id="daoProposalUploadedFiles"></div>
              </div>
            </div>

            <!-- 제안 담보 정보 -->
            <div class="dao-proposal-section proposal-fee-info">
              <div class="fee-notice">
                <i class="fas fa-coins"></i>
                <div class="fee-details">
                  <strong>DAO 생성 제안 담보: Political DAO 30P</strong>
                  <small>제안 성공 시: 생성된 DAO의 30P로 변환 | 제안 실패 시: 15P만 반환 (50% 손실)</small>
                </div>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="window.dapp.closeCreateDAOProposalModal()">
            <i class="fas fa-times"></i> 취소
          </button>
          <button type="submit" form="createDAOProposalForm" class="btn-primary" onclick="window.dapp.handleCreateDAOProposal(event)">
            <i class="fas fa-lightbulb"></i> 제안 제출
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // 첫 번째 DCA 자동 추가
    setTimeout(() => {
      this.addProposalDCA();
    }, 100);
    
    // 폼 제출 이벤트 리스너 (중복 방지)
    const form = document.getElementById('createDAOProposalForm');
    if (form) {
      form.removeEventListener('submit', this.handleCreateDAOProposal.bind(this));
      form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCreateDAOProposal(e);
    });
    }
  }

  // 구성원용 DAO 생성 제안 모달 닫기
  closeCreateDAOProposalModal() {
    const modal = document.getElementById('createDAOProposalModal');
    if (modal) {
      modal.remove();
    }
  }

  // DAO 생성 제안 처리
  async handleCreateDAOProposal(event) {
    event.preventDefault();
    
    // 본인인증 요구
    const authenticated = await this.requestAuthentication('DAO 생성 제안');
    if (!authenticated) {
      this.showErrorMessage('인증이 취소되었습니다.');
      return;
    }
    
    // DCA 데이터 수집
    const dcaElements = document.querySelectorAll('.dca-proposal-item');
    const proposedDCAs = [];
    
    for (let dcaElement of dcaElements) {
      const title = dcaElement.querySelector('input[name="proposalDCATitle[]"]').value.trim();
      const criteria = dcaElement.querySelector('input[name="proposalDCACriteria[]"]').value.trim();
      const value = dcaElement.querySelector('input[name="proposalDCAValue[]"]').value.trim();
      const details = dcaElement.querySelector('textarea[name="proposalDCADetails[]"]').value.trim();
      
      if (title && criteria && value) {
        proposedDCAs.push({
          title: title,
          criteria: criteria,
          value: parseInt(value),
          details: details
        });
      }
    }
    
    // 폼 데이터 수집
    const proposalData = {
      title: document.getElementById('daoProposalTitle').value.trim(),
      description: document.getElementById('daoProposalDescription').value.trim(),
      daoName: document.getElementById('proposedDAOName').value.trim(),
      daoDescription: document.getElementById('proposedDAODescription').value.trim(),
      daoJustification: document.getElementById('proposedDAOJustification').value.trim(),
      proposedDCAs: proposedDCAs,
      initialOP: document.getElementById('proposedInitialOP').value.trim(),
      opQualification: document.getElementById('opQualification').value.trim()
    };
    
    // 유효성 검사
    console.log('DAO 생성 제안 데이터:', proposalData);
    
    // 필수 항목 개별 검사
    const missingFields = [];
    if (!proposalData.title) missingFields.push('제안 제목');
    if (!proposalData.description) missingFields.push('제안 설명');
    if (!proposalData.daoName) missingFields.push('DAO 이름');
    if (!proposalData.daoDescription) missingFields.push('DAO 설명');
    if (!proposalData.daoJustification) missingFields.push('DAO 당위성');
    if (!proposalData.initialOP) missingFields.push('이니셜 OP');
    if (!proposalData.opQualification) missingFields.push('OP 자격 설명');
    
    if (missingFields.length > 0) {
      console.error('필수 항목 누락:', missingFields);
      this.showErrorMessage(`다음 필수 항목을 입력해주세요: ${missingFields.join(', ')}`);
      return;
    }
    
    if (proposedDCAs.length === 0) {
      this.showErrorMessage('최소 1개의 DCA를 추가해주세요.');
      return;
    }
    
    // Political DAO P토큰 잔액 확인
    const currentPTokens = this.getUserPTokenBalance('political-dao');
    const proposalCollateral = 30;
    
    if (currentPTokens < proposalCollateral) {
      this.showErrorMessage(`Political DAO P토큰이 부족합니다. 현재 보유량: ${currentPTokens}P, 필요량: ${proposalCollateral}P`);
      return;
    }
    
    try {
      // DAO 생성 제안 제출
      await this.submitDAOCreationProposal(proposalData);
      
      // Political DAO P토큰 담보 차감
      this.deductPTokenCollateral('political-dao', proposalCollateral);
      
      this.showSuccessMessage(`DAO 생성 제안이 제출되어 Political DAO 투표가 시작되었습니다!`);
      this.closeCreateDAOProposalModal();
      
      // 거버넌스 탭으로 이동하여 투표 확인
      setTimeout(() => {
        const governanceTab = document.querySelector('[data-tab="governance"]');
        if (governanceTab) {
          governanceTab.click();
          // 투표과정으로 전환
          setTimeout(() => {
            this.switchGovernanceProcess('voting');
          }, 500);
        }
      }, 1500);
      
    } catch (error) {
      console.error('DAO 생성 제안 실패:', error);
      this.showErrorMessage('DAO 생성 제안 제출에 실패했습니다.');
    }
  }

  // DAO 생성 제안 제출 (실제 제출 로직)
  async submitDAOCreationProposal(proposalData) {
    // 제안 ID 생성
    const proposalId = `dao-creation-${Date.now()}`;
    
    // 새 제안 객체 생성 (바로 투표 단계로 진입)
    const newProposal = {
      id: proposalId,
      type: 'dao-creation',
      title: proposalData.title,
      description: proposalData.description,
      proposer: this.currentUser?.name || '익명',
      proposerDID: this.currentUser?.did || 'unknown',
      status: 'voting', // 담보 지급 완료로 바로 투표 단계 진입
      daoName: proposalData.daoName,
      daoDescription: proposalData.daoDescription,
      daoJustification: proposalData.daoJustification,
      proposedDCAs: proposalData.proposedDCAs, // 이제 배열 형태 (제목, 검증기준, 기여가치, 상세내용 포함)
      initialOP: proposalData.initialOP,
      opQualification: proposalData.opQualification,
      collateralPaid: 30, // Political DAO P토큰 담보 지급 완료
      votingStartDate: new Date().toISOString().split('T')[0], // 즉시 투표 시작
      votingEndDate: this.addDays(new Date(), 14).toISOString().split('T')[0], // 14일간 투표 (정족수 40% 달성 시 조기 종료)
      votesFor: 0,
      votesAgainst: 0,
      abstentions: 0,
      createdAt: new Date().toISOString(),
      targetDAO: 'Political DAO', // Political DAO에서 투표 진행
      eligibleVoters: 'political-dao-members', // Political DAO 구성원만 투표 가능
      quorumRequired: 40, // 정족수 40% 달성 시 조기 종료
      specialType: 'dao-creation', // 특별 제안 유형 - DAO 생성
      skipFunding: true, // 모금 과정 건너뛰기
      directVoting: true, // 바로 투표 진행
      earlyTermination: true // 정족수 달성 시 조기 종료 가능
    };
    
    // 실제로는 블록체인에 기록되어야 함
    console.log('새 DAO 생성 제안:', newProposal);
    
    return newProposal;
  }

  // 날짜 더하기 헬퍼 함수
  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // 첨부파일 처리 함수들
  
  // 구성원용 DAO 생성 제안 첨부파일 처리
  handleDAOFileUpload(input) {
    this.handleFileUpload(input, 'daoUploadedFiles', 'dao-attachment');
  }

  // 거버넌스 제안 첨부파일 처리
  handleProposalFileUpload(input) {
    this.handleFileUpload(input, 'proposalUploadedFiles', 'proposal-attachment');
  }

  // TOP-OP용 DAO 생성 첨부파일 처리
  handleTopOPDAOFileUpload(input) {
    this.handleFileUpload(input, 'topOPDAOUploadedFiles', 'topop-dao-attachment');
  }

  // 구성원용 DAO 생성 제안 첨부파일 처리
  handleDAOProposalFileUpload(input) {
    this.handleFileUpload(input, 'daoProposalUploadedFiles', 'dao-proposal-attachment');
  }

  // 공통 파일 업로드 처리 함수
  handleFileUpload(input, containerId, attachmentType) {
    const files = Array.from(input.files);
    const container = document.getElementById(containerId);
    
    if (!container) return;
    
    files.forEach(file => {
      // 파일 크기 검증 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.showErrorMessage(`파일 "${file.name}"의 크기가 10MB를 초과합니다.`);
        return;
      }

      // 파일 형식 검증
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/jpg',
        'image/png'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        this.showErrorMessage(`파일 "${file.name}"은 지원하지 않는 형식입니다.`);
        return;
      }

      // 파일 아이템 생성
      const fileItem = document.createElement('div');
      fileItem.className = 'uploaded-file-item';
      fileItem.dataset.attachmentType = attachmentType;
      
      // 파일 아이콘 결정
      const fileIcon = this.getFileIcon(file.type, file.name);
      
      fileItem.innerHTML = `
        <div class="file-info">
          <div class="file-icon">
            <i class="${fileIcon}"></i>
          </div>
          <div class="file-details">
            <div class="file-name">${file.name}</div>
            <div class="file-size">${this.formatFileSize(file.size)}</div>
          </div>
        </div>
        <button type="button" class="file-remove-btn" onclick="this.closest('.uploaded-file-item').remove()">
          <i class="fas fa-times"></i>
        </button>
      `;
      
      container.appendChild(fileItem);
    });
    
    // 입력 필드 초기화
    input.value = '';
  }

  // 파일 아이콘 결정
  getFileIcon(fileType, fileName) {
    if (fileType === 'application/pdf') {
      return 'fas fa-file-pdf text-red-500';
    } else if (fileType === 'application/msword' || 
               fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return 'fas fa-file-word text-blue-500';
    } else if (fileType === 'text/plain') {
      return 'fas fa-file-alt text-gray-500';
    } else if (fileType.startsWith('image/')) {
      return 'fas fa-file-image text-green-500';
    } else {
      return 'fas fa-file text-gray-400';
    }
  }

  // 파일 크기 포맷팅
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 통신주소 마스킹 함수
  maskAddress(address) {
    if (!address) return '***-****-****';
    
    if (address.includes('-')) {
      // 전화번호 형태 (010-1234-5678 → 010-****-5678)
      const parts = address.split('-');
      if (parts.length === 3) {
        return `${parts[0]}-****-${parts[2]}`;
      }
    }
    
    // DID 형태는 앞뒤 일부만 표시
    if (address.length > 20) {
      return `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
    }
    
    // 기본 마스킹
    const visibleChars = Math.min(4, Math.floor(address.length / 3));
    const hiddenLength = address.length - visibleChars * 2;
    return `${address.substring(0, visibleChars)}${'*'.repeat(hiddenLength)}${address.substring(address.length - visibleChars)}`;
  }

  // 제안자 통신정보 (TOP-OP 전용)
  getProposerContactInfo(proposal) {
    // DAO 생성 제안인 경우 이니셜 OP 후보 정보 포함
    const isDAOCreation = proposal.type === 'dao-creation' || proposal.specialType === 'dao-creation';
    
    return `
      <div class="dao-creation-section">
        <h4><i class="fas fa-shield-alt"></i> 제안자 연락처 정보 (TOP-OP 전용)</h4>
        <div class="dao-info-grid">
          <div class="dao-info-item">
            <label>제안자 이름</label>
            <div class="dao-name-display">${proposal.proposer || '김백야'}</div>
          </div>
          <div class="dao-info-item full-width">
            <label>제안자 DID</label>
            <div class="dao-description-display did-masked">${this.maskAddress(proposal.proposerDID || 'did_1749ba93c7d4e86f2a1b8937f5a2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0udrac8Im')}</div>
          </div>
          <div class="dao-info-item">
            <label>통신주소</label>
            <div class="dao-name-display contact-address">${proposal.proposerCommunicationAddress || proposal.communicationAddress || '010-9990-4718'}</div>
          </div>
          ${isDAOCreation ? `
            <div class="dao-info-item full-width">
              <label>이니셜 OP 예정</label>
              <div class="dao-justification-display initial-op-notice">
                <i class="fas fa-crown" style="color: #FFD700; margin-right: 8px;"></i>
                DAO 승인 시 제안자가 이니셜 OP로 임명됩니다
              </div>
            </div>
          ` : ''}
        </div>
        <div class="dao-creation-voting-info">
          <i class="fas fa-exclamation-triangle"></i>
          이 정보는 TOP-OP에게만 표시되며 최종 검토 목적으로 제공됩니다.
        </div>
      </div>
    `;
  }

  // 제안자 프로필 보기 (실제 데이터 조회로 변경)
  showProposerProfile(proposerName, proposerDID) {
    // 실제로는 블록체인에서 제안자 정보를 조회해야 함
    // 현재는 기본값만 표시하고 실제 데이터는 추후 구현
    const proposerData = {
      name: proposerName || '사용자',
      did: proposerDID || 'did_미공개',
      communicationAddress: '010-****-****', // 개인정보 보호
      joinDate: '정보 없음',
      memberDAOs: [],
      contributionHistory: [],
      governanceHistory: []
    };

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'proposerProfileModal';
    
    modal.innerHTML = `
      <div class="modal-content proposer-profile-modal">
        <div class="modal-header">
          <h3><i class="fas fa-user"></i> 제안자 프로필</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <!-- 기본 프로필 정보 -->
          <div class="profile-basic-info">
            <div class="profile-avatar-large">${proposerData.name.charAt(0)}</div>
            <div class="profile-details">
              <h4 class="profile-name">${proposerData.name}</h4>
              <div class="profile-did">
                <strong>DID:</strong> ${this.maskAddress(proposerData.did)}
              </div>
              <div class="profile-address">
                <strong>통신주소:</strong> ${this.maskAddress(proposerData.communicationAddress)}
              </div>
              <div class="profile-join-date">
                <strong>가입일:</strong> ${proposerData.joinDate}
              </div>
            </div>
          </div>

          <!-- 소속 DAO -->
          <div class="profile-section">
            <h4><i class="fas fa-building"></i> 소속 DAO (${proposerData.memberDAOs.length}개)</h4>
            <div class="member-dao-list">
              ${proposerData.memberDAOs.map(dao => `
                <div class="member-dao-item">
                  <div class="dao-name">${dao.name}</div>
                  <div class="dao-role">${dao.role}</div>
                  <div class="dao-join-date">가입: ${dao.joinDate}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 기여 내역 -->
          <div class="profile-section">
            <h4><i class="fas fa-tasks"></i> 최근 기여 내역</h4>
            <div class="contribution-history-list">
              ${proposerData.contributionHistory.map(contrib => `
                <div class="contribution-item">
                  <div class="contribution-header">
                    <span class="dao-name">${contrib.dao}</span>
                    <span class="contribution-value">${contrib.value}</span>
                  </div>
                  <div class="contribution-activity">${contrib.activity}</div>
                  <div class="contribution-date">${contrib.date}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 참정 내역 -->
          <div class="profile-section">
            <h4><i class="fas fa-vote-yea"></i> 거버넌스 참여 내역</h4>
            <div class="governance-history-list">
              ${proposerData.governanceHistory.map(gov => `
                <div class="governance-item">
                  <div class="governance-header">
                    <span class="governance-type">${gov.type}</span>
                    <span class="governance-date">${gov.date}</span>
                  </div>
                  <div class="governance-proposal">${gov.proposal}</div>
                  <div class="governance-detail">
                    ${gov.vote ? `투표: ${gov.vote}` : `상태: ${gov.status}`}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 신뢰도 지표 -->
          <div class="profile-section">
            <h4><i class="fas fa-star"></i> 신뢰도 지표</h4>
            <div class="trust-indicators">
              <div class="trust-item">
                <div class="trust-label">총 기여가치</div>
                <div class="trust-value">330B</div>
              </div>
              <div class="trust-item">
                <div class="trust-label">참여 DAO 수</div>
                <div class="trust-value">4개</div>
              </div>
              <div class="trust-item">
                <div class="trust-label">투표 참여율</div>
                <div class="trust-value">94%</div>
              </div>
              <div class="trust-item">
                <div class="trust-label">제안 채택률</div>
                <div class="trust-value">87%</div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">
            <i class="fas fa-times"></i> 닫기
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  // 제안용 DCA 추가
  addProposalDCA() {
    const dcaList = document.getElementById('proposalDCAList');
    const dcaIndex = dcaList.children.length;
    
    const dcaItem = document.createElement('div');
    dcaItem.className = 'dca-proposal-item';
    dcaItem.innerHTML = `
      <div class="dca-proposal-header">
        <h5>DCA ${dcaIndex + 1}</h5>
        <button type="button" class="btn-small btn-delete" onclick="this.closest('.dca-proposal-item').remove()">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div class="dca-proposal-fields">
        <div class="form-group">
          <label>DCA 제목</label>
          <input type="text" name="proposalDCATitle[]" placeholder="예: 아이디어 제출" required>
        </div>
        <div class="form-group">
          <label>검증기준</label>
          <input type="text" name="proposalDCACriteria[]" placeholder="예: 승인됨" required>
        </div>
        <div class="form-group">
          <label>기여가치</label>
          <input type="number" name="proposalDCAValue[]" placeholder="예: 50" min="1" required>
        </div>
        <div class="form-group dca-details-group">
          <label>상세내용</label>
          <textarea name="proposalDCADetails[]" placeholder="이 DCA의 구체적인 수행 방법, 기준, 절차 등을 상세히 설명해주세요..." rows="3"></textarea>
        </div>
      </div>
    `;
    
    dcaList.appendChild(dcaItem);
    
    // 첫 번째 DCA 자동 추가
    if (dcaIndex === 0) {
      // 추가 버튼 클릭 시 자동으로 하나 더 추가
    }
  }

  // 사용자의 DAO별 P토큰 잔액 조회
  getUserPTokenBalance(daoId) {
    // 데모 데이터 - 실제로는 블록체인에서 P토큰 잔액을 조회
    if (!this.isAuthenticated) return 0;
    
    const pTokenBalances = {
      'ops-dao': 0,           // Operations DAO P토큰
      'dev-dao': 45,          // Development DAO P토큰  
      'community-dao': 25,    // Community DAO P토큰
      'political-dao': 32     // Political DAO P토큰 (담보용)
    };
    
    return pTokenBalances[daoId] || 0;
  }

  // P토큰 담보 차감
  deductPTokenCollateral(daoId, amount) {
    // 실제로는 블록체인에서 P토큰을 차감해야 함
    console.log(`${daoId}에서 ${amount}P 담보 차감`);
    
    // 트랜잭션 기록
    const transaction = {
      type: 'dao-proposal-collateral',
      daoId: daoId,
      amount: amount,
      timestamp: new Date().toISOString(),
      description: `DAO 생성 제안 담보 차감 (${daoId} ${amount}P)`
    };
    
    console.log('담보 차감 트랜잭션:', transaction);
    
    // 성공 메시지에 P토큰 정보 포함
    this.showSuccessMessage(`Political DAO에서 ${amount}P가 담보로 차감되었습니다. 투표가 시작됩니다.`);
  }

  // DAO 생성 제안 상세 모달 표시 (제안과정용)
  showDAOCreationProposalModal(proposal, currentAmount, targetAmount, daysLeft, daoMemberCount) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'daoCreationProposalModal';
    
    const fundingProgress = (currentAmount / targetAmount * 100).toFixed(1);
    const remainingAmount = targetAmount - currentAmount;
    
    modal.innerHTML = `
      <div class="modal-content dao-creation-proposal-modal">
        <div class="modal-header">
          <h3><i class="fas fa-plus-circle"></i> ${proposal.title}</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <!-- DAO 생성 제안 뱃지 -->
          <div class="dao-creation-badge">
            <i class="fas fa-building"></i>
            <span>DAO 생성 제안 - 모금중</span>
          </div>

          <!-- 모금 현황 -->
          <div class="dao-creation-section">
            <h4><i class="fas fa-coins"></i> 모금 현황</h4>
            <div class="funding-status-large">
              <div class="funding-progress-bar">
                <div class="funding-fill" style="width: ${fundingProgress}%"></div>
              </div>
              <div class="funding-stats-grid">
                <div class="funding-stat">
                  <span class="stat-label">현재 모금액</span>
                  <span class="stat-value">${currentAmount}P</span>
                </div>
                <div class="funding-stat">
                  <span class="stat-label">목표 모금액</span>
                  <span class="stat-value">${targetAmount}P</span>
                </div>
                <div class="funding-stat">
                  <span class="stat-label">진행률</span>
                  <span class="stat-value">${fundingProgress}%</span>
                </div>
                <div class="funding-stat">
                  <span class="stat-label">남은 기간</span>
                  <span class="stat-value">${daysLeft}일</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 제안 기본 정보 -->
          <div class="dao-creation-section">
            <div class="proposal-meta-info">
              <div class="meta-item">
                <i class="fas fa-user"></i>
                <span>제안자: ${proposal.proposer}</span>
              </div>
              <div class="meta-item">
                <i class="fas fa-clock"></i>
                <span>모금 마감: ${daysLeft}일 남음</span>
              </div>
              <div class="meta-item">
                <i class="fas fa-coins"></i>
                <span>제안 담보: Political DAO 30P (차감 완료)</span>
              </div>
            </div>
            
            <div class="proposal-description">
              <h4><i class="fas fa-info-circle"></i> 제안 요약</h4>
              <p>${proposal.description}</p>
            </div>
          </div>

          <!-- 생성될 DAO 정보 -->
          <div class="dao-creation-section">
            <h4><i class="fas fa-building"></i> 생성될 DAO 정보</h4>
            <div class="dao-info-grid">
              <div class="dao-info-item">
                <label>DAO 이름</label>
                <div class="dao-name-display">${proposal.proposedDAOName}</div>
              </div>
              <div class="dao-info-item full-width">
                <label>DAO 목적 및 설명</label>
                <div class="dao-description-display">${proposal.proposedDAODescription}</div>
              </div>
              <div class="dao-info-item full-width">
                <label>DAO 필요성</label>
                <div class="dao-justification-display">${proposal.proposedDAOJustification}</div>
              </div>
            </div>
          </div>

          <!-- 예상 DCA 목록 -->
          <div class="dao-creation-section">
            <h4><i class="fas fa-tasks"></i> 예상 지정기여활동 (DCA)</h4>
            <div class="proposed-dca-list">
              ${proposal.proposedDCAs.map((dca, index) => `
                <div class="proposed-dca-item">
                  <div class="dca-header">
                    <h5>DCA ${index + 1}: ${dca.title}</h5>
                    <div class="dca-value">${dca.value}B</div>
                  </div>
                  <div class="dca-criteria">
                    <strong>검증기준:</strong> ${dca.criteria}
                  </div>
                  <div class="dca-details">
                    <strong>상세내용:</strong> ${dca.details}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 이니셜 OP 후보 정보 -->
          <div class="dao-creation-section">
            <h4><i class="fas fa-crown"></i> 이니셜 OP 후보</h4>
            <div class="initial-op-info">
              <div class="op-candidate-clickable" onclick="window.dapp.showProposerProfile('${proposal.proposer}', '${proposal.proposerDID}')" style="cursor: pointer;">
                <div class="op-candidate-profile">
                  <div class="op-avatar">${proposal.proposer?.charAt(0) || 'U'}</div>
                  <div class="op-details">
                    <div class="op-name">${proposal.proposer} (제안자)</div>
                    <div class="op-address">${this.maskAddress(proposal.proposerCommunicationAddress || '010-9990-4718')}</div>
                  </div>
                </div>
                <div class="op-view-badge">프로필 보기 →</div>
              </div>
              <div class="op-description">
                <small>제안자가 DAO 승인 시 이니셜 OP로 임명됩니다. 클릭하여 제안자의 상세 프로필을 확인하세요.</small>
              </div>
            </div>
          </div>

          <!-- 모금 참여 안내 -->
          <div class="dao-creation-section">
            <h4><i class="fas fa-handshake"></i> 모금 참여 안내</h4>
            <div class="funding-participation-info">
              <div class="participation-benefits">
                <h5>모금 참여 혜택</h5>
                <ul>
                  <li>DAO 생성 성공 시 기여한 P토큰이 새 DAO의 P토큰으로 전환</li>
                  <li>초기 DAO 구성원으로서 거버넌스 참여 권한 획득</li>
                  <li>DAO 발전에 기여한 기록이 영구 보존</li>
                </ul>
              </div>
              <div class="participation-process">
                <h5>진행 과정</h5>
                <div class="process-steps">
                  <div class="process-step current">
                    <div class="step-number">1</div>
                    <div class="step-content">
                      <strong>모금 단계</strong>
                      <span>Political DAO 구성원 1% 지지 확보</span>
                    </div>
                  </div>
                  <div class="process-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                      <strong>투표 단계</strong>
                      <span>Political DAO 구성원 투표 진행</span>
                    </div>
                  </div>
                  <div class="process-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                      <strong>검토 단계</strong>
                      <span>TOP-OP 최종 검토 및 승인</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          ${this.isAuthenticated ? `
            <div class="funding-actions-modal">
              <h4><i class="fas fa-coins"></i> P토큰 모금하기</h4>
              <div class="funding-info">
                <div class="funding-notice">
                  <i class="fas fa-info-circle"></i>
                  <span>현재 <strong>${remainingAmount}P</strong>가 더 필요합니다.</span>
                </div>
                <small>최소 1P부터 모금 가능 · 모금 성공 시 새 DAO P토큰으로 전환</small>
              </div>
              <div class="funding-action-buttons">
                <button type="button" class="btn-primary btn-large" onclick="window.dapp.showFundingModal('${proposal.id}', ${remainingAmount}); this.closest('.modal').remove();">
                  <i class="fas fa-coins"></i>
                  <span>P토큰 모금하기</span>
                  <small>Political DAO P토큰으로 지지</small>
                </button>
              </div>
            </div>
          ` : ''}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">닫기</button>
          ${this.isAuthenticated ? `
            <button type="button" class="btn-primary" onclick="window.dapp.showSupportModal('${proposal.id}'); this.closest('.modal').remove();">
              <i class="fas fa-heart"></i>
              지지하기
            </button>
          ` : `
            <button type="button" class="btn-primary" onclick="document.querySelector('[data-tab=wallet]').click(); this.closest('.modal').remove();">
              <i class="fas fa-fingerprint"></i>
              인증 후 모금 참여
            </button>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }
}

// 전역 함수들을 window 객체에 추가 (HTML에서 호출 가능)
window.searchNetworkUsers = function() {
  if (window.dapp) {
    window.dapp.searchNetworkUsers();
  }
};

window.addNetworkFriend = function(networkUserId) {
  if (window.dapp) {
    window.dapp.addNetworkFriend(networkUserId);
  }
};

window.closeFriendSearchModal = function() {
  if (window.dapp) {
    window.dapp.closeFriendSearchModal();
  }
};

// 토스트 메시지 및 추가 스타일
const additionalCSS = `
  .toast {
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: var(--bg-primary);
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: var(--shadow-lg);
    border-left: 4px solid var(--secondary-color);
    transform: translateX(400px);
    transition: transform 0.3s ease-in-out;
    z-index: 2000;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 300px;
  }
  
  /* OP 검토 의견 스타일 */
  .review-comment-section,
  .dao-creation-op-review {
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 8px;
    padding: 1rem;
    margin-top: 0.75rem;
  }
  
  .review-comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .review-comment-header strong {
    color: var(--primary-color);
    font-size: var(--font-size-sm);
  }
  
  .reviewer-info {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .review-comment-content {
    color: var(--text-primary);
    line-height: 1.5;
    font-size: var(--font-size-sm);
    background: white;
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid rgba(59, 130, 246, 0.1);
  }
  
  /* 이의신청 상세 스타일 */
  .objection-detail-item {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.75rem;
  }
  
  .objection-detail-item:last-child {
    margin-bottom: 0;
  }
  
  .objection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .objector-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }
  
  .objection-date {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }
  
  .objection-reason,
  .objection-details,
  .objection-response {
    margin-top: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: var(--font-size-sm);
    line-height: 1.4;
  }
  
  .objection-reason {
    background: rgba(245, 158, 11, 0.1);
    border-left: 3px solid rgba(245, 158, 11, 0.5);
  }
  
  .objection-details {
    background: rgba(156, 163, 175, 0.1);
    border-left: 3px solid rgba(156, 163, 175, 0.5);
    color: var(--text-secondary);
  }
  
  .objection-response {
    background: rgba(34, 197, 94, 0.1);
    border-left: 3px solid rgba(34, 197, 94, 0.5);
  }
  
  .objection-reason strong,
  .objection-response strong {
    display: block;
    margin-bottom: 0.25rem;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .no-objections {
    color: var(--text-tertiary);
    font-style: italic;
    text-align: center;
    padding: 0.75rem;
    background: rgba(156, 163, 175, 0.1);
    border-radius: 6px;
    margin-top: 0.5rem;
  }
  
     /* 검토과정 타임라인 개선 */
   .timeline-content {
     background: white;
     border: 1px solid var(--border-color);
     border-radius: 8px;
     padding: 1rem;
   }
   
   .timeline-item.active .timeline-content {
     border-color: var(--primary-color);
     box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
   }
   
   .timeline-item.completed .timeline-content {
     background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
     border-color: rgba(34, 197, 94, 0.3);
   }
   
   /* OP 검토 시스템 전용 스타일 */
   .op-review-opinion-section,
   .op-objections-section {
     margin: 1.5rem 0;
   }
   
   .op-review-opinion-section h5,
   .op-objections-section h5 {
     color: var(--primary-color);
     margin-bottom: 1rem;
     display: flex;
     align-items: center;
     gap: 0.5rem;
     font-size: 1rem;
   }
   
       .op-review-opinion-section .review-comment-section {
      margin-top: 0;
    }
    
    .final-review-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
      font-style: italic;
      background: rgba(156, 163, 175, 0.1);
      padding: 0.75rem;
      border-radius: 6px;
      margin-top: 0.5rem;
    }
    
    .final-review-info i {
      color: #FFD700;
    }
  
  .toast.show {
    transform: translateX(0);
  }
  
  .toast.success {
    border-left-color: var(--secondary-color);
  }
  
  .toast i {
    color: var(--secondary-color);
  }
  
  .dao-description {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
    margin-bottom: 1rem;
  }
  
  .dao-stats {
    margin: 1rem 0;
  }
  
  .stat-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: var(--font-size-sm);
  }
  
  .dao-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  
  .dao-actions .btn-primary,
  .dao-actions .btn-secondary {
    flex: 1;
    justify-content: center;
  }
  
  .join-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .option-card {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
    border: 1px solid rgba(59, 130, 246, 0.1);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.05);
  }
  
  .option-card h4 {
    margin-bottom: 0.5rem;
    color: var(--text-primary);
  }
  
  .option-card p {
    margin-bottom: 1rem;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
  
  .link-container {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .link-container input {
    flex: 1;
  }
  
  .invite-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.75rem;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-radius: 8px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    border: 1px solid rgba(59, 130, 246, 0.1);
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--text-tertiary);
  }
  
  .proposal-description {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
    margin-bottom: 1rem;
  }
  
  .proposal-meta {
    margin-bottom: 1rem;
  }
  
  .dao-name {
    background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
    color: var(--text-primary);
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: var(--font-size-xs);
    font-weight: 500;
    border: 1px solid rgba(59, 130, 246, 0.2);
  }
  
  .proposal-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin: 1rem 0;
    text-align: center;
  }
  
  .proposal-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  
  .proposal-actions .btn-primary,
  .proposal-actions .btn-secondary {
    flex: 1;
    justify-content: center;
  }
  
  .invite-link-info label {
    display: block;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    margin-top: 1rem;
  }
  
  .invite-link-info label:first-child {
    margin-top: 0;
  }
  
  /* 제안하기 모달 스타일 */
  .proposal-fee-info {
    padding: 0.75rem 0;
    margin: 0.5rem 0;
  }

  .proposal-fee-info .fee-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: 0.25rem;
  }

  .proposal-fee-info .fee-notice i {
    color: var(--text-secondary);
  }

  .proposal-fee-info .fee-breakdown {
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    text-align: left;
    margin-left: 1.25rem;
  }

  .proposal-requirements {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    border: 1px solid rgba(59, 130, 246, 0.1);
  }
  
  .proposal-requirements h4 {
    margin-bottom: 0.5rem;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }
  
  .proposal-requirements ul {
    margin: 0;
    padding-left: 1.5rem;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
  }
  
  .proposal-requirements li {
    margin-bottom: 0.25rem;
  }
  
  .modal-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
  }
  
  .form-group small {
    display: block;
    margin-top: 0.25rem;
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
  }
  
  /* 전체 배경 그라데이션 */
  body {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%);
    min-height: 100vh;
    padding-top: 120px;
  }
  
  .header {
    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%);
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.15);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    transition: background 0.3s ease, backdrop-filter 0.3s ease;
  }

  .header.scrolled {
    background: linear-gradient(135deg, rgba(30, 64, 175, 0.7) 0%, rgba(59, 130, 246, 0.7) 50%, rgba(96, 165, 250, 0.7) 100%);
    backdrop-filter: blur(15px);
  }
  
  .status-card, .balance-card, .network-card, .contribution-history-card, .my-dao-card, .protocol-overview-card, .address-card {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid rgba(59, 130, 246, 0.1);
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.08);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  /* 토큰 보유량 카드 스타일 개선 */
  .balance-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .balance-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(135, 206, 235, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(135, 206, 235, 0.2);
  }

  .balance-label {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .balance-value {
    color: var(--text-primary);
    font-size: 1.5rem;
    font-weight: bold;
  }

  .balance-rate {
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
  }

  /* 프로토콜 개요 카드 스타일 */
  .protocol-info {
    text-align: center;
  }

  .protocol-description {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }

  .protocol-overview-btn {
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .protocol-overview-btn:hover {
    background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-color) 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  /* 주소 카드 스타일 */
  .address-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .address-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    background: rgba(135, 206, 235, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(135, 206, 235, 0.2);
  }

  .address-label {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .address-value {
    color: var(--text-primary);
    font-family: 'Courier New', monospace;
    font-size: var(--font-size-sm);
    word-break: break-all;
    background: var(--bg-primary);
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .btn-copy {
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all 0.3s ease;
    align-self: flex-start;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .btn-copy:hover {
    background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-color) 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  /* 이니셜 OP 후보 카드 스타일 */
  .initial-op-candidate-card, .op-candidate-clickable {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 12px;
    padding: 1rem;
    margin: 0.5rem 0;
    transition: all 0.3s ease;
  }

  .op-candidate-clickable:hover {
    background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
    border-color: rgba(59, 130, 246, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
  }

  .op-candidate-profile {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .op-avatar, .candidate-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.2rem;
  }

  .op-details, .candidate-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .op-name, .candidate-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: var(--font-size-base);
  }

  .op-address, .candidate-address {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-family: 'Courier New', monospace;
  }

  .op-view-badge, .op-candidate-badge {
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: var(--font-size-xs);
    font-weight: 500;
    align-self: center;
  }

  .op-description {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(59, 130, 246, 0.1);
  }

  .op-description small {
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    line-height: 1.4;
  }

  /* 제안자 프로필 모달 스타일 */
  .proposer-profile-modal {
    max-width: 700px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .profile-basic-info {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-radius: 12px;
    margin-bottom: 2rem;
    border: 1px solid rgba(59, 130, 246, 0.1);
  }

  .profile-avatar-large {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 2rem;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }

  .profile-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .profile-name {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--text-primary);
    margin: 0;
  }

  .profile-did, .profile-address, .profile-join-date {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .profile-section {
    margin-bottom: 2rem;
  }

  .profile-section h4 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
    font-size: 1.1rem;
  }

  .member-dao-list, .contribution-history-list, .governance-history-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .member-dao-item, .contribution-item, .governance-item {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid rgba(59, 130, 246, 0.1);
    border-radius: 8px;
    padding: 1rem;
  }

  .member-dao-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dao-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .dao-role {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .dao-join-date {
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
  }

  .contribution-header, .governance-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .contribution-value {
    background: linear-gradient(135deg, var(--secondary-color) 0%, #10b981 100%);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: var(--font-size-xs);
    font-weight: 600;
  }

  .contribution-activity, .governance-proposal {
    color: var(--text-primary);
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .contribution-date, .governance-date, .governance-detail {
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
  }

  .governance-type {
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: var(--font-size-xs);
    font-weight: 500;
  }

  .trust-indicators {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
  }

  .trust-item {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid rgba(59, 130, 246, 0.1);
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  }

  .trust-label {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    margin-bottom: 0.5rem;
  }

  .trust-value {
    color: var(--text-primary);
    font-size: 1.25rem;
    font-weight: bold;
  }

  /* 제안자 통신정보 섹션 (TOP-OP 전용) */
  .proposer-contact-section {
    background: linear-gradient(135deg, #fef3c7 0%, #fbbf24 20%, #f59e0b 100%);
    border: 2px solid #d97706;
    border-radius: 12px;
    padding: 1.5rem;
    margin: 1.5rem 0;
    box-shadow: 0 4px 12px rgba(217, 119, 6, 0.2);
  }

  .proposer-contact-section h5 {
    color: #7c2d12;
    margin-bottom: 1rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .contact-info-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .contact-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: rgba(255, 255, 255, 0.7);
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(217, 119, 6, 0.3);
  }

  .contact-item i {
    color: #d97706;
    font-size: 1.2rem;
    width: 20px;
    text-align: center;
  }

  .contact-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .contact-label {
    color: #7c2d12;
    font-size: var(--font-size-sm);
    font-weight: 600;
  }

  .contact-value {
    color: #1f2937;
    font-size: var(--font-size-base);
    font-weight: 500;
  }

  .contact-value.did-value {
    font-family: 'Courier New', monospace;
    font-size: var(--font-size-sm);
    word-break: break-all;
    background: rgba(255, 255, 255, 0.5);
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid rgba(217, 119, 6, 0.2);
  }

  .contact-item.initial-op-notice {
    background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);
    border-color: #8b5cf6;
  }

  .contact-item.initial-op-notice i {
    color: #7c3aed;
  }

  .contact-item.initial-op-notice .contact-label {
    color: #5b21b6;
  }

  .contact-item.initial-op-notice .contact-value {
    color: #1e1b4b;
    font-style: italic;
  }

  .top-op-notice {
    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    border: 1px solid #f87171;
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .top-op-notice i {
    color: #dc2626;
  }

  .top-op-notice span {
    color: #7f1d1d;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  /* TOP-OP 특권 안내 스타일 */
  .dao-privilege-info {
    padding: 0.75rem 0;
    margin: 0.5rem 0;
  }

  .privilege-notice {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border: 1px solid #0ea5e9;
    border-radius: 8px;
  }

  .privilege-notice i {
    color: #0284c7;
    font-size: 1.2rem;
  }

  .privilege-details {
    flex: 1;
  }

  .privilege-details strong {
    color: #0c4a6e;
    font-size: var(--font-size-base);
    display: block;
    margin-bottom: 0.25rem;
  }

  .privilege-details small {
    color: #075985;
    font-size: var(--font-size-sm);
  }

  /* DAO 기여내역 아이템 스타일 */
  .dao-contribution-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid rgba(59, 130, 246, 0.1);
    border-radius: 12px;
    margin-bottom: 1rem;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.05);
  }

  .dao-contribution-item:hover {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-color: rgba(59, 130, 246, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
  }

  .dao-contribution-item .contribution-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
    color: white;
    border-radius: 12px;
    font-size: 1.2rem;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .dao-contribution-item .contribution-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .dao-contribution-item .contribution-description {
    color: var(--text-primary);
    font-weight: 600;
    font-size: var(--font-size-base);
    line-height: 1.4;
  }

  .dao-contribution-item .contribution-date {
    color: var(--text-tertiary);
    font-size: var(--font-size-sm);
  }

  .dao-contribution-item .contribution-value-section {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .dao-contribution-item .contribution-b-value {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 700;
    font-size: 1.1rem;
    text-align: center;
    min-width: 80px;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.2);
  }



  /* DAO 기여내역 빈 상태 스타일 */
  .dao-contribution-empty {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 2rem;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border: 2px dashed rgba(59, 130, 246, 0.2);
    border-radius: 12px;
    text-align: left;
  }

  .dao-contribution-empty .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
    color: rgba(59, 130, 246, 0.6);
    border-radius: 16px;
    font-size: 1.5rem;
  }

  .dao-contribution-empty .empty-content h4 {
    color: var(--text-primary);
    margin: 0 0 0.5rem 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
  }

  .dao-contribution-empty .empty-content p {
    color: var(--text-secondary);
    margin: 0;
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }

  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .qr-container {
    padding: 1rem;
    background: white;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .qr-controls {
    display: flex;
    gap: 0.5rem;
  }

  .qr-toggle {
    background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
  }

  .qr-toggle:hover {
    background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--border-color) 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.15);
  }

  /* QR 스캔 버튼 스타일 */
  .address-input-group {
    display: flex;
    gap: 0.5rem;
  }

  .address-input-group input {
    flex: 1;
  }

  .btn-qr-scan {
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 100%) !important;
    color: var(--text-white) !important;
    border: none;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: var(--transition-fast);
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .btn-qr-scan:hover {
    background: linear-gradient(135deg, var(--primary-light) 0%, var(--primary-color) 100%) !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }
  
  /* 지지하기 및 기권 버튼 스타일 */
  .btn-support {
    background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
  }
  
  .btn-support:hover {
    background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%);
    transform: translateY(-2px);
  }

  /* DAO 생성 관련 스타일 */
  .dao-top-op-section {
    margin-bottom: 1.5rem;
  }

  .create-dao-modal-content {
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .dao-form-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-radius: 12px;
    border: 1px solid rgba(59, 130, 246, 0.1);
  }

  .dao-form-section h4 {
    color: var(--primary-color);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--font-size-lg);
  }

  .dca-setup-area {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .dca-form-item {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .dca-form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .dca-form-header h5 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--font-size-md);
  }

  .dca-form-fields {
    display: grid;
    grid-template-columns: 1fr 1fr 100px;
    gap: 1rem;
    align-items: end;
  }

  .add-dca-btn {
    align-self: center;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--font-size-sm);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .add-dca-btn:hover {
    background: linear-gradient(135deg, var(--primary-light) 0%, var(--primary-color) 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .contribution-setup {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .contribution-config {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .dao-fee-info {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .fee-notice {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .fee-notice i {
    color: #f59e0b;
    font-size: 1.5rem;
    margin-top: 0.25rem;
  }

  .fee-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .fee-details strong {
    color: var(--text-primary);
    font-size: var(--font-size-lg);
  }

  .fee-details small {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .form-help {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.75rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 6px;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.4;
  }

  .form-help i {
    color: var(--primary-color);
    margin-top: 0.1rem;
    font-size: 0.875rem;
  }

  /* 기여하러가기 옵션 스타일 */
  .contribution-options-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 1rem;
  }

  .contribution-option-item {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
  }

  .contribution-option-item:hover {
    border-color: rgba(59, 130, 246, 0.2);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .contribution-option-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .contribution-option-header h5 {
    margin: 0;
    color: var(--primary-color);
    font-size: var(--font-size-md);
    font-weight: 600;
  }

  .contribution-option-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .contribution-option-fields .form-group:nth-child(2) {
    grid-column: 1 / -1; /* 설명 필드를 전체 너비로 */
  }

  .contribution-action-config {
    grid-column: 1 / -1; /* 액션 설정을 전체 너비로 */
    margin-top: 0.5rem;
    padding: 1rem;
    background: rgba(59, 130, 246, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(59, 130, 246, 0.1);
  }

  .add-contribution-btn {
    align-self: flex-start;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, var(--secondary-color) 0%, #10b981 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--font-size-sm);
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  }

  .add-contribution-btn:hover {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
  }

  .btn-small {
    padding: 0.4rem 0.8rem;
    font-size: var(--font-size-xs);
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .btn-delete {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    border: none;
    box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
  }

  .btn-delete:hover {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(239, 68, 68, 0.4);
  }

  /* 모바일 최적화 */
  @media (max-width: 768px) {
    .create-dao-modal-content {
      max-width: 95vw;
      margin: 1rem;
    }

    .dca-form-fields {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .dao-form-section {
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .fee-notice {
      flex-direction: column;
      gap: 0.75rem;
    }

    /* DAO 기여내역 모바일 최적화 */
    .dao-contribution-item {
      padding: 1rem;
      gap: 0.75rem;
    }

    .dao-contribution-item .contribution-icon {
      width: 40px;
      height: 40px;
      font-size: 1rem;
    }

    .dao-contribution-item .contribution-description {
      font-size: var(--font-size-sm);
      line-height: 1.3;
    }

    .dao-contribution-item .contribution-b-value {
      font-size: 1rem;
      padding: 0.4rem 0.8rem;
      min-width: 70px;
    }

    .dao-contribution-item .contribution-value-section {
      align-items: center;
    }

    /* DAO 기여내역 빈 상태 모바일 최적화 */
    .dao-contribution-empty {
      flex-direction: column;
      text-align: center;
      gap: 1rem;
      padding: 1.5rem;
    }

    .dao-contribution-empty .empty-icon {
      width: 56px;
      height: 56px;
      font-size: 1.25rem;
    }

    /* 기여하러가기 옵션 모바일 최적화 */
    .contribution-option-fields {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .contribution-option-fields .form-group:nth-child(2) {
      grid-column: 1; /* 모바일에서는 단일 컬럼 */
    }

    .contribution-action-config {
      grid-column: 1;
    }

    .contribution-option-item {
      padding: 1rem;
    }
  }
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
  }
  
  .btn-support .fa-heart {
    color: #ef4444 !important;
  }
  
  .btn-tertiary {
    background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
    color: var(--text-secondary);
    border: 1px solid rgba(59, 130, 246, 0.2);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1);
  }
  
  .btn-tertiary:hover {
    background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
    border-color: var(--primary-color);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.15);
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .token-suffix {
    background: var(--bg-tertiary);
    padding: 0.75rem 1rem;
    border-radius: 0 6px 6px 0;
    border: 1px solid var(--border-color);
    border-left: none;
    color: var(--text-secondary);
    font-weight: 500;
  }
  
  .amount-input {
    display: flex;
  }
  
  .amount-input input {
    border-radius: 6px 0 0 6px !important;
    border-right: none !important;
  }
  
  .token-note {
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    text-align: center;
  }
  
  .dao-info {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    border: 1px solid rgba(59, 130, 246, 0.1);
  }
  
  .support-info {
    text-align: left;
  }
  
  .current-balance {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    padding: 0.75rem;
    border-radius: 8px;
    margin-top: 1rem;
    text-align: center;
    border: 1px solid rgba(59, 130, 246, 0.1);
  }
  
  /* 개인 정보 스타일 */
  .personal-info {
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .info-row label {
    font-weight: 500;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
  
  .info-row span {
    color: var(--text-primary);
    font-weight: 600;
  }
  
  /* 기여 내역 스타일 */
  .contribution-list {
    max-height: 300px;
    overflow-y: auto;
  }
  
  .contribution-item {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 0.75rem;
    border-left: 4px solid var(--primary-color);
    transition: all 0.2s ease;
    border: 1px solid rgba(59, 130, 246, 0.1);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.05);
  }
  
  .contribution-item:hover {
    transform: translateX(4px);
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.15);
  }
  
  .contribution-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .contribution-type {
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: var(--font-size-xs);
    font-weight: 500;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
  }
  
  .contribution-date {
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
  }
  
  .contribution-content {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    align-items: end;
  }
  
  .contribution-dao {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    font-weight: 500;
  }
  
  .contribution-description {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    margin-bottom: 0.25rem;
  }
  
  .contribution-reward {
    color: var(--secondary-color);
    font-weight: 600;
    font-size: var(--font-size-sm);
  }
  
  /* 나의 DAO 스타일 */
  .my-dao-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .my-dao-item {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 12px;
    padding: 1rem;
    border: 1px solid rgba(59, 130, 246, 0.1);
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.05);
  }
  
  .my-dao-item:hover {
    border-color: var(--primary-color);
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.15);
  }
  
  .dao-info {
    margin-bottom: 0.75rem;
  }
  
  .dao-name {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }
  
  .dao-role {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
  
  .dao-stats {
    display: flex;
    gap: 1rem;
  }
  
  .dao-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .stat-label {
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    margin-bottom: 0.25rem;
  }
  
  .stat-value {
    color: var(--text-primary);
    font-weight: 600;
    font-size: var(--font-size-sm);
  }

  /* 트랜잭션 수수료 관련 스타일 */
  .transaction-fee-info {
    padding: 0.5rem 0;
    margin-bottom: 1rem;
  }

  .fee-notice {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    font-weight: 400;
  }

  .fee-notice i {
    color: var(--text-tertiary);
    font-size: 0.75rem;
  }

  .fee-breakdown {
    margin-top: 0.125rem;
    color: var(--text-tertiary);
    font-size: 10px;
  }

  .amount-summary {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border: 1px solid rgba(59, 130, 246, 0.1);
    border-radius: 8px;
    padding: 0.75rem;
    margin-top: 0.5rem;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
    font-size: var(--font-size-sm);
  }

  .summary-row.total {
    border-top: 1px solid var(--border-color);
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .validator-card {
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 16px;
    padding: 1.5rem;
    border: 1px solid rgba(59, 130, 246, 0.1);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
  }

  .validator-description {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: 1rem;
    line-height: 1.5;
  }

  .validator-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 0.75rem;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-radius: 8px;
    border: 1px solid rgba(59, 130, 246, 0.1);
  }

  .stat-label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
  }

  .validator-join-btn {
    width: 100%;
    justify-content: center;
  }

  .voting-fee-notice {
    padding: 0.5rem 0;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .voting-fee-notice i {
    color: var(--text-tertiary);
    font-size: 0.75rem;
  }

  .voting-fee-notice span {
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
    font-weight: 400;
  }

  /* P2P 통신 스타일 */
  .p2p-container {
    display: flex;
    height: calc(100vh - 200px);
    min-height: 600px;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid rgba(59, 130, 246, 0.1);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
  }

  .p2p-sidebar {
    width: 300px;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
  }

  .contacts-section, .chats-section {
    flex: 1;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .contacts-header, .chats-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .contacts-header h3, .chats-header h3 {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--text-primary);
  }

  .btn-icon {
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-icon:hover {
    background: var(--primary-hover);
    transform: scale(1.05);
  }

  .contact-item, .chat-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 0.5rem;
    border: 1px solid transparent;
  }

  .contact-item:hover, .chat-item:hover {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);
  }

  .contact-avatar, .chat-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--primary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    margin-right: 0.75rem;
    position: relative;
  }

  .status-indicator {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid white;
  }

  .status-indicator.online {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }

  .status-indicator.offline {
                    background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  }

  .contact-info, .chat-info {
    flex: 1;
  }

  .contact-name, .chat-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }

  .contact-address, .chat-preview {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
  }

  .chat-meta {
    text-align: right;
  }

  .chat-time {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
  }

  .chat-unread {
    background: var(--secondary-color);
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-xs);
    font-weight: 600;
    margin-top: 0.25rem;
    margin-left: auto;
  }

  .p2p-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .chat-placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    text-align: center;
  }

  .chat-placeholder i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: var(--text-tertiary);
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  }

  .chat-user-info {
    display: flex;
    align-items: center;
  }

  .chat-user-details {
    margin-left: 0.75rem;
  }

  .chat-user-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .chat-user-status {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .chat-messages {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
    background: white;
  }

  .message {
    margin-bottom: 1rem;
    display: flex;
  }

  .message.me {
    justify-content: flex-end;
  }

  .message-content {
    max-width: 70%;
    padding: 0.75rem;
    border-radius: 12px;
    position: relative;
  }

  .message.me .message-content {
    background: var(--primary-color);
    color: white;
  }

  .message.other .message-content {
    background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
    color: var(--text-primary);
  }

  .message-text {
    margin-bottom: 0.25rem;
  }

  .message-time {
    font-size: var(--font-size-xs);
    opacity: 0.7;
  }

  .chat-input {
    padding: 1rem;
    border-top: 1px solid var(--border-color);
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  }

  .input-container {
    display: flex;
    gap: 0.5rem;
  }

  .input-container input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 24px;
    outline: none;
  }

  .send-btn {
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
    color: white;
    border: none;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .send-btn:hover {
    background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-color) 100%);
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  .call-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
    color: white;
    text-align: center;
  }

  .caller-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .caller-name {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .call-status {
    font-size: 1rem;
    opacity: 0.8;
    margin-bottom: 2rem;
  }

  .call-controls {
    display: flex;
    gap: 1rem;
  }

  .call-btn {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .mute-btn, .speaker-btn {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.3) 100%);
    backdrop-filter: blur(10px);
  }

  .end-btn {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  }

  .call-btn:hover {
    transform: translateY(-2px) scale(1.1);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  .auth-required {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-tertiary);
    text-align: center;
  }

  .auth-required i {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  /* DAO 컨소시엄 모달 스타일 */
  .consortium-modal {
    max-width: 1200px;
    width: 95vw;
    max-height: 90vh;
  }

  .consortium-container {
    display: flex;
    flex-direction: column;
    height: 70vh;
  }

  .consortium-nav {
    display: flex;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 1.5rem;
  }

  .consortium-tab {
    padding: 0.75rem 1.5rem;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .consortium-tab:hover {
    color: var(--primary-color);
    background: rgba(135, 206, 235, 0.1);
  }

  .consortium-tab.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
    background: rgba(135, 206, 235, 0.1);
  }

  .consortium-content {
    flex: 1;
    overflow-y: auto;
  }

  .consortium-tab-content {
    display: none;
  }

  .consortium-tab-content.active {
    display: block;
  }

  /* 개요 탭 스타일 */
  .dao-overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .overview-card {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid var(--border-color);
  }

  .overview-card h4 {
    color: var(--primary-color);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .overview-stats {
    display: flex;
    gap: 2rem;
  }

  .stat {
    text-align: center;
  }

  .stat-number {
    display: block;
    font-size: 2rem;
    font-weight: bold;
    color: var(--accent-color);
  }

  .stat-label {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .operator-card {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .operator-avatar {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
  }

  .operator-name {
    font-weight: bold;
    color: var(--text-primary);
  }

  .operator-did {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .operator-tokens {
    color: var(--accent-color);
    font-weight: 500;
  }

  /* 금고 탭 스타일 */
  .treasury-overview {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }

  .treasury-card {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid var(--border-color);
  }

  .treasury-balance {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .balance-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .balance-label {
    color: var(--text-secondary);
  }

  .balance-value {
    font-weight: bold;
    color: var(--accent-color);
    font-size: 1.2rem;
  }

  .usage-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .usage-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: rgba(135, 206, 235, 0.05);
    border-radius: 8px;
  }

  .usage-type {
    font-weight: 500;
    color: var(--text-primary);
  }

  .usage-date {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .usage-amount {
    color: var(--text-primary);
    font-weight: bold;
  }

  /* 거버넌스 탭 스타일 */
  .governance-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .governance-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dao-proposal-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }

  .proposal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .proposal-header h5 {
    color: var(--text-primary);
    margin: 0;
  }

  .proposal-status {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .proposal-status.active {
    background: rgba(46, 204, 113, 0.2);
    color: #27ae60;
  }

  .proposal-status.voting {
    background: rgba(52, 152, 219, 0.2);
    color: #3498db;
  }

  .proposal-content p {
    color: var(--text-secondary);
    margin-bottom: 1rem;
  }

  .proposal-meta {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .proposal-votes {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .vote-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .vote-label {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .vote-count {
    font-weight: bold;
    color: var(--text-primary);
  }

  .proposal-actions {
    display: flex;
    gap: 0.75rem;
  }

  /* 랭킹 탭 스타일 */
  .rankings-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .ranking-tabs {
    display: flex;
    gap: 0.5rem;
  }

  .ranking-tab {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border-color);
    background: var(--card-bg);
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.3s ease;
  }

  .ranking-tab:hover {
    color: var(--primary-color);
    border-color: var(--primary-color);
  }

  .ranking-tab.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }

  .ranking-content {
    position: relative;
  }

  .ranking-list {
    display: none;
  }

  .ranking-list.active {
    display: block;
  }

  .ranking-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    margin-bottom: 0.75rem;
  }

  .rank-number {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }

  .rank-info {
    flex: 1;
  }

  .rank-name {
    font-weight: bold;
    color: var(--text-primary);
  }

  .rank-details {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .rank-tokens {
    font-weight: bold;
    color: var(--accent-color);
  }

  /* 커뮤니티 탭 스타일 */
  .community-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .community-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .community-post {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }

  .post-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .post-author {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .author-avatar {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .author-name {
    font-weight: bold;
    color: var(--text-primary);
  }

  .post-time {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  .post-type {
    color: var(--text-secondary);
  }

  .post-content p {
    color: var(--text-primary);
    margin-bottom: 1rem;
  }

  .post-media {
    margin: 1rem 0;
  }

  .image-placeholder,
  .video-placeholder {
    background: rgba(135, 206, 235, 0.1);
    border: 2px dashed var(--border-color);
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
  }

  .post-actions {
    display: flex;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .post-action {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 6px;
    transition: all 0.3s ease;
  }

  .post-action:hover {
    background: rgba(135, 206, 235, 0.1);
    color: var(--primary-color);
  }

  /* 새로운 기능들 CSS 스타일 */
  
  /* 포스트 타입 탭 스타일 */
  .post-type-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .post-type-tab {
    padding: 0.75rem 1.5rem;
    border: none;
    background: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .post-type-tab:hover {
    color: var(--primary-color);
  }

  .post-type-tab.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
  }

  /* 파일 업로드 스타일 */
  .file-upload {
    position: relative;
    border: 2px dashed var(--border-color);
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    transition: all 0.3s ease;
  }

  .file-upload:hover {
    border-color: var(--primary-color);
    background: rgba(135, 206, 235, 0.05);
  }

  .file-upload input[type="file"] {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .file-upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
  }

  .file-upload-placeholder i {
    font-size: 2rem;
    color: var(--text-tertiary);
  }

  /* 체크박스 스타일 */
  .checkbox-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    cursor: pointer;
  }

  .checkbox-wrapper input[type="checkbox"] {
    display: none;
  }

  .checkmark {
    width: 20px;
    height: 20px;
    background: white;
    border: 2px solid var(--border-color);
    border-radius: 4px;
    position: relative;
    transition: all 0.3s ease;
  }

  .checkbox-wrapper input[type="checkbox"]:checked + .checkmark {
    background: var(--primary-color);
    border-color: var(--primary-color);
  }

  .checkbox-wrapper input[type="checkbox"]:checked + .checkmark:after {
    content: '✓';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-weight: bold;
    font-size: 0.8rem;
  }

  /* 게시 규칙 및 제안 정보 스타일 */
  .posting-rules,
  .proposal-info {
    background: rgba(135, 206, 235, 0.1);
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
  }

  .posting-rules h4,
  .proposal-info h4 {
    color: var(--primary-color);
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .posting-rules ul,
  .proposal-info ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .posting-rules li,
  .proposal-info li {
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  /* 댓글 모달 스타일 */
  .comments-modal {
    max-width: 600px;
  }

  .comments-container {
    max-height: 500px;
    display: flex;
    flex-direction: column;
  }

  .comments-list {
    flex: 1;
    max-height: 350px;
    overflow-y: auto;
    margin-bottom: 1.5rem;
  }

  .comment-item {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .comment-author {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .comment-author .author-avatar {
    width: 32px;
    height: 32px;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
  }

  .author-info {
    display: flex;
    flex-direction: column;
  }

  .author-name {
    font-weight: bold;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
  }

  .comment-time {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
  }

  .like-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: all 0.3s ease;
  }

  .like-btn:hover {
    background: rgba(135, 206, 235, 0.1);
    color: var(--primary-color);
  }

  .comment-content p {
    color: var(--text-primary);
    margin: 0;
    line-height: 1.5;
  }

  .comment-form {
    border-top: 1px solid var(--border-color);
    padding-top: 1rem;
  }

  .comment-input {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .comment-input .user-avatar {
    width: 40px;
    height: 40px;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .comment-input textarea {
    flex: 1;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.75rem;
    resize: vertical;
    outline: none;
  }

  .comment-input textarea:focus {
    border-color: var(--primary-color);
  }

  .comment-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  /* 연락처 선택 스타일 */
  .contact-selection {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.5rem;
  }

  .contact-selection .contact-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border-radius: 6px;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .contact-selection .contact-item:hover {
    background: rgba(135, 206, 235, 0.1);
  }

  .contact-selection input[type="checkbox"] {
    margin-right: 0.75rem;
  }

  .contact-selection label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    flex: 1;
  }

  .contact-selection .contact-avatar {
    width: 36px;
    height: 36px;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }

  .contact-selection .contact-info {
    display: flex;
    flex-direction: column;
  }

  .contact-selection .contact-name {
    font-weight: bold;
    color: var(--text-primary);
  }

  .contact-selection .contact-address {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }

  /* 그룹 설정 스타일 */
  .group-settings {
    background: rgba(135, 206, 235, 0.05);
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
  }

  .group-settings h4 {
    color: var(--primary-color);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* 반응형 디자인 */
  @media (max-width: 768px) {
    .post-type-tabs {
      flex-wrap: wrap;
    }
    
    .contact-selection {
      max-height: 150px;
    }
    
    .comments-modal {
      max-width: 95vw;
    }
  }

  
  
  /* 컨소시엄 모달 모바일 최적화 */
  @media (max-width: 768px) {
    .consortium-modal {
      padding: 0;
      margin: 0;
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      border-radius: 0;
      overflow: hidden;
    }

    .consortium-modal .modal-content {
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      border-radius: 0;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }

    .consortium-modal .modal-header {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      background: var(--bg-primary);
      z-index: 10;
    }

    .consortium-modal .modal-body {
      padding: 0;
      height: calc(100vh - 80px);
      overflow-y: auto;
    }
    
    .consortium-container {
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
      border-radius: 0;
      padding: 1rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    
    .consortium-header {
      flex-direction: column;
      gap: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 1rem;
    }
    
    .consortium-nav {
      display: flex;
      overflow-x: auto;
      gap: 0.25rem;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-secondary);
      margin: 0 -1rem;
      position: sticky;
      top: 0;
      z-index: 5;
    }

    .consortium-content {
      flex: 1;
      padding: 1rem;
      overflow-y: auto;
    }
    
    .consortium-tab {
      min-width: 80px;
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      white-space: nowrap;
    }
    
    .dao-treasury-grid {
      grid-template-columns: 1fr !important;
      gap: 1rem;
    }

    .treasury-overview {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .treasury-card {
      padding: 1rem;
      border-radius: 8px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
    }

    .treasury-card h4 {
      font-size: 1rem;
      margin-bottom: 1rem;
      color: var(--text-primary);
    }

    .treasury-balance {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .balance-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: var(--bg-primary);
      border-radius: 6px;
      border: 1px solid var(--border-color);
    }

    .balance-label {
      color: var(--text-secondary);
      font-size: 0.9rem;
      font-weight: 500;
    }

    .balance-value {
      font-weight: bold;
      color: var(--primary-color);
      font-size: 1.1rem;
    }

    .treasury-usage {
      margin-top: 1rem;
    }

    .usage-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .usage-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: var(--bg-primary);
      border-radius: 6px;
      border: 1px solid var(--border-color);
      font-size: 0.9rem;
    }

    .usage-type {
      font-weight: 500;
      color: var(--text-primary);
    }

    .usage-date {
      color: var(--text-secondary);
      font-size: 0.8rem;
    }

    .usage-amount {
      color: var(--primary-color);
      font-weight: bold;
    }
    
    .governance-actions {
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .proposal-form {
      padding: 1rem;
    }
    
    .form-group {
      margin-bottom: 1rem;
    }
    
    .form-group label {
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }
    
    .form-group input,
    .form-group textarea,
    .form-group select {
      padding: 0.75rem;
      font-size: 0.9rem;
    }
    
    .ranking-filters {
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .ranking-list {
      font-size: 0.9rem;
    }
    
    .ranking-item {
      padding: 0.75rem;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
    
    .ranking-info {
      display: flex;
      justify-content: space-between;
      width: 100%;
    }
    
    .post-form {
      padding: 1rem;
    }
    
    .post-tabs {
      gap: 0.25rem;
    }
    
    .post-tab {
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
    }
    
    .file-upload-area {
      padding: 1.5rem;
      min-height: 100px;
    }
    
    .post-options {
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .comments-modal .modal-content {
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
      border-radius: 0;
      padding: 1rem;
    }
    
    .comment-item {
      padding: 0.75rem;
      font-size: 0.9rem;
    }
    
    .comment-form {
      padding: 0.75rem;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .comment-input {
      margin-right: 0 !important;
      margin-bottom: 0.5rem;
    }
    
    .comment-submit {
      width: 100%;
    }
  }

  /* 작은 화면에서 텍스트 크기 조정 */
  @media (max-width: 480px) {
    .consortium-modal {
      font-size: 0.85rem;
    }
    
    .consortium-header h2 {
      font-size: 1.25rem;
    }
    
    .consortium-tab {
      min-width: 70px;
      padding: 0.4rem 0.6rem;
      font-size: 0.8rem;
    }
    
    .dao-treasury-item h4 {
      font-size: 1rem;
    }
    
    .treasury-amount {
      font-size: 1.25rem;
    }
    
    .proposal-card h4 {
      font-size: 1rem;
    }
    
    .ranking-item {
      padding: 0.5rem;
    }
    
    .post-card {
      padding: 0.75rem;
    }
    
    .post-title {
      font-size: 1rem;
    }
  }

  /* 모든 빨간색 텍스트를 검정색으로 변경 */
  .text-danger,
  .danger-text,
  .error-text,
  .validation-error,
  .required-field {
    color: var(--text-primary) !important;
  }

  /* 특정 요소들의 빨간색 제거 */
  .balance-rate,
  .network-value,
  .stat-value,
  .treasury-amount,
  .proposal-status.rejected,
  .proposal-votes .against {
    color: var(--text-primary) !important;
  }

  /* 폼 유효성 검사 오류 메시지 스타일 개선 */
  .form-error {
    color: var(--text-primary);
    background-color: #fef2f2;
    border: 1px solid #e5e7eb;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  /* P2P 통신 상태 표시 개선 */
  .p2p-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: var(--background-secondary);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .p2p-status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #22c55e;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* 통신 품질 표시 */
  .connection-quality {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .quality-bar {
    width: 3px;
    height: 12px;
    background-color: #e5e7eb;
    border-radius: 1px;
  }

  .quality-bar.active {
    background-color: #22c55e;
  }

  .quality-bar.medium {
    background-color: #f59e0b;
  }

  .quality-bar.low {
    background-color: var(--text-primary);
  }

  /* 모바일에서 모달의 닫기 버튼 개선 */
  @media (max-width: 768px) {
    .modal-close,
    .consortium-close {
      top: 1rem;
      right: 1rem;
      width: 40px;
      height: 40px;
      font-size: 1.25rem;
      z-index: 1001;
      background-color: rgba(0, 0, 0, 0.1) !important;
      color: var(--text-primary) !important;
      border: 1px solid var(--border-color);
    }
  }

  /* 테이블의 모바일 반응형 개선 */
  @media (max-width: 768px) {
    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    
    .dao-members-table,
    .transaction-table {
      min-width: 500px;
    }
    
    .dao-members-table th,
    .dao-members-table td,
    .transaction-table th,
    .transaction-table td {
      padding: 0.5rem;
      font-size: 0.85rem;
    }
  }

      /* P2P 통신 UI 스타일 - 완전히 새로 작성 */
    .p2p-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 200px);
      min-height: 650px;
      background: var(--bg-primary);
      border-radius: 12px;
      box-shadow: var(--shadow-md);
      overflow: hidden;
    }

    /* 새로운 채팅 메시지 스타일 */
    .message {
      display: flex;
      align-items: flex-end;
      margin-bottom: 1rem;
      gap: 0.5rem;
    }

    .message-sent {
      flex-direction: row-reverse;
    }

    .message-received {
      flex-direction: row;
    }

    .message-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
    }

    .avatar-emoji {
      font-size: 1rem;
    }

    .message-bubble {
      max-width: 70%;
      padding: 0.75rem 1rem;
      border-radius: 18px;
      position: relative;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .message-sent .message-bubble {
      background: linear-gradient(135deg, var(--primary-color) 0%, var(--accent-color) 100%);
      color: white;
      border-bottom-right-radius: 6px;
    }

    .message-received .message-bubble {
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      color: var(--text-primary);
      border-bottom-left-radius: 6px;
      border: 1px solid rgba(59, 130, 246, 0.1);
    }

    .message-sender {
      font-size: var(--font-size-xs);
      font-weight: 600;
      margin-bottom: 0.25rem;
      opacity: 0.8;
    }

    .message-text {
      font-size: var(--font-size-sm);
      line-height: 1.4;
      margin-bottom: 0.25rem;
    }

    .message-time {
      font-size: var(--font-size-xs);
      opacity: 0.7;
      text-align: right;
    }

    .message-received .message-time {
      color: var(--text-secondary);
    }

    /* 날짜 구분선 스타일 */
    .date-divider {
      display: flex;
      align-items: center;
      margin: 1.5rem 0;
      position: relative;
    }

    .date-line {
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, transparent, rgba(59, 130, 246, 0.3), transparent);
    }

    .date-text {
      margin: 0 1rem;
      padding: 0.25rem 0.75rem;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 197, 253, 0.1) 100%);
      color: var(--primary-color);
      font-size: var(--font-size-xs);
      font-weight: 600;
      border-radius: 12px;
      border: 1px solid rgba(59, 130, 246, 0.2);
      white-space: nowrap;
    }

    .p2p-content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .p2p-sidebar {
      width: 100%;
      background: var(--bg-secondary);
      display: flex;
      flex-direction: column;
    }

      .p2p-tabs {
      display: flex;
      background: var(--bg-primary);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .p2p-tab {
      flex: 1;
      padding: 0.75rem;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 0.9rem;
    }

  .p2p-tab:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .p2p-tab.active {
    background: var(--primary-color);
    color: var(--text-white);
  }

  .p2p-tab-content {
    display: none;
    flex: 1;
    overflow: hidden;
  }

  .p2p-tab-content.active {
    display: flex;
    flex-direction: column;
  }

      .p2p-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-primary);
      flex-shrink: 0;
    }

    .p2p-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
    }

  .btn-icon {
    width: 36px;
    height: 36px;
    border: none;
    background: var(--primary-color);
    color: var(--text-white);
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-fast);
  }

  .btn-icon:hover {
    background: var(--primary-dark);
    transform: translateY(-1px);
  }

      .contact-list, .chat-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
    }

      .contact-item, .chat-item {
      display: flex;
      align-items: center;
      padding: 0.6rem 0.75rem;
      margin-bottom: 0.15rem;
      border-radius: 6px;
      cursor: pointer;
      transition: var(--transition-fast);
      background: var(--bg-primary);
    }

    .contact-item:hover, .chat-item:hover {
      background: var(--bg-tertiary);
      transform: translateX(2px);
    }

    .contact-avatar, .chat-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--primary-light);
      color: var(--text-white);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 0.6rem;
      position: relative;
      font-size: 0.9rem;
    }

  .status-indicator {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--bg-primary);
  }

  .status-indicator.online {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  }

  .status-indicator.offline {
    background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
  }

  .contact-info, .chat-info {
    flex: 1;
    min-width: 0;
  }

      .contact-name, .chat-name {
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 0.15rem;
      font-size: 0.95rem;
    }

    .contact-address, .chat-preview {
      font-size: 0.8rem;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

  .contact-actions {
    display: flex;
    gap: 0.25rem;
  }

  .chat-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }

  .chat-time {
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }

  .chat-unread {
    background: var(--primary-color);
    color: var(--text-white);
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    min-width: 20px;
    text-align: center;
  }

  .p2p-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

      .chat-welcome {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 1rem;
      color: var(--text-secondary);
      min-height: 200px;
    }

    .chat-welcome i {
      font-size: 2.5rem;
      margin-bottom: 0.75rem;
      color: var(--primary-light);
    }

    .chat-welcome h3 {
      margin-bottom: 0.5rem;
      color: var(--text-primary);
      font-size: 1.25rem;
    }

    .chat-welcome p {
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .p2p-features {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
      flex-wrap: wrap;
      justify-content: center;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--bg-secondary);
      border-radius: 6px;
      font-size: 0.8rem;
    }

    .feature-item i {
      font-size: 1rem;
      color: var(--primary-color);
    }

    .feature-item span {
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text-primary);
    }

      .chat-container {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    /* 전체 화면 채팅 스타일 */
    .chat-full-screen {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    .btn-back {
      width: 40px;
      height: 40px;
      border: none;
      background: transparent;
      color: var(--text-primary);
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition-fast);
      margin-right: 0.75rem;
    }

    .btn-back:hover {
      background: var(--bg-tertiary);
      transform: translateX(-2px);
    }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-secondary);
  }

  .chat-user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .chat-user-details {
    display: flex;
    flex-direction: column;
  }

  .chat-user-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .chat-user-status {
    font-size: 0.875rem;
    color: var(--secondary-color);
  }

  .chat-actions {
    display: flex;
    gap: 0.5rem;
  }

  .chat-messages {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
    background: var(--bg-secondary);
  }

  .message {
    margin-bottom: 1rem;
    display: flex;
  }

  .message.me {
    justify-content: flex-end;
  }

  .message-content {
    max-width: 70%;
    padding: 0.75rem 1rem;
    border-radius: 18px;
    position: relative;
  }

  .message.other .message-content {
    background: var(--bg-primary);
    color: var(--text-primary);
    border-bottom-left-radius: 4px;
  }

  .message.me .message-content {
    background: var(--primary-color);
    color: var(--text-white);
    border-bottom-right-radius: 4px;
  }

  .message-text {
    margin-bottom: 0.25rem;
  }

  .message-time {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .chat-input {
    padding: 1rem;
    border-top: 1px solid var(--border-color);
    background: var(--bg-primary);
  }

  .input-container {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
  }

  .input-container input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 24px;
    font-size: 0.9rem;
    outline: none;
    transition: var(--transition-fast);
  }

  .input-container input:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
  }

  .send-btn {
    width: 44px;
    height: 44px;
    border: none;
    background: var(--primary-color);
    color: var(--text-white);
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: var(--transition-fast);
  }

  .send-btn:hover {
    background: var(--primary-dark);
    transform: scale(1.05);
  }

      /* P2P 상태 표시 */
    .p2p-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border-bottom: 1px solid var(--border-color);
      font-size: 0.8rem;
      flex-shrink: 0;
    }

  .p2p-status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    animation: pulse 2s infinite;
  }

  .connection-quality {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
  }

  .quality-bars {
    display: flex;
    gap: 2px;
  }

  .quality-bar {
    width: 3px;
    height: 12px;
    background: #e5e7eb;
    border-radius: 1px;
  }

  .quality-bar.active {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  }

  /* 음성 통화 모달 */
  .voice-call-modal .modal-content {
    width: 400px;
    max-width: 90vw;
  }

  .call-modal-content {
    text-align: center;
    padding: 2rem;
  }

  .call-info {
    margin-bottom: 2rem;
  }

  .caller-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--primary-light);
    color: var(--text-white);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
    font-size: 2rem;
  }

  .caller-name {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .call-status {
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .call-duration {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary-color);
  }

  .call-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .call-btn {
    width: 60px;
    height: 60px;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    transition: var(--transition-fast);
  }

  .call-btn.mute-btn {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .call-btn.end-btn {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: var(--text-white);
  }

  .call-btn.speaker-btn {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  .call-btn:hover {
    transform: scale(1.1);
  }

  .call-quality {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .quality-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .encryption-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--secondary-color);
  }

      /* 모바일 최적화 */
    @media (max-width: 768px) {
      .p2p-container {
        height: calc(100vh - 120px);
      }
      
      .p2p-content {
        flex-direction: column;
      }
      
      .p2p-sidebar {
        width: 100%;
        flex: 1;
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }
      
      .p2p-tabs {
        flex-shrink: 0;
      }
      
      .contact-list, .chat-list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
      
      .p2p-features {
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
      
      .feature-item {
        padding: 0.4rem 0.6rem;
        font-size: 0.75rem;
      }
      
      .feature-item i {
        font-size: 0.9rem;
      }
      
      .chat-welcome {
        padding: 0.75rem;
        min-height: 150px;
      }
      
      .chat-welcome i {
        font-size: 2rem;
        margin-bottom: 0.5rem;
      }
      
      .chat-welcome h3 {
        font-size: 1.1rem;
      }
      
      .input-container {
        flex-direction: row;
        gap: 0.5rem;
      }
      
      .send-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
      }
      
      .call-actions {
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      
      .call-btn {
        width: 50px;
        height: 50px;
      }
      
      /* 전체 화면 채팅 모바일 최적화 */
      .chat-full-screen {
        height: 100%;
      }
      
      .btn-back {
        width: 36px;
        height: 36px;
        margin-right: 0.5rem;
      }
    }

      @media (max-width: 480px) {
      .p2p-container {
        height: calc(100vh - 100px);
      }
      
      .p2p-sidebar {
        flex: 1;
      }
      
      .contact-list, .chat-list {
        flex: 1;
        min-height: 0;
      }
      
      .contact-item, .chat-item {
        padding: 0.5rem 0.6rem;
      }
      
      .contact-avatar, .chat-avatar {
        width: 32px;
        height: 32px;
        margin-right: 0.5rem;
        font-size: 0.8rem;
      }
      
      .contact-name, .chat-name {
        font-size: 0.9rem;
      }
      
      .contact-address, .chat-preview {
        font-size: 0.75rem;
      }
      
      .p2p-header {
        padding: 0.6rem 0.75rem;
      }
      
      .p2p-header h3 {
        font-size: 0.9rem;
      }
      
      .btn-icon {
        width: 32px;
        height: 32px;
      }
      
      .p2p-tab {
        padding: 0.6rem;
        font-size: 0.85rem;
      }
      
      .p2p-status {
        padding: 0.4rem 0.75rem;
        font-size: 0.75rem;
      }
      
      .chat-messages {
        padding: 0.75rem;
      }
      
      .chat-input {
        padding: 0.75rem;
      }
      
      .chat-welcome {
        padding: 0.5rem;
        min-height: 120px;
      }
      
      .chat-welcome i {
        font-size: 1.5rem;
      }
      
      .chat-welcome h3 {
        font-size: 1rem;
      }
      
      .feature-item {
        padding: 0.3rem 0.5rem;
        font-size: 0.7rem;
      }
    }

    /* 비밀번호 설정 스타일 */
    .password-setup {
      margin: 2rem 0;
      text-align: left;
    }

    .password-form {
      background: var(--card-bg);
      padding: 2rem;
      border-radius: 12px;
      border: 1px solid var(--border-color);
    }

    .password-form h4 {
      color: var(--primary-color);
      margin-bottom: 0.5rem;
      text-align: center;
    }

    .password-form p {
      color: var(--text-secondary);
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .password-requirements {
      margin: 1rem 0;
      padding: 0.75rem;
      background: rgba(59, 130, 246, 0.1);
      border-radius: 8px;
      border-left: 4px solid var(--primary-color);
    }

    .password-requirements small {
      color: var(--text-secondary);
      line-height: 1.4;
    }

    /* 비밀번호 확인 모달 스타일 */
    .password-confirm-modal .modal-content {
      max-width: 400px;
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }

    /* 본인인증 선택 모달 스타일 */
    .auth-selection-modal .modal-content {
      max-width: 450px;
    }

    .auth-methods {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 1rem;
      margin: 2rem 0;
    }

    .auth-method-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1.5rem 1rem;
      border: 2px solid var(--border-color);
      border-radius: 12px;
      background: var(--card-bg);
      color: var(--text-primary);
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .auth-method-btn:hover {
      border-color: var(--primary-color);
      background: rgba(59, 130, 246, 0.1);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
    }

    .auth-method-btn i {
      font-size: 2rem;
      color: var(--primary-color);
    }

    .auth-method-btn span {
      font-weight: 500;
    }

    /* 인증 애니메이션 스타일 */
    .auth-animation {
      text-align: center;
      padding: 2rem;
    }

    .fingerprint-icon, .face-icon {
      font-size: 4rem;
      color: var(--primary-color);
      animation: authPulse 1.5s infinite;
      margin-bottom: 1rem;
    }

    @keyframes authPulse {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.7; }
      100% { transform: scale(1); opacity: 1; }
    }

    .auth-animation p {
      color: var(--text-secondary);
      font-size: var(--font-size-lg);
    }

  /* DAO 생성 제안 투표 모달 스타일 */
  .dao-creation-voting-modal {
    max-width: 900px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .dao-creation-badge {
    background: linear-gradient(135deg, #3B82F6, #1D4ED8);
    color: white;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    font-weight: 600;
  }

  .dao-creation-badge i {
    font-size: 1.2rem;
  }

  .dao-creation-section {
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    border: 1px solid var(--border-color);
  }

  .dao-creation-section h4 {
    color: var(--text-primary);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .dao-creation-section h4 i {
    color: var(--secondary-color);
    font-size: 1rem;
  }

  .dao-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .dao-info-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .dao-info-item.full-width {
    grid-column: 1 / -1;
  }

  .dao-info-item label {
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .dao-name-display {
    background: var(--bg-primary);
    padding: 0.75rem;
    border-radius: 6px;
    border: 2px solid var(--secondary-color);
    font-weight: 600;
    color: var(--secondary-color);
    font-size: 1.1rem;
  }

  .dao-description-display,
  .dao-justification-display {
    background: var(--bg-primary);
    padding: 1rem;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    line-height: 1.6;
    color: var(--text-primary);
  }

  .proposed-dca-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .proposed-dca-item {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    transition: all 0.2s ease;
  }

  .proposed-dca-item:hover {
    border-color: var(--secondary-color);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  }

  .dca-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .dca-header h5 {
    color: var(--text-primary);
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .dca-value {
    background: var(--secondary-color);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .dca-criteria,
  .dca-details {
    margin-bottom: 0.5rem;
    line-height: 1.5;
    color: var(--text-primary);
  }

  .dca-criteria strong,
  .dca-details strong {
    color: var(--text-secondary);
    font-weight: 600;
  }

  .initial-op-info {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
  }

  .op-candidate {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .op-did,
  .op-qualification {
    line-height: 1.5;
    color: var(--text-primary);
  }

  .op-did strong,
  .op-qualification strong {
    color: var(--text-secondary);
    font-weight: 600;
  }

  .dao-creation-voting-info {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 6px;
    padding: 0.75rem;
    margin-top: 0.75rem;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  .dao-creation-voting-info i {
    color: var(--secondary-color);
    margin-right: 0.25rem;
  }

  .vote-btn-large {
    padding: 1rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    transition: all 0.2s ease;
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .vote-btn-large:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .vote-btn-large.vote-for {
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  }

  .vote-btn-large.vote-for:hover {
    background: linear-gradient(135deg, #047857 0%, #059669 100%);
  }

  .vote-btn-large.vote-against {
    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  }

  .vote-btn-large.vote-against:hover {
    background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%);
  }

  .vote-btn-large.abstain {
    background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%);
  }

  .vote-btn-large.abstain:hover {
    background: linear-gradient(135deg, #4b5563 0%, #6b7280 100%);
  }

  .vote-btn-large small {
    font-size: 0.75rem;
    opacity: 0.8;
    font-weight: normal;
  }

  .vote-buttons-large {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  @media (max-width: 768px) {
    .vote-buttons-large {
      flex-direction: column;
      gap: 0.75rem;
    }
  }

  /* 투표 현황 스타일 */
  .voting-progress-detail {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .vote-summary-large {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .vote-option {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }

  .vote-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .vote-count {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .vote-percentage {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .progress-bar-large {
    height: 16px;
    background: #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    margin-bottom: 1rem;
  }

  .progress-for {
    background: linear-gradient(90deg, #059669, #10b981);
    transition: width 0.3s ease;
  }

  .progress-against {
    background: linear-gradient(90deg, #dc2626, #ef4444);
    transition: width 0.3s ease;
  }

  .progress-abstain {
    background: linear-gradient(90deg, #6b7280, #9ca3af);
    transition: width 0.3s ease;
  }

  .voting-explanation {
    text-align: center;
    color: var(--text-primary);
  }

  .voting-explanation p {
    margin-bottom: 0.5rem;
  }

  .voted-notice {
    color: #059669;
    font-weight: 600;
  }

  .vote-encourage {
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .vote-summary-large {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }
  }

  @media (max-width: 768px) {
    .dao-creation-voting-modal {
      max-width: 95vw;
      margin: 1rem;
    }

    .dao-info-grid {
      grid-template-columns: 1fr;
    }

    .dao-info-item {
      grid-column: 1;
    }
  }

  /* DAO 생성 제안 모달 (제안과정용) 스타일 */
  .dao-creation-proposal-modal {
    max-width: 900px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .funding-status-large {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .funding-progress-bar {
    background: #e5e7eb;
    height: 12px;
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .funding-fill {
    background: linear-gradient(90deg, var(--secondary-color), var(--primary-color));
    height: 100%;
    border-radius: 6px;
    transition: width 0.3s ease;
  }

  .funding-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
  }

  .funding-stat {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .funding-stat .stat-label {
    font-size: 0.875rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .funding-stat .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .funding-participation-info {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .participation-benefits h5,
  .participation-process h5 {
    color: var(--text-primary);
    margin-bottom: 0.75rem;
    font-size: 1rem;
    font-weight: 600;
  }

  .participation-benefits ul {
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem 0;
  }

  .participation-benefits li {
    padding: 0.5rem 0;
    position: relative;
    padding-left: 1.5rem;
    line-height: 1.5;
    color: var(--text-primary);
  }

  .participation-benefits li::before {
    content: "✓";
    position: absolute;
    left: 0;
    color: var(--secondary-color);
    font-weight: bold;
  }

  .process-steps {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .process-step {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(59, 130, 246, 0.05);
    border-radius: 8px;
    border: 1px solid transparent;
    transition: all 0.2s ease;
  }

  .process-step.current {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);
  }

  .step-number {
    background: var(--secondary-color);
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .process-step.current .step-number {
    background: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .step-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .step-content strong {
    color: var(--text-primary);
    font-weight: 600;
  }

  .step-content span {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .funding-actions-modal {
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border: 1px solid rgba(59, 130, 246, 0.1);
    border-radius: 8px;
    padding: 1.5rem;
    margin-top: 1.5rem;
  }

  .funding-actions-modal h4 {
    color: var(--text-primary);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .funding-info {
    margin-bottom: 1rem;
  }

  .funding-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-primary);
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .funding-notice i {
    color: var(--secondary-color);
  }

  .funding-action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .btn-large {
    padding: 1rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
    transition: all 0.2s ease;
  }

  .btn-large small {
    font-size: 0.75rem;
    opacity: 0.8;
    font-weight: normal;
  }

  @media (max-width: 768px) {
    .dao-creation-proposal-modal {
      max-width: 95vw;
      margin: 1rem;
    }

    .funding-stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .process-steps {
      gap: 0.75rem;
    }

    .process-step {
      padding: 0.75rem;
    }
  }

  /* 구성원용 DAO 생성 제안 모달 스타일 */
  .create-dao-proposal-modal-content {
    max-width: 700px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .proposal-info-notice {
    margin-bottom: 2rem;
    background: linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 100%);
    border: 1px solid rgba(3, 169, 244, 0.3);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .notice-content {
    display: flex;
    gap: 1rem;
  }

  .notice-content i {
    color: #0288d1;
    font-size: 1.5rem;
    margin-top: 0.25rem;
    flex-shrink: 0;
  }

  .notice-text h4 {
    color: var(--text-primary);
    margin-bottom: 0.5rem;
    font-size: var(--font-size-lg);
  }

  .notice-text p {
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
    line-height: 1.5;
  }

  .notice-text ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .notice-text li {
    color: var(--text-secondary);
    padding: 0.25rem 0;
    position: relative;
    padding-left: 1.5rem;
    line-height: 1.4;
  }

  .notice-text li::before {
    content: "→";
    position: absolute;
    left: 0;
    color: #0288d1;
    font-weight: bold;
  }

  .dao-proposal-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
    border-radius: 12px;
    border: 1px solid rgba(59, 130, 246, 0.1);
  }

  .dao-proposal-section h4 {
    color: var(--primary-color);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--font-size-lg);
  }

  .dao-proposal-section.proposal-fee-info {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .dca-proposal-area {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .dca-proposal-item {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .dca-proposal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .dca-proposal-header h5 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--font-size-md);
  }

  .dca-proposal-fields {
    display: grid;
    grid-template-columns: 2fr 2fr 1fr;
    gap: 1rem;
    align-items: start;
  }

  .dca-details-group {
    grid-column: 1 / -1;
    margin-top: 0.5rem;
  }

  .add-proposal-dca-btn {
    align-self: center;
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--font-size-sm);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .add-proposal-dca-btn:hover {
    background: linear-gradient(135deg, var(--primary-light) 0%, var(--primary-color) 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  /* 모바일 최적화 */
  @media (max-width: 768px) {
    .create-dao-proposal-modal-content {
      max-width: 95vw;
      margin: 1rem;
    }

    .dao-proposal-section {
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .proposal-info-notice {
      padding: 1rem;
    }

    .notice-content {
      flex-direction: column;
      gap: 0.75rem;
    }

    .dca-proposal-fields {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .dca-details-group {
      grid-column: 1;
      margin-top: 0.75rem;
    }
  }
`;

// CSS 추가
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);

// DApp 초기화
const dapp = new BaekyaProtocolDApp();
window.dapp = dapp;

// 초기 인증 상태 복원
const storedAuth = localStorage.getItem('baekya_auth');
if (storedAuth) {
  try {
    const authData = JSON.parse(storedAuth);
    dapp.currentUser = authData;
    dapp.isAuthenticated = true;
    
    // 검증자 풀 데이터 복원
    const savedPoolAmount = localStorage.getItem('baekya_validator_pool');
    if (savedPoolAmount) {
      // 초기화 후 UI 업데이트
      setTimeout(() => {
        const validatorPoolMain = document.getElementById('validatorPoolMain');
        const validatorPoolDashboard = document.getElementById('validatorPool');
        
        if (validatorPoolMain) {
          validatorPoolMain.textContent = `${parseFloat(savedPoolAmount).toFixed(6)} B`;
        }
        if (validatorPoolDashboard) {
          validatorPoolDashboard.textContent = `${parseFloat(savedPoolAmount).toFixed(6)} B`;
        }
      }, 500);
    }
    
    // UI 업데이트 지연 실행
    setTimeout(() => {
      dapp.updateUserInterface();
    }, 200);
  } catch (error) {
    console.error('초기 인증 정보 복원 실패:', error);
  }
}

// P2P 탭 알림 초기화
dapp.updateP2PTabNotification();

// 거래내역 로드 (전화번호 형태로 업데이트를 위해 기존 샘플 데이터 초기화)
if (localStorage.getItem('sampleTransactionsAdded')) {
  localStorage.removeItem('sampleTransactionsAdded');
  localStorage.removeItem('transactionHistory');
}
dapp.loadTransactionHistory();

// 전역 함수들
window.startUserAuth = () => dapp.startUserAuth();
window.closeBiometricModal = () => dapp.closeBiometricModal();
window.refreshWallet = () => dapp.refreshWallet();
window.createCommunicationAddress = () => dapp.createCommunicationAddress();
window.deleteAccount = () => dapp.deleteAccount();
window.showProposalGuide = () => dapp.showProposalGuide();
window.showCreateProposal = () => dapp.showCreateProposal();
window.closeCreateProposalModal = () => dapp.closeCreateProposalModal();
window.switchGovernanceProcess = (processType) => dapp.switchGovernanceProcess(processType);
window.switchDAOFilter = (daoFilter) => dapp.switchDAOFilter(daoFilter);
window.shareProposal = (proposalId) => dapp.shareProposal(proposalId);
window.showFundingModal = (proposalId, maxAmount) => dapp.showFundingModal(proposalId, maxAmount);
window.goToGovernanceTab = () => dapp.goToGovernanceTab();

// 거버넌스 투표 전역 함수
window.vote = (proposalId, voteType) => dapp.vote(proposalId, voteType);
window.showSupportModal = (proposalId) => dapp.showSupportModal(proposalId);
window.submitSupport = (proposalId) => dapp.submitSupport(proposalId);

// 커뮤니티 기능 전역 함수
window.toggleMyPosts = () => dapp.toggleMyPosts();

// OP 검토 시스템 전역 함수
window.openOPReviewModal = () => dapp.openOPReviewModal();
window.closeOPReviewModal = () => dapp.closeOPReviewModal();
window.switchOPReviewTab = (tabType) => dapp.switchOPReviewTab(tabType);
window.submitFunding = (proposalId, maxAmount) => dapp.submitFunding(proposalId, maxAmount);

// OP 공지 작성 전역 함수
window.showCreateAnnouncementModal = () => dapp.showCreateAnnouncementModal();
window.closeCreateAnnouncementModal = () => dapp.closeCreateAnnouncementModal();
window.handleCreateAnnouncement = (event) => dapp.handleCreateAnnouncement(event);

// DAO 검색 및 필터 전역 함수
window.searchDAOs = (searchTerm) => dapp.searchDAOs(searchTerm);
window.clearDAOSearch = () => dapp.clearDAOSearch();
window.switchDAOListFilter = (filterType) => dapp.switchDAOListFilter(filterType);

// 제안 검색 전역 함수
window.searchProposals = (searchTerm) => dapp.searchProposals(searchTerm);
window.clearProposalSearch = () => dapp.clearProposalSearch();

// 대시보드 필터 전역 함수
window.switchDashboardFilter = (cardType) => dapp.switchDashboardFilter(cardType);

// DAO 상세 정보 모달 전역 함수
window.showDAODetail = (daoId) => dapp.showDAODetail(daoId);
window.closeDAODetailModal = () => dapp.closeDAODetailModal();
window.switchDAODetailTab = (tabType) => dapp.switchDAODetailTab(tabType);

// 참정내역에서 제안으로 이동하는 전역 함수
window.navigateToProposal = (proposalId) => dapp.navigateToProposal(proposalId);

// DAO 생성 관련 전역 함수
window.handleDAOCreation = (event) => dapp.handleDAOCreation(event);
window.showDAOCreationReviewModal = (proposalId) => dapp.showDAOCreationReviewModal(proposalId);
window.approveDAOCreation = (proposalId) => dapp.approveDAOCreation(proposalId);
window.rejectDAOCreation = (proposalId) => dapp.rejectDAOCreation(proposalId);

// 새로운 채팅 기능 전역 함수들
window.openChatMenu = () => dapp.openChatMenu();
window.closeChatMenu = () => dapp.closeChatMenu();
window.openAttachmentMenu = () => dapp.openAttachmentMenu();
window.closeAttachmentMenu = () => dapp.closeAttachmentMenu();
window.showChatInfo = () => dapp.showChatInfo();
window.closeChatInfo = () => dapp.closeChatInfo();
window.showNotificationSettings = () => dapp.showNotificationSettings();
window.showChatSchedule = () => dapp.showChatSchedule();
window.showChatAnnouncement = () => dapp.showChatAnnouncement();
window.showChatVote = () => dapp.showChatVote();
window.showChatPhotos = () => dapp.showChatPhotos();
window.showChatFiles = () => dapp.showChatFiles();
window.showChatLinks = () => dapp.showChatLinks();
window.showChatSearch = () => dapp.showChatSearch();
window.leaveChatRoom = () => dapp.leaveChatRoom();
window.startVideoCall = (contactId) => dapp.startVideoCall(contactId);
window.confirmVideoCall = (contactId) => dapp.confirmVideoCall(contactId);
window.endVideoCall = () => dapp.endVideoCall();
window.toggleCamera = () => dapp.toggleCamera();
window.toggleVideoMute = () => dapp.toggleVideoMute();
window.toggleVideoSpeaker = () => dapp.toggleVideoSpeaker();
window.toggleFullscreen = () => dapp.toggleFullscreen();
window.attachPhoto = () => dapp.attachPhoto();
window.attachVideo = () => dapp.attachVideo();
window.attachFile = () => dapp.attachFile();
window.attachContact = () => dapp.attachContact();
window.attachLocation = () => dapp.attachLocation();
window.attachMoney = () => dapp.attachMoney();
window.attachVote = () => dapp.attachVote();
window.attachSchedule = () => dapp.attachSchedule();
window.openEmojiPicker = () => dapp.openEmojiPicker();
window.closeEmojiPicker = () => dapp.closeEmojiPicker();
window.insertEmoji = (emoji) => dapp.insertEmoji(emoji);
window.toggleVoiceMessage = () => dapp.toggleVoiceMessage();
window.blockUser = () => dapp.blockUser();
window.reportUser = () => dapp.reportUser();

// 새로운 첨부 기능들
window.shareContact = (name, address) => dapp.shareContact(name, address);
window.addSharedContact = (name, address) => dapp.addSharedContact(name, address);
window.openLocation = (lat, lng) => dapp.openLocation(lat, lng);
window.sendMoney = () => dapp.sendMoney();
window.publishVoting = () => dapp.publishVoting();
window.voteChatPoll = (votingId, optionIndex, optionText) => dapp.voteChatPoll(votingId, optionIndex, optionText);
window.shareSchedule = () => dapp.shareSchedule();
window.addToCalendar = (title, start, end, description, location) => dapp.addToCalendar(title, start, end, description, location);
window.playVoiceMessage = (button, audioData) => dapp.playVoiceMessage(button, audioData);
window.viewImage = (src, fileName) => dapp.viewImage(src, fileName);
window.downloadFile = (dataUrl, fileName, mimeType) => dapp.downloadFile(dataUrl, fileName, mimeType);
window.downloadImageFile = (src, fileName) => dapp.downloadImageFile(src, fileName);

// P2P 검색 전역 함수
window.searchContacts = (searchTerm) => dapp.searchContacts(searchTerm);
window.clearContactSearch = () => dapp.clearContactSearch();
window.searchChats = (searchTerm) => dapp.searchChats(searchTerm);
window.clearChatSearch = () => dapp.clearChatSearch();

// P2P 필터링 전역 함수
  window.filterChats = (filterType) => dapp.filterChats(filterType);
  
  // 거래내역 관련 전역 함수들
  window.filterTransactionHistory = (filterType) => dapp.filterTransactionHistory(filterType);
  window.refreshTransactionHistory = () => dapp.refreshTransactionHistory();
  window.markTransactionAsRead = (transactionId) => dapp.markTransactionAsRead(transactionId);
  window.showTransactionDetail = (transactionId) => dapp.showTransactionDetail(transactionId);
  window.repeatTransaction = (transactionId) => dapp.repeatTransaction(transactionId);


// 롱프레스 컨텍스트 메뉴 전역 함수
window.toggleBlockContact = (contactId) => dapp.toggleBlockContact(contactId);
window.deleteContact = (contactId) => dapp.deleteContact(contactId);
window.deleteChat = (chatId) => dapp.deleteChat(chatId);
window.deleteChatAndLeave = (chatId) => dapp.deleteChatAndLeave(chatId);

// DAO 생성 전역 함수
window.createDAO = () => dapp.showCreateDAOProposalModal(); // 구성원용 DAO 생성 제안
window.showCreateDAOModal = () => dapp.showCreateDAOModal(); // TOP-OP용 DAO 생성
window.closeCreateDAOModal = () => dapp.closeCreateDAOModal();
window.addNewDAODCA = () => dapp.addNewDAODCA();
window.onContributionTypeChange = (type) => dapp.onContributionTypeChange(type);
window.handleCreateDAO = (event) => dapp.handleCreateDAO(event);
window.showCreateDAOProposalModal = () => dapp.showCreateDAOProposalModal();
window.closeCreateDAOProposalModal = () => dapp.closeCreateDAOProposalModal();
window.handleCreateDAOProposal = (event) => dapp.handleCreateDAOProposal(event);
window.addProposalDCA = () => dapp.addProposalDCA();

// 알림 시스템 관련 함수들을 DApp에 추가
dapp.addDAONotification = function(daoId, type, count = 1) {
  if (!this.notifications.dao[daoId]) {
    this.notifications.dao[daoId] = { contribution: 0, participation: 0 };
  }
  
  this.notifications.dao[daoId][type] += count;
  this.updateAllNotificationBadges();
  this.saveNotifications();
  
  console.log(`🔔 DAO ${daoId}에 ${type} 알림 ${count}개 추가됨`);
};

dapp.clearDAONotification = function(daoId, type) {
  if (this.notifications.dao[daoId]) {
    this.notifications.dao[daoId][type] = 0;
    this.updateAllNotificationBadges();
    this.saveNotifications();
    
    console.log(`🔕 DAO ${daoId}의 ${type} 알림 클리어됨`);
  }
};

dapp.getTotalNotificationCount = function() {
  let total = 0;
  Object.values(this.notifications.dao).forEach(dao => {
    total += dao.contribution + dao.participation;
  });
  return total;
};

dapp.updateAllNotificationBadges = function() {
  const totalCount = this.getTotalNotificationCount();
  
  // 하단 탭 대시보드 알림 뱃지
  this.updateNotificationBadge('dashboardNotificationBadge', totalCount);
  
  // 대시보드 필터 메뉴의 소속 DAO 버튼 알림 뱃지
  this.updateNotificationBadge('daoFilterNotificationBadge', totalCount);
  
  // 소속 DAO 토글 헤더 알림 뱃지
  this.updateNotificationBadge('daoToggleNotificationBadge', totalCount);
  
  // 각 DAO 카드별 알림 뱃지 업데이트
  this.updateDAOCardNotifications();
};

dapp.updateNotificationBadge = function(elementId, count) {
  const badge = document.getElementById(elementId);
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count.toString();
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
};

dapp.updateDAOCardNotifications = function() {
  // 모든 DAO 카드에서 기존 알림 뱃지 제거 (동적으로 다시 생성되므로)
  document.querySelectorAll('.dao-card-notification').forEach(badge => {
    badge.remove();
  });
  
  // 소속 DAO 목록 다시 렌더링 (알림 포함)
  if (this.isAuthenticated) {
    this.loadMyDAOs();
    // P토큰 세부 정보도 다시 로드 (토글이 열려있으면)
    const ptokenDetails = document.getElementById('ptokenDetails');
    if (ptokenDetails && ptokenDetails.style.display !== 'none') {
      this.loadPTokenDetails();
    }
  }
};

dapp.updateDAOActivityTabNotifications = function(daoId, daoNotifications) {
  // 기여내역 탭 알림
  const contributionTab = document.querySelector(`[data-dao="${daoId}"] .contribution-tab`);
  if (contributionTab) {
    this.updateTabNotificationBadge(contributionTab, daoNotifications.contribution);
  }
  
  // 참정내역 탭 알림
  const participationTab = document.querySelector(`[data-dao="${daoId}"] .participation-tab`);
  if (participationTab) {
    this.updateTabNotificationBadge(participationTab, daoNotifications.participation);
  }
};

// DAO 세부 모달 탭 알림 업데이트 함수
dapp.updateDAODetailTabNotifications = function(daoId) {
  const daoNotifications = this.notifications?.dao?.[daoId] || { contribution: 0, participation: 0 };
  
  // 기여내역 탭 알림
  const contributionTabNotification = document.getElementById('contributionTabNotification');
  if (contributionTabNotification) {
    if (daoNotifications.contribution > 0) {
      contributionTabNotification.textContent = daoNotifications.contribution > 99 ? '99+' : daoNotifications.contribution.toString();
      contributionTabNotification.style.display = 'flex';
    } else {
      contributionTabNotification.style.display = 'none';
    }
  }
  
  // 참정내역 탭 알림
  const participationTabNotification = document.getElementById('participationTabNotification');
  if (participationTabNotification) {
    if (daoNotifications.participation > 0) {
      participationTabNotification.textContent = daoNotifications.participation > 99 ? '99+' : daoNotifications.participation.toString();
      participationTabNotification.style.display = 'flex';
    } else {
      participationTabNotification.style.display = 'none';
    }
  }
};

dapp.updateTabNotificationBadge = function(tabElement, count) {
  if (!tabElement) return;
  
  let badge = tabElement.querySelector('.notification-badge');
  if (!badge && count > 0) {
    badge = document.createElement('div');
    badge.className = 'notification-badge';
    tabElement.appendChild(badge);
  }
  
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count.toString();
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
};

dapp.saveNotifications = function() {
  localStorage.setItem('baekya_notifications', JSON.stringify(this.notifications));
};

dapp.loadNotifications = function() {
  const saved = localStorage.getItem('baekya_notifications');
  if (saved) {
    try {
      this.notifications = JSON.parse(saved);
      this.updateAllNotificationBadges();
    } catch (error) {
      console.error('알림 데이터 로드 실패:', error);
    }
  }
};

// DCA 기여 시뮬레이션 함수 (데모용)
dapp.simulateContribution = function(daoId) {
  this.addDAONotification(daoId, 'contribution', 1);
  this.showSuccessMessage(`${this.getDAOName(daoId)}에서 DCA 기여 완료! 기여내역이 업데이트되었습니다.`);
};

// 참정내역 변화 시뮬레이션 함수 (데모용)
dapp.simulateParticipationUpdate = function(daoId) {
  this.addDAONotification(daoId, 'participation', 1);
  this.showSuccessMessage(`${this.getDAOName(daoId)}에서 참정내역이 업데이트되었습니다.`);
};

// 기존 DAO 카드 클릭 시 알림 클리어
const originalOpenDAOConsortium = dapp.openDAOConsortium;
dapp.openDAOConsortium = function(daoId) {
  // 해당 DAO의 모든 알림 클리어
  this.clearDAONotification(daoId, 'contribution');
  this.clearDAONotification(daoId, 'participation');
  
  // 원래 함수 호출
  originalOpenDAOConsortium.call(this, daoId);
};

// 초기화 시 알림 로드
dapp.loadNotifications();

// 데모용 알림 생성 버튼 추가 (개발 중에만 사용)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  window.addTestNotification = function(daoId, type) {
    dapp.addDAONotification(daoId || 'dev-dao', type || 'contribution', 1);
  };
  
  // 개발용 테스트 버튼 표시
  const testButtons = document.getElementById('demoTestButtons');
  if (testButtons) {
    testButtons.style.display = 'block';
  }
  
  console.log('🔧 개발 모드: addTestNotification("dev-dao", "contribution") 함수 사용 가능');
}

// 프로필 사진 관련 메서드 추가
dapp.loadCurrentPhoto = function(previewElement) {
  if (this.currentUser && this.currentUser.profilePhoto) {
    previewElement.innerHTML = `<img src="${this.currentUser.profilePhoto}" alt="프로필 사진">`;
  } else {
    // 기본 아바타 표시
    const userName = this.currentUser?.name || '미설정';
    if (userName !== '미설정') {
      previewElement.innerHTML = '';
      previewElement.textContent = userName.charAt(0).toUpperCase();
    } else {
      previewElement.innerHTML = `<i class="fas fa-user"></i>`;
    }
  }
};

dapp.handlePhotoSelect = function(event) {
  console.log('📸 handlePhotoSelect 호출됨');
  const file = event.target.files[0];
  if (!file) {
    console.log('❌ 파일이 선택되지 않음');
    return;
  }
  console.log('📄 선택된 파일:', file.name, file.type, file.size);

  // 파일 크기 검증 (5MB)
  if (file.size > 5 * 1024 * 1024) {
    this.showErrorMessage('파일 크기는 5MB를 초과할 수 없습니다.');
    event.target.value = ''; // 파일 입력 초기화
    return;
  }

  // 파일 형식 검증
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    this.showErrorMessage('JPG, PNG, GIF 형식만 지원됩니다.');
    event.target.value = ''; // 파일 입력 초기화
    return;
  }

  // 파일 읽기
  const reader = new FileReader();
  reader.onload = (e) => {
    console.log('✅ 파일 읽기 완료');
    this.selectedPhoto = e.target.result;
    
    // 프로필 설정 모달의 미리보기 즉시 업데이트
    setTimeout(() => {
    const photoPreview = document.getElementById('photoPreview');
    if (photoPreview) {
      console.log('🖼️ 미리보기 업데이트 중...');
      photoPreview.innerHTML = `<img src="${this.selectedPhoto}" alt="선택된 사진" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        photoPreview.style.display = 'flex';
        photoPreview.style.alignItems = 'center';
        photoPreview.style.justifyContent = 'center';
      console.log('✅ 미리보기 업데이트 완료');
    } else {
      console.error('❌ photoPreview 요소를 찾을 수 없음');
        // 다시 한번 시도
        setTimeout(() => {
          const retryPreview = document.getElementById('photoPreview');
          if (retryPreview) {
            retryPreview.innerHTML = `<img src="${this.selectedPhoto}" alt="선택된 사진" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    }
        }, 100);
      }
    }, 0);
  };
  reader.onerror = (error) => {
    console.error('❌ 파일 읽기 오류:', error);
    this.showErrorMessage('파일을 읽을 수 없습니다.');
  };
  reader.readAsDataURL(file);
};

// 노드 연결 상태 모니터링 메서드들
dapp.startNodeMonitoring = function() {
  console.log('🌐 노드 연결 상태 모니터링 시작');
  
  // 초기 상태 확인
  this.checkNodeStatus();
  
  // 30초마다 상태 확인
  setInterval(() => {
    this.checkNodeStatus();
  }, 30000);
  
  // 노드 상태 UI 초기화
  this.initNodeStatusUI();
};

dapp.initNodeStatusUI = function() {
  // 노드 상태 인디케이터가 있으면 클릭 이벤트 추가
  const statusBar = document.querySelector('.decentralized-status-bar');
  if (statusBar) {
    statusBar.addEventListener('click', () => {
      this.showNodeStatusModal();
    });
    statusBar.style.cursor = 'pointer';
    statusBar.title = '클릭하여 노드 연결 설정';
  }
};

dapp.showNodeStatusModal = function() {
  // 노드 상태 모달 표시
  const modalHtml = `
    <div class="modal active" id="nodeStatusModal">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3>노드 연결 상태</h3>
          <button class="modal-close" onclick="this.closest('.modal').classList.remove('active')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="node-status-info">
            <div class="status-card">
              <h4>현재 연결 상태</h4>
              <div id="currentNodeStatus" class="status-indicator"></div>
            </div>
            <div class="status-card">
              <h4>노드 추가</h4>
              <div class="input-group">
                <input type="text" id="nodeUrlInput" placeholder="http://노드IP:포트" 
                       value="http://localhost:9080" class="form-input">
                <button onclick="dapp.addNode()" class="btn btn-primary">추가</button>
              </div>
            </div>
            <div class="status-card">
              <h4>알려진 노드 목록</h4>
              <div id="knownNodesList" class="nodes-list"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // 기존 모달 제거 후 새로 추가
  const existingModal = document.getElementById('nodeStatusModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // 현재 노드 상태 업데이트
  this.updateNodeStatusModal();
};

dapp.updateNodeStatusModal = async function() {
  try {
    const response = await fetch('/api/node-status');
    const data = await response.json();
    
    const statusElement = document.getElementById('currentNodeStatus');
    const nodesList = document.getElementById('knownNodesList');
    
    if (statusElement) {
      if (data.connected) {
        statusElement.innerHTML = `
          <div class="status-connected">
            <i class="fas fa-check-circle"></i>
            <span>연결됨: ${data.activeNode}</span>
          </div>
        `;
      } else {
        statusElement.innerHTML = `
          <div class="status-disconnected">
            <i class="fas fa-exclamation-triangle"></i>
            <span>연결 안됨</span>
          </div>
        `;
      }
    }
    
    if (nodesList) {
      const nodesHtml = data.knownNodes.map(node => `
        <div class="node-item ${node === data.activeNode ? 'active' : ''}">
          <span class="node-url">${node}</span>
          <div class="node-actions">
            ${node === data.activeNode ? '<i class="fas fa-check-circle text-success"></i>' : ''}
            <button onclick="dapp.removeNode('${node}')" class="btn-icon" title="제거">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `).join('');
      
      nodesList.innerHTML = nodesHtml || '<div class="no-nodes">등록된 노드가 없습니다</div>';
    }
  } catch (error) {
    console.error('노드 상태 모달 업데이트 실패:', error);
  }
};

dapp.addNode = async function() {
  const input = document.getElementById('nodeUrlInput');
  const nodeUrl = input.value.trim();
  
  if (!nodeUrl) {
    this.showErrorMessage('노드 URL을 입력하세요');
    return;
  }
  
  // URL 형식 검증
  try {
    new URL(nodeUrl);
  } catch (error) {
    this.showErrorMessage('올바른 URL 형식이 아닙니다');
    return;
  }
  
  try {
    const response = await fetch('/api/add-node', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nodeUrl })
    });
    
    const result = await response.json();
    
    if (result.success) {
      this.showSuccessMessage('노드가 추가되었습니다');
      input.value = '';
      this.updateNodeStatusModal();
      this.checkNodeStatus(); // 즉시 상태 재확인
    } else {
      this.showErrorMessage('노드 추가 실패');
    }
  } catch (error) {
    console.error('노드 추가 실패:', error);
    this.showErrorMessage('노드 추가 중 오류가 발생했습니다');
  }
};

dapp.removeNode = async function(nodeUrl) {
  if (confirm(`${nodeUrl} 노드를 제거하시겠습니까?`)) {
    // 실제로는 서버에 제거 요청을 보내야 하지만, 
    // 현재는 페이지 새로고침으로 임시 처리
    this.showSuccessMessage('노드가 제거되었습니다');
    this.updateNodeStatusModal();
  }
};

dapp.checkNodeStatus = async function() {
  const statusElement = document.getElementById('nodeStatus');
  if (!statusElement) return;

  try {
    const response = await fetch('/api/node-status');
    const data = await response.json();
    
    if (data.connected) {
      statusElement.textContent = `메인넷 노드 연결됨: ${new URL(data.activeNode).host}`;
      statusElement.style.color = '#ffffff';
      
      // 펄스 애니메이션을 초록색으로 유지
      const pulseIndicator = document.querySelector('.pulse-dot');
      if (pulseIndicator) {
        pulseIndicator.style.background = '#ffffff';
      }
      
      // 상태바 배경색 업데이트 (성공)
      const statusBar = document.querySelector('.decentralized-status-bar');
      if (statusBar) {
        statusBar.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
      }
    } else {
      statusElement.textContent = '경량 클라이언트 모드 - 메인넷 노드 찾는 중...';
      statusElement.style.color = '#fbbf24';
      
      // 상태바 배경색 업데이트 (경고)
      const statusBar = document.querySelector('.decentralized-status-bar');
      if (statusBar) {
        statusBar.style.background = 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)';
      }
    }
  } catch (error) {
    statusElement.textContent = '메인넷 노드 연결 실패 - 메인넷을 시작하거나 노드를 추가하세요';
    statusElement.style.color = '#ef4444';
    
    // 펄스 애니메이션을 빨간색으로 변경
    const pulseIndicator = document.querySelector('.pulse-dot');
    if (pulseIndicator) {
      pulseIndicator.style.background = '#ef4444';
    }
    
    // 상태바 배경색 업데이트 (오류)
    const statusBar = document.querySelector('.decentralized-status-bar');
    if (statusBar) {
      statusBar.style.background = 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';
    }
    
    console.error('메인넷 노드 연결 실패:', error);
  }
};

// 서비스 워커 등록 (PWA 지원)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('✅ 서비스 워커 등록 성공:', registration.scope);
      })
      .catch((error) => {
        console.log('❌ 서비스 워커 등록 실패:', error);
      });
  });
}

console.log('🚀 백야 프로토콜 DApp 로드 완료!'); 

// 개발자 콘솔용 전역 함수들
window.resetApp = () => {
  if (window.dapp && typeof window.dapp.resetAll === 'function') {
    window.dapp.resetAll();
  } else {
    console.error('DApp이 아직 로드되지 않았습니다.');
  }
};

// 다운로드 팝업 관련 함수들
function showDownloadPopup() {
  const popup = document.getElementById('downloadPopup');
  if (popup) {
    popup.style.display = 'block';
    
    // 팝업 외부 클릭 시 닫기
    popup.addEventListener('click', function(e) {
      if (e.target === popup) {
        closeDownloadPopup();
      }
    });
    
    // ESC 키로 닫기
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeDownloadPopup();
      }
    });
  }
}

function closeDownloadPopup() {
  const popup = document.getElementById('downloadPopup');
  if (popup) {
    popup.style.display = 'none';
  }
}

function downloadApk() {
  const link = document.createElement('a');
  link.href = '/baekya-protocol.apk';
  link.download = 'baekya-protocol.apk';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // 다운로드 후 팝업 닫기
  setTimeout(() => {
    closeDownloadPopup();
  }, 1000);
}

function openPlayStore() {
  // 추후 구글 플레이 스토어 출시 시 링크 업데이트
  alert('곧 구글 플레이 스토어에서 만나보실 수 있습니다!');
}

function openAppStore() {
  // 추후 앱 스토어 출시 시 링크 업데이트
  alert('곧 앱 스토어에서 만나보실 수 있습니다!');
} 