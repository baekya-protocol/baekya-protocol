const BlockchainCore = require('../src/blockchain/BlockchainCore');
const Transaction = require('../src/blockchain/Transaction');

// 노드 3 - 일반 노드 (검증자 아님)
class TestnetNode3 {
  constructor() {
    this.blockchain = new BlockchainCore();
    this.nodeId = 'NODE-3';
    this.port = 3003;
    this.userDID = 'did:baekya:user3000000000000000000000000000000000000000';
  }

  async start() {
    console.log('🚀 테스트넷 노드 3 시작 (일반 노드)...');
    
    try {
      // P2P 네트워크 시작
      const networkResult = await this.blockchain.p2pNetwork.start(this.port);
      if (!networkResult.success) {
        throw new Error(`네트워크 시작 실패: ${networkResult.error}`);
      }

      // 일반 사용자 잔액 설정
      this.blockchain.setBalance(this.userDID, 500, 'B-Token');
      console.log(`💰 사용자 잔액 설정: ${this.userDID.substring(0, 20)}...`);

      // 다른 노드들에 연결 시도
      setTimeout(() => {
        this.connectToNetwork();
      }, 5000);

      // 정기적으로 네트워크 상태 체크
      setInterval(() => {
        this.checkNetworkHealth();
      }, 45000);

      console.log(`🌟 노드 3 준비 완료 - 포트: ${this.port}`);
      console.log(`📍 노드 ID: ${this.blockchain.p2pNetwork.nodeId.substring(0, 16)}...`);

    } catch (error) {
      console.error('❌ 노드 3 시작 실패:', error.message);
      process.exit(1);
    }
  }

  // 네트워크에 연결
  async connectToNetwork() {
    const nodes = ['ws://localhost:3001', 'ws://localhost:3002'];
    
    for (const nodeUrl of nodes) {
      try {
        console.log(`🔗 ${nodeUrl}에 연결 시도...`);
        const result = await this.blockchain.p2pNetwork.connectToPeerByUrl(nodeUrl);
        if (result.success) {
          console.log(`✅ ${nodeUrl} 연결 성공`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.log(`⚠️ ${nodeUrl} 연결 실패: ${error.message}`);
      }
    }

    // 연결 후 동기화 요청
    setTimeout(() => {
      this.blockchain.p2pNetwork.requestSync();
    }, 3000);
  }

  // 네트워크 건강성 체크
  checkNetworkHealth() {
    const networkStatus = this.blockchain.p2pNetwork.getNetworkStatus();
    
    if (networkStatus.peerCount === 0) {
      console.log('⚠️ 연결된 피어가 없음 - 재연결 시도');
      this.connectToNetwork();
    } else {
      console.log(`💚 네트워크 상태 양호 - ${networkStatus.peerCount}개 피어 연결됨`);
      
      // 가끔 동기화 요청
      if (Math.random() < 0.3) {
        this.blockchain.p2pNetwork.requestSync();
      }
    }
  }

  // 사용자 트랜잭션 생성 (가끔)
  createUserTransaction() {
    try {
      const recipients = [
        'did:baekya:test1000000000000000000000000000000000000000',
        'did:baekya:test2000000000000000000000000000000000000000'
      ];
      
      const toDID = recipients[Math.floor(Math.random() * recipients.length)];
      const amount = Math.floor(Math.random() * 20) + 1;

      const transaction = new Transaction(this.userDID, toDID, amount, 'B-Token');
      transaction.sign('user-private-key');

      const result = this.blockchain.addTransaction(transaction);
      if (result.success) {
        console.log(`📝 사용자 트랜잭션 생성: ${amount} B-Token -> ${toDID.substring(0, 20)}...`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ 사용자 트랜잭션 생성 실패:', error.message);
      return { success: false, error: error.message };
    }
  }

  // 잔액 조회
  checkBalance() {
    const balance = this.blockchain.getBalance(this.userDID, 'B-Token');
    console.log(`💰 현재 잔액: ${balance} B-Token`);
    return balance;
  }

  // 노드 상태 출력
  getStatus() {
    const networkStatus = this.blockchain.p2pNetwork.getNetworkStatus();
    const chainLength = this.blockchain.chain.length;
    const balance = this.blockchain.getBalance(this.userDID, 'B-Token');

    return {
      nodeId: this.nodeId,
      port: this.port,
      nodeType: 'USER_NODE',
      chainLength,
      userBalance: balance,
      connectedPeers: networkStatus.peerCount,
      syncStatus: networkStatus.syncStatus.isSyncing ? 'SYNCING' : 'READY',
      uptime: Math.floor(networkStatus.uptime / 1000) + 's',
      lastBlock: this.blockchain.getLatestBlock().hash.substring(0, 16) + '...'
    };
  }

  // 네트워크 통계 출력
  printNetworkStats() {
    const stats = this.blockchain.p2pNetwork.getNetworkStats();
    const peers = this.blockchain.p2pNetwork.getPeers();
    
    console.log('\n📈 네트워크 통계:');
    console.log(`- 연결된 피어: ${stats.connectedPeers}/${stats.totalPeers}`);
    console.log(`- 총 메시지: ${stats.totalMessages}`);
    console.log(`- 가동시간: ${Math.floor(stats.uptime / 1000)}초`);
    
    if (peers.length > 0) {
      console.log('👥 연결된 피어들:');
      peers.forEach((peer, index) => {
        console.log(`  ${index + 1}. ${peer.id.substring(0, 16)}... (${peer.status})`);
      });
    }
  }
}

// 노드 시작
const node3 = new TestnetNode3();

// 상태 출력
setInterval(() => {
  console.log('\n📊 노드 3 상태:', node3.getStatus());
}, 30000);

// 사용자 트랜잭션 생성 (낮은 빈도)
setInterval(() => {
  if (Math.random() < 0.2) { // 20% 확률
    node3.createUserTransaction();
  }
}, 20000);

// 네트워크 통계 출력
setInterval(() => {
  node3.printNetworkStats();
}, 90000); // 1.5분마다

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n🛑 노드 3 종료 중...');
  node3.blockchain.p2pNetwork.cleanup();
  process.exit(0);
});

node3.start(); 