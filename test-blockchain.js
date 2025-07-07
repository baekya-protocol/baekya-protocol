const fs = require('fs');
const path = require('path');

// 블록체인 데이터 읽기
const dataPath = path.join(__dirname, 'baekya_data', 'protocol_data.json');

if (fs.existsSync(dataPath)) {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  console.log('🔗 백야 프로토콜 블록체인 상태');
  console.log('================================');
  console.log(`총 블록 수: ${data.blockchain.length}`);
  console.log(`총 트랜잭션 수: ${data.transactions.length}`);
  console.log(`검증자 풀 총 후원액: ${data.validatorPool.totalStake} B`);
  console.log('\n📊 토큰 잔액:');
  
  // B-Token 잔액
  const bTokens = data.tokens.bTokenBalances;
  for (const [did, balance] of Object.entries(bTokens)) {
    console.log(`  ${did.substring(0, 20)}...: ${balance} B`);
  }
  
  console.log('\n⛓️ 최신 블록:');
  const latestBlock = data.blockchain[data.blockchain.length - 1];
  console.log(`  인덱스: ${latestBlock.index}`);
  console.log(`  해시: ${latestBlock.hash.substring(0, 32)}...`);
  console.log(`  트랜잭션 수: ${latestBlock.transactions.length}`);
  console.log(`  검증자: ${latestBlock.validator.substring(0, 20)}...`);
  
} else {
  console.log('❌ 블록체인 데이터 파일이 없습니다.');
} 