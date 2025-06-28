const crypto = require('crypto');

class Block {
  constructor(index, previousHash, transactions, validator, difficulty = 2) {
    this.index = index;
    this.previousHash = previousHash;
    this.transactions = transactions || [];
    this.validator = validator; // 검증자 DID
    this.timestamp = Date.now();
    this.difficulty = difficulty;
    this.nonce = 0;
    this.merkleRoot = this.calculateMerkleRoot();
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto.createHash('sha256')
      .update(
        this.index +
        this.previousHash +
        this.timestamp +
        this.merkleRoot +
        this.validator +
        this.nonce
      )
      .digest('hex');
  }

  calculateMerkleRoot() {
    if (this.transactions.length === 0) {
      return crypto.createHash('sha256').update('').digest('hex');
    }

    // 트랜잭션의 현재 데이터로 해시를 항상 재계산하여 조작 감지
    let txHashes = this.transactions.map(tx => {
      // 항상 현재 데이터로 해시 계산 (조작 감지를 위해)
      const txData = tx.fromDID + tx.toDID + tx.amount + tx.tokenType + 
                    JSON.stringify(tx.data || {}) + tx.timestamp + (tx.signature || '');
      return crypto.createHash('sha256').update(txData).digest('hex');
    });
    
    while (txHashes.length > 1) {
      const newHashes = [];
      
      for (let i = 0; i < txHashes.length; i += 2) {
        const left = txHashes[i];
        const right = txHashes[i + 1] || txHashes[i]; // 홀수개일 경우 마지막 해시 중복
        
        const combined = crypto.createHash('sha256')
          .update(left + right)
          .digest('hex');
        
        newHashes.push(combined);
      }
      
      txHashes = newHashes;
    }

    return txHashes[0];
  }

  mineBlock() {
    const target = Array(this.difficulty + 1).join('0');
    
    while (this.hash.substring(0, this.difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }

    console.log(`🔨 블록 채굴 완료: ${this.hash}`);
    return this.hash;
  }

  isValid(previousBlock = null) {
    // 머클루트 검증 (트랜잭션 무결성 확인) - 가장 먼저 검사
    const currentMerkleRoot = this.calculateMerkleRoot();
    if (this.merkleRoot !== currentMerkleRoot) {
      console.error('❌ 머클루트가 올바르지 않습니다 - 트랜잭션이 조작되었습니다');
      return false;
    }

    // 해시 검증
    if (this.hash !== this.calculateHash()) {
      console.error('❌ 블록 해시가 올바르지 않습니다');
      return false;
    }

    // 이전 블록과의 연결 검증
    if (previousBlock && this.previousHash !== previousBlock.hash) {
      console.error('❌ 이전 블록 해시가 일치하지 않습니다');
      return false;
    }

    // 인덱스 검증
    if (previousBlock && this.index !== previousBlock.index + 1) {
      console.error('❌ 블록 인덱스가 올바르지 않습니다');
      return false;
    }

    // 타임스탬프 검증 (이전 블록보다 나중이어야 함)
    if (previousBlock && this.timestamp <= previousBlock.timestamp) {
      console.error('❌ 블록 타임스탬프가 올바르지 않습니다');
      return false;
    }

    // 트랜잭션 검증
    for (const tx of this.transactions) {
      if (!tx.isValid()) {
        console.error('❌ 유효하지 않은 트랜잭션이 포함되어 있습니다');
        return false;
      }
    }

    // 검증자 DID 형식 검증
    const didPattern = /^did:baekya:[a-f0-9]{40}$/;
    const systemDIDPattern = /^did:baekya:system[0-9a-f]{32}$/;
    const testDIDPattern = /^did:baekya:test[a-f0-9]{40,48}$/;
    const genesisDIDPattern = /^did:baekya:genesis[0-9a-f]{32}$/;
    
    const isValidValidator = didPattern.test(this.validator) || 
                            systemDIDPattern.test(this.validator) || 
                            testDIDPattern.test(this.validator) ||
                            genesisDIDPattern.test(this.validator);
    
    if (!isValidValidator) {
      console.error('❌ 유효하지 않은 검증자 DID입니다');
      return false;
    }

    // 채굴 난이도 검증 (제네시스 블록은 예외)
    if (this.index > 0 && this.difficulty > 0) {
      const target = Array(this.difficulty + 1).join('0');
      if (this.hash.substring(0, this.difficulty) !== target) {
        console.error('❌ 블록이 채굴 난이도를 만족하지 않습니다');
        return false;
      }
    }

    return true;
  }

  addTransaction(transaction) {
    if (!transaction.isValid()) {
      throw new Error('유효하지 않은 트랜잭션입니다');
    }

    this.transactions.push(transaction);
    this.merkleRoot = this.calculateMerkleRoot();
    this.hash = this.calculateHash();
  }

  getTransactionsByType(tokenType) {
    return this.transactions.filter(tx => tx.tokenType === tokenType);
  }

  getTransactionsByDID(did) {
    return this.transactions.filter(tx => tx.fromDID === did || tx.toDID === did);
  }

  // 블록에 포함된 총 거래량 계산
  getTotalVolume(tokenType = null) {
    let transactions = this.transactions;
    
    if (tokenType) {
      transactions = transactions.filter(tx => tx.tokenType === tokenType);
    }

    return transactions.reduce((total, tx) => total + tx.amount, 0);
  }

  // 제네시스 블록 생성
  static createGenesisBlock() {
    return new Block(
      0, 
      '0', 
      [], 
      'did:baekya:genesis000000000000000000000000000000000000',
      0 // 제네시스 블록은 채굴하지 않음
    );
  }

  toJSON() {
    return {
      index: this.index,
      previousHash: this.previousHash,
      transactions: this.transactions.map(tx => tx.toJSON ? tx.toJSON() : tx),
      validator: this.validator,
      timestamp: this.timestamp,
      difficulty: this.difficulty,
      nonce: this.nonce,
      merkleRoot: this.merkleRoot,
      hash: this.hash
    };
  }

  static fromJSON(data) {
    const Transaction = require('./Transaction');
    
    const block = new Block(
      data.index,
      data.previousHash,
      data.transactions.map(tx => Transaction.fromJSON ? Transaction.fromJSON(tx) : tx),
      data.validator,
      data.difficulty
    );
    
    block.timestamp = data.timestamp;
    block.nonce = data.nonce;
    block.merkleRoot = data.merkleRoot;
    block.hash = data.hash;
    
    return block;
  }
}

module.exports = Block; 