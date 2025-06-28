const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const BMRCalculator = require('./BMRCalculator');

/**
 * CVCM (Contribution-Verification-Calculation-Minting) 시스템
 * 기여-검증-계산-발행 메커니즘을 구현하여 기여기반 화폐 발행을 처리
 * Protocol Overview의 LDM 방식을 정확히 구현 (동적시간감쇠율 적용)
 */
class CVCM {
  constructor(didSystem) {
    this.didSystem = didSystem;
    
    // BMR 계산기 초기화
    this.bmrCalculator = new BMRCalculator();
    
    // DAO별 지정된 기여활동(DCA) 저장
    this.dcaRegistry = new Map(); // daoId -> Map(dcaId -> dca)
    
    // 기여 제출 데이터 저장
    this.contributions = new Map(); // contributionId -> contribution
    
    // 검증 결과 저장
    this.verifications = new Map(); // contributionId -> verification
    
    // 기여자별 BMR 데이터 저장 (Protocol Overview 방식)
    this.contributorBMRs = new Map(); // contributorDID -> Array of BMR data
    
    // 기여자별 누적 토큰 저장
    this.accumulatedTokens = new Map(); // contributorDID -> accumulated tokens
    
    // 기여자별 마지막 업데이트 시간
    this.lastUpdateTime = new Map(); // contributorDID -> timestamp
    
    console.log('🏗️ CVCM 시스템 초기화 완료 (Protocol Overview LDM 방식 - 동적시간감쇠율)');
  }

  /**
   * DAO에 기여활동(DCA) 등록
   * @param {string} daoId 
   * @param {Object} dca - {id, name, value, verificationCriteria}
   */
  registerDCA(daoId, dca) {
    if (!dca.id || !dca.name || !dca.value || !dca.verificationCriteria) {
      throw new Error('DCA의 필수 정보가 누락되었습니다');
    }

    if (!this.dcaRegistry.has(daoId)) {
      this.dcaRegistry.set(daoId, new Map());
    }

    const daoDCAs = this.dcaRegistry.get(daoId);
    if (daoDCAs.has(dca.id)) {
      throw new Error('이미 등록된 DCA입니다');
    }

    daoDCAs.set(dca.id, dca);
    console.log(`📝 DCA 등록: ${daoId}/${dca.id} (${dca.value}B)`);
  }

  /**
   * 등록된 DCA 조회
   * @param {string} daoId 
   * @param {string} dcaId 
   * @returns {Object}
   */
  getDCA(daoId, dcaId) {
    const daoDCAs = this.dcaRegistry.get(daoId);
    if (!daoDCAs) {
      throw new Error('존재하지 않는 DAO입니다');
    }
    
    const dca = daoDCAs.get(dcaId);
    if (!dca) {
      throw new Error(`존재하지 않는 DCA입니다: ${dcaId}`);
    }
    
    return dca;
  }

  /**
   * 기여 제출
   * @param {Object} contribution - {daoId, dcaId, contributorDID, contributorAge, gender, description, evidence}
   * @returns {Object} 기여 제출 결과
   */
  submitContribution(contribution) {
    if (!contribution.contributorDID) {
      throw new Error('기여자 DID는 필수입니다');
    }
    if (!contribution.daoId || !contribution.dcaId) {
      throw new Error('DAO ID와 DCA ID는 필수입니다');
    }
    if (!contribution.contributorAge || contribution.contributorAge < 0) {
      throw new Error('기여자 나이는 필수입니다');
    }

    // DCA 존재 확인
    const dca = this.getDCA(contribution.daoId, contribution.dcaId);

    const contributionId = uuidv4();
    const contributionData = {
      id: contributionId,
      ...contribution,
      timestamp: Date.now(),
      status: 'submitted',
      dcaValue: dca.value // DCA 가치 저장
    };

    this.contributions.set(contributionId, contributionData);
    console.log(`📝 기여 제출: ${contributionId.substring(0, 8)}... (${dca.value}B)`);
    
    return {
      success: true,
      contributionId,
      status: 'submitted',
      dcaValue: dca.value,
      message: '기여가 성공적으로 제출되었습니다'
    };
  }

