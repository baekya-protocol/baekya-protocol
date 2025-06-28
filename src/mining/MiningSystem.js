class MiningSystem {
  constructor() {
    this.minerData = new Map(); // DID -> mining data
    this.lastUpdateTime = new Map(); // DID -> last update timestamp
    this.miningHistory = new Map(); // DID -> mining history array
  }

  // BMR 추가 (기여 시)
  addBMR(contributorDID, contributorAge, bTokenValue) {
    const lifeExpectancy = contributorAge > 50 ? 80 : (contributorAge > 30 ? 85 : 90);
    const remainingYears = Math.max(lifeExpectancy - contributorAge, 10);
    const decayRate = 0.016;
    
    // LDM 계산
    const integralValue = (1 - Math.exp(-decayRate * remainingYears)) / decayRate;
    const initialRate = bTokenValue / integralValue; // A 값
    
    const bmrData = {
      initialRate, // A
      decayRate, // k
      contributorAge,
      remainingYears, // R
      startTime: Date.now(),
      totalValue: bTokenValue,
      accumulatedTokens: 0 // 실제로 누적된 토큰
    };

    if (!this.minerData.has(contributorDID)) {
      this.minerData.set(contributorDID, []);
      this.lastUpdateTime.set(contributorDID, Date.now());
      this.miningHistory.set(contributorDID, []);
    }

    this.minerData.get(contributorDID).push(bmrData);
    
    // 마이닝 히스토리에 추가
    this.miningHistory.get(contributorDID).push({
      timestamp: Date.now(),
      action: 'BMR_ADDED',
      bTokenValue,
      initialRate,
      remainingYears
    });

    return {
      success: true,
      message: `BMR이 추가되었습니다. 시간당 ${this.getCurrentHourlyRate(contributorDID).toFixed(6)} B가 발행됩니다.`,
      bmrId: bmrData.startTime,
      currentHourlyRate: this.getCurrentHourlyRate(contributorDID)
    };
  }

  // 현재 시간당 발행량 계산
  getCurrentHourlyRate(contributorDID) {
    const bmrList = this.minerData.get(contributorDID) || [];
    let totalHourlyRate = 0;

    const currentTime = Date.now();

    for (const bmr of bmrList) {
      const hoursElapsed = (currentTime - bmr.startTime) / (1000 * 60 * 60);
      const yearsElapsed = hoursElapsed / (365 * 24);
      
      // BMR(t) = A * e^(-k*t)
      const currentRate = bmr.initialRate * Math.exp(-bmr.decayRate * yearsElapsed);
      totalHourlyRate += currentRate / (365 * 24); // 연간 -> 시간당 변환
    }

    return totalHourlyRate;
  }

  // 누적된 토큰 업데이트 및 반환
  updateAndGetAccumulatedTokens(contributorDID) {
    const bmrList = this.minerData.get(contributorDID) || [];
    
    if (bmrList.length === 0) {
      return {
        success: true,
        accumulatedTokens: 0,
        newTokens: 0,
        totalBMR: 0,
        hourlyRate: 0,
        lastUpdate: Date.now()
      };
    }

    // lastUpdateTime이 없으면 가장 최근 BMR의 시작 시간으로 설정
    let lastUpdate = this.lastUpdateTime.get(contributorDID);
    if (!lastUpdate) {
      lastUpdate = Math.max(...bmrList.map(bmr => bmr.startTime));
      this.lastUpdateTime.set(contributorDID, lastUpdate);
    }
    
    const currentTime = Date.now();
    let totalNewTokens = 0;
    const hoursElapsed = (currentTime - lastUpdate) / (1000 * 60 * 60);

    // 각 BMR에 대해 새로 누적된 토큰 계산
    for (const bmr of bmrList) {
      const bmrStartTime = Math.max(bmr.startTime, lastUpdate);
      const bmrHoursElapsed = Math.max(0, (currentTime - bmrStartTime) / (1000 * 60 * 60));
      
      if (bmrHoursElapsed > 0) {
        // 시간 적분으로 누적 토큰 계산
        const yearsFromStart = (bmrStartTime - bmr.startTime) / (1000 * 60 * 60 * 24 * 365);
        const yearsToEnd = yearsFromStart + (bmrHoursElapsed / (24 * 365));
        
        // ∫[t1, t2] A * e^(-k*t) dt = A * (e^(-k*t1) - e^(-k*t2)) / k
        const integral = bmr.initialRate * 
          (Math.exp(-bmr.decayRate * yearsFromStart) - Math.exp(-bmr.decayRate * yearsToEnd)) / 
          bmr.decayRate;
        
        bmr.accumulatedTokens += integral;
        totalNewTokens += integral;
      }
    }

    // 업데이트 시간 갱신
    this.lastUpdateTime.set(contributorDID, currentTime);

    // 마이닝 히스토리 업데이트
    if (totalNewTokens > 0) {
      const history = this.miningHistory.get(contributorDID) || [];
      history.push({
        timestamp: currentTime,
        action: 'TOKENS_MINED',
        amount: totalNewTokens,
        hoursElapsed,
        hourlyRate: this.getCurrentHourlyRate(contributorDID)
      });
      this.miningHistory.set(contributorDID, history);
    }

    return {
      success: true,
      accumulatedTokens: this.getTotalAccumulatedTokens(contributorDID),
      newTokens: totalNewTokens,
      totalBMR: this.getTotalBMR(contributorDID),
      hourlyRate: this.getCurrentHourlyRate(contributorDID),
      lastUpdate: currentTime
    };
  }

  // 총 누적 토큰 계산
  getTotalAccumulatedTokens(contributorDID) {
    const bmrList = this.minerData.get(contributorDID) || [];
    return bmrList.reduce((total, bmr) => total + bmr.accumulatedTokens, 0);
  }

  // 총 BMR 값 계산
  getTotalBMR(contributorDID) {
    const bmrList = this.minerData.get(contributorDID) || [];
    return bmrList.reduce((total, bmr) => total + bmr.totalValue, 0);
  }

  // 마이닝 대시보드 데이터
  getMiningDashboard(contributorDID) {
    this.updateAndGetAccumulatedTokens(contributorDID); // 먼저 업데이트
    
    const bmrList = this.minerData.get(contributorDID) || [];
    const history = this.miningHistory.get(contributorDID) || [];
    
    return {
      totalBMR: this.getTotalBMR(contributorDID),
      accumulatedTokens: this.getTotalAccumulatedTokens(contributorDID),
      currentHourlyRate: this.getCurrentHourlyRate(contributorDID),
      activeBMRs: bmrList.length,
      miningHistory: history.slice(-10), // 최근 10개 히스토리
      projectedDaily: this.getCurrentHourlyRate(contributorDID) * 24,
      projectedMonthly: this.getCurrentHourlyRate(contributorDID) * 24 * 30,
      bmrDetails: bmrList.map(bmr => ({
        startTime: bmr.startTime,
        totalValue: bmr.totalValue,
        accumulatedTokens: bmr.accumulatedTokens,
        remainingValue: bmr.totalValue - bmr.accumulatedTokens,
        remainingYears: bmr.remainingYears,
        currentRate: bmr.initialRate * Math.exp(-bmr.decayRate * 
          ((Date.now() - bmr.startTime) / (1000 * 60 * 60 * 24 * 365)))
      }))
    };
  }

  // 시뮬레이션: 미래 수익 예측
  simulateFutureEarnings(contributorDID, futureHours) {
    const bmrList = this.minerData.get(contributorDID) || [];
    const currentTime = Date.now();
    let totalFutureTokens = 0;

    for (const bmr of bmrList) {
      const yearsFromStart = (currentTime - bmr.startTime) / (1000 * 60 * 60 * 24 * 365);
      const yearsToEnd = yearsFromStart + (futureHours / (24 * 365));
      
      // 미래 누적 토큰 계산
      const futureIntegral = bmr.initialRate * 
        (Math.exp(-bmr.decayRate * yearsFromStart) - Math.exp(-bmr.decayRate * yearsToEnd)) / 
        bmr.decayRate;
      
      totalFutureTokens += Math.max(0, futureIntegral);
    }

    return {
      futureHours,
      estimatedTokens: totalFutureTokens,
      averageHourlyRate: totalFutureTokens / futureHours
    };
  }

  // 전체 네트워크 마이닝 통계
  getNetworkMiningStats() {
    let totalMiners = 0;
    let totalHourlyRate = 0;
    let totalAccumulatedTokens = 0;
    let totalBMR = 0;

    for (const [did, bmrList] of this.minerData) {
      if (bmrList.length > 0) {
        totalMiners++;
        totalHourlyRate += this.getCurrentHourlyRate(did);
        totalAccumulatedTokens += this.getTotalAccumulatedTokens(did);
        totalBMR += this.getTotalBMR(did);
      }
    }

    return {
      totalMiners,
      totalHourlyRate,
      totalAccumulatedTokens,
      totalBMR,
      averageHourlyRate: totalMiners > 0 ? totalHourlyRate / totalMiners : 0,
      networkHashRate: totalHourlyRate * 24 * 365 // 연간 예상 발행량
    };
  }

  // 정리: 만료된 BMR 제거
  cleanupExpiredBMRs() {
    const currentTime = Date.now();
    let cleanedCount = 0;

    for (const [did, bmrList] of this.minerData) {
      const filteredBMRs = bmrList.filter(bmr => {
        const yearsSinceStart = (currentTime - bmr.startTime) / (1000 * 60 * 60 * 24 * 365);
        return yearsSinceStart < bmr.remainingYears;
      });

      if (filteredBMRs.length !== bmrList.length) {
        cleanedCount += bmrList.length - filteredBMRs.length;
        this.minerData.set(did, filteredBMRs);
      }
    }

    return {
      success: true,
      cleanedBMRs: cleanedCount,
      message: `${cleanedCount}개의 만료된 BMR이 정리되었습니다`
    };
  }
}

module.exports = MiningSystem; 