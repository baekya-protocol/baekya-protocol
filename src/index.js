const DID = require('./did/DID');
const DAO = require('./dao/DAO');
const MiningSystem = require('./mining/MiningSystem');
const AutomationSystem = require('./automation/AutomationSystem');
const TransactionFeeSystem = require('./tfs/TransactionFeeSystem');
const SimpleAuth = require('./auth/SimpleAuth');
const BlockchainCore = require('./blockchain/BlockchainCore');
const DataStorage = require('./storage/DataStorage');
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
⚔️  BROTHERHOOD VALIDATOR START
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

      // 0. 데이터 영구 저장소 초기화
      console.log('💾 데이터 영구 저장소 초기화...');
      this.components.storage = new DataStorage();

      // 서버 시작 시 검증자 풀과 DAO 금고 초기화
      console.log('🔄 검증자 풀 및 DAO 금고 초기화...');
      this.components.storage.resetValidatorPool();
      this.components.storage.resetDAOTreasuries();

      // 1. 간단한 인증 시스템
      console.log('🔐 인증 시스템 초기화...');
      this.components.authSystem = new SimpleAuth();
      
      // SimpleAuth에 DataStorage 연결
      this.components.authSystem.setDataStorage(this.components.storage);
      
      // 저장된 사용자 정보 로드
      const storedUsers = this.components.storage.data.users || {};
      for (const [didHash, userInfo] of Object.entries(storedUsers)) {
        if (userInfo.communicationAddress) {
          const didInfo = this.components.authSystem.getDIDInfo(didHash);
          if (didInfo.success) {
            // 저장된 통신주소로 업데이트
            const updateResult = this.components.authSystem.updateCommunicationAddress(
              didHash, 
              userInfo.communicationAddress
            );
            if (updateResult.success) {
              console.log(`📱 사용자 통신주소 복원: ${didHash.substring(0, 16)}... → ${userInfo.communicationAddress}`);
            }
          }
        }
      }

      // 2. 통신주소 설정 (웹 테스트 모드에서는 건너뛰기)
      if (this.config.isWebTest) {
        console.log('🌐 웹 테스트 모드: 통신주소 입력 건너뛰기');
        this.config.communicationAddress = this.config.communicationAddress || '010-0000-0000';
      } else if (this.config.isValidator) {
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
      
      // 3. 검증자 모드이거나 웹 테스트 모드인 경우에만 DID 생성/조회
      if (this.config.isValidator || this.config.isWebTest) {
        if (this.config.isWebTest) {
          console.log('🌐 웹 테스트 모드: 기본 DID 생성 건너뛰기');
          this.config.validatorDID = null;
        } else {
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
      
      // 블록체인에 영구 저장소 연결
      this.components.blockchain.setDataStorage(this.components.storage);

      // 6. DAO 거버넌스 시스템
      console.log('🏛️  DAO 거버넌스 시스템 초기화...');
      this.components.dao = new DAO(
        this.components.didSystem,
        null, // P-Token 시스템 제거됨
        this.components.storage
      );

      // 7. 트랜잭션 수수료 시스템
      console.log('💰 트랜잭션 수수료 시스템 초기화...');
      this.components.txFeeSystem = new TransactionFeeSystem();

      // 8. 마이닝 시스템
      console.log('⛏️  마이닝 시스템 초기화...');
      this.components.miningSystem = new MiningSystem();

      // 9. 자동화 시스템
      console.log('🤖 자동화 시스템 초기화...');
      this.components.automationSystem = new AutomationSystem(this);

      // 시스템 간 연결 설정
      this.setupInterconnections();
      
      // Founder 계정 초기 설정
      await this.initializeFounderAccount();

      this.isInitialized = true;
      console.log('✅ 모든 프로토콜 구성요소 초기화 완료!\n');

      return true;
    } catch (error) {
      console.error('❌ 프로토콜 초기화 실패:', error.message);
      return false;
    }
  }

  setupInterconnections() {
    // DAO 시스템 초기화 (기본 DAO들 생성)
    this.components.dao.initialize();
    
    // 블록체인에 DID 레지스트리 연결
    this.components.blockchain.setDIDRegistry(this.components.didSystem);
    
    console.log('🔗 시스템 간 상호연결 설정 완료 (P-Token 제거됨)');
  }

  /**
   * Founder 계정 초기 설정
   * 서버 시작 시 자동으로 founder 계정을 생성하고 모든 권한과 토큰을 부여
   */
  async initializeFounderAccount() {
    try {
      console.log('👑 Founder 계정 초기 설정 중...');
      
      // founder 계정이 이미 있는지 확인
      const existingFounder = this.components.authSystem.getDIDByUsername('founder');
      
      if (existingFounder.success) {
        console.log('✅ Founder 계정이 이미 존재합니다:', existingFounder.didHash.substring(0, 16) + '...');
        return;
      }
      
      // founder 계정 생성
      console.log('🔨 Founder 계정 생성 중...');
      const founderData = {
        username: 'founder',
        password: 'Founder123!', // 영문 대소문자와 숫자, 특수문자 포함
        name: 'Protocol Founder'
      };
      
      const result = this.components.authSystem.generateDID(
        founderData.username,
        founderData.password,
        founderData.name
      );
      
      if (!result.success) {
        console.error('❌ Founder 계정 생성 실패:', result.error);
        return;
      }
      
      const founderDID = result.didHash;
      console.log('✅ Founder 계정 생성 완료:', founderDID.substring(0, 16) + '...');
      
      // DID 시스템에 등록
      this.components.didSystem.registerDID(founderDID, result);
      
      // 4개 기본 DAO의 OP로 설정
      const defaultDAOs = ['Operations DAO', 'Community DAO', 'Political DAO'];
      
      for (const daoName of defaultDAOs) {
        const dao = Array.from(this.components.dao.daos.values())
          .find(d => d.name === daoName);
          
        if (dao) {
          // OP로 설정
          dao.operatorDID = founderDID;
          dao.founderDID = founderDID;
          
          // DAO 구성원으로 추가
          const members = this.components.dao.daoMembers.get(dao.id);
          members.add(founderDID);
          
          console.log(`  ✅ ${daoName} OP 설정 완료`);
        }
      }
      
      // 시스템 검증자 등록 (초기 블록 마이닝용)
      const systemValidatorDID = 'did:baekya:system_validator_000000000000000000000000';
      this.components.blockchain.registerValidator(systemValidatorDID, 1000);
      
      // B-토큰 잔액 확인 (중복 지급 방지)
      const currentBTokenBalance = this.components.blockchain.getBalance(founderDID, 'B-Token');
      
      if (currentBTokenBalance === 0) {
        // B-Token 30개 부여 (서버 시작 시 한 번만)
        console.log('💰 Founder 계정에 초기 B-토큰 30B 지급 중...');
      const Transaction = require('./blockchain/Transaction');
      const bTokenTx = new Transaction(
        'did:baekya:system000000000000000000000000000000000',
        founderDID,
        30,
        'B-Token',
        { type: 'founder_initial', reason: 'founder_account_creation' }
      );
      bTokenTx.signature = 'founder-initial-grant';
      this.components.blockchain.addTransaction(bTokenTx);
      
        // 즉시 블록 생성하여 토큰 반영 (시스템 검증자 사용)
        const bTokenBlock = this.components.blockchain.mineBlock([bTokenTx], systemValidatorDID);
        if (bTokenBlock && !bTokenBlock.error) {
          console.log(`💎 Founder B-토큰 블록 생성: #${bTokenBlock.index || '?'}`);
        } else {
          console.error('❌ Founder B-토큰 블록 생성 실패:', bTokenBlock?.error || '알 수 없는 오류');
        }
      } else {
        console.log(`⚠️  Founder 계정은 이미 B-토큰을 보유하고 있습니다 (${currentBTokenBalance}B).`);
      }
      
      console.log(`
👑 Founder 계정 초기 설정 완료!
   • 아이디: founder
   • 비밀번호: Founder123!
   • DID: ${founderDID.substring(0, 16)}...
   • B-Token: 30B
   • 역할: 4개 기본 DAO의 Operator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
      
    } catch (error) {
      console.error('❌ Founder 계정 초기 설정 실패:', error.message);
    }
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
   • 메인 API 포트: ${this.config.port + 1000}
   • 경량 클라이언트 포트: 3000 (통합)
   • 역할: ${this.config.isValidator ? 'VALIDATOR' : 'FULL NODE'}
   • 통신주소: ${this.config.communicationAddress || '없음 (검증자 풀 보상 제외)'}
   • DID: ${this.config.validatorDID ? this.config.validatorDID.substring(0, 16) + '...' : 'N/A'}

🌐 웹 인터페이스 접속:
   • 직접 연결: http://localhost:${this.config.port + 1000}
   • 경량 클라이언트: http://localhost:3000 (폰 접속용)
   • 폰에서 접속: http://[PC의 IP주소]:3000
   
💡 이제 하나의 메인넷 서버로 모든 기능을 제공합니다!

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
        console.log('🔗 메인 API 서버 종료됨');
      }
      
      // 모바일 서버 종료
      if (this.mobileServer) {
        this.mobileServer.close();
        console.log('📱 경량 클라이언트 서버 종료됨');
      }
      
      // 자동화 시스템 정지
      if (this.components.automationSystem) {
        this.components.automationSystem.stop();
      }
      
      // P2P 네트워크 종료
      if (this.components.blockchain && this.components.blockchain.p2pNetwork) {
        this.components.blockchain.p2pNetwork.stop();
      }
      
      console.log('✅ 모든 서비스가 안전하게 종료되었습니다');
      process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGQUIT', gracefulShutdown);

    // Windows용 CTRL+C 처리
    if (process.platform === 'win32') {
      require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      }).on('SIGINT', () => {
        gracefulShutdown('SIGINT');
      });
    }
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

  // CVCM 시스템 제거됨
  // P-Token 시스템 제거됨

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
        userData.name         // 실제 이름 (선택사항)
      );
      
      if (result.success) {
        // DID 시스템에 등록
        this.components.didSystem.registerDID(result.didHash, result);
        
        // 영구 저장소에 사용자 데이터 저장
        this.components.storage.saveUser(result.didHash, {
          didHash: result.didHash,
          username: result.username,
          name: result.name,
          communicationAddress: result.communicationAddress,
          createdAt: Date.now()
        });
        
        // Founder 계정 특별 혜택 부여
        if (result.isFounder) {
          this.grantFounderBenefits(result.didHash);
          result.founderBenefits = {
            bTokenGranted: 30
          };
        }
        
        // 첫 번째 사용자인 경우 이니셜 OP로 설정
        if (result.isFirstUser && result.isInitialOP) {
          const opResult = this.components.dao.setInitialOperator(result.didHash);
          if (opResult.success) {
            result.initialOPResult = opResult;
            result.message += `\n🎉 ${opResult.totalDAOs}개 DAO의 이니셜 OP가 되었습니다!`;
            console.log(`👑 첫 번째 사용자 이니셜 OP 설정 완료: ${result.didHash}`);
          }
        }
        
        // Founder 계정인 경우에도 이니셜 OP로 설정
        if (result.isFounder && !result.isFirstUser) {
          const opResult = this.components.dao.setInitialOperator(result.didHash);
          if (opResult.success) {
            result.initialOPResult = opResult;
            result.message += `\n🎉 Founder로서 ${opResult.totalDAOs}개 DAO의 이니셜 OP가 되었습니다!`;
            console.log(`👑 Founder 이니셜 OP 설정 완료: ${result.didHash}`);
          }
        }
        
        return result;
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 아이디 중복 확인
   * @param {string} userId - 확인할 아이디
   * @returns {boolean} 중복 여부
   */
  checkUserIdExists(userId) {
    try {
      return this.components.authSystem.checkUserIdExists(userId);
    } catch (error) {
      console.error('아이디 중복 확인 실패:', error);
      return false;
    }
  }

  // 사용자 로그인 메서드 추가
  loginUser(username, password, deviceId = null) {
    try {
      const result = this.components.authSystem.login(username, password);
      
      if (result.success) {
        // 세션 생성 (기존 세션은 자동 종료됨)
        if (deviceId) {
          const sessionId = this.components.storage.createSession(result.didHash, deviceId);
          result.sessionId = sessionId;
          
          // 다른 기기에서 로그인 중이었다면 알림
          const existingSessions = this.components.storage.getActiveSessions?.(result.didHash) || [];
          if (existingSessions.length > 0) {
            result.otherSessionsTerminated = true;
            result.terminatedDevices = existingSessions.map(s => s.deviceId);
          }
        }
        
        // 블록체인에서 최신 토큰 잔액 가져오기 (진실의 원천)
        const bTokenBalance = this.components.blockchain.getBalance(result.didHash, 'B-Token');
        
        // 영구 저장소와 동기화
        this.components.storage.setTokenBalance(result.didHash, bTokenBalance, 'B');
        
        result.tokenBalances = {
          bToken: bTokenBalance
        };
        
        // 검증자 풀 상태도 함께 전송
        result.validatorPoolStatus = this.components.storage.getValidatorPoolStatus();
      }
      
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
      
      // 시스템 검증자 등록 (아직 없는 경우)
      const systemValidatorDID = 'did:baekya:system_validator_000000000000000000000000';
      if (!this.components.blockchain.validators.has(systemValidatorDID)) {
        this.components.blockchain.registerValidator(systemValidatorDID, 1000);
      }
      
      // B-토큰은 서버 시작 시에만 지급되므로 여기서는 지급하지 않음
      console.log(`⚠️  B-토큰은 서버 시작 시에만 지급됩니다.`);
      
      console.log(`✅ Founder 혜택 완료: B-토큰만 보유`);
      
      return {
        success: true,
        bTokensGranted: 0 // B-토큰은 서버 시작 시에만 지급
      };
      
    } catch (error) {
      console.error('❌ Founder 혜택 부여 실패:', error.message);
      return { success: false, error: error.message };
    }
  }

  // CVCM 시스템 제거로 해당 메서드들 폐지됨

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
      // 사용자가 소속된 DAO 찾기
      const userDAOs = [];
      if (this.components.dao) {
        for (const [daoId, dao] of this.components.dao.daos) {
          const members = this.components.dao.daoMembers.get(daoId);
          if (members && members.has(userDID)) {
            userDAOs.push({
              id: daoId,
              name: dao.name,
              role: dao.operatorDID === userDID ? 'operator' : 'member',
              joinedAt: dao.createdAt // 실제로는 가입 시간을 따로 추적해야 함
            });
          }
        }
      }

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
          bToken: this.components.blockchain?.getBalance(userDID, 'B-Token') || 0
        },
        daos: userDAOs // 소속 DAO 정보 추가
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
  async transferTokens(fromDID, toDID, amount, tokenType = 'B-Token', authData = {}) {
    try {
      console.log(`💸 토큰 전송 시작: ${fromDID} -> ${toDID} (${amount} ${tokenType})`);
      
      // 토큰 타입 정규화 (이미 -Token이 붙어있으면 그대로 사용)
      const normalizedTokenType = tokenType.includes('-Token') ? tokenType : tokenType + '-Token';
      
      // 잔액 확인
      const senderBalance = this.components.blockchain.getBalance(fromDID, normalizedTokenType);
      if (senderBalance < amount) {
        throw new Error(`잔액이 부족합니다. 현재 잔액: ${senderBalance} ${normalizedTokenType}, 필요 금액: ${amount} ${normalizedTokenType}`);
      }
      
      const Transaction = require('./blockchain/Transaction');
      
      // 블록체인 트랜잭션 생성
      const tx = new Transaction(
        fromDID, 
        toDID, 
        amount, 
        normalizedTokenType,
        { 
          type: 'transfer', 
          purpose: '토큰 전송',
          memo: authData.memo || ''
        }
      );
      tx.sign('test-key'); // 개발 환경용 테스트 키
      
      // 트랜잭션을 블록체인에 추가
      const addResult = this.components.blockchain.addTransaction(tx);
      if (!addResult.success) {
        throw new Error(addResult.error);
      }
      
      console.log(`✅ 토큰 전송 트랜잭션 추가됨: ${tx.hash}`);
      
      // 수수료 계산 (0.001 B-Token)
      const fee = 0.001;
      const feeDistribution = {
        validatorPool: fee * 1.0, // 100%는 검증자 풀로
        dao: fee * 0.0 // 0%는 DAO들에게 분배 (100% 검증자 풀로 변경)
      };
      
      // 수신자 정보 가져오기
      const recipient = {
        did: toDID,
        address: this.components.didSystem.generateCommunicationAddress(toDID)
      };
      
      return {
        success: true,
        transactionId: tx.hash,
        blockNumber: this.components.blockchain.getLatestBlock().index + 1, // 다음 블록 번호
        fromDID,
        toDID,
        amount,
        tokenType: normalizedTokenType,
        timestamp: Date.now(),
        feeDistribution,
        recipient,
        message: `${amount} ${normalizedTokenType}이 성공적으로 전송되었습니다`
      };
    } catch (error) {
      console.error('토큰 전송 실패:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 사용자 지갑 정보 조회
  async getUserWallet(userDID) {
    try {
      // 블록체인에서 실제 잔액 계산
      const bTokenBalance = this.components.blockchain?.getBalance(userDID, 'B-Token') || 0;
      
      // 영구 저장소와 동기화
      if (this.components.storage) {
        const storedBToken = this.components.storage.getTokenBalance(userDID, 'B');
        
        // 블록체인이 진실의 원천 - 저장소와 다르면 업데이트
        if (storedBToken !== bTokenBalance) {
          this.components.storage.setTokenBalance(userDID, bTokenBalance, 'B');
        }
      }
      
      // CVCM 제거로 miningData는 null
      const miningData = null;
      
      return {
        success: true,
        userDID,
        balances: {
          bToken: bTokenBalance
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
        // CVCM 제거로 stats는 기본값
        const stats = { totalContributions: 0, totalValue: 0 };
        
        daos.push({
          id: daoId,
          name: dao.name,
          purpose: dao.purpose,
          description: dao.description,
          memberCount: members.length,
          contributionStats: stats,
          createdAt: dao.createdAt,
          status: dao.status,
          treasury: dao.treasury || 0
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
      // CVCM 제거로 stats는 기본값
      const stats = { totalContributions: 0, totalValue: 0 };
      
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
      // CVCM 제거로 기본값 반환
      const contributions = [];
      const miningData = null;
      
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

    // 경량 클라이언트용 노드 상태 API
    app.get('/api/node-status', (req, res) => {
      try {
        res.json({
          connected: true,
          activeNode: `http://localhost:${apiPort}`,
          knownNodes: [`http://localhost:${apiPort}`]
        });
      } catch (error) {
        res.status(500).json({ error: '노드 상태 조회 실패', details: error.message });
      }
    });

    // 경량 클라이언트용 노드 추가 API (자기 자신이므로 실질적으로 무시)
    app.post('/api/add-node', (req, res) => {
      res.json({ 
        success: true, 
        message: '통합 노드에서는 노드 추가가 필요하지 않습니다',
        knownNodes: [`http://localhost:${apiPort}`]
      });
    });

    // API 서버 시작 - 모든 네트워크 인터페이스에서 접속 가능하도록 0.0.0.0으로 바인딩
    const apiServerPromise = new Promise((resolve, reject) => {
      this.httpServer = app.listen(apiPort, '0.0.0.0', () => {
        console.log(`🔗 탈중앙화 API 서버 시작됨:`);
        console.log(`  🌐 PC: http://localhost:${apiPort}`);
        console.log(`  📱 폰: http://[PC의 IP주소]:${apiPort}`);
        console.log(`  💡 PC IP 확인: Windows - ipconfig | Linux/Mac - ifconfig`);
        console.log(`📝 이 API는 오직 이 노드의 로컬 데이터만 제공합니다`);
        resolve();
      });

      this.httpServer.on('error', (error) => {
        console.error('❌ API 서버 시작 실패:', error.message);
        reject(error);
      });
    });

    // 동시에 경량 클라이언트 프록시 서버 시작 (3000 포트)
    const mobileServerPromise = this.startMobileClientServer(apiPort);

    // 두 서버 모두 시작 대기
    return Promise.all([apiServerPromise, mobileServerPromise]);
  }

  // 경량 클라이언트 프록시 서버 시작
  async startMobileClientServer(mainApiPort) {
    const express = require('express');
    const path = require('path');
    const app = express();
    const mobilePort = 3000;

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
      res.sendFile(path.join(__dirname, '../public', 'index.html'));
    });

    // 노드 상태 확인 (항상 연결됨으로 응답)
    app.get('/api/node-status', (req, res) => {
      res.json({
        connected: true,
        activeNode: `http://localhost:${mainApiPort}`,
        knownNodes: [`http://localhost:${mainApiPort}`]
      });
    });

    // 노드 추가 (통합 서버에서는 불필요)
    app.post('/api/add-node', (req, res) => {
      res.json({ 
        success: true, 
        message: '통합 서버에서는 노드 추가가 불필요합니다',
        knownNodes: [`http://localhost:${mainApiPort}`]
      });
    });

    // 모든 API 요청을 메인 API 서버로 프록시
    app.all('/api/*', (req, res) => {
      const apiPath = req.originalUrl;
      const targetUrl = `http://localhost:${mainApiPort}${apiPath}`;
      
      // 같은 프로세스 내에서 직접 호출
      this.handleInternalAPICall(req, res, apiPath);
    });

    return new Promise((resolve, reject) => {
      this.mobileServer = app.listen(mobilePort, '0.0.0.0', () => {
        console.log(`📱 경량 클라이언트 서버 통합 시작됨:`);
        console.log(`  🌐 PC: http://localhost:${mobilePort}`);
        console.log(`  📱 폰: http://[PC의 IP주소]:${mobilePort}`);
        console.log(`  🔗 메인 API와 통합되어 실행됩니다`);
        resolve();
      });

      this.mobileServer.on('error', (error) => {
        console.error('❌ 경량 클라이언트 서버 시작 실패:', error.message);
        reject(error);
      });
    });
  }

  // 내부 API 호출 처리
  async handleInternalAPICall(req, res, apiPath) {
    try {
      // 같은 프로세스 내에서 직접 메서드 호출
      const method = req.method.toLowerCase();
      const path = apiPath.replace('/api/', '');
      
      let result;
      
      switch (path) {
        case 'status':
          result = this.getProtocolStatus();
          break;
          
        case 'register':
          if (method === 'post') {
            const { userData } = req.body;
            if (!userData || !userData.username || !userData.password) {
              return res.status(400).json({ 
                success: false, 
                error: '아이디와 비밀번호가 필요합니다' 
              });
            }
            result = this.registerUser(userData);
          }
          break;
          
        case 'login':
          if (method === 'post') {
            const { username, password } = req.body;
            if (!username || !password) {
              return res.status(400).json({ 
                success: false, 
                error: '아이디와 비밀번호가 필요합니다' 
              });
            }
            result = this.loginUser(username, password);
            if (!result.success) {
              return res.status(401).json(result);
            }
          }
          break;
          
        default:
          if (path.startsWith('dashboard/')) {
            const did = path.split('/')[1];
            result = this.getUserDashboard(did);
          } else if (path.startsWith('wallet/')) {
            const did = path.split('/')[1];
            result = await this.getUserWallet(did);
          } else if (path === 'daos') {
            result = this.getDAOs();
          } else if (path.startsWith('daos/')) {
            const daoId = path.split('/')[1];
            result = this.getDAO(daoId);
          } else if (path === 'proposals') {
            result = await this.getProposals();
          } else if (path.startsWith('contributions/')) {
            const did = path.split('/')[1];
            result = await this.getContributionHistory(did);
          } else if (path === 'blockchain/status') {
            result = this.components.blockchain.getBlockchainStatus();
          } else if (path === 'transfer' && method === 'post') {
            const { fromDID, toDID, amount, tokenType } = req.body;
            result = await this.transferTokens(fromDID, toDID, amount, tokenType);
          } else {
            return res.status(404).json({ error: '요청한 API를 찾을 수 없습니다' });
          }
          break;
      }
      
      res.json(result);
    } catch (error) {
      console.error('내부 API 호출 오류:', error);
      res.status(500).json({ 
        success: false, 
        error: 'API 처리 실패', 
        details: error.message 
      });
    }
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