  /**
   * 기여 검증
   * @param {string} contributionId 
   * @param {string} verifierDID 
   * @param {boolean} verified 
   * @param {string} reason 
   * @returns {Object}
   */
  async verifyContribution(contributionId, verifierDID, verified, reason = '') {
    const contribution = this.contributions.get(contributionId);
    if (!contribution) {
      throw new Error('존재하지 않는 기여입니다');
    }

    const verificationResult = {
      success: true,
      contributionId,
      verifierDID,
      verified,
      reason,
      timestamp: Date.now()
    };

    this.verifications.set(contributionId, verificationResult);

    // 기여 상태 업데이트
    contribution.status = verified ? 'verified' : 'rejected';
    
    // 검증된 기여에 대해 BMR 추가
    if (verified) {
      const bmrResult = await this.addBMRForContribution(contribution);
      verificationResult.bmrAdded = bmrResult.bmrAdded;
      verificationResult.totalBMR = bmrResult.totalBMR;
    }

    console.log(`✅ 기여 검증 ${verified ? '승인' : '거부'}: ${contributionId.substring(0, 8)}...`);
    return verificationResult;
  }

  /**
   * 검증된 기여에 대해 BMR 추가 (Protocol Overview 방식)
   * @param {Object} contribution 
   * @returns {Object}
   */
  async addBMRForContribution(contribution) {
    try {
      // BMR 계산
      const bmrData = this.bmrCalculator.calculateBMR({
        contributorAge: contribution.contributorAge,
        dcaValue: contribution.dcaValue,
        gender: contribution.gender || 'default'
      });

      // BMR 데이터 저장
      const bmrEntry = {
        contributionId: contribution.id,
        bmrData,
        startTime: Date.now(),
        daoId: contribution.daoId,
        dcaId: contribution.dcaId
      };

      // 기여자의 BMR 목록에 추가
      if (!this.contributorBMRs.has(contribution.contributorDID)) {
        this.contributorBMRs.set(contribution.contributorDID, []);
        this.accumulatedTokens.set(contribution.contributorDID, 0);
        this.lastUpdateTime.set(contribution.contributorDID, Date.now());
      }

      this.contributorBMRs.get(contribution.contributorDID).push(bmrEntry);

      // 기여 상태 업데이트
      contribution.status = 'minted';
      contribution.bmrAdded = bmrData.initialRate;

      console.log(`⛏️ BMR 추가: ${contribution.contributorDID.substring(0, 8)}... (+${bmrData.initialRate.toFixed(4)}B/년)`);

      return {
        success: true,
        contributionId: contribution.id,
        bmrAdded: bmrData.initialRate,
        totalBMR: this.getTotalBMR(contribution.contributorDID),
        bmrData: bmrData
      };

    } catch (error) {
      console.error('❌ BMR 추가 실패:', error.message);
      throw error;
    }
  }

  /**
   * 기여자의 총 BMR 계산 (모든 기여의 초기 발행률 합계)
   * @param {string} contributorDID 
   * @returns {number}
   */
  getTotalBMR(contributorDID) {
    const bmrList = this.contributorBMRs.get(contributorDID) || [];
    return bmrList.reduce((total, entry) => total + entry.bmrData.initialRate, 0);
  }

  /**
   * 현재 시점의 시간당 발행률 계산
   * @param {string} contributorDID 
   * @returns {number}
   */
  getCurrentHourlyRate(contributorDID) {
    const bmrList = this.contributorBMRs.get(contributorDID) || [];
    const currentTime = Date.now();
    let totalHourlyRate = 0;

    for (const entry of bmrList) {
      const yearsElapsed = (currentTime - entry.startTime) / (1000 * 60 * 60 * 24 * 365);
      const currentRate = this.bmrCalculator.getBMRAtTime(entry.bmrData, yearsElapsed);
      totalHourlyRate += currentRate / (365 * 24);
    }

    return totalHourlyRate;
  }

