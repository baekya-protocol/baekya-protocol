const crypto = require('crypto');

/**
 * GitHub 통합 시스템 (중앙화 방식)
 * 원본 저장소에서 모든 PR 이벤트를 받아 기여자에게 보상 지급
 */
class GitHubIntegration {
  constructor(daoSystem, cvcmSystem, dataStorage = null) {
    this.daoSystem = daoSystem;
    this.cvcmSystem = cvcmSystem; // 사용하지 않지만 호환성 유지
    this.dataStorage = dataStorage; // DataStorage 인스턴스 추가
    this.githubUserMappings = new Map(); // githubUsername -> userDID
    this.verifiedContributions = new Map();
    this.centralWebhook = null;
    this.targetRepository = 'baekya-protocol'; // 원본 저장소 이름
    this.targetOwner = 'baekya-protocol'; // 원본 저장소 소유자
    this.blockchain = null; // 블록체인 인스턴스 저장
    this.processedOwnIssues = new Set(); // 자기 이슈로 처리된 이슈 번호 추적
  }

  // 블록체인 인스턴스 설정
  setBlockchain(blockchain) {
    this.blockchain = blockchain;
  }

  /**
   * 사용자 GitHub 계정 연동 설정
   * @param {string} userDID 
   * @param {string} githubUsername 
   */
  setupUserGitHubMapping(userDID, githubUsername) {
    // 기존 매핑이 있으면 제거
    for (const [username, did] of this.githubUserMappings.entries()) {
      if (did === userDID) {
        this.githubUserMappings.delete(username);
        break;
      }
    }

    // 새로운 매핑 설정
    this.githubUserMappings.set(githubUsername.toLowerCase(), userDID);

    console.log(`✅ GitHub 계정 연동 완료: ${githubUsername} -> ${userDID}`);
    
    return {
      success: true,
      githubUsername,
      userDID,
      message: 'GitHub 계정 연동이 완료되었습니다'
    };
  }

  /**
   * 중앙 웹훅 설정 (원본 저장소용)
   * @param {string} webhookUrl 
   */
  setupCentralWebhook(webhookUrl) {
    this.centralWebhook = {
      url: webhookUrl,
      secret: crypto.randomBytes(32).toString('hex'),
      active: true,
      repository: `${this.targetOwner}/${this.targetRepository}`,
      setupAt: Date.now()
    };

    console.log(`🔗 중앙 웹훅 설정 완료: ${this.centralWebhook.repository}`);
    
    return {
      success: true,
      webhookUrl,
      repository: this.centralWebhook.repository,
      message: '중앙 웹훅이 설정되었습니다'
    };
  }

  /**
   * GitHub Webhook 이벤트 처리 (중앙화 방식)
   * @param {Object} payload GitHub webhook payload
   * @param {string} eventType GitHub event type (x-github-event header)
   */
  async handleCentralWebhookEvent(payload, eventType) {
    if (!this.centralWebhook || !this.centralWebhook.active) {
      throw new Error('Central webhook not configured');
    }
    
    console.log(`🔔 GitHub 중앙 웹훅 이벤트: ${eventType} (${payload.action || 'no-action'})`);

    try {
      switch (eventType) {
        case 'pull_request':
          if (payload.action === 'closed' && payload.pull_request?.merged) {
            return await this.handlePullRequestMerged(payload.pull_request);
          }
          break;
          
        case 'issues':
          if (payload.action === 'closed' && payload.issue?.state === 'closed') {
            return await this.handleIssueClosed(payload.issue);
          }
          break;
          
        case 'ping':
          console.log(`🏓 GitHub ping 이벤트 수신`);
          return { success: true, message: 'Webhook ping received' };
          
        default:
          console.log(`미처리 이벤트 타입: ${eventType} (${payload.action || 'no-action'})`);
      }
    } catch (error) {
      console.error(`중앙 웹훅 처리 오류:`, error);
      throw error;
    }

    return { success: true, message: 'Event processed' };
  }



