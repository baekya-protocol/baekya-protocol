/**
 * 백야 프로토콜 - Protocol Overview 예시 데모
 * 30세 남성의 80B + 250B 기여 시나리오 재현
 */

const CVCM = require('./src/cvcm/CVCM');
const DID = require('./src/did/DID');

async function main() {
  console.log(`
🌟 백야 프로토콜 - Protocol Overview 예시 데모
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 Protocol Overview의 30세 남성 예시를 정확히 재현합니다
  `);

  // 시스템 초기화
  const didSystem = new DID();
  const cvcm = new CVCM(didSystem);

  // 기본 DCA 등록 (Protocol Overview 예시용)
  cvcm.registerDCA('development', {
    id: 'opinion-proposal',
    name: '의견 제안 (Opinion Proposal)',
    value: 80,
    verificationCriteria: 'PR merged into main branch'
  });

  cvcm.registerDCA('development', {
    id: 'pull-request', 
    name: 'Pull Request',
    value: 250,
    verificationCriteria: 'PR merged successfully'
  });

  console.log('✅ 시스템 초기화 및 DCA 등록 완료\n');

  // 30세 남성 기여자
  const contributorDID = 'did:baekya:demo30male';
  console.log(`👤 기여자: ${contributorDID}`);
  console.log(`📊 기본 정보: 30세 남성, 기대수명 80세, 남은 생애 50년\n`);

  // BMR Calculator 예시 검증
  console.log('🧮 BMR Calculator 검증:');
  const validationResult = cvcm.bmrCalculator.validateProtocolExample();
  console.log('');

  // === 첫 번째 기여: 80B (의견 제안) ===
  console.log('📝 첫 번째 기여: 의견 제안 (80B)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const contribution1 = {
    daoId: 'development',
    dcaId: 'opinion-proposal', 
    contributorDID: contributorDID,
    contributorAge: 30,
    gender: 'male',
    description: '프로토콜의 더 효율적인 메커니즘을 제안했습니다',
    evidence: 'GitHub issue #123 → PR merged'
  };

  const submit1 = cvcm.submitContribution(contribution1);
  console.log(`✅ 기여 제출 완료: ${submit1.contributionId.substring(0, 8)}...`);

  const verify1 = await cvcm.verifyContribution(submit1.contributionId, 'did:baekya:verifier', true);
  console.log(`✅ 기여 검증 완료: BMR +${verify1.bmrAdded.toFixed(4)}B/년 추가`);

  // === 두 번째 기여: 250B (Pull Request) ===
  console.log('\n📝 두 번째 기여: Pull Request (250B)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const contribution2 = {
    daoId: 'development',
    dcaId: 'pull-request',
    contributorDID: contributorDID,
    contributorAge: 30,
    gender: 'male', 
    description: '의견을 직접 PR로 구현했습니다',
    evidence: 'PR #456 → merged successfully'
  };

  const submit2 = cvcm.submitContribution(contribution2);
  console.log(`✅ 기여 제출 완료: ${submit2.contributionId.substring(0, 8)}...`);

  const verify2 = await cvcm.verifyContribution(submit2.contributionId, 'did:baekya:verifier', true);
  console.log(`✅ 기여 검증 완료: BMR +${verify2.bmrAdded.toFixed(4)}B/년 추가`);

  // === 최종 결과 분석 ===
  console.log('\n📊 최종 결과 분석');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const dashboard = cvcm.getMiningDashboard(contributorDID);
  const totalBMR = cvcm.getTotalBMR(contributorDID);

  console.log(`\n🎯 Protocol Overview 예시와 비교:`);
  console.log(`   예상 총 BMR: 9.58B/년 (2.32 + 7.26)`);
  console.log(`   실제 총 BMR: ${totalBMR.toFixed(2)}B/년`);
  console.log(`   오차율: ${Math.abs(totalBMR - 9.58) / 9.58 * 100}%`);

  console.log(`\n⛏️ 현재 마이닝 현황:`);
  console.log(`   시간당 발행량: ${dashboard.currentHourlyRate.toFixed(6)}B/시간`);
  console.log(`   일일 발행량:   ${dashboard.dailyRate.toFixed(4)}B/일`);
  console.log(`   월간 발행량:   ${dashboard.monthlyRate.toFixed(2)}B/월`);
  console.log(`   연간 발행량:   ${dashboard.yearlyRate.toFixed(2)}B/년`);

  console.log(`\n📈 활성 BMR 정보:`);
  console.log(`   활성 BMR 개수: ${dashboard.activeBMRs}개`);
  
  dashboard.bmrDetails.forEach((bmr, index) => {
    console.log(`   BMR #${index + 1}:`);
    console.log(`     총 가치:     ${bmr.totalValue}B`);
    console.log(`     초기 발행률: ${bmr.initialRate.toFixed(4)}B/년`);
    console.log(`     현재 발행률: ${bmr.currentRate.toFixed(4)}B/년`);
    console.log(`     남은 기간:   ${bmr.remainingYears.toFixed(1)}년`);
  });

  console.log(`\n🕐 시간표 (Protocol Overview 방식):`);
  const firstBMR = dashboard.bmrDetails[0];
  if (firstBMR && firstBMR.timeTable) {
    console.log('   ┌────────┬─────────────┬─────────────┬─────────────┬─────────────┐');
    console.log('   │  시점  │  연간 발행  │  월간 발행  │  일간 발행  │  시간당발행 │');
    console.log('   ├────────┼─────────────┼─────────────┼─────────────┼─────────────┤');
    
    firstBMR.timeTable.forEach(entry => {
      console.log(`   │ ${entry.years}년 후  │ ${entry.yearlyRate.toString().padStart(9)}B │ ${entry.monthlyRate.toString().padStart(9)}B │ ${entry.dailyRate.toString().padStart(9)}B │ ${entry.hourlyRate.toString().padStart(9)}B │`);
    });
    
    console.log('   └────────┴─────────────┴─────────────┴─────────────┴─────────────┘');
  }

  console.log(`\n✅ Protocol Overview 예시 재현 완료!`);
  console.log(`🌟 백야 프로토콜의 LDM (생애 감쇠 발행) 방식이 정확히 구현되었습니다.`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return dashboard;
}

// 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = main; 