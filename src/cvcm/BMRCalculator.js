/**
 * BMR (Baekya Mining Rate) Calculator
 * Protocol Overview의 LDM (Lifetime Decay Minting) 방식을 구현
 * 
 * 공식:
 * BMR(t) = A × e^(-k×t)
 * B_total = ∫[0 to R] A × e^(-k×t) dt
 * A = B_total × k / (1 - e^(-k×R))
 * 
 * 동적시간감쇠율: k = 4.605 / R (남은생애기간에 따라 동적으로 계산)
 * 이를 통해 남은생애기간의 마지막해에 BMR이 거의 0(1%)이 되도록 함
 */
class BMRCalculator {
  constructor() {
    // Protocol Overview 기본값
    this.DEFAULT_LIFE_EXPECTANCY = {
      male: 80,
      female: 85,
      default: 80
    };
    // 고정 감쇠율 제거 - 동적 계산 방식 사용
  }

  /**
   * 동적시간감쇠율 계산 (퍼블릭 폴더와 동일)
   * @param {number} remainingYears - 남은 기대수명
   * @returns {number} 감쇠율 k
   */
  calculateDecayRate(remainingYears) {
    // LDM 방식: 남은 기대수명의 마지막 해에 0이 되도록 감쇠율 계산
    // BMR(t) = A * e^(-kt)에서 BMR(R) ≈ 0이 되도록 k 설정
    // e^(-kR) ≈ 0.01 (1%로 근사)
    // -kR = ln(0.01) ≈ -4.605
    // k = 4.605 / R
    
    if (remainingYears <= 0) return 0;
    return 4.605 / remainingYears;
  }

  /**
   * LDM 방식으로 BMR 계산 (동적시간감쇠율 적용)
   * @param {Object} params - 계산 파라미터
   * @param {number} params.contributorAge - 기여자 나이
   * @param {number} params.dcaValue - DCA의 B-token 가치
   * @param {string} params.gender - 성별 ('male', 'female', 'default')
   * @param {number} params.lifeExpectancy - 기대수명 (선택적)
   * @returns {Object} BMR 계산 결과
   */
  calculateBMR(params) {
    const {
      contributorAge,
      dcaValue,
      gender = 'default',
      lifeExpectancy = this.DEFAULT_LIFE_EXPECTANCY[gender] || this.DEFAULT_LIFE_EXPECTANCY.default
    } = params;

    // 입력 검증
    if (!contributorAge || contributorAge < 0 || contributorAge > 120) {
      throw new Error('유효하지 않은 기여자 나이입니다');
    }
    if (!dcaValue || dcaValue <= 0) {
      throw new Error('유효하지 않은 DCA 가치입니다');
    }

    // 남은 기대 생애기간 계산
    const remainingLifetime = lifeExpectancy - contributorAge;
    
    if (remainingLifetime <= 0) {
      throw new Error(`기대 수명(${lifeExpectancy})이 현재 나이(${contributorAge})보다 작거나 같습니다`);
    }

    // 동적시간감쇠율 계산 (퍼블릭 폴더와 동일)
    const decayRate = this.calculateDecayRate(remainingLifetime);

    // LDM 공식 적용
    // B_total = ∫[0 to R] A × e^(-k×t) dt = A × (1 - e^(-k×R)) / k
    // 따라서 A = B_total × k / (1 - e^(-k×R))
    const expTerm = Math.exp(-decayRate * remainingLifetime);
    const denominator = 1 - expTerm;
    
    if (Math.abs(denominator) < 1e-10) {
      throw new Error('감쇠율 계산에 수치적 오류가 발생했습니다');
    }

    const initialRate = (dcaValue * decayRate) / denominator; // A 값

    // 시간대별 발행량 계산 (Protocol Overview 예시와 같이)
    const timeTable = this.generateTimeTable(initialRate, decayRate, remainingLifetime);

    return {
      initialRate, // A
      decayRate, // k (동적으로 계산됨)
      remainingLifetime, // R
      totalValue: dcaValue, // B_total
      contributorAge,
      lifeExpectancy,
      timeTable,
      // 실용적인 값들
      hourlyRate: initialRate / (365 * 24),
      dailyRate: initialRate / 365,
      monthlyRate: initialRate / 12,
      yearlyRate: initialRate
    };
  }

  /**
   * Protocol Overview와 동일한 시간표 생성
   * @param {number} A - 초기 발행량
   * @param {number} k - 감쇠율
   * @param {number} R - 남은 생애기간
   * @returns {Array} 시간표
   */
  generateTimeTable(A, k, R) {
    const timePoints = [0, 1, 5, 10, 25];
    if (R >= 50) timePoints.push(50);
    
    return timePoints.map(t => {
      if (t > R) return null;
      
      const yearlyRate = A * Math.exp(-k * t);
      return {
        years: t,
        yearlyRate: Math.round(yearlyRate * 100) / 100,
        monthlyRate: Math.round((yearlyRate / 12) * 1000) / 1000,
        dailyRate: Math.round((yearlyRate / 365) * 100000) / 100000,
        hourlyRate: Math.round((yearlyRate / (365 * 24)) * 1000000) / 1000000
      };
    }).filter(entry => entry !== null);
  }

  /**
   * 특정 시점의 BMR 계산
   * @param {Object} bmrData - calculateBMR 결과
   * @param {number} yearsElapsed - 경과 연수
   * @returns {number} 해당 시점의 연간 발행량
   */
  getBMRAtTime(bmrData, yearsElapsed) {
    if (yearsElapsed < 0) return 0;
    if (yearsElapsed > bmrData.remainingLifetime) return 0;
    
    return bmrData.initialRate * Math.exp(-bmrData.decayRate * yearsElapsed);
  }

