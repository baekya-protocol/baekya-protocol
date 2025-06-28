const DAO = require('../DAO');
const DID = require('../../did/DID');
const CVCM = require('../../cvcm/CVCM');

describe('DAO System', () => {
  let daoSystem;
  let didSystem;
  let cvcmSystem;

  beforeEach(() => {
    didSystem = new DID();
    cvcmSystem = new CVCM(didSystem);
    daoSystem = new DAO(didSystem, cvcmSystem);
  });

  describe('DAO 생성', () => {
    test('새로운 DAO를 생성할 수 있어야 함', () => {
      const founderDID = 'founder-did-hash';
      const daoConfig = {
        name: 'Development DAO',
        purpose: '백야 프로토콜 개발',
        description: '백야 프로토콜의 개발과 개선을 위한 DAO'
      };

      const daoId = daoSystem.createDAO(founderDID, daoConfig);

      expect(daoId).toBeDefined();
      expect(typeof daoId).toBe('string');
      
      const dao = daoSystem.getDAO(daoId);
      expect(dao.name).toBe(daoConfig.name);
      expect(dao.purpose).toBe(daoConfig.purpose);
      expect(dao.founderDID).toBe(founderDID);
      expect(dao.operatorDID).toBe(founderDID); // 창립자가 초기 운영자
    });

    test('필수 정보 없이는 DAO를 생성할 수 없어야 함', () => {
      const founderDID = 'founder-did-hash';
      const invalidConfig = {
        name: 'Test DAO'
        // purpose 누락
      };

      expect(() => {
        daoSystem.createDAO(founderDID, invalidConfig);
      }).toThrow('DAO 생성에 필요한 정보가 누락되었습니다');
    });
  });

  describe('구성원 관리', () => {
    let daoId;

    beforeEach(() => {
      const founderDID = 'founder-did-hash';
      const daoConfig = {
        name: 'Test DAO',
        purpose: '테스트 목적',
        description: '테스트용 DAO'
      };
      daoId = daoSystem.createDAO(founderDID, daoConfig);
    });

    test('기여자는 자동으로 DAO 구성원이 되어야 함', () => {
      const contributorDID = 'contributor-did-hash';
      
      // 기여자가 DAO에 기여했다고 가정
      daoSystem.addContributor(daoId, contributorDID);
      
      const members = daoSystem.getDAOMembers(daoId);
      expect(members).toContain(contributorDID);
    });

    test('DAO 구성원 목록을 조회할 수 있어야 함', () => {
      const contributorDID1 = 'contributor-1';
      const contributorDID2 = 'contributor-2';
      
      daoSystem.addContributor(daoId, contributorDID1);
      daoSystem.addContributor(daoId, contributorDID2);
      
      const members = daoSystem.getDAOMembers(daoId);
      expect(members).toContain('founder-did-hash'); // 창립자
      expect(members).toContain(contributorDID1);
      expect(members).toContain(contributorDID2);
      expect(members.length).toBe(3);
    });
  });

  describe('DCA 관리', () => {
    let daoId;

    beforeEach(() => {
      const founderDID = 'founder-did-hash';
      const daoConfig = {
        name: 'Dev DAO',
        purpose: '개발',
        description: '개발 DAO'
      };
      daoId = daoSystem.createDAO(founderDID, daoConfig);
    });

    test('DAO 운영자가 DCA를 등록할 수 있어야 함', () => {
      const operatorDID = 'founder-did-hash';
      const dca = {
        id: 'code-review',
        name: 'Code Review',
        value: 100,
        verificationCriteria: 'approved'
      };

      daoSystem.registerDCA(daoId, operatorDID, dca);
      
      const registeredDCA = daoSystem.getDCA(daoId, 'code-review');
      expect(registeredDCA).toEqual(dca);
    });

    test('일반 구성원은 DCA를 등록할 수 없어야 함', () => {
      const memberDID = 'member-did-hash';
      const dca = {
        id: 'code-review',
        name: 'Code Review',
        value: 100,
        verificationCriteria: 'approved'
      };

      expect(() => {
        daoSystem.registerDCA(daoId, memberDID, dca);
      }).toThrow('DCA 등록 권한이 없습니다');
    });
  });

  describe('거버넌스', () => {
    let daoId;

    beforeEach(() => {
      const founderDID = 'founder-did-hash';
      const daoConfig = {
        name: 'Governance DAO',
        purpose: '거버넌스 테스트',
        description: '거버넌스 테스트용 DAO'
      };
      daoId = daoSystem.createDAO(founderDID, daoConfig);
      
      // 테스트용 구성원들 추가
      daoSystem.addContributor(daoId, 'member-1');
      daoSystem.addContributor(daoId, 'member-2');
      daoSystem.addContributor(daoId, 'member-3');
    });

    test('구성원이 제안을 생성할 수 있어야 함', () => {
      const proposerDID = 'member-1';
      const proposal = {
        title: '새로운 DCA 추가 제안',
        description: 'UI/UX 디자인 DCA를 추가하자',
        type: 'dca-addition',
        data: {
          dcaId: 'ui-design',
          dcaName: 'UI/UX Design',
          dcaValue: 150,
          verificationCriteria: 'design-approved'
        }
      };

      const proposalId = daoSystem.createProposal(daoId, proposerDID, proposal);
      
      expect(proposalId).toBeDefined();
      expect(typeof proposalId).toBe('string');
      
      const createdProposal = daoSystem.getProposal(daoId, proposalId);
      expect(createdProposal.title).toBe(proposal.title);
      expect(createdProposal.proposerDID).toBe(proposerDID);
      expect(createdProposal.status).toBe('pending');
    });

    test('제안이 진입 조건을 만족하면 투표 단계로 진행되어야 함', () => {
      const proposerDID = 'member-1';
      const proposal = {
        title: '테스트 제안',
        description: '테스트용 제안',
        type: 'general'
      };

      const proposalId = daoSystem.createProposal(daoId, proposerDID, proposal);
      
      // P-token 담보 지불 (테스트에서는 시뮬레이션)
      daoSystem.payProposalStake(daoId, proposalId, proposerDID, 1);
      
      // 다른 구성원들이 지지 (전체 구성원의 1% 이상)
      daoSystem.endorseProposal(daoId, proposalId, 'member-2', 1);
      
      const updatedProposal = daoSystem.getProposal(daoId, proposalId);
      expect(updatedProposal.status).toBe('voting');
    });

    test('구성원이 제안에 투표할 수 있어야 함', () => {
      const proposerDID = 'member-1';
      const proposal = {
        title: '테스트 제안',
        description: '테스트용 제안',
        type: 'general'
      };

      const proposalId = daoSystem.createProposal(daoId, proposerDID, proposal);
      
      // 제안을 투표 단계로 진행
      daoSystem.payProposalStake(daoId, proposalId, proposerDID, 1);
      daoSystem.endorseProposal(daoId, proposalId, 'member-2', 1);
      
      // 투표
      const voteResult = daoSystem.vote(daoId, proposalId, 'member-3', 'approve', 0.1);
      
      expect(voteResult.success).toBe(true);
      expect(voteResult.vote).toBe('approve');
      
      const updatedProposal = daoSystem.getProposal(daoId, proposalId);
      expect(updatedProposal.votes.approve).toBe(0.1);
    });
  });

  describe('운영자 관리', () => {
    let daoId;

          beforeEach(() => {
        const founderDID = 'founder-did-hash';
        const daoConfig = {
          name: 'Test DAO',
          purpose: '운영자 테스트',
          description: '운영자 관리 테스트용 DAO'
        };
        daoId = daoSystem.createDAO(founderDID, daoConfig);
        
        // 테스트용 구성원들 추가
        daoSystem.addContributor(daoId, 'member-1');
        daoSystem.addContributor(daoId, 'member-2');
        daoSystem.addContributor(daoId, 'member-3');
      });

    test('운영자 지지도 조사를 실시할 수 있어야 함', () => {
      const surveyId = daoSystem.conductOperatorSurvey(daoId);
      
      expect(surveyId).toBeDefined();
      const survey = daoSystem.getOperatorSurvey(daoId, surveyId);
      expect(survey.status).toBe('active');
    });

    test('구성원이 운영자 지지도 조사에 참여할 수 있어야 함', () => {
      const surveyId = daoSystem.conductOperatorSurvey(daoId);
      
      const voteResult = daoSystem.voteOperatorSurvey(daoId, surveyId, 'member-1', 'support');
      
      expect(voteResult.success).toBe(true);
      
      const survey = daoSystem.getOperatorSurvey(daoId, surveyId);
      expect(survey.votes.support).toBe(1);
    });

    test('지지도가 낮으면 탄핵 절차가 시작되어야 함', () => {
      const surveyId = daoSystem.conductOperatorSurvey(daoId);
      
      // 지지도 낮게 투표
      daoSystem.voteOperatorSurvey(daoId, surveyId, 'member-1', 'oppose');
      daoSystem.voteOperatorSurvey(daoId, surveyId, 'member-2', 'oppose');
      daoSystem.voteOperatorSurvey(daoId, surveyId, 'member-3', 'oppose');
      
      // 설문 종료 시뮬레이션
      const impeachmentResult = daoSystem.concludeOperatorSurvey(daoId, surveyId);
      
      expect(impeachmentResult.impeachmentTriggered).toBe(true);
    });
  });
}); 