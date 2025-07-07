/**
 * 커뮤니티DAO 통합 시스템
 * 커뮤니티DAO DCA 자동검증을 담당
 */
class CommunityDAOIntegration {
  constructor(daoSystem, cvcmSystem, automationSystem) {
    this.daoSystem = daoSystem;
    this.automationSystem = automationSystem;
    this.verifiedContributions = new Map();
    this.inviteTracker = new Map(); // inviteCode -> {inviterDID, createdAt}
    this.proposalTracker = new Map(); // proposalId -> {proposerDID, stage, bTokensEarned}
  }

  /**
   * 초대 활동 처리 (50B)
   * 초대 받은 사용자가 DID 생성 시 자동 검증
   * @param {string} inviteCode 
   * @param {string} inviterDID 
   * @param {string} inviteeDID 새로 생성된 DID
   */
  async handleInviteSuccess(inviteCode, inviterDID, inviteeDID) {
    const contributionId = `invite_${inviteCode}_${Date.now()}`;
    
    // 중복 방지 체크
    if (this.verifiedContributions.has(contributionId)) {
      return { success: false, message: 'Already processed' };
    }

    const contribution = {
      id: contributionId,
      userDID: inviterDID,
      type: 'invite_activity',
      title: '초대 활동',
      inviteCode,
      inviteeDID,
      bValue: 30,
      verifiedAt: Date.now(),
      inviteData: {
        inviteCode,
        inviteeDID,
        completedAt: Date.now()
      }
    };

    // 기여 활동 기록
    this.verifiedContributions.set(contributionId, contribution);
    
    // 커뮤니티DAO에 기여자 추가
    try {
      this.daoSystem.addContributor('community-dao', inviterDID);
    } catch (error) {
      console.log('이미 커뮤니티DAO 구성원입니다.');
    }

    console.log(`🎉 초대 활동 검증 완료: ${inviterDID} -> ${contribution.bValue}B`);

    return {
      success: true,
      contribution,
      bTokensAwarded: contribution.bValue,
      message: `초대 활동으로 ${contribution.bValue}B가 지급되었습니다`
    };
  }

  /**
   * 제안의 모금 성공 처리 (20B)
   * @param {string} proposalId 
   * @param {string} proposerDID 
   * @param {Object} fundingData 
   */
  async handleProposalFundingSuccess(proposalId, proposerDID, fundingData) {
    const contributionId = `funding_success_${proposalId}_${Date.now()}`;
    
    // 중복 방지 체크
    if (this.verifiedContributions.has(contributionId)) {
      return { success: false, message: 'Already processed' };
    }

    const contribution = {
      id: contributionId,
      userDID: proposerDID,
      type: 'proposal_funding_success',
      title: '제안의 모금 성공',
      proposalId,
      bValue: 20,
      verifiedAt: Date.now(),
      fundingData: {
        proposalId,
        targetAmount: fundingData.targetAmount,
        currentAmount: fundingData.currentAmount,
        fundingRate: fundingData.fundingRate,
        completedAt: Date.now()
      }
    };

    // 기여 활동 기록
    this.verifiedContributions.set(contributionId, contribution);
    
    // 제안 추적 정보 업데이트
    if (!this.proposalTracker.has(proposalId)) {
      this.proposalTracker.set(proposalId, {
        proposerDID,
        stage: 'funding_success',
        bTokensEarned: 20
      });
    } else {
      const tracker = this.proposalTracker.get(proposalId);
      tracker.bTokensEarned += 20;
    }

    // 커뮤니티DAO에 기여자 추가
    try {
      this.daoSystem.addContributor('community-dao', proposerDID);
    } catch (error) {
      console.log('이미 커뮤니티DAO 구성원입니다.');
    }

    console.log(`🎉 제안 모금 성공 검증 완료: ${proposerDID} -> ${contribution.bValue}B`);

    return {
      success: true,
      contribution,
      bTokensAwarded: contribution.bValue,
      message: `제안 모금 성공으로 ${contribution.bValue}B가 지급되었습니다`
    };
  }

