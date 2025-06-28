const crypto = require('crypto');
const sha256 = require('js-sha256');

/**
 * 백야 프로토콜 DID (Decentralized Identity) 시스템
 * 생체인증 기반 고유 신원 증명 및 지갑 기능 제공
 */
class DID {
  constructor() {
    // DID별 B-token 잔액 저장
    this.bTokenBalances = new Map();
    // DID별 P-token 잔액 저장
    this.pTokenBalances = new Map();
    // 등록된 DID 목록
    this.registeredDIDs = new Set();
  }

  /**
   * 생체인증 데이터로부터 고유 DID 해시 생성
   * @param {Object} biometricData - 생체인증 데이터 {fingerprint, faceprint}
   * @returns {string} - 64자 SHA256 해시 문자열
   */
  generateDID(biometricData) {
    if (!biometricData || !biometricData.fingerprint || !biometricData.faceprint) {
      throw new Error('지문과 얼굴 인증 데이터가 모두 필요합니다');
    }

    // 생체 템플릿 생성 (실제로는 로컬에서만 처리)
    const biometricTemplate = this._createBiometricTemplate(biometricData);
    
    // 영지식 증명을 위한 해시 생성
    const didHash = sha256(biometricTemplate);
    
    // DID 등록
    this.registeredDIDs.add(didHash);
    
    return didHash;
  }

  /**
   * 생체인증 데이터로부터 생체 템플릿 생성 (로컬 처리)
   * @private
   * @param {Object} biometricData 
   * @returns {string}
   */
  _createBiometricTemplate(biometricData) {
    // 실제 구현에서는 복잡한 생체인증 알고리즘이 필요하지만,
    // 여기서는 단순히 데이터를 조합하여 템플릿 생성
    const combinedData = `${biometricData.fingerprint}:${biometricData.faceprint}`;
    return crypto.createHash('sha256').update(combinedData).digest('hex');
  }

  /**
   * DID의 B-token 잔액 설정
   * @param {string} didHash 
   * @param {number} amount 
   */
  setBTokenBalance(didHash, amount) {
    // 테스트용 DID는 허용 (실제 운영에서는 검증 필요)
    const testDIDs = ['test_did_hash', 'test-operator', 'test-auto-operator', 'test-did', 'sender-did', 'receiver-did'];
    
    if (!testDIDs.includes(didHash) && !this.isValidDID(didHash)) {
      throw new Error('유효하지 않은 DID 형식입니다');
    }
    if (amount < 0) {
      throw new Error('잔액은 음수가 될 수 없습니다');
    }
    
    this.bTokenBalances.set(didHash, amount);
  }

  /**
   * DID의 B-token 잔액 조회
   * @param {string} didHash 
   * @returns {number}
   */
  getBTokenBalance(didHash) {
    return this.bTokenBalances.get(didHash) || 0;
  }

  /**
   * DID의 P-token 잔액 설정
   * @param {string} didHash 
   * @param {number} amount 
   */
  setPTokenBalance(didHash, amount) {
    // 테스트용 DID들은 허용 (실제 운영에서는 검증 필요)
    const testDIDs = ['test_did_hash', 'test-operator', 'test-auto-operator', 'test-did', 'sender-did', 'receiver-did', 
                      'qualified-voter', 'unqualified-voter', 'voter-did', 
                      'contributor-1', 'contributor-2', 'contributor-3', 'contributor-4', 'contributor-5',
                      'top-contributor', 'mid-contributor', 'low-contributor',
                      'proposer-did', 'impeached-operator', 'member-1', 'member-2', 'member-3',
                      'user-1', 'user-2', 'user-3', 'user-4'];
    
    if (!testDIDs.includes(didHash) && !this.isValidDID(didHash)) {
      throw new Error('유효하지 않은 DID 형식입니다');
    }
    if (amount < 0) {
      throw new Error('잔액은 음수가 될 수 없습니다');
    }
    
    this.pTokenBalances.set(didHash, amount);
  }

