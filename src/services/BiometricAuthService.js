import ReactNativeBiometrics from 'react-native-biometrics';
import { Alert } from 'react-native';

/**
 * 백야 프로토콜 생체인증 서비스
 * 지문인식, 얼굴인식을 통한 고유 DID 생성
 */
class BiometricAuthService {
  constructor() {
    this.rnBiometrics = new ReactNativeBiometrics();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      const { available, biometryType } = await this.rnBiometrics.isSensorAvailable();
      
      if (available) {
        console.log('🔐 생체인증 센서 감지:', biometryType);
        this.biometryType = biometryType;
        this.isInitialized = true;
        return { success: true, biometryType };
      } else {
        console.log('❌ 생체인증 센서 없음');
        return { success: false, error: '생체인증 센서가 없습니다' };
      }
    } catch (error) {
      console.error('생체인증 초기화 실패:', error);
      return { success: false, error: error.message };
    }
  }

  async createKeys() {
    try {
      const { success, publicKey } = await this.rnBiometrics.createKeys();
      
      if (success) {
        console.log('🔑 생체인증 키 생성 완료');
        return { success: true, publicKey };
      } else {
        return { success: false, error: '키 생성 실패' };
      }
    } catch (error) {
      console.error('키 생성 오류:', error);
      return { success: false, error: error.message };
    }
  }

  async authenticate(promptMessage = '백야 프로토콜 인증') {
    try {
      const { success, signature } = await this.rnBiometrics.createSignature({
        promptMessage,
        payload: Date.now().toString(),
      });

      if (success) {
        console.log('✅ 생체인증 성공');
        return { 
          success: true, 
          signature,
          timestamp: Date.now(),
          biometryType: this.biometryType
        };
      } else {
        return { success: false, error: '인증 실패' };
      }
    } catch (error) {
      console.error('생체인증 오류:', error);
      return { success: false, error: error.message };
    }
  }

  async generateDID() {
    try {
      // 1. 생체인증 실행
      const authResult = await this.authenticate('DID 생성을 위한 생체인증');
      
      if (!authResult.success) {
        return authResult;
      }

      // 2. 생체 데이터로 고유 DID 생성
      const biometricHash = await this.createBiometricHash(authResult.signature);
      const didHash = `did:baekya:${biometricHash.substring(0, 32)}`;

      // 3. 통신주소 생성 (전화번호 형태)
      const communicationAddress = this.generateCommunicationAddress();

      return {
        success: true,
        did: didHash,
        communicationAddress,
        biometryType: authResult.biometryType,
        createdAt: Date.now()
      };
    } catch (error) {
      console.error('DID 생성 실패:', error);
      return { success: false, error: error.message };
    }
  }

  async createBiometricHash(signature) {
    // 생체 서명을 해시화하여 고유 식별자 생성
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(signature).digest('hex');
  }

  generateCommunicationAddress() {
    // 010-XXXX-XXXX 형태의 고유 통신주소 생성
    const prefix = '010';
    const middle = Math.floor(Math.random() * 9000 + 1000);
    const suffix = Math.floor(Math.random() * 9000 + 1000);
    return `${prefix}-${middle}-${suffix}`;
  }

  getBiometryTypeString() {
    switch (this.biometryType) {
      case 'TouchID':
        return '지문인식 (Touch ID)';
      case 'FaceID':
        return '얼굴인식 (Face ID)';
      case 'Biometrics':
        return '생체인식';
      default:
        return '알 수 없음';
    }
  }
}

export default BiometricAuthService; 