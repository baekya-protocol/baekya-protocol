// BROTHERHOOD 소개 페이지 인터랙션

document.addEventListener('DOMContentLoaded', function() {
    // 스크롤 애니메이션
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                
                // 특별한 애니메이션이 필요한 요소들
                if (entry.target.classList.contains('problem-card')) {
                    entry.target.style.animationDelay = `${entry.target.dataset.delay || 0}s`;
                }
            }
        });
    }, observerOptions);

    // 관찰할 요소들
    const animatedElements = document.querySelectorAll(
        '.problem-card, .solution-card, .feature-item, .roadmap-item'
    );
    
    animatedElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s ease-out';
        el.dataset.delay = index * 0.1;
        observer.observe(el);
    });

    // visible 클래스 추가 시 애니메이션
    const style = document.createElement('style');
    style.textContent = `
        .visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);

    // 스크롤 인디케이터 (기능 제거됨)

    // 다운로드 버튼 효과
    const downloadBtns = document.querySelectorAll('.download-btn:not(:disabled)');
    downloadBtns.forEach(btn => {
        btn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        btn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // P2P 네트워크 노드 상호작용
    const nodes = document.querySelectorAll('.node');
    nodes.forEach((node, index) => {
        node.addEventListener('mouseenter', function() {
            // 다른 노드들과 연결선 강조
            const line = document.querySelector('.pentagon');
            if (line) {
                line.style.stroke = '#ef4444';
                line.style.strokeWidth = '3';
            }
        });
        
        node.addEventListener('mouseleave', function() {
            const line = document.querySelector('.pentagon');
            if (line) {
                line.style.stroke = '#ff0000';
                line.style.strokeWidth = '2';
            }
        });
    });

    // 플로팅 요소 마우스 따라가기 효과 (기능 제거됨)

    // 타이핑 효과 (섹션 제목)
    const typeWriter = (element, text, speed = 50) => {
        let i = 0;
        element.textContent = '';
        
        const type = () => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        };
        
        type();
    };

    // 섹션 제목 타이핑 효과 적용
    const sectionTitles = document.querySelectorAll('.section-title');
    const titleObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('typed')) {
                entry.target.classList.add('typed');
                const originalText = entry.target.textContent;
                typeWriter(entry.target, originalText, 30);
            }
        });
    }, { threshold: 0.5 });

    sectionTitles.forEach(title => {
        titleObserver.observe(title);
    });

    // 숫자 카운트업 애니메이션
    const countUp = (element, target, duration = 2000) => {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const updateCount = () => {
            current += increment;
            if (current < target) {
                element.textContent = Math.floor(current);
                requestAnimationFrame(updateCount);
            } else {
                element.textContent = target;
            }
        };
        
        updateCount();
    };

    // 통계 숫자가 있다면 카운트업 적용
    const stats = document.querySelectorAll('.stat-number');
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                entry.target.classList.add('counted');
                const target = parseInt(entry.target.dataset.target);
                countUp(entry.target, target);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(stat => {
        statsObserver.observe(stat);
    });

    // 부드러운 스크롤 (기능 제거됨)

    // 페이지 로드 시 히어로 섹션 애니메이션
    window.addEventListener('load', () => {
        document.querySelector('.hero-section').classList.add('loaded');
        
        // P2P 네트워크 애니메이션 시작
        setTimeout(() => {
            const pentagon = document.querySelector('.pentagon');
            if (pentagon) {
                pentagon.style.animation = 'draw-line 3s ease-out forwards';
            }
        }, 500);
    });

    // 모바일 터치 이벤트와 패럴랙스 효과 (기능 제거됨)

    // 섹션 네비게이션 기능
    const sectionNav = document.getElementById('sectionNav');
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('section');
    
    // 섹션 네비게이션 클릭 이벤트
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.dataset.section;
            const targetSection = document.querySelector(`.${sectionId}`);
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // 스크롤에 따른 섹션 네비게이션 표시/숨김 및 활성 섹션 업데이트
    let isNavVisible = false;
    
    function updateSectionNav() {
        const scrollY = window.scrollY;
        const heroHeight = document.querySelector('.hero-section').offsetHeight;
        
        // 섹션2(문제 섹션)부터 네비게이션 표시
        if (scrollY > heroHeight - 100 && !isNavVisible) {
            sectionNav.classList.add('visible');
            isNavVisible = true;
        } else if (scrollY <= heroHeight - 100 && isNavVisible) {
            sectionNav.classList.remove('visible');
            isNavVisible = false;
        }
        
        // 현재 활성 섹션 감지
        let currentSection = '';
        const offset = 200; // 섹션 전환을 위한 오프셋
        const documentHeight = document.documentElement.scrollHeight;
        const windowHeight = window.innerHeight;
        
        // 현재 보이는 섹션 감지
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            
            if (scrollY >= sectionTop - offset && scrollY < sectionTop + sectionHeight - offset) {
                const sectionClass = section.className.split(' ')[0];
                // 히어로 섹션과 CTA 섹션은 네비게이션에서 제외
                if (sectionClass !== 'hero-section' && sectionClass !== 'cta-section') {
                    currentSection = sectionClass;
                }
            }
        });
        
        // 네비게이션 아이템 활성화 업데이트
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === currentSection) {
                item.classList.add('active');
            }
        });
    }
    
    // 스크롤 이벤트 리스너
    window.addEventListener('scroll', updateSectionNav);
    
    // 초기 실행
    updateSectionNav();
});