// 백야 프로토콜 인터랙티브 데모
const BaekyaProtocol = require('./src/index');
const readline = require('readline');

class ProtocolDemo {
  constructor() {
    this.protocol = new BaekyaProtocol();
    this.currentUser = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('\n🌅 백야 프로토콜 인터랙티브 데모에 오신 것을 환영합니다!');
    console.log('━'.repeat(60));
    
    await this.showMainMenu();
  }

  async showMainMenu() {
    console.log('\n📋 메인 메뉴:');
    console.log('1. 👤 사용자 등록 (DID 생성)');
    console.log('2. 📝 기여 제출하기');
    console.log('3. ✅ 기여 검증하기 (운영자)');
    console.log('4. 🏛️ DAO 정보 확인');
    console.log('5. 🗳️ 제안 생성하기');
    console.log('6. 💰 내 토큰 잔액 확인');
    console.log('7. 📊 프로토콜 전체 상태');
    console.log('8. 🎯 P-token 발행 시뮬레이션');
    console.log('9. 🚪 종료');
    
    const choice = await this.question('\n선택하세요 (1-9): ');
    await this.handleMainMenuChoice(choice);
  }

  async handleMainMenuChoice(choice) {
    switch(choice) {
      case '1':
        await this.registerUser();
        break;
      case '2':
        await this.submitContribution();
        break;
      case '3':
        await this.verifyContribution();
        break;
      case '4':
        await this.showDAOInfo();
        break;
      case '5':
        await this.createProposal();
        break;
      case '6':
        await this.checkTokenBalance();
        break;
      case '7':
        await this.showProtocolStatus();
        break;
      case '8':
        await this.simulatePTokenMinting();
        break;
      case '9':
        console.log('\n👋 백야 프로토콜 데모를 종료합니다. 감사합니다!');
        this.rl.close();
        return;
      default:
        console.log('❌ 잘못된 선택입니다.');
    }
    
    await this.showMainMenu();
  }

  async registerUser() {
    console.log('\n🆔 새로운 사용자 등록');
    console.log('━'.repeat(30));
    
    const name = await this.question('사용자 이름: ');
    const age = await this.question('나이: ');
    
    // 시뮬레이션된 생체인증 데이터
    const biometricData = {
      fingerprint: `fp_${name}_${Date.now()}`,
      faceprint: `face_${name}_${Date.now()}`
    };
    
    const result = this.protocol.registerUser(biometricData);
    
    if (result.success) {
      this.currentUser = {
        ...result,
        name,
        age: parseInt(age)
      };
      
      console.log(`✅ ${name}님이 성공적으로 등록되었습니다!`);
      console.log(`🆔 DID: ${result.didHash.slice(0, 16)}...`);
      console.log(`📞 통신 주소: ${result.communicationAddress.slice(0, 16)}...`);
      console.log(`💰 B-token: ${result.bTokenBalance} B`);
      console.log(`🗳️ P-token: ${result.pTokenBalance} P`);
    } else {
      console.log(`❌ 등록 실패: ${result.error}`);
    }
  }

  async submitContribution() {
    if (!this.currentUser) {
      console.log('❌ 먼저 사용자 등록을 해주세요.');
      return;
    }

    console.log('\n📝 기여 제출');
    console.log('━'.repeat(20));
    
    // 사용 가능한 DAO 목록 표시
    const allDAOs = Array.from(this.protocol.daoSystem.daos.values());
    console.log('\n사용 가능한 DAO:');
    allDAOs.forEach((dao, index) => {
      console.log(`${index + 1}. ${dao.name} - ${dao.purpose}`);
    });
    
    const daoChoice = await this.question('DAO 선택 (번호): ');
    const selectedDAO = allDAOs[parseInt(daoChoice) - 1];
    
    if (!selectedDAO) {
      console.log('❌ 잘못된 DAO 선택입니다.');
      return;
    }

    console.log('\n사용 가능한 DCA:');
    console.log('1. Pull Request (250 B)');
    console.log('2. 코드 리뷰 (100 B)');
    console.log('3. 버그 리포트 (150 B)');
    console.log('4. 의견 제안 (80 B)');
    
    const dcaChoice = await this.question('DCA 선택 (번호): ');
    const dcaMap = {
      '1': { id: 'pull-request', name: 'Pull Request', value: 250 },
      '2': { id: 'code-review', name: '코드 리뷰', value: 100 },
      '3': { id: 'bug-report', name: '버그 리포트', value: 150 },
      '4': { id: 'opinion-proposal', name: '의견 제안', value: 80 }
    };
    
    const selectedDCA = dcaMap[dcaChoice];
    if (!selectedDCA) {
      console.log('❌ 잘못된 DCA 선택입니다.');
      return;
    }

    const title = await this.question('기여 제목: ');
    const description = await this.question('기여 설명: ');
    
    const contributionData = {
      daoId: selectedDAO.id,
      dcaId: selectedDCA.id,
      title,
      description,
      contributorDID: this.currentUser.didHash,
      contributorAge: this.currentUser.age,
      evidence: `https://github.com/baekya-protocol/demo-${Date.now()}`
    };
    
    const result = this.protocol.submitContribution(contributionData);
    console.log(`✅ ${result.message}`);
    console.log(`📋 기여 ID: ${result.contributionId}`);
  }

