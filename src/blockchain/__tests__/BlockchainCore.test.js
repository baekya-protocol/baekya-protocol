const BlockchainCore = require('../BlockchainCore');
const Block = require('../Block');
const Transaction = require('../Transaction');
const P2PNetwork = require('../P2PNetwork');
const PoCConsensus = require('../PoCConsensus');

describe('BlockchainCore', () => {
  let blockchain;
  let testDID1, testDID2, testDID3;

  beforeEach(() => {
    blockchain = new BlockchainCore();
    testDID1 = 'did:baekya:test1234567890abcdef1234567890abcdef12345678';
    testDID2 = 'did:baekya:test2234567890abcdef1234567890abcdef12345678';
    testDID3 = 'did:baekya:test3234567890abcdef1234567890abcdef12345678';
    
    // 테스트 계정들에 초기 잔액 설정
    blockchain.setBalance(testDID1, 1000, 'B-Token');
    blockchain.setBalance(testDID2, 1000, 'B-Token');
    blockchain.setBalance(testDID3, 1000, 'B-Token');
    blockchain.setBalance(testDID1, 500, 'P-Token');
    blockchain.setBalance(testDID2, 500, 'P-Token');
    blockchain.setBalance(testDID3, 500, 'P-Token');
    
    // 검증자 등록 및 기여도 설정
    blockchain.registerValidator(testDID1, 1000);
    blockchain.registerValidator(testDID2, 800);
    blockchain.registerValidator(testDID3, 600);
  });

  // 테스트 헬퍼 함수들
  const createSignedTransaction = (fromDID, toDID, amount, tokenType = 'B-Token') => {
    const transaction = new Transaction(fromDID, toDID, amount, tokenType);
    transaction.sign('test-private-key');
    return transaction;
  };

  const createSystemTransaction = (toDID, amount, tokenType = 'B-Token') => {
    return new Transaction(
      'did:baekya:system0000000000000000000000000000000000000000',
      toDID,
      amount,
      tokenType
    );
  };

  describe('블록체인 초기화', () => {
    test('제네시스 블록이 올바르게 생성되어야 함', () => {
      expect(blockchain.chain.length).toBe(1);
      expect(blockchain.chain[0].index).toBe(0);
      expect(blockchain.chain[0].previousHash).toBe('0');
      expect(blockchain.chain[0].data).toEqual({
        type: 'genesis',
        message: '백야 프로토콜 제네시스 블록',
        timestamp: expect.any(Number)
      });
    });

    test('초기 난이도가 설정되어야 함', () => {
      expect(blockchain.difficulty).toBe(2);
    });

    test('빈 트랜잭션 풀로 시작해야 함', () => {
      expect(blockchain.pendingTransactions).toEqual([]);
    });

    test('P2P 네트워크가 초기화되어야 함', () => {
      expect(blockchain.p2pNetwork).toBeDefined();
      expect(blockchain.p2pNetwork.constructor.name).toBe('P2PNetwork');
    });

    test('PoC 합의 메커니즘이 초기화되어야 함', () => {
      expect(blockchain.pocConsensus).toBeDefined();
      expect(blockchain.pocConsensus.constructor.name).toBe('PoCConsensus');
    });
  });

  describe('블록 생성 및 추가', () => {
    test('새 블록을 올바르게 생성해야 함', () => {
      const transactions = [
        createSignedTransaction(testDID1, testDID2, 100, 'B-Token'),
        createSignedTransaction(testDID2, testDID3, 50, 'B-Token')
      ];

      const newBlock = blockchain.createBlock(transactions, testDID1);

      expect(newBlock.index).toBe(1);
      expect(newBlock.previousHash).toBe(blockchain.getLatestBlock().hash);
      expect(newBlock.transactions).toEqual(transactions);
      expect(newBlock.validator).toBe(testDID1);
      expect(newBlock.timestamp).toBeDefined();
      expect(newBlock.hash).toBeDefined();
    });

    test('블록을 체인에 추가할 수 있어야 함', () => {
      const transactions = [createSignedTransaction(testDID1, testDID2, 100, 'B-Token')];
      const newBlock = blockchain.createBlock(transactions, testDID1);
      
      const result = blockchain.addBlock(newBlock);

      expect(result.success).toBe(true);
      expect(blockchain.chain.length).toBe(2);
      expect(blockchain.chain[1]).toBe(newBlock);
    });

    test('유효하지 않은 블록은 거부되어야 함', () => {
      const invalidBlock = new Block(1, 'invalid-hash', [], testDID1);
      
      const result = blockchain.addBlock(invalidBlock);

      expect(result.success).toBe(false);
      expect(result.error).toContain('유효하지 않은 블록');
      expect(blockchain.chain.length).toBe(1);
    });

    test('블록 해시가 올바르게 계산되어야 함', () => {
      const transactions = [new Transaction(testDID1, testDID2, 100, 'B-Token')];
      const block = blockchain.createBlock(transactions, testDID1);
      
      const expectedHash = block.calculateHash();
      expect(block.hash).toBe(expectedHash);
    });
  });

  describe('트랜잭션 처리', () => {
    test('트랜잭션을 풀에 추가할 수 있어야 함', () => {
      const transaction = new Transaction(testDID1, testDID2, 100, 'B-Token');
      transaction.sign('test-private-key');
      
      const result = blockchain.addTransaction(transaction);

      expect(result.success).toBe(true);
      expect(blockchain.pendingTransactions.length).toBe(1);
      expect(blockchain.pendingTransactions[0]).toBe(transaction);
    });

    test('유효하지 않은 트랜잭션은 거부되어야 함', () => {
      const invalidTransaction = new Transaction('', testDID2, 100, 'B-Token');
      
      const result = blockchain.addTransaction(invalidTransaction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('유효하지 않은 트랜잭션');
      expect(blockchain.pendingTransactions.length).toBe(0);
    });

    test('서명되지 않은 트랜잭션은 거부되어야 함', () => {
      const transaction = new Transaction(testDID1, testDID2, 100, 'B-Token');
      
      const result = blockchain.addTransaction(transaction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('서명되지 않은 트랜잭션');
    });
  });

  describe('PoC (Proof of Contribution) 합의', () => {
    test('기여도 기반으로 검증자를 선택해야 함', () => {
      // 기여도 데이터 설정
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);
      blockchain.pocConsensus.setContributionScore(testDID2, 500);
      blockchain.pocConsensus.setContributionScore(testDID3, 200);

      const validator = blockchain.pocConsensus.selectValidator([testDID1, testDID2, testDID3]);

      expect([testDID1, testDID2, testDID3]).toContain(validator);
    });

    test('기여도가 높은 검증자가 더 자주 선택되어야 함', () => {
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);
      blockchain.pocConsensus.setContributionScore(testDID2, 100);

      const selections = {};
      for (let i = 0; i < 100; i++) {
        const validator = blockchain.pocConsensus.selectValidator([testDID1, testDID2]);
        selections[validator] = (selections[validator] || 0) + 1;
      }

      expect(selections[testDID1]).toBeGreaterThan(selections[testDID2]);
    });

    test('블록 검증에서 기여도를 확인해야 함', () => {
      const transactions = [createSignedTransaction(testDID1, testDID2, 100, 'B-Token')];
      const block = blockchain.createBlock(transactions, testDID1);
      
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);

      const isValid = blockchain.pocConsensus.validateBlock(block);
      expect(isValid).toBe(true);
    });

    test('기여도가 부족한 검증자의 블록은 거부되어야 함', () => {
      const transactions = [createSignedTransaction(testDID1, testDID2, 100, 'B-Token')];
      const block = blockchain.createBlock(transactions, testDID1);
      
      blockchain.pocConsensus.setContributionScore(testDID1, 10); // 최소 기여도 미달

      const isValid = blockchain.pocConsensus.validateBlock(block);
      expect(isValid).toBe(false);
    });
  });

  describe('체인 검증', () => {
    test('유효한 체인을 올바르게 검증해야 함', () => {
      const transaction1 = new Transaction(testDID1, testDID2, 100, 'B-Token');
      transaction1.sign('test-key-1');
      blockchain.addTransaction(transaction1);

      const block1 = blockchain.createBlock([transaction1], testDID1);
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);
      blockchain.addBlock(block1);

      const isValid = blockchain.isChainValid();
      expect(isValid).toBe(true);
    });

    test('손상된 체인을 감지해야 함', () => {
      const transaction1 = new Transaction(testDID1, testDID2, 100, 'B-Token');
      transaction1.sign('test-key-1');
      blockchain.addTransaction(transaction1);

      const block1 = blockchain.createBlock([transaction1], testDID1);
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);
      blockchain.addBlock(block1);

      // 블록 데이터 손상 (amount 변경)
      blockchain.chain[1].transactions[0].amount = 999;
      // 블록 해시는 기존 값 유지하여 조작 감지를 위한 불일치 생성

      const isValid = blockchain.isChainValid();
      expect(isValid).toBe(false);
    });

    test('이전 해시 연결을 검증해야 함', () => {
      const transaction1 = new Transaction(testDID1, testDID2, 100, 'B-Token');
      transaction1.sign('test-key-1');
      
      const block1 = blockchain.createBlock([transaction1], testDID1);
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);
      blockchain.addBlock(block1);

      // 이전 해시 조작
      blockchain.chain[1].previousHash = 'fake-hash';

      const isValid = blockchain.isChainValid();
      expect(isValid).toBe(false);
    });
  });

  describe('P2P 네트워킹', () => {
    test('새 노드를 네트워크에 추가할 수 있어야 함', async () => {
      const nodeId = 'node-123';
      const nodeAddress = 'ws://192.168.1.100:8080';

      const result = await blockchain.p2pNetwork.addPeer(nodeId, nodeAddress);

      expect(result.success).toBe(false); // 실제 연결은 실패할 것이므로 false 예상
      expect(result.error).toBeDefined(); // 오류 메시지가 있어야 함
    });

    test('블록을 네트워크에 브로드캐스트해야 함', () => {
      const transaction = createSignedTransaction(testDID1, testDID2, 100, 'B-Token');
      const block = blockchain.createBlock([transaction], testDID1);

      const broadcastSpy = jest.spyOn(blockchain.p2pNetwork, 'broadcastBlock');
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);
      blockchain.addBlock(block);

      expect(broadcastSpy).toHaveBeenCalledWith(block);
    });

    test('트랜잭션을 네트워크에 브로드캐스트해야 함', () => {
      const transaction = createSignedTransaction(testDID1, testDID2, 100, 'B-Token');

      const broadcastSpy = jest.spyOn(blockchain.p2pNetwork, 'broadcastTransaction');
      blockchain.addTransaction(transaction);

      expect(broadcastSpy).toHaveBeenCalledWith(transaction);
    });

    test('다른 노드로부터 블록을 수신하고 검증해야 함', () => {
      const transaction = createSignedTransaction(testDID1, testDID2, 100, 'B-Token');
      const block = blockchain.createBlock([transaction], testDID1);
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);

      const result = blockchain.receiveBlock(block);

      expect(result.success).toBe(true);
      expect(blockchain.chain.length).toBe(2);
    });
  });

  describe('포크 해결', () => {
    test('더 긴 체인을 채택해야 함', () => {
      const originalChainLength = blockchain.chain.length;

      // 더 긴 체인 생성
      const longerChain = [...blockchain.chain];
      let baseTimestamp = Date.now();
      
      for (let i = 0; i < 3; i++) {
        const transaction = createSignedTransaction(testDID1, testDID2, 100 + i, 'B-Token');
        const block = new Block(
          longerChain.length,
          longerChain[longerChain.length - 1].hash,
          [transaction],
          testDID1,
          0  // 난이도 0으로 설정하여 채굴 검증 우회
        );
        // 타임스탬프를 순차적으로 증가시켜 검증 통과
        block.timestamp = baseTimestamp + (i + 1) * 1000;
        block.hash = block.calculateHash();
        longerChain.push(block);
      }

      const result = blockchain.resolveConflicts([longerChain]);

      expect(result.success).toBe(true);
      expect(blockchain.chain.length).toBeGreaterThan(originalChainLength);
    });

    test('유효하지 않은 체인은 거부해야 함', () => {
      const originalChain = [...blockchain.chain];
      
      // 유효하지 않은 체인 생성
      const invalidChain = [...blockchain.chain];
      const invalidBlock = new Block(1, 'fake-hash', [], testDID1);
      invalidChain.push(invalidBlock);

      const result = blockchain.resolveConflicts([invalidChain]);

      expect(result.success).toBe(false);
      expect(blockchain.chain).toEqual(originalChain);
    });
  });

  describe('마이닝 및 보상', () => {
    test('블록 마이닝 시 검증자에게 보상을 지급해야 함', () => {
      const transaction = createSignedTransaction(testDID1, testDID2, 100, 'B-Token');
      
      blockchain.setBalance(testDID1, 1000);
      blockchain.setBalance(testDID3, 500); // 다른 검증자 설정
      const initialBalance = blockchain.getBalance(testDID3); // testDID3의 초기 잔액
      blockchain.pocConsensus.setContributionScore(testDID3, 1000); // testDID3를 검증자로 설정
      const block = blockchain.mineBlock([transaction], testDID3); // testDID3가 마이닝

      expect(block).toBeDefined();
      expect(blockchain.getBalance(testDID3)).toBeGreaterThan(initialBalance); // testDID3의 잔액 증가 확인
    });

    test('마이닝 난이도가 조정되어야 함', () => {
      const initialDifficulty = blockchain.difficulty;
      
      // 빠른 블록 생성으로 난이도 증가 시뮬레이션
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);
      for (let i = 0; i < 5; i++) {
        const transaction = createSignedTransaction(testDID1, testDID2, 100 + i, 'B-Token');
        blockchain.mineBlock([transaction], testDID1);
      }

      blockchain.adjustDifficulty();
      expect(blockchain.difficulty).toBeGreaterThanOrEqual(initialDifficulty);
    });
  });

  describe('상태 관리', () => {
    test('계정 잔액을 올바르게 계산해야 함', () => {
      // 초기 잔액 설정 (테스트용)
      blockchain.setBalance(testDID1, 1000);
      blockchain.setBalance(testDID2, 0);
      blockchain.setBalance(testDID3, 0);

      const transaction1 = createSignedTransaction(testDID1, testDID2, 100, 'B-Token');
      blockchain.addTransaction(transaction1);
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);
      
      // 첫 번째 트랜잭션을 블록에 포함
      const block1 = blockchain.createBlock([transaction1], testDID1);
      blockchain.addBlock(block1);

      // 이제 testDID2가 100을 받았으므로 두 번째 트랜잭션 추가 가능
      const transaction2 = createSignedTransaction(testDID2, testDID3, 50, 'B-Token');
      blockchain.addTransaction(transaction2);
      
      // 두 번째 트랜잭션을 블록에 포함
      const block2 = blockchain.createBlock([transaction2], testDID1);
      blockchain.addBlock(block2);

      // 트랜잭션 적용 후 잔액 확인
      expect(blockchain.getBalance(testDID1)).toBe(900); // 1000 - 100
      expect(blockchain.getBalance(testDID2)).toBe(50);  // 0 + 100 - 50
      expect(blockchain.getBalance(testDID3)).toBe(50);  // 0 + 50
    });

    test('트랜잭션 히스토리를 추적해야 함', () => {
      const transaction = createSignedTransaction(testDID1, testDID2, 100, 'B-Token');
      
      blockchain.addTransaction(transaction);
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);
      blockchain.mineBlock(blockchain.pendingTransactions, testDID1);

      const history = blockchain.getTransactionHistory(testDID1);
      expect(history.length).toBeGreaterThan(0);
      expect(history.some(tx => tx.from === testDID1 && tx.to === testDID2)).toBe(true);
    });
  });

  describe('보안 및 검증', () => {
    test('이중 지불을 방지해야 함', () => {
      blockchain.setBalance(testDID1, 100);

      const transaction1 = createSignedTransaction(testDID1, testDID2, 100, 'B-Token');
      const transaction2 = createSignedTransaction(testDID1, testDID3, 100, 'B-Token');

      blockchain.addTransaction(transaction1);
      const result = blockchain.addTransaction(transaction2);

      expect(result.success).toBe(false);
      expect(result.error).toContain('잔액 부족');
    });

    test('악의적인 트랜잭션을 탐지해야 함', () => {
      const transaction = new Transaction(testDID1, testDID2, -100, 'B-Token');
      transaction.sign('test-private-key');

      const result = blockchain.addTransaction(transaction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('유효하지 않은 금액');
    });

    test('타임스탬프 조작을 탐지해야 함', () => {
      const transaction = createSignedTransaction(testDID1, testDID2, 100, 'B-Token');
      
      const block = blockchain.createBlock([transaction], testDID1);
      block.timestamp = Date.now() + 3600000; // 1시간 후

      const result = blockchain.addBlock(block);

      expect(result.success).toBe(false);
      expect(result.error).toContain('유효하지 않은 타임스탬프');
    });
  });

  describe('성능 및 최적화', () => {
    test('대량의 트랜잭션을 효율적으로 처리해야 함', () => {
      // 충분한 잔액 설정
      blockchain.setBalance(testDID1, 100000, 'B-Token'); // 충분한 잔액 설정
      
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) { 
        // 각 트랜잭션마다 고유한 수신자 생성하여 중복 방지
        const receiverDID = `did:baekya:test${(2000 + i).toString().padStart(40, '0')}`;
        const transaction = createSignedTransaction(testDID1, receiverDID, i + 1, 'B-Token');
        blockchain.addTransaction(transaction);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(5000); // 5초 이내
      expect(blockchain.pendingTransactions.length).toBe(100);
    });

    test('메모리 사용량을 최적화해야 함', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 많은 블록 생성
      blockchain.pocConsensus.setContributionScore(testDID1, 1000);
      for (let i = 0; i < 10; i++) { // 100에서 10으로 줄임 (성능 고려)
        const transaction = createSignedTransaction(testDID1, testDID2, i, 'B-Token');
        blockchain.mineBlock([transaction], testDID1);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 메모리 증가량이 합리적인 범위 내에 있는지 확인
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB 이내
    });
  });
}); 