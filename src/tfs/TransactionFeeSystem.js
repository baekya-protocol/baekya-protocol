/**
 * 백야 프로토콜 - 거래 수수료 시스템 (TFS)
 * 검증자 풀과 DAO 금고로 수수료 분배
 */

class TransactionFeeSystem {
  constructor() {
    this.validatorPool = {
      totalFees: 0,
      validators: new Map(), // 검증자별 수수료 누적
      distributionHistory: []
    };

    this.daoTreasuries = new Map(); // DAO별 금고
    this.feeDistributionRatio = {
      validator: 0.6, // 검증자 풀 60%
      dao: 0.4 // DAO 금고 40%
    };

    this.transactionHistory = [];
    this.validatorRegistry = new Map(); // 검증자 등록부
  }



  /**
   * 거래 수수료 계산
   * @private
   */
  calculateTxFee(amount, tokenType) {
    // 기본 수수료율: B-Token 0.1%, P-Token 0.01%
    const baseFeeRate = tokenType === 'B' ? 0.001 : 0.0001;
    
    // 최소 수수료: 0.001 B-Token
    const minFee = 0.001;
    
    const calculatedFee = amount * baseFeeRate;
    return Math.max(calculatedFee, minFee);
  }

  /**
   * DAO별 수수료 분배 계산
   * @private
   */
  calculateDAODistribution(totalDAOShare, userContributions) {
    if (!userContributions || userContributions.length === 0) {
      return {};
    }

    // 총 기여량 계산
    const totalContributions = userContributions.reduce((sum, contrib) => sum + contrib.value, 0);
    
    if (totalContributions === 0) {
      return {};
    }

    // DAO별 기여 비율에 따른 분배
    const distribution = {};
    
    userContributions.forEach(contrib => {
      const ratio = contrib.value / totalContributions;
      distribution[contrib.daoId] = totalDAOShare * ratio;
    });

    return distribution;
  }

  /**
   * 검증자 풀에 수수료 분배
   * @private
   */
  distributeToValidatorPool(amount) {
    this.validatorPool.totalFees += amount;
    
    // 활성 검증자들에게 분배
    const activeValidators = Array.from(this.validatorRegistry.values())
      .filter(v => v.status === 'active');
    
    if (activeValidators.length > 0) {
      const sharePerValidator = amount / activeValidators.length;
      
      activeValidators.forEach(validator => {
        if (!this.validatorPool.validators.has(validator.validatorId)) {
          this.validatorPool.validators.set(validator.validatorId, 0);
        }
        
        const currentShare = this.validatorPool.validators.get(validator.validatorId);
        this.validatorPool.validators.set(validator.validatorId, currentShare + sharePerValidator);
      });
    }

    // 분배 기록
    this.validatorPool.distributionHistory.push({
      amount,
      validatorCount: activeValidators.length,
      timestamp: Date.now()
    });
  }

  /**
   * DAO 금고에 수수료 분배
   * @private
   */
  distributeToDAOTreasuries(distribution) {
    Object.entries(distribution).forEach(([daoId, amount]) => {
      if (!this.daoTreasuries.has(daoId)) {
        this.daoTreasuries.set(daoId, {
          daoId,
          balance: 0,
          transactions: [],
          createdAt: Date.now()
        });
      }

      const treasury = this.daoTreasuries.get(daoId);
      treasury.balance += amount;
      
      treasury.transactions.push({
        type: 'fee_distribution',
        amount,
        timestamp: Date.now(),
        description: '거래 수수료 분배'
      });

      console.log(`💰 DAO 금고 입금: ${daoId} +${amount} B`);
    });
  }