  async verifyContribution() {
    console.log('\n✅ 기여 검증 (운영자 권한)');
    console.log('━'.repeat(30));
    
    // 검증 대기 중인 기여 목록 (시뮬레이션)
    const pendingContributions = Array.from(this.protocol.cvcmSystem.contributions.values())
      .filter(c => !this.protocol.cvcmSystem.verifications.has(c.id));
    
    if (pendingContributions.length === 0) {
      console.log('📭 검증 대기 중인 기여가 없습니다.');
      return;
    }
    
    console.log('\n검증 대기 중인 기여:');
    pendingContributions.forEach((contribution, index) => {
      console.log(`${index + 1}. ${contribution.title} (${contribution.dcaId})`);
    });
    
    const choice = await this.question('검증할 기여 선택 (번호): ');
    const selectedContribution = pendingContributions[parseInt(choice) - 1];
    
    if (!selectedContribution) {
      console.log('❌ 잘못된 선택입니다.');
      return;
    }
    
    const approval = await this.question('승인하시겠습니까? (y/n): ');
    const verified = approval.toLowerCase() === 'y';
    const reason = verified ? '기여 조건 충족' : '기여 조건 미충족';
    
    // 시뮬레이션된 운영자 DID 사용
    const verifierDID = Array.from(this.protocol.daoSystem.daos.values())[0].operatorDID;
    
    const result = this.protocol.verifyContribution(
      selectedContribution.id, 
      verifierDID, 
      verified, 
      reason
    );
    
    console.log(verified ? '✅ 기여가 승인되었습니다!' : '❌ 기여가 거부되었습니다.');
    
    if (verified) {
      console.log('💰 토큰이 발행되었습니다!');
    }
  }

  async showDAOInfo() {
    console.log('\n🏛️ DAO 정보');
    console.log('━'.repeat(20));
    
    const allDAOs = Array.from(this.protocol.daoSystem.daos.values());
    
    allDAOs.forEach(dao => {
      const members = this.protocol.daoSystem.getDAOMembers(dao.id);
      console.log(`\n📋 ${dao.name}`);
      console.log(`   목적: ${dao.purpose}`);
      console.log(`   설명: ${dao.description}`);
      console.log(`   구성원: ${members.length}명`);
      console.log(`   운영자: ${dao.operatorDID.slice(0, 8)}...`);
      console.log(`   상태: ${dao.status}`);
    });
  }

