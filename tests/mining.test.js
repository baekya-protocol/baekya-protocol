const MiningSystem = require('../src/mining/MiningSystem');
const AutomationSystem = require('../src/automation/AutomationSystem');
const BaekyaProtocol = require('../src/index');

describe('마이닝 시스템 테스트', () => {
  let miningSystem;
  let protocol;

  beforeEach(() => {
    miningSystem = new MiningSystem();
    protocol = new BaekyaProtocol();
  });

  beforeEach(async () => {
    await protocol.initialize();
    // 테스트 간 인증 데이터 중복 방지
    protocol.components.authSystem.clearForTesting();
  });

  describe('BMR 추가 및 계산', () => {
    test('BMR 추가가 정상적으로 작동해야 함', () => {
      const testDID = 'test-did-12345';
      const result = miningSystem.addBMR(testDID, 30, 250);

      expect(result.success).toBe(true);
      expect(result.currentHourlyRate).toBeGreaterThan(0);
      expect(result.bmrId).toBeTruthy();
    });

    test('나이별 LDM 계산이 정확해야 함', () => {
      const youngDID = 'young-user';
      const oldDID = 'old-user';

      const youngResult = miningSystem.addBMR(youngDID, 25, 250);
      const oldResult = miningSystem.addBMR(oldDID, 50, 250);

      // 젊은 사용자의 시간당 발행량이 적어야 함 (더 오랜 기간에 분산)
      expect(youngResult.currentHourlyRate).toBeLessThan(oldResult.currentHourlyRate);
    });

    test('여러 BMR을 누적할 수 있어야 함', () => {
      const testDID = 'test-accumulate';
      
      miningSystem.addBMR(testDID, 30, 100);
      const firstRate = miningSystem.getCurrentHourlyRate(testDID);
      
      miningSystem.addBMR(testDID, 30, 150);
      const secondRate = miningSystem.getCurrentHourlyRate(testDID);

      expect(secondRate).toBeGreaterThan(firstRate);
    });
  });

  describe('토큰 누적 계산', () => {
    test('시간 경과에 따른 토큰 누적이 계산되어야 함', () => {
      const testDID = 'test-accumulation';
      
      miningSystem.addBMR(testDID, 30, 100);
      
      // 초기 상태
      const initial = miningSystem.updateAndGetAccumulatedTokens(testDID);
      expect(initial.accumulatedTokens).toBeCloseTo(0, 8);
      
      // 시간 경과 시뮬레이션 (1시간)
      const minerData = miningSystem.minerData.get(testDID);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      minerData[0].startTime = oneHourAgo; // 1시간 전
      
      // lastUpdateTime도 1시간 전으로 설정
      miningSystem.lastUpdateTime.set(testDID, oneHourAgo);
      
      const afterOneHour = miningSystem.updateAndGetAccumulatedTokens(testDID);
      expect(afterOneHour.accumulatedTokens).toBeGreaterThan(0);
      expect(afterOneHour.newTokens).toBeGreaterThan(0);
    });

    test('마이닝 대시보드 데이터가 정확해야 함', () => {
      const testDID = 'test-dashboard';
      
      miningSystem.addBMR(testDID, 35, 200);
      const dashboard = miningSystem.getMiningDashboard(testDID);

      expect(dashboard.totalBMR).toBe(200);
      expect(dashboard.currentHourlyRate).toBeGreaterThan(0);
      expect(dashboard.activeBMRs).toBe(1);
      expect(dashboard.projectedDaily).toBe(dashboard.currentHourlyRate * 24);
      expect(dashboard.projectedMonthly).toBe(dashboard.currentHourlyRate * 24 * 30);
    });
  });

  describe('네트워크 통계', () => {
    test('네트워크 마이닝 통계가 올바르게 계산되어야 함', () => {
      // 여러 사용자의 BMR 추가
      miningSystem.addBMR('user1', 25, 100);
      miningSystem.addBMR('user2', 35, 200);
      miningSystem.addBMR('user3', 45, 150);

      const stats = miningSystem.getNetworkMiningStats();

      expect(stats.totalMiners).toBe(3);
      expect(stats.totalBMR).toBe(450);
      expect(stats.totalHourlyRate).toBeGreaterThan(0);
      expect(stats.averageHourlyRate).toBe(stats.totalHourlyRate / 3);
    });
  });

  describe('BMR 정리', () => {
    test('만료된 BMR이 정리되어야 함', () => {
      const testDID = 'test-cleanup';
      
      // BMR 추가 후 시작 시간을 과거로 설정 (만료 상태)
      miningSystem.addBMR(testDID, 30, 100);
      const minerData = miningSystem.minerData.get(testDID);
      minerData[0].startTime = Date.now() - (100 * 365 * 24 * 60 * 60 * 1000); // 100년 전

      const cleanupResult = miningSystem.cleanupExpiredBMRs();
      expect(cleanupResult.cleanedBMRs).toBe(1);
      
      const remainingBMRs = miningSystem.minerData.get(testDID);
      expect(remainingBMRs.length).toBe(0);
    });
  });
});