  /**
   * PR이 자기 이슈인지 확인
   * @param {Object} pullRequest 
   * @param {string} prAuthor 
   * @returns {Object} { isOwnIssue: boolean, referencedIssues: number[] }
   */
  async checkIfOwnIssue(pullRequest, prAuthor) {
    try {
      // PR 본문에서 이슈 번호 추출 (Closes #123, Fixes #456 등)
      const prBody = pullRequest.body || '';
      const prTitle = pullRequest.title || '';
      const issuePattern = /(?:close[ds]?|fix(?:e[ds])?|resolve[ds]?)\s+#(\d+)/gi;
      
      let match;
      const referencedIssues = [];
      
      // PR 제목과 본문에서 이슈 번호 추출
      const fullText = prTitle + ' ' + prBody;
      while ((match = issuePattern.exec(fullText)) !== null) {
        referencedIssues.push(parseInt(match[1]));
      }
      
      // 참조된 이슈가 없으면 자기 이슈로 간주 (기본값)
      if (referencedIssues.length === 0) {
        console.log(`📝 참조된 이슈 없음 - 자기 이슈로 간주: ${prAuthor}`);
        return { isOwnIssue: true, referencedIssues: [] };
      }
      
      // GitHub API로 이슈 작성자 확인 (실제 API는 사용하지 않고 로컬 추적)
      // 실제로는 이슈가 생성될 때 작성자를 추적해야 하지만, 
      // 간단하게 이슈 번호가 있으면 남의 이슈로 간주
      console.log(`📝 참조된 이슈 발견: ${referencedIssues.join(', ')} - 남의 이슈로 간주`);
      return { isOwnIssue: false, referencedIssues };
      
    } catch (error) {
      console.error('이슈 분석 오류:', error);
      // 오류 시 기본값으로 자기 이슈로 간주
      return { isOwnIssue: true, referencedIssues: [] };
    }
  }

  /**
   * Pull Request 병합 처리 (자기 이슈: 250B, 남의 이슈: 280B)
   * @param {Object} pullRequest 
   */
  async handlePullRequestMerged(pullRequest) {
    const githubUsername = pullRequest.user?.login;
    if (!githubUsername) {
      console.log('PR 작성자 정보 없음');
      return { success: false, message: 'No author information' };
    }

    const userDID = this.githubUserMappings.get(githubUsername.toLowerCase());
    if (!userDID) {
      console.log(`연동되지 않은 GitHub 사용자: ${githubUsername}`);
      return { success: false, message: 'GitHub user not linked' };
    }

    const contributionId = `pr_${pullRequest.id}_${Date.now()}`;
    
    // 중복 방지 체크
    if (this.verifiedContributions.has(contributionId)) {
      return { success: false, message: 'Already processed' };
    }

    // 이슈 작성자와 PR 작성자 비교하여 보상 결정
    const issueAnalysis = await this.checkIfOwnIssue(pullRequest, githubUsername);
    const isOwnIssue = issueAnalysis.isOwnIssue;
    const referencedIssues = issueAnalysis.referencedIssues;
    const bValue = isOwnIssue ? 250 : 280;
    const prType = isOwnIssue ? 'pull_request_own_issue' : 'pull_request_others_issue';

    console.log(`📝 PR 이슈 분석: ${githubUsername} -> ${isOwnIssue ? '자기 이슈' : '남의 이슈'} (${bValue}B)`);

    // 자기 이슈인 경우 해당 이슈 번호들을 추적하여 중복 보상 방지
    if (isOwnIssue && referencedIssues.length === 0) {
      // 참조된 이슈가 없는 경우 PR 번호를 기준으로 추적
      this.processedOwnIssues.add(`own_issue_pr_${pullRequest.number}`);
    } else if (isOwnIssue && referencedIssues.length > 0) {
      // 참조된 이슈가 있는 경우 해당 이슈 번호들을 추적
      referencedIssues.forEach(issueNumber => {
        this.processedOwnIssues.add(issueNumber);
        console.log(`🔒 자기 이슈 #${issueNumber} 보상 차단 등록`);
      });
    }

    const contribution = {
      id: contributionId,
      userDID,
      githubUsername,
      type: prType,
      title: pullRequest.title,
      url: pullRequest.html_url,
      bValue,
      verifiedAt: Date.now(),
      githubData: {
        id: pullRequest.id,
        number: pullRequest.number,
        merged_at: pullRequest.merged_at,
        additions: pullRequest.additions,
        deletions: pullRequest.deletions,
        changed_files: pullRequest.changed_files,
        repository: `${this.targetOwner}/${this.targetRepository}`
      }
    };

    // 기여 활동 기록 (로컬 Map과 DataStorage 모두에 저장)
    this.verifiedContributions.set(contributionId, contribution);
    
    // DataStorage에 기여 내역 저장
    if (this.dataStorage) {
      try {
        this.dataStorage.saveContribution(userDID, 'dev-dao', {
          id: contributionId,
          type: prType,
          title: pullRequest.title,
          dcaId: 'github-pr',
          evidence: pullRequest.html_url,
          description: `GitHub PR 병합: ${pullRequest.title}`,
          bValue: bValue,
          verified: true,
          verifiedAt: Date.now(),
          metadata: {
            githubData: contribution.githubData,
            githubUsername: githubUsername,
            isOwnIssue: isOwnIssue,
            prNumber: pullRequest.number,
            repository: `${this.targetOwner}/${this.targetRepository}`
          }
        });
      } catch (error) {
        console.error('DataStorage 기여 내역 저장 실패:', error);
      }
    }
    
    // DevDAO에 기여자 추가
    try {
      this.daoSystem.addContributor('dev-dao', userDID);
    } catch (error) {
      console.log('이미 DevDAO 구성원입니다.');
    }

    // 블록체인 트랜잭션 생성 (직접)
    let transactionResult = null;
    if (this.blockchain) {
      try {
        const Transaction = require('../blockchain/Transaction');
        const rewardTransaction = new Transaction(
          'did:baekya:system000000000000000000000000000000000',
          userDID,
          bValue,
          'B-Token',
          'pr_merged_reward',
          {
            type: 'dca_reward',
            dcaType: prType,
            prNumber: pullRequest.number,
            prTitle: pullRequest.title,
            prUrl: pullRequest.html_url,
            repository: `${this.targetOwner}/${this.targetRepository}`,
            mergedAt: pullRequest.merged_at,
            githubUsername: githubUsername,
            isOwnIssue: isOwnIssue,
            rewardAmount: bValue
          }
        );
        
        rewardTransaction.signature = 'system-dca-reward-signature';
        const txResult = this.blockchain.addTransaction(rewardTransaction);
        
        if (txResult.success) {
          transactionResult = { 
            success: true, 
            transactionHash: rewardTransaction.hash 
          };
          console.log(`💰 블록체인 트랜잭션 생성 완료: ${rewardTransaction.hash}`);
        } else {
          console.error('❌ 블록체인 트랜잭션 생성 실패:', txResult.error);
        }
      } catch (txError) {
        console.error('❌ 블록체인 트랜잭션 처리 오류:', txError);
      }
    }

    console.log(`🎉 Pull Request 병합 검증 완료: ${githubUsername} (${userDID}) -> ${contribution.bValue}B`);

    return {
      success: true,
      contribution,
      bTokensAwarded: contribution.bValue,
      transactionResult,
      message: `Pull Request 병합으로 ${contribution.bValue}B가 지급되었습니다`
    };
  }