  async createProposal() {
    if (!this.currentUser) {
      console.log('❌ 먼저 사용자 등록을 해주세요.');
      return;
    }

    console.log('\n🗳️ 제안 생성');
    console.log('━'.repeat(20));
    
    // 사용 가능한 DAO 목록
    const allDAOs = Array.from(this.protocol.daoSystem.daos.values());
    console.log('\nDAO 목록:');
    allDAOs.forEach((dao, index) => {
      console.log(`${index + 1}. ${dao.name}`);
    });
    
    const daoChoice = await this.question('DAO 선택 (번호): ');
    const selectedDAO = allDAOs[parseInt(daoChoice) - 1];
    
    if (!selectedDAO) {
      console.log('❌ 잘못된 DAO 선택입니다.');
      return;
    }
    
    // 먼저 구성원으로 추가
    this.protocol.daoSystem.addContributor(selectedDAO.id, this.currentUser.didHash);
    
    const title = await this.question('제안 제목: ');
    const description = await this.question('제안 설명: ');
    
    const proposalData = {
      title,
      description,
      type: 'general'
    };
    
    const result = this.protocol.createProposal(selectedDAO.id, this.currentUser.didHash, proposalData);
    
    if (result.success) {
      console.log('✅ 제안이 생성되었습니다!');
      console.log(`📋 제안 ID: ${result.proposalId}`);
      console.log(`📊 상태: ${result.proposal.status}`);
    } else {
      console.log(`❌ 제안 생성 실패: ${result.error}`);
    }
  }

  async checkTokenBalance() {
    if (!this.currentUser) {
      console.log('❌ 먼저 사용자 등록을 해주세요.');
      return;
    }

    console.log('\n💰 토큰 잔액');
    console.log('━'.repeat(20));
    
    const dashboard = this.protocol.getUserDashboard(this.currentUser.didHash);
    
    console.log(`👤 사용자: ${this.currentUser.name}`);
    console.log(`🆔 DID: ${this.currentUser.didHash.slice(0, 16)}...`);
    console.log(`💰 B-token: ${dashboard.balances.bToken} B`);
    console.log(`🗳️ P-token: ${dashboard.balances.pToken} P`);
    console.log(`📊 총 BMR: ${dashboard.mining.totalBMR} B`);
    console.log(`⏰ 시간당 마이닝: ${dashboard.mining.hourlyRate} B/h`);
    console.log(`🗳️ 투표권: ${dashboard.votingPower} P`);
    console.log(`✅ 투표 자격: ${dashboard.isQualifiedVoter ? '있음' : '없음'}`);
  }

  async showProtocolStatus() {
    console.log('\n📊 프로토콜 전체 상태');
    console.log('━'.repeat(30));
    
    const status = this.protocol.getProtocolStatus();
    
    console.log(`🌅 백야 프로토콜 v${status.version}`);
    console.log(`📈 상태: ${status.status}`);
    console.log(`🏛️ 총 DAO 수: ${status.network.totalDAOs}`);
    console.log(`👥 총 구성원 수: ${status.network.totalMembers}`);
    console.log(`🗳️ P-token 총 공급량: ${status.network.totalPTokenSupply} P`);
    console.log(`💰 B-token 총량: ${status.network.totalBTokens} B`);
    
    console.log('\n🏛️ DAO 목록:');
    status.daos.forEach(dao => {
      console.log(`   • ${dao.name}: ${dao.memberCount}명`);
    });
  }

  async simulatePTokenMinting() {
    console.log('\n🎯 P-token 발행 시뮬레이션');
    console.log('━'.repeat(35));
    
    // 시뮬레이션된 기여자들
    const contributors = [
      { did: 'contributor-1', contribution: 500 },
      { did: 'contributor-2', contribution: 300 },
      { did: 'contributor-3', contribution: 200 },
      { did: 'contributor-4', contribution: 100 },
      { did: 'contributor-5', contribution: 80 }
    ];
    
    const config = {
      minGuarantee: 5,
      medianValue: 25,
      totalContributors: 5
    };
    
    console.log('📈 CAPM 방식 P-token 발행 시뮬레이션:');
    console.log(`   최소 보장: ${config.minGuarantee} P`);
    console.log(`   중간값: ${config.medianValue} P`);
    console.log(`   총 기여자: ${config.totalContributors}명`);
    
    const result = this.protocol.pTokenSystem.calculateCAPM(contributors, config);
    
    console.log(`\n💰 총 발행량: ${result.totalPTokens} P`);
    console.log(`📊 등차수열 공차: ${result.commonDifference.toFixed(2)}`);
    console.log('\n🏆 기여자별 P-token 분배:');
    
    result.distributions.forEach((dist, index) => {
      console.log(`   ${index + 1}등: ${dist.amount} P (기여도: ${dist.contribution})`);
    });
  }

  question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }
}

// 데모 시작
const demo = new ProtocolDemo();
demo.start().catch(console.error);

module.exports = ProtocolDemo; 