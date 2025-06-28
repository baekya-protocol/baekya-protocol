// 통신주소 정보 모달 표시
window.dapp.showCommunicationAddressModal = function() {
    if (!this.isAuthenticated || !this.currentUser) {
      this.showErrorMessage('로그인 후 이용 가능합니다.');
      return;
    }

    const canChange = this.canChangeCommunicationAddress();
    const daysLeft = this.getDaysUntilCommunicationAddressChange();
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'communicationAddressModal';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3><i class="fas fa-phone"></i> 통신주소 정보</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="comm-address-info" style="background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); padding: 1.5rem; border-radius: 12px; margin-bottom: 1rem;">
            <h4 style="color: var(--text-primary); margin-bottom: 1rem; font-size: 1.1rem;">현재 통신주소</h4>
            <div class="current-address" style="font-size: 1.5rem; font-weight: 600; color: var(--primary-color); text-align: center; padding: 1rem; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
              ${this.currentUser.communicationAddress || '미설정'}
            </div>
          </div>
          
          <div class="comm-address-status" style="background: #f0f9ff; padding: 1rem; border-radius: 8px; border: 1px solid #bae6fd;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <i class="fas fa-info-circle" style="color: #0284c7;"></i>
              <span style="font-weight: 600; color: #0369a1;">통신주소 변경 정책</span>
            </div>
            ${canChange ? 
              `<p style="color: #059669; margin: 0;">✓ 통신주소를 변경할 수 있습니다.</p>` :
              `<p style="color: #6b7280; margin: 0;">통신주소는 3개월에 한 번만 변경 가능합니다.<br><span style="color: #9ca3af; font-size: 0.875rem;">${daysLeft}일 후에 변경 가능</span></p>`
            }
          </div>
          
          <div class="comm-address-actions" style="margin-top: 1.5rem;">
            ${canChange ? 
              `<button class="btn-primary" onclick="window.dapp.showChangeCommAddressModal()" style="width: 100%;">
                <i class="fas fa-edit"></i> 통신주소 변경
              </button>` :
              `<button class="btn-secondary" disabled style="width: 100%; opacity: 0.5; cursor: not-allowed;">
                <i class="fas fa-lock"></i> ${daysLeft}일 후 변경 가능
              </button>`
            }
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
};

// QR 다운로드 함수 개선
window.dapp.downloadQR = function() {
    const canvas = document.getElementById('qrCanvas');
    const qrContainer = canvas ? canvas.parentElement : null;
    
    // QRCode.js로 생성된 canvas 또는 img 찾기
    const qrCanvas = qrContainer ? qrContainer.querySelector('.qr-code-generated canvas') : null;
    const qrImg = qrContainer ? qrContainer.querySelector('.qr-code-generated img') : null;
    
    let dataURL = null;
    
    if (qrCanvas) {
      // QRCode.js canvas에서 데이터 가져오기
      dataURL = qrCanvas.toDataURL('image/png');
    } else if (qrImg) {
      // QRCode.js img를 canvas로 변환
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 150;
      tempCanvas.height = 150;
      const ctx = tempCanvas.getContext('2d');
      
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 150, 150);
        dataURL = tempCanvas.toDataURL('image/png');
        this.performDownload(dataURL);
      };
      img.src = qrImg.src;
      return; // 비동기 처리를 위해 여기서 종료
    } else if (canvas && canvas.style.display !== 'none') {
      // 폴백: 원래 canvas 사용
      dataURL = canvas.toDataURL('image/png');
    } else {
      this.showErrorMessage('QR 코드를 찾을 수 없습니다.');
      return;
    }
    
    if (dataURL) {
      this.performDownload(dataURL);
    }
};

