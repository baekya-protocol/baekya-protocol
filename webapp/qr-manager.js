/**
 * BROTHERHOOD QR 코드 관리 시스템
 * QR 생성, 스캔, 저장 기능 제공
 */

class QRManager {
  constructor() {
    this.isScanning = false;
    this.scanStream = null;
    this.scanModal = null;
    this.onScanResult = null;
  }

  /**
   * 지갑 주소로 QR 코드 생성
   */
  async generateAddressQR(address, size = 256) {
    try {
      // QRCode 라이브러리 로드 확인
      if (typeof QRCode === 'undefined') {
        await this.loadQRLibrary();
      }

      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, address, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return canvas.toDataURL();
    } catch (error) {
      console.error('❌ QR 코드 생성 실패:', error);
      throw error;
    }
  }

  /**
   * QR 코드 라이브러리 동적 로드
   */
  async loadQRLibrary() {
    return new Promise((resolve, reject) => {
      if (typeof QRCode !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * 지갑 주소 QR 코드 표시 모달
   */
  async showAddressQR(address, userName = '') {
    try {
      const qrDataURL = await this.generateAddressQR(address, 256);
      
      const modal = document.createElement('div');
      modal.className = 'modal active qr-modal';
      modal.innerHTML = `
        <div class="modal-content qr-content">
          <div class="modal-header">
            <h3><i class="fas fa-qrcode"></i> 내 지갑 주소 QR</h3>
            <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
          </div>
          <div class="modal-body qr-body">
            <div class="qr-info">
              <p><strong>${userName ? userName + '의' : ''} 지갑 주소</strong></p>
              <p class="wallet-address">${address}</p>
            </div>
            <div class="qr-display">
              <img src="${qrDataURL}" alt="지갑 주소 QR 코드" class="qr-image">
            </div>
            <div class="qr-actions">
              <button class="btn-primary" onclick="window.qrManager.saveQRToGallery('${qrDataURL}', '${address}')">
                <i class="fas fa-download"></i> 갤러리에 저장
              </button>
              <button class="btn-secondary" onclick="window.qrManager.shareQR('${qrDataURL}', '${address}')">
                <i class="fas fa-share"></i> 공유하기
              </button>
              <button class="btn-secondary" onclick="window.qrManager.copyAddress('${address}')">
                <i class="fas fa-copy"></i> 주소 복사
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      console.log('📱 지갑 주소 QR 코드 표시됨');
    } catch (error) {
      console.error('❌ QR 코드 표시 실패:', error);
      window.dapp?.showErrorMessage?.('QR 코드를 생성할 수 없습니다');
    }
  }

  /**
   * QR 스캔 모달 열기
   */
  async openQRScanner(onResult) {
    try {
      this.onScanResult = onResult;
      
      // APK 환경에서는 간단한 카메라 촬영
      if (window.Capacitor?.isNativePlatform()) {
        await this.simpleAPKQRScan();
        return;
      }
      
      // 웹 환경에서는 기존 방식 사용
      const hasPermission = await this.requestCameraPermission();
      if (!hasPermission) {
        window.dapp?.showErrorMessage?.('카메라 접근 권한이 필요합니다');
        return;
      }

      this.createScannerModal();
      await this.startCamera();
    } catch (error) {
      console.error('❌ QR 스캐너 시작 실패:', error);
      window.dapp?.showErrorMessage?.('QR 스캐너를 시작할 수 없습니다');
    }
  }

  /**
   * 카메라 권한 요청
   */
  async requestCameraPermission() {
    try {
      // Capacitor 환경에서 카메라 권한 요청
      if (window.Capacitor?.Plugins?.Camera) {
        const permissions = await window.Capacitor.Plugins.Camera.requestPermissions();
        return permissions.camera === 'granted';
      }

      // 웹 환경에서 카메라 권한 요청
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (error) {
        console.warn('카메라 권한 요청 실패:', error);
        return false;
      }
    } catch (error) {
      console.error('❌ 카메라 권한 확인 실패:', error);
      return false;
    }
  }

  /**
   * QR 스캐너 모달 생성
   */
  createScannerModal() {
    this.scanModal = document.createElement('div');
    this.scanModal.className = 'modal active qr-scanner-modal';
    this.scanModal.innerHTML = `
      <div class="modal-content scanner-content">
        <div class="modal-header scanner-header">
          <h3><i class="fas fa-camera"></i> QR 코드 스캔</h3>
          <button class="close-btn" onclick="window.qrManager.closeScan()">×</button>
        </div>
        <div class="modal-body scanner-body">
          <div class="scanner-container">
            <video id="qr-video" autoplay playsinline></video>
            <canvas id="qr-canvas" style="display: none;"></canvas>
            <div class="scan-overlay">
              <div class="scan-area">
                <div class="scan-corners">
                  <div class="corner top-left"></div>
                  <div class="corner top-right"></div>
                  <div class="corner bottom-left"></div>
                  <div class="corner bottom-right"></div>
                </div>
              </div>
            </div>
          </div>
          <div class="scanner-info">
            <p><i class="fas fa-info-circle"></i> QR 코드를 스캔 영역에 맞춰주세요</p>
            <div class="scanner-status">
              <span class="status-text">스캔 준비 중...</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.scanModal);
  }

  /**
   * 카메라 시작 및 QR 스캔
   */
  async startCamera() {
    try {
      const video = document.getElementById('qr-video');
      const canvas = document.getElementById('qr-canvas');
      const context = canvas.getContext('2d');

      // 카메라 스트림 시작
      this.scanStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // 후면 카메라 선호
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });

      video.srcObject = this.scanStream;
      this.isScanning = true;

      // 비디오 로드 후 스캔 시작
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        this.updateScannerStatus('QR 코드를 찾는 중...', 'scanning');
        this.scanLoop(video, canvas, context);
      };

    } catch (error) {
      console.error('❌ 카메라 시작 실패:', error);
      this.updateScannerStatus('카메라 접근 실패', 'error');
      window.dapp?.showErrorMessage?.('카메라에 접근할 수 없습니다');
    }
  }

  /**
   * QR 스캔 루프
   */
  scanLoop(video, canvas, context) {
    if (!this.isScanning) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // jsQR로 QR 코드 스캔
      if (typeof jsQR !== 'undefined') {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code && code.data) {
          this.handleScanResult(code.data);
          return;
        }
      }
    }

