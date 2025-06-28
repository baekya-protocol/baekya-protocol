/**
 * 백야 프로토콜 P-Token (Political Token) 시스템
 * CAPM 방식의 등차수열 발행과 참정권 관리
 */
class PToken {
  constructor(didSystem, cvcmSystem, daoSystem) {
    this.didSystem = didSystem;
    this.cvcmSystem = cvcmSystem;
    this.daoSystem = daoSystem;
    
    // P-token 잔액 관리 (DID 시스템과 연동)
    this.pTokenBalances = new Map();
    
    // DAO별 P-token 발행 기록
    this.daoIssuanceRecords = new Map(); // daoId -> Array of {did, amount, timestamp}
    
    // 전체 P-token 발행 통계
    this.totalSupply = 0;
    this.burnedTokens = 0;
    
    // 주기적 발행 설정
    this.defaultMintingConfig = {
      minGuarantee: 1,
      period: 30 * 24 * 60 * 60 * 1000 // 30일 (밀리초)
    };
  }

  /**
   * 구성원 수에 따른 P중간값 계산
   * @param {number} memberCount - 구성원 수
   * @returns {number} P중간값
   */
  calculateMedianValue(memberCount) {
    if (memberCount <= 10) {
      return 3;  // 10명 이하: 3P
    } else if (memberCount <= 100) {
      return 8;  // 10~100명: 8P
    } else if (memberCount <= 1000) {
      return 16; // 100~1000명: 16P
    } else {
      return 30; // 1000명 이상: 30P
    }
  }

  /**
   * CAPM 방식으로 P-token 계산
   * @param {Array} contributors - [{did, contribution}]
   * @param {Object} config - {minGuarantee, medianValue, totalContributors}
   * @returns {Object}
   */
  calculateCAPM(contributors, config) {
    const { minGuarantee, totalContributors } = config;
    const N = totalContributors || contributors.length;
    
    // 구성원 수에 따른 P중간값 계산 (config에 medianValue가 없으면 자동 계산)
    const medianValue = config.medianValue || this.calculateMedianValue(N);
    
    if (N === 0) {
      return {
        totalPTokens: 0,
        commonDifference: 0,
        distributions: []
      };
    }
    
    if (N === 1) {
      return {
        totalPTokens: medianValue,
        commonDifference: 0,
        distributions: [{ did: contributors[0].did, amount: medianValue, rank: 1 }]
      };
    }

    // P_total = N * P_median
    const totalPTokens = N * medianValue;
    
    // 등차수열 공차: d = 2 * (P_median - P_min) / (N-1)
    const commonDifference = (2 * (medianValue - minGuarantee)) / (N - 1);
    
    // 기여량 순으로 정렬 (내림차순)
    const sortedContributors = [...contributors].sort((a, b) => b.contribution - a.contribution);
    
    // 각 기여자에게 P-token 할당
    const distributions = sortedContributors.map((contributor, index) => {
      const rank = index + 1;
      // P_i = P_min + (N - rank) * d
      const amount = minGuarantee + (N - rank) * commonDifference;
      
      return {
        did: contributor.did,
        amount: Math.round(amount * 100) / 100, // 소수점 2자리
        rank,
        contribution: contributor.contribution
      };
    });

    return {
      totalPTokens,
      commonDifference,
      distributions
    };
  }

  /**
   * CAPM 방식으로 P-token 발행
   * @param {string} daoId 
   * @param {Array} contributors 
   * @param {Object} config 
   * @returns {Object}
   */
  mintPTokensCAMP(daoId, contributors, config) {
    if (!contributors || contributors.length === 0) {
      return {
        success: true,
        totalMinted: 0,
        distributions: [],
        message: '기여자가 없습니다'
      };
    }

    const calculation = this.calculateCAPM(contributors, config);
    
    // 각 기여자에게 P-token 발행
    calculation.distributions.forEach(dist => {
      const currentBalance = this.getPTokenBalance(dist.did);
      this.setPTokenBalance(dist.did, currentBalance + dist.amount);
      
      // 발행 기록
      this.recordPTokenIssuance(daoId, dist.did, dist.amount);
    });

    // 총 공급량 업데이트
    this.totalSupply += calculation.totalPTokens;

    return {
      success: true,
      daoId,
      totalMinted: calculation.totalPTokens,
      distributions: calculation.distributions,
      mintingConfig: config
    };
  }

  /**
   * P-token 잔액 설정
   * @param {string} did 
   * @param {number} amount 
   */
  setPTokenBalance(did, amount) {
    if (amount < 0) {
      throw new Error('P-token 잔액은 음수가 될 수 없습니다');
    }
    
    this.pTokenBalances.set(did, amount);
    
    // DID 시스템과 동기화
    if (this.didSystem && this.didSystem.setPTokenBalance) {
      this.didSystem.setPTokenBalance(did, amount);
    }
  }

  /**
   * P-token 잔액 조회
   * @param {string} did 
   * @returns {number}
   */
  getPTokenBalance(did) {
    return this.pTokenBalances.get(did) || 0;
  }

  /**
   * P-token 전송
   * @param {string} fromDID 
   * @param {string} toDID 
   * @param {number} amount 
   * @returns {Object}
   */
  transferPToken(fromDID, toDID, amount) {
    const fromBalance = this.getPTokenBalance(fromDID);
    
    if (fromBalance < amount) {
      throw new Error('P-token 잔액이 부족합니다');
    }
    
    this.setPTokenBalance(fromDID, fromBalance - amount);
    this.setPTokenBalance(toDID, this.getPTokenBalance(toDID) + amount);
    
    return {
      success: true,
      fromDID,
      toDID,
      amount,
      timestamp: Date.now()
    };
  }