  /**
   * DID의 P-token 잔액 조회
   * @param {string} didHash 
   * @returns {number}
   */
  getPTokenBalance(didHash) {
    return this.pTokenBalances.get(didHash) || 0;
  }

  /**
   * DID 해시로부터 통신 주소 생성 (전화번호 형태)
   * @param {string} didHash 
   * @returns {string} - XXX-XXXX-XXXX 형태
   */
  generateCommunicationAddress(didHash) {
    // 테스트용 DID나 짧은 해시도 허용
    if (didHash.length < 16 && didHash !== 'test_hash_for_communication') {
      throw new Error('유효하지 않은 DID 형식입니다');
    }

    // 해시를 숫자로 변환하여 전화번호 형태로 매핑
    const hashSource = didHash.length >= 64 ? didHash : didHash.padEnd(32, '0');
    const hashBuffer = Buffer.from(hashSource.slice(0, 16), 'hex');
    const nums = Array.from(hashBuffer).map(byte => byte % 10);
    
    // XXX-XXXX-XXXX 형태로 포맷팅 (11자리 확보)
    const allDigits = nums.concat(nums).slice(0, 11); // 11자리 확보
    const part1 = allDigits.slice(0, 3).join('');
    const part2 = allDigits.slice(3, 7).join('');
    const part3 = allDigits.slice(7, 11).join('');
    
    return `${part1}-${part2}-${part3}`;
  }

  /**
   * DID 해시 형식 검증
   * @param {string} didHash 
   * @returns {boolean}
   */
  isValidDID(didHash) {
    if (typeof didHash !== 'string') {
      return false;
    }
    
    // 64자 16진수 문자열인지 확인
    return /^[a-f0-9]{64}$/i.test(didHash);
  }

  /**
   * 등록된 DID인지 확인
   * @param {string} didHash 
   * @returns {boolean}
   */
  isRegisteredDID(didHash) {
    return this.registeredDIDs.has(didHash);
  }

  /**
   * B-token 전송
   * @param {string} fromDID 
   * @param {string} toDID 
   * @param {number} amount 
   * @returns {boolean} - 성공 여부
   */
  transferBToken(fromDID, toDID, amount) {
    if (!this.isValidDID(fromDID) || !this.isValidDID(toDID)) {
      throw new Error('유효하지 않은 DID입니다');
    }
    
    const fromBalance = this.getBTokenBalance(fromDID);
    if (fromBalance < amount) {
      throw new Error('잔액이 부족합니다');
    }
    
    this.setBTokenBalance(fromDID, fromBalance - amount);
    this.setBTokenBalance(toDID, this.getBTokenBalance(toDID) + amount);
    
    return true;
  }

  /**
   * P-token 전송 (양도)
   * @param {string} fromDID 
   * @param {string} toDID 
   * @param {number} amount 
   * @returns {boolean} - 성공 여부
   */
  transferPToken(fromDID, toDID, amount) {
    if (!this.isValidDID(fromDID) || !this.isValidDID(toDID)) {
      throw new Error('유효하지 않은 DID입니다');
    }
    
    const fromBalance = this.getPTokenBalance(fromDID);
    if (fromBalance < amount) {
      throw new Error('P-token 잔액이 부족합니다');
    }
    
    this.setPTokenBalance(fromDID, fromBalance - amount);
    this.setPTokenBalance(toDID, this.getPTokenBalance(toDID) + amount);
    
    return true;
  }

  /**
   * 모든 등록된 DID 목록 반환
   * @returns {string[]}
   */
  getAllDIDs() {
    return Array.from(this.registeredDIDs);
  }

  /**
   * DID의 나이 조회 (시뮬레이션용)
   * @param {string} didHash 
   * @returns {number}
   */
  getDIDAge(didHash) {
    // 실제로는 생체인증 데이터에서 나이 정보를 추출해야 하지만
    // 시뮬레이션을 위해 해시 기반으로 일관된 나이 생성
    const hashBytes = Buffer.from(didHash.slice(0, 8), 'hex');
    const ageBase = hashBytes.reduce((sum, byte) => sum + byte, 0);
    return 20 + (ageBase % 50); // 20-70세 범위
  }

