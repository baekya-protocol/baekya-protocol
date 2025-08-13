#!/usr/bin/env node

/**
 * 백야 프로토콜 검증자 노드
 * 블록 검증과 릴레이 연결 기능만 제공
 */

const path = require('path');

// 환경 설정
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('📌 NODE_ENV를 development로 설정했습니다.');
}

console.log('\n🌟 백야 프로토콜 시작');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚙️  환경: 개발/테스트넷');
console.log('🔗 네트워크: LOCAL');
console.log('👤 역할: VALIDATOR NODE (검증자 전용)');
console.log('📞 통신주소: 입력 필요');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n🚀 "기여한 만큼 보장받는" 사회규약을 실현하기 위한');
console.log('📜 기여기반 탈중앙 사회시스템이 시작됩니다...\n');

// 필요한 모듈만 직접 로드
const BlockchainCore = require('./src/blockchain/BlockchainCore');
const DataStorage = require('./src/storage/DataStorage');
const SimpleAuth = require('./src/auth/SimpleAuth');
const RelayManager = require('./src/network/RelayManager');

// 전역 변수
let blockchain;
let storage;
let authSystem;
let relayManager;
let validatorDID;

// 검증자 초기화 (핵심 기능만)
async function initializeValidator() {
  try {
    console.log('🚀 백야 프로토콜 검증자 초기화 중...');
    
    // 데이터 저장소 초기화
    console.log('💾 데이터 저장소 초기화...');
    storage = new DataStorage();
    
    // 인증 시스템 초기화 (검증자 DID 관리용)
    console.log('🔐 인증 시스템 초기화...');
    authSystem = new SimpleAuth();
    authSystem.setDataStorage(storage);
    
    // 블록체인 코어 초기화
    console.log('⛓️ 블록체인 코어 초기화...');
    blockchain = new BlockchainCore();
    blockchain.setDataStorage(storage);
    
    // 검증자 DID 설정 (기존 데이터에서 첫 번째 검증자 사용)
    const storedUsers = storage.data.users || {};
    const validatorUsers = Object.entries(storedUsers).filter(([did, user]) => 
      user.role === 'validator' || user.username === 'founder'
    );
    
    if (validatorUsers.length > 0) {
      validatorDID = validatorUsers[0][0]; // 첫 번째 검증자 DID 사용
      console.log(`👤 검증자 DID: ${validatorDID.substring(0, 20)}...`);
    } else {
      console.log('⚠️ 검증자 DID를 찾을 수 없습니다. Founder 계정을 사용합니다.');
      // 간단한 기본 검증자 DID 생성
      validatorDID = 'did:baekya:validator' + Date.now();
    }
    
    console.log('✅ 검증자 초기화 완료');
    
    // RelayManager 초기화
  console.log('🔍 릴레이 매니저로 동적 릴레이 연결 시작...');
    relayManager = new RelayManager();
    
    // 릴레이 연결 이벤트 핸들러
    relayManager.on('connected', (relayInfo) => {
      console.log(`✅ 릴레이 연결됨: ${relayInfo.url}`);
      console.log(`🆔 릴레이 노드 ID: ${relayInfo.nodeId}`);
      
      // 검증자 등록
      registerAsValidator();
      
      // 터미널 UI는 릴레이 연결 후 1초 뒤에 시작
      setTimeout(() => {
        setupTerminalInterface();
      }, 1000);
    });
    
    relayManager.on('disconnected', () => {
      console.log('🔌 릴레이 연결이 끊어짐 - 자동 재연결 시도 중...');
    });
    
    relayManager.on('message', (message) => {
      if (message && typeof message === 'object') {
        handleRelayMessage(message);
      } else {
        console.warn('⚠️ 잘못된 릴레이 메시지 형식:', message);
      }
    });
    
    // 릴레이 연결 시작
    await relayManager.connect();
    
  } catch (error) {
    console.error('❌ 검증자 초기화 실패:', error);
    process.exit(1);
  }
}

// 검증자로 등록
function registerAsValidator() {
  try {
    if (validatorDID) {
      console.log(`👤 검증자 등록: ${validatorDID.substring(0, 20)}...`);
      
      // 릴레이에 검증자로 등록
      relayManager.send({
        type: 'register_validator',
        validatorDID: validatorDID,
          timestamp: Date.now()
      });
        } else {
      console.warn('⚠️ 검증자 DID가 설정되지 않았습니다');
    }
              } catch (error) {
    console.error('❌ 검증자 등록 실패:', error);
  }
}

