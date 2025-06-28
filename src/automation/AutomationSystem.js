const crypto = require('crypto');

/**
 * 자동화 시스템
 * 운영 DAO DCA 자동 반영, GitHub 통합, 초대 시스템 등을 관리
 */
class AutomationSystem {
  constructor(protocol) {
    this.protocol = protocol;
    this.githubWebhooks = new Map();
    this.inviteLinks = new Map();
    this.pendingInvites = new Map();
  }

  // 자동화 시스템 시작
  start() {
    console.log('🤖 자동화 시스템이 시작되었습니다.');
    
    // PoliticalDAO DCA 자동 처리 시스템 시작
    this.startPoliticalDAOMonitoring();
    
    console.log(`📊 현재 상태: ${JSON.stringify(this.getAutomationStatus())}`);
    return { success: true, message: '자동화 시스템 시작 완료' };
  }

  // PoliticalDAO 모금 통과 자동 모니터링
  startPoliticalDAOMonitoring() {
    // 1분마다 PoliticalDAO 제안 상태 체크
    this.politicalDAOMonitor = setInterval(() => {
      this.checkPoliticalDAOProposals();
    }, 60000);
    
    console.log('🏛️ PoliticalDAO 자동 모니터링 시작');
  }

  // PoliticalDAO 제안 모금 통과 체크
  async checkPoliticalDAOProposals() {
    try {
      const daoSystem = this.protocol.getDAOSystem();
      const cvcmSystem = this.protocol.getCVCMSystem();
      
      // PoliticalDAO 제안들 확인
      const politicalDAOId = this.getPoliticalDAOId();
      if (!politicalDAOId) return;
      
      const daoProposals = daoSystem.proposals.get(politicalDAOId);
      if (!daoProposals) return;
      
      for (const [proposalId, proposal] of daoProposals) {
        // 모금 통과하여 투표 단계로 진입한 제안 체크
        if (proposal.status === 'voting' && !proposal.dcaProcessed) {
          await this.processPoliticalDAOContribution(proposal, cvcmSystem);
          proposal.dcaProcessed = true; // 중복 처리 방지
        }
      }
    } catch (error) {
      console.error('❌ PoliticalDAO 모니터링 실패:', error.message);
    }
  }

  // PoliticalDAO 기여 처리 (모금 통과 → 20B DCA 자동 누적)
  async processPoliticalDAOContribution(proposal, cvcmSystem) {
    try {
      const contributorDID = proposal.proposerDID;
      const contributorAge = this.getContributorAge(contributorDID);
      
      // PoliticalDAO DCA 자동 기여 제출
      const contributionData = {
        daoId: 'political-dao',
        dcaId: 'proposal-funding-success',
        contributorDID: contributorDID,
        contributorAge: contributorAge,
        gender: 'default',
        description: `제안 "${proposal.title}" 모금 통과`,
        evidence: `제안 ID: ${proposal.id}, 모금 성공 시점: ${Date.now()}`
      };
      
      // 기여 제출
      const submitResult = cvcmSystem.submitContribution(contributionData);
      if (submitResult.success) {
        // 자동 검증 (PoliticalDAO는 자동 검증)
        const verifyResult = await cvcmSystem.verifyContribution(
          submitResult.contributionId,
          'did:baekya:system-auto-verifier',
          true,
          'PoliticalDAO 모금 통과 자동 검증'
        );
        
        console.log(`🏛️ PoliticalDAO DCA 자동 처리 완료: ${contributorDID} → 20B 누적, BMR: ${verifyResult.bmrAdded}`);
        
        return {
          success: true,
          contributionId: submitResult.contributionId,
          bmrAdded: verifyResult.bmrAdded,
          totalBMR: verifyResult.totalBMR
        };
      }
    } catch (error) {
      console.error('❌ PoliticalDAO 기여 처리 실패:', error.message);
    }
  }

  // PoliticalDAO ID 조회
  getPoliticalDAOId() {
    const daoSystem = this.protocol.getDAOSystem();
    for (const [daoId, dao] of daoSystem.daos) {
      if (dao.name === 'Political DAO' || dao.purpose === 'Political Governance') {
        return daoId;
      }
    }
    return null;
  }

  // 기여자 나이 조회 (DID 시스템 연동)
  getContributorAge(contributorDID) {
    try {
      const didSystem = this.protocol.getDIDSystem();
      return didSystem.getDIDAge(contributorDID);
    } catch (error) {
      return 30; // 기본값
    }
  }

