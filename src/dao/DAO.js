const { v4: uuidv4 } = require('uuid');

/**
 * 백야 프로토콜 DAO (Decentralized Autonomous Organization) 시스템
 * DAO 생성, 구성원 관리, 거버넌스, DCA 관리 기능 제공
 */
class DAO {
  constructor(didSystem, cvcmSystem) {
    this.didSystem = didSystem;
    this.cvcmSystem = cvcmSystem;
    
    // DAO 관리
    this.daos = new Map(); // daoId -> dao
    this.daoMembers = new Map(); // daoId -> Set(memberDID)
    
    // 제안 관리  
    this.proposals = new Map(); // daoId -> Map(proposalId -> proposal)
    
    // 운영자 지지도 조사
    this.operatorSurveys = new Map(); // daoId -> Map(surveyId -> survey)
    
    // 탄핵 절차
    this.impeachments = new Map(); // daoId -> Map(impeachmentId -> impeachment)
  }

  /**
   * DAO 시스템 초기화 (CVCM 시스템이 설정된 후 호출)
   */
  initialize() {
    if (!this.cvcmSystem) {
      throw new Error('CVCM 시스템이 설정되지 않았습니다');
    }
    this.initializeDefaultDAOs();
  }

  /**
   * 기본 DAO들 초기화
   * @private
   */
  initializeDefaultDAOs() {
    const systemDID = 'did:baekya:system000000000000000000000000000000000';
    
    // Operations DAO
    const operationsDAO = this.createDAO(systemDID, {
      name: 'Operations DAO',
      purpose: 'Protocol Operations Management',
      description: '백야 프로토콜 운영 관리를 담당하는 DAO'
    });

    // Development DAO  
    const developmentDAO = this.createDAO(systemDID, {
      name: 'Development DAO',
      purpose: 'Protocol Development',
      description: '백야 프로토콜 개발을 담당하는 DAO'
    });

    // Community DAO
    const communityDAO = this.createDAO(systemDID, {
      name: 'Community DAO', 
      purpose: 'Community Management',
      description: '백야 프로토콜 커뮤니티 관리를 담당하는 DAO'
    });

    // Political DAO 추가
    const politicalDAO = this.createDAO(systemDID, {
      name: 'Political DAO',
      purpose: 'Political Governance',
      description: '백야 프로토콜 정치적 거버넌스와 정책 결정을 담당하는 DAO'
    });

    // 기본 DCA들 등록
    this.registerDefaultDCAs(operationsDAO, developmentDAO, communityDAO);

    // 기본 DAO ID들 저장 (이니셜 OP 설정용)
    this.defaultDAOs = {
      operations: operationsDAO,
      development: developmentDAO,
      community: communityDAO,
      political: politicalDAO
    };

    console.log(`🏛️ 기본 DAO 초기화 완료: Operations, Development, Community, Political`);
  }

  /**
   * 기본 DCA들 등록
   * @private
   */
  registerDefaultDCAs(operationsDAO, developmentDAO, communityDAO) {
    // Development DAO DCA들
    this.cvcmSystem.registerDCA(developmentDAO, {
      id: 'pull-request',
      name: 'Pull Request',
      description: 'GitHub Pull Request 기여',
      value: 100,
      verificationCriteria: 'GitHub API 연동으로 자동 검증',
      requiredFields: ['evidence', 'description']
    });

    this.cvcmSystem.registerDCA(developmentDAO, {
      id: 'bug-fix',
      name: 'Bug Fix',  
      description: '버그 수정 기여',
      value: 80,
      verificationCriteria: 'GitHub commit history 검증',
      requiredFields: ['evidence', 'description']
    });

    // Operations DAO DCA들
    this.cvcmSystem.registerDCA(operationsDAO, {
      id: 'system-maintenance',
      name: 'System Maintenance',
      description: '시스템 유지보수 기여',
      value: 120,
      verificationCriteria: '시스템 로그 및 작업 증빙 검증',
      requiredFields: ['evidence', 'description']
    });

    // Community DAO DCA들
    this.cvcmSystem.registerDCA(communityDAO, {
      id: 'content-creation',
      name: 'Content Creation',
      description: '콘텐츠 제작 기여',
      value: 60,
      verificationCriteria: '콘텐츠 품질 및 참여도 검증',
      requiredFields: ['evidence', 'description']
    });

    // Political DAO DCA 추가
    const politicalDAOId = this.findDAOByName('Political DAO');
    if (politicalDAOId) {
      this.cvcmSystem.registerDCA(politicalDAOId, {
        id: 'proposal-funding-success',
        name: 'Proposal Funding Success',
        description: '제안 모금 통과 기여',
        value: 20,
        verificationCriteria: '제안이 모금 단계를 통과하여 투표 단계로 진입 시 자동 검증',
        requiredFields: ['evidence', 'description'],
        autoVerified: true // 자동 검증 DCA
      });

      console.log('🏛️ Political DAO DCA 등록 완료: proposal-funding-success (20B)');
    }
  }

