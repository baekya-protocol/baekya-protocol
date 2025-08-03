/**
 * 백야 프로토콜 계정 관리 기능
 * 계정 일시정지, 재활성화 등
 */

// 계정 일시정지
window.suspendAccount = async function() {
  const dapp = window.dapp;
  
  if (!dapp.isAuthenticated || !dapp.currentUser) {
    dapp.showErrorMessage('로그인된 상태가 아닙니다.');
    return;
  }

  // UUID 초기화 확인
  if (!window.deviceUUIDManager.isReady()) {
    dapp.showErrorMessage('디바이스 초기화가 완료되지 않았습니다.');
    return;
  }

  // 확인 모달
  const confirmed = await showConfirmDialog(
    '계정 일시정지',
    '정말로 계정을 일시정지하시겠습니까?\n\n⚠️ 주의사항:\n- 현재 디바이스에서 계정 연결이 해제됩니다\n- 모든 기능(결제, 추천코드, 검증 등)이 비활성화됩니다\n- 다시 로그인하면 계정이 재활성화됩니다\n- 계정 데이터는 보존됩니다',
    '일시정지',
    '취소'
  );

  if (!confirmed) return;

  dapp.showLoadingMessage('계정 일시정지 중...');

  try {
    const result = await window.deviceUUIDManager.suspendAccount(dapp.currentUser.did);
    
    if (result) {
      dapp.showSuccessMessage('계정이 일시정지되었습니다. 앱이 종료됩니다.');
      
      // 로컬 데이터 정리
      setTimeout(() => {
        dapp.logout();
        
        // 웹 환경이면 페이지 새로고침, 앱 환경이면 앱 종료
        if (window.deviceUUIDManager.isCapacitorApp()) {
          // Capacitor 앱 종료
          if (window.Capacitor && window.Capacitor.Plugins.App) {
            window.Capacitor.Plugins.App.exitApp();
          }
        } else {
          // 웹 브라우저 새로고침
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      }, 2000);
      
    } else {
      dapp.showErrorMessage('계정 일시정지에 실패했습니다. 다시 시도해주세요.');
    }
  } catch (error) {
    console.error('❌ 계정 일시정지 오류:', error);
    dapp.showErrorMessage('계정 일시정지 중 오류가 발생했습니다.');
  } finally {
    dapp.hideLoadingMessage();
  }
};

// 확인 대화상자 표시
function showConfirmDialog(title, message, confirmText = '확인', cancelText = '취소') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
        </div>
        <div class="modal-body">
          <p style="white-space: pre-line; line-height: 1.6;">${message}</p>
          <div class="modal-actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn-secondary" id="cancelBtn">${cancelText}</button>
            <button class="btn-danger" id="confirmBtn">${confirmText}</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const cancelBtn = modal.querySelector('#cancelBtn');
    const confirmBtn = modal.querySelector('#confirmBtn');
    
    cancelBtn.addEventListener('click', () => {
      modal.remove();
      resolve(false);
    });
    
    confirmBtn.addEventListener('click', () => {
      modal.remove();
      resolve(true);
    });
    
    // ESC 키로 취소
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleKeydown);
        resolve(false);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  });
}

// dapp에 함수 추가
if (window.dapp) {
  window.dapp.suspendAccount = window.suspendAccount;
  window.dapp.showConfirmDialog = showConfirmDialog;
}

console.log('📱 계정 관리 시스템 로드 완료');