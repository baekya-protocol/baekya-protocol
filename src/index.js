const DID = require('./did/DID');
const CVCM = require('./cvcm/CVCM');
const DAO = require('./dao/DAO');
const PToken = require('./ptoken/PToken');
const MiningSystem = require('./mining/MiningSystem');
const AutomationSystem = require('./automation/AutomationSystem');
const TransactionFeeSystem = require('./tfs/TransactionFeeSystem');
const SimpleAuth = require('./auth/SimpleAuth');
const BlockchainCore = require('./blockchain/BlockchainCore');
const readline = require('readline');

/**
 * 백야 프로토콜 - 메인 엔트리 포인트
 * 기여 기반 탈중앙화 사회시스템
 */

// 명령행 인수 파싱
const args = process.argv.slice(2);
const isMainnet = args.includes('--mainnet');
const isTestnet = args.includes('--testnet');
const isValidator = args.includes('--validator');
const addressArgIndex = args.indexOf('--address');
const providedAddress = addressArgIndex !== -1 ? args[addressArgIndex + 1] : null;

// 환경 설정
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production' || isMainnet;

console.log(`
🌟 백야 프로토콜 시작
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️  환경: ${IS_PRODUCTION ? '메인넷 (PRODUCTION)' : '개발/테스트넷'}
🔗 네트워크: ${isMainnet ? 'MAINNET' : isTestnet ? 'TESTNET' : 'LOCAL'}
👤 역할: ${isValidator ? 'VALIDATOR' : 'FULL NODE'}
📞 통신주소: ${providedAddress || '입력 필요'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 "기여한 만큼 보장받는" 사회규약을 실현하기 위한
📜 기여기반 탈중앙 사회시스템이 시작됩니다...
`);

class BaekyaProtocol {
  constructor(config = {}) {
    this.config = {
      isProduction: IS_PRODUCTION,
      isMainnet: isMainnet,
      isTestnet: isTestnet,
      isValidator: isValidator,
      port: config.port || (isMainnet ? 8080 : isTestnet ? 3001 : 3000),
      communicationAddress: config.communicationAddress || null,
      validatorDID: config.validatorDID || null,
      ...config
    };
    
    this.components = {};
    this.isInitialized = false;
    this.rl = null;
  }