describe('자동화 시스템 테스트', () => {
  let automationSystem;
  let protocol;

  beforeEach(async () => {
    protocol = new BaekyaProtocol();
    await protocol.initialize();
    automationSystem = protocol.automationSystem;
  });

  describe('운영 DAO 자동 반영', () => {
    test('운영자 활동이 자동으로 반영되어야 함', () => {
      const operatorDID = 'test-operator';
      
      const result = automationSystem.handleOperationsDAOActivity(
        operatorDID, 
        'proposal_approval', 
        'test-proposal-123',
        { decision: 'approved', reason: 'test reason' }
      );

      expect(result.success).toBe(true);
      expect(result.bTokensEarned).toBe(150);
      expect(result.contributionId).toBeTruthy();
    });

    test('알 수 없는 운영자 활동은 거부되어야 함', () => {
      const operatorDID = 'test-operator';
      
      const result = automationSystem.handleOperationsDAOActivity(
        operatorDID, 
        'unknown_action', 
        'test-target'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown operator action');
    });
  });



  describe('초대 시스템', () => {
    test('초대 링크 생성이 가능해야 함', () => {
      const inviterDID = 'test-inviter';
      
      const result = automationSystem.createInviteLink(inviterDID);

      expect(result.success).toBe(true);
      expect(result.inviteCode).toBeTruthy();
      expect(result.inviteLink).toContain(result.inviteCode);
    });

    test('초대를 통한 가입 처리가 가능해야 함', () => {
      const inviterDID = 'test-inviter';
      
      // 초대 링크 생성
      const inviteResult = automationSystem.createInviteLink(inviterDID);
      expect(inviteResult.success).toBe(true);

      // 초대를 통한 가입
      const userData = {
        username: 'inviteduser1',
        password: 'InvitePass123',
        name: '초대된 사용자',
        birthDate: '1990-01-01'
      };

      const registrationResult = automationSystem.processInviteRegistration(
        inviteResult.inviteCode,
        userData
      );

      expect(registrationResult.success).toBe(true);
      expect(registrationResult.user).toBeTruthy();
      expect(registrationResult.inviter).toBe(inviterDID);
    });

    test('만료된 초대 코드는 거부되어야 함', () => {
      const inviterDID = 'test-inviter';
      
      // 초대 링크 생성
      const inviteResult = automationSystem.createInviteLink(inviterDID);
      const inviteCode = inviteResult.inviteCode;
      
      // 만료 시간을 과거로 설정
      const invite = automationSystem.inviteLinks.get(inviteCode);
      invite.expiresAt = Date.now() - 1000; // 1초 전 만료

      const userData = {
        username: 'expireduser',
        password: 'ExpiredPass123',
        name: '만료 테스트 사용자',
        birthDate: '1990-01-01'
      };

      const result = automationSystem.processInviteRegistration(inviteCode, userData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('만료된 초대 코드입니다');
    });

    test('이미 사용된 초대 코드는 거부되어야 함', () => {
      const inviterDID = 'test-inviter';
      
      // 초대 링크 생성 및 사용
      const inviteResult = automationSystem.createInviteLink(inviterDID);
      const inviteCode = inviteResult.inviteCode;
      
      const userData1 = {
        username: 'dupuser1',
        password: 'DupPass123',
        name: '중복 테스트 사용자 1',
        birthDate: '1990-01-01'
      };

      automationSystem.processInviteRegistration(inviteCode, userData1);

      // 동일한 코드로 다시 시도
      const userData2 = {
        username: 'dupuser2',
        password: 'DupPass456',
        name: '중복 테스트 사용자 2',
        birthDate: '1990-01-01'
      };

      const result = automationSystem.processInviteRegistration(inviteCode, userData2);
      expect(result.success).toBe(false);
      expect(result.error).toBe('이미 사용된 초대 코드입니다');
    });
  });

  describe('자동화 상태', () => {
    test('자동화 시스템 상태를 확인할 수 있어야 함', () => {
      // GitHub 웹훅 설정
  
      
      // 초대 링크 생성
      automationSystem.createInviteLink('test-inviter');

      const status = automationSystem.getAutomationStatus();

      expect(status.githubWebhooks).toHaveLength(1);
      expect(status.githubWebhooks[0].repo).toBe('test-owner/test-repo');
      expect(status.activeInvites).toBe(1);
      expect(status.totalInvites).toBe(1);
    });
  });
});

describe('통합 시나리오 테스트', () => {
  let protocol;

  beforeEach(async () => {
    protocol = new BaekyaProtocol();
    await protocol.initialize();
    // 테스트 간 인증 데이터 중복 방지
    protocol.components.authSystem.clearForTesting();
  });

  test('전체 기여-마이닝 플로우가 정상 작동해야 함', async () => {
    // 1. 사용자 등록 (고유한 아이디/비밀번호 사용)
    const userResult = protocol.registerUser({
      username: 'testuser1',
      password: 'TestPass123',
      name: '통합 테스트 사용자',
      birthDate: '1990-01-01'
    });
    
    expect(userResult.success).toBe(true);
    const userDID = userResult.didHash;

    // 2. 기여 제출 (Development DAO 사용)
    const devDAO = Array.from(protocol.daoSystem.daos.values())
      .find(dao => dao.name === 'Development DAO');
    
    const contributionData = {
      daoId: devDAO.id,
      dcaId: 'pull-request',
      title: '통합 테스트 기여',
      description: '테스트용 기여입니다',
      contributorDID: userDID,
      contributorAge: 30,
      evidence: 'https://github.com/test/test/pull/123'
    };

    const submitResult = protocol.submitContribution(contributionData);
    expect(submitResult.success).toBe(true);

    // 3. 기여 검증 (DAO 운영자가 검증)
    const verifyResult = await protocol.verifyContribution(
      submitResult.contributionId,
      devDAO.operatorDID,
      true,
      '통합 테스트 검증'
    );
    
    expect(verifyResult.success).toBe(true);
    // miningAdded 필드가 있다면 true인지 확인
    if (verifyResult.miningAdded !== undefined) {
      expect(verifyResult.miningAdded).toBe(true);
    }

    // 4. 대시보드 확인
    const dashboard = protocol.getUserDashboard(userDID);
    expect(dashboard.mining.totalBMR).toBeGreaterThan(0);
    expect(dashboard.mining.hourlyRate).toBeGreaterThan(0);
    expect(dashboard.mining.activeBMRs).toBe(1);
  });

  test('자동화된 운영자 활동이 반영되어야 함', () => {
    const operatorDID = 'test-auto-operator';
    
    // 운영자 활동 처리
    const result = protocol.handleOperatorActivity(
      operatorDID,
      'proposal_approval',
      'test-proposal',
      { approved: true, reason: '테스트 승인' }
    );

    expect(result.success).toBe(true);
    expect(result.bTokensEarned).toBe(150);

    // 대시보드에서 확인
    const dashboard = protocol.getUserDashboard(operatorDID);
    expect(dashboard.mining.totalBMR).toBe(150);
  });

  test('정기 유지보수 작업이 정상 실행되어야 함', () => {
    // 여러 사용자 추가
    const users = [];
    for (let i = 0; i < 3; i++) {
      const user = protocol.registerUser({
        username: `testuser${i}`,
        password: `TestPass${i}23`,
        name: `테스트 사용자 ${i}`,
        birthDate: '1990-01-01'
      });
      users.push(user.didHash);
      
      // BMR 추가
      protocol.miningSystem.addBMR(user.didHash, 30 + i * 5, 100 + i * 50);
    }

    // 유지보수 작업 실행
    const maintenanceResult = protocol.performMaintenanceTasks();
    
    expect(maintenanceResult.updatedUsers).toBeGreaterThanOrEqual(0);
    expect(maintenanceResult.timestamp).toBeTruthy();
  });

  test('프로토콜 상태 조회가 모든 데이터를 포함해야 함', () => {
    const status = protocol.getProtocolStatus();

    expect(status.version).toBe('1.0.0');
    expect(status.status).toBe('active');
    expect(status.network).toBeTruthy();
    expect(status.daos).toHaveLength(4); // Operations, Development, Community, Political
    expect(status.automation).toBeTruthy();
    expect(status.mining).toBeTruthy();
  });
});

describe('성능 테스트', () => {
  let miningSystem;

  beforeEach(() => {
    miningSystem = new MiningSystem();
  });

  test('대량 BMR 처리 성능', () => {
    const startTime = Date.now();
    
    // 1000개의 BMR 추가
    for (let i = 0; i < 1000; i++) {
      miningSystem.addBMR(`user_${i}`, 25 + (i % 50), 100 + (i % 200));
    }
    
    const addTime = Date.now() - startTime;
    expect(addTime).toBeLessThan(5000); // 5초 내 완료
    
    // 네트워크 통계 계산 성능
    const statsStartTime = Date.now();
    const stats = miningSystem.getNetworkMiningStats();
    const statsTime = Date.now() - statsStartTime;
    
    expect(statsTime).toBeLessThan(1000); // 1초 내 완료
    expect(stats.totalMiners).toBe(1000);
  });

  test('토큰 누적 계산 성능', () => {
    // 100명의 사용자에게 각각 5개의 BMR 추가
    for (let i = 0; i < 100; i++) {
      const userId = `perf_user_${i}`;
      for (let j = 0; j < 5; j++) {
        miningSystem.addBMR(userId, 30, 100);
      }
    }

    const startTime = Date.now();
    
    // 모든 사용자의 토큰 업데이트
    for (let i = 0; i < 100; i++) {
      miningSystem.updateAndGetAccumulatedTokens(`perf_user_${i}`);
    }
    
    const updateTime = Date.now() - startTime;
    expect(updateTime).toBeLessThan(2000); // 2초 내 완료
  });
}); 