    requestAnimationFrame(() => this.scanLoop(video, canvas, context));
  }

  /**
   * QR 스캔 결과 처리
   */
  handleScanResult(data) {
    console.log('✅ QR 스캔 성공:', data);
    
    // 지갑 주소 형식 검증 (did:baekya: 또는 일반 주소)
    let address = data;
    if (data.startsWith('did:baekya:') || this.isValidAddress(data)) {
      this.updateScannerStatus('스캔 완료!', 'success');
      
      // 스캔 결과 콜백 실행
      if (this.onScanResult) {
        this.onScanResult(address);
      }
      
      // 1초 후 모달 닫기
      setTimeout(() => {
        this.closeScan();
      }, 1000);
    } else {
      this.updateScannerStatus('유효하지 않은 주소입니다', 'error');
      setTimeout(() => {
        this.updateScannerStatus('QR 코드를 다시 스캔해주세요', 'scanning');
      }, 2000);
    }
  }

  /**
   * 주소 유효성 검증
   */
  isValidAddress(address) {
    // 간단한 주소 형식 검증 (나중에 더 정교하게 구현 가능)
    return address && address.length > 10 && address.trim() !== '';
  }

  /**
   * 스캐너 상태 업데이트
   */
  updateScannerStatus(message, status = 'info') {
    const statusElement = this.scanModal?.querySelector('.status-text');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status-text status-${status}`;
    }
  }

  /**
   * QR 스캔 종료
   */
  closeScan() {
    this.isScanning = false;
    
    if (this.scanStream) {
      this.scanStream.getTracks().forEach(track => track.stop());
      this.scanStream = null;
    }
    
    if (this.scanModal) {
      this.scanModal.remove();
      this.scanModal = null;
    }
    
    this.onScanResult = null;
    console.log('📷 QR 스캔 종료');
  }

  /**
   * QR 코드 갤러리에 저장
   */
  async saveQRToGallery(dataURL, address) {
    try {
      if (window.Capacitor?.Plugins?.Filesystem) {
        // 모바일: Capacitor Filesystem 사용
        const { Filesystem, Directory } = window.Capacitor.Plugins;
        
        const fileName = `baekya-wallet-qr-${Date.now()}.png`;
        const base64Data = dataURL.split(',')[1];
        
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents
        });
        
        window.dapp?.showSuccessMessage?.('QR 코드가 갤러리에 저장되었습니다');
      } else {
        // 웹: 다운로드 링크 생성
        const link = document.createElement('a');
        link.download = `baekya-wallet-qr-${Date.now()}.png`;
        link.href = dataURL;
        link.click();
        
        window.dapp?.showSuccessMessage?.('QR 코드가 다운로드되었습니다');
      }
    } catch (error) {
      console.error('❌ QR 저장 실패:', error);
      window.dapp?.showErrorMessage?.('QR 코드 저장에 실패했습니다');
    }
  }

  /**
   * QR 코드 공유
   */
  async shareQR(dataURL, address) {
    try {
      if (window.Capacitor?.Plugins?.Share) {
        // 모바일: Capacitor Share 사용
        await window.Capacitor.Plugins.Share.share({
                          title: 'BROTHERHOOD 지갑 주소',
          text: `지갑 주소: ${address}`,
          url: dataURL
        });
      } else {
        // 웹: 클립보드에 주소 복사
        await navigator.clipboard.writeText(address);
        window.dapp?.showSuccessMessage?.('지갑 주소가 복사되었습니다');
      }
    } catch (error) {
      console.error('❌ QR 공유 실패:', error);
      window.dapp?.showErrorMessage?.('QR 코드 공유에 실패했습니다');
    }
  }

  /**
   * 주소 복사
   */
  async copyAddress(address) {
    try {
      await navigator.clipboard.writeText(address);
      window.dapp?.showSuccessMessage?.('지갑 주소가 복사되었습니다');
    } catch (error) {
      console.error('❌ 주소 복사 실패:', error);
      window.dapp?.showErrorMessage?.('주소 복사에 실패했습니다');
    }
  }

  /**
   * 간단한 APK QR 스캔
   */
  async simpleAPKQRScan() {
    try {
      console.log('📱 간단한 QR 스캔 시작');
      
      // 바로 카메라 촬영
      const Camera = window.Capacitor.Plugins.Camera;
      
      const image = await Camera.getPhoto({
        quality: 90,
        resultType: Camera.CameraResultType.DataUrl,
        source: Camera.CameraSource.Camera
      });

      // QR 분석
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code && code.data) {
          console.log('✅ QR 스캔 성공:', code.data);
          if (this.onScanResult) {
            this.onScanResult(code.data);
          }
          window.dapp?.showSuccessMessage?.('QR 코드 스캔 완료!');
        } else {
          window.dapp?.showErrorMessage?.('QR 코드를 찾을 수 없습니다');
        }
      };
      
      img.src = image.dataUrl;

    } catch (error) {
      console.error('❌ QR 스캔 실패:', error);
      if (error.message && error.message.includes('cancelled')) {
        console.log('사용자가 취소함');
      } else {
        window.dapp?.showErrorMessage?.('QR 스캔에 실패했습니다');
      }
    }
  }



  /**
   * APK용 QR 코드 저장 (Capacitor Share 사용)
   */
  async saveQRToGalleryAPK(canvas, fileName) {
    try {
      if (!window.Capacitor?.Plugins?.Share) {
        throw new Error('Capacitor Share 플러그인을 찾을 수 없습니다');
      }

      const Share = window.Capacitor.Plugins.Share;
      const dataUrl = canvas.toDataURL('image/png');
      
      await Share.share({
                        title: 'BROTHERHOOD QR 코드',
        text: '지갑 주소 QR 코드',
        url: dataUrl,
        dialogTitle: 'QR 코드 저장'
      });

      console.log('📱 APK QR 코드 공유 완료');
      window.dapp?.showSuccessMessage?.('QR 코드가 공유되었습니다');

    } catch (error) {
      console.error('❌ APK QR 코드 저장 실패:', error);
      window.dapp?.showErrorMessage?.('QR 코드 저장에 실패했습니다: ' + error.message);
    }
  }
}

// 전역 QR 매니저 인스턴스 생성
window.qrManager = new QRManager();

console.log('📱 QR 매니저 로드 완료');