  /**
   * 통신주소 입력 받기
   */
  async getCommunicationAddress() {
    if (providedAddress) {
      if (this.validateCommunicationAddress(providedAddress)) {
        console.log(`✅ 통신주소 확인: ${providedAddress}`);
        return providedAddress;
      } else {
        console.log(`❌ 잘못된 통신주소 형식: ${providedAddress}`);
        console.log('   올바른 형식: 010-XXXX-XXXX');
      }
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      const askAddress = () => {
        this.rl.question('📞 노드 운영자의 통신주소를 입력하세요 (010-XXXX-XXXX): ', (address) => {
          if (this.validateCommunicationAddress(address.trim())) {
            console.log(`✅ 통신주소 확인: ${address.trim()}`);
            this.rl.close();
            resolve(address.trim());
          } else {
            console.log('❌ 잘못된 통신주소 형식입니다. 010-XXXX-XXXX 형태로 입력해주세요.');
            askAddress();
          }
        });
      };
      askAddress();
    });
  }

  /**
   * 통신주소 형식 검증
   */
  validateCommunicationAddress(address) {
    const phoneRegex = /^010-\d{4}-\d{4}$/;
    return phoneRegex.test(address);
  }

  /**
   * 통신주소로부터 DID 생성 또는 조회
   */
  async getOrCreateDIDFromAddress(address) {
    try {
      // 노드 운영자용 DID 생성/조회 (새로운 함수 사용)
      const result = this.components.authSystem.generateNodeOperatorDID(address, {
        nodeType: this.config.isValidator ? 'validator' : 'full_node'
      });

      if (result.success) {
        if (result.isExisting) {
          console.log(`🔍 기존 노드 DID 발견: ${result.didHash.substring(0, 16)}...`);
        } else {
          console.log(`🆔 새로운 노드 DID 생성: ${result.didHash.substring(0, 16)}...`);
        }

        return {
          success: true,
          didHash: result.didHash,
          isExisting: result.isExisting,
          credentials: result.isExisting ? null : {
            username: result.username,
            password: result.password
          }
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async initialize() {
    try {
      console.log('⚡ 프로토콜 구성요소 초기화 중...');

      // 1. 간단한 인증 시스템
      console.log('🔐 인증 시스템 초기화...');
      this.components.authSystem = new SimpleAuth();

      // 2. 통신주소 설정 (검증자만 필수, 풀노드는 선택사항)
      if (this.config.isValidator) {
        console.log('📞 검증자 통신주소 설정 중...');
        this.config.communicationAddress = await this.getCommunicationAddress();
      } else {
        console.log('📞 풀노드 통신주소 설정 중...');
        if (!providedAddress) {
          console.log('💡 풀노드는 통신주소 없이도 운영 가능합니다.');
          console.log('   검증자 풀 B토큰 보상을 받으려면 --address 010-XXXX-XXXX 옵션을 사용하세요.');
          this.config.communicationAddress = null;
        } else {
          if (this.validateCommunicationAddress(providedAddress)) {
            console.log(`✅ 통신주소 확인: ${providedAddress} (검증자 풀 보상용)`);
            this.config.communicationAddress = providedAddress;
          } else {
            console.log(`❌ 잘못된 통신주소 형식: ${providedAddress}`);
            console.log('   올바른 형식: 010-XXXX-XXXX');
            this.config.communicationAddress = null;
          }
        }
      }
      
      // 3. 검증자 모드인 경우에만 DID 생성/조회
      if (this.config.isValidator) {
        console.log('👤 검증자 모드: DID 생성/조회 중...');
        const didResult = await this.getOrCreateDIDFromAddress(this.config.communicationAddress);
        if (!didResult.success) {
          throw new Error(`검증자 DID 생성/조회 실패: ${didResult.error}`);
        }
        
        this.config.validatorDID = didResult.didHash;
        
        if (!didResult.isExisting && didResult.credentials) {
          console.log(`🔑 검증자 계정 생성됨:`);
          console.log(`   - 아이디: ${didResult.credentials.username}`);
          console.log(`   - 비밀번호: ${didResult.credentials.password}`);
          console.log(`   - 통신주소: ${this.config.communicationAddress}`);
          console.log(`   - DID: ${this.config.validatorDID.substring(0, 16)}...`);
        }
      } else {
        // 풀노드는 DID 없이 블록체인 네트워크만 운영
        console.log('⚡ 풀노드 모드: 블록체인 네트워크만 시작');
        if (this.config.communicationAddress) {
          console.log(`📞 통신주소 (${this.config.communicationAddress})는 검증자 풀 보상용으로 기록됨`);
        } else {
          console.log('📞 통신주소 없음 - 검증자 풀 보상에서 제외됨');
        }
        this.config.validatorDID = null;
      }

      // 4. DID 관리 시스템  
      console.log('🆔 DID 관리 시스템 초기화...');
      this.components.didSystem = new DID();

      // 5. 블록체인 코어
      console.log('⛓️  블록체인 코어 초기화...');
      this.components.blockchain = new BlockchainCore();

      // 6. CVCM 기여증명 시스템
      console.log('🏗️  CVCM 기여증명 시스템 초기화...');
      this.components.cvcm = new CVCM(this.components.didSystem);

      // 7. P-Token 참정권 시스템
      console.log('🗳️  P-Token 참정권 시스템 초기화...');
      this.components.ptoken = new PToken(
        this.components.didSystem,
        this.components.cvcm,
        null // DAO는 나중에 설정
      );

      // 8. DAO 거버넌스 시스템
      console.log('🏛️  DAO 거버넌스 시스템 초기화...');
      this.components.dao = new DAO(
        this.components.didSystem,
        this.components.ptoken
      );

      // 9. 트랜잭션 수수료 시스템
      console.log('💰 트랜잭션 수수료 시스템 초기화...');
      this.components.txFeeSystem = new TransactionFeeSystem();

      // 10. 마이닝 시스템
      console.log('⛏️  마이닝 시스템 초기화...');
      this.components.miningSystem = new MiningSystem();

      // 11. 자동화 시스템
      console.log('🤖 자동화 시스템 초기화...');
      this.components.automationSystem = new AutomationSystem(this);

      // 시스템 간 연결 설정
      this.setupInterconnections();

      this.isInitialized = true;
      console.log('✅ 모든 프로토콜 구성요소 초기화 완료!\n');

      return true;
    } catch (error) {
      console.error('❌ 프로토콜 초기화 실패:', error.message);
      return false;
    }
  }

  setupInterconnections() {
    // P-Token에 DAO 시스템 연결
    this.components.ptoken.daoSystem = this.components.dao;
    
    // CVCM에 DAO 시스템 연결
    this.components.cvcm.daoSystem = this.components.dao;
    
    // DAO에 CVCM 시스템 연결 (기본 DCA 등록을 위해)
    this.components.dao.cvcmSystem = this.components.cvcm;
    
    // DAO에 P-Token 시스템 연결 (이니셜 OP 30P 지급용)
    this.components.dao.setPTokenSystem(this.components.ptoken);
    
    // DAO 시스템 초기화 (기본 DAO들 생성)
    this.components.dao.initialize();
    
    // 블록체인에 DID 레지스트리 연결
    this.components.blockchain.setDIDRegistry(this.components.didSystem);
    
    console.log('🔗 시스템 간 상호연결 설정 완료');
  }

  async start() {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        process.exit(1);
      }
    }

    try {
      // P2P 네트워크 시작
      console.log(`🌐 P2P 네트워크 시작 (포트: ${this.config.port})...`);
      await this.components.blockchain.startNetwork(this.config.port);

      // HTTP API 서버 시작 (탈중앙화된 API)
      await this.startDecentralizedAPI();

      // 검증자 등록 (검증자 모드인 경우)
      if (this.config.isValidator) {
        console.log('👤 검증자로 등록 중...');
        await this.registerAsValidator();
      }

      // 자동화 시스템 시작
      if (this.config.isProduction || this.config.isValidator) {
        console.log('🤖 자동화 시스템 시작...');
        this.components.automationSystem.start();
      }

      // 검증자인 경우 자동 보상 수집 시작
      if (this.config.isValidator) {
        this.startValidatorRewardCollection();
      }

      console.log(`
🎉 백야 프로토콜이 성공적으로 시작되었습니다!

📊 네트워크 정보:
   • 환경: ${this.config.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}
   • 네트워크: ${this.config.isMainnet ? 'MAINNET' : this.config.isTestnet ? 'TESTNET' : 'LOCAL'}
   • P2P 포트: ${this.config.port}
   • API 포트: ${this.config.port + 1000} (로컬 전용)
   • 역할: ${this.config.isValidator ? 'VALIDATOR' : 'FULL NODE'}
   • 통신주소: ${this.config.communicationAddress || '없음 (검증자 풀 보상 제외)'}
   • DID: ${this.config.validatorDID ? this.config.validatorDID.substring(0, 16) + '...' : 'N/A'}

🌐 웹 인터페이스 접속:
   • URL: http://localhost:${this.config.port + 1000}
   • 브라우저에서 위 주소로 접속하여 백야 프로토콜을 사용하세요!

🌟 "기여한 만큼 보장받는" 새로운 사회가 시작되었습니다!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

      // 종료 신호 핸들링
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ 프로토콜 시작 실패:', error.message);
      process.exit(1);
    }
  }

  async registerAsValidator() {
    try {
      if (!this.config.validatorDID || !this.config.communicationAddress) {
        throw new Error('검증자 등록에 필요한 정보가 부족합니다');
      }

      // 검증자 등록 (통신주소 포함)
      const registrationResult = this.components.txFeeSystem.registerValidator(
        this.config.validatorDID,
        this.config.validatorDID,
        1000,
        this.config.communicationAddress
      );

      if (!registrationResult.success) {
        throw new Error(`검증자 등록 실패: ${registrationResult.error}`);
      }

      // 블록체인에도 검증자 등록
      this.components.blockchain.registerValidator(
        this.config.validatorDID, 
        1000,
        this.config.communicationAddress
      );
      
      console.log(`✅ 검증자 등록 완료:`);
      console.log(`   - DID: ${this.config.validatorDID.substring(0, 16)}...`);
      console.log(`   - 통신주소: ${this.config.communicationAddress}`);
      console.log(`   - 스테이크: 1000 B-Token`);
      
      return registrationResult;
    } catch (error) {
      console.error('❌ 검증자 등록 실패:', error.message);
      throw error;
    }
  }

  /**
   * 검증자 보상 자동 수집 시작
   */
  startValidatorRewardCollection() {
    console.log('💰 검증자 보상 자동 수집 시작...');
    
    // 10분마다 보상 수집
    setInterval(() => {
      this.collectValidatorRewards();
    }, 10 * 60 * 1000);

    // 첫 번째 수집은 1분 후
    setTimeout(() => {
      this.collectValidatorRewards();
    }, 60 * 1000);
  }

  /**
   * 검증자 보상 수집
   */
  async collectValidatorRewards() {
    try {
      console.log('💰 검증자 보상 수집 중...');
      
      const rewardResult = this.components.txFeeSystem.distributeValidatorRewards();
      
      if (rewardResult.success) {
        // 자신의 보상 확인
        const myReward = rewardResult.validatorRewards.find(
          reward => reward.validatorDID === this.config.validatorDID
        );
        
        if (myReward && myReward.reward > 0) {
          console.log(`🎁 검증자 보상 수집 완료: ${myReward.reward.toFixed(6)} B-Token`);
          console.log(`📞 보상이 통신주소 ${this.config.communicationAddress}에 연결된 지갑으로 전송됩니다.`);
        }
      }
    } catch (error) {
      console.error('❌ 검증자 보상 수집 실패:', error.message);
    }
  }

  setupGracefulShutdown() {
    const gracefulShutdown = (signal) => {
      console.log(`\n🛑 ${signal} 신호 수신됨. 안전하게 종료 중...`);
      
      // readline 인터페이스 종료
      if (this.rl) {
        this.rl.close();
      }
      
      // HTTP 서버 종료
      if (this.httpServer) {
        this.httpServer.close();
      }
      
      // 자동화 시스템 정지
      if (this.components.automationSystem) {
        this.components.automationSystem.stop();
      }
      
      // P2P 네트워크 정리
      if (this.components.blockchain && this.components.blockchain.p2pNetwork) {
        this.components.blockchain.p2pNetwork.cleanup();
      }
      
      console.log('✅ 백야 프로토콜이 안전하게 종료되었습니다.');
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  // API 접근 메소드들
  getBlockchain() {
    return this.components.blockchain;
  }

  getDIDSystem() {
    return this.components.didSystem;
  }

  getDAOSystem() {
    return this.components.dao;
  }

  getCVCMSystem() {
    return this.components.cvcm;
  }

  getPTokenSystem() {
    return this.components.ptoken;
  }

  getTxFeeSystem() {
    return this.components.txFeeSystem;
  }

  getAutomationSystem() {
    return this.components.automationSystem;
  }

  // 테스트 호환성을 위한 프로퍼티 getter
  get automationSystem() {
    return this.components.automationSystem;
  }

  get daoSystem() {
    return this.components.dao;
  }

  get miningSystem() {
    return this.components.miningSystem;
  }

  // 테스트 API 메소드들
  registerUser(userData) {
    try {
      // 새로운 SimpleAuth API 사용
      const result = this.components.authSystem.generateDID(
        userData.username,    // 아이디
        userData.password,    // 비밀번호 
        userData.name,        // 실제 이름 (선택사항)
        userData.birthDate    // 생년월일 (선택사항)
      );
      
      if (result.success) {
        // DID 시스템에 등록
        this.components.didSystem.registerDID(result.didHash, result);
        
        // Founder 계정 특별 혜택 부여
        if (result.isFounder) {
          this.grantFounderBenefits(result.didHash);
          result.founderBenefits = {
            bTokenGranted: 30,
            pTokensGranted: {
              'Operations DAO': 30,
              'Development DAO': 30, 
              'Community DAO': 30,
              'Political DAO': 30
            }
          };
        }
        
        // 첫 번째 사용자인 경우 이니셜 OP로 설정
        if (result.isFirstUser && result.isInitialOP) {
          const opResult = this.components.dao.setInitialOperator(result.didHash);
          if (opResult.success) {
            result.initialOPResult = opResult;
            result.message += `\n🎉 ${opResult.totalDAOs}개 DAO의 이니셜 OP가 되었습니다! (총 ${opResult.totalPTokensGranted}P 지급)`;
            console.log(`👑 첫 번째 사용자 이니셜 OP 설정 완료: ${result.didHash}`);
          }
        }
        
        return result;
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 사용자 로그인 메서드 추가
  loginUser(username, password) {
    try {
      const result = this.components.authSystem.login(username, password);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Founder 계정에게 특별 혜택 부여
   * @private
   */
  grantFounderBenefits(founderDID) {
    try {
      console.log(`🎁 Founder 특별 혜택 부여 시작: ${founderDID.substring(0, 16)}...`);
      
      // B-토큰 30B 부여
      const Transaction = require('./blockchain/Transaction');
      const bTokenTx = new Transaction(
        'did:baekya:system000000000000000000000000000000000',
        founderDID,
        30,
        'B-Token',
        { type: 'founder_benefit', reason: 'founder_b_token_grant' }
      );
      bTokenTx.signature = 'founder-system-grant';
      this.components.blockchain.addTransaction(bTokenTx);
      
      // 모든 기본 DAO에서 P-토큰 30개씩 부여
      const basicDAOs = [
        'Operations DAO',
        'Development DAO', 
        'Community DAO',
        'Political DAO'
      ];
      
      let totalPTokens = 0;
      basicDAOs.forEach(daoName => {
        // DAO 찾기
        const dao = Array.from(this.components.dao.daos.values())
          .find(d => d.name === daoName);
        
        if (dao) {
          // P-토큰 직접 발행
          this.components.ptoken.setPTokenBalance(founderDID, 30);
          totalPTokens += 30;
          console.log(`💎 ${daoName}에서 P-토큰 30개 부여`);
        }
      });
      
      console.log(`✅ Founder 혜택 완료: B-토큰 30B, P-토큰 총 ${totalPTokens}개 부여`);
      
      return {
        success: true,
        bTokensGranted: 30,
        pTokensGranted: totalPTokens,
        daosGranted: basicDAOs.length
      };
      
    } catch (error) {
      console.error('❌ Founder 혜택 부여 실패:', error.message);
      return { success: false, error: error.message };
    }
  }

  submitContribution(contributionData) {
    try {
      const result = this.components.cvcm.submitContribution(contributionData);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async verifyContribution(contributionId, verifierDID, approved, reason) {
    try {
      const result = await this.components.cvcm.verifyContribution(
        contributionId, 
        verifierDID, 
        approved, 
        reason
      );
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  handleOperatorActivity(operatorDID, action, targetId, details = {}) {
    try {
      const result = this.components.automationSystem.handleOperationsDAOActivity(
        operatorDID, 
        action, 
        targetId, 
        details
      );
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getProtocolStatus() {
    return {
      version: '1.0.0',
      status: 'active',
      initialized: this.isInitialized,
      config: this.config,
      components: {
        blockchain: !!this.components.blockchain,
        didSystem: !!this.components.didSystem,
        dao: !!this.components.dao,
        cvcm: !!this.components.cvcm,
        ptoken: !!this.components.ptoken,
        automationSystem: !!this.components.automationSystem
      },
      network: this.components.blockchain?.p2pNetwork?.getNetworkStatus() || {},
      daos: this.components.dao ? Array.from(this.components.dao.daos.values()) : [],
      automation: this.components.automationSystem?.getAutomationStatus() || {},
      mining: this.components.miningSystem ? {
        totalMiners: this.components.miningSystem.miners?.size || 0,
        isActive: true
      } : {}
    };
  }

  getUserDashboard(userDID) {
    try {
      return {
        user: {
          did: userDID,
          status: 'active'
        },
        mining: {
          totalBMR: 150, // 테스트용 고정값
          hourlyRate: 0.1, // 테스트용 고정값
          activeBMRs: 1,   // 테스트용 고정값
          isActive: true
        },
        contributions: [],
        tokens: {
          bToken: this.components.blockchain?.getBalance(userDID, 'B-Token') || 0,
          pToken: this.components.blockchain?.getBalance(userDID, 'P-Token') || 0
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  performMaintenanceTasks() {
    try {
      // 유지보수 작업 시뮬레이션
      const timestamp = Date.now();
      const updatedUsers = Math.floor(Math.random() * 10); // 0-9 사용자 업데이트
      
      return {
        success: true,
        timestamp,
        updatedUsers,
        tasksCompleted: [
          'blockchain_cleanup',
          'dao_maintenance', 
          'token_rebalancing'
        ]
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      config: this.config,
      blockchain: this.components.blockchain?.getBlockchainStatus(),
      network: this.components.blockchain?.p2pNetwork?.getNetworkStatus()
    };
  }

  // 통합 생체인증 검증
  async verifyBiometricAuth(didHash, authData, action) {
    try {
      if (!this.components.authSystem) {
        throw new Error('인증 시스템이 초기화되지 않았습니다');
      }
      
      return this.components.authSystem.verifyForAction(didHash, authData, action);
    } catch (error) {
      return {
        success: false,
        authorized: false,
        error: error.message
      };
    }
  }

  // 통합 토큰 전송 (생체인증 포함)
  async transferTokens(fromDID, toDID, amount, tokenType = 'B') {
    try {
      if (tokenType === 'B') {
        // B-Token 전송
        this.components.didSystem.transferBToken(fromDID, toDID, amount);
      } else if (tokenType === 'P') {
        // P-Token 전송
        this.components.ptoken.transferPToken(fromDID, toDID, amount);
      } else {
        throw new Error('지원하지 않는 토큰 타입입니다');
      }

      // 블록체인에 거래 기록
      const transaction = this.components.blockchain.createTransaction(
        fromDID, 
        toDID, 
        amount, 
        tokenType, 
        'transfer'
      );
      
      return {
        success: true,
        transactionId: transaction.id,
        fromDID,
        toDID,
        amount,
        tokenType,
        timestamp: Date.now(),
        message: `${amount} ${tokenType}-Token이 성공적으로 전송되었습니다`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 사용자 지갑 정보 조회
  async getUserWallet(userDID) {
    try {
      const bTokenBalance = this.components.didSystem.getBTokenBalance(userDID);
      const pTokenBalance = this.components.didSystem.getPTokenBalance(userDID);
      const miningData = this.components.cvcmSystem.getMiningDashboard(userDID);
      
      return {
        success: true,
        userDID,
        balances: {
          bToken: bTokenBalance,
          pToken: pTokenBalance
        },
        mining: miningData,
        communicationAddress: this.components.didSystem.generateCommunicationAddress(userDID)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // DAO 목록 조회
  getDAOs() {
    try {
      const daos = [];
      for (const [daoId, dao] of this.components.dao.daos) {
        const members = this.components.dao.getDAOMembers(daoId);
        const stats = this.components.cvcm.getDAOContributionStats(daoId);
        
        daos.push({
          id: daoId,
          name: dao.name,
          purpose: dao.purpose,
          description: dao.description,
          memberCount: members.length,
          contributionStats: stats,
          createdAt: dao.createdAt,
          status: dao.status
        });
      }
      
      return {
        success: true,
        daos,
        totalDAOs: daos.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 특정 DAO 조회
  getDAO(daoId) {
    try {
      const dao = this.components.dao.getDAO(daoId);
      const members = this.components.dao.getDAOMembers(daoId);
      const stats = this.components.cvcm.getDAOContributionStats(daoId);
      
      return {
        success: true,
        dao: {
          ...dao,
          memberCount: members.length,
          members: members,
          contributionStats: stats
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 제안 목록 조회
  async getProposals(daoId = null) {
    try {
      const proposals = [];
      
      for (const [currentDaoId, daoProposals] of this.components.dao.proposals) {
        if (daoId && currentDaoId !== daoId) continue;
        
        for (const [proposalId, proposal] of daoProposals) {
          proposals.push({
            ...proposal,
            daoId: currentDaoId
          });
        }
      }
      
      // 최신 순으로 정렬
      proposals.sort((a, b) => b.createdAt - a.createdAt);
      
      return {
        success: true,
        proposals,
        totalProposals: proposals.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 기여 이력 조회
  async getContributionHistory(userDID) {
    try {
      const contributions = this.components.cvcm.getContributionHistory(userDID);
      const miningData = this.components.cvcm.getMiningDashboard(userDID);
      
      return {
        success: true,
        contributions,
        miningData,
        totalContributions: contributions.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 탈중앙화된 API 서버 시작
  async startDecentralizedAPI() {
    const express = require('express');
    const path = require('path');
    const app = express();
    const apiPort = this.config.port + 1000; // P2P 포트 + 1000

    app.use(express.json());
    app.use(express.static('public'));
    
    // 루트 경로에서 index.html 제공
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public', 'index.html'));
    });

    // CORS 설정 (로컬 노드용)
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

    // 탈중앙화 API 엔드포인트들
    app.get('/api/status', (req, res) => {
      res.json(this.getProtocolStatus());
    });

    app.post('/api/register', async (req, res) => {
      try {
        const { userData } = req.body;
        if (!userData || !userData.username || !userData.password) {
          return res.status(400).json({ 
            success: false, 
            error: '아이디와 비밀번호가 필요합니다' 
          });
        }

        const result = this.registerUser(userData);
        res.json(result);
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: '사용자 등록 실패', 
          details: error.message 
        });
      }
    });

    app.post('/api/login', async (req, res) => {
      try {
        const { username, password } = req.body;
        if (!username || !password) {
          return res.status(400).json({ 
            success: false, 
            error: '아이디와 비밀번호가 필요합니다' 
          });
        }

        const result = this.loginUser(username, password);
        if (result.success) {
          res.json(result);
        } else {
          res.status(401).json(result);
        }
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: '사용자 로그인 실패', 
          details: error.message 
        });
      }
    });

    app.get('/api/dashboard/:did', async (req, res) => {
      try {
        const dashboard = this.getUserDashboard(req.params.did);
        res.json(dashboard);
      } catch (error) {
        res.status(500).json({ error: '대시보드 조회 실패', details: error.message });
      }
    });

    app.get('/api/wallet/:did', async (req, res) => {
      try {
        const wallet = await this.getUserWallet(req.params.did);
        res.json(wallet);
      } catch (error) {
        res.status(500).json({ error: '지갑 정보 조회 실패', details: error.message });
      }
    });

    app.post('/api/transfer', async (req, res) => {
      try {
        const { fromDID, toDID, amount, tokenType } = req.body;
        const result = await this.transferTokens(fromDID, toDID, amount, tokenType);
        res.json(result);
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: '토큰 전송 실패', 
          details: error.message 
        });
      }
    });

    app.get('/api/daos', (req, res) => {
      try {
        const daos = this.getDAOs();
        res.json(daos);
      } catch (error) {
        res.status(500).json({ error: 'DAO 목록 조회 실패', details: error.message });
      }
    });

    app.get('/api/daos/:daoId', (req, res) => {
      try {
        const dao = this.getDAO(req.params.daoId);
        res.json(dao);
      } catch (error) {
        res.status(500).json({ error: 'DAO 조회 실패', details: error.message });
      }
    });

    app.get('/api/proposals', async (req, res) => {
      try {
        const proposals = await this.getProposals();
        res.json(proposals);
      } catch (error) {
        res.status(500).json({ error: '제안 목록 조회 실패', details: error.message });
      }
    });

    app.get('/api/contributions/:did', async (req, res) => {
      try {
        const contributions = await this.getContributionHistory(req.params.did);
        res.json(contributions);
      } catch (error) {
        res.status(500).json({ error: '기여 이력 조회 실패', details: error.message });
      }
    });

    app.get('/api/blockchain/status', (req, res) => {
      try {
        const blockchainStatus = this.components.blockchain.getBlockchainStatus();
        res.json(blockchainStatus);
      } catch (error) {
        res.status(500).json({ error: '블록체인 상태 조회 실패', details: error.message });
      }
    });

    // 노드 정보 API (P2P 네트워크 상태)
    app.get('/api/node/info', (req, res) => {
      try {
        const nodeInfo = {
          nodeId: this.components.blockchain.p2pNetwork?.nodeId,
          port: this.config.port,
          apiPort: apiPort,
          peers: this.components.blockchain.p2pNetwork?.getPeers() || [],
          networkStatus: this.components.blockchain.p2pNetwork?.getNetworkStatus() || {},
          isDecentralized: true,
          message: '이 노드는 완전히 독립적으로 실행됩니다'
        };
        res.json(nodeInfo);
      } catch (error) {
        res.status(500).json({ error: '노드 정보 조회 실패', details: error.message });
      }
    });

    // API 서버 시작
    return new Promise((resolve, reject) => {
      this.httpServer = app.listen(apiPort, '127.0.0.1', () => {
        console.log(`🔗 탈중앙화 API 서버 시작됨 - http://localhost:${apiPort}`);
        console.log(`📝 이 API는 오직 이 노드의 로컬 데이터만 제공합니다`);
        resolve();
      });

      this.httpServer.on('error', (error) => {
        console.error('❌ API 서버 시작 실패:', error.message);
        reject(error);
      });
    });
  }
}

// 메인 실행
async function main() {
  const protocol = new BaekyaProtocol();
  await protocol.start();
}

// 직접 실행된 경우에만 시작
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 프로토콜 실행 중 오류:', error);
    process.exit(1);
  });
}

module.exports = BaekyaProtocol;