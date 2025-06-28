const crypto = require('crypto');

/**
 * GitHub 통합 시스템
 * DevDAO DCA 자동검증을 담당
 */
class GitHubIntegration {
  constructor(daoSystem, cvcmSystem) {
    this.daoSystem = daoSystem;
    this.cvcmSystem = cvcmSystem;
    this.webhooks = new Map();
    this.userIntegrations = new Map(); // userDID -> {repoOwner, repoName, accessToken}
    this.verifiedContributions = new Map();
  }

  /**
   * 사용자 GitHub 연동 설정
   * @param {string} userDID 
   * @param {string} repoOwner 
   * @param {string} repoName 
   * @param {string} accessToken 
   */
  setupUserIntegration(userDID, repoOwner, repoName, accessToken) {
    const integrationId = `${userDID}:${repoOwner}/${repoName}`;
    
    this.userIntegrations.set(userDID, {
      repoOwner,
      repoName,
      accessToken,
      integrationId,
      connectedAt: Date.now()
    });

    // Webhook 설정 (실제 환경에서는 GitHub API 사용)
    this.webhooks.set(integrationId, {
      userDID,
      repoOwner,
      repoName,
      active: true,
      webhookUrl: `https://baekya-protocol.io/webhook/github/${integrationId}`,
      secret: crypto.randomBytes(32).toString('hex')
    });

    console.log(`✅ GitHub 통합 설정 완료: ${userDID} -> ${repoOwner}/${repoName}`);
    
    return {
      success: true,
      integrationId,
      webhookUrl: this.webhooks.get(integrationId).webhookUrl,
      message: 'GitHub 통합이 설정되었습니다'
    };
  }

  /**
   * GitHub Webhook 이벤트 처리
   * @param {string} integrationId 
   * @param {Object} payload GitHub webhook payload
   */
  async handleWebhookEvent(integrationId, payload) {
    const webhook = this.webhooks.get(integrationId);
    if (!webhook || !webhook.active) {
      throw new Error('Invalid webhook');
    }

    const { userDID } = webhook;
    const eventType = payload.action;
    
    console.log(`🔔 GitHub Webhook 이벤트: ${eventType} from ${integrationId}`);

    try {
      switch (eventType) {
        case 'closed':
          if (payload.pull_request && payload.pull_request.merged) {
            return await this.handlePullRequestMerged(userDID, payload.pull_request);
          }
          if (payload.issue) {
            return await this.handleIssueClosed(userDID, payload.issue);
          }
          break;
          
        case 'submitted':
          if (payload.review && payload.pull_request) {
            return await this.handlePullRequestReview(userDID, payload.review, payload.pull_request);
          }
          break;
          
        default:
          console.log(`미처리 이벤트 타입: ${eventType}`);
      }
    } catch (error) {
      console.error(`Webhook 처리 오류:`, error);
      throw error;
    }

    return { success: true, message: 'Event processed' };
  }

  /**
   * Pull Request 병합 처리 (250B)
   * @param {string} userDID 
   * @param {Object} pullRequest 
   */
  async handlePullRequestMerged(userDID, pullRequest) {
    const contributionId = `pr_${pullRequest.id}_${Date.now()}`;
    
    // 중복 방지 체크
    if (this.verifiedContributions.has(contributionId)) {
      return { success: false, message: 'Already processed' };
    }

    const contribution = {
      id: contributionId,
      userDID,
      type: 'pull_request',
      title: pullRequest.title,
      url: pullRequest.html_url,
      bValue: 250,
      verifiedAt: Date.now(),
      githubData: {
        id: pullRequest.id,
        number: pullRequest.number,
        merged_at: pullRequest.merged_at,
        additions: pullRequest.additions,
        deletions: pullRequest.deletions,
        changed_files: pullRequest.changed_files
      }
    };

    // 기여 활동 기록
    this.verifiedContributions.set(contributionId, contribution);
    
    // DevDAO에 기여자 추가
    try {
      this.daoSystem.addContributor('dev-dao', userDID);
    } catch (error) {
      console.log('이미 DevDAO 구성원입니다.');
    }

    // CVCM 시스템에 기여 기록 (B 토큰 발급)
    const cvcmResult = await this.cvcmSystem.submitContribution(userDID, 'dev-dao', {
      dcaId: 'pull-request',
      evidence: pullRequest.html_url,
      description: `Pull Request: ${pullRequest.title}`,
      metadata: contribution.githubData
    });

    console.log(`🎉 Pull Request 병합 검증 완료: ${userDID} -> ${contribution.bValue}B`);

    return {
      success: true,
      contribution,
      bTokensAwarded: contribution.bValue,
      cvcmResult,
      message: `Pull Request 병합으로 ${contribution.bValue}B가 지급되었습니다`
    };
  }

