const WebSocket = require('ws');
const fs = require('fs');

class TestnetMonitor {
  constructor() {
    this.nodes = [
      { name: 'NODE-1', port: 3001, type: '검증자', status: 'UNKNOWN' },
      { name: 'NODE-2', port: 3002, type: '검증자', status: 'UNKNOWN' },
      { name: 'NODE-3', port: 3003, type: '사용자', status: 'UNKNOWN' }
    ];
    this.connections = new Map();
    this.lastUpdate = new Date();
    this.stats = {
      totalBlocks: 0,
      totalTransactions: 0,
      activeNodes: 0,
      networkLatency: 0
    };
  }

  async start() {
    console.log('🔍 백야 프로토콜 테스트넷 모니터 시작...\n');
    
    // 노드들에 연결 시도
    for (const node of this.nodes) {
      await this.connectToNode(node);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 주기적 상태 업데이트
    setInterval(() => this.updateStatus(), 10000);
    
    // 실시간 모니터링 시작
    this.startRealTimeMonitoring();
  }

  async connectToNode(node) {
    try {
      const wsUrl = `ws://localhost:${node.port}`;
      console.log(`🔗 ${node.name} 연결 시도: ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      
      ws.on('open', () => {
        console.log(`✅ ${node.name} 연결 성공`);
        node.status = 'CONNECTED';
        this.connections.set(node.name, ws);
        
        // 인증 메시지 전송
        const authMessage = {
          type: 'auth',
          nodeId: 'MONITOR-' + Date.now(),
          timestamp: Date.now(),
          version: '1.0.0'
        };
        ws.send(JSON.stringify(authMessage));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleNodeMessage(node, message);
        } catch (error) {
          console.log(`⚠️ ${node.name} 메시지 파싱 오류:`, error.message);
        }
      });

      ws.on('close', () => {
        console.log(`❌ ${node.name} 연결 종료`);
        node.status = 'DISCONNECTED';
        this.connections.delete(node.name);
      });

      ws.on('error', (error) => {
        console.log(`⚠️ ${node.name} 연결 오류: ${error.message}`);
        node.status = 'ERROR';
      });

    } catch (error) {
      console.log(`❌ ${node.name} 연결 실패: ${error.message}`);
      node.status = 'FAILED';
    }
  }

  handleNodeMessage(node, message) {
    // 메시지 타입별 처리
    switch (message.type) {
      case 'newBlock':
        console.log(`📦 ${node.name}: 새 블록 감지 #${message.data?.index || 'N/A'}`);
        this.stats.totalBlocks++;
        break;
        
      case 'newTransaction':
        console.log(`💸 ${node.name}: 새 트랜잭션 감지`);
        this.stats.totalTransactions++;
        break;
        
      case 'heartbeat':
        node.lastHeartbeat = Date.now();
        break;
        
      case 'authResponse':
        if (message.success) {
          console.log(`🔐 ${node.name}: 인증 완료`);
        }
        break;
    }
  }

  updateStatus() {
    console.clear();
    console.log('🌐 백야 프로토콜 테스트넷 모니터');
    console.log('='.repeat(50));
    console.log(`📅 마지막 업데이트: ${new Date().toLocaleString()}`);
    console.log('');

    // 노드 상태
    console.log('🖥️  노드 상태:');
    this.stats.activeNodes = 0;
    
    this.nodes.forEach(node => {
      const statusIcon = this.getStatusIcon(node.status);
      const connectionInfo = node.status === 'CONNECTED' ? 
        `(${this.connections.has(node.name) ? '연결됨' : '연결 끊김'})` : '';
      
      console.log(`   ${statusIcon} ${node.name} [${node.type}] - 포트 ${node.port} ${connectionInfo}`);
      
      if (node.status === 'CONNECTED') {
        this.stats.activeNodes++;
      }
    });

    console.log('');

    // 네트워크 통계
    console.log('📊 네트워크 통계:');
    console.log(`   활성 노드: ${this.stats.activeNodes}/${this.nodes.length}`);
    console.log(`   총 블록 수: ${this.stats.totalBlocks}`);
    console.log(`   총 트랜잭션: ${this.stats.totalTransactions}`);
    console.log(`   네트워크 연결률: ${Math.round((this.stats.activeNodes / this.nodes.length) * 100)}%`);

    console.log('');

    // 연결 상태 매트릭스
    console.log('🔗 P2P 연결 매트릭스:');
    console.log('   [이 기능은 향후 구현 예정]');

    console.log('');
    console.log('💡 팁: Ctrl+C로 모니터를 종료할 수 있습니다');
  }

  getStatusIcon(status) {
    switch (status) {
      case 'CONNECTED': return '🟢';
      case 'DISCONNECTED': return '🔴';
      case 'ERROR': return '🟠';
      case 'FAILED': return '❌';
      default: return '⚪';
    }
  }

  startRealTimeMonitoring() {
    console.log('\n🔄 실시간 모니터링 시작...');
    console.log('새로운 블록과 트랜잭션이 실시간으로 표시됩니다.\n');
  }

  // 로그 저장
  saveLog(data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...data
    };

    const logFile = 'testnet/logs/monitor.log';
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }

  // 테스트넷 건강성 체크
  async healthCheck() {
    const results = {
      overall: 'HEALTHY',
      issues: []
    };

    // 노드 연결 체크
    const connectedNodes = this.nodes.filter(node => node.status === 'CONNECTED').length;
    if (connectedNodes < 2) {
      results.overall = 'UNHEALTHY';
      results.issues.push('연결된 노드가 2개 미만');
    }

    // 블록 생성 체크 (마지막 5분간)
    // [실제 구현에서는 블록 타임스탬프를 확인]

    return results;
  }

  cleanup() {
    console.log('\n🧹 모니터 정리 중...');
    
    for (const [nodeName, ws] of this.connections) {
      try {
        ws.close();
        console.log(`✅ ${nodeName} 연결 해제`);
      } catch (error) {
        console.log(`⚠️ ${nodeName} 연결 해제 오류: ${error.message}`);
      }
    }
    
    this.connections.clear();
    console.log('✅ 모니터 정리 완료');
  }
}

// 모니터 시작
const monitor = new TestnetMonitor();

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  monitor.cleanup();
  process.exit(0);
});

monitor.start().catch(error => {
  console.error('❌ 모니터 시작 실패:', error.message);
  process.exit(1);
}); 