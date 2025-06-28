const DID = require('../DID');
const crypto = require('crypto');

describe('DID System', () => {
  let didInstance;

  beforeEach(() => {
    didInstance = new DID();
  });

  describe('DID 생성', () => {
    test('생체인증 데이터로 고유 DID 해시를 생성해야 함', () => {
      const biometricData = {
        fingerprint: 'mock_fingerprint_data_123',
        faceprint: 'mock_face_data_456'
      };

      const didHash = didInstance.generateDID(biometricData);
      
      expect(didHash).toBeDefined();
      expect(typeof didHash).toBe('string');
      expect(didHash.length).toBe(64); // SHA256 해시 길이
    });

    test('동일한 생체인증 데이터는 동일한 DID를 생성해야 함', () => {
      const biometricData = {
        fingerprint: 'same_fingerprint_data',
        faceprint: 'same_face_data'
      };

      const didHash1 = didInstance.generateDID(biometricData);
      const didHash2 = didInstance.generateDID(biometricData);
      
      expect(didHash1).toBe(didHash2);
    });

    test('다른 생체인증 데이터는 다른 DID를 생성해야 함', () => {
      const biometricData1 = {
        fingerprint: 'fingerprint_1',
        faceprint: 'face_1'
      };
      
      const biometricData2 = {
        fingerprint: 'fingerprint_2',
        faceprint: 'face_2'
      };

      const didHash1 = didInstance.generateDID(biometricData1);
      const didHash2 = didInstance.generateDID(biometricData2);
      
      expect(didHash1).not.toBe(didHash2);
    });
  });

  describe('지갑 기능', () => {
    test('DID에 B-token 잔액을 설정하고 조회할 수 있어야 함', () => {
      const didHash = 'test_did_hash';
      const amount = 1000;

      didInstance.setBTokenBalance(didHash, amount);
      const balance = didInstance.getBTokenBalance(didHash);
      
      expect(balance).toBe(amount);
    });

    test('DID에 P-token 잔액을 설정하고 조회할 수 있어야 함', () => {
      const didHash = 'test_did_hash';
      const amount = 50;

      didInstance.setPTokenBalance(didHash, amount);
      const balance = didInstance.getPTokenBalance(didHash);
      
      expect(balance).toBe(amount);
    });

    test('존재하지 않는 DID의 잔액은 0이어야 함', () => {
      const nonExistentDID = 'non_existent_did';
      
      const bTokenBalance = didInstance.getBTokenBalance(nonExistentDID);
      const pTokenBalance = didInstance.getPTokenBalance(nonExistentDID);
      
      expect(bTokenBalance).toBe(0);
      expect(pTokenBalance).toBe(0);
    });
  });

  describe('통신 주소 생성', () => {
    test('DID 해시로부터 전화번호 형태의 통신 주소를 생성해야 함', () => {
      const didHash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      const communicationAddress = didInstance.generateCommunicationAddress(didHash);
      
      expect(communicationAddress).toMatch(/^\d{3}-\d{4}-\d{4}$/);
    });

    test('동일한 DID 해시는 동일한 통신 주소를 생성해야 함', () => {
      const didHash = 'test_hash_for_communication';
      
      const address1 = didInstance.generateCommunicationAddress(didHash);
      const address2 = didInstance.generateCommunicationAddress(didHash);
      
      expect(address1).toBe(address2);
    });
  });

  describe('DID 검증', () => {
    test('유효한 DID 해시 형식을 검증해야 함', () => {
      const validDID = 'a'.repeat(64); // 64자 16진수 문자열
      const invalidDID1 = 'a'.repeat(63); // 너무 짧음
      const invalidDID2 = 'a'.repeat(65); // 너무 김
      const invalidDID3 = 'g'.repeat(64); // 잘못된 문자

      expect(didInstance.isValidDID(validDID)).toBe(true);
      expect(didInstance.isValidDID(invalidDID1)).toBe(false);
      expect(didInstance.isValidDID(invalidDID2)).toBe(false);
      expect(didInstance.isValidDID(invalidDID3)).toBe(false);
    });
  });
}); 