  /**
   * 투표 가중치 계산 (P-token 보유량과 동일)
   * @param {string} did 
   * @returns {number}
   */
  getVotingPower(did) {
    return this.getPTokenBalance(did);
  }

  /**
   * 투표 자격 확인 (1P 이상 보유)
   * @param {string} did 
   * @returns {boolean}
   */
  isQualifiedVoter(did) {
    return this.getPTokenBalance(did) >= 1;
  }

  /**
   * 주기적 P-token 발행 실행
   * @param {string} daoId 
   * @param {Array} contributors 
   * @param {Object} customConfig 
   * @returns {Object}
   */
  async executePeriodicMinting(daoId, contributors, customConfig = null) {
    const baseConfig = customConfig || this.defaultMintingConfig;
    
    if (!contributors || contributors.length === 0) {
      return {
        success: true,
        daoId,
        totalMinted: 0,
        contributorsCount: 0,
        message: '해당 기간 동안 기여자가 없습니다'
      };
    }

    // 구성원 수에 따른 P중간값 자동 계산
    const memberCount = contributors.length;
    const medianValue = this.calculateMedianValue(memberCount);
    
    const config = {
      ...baseConfig,
      medianValue,
      totalContributors: memberCount
    };

    const mintingResult = this.mintPTokensCAMP(daoId, contributors, config);
    
    return {
      success: true,
      daoId,
      contributorsCount: contributors.length,
      totalMinted: mintingResult.totalMinted,
      distributions: mintingResult.distributions,
      timestamp: Date.now()
    };
  }

  /**
   * P-token 소각
   * @param {string} did 
   * @param {number} amount 
   * @param {string} reason 
   * @returns {Object}
   */
  burnPToken(did, amount, reason = '') {
    const currentBalance = this.getPTokenBalance(did);
    
    if (currentBalance < amount) {
      throw new Error('소각할 P-token이 부족합니다');
    }
    
    this.setPTokenBalance(did, currentBalance - amount);
    this.burnedTokens += amount;
    this.totalSupply -= amount;
    
    return {
      success: true,
      did,
      burnedAmount: amount,
      reason,
      remainingBalance: this.getPTokenBalance(did),
      timestamp: Date.now()
    };
  }

  /**
   * 모든 P-token 소각 (탄핵 시 사용)
   * @param {string} did 
   * @param {string} reason 
   * @returns {Object}
   */
  burnAllPTokens(did, reason = '') {
    const currentBalance = this.getPTokenBalance(did);
    
    if (currentBalance > 0) {
      this.setPTokenBalance(did, 0);
      this.burnedTokens += currentBalance;
      this.totalSupply -= currentBalance;
    }
    
    return {
      success: true,
      did,
      burnedAmount: currentBalance,
      reason,
      remainingBalance: 0,
      timestamp: Date.now()
    };
  }

  /**
   * P-token 발행 기록
   * @param {string} daoId 
   * @param {string} did 
   * @param {number} amount 
   */
  recordPTokenIssuance(daoId, did, amount) {
    if (!this.daoIssuanceRecords.has(daoId)) {
      this.daoIssuanceRecords.set(daoId, []);
    }
    
    const records = this.daoIssuanceRecords.get(daoId);
    records.push({
      did,
      amount,
      timestamp: Date.now()
    });
  }

  /**
   * DAO별 P-token 통계 조회
   * @param {string} daoId 
   * @returns {Object}
   */
  getDAOPTokenStats(daoId) {
    const records = this.daoIssuanceRecords.get(daoId) || [];
    
    const totalIssued = records.reduce((sum, record) => sum + record.amount, 0);
    const uniqueHolders = new Set(records.map(record => record.did)).size;
    const averageHolding = uniqueHolders > 0 ? totalIssued / uniqueHolders : 0;
    
    return {
      daoId,
      totalIssued,
      totalHolders: uniqueHolders,
      averageHolding: Math.round(averageHolding * 100) / 100,
      issuanceCount: records.length
    };
  }

  /**
   * 전체 네트워크 P-token 통계 조회
   * @returns {Object}
   */
  getNetworkPTokenStats() {
    const allDIDs = new Set();
    let totalIssued = 0;
    
    // 모든 DAO의 발행 기록 집계
    for (const [daoId, records] of this.daoIssuanceRecords) {
      records.forEach(record => {
        allDIDs.add(record.did);
        totalIssued += record.amount;
      });
    }
    
    // totalSupply가 0이면 실제 발행된 totalIssued 사용
    const actualTotalSupply = this.totalSupply > 0 ? this.totalSupply : totalIssued;
    
    return {
      totalSupply: actualTotalSupply,
      totalBurned: this.burnedTokens,
      circulating: actualTotalSupply - this.burnedTokens,
      totalHolders: allDIDs.size,
      activeDAOs: this.daoIssuanceRecords.size
    };
  }

  /**
   * 1P 이상 보유자 목록 조회 (투표 자격자)
   * @param {string} daoId 
   * @returns {Array}
   */
  getQualifiedVoters(daoId) {
    const daoMembers = this.daoSystem.getDAOMembers(daoId);
    
    return daoMembers
      .filter(did => this.isQualifiedVoter(did))
      .map(did => ({
        did,
        pTokenBalance: this.getPTokenBalance(did),
        votingPower: this.getVotingPower(did)
      }))
      .sort((a, b) => b.pTokenBalance - a.pTokenBalance);
  }

  /**
   * P-token 보유 상위자 조회
   * @param {number} limit 
   * @returns {Array}
   */
  getTopPTokenHolders(limit = 10) {
    const holders = [];
    
    for (const [did, balance] of this.pTokenBalances) {
      if (balance > 0) {
        holders.push({ did, balance });
      }
    }
    
    return holders
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);
  }
}

module.exports = PToken; 