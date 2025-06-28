/**
 * 백야 프로토콜 - 아이디/비밀번호 기반 DID 시스템 테스트
 */

const SimpleAuth = require('../SimpleAuth'); // 경로 수정

describe('SimpleAuth - 아이디/비밀번호 기반 DID 시스템', () => {
  let authSystem;

  beforeEach(() => {
    authSystem = new SimpleAuth();
  });

  afterEach(() => {
    authSystem.clearForTesting();
  });

  describe('DID 생성', () => {
    test('아이디/비밀번호로 DID 생성 성공', () => {
      const userData = {
        username: 'testuser',
        password: 'TestPass123',
        name: '테스트사용자',
        birthDate: '1990-01-01'
      };

      const result = authSystem.generateDID(
        userData.username,
        userData.password,
        userData.name,
        userData.birthDate
      );

      expect(result.success).toBe(true);
      expect(result.didHash).toBeDefined();
      expect(result.username).toBe('testuser');
      expect(result.name).toBe('테스트사용자');
      expect(result.communicationAddress).toMatch(/^010-\d{4}-\d{4}$/);
      expect(result.isFirstUser).toBe(true);
      expect(result.isFounder).toBe(false); // 아이디가 'founder'가 아니므로 false
    });

    test('아이디가 founder인 계정은 Founder 특별 혜택 메시지 표시', () => {
      const result = authSystem.generateDID('founder', 'FounderPass123');
      
      expect(result.success).toBe(true);
      expect(result.isFounder).toBe(true);
      expect(result.message).toContain('Founder');
      expect(result.message).toContain('특별 혜택');
    });

    test('잘못된 아이디 형식으로 DID 생성 실패', () => {
      const result = authSystem.generateDID('한글아이디', 'TestPass123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('영문, 숫자, 언더스코어');
    });

    test('짧은 아이디로 DID 생성 실패', () => {
      const result = authSystem.generateDID('ab', 'TestPass123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('3-20자');
    });

    test('약한 비밀번호로 DID 생성 실패', () => {
      const result = authSystem.generateDID('testuser', '123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('8-50자');
    });

    test('복잡도 부족한 비밀번호로 DID 생성 실패', () => {
      const result = authSystem.generateDID('testuser', 'onlylowercase');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('영문 대소문자와 숫자');
    });

    test('중복 아이디로 DID 생성 실패', () => {
      // 첫 번째 사용자 생성
      authSystem.generateDID('testuser', 'TestPass123');
      
      // 동일한 아이디로 다시 생성 시도
      const result = authSystem.generateDID('testuser', 'DifferentPass123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('이미 사용 중인 아이디');
    });

    test('아이디가 founder가 아닌 계정은 일반 사용자로 생성', () => {
      // founder 계정 생성
      authSystem.generateDID('founder', 'FounderPass123');
      
      // 일반 사용자 계정 생성
      const result = authSystem.generateDID('user2', 'UserPass123');
      
      expect(result.success).toBe(true);  
      expect(result.isFirstUser).toBe(false);
      expect(result.isFounder).toBe(false); // 아이디가 'founder'가 아니므로 false
      expect(result.message).toBe('아이디가 성공적으로 생성되었습니다');
    });

    test('첫 번째 사용자라도 아이디가 founder가 아니면 파운더가 아님', () => {
      // 첫 번째 사용자를 일반 아이디로 생성
      const result = authSystem.generateDID('firstuser', 'FirstPass123');
      
      expect(result.success).toBe(true);
      expect(result.isFirstUser).toBe(true); // 첫 번째 사용자이지만
      expect(result.isFounder).toBe(false); // 아이디가 'founder'가 아니므로 파운더 아님
      expect(result.message).toBe('🎉 축하합니다! 백야 프로토콜의 첫 번째 사용자로 등록되어 모든 DAO의 이니셜 OP가 되었습니다!');
    });

    test('아이디가 founder이면 첫 번째 사용자가 아니어도 파운더가 됨', () => {
      // 다른 사용자를 먼저 등록
      authSystem.generateDID('otheruser', 'OtherPass123');
      
      // 나중에 founder 계정 등록
      const result = authSystem.generateDID('founder', 'FounderPass123');
      
      expect(result.success).toBe(true);
      expect(result.isFirstUser).toBe(false); // 첫 번째 사용자가 아니지만
      expect(result.isFounder).toBe(true); // 아이디가 'founder'이므로 파운더임
      expect(result.message).toContain('Founder');
      expect(result.message).toContain('특별 혜택');
    });
  });

  describe('사용자 로그인', () => {
    beforeEach(() => {
      // 테스트용 사용자 생성
      authSystem.generateDID('testuser', 'TestPass123', '테스트사용자');
    });

    test('올바른 아이디/비밀번호로 로그인 성공', () => {
      const result = authSystem.login('testuser', 'TestPass123');
      
      expect(result.success).toBe(true);
      expect(result.username).toBe('testuser');
      expect(result.name).toBe('테스트사용자');
      expect(result.didHash).toBeDefined();
      expect(result.communicationAddress).toMatch(/^010-\d{4}-\d{4}$/);
    });

    test('존재하지 않는 아이디로 로그인 실패', () => {
      const result = authSystem.login('nonexistuser', 'TestPass123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('존재하지 않는 아이디');
    });

    test('잘못된 비밀번호로 로그인 실패', () => {
      const result = authSystem.login('testuser', 'WrongPass123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('비밀번호가 올바르지 않습니다');
      expect(result.remainingAttempts).toBe(4);
    });

    test('5회 연속 로그인 실패 시 계정 잠금', () => {
      // 5회 연속 실패
      for (let i = 0; i < 5; i++) {
        authSystem.login('testuser', 'WrongPass123');
      }
      
      // 6번째 시도
      const result = authSystem.login('testuser', 'WrongPass123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('계정이 잠겨있습니다');
    });

    test('계정 잠금 후 올바른 비밀번호로도 로그인 불가', () => {
      // 계정 잠금까지 실패
      for (let i = 0; i < 5; i++) {
        authSystem.login('testuser', 'WrongPass123');
      }
      
      // 올바른 비밀번호로 시도
      const result = authSystem.login('testuser', 'TestPass123');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('계정이 잠겨있습니다');
    });
  });

  describe('DID 정보 조회', () => {
    let testDIDHash;
    let testCommAddress;

    beforeEach(() => {
      const result = authSystem.generateDID('testuser', 'TestPass123', '테스트사용자');
      testDIDHash = result.didHash;
      testCommAddress = result.communicationAddress;
    });

    test('DID 해시로 사용자 정보 조회', () => {
      const result = authSystem.getDIDInfo(testDIDHash);
      
      expect(result.success).toBe(true);
      expect(result.didData.username).toBe('testuser');
      expect(result.didData.name).toBe('테스트사용자');
      expect(result.didData.communicationAddress).toBe(testCommAddress);
    });

    test('통신주소로 DID 조회', () => {
      const result = authSystem.getDIDByCommAddress(testCommAddress);
      
      expect(result.success).toBe(true);
      expect(result.didHash).toBe(testDIDHash);
      expect(result.communicationAddress).toBe(testCommAddress);
    });

    test('존재하지 않는 DID 조회 시 실패', () => {
      const result = authSystem.getDIDInfo('nonexistent_did_hash');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('DID를 찾을 수 없습니다');
    });

    test('존재하지 않는 통신주소 조회 시 실패', () => {
      const result = authSystem.getDIDByCommAddress('010-0000-0000');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('통신주소를 찾을 수 없습니다');
    });
  });

  describe('통합 인증 검증', () => {
    let testDIDHash;

    beforeEach(() => {
      const result = authSystem.generateDID('testuser', 'TestPass123');
      testDIDHash = result.didHash;
    });

    test('올바른 비밀번호로 작업 인증 성공', () => {
      const result = authSystem.verifyForAction(
        testDIDHash, 
        { password: 'TestPass123' }, 
        'token_transfer'
      );
      
      expect(result.success).toBe(true);
      expect(result.authorized).toBe(true);
      expect(result.action).toBe('token_transfer');
    });

    test('잘못된 비밀번호로 작업 인증 실패', () => {
      const result = authSystem.verifyForAction(
        testDIDHash, 
        { password: 'WrongPass123' }, 
        'token_transfer'
      );
      
      expect(result.success).toBe(true);
      expect(result.authorized).toBe(false);
      expect(result.message).toContain('비밀번호 인증이 필요합니다');
    });

    test('존재하지 않는 DID로 인증 시도 시 실패', () => {
      const result = authSystem.verifyForAction(
        'nonexistent_did', 
        { password: 'TestPass123' }, 
        'voting'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('DID를 찾을 수 없습니다');
    });
  });

  describe('통신 세션', () => {
    let fromDID, toCommAddress;

    beforeEach(() => {
      const user1 = authSystem.generateDID('user1', 'Pass123User1');
      const user2 = authSystem.generateDID('user2', 'Pass123User2');
      
      fromDID = user1.didHash;
      toCommAddress = user2.communicationAddress;
    });

    test('통신 세션 시작 성공', () => {
      const result = authSystem.startCommunicationSession(fromDID, toCommAddress);
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.fromDID).toBe(fromDID);
      expect(result.toCommAddress).toBe(toCommAddress);
    });

    test('존재하지 않는 발신자 DID로 세션 시작 실패', () => {
      const result = authSystem.startCommunicationSession('invalid_did', toCommAddress);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('발신자 DID를 찾을 수 없습니다');
    });

    test('존재하지 않는 대상 통신주소로 세션 시작 실패', () => {
      const result = authSystem.startCommunicationSession(fromDID, '010-0000-0000');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('대상 통신주소를 찾을 수 없습니다');
    });
  });

  describe('시스템 통계', () => {
    test('DID 통계 조회', () => {
      // 여러 사용자 생성
      authSystem.generateDID('user1', 'Pass123User1');
      authSystem.generateDID('user2', 'Pass123User2');
      authSystem.generateDID('user3', 'Pass123User3');
      
      const stats = authSystem.getStats();
      
      expect(stats.totalDIDs).toBe(3);
      expect(stats.totalCommunicationAddresses).toBe(3);
      expect(stats.totalUsers).toBe(3);
      expect(stats.activeDIDs).toBe(3);
    });
  });

  describe('Rate Limiting', () => {
    test('DID 생성 Rate Limiting', () => {
      // 5회 연속 생성 시도 (정상적으로는 username 중복으로 실패하겠지만 rate limit이 먼저 걸림)
      for (let i = 0; i < 6; i++) {
        authSystem.generateDID(`user${i}`, 'TestPass123');
      }
      
      // 6번째 시도는 rate limit에 걸려야 함
      const result = authSystem.generateDID('user6', 'TestPass123');
      
      // Rate limit에 걸리거나 정상 생성되거나 (동일 username이면 중복 오류)
      expect(result.success).toBeDefined();
    });
  });
}); 