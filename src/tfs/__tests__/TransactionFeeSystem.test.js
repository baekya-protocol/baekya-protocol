/**
 * 백야 프로토콜 - 거래 수수료 시스템 테스트
 */

const TransactionFeeSystem = require('../TransactionFeeSystem');

describe('TransactionFeeSystem', () => {
  let tfs;

  beforeEach(() => {
    tfs = new TransactionFeeSystem();
  });

  describe('거래 수수료 계산', () => {
    test('B-Token 거래 수수료 계산', () => {
      const fee = tfs.calculateTxFee(1000, 'B');
      expect(fee).toBe(1); // 1000 * 0.001 = 1
    });

    test('P-Token 거래 수수료 계산', () => {
      const fee = tfs.calculateTxFee(1000, 'P');
      expect(fee).toBe(0.1); // 1000 * 0.0001 = 0.1
    });

    test('최소 수수료 적용', () => {
      const fee = tfs.calculateTxFee(0.5, 'B');
      expect(fee).toBe(0.001); // 최소 수수료
    });
  });

  describe('검증자 등록 및 관리', () => {
    test('검증자 등록', () => {
      const result = tfs.registerValidator('validator1', 'did:baekya:validator1', 1000);
      
      expect(result.success).toBe(true);
      expect(result.validatorId).toBe('validator1');
      
      const validatorInfo = tfs.getValidatorInfo('validator1');
      expect(validatorInfo.success).toBe(true);
      expect(validatorInfo.validator.stake).toBe(1000);
      expect(validatorInfo.validator.status).toBe('active');
    });

    test('중복 검증자 등록 방지', () => {
      tfs.registerValidator('validator1', 'did:baekya:validator1', 1000);
      const result = tfs.registerValidator('validator1', 'did:baekya:validator1', 1000);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('이미 등록된');
    });

    test('검증자 상태 변경', () => {
      tfs.registerValidator('validator1', 'did:baekya:validator1', 1000);
      
      const result = tfs.updateValidatorStatus('validator1', 'inactive');
      expect(result.success).toBe(true);
      
      const validatorInfo = tfs.getValidatorInfo('validator1');
      expect(validatorInfo.validator.status).toBe('inactive');
    });
  });

  describe('거래 수수료 처리', () => {
    beforeEach(() => {
      // 테스트용 검증자 등록
      tfs.registerValidator('validator1', 'did:baekya:validator1', 1000);
      tfs.registerValidator('validator2', 'did:baekya:validator2', 1500);
    });

    test('기본 거래 수수료 처리', () => {
      const userContributions = [
        { daoId: 'dao1', value: 600 },
        { daoId: 'dao2', value: 400 }
      ];

      const result = tfs.processTxFee(
        'did:baekya:sender',
        'did:baekya:receiver',
        1000,
        'B',
        userContributions
      );

      expect(result.success).toBe(true);
      expect(result.fees.total).toBe(1); // 1000 * 0.001
      expect(result.fees.validatorShare).toBe(1.0); // 1 * 1.0
      expect(result.fees.daoShare).toBe(0.0); // 1 * 0.0
      
      // DAO 분배 확인 (분배하지 않음)
      expect(result.fees.daoDistribution).toEqual({}); // 분배되지 않음
    });

    test('검증자 풀 분배 확인', () => {
      const userContributions = [{ daoId: 'dao1', value: 1000 }];
      
      tfs.processTxFee('sender', 'receiver', 1000, 'B', userContributions);
      
      const poolInfo = tfs.getValidatorPoolInfo();
      expect(poolInfo.totalFees).toBe(1.0);
      
      // 각 검증자가 동일하게 분배받았는지 확인
      const validator1Share = tfs.validatorPool.validators.get('validator1');
      const validator2Share = tfs.validatorPool.validators.get('validator2');
      
      expect(validator1Share).toBe(0.5); // 1.0 / 2
      expect(validator2Share).toBe(0.5); // 1.0 / 2
    });

    test('DAO 금고 분배 확인', () => {
      const userContributions = [
        { daoId: 'dao1', value: 750 },
        { daoId: 'dao2', value: 250 }
      ];

      tfs.processTxFee('sender', 'receiver', 1000, 'B', userContributions);
      
      const dao1Treasury = tfs.getDAOTreasuryInfo('dao1');
      const dao2Treasury = tfs.getDAOTreasuryInfo('dao2');
      
      expect(dao1Treasury.success).toBe(true);
      expect(dao1Treasury.treasury.balance).toBeCloseTo(0.0, 10); // 0.0 * 0.75
      
      expect(dao2Treasury.success).toBe(true);
      expect(dao2Treasury.treasury.balance).toBeCloseTo(0.0, 10); // 0.0 * 0.25
    });

    test('기여 내역 없는 경우 처리', () => {
      const result = tfs.processTxFee('sender', 'receiver', 1000, 'B', []);
      
      expect(result.success).toBe(true);
      expect(result.fees.daoDistribution).toEqual({});
      
      // 검증자 풀에만 분배
      const poolInfo = tfs.getValidatorPoolInfo();
      expect(poolInfo.totalFees).toBe(1.0);
    });
  });

  describe('검증자 보상 분배', () => {
    beforeEach(() => {
      tfs.registerValidator('validator1', 'did:baekya:validator1', 1000);
      tfs.registerValidator('validator2', 'did:baekya:validator2', 2000);
      
      // 수수료 누적
      tfs.processTxFee('sender', 'receiver', 1000, 'B', []);
    });

    test('검증자 보상 분배', () => {
      const result = tfs.distributeValidatorRewards();
      
      expect(result.success).toBe(true);
      expect(result.totalDistributed).toBeGreaterThan(0);
      expect(result.validatorRewards).toHaveLength(2);
      
      // 스테이크 비율에 따른 분배 확인
      const validator1Reward = result.validatorRewards.find(r => r.validatorId === 'validator1');
      const validator2Reward = result.validatorRewards.find(r => r.validatorId === 'validator2');
      
      expect(validator2Reward.reward).toBeGreaterThan(validator1Reward.reward);
    });

    test('비활성 검증자는 보상 제외', () => {
      tfs.updateValidatorStatus('validator2', 'inactive');
      
      const result = tfs.distributeValidatorRewards();
      
      expect(result.validatorRewards).toHaveLength(1);
      expect(result.validatorRewards[0].validatorId).toBe('validator1');
    });
  });

  describe('DAO 금고 관리', () => {
    beforeEach(() => {
      // DAO 금고에 자금 추가
      const userContributions = [{ daoId: 'dao1', value: 1000 }];
      tfs.processTxFee('sender', 'receiver', 1000, 'B', userContributions);
    });

    test('DAO 금고 자금 사용', () => {
      const result = tfs.useDAOTreasuryFunds('dao1', 0.2, '개발 지원금', 'did:baekya:operator');
      
      expect(result.success).toBe(true);
      
      const treasuryInfo = tfs.getDAOTreasuryInfo('dao1');
      expect(treasuryInfo.treasury.balance).toBeCloseTo(-0.2, 10); // 0.0 - 0.2
      
      // 거래 기록 확인
      const lastTransaction = treasuryInfo.treasury.transactions[treasuryInfo.treasury.transactions.length - 1];
      expect(lastTransaction.type).toBe('withdrawal');
      expect(lastTransaction.amount).toBe(-0.2);
      expect(lastTransaction.purpose).toBe('개발 지원금');
    });

    test('잔액 부족시 사용 실패', () => {
      const result = tfs.useDAOTreasuryFunds('dao1', 1.0, '과도한 지출', 'did:baekya:operator');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('잔액이 부족');
    });

    test('존재하지 않는 DAO 금고', () => {
      const result = tfs.useDAOTreasuryFunds('nonexistent', 0.1, '테스트', 'operator');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('존재하지 않는');
    });
  });

  describe('수수료 분배 비율 관리', () => {
    test('분배 비율 업데이트', () => {
      const result = tfs.updateFeeDistributionRatio(1.0, 0.0);
      
      expect(result.success).toBe(true);
      expect(tfs.feeDistributionRatio.validator).toBe(1.0);
      expect(tfs.feeDistributionRatio.dao).toBe(0.0);
    });

    test('잘못된 분배 비율', () => {
      const result = tfs.updateFeeDistributionRatio(0.6, 0.5); // 합계가 1.1
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('비율의 합');
    });
  });

  describe('통계 및 정보 조회', () => {
    beforeEach(() => {
      tfs.registerValidator('validator1', 'did:baekya:validator1', 1000);
      
      const userContributions = [
        { daoId: 'dao1', value: 600 },
        { daoId: 'dao2', value: 400 }
      ];
      
      tfs.processTxFee('sender1', 'receiver1', 1000, 'B', userContributions);
      tfs.processTxFee('sender2', 'receiver2', 500, 'P', userContributions);
    });

    test('전체 통계 조회', () => {
      const stats = tfs.getStats();
      
      expect(stats.totalTransactions).toBe(2);
      expect(stats.totalFeesCollected).toBeGreaterThan(0);
      expect(stats.validatorPoolTotal).toBeGreaterThan(0);
      expect(stats.daoTreasuryTotal).toBeGreaterThan(0);
      expect(stats.activeValidators).toBe(1);
      expect(stats.totalDAOTreasuries).toBe(2);
    });

    test('검증자 풀 정보 조회', () => {
      const poolInfo = tfs.getValidatorPoolInfo();
      
      expect(poolInfo.totalFees).toBeGreaterThan(0);
      expect(poolInfo.activeValidators).toBe(1);
      expect(poolInfo.distributionHistory).toHaveLength(2);
    });

    test('DAO 금고 정보 조회', () => {
      const dao1Info = tfs.getDAOTreasuryInfo('dao1');
      const dao2Info = tfs.getDAOTreasuryInfo('dao2');
      
      expect(dao1Info.success).toBe(true);
      expect(dao1Info.treasury.balance).toBeGreaterThan(0);
      expect(dao1Info.treasury.transactions.length).toBeGreaterThan(0);
      
      expect(dao2Info.success).toBe(true);
      expect(dao2Info.treasury.balance).toBeGreaterThan(0);
    });
  });

  describe('에러 처리', () => {
    test('잘못된 토큰 타입', () => {
      const result = tfs.processTxFee('sender', 'receiver', 1000, 'INVALID', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('지원되지 않는');
    });

    test('음수 거래 금액', () => {
      const result = tfs.processTxFee('sender', 'receiver', -100, 'B', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('유효하지 않은');
    });

    test('빈 DID', () => {
      const result = tfs.processTxFee('', 'receiver', 1000, 'B', []);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('DID가 필요');
    });
  });

  describe('TFS 인스턴스 초기화', () => {
    test('TFS 인스턴스 초기화', () => {
      const result = tfs.handleTransactionFee(txFee, userDID, userDAOs);
      
      // 수수료 분배 확인 (100%:0%)
      expect(result.fees.validatorShare).toBe(1.0); // 1 * 1.0
      expect(result.fees.daoShare).toBe(0.0); // 1 * 0.0
      
      // DAO 분배 정보 확인 (분배하지 않음)
      expect(result.fees.daoDistribution).toEqual({});
      
      // 검증자 풀 정보 확인
      const poolInfo = tfs.getValidatorPoolInfo();
      expect(poolInfo.totalFees).toBe(1.0);
      
      // 검증자별 분배 확인
      const validator1Share = tfs.getValidatorReward('validator1');
      const validator2Share = tfs.getValidatorReward('validator2');
      expect(validator1Share).toBe(0.5); // 1.0 / 2
      expect(validator2Share).toBe(0.5); // 1.0 / 2
    });
  });
}); 