  /**
   * 누적 토큰 업데이트 및 반환
   * @param {string} contributorDID 
   * @returns {Object}
   */
  updateAccumulatedTokens(contributorDID) {
    const bmrList = this.contributorBMRs.get(contributorDID) || [];
    if (bmrList.length === 0) {
      return { accumulatedTokens: 0, newTokens: 0 };
    }

    const currentTime = Date.now();
    const lastUpdate = this.lastUpdateTime.get(contributorDID) || currentTime;
    let newTokens = 0;

    // 각 BMR에 대해 마지막 업데이트 이후 누적된 토큰 계산
    for (const entry of bmrList) {
      const bmrStartTime = Math.max(entry.startTime, lastUpdate);
      const hoursElapsed = Math.max(0, (currentTime - bmrStartTime) / (1000 * 60 * 60));
      
      if (hoursElapsed > 0) {
        const yearsFromBMRStart = (bmrStartTime - entry.startTime) / (1000 * 60 * 60 * 24 * 365);
        const futureTokens = this.bmrCalculator.getFutureEarnings(
          entry.bmrData, 
          entry.startTime, 
          hoursElapsed + ((bmrStartTime - entry.startTime) / (1000 * 60 * 60))
        );
        
        newTokens += futureTokens;
      }
    }

    // 누적 토큰 업데이트
    const currentAccumulated = this.accumulatedTokens.get(contributorDID) || 0;
    const newAccumulatedTotal = currentAccumulated + newTokens;
    
    this.accumulatedTokens.set(contributorDID, newAccumulatedTotal);
    this.lastUpdateTime.set(contributorDID, currentTime);

    return {
      accumulatedTokens: newAccumulatedTotal,
      newTokens: newTokens,
      totalBMR: this.getTotalBMR(contributorDID),
      hourlyRate: this.getCurrentHourlyRate(contributorDID)
    };
  }

  /**
   * 기여자의 마이닝 대시보드 데이터
   * @param {string} contributorDID 
   * @returns {Object}
   */
  getMiningDashboard(contributorDID) {
    const tokenData = this.updateAccumulatedTokens(contributorDID);
    const bmrList = this.contributorBMRs.get(contributorDID) || [];
    const currentHourlyRate = this.getCurrentHourlyRate(contributorDID);

    return {
      totalBMR: tokenData.totalBMR,
      accumulatedTokens: tokenData.accumulatedTokens,
      currentHourlyRate: currentHourlyRate,
      dailyRate: currentHourlyRate * 24,
      monthlyRate: currentHourlyRate * 24 * 30,
      yearlyRate: currentHourlyRate * 24 * 365,
      activeBMRs: bmrList.length,
      bmrDetails: bmrList.map(entry => {
        const yearsElapsed = (Date.now() - entry.startTime) / (1000 * 60 * 60 * 24 * 365);
        const currentRate = this.bmrCalculator.getBMRAtTime(entry.bmrData, yearsElapsed);
        
        return {
          contributionId: entry.contributionId,
          startTime: entry.startTime,
          daoId: entry.daoId,
          dcaId: entry.dcaId,
          totalValue: entry.bmrData.totalValue,
          initialRate: entry.bmrData.initialRate,
          currentRate: currentRate,
          remainingYears: Math.max(0, entry.bmrData.remainingLifetime - yearsElapsed),
          timeTable: entry.bmrData.timeTable
        };
      })
    };
  }