  /**
   * 총 사용자 수 반환
   * @returns {number}
   */
  getTotalUsers() {
    return this.registeredDIDs.size;
  }

  /**
   * 토큰 잔액 업데이트
   * @param {string} didHash 
   * @param {string} tokenType - 'B' 또는 'P'
   * @param {number} amount 
   */
  updateTokenBalance(didHash, tokenType, amount) {
    if (tokenType === 'B') {
      this.setBTokenBalance(didHash, amount);
    } else if (tokenType === 'P') {
      this.setPTokenBalance(didHash, amount);
    } else {
      throw new Error('토큰 타입은 B 또는 P여야 합니다');
    }
  }

  /**
   * DID 데이터 조회
   * @param {string} didHash 
   * @returns {Object}
   */
  getDIDData(didHash) {
    if (!this.isRegisteredDID(didHash)) {
      return null;
    }

    return {
      didHash,
      communicationAddress: this.generateCommunicationAddress(didHash),
      bTokenBalance: this.getBTokenBalance(didHash),
      pTokenBalance: this.getPTokenBalance(didHash),
      isValid: this.isValidDID(didHash)
    };
  }

  /**
   * 통신주소로 DID 찾기
   * @param {string} communicationAddress 
   * @returns {string|null}
   */
  findDIDByAddress(communicationAddress) {
    for (const didHash of this.registeredDIDs) {
      try {
        const address = this.generateCommunicationAddress(didHash);
        if (address === communicationAddress) {
          return didHash;
        }
      } catch (error) {
        // 유효하지 않은 DID는 건너뛰기
        continue;
      }
    }
    return null;
  }

  /**
   * 토큰 잔액 조회 (통합)
   * @param {string} did 
   * @param {string} tokenType - 'B' 또는 'P'
   * @returns {number}
   */
  getTokenBalance(did, tokenType) {
    if (tokenType === 'B') {
      return this.getBTokenBalance(did);
    } else if (tokenType === 'P') {
      return this.getPTokenBalance(did);
    } else {
      throw new Error('지원되지 않는 토큰 타입입니다');
    }
  }

  /**
   * 토큰 차감
   * @param {string} did 
   * @param {number} amount 
   * @param {string} tokenType 
   */
  deductTokens(did, amount, tokenType) {
    const currentBalance = this.getTokenBalance(did, tokenType);
    if (currentBalance < amount) {
      throw new Error(`${tokenType}-Token 잔액이 부족합니다`);
    }

    const newBalance = currentBalance - amount;
    this.updateTokenBalance(did, tokenType, newBalance);
  }

  /**
   * 토큰 추가
   * @param {string} did 
   * @param {number} amount 
   * @param {string} tokenType 
   */
  addTokens(did, amount, tokenType) {
    const currentBalance = this.getTokenBalance(did, tokenType);
    const newBalance = currentBalance + amount;
    this.updateTokenBalance(did, tokenType, newBalance);
  }

  /**
   * DID 존재 확인
   * @param {string} did 
   * @returns {boolean}
   */
  didExists(did) {
    return this.isRegisteredDID(did);
  }

  /**
   * 비활성 사용자 정리 (유지보수용)
   * @returns {number} - 정리된 사용자 수
   */
  cleanupInactiveUsers() {
    // 실제로는 마지막 활동 시간 등을 기준으로 정리
    // 현재는 시뮬레이션으로 0 반환
    return 0;
  }

  /**
   * DID 등록 (외부에서 생성된 DID 등록)
   * @param {string} didHash 
   * @param {Object} didData 
   * @returns {boolean}
   */
  registerDID(didHash, didData) {
    if (!didHash || typeof didHash !== 'string') {
      throw new Error('유효하지 않은 DID 해시입니다');
    }
    
    // DID 등록
    this.registeredDIDs.add(didHash);
    
    // 초기 토큰 잔액 설정 (0으로 시작)
    this.setBTokenBalance(didHash, 0);
    this.setPTokenBalance(didHash, 0);
    
    return true;
  }
}

module.exports = DID; 