  /**
   * 제안의 투표 통과 처리 (80B)
   * @param {string} proposalId 
   * @param {string} proposerDID 
   * @param {Object} votingData 
   */
  async handleProposalVotingSuccess(proposalId, proposerDID, votingData) {
    const contributionId = `voting_success_${proposalId}_${Date.now()}`;
    
    // 중복 방지 체크
    if (this.verifiedContributions.has(contributionId)) {
      return { success: false, message: 'Already processed' };
    }

    const contribution = {
      id: contributionId,
      userDID: proposerDID,
      type: 'proposal_voting_success',
      title: '제안의 투표 통과',
      proposalId,
      bValue: 80,
      verifiedAt: Date.now(),
      votingData: {
        proposalId,
        totalVotes: votingData.totalVotes,
        approveVotes: votingData.approveVotes,
        rejectVotes: votingData.rejectVotes,
        abstainVotes: votingData.abstainVotes,
        approvalRate: votingData.approvalRate,
        passedAt: Date.now()
      }
    };

    // 기여 활동 기록
    this.verifiedContributions.set(contributionId, contribution);
    
    // 제안 추적 정보 업데이트
    if (!this.proposalTracker.has(proposalId)) {
      this.proposalTracker.set(proposalId, {
        proposerDID,
        stage: 'voting_success',
        bTokensEarned: 80
      });
    } else {
      const tracker = this.proposalTracker.get(proposalId);
      tracker.stage = 'voting_success';
      tracker.bTokensEarned += 80;
    }

    // 커뮤니티DAO에 기여자 추가
    try {
      this.daoSystem.addContributor('community-dao', proposerDID);
    } catch (error) {
      console.log('이미 커뮤니티DAO 구성원입니다.');
    }

    console.log(`🎉 제안 투표 통과 검증 완료: ${proposerDID} -> ${contribution.bValue}B`);

    return {
      success: true,
      contribution,
      bTokensAwarded: contribution.bValue,
      message: `제안 투표 통과로 ${contribution.bValue}B가 지급되었습니다`
    };
  }

  /**
   * 제안의 1차검토 승인 처리 (30B)
   * @param {string} proposalId 
   * @param {string} proposerDID 
   * @param {Object} reviewData 
   */
  async handleProposalFirstReviewApproval(proposalId, proposerDID, reviewData) {
    const contributionId = `first_review_approval_${proposalId}_${Date.now()}`;
    
    // 중복 방지 체크
    if (this.verifiedContributions.has(contributionId)) {
      return { success: false, message: 'Already processed' };
    }

    const contribution = {
      id: contributionId,
      userDID: proposerDID,
      type: 'proposal_first_review_approval',
      title: '제안의 1차검토 승인',
      proposalId,
      bValue: 30,
      verifiedAt: Date.now(),
      reviewData: {
        proposalId,
        reviewStage: 'first_review',
        reviewerDID: reviewData.reviewerDID,
        reviewResult: 'approved',
        reviewComments: reviewData.comments,
        approvedAt: Date.now()
      }
    };

    // 기여 활동 기록
    this.verifiedContributions.set(contributionId, contribution);
    
    // 제안 추적 정보 업데이트
    if (!this.proposalTracker.has(proposalId)) {
      this.proposalTracker.set(proposalId, {
        proposerDID,
        stage: 'first_review_approved',
        bTokensEarned: 30
      });
    } else {
      const tracker = this.proposalTracker.get(proposalId);
      tracker.stage = 'first_review_approved';
      tracker.bTokensEarned += 30;
    }

    // 커뮤니티DAO에 기여자 추가
    try {
      this.daoSystem.addContributor('community-dao', proposerDID);
    } catch (error) {
      console.log('이미 커뮤니티DAO 구성원입니다.');
    }

    console.log(`🎉 제안 1차검토 승인 검증 완료: ${proposerDID} -> ${contribution.bValue}B`);

    return {
      success: true,
      contribution,
      bTokensAwarded: contribution.bValue,
      message: `제안 1차검토 승인으로 ${contribution.bValue}B가 지급되었습니다`
    };
  }