  /**
   * 이슈 해결 처리 (80B - 자기 이슈인 경우 보상 차단)
   * @param {Object} issue 
   */
  async handleIssueClosed(issue) {
    const githubUsername = issue.user?.login;
    if (!githubUsername) {
      console.log('이슈 작성자 정보 없음');
      return { success: false, message: 'No issue author information' };
    }

    const userDID = this.githubUserMappings.get(githubUsername.toLowerCase());
    if (!userDID) {
      console.log(`연동되지 않은 GitHub 사용자: ${githubUsername}`);
      return { success: false, message: 'GitHub user not linked' };
    }

    // 자기 이슈인 경우 보상 차단 (이미 PR 보상을 받았음)
    if (this.processedOwnIssues.has(issue.number)) {
      console.log(`🔒 자기 이슈 #${issue.number} 보상 차단: ${githubUsername} (이미 PR 보상 지급됨)`);
      return { 
        success: false, 
        message: 'Own issue - already rewarded via PR',
        reason: 'duplicate_reward_prevention'
      };
    }

    // 간단한 방법: 같은 사용자가 이슈를 생성하고 해결한 경우 보상 차단
    // (이슈 생성자 = 이슈 해결자인 경우, 이미 PR 보상을 받았을 가능성이 높음)
    const issueCreator = issue.user?.login;
    if (issueCreator && issueCreator.toLowerCase() === githubUsername.toLowerCase()) {
      console.log(`🔒 자기 이슈 #${issue.number} 보상 차단: ${githubUsername} (이슈 생성자와 해결자가 동일)`);
    return {
        success: false, 
        message: 'Own issue - no reward for self-created issues',
        reason: 'self_created_issue'
      };
    }

    const contributionId = `issue_${issue.id}_${Date.now()}`;
    
    // 중복 방지 체크
    if (this.verifiedContributions.has(contributionId)) {
      return { success: false, message: 'Already processed' };
    }

    const contribution = {
      id: contributionId,
      userDID,
      githubUsername,
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
        labels: issue.labels.map(label => label.name),
        repository: `${this.targetOwner}/${this.targetRepository}`
      }
    };

