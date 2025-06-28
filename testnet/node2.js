const BlockchainCore = require('../src/blockchain/BlockchainCore');
const Transaction = require('../src/blockchain/Transaction');

// 노드 2 - 보조 검증자 노드
class TestnetNode2 {
  constructor() {
    this.blockchain = new BlockchainCore();
    this.nodeId = 'NODE-2';
    this.port = 3002;
    this.validatorDID = 'did:baekya:validator2000000000000000000000000000000000000000';
  }

  async start() {
    console.log('🚀 테스트넷 노드 2 시작...');
    
    try {
      // P2P 네트워크 시작
      const networkResult = await this.blockchain.p2pNetwork.start(this.port);
      if (!networkResult.success) {
        throw new Error(`네트워크 시작 실패: ${networkResult.error}`);
      }

      // 검증자 등록 (노드 1보다 낮은 기여도)
      this.blockchain.pocConsensus.setContributionScore(this.validatorDID, 5000);
      console.log(`✅ 검증자 등록 완료: ${this.validatorDID.substring(0, 20)}...`);

      // 노드 1에 연결 시도
      setTimeout(() => {
        this.connectToNode1();
      }, 3000);

      // 동기화 주기적 실행
      setInterval(() => {
        this.requestSyncIfNeeded();
      }, 60000); // 1분마다 동기화 확인

      console.log(`🌟 노드 2 준비 완료 - 포트: ${this.port}`);
      console.log(`📍 노드 ID: ${this.blockchain.p2pNetwork.nodeId.substring(0, 16)}...`);

    } catch (error) {
      console.error('❌ 노드 2 시작 실패:', error.message);
      process.exit(1);
    }
  }

  // 노드 1에 연결
  async connectToNode1() {
    try {
      console.log('🔗 노드 1에 연결 시도...');
      const result = await this.blockchain.p2pNetwork.connectToPeerByUrl('ws://localhost:3001');
      if (result.success) {
        console.log('✅ 노드 1 연결 성공');
        
        // 연결 후 즉시 동기화 요청
        setTimeout(() => {
          this.blockchain.p2pNetwork.requestSync();
        }, 2000);
      } else {
        console.log('⚠️ 노드 1 연결 실패, 재시도 예정');
        setTimeout(() => this.connectToNode1(), 10000);
      }
    } catch (error) {
      console.error('❌ 노드 1 연결 오류:', error.message);
      setTimeout(() => this.connectToNode1(), 10000);
    }
  }

  // 필요시 동기화 요청
  requestSyncIfNeeded() {
    const networkStatus = this.blockchain.p2pNetwork.getNetworkStatus();
    
    if (networkStatus.peerCount > 0 && !networkStatus.syncStatus.isSyncing) {
      console.log('🔄 정기 동기화 요청...');
      this.blockchain.p2pNetwork.requestSync();
    }
  }

  // 수동 트랜잭션 생성 (노드 1보다 적게)
  createTestTransaction() {
    try {
      const fromDID = 'did:baekya:test2000000000000000000000000000000000000000';
      const toDID = 'did:baekya:test1000000000000000000000000000000000000000';
      const amount = Math.floor(Math.random() * 50) + 5;

      const transaction = new Transaction(fromDID, toDID, amount, 'B-Token');
      transaction.sign('test-key-node2');

      const result = this.blockchain.addTransaction(transaction);
      if (result.success) {
        console.log(`📝 노드 2 트랜잭션 생성: ${amount} B-Token`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ 트랜잭션 생성 실패:', error.message);
      return { success: false, error: error.message };
    }
  }

  // 노드 상태 출력
  getStatus() {
    const networkStatus = this.blockchain.p2pNetwork.getNetworkStatus();
    const chainLength = this.blockchain.chain.length;
    const pendingTxs = this.blockchain.pendingTransactions.length;

    return {
      nodeId: this.nodeId,
      port: this.port,
      chainLength,
      pendingTransactions: pendingTxs,
      connectedPeers: networkStatus.peerCount,
      syncStatus: networkStatus.syncStatus.isSyncing ? 'SYNCING' : 'READY',
      lastSync: networkStatus.syncStatus.lastSyncTime ? 
        new Date(networkStatus.syncStatus.lastSyncTime).toLocaleTimeString() : 'NEVER',
      lastBlock: this.blockchain.getLatestBlock().hash.substring(0, 16) + '...'
    };
  }
}

// 노드 시작
const node2 = new TestnetNode2();

// 상태 출력
setInterval(() => {
  console.log('\n📊 노드 2 상태:', node2.getStatus());
}, 30000);

// 테스트 트랜잭션 생성 (노드 1보다 낮은 빈도)
setInterval(() => {
  if (Math.random() < 0.3) { // 30% 확률
    node2.createTestTransaction();
  }
}, 15000);

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n🛑 노드 2 종료 중...');
  node2.blockchain.p2pNetwork.cleanup();
  process.exit(0);
});

node2.start(); 