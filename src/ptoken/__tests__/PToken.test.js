const PToken = require('../PToken');
const DID = require('../../did/DID');
const CVCM = require('../../cvcm/CVCM');
const DAO = require('../../dao/DAO');

describe('P-Token (Political Token) System', () => {
  let pTokenSystem;
  let didSystem;
  let cvcmSystem;
  let daoSystem;

  beforeEach(() => {
    didSystem = new DID();
    cvcmSystem = new CVCM(didSystem);
    daoSystem = new DAO(didSystem, cvcmSystem);
    pTokenSystem = new PToken(didSystem, cvcmSystem, daoSystem);
  });

  describe('CAPM 발행 방식', () => {
    test('기여자들에게 등차수열 방식으로 P-token을 발행해야 함', () => {
      const daoId = 'test-dao';
      const contributors = [
        { did: 'contributor-1', contribution: 100 },
        { did: 'contributor-2', contribution: 80 },
        { did: 'contributor-3', contribution: 60 },
        { did: 'contributor-4', contribution: 40 },
        { did: 'contributor-5', contribution: 20 }
      ];

      const mintingConfig = {
        minGuarantee: 1,    // P_min
        totalContributors: 5
      };

      const result = pTokenSystem.mintPTokensCAMP(daoId, contributors, mintingConfig);

      expect(result.success).toBe(true);
      expect(result.totalMinted).toBe(15); // 5명 = 3P median * 5 = 15p
      
      // 1등은 가장 많이, 5등은 최소값 받아야 함
      expect(result.distributions[0].amount).toBeGreaterThan(result.distributions[4].amount);
      expect(result.distributions[4].amount).toBe(1); // 최소 보장값
    });

    test('등차수열 공식이 정확히 계산되어야 함', () => {
      const contributors = [
        { did: 'top-contributor', contribution: 1000 },
        { did: 'mid-contributor', contribution: 500 },
        { did: 'low-contributor', contribution: 100 }
      ];

      const mintingConfig = {
        minGuarantee: 5,
        medianValue: 20, // 등차수열 공식 테스트를 위해 명시적으로 지정
        totalContributors: 3
      };

      const calculation = pTokenSystem.calculateCAPM(contributors, mintingConfig);
      
      // P_total = N * P_median = 3 * 20 = 60
      expect(calculation.totalPTokens).toBe(60);
      
      // d = 2 * (P_median - P_min) / (N-1) = 2 * (20-5) / 2 = 15
      expect(calculation.commonDifference).toBe(15);
      
      // 1등: P_min + (N-1) * d = 5 + 2 * 15 = 35
      expect(calculation.distributions[0].amount).toBe(35);
      
      // 3등: P_min = 5
      expect(calculation.distributions[2].amount).toBe(5);
    });

    test('구성원 수에 따른 P중간값이 올바르게 계산되어야 함', () => {
      expect(pTokenSystem.calculateMedianValue(5)).toBe(3);    // 10명 이하: 3P
      expect(pTokenSystem.calculateMedianValue(10)).toBe(3);   // 10명 이하: 3P
      expect(pTokenSystem.calculateMedianValue(50)).toBe(8);   // 10~100명: 8P
      expect(pTokenSystem.calculateMedianValue(100)).toBe(8);  // 10~100명: 8P
      expect(pTokenSystem.calculateMedianValue(500)).toBe(16); // 100~1000명: 16P
      expect(pTokenSystem.calculateMedianValue(1000)).toBe(16);// 100~1000명: 16P
      expect(pTokenSystem.calculateMedianValue(2000)).toBe(30);// 1000명 이상: 30P
    });

    test('구성원 수에 따른 자동 P중간값 계산이 적용되어야 함', () => {
      const contributors = [
        { did: 'contributor-1', contribution: 100 },
        { did: 'contributor-2', contribution: 80 },
        { did: 'contributor-3', contribution: 60 }
      ];

      const mintingConfig = {
        minGuarantee: 1
      };

      const calculation = pTokenSystem.calculateCAPM(contributors, mintingConfig);
      
      // 3명의 contributors이므로 medianValue는 3P가 자동 계산됨
      expect(calculation.totalPTokens).toBe(9); // 3 * 3 = 9P
    });
  });

  describe('P-token 관리', () => {
    test('P-token 잔액을 조회할 수 있어야 함', () => {
      const did = 'test-did';
      const amount = 25;

      pTokenSystem.setPTokenBalance(did, amount);
      const balance = pTokenSystem.getPTokenBalance(did);

      expect(balance).toBe(amount);
    });

    test('P-token을 전송할 수 있어야 함', () => {
      const fromDID = 'sender-did';
      const toDID = 'receiver-did';
      const amount = 10;

      pTokenSystem.setPTokenBalance(fromDID, 50);
      pTokenSystem.setPTokenBalance(toDID, 0);

      const result = pTokenSystem.transferPToken(fromDID, toDID, amount);

      expect(result.success).toBe(true);
      expect(pTokenSystem.getPTokenBalance(fromDID)).toBe(40);
      expect(pTokenSystem.getPTokenBalance(toDID)).toBe(10);
    });

    test('잔액 부족시 전송이 실패해야 함', () => {
      const fromDID = 'sender-did';
      const toDID = 'receiver-did';
      const amount = 100;

      pTokenSystem.setPTokenBalance(fromDID, 50);

      expect(() => {
        pTokenSystem.transferPToken(fromDID, toDID, amount);
      }).toThrow('P-token 잔액이 부족합니다');
    });
  });

  describe('참정권 계산', () => {
    test('P-token 보유량에 따른 투표 가중치를 계산해야 함', () => {
      const did = 'voter-did';
      const pTokenAmount = 15;

      pTokenSystem.setPTokenBalance(did, pTokenAmount);
      const votingPower = pTokenSystem.getVotingPower(did);

      expect(votingPower).toBe(pTokenAmount);
    });

    test('1P 이상 보유자만 투표 자격이 있어야 함', () => {
      const did1 = 'qualified-voter';
      const did2 = 'unqualified-voter';

      pTokenSystem.setPTokenBalance(did1, 2);
      pTokenSystem.setPTokenBalance(did2, 0.5);

      expect(pTokenSystem.isQualifiedVoter(did1)).toBe(true);
      expect(pTokenSystem.isQualifiedVoter(did2)).toBe(false);
    });
  });

  describe('주기적 발행', () => {
    test('DAO별로 주기적 P-token 발행을 실행할 수 있어야 함', async () => {
      // 테스트용 DAO 생성
      const founderDID = 'founder';
      const daoId = daoSystem.createDAO(founderDID, {
        name: 'Test DAO',
        purpose: 'Testing periodic minting'
      });

      // 기여자들 추가 (시뮬레이션)
      const contributors = [
        { did: 'contributor-1', contribution: 200 },
        { did: 'contributor-2', contribution: 150 },
        { did: 'contributor-3', contribution: 100 }
      ];

      contributors.forEach(contributor => {
        daoSystem.addContributor(daoId, contributor.did);
      });

      // 주기적 발행 실행
      const mintingResult = await pTokenSystem.executePeriodicMinting(daoId, contributors);

      expect(mintingResult.success).toBe(true);
      expect(mintingResult.daoId).toBe(daoId);
      expect(mintingResult.contributorsCount).toBe(3);
      expect(mintingResult.totalMinted).toBeGreaterThan(0);
    });

    test('기여가 없는 기간에는 P-token이 발행되지 않아야 함', async () => {
      const daoId = daoSystem.createDAO('founder', {
        name: 'Inactive DAO',
        purpose: 'Testing inactive period'
      });

      // 기여자 없음
      const contributors = [];

      const mintingResult = await pTokenSystem.executePeriodicMinting(daoId, contributors);

      expect(mintingResult.success).toBe(true);
      expect(mintingResult.totalMinted).toBe(0);
      expect(mintingResult.message).toContain('기여자가 없습니다');
    });
  });

  describe('P-token 소각', () => {
    test('제안 담보로 사용된 P-token을 소각할 수 있어야 함', () => {
      const did = 'proposer-did';
      const initialAmount = 50;
      const burnAmount = 5;

      pTokenSystem.setPTokenBalance(did, initialAmount);
      
      const result = pTokenSystem.burnPToken(did, burnAmount, '제안 담보');
      
      expect(result.success).toBe(true);
      expect(pTokenSystem.getPTokenBalance(did)).toBe(initialAmount - burnAmount);
    });

    test('탄핵된 운영자의 모든 P-token을 소각할 수 있어야 함', () => {
      const operatorDID = 'impeached-operator';
      const initialAmount = 100;

      pTokenSystem.setPTokenBalance(operatorDID, initialAmount);
      
      const result = pTokenSystem.burnAllPTokens(operatorDID, '운영자 탄핵');
      
      expect(result.success).toBe(true);
      expect(pTokenSystem.getPTokenBalance(operatorDID)).toBe(0);
      expect(result.burnedAmount).toBe(initialAmount);
    });
  });

  describe('P-token 통계', () => {
    test('DAO별 P-token 발행 통계를 조회할 수 있어야 함', () => {
      const daoId = 'stats-dao';
      
      // 여러 구성원에게 P-token 발행
      const members = [
        { did: 'member-1', amount: 30 },
        { did: 'member-2', amount: 20 },
        { did: 'member-3', amount: 10 }
      ];

      members.forEach(member => {
        pTokenSystem.setPTokenBalance(member.did, member.amount);
        pTokenSystem.recordPTokenIssuance(daoId, member.did, member.amount);
      });

      const stats = pTokenSystem.getDAOPTokenStats(daoId);

      expect(stats.totalIssued).toBe(60);
      expect(stats.totalHolders).toBe(3);
      expect(stats.averageHolding).toBe(20);
    });

    test('전체 네트워크 P-token 통계를 조회할 수 있어야 함', () => {
      // 여러 DAO에 P-token 발행
      const distributions = [
        { daoId: 'dao-1', did: 'user-1', amount: 25 },
        { daoId: 'dao-1', did: 'user-2', amount: 15 },
        { daoId: 'dao-2', did: 'user-3', amount: 35 },
        { daoId: 'dao-2', did: 'user-4', amount: 20 }
      ];

      distributions.forEach(dist => {
        pTokenSystem.setPTokenBalance(dist.did, dist.amount);
        pTokenSystem.recordPTokenIssuance(dist.daoId, dist.did, dist.amount);
      });

      const networkStats = pTokenSystem.getNetworkPTokenStats();

      expect(networkStats.totalSupply).toBe(95);
      expect(networkStats.totalHolders).toBe(4);
      expect(networkStats.activeDAOs).toBe(2);
    });
  });
}); 