    // 기여 활동 기록 (로컬 Map과 DataStorage 모두에 저장)
    this.verifiedContributions.set(contributionId, contribution);
    
    // DataStorage에 기여 내역 저장
    if (this.dataStorage) {
      try {
        this.dataStorage.saveContribution(userDID, 'dev-dao', {
          id: contributionId,
          type: 'issue_report',
          title: issue.title,
          dcaId: 'github-issue',
          evidence: issue.html_url,
          description: `GitHub 이슈 리포트: ${issue.title}`,
          bValue: 80,
          verified: true,
          verifiedAt: Date.now(),
          metadata: {
            githubData: contribution.githubData,
            githubUsername: githubUsername,
            issueNumber: issue.number,
            repository: `${this.targetOwner}/${this.targetRepository}`
          }
        });
      } catch (error) {
        console.error('DataStorage 기여 내역 저장 실패:', error);
      }
    }
    
    // DevDAO에 기여자 추가
    try {
      this.daoSystem.addContributor('dev-dao', userDID);
    } catch (error) {
      console.log('이미 DevDAO 구성원입니다.');
    }

    // 블록체인 트랜잭션 생성 (직접)
    let transactionResult = null;
    if (this.blockchain) {
      try {
        const Transaction = require('../blockchain/Transaction');
        const rewardTransaction = new Transaction(
          'did:baekya:system000000000000000000000000000000000',
          userDID,
          80,
          'B-Token',
          'issue_resolved_reward',
          {
            type: 'dca_reward',
            dcaType: 'issue',
            issueNumber: issue.number,
            issueTitle: issue.title,
            issueUrl: issue.html_url,
            repository: `${this.targetOwner}/${this.targetRepository}`,
            closedAt: issue.closed_at,
            githubUsername: githubUsername
          }
        );
        
        rewardTransaction.signature = 'system-dca-reward-signature';
        const txResult = this.blockchain.addTransaction(rewardTransaction);
        
        if (txResult.success) {
          transactionResult = { 
            success: true, 
            transactionHash: rewardTransaction.hash 
          };
          console.log(`💰 블록체인 트랜잭션 생성 완료: ${rewardTransaction.hash}`);
        } else {
          console.error('❌ 블록체인 트랜잭션 생성 실패:', txResult.error);
        }
      } catch (txError) {
        console.error('❌ 블록체인 트랜잭션 처리 오류:', txError);
      }
    }

    console.log(`🎉 이슈 해결 검증 완료: ${githubUsername} (${userDID}) -> ${contribution.bValue}B`);

    return {
      success: true,
      contribution,
      bTokensAwarded: contribution.bValue,
      transactionResult,
      message: `이슈 해결로 ${contribution.bValue}B가 지급되었습니다`
    };
  }

  /**
   * 사용자의 GitHub 연동 상태 확인
   * @param {string} userDID 
   */
  getUserGitHubMapping(userDID) {
    for (const [username, did] of this.githubUserMappings.entries()) {
      if (did === userDID) {
        return { githubUsername: username, userDID };
      }
    }
    return null;
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
    const mapping = this.getUserGitHubMapping(userDID);
    if (!mapping) {
      return { connected: false };
    }

    const contributions = this.getUserContributions(userDID);
    const totalBTokens = contributions.reduce((sum, contrib) => sum + contrib.bValue, 0);

    return {
      connected: true,
      githubUsername: mapping.githubUsername,
      targetRepository: `${this.targetOwner}/${this.targetRepository}`,
      centralWebhook: this.centralWebhook,
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
      linkedGitHubUsers: this.githubUserMappings.size,
      targetRepository: `${this.targetOwner}/${this.targetRepository}`,
      centralWebhookActive: this.centralWebhook?.active || false
    };
  }
}

module.exports = GitHubIntegration; 