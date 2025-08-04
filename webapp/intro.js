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

    // 스크롤 인디케이터 클릭
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', () => {
            window.scrollTo({
                top: window.innerHeight,
                behavior: 'smooth'
            });
        });
    }

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

    // 플로팅 요소 마우스 따라가기 효과
    let mouseX = 0;
    let mouseY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX / window.innerWidth;
        mouseY = e.clientY / window.innerHeight;
        
        const floatElements = document.querySelectorAll('.float-element');
        floatElements.forEach((el, index) => {
            const speed = (index + 1) * 0.01;
            const x = (mouseX - 0.5) * 100 * speed;
            const y = (mouseY - 0.5) * 100 * speed;
            
            el.style.transform = `translate(${x}px, ${y}px)`;
        });
    });

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

    // 부드러운 스크롤
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

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

    // 모바일 터치 이벤트
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });

    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    function handleSwipe() {
        if (touchEndX < touchStartX - 50) {
            // 왼쪽 스와이프 - 다음 섹션으로
            const currentSection = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
            const nextSection = currentSection?.closest('section')?.nextElementSibling;
            if (nextSection && nextSection.tagName === 'SECTION') {
                nextSection.scrollIntoView({ behavior: 'smooth' });
            }
        }
        if (touchEndX > touchStartX + 50) {
            // 오른쪽 스와이프 - 이전 섹션으로
            const currentSection = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
            const prevSection = currentSection?.closest('section')?.previousElementSibling;
            if (prevSection && prevSection.tagName === 'SECTION') {
                prevSection.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    // 패럴랙스 효과
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        
        // 히어로 배경 패럴랙스
        const heroBg = document.querySelector('.hero-bg');
        if (heroBg) {
            heroBg.style.transform = `translateY(${scrolled * 0.5}px)`;
        }
        
        // 플로팅 요소 패럴랙스
        const floatElements = document.querySelectorAll('.float-element');
        floatElements.forEach((el, index) => {
            const speed = (index + 1) * 0.2;
            el.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });
});