  // DAO 이름으로 ID 찾기
  findDAOByName(name) {
    for (const [daoId, dao] of this.daos) {
      if (dao.name === name) {
        return daoId;
      }
    }
    return null;
  }

  /**
   * 새로운 DAO 생성
   * @param {string} founderDID 
   * @param {Object} config - {name, purpose, description}
   * @returns {string} daoId
   */
  createDAO(founderDID, config) {
    if (!config.name || !config.purpose) {
      throw new Error('DAO 생성에 필요한 정보가 누락되었습니다');
    }

    const daoId = uuidv4();
    const dao = {
      id: daoId,
      name: config.name,
      purpose: config.purpose,
      description: config.description || '',
      founderDID,
      operatorDID: founderDID, // 창립자가 초기 운영자
      createdAt: Date.now(),
      status: 'active'
    };

    this.daos.set(daoId, dao);
    
    // 창립자를 첫 번째 구성원으로 추가
    this.daoMembers.set(daoId, new Set([founderDID]));
    
    // 제안 저장소 초기화
    this.proposals.set(daoId, new Map());
    
    // 운영자 조사 저장소 초기화
    this.operatorSurveys.set(daoId, new Map());
    
    return daoId;
  }

  /**
   * DAO 정보 조회
   * @param {string} daoId 
   * @returns {Object}
   */
  getDAO(daoId) {
    const dao = this.daos.get(daoId);
    if (!dao) {
      throw new Error('존재하지 않는 DAO입니다');
    }
    return dao;
  }

  /**
   * DAO에 기여자 추가 (기여하면 자동으로 구성원이 됨)
   * @param {string} daoId 
   * @param {string} contributorDID 
   */
  addContributor(daoId, contributorDID) {
    if (!this.daos.has(daoId)) {
      throw new Error('존재하지 않는 DAO입니다');
    }

    const members = this.daoMembers.get(daoId);
    members.add(contributorDID);
  }

  /**
   * DAO 구성원 목록 조회
   * @param {string} daoId 
   * @returns {Array}
   */
  getDAOMembers(daoId) {
    const members = this.daoMembers.get(daoId);
    if (!members) {
      throw new Error('존재하지 않는 DAO입니다');
    }
    return Array.from(members);
  }

  /**
   * DCA 등록 (운영자만 가능)
   * @param {string} daoId 
   * @param {string} operatorDID 
   * @param {Object} dca 
   */
  registerDCA(daoId, operatorDID, dca) {
    const dao = this.getDAO(daoId);
    
    if (dao.operatorDID !== operatorDID) {
      throw new Error('DCA 등록 권한이 없습니다');
    }

    this.cvcmSystem.registerDCA(daoId, dca);
  }

  /**
   * DCA 조회
   * @param {string} daoId 
   * @param {string} dcaId 
   * @returns {Object}
   */
  getDCA(daoId, dcaId) {
    return this.cvcmSystem.getDCA(daoId, dcaId);
  }

