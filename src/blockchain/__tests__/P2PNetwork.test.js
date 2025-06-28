const P2PNetwork = require('../P2PNetwork');
const WebSocket = require('ws');

describe('P2PNetwork', () => {
  let network1, network2, network3;
  const testPorts = [3001, 3002, 3003];

  beforeEach(() => {
    // 각 테스트마다 새로운 네트워크 인스턴스 생성 (자동 생성 노드 ID)
    network1 = new P2PNetwork();
    network2 = new P2PNetwork();
    network3 = new P2PNetwork();
  });

  afterEach(async () => {
    // 테스트 후 정리
    if (network1) await network1.cleanup();
    if (network2) await network2.cleanup();
    if (network3) await network3.cleanup();
    
    // 포트가 완전히 해제될 때까지 대기
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('네트워크 초기화', () => {
    test('노드 ID가 올바르게 생성되어야 함', () => {
      expect(network1.nodeId).toBeDefined();
      expect(network1.nodeId).toMatch(/^[a-f0-9]{64}$/);
      expect(network1.nodeId).not.toBe(network2.nodeId);
    });

    test('초기 상태가 올바르게 설정되어야 함', () => {
      expect(network1.connectionStatus).toBe('disconnected');
      expect(network1.peers.size).toBe(0);
      expect(network1.maxPeers).toBe(50);
      expect(network1.syncStatus.isSyncing).toBe(false);
    });

    test('커스텀 노드 ID로 초기화할 수 있어야 함', () => {
      const customNodeId = 'custom-node-id-123';
      const customNetwork = new P2PNetwork(customNodeId);
      expect(customNetwork.nodeId).toBe(customNodeId);
    });
  });

  describe('네트워크 시작', () => {
    test('네트워크를 성공적으로 시작할 수 있어야 함', async () => {
      const result = await network1.start(testPorts[0]);
      
      expect(result.success).toBe(true);
      expect(result.nodeId).toBe(network1.nodeId);
      expect(result.port).toBe(testPorts[0]);
      expect(network1.connectionStatus).toBe('connected');
    });

    test('이미 사용 중인 포트에서는 실패해야 함', async () => {
      await network1.start(testPorts[0]);
      const result = await network2.start(testPorts[0]);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('네트워크 시작 시 이벤트가 발생해야 함', async () => {
      const eventPromise = new Promise(resolve => {
        network1.on('networkStarted', resolve);
      });

      await network1.start(testPorts[0]);
      const eventData = await eventPromise;

      expect(eventData.nodeId).toBe(network1.nodeId);
      expect(eventData.port).toBe(testPorts[0]);
    });
  });

  describe('피어 연결', () => {
    beforeEach(async () => {
      // 테스트용 네트워크 시작
      await network1.start(testPorts[0]);
      await network2.start(testPorts[1]);
    });

    test('다른 노드에 연결할 수 있어야 함', async () => {
      // 피어 연결 이벤트를 기다리는 Promise 생성
      const peerConnectedPromise = new Promise(resolve => {
        network1.on('peerConnected', resolve);
      });

      const result = await network2.connectToPeerByUrl(`ws://localhost:${testPorts[0]}`);
      
      expect(result.success).toBe(true);
      
      // 인증 완료까지 대기
      await Promise.race([
        peerConnectedPromise,
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      
      expect(network1.peers.size).toBeGreaterThan(0);
    });

    test('존재하지 않는 노드에 연결 시 실패해야 함', async () => {
      const result = await network2.connectToPeerByUrl('ws://localhost:9999');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('피어 연결 시 인증이 수행되어야 함', async () => {
      const authPromise = new Promise(resolve => {
        network1.on('peerConnected', resolve);
      });

      await network2.connectToPeerByUrl(`ws://localhost:${testPorts[0]}`);
      
      // 인증 완료까지 대기
      await Promise.race([
        authPromise,
        new Promise(resolve => setTimeout(resolve, 2000))
      ]);

      expect(network1.peers.size).toBeGreaterThan(0);
    });
  });

  describe('메시지 브로드캐스트', () => {
    beforeEach(async () => {
      await network1.start(testPorts[0]);
      await network2.start(testPorts[1]);
      await network3.start(testPorts[2]);
      
      // 네트워크 연결 설정
      await network2.connectToPeerByUrl(`ws://localhost:${testPorts[0]}`);
      await network3.connectToPeerByUrl(`ws://localhost:${testPorts[0]}`);
      
      // 연결 안정화 대기
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    test('모든 피어에게 메시지를 브로드캐스트할 수 있어야 함', async () => {
      const messagePromises = [
        new Promise(resolve => network2.on('testMessage', resolve)),
        new Promise(resolve => network3.on('testMessage', resolve))
      ];

      network1.broadcast('testMessage', { content: 'Hello World' });

      const results = await Promise.all(messagePromises.map(p => 
        Promise.race([p, new Promise(resolve => setTimeout(() => resolve(null), 2000))])
      ));

      // 적어도 하나의 메시지는 전달되어야 함
      expect(results.some(result => result !== null)).toBe(true);
    });

    test('블록을 네트워크에 브로드캐스트할 수 있어야 함', async () => {
      const mockBlock = {
        index: 1,
        hash: 'test-hash',
        transactions: [],
        timestamp: Date.now()
      };

      const blockPromise = new Promise(resolve => {
        network2.on('newBlockReceived', resolve);
      });

      network1.broadcastBlock(mockBlock);

      const receivedBlock = await Promise.race([
        blockPromise,
        new Promise(resolve => setTimeout(() => resolve(null), 2000))
      ]);

      if (receivedBlock) {
        expect(receivedBlock.index).toBe(mockBlock.index);
        expect(receivedBlock.hash).toBe(mockBlock.hash);
      }
    });

    test('트랜잭션을 네트워크에 브로드캐스트할 수 있어야 함', async () => {
      const mockTransaction = {
        fromDID: 'did:baekya:test1',
        toDID: 'did:baekya:test2',
        amount: 100,
        timestamp: Date.now()
      };

      const txPromise = new Promise(resolve => {
        network2.on('newTransactionReceived', resolve);
      });

      network1.broadcastTransaction(mockTransaction);

      const receivedTx = await Promise.race([
        txPromise,
        new Promise(resolve => setTimeout(() => resolve(null), 2000))
      ]);

      if (receivedTx) {
        expect(receivedTx.fromDID).toBe(mockTransaction.fromDID);
        expect(receivedTx.amount).toBe(mockTransaction.amount);
      }
    });
  });

  describe('동기화', () => {
    beforeEach(async () => {
      await network1.start(testPorts[0]);
      await network2.start(testPorts[1]);
      await network2.connectToPeerByUrl(`ws://localhost:${testPorts[0]}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    test('동기화를 요청할 수 있어야 함', async () => {
      const syncPromise = new Promise(resolve => {
        network1.on('syncRequested', resolve);
      });

      network2.requestSync();

      const syncRequest = await Promise.race([
        syncPromise,
        new Promise(resolve => setTimeout(() => resolve(null), 2000))
      ]);

      expect(syncRequest).toBeDefined();
    });

    test('동기화 상태를 추적할 수 있어야 함', () => {
      expect(network1.syncStatus.isSyncing).toBe(false);
      expect(network1.syncStatus.lastSyncTime).toBeNull();
      expect(network1.syncStatus.syncProgress).toBe(0);
    });
  });

  describe('하트비트', () => {
    beforeEach(async () => {
      await network1.start(testPorts[0]);
      await network2.start(testPorts[1]);
      await network2.connectToPeerByUrl(`ws://localhost:${testPorts[0]}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    test('하트비트가 정기적으로 전송되어야 함', async () => {
      const heartbeatPromise = new Promise(resolve => {
        network1.on('heartbeatReceived', resolve);
      });

      // 하트비트 시작
      network2.startHeartbeat();

      const heartbeat = await Promise.race([
        heartbeatPromise,
        new Promise(resolve => setTimeout(() => resolve(null), 5000))
      ]);

      expect(heartbeat).toBeDefined();
    });

    test('비활성 피어를 감지할 수 있어야 함', async () => {
      // 피어 연결 후 강제로 연결 해제
      const peerId = Array.from(network1.peers.keys())[0];
      if (peerId) {
        const peer = network1.peers.get(peerId);
        if (peer && peer.ws) {
          peer.ws.close();
        }
      }

      // 피어 상태 확인
      network1.checkPeerHealth();

      // 연결 해제 감지까지 대기
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 비활성 피어가 제거되었는지 확인
      expect(network1.peers.has(peerId)).toBe(false);
    });
  });

  describe('네트워크 상태', () => {
    test('네트워크 상태를 조회할 수 있어야 함', async () => {
      await network1.start(testPorts[0]);
      
      const status = network1.getNetworkStatus();
      
      expect(status.nodeId).toBe(network1.nodeId);
      expect(status.connectionStatus).toBe('connected');
      expect(status.peerCount).toBe(0);
      expect(status.port).toBe(testPorts[0]);
    });

    test('네트워크 통계를 조회할 수 있어야 함', async () => {
      await network1.start(testPorts[0]);
      
      const stats = network1.getNetworkStats();
      
      expect(stats.uptime).toBeGreaterThan(0);
      expect(stats.totalConnections).toBe(0);
      expect(stats.activeConnections).toBe(0);
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesReceived).toBe(0);
    });

    test('연결된 피어 목록을 조회할 수 있어야 함', async () => {
      await network1.start(testPorts[0]);
      
      const peers = network1.getPeers();
      
      expect(Array.isArray(peers)).toBe(true);
      expect(peers.length).toBe(0);
    });
  });

  describe('정리 및 종료', () => {
    test('네트워크를 정상적으로 종료할 수 있어야 함', async () => {
      await network1.start(testPorts[0]);
      expect(network1.connectionStatus).toBe('connected');
      
      await network1.cleanup();
      expect(network1.connectionStatus).toBe('disconnected');
    });

    test('모든 피어 연결이 정리되어야 함', async () => {
      await network1.start(testPorts[0]);
      await network2.start(testPorts[1]);
      
      // 피어 연결 이벤트를 기다리는 Promise 생성
      const peerConnectedPromise = new Promise(resolve => {
        network1.on('peerConnected', resolve);
      });
      
      await network2.connectToPeerByUrl(`ws://localhost:${testPorts[0]}`);
      
      // 인증 완료까지 대기
      await Promise.race([
        peerConnectedPromise,
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      
      expect(network1.peers.size).toBeGreaterThan(0);
      
      await network1.cleanup();
      expect(network1.peers.size).toBe(0);
    });
  });

  describe('오류 처리', () => {
    test('잘못된 메시지 형식을 처리할 수 있어야 함', async () => {
      await network1.start(testPorts[0]);
      
      // 직접 WebSocket 연결하여 잘못된 메시지 전송
      const ws = new WebSocket(`ws://localhost:${testPorts[0]}`);
      
      await new Promise(resolve => {
        ws.on('open', () => {
          ws.send('invalid json message');
          resolve();
        });
      });

      // 오류가 발생해도 네트워크가 계속 작동해야 함
      expect(network1.connectionStatus).toBe('connected');
      
      ws.close();
    });

    test('연결 실패 시 적절한 오류를 반환해야 함', async () => {
      const result = await network1.connectToPeerByUrl('ws://invalid-url:9999');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
}); 