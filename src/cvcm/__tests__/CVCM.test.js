const CVCM = require('../CVCM');
const DID = require('../../did/DID');

describe('CVCM (Contribution-Verification-Calculation-Minting) System', () => {
  let cvcmInstance;
  let didSystem;

  beforeEach(() => {
    didSystem = new DID();
    cvcmInstance = new CVCM(didSystem);

    // 테스트용 DAO와 DCA 설정
    cvcmInstance.registerDCA('development', {
      id: 'opinion-proposal',
      name: 'Opinion Proposal',
      value: 80,
      verificationCriteria: 'Merged into main branch'
    });

    cvcmInstance.registerDCA('development', {
      id: 'pull-request',
      name: 'Pull Request',
      value: 250,
      verificationCriteria: 'PR merged successfully'
    });
  });

  describe('기여 활동 (DCA) 등록', () => {
    test('DAO에 기여 활동을 등록할 수 있어야 함', () => {
      const dca = {
        id: 'code-review',
        name: 'Code Review',
        value: 150,
        verificationCriteria: 'Review approved'
      };

      expect(() => {
        cvcmInstance.registerDCA('development', dca);
      }).not.toThrow();

      const retrievedDCA = cvcmInstance.getDCA('development', 'code-review');
      expect(retrievedDCA).toEqual(dca);
    });

    test('동일한 DCA ID는 중복 등록될 수 없어야 함', () => {
      const dca = {
        id: 'opinion-proposal', // 이미 등록된 ID
        name: 'Duplicate Opinion',
        value: 100,
        verificationCriteria: 'Test'
      };

      expect(() => {
        cvcmInstance.registerDCA('development', dca);
      }).toThrow('이미 등록된 DCA입니다');
    });
  });

  describe('기여 제출', () => {
    test('구성원이 기여를 제출할 수 있어야 함', () => {
      const contribution = {
        daoId: 'development',
        dcaId: 'opinion-proposal',
        contributorDID: 'did:baekya:test123',
        contributorAge: 30,
        gender: 'male',
        description: 'Fixed bug in token calculation',
        evidence: 'GitHub PR #123'
      };

      const result = cvcmInstance.submitContribution(contribution);

      expect(result.success).toBe(true);
      expect(result.contributionId).toBeDefined();
      expect(result.dcaValue).toBe(80);
      expect(result.status).toBe('submitted');
    });

    test('필수 정보 없이는 기여를 제출할 수 없어야 함', () => {
      const incompleteContribution = {
        daoId: 'development',
        dcaId: 'opinion-proposal'
        // contributorDID, contributorAge 누락
      };

      expect(() => {
        cvcmInstance.submitContribution(incompleteContribution);
      }).toThrow('기여자 DID는 필수입니다');
    });
  });

  describe('기여 검증', () => {
    test('기여를 성공적으로 검증할 수 있어야 함', async () => {
      const contribution = {
        daoId: 'development',
        dcaId: 'opinion-proposal',
        contributorDID: 'did:baekya:test123',
        contributorAge: 30,
        gender: 'male',
        description: 'Fixed bug in token calculation',
        evidence: 'GitHub PR #123'
      };

      const submitResult = cvcmInstance.submitContribution(contribution);
      const contributionId = submitResult.contributionId;

      const verificationResult = await cvcmInstance.verifyContribution(
        contributionId,
        'verifier-did',
        true,
        'Good contribution'
      );

      expect(verificationResult.success).toBe(true);
      expect(verificationResult.verified).toBe(true);
      expect(verificationResult.contributionId).toBe(contributionId);
      expect(verificationResult.bmrAdded).toBeDefined();
      expect(verificationResult.totalBMR).toBeDefined();
    });

    test('기여 검증 실패 시 처리되어야 함', async () => {
      const contribution = {
        daoId: 'development',
        dcaId: 'opinion-proposal',
        contributorDID: 'did:baekya:test123',
        contributorAge: 30,
        gender: 'male',
        description: 'Poor quality contribution',
        evidence: 'No evidence'
      };

      const submitResult = cvcmInstance.submitContribution(contribution);
      const contributionId = submitResult.contributionId;

      const verificationResult = await cvcmInstance.verifyContribution(
        contributionId,
        'verifier-did',
        false,
        'Insufficient evidence'
      );

      expect(verificationResult.success).toBe(true);
      expect(verificationResult.verified).toBe(false);
      expect(verificationResult.reason).toBe('Insufficient evidence');
      expect(verificationResult.bmrAdded).toBeUndefined(); // 거부된 기여는 BMR 없음
    });
  });

  describe('BMR 계산 (Protocol Overview LDM 방식)', () => {
    test('BMR Calculator를 통한 정확한 LDM 계산', () => {
      const contributorAge = 30;
      const dcaValue = 80;
      const gender = 'male';

      const bmrData = cvcmInstance.bmrCalculator.calculateBMR({
        contributorAge,
        dcaValue,
        gender
      });

      expect(bmrData).toHaveProperty('initialRate');
      expect(bmrData).toHaveProperty('decayRate', 0.016);
      expect(bmrData).toHaveProperty('remainingLifetime', 50);
      expect(bmrData).toHaveProperty('totalValue', 80);
      expect(bmrData.initialRate).toBeCloseTo(2.32, 1); // Protocol Overview 예시
    });

    test('다른 나이에 대해 다른 BMR이 계산되어야 함', () => {
      const dcaValue = 100;
      const gender = 'male';

      const bmr25 = cvcmInstance.bmrCalculator.calculateBMR({
        contributorAge: 25,
        dcaValue,
        gender
      });

      const bmr35 = cvcmInstance.bmrCalculator.calculateBMR({
        contributorAge: 35,
        dcaValue,
        gender
      });

      // 나이가 적을수록 남은 생애가 길어서 초기 발행률이 낮아야 함
      expect(bmr25.remainingLifetime).toBeGreaterThan(bmr35.remainingLifetime);
      expect(bmr25.initialRate).toBeLessThan(bmr35.initialRate);
    });
  });

  describe('통합된 기여 검증 및 BMR 추가', () => {
    test('검증된 기여에 대해 자동으로 BMR이 추가되어야 함', async () => {
      const contribution = {
        daoId: 'development',
        dcaId: 'opinion-proposal',
        contributorDID: 'did:baekya:test123',
        contributorAge: 30,
        gender: 'male',
        description: 'Great improvement suggestion',
        evidence: 'GitHub issue #456'
      };

      const submitResult = cvcmInstance.submitContribution(contribution);
      const contributionId = submitResult.contributionId;

      // 검증 시 자동으로 BMR 추가됨
      const verificationResult = await cvcmInstance.verifyContribution(
        contributionId,
        'verifier-did',
        true
      );

      expect(verificationResult.success).toBe(true);
      expect(verificationResult.bmrAdded).toBeGreaterThan(0);
      expect(verificationResult.totalBMR).toBeGreaterThan(0);

      // BMR 데이터 확인
      const totalBMR = cvcmInstance.getTotalBMR('did:baekya:test123');
      expect(totalBMR).toBe(verificationResult.totalBMR);
    });

    test('거부된 기여에 대해서는 BMR이 추가되지 않아야 함', async () => {
      const contribution = {
        daoId: 'development',
        dcaId: 'opinion-proposal',
        contributorDID: 'did:baekya:test456',
        contributorAge: 30,
        gender: 'male',
        description: 'Poor quality',
        evidence: 'Insufficient'
      };

      const submitResult = cvcmInstance.submitContribution(contribution);
      const contributionId = submitResult.contributionId;

      const verificationResult = await cvcmInstance.verifyContribution(
        contributionId,
        'verifier-did',
        false,
        'Quality too low'
      );

      expect(verificationResult.verified).toBe(false);
      expect(verificationResult.bmrAdded).toBeUndefined();

      const totalBMR = cvcmInstance.getTotalBMR('did:baekya:test456');
      expect(totalBMR).toBe(0);
    });
  });

  describe('BMR 누적 및 마이닝', () => {
    test('동일 기여자의 여러 기여에 대해 BMR이 누적되어야 함', async () => {
      const contributorDID = 'did:baekya:test789';

      // 첫 번째 기여 (80B)
      const contribution1 = {
        daoId: 'development',
        dcaId: 'opinion-proposal',
        contributorDID: contributorDID,
        contributorAge: 30,
        gender: 'male',
        description: 'First contribution',
        evidence: 'PR #100'
      };

      const result1 = cvcmInstance.submitContribution(contribution1);
      await cvcmInstance.verifyContribution(result1.contributionId, 'verifier-did', true);

      const bmrAfterFirst = cvcmInstance.getTotalBMR(contributorDID);
      expect(bmrAfterFirst).toBeGreaterThan(0);

      // 두 번째 기여 (250B)
      const contribution2 = {
        daoId: 'development',
        dcaId: 'pull-request',
        contributorDID: contributorDID,
        contributorAge: 30,
        gender: 'male',
        description: 'Second contribution',
        evidence: 'PR #101'
      };

      const result2 = cvcmInstance.submitContribution(contribution2);
      await cvcmInstance.verifyContribution(result2.contributionId, 'verifier-did', true);

      const bmrAfterSecond = cvcmInstance.getTotalBMR(contributorDID);
      expect(bmrAfterSecond).toBeGreaterThan(bmrAfterFirst);

      // Protocol Overview 예시와 비교 (80B + 250B = 330B total)
      // 30세 남성, 총 330B → 초기 BMR ≈ 9.58B/년
      expect(bmrAfterSecond).toBeCloseTo(9.58, 1);
    });

    test('마이닝 대시보드 데이터 조회', async () => {
      const contributorDID = 'did:baekya:dashboard-test';

      const contribution = {
        daoId: 'development',
        dcaId: 'pull-request',
        contributorDID: contributorDID,
        contributorAge: 25,
        gender: 'female',
        description: 'Dashboard test contribution',
        evidence: 'Test data'
      };

      const result = cvcmInstance.submitContribution(contribution);
      await cvcmInstance.verifyContribution(result.contributionId, 'verifier-did', true);

      const dashboard = cvcmInstance.getMiningDashboard(contributorDID);

      expect(dashboard).toHaveProperty('totalBMR');
      expect(dashboard).toHaveProperty('accumulatedTokens');
      expect(dashboard).toHaveProperty('currentHourlyRate');
      expect(dashboard).toHaveProperty('dailyRate');
      expect(dashboard).toHaveProperty('monthlyRate');
      expect(dashboard).toHaveProperty('activeBMRs', 1);
      expect(dashboard).toHaveProperty('bmrDetails');
      expect(dashboard.bmrDetails).toHaveLength(1);
    });
  });

  describe('Protocol Overview 예시 재현', () => {
    test('Protocol Overview 30세 남성 예시 완전 재현', async () => {
      const contributorDID = 'did:baekya:protocol-example';

      // 첫 번째 기여: 80B (의견 제안)
      const contribution1 = {
        daoId: 'development',
        dcaId: 'opinion-proposal',
        contributorDID: contributorDID,
        contributorAge: 30,
        gender: 'male',
        description: '프로토콜 효율성 개선 의견',
        evidence: 'GitHub issue #123'
      };

      const result1 = cvcmInstance.submitContribution(contribution1);
      const verification1 = await cvcmInstance.verifyContribution(result1.contributionId, 'verifier-did', true);

      // 두 번째 기여: 250B (PR)
      const contribution2 = {
        daoId: 'development',
        dcaId: 'pull-request',
        contributorDID: contributorDID,
        contributorAge: 30,
        gender: 'male',
        description: '효율성 개선 PR',
        evidence: 'PR #456'
      };

      const result2 = cvcmInstance.submitContribution(contribution2);
      const verification2 = await cvcmInstance.verifyContribution(result2.contributionId, 'verifier-did', true);

      // 결과 검증
      const totalBMR = cvcmInstance.getTotalBMR(contributorDID);
      const dashboard = cvcmInstance.getMiningDashboard(contributorDID);

      // Protocol Overview 예시와 비교
      expect(totalBMR).toBeCloseTo(9.58, 1); // 2.32 + 7.26 ≈ 9.58B/년
      expect(dashboard.currentHourlyRate).toBeCloseTo(0.001094, 4); // ≈ 0.001094B/시간
      expect(dashboard.activeBMRs).toBe(2);
    });
  });

  describe('기여 이력 및 통계', () => {
    test('기여자의 기여 이력을 조회할 수 있어야 함', async () => {
      const contributorDID = 'did:baekya:history-test';

      const contribution = {
        daoId: 'development',
        dcaId: 'opinion-proposal',
        contributorDID: contributorDID,
        contributorAge: 35,
        gender: 'default',
        description: 'History test',
        evidence: 'Test'
      };

      const result = cvcmInstance.submitContribution(contribution);
      await cvcmInstance.verifyContribution(result.contributionId, 'verifier-did', true);

      const history = cvcmInstance.getContributionHistory(contributorDID);
      expect(history).toHaveLength(1);
      expect(history[0].contributorDID).toBe(contributorDID);
      expect(history[0].verification).toBeDefined();
      expect(history[0].verification.verified).toBe(true);
    });

    test('DAO별 기여 통계를 조회할 수 있어야 함', async () => {
      const stats = cvcmInstance.getDAOContributionStats('development');
      expect(stats).toHaveProperty('totalContributions');
      expect(stats).toHaveProperty('verifiedContributions');
      expect(stats).toHaveProperty('totalBMRGenerated');
      expect(stats).toHaveProperty('uniqueContributors');
      expect(stats).toHaveProperty('verificationRate');
    });
  });
}); 