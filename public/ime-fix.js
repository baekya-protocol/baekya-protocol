// IME 입력 문제 해결을 위한 완전히 새로운 접근
(function() {
    'use strict';
    
    // 전역 IME 상태 관리
    let globalIMEState = {
        isComposing: false,
        activeInput: null
    };
    
    // 입력 필드 스타일 강제 적용
    function forceInputStyle(input) {
        // 기본 속성 설정
        input.style.opacity = '1';
        input.style.color = 'inherit';
        input.style.backgroundColor = 'transparent';
        
        // WebKit 관련 속성
        input.style.webkitTextFillColor = 'inherit';
        input.style.webkitOpacity = '1';
        
        // 입력 모드 설정
        input.setAttribute('inputmode', 'text');
        
        // 자동완성 끄기
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('spellcheck', 'false');
    }
    
    // 입력 필드 초기화 및 이벤트 설정
    function initializeInput(input) {
        // 이미 초기화된 경우 스킵
        if (input.hasAttribute('data-ime-initialized')) return;
        input.setAttribute('data-ime-initialized', 'true');
        
        // 스타일 적용
        forceInputStyle(input);
        
        // 포커스 이벤트
        input.addEventListener('focus', function() {
            globalIMEState.activeInput = this;
            // 포커스 시 스타일 재적용
            forceInputStyle(this);
            // 가상 키보드 강제 표시 (모바일)
            if ('ontouchstart' in window) {
                this.click();
            }
        });
        
        // 블러 이벤트
        input.addEventListener('blur', function() {
            if (globalIMEState.activeInput === this) {
                globalIMEState.activeInput = null;
            }
            globalIMEState.isComposing = false;
        });
        
        // Composition 이벤트 (한글 입력)
        input.addEventListener('compositionstart', function(e) {
            globalIMEState.isComposing = true;
        });
        
        input.addEventListener('compositionupdate', function(e) {
            // 입력 중인 텍스트를 강제로 표시
            if (e.data) {
                this.style.color = 'inherit !important';
                this.style.opacity = '1 !important';
            }
        });
        
        input.addEventListener('compositionend', function(e) {
            globalIMEState.isComposing = false;
            // 입력 완료 후 값 강제 갱신
            const value = this.value;
            this.value = '';
            this.value = value;
        });
        
        // Input 이벤트
        input.addEventListener('input', function(e) {
            // 강제 렌더링
            this.style.display = 'none';
            this.offsetHeight; // 리플로우 강제
            this.style.display = '';
        });
        
        // Keydown 이벤트 (백스페이스 등 특수키 처리)
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' || e.key === 'Delete') {
                // 삭제 시 즉시 반영
                setTimeout(() => {
                    const value = this.value;
                    this.value = value;
                }, 0);
            }
        });
    }
    
    // 모든 입력 필드 선택자
    const inputSelector = 'input[type="text"], input[type="password"], input[type="email"], input[type="tel"], input[type="search"], input:not([type]), textarea';
    
    // 페이지 로드 시 초기화
    function initializeAllInputs() {
        document.querySelectorAll(inputSelector).forEach(initializeInput);
    }
    
    // DOM 변경 감지
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            // 추가된 노드 처리
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) {
                    if (node.matches && node.matches(inputSelector)) {
                        initializeInput(node);
                    }
                    if (node.querySelectorAll) {
                        node.querySelectorAll(inputSelector).forEach(initializeInput);
                    }
                }
            });
        });
    });
    
    // 초기화 실행
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initializeAllInputs();
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    } else {
        initializeAllInputs();
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // 추가 안전장치: 주기적으로 입력 필드 체크
    setInterval(function() {
        if (globalIMEState.activeInput && globalIMEState.activeInput.value) {
            forceInputStyle(globalIMEState.activeInput);
        }
    }, 100);
})();

// 특별히 문제가 되는 입력 필드들에 대한 추가 처리
window.fixSpecificInputs = function() {
    // 아이디 입력 필드
    const userIdInput = document.getElementById('newUserId');
    if (userIdInput) {
        userIdInput.setAttribute('autocomplete', 'off');
        userIdInput.setAttribute('spellcheck', 'false');
    }
    
    // 이름 입력 필드
    const nameInput = document.getElementById('newUserName');
    if (nameInput) {
        nameInput.setAttribute('autocomplete', 'off');
        nameInput.setAttribute('spellcheck', 'false');
    }
    
    // 비밀번호 입력 필드
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
        input.setAttribute('autocomplete', 'new-password');
    });
};

console.log('✅ IME input fix loaded'); 