  /**
   * 제안의 최종검토 승인 처리 (120B)
   * @param {string} proposalId 
   * @param {string} proposerDID 
   * @param {Object} reviewData 
   */
  async handleProposalFinalReviewApproval(proposalId, proposerDID, reviewData) {
    const contributionId = `final_review_approval_${proposalId}_${Date.now()}`;
    
    // 중복 방지 체크
    if (this.verifiedContributions.has(contributionId)) {
      return { success: false, message: 'Already processed' };
    }

    const contribution = {
      id: contributionId,
      userDID: proposerDID,
      type: 'proposal_final_review_approval',
      title: '제안의 최종검토 승인',
      proposalId,
      bValue: 120,
      verifiedAt: Date.now(),
      reviewData: {
        proposalId,
        reviewStage: 'final_review',
        reviewerDID: reviewData.reviewerDID,
        reviewResult: 'approved',
        reviewComments: reviewData.comments,
        approvedAt: Date.now()
      }
    };

    // 기여 활동 기록
    this.verifiedContributions.set(contributionId, contribution);
    
    // 제안 추적 정보 업데이트
    if (!this.proposalTracker.has(proposalId)) {
      this.proposalTracker.set(proposalId, {
        proposerDID,
        stage: 'final_review_approved',
        bTokensEarned: 120
      });
    } else {
      const tracker = this.proposalTracker.get(proposalId);
      tracker.stage = 'final_review_approved';
      tracker.bTokensEarned += 120;
    }

    // 커뮤니티DAO에 기여자 추가
    try {
      this.daoSystem.addContributor('community-dao', proposerDID);
    } catch (error) {
      console.log('이미 커뮤니티DAO 구성원입니다.');
    }

    console.log(`🎉 제안 최종검토 승인 검증 완료: ${proposerDID} -> ${contribution.bValue}B`);

    return {
      success: true,
      contribution,
      bTokensAwarded: contribution.bValue,
      message: `제안 최종검토 승인으로 ${contribution.bValue}B가 지급되었습니다`
    };
  }

  /**
   * 초대 링크 생성 추적
   * @param {string} inviteCode 
   * @param {string} inviterDID 
   */
  trackInviteCreation(inviteCode, inviterDID) {
    this.inviteTracker.set(inviteCode, {
      inviterDID,
      createdAt: Date.now(),
      used: false
    });
  }

  /**
   * 초대 링크 사용 처리
   * @param {string} inviteCode 
   * @param {string} inviteeDID 
   */
  async processInviteUsage(inviteCode, inviteeDID) {
    const inviteInfo = this.inviteTracker.get(inviteCode);
    if (!inviteInfo) {
      throw new Error('초대 정보를 찾을 수 없습니다');
    }

    if (inviteInfo.used) {
      throw new Error('이미 사용된 초대 코드입니다');
    }

    // 초대 사용 표시
    inviteInfo.used = true;
    inviteInfo.usedAt = Date.now();
    inviteInfo.inviteeDID = inviteeDID;

    // 초대 성공 처리
    return await this.handleInviteSuccess(inviteCode, inviteInfo.inviterDID, inviteeDID);
  }

  /**
   * 제안 상태 변경 이벤트 처리
   * @param {string} proposalId 
   * @param {string} newStatus 
   * @param {Object} eventData 
   */
  async handleProposalStatusChange(proposalId, newStatus, eventData) {
    const proposal = eventData.proposal;
    const proposerDID = proposal.proposerDID;

    switch (newStatus) {
      case 'funding_success':
        return await this.handleProposalFundingSuccess(proposalId, proposerDID, {
          targetAmount: proposal.targetAmount,
          currentAmount: proposal.currentAmount,
          fundingRate: (proposal.currentAmount / proposal.targetAmount) * 100
        });

      case 'voting_passed':
        return await this.handleProposalVotingSuccess(proposalId, proposerDID, {
          totalVotes: eventData.totalVotes,
          approveVotes: eventData.approveVotes,
          rejectVotes: eventData.rejectVotes,
          abstainVotes: eventData.abstainVotes,
          approvalRate: (eventData.approveVotes / eventData.totalVotes) * 100
        });

      case 'first_review_approved':
        return await this.handleProposalFirstReviewApproval(proposalId, proposerDID, {
          reviewerDID: eventData.reviewerDID,
          comments: eventData.comments
        });

      case 'final_review_approved':
        return await this.handleProposalFinalReviewApproval(proposalId, proposerDID, {
          reviewerDID: eventData.reviewerDID,
          comments: eventData.comments
        });

      default:
        console.log(`처리되지 않은 제안 상태: ${newStatus}`);
        return { success: false, message: 'Unhandled proposal status' };
    }
  }