  // 자동화 시스템 중지
  stop() {
    console.log('🤖 자동화 시스템을 중지합니다.');
    
    // PoliticalDAO 모니터링 중지
    if (this.politicalDAOMonitor) {
      clearInterval(this.politicalDAOMonitor);
      this.politicalDAOMonitor = null;
    }
    
    return { success: true, message: '자동화 시스템 중지 완료' };
  }

  // 운영 DAO DCA 자동 반영
  handleOperationsDAOActivity(operatorDID, action, targetId, details = {}) {
    console.log(`🏛️ 운영 DAO 활동 처리: ${action}`);
    
    // 알려진 운영자 활동 목록
    const knownActions = [
      'proposal_approval',
      'proposal_rejection', 
      'member_invite',
      'system_update',
      'policy_change'
    ];

    if (!knownActions.includes(action)) {
      return {
        success: false,
        error: 'Unknown operator action'
      };
    }

    // 활동에 따른 B-Token 보상 계산
    const rewardMap = {
      'proposal_approval': 150,
      'proposal_rejection': 100,
      'member_invite': 200,
      'system_update': 300,
      'policy_change': 250
    };

    const bTokensEarned = rewardMap[action] || 100;
    const contributionId = `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return { 
      success: true, 
      message: `운영자 활동 '${action}' 처리 완료`,
      bTokensEarned,
      contributionId
    };
  }

  // GitHub 통합 설정
  setupGitHubIntegration(repoOwner, repoName, accessToken) {
    const webhookId = `${repoOwner}/${repoName}`;
    this.githubWebhooks.set(webhookId, {
      owner: repoOwner,
      repo: repoName,
      token: accessToken,
      active: true
    });
    
    return {
      success: true,
      webhookUrl: `https://baekya-protocol.io/webhook/github/${webhookId}`,
      message: 'GitHub 통합이 설정되었습니다'
    };
  }

  // 초대 링크 생성
  createInviteLink(inviterDID) {
    const inviteCode = crypto.randomBytes(16).toString('hex');
    const inviteLink = `https://baekya-protocol.io/invite/${inviteCode}`;
    
    this.inviteLinks.set(inviteCode, {
      inviterDID,
      createdAt: Date.now(),
      used: false,
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
    });

    return {
      success: true,
      inviteCode,
      inviteLink,
      message: '초대 링크가 생성되었습니다'
    };
  }

  // 자동화 시스템 상태 확인
  getAutomationStatus() {
    return {
      githubWebhooks: Array.from(this.githubWebhooks.entries()).map(([id, webhook]) => ({
        id,
        active: webhook.active,
        repo: `${webhook.owner}/${webhook.repo}`
      })),
      activeInvites: Array.from(this.inviteLinks.values()).filter(invite => 
        !invite.used && Date.now() < invite.expiresAt
      ).length,
      totalInvites: this.inviteLinks.size
    };
  }

  // 텍스트에서 통신주소 추출
  extractCommunicationAddress(text) {
    // 010-XXXX-XXXX 패턴을 찾는 정규식
    const phonePattern = /010-\d{4}-\d{4}/g;
    const matches = text.match(phonePattern);
    
    return matches ? matches[0] : null;
  }

  // 초대를 통한 가입 처리
  processInviteRegistration(inviteCode, userData) {
    const invite = this.inviteLinks.get(inviteCode);
    
    if (!invite) {
      return {
        success: false,
        error: '유효하지 않은 초대 코드입니다'
      };
    }

    if (Date.now() > invite.expiresAt) {
      return {
        success: false,
        error: '만료된 초대 코드입니다'
      };
    }

    if (invite.used) {
      return {
        success: false,
        error: '이미 사용된 초대 코드입니다'
      };
    }

    // 사용자 데이터 검증
    if (!userData.username || !userData.password) {
      return {
        success: false,
        error: '아이디와 비밀번호가 필요합니다'
      };
    }

    // DID 생성 (아이디 기반)
    const userDID = `did:baekya:${crypto.createHash('sha256').update(userData.username).digest('hex').substring(0, 32)}`;
    
    // 초대 코드 사용 처리
    invite.used = true;
    invite.usedAt = Date.now();

    return {
      success: true,
      user: {
        did: userDID,
        username: userData.username,
        name: userData.name || userData.username,
        createdAt: Date.now(),
        invitedBy: invite.inviterDID
      },
      inviter: invite.inviterDID,
      message: '초대를 통한 가입이 완료되었습니다'
    };
  }
}

module.exports = AutomationSystem; 