  /**
   * 제안 생성
   * @param {string} daoId 
   * @param {string} proposerDID 
   * @param {Object} proposalData 
   * @returns {string} proposalId
   */
  createProposal(daoId, proposerDID, proposalData) {
    const dao = this.getDAO(daoId);
    const members = this.getDAOMembers(daoId);
    
    if (!members.includes(proposerDID)) {
      throw new Error('DAO 구성원만 제안할 수 있습니다');
    }

    const proposalId = uuidv4();
    const proposal = {
      id: proposalId,
      daoId,
      proposerDID,
      title: proposalData.title,
      description: proposalData.description,
      type: proposalData.type,
      data: proposalData.data,
      status: 'pending',
      createdAt: Date.now(),
      stake: 0,
      endorsements: 0,
      votes: {
        approve: 0,
        reject: 0,
        abstain: 0
      },
      voters: new Set()
    };

    const daoProposals = this.proposals.get(daoId);
    daoProposals.set(proposalId, proposal);
    
    return proposalId;
  }

  /**
   * 제안 조회
   * @param {string} daoId 
   * @param {string} proposalId 
   * @returns {Object}
   */
  getProposal(daoId, proposalId) {
    const daoProposals = this.proposals.get(daoId);
    if (!daoProposals) {
      throw new Error('존재하지 않는 DAO입니다');
    }
    
    const proposal = daoProposals.get(proposalId);
    if (!proposal) {
      throw new Error('존재하지 않는 제안입니다');
    }
    
    return proposal;
  }

  /**
   * 제안 담보 지불
   * @param {string} daoId 
   * @param {string} proposalId 
   * @param {string} proposerDID 
   * @param {number} stakeAmount 
   */
  payProposalStake(daoId, proposalId, proposerDID, stakeAmount) {
    const proposal = this.getProposal(daoId, proposalId);
    
    if (proposal.proposerDID !== proposerDID) {
      throw new Error('제안자만 담보를 지불할 수 있습니다');
    }

    // P-token 담보 지불 (실제로는 didSystem과 연동)
    proposal.stake += stakeAmount;
    
    this._checkProposalProgress(daoId, proposalId);
  }

  /**
   * 제안 지지
   * @param {string} daoId 
   * @param {string} proposalId 
   * @param {string} endorserDID 
   * @param {number} endorseAmount 
   */
  endorseProposal(daoId, proposalId, endorserDID, endorseAmount) {
    const proposal = this.getProposal(daoId, proposalId);
    const members = this.getDAOMembers(daoId);
    
    if (!members.includes(endorserDID)) {
      throw new Error('DAO 구성원만 지지할 수 있습니다');
    }

    proposal.endorsements += endorseAmount;
    
    this._checkProposalProgress(daoId, proposalId);
  }

  /**
   * 제안 진행 상태 확인 및 업데이트
   * @private
   * @param {string} daoId 
   * @param {string} proposalId 
   */
  _checkProposalProgress(daoId, proposalId) {
    const proposal = this.getProposal(daoId, proposalId);
    const members = this.getDAOMembers(daoId);
    
    // 진입 조건: 담보 1P 이상 + 전체 구성원의 1% 지지
    const requiredEndorsements = Math.max(1, Math.ceil(members.length * 0.01));
    
    if (proposal.status === 'pending' && 
        proposal.stake >= 1 && 
        proposal.endorsements >= requiredEndorsements) {
      proposal.status = 'voting';
      proposal.votingStartedAt = Date.now();
    }
  }

  /**
   * 제안 투표
   * @param {string} daoId 
   * @param {string} proposalId 
   * @param {string} voterDID 
   * @param {string} vote - 'approve', 'reject', 'abstain'
   * @param {number} voteWeight 
   * @returns {Object}
   */
  vote(daoId, proposalId, voterDID, vote, voteWeight) {
    const proposal = this.getProposal(daoId, proposalId);
    const members = this.getDAOMembers(daoId);
    
    if (!members.includes(voterDID)) {
      throw new Error('DAO 구성원만 투표할 수 있습니다');
    }
    
    if (proposal.status !== 'voting') {
      throw new Error('투표 가능한 상태가 아닙니다');
    }
    
    if (proposal.voters.has(voterDID)) {
      throw new Error('이미 투표에 참여했습니다');
    }
    
    if (!['approve', 'reject', 'abstain'].includes(vote)) {
      throw new Error('유효하지 않은 투표입니다');
    }

    // P-token 0.1개 소모 (실제로는 didSystem과 연동)
    proposal.votes[vote] += voteWeight;
    proposal.voters.add(voterDID);
    
    // 정족수 확인 (1P 이상 보유자의 40%)
    const quorum = Math.ceil(members.length * 0.4);
    const totalVotes = proposal.votes.approve + proposal.votes.reject + proposal.votes.abstain;
    
    if (totalVotes >= quorum) {
      this._concludeVoting(daoId, proposalId);
    }

    return {
      success: true,
      vote,
      voteWeight
    };
  }

