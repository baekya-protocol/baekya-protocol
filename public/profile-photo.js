// 프로필 사진 관리 스크립트

// DApp 클래스에 프로필 사진 메서드 추가
if (typeof BaekyaProtocolDApp !== 'undefined') {
  Object.assign(BaekyaProtocolDApp.prototype, {
    
    // 프로필 사진 모달 열기
    openProfilePhotoModal() {
      const modal = document.getElementById('profilePhotoModal');
      const photoPreview = document.getElementById('photoPreview');
      const saveBtn = document.getElementById('savePhotoBtn');
      
      // 현재 프로필 사진 로드
      this.loadCurrentPhoto(photoPreview);
      
      // 저장 버튼 비활성화
      saveBtn.disabled = true;
      
      modal.classList.add('active');
    },

    // 프로필 사진 모달 닫기
    closeProfilePhotoModal() {
      const modal = document.getElementById('profilePhotoModal');
      modal.classList.remove('active');
      
      // 선택된 사진 초기화
      this.selectedPhoto = null;
      const photoInput = document.getElementById('photoInput');
      if (photoInput) photoInput.value = '';
    },

    // 현재 프로필 사진 로드
    loadCurrentPhoto(previewElement) {
      if (this.currentUser && this.currentUser.profilePhoto) {
        previewElement.innerHTML = `<img src="${this.currentUser.profilePhoto}" alt="프로필 사진">`;
      } else {
        // 기본 아바타 표시
        const userName = this.currentUser?.name || '미설정';
        if (userName !== '미설정') {
          previewElement.innerHTML = '';
          previewElement.textContent = userName.charAt(0).toUpperCase();
        } else {
          previewElement.innerHTML = `<i class="fas fa-user"></i>`;
        }
      }
    },

    // 사진 선택 처리
    handlePhotoSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      // 파일 크기 검증 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.showErrorMessage('파일 크기는 5MB를 초과할 수 없습니다.');
        return;
      }

      // 파일 형식 검증
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        this.showErrorMessage('JPG, PNG, GIF 형식만 지원됩니다.');
        return;
      }

      // 파일 읽기
      const reader = new FileReader();
      reader.onload = (e) => {
        this.selectedPhoto = e.target.result;
        
        // 미리보기 업데이트
        const photoPreview = document.getElementById('photoPreview');
        photoPreview.innerHTML = `<img src="${this.selectedPhoto}" alt="선택된 사진">`;
        
        // 저장 버튼 활성화
        const saveBtn = document.getElementById('savePhotoBtn');
        if (saveBtn) saveBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    },

    // 프로필 사진 리셋
    resetProfilePhoto() {
      const photoPreview = document.getElementById('photoPreview');
      
      // 기본 아바타로 리셋
      if (this.currentUser && this.currentUser.name && this.currentUser.name !== '미설정') {
        photoPreview.innerHTML = '';
        photoPreview.textContent = this.currentUser.name.charAt(0).toUpperCase();
      } else {
        photoPreview.innerHTML = '<i class="fas fa-user"></i>';
      }
      
      this.selectedPhoto = 'reset';
      const saveBtn = document.getElementById('savePhotoBtn');
      if (saveBtn) saveBtn.disabled = false;
    },

    // 프로필 사진 저장
    async saveProfilePhoto() {
      try {
        if (!this.currentUser) {
          this.showErrorMessage('로그인이 필요합니다.');
          return;
        }

        console.log('프로필 사진 저장 시작 - selectedPhoto:', this.selectedPhoto);

        // 프로필 사진 데이터 업데이트
        if (this.selectedPhoto === 'reset') {
          this.currentUser.profilePhoto = null;
          console.log('프로필 사진 리셋');
        } else if (this.selectedPhoto) {
          this.currentUser.profilePhoto = this.selectedPhoto;
          console.log('프로필 사진 저장:', this.selectedPhoto.substring(0, 50) + '...');
        }

        // 로컬 스토리지에 저장
        localStorage.setItem('baekya_auth', JSON.stringify(this.currentUser));

        // UI 업데이트 - 여러 번 호출하여 확실히 업데이트
        setTimeout(() => {
        this.updateProfilePhotoInUI();
          // 메인 프로필 업데이트도 호출
          if (this.updateUserProfile) {
            this.updateUserProfile();
          }
        }, 100);

        // 성공 메시지
        this.showSuccessMessage('프로필 사진이 업데이트되었습니다.');

        // 모달 닫기
        this.closeProfilePhotoModal();

      } catch (error) {
        console.error('프로필 사진 저장 실패:', error);
        this.showErrorMessage('프로필 사진 저장에 실패했습니다.');
      }
    },

    // UI에서 프로필 사진 업데이트
    updateProfilePhotoInUI() {
      const profilePhoto = document.getElementById('profilePhoto');
      const mobileAvatar = document.getElementById('mobile-profile-avatar');
      // DAO 탭과 다른 위치의 프로필 사진도 업데이트
      const allProfilePhotos = document.querySelectorAll('.profile-photo, .user-avatar');

      if (this.currentUser && this.currentUser.profilePhoto) {
        // 프로필 사진이 있는 경우
        if (profilePhoto) {
          profilePhoto.innerHTML = `<img src="${this.currentUser.profilePhoto}" alt="프로필 사진" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        }
        if (mobileAvatar) {
          mobileAvatar.innerHTML = `<img src="${this.currentUser.profilePhoto}" alt="프로필 사진" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        }
        // 모든 프로필 사진 요소 업데이트
        allProfilePhotos.forEach(element => {
          if (element.id !== 'profilePhoto' && element.id !== 'mobile-profile-avatar') {
            element.innerHTML = `<img src="${this.currentUser.profilePhoto}" alt="프로필 사진" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
          }
        });
      } else {
        // 기본 아바타 표시
        const userName = this.currentUser?.name || '미설정';
        const displayText = userName !== '미설정' ? userName.charAt(0).toUpperCase() : 'U';
        
        if (profilePhoto) {
          if (userName !== '미설정') {
            profilePhoto.innerHTML = '';
            profilePhoto.textContent = displayText;
            profilePhoto.style.display = 'flex';
            profilePhoto.style.alignItems = 'center';
            profilePhoto.style.justifyContent = 'center';
            profilePhoto.style.fontSize = '2rem';
            profilePhoto.style.fontWeight = 'bold';
            profilePhoto.style.backgroundColor = 'var(--primary-light)';
            profilePhoto.style.color = 'white';
          } else {
            profilePhoto.innerHTML = '<i class="fas fa-user"></i>';
          }
        }
        if (mobileAvatar) {
          mobileAvatar.textContent = displayText;
          mobileAvatar.style.display = 'flex';
          mobileAvatar.style.alignItems = 'center';
          mobileAvatar.style.justifyContent = 'center';
        }
        // 모든 프로필 사진 요소 업데이트
        allProfilePhotos.forEach(element => {
          if (element.id !== 'profilePhoto' && element.id !== 'mobile-profile-avatar') {
            element.textContent = displayText;
            element.style.display = 'flex';
            element.style.alignItems = 'center';
            element.style.justifyContent = 'center';
          }
        });
      }
      
      // 프로필 설정 미리보기도 업데이트
      const profilePreview = document.querySelector('.profile-settings .profile-photo-preview');
      if (profilePreview) {
        if (this.currentUser && this.currentUser.profilePhoto) {
          profilePreview.innerHTML = `<img src="${this.currentUser.profilePhoto}" alt="프로필 사진" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
          profilePreview.innerHTML = '';
          profilePreview.textContent = displayText || 'U';
          profilePreview.style.display = 'flex';
          profilePreview.style.alignItems = 'center';
          profilePreview.style.justifyContent = 'center';
          profilePreview.style.fontSize = '2rem';
          profilePreview.style.fontWeight = 'bold';
        }
      }
    },

    // 에러 메시지 표시
    showErrorMessage(message) {
      // 기존 toast가 있다면 제거
      const existingToast = document.querySelector('.toast.error');
      if (existingToast) {
        existingToast.remove();
      }

      const toast = document.createElement('div');
      toast.className = 'toast error';
      toast.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        <span>${message}</span>
      `;
      
      // 에러 스타일 추가
      toast.style.borderLeftColor = '#ef4444';
      
      document.body.appendChild(toast);
      
      setTimeout(() => toast.classList.add('show'), 100);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 300);
      }, 3000);
    }
  });
}

// 기존 updateUserProfile 메서드 확장
if (typeof window.dapp !== 'undefined' && window.dapp.updateUserProfile) {
  const originalUpdateUserProfile = window.dapp.updateUserProfile.bind(window.dapp);
  
  window.dapp.updateUserProfile = function() {
    // 기존 프로필 업데이트 실행
    originalUpdateUserProfile();
    
    // 프로필 사진 UI 업데이트
    this.updateProfilePhotoInUI();
  };
}

// 기존 updateMobileProfileHeader 메서드 확장
if (typeof window.dapp !== 'undefined' && window.dapp.updateMobileProfileHeader) {
  const originalUpdateMobileProfileHeader = window.dapp.updateMobileProfileHeader.bind(window.dapp);
  
  window.dapp.updateMobileProfileHeader = function() {
    // 기존 모바일 헤더 업데이트 실행
    originalUpdateMobileProfileHeader();
    
    // 프로필 사진이 있으면 적용
    const mobileAvatar = document.getElementById('mobile-profile-avatar');
    if (mobileAvatar && this.currentUser && this.currentUser.profilePhoto) {
      mobileAvatar.innerHTML = `<img src="${this.currentUser.profilePhoto}" alt="프로필 사진">`;
    }
  };
}

console.log('📸 프로필 사진 기능이 로드되었습니다.'); 