  /**
   * 기여자의 기여 이력 조회
   * @param {string} contributorDID 
   * @returns {Array}
   */
  getContributionHistory(contributorDID) {
    const history = [];
    
    for (const [contributionId, contribution] of this.contributions) {
      if (contribution.contributorDID === contributorDID) {
        const verification = this.verifications.get(contributionId);
        history.push({
          ...contribution,
          verification
        });
      }
    }

    return history.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * DAO별 기여 통계 조회
   * @param {string} daoId 
   * @returns {Object}
   */
  getDAOContributionStats(daoId) {
    let totalContributions = 0;
    let verifiedContributions = 0;
    let totalBMRGenerated = 0;
    const contributors = new Set();

    for (const [contributionId, contribution] of this.contributions) {
      if (contribution.daoId === daoId) {
        totalContributions++;
        contributors.add(contribution.contributorDID);
        
        const verification = this.verifications.get(contributionId);
        if (verification && verification.verified) {
          verifiedContributions++;
          if (contribution.bmrAdded) {
            totalBMRGenerated += contribution.bmrAdded;
          }
        }
      }
    }

    return {
      totalContributions,
      verifiedContributions,
      totalBMRGenerated,
      uniqueContributors: contributors.size,
      verificationRate: totalContributions > 0 ? verifiedContributions / totalContributions : 0
    };
  }

  /**
   * 사용자 기여 현황 조회
   * @param {string} userDID 
   * @returns {Object}
   */
  getUserContributions(userDID) {
    const contributions = this.getContributionHistory(userDID);
    const dashboard = this.getMiningDashboard(userDID);
    
    return {
      contributions: contributions,
      miningData: dashboard,
      totalContributions: contributions.length,
      verifiedContributions: contributions.filter(c => c.verification?.verified).length
    };
  }

  /**
   * Protocol Overview 예시 데모 (동적시간감쇠율 적용)
   */
  async demonstrateProtocolExample() {
    console.log('\n🎯 Protocol Overview 예시 시연 (동적시간감쇠율)');
    console.log('==================================================');
    
    // 30세 남성 기여자 설정
    const contributorDID = 'did:baekya:demo30male';
    const contributorAge = 30;
    const gender = 'male';
    const lifeExpectancy = 80;
    const remainingYears = lifeExpectancy - contributorAge; // 50년
    
    console.log(`기여자 정보: ${contributorAge}세 ${gender}, 남은 기대수명: ${remainingYears}년`);
    
    // 동적시간감쇠율 계산 (퍼블릭 폴더와 동일)
    const dynamicDecayRate = this.bmrCalculator.calculateDecayRate(remainingYears);
    console.log(`동적시간감쇠율: ${(dynamicDecayRate * 100).toFixed(2)}%/년 (k = ${dynamicDecayRate.toFixed(4)})`);
    
    // 첫 번째 기여: 80B 가치
    const contribution1 = await this.submitContribution({
      daoId: 'development',
      dcaId: 'opinion-proposal',
      contributorDID: contributorDID,
      contributorAge: contributorAge,
      gender: gender,
      description: '프로토콜 효율성 개선 의견 제안',
      evidence: 'GitHub issue #123'
    });
    
    await this.verifyContribution(contribution1.contributionId, 'did:baekya:verifier', true);
    
    // 두 번째 기여: 250B 가치
    const contribution2 = await this.submitContribution({
      daoId: 'development',
      dcaId: 'pull-request',
      contributorDID: contributorDID,
      contributorAge: contributorAge,
      gender: gender,
      description: '효율성 개선 PR 제출',
      evidence: 'PR #456'
    });
    
    await this.verifyContribution(contribution2.contributionId, 'did:baekya:verifier', true);
    
    // 결과 확인
    const dashboard = this.getMiningDashboard(contributorDID);
    
    console.log(`\n📊 결과 (동적시간감쇠율 적용):`);
    console.log(`총 기여가치: 330B (80B + 250B)`);
    console.log(`총 BMR: ${dashboard.totalBMR.toFixed(2)}B/년`);
    console.log(`현재 시간당 발행량: ${dashboard.currentHourlyRate.toFixed(6)}B/시간`);
    console.log(`일일 발행량: ${dashboard.dailyRate.toFixed(4)}B/일`);
    console.log(`월간 발행량: ${dashboard.monthlyRate.toFixed(2)}B/월`);
    
    // BMR 세부 정보 출력
    console.log('\n🔍 BMR 세부 정보:');
    dashboard.bmrDetails.forEach((bmr, index) => {
      console.log(`  기여 ${index + 1}: 초기 ${bmr.initialRate.toFixed(2)}B/년, 현재 ${bmr.currentRate.toFixed(2)}B/년`);
      console.log(`    감쇠율: ${(bmr.currentRate > 0 ? (bmr.initialRate / bmr.currentRate - 1) * 100 : 0).toFixed(2)}% 감소`);
      console.log(`    남은 기간: ${bmr.remainingYears.toFixed(1)}년`);
    });
    
    // 시간별 발행량 변화 시뮬레이션
    console.log('\n⏰ 시간별 발행량 변화 (첫 번째 기여 80B 기준):');
    const firstBMR = dashboard.bmrDetails[0];
    if (firstBMR && firstBMR.timeTable) {
      firstBMR.timeTable.slice(0, 5).forEach(entry => {
        console.log(`  ${entry.years}년 후: ${entry.yearlyRate}B/년 (${entry.hourlyRate.toFixed(6)}B/시간)`);
      });
    }
    
    return dashboard;
  }
}

module.exports = CVCM;