  /**
   * Pull Request 리뷰 제출 처리 (120B)
   * @param {string} userDID 
   * @param {Object} review 
   * @param {Object} pullRequest 
   */
  async handlePullRequestReview(userDID, review, pullRequest) {
    // PR이 병합되었을 때만 리뷰 보상 지급
    if (!pullRequest.merged_at) {
      console.log('PR이 아직 병합되지 않음. 대기 중...');
      return { success: true, message: 'Waiting for PR to be merged' };
    }

    const contributionId = `pr_review_${review.id}_${Date.now()}`;
    
    // 중복 방지 체크
    if (this.verifiedContributions.has(contributionId)) {
      return { success: false, message: 'Already processed' };
    }

    const contribution = {
      id: contributionId,
      userDID,
      type: 'pull_request_review',
      title: `Review: ${pullRequest.title}`,
      url: review.html_url,
      bValue: 120,
      verifiedAt: Date.now(),
      githubData: {
        review_id: review.id,
        pr_id: pullRequest.id,
        pr_number: pullRequest.number,
        state: review.state,
        submitted_at: review.submitted_at,
        pr_merged_at: pullRequest.merged_at
      }
    };

    // 기여 활동 기록
    this.verifiedContributions.set(contributionId, contribution);
    
    // DevDAO에 기여자 추가
    try {
      this.daoSystem.addContributor('dev-dao', userDID);
    } catch (error) {
      console.log('이미 DevDAO 구성원입니다.');
    }

    // CVCM 시스템에 기여 기록 (B 토큰 발급)
    const cvcmResult = await this.cvcmSystem.submitContribution(userDID, 'dev-dao', {
      dcaId: 'pull-request-review',
      evidence: review.html_url,
      description: `Pull Request Review: ${pullRequest.title}`,
      metadata: contribution.githubData
    });

    console.log(`🎉 Pull Request 리뷰 검증 완료: ${userDID} -> ${contribution.bValue}B`);

    return {
      success: true,
      contribution,
      bTokensAwarded: contribution.bValue,
      cvcmResult,
      message: `Pull Request 리뷰로 ${contribution.bValue}B가 지급되었습니다`
    };
  }

  /**
   * 이슈 해결 처리 (80B)
   * @param {string} userDID 
   * @param {Object} issue 
   */
  async handleIssueClosed(userDID, issue) {
    const contributionId = `issue_${issue.id}_${Date.now()}`;
    
    // 중복 방지 체크
    if (this.verifiedContributions.has(contributionId)) {
      return { success: false, message: 'Already processed' };
    }

    const contribution = {
      id: contributionId,
      userDID,
      type: 'issue_report',
      title: issue.title,
      url: issue.html_url,
      bValue: 80,
      verifiedAt: Date.now(),
      githubData: {
        id: issue.id,
        number: issue.number,
        state: issue.state,
        closed_at: issue.closed_at,
        labels: issue.labels.map(label => label.name)
      }
    };

    // 기여 활동 기록
    this.verifiedContributions.set(contributionId, contribution);
    
    // DevDAO에 기여자 추가
    try {
      this.daoSystem.addContributor('dev-dao', userDID);
    } catch (error) {
      console.log('이미 DevDAO 구성원입니다.');
    }

    // CVCM 시스템에 기여 기록 (B 토큰 발급)
    const cvcmResult = await this.cvcmSystem.submitContribution(userDID, 'dev-dao', {
      dcaId: 'issue-report',
      evidence: issue.html_url,
      description: `Issue Report: ${issue.title}`,
      metadata: contribution.githubData
    });

    console.log(`🎉 이슈 해결 검증 완료: ${userDID} -> ${contribution.bValue}B`);

    return {
      success: true,
      contribution,
      bTokensAwarded: contribution.bValue,
      cvcmResult,
      message: `이슈 해결로 ${contribution.bValue}B가 지급되었습니다`
    };
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
   * 통합 상태 조회
   * @param {string} userDID 
   * @returns {Object}
   */
  getIntegrationStatus(userDID) {
    const integration = this.userIntegrations.get(userDID);
    if (!integration) {
      return { connected: false };
    }

    const contributions = this.getUserContributions(userDID);
    const totalBTokens = contributions.reduce((sum, contrib) => sum + contrib.bValue, 0);

    return {
      connected: true,
      integration,
      contributions: contributions.length,
      totalBTokensEarned: totalBTokens,
      lastContribution: contributions[0] || null
    };
  }

  /**
   * 모든 검증된 기여 내역 조회 (관리자용)
   * @returns {Array}
   */
  getAllVerifiedContributions() {
    return Array.from(this.verifiedContributions.values())
      .sort((a, b) => b.verifiedAt - a.verifiedAt);
  }

  /**
   * 통계 정보 조회
   * @returns {Object}
   */
  getStatistics() {
    const allContributions = this.getAllVerifiedContributions();
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
      activeIntegrations: this.userIntegrations.size,
      activeWebhooks: Array.from(this.webhooks.values()).filter(w => w.active).length
    };
  }
}

module.exports = GitHubIntegration; 