  /**
   * 시간 구간 내 총 발행량 계산 (적분)
   * @param {Object} bmrData - calculateBMR 결과
   * @param {number} startYears - 시작 연수
   * @param {number} endYears - 종료 연수
   * @returns {number} 구간 내 총 발행량
   */
  getTokensInPeriod(bmrData, startYears, endYears) {
    if (startYears >= endYears) return 0;
    if (startYears >= bmrData.remainingLifetime) return 0;
    
    const actualEndYears = Math.min(endYears, bmrData.remainingLifetime);
    
    // ∫[t1, t2] A × e^(-k×t) dt = A × (e^(-k×t1) - e^(-k×t2)) / k
    const integral = bmrData.initialRate * 
      (Math.exp(-bmrData.decayRate * startYears) - Math.exp(-bmrData.decayRate * actualEndYears)) / 
      bmrData.decayRate;
    
    return Math.max(0, integral);
  }

  /**
   * 현재 시점부터 미래 기간 동안의 예상 수익
   * @param {Object} bmrData - calculateBMR 결과
   * @param {number} bmrStartTime - BMR 시작 시간 (timestamp)
   * @param {number} futureHours - 미래 시간 (시간 단위)
   * @returns {number} 예상 수익
   */
  getFutureEarnings(bmrData, bmrStartTime, futureHours) {
    const currentTime = Date.now();
    const yearsElapsed = (currentTime - bmrStartTime) / (1000 * 60 * 60 * 24 * 365);
    const futureYears = futureHours / (24 * 365);
    
    return this.getTokensInPeriod(bmrData, yearsElapsed, yearsElapsed + futureYears);
  }

  /**
   * Protocol Overview 예시와 동일한 시나리오 검증 (동적시간감쇠율 적용)
   */
  validateProtocolExample() {
    console.log('📊 Protocol Overview 예시 검증 (동적시간감쇠율):');
    
    // Protocol Overview 예시: 30세 남성, 80B 기여
    const contributorAge = 30;
    const gender = 'male';
    const lifeExpectancy = 80;
    const remainingYears = lifeExpectancy - contributorAge; // 50년
    
    console.log(`기여자: ${contributorAge}세 ${gender}, 남은 기대수명: ${remainingYears}년`);
    
    // 동적시간감쇠율 계산
    const dynamicDecayRate = this.calculateDecayRate(remainingYears);
    console.log(`동적시간감쇠율: ${(dynamicDecayRate * 100).toFixed(2)}%/년 (k = ${dynamicDecayRate.toFixed(4)})`);
    
    // 첫 번째 기여: 80B
    const example1 = this.calculateBMR({
      contributorAge: contributorAge,
      dcaValue: 80,
      gender: gender
    });

    console.log(`\n첫 번째 기여 (80B):`);
    console.log(`  초기 발행량: ${example1.initialRate.toFixed(2)}B/년`);
    console.log(`  적용된 감쇠율: ${(example1.decayRate * 100).toFixed(2)}%/년`);
    console.log('  시간표:');
    example1.timeTable.forEach(entry => {
      console.log(`    ${entry.years}년 후: ${entry.yearlyRate}B/년, ${entry.hourlyRate.toFixed(6)}B/시간`);
    });

    // 두 번째 기여: 250B
    const example2 = this.calculateBMR({
      contributorAge: contributorAge,
      dcaValue: 250,
      gender: gender
    });

    console.log(`\n두 번째 기여 (250B):`);
    console.log(`  초기 발행량: ${example2.initialRate.toFixed(2)}B/년`);
    console.log(`  적용된 감쇠율: ${(example2.decayRate * 100).toFixed(2)}%/년`);
    
    // 총 누적 (330B)
    const totalInitialRate = example1.initialRate + example2.initialRate;
    const totalHourlyRate = totalInitialRate / (365 * 24);
    
    console.log(`\n📈 총 누적 결과:`);
    console.log(`  총 기여가치: 330B (80B + 250B)`);
    console.log(`  총 초기 발행량: ${totalInitialRate.toFixed(2)}B/년`);
    console.log(`  현재 시간당 발행량: ${totalHourlyRate.toFixed(6)}B/시간`);
    console.log(`  일일 발행량: ${(totalInitialRate / 365).toFixed(4)}B/일`);
    console.log(`  월간 발행량: ${(totalInitialRate / 12).toFixed(2)}B/월`);
    
    // 시간별 감쇠 시뮬레이션 (총 합계)
    console.log(`\n⏰ 시간별 총 발행량 변화:`);
    const timePoints = [0, 1, 5, 10, 25, 50];
    timePoints.forEach(years => {
      if (years <= remainingYears) {
        const rate1 = this.getBMRAtTime(example1, years);
        const rate2 = this.getBMRAtTime(example2, years);
        const totalRate = rate1 + rate2;
        const hourlyRate = totalRate / (365 * 24);
        console.log(`  ${years}년 후: ${totalRate.toFixed(2)}B/년 (${hourlyRate.toFixed(6)}B/시간)`);
      }
    });
    
    // 마지막 해 확인 (거의 0에 가까워야 함)
    const finalRate1 = this.getBMRAtTime(example1, remainingYears);
    const finalRate2 = this.getBMRAtTime(example2, remainingYears);
    const finalTotalRate = finalRate1 + finalRate2;
    console.log(`\n🎯 ${remainingYears}년 후 (마지막 해): ${finalTotalRate.toFixed(6)}B/년 (거의 0에 수렴)`);
    
    return { 
      example1, 
      example2, 
      totalInitialRate,
      dynamicDecayRate,
      remainingYears,
      finalRate: finalTotalRate
    };
  }
}

module.exports = BMRCalculator; 