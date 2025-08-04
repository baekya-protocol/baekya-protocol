/**
 * BROTHERHOOD 디바이스 UUID 관리 시스템
 * 
 * 기능:
 * - 앱 설치 시 고유 UUID 생성
 * - UUID와 계정 연결 관리
 * - 1 UUID = 1 계정 원칙 강제
 * - 계정 일시정지/재활성화
 */

class DeviceUUIDManager {
  constructor() {
    this.deviceUUID = null;
    this.isInitialized = false;
    this.serverEndpoint = window.location.origin;
  }

  /**
   * UUID 매니저 초기화
   */
  async initialize() {
    try {
      // Capacitor 환경에서만 실제 디바이스 UUID 생성
      if (this.isCapacitorApp()) {
        await this.initializeCapacitorUUID();
      } else {
        // 웹 환경에서는 브라우저 기반 UUID 사용
        await this.initializeWebUUID();
      }
      
      this.isInitialized = true;
      console.log('🆔 Device UUID Manager 초기화 완료:', this.deviceUUID);
      
      return this.deviceUUID;
    } catch (error) {
      console.error('❌ UUID 매니저 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * Capacitor 앱 환경 확인
   */
  isCapacitorApp() {
    return window.Capacitor && window.Capacitor.isNativePlatform();
  }

  /**
   * Capacitor 환경에서 UUID 초기화
   */
  async initializeCapacitorUUID() {
    try {
      // 저장된 UUID 확인
      const { Preferences } = window.Capacitor.Plugins;
      const stored = await Preferences.get({ key: 'device_uuid' });
      
      if (stored.value) {
        this.deviceUUID = stored.value;
        console.log('📱 기존 디바이스 UUID 로드:', this.deviceUUID);
        return;
      }

      // 새 UUID 생성
      const { Device } = window.Capacitor.Plugins;
      const deviceInfo = await Device.getInfo();
      const deviceId = await Device.getId();
      
      // 디바이스 정보와 타임스탬프로 고유 UUID 생성
      const uniqueString = `${deviceInfo.platform}-${deviceInfo.model}-${deviceId.identifier || deviceId.uuid}-${Date.now()}`;
      this.deviceUUID = this.generateUUIDFromString(uniqueString);
      
      // UUID 저장
      await Preferences.set({
        key: 'device_uuid',
        value: this.deviceUUID
      });
      
      console.log('🆕 새 디바이스 UUID 생성:', this.deviceUUID);
      
      // 서버에 새 디바이스 등록
      await this.registerDeviceOnServer();
      
    } catch (error) {
      console.error('❌ Capacitor UUID 초기화 실패:', error);
      // 폴백: 랜덤 UUID 생성
      this.deviceUUID = this.generateRandomUUID();
      await Preferences.set({
        key: 'device_uuid', 
        value: this.deviceUUID
      });
    }
  }

  /**
   * 웹 환경에서 UUID 초기화
   */
  async initializeWebUUID() {
    try {
      // localStorage에서 기존 UUID 확인
      const stored = localStorage.getItem('baekya_device_uuid');
      
      if (stored) {
        this.deviceUUID = stored;
        console.log('🌐 기존 웹 UUID 로드:', this.deviceUUID);
        return;
      }

      // 새 UUID 생성 (브라우저 핑거프린트 기반)
      const fingerprint = await this.generateBrowserFingerprint();
      this.deviceUUID = this.generateUUIDFromString(fingerprint);
      
      // localStorage에 저장
      localStorage.setItem('baekya_device_uuid', this.deviceUUID);
      
      console.log('🆕 새 웹 UUID 생성:', this.deviceUUID);
      
      // 서버에 새 디바이스 등록
      await this.registerDeviceOnServer();
      
    } catch (error) {
      console.error('❌ 웹 UUID 초기화 실패:', error);
      // 폴백: 랜덤 UUID 생성
      this.deviceUUID = this.generateRandomUUID();
      localStorage.setItem('baekya_device_uuid', this.deviceUUID);
    }
  }

  /**
   * 브라우저 핑거프린트 생성
   */
  async generateBrowserFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
            ctx.fillText('BROTHERHOOD UUID', 2, 2);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
      Date.now()
    ].join('|');
    
    return fingerprint;
  }

  /**
   * 문자열로부터 UUID 생성
   */
  generateUUIDFromString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    
    // UUID 형식으로 변환
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `baekya-${hex}-${Date.now().toString(16)}-${Math.random().toString(16).substr(2, 8)}`;
  }