// 릴레이 메시지 처리
function handleRelayMessage(message) {
  if (!message || !message.type) {
    console.warn('⚠️ 릴레이 메시지에 타입이 없습니다:', message);
    return;
  }

  switch (message.type) {
    case 'relay_operator_info':
      // 릴레이 운영자 정보 저장
      if (message.operatorDID && message.operatorUsername && message.nodeId) {
        relayManager.relayOperatorDID = message.operatorDID;
        relayManager.relayOperatorUsername = message.operatorUsername;
        relayManager.relayNodeId = message.nodeId;
        console.log(`👤 릴레이 운영자: ${message.operatorUsername} (${message.operatorDID.substring(0, 8)}...)`);
      }
                  break;
      
    case 'new_block_received':
      // 다른 릴레이에서 받은 블록 처리
      try {
        const { blockData, sourceRelay } = message;
        if (blockData) {
          console.log(`📦 릴레이에서 블록 수신: #${blockData.index} (from ${sourceRelay?.substring(0, 8)}...)`);
          const result = blockchain.addExternalBlock(blockData);
    if (result.success) {
            console.log(`✅ 외부 블록 #${blockData.index} 추가 완료`);
          } else {
            console.warn(`⚠️ 외부 블록 #${blockData.index} 추가 실패: ${result.error}`);
          }
        }
      } catch (error) {
        console.error('❌ 릴레이 블록 처리 실패:', error.message);
      }
              break;
      
    case 'transaction':
      // 릴레이에서 받은 트랜잭션 처리
      try {
        const { transaction, sourceRelay } = message;
        if (transaction) {
          console.log(`📨 릴레이에서 트랜잭션 수신: ${transaction.id || transaction.hash || 'unknown'} (from ${sourceRelay?.substring(0, 8)}...)`);
          
          // Transaction 클래스 인스턴스로 복원
    const Transaction = require('./src/blockchain/Transaction');
          const restoredTransaction = new Transaction(
            transaction.fromDID || transaction.from,
            transaction.toDID || transaction.to,
            transaction.amount,
            transaction.tokenType,
            transaction.data
          );
          
          // 메타데이터 복사
          if (transaction.signature) restoredTransaction.signature = transaction.signature;
          if (transaction.hash) restoredTransaction.hash = transaction.hash;
          if (transaction.id) restoredTransaction.id = transaction.id;
          if (transaction.timestamp) restoredTransaction.timestamp = transaction.timestamp;
          if (transaction.nonce) restoredTransaction.nonce = transaction.nonce;
          
          console.log(`🔄 트랜잭션 객체 복원 완료: ${restoredTransaction.id || restoredTransaction.hash}`);
      
      // 블록체인에 트랜잭션 추가
          const addResult = blockchain.addTransaction(restoredTransaction);
          
          if (addResult.success) {
            console.log(`✅ 릴레이 트랜잭션 추가 완료: ${restoredTransaction.id || restoredTransaction.hash || 'unknown'}`);
      } else {
            console.warn(`⚠️ 릴레이 트랜잭션 추가 실패: ${addResult.error}`);
            if (addResult.details) {
              console.warn(`   세부사항: ${JSON.stringify(addResult.details)}`);
            }
          }
      }
    } catch (error) {
        console.error('❌ 릴레이 트랜잭션 처리 실패:', error.message);
        console.error('❌ 트랜잭션 상세:', JSON.stringify(message.transaction, null, 2));
      }
      break;
      
    default:
      console.log(`❓ 알 수 없는 릴레이 메시지 타입: ${message.type}`);
      break;
  }
}

// 블록 생성 및 릴레이 전파
function generateBlock() {
  try {
    // 블록 생성
    const block = blockchain.generateBlock(validatorDID);
    
    if (block) {
      console.log(`⛏️ 새 블록 생성 완료 - 인덱스: ${block.index}, 검증자: ${validatorDID?.substring(0, 20)}...`);
      
      // 릴레이 보상 처리 (간소화된 버전)
      if (relayManager && relayManager.isConnected() && relayManager.relayOperatorDID) {
        try {
          const relayRewardAmount = 0.25; // 0.25B
        const Transaction = require('./src/blockchain/Transaction');
          
      const rewardTransaction = new Transaction(
            'did:baekya:system000000000000000000000000000000000', // 시스템에서
            relayManager.relayOperatorDID, // 릴레이 운영자에게
            relayRewardAmount,
        'B-Token',
            {
              type: 'relay_reward',
              blockIndex: block.index,
              relayNodeId: relayManager.relayNodeId,
              description: `블록 #${block.index} 전파 보상`
            }
          );
          
          rewardTransaction.sign('test-private-key');
          
          // 블록에 릴레이 보상 트랜잭션 추가
          block.transactions.push(rewardTransaction);
          
          console.log(`💰 릴레이 노드 보상: ${relayRewardAmount}B → ${relayManager.relayOperatorDID?.substring(0, 8)}...`);
  } catch (error) {
          console.warn('⚠️ 릴레이 노드 보상 처리 실패:', error.message);
        }
      }
      
      // 릴레이에 블록 전파
      if (relayManager && relayManager.isConnected()) {
        relayManager.send({
          type: 'block_propagation',
          blockData: {
            index: block.index,
            hash: block.hash,
            transactions: block.transactions,
            timestamp: block.timestamp,
            previousHash: block.previousHash,
            validator: validatorDID
          },
          sourceValidator: validatorDID,
          timestamp: Date.now()
        });
        
        console.log(`📡 블록 #${block.index} 릴레이 전파 완료`);
      }
    }
  } catch (error) {
    console.error('❌ 블록 생성 실패:', error);
  }
}

