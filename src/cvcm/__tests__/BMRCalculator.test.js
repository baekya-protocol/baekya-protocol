const BMRCalculator = require('../BMRCalculator');

describe('BMRCalculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = new BMRCalculator();
  });

  describe('기본 BMR 계산', () => {
    test('정상적인 BMR 계산', () => {
      const result = calculator.calculateBMR({
        contributorAge: 30,
        dcaValue: 100,
        gender: 'male'
      });

      expect(result).toHaveProperty('initialRate');
      expect(result).toHaveProperty('decayRate', 0.016);
      expect(result).toHaveProperty('remainingLifetime', 50);
      expect(result).toHaveProperty('totalValue', 100);
      expect(result.initialRate).toBeGreaterThan(0);
    });

    test('잘못된 나이 입력 시 에러', () => {
      expect(() => {
        calculator.calculateBMR({
          contributorAge: -5,
          dcaValue: 100
        });
      }).toThrow('유효하지 않은 기여자 나이입니다');

      expect(() => {
        calculator.calculateBMR({
          contributorAge: 150,
          dcaValue: 100
        });
      }).toThrow('유효하지 않은 기여자 나이입니다');
    });

    test('잘못된 DCA 가치 입력 시 에러', () => {
      expect(() => {
        calculator.calculateBMR({
          contributorAge: 30,
          dcaValue: -100
        });
      }).toThrow('유효하지 않은 DCA 가치입니다');

      expect(() => {
        calculator.calculateBMR({
          contributorAge: 30,
          dcaValue: 0
        });
      }).toThrow('유효하지 않은 DCA 가치입니다');
    });

    test('기대수명보다 나이가 높을 때 에러', () => {
      expect(() => {
        calculator.calculateBMR({
          contributorAge: 85,
          dcaValue: 100,
          gender: 'male' // 기대수명 80세
        });
      }).toThrow('기대 수명(80)이 현재 나이(85)보다 작거나 같습니다');
    });
  });

  describe('Protocol Overview 예시 검증', () => {
    test('30세 남성, 80B 기여 예시', () => {
      const result = calculator.calculateBMR({
        contributorAge: 30,
        dcaValue: 80,
        gender: 'male'
      });

      // Protocol Overview 예시와 비교
      // A = 80 * 0.016 / (1 - e^(-0.016 * 50)) ≈ 2.32
      expect(result.initialRate).toBeCloseTo(2.32, 1);
      expect(result.remainingLifetime).toBe(50);
      expect(result.totalValue).toBe(80);

      // 시간당 발행량 확인
      const expectedHourlyRate = result.initialRate / (365 * 24);
      expect(result.hourlyRate).toBeCloseTo(expectedHourlyRate, 6);
    });

    test('30세 남성, 250B 기여 예시', () => {
      const result = calculator.calculateBMR({
        contributorAge: 30,
        dcaValue: 250,
        gender: 'male'
      });

      // Protocol Overview 예시와 비교
      // A = 250 * 0.016 / (1 - e^(-0.016 * 50)) ≈ 7.26
      expect(result.initialRate).toBeCloseTo(7.26, 1);
      expect(result.totalValue).toBe(250);
    });

    test('시간표 생성 확인', () => {
      const result = calculator.calculateBMR({
        contributorAge: 30,
        dcaValue: 80,
        gender: 'male'
      });

      expect(result.timeTable).toHaveLength(6); // 0, 1, 5, 10, 25, 50년
      
      // t=0일 때 초기값과 일치
      const t0 = result.timeTable.find(entry => entry.years === 0);
      expect(t0.yearlyRate).toBeCloseTo(result.initialRate, 1);
      
      // t=1일 때 감쇠 확인
      const t1 = result.timeTable.find(entry => entry.years === 1);
      const expectedT1 = result.initialRate * Math.exp(-0.016 * 1);
      expect(t1.yearlyRate).toBeCloseTo(expectedT1, 1);
    });
  });

  describe('시간별 BMR 계산', () => {
    test('특정 시점의 BMR 계산', () => {
      const bmrData = calculator.calculateBMR({
        contributorAge: 30,
        dcaValue: 100,
        gender: 'male'
      });

      const bmrAt0 = calculator.getBMRAtTime(bmrData, 0);
      expect(bmrAt0).toBeCloseTo(bmrData.initialRate, 6);

      const bmrAt1 = calculator.getBMRAtTime(bmrData, 1);
      const expected = bmrData.initialRate * Math.exp(-0.016 * 1);
      expect(bmrAt1).toBeCloseTo(expected, 6);

      // 범위 밖은 0 반환
      const bmrAt100 = calculator.getBMRAtTime(bmrData, 100);
      expect(bmrAt100).toBe(0);
    });

    test('시간 구간 내 총 발행량 계산', () => {
      const bmrData = calculator.calculateBMR({
        contributorAge: 30,
        dcaValue: 100,
        gender: 'male'
      });

      // 전체 생애 기간 동안의 총 발행량은 dcaValue와 같아야 함
      const totalTokens = calculator.getTokensInPeriod(bmrData, 0, 50);
      expect(totalTokens).toBeCloseTo(100, 1);

      // 일부 구간
      const firstYearTokens = calculator.getTokensInPeriod(bmrData, 0, 1);
      expect(firstYearTokens).toBeGreaterThan(0);
      expect(firstYearTokens).toBeLessThan(100);
    });
  });

  describe('미래 수익 예측', () => {
    test('미래 수익 계산', () => {
      const bmrData = calculator.calculateBMR({
        contributorAge: 30,
        dcaValue: 100,
        gender: 'male'
      });

      const now = Date.now();
      const future24Hours = calculator.getFutureEarnings(bmrData, now, 24);
      
      expect(future24Hours).toBeGreaterThan(0);
      expect(future24Hours).toBeLessThan(100);
    });
  });

  describe('성별별 기대수명 차이', () => {
    test('남성 vs 여성 기대수명 차이', () => {
      const maleResult = calculator.calculateBMR({
        contributorAge: 30,
        dcaValue: 100,
        gender: 'male'
      });

      const femaleResult = calculator.calculateBMR({
        contributorAge: 30,
        dcaValue: 100,
        gender: 'female'
      });

      // 여성이 기대수명이 더 길므로 초기 발행률이 더 낮아야 함
      expect(femaleResult.remainingLifetime).toBeGreaterThan(maleResult.remainingLifetime);
      expect(femaleResult.initialRate).toBeLessThan(maleResult.initialRate);
    });
  });

  describe('Protocol Overview 검증 메서드', () => {
    test('예시 검증 실행', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const result = calculator.validateProtocolExample();
      
      expect(result).toHaveProperty('example1');
      expect(result).toHaveProperty('example2');
      expect(result).toHaveProperty('totalInitialRate');
      
      // 누적 BMR 확인
      const expectedTotal = result.example1.initialRate + result.example2.initialRate;
      expect(result.totalInitialRate).toBeCloseTo(expectedTotal, 6);
      
      consoleSpy.mockRestore();
    });
  });

  describe('수치적 안정성', () => {
    test('극단적인 감쇠율에서의 안정성', () => {
      expect(() => {
        calculator.calculateBMR({
          contributorAge: 30,
          dcaValue: 100,
          decayRate: 0.0001 // 매우 작은 감쇠율
        });
      }).not.toThrow();

      expect(() => {
        calculator.calculateBMR({
          contributorAge: 30,
          dcaValue: 100,
          decayRate: 1 // 큰 감쇠율
        });
      }).not.toThrow();
    });

    test('매우 나이가 많은 경우', () => {
      const result = calculator.calculateBMR({
        contributorAge: 78,
        dcaValue: 100,
        gender: 'male'
      });

      expect(result.remainingLifetime).toBe(2);
      expect(result.initialRate).toBeGreaterThan(0);
    });
  });
}); 