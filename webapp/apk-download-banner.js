/**
 * APK 다운로드 배너 관리
 */

class APKDownloadBanner {
  constructor() {
    this.isVisible = false;
    this.bannerId = 'apk-download-banner';
    this.init();
  }

  init() {
    // Capacitor 앱에서는 배너 표시하지 않음
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      return;
    }
    
    // 페이지 로드 시 배너 생성
    this.createBanner();
    
    // 모바일 기기에서는 자동으로 배너 표시
    if (this.isMobileDevice()) {
      setTimeout(() => {
        this.showBanner();
      }, 2000);
    }
  }

  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  createBanner() {
    const banner = document.createElement('div');
    banner.id = this.bannerId;
    banner.className = 'apk-download-banner hidden';
    
    banner.innerHTML = `
      <div class="banner-content">
        <div class="banner-info">
          <div class="app-icon">
            <i class="fas fa-mobile-alt"></i>
          </div>
          <div class="banner-text">
                            <h3>📱 BROTHERHOOD 앱 다운로드</h3>
            <p>더 나은 모바일 경험을 위해 앱을 설치하세요</p>
          </div>
        </div>
        <div class="banner-actions">
          <button class="download-btn" onclick="window.apkBanner.downloadAPK()">
            <i class="fas fa-download"></i>
            APK 다운로드
          </button>
          <button class="guide-btn" onclick="window.apkBanner.showInstallGuide()">
            <i class="fas fa-question-circle"></i>
            설치방법
          </button>
          <button class="close-btn" onclick="window.apkBanner.closeBanner()">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
    
    // body의 맨 위에 삽입
    document.body.insertBefore(banner, document.body.firstChild);
  }

  showBanner() {
    const banner = document.getElementById(this.bannerId);
    if (banner) {
      banner.classList.remove('hidden');
      banner.classList.add('visible');
      this.isVisible = true;
      
      // 기존 페이지 콘텐츠를 아래로 밀어내기
      document.body.style.paddingTop = '80px';
    }
  }

  hideBanner() {
    const banner = document.getElementById(this.bannerId);
    if (banner) {
      banner.classList.remove('visible');
      banner.classList.add('hidden');
      this.isVisible = false;
      
      // 페이지 패딩 복원
      document.body.style.paddingTop = '0';
    }
  }

  closeBanner() {
    this.hideBanner();
    
    // 24시간 동안 배너 숨김
    localStorage.setItem('apk_banner_closed', Date.now());
  }

  shouldShowBanner() {
    const closedTime = localStorage.getItem('apk_banner_closed');
    if (closedTime) {
      const oneDayInMs = 24 * 60 * 60 * 1000;
      return (Date.now() - parseInt(closedTime)) > oneDayInMs;
    }
    return true;
  }

  downloadAPK() {
    // APK 다운로드 처리
    const apkUrl = this.getAPKDownloadURL();
    
    if (apkUrl) {
      // 다운로드 링크 생성
      const downloadLink = document.createElement('a');
      downloadLink.href = apkUrl;
      downloadLink.download = 'baekya-protocol.apk';
      downloadLink.style.display = 'none';
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      // 다운로드 성공 메시지
      this.showDownloadMessage();
      
      // 통계 기록
      this.recordDownload();
    } else {
      // APK 준비 중 메시지
      this.showPreparingMessage();
    }
  }

  getAPKDownloadURL() {
    // 빌드된 APK의 URL을 반환
    // GitHub Releases, Firebase App Distribution, 또는 직접 호스팅
    return '/downloads/brotherhood-latest.apk';
  }

  showInstallGuide() {
    // 설치 가이드 새 창으로 열기
    window.open('/downloads/apk-install-guide.html', '_blank');
  }

  showDownloadMessage() {
    // 모달 생성
    const modal = document.createElement('div');
    modal.className = 'modal active download-success-modal';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📱 다운로드 시작됨</h3>
        </div>
        <div class="modal-body">
          <div class="download-success-content">
            <div class="success-icon">
              <i class="fas fa-check-circle"></i>
            </div>
                            <h4>BROTHERHOOD APK 다운로드</h4>
            <p>APK 파일 다운로드가 시작되었습니다.</p>
            
            <div class="install-instructions">
              <h5>설치 방법:</h5>
              <ol>
                <li>다운로드된 APK 파일을 탭하세요</li>
                <li>"알 수 없는 앱 설치" 권한을 허용하세요</li>
                <li>설치 과정을 완료하세요</li>
                <li>앱을 열고 기존 계정으로 로그인하세요</li>
              </ol>
            </div>
            
            <div class="security-note">
              <i class="fas fa-shield-alt"></i>
                              <small>이 APK는 공식 BROTHERHOOD 팀에서 배포하는 안전한 파일입니다.</small>
            </div>
          </div>
          
          <div class="modal-actions">
            <button class="btn-primary" onclick="this.closest('.modal').remove()">확인</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 5초 후 자동 닫기
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 10000);
  }

  showPreparingMessage() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>🔧 APK 준비 중</h3>
        </div>
        <div class="modal-body">
          <div class="preparing-content">
            <div class="loading-spinner">
              <i class="fas fa-cog fa-spin"></i>
            </div>
            <h4>APK 파일 준비 중입니다</h4>
            <p>최신 버전의 APK를 준비하고 있습니다.<br>잠시만 기다려주세요...</p>
            
            <div class="progress-info">
              <p><strong>현재 진행상황:</strong></p>
              <ul>
                <li>✅ 웹앱 → 모바일 앱 변환</li>
                <li>✅ UUID 시스템 통합</li>
                <li>🔄 APK 빌드 및 서명</li>
                <li>⏳ 다운로드 준비</li>
              </ul>
            </div>
          </div>
          
          <div class="modal-actions">
            <button class="btn-secondary" onclick="this.closest('.modal').remove()">나중에</button>
            <button class="btn-primary" onclick="window.apkBanner.checkBuildStatus()">상태 확인</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  checkBuildStatus() {
    // 빌드 상태 확인 (실제로는 서버 API 호출)
    fetch('/api/apk-build-status')
      .then(response => response.json())
      .then(data => {
        if (data.ready) {
          window.location.reload(); // 준비되면 페이지 새로고침
        } else {
          alert(`빌드 진행률: ${data.progress}%\n예상 완료 시간: ${data.estimatedTime}`);
        }
      })
      .catch(() => {
        alert('빌드 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요.');
      });
  }

  recordDownload() {
    // 다운로드 통계 기록
    fetch('/api/apk-download-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        referrer: document.referrer
      })
    }).catch(error => {
      console.log('다운로드 통계 기록 실패:', error);
    });
  }

  // 수동으로 배너 표시/숨김
  toggleBanner() {
    if (this.isVisible) {
      this.hideBanner();
    } else {
      this.showBanner();
    }
  }
}

// 전역 인스턴스 생성
window.apkBanner = new APKDownloadBanner();

console.log('📱 APK 다운로드 배너 시스템 로드 완료');