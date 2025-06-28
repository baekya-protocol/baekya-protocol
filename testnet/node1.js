const BlockchainCore = require('../src/blockchain/BlockchainCore');
const Transaction = require('../src/blockchain/Transaction');

// 노드 1 - 메인 검증자 노드
class TestnetNode1 {
  constructor() {
    this.blockchain = new BlockchainCore();
    this.nodeId = 'NODE-1';
    this.port = 3001;
    this.validatorDID = 'did:baekya:validator1000000000000000000000000000000000000000';
  }

  async start() {
    console.log('🚀 테스트넷 노드 1 시작...');
    
    try {
      // P2P 네트워크 시작
      const networkResult = await this.blockchain.p2pNetwork.start(this.port);
      if (!networkResult.success) {
        throw new Error(`네트워크 시작 실패: ${networkResult.error}`);
      }

      // 검증자 등록
      this.blockchain.pocConsensus.setContributionScore(this.validatorDID, 10000);
      console.log(`✅ 검증자 등록 완료: ${this.validatorDID.substring(0, 20)}...`);

      // 초기 테스트 잔액 설정
      this.setupInitialBalances();

      // 주기적으로 테스트 트랜잭션 생성
      this.startTransactionGenerator();

      console.log(`🌟 노드 1 준비 완료 - 포트: ${this.port}`);
      console.log(`📍 노드 ID: ${this.blockchain.p2pNetwork.nodeId.substring(0, 16)}...`);

    } catch (error) {
      console.error('❌ 노드 1 시작 실패:', error.message);
      process.exit(1);
    }
  }

  // 초기 잔액 설정
  setupInitialBalances() {
    const testDIDs = [
      'did:baekya:test1000000000000000000000000000000000000000',
      'did:baekya:test2000000000000000000000000000000000000000',
      'did:baekya:test3000000000000000000000000000000000000000'
    ];

    testDIDs.forEach((did, index) => {
      this.blockchain.setBalance(did, (index + 1) * 1000, 'B-Token');
    });

    console.log('💰 초기 테스트 잔액 설정 완료');
  }

  // 테스트 트랜잭션 생성기
  startTransactionGenerator() {
    let transactionCount = 0;
    
    setInterval(() => {
      try {
        transactionCount++;
        
        // 랜덤 트랜잭션 생성
        const fromDID = `did:baekya:test${Math.floor(Math.random() * 3) + 1}000000000000000000000000000000000000000`;
        const toDID = `did:baekya:test${Math.floor(Math.random() * 3) + 1}000000000000000000000000000000000000000`;
        const amount = Math.floor(Math.random() * 100) + 10;

        if (fromDID !== toDID) {
          const transaction = new Transaction(fromDID, toDID, amount, 'B-Token');
          transaction.sign(`test-key-${transactionCount}`);

          const result = this.blockchain.addTransaction(transaction);
          if (result.success) {
            console.log(`📝 테스트 트랜잭션 생성 #${transactionCount}: ${amount} B-Token`);
            
            // 트랜잭션이 5개 이상 쌓이면 블록 마이닝
            if (this.blockchain.pendingTransactions.length >= 5) {
              this.mineBlock();
            }
          }
        }
      } catch (error) {
        console.error('❌ 트랜잭션 생성 실패:', error.message);
      }
    }, 10000); // 10초마다 트랜잭션 생성
  }

  // 블록 마이닝
  async mineBlock() {
    try {
      console.log('⛏️ 블록 마이닝 시작...');
      
      const transactions = this.blockchain.pendingTransactions.slice(0, 5);
      const block = this.blockchain.createBlock(transactions, this.validatorDID);
      
      const result = this.blockchain.addBlock(block);
      if (result.success) {
        console.log(`✅ 블록 #${block.index} 마이닝 완료 - ${transactions.length}개 트랜잭션 포함`);
        
        // 네트워크에 새 블록 브로드캐스트
        this.blockchain.p2pNetwork.broadcastBlock(block.toJSON());
      }
    } catch (error) {
      console.error('❌ 블록 마이닝 실패:', error.message);
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
      lastBlock: this.blockchain.getLatestBlock().hash.substring(0, 16) + '...'
    };
  }
}

// 노드 시작
const node1 = new TestnetNode1();

// 상태 출력
setInterval(() => {
  console.log('\n📊 노드 1 상태:', node1.getStatus());
}, 30000); // 30초마다 상태 출력

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n🛑 노드 1 종료 중...');
  node1.blockchain.p2pNetwork.cleanup();
  process.exit(0);
});

node1.start(); 