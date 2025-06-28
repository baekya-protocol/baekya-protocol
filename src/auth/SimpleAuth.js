/**
 * 백야 프로토콜 - 간단한 아이디/비밀번호 기반 DID 시스템
 * 아이디와 비밀번호를 통한 고유 DID 생성 및 통신주소 할당
 */

const crypto = require('crypto');

class SimpleAuth {
  constructor() {
    this.didRegistry = new Map(); // DID 레지스트리
    this.communicationRegistry = new Map(); // 통신주소 레지스트리
    this.userCredentials = new Map(); // 사용자 인증 정보 저장소
    this.rateLimiter = new Map(); // Rate limiting for security
  }

  /**
   * 아이디/비밀번호 기반 DID 생성
   * @param {string} username - 사용자 아이디
   * @param {string} password - 비밀번호
   * @param {string} name - 실제 이름 (선택사항)
   * @param {string} birthDate - 생년월일 (선택사항)
   * @returns {Object} DID 생성 결과
   */
  generateDID(username, password, name = '', birthDate = '') {
    try {
      // Rate limiting 체크
      if (!this.checkRateLimit('generateDID')) {
        throw new Error('요청이 너무 빈번합니다. 잠시 후 다시 시도하세요.');
      }

      // 1. 사용자 데이터 검증
      this.validateUserData(username, password);

      // 2. 중복 아이디 확인
      if (this.isUsernameTaken(username)) {
        throw new Error('이미 사용 중인 아이디입니다');
      }

      // 3. DID 해시 생성
      const didHash = this.createDIDHash(username, password);

      // 4. 통신주소 생성 (USIM 2.0)
      const communicationAddress = this.generateCommunicationAddress(didHash);

      // 5. 파운더 계정인지 확인 (아이디가 'founder'인 경우)
      const isFirstUser = this.didRegistry.size === 0;
      const isFounder = username === 'founder';
      const isInitialOP = isFounder;  // founder는 자동으로 이니셜 OP가 됨

      // 6. 비밀번호 해시 생성
      const passwordHash = this.hashPassword(password);

      // 7. DID 등록
      const didData = {
        didHash,
        username,
        name: name || username,
        birthDate,
        communicationAddress,
        createdAt: Date.now(),
        status: 'active',
        isFirstUser: isFirstUser,
        isInitialOP: isInitialOP,
        isFounder: isFounder,
        lastAuthTime: null,
        authAttempts: 0,
        locked: false
      };

      // 8. 사용자 인증 정보 저장
      this.userCredentials.set(username, {
        passwordHash,
        didHash,
        createdAt: Date.now()
      });

      this.didRegistry.set(didHash, didData);
      this.communicationRegistry.set(communicationAddress, didHash);

      console.log(`🆔 새로운 DID 생성: ${didHash.substring(0, 16)}... (사용자: ${username})`);
      console.log(`📞 통신주소 할당: ${communicationAddress}`);
      
      if (isFounder) {
        console.log(`👑 Founder 계정 등록! 특별 혜택이 부여됩니다.`);
      }

      return {
        success: true,
        didHash,
        username,
        name: didData.name,
        communicationAddress,
        isFirstUser,
        isInitialOP: isInitialOP,
        isFounder: isFounder,
        message: isFounder ? 
          '🎉 축하합니다! 백야 프로토콜의 Founder로 등록되어 특별 혜택(모든 DAO P-토큰 30개씩, B-토큰 30B)을 받았습니다!' :
          isFirstUser ? 
          '🎉 축하합니다! 백야 프로토콜의 첫 번째 사용자로 등록되어 모든 DAO의 이니셜 OP가 되었습니다!' :
          '아이디가 성공적으로 생성되었습니다'
      };

    } catch (error) {
      console.error('❌ DID 생성 실패:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 사용자 로그인
   * @param {string} username - 사용자 아이디
   * @param {string} password - 비밀번호
   * @returns {Object} 로그인 결과
   */
  login(username, password) {
    try {
      // Rate limiting
      if (!this.checkRateLimit(`login_${username}`, 10, 300000)) {
        return { 
          success: false, 
          error: '로그인 시도가 너무 빈번합니다. 잠시 후 다시 시도하세요.' 
        };
      }

      const credentials = this.userCredentials.get(username);
      if (!credentials) {
        return { success: false, error: '존재하지 않는 아이디입니다' };
      }

      const didData = this.didRegistry.get(credentials.didHash);
      if (!didData) {
        return { success: false, error: 'DID 정보를 찾을 수 없습니다' };
      }

      // 계정 잠금 확인
      if (didData.locked) {
        return { 
          success: false, 
          error: '계정이 잠겨있습니다. 관리자에게 문의하세요.' 
        };
      }

      // 비밀번호 검증
      const isValidPassword = this.verifyPassword(password, credentials.passwordHash);
      
      // 로그인 시도 기록
      didData.authAttempts = isValidPassword ? 0 : (didData.authAttempts || 0) + 1;
      didData.lastAuthTime = Date.now();

      // 5회 실패시 계정 잠금
      if (didData.authAttempts >= 5) {
        didData.locked = true;
        console.log(`🔒 계정 잠금: ${username} (5회 실패)`);
        return { 
          success: false, 
          error: '너무 많은 로그인 실패로 계정이 잠겼습니다.' 
        };
      }

      if (!isValidPassword) {
        return { 
          success: false, 
          remainingAttempts: (5 - didData.authAttempts),
          error: `비밀번호가 올바르지 않습니다 (남은 시도: ${5 - didData.authAttempts}회)`
        };
      }

      return { 
        success: true, 
        didHash: didData.didHash,
        username: didData.username,
        name: didData.name,
        communicationAddress: didData.communicationAddress,
        isFounder: didData.isFounder,
        message: '로그인되었습니다'
      };

    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 사용자 데이터 검증
   * @private
   */
  validateUserData(username, password) {
    if (!username || !password) {
      throw new Error('아이디와 비밀번호가 모두 필요합니다');
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new Error('잘못된 데이터 형식입니다');
    }

    // 아이디 길이 및 형식 검증
    if (username.length < 3 || username.length > 20) {
      throw new Error('아이디는 3-20자 이내로 입력하세요');
    }

    // 아이디 형식 검증 (영문, 숫자, 언더스코어만 허용)
    const usernamePattern = /^[a-zA-Z0-9_]+$/;
    if (!usernamePattern.test(username)) {
      throw new Error('아이디는 영문, 숫자, 언더스코어(_)만 사용 가능합니다');
    }

    // 비밀번호 길이 검증
    if (password.length < 8 || password.length > 50) {
      throw new Error('비밀번호는 8-50자 이내로 입력하세요');
    }

    // 비밀번호 복잡도 검증
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      throw new Error('비밀번호는 영문 대소문자와 숫자를 모두 포함해야 합니다');
    }
  }

  /**
   * 중복 아이디 확인
   * @private
   */
  isUsernameTaken(username) {
    return this.userCredentials.has(username);
  }

  /**
   * 비밀번호 해시 생성
   * @private
   */
  hashPassword(password) {
    const salt = crypto.randomBytes(32).toString('hex');
    const iterations = 100000;
    const keyLength = 64;
    
    const hash = crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha512').toString('hex');
    
    return {
      hash,
      salt,
      iterations,
      keyLength
    };
  }

  /**
   * 비밀번호 검증
   * @private
   */
  verifyPassword(password, storedHash) {
    try {
      const hash = crypto.pbkdf2Sync(
        password, 
        storedHash.salt, 
        storedHash.iterations, 
        storedHash.keyLength, 
        'sha512'
      ).toString('hex');
      
      return hash === storedHash.hash;
    } catch (error) {
      return false;
    }
  }

  /**
   * DID 해시 생성
   * @private
   */
  createDIDHash(username, password) {
    const timestamp = Date.now();
    const entropy = crypto.randomBytes(32).toString('hex');
    
    const combinedData = {
      username,
      passwordHash: crypto.createHash('sha256').update(password).digest('hex'),
      timestamp,
      entropy,
      version: '2.0_simple'
    };

    return crypto.createHash('sha512')
      .update(JSON.stringify(combinedData))
      .digest('hex')
      .substring(0, 64);
  }

  /**
   * USIM 2.0 통신주소 생성
   * @private
   */
  generateCommunicationAddress(didHash) {
    const hash = crypto.createHash('sha256').update(didHash + Date.now()).digest('hex');
    
    const part1 = parseInt(hash.substring(0, 8), 16) % 9000 + 1000;
    const part2 = parseInt(hash.substring(8, 16), 16) % 9000 + 1000;
    
    const commAddress = `010-${part1}-${part2}`;
    
    let attempts = 0;
    let finalAddress = commAddress;
    
    while (this.communicationRegistry.has(finalAddress) && attempts < 100) {
      const newHash = crypto.createHash('sha256')
        .update(didHash + Date.now() + attempts)
        .digest('hex');
      const newPart1 = parseInt(newHash.substring(0, 8), 16) % 9000 + 1000;
      const newPart2 = parseInt(newHash.substring(8, 16), 16) % 9000 + 1000;
      finalAddress = `010-${newPart1}-${newPart2}`;
      attempts++;
    }
    
    if (attempts >= 100) {
      throw new Error('통신주소 생성 실패: 너무 많은 중복');
    }
    
    return finalAddress;
  }

  /**
   * Rate limiting 체크
   * @private
   */
  checkRateLimit(action, maxAttempts = 5, windowMs = 60000) {
    const now = Date.now();
    const key = `${action}_rate_limit`;
    
    if (!this.rateLimiter.has(key)) {
      this.rateLimiter.set(key, { attempts: 1, windowStart: now });
      return true;
    }
    
    const rateData = this.rateLimiter.get(key);
    
    if (now - rateData.windowStart > windowMs) {
      this.rateLimiter.set(key, { attempts: 1, windowStart: now });
      return true;
    }
    
    if (rateData.attempts >= maxAttempts) {
      return false;
    }
    
    rateData.attempts++;
    return true;
  }

  /**
   * DID로 사용자 정보 조회
   */
  getDIDInfo(didHash) {
    const didData = this.didRegistry.get(didHash);
    if (!didData) {
      return { success: false, error: 'DID를 찾을 수 없습니다' };
    }

    return {
      success: true,
      didData: {
        didHash: didData.didHash,
        username: didData.username,
        name: didData.name,
        communicationAddress: didData.communicationAddress,
        createdAt: didData.createdAt,
        status: didData.status
      }
    };
  }

  /**
   * 통신주소로 DID 조회
   */
  getDIDByCommAddress(commAddress) {
    const didHash = this.communicationRegistry.get(commAddress);
    if (!didHash) {
      return { success: false, error: '통신주소를 찾을 수 없습니다' };
    }

    return {
      success: true,
      didHash,
      communicationAddress: commAddress
    };
  }

  /**
   * 통신주소로 DID 찾기 (index.js에서 사용)
   */
  findDIDByAddress(communicationAddress) {
    const result = this.getDIDByCommAddress(communicationAddress);
    if (result.success) {
      const userData = this.didRegistry.get(result.didHash);
      return {
        success: true,
        didHash: result.didHash,
        userData
      };
    }
    return result;
  }

  /**
   * 노드 운영자용 DID 생성 (통신주소 기반)
   */
  generateNodeOperatorDID(communicationAddress, additionalInfo = {}) {
    try {
      // 통신주소 검증
      const phoneRegex = /^010-\d{4}-\d{4}$/;
      if (!phoneRegex.test(communicationAddress)) {
        return {
          success: false,
          error: '유효하지 않은 통신주소 형식입니다 (010-XXXX-XXXX)'
        };
      }

      // 이미 등록된 통신주소인지 확인
      const existingResult = this.findDIDByAddress(communicationAddress);
      if (existingResult.success) {
        return {
          success: true,
          didHash: existingResult.didHash,
          isExisting: true,
          message: '이미 등록된 통신주소입니다'
        };
      }

      // 고유 식별자 생성
      const addressId = communicationAddress.replace(/-/g, '');
      const timestamp = Date.now();
      const username = `node_${addressId}`;
      const tempPassword = `node${addressId}${timestamp}`;

      // DID 생성
      const result = this.generateDID(
        username,
        tempPassword,
        additionalInfo.name || `Node Operator ${communicationAddress}`,
        additionalInfo.birthDate || null
      );

      if (result.success) {
        // 사용자 데이터에 노드 운영자 정보 추가
        const userData = this.didRegistry.get(result.didHash);
        userData.nodeOperator = true;
        userData.nodeInfo = {
          registeredAt: timestamp,
          nodeType: additionalInfo.nodeType || 'full_node',
          ...additionalInfo
        };

        // 통신주소 재매핑 (생성된 통신주소를 입력받은 통신주소로 교체)
        this.communicationRegistry.delete(result.communicationAddress);
        this.communicationRegistry.set(communicationAddress, result.didHash);
        userData.communicationAddress = communicationAddress;

        return {
          success: true,
          didHash: result.didHash,
          communicationAddress,
          username,
          password: tempPassword,
          isExisting: false,
          message: '노드 운영자 DID가 성공적으로 생성되었습니다'
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 통합 인증 검증
   */
  verifyForAction(didHash, authData, action) {
    try {
      const didData = this.didRegistry.get(didHash);
      if (!didData) {
        return { success: false, error: 'DID를 찾을 수 없습니다' };
      }

      // 비밀번호로 인증
      if (authData.password) {
        const credentials = this.userCredentials.get(didData.username);
        if (credentials && this.verifyPassword(authData.password, credentials.passwordHash)) {
          return {
            success: true,
            authorized: true,
            action,
            message: `${action} 작업이 인증되었습니다`
          };
        }
      }

      return {
        success: true,
        authorized: false,
        action,
        message: `${action} 작업을 위해 비밀번호 인증이 필요합니다`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 통신 세션 시작
   */
  startCommunicationSession(fromDID, toCommAddress, messageType = 'text') {
    const fromData = this.didRegistry.get(fromDID);
    const toDID = this.communicationRegistry.get(toCommAddress);
    
    if (!fromData) {
      return { success: false, error: '발신자 DID를 찾을 수 없습니다' };
    }
    
    if (!toDID) {
      return { success: false, error: '대상 통신주소를 찾을 수 없습니다' };
    }

    const sessionId = crypto.randomBytes(16).toString('hex');

    console.log(`📞 통신 세션 시작: ${fromData.communicationAddress} -> ${toCommAddress}`);

    return {
      success: true,
      sessionId,
      fromDID,
      toCommAddress,
      message: '통신 세션이 시작되었습니다'
    };
  }

  /**
   * DID 통계
   */
  getStats() {
    return {
      totalDIDs: this.didRegistry.size,
      totalCommunicationAddresses: this.communicationRegistry.size,
      totalUsers: this.userCredentials.size,
      activeDIDs: Array.from(this.didRegistry.values())
        .filter(did => did.status === 'active').length
    };
  }

  /**
   * DID 상태 업데이트
   */
  updateDIDStatus(didHash, status) {
    const didData = this.didRegistry.get(didHash);
    if (!didData) {
      return { success: false, error: 'DID를 찾을 수 없습니다' };
    }

    didData.status = status;
    didData.updatedAt = Date.now();

    return {
      success: true,
      message: `DID 상태가 ${status}로 업데이트되었습니다`
    };
  }

  /**
   * 테스트용 초기화
   */
  clearForTesting() {
    this.didRegistry.clear();
    this.communicationRegistry.clear();
    this.userCredentials.clear();
    this.rateLimiter.clear();
    console.log('🧪 SimpleAuth 테스트용 초기화 완료');
  }

  /**
   * 아이디로 DID 조회
   * @param {string} username - 찾을 아이디
   * @returns {Object} { success: boolean, didHash?: string, user?: Object, error?: string }
   */
  getDIDByUsername(username) {
    try {
      // 모든 사용자 중에서 해당 아이디 찾기
      for (const [didHash, user] of this.didRegistry.entries()) {
        if (user.username === username) {
          return {
            success: true,
            didHash: didHash,
            user: user
          };
        }
      }
      
      return {
        success: false,
        error: '해당 아이디의 사용자를 찾을 수 없습니다'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SimpleAuth; 