// 터미널 인터페이스 설정
function setupTerminalInterface() {
  const readline = require('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('🔧 백야 프로토콜 검증자 모드');
  console.log('='.repeat(50));
  console.log('📋 사용 가능한 명령어:');
  console.log('  status   - 검증자 상태 확인');
  console.log('  mine     - 수동 블록 생성');
  console.log('  balance  - 잔액 확인');
  console.log('  relay    - 릴레이 연결 상태');
  console.log('  exit     - 검증자 종료');
  console.log('='.repeat(50));
  
  const askCommand = () => {
    rl.question('🔧 명령어 입력 > ', (command) => {
      handleCommand(command.trim(), rl, askCommand);
    });
  };
  
  askCommand();
}

// 명령어 처리
function handleCommand(command, rl, askCommand) {
  switch (command.toLowerCase()) {
    case 'status':
      showValidatorStatus();
      break;
      
    case 'mine':
      console.log('⛏️ 수동 블록 생성 중...');
      generateBlock();
      break;
      
    case 'balance':
      showBalance();
      break;
      
    case 'relay':
      showRelayStatus();
      break;
      
    case 'exit':
      console.log('👋 검증자를 종료합니다...');
      rl.close();
      process.exit(0);
      break;
      
    default:
      console.log('❓ 알 수 없는 명령어입니다. 다시 시도해주세요.');
      break;
  }
  
  askCommand();
}

// 검증자 상태 표시
function showValidatorStatus() {
  try {
    console.log('\n📊 검증자 상태:');
    console.log(`  🆔 DID: ${validatorDID ? validatorDID.substring(0, 30) + '...' : 'N/A'}`);
    console.log(`  ⛓️ 블록 수: ${blockchain.chain.length}`);
    console.log(`  📄 대기 트랜잭션: ${blockchain.pendingTransactions.length}`);
    console.log(`  🔗 릴레이 연결: ${relayManager.isConnected() ? '✅ 연결됨' : '❌ 끊어짐'}`);
  } catch (error) {
    console.log('❌ 상태 조회 실패:', error.message);
  }
}

// 잔액 표시
function showBalance() {
  try {
    if (!validatorDID) {
      console.log('❌ 검증자 DID가 설정되지 않았습니다.');
      return;
    }
    
    const balance = blockchain.getBalance(validatorDID, 'B-Token');
    console.log(`\n💰 현재 잔액: ${balance}B`);
  } catch (error) {
    console.log('❌ 잔액 조회 실패:', error.message);
  }
}

// 릴레이 상태 표시
function showRelayStatus() {
  try {
    console.log('\n🔗 릴레이 연결 상태:');
    console.log(`  상태: ${relayManager.isConnected() ? '✅ 연결됨' : '❌ 끊어짐'}`);
    if (relayManager.isConnected()) {
      console.log(`  URL: ${relayManager.currentRelay?.url || 'N/A'}`);
      console.log(`  노드 ID: ${relayManager.currentRelay?.nodeId || 'N/A'}`);
      if (relayManager.relayOperatorDID) {
        console.log(`  운영자: ${relayManager.relayOperatorUsername || 'Unknown'} (${relayManager.relayOperatorDID.substring(0, 8)}...)`);
      }
    }
  } catch (error) {
    console.log('❌ 릴레이 상태 조회 실패:', error.message);
  }
}

// 자동 블록 생성 (30초마다)
function startBlockGeneration() {
  setInterval(() => {
    if (blockchain && validatorDID && relayManager.isConnected()) {
      if (blockchain.pendingTransactions.length > 0) {
        console.log('⏰ 자동 블록 생성 시간...');
  generateBlock();
      }
    }
  }, 30000); // 30초마다
}

// 메인 실행
async function main() {
  try {
    await initializeValidator();
    
    // 자동 블록 생성 시작
    startBlockGeneration();
    
    console.log('🚀 검증자 시작 완료 - 릴레이 연결 대기 중...');
  } catch (error) {
    console.error('❌ 검증자 시작 실패:', error);
    process.exit(1);
  }
}

// 프로세스 종료 처리
process.on('SIGINT', () => {
  console.log('\n👋 검증자를 안전하게 종료합니다...');
  if (relayManager) {
    relayManager.disconnect();
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 예상치 못한 오류:', error);
  process.exit(1);
});

// 시작
main();