  /**
   * 투표 종료 및 결과 처리
   * @private
   * @param {string} daoId 
   * @param {string} proposalId 
   */
  _concludeVoting(daoId, proposalId) {
    const proposal = this.getProposal(daoId, proposalId);
    
    const approveVotes = proposal.votes.approve;
    const rejectVotes = proposal.votes.reject;
    const totalDecisionVotes = approveVotes + rejectVotes; // 기권 제외
    
    // 기권 제외한 찬성표가 50% 이상이면 통과
    if (totalDecisionVotes > 0 && approveVotes / totalDecisionVotes >= 0.5) {
      proposal.status = 'passed';
    } else {
      proposal.status = 'rejected';
    }
    
    proposal.concludedAt = Date.now();
  }

  /**
   * 운영자 지지도 조사 실시
   * @param {string} daoId 
   * @returns {string} surveyId
   */
  conductOperatorSurvey(daoId) {
    const dao = this.getDAO(daoId);
    
    const surveyId = uuidv4();
    const survey = {
      id: surveyId,
      daoId,
      operatorDID: dao.operatorDID,
      status: 'active',
      createdAt: Date.now(),
      votes: {
        support: 0,
        neutral: 0,
        oppose: 0
      },
      voters: new Set()
    };

    const daoSurveys = this.operatorSurveys.get(daoId);
    daoSurveys.set(surveyId, survey);
    
    return surveyId;
  }

  /**
   * 운영자 지지도 조사 조회
   * @param {string} daoId 
   * @param {string} surveyId 
   * @returns {Object}
   */
  getOperatorSurvey(daoId, surveyId) {
    const daoSurveys = this.operatorSurveys.get(daoId);
    if (!daoSurveys) {
      throw new Error('존재하지 않는 DAO입니다');
    }
    
    const survey = daoSurveys.get(surveyId);
    if (!survey) {
      throw new Error('존재하지 않는 조사입니다');
    }
    
    return survey;
  }

  /**
   * 운영자 지지도 조사 투표
   * @param {string} daoId 
   * @param {string} surveyId 
   * @param {string} voterDID 
   * @param {string} vote - 'support', 'neutral', 'oppose'
   * @returns {Object}
   */
  voteOperatorSurvey(daoId, surveyId, voterDID, vote) {
    const survey = this.getOperatorSurvey(daoId, surveyId);
    const members = this.getDAOMembers(daoId);
    
    if (!members.includes(voterDID)) {
      throw new Error('DAO 구성원만 투표할 수 있습니다');
    }
    
    if (survey.voters.has(voterDID)) {
      throw new Error('이미 투표에 참여했습니다');
    }
    
    if (!['support', 'neutral', 'oppose'].includes(vote)) {
      throw new Error('유효하지 않은 투표입니다');
    }

    survey.votes[vote] += 1;
    survey.voters.add(voterDID);
    
    return {
      success: true,
      vote
    };
  }

  /**
   * 운영자 지지도 조사 종료
   * @param {string} daoId 
   * @param {string} surveyId 
   * @returns {Object}
   */
  concludeOperatorSurvey(daoId, surveyId) {
    const survey = this.getOperatorSurvey(daoId, surveyId);
    
    survey.status = 'concluded';
    survey.concludedAt = Date.now();
    
    const supportVotes = survey.votes.support;
    const opposeVotes = survey.votes.oppose;
    const totalDecisionVotes = supportVotes + opposeVotes; // 중립 제외
    
    // 지지율 40% 이하면 탄핵 절차 시작
    const supportRate = totalDecisionVotes > 0 ? supportVotes / totalDecisionVotes : 1;
    const impeachmentTriggered = supportRate <= 0.4;
    
    if (impeachmentTriggered) {
      this._startImpeachmentProcess(daoId);
    }
    
    return {
      supportRate,
      impeachmentTriggered
    };
  }

