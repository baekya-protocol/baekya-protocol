const fs = require('fs');
const path = require('path');

/**
 * 백야 프로토콜 데이터 영구 저장소
 * 파일 기반 간단한 DB 시스템
 */
class DataStorage {
  constructor(dataDir = './baekya_data') {
    this.dataDir = dataDir;
    this.dataFile = path.join(dataDir, 'protocol_data.json');
    this.sessionsFile = path.join(dataDir, 'active_sessions.json');
    this.data = {};
    this.sessions = new Map();
    
    this.initialize();
  }

  initialize() {
    // 데이터 디렉토리 생성
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log('📁 데이터 저장소 디렉토리 생성:', this.dataDir);
    }

    // 기존 데이터 로드
    this.loadData();
    this.loadSessions();
    
    // 주기적 자동 저장 (5초마다)
    setInterval(() => {
      this.saveData();
      this.saveSessions();
    }, 5000);
  }

  loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const rawData = fs.readFileSync(this.dataFile, 'utf8');
        this.data = JSON.parse(rawData);
        console.log('💾 기존 프로토콜 데이터 로드 완료');
        
        // 필수 필드 확인 및 추가
        if (!this.data.users) this.data.users = {};
        if (!this.data.tokens) {
          this.data.tokens = {
            bTokenBalances: {},
            pTokenBalances: {}
          };
          console.log('⚠️ tokens 필드가 없어서 추가했습니다.');
        }
        if (!this.data.tokens.bTokenBalances) this.data.tokens.bTokenBalances = {};
        if (!this.data.tokens.pTokenBalances) this.data.tokens.pTokenBalances = {};
        if (!this.data.daos) this.data.daos = {};
        if (!this.data.contributions) this.data.contributions = {};
        if (!this.data.validatorPool) {
          this.data.validatorPool = { totalStake: 0, contributions: {} };
        }
        if (!this.data.governance) {
          this.data.governance = {
            proposals: []
          };
        }
        if (!this.data.transactions) this.data.transactions = [];
        if (!this.data.blockchain) this.data.blockchain = [];
        
      } else {
        this.data = {
          users: {},
          tokens: {
            bTokenBalances: {},
            pTokenBalances: {}
          },
          daos: {},
          contributions: {},
          validatorPool: {
            totalStake: 0,
            contributions: {}
          },
          governance: {
            proposals: []
          },
          transactions: [],
          blockchain: []
        };
        this.saveData();
        console.log('💾 새 프로토콜 데이터 파일 생성');
      }
    } catch (error) {
      console.error('❌ 데이터 로드 실패:', error);
      // 오류 발생 시 기본 구조로 초기화
      this.data = {
        users: {},
        tokens: {
          bTokenBalances: {},
          pTokenBalances: {}
        },
        daos: {},
        contributions: {},
        validatorPool: {
          totalStake: 0,
          contributions: {}
        },
        transactions: [],
        blockchain: []
      };
      this.saveData();
      console.log('💾 데이터 로드 실패로 인해 초기화했습니다.');
    }
  }

  loadSessions() {
    try {
      if (fs.existsSync(this.sessionsFile)) {
        const rawData = fs.readFileSync(this.sessionsFile, 'utf8');
        const sessionsData = JSON.parse(rawData);
        this.sessions = new Map(Object.entries(sessionsData));
        
        // 만료된 세션 정리
        this.cleanupExpiredSessions();
        console.log('🔐 활성 세션 로드 완료:', this.sessions.size, '개');
      }
    } catch (error) {
      console.error('❌ 세션 로드 실패:', error);
      this.sessions = new Map();
    }
  }

  saveData() {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('❌ 데이터 저장 실패:', error);
    }
  }

  saveSessions() {
    try {
      const sessionsObj = Object.fromEntries(this.sessions);
      fs.writeFileSync(this.sessionsFile, JSON.stringify(sessionsObj, null, 2));
    } catch (error) {
      console.error('❌ 세션 저장 실패:', error);
    }
  }

  // 사용자 데이터 관리
  saveUser(didHash, userData) {
    if (!this.data.users) this.data.users = {};
    this.data.users[didHash] = {
      ...userData,
      lastUpdated: Date.now()
    };
    this.saveData();
  }

  getUser(didHash) {
    return this.data.users?.[didHash] || null;
  }

  // 토큰 잔액 관리
  setTokenBalance(didHash, amount, tokenType = 'B') {
    // 부동소수점 오류 방지를 위해 소수점 4자리까지 반올림
    const roundedAmount = Math.round(amount * 10000) / 10000;
    
    if (tokenType === 'B') {
      if (!this.data.tokens.bTokenBalances) this.data.tokens.bTokenBalances = {};
      this.data.tokens.bTokenBalances[didHash] = roundedAmount;
    } else if (tokenType === 'P') {
      if (!this.data.tokens.pTokenBalances) this.data.tokens.pTokenBalances = {};
      this.data.tokens.pTokenBalances[didHash] = roundedAmount;
    }
    this.saveData();
  }

  getTokenBalance(didHash, tokenType = 'B') {
    if (tokenType === 'B') {
      return this.data.tokens.bTokenBalances?.[didHash] || 0;
    } else if (tokenType === 'P') {
      return this.data.tokens.pTokenBalances?.[didHash] || 0;
    }
    return 0;
  }

  // 잔액 업데이트
  updateBalance(didHash, tokenType, newAmount) {
    if (tokenType === 'bToken') {
      if (!this.data.tokens.bTokenBalances) this.data.tokens.bTokenBalances = {};
      this.data.tokens.bTokenBalances[didHash] = Math.round(newAmount * 10000) / 10000;
    } else if (tokenType === 'pToken') {
      if (!this.data.tokens.pTokenBalances) this.data.tokens.pTokenBalances = {};
      this.data.tokens.pTokenBalances[didHash] = Math.round(newAmount * 10000) / 10000;
    }
    this.saveData();
  }

  // 잔액 조회 (거버넌스용)
  getBalance(didHash, tokenType) {
    if (tokenType === 'B-Token' || tokenType === 'B') {
      return this.data.tokens.bTokenBalances?.[didHash] || 0;
    } else if (tokenType === 'P-Token' || tokenType === 'P') {
      return this.data.tokens.pTokenBalances?.[didHash] || 0;
    }
    return 0;
  }

  // 검증자 풀 관리
  updateValidatorPool(contributorDID, amount) {
    if (!this.data.validatorPool) {
      this.data.validatorPool = { totalStake: 0, contributions: {} };
    }
    
    if (!this.data.validatorPool.contributions[contributorDID]) {
      this.data.validatorPool.contributions[contributorDID] = 0;
    }
    
    // 부동소수점 오류 방지를 위해 소수점 4자리까지 반올림
    this.data.validatorPool.contributions[contributorDID] = 
      Math.round((this.data.validatorPool.contributions[contributorDID] + amount) * 10000) / 10000;
    this.data.validatorPool.totalStake = 
      Math.round((this.data.validatorPool.totalStake + amount) * 10000) / 10000;
    
    this.saveData();
  }

  getValidatorPoolStatus() {
    return this.data.validatorPool || { totalStake: 0, contributions: {} };
  }
  
  // 검증자 풀에서 인센티브 차감
  withdrawFromValidatorPool(amount) {
    if (!this.data.validatorPool) {
      this.data.validatorPool = { totalStake: 0, contributions: {} };
    }
    
    // 최대 풀 잔액까지만 차감 가능
    const currentBalance = this.data.validatorPool.totalStake || 0;
    const withdrawAmount = Math.min(amount, currentBalance);
    
    if (withdrawAmount > 0) {
      this.data.validatorPool.totalStake = 
        Math.round((this.data.validatorPool.totalStake - withdrawAmount) * 10000) / 10000;
      this.saveData();
    }
    
    return withdrawAmount; // 실제로 차감된 금액 반환
  }
  
  // 검증자 풀 초기화 (블록체인에서 다시 계산할 때 사용)
  resetValidatorPool() {
    this.data.validatorPool = { totalStake: 0, contributions: {} };
    this.saveData();
  }

  // DAO 금고 초기화 (서버 시작 시 사용)
  resetDAOTreasuries() {
    if (!this.data.daos) this.data.daos = {};
    
    let resetCount = 0;
    for (const daoId in this.data.daos) {
      const dao = this.data.daos[daoId];
      if (dao.treasury && dao.treasury > 0) {
        dao.treasury = 0;
        resetCount++;
        console.log(`💰 DAO 금고 초기화: ${dao.name} → 0B`);
      }
    }
    
    if (resetCount > 0) {
      this.saveData();
      console.log(`✅ ${resetCount}개 DAO 금고 초기화 완료`);
    }
  }

  // 세션 관리
  createSession(didHash, deviceId, metadata = {}) {
    // 기존 세션 종료
    const existingSessions = Array.from(this.sessions.entries())
      .filter(([id, session]) => session.didHash === didHash);
    
    for (const [sessionId, session] of existingSessions) {
      console.log(`🔐 기존 세션 종료: ${sessionId} (${session.deviceId})`);
      this.sessions.delete(sessionId);
    }
    
    // 새 세션 생성
    const sessionId = `${didHash}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSession = {
      sessionId,
      didHash,
      deviceId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24시간
      metadata
    };
    
    this.sessions.set(sessionId, newSession);
    this.saveSessions();
    
    console.log(`🔑 새 세션 생성: ${sessionId} (${deviceId})`);
    return sessionId;
  }

  validateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    
    // 만료 확인
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      this.saveSessions();
      return null;
    }
    
    // 활동 시간 업데이트
    session.lastActivity = Date.now();
    return session;
  }

  terminateSession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.saveSessions();
      console.log(`🔐 세션 종료: ${sessionId}`);
    }
    return deleted;
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 만료된 세션 ${cleaned}개 정리`);
      this.saveSessions();
    }
  }

  // 트랜잭션 기록
  recordTransaction(transaction) {
    if (!this.data.transactions) this.data.transactions = [];
    
    this.data.transactions.push({
      ...transaction,
      timestamp: Date.now()
    });
    
    // 최근 1000개만 유지
    if (this.data.transactions.length > 1000) {
      this.data.transactions = this.data.transactions.slice(-1000);
    }
    
    this.saveData();
  }

  // DAO 데이터 관리
  saveDAO(daoId, daoData) {
    if (!this.data.daos) this.data.daos = {};
    this.data.daos[daoId] = {
      ...daoData,
      lastUpdated: Date.now()
    };
    this.saveData();
  }

  getDAO(daoId) {
    return this.data.daos?.[daoId] || null;
  }

  getAllDAOs() {
    return Object.values(this.data.daos || {});
  }

  // DAO 금고 업데이트
  updateDAOTreasury(daoId, amount) {
    if (!this.data.daos) this.data.daos = {};
    
    const dao = this.data.daos[daoId];
    if (dao) {
      if (!dao.treasury) {
        dao.treasury = 0;
      }
      // 부동소수점 오류 방지를 위해 소수점 4자리까지 반올림
      dao.treasury = Math.round((dao.treasury + amount) * 10000) / 10000;
      this.saveData();
      console.log(`💰 DAO 금고 업데이트: ${dao.name} +${amount}B → 총 ${dao.treasury}B`);
      return dao.treasury;
    }
    return 0;
  }

  // 전체 데이터 초기화 (테스트용)
  resetAllData() {
    console.log('⚠️  모든 데이터 초기화 중...');
    this.data = {
      users: {},
      tokens: {
        bTokenBalances: {},
        pTokenBalances: {}
      },
      daos: {},
      contributions: {},
      validatorPool: {
        totalStake: 0,
        contributions: {}
      },
      transactions: [],
      blockchain: []
    };
    this.sessions.clear();
    this.saveData();
    this.saveSessions();
    console.log('✅ 데이터 초기화 완료');
  }
  
  // 블록체인 저장
  saveBlockchain(chain) {
    if (!this.data.blockchain) this.data.blockchain = [];
    this.data.blockchain = chain;
    this.saveData();
  }
  
  // 블록체인 로드
  getBlockchain() {
    return this.data.blockchain || [];
  }
  
  // 새 블록 추가
  addBlock(block) {
    if (!this.data.blockchain) this.data.blockchain = [];
    this.data.blockchain.push(block);
    this.saveData();
  }

  // 세션 무효화 (다른 기기 로그인)
  invalidateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      console.log(`🔒 세션 무효화: ${sessionId}`);
    }
  }

  // 사용자 정보 저장 (통신주소 변경 등)
  saveUserInfo(didHash, updates) {
    if (!this.data.users) this.data.users = {};
    
    const userInfo = this.data.users[didHash] || {};
    Object.assign(userInfo, updates);
    
    // 영구 저장
    this.saveData();
    
    console.log(`💾 사용자 정보 업데이트: ${didHash}`, updates);
  }

  // 사용자 정보 로드
  getUserInfo(didHash) {
    return this.data.users?.[didHash] || null;
  }

  // 초대코드 관리
  saveUserInviteCode(didHash, inviteCode) {
    if (!this.data.inviteCodes) this.data.inviteCodes = {};
    
    this.data.inviteCodes[didHash] = {
      inviteCode: inviteCode,
      createdAt: Date.now(),
      registeredOnChain: false
    };
    
    this.saveData();
    console.log(`🎫 초대코드 저장: ${didHash} → ${inviteCode}`);
  }

  getUserInviteCode(didHash) {
    if (!this.data.inviteCodes) this.data.inviteCodes = {};
    
    const codeData = this.data.inviteCodes[didHash];
    return codeData ? codeData.inviteCode : null;
  }

  // 초대코드로 사용자 찾기
  findUserByInviteCode(inviteCode) {
    if (!this.data.inviteCodes) return null;
    
    for (const [didHash, codeData] of Object.entries(this.data.inviteCodes)) {
      if (codeData.inviteCode === inviteCode) {
        return didHash;
      }
    }
    return null;
  }

  // 초대코드 블록체인 등록 상태 업데이트
  markInviteCodeRegistered(didHash) {
    if (!this.data.inviteCodes) this.data.inviteCodes = {};
    
    if (this.data.inviteCodes[didHash]) {
      this.data.inviteCodes[didHash].registeredOnChain = true;
      this.data.inviteCodes[didHash].registeredAt = Date.now();
      this.saveData();
      console.log(`✅ 초대코드 블록체인 등록 완료: ${didHash}`);
    }
  }

  // 모든 초대코드 목록 (관리자용)
  getAllInviteCodes() {
    return this.data.inviteCodes || {};
  }

  // GitHub 연동 정보 관리
  saveGitHubIntegrations(userDID, integrations) {
    if (!this.data.githubIntegrations) this.data.githubIntegrations = {};
    
    this.data.githubIntegrations[userDID] = {
      integrations: integrations,
      lastUpdated: Date.now()
    };
    
    this.saveData();
    console.log(`🔗 GitHub 연동 정보 저장: ${userDID} (${integrations.length}개 연동)`);
  }

  getGitHubIntegrations(userDID) {
    if (!this.data.githubIntegrations) this.data.githubIntegrations = {};
    
    const userData = this.data.githubIntegrations[userDID];
    return userData ? userData.integrations : [];
  }

  // 특정 GitHub 연동 정보 조회
  getGitHubIntegration(integrationId) {
    if (!this.data.githubIntegrations) return null;
    
    for (const [userDID, userData] of Object.entries(this.data.githubIntegrations)) {
      const integration = userData.integrations.find(i => i.id === integrationId);
      if (integration) {
        return {
          userDID: userDID,
          ...integration
        };
      }
    }
    return null;
  }

  // GitHub 연동 활성화/비활성화
  updateGitHubIntegrationStatus(integrationId, isActive) {
    if (!this.data.githubIntegrations) return false;
    
    for (const [userDID, userData] of Object.entries(this.data.githubIntegrations)) {
      const integration = userData.integrations.find(i => i.id === integrationId);
      if (integration) {
        integration.isActive = isActive;
        integration.lastUpdated = Date.now();
        this.saveData();
        console.log(`🔗 GitHub 연동 상태 업데이트: ${integrationId} → ${isActive ? '활성' : '비활성'}`);
        return true;
      }
    }
    return false;
  }

  // GitHub 기여 기록 저장
  saveGitHubContribution(userDID, contributionData) {
    if (!this.data.githubContributions) this.data.githubContributions = {};
    if (!this.data.githubContributions[userDID]) this.data.githubContributions[userDID] = [];
    
    const contribution = {
      ...contributionData,
      id: `github_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      verified: true,
      verifiedAt: Date.now()
    };
    
    this.data.githubContributions[userDID].push(contribution);
    
    // 최근 100개만 유지
    if (this.data.githubContributions[userDID].length > 100) {
      this.data.githubContributions[userDID] = this.data.githubContributions[userDID].slice(-100);
    }
    
    this.saveData();
    console.log(`🎯 GitHub 기여 기록 저장: ${userDID} → ${contributionData.type} (+${contributionData.reward}B)`);
    return contribution;
  }

  // GitHub 기여 내역 조회
  getGitHubContributions(userDID) {
    if (!this.data.githubContributions) this.data.githubContributions = {};
    
    return this.data.githubContributions[userDID] || [];
  }

  // 모든 GitHub 연동 정보 조회 (관리자용)
  getAllGitHubIntegrations() {
    return this.data.githubIntegrations || {};
  }

  // 기여 내역 저장
  saveContribution(userDID, daoId, contribution) {
    if (!this.data.contributions) this.data.contributions = {};
    if (!this.data.contributions[userDID]) this.data.contributions[userDID] = {};
    if (!this.data.contributions[userDID][daoId]) this.data.contributions[userDID][daoId] = [];
    
    const savedContribution = {
      ...contribution,
      savedAt: Date.now()
    };
    
    this.data.contributions[userDID][daoId].push(savedContribution);
    
    this.saveData();
    console.log(`💾 기여 내역 저장 완료: ${userDID} → ${daoId} → ${contribution.type}`);
    console.log(`📋 저장된 기여 내역:`, JSON.stringify(savedContribution, null, 2));
    console.log(`🔍 현재 사용자의 총 기여 내역: ${this.data.contributions[userDID][daoId].length}건`);
  }

  // 사용자의 DAO 기여 내역 조회
  getUserContributions(userDID, daoId = null, logDetails = false) {
    if (!this.data.contributions || !this.data.contributions[userDID]) {
      return [];
    }
    
    if (daoId) {
      const daoContributions = this.data.contributions[userDID][daoId] || [];
      // 로그는 상세 조회시에만 출력 (기여 개수 조회시에는 출력 안함)
      if (logDetails && daoContributions.length > 0) {
        console.log(`📋 ${daoId} 기여 내역 상세 조회: ${daoContributions.length}건`);
      }
      return daoContributions;
    }
    
    // 모든 DAO의 기여 내역 반환
    const allContributions = [];
    Object.keys(this.data.contributions[userDID]).forEach(dao => {
      const daoContributions = this.data.contributions[userDID][dao] || [];
      daoContributions.forEach(contrib => {
        allContributions.push({ ...contrib, daoId: dao });
      });
    });
    
    return allContributions.sort((a, b) => (b.verifiedAt || b.savedAt) - (a.verifiedAt || a.savedAt));
  }

  // DAO별 기여 통계 조회
  getDAOContributionStats(daoId) {
    if (!this.data.contributions) return { totalContributions: 0, totalContributors: 0 };
    
    let totalContributions = 0;
    const contributors = new Set();
    
    Object.keys(this.data.contributions).forEach(userDID => {
      if (this.data.contributions[userDID][daoId]) {
        const userContributions = this.data.contributions[userDID][daoId];
        totalContributions += userContributions.length;
        contributors.add(userDID);
      }
    });
    
    return {
      totalContributions,
      totalContributors: contributors.size
    };
  }

  // 거버넌스 제안 관련 메서드들
  getGovernanceProposals() {
    return this.data.governance.proposals || [];
  }

  addGovernanceProposal(proposal) {
    if (!this.data.governance) {
      this.data.governance = { proposals: [] };
    }
    this.data.governance.proposals.push(proposal);
    this.saveData();
    console.log(`🏛️ 거버넌스 제안 저장됨: ${proposal.id}`);
  }

  getGovernanceProposal(proposalId) {
    return this.data.governance.proposals.find(p => p.id === proposalId);
  }

  updateGovernanceProposal(proposalId, updates) {
    const index = this.data.governance.proposals.findIndex(p => p.id === proposalId);
    if (index !== -1) {
      this.data.governance.proposals[index] = {
        ...this.data.governance.proposals[index],
        ...updates
      };
      this.saveData();
      return true;
    }
    return false;
  }

  deleteGovernanceProposal(proposalId) {
    const index = this.data.governance.proposals.findIndex(p => p.id === proposalId);
    if (index !== -1) {
      this.data.governance.proposals.splice(index, 1);
      this.saveData();
      return true;
    }
    return false;
  }

  // 모든 거버넌스 제안 삭제 (테스트용)
  clearAllGovernanceProposals() {
    if (!this.data.governance) {
      this.data.governance = { proposals: [] };
    }
    const count = this.data.governance.proposals.length;
    this.data.governance.proposals = [];
    this.saveData();
    console.log(`🧹 모든 거버넌스 제안 삭제됨: ${count}개`);
    return count;
  }
}

module.exports = DataStorage; 