// 실제 다운로드 수행 함수
window.dapp.performDownload = function(dataURL) {
    // 다운로드 링크 생성
    const link = document.createElement('a');
    link.download = `baekya-qr-${Date.now()}.png`;
    link.href = dataURL;
    
    // 모바일 환경 처리
    if (navigator.userAgent.match(/Android|iPhone|iPad|iPod/i)) {
      // 모바일에서는 새 창에서 이미지 열기
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>QR 코드 저장</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f3f4f6;">
              <div style="text-align: center; padding: 20px;">
                <img src="${dataURL}" style="max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <p style="margin-top: 20px; color: #4b5563;">이미지를 길게 눌러 저장하세요</p>
              </div>
            </body>
          </html>
        `);
      }
    } else {
      // 데스크톱에서는 직접 다운로드
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    this.showSuccessMessage('QR 코드가 생성되었습니다.');
};

// QR 스캔 함수 개선 - 권한 요청 개선
window.dapp.scanQRCode = function() {
    // 카메라 지원 확인
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // 파일 입력 대체 방법 제공
      this.showQRFileInput();
      return;
    }
    
    // 바로 카메라 시작 시도
    this.startCamera();
};

// 카메라 시작 함수
window.dapp.startCamera = function() {
    const constraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    
    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        // QR 스캐너 UI 표시
        this.showQRScannerModal(stream);
      })
      .catch(err => {
        console.error('Camera error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          this.showErrorMessage('카메라 권한이 거부되었습니다. 카메라 사용을 허용해주세요.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          this.showErrorMessage('카메라를 찾을 수 없습니다.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          this.showErrorMessage('카메라가 이미 다른 앱에서 사용 중입니다.');
        } else {
          this.showErrorMessage('카메라 접근 중 오류가 발생했습니다.');
        }
      });
};

// QR 스캐너 모달
window.dapp.showQRScannerModal = function(stream) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'qrScannerModal';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3><i class="fas fa-qrcode"></i> QR 코드 스캔</h3>
          <button class="modal-close" onclick="window.dapp.closeQRScanner()">&times;</button>
        </div>
        <div class="modal-body">
          <video id="qrVideo" style="width: 100%; max-width: 400px; margin: 0 auto; display: block;"></video>
          <p style="text-align: center; margin-top: 1rem; color: var(--text-secondary);">
            QR 코드를 카메라 프레임 안에 위치시켜주세요
          </p>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const video = document.getElementById('qrVideo');
    video.srcObject = stream;
    video.play();
    
    // QR 코드 인식 시뮬레이션 (실제로는 QR 라이브러리 사용)
    setTimeout(() => {
      this.closeQRScanner();
      const mockAddress = '010-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000);
      const input = document.getElementById('recipientAddress');
      if (input) {
        input.value = mockAddress;
        this.showSuccessMessage('QR 코드가 스캔되었습니다');
      }
    }, 3000);
};

// QR 스캐너 닫기
window.dapp.closeQRScanner = function() {
    const modal = document.getElementById('qrScannerModal');
    if (modal) {
      const video = modal.querySelector('video');
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
      }
      modal.remove();
    }
};

// 통신주소 변경 모달
window.dapp.showChangeCommAddressModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'changeCommAddressModal';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3><i class="fas fa-edit"></i> 통신주소 변경</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>새로운 통신주소</label>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <input type="text" value="010" disabled style="width: 60px; text-align: center;">
              <span>-</span>
              <input type="text" id="newCommMiddle" maxlength="4" placeholder="0000" style="width: 80px; text-align: center;" onkeyup="if(this.value.length==4) document.getElementById('newCommLast').focus()">
              <span>-</span>
              <input type="text" id="newCommLast" maxlength="4" placeholder="0000" style="width: 80px; text-align: center;">
            </div>
          </div>
          <div class="form-help" style="background: #f0f9ff; padding: 0.75rem; border-radius: 6px; margin-top: 1rem;">
            <i class="fas fa-info-circle" style="color: #0284c7;"></i>
            <span style="color: #0369a1;">통신주소는 3개월에 한 번만 변경할 수 있습니다.</span>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">취소</button>
          <button type="button" class="btn-primary" onclick="window.dapp.confirmChangeCommAddress()">변경</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 숫자만 입력 가능하도록 설정
    const middleInput = modal.querySelector('#newCommMiddle');
    const lastInput = modal.querySelector('#newCommLast');
    
    [middleInput, lastInput].forEach(input => {
      input.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9]/g, '');
      });
    });
};

// 통신주소 변경 확인
window.dapp.confirmChangeCommAddress = function() {
    const middle = document.getElementById('newCommMiddle').value;
    const last = document.getElementById('newCommLast').value;
    
    if (middle.length !== 4 || last.length !== 4) {
      this.showErrorMessage('통신주소는 각각 4자리 숫자여야 합니다.');
      return;
    }
    
    const newAddress = `010-${middle}-${last}`;
    
    // 현재 주소와 동일한지 확인
    if (this.currentUser.communicationAddress === newAddress) {
      this.showErrorMessage('현재 통신주소와 동일합니다.');
      return;
    }
    
    // 통신주소 업데이트
    this.currentUser.communicationAddress = newAddress;
    this.currentUser.communicationAddressSetAt = Date.now();
    
    // 로컬 스토리지 업데이트
    localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));
    
    // UI 업데이트
    this.updateAddressDisplay();
    
    // 모달 닫기
    document.getElementById('changeCommAddressModal').remove();
    document.getElementById('communicationAddressModal').remove();
    
    this.showSuccessMessage('통신주소가 변경되었습니다.');
};

// QR 파일 입력 대체 방법
window.dapp.showQRFileInput = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          // 이미지에서 QR 코드 읽기 시뮬레이션
          this.processQRImage(event.target.result);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
};

// QR 이미지 처리
window.dapp.processQRImage = function(imageData) {
    // QR 코드 인식 시뮬레이션
    const mockAddress = '010-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000);
    const input = document.getElementById('recipientAddress');
    if (input) {
      input.value = mockAddress;
      this.showSuccessMessage('QR 코드가 인식되었습니다');
    }
};

// PWA 설치 프롬프트
let deferredPrompt;
let pwaInstallBannerShown = false;

// PWA 설치 가능 상태 확인
function checkPWAInstallability() {
    // 이미 PWA로 실행 중인지 확인
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        console.log('이미 PWA로 실행 중');
        return false;
    }
    
    // 서비스 워커가 등록되었는지 확인
    if ('serviceWorker' in navigator) {
        return true;
    }
    
    return false;
}

// PWA 설치 배너 표시
function showPWAInstallBanner() {
    if (pwaInstallBannerShown || !checkPWAInstallability()) {
        return;
    }
    
    const banner = document.getElementById('pwaInstallBanner');
    const installBtn = document.getElementById('pwaInstallBtn');
    const dismissBtn = document.getElementById('pwaDismissBtn');
    
    if (banner && installBtn && dismissBtn) {
        banner.style.display = 'block';
        setTimeout(() => {
            banner.classList.add('show');
            document.body.classList.add('pwa-banner-shown');
        }, 1000);
        
        // 설치 버튼 클릭
        installBtn.addEventListener('click', () => {
            window.dapp.installPWA();
        });
        
        // 닫기 버튼 클릭
        dismissBtn.addEventListener('click', () => {
            hidePWAInstallBanner();
            // 24시간 동안 다시 표시하지 않음
            localStorage.setItem('pwa_banner_dismissed', Date.now());
        });
        
        pwaInstallBannerShown = true;
    }
}

// PWA 설치 배너 숨기기
function hidePWAInstallBanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) {
        banner.classList.remove('show');
        document.body.classList.remove('pwa-banner-shown');
        setTimeout(() => {
            banner.style.display = 'none';
        }, 300);
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    // 기본 설치 프롬프트 방지
    e.preventDefault();
    // 나중에 사용하기 위해 이벤트 저장
    deferredPrompt = e;
    
    console.log('PWA 설치 프롬프트 준비됨');
    
    // 수동 배너 표시
    setTimeout(showPWAInstallBanner, 3000);
});

// PWA 설치 함수
window.dapp.installPWA = function() {
    if (deferredPrompt) {
        // 설치 프롬프트 표시
        deferredPrompt.prompt();
        
        // 사용자의 선택 대기
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('PWA 설치 승인됨');
                this.showSuccessMessage('백야 프로토콜이 설치되었습니다!');
                hidePWAInstallBanner();
            } else {
                console.log('PWA 설치 거부됨');
            }
            deferredPrompt = null;
        });
    } else {
        // 브라우저별 수동 설치 안내
        if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
            this.showiOSInstallGuide();
        } else {
            this.showManualInstallGuide();
        }
    }
};

// 수동 설치 가이드 (Android/Chrome)
window.dapp.showManualInstallGuide = function() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3><i class="fas fa-mobile-alt"></i> 앱 설치 가이드</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p>백야 프로토콜을 앱으로 설치하는 방법:</p>
                <ol style="line-height: 1.8;">
                    <li>브라우저 메뉴(⋮)를 탭합니다</li>
                    <li>"홈 화면에 추가" 또는 "앱 설치"를 선택합니다</li>
                    <li>"설치" 버튼을 탭합니다</li>
                </ol>
                <p style="margin-top: 1rem; color: var(--text-secondary);">
                    앱으로 설치하면 더 빠르고 편리하게 이용할 수 있습니다!
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

// 설치 상태 확인
window.addEventListener('appinstalled', (evt) => {
    console.log('백야 프로토콜 PWA가 설치되었습니다');
    hidePWAInstallBanner();
});

// 페이지 로드 시 설치 가능성 확인
document.addEventListener('DOMContentLoaded', () => {
    // 24시간 이내에 배너를 닫았다면 표시하지 않음
    const dismissed = localStorage.getItem('pwa_banner_dismissed');
    if (dismissed && (Date.now() - parseInt(dismissed)) < 24 * 60 * 60 * 1000) {
        return;
    }
    
    // beforeinstallprompt 이벤트가 없어도 배너 표시 (5초 후)
    setTimeout(() => {
        if (!deferredPrompt && !pwaInstallBannerShown) {
            showPWAInstallBanner();
        }
    }, 5000);
});

// iOS 설치 안내
window.dapp.showiOSInstallGuide = function() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <h3><i class="fas fa-mobile-alt"></i> iOS 설치 가이드</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <ol style="line-height: 1.8;">
                    <li>Safari에서 이 페이지를 엽니다</li>
                    <li>하단의 공유 버튼 <i class="fas fa-share"></i>을 탭합니다</li>
                    <li>"홈 화면에 추가"를 선택합니다</li>
                    <li>"추가"를 탭합니다</li>
                </ol>
                <p style="margin-top: 1rem; color: var(--text-secondary);">
                    홈 화면에 백야 프로토콜 아이콘이 추가됩니다!
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

console.log('✅ App additions loaded successfully'); 