  /**
   * 탄핵 절차 시작
   * @private
   * @param {string} daoId 
   */
  _startImpeachmentProcess(daoId) {
    const dao = this.getDAO(daoId);
    
    const impeachmentId = uuidv4();
    const impeachment = {
      id: impeachmentId,
      daoId,
      targetOperatorDID: dao.operatorDID,
      status: 'active',
      createdAt: Date.now(),
      votes: {
        approve: 0,
        reject: 0
      },
      voters: new Set()
    };

    if (!this.impeachments.has(daoId)) {
      this.impeachments.set(daoId, new Map());
    }
    
    const daoImpeachments = this.impeachments.get(daoId);
    daoImpeachments.set(impeachmentId, impeachment);
  }

  /**
   * DAO 통계 조회
   * @param {string} daoId 
   * @returns {Object}
   */
  getDAOStats(daoId) {
    const dao = this.getDAO(daoId);
    const members = this.getDAOMembers(daoId);
    const contributionStats = this.cvcmSystem.getDAOContributionStats(daoId);
    
    return {
      ...dao,
      memberCount: members.length,
      ...contributionStats
    };
  }

  /**
   * 첫 번째 사용자를 모든 DAO의 이니셜 OP로 설정
   * @param {string} userDID - 첫 번째 사용자의 DID
   */
  setInitialOperator(userDID) {
    if (!this.defaultDAOs) {
      console.error('❌ 기본 DAO가 초기화되지 않았습니다');
      return { success: false, error: '기본 DAO가 초기화되지 않았습니다' };
    }

    const results = [];

    // 4개 기본 DAO의 OP로 설정
    Object.entries(this.defaultDAOs).forEach(([daoType, daoId]) => {
      try {
        const dao = this.daos.get(daoId);
        if (dao) {
          // 기존 시스템 DID를 첫 번째 사용자로 변경
          dao.operatorDID = userDID;
          dao.founderDID = userDID; // 창립자도 변경
          
          // DAO 구성원으로 추가
          const members = this.daoMembers.get(daoId);
          members.add(userDID);
          
          // P-Token 30개 지급 (각 DAO별)
          const pTokenSystem = this.cvcmSystem?.pTokenSystem || this.pTokenSystem;
          if (pTokenSystem) {
            const currentBalance = pTokenSystem.getPTokenBalance(userDID);
            pTokenSystem.setPTokenBalance(userDID, currentBalance + 30);
            
            // 발행 기록
            pTokenSystem.recordPTokenIssuance(daoId, userDID, 30);
          }

          results.push({
            dao: dao.name,
            daoId: daoId,
            role: 'Initial Operator',
            pTokensGranted: 30,
            success: true
          });

          console.log(`👑 ${dao.name} 이니셜 OP 설정 완료: ${userDID} (+30P)`);
        }
      } catch (error) {
        console.error(`❌ ${daoType} DAO OP 설정 실패:`, error.message);
        results.push({
          dao: daoType,
          daoId: daoId,
          success: false,
          error: error.message
        });
      }
    });

    const successCount = results.filter(r => r.success).length;
    const totalPTokens = successCount * 30;

    console.log(`🎉 이니셜 OP 설정 완료: ${successCount}/4개 DAO, 총 ${totalPTokens}P 지급`);

    return {
      success: successCount > 0,
      userDID,
      totalDAOs: successCount,
      totalPTokensGranted: totalPTokens,
      results: results,
      message: `${successCount}개 DAO의 이니셜 OP로 설정되었습니다. 총 ${totalPTokens}P가 지급되었습니다.`
    };
  }

  /**
   * P-Token 시스템 연결
   * @param {Object} pTokenSystem 
   */
  setPTokenSystem(pTokenSystem) {
    this.pTokenSystem = pTokenSystem;
  }
}

module.exports = DAO; 