  /**
   * 거래 수수료 처리
   * @param {string} senderDID - 보낸 사람 DID
   * @param {string} receiverDID - 받는 사람 DID
   * @param {number} amount - 거래 금액
   * @param {string} tokenType - 토큰 타입 (B 또는 P)
   * @param {Array} userContributions - 사용자의 기여 내역 [{daoId, value}]
   */
  processTxFee(senderDID, receiverDID, amount, tokenType, userContributions = []) {
    try {
      // 입력 검증
      if (!senderDID || !receiverDID) {
        throw new Error('보낸 사람과 받는 사람의 DID가 필요합니다');
      }

      if (amount <= 0) {
        throw new Error('유효하지 않은 거래 금액입니다');
      }

      if (!['B', 'P'].includes(tokenType)) {
        throw new Error('지원되지 않는 토큰 타입입니다');
      }

      // 1. 거래 수수료 계산
      const txFee = this.calculateTxFee(amount, tokenType);
      
      // 2. 검증자 풀 분배 계산
      const validatorShare = txFee * this.feeDistributionRatio.validator;
      
      // 3. DAO 금고 분배 계산
      const daoShare = txFee * this.feeDistributionRatio.dao;
      
      // 4. DAO별 기여 비율에 따른 분배
      const daoDistribution = this.calculateDAODistribution(daoShare, userContributions);
      
      // 5. 수수료 분배 실행
      this.distributeToValidatorPool(validatorShare);
      this.distributeToDAOTreasuries(daoDistribution);
      
      // 6. 거래 기록
      const transaction = {
        id: this.generateTxId(),
        senderDID,
        receiverDID,
        amount,
        tokenType,
        txFee,
        validatorShare,
        daoShare,
        daoDistribution,
        timestamp: Date.now(),
        status: 'completed'
      };
      
      this.transactionHistory.push(transaction);
      
      console.log(`💰 거래 수수료 처리 완료: ${txFee} B-Token`);
      console.log(`  - 검증자 풀: ${validatorShare} B`);
      console.log(`  - DAO 금고: ${daoShare} B`);
      
      return {
        success: true,
        transaction,
        fees: {
          total: txFee,
          validatorShare,
          daoShare,
          daoDistribution
        }
      };
      
    } catch (error) {
      console.error('❌ 거래 수수료 처리 실패:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 검증자 등록 (통신주소 포함)
   */
  registerValidator(validatorId, validatorDID, stake, communicationAddress = null) {
    if (this.validatorRegistry.has(validatorId)) {
      const existingValidator = this.validatorRegistry.get(validatorId);
      
      // 이미 등록된 검증자인 경우 통신주소 업데이트
      if (communicationAddress && existingValidator.communicationAddress !== communicationAddress) {
        existingValidator.communicationAddress = communicationAddress;
        existingValidator.updatedAt = Date.now();
        
        console.log(`📞 검증자 통신주소 업데이트: ${validatorId} -> ${communicationAddress}`);
        
        return {
          success: true,
          validatorId,
          validator: existingValidator,
          message: '검증자 통신주소가 업데이트되었습니다'
        };
      }
      
      return {
        success: false,
        error: '이미 등록된 검증자입니다'
      };
    }

    const validator = {
      validatorId,
      validatorDID,
      stake,
      communicationAddress,
      status: 'active',
      registeredAt: Date.now(),
      lastActiveAt: Date.now(),
      totalRewards: 0,
      validatedTxCount: 0,
      rewardHistory: [],
      networkContribution: 0
    };

    this.validatorRegistry.set(validatorId, validator);
    
    console.log(`🔐 새로운 검증자 등록: ${validatorId}`);
    if (communicationAddress) {
      console.log(`📞 통신주소 연결: ${communicationAddress}`);
    }

    return {
      success: true,
      validatorId,
      validator,
      message: '검증자가 성공적으로 등록되었습니다'
    };
  }

  /**
   * 검증자 보상 지급 (스테이크 비율 기반)
   */
  distributeValidatorRewards() {
    const totalPool = this.validatorPool.totalFees;
    const activeValidators = Array.from(this.validatorRegistry.values())
      .filter(v => v.status === 'active');

    if (activeValidators.length === 0 || totalPool === 0) {
      return {
        success: false,
        error: '분배할 보상이 없거나 활성 검증자가 없습니다'
      };
    }

    // 총 스테이크 계산
    const totalStake = activeValidators.reduce((sum, v) => sum + v.stake, 0);
    const validatorRewards = [];

    activeValidators.forEach(validator => {
      // 스테이크 비율에 따른 보상 계산
      const stakeRatio = validator.stake / totalStake;
      const reward = totalPool * stakeRatio;
      
      validator.totalRewards += reward;
      validator.lastActiveAt = Date.now();
      validator.networkContribution += 1;
      
      // 보상 히스토리 기록
      const rewardRecord = {
        amount: reward,
        timestamp: Date.now(),
        stakeRatio,
        distributionRound: this.validatorPool.distributionHistory.length + 1,
        communicationAddress: validator.communicationAddress
      };
      
      if (!validator.rewardHistory) {
        validator.rewardHistory = [];
      }
      validator.rewardHistory.push(rewardRecord);
      
      // 최근 50개 기록만 유지
      if (validator.rewardHistory.length > 50) {
        validator.rewardHistory = validator.rewardHistory.slice(-50);
      }
      
      validatorRewards.push({
        validatorId: validator.validatorId,
        validatorDID: validator.validatorDID,
        communicationAddress: validator.communicationAddress,
        reward,
        stakeRatio,
        rewardRecord
      });

      // 통신주소가 있는 경우 로그 출력
      if (validator.communicationAddress) {
        console.log(`💰 검증자 보상: ${validator.communicationAddress} <- ${reward.toFixed(6)} B-Token`);
      }
    });

    // 검증자 풀 초기화
    this.validatorPool.totalFees = 0;
    this.validatorPool.validators.clear();

    console.log(`🎁 검증자 보상 지급 완료: ${activeValidators.length}명, 총 ${totalPool.toFixed(6)} B`);

    return {
      success: true,
      totalDistributed: totalPool,
      validatorCount: activeValidators.length,
      validatorRewards,
      distributionTimestamp: Date.now()
    };
  }

  /**
   * DAO 금고 자금 사용
   */
  useDAOTreasuryFunds(daoId, amount, purpose, operatorDID) {
    const treasury = this.daoTreasuries.get(daoId);
    
    if (!treasury) {
      return {
        success: false,
        error: '존재하지 않는 DAO 금고입니다'
      };
    }

    if (treasury.balance < amount) {
      return {
        success: false,
        error: '잔액이 부족합니다'
      };
    }

    // 자금 사용
    treasury.balance -= amount;
    treasury.transactions.push({
      type: 'withdrawal',
      amount: -amount,
      purpose,
      operatorDID,
      timestamp: Date.now(),
      description: purpose
    });

    console.log(`💸 DAO 금고 자금 사용: ${daoId} -${amount} B (${purpose})`);

    return {
      success: true,
      remainingBalance: treasury.balance,
      message: 'DAO 금고 자금이 성공적으로 사용되었습니다'
    };
  }

  /**
   * 검증자 정보 조회
   */
  getValidatorInfo(validatorId) {
    const validator = this.validatorRegistry.get(validatorId);
    if (!validator) {
      return {
        success: false,
        error: '검증자를 찾을 수 없습니다'
      };
    }

    return {
      success: true,
      validator
    };
  }

  /**
   * 검증자 상태 업데이트
   */
  updateValidatorStatus(validatorId, status) {
    const validator = this.validatorRegistry.get(validatorId);
    if (!validator) {
      return {
        success: false,
        error: '검증자를 찾을 수 없습니다'
      };
    }

    validator.status = status;
    validator.lastUpdated = Date.now();

    return {
      success: true,
      message: `검증자 상태가 ${status}로 변경되었습니다`
    };
  }

  /**
   * DAO 금고 현황 조회
   */
  getDAOTreasuryInfo(daoId) {
    const treasury = this.daoTreasuries.get(daoId);
    
    if (!treasury) {
      return {
        success: false,
        error: '존재하지 않는 DAO 금고입니다'
      };
    }

    const recentTransactions = treasury.transactions
      .slice(-10) // 최근 10개 거래
      .sort((a, b) => b.timestamp - a.timestamp);

    return {
      success: true,
      treasury: {
        daoId: treasury.daoId,
        balance: treasury.balance,
        transactions: treasury.transactions,
        transactionCount: treasury.transactions.length,
        createdAt: treasury.createdAt,
        recentTransactions
      }
    };
  }

  /**
   * 검증자 풀 현황 조회
   */
  getValidatorPoolInfo() {
    const activeValidators = Array.from(this.validatorRegistry.values())
      .filter(v => v.status === 'active');

    return {
      totalFees: this.validatorPool.totalFees,
      activeValidators: activeValidators.length,
      totalValidators: this.validatorRegistry.size,
      distributionHistory: this.validatorPool.distributionHistory.slice(-10),
      validators: activeValidators.map(v => ({
        validatorId: v.validatorId,
        validatorDID: v.validatorDID,
        stake: v.stake,
        totalRewards: v.totalRewards,
        validatedTxCount: v.validatedTxCount,
        lastActiveAt: v.lastActiveAt
      }))
    };
  }

  /**
   * 거래 ID 생성
   * @private
   */
  generateTxId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * TFS 통계
   */
  getStats() {
    const totalDAOBalance = Array.from(this.daoTreasuries.values())
      .reduce((sum, treasury) => sum + treasury.balance, 0);

    const totalFeesCollected = this.transactionHistory
      .reduce((sum, tx) => sum + tx.txFee, 0);

    const activeValidators = Array.from(this.validatorRegistry.values())
      .filter(v => v.status === 'active').length;

    return {
      totalTransactions: this.transactionHistory.length,
      totalFeesCollected,
      validatorPoolTotal: this.validatorPool.totalFees,
      daoTreasuryTotal: totalDAOBalance,
      activeValidators,
      totalDAOTreasuries: this.daoTreasuries.size,
      feeDistribution: this.feeDistributionRatio
    };
  }

  /**
   * 수수료 분배 비율 업데이트
   */
  updateFeeDistributionRatio(validatorRatio, daoRatio) {
    if (Math.abs(validatorRatio + daoRatio - 1.0) > 0.001) {
      return {
        success: false,
        error: '비율의 합은 1.0이어야 합니다'
      };
    }

    this.feeDistributionRatio.validator = validatorRatio;
    this.feeDistributionRatio.dao = daoRatio;

    return {
      success: true,
      newRatio: this.feeDistributionRatio,
      message: '수수료 분배 비율이 업데이트되었습니다'
    };
  }
}

module.exports = TransactionFeeSystem; 