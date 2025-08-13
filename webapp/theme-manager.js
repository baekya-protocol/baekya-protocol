// 테마 관리자 클래스
class ThemeManager {
    constructor() {
        this.currentTheme = 'light'; // 기본값은 라이트 모드
        this.themeToggleBtn = null;
        this.init();
    }

    init() {
        console.log('🎨 테마 관리자 초기화');
        
        // 저장된 테마 로드
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
        
        // DOM이 로드된 후 버튼 초기화
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initToggleButton();
                this.setupDynamicThemeObserver();
            });
        } else {
            this.initToggleButton();
            this.setupDynamicThemeObserver();
        }
    }

    // 동적으로 생성되는 요소들 감지
    setupDynamicThemeObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // 자식 노드 추가/제거 감지
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            // DAO 모달이 추가된 경우
                            if (node.classList?.contains('modal') || 
                                node.querySelector?.('.dao-detail-content, .option-card')) {
                                this.applyThemeToDAOModals(this.currentTheme);
                            }
                            
                            // 프로필 사진이 추가된 경우
                            if (node.querySelector?.('.profile-photo, .user-avatar-large') ||
                                node.classList?.contains('profile-photo') ||
                                node.classList?.contains('user-avatar-large')) {
                                this.applyThemeToProfilePhotos(this.currentTheme);
                            }
                            

                        }
                    });
                }
                

            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('🔍 동적 테마 관찰자 설정 완료');
    }

    initToggleButton() {
        this.themeToggleBtn = document.getElementById('themeToggle');
        if (this.themeToggleBtn) {
            this.updateToggleButton();
            console.log('🔘 테마 토글 버튼 초기화 완료');
        }
    }

    setTheme(theme) {
        this.currentTheme = theme;
        
        // HTML 요소와 body 모두에 data-theme 설정
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        
        // 클래스도 추가로 설정 (더 강력한 선택자를 위해)
        if (theme === 'dark') {
            document.documentElement.classList.add('dark-theme');
            document.body.classList.add('dark-theme');
        } else {
            document.documentElement.classList.remove('dark-theme');
            document.body.classList.remove('dark-theme');
        }
        
        localStorage.setItem('theme', theme);
        
        if (this.themeToggleBtn) {
            this.updateToggleButton();
        }
        
        console.log(`🎨 테마 변경: ${theme} (HTML과 Body에 모두 적용)`);
        
        // 강제로 카드 스타일 재적용
        this.forceApplyCardStyles(theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        
        // 토글 애니메이션
        if (this.themeToggleBtn) {
            this.themeToggleBtn.classList.add('toggling');
            setTimeout(() => {
                this.themeToggleBtn.classList.remove('toggling');
            }, 300);
        }
    }

    updateToggleButton() {
        if (!this.themeToggleBtn) return;
        
        const icon = this.themeToggleBtn.querySelector('i');
        const isDark = this.currentTheme === 'dark';
        
        // 아이콘 변경
        icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
        
        // 툴팁 변경
        this.themeToggleBtn.title = isDark ? '라이트모드로 전환' : '다크모드로 전환';
        
        // 버튼 상태 클래스 업데이트
        this.themeToggleBtn.classList.toggle('dark-mode', isDark);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    isDarkMode() {
        return this.currentTheme === 'dark';
    }

    // 카드 스타일 강제 적용
    forceApplyCardStyles(theme) {
        const cards = document.querySelectorAll('.status-card, .balance-card, .contribution-card, .network-card, .contribution-history-card, .my-dao-card, .protocol-overview-card, .validator-card');
        
        cards.forEach(card => {
            if (theme === 'dark') {
                card.style.setProperty('background', '#1a1a2e', 'important');
                card.style.setProperty('background-color', '#1a1a2e', 'important');
                card.style.setProperty('background-image', 'none', 'important');
                card.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.1)', 'important');
                card.style.setProperty('color', '#ffffff', 'important');
                
                // 카드 내부 요소들도 적용
                const headers = card.querySelectorAll('.card-header, .card-header h3');
                const contents = card.querySelectorAll('.card-content, .info-row span, .balance-value, .stat-item, .validator-stats, .validator-info');
                const labels = card.querySelectorAll('.info-row label, .balance-label, .stat-label');
                
                headers.forEach(el => {
                    el.style.setProperty('color', '#ffffff', 'important');
                    el.style.setProperty('background', 'transparent', 'important');
                });
                
                contents.forEach(el => {
                    el.style.setProperty('color', '#ffffff', 'important');
                    el.style.setProperty('background', 'transparent', 'important');
                });
                
                // 검증자 카드의 특별한 요소들 처리
                if (card.classList.contains('validator-card')) {
                    const statItems = card.querySelectorAll('.stat-item');
                    statItems.forEach(statItem => {
                        statItem.style.setProperty('background', 'rgba(255, 255, 255, 0.05)', 'important');
                        statItem.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.1)', 'important');
                        statItem.style.setProperty('border-radius', '8px', 'important');
                        statItem.style.setProperty('padding', '12px', 'important');
                    });
                }
                
                labels.forEach(el => {
                    el.style.setProperty('color', 'rgba(255, 255, 255, 0.7)', 'important');
                });
                
            } else {
                // 라이트 모드로 복원
                card.style.removeProperty('background');
                card.style.removeProperty('background-color');
                card.style.removeProperty('background-image');
                card.style.removeProperty('border');
                card.style.removeProperty('color');
                
                // 내부 요소들도 복원
                const allElements = card.querySelectorAll('*');
                allElements.forEach(el => {
                    el.style.removeProperty('color');
                    el.style.removeProperty('background');
                });
            }
        });
        
        console.log(`🎨 ${cards.length}개 카드에 ${theme} 테마 강제 적용 완료`);
        
        // DAO 기여 모달 요소들 처리
        this.applyThemeToDAOModals(theme);
        
        // 프로필 사진 처리
        this.applyThemeToProfilePhotos(theme);
    }

    // DAO 모달 요소들에 테마 적용
    applyThemeToDAOModals(theme) {
        if (theme === 'dark') {
            // DAO 기여 모달 관련 요소들
            const daoElements = document.querySelectorAll(`
                .dao-detail-content, .dao-content, .contribution-action-section,
                .contribution-actions, .join-options, .option-card,
                .modal-content.dao-detail-content, .dao-participate-modal,
                .dao-info-section, .dao-info
            `);
            
            daoElements.forEach(el => {
                if (el.classList.contains('option-card')) {
                    // 기여 옵션 카드는 더 어두운 배경
                    el.style.setProperty('background', 'rgba(255, 255, 255, 0.05)', 'important');
                    el.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.1)', 'important');
                    el.style.setProperty('border-radius', '8px', 'important');
                } else if (el.classList.contains('dao-info-section') || el.classList.contains('dao-info')) {
                    // DAO 설명창은 파란색 테마
                    el.style.setProperty('background', 'rgba(74, 158, 255, 0.1)', 'important');
                    el.style.setProperty('border', '1px solid rgba(74, 158, 255, 0.3)', 'important');
                    el.style.setProperty('border-radius', '8px', 'important');
                    el.style.setProperty('padding', '15px', 'important');
                } else {
                    // 메인 컨테이너들
                    el.style.setProperty('background', '#1a1a2e', 'important');
                    el.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.1)', 'important');
                }
                el.style.setProperty('color', '#ffffff', 'important');
            });
            
            console.log(`🌃 DAO 모달 요소들에 다크모드 적용 완료 (${daoElements.length}개)`);
        } else {
            // 라이트 모드로 복원
            const daoElements = document.querySelectorAll(`
                .dao-detail-content, .dao-content, .contribution-action-section,
                .contribution-actions, .join-options, .option-card,
                .modal-content.dao-detail-content, .dao-participate-modal,
                .dao-info-section, .dao-info
            `);
            
            daoElements.forEach(el => {
                el.style.removeProperty('background');
                el.style.removeProperty('background-color');
                el.style.removeProperty('border');
                el.style.removeProperty('border-radius');
                el.style.removeProperty('color');
            });
        }
    }



    // 프로필 사진에 테마 적용
    applyThemeToProfilePhotos(theme) {
        if (theme === 'dark') {
            // 대시보드 프로필 사진 - 다크모드에서는 라이트 색상 사용
            const profilePhotos = document.querySelectorAll('.status-card[data-card="profile"] .profile-photo');
            profilePhotos.forEach(photo => {
                photo.style.setProperty('background', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'important');
                photo.style.setProperty('border', '3px solid #1a1a2e', 'important');
            });
            
            // 사용자 모달 프로필 사진 - 다크모드에서는 라이트 색상 사용
            const userAvatars = document.querySelectorAll('.user-avatar-large');
            userAvatars.forEach(avatar => {
                avatar.style.setProperty('background', 'linear-gradient(135deg, #667eea, #764ba2)', 'important');
                avatar.style.setProperty('border', '3px solid #1a1a2e', 'important');
                avatar.style.setProperty('box-shadow', '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)', 'important');
            });
            
            console.log(`🖼️ 프로필 사진에 다크모드 적용 완료 (라이트 색상 사용)`);
        } else {
            // 라이트 모드로 복원 - 배경색은 CSS에서 보라색으로 유지
            const allPhotos = document.querySelectorAll('.status-card[data-card="profile"] .profile-photo, .user-avatar-large');
            allPhotos.forEach(photo => {
                // 배경색은 제거하지 않음 (CSS에서 보라색으로 설정됨)
                photo.style.removeProperty('border');
                photo.style.removeProperty('box-shadow');
            });
        }
    }
}

// 전역 객체로 등록
window.themeManager = new ThemeManager();