  /**
   * 사용자의 기여 내역 조회
   * @param {string} userDID 
   * @returns {Array}
   */
  getUserContributions(userDID) {
    return Array.from(this.verifiedContributions.values())
      .filter(contrib => contrib.userDID === userDID)
      .sort((a, b) => b.verifiedAt - a.verifiedAt);
  }

  /**
   * 제안별 B토큰 획득 현황 조회
   * @param {string} proposalId 
   * @returns {Object}
   */
  getProposalBTokenStatus(proposalId) {
    const tracker = this.proposalTracker.get(proposalId);
    if (!tracker) {
      return { found: false };
    }

    const contributions = Array.from(this.verifiedContributions.values())
      .filter(contrib => contrib.proposalId === proposalId);

    return {
      found: true,
      proposerDID: tracker.proposerDID,
      currentStage: tracker.stage,
      totalBTokensEarned: tracker.bTokensEarned,
      contributions: contributions.map(contrib => ({
        type: contrib.type,
        title: contrib.title,
        bValue: contrib.bValue,
        verifiedAt: contrib.verifiedAt
      }))
    };
  }

  /**
   * 통계 정보 조회
   * @returns {Object}
   */
  getStatistics() {
    const allContributions = Array.from(this.verifiedContributions.values());
    const typeStats = {};
    let totalBTokens = 0;

    allContributions.forEach(contrib => {
      typeStats[contrib.type] = (typeStats[contrib.type] || 0) + 1;
      totalBTokens += contrib.bValue;
    });

    return {
      totalContributions: allContributions.length,
      totalBTokensIssued: totalBTokens,
      contributionsByType: typeStats,
      totalInvites: this.inviteTracker.size,
      successfulInvites: Array.from(this.inviteTracker.values()).filter(invite => invite.used).length,
      trackedProposals: this.proposalTracker.size
    };
  }

  /**
   * 초대받은 사용자(생성자)의 커뮤니티DAO 가입 처리
   * 초대받아 가입한 사용자는 기여자로 간주되어 자동으로 커뮤니티DAO 구성원이 됨
   * @param {string} inviteCode 
   * @param {string} inviteeDID 새로 생성된 사용자의 DID
   * @param {string} inviterDID 초대한 사용자의 DID
   */
  async handleInviteeJoinCommunityDAO(inviteCode, inviteeDID, inviterDID) {
    const contributionId = `invite_join_${inviteCode}_${inviteeDID}_${Date.now()}`;
    
    // 중복 방지 체크
    if (this.verifiedContributions.has(contributionId)) {
      return { success: false, message: 'Already processed' };
    }

    const contribution = {
      id: contributionId,
      userDID: inviteeDID,
      type: 'invite_join',
      title: '초대 참여',
      inviteCode,
      inviterDID,
      bValue: 20, // 실제 지급받은 B-Token
      verified: true,
      verifiedAt: Date.now(),
      metadata: {
        inviteCode,
        inviterDID,
        joinedAt: Date.now(),
        description: '초대를 통해 커뮤니티에 참여'
      }
    };

    // 기여 활동 기록
    this.verifiedContributions.set(contributionId, contribution);
    
    // 커뮤니티DAO에 기여자 추가 (초대받은 사용자도 기여자로 간주)
    try {
      this.daoSystem.addContributor('community-dao', inviteeDID);
      console.log(`🎉 초대받은 사용자 커뮤니티DAO 가입: ${inviteeDID}`);
    } catch (error) {
      console.log('이미 커뮤니티DAO 구성원입니다.');
    }

    console.log(`🎉 초대받은 사용자 커뮤니티DAO 가입 완료: ${inviteeDID} (초대자: ${inviterDID})`);

    return {
      success: true,
      contribution,
      message: '초대를 통해 커뮤니티DAO에 가입했습니다'
    };
  }
}

module.exports = CommunityDAOIntegration;
 