  /**
   * 랜덤 UUID 생성
   */
  generateRandomUUID() {
    return `baekya-${Date.now().toString(16)}-${Math.random().toString(16).substr(2, 8)}-${Math.random().toString(16).substr(2, 8)}`;
  }

  /**
   * 서버에 디바이스 등록
   */
  async registerDeviceOnServer() {
    try {
      const response = await fetch(`${this.serverEndpoint}/api/device/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceUUID: this.deviceUUID,
          platform: this.isCapacitorApp() ? 'mobile' : 'web',
          timestamp: Date.now()
        })
      });

      const result = await response.json();
      if (result.success) {
        console.log('✅ 디바이스 서버 등록 성공');
      } else {
        console.error('❌ 디바이스 서버 등록 실패:', result.error);
      }
    } catch (error) {
      console.error('❌ 디바이스 등록 요청 실패:', error);
    }
  }

  /**
   * 계정과 UUID 연결
   */
  async linkAccountToDevice(userDID) {
    if (!this.isInitialized) {
      throw new Error('UUID 매니저가 초기화되지 않았습니다');
    }

    try {
      const response = await fetch(`${this.serverEndpoint}/api/device/link-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceUUID: this.deviceUUID,
          userDID: userDID
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('🔗 계정-디바이스 연결 성공:', userDID);
        return true;
      } else {
        console.error('❌ 계정-디바이스 연결 실패:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ 계정 연결 요청 실패:', error);
      return false;
    }
  }

  /**
   * 디바이스 연결 상태 확인
   */
  async checkDeviceStatus() {
    if (!this.isInitialized) {
      return { isValid: false, error: 'UUID 매니저 미초기화' };
    }

    try {
      const response = await fetch(`${this.serverEndpoint}/api/device/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceUUID: this.deviceUUID
        })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('❌ 디바이스 상태 확인 실패:', error);
      return { isValid: false, error: '상태 확인 실패' };
    }
  }

  /**
   * 계정 일시정지
   */
  async suspendAccount(userDID) {
    try {
      const response = await fetch(`${this.serverEndpoint}/api/device/suspend-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceUUID: this.deviceUUID,
          userDID: userDID
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // 로컬 UUID 삭제
        await this.clearLocalUUID();
        console.log('⏸️ 계정 일시정지 완료');
        return true;
      } else {
        console.error('❌ 계정 일시정지 실패:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ 계정 일시정지 요청 실패:', error);
      return false;
    }
  }

  /**
   * 로컬 UUID 삭제
   */
  async clearLocalUUID() {
    try {
      if (this.isCapacitorApp()) {
        const { Preferences } = window.Capacitor.Plugins;
        await Preferences.remove({ key: 'device_uuid' });
      } else {
        localStorage.removeItem('baekya_device_uuid');
      }
      
      this.deviceUUID = null;
      this.isInitialized = false;
      console.log('🗑️ 로컬 UUID 삭제 완료');
    } catch (error) {
      console.error('❌ 로컬 UUID 삭제 실패:', error);
    }
  }

  /**
   * UUID 가져오기
   */
  getDeviceUUID() {
    return this.deviceUUID;
  }

  /**
   * 초기화 상태 확인
   */
  isReady() {
    return this.isInitialized && this.deviceUUID !== null;
  }


}

// 전역 인스턴스 생성
window.deviceUUIDManager = new DeviceUUIDManager();

// 즉시 초기화 시도 (APK 환경 대응)
(async () => {
  try {
    console.log('📱 Device UUID Manager 즉시 초기화 시작');
    await window.deviceUUIDManager.initialize();
    console.log('✅ UUID 매니저 즉시 초기화 성공');
  } catch (error) {
    console.error('❌ UUID 매니저 즉시 초기화 실패:', error);
  }
})();

// DOMContentLoaded 백업 초기화
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (!window.deviceUUIDManager.isReady()) {
      console.log('🔄 DOMContentLoaded에서 UUID 매니저 재시도');
      await window.deviceUUIDManager.initialize();
    }
  } catch (error) {
    console.error('❌ UUID 매니저 DOMContentLoaded 초기화 실패:', error);
  }
});

console.log('📱 Device UUID Manager 로드 완료');