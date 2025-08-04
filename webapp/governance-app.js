// 거버넌스 애플리케이션 클래스
class GovernanceApp {
    constructor() {
        this.currentTab = 'system';
        this.currentGovernanceSubTab = 'proposal';
        this.currentProposalFilter = 'new'; // new, waiting
        this.currentEvaluationFilter = 'evaluating'; // evaluating, completed
        
        // 메인 앱과 동일한 API 설정
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const localServerUrl = `http://${window.location.hostname}:3000`;
        this.relayServerUrl = isLocal ? localServerUrl : 'https://baekya-relay-production.up.railway.app';
        this.apiBase = isLocal ? `${localServerUrl}/api` : `${this.relayServerUrl}/api`;
        
        // 임시: 거버넌스 API가 구현되지 않았으므로 로컬 처리
        this.useLocalStorage = true;
        
        // 데이터 저장소 (로컬 캐시용)
        this.proposals = [];
        this.collaborations = {};
        this.evaluations = [];
        this.forks = [];
        this.votes = {};
        this.donations = {};
        this.prs = {};
        this.feedbacks = {};
        
        // 사용자 정보
        this.currentUser = null;
        this.userBalance = 0;
        this.sessionId = null;
        this.lastAuthPassword = null;
        
        // 타이머 관리
        this.timers = {};
        
        this.init();
    }

    init() {
        console.log('🏛️ 거버넌스 앱 초기화');
        
        // Firebase 인증 상태 확인
        this.checkAuthState();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 초기 데이터 로드
        this.loadInitialData();
        
        // 초기 탭 설정 (DOM 로드 후 실행)
        setTimeout(() => {
            this.switchTab('system');
        }, 100);
        
        // 주기적 업데이트 시작
        this.startPeriodicUpdates();
    }

    // 로컬 스토리지 관리
    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('스토리지 저장 실패:', e);
        }
    }

    loadFromStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('스토리지 로드 실패:', e);
            return null;
        }
    }

    // 인증 상태 확인
    checkAuthState() {
        try {
            // 메인 앱에서 사용자 정보 가져오기
            if (window.parent && window.parent.app && window.parent.app.currentUser) {
                this.currentUser = window.parent.app.currentUser;
                this.sessionId = window.parent.app.sessionId;
                this.userBalance = window.parent.app.currentUser.balance || 0;
                this.lastAuthPassword = window.parent.app.lastAuthPassword || '';
                console.log('👤 메인 앱 사용자 정보 로드:', this.currentUser);
            } else {
                // 실제 로그인된 사용자 정보 사용 (founder 계정)
                this.currentUser = {
                    uid: 'founder',
                    did: 'e4221a49e2420aea55cd4ff0cb81973b845e79f8634434f98b5d2e138efd58e0',
                    displayName: 'Founder',
                    photoURL: null,
                    balance: 30
                };
                this.userBalance = 30;
                this.sessionId = 'founder-session';
                this.lastAuthPassword = 'Founder123!';
                console.log('👑 Founder 사용자 정보 사용:', this.currentUser);
            }
        } catch (error) {
            console.error('사용자 정보 로드 실패:', error);
            // 기본값 설정 (founder 계정)
            this.currentUser = {
                uid: 'founder',
                did: 'e4221a49e2420aea55cd4ff0cb81973b845e79f8634434f98b5d2e138efd58e0',
                displayName: 'Founder',
                photoURL: null,
                balance: 30
            };
            this.userBalance = 30;
            this.sessionId = 'founder-session';
            this.lastAuthPassword = 'Founder123!';
        }
    }

    // 사용자 잔액 로드
    loadUserBalance() {
        try {
            // 메인 앱의 토큰 잔액 가져오기
            if (window.parent && window.parent.blockchainCore) {
                const balance = window.parent.blockchainCore.getBalance();
                this.userBalance = balance;
                console.log('🏦 실제 잔액 로드:', balance + 'B');
            } else if (window.blockchainCore) {
                const balance = window.blockchainCore.getBalance();
                this.userBalance = balance;
                console.log('🏦 실제 잔액 로드:', balance + 'B');
            } else {
                // 로컬 스토리지에서 잔액 가져오기
                const savedBalance = localStorage.getItem('userBalance');
                if (savedBalance) {
                    this.userBalance = parseFloat(savedBalance);
                } else {
                    this.userBalance = 30.25; // 기본값
                }
                console.log('🏦 저장된 잔액 로드:', this.userBalance + 'B');
            }
        } catch (error) {
            console.error('잔액 로드 실패:', error);
            this.userBalance = 30.25; // 기본값
        }
    }

    // 잔액 업데이트
    updateBalance(amount) {
        this.userBalance += amount;
        localStorage.setItem('userBalance', this.userBalance.toString());
        
        // 메인 앱에 잔액 업데이트 알림
        if (window.parent && window.parent.blockchainCore) {
            window.parent.blockchainCore.updateBalance(amount);
        } else if (window.blockchainCore) {
            window.blockchainCore.updateBalance(amount);
        }
        
        console.log('💰 잔액 업데이트:', amount + 'B, 현재 잔액:', this.userBalance + 'B');
    }

    // 블록체인 트랜잭션 생성
    createBlockchainTransaction(type, data) {
        try {
            const transaction = {
                type: type,
                data: data,
                timestamp: Date.now(),
                userId: this.currentUser.uid,
                hash: this.generateTransactionHash(type, data)
            };

            // 메인 앱의 블록체인에 트랜잭션 추가
            if (window.parent && window.parent.blockchainCore) {
                window.parent.blockchainCore.addTransaction(transaction);
                console.log('🔗 블록체인 트랜잭션 생성:', transaction);
            } else if (window.blockchainCore) {
                window.blockchainCore.addTransaction(transaction);
                console.log('🔗 블록체인 트랜잭션 생성:', transaction);
            } else {
                // 로컬 스토리지에 트랜잭션 저장
                const transactions = JSON.parse(localStorage.getItem('blockchain_transactions') || '[]');
                transactions.push(transaction);
                localStorage.setItem('blockchain_transactions', JSON.stringify(transactions));
                console.log('💾 로컬 트랜잭션 저장:', transaction);
            }

            return transaction;
        } catch (error) {
            console.error('트랜잭션 생성 실패:', error);
            return null;
        }
    }

    // 트랜잭션 해시 생성
    generateTransactionHash(type, data) {
        const content = type + JSON.stringify(data) + Date.now();
        // 한글 지원을 위해 btoa 대신 간단한 해시 생성
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32비트 정수로 변환
        }
        return Math.abs(hash).toString(16).substring(0, 16);
    }

    // 메인 앱의 블록체인에 트랜잭션 전송
    async sendTransactionToMainApp(type, data) {
        try {
            const transaction = {
                type: type,
                data: data,
                timestamp: Date.now(),
                from: this.currentUser.did || this.currentUser.uid,
                amount: data.cost || 0,
                hash: this.generateTransactionHash(type, data)
            };

            // 메인 앱의 transfer 함수 호출 (토큰 전송과 동일한 방식)
            if (window.parent && window.parent.app) {
                // 메인 앱에서 거버넌스 트랜잭션 처리
                const result = await window.parent.app.processGovernanceTransaction(transaction);
                console.log('🔗 메인 앱 트랜잭션 전송 완료:', result);
                return result;
            } else {
                // 독립 실행 시 직접 릴레이서버로 전송
                console.log('🔗 독립 실행 모드 - 릴레이서버로 직접 전송:', transaction);
                const result = await this.sendDirectToRelay(transaction);
                return result;
            }
        } catch (error) {
            console.error('메인 앱 트랜잭션 전송 실패:', error);
            throw error;
        }
    }

    // 릴레이서버로 직접 거버넌스 트랜잭션 전송
    async sendDirectToRelay(transaction) {
        try {
            const transferData = {
                fromDID: this.currentUser.did || this.currentUser.uid,
                toAddress: 'GOVERNANCE_POOL', // 거버넌스 풀 주소
                amount: transaction.amount || 0,
                tokenType: 'B-Token',
                memo: `거버넌스 ${transaction.type}: ${transaction.data.title || transaction.data.proposalId}`,
                authData: {
                    password: this.lastAuthPassword || ''
                },
                governanceData: transaction // 거버넌스 데이터 포함
            };

            console.log('🏛️ 릴레이서버로 거버넌스 트랜잭션 전송:', transferData);

            const response = await fetch(`${this.apiBase}/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionId}`
                },
                body: JSON.stringify(transferData)
            });

            const result = await response.json();
            console.log('🔗 릴레이서버 응답:', result);

            if (result.success) {
                console.log('✅ 거버넌스 트랜잭션 성공 - 블록 생성 완료');
                // 잔액 업데이트
                if (transaction.amount > 0) {
                    this.userBalance -= transaction.amount;
                    this.updateWalletDisplay();
                }
            } else {
                console.error('❌ 거버넌스 트랜잭션 실패:', result.error);
            }

            return result;
        } catch (error) {
            console.error('릴레이서버 직접 전송 실패:', error);
            return { success: false, error: error.message };
        }
    }

    // 주기적 업데이트
    startPeriodicUpdates() {
        // 1분마다 제안 상태 업데이트
        setInterval(() => {
            this.updateProposalStatuses();
            this.updateCollaborationStatuses();
            this.updateEvaluationStatuses();
        }, 60000);
    }

    // 제안 상태 업데이트
    updateProposalStatuses() {
        const now = Date.now();
        let updated = false;

        this.proposals.forEach(proposal => {
            const age = now - proposal.createdAt;
            const oneWeek = 7 * 24 * 60 * 60 * 1000;

            if (proposal.status === 'new' && age >= oneWeek) {
                const goodRate = this.calculateGoodRate(proposal.id);
                
                if (goodRate >= 60) {
                    proposal.status = 'waiting';
                    proposal.waitingSince = now;
                    this.verifyProposalDCA(proposal); // DCA 검증
                    updated = true;
                } else {
                    // 1주일 지났는데 60% 미달성 -> 삭제
                    this.deleteProposal(proposal.id);
                    updated = true;
                }
            } else if (proposal.status === 'waiting') {
                const goodRate = this.calculateGoodRate(proposal.id);
                
                if (goodRate < 50) {
                    // 50% 미만으로 떨어지면 삭제
                    this.deleteProposal(proposal.id);
                    updated = true;
                }
            }
        });

        if (updated) {
            this.saveToStorage('governance_proposals', this.proposals);
            this.renderProposals();
        }
    }

    // Good 투표율 계산
    calculateGoodRate(proposalId) {
        const votes = this.votes[proposalId] || { good: [], bad: [] };
        const total = votes.good.length + votes.bad.length;
        
        if (total === 0) return 0;
        return (votes.good.length / total) * 100;
    }

    // Good 투표자 수 가져오기
    getGoodVoterCount(proposalId) {
        const votes = this.votes[proposalId] || { good: [], bad: [] };
        return votes.good.length;
    }

    // 제안 삭제 (모금액 반환)
    deleteProposal(proposalId) {
        const proposalIndex = this.proposals.findIndex(p => p.id === proposalId);
        if (proposalIndex === -1) return;

        const proposal = this.proposals[proposalIndex];
        
        // 모금액 반환
        const donations = this.donations[proposalId] || [];
        donations.forEach(donation => {
            // 실제 구현 시 사용자에게 반환
            console.log(`${donation.userId}에게 ${donation.amount}B 반환`);
        });

        // 데이터 삭제
        this.proposals.splice(proposalIndex, 1);
        delete this.votes[proposalId];
        delete this.donations[proposalId];
        
        this.saveToStorage('governance_proposals', this.proposals);
        this.saveToStorage('governance_votes', this.votes);
        this.saveToStorage('governance_donations', this.donations);
    }

    // 협업 상태 업데이트
    updateCollaborationStatuses() {
        if (!this.collaborations.current) return;

        const collab = this.collaborations.current;
        const now = Date.now();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;

        if (collab.stage === 'core' && collab.stageStartedAt) {
            if (now - collab.stageStartedAt >= oneWeek) {
                // Core PR 단계 종료
                this.finalizeCorePRStage();
            }
        } else if (collab.stage === 'complementary' && collab.stageStartedAt) {
            if (now - collab.stageStartedAt >= oneWeek) {
                // Complementary PR 단계 종료
                this.finalizeComplementaryPRStage();
            }
        }
    }

    // 평가 상태 업데이트
    updateEvaluationStatuses() {
        const now = Date.now();
        const threeWeeks = 21 * 24 * 60 * 60 * 1000;
        let updated = false;

        this.evaluations.forEach(evaluation => {
            if (evaluation.status === 'evaluating' && evaluation.startedAt) {
                if (now - evaluation.startedAt >= threeWeeks) {
                    evaluation.status = 'completed';
                    evaluation.completedAt = now;
                    
                    // 1위 평가자에게 보상 지급
                    this.distributeEvaluationReward(evaluation.id);
                    updated = true;
                }
            }
        });

        if (updated) {
            this.saveToStorage('governance_evaluations', this.evaluations);
            this.renderEvaluations();
        }
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 메인 탭 버튼들
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // 모바일 헤더 탭들
        document.querySelectorAll('.mobile-header-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.id;
                const tabName = tabId.replace('mobile-header-', '');
                this.switchTab(tabName);
            });
        });
    }

    switchTab(tabName) {
        console.log('🔄 탭 전환:', tabName);
        
        this.currentTab = tabName;

        // 모든 탭 콘텐츠 숨기기
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // 모든 탭 버튼 비활성화
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 모든 모바일 헤더 탭 비활성화
        document.querySelectorAll('.mobile-header-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // 선택된 탭 활성화
        const selectedContent = document.getElementById(tabName);
        const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const selectedMobileTab = document.getElementById(`mobile-header-${tabName}`);

        if (selectedContent) selectedContent.classList.add('active');
        if (selectedBtn) selectedBtn.classList.add('active');
        if (selectedMobileTab) selectedMobileTab.classList.add('active');

        // 탭별 초기화
        switch(tabName) {
            case 'main':
                // 메인 페이지로 이동
                window.location.href = '/';
                break;
            case 'system':
                this.loadSystemFiles();
                break;
            case 'governance':
                this.switchGovernanceSubTab('proposal');
                break;
            case 'fork':
                this.loadForks();
                break;
        }
    }

    switchGovernanceSubTab(subTabName) {
        console.log('🔄 거버넌스 서브탭 전환:', subTabName);
        
        this.currentGovernanceSubTab = subTabName;

        // 모든 거버넌스 서브 탭 콘텐츠 숨기기
        document.querySelectorAll('.governance-sub-content').forEach(content => {
            content.classList.remove('active');
        });

        // 모든 거버넌스 서브 탭 버튼 비활성화
        document.querySelectorAll('[data-gov-sub]').forEach(btn => {
            btn.classList.remove('active');
        });

        // 선택된 서브탭 활성화
        const selectedContent = document.getElementById(`gov-${subTabName}`);
        const selectedBtn = document.querySelector(`[data-gov-sub="${subTabName}"]`);

        if (selectedContent) selectedContent.classList.add('active');
        if (selectedBtn) selectedBtn.classList.add('active');

        // 서브탭별 데이터 로드
        switch(subTabName) {
            case 'proposal':
                this.renderProposals();
                break;
            case 'collab':
                this.loadCollaboration();
                break;
            case 'evaluation':
                this.loadEvaluations();
                break;
        }
    }

    // 제안 필터 전환
    switchProposalFilter(filter) {
        this.currentProposalFilter = filter;
        
        // 필터 버튼 업데이트
        document.querySelectorAll('[data-proposal-filter]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.proposalFilter === filter);
        });
        
        this.renderProposals();
    }

    // 평가 필터 전환
    switchEvaluationFilter(filter) {
        this.currentEvaluationFilter = filter;
        
        // 필터 버튼 업데이트
        document.querySelectorAll('[data-evaluation-filter]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.evaluationFilter === filter);
        });
        
        this.renderEvaluations();
    }

    // 제안 로드
    loadProposals() {
        this.renderProposals();
    }

    // 제안 렌더링
    renderProposals() {
        const container = document.getElementById('proposalList');
        if (!container) return;

        // 필터링된 제안 목록
        const filteredProposals = this.proposals.filter(proposal => {
            if (this.currentProposalFilter === 'new') {
                return proposal.status === 'new';
            } else if (this.currentProposalFilter === 'waiting') {
                return proposal.status === 'waiting';
            }
            return true;
        });

        // 정렬 (waiting은 good 투표자 수 기준)
        if (this.currentProposalFilter === 'waiting') {
            filteredProposals.sort((a, b) => {
                return this.getGoodVoterCount(b.id) - this.getGoodVoterCount(a.id);
            });
        } else {
            // new는 최신순
            filteredProposals.sort((a, b) => b.createdAt - a.createdAt);
        }

        if (filteredProposals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-lightbulb"></i>
                    <p>${this.currentProposalFilter === 'new' ? '아직 새로운 제안이 없습니다.' : '협업 대기 중인 제안이 없습니다.'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredProposals.map(proposal => {
            const votes = this.votes[proposal.id] || { good: [], bad: [] };
            const donations = this.donations[proposal.id] || [];
            const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
            const goodRate = this.calculateGoodRate(proposal.id);
            const age = Date.now() - proposal.createdAt;
            const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
            
            // 순위 표시 (waiting 탭에서만)
            const rankBadge = this.currentProposalFilter === 'waiting' ? 
                `<span class="proposal-rank">#${filteredProposals.indexOf(proposal) + 1}</span>` : '';

            return `
                <div class="proposal-card" onclick="window.governanceApp.showProposalDetail('${proposal.id}')">
                    <div class="proposal-card-header">
                        <div>
                            <h3 class="proposal-title">${proposal.title} ${rankBadge}</h3>
                            <div class="proposal-labels">
                                ${proposal.labels.map(label => `<span class="proposal-label">${label}</span>`).join('')}
                            </div>
                        </div>
                        <span class="proposal-age">${daysOld}일 전</span>
                    </div>
                    <p class="proposal-description">${proposal.description}</p>
                    <div class="proposal-stats">
                        <div class="proposal-stat good">
                            <i class="fas fa-thumbs-up"></i>
                            <span>${votes.good.length}</span>
                        </div>
                        <div class="proposal-stat bad">
                            <i class="fas fa-thumbs-down"></i>
                            <span>${votes.bad.length}</span>
                        </div>
                        <div class="proposal-stat">
                            <i class="fas fa-percentage"></i>
                            <span>${goodRate.toFixed(1)}%</span>
                        </div>
                        <div class="proposal-stat donation">
                            <i class="fas fa-coins"></i>
                            <span>${totalDonations}B</span>
                        </div>
                    </div>
                    <div class="proposal-actions" onclick="event.stopPropagation()">
                        <button class="proposal-action-btn good" onclick="window.governanceApp.voteProposal('${proposal.id}', 'good')">
                            <i class="fas fa-thumbs-up"></i>
                            <span>Good</span>
                        </button>
                        <button class="proposal-action-btn bad" onclick="window.governanceApp.voteProposal('${proposal.id}', 'bad')">
                            <i class="fas fa-thumbs-down"></i>
                            <span>Bad</span>
                        </button>
                        <button class="proposal-action-btn donate" onclick="window.governanceApp.openDonationModal('${proposal.id}')">
                            <i class="fas fa-coins"></i>
                            <span>모금</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 제안 생성 모달 열기
    openProposalCreateModal() {
        document.getElementById('proposalCreateModal').classList.add('active');
    }

    // 제안 생성 모달 닫기
    closeProposalCreateModal() {
        document.getElementById('proposalCreateModal').classList.remove('active');
        // 입력 필드 초기화
        document.getElementById('proposalTitle').value = '';
        document.getElementById('proposalDescription').value = '';
        document.getElementById('proposalLabels').value = '';
    }

    // 제안 생성
    createProposal() {
        const title = document.getElementById('proposalTitle').value.trim();
        const description = document.getElementById('proposalDescription').value.trim();
        const labelsInput = document.getElementById('proposalLabels').value.trim();

        if (!title || !description) {
            alert('제목과 설명을 모두 입력해주세요.');
            return;
        }

        // 잔액 확인
        if (this.userBalance < 1) {
            alert('잔액이 부족합니다. (필요: 1B)');
            return;
        }

        const labels = labelsInput ? labelsInput.split(',').map(l => l.trim()).filter(l => l) : [];
        
        const proposal = {
            id: 'proposal-' + Date.now(),
            title,
            description,
            labels,
            status: 'new',
            createdAt: Date.now(),
            author: this.currentUser.uid,
            authorName: this.currentUser.displayName
        };

        // 제안 추가
        this.proposals.push(proposal);
        
        // 1B 차감 및 모금함에 추가
        this.userBalance -= 1;
        this.donations[proposal.id] = [{
            userId: this.currentUser.uid,
            amount: 1,
            timestamp: Date.now()
        }];

        // 저장
        this.saveToStorage('governance_proposals', this.proposals);
        this.saveToStorage('governance_donations', this.donations);

        // 모달 닫기 및 렌더링
        this.closeProposalCreateModal();
        this.renderProposals();

        // 성공 메시지
        this.showToast('제안이 성공적으로 생성되었습니다! (1B 차감)');
    }

    // 제안 투표
    async voteProposal(proposalId, voteType) {
        if (!this.currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }

        try {
            const votes = this.votes[proposalId] || { good: [], bad: [] };
            const userId = this.currentUser.did || this.currentUser.uid;

            // 이미 투표했는지 확인
            const hasVotedGood = votes.good.includes(userId);
            const hasVotedBad = votes.bad.includes(userId);

            if (voteType === 'good') {
                if (hasVotedGood) {
                    // 투표 취소
                    votes.good = votes.good.filter(id => id !== userId);
                } else {
                    // Good 투표
                    votes.good.push(userId);
                    // Bad 투표 제거
                    votes.bad = votes.bad.filter(id => id !== userId);
                }
            } else {
                if (hasVotedBad) {
                    // 투표 취소
                    votes.bad = votes.bad.filter(id => id !== userId);
                } else {
                    // Bad 투표
                    votes.bad.push(userId);
                    // Good 투표 제거
                    votes.good = votes.good.filter(id => id !== userId);
                }
            }

            this.votes[proposalId] = votes;
            this.saveToStorage('governance_votes', this.votes);

            // 메인 앱에 트랜잭션 전송
            await this.sendTransactionToMainApp('GOVERNANCE_VOTE', {
                proposalId: proposalId,
                voteType: voteType,
                voter: userId
            });

            this.renderProposals();
            this.updateProposalStatuses();
            
            console.log('✅ 투표 완료:', { proposalId, voteType });
        } catch (error) {
            console.error('투표 실패:', error);
            alert('투표 중 오류가 발생했습니다.');
        }
    }

    // 모금 모달 열기
    async openDonationModal(proposalId) {
        // 간단한 프롬프트로 처리 (실제로는 모달 구현)
        const amount = prompt('모금할 금액을 입력하세요 (B):');
        if (!amount || isNaN(amount) || amount <= 0) return;

        const donationAmount = parseFloat(amount);
        if (this.userBalance < donationAmount) {
            alert('잔액이 부족합니다.');
            return;
        }

        try {
            // 모금 추가
            if (!this.donations[proposalId]) {
                this.donations[proposalId] = [];
            }

            this.donations[proposalId].push({
                userId: this.currentUser.did || this.currentUser.uid,
                amount: donationAmount,
                timestamp: Date.now()
            });

            // 잔액 차감
            this.userBalance -= donationAmount;
            localStorage.setItem('userBalance', this.userBalance.toString());
            
            this.saveToStorage('governance_donations', this.donations);

            // 메인 앱에 트랜잭션 전송
            await this.sendTransactionToMainApp('GOVERNANCE_DONATION', {
                proposalId: proposalId,
                amount: donationAmount,
                donor: this.currentUser.did || this.currentUser.uid
            });

            this.renderProposals();
            
            console.log('✅ 모금 완료:', { proposalId, amount: donationAmount });
            alert(`${donationAmount}B를 모금했습니다! 블록체인에 기록되었습니다.`);
        } catch (error) {
            console.error('모금 실패:', error);
            alert('모금 중 오류가 발생했습니다.');
        }
    }

    // 제안 상세 보기
    showProposalDetail(proposalId) {
        const proposal = this.proposals.find(p => p.id === proposalId);
        if (!proposal) return;

        const modal = document.getElementById('proposalDetailModal');
        const title = document.getElementById('proposalDetailTitle');
        const content = document.getElementById('proposalDetailContent');

        const votes = this.votes[proposalId] || { good: [], bad: [] };
        const donations = this.donations[proposalId] || [];
        const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
        const goodRate = this.calculateGoodRate(proposalId);

        title.innerHTML = `<i class="fas fa-lightbulb"></i> ${proposal.title}`;
        
        content.innerHTML = `
            <div class="proposal-detail">
                <div class="proposal-detail-meta">
                    <span class="proposal-author">
                        <i class="fas fa-user"></i> ${proposal.authorName}
                    </span>
                    <span class="proposal-date">
                        <i class="fas fa-calendar"></i> ${new Date(proposal.createdAt).toLocaleDateString()}
                    </span>
                </div>
                <div class="proposal-labels">
                    ${proposal.labels.map(label => `<span class="proposal-label">${label}</span>`).join('')}
                </div>
                <div class="proposal-detail-description">
                    <h4>설명</h4>
                    <p>${proposal.description}</p>
                </div>
                <div class="proposal-detail-stats">
                    <div class="stat-card">
                        <i class="fas fa-thumbs-up"></i>
                        <div class="stat-value">${votes.good.length}</div>
                        <div class="stat-label">Good</div>
                    </div>
                    <div class="stat-card">
                        <i class="fas fa-thumbs-down"></i>
                        <div class="stat-value">${votes.bad.length}</div>
                        <div class="stat-label">Bad</div>
                    </div>
                    <div class="stat-card">
                        <i class="fas fa-percentage"></i>
                        <div class="stat-value">${goodRate.toFixed(1)}%</div>
                        <div class="stat-label">Good 비율</div>
                    </div>
                    <div class="stat-card">
                        <i class="fas fa-coins"></i>
                        <div class="stat-value">${totalDonations}B</div>
                        <div class="stat-label">모금액</div>
                    </div>
                </div>
                ${proposal.status === 'waiting' ? `
                    <div class="proposal-waiting-info">
                        <i class="fas fa-info-circle"></i>
                        <span>협업 대기 중 - 순위: ${this.getWaitingRank(proposalId)}위</span>
                    </div>
                ` : ''}
            </div>
        `;

        modal.classList.add('active');
    }

    // 제안 상세 모달 닫기
    closeProposalDetailModal() {
        document.getElementById('proposalDetailModal').classList.remove('active');
    }

    // 협업 대기 순위 가져오기
    getWaitingRank(proposalId) {
        const waitingProposals = this.proposals
            .filter(p => p.status === 'waiting')
            .sort((a, b) => this.getGoodVoterCount(b.id) - this.getGoodVoterCount(a.id));
        
        return waitingProposals.findIndex(p => p.id === proposalId) + 1;
    }

    // 토스트 메시지
    showToast(message) {
        // 간단한 알림으로 대체 (실제로는 토스트 UI 구현)
        console.log('🔔', message);
        // alert(message);
    }

    // 협업 단계 로드
    loadCollaboration() {
        this.checkAndStartCollaboration();
        this.renderCollaboration();
    }

    // 협업 시작 확인
    checkAndStartCollaboration() {
        // 현재 진행 중인 협업이 없고, 대기 중인 제안이 있으면 시작
        if (!this.collaborations.current) {
            const waitingProposals = this.proposals
                .filter(p => p.status === 'waiting')
                .sort((a, b) => this.getGoodVoterCount(b.id) - this.getGoodVoterCount(a.id));

            if (waitingProposals.length > 0) {
                const topProposal = waitingProposals[0];
                const goodRate = this.calculateGoodRate(topProposal.id);
                
                // 60% 이상인지 재확인
                if (goodRate >= 60) {
                    this.startCollaboration(topProposal);
                }
            }
        }
    }

    // 협업 시작
    startCollaboration(proposal) {
        this.collaborations.current = {
            proposalId: proposal.id,
            proposal: proposal,
            stage: 'waiting', // waiting, core, complementary
            corePRs: [],
            complementaryPRs: [],
            selectedCorePR: null,
            selectedComplementaryPR: null,
            startedAt: Date.now()
        };

        // 제안 상태 업데이트
        proposal.status = 'collaborating';
        
        // 제안자에게 15% 보상 지급
        const donations = this.donations[proposal.id] || [];
        const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
        const proposerReward = totalDonations * 0.15;
        
        console.log(`제안자 ${proposal.authorName}에게 ${proposerReward}B 지급`);
        
        this.saveToStorage('governance_collaborations', this.collaborations);
        this.saveToStorage('governance_proposals', this.proposals);
        
        this.showToast('새로운 협업이 시작되었습니다!');
    }

    // 협업 렌더링
    renderCollaboration() {
        const container = document.getElementById('collabContainer');
        if (!container) return;

        const collab = this.collaborations.current;
        
        if (!collab) {
            container.innerHTML = `
                <div class="collab-empty-state">
                    <i class="fas fa-handshake"></i>
                    <p>현재 진행 중인 협업 안건이 없습니다.</p>
                    <p class="collab-empty-subtitle">제안 단계의 협업대기 안건이 자동으로 진입합니다.</p>
                </div>
            `;
            return;
        }

        const proposal = collab.proposal;
        const votes = this.votes[proposal.id] || { good: [], bad: [] };
        const donations = this.donations[proposal.id] || [];
        const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);

        container.innerHTML = `
            <div class="collab-content">
                <div class="collab-proposal-info">
                    <h2 class="collab-proposal-title">${proposal.title}</h2>
                    <div class="proposal-labels">
                        ${proposal.labels.map(label => `<span class="proposal-label">${label}</span>`).join('')}
                    </div>
                    <p class="proposal-description">${proposal.description}</p>
                    <div class="proposal-stats">
                        <div class="proposal-stat good">
                            <i class="fas fa-thumbs-up"></i>
                            <span>${votes.good.length}</span>
                        </div>
                        <div class="proposal-stat bad">
                            <i class="fas fa-thumbs-down"></i>
                            <span>${votes.bad.length}</span>
                        </div>
                        <div class="proposal-stat donation">
                            <i class="fas fa-coins"></i>
                            <span>${totalDonations}B</span>
                        </div>
                    </div>
                </div>

                ${this.renderPRSection(collab)}
            </div>
        `;
    }

    // PR 섹션 렌더링
    renderPRSection(collab) {
        if (collab.stage === 'waiting') {
            return `
                <div class="pr-section">
                    <div class="pr-section-header">
                        <h3 class="pr-section-title">Core PR</h3>
                        <button class="fork-btn" onclick="window.governanceApp.createFork('core')">
                            <i class="fas fa-code-branch"></i>
                            포크
                        </button>
                    </div>
                    <div class="pr-waiting-state">
                        <i class="fas fa-clock"></i>
                        <p>첫 번째 PR을 기다리고 있습니다...</p>
                    </div>
                </div>
            `;
        } else if (collab.stage === 'core') {
            const timeLeft = this.getTimeLeft(collab.stageStartedAt, 7);
            return `
                <div class="pr-section">
                    <div class="pr-section-header">
                        <h3 class="pr-section-title">Core PR (${timeLeft} 남음)</h3>
                        <button class="fork-btn" onclick="window.governanceApp.createFork('core')">
                            <i class="fas fa-code-branch"></i>
                            포크
                        </button>
                    </div>
                    <div class="pr-list">
                        ${this.renderNoneGoodPR('core')}
                        ${collab.corePRs.map(pr => this.renderPRCard(pr, 'core')).join('')}
                    </div>
                </div>
            `;
        } else if (collab.stage === 'complementary') {
            // Core PR 결과 표시
            const corePR = collab.corePRs.find(pr => pr.id === collab.selectedCorePR);
            const timeLeft = this.getTimeLeft(collab.stageStartedAt, 7);
            
            return `
                <div class="pr-section">
                    <div class="selected-pr-section">
                        <h3 class="pr-section-title">선정된 Core PR</h3>
                        ${this.renderPRCard(corePR, 'core', true)}
                    </div>
                </div>
                
                <div class="pr-section">
                    <div class="pr-section-header">
                        <h3 class="pr-section-title">Complementary PR (${timeLeft} 남음)</h3>
                        <button class="fork-btn" onclick="window.governanceApp.createFork('complementary')">
                            <i class="fas fa-code-branch"></i>
                            포크
                        </button>
                    </div>
                    <div class="pr-list">
                        ${this.renderNoneGoodPR('complementary')}
                        ${collab.complementaryPRs.map(pr => this.renderPRCard(pr, 'complementary')).join('')}
                    </div>
                </div>
            `;
        }
    }

    // None Good PR 카드 렌더링
    renderNoneGoodPR(stage) {
        const collab = this.collaborations.current;
        const prId = `none-good-${stage}`;
        const votes = this.prs[collab.proposalId]?.[stage]?.votes?.[prId] || [];

        return `
            <div class="pr-card none-good">
                <div class="pr-card-header">
                    <div>
                        <h4 class="pr-title">None Good PR</h4>
                        <p class="pr-author">모든 PR이 부적절한 경우 선택</p>
                    </div>
                    <div class="pr-votes">
                        <i class="fas fa-vote-yea"></i>
                        <span>${votes.length}</span>
                    </div>
                </div>
                <p class="pr-description">제출된 PR 중 적절한 것이 없다고 판단되는 경우 이 옵션에 투표하세요.</p>
                <div class="pr-actions">
                    <button class="pr-action-btn vote" onclick="window.governanceApp.votePR('${prId}', '${stage}')">
                        <i class="fas fa-vote-yea"></i>
                        투표
                    </button>
                </div>
            </div>
        `;
    }

    // PR 카드 렌더링
    renderPRCard(pr, stage, isSelected = false) {
        const collab = this.collaborations.current;
        const votes = this.prs[collab.proposalId]?.[stage]?.votes?.[pr.id] || [];

        return `
            <div class="pr-card ${isSelected ? 'selected' : ''}">
                <div class="pr-card-header">
                    <div>
                        <h4 class="pr-title">${pr.title}</h4>
                        <p class="pr-author">by ${pr.authorName}</p>
                    </div>
                    <div class="pr-votes">
                        <i class="fas fa-vote-yea"></i>
                        <span>${votes.length}</span>
                    </div>
                </div>
                <p class="pr-description">${pr.description}</p>
                <div class="pr-files">
                    <i class="fas fa-file-code"></i>
                    <span>${pr.files}</span>
                </div>
                <div class="pr-actions">
                    ${!isSelected ? `
                        <button class="pr-action-btn vote" onclick="window.governanceApp.votePR('${pr.id}', '${stage}')">
                            <i class="fas fa-vote-yea"></i>
                            투표
                        </button>
                    ` : ''}
                    <button class="pr-action-btn" onclick="window.governanceApp.viewPRComments('${pr.id}', '${stage}')">
                        <i class="fas fa-comments"></i>
                        코멘트
                    </button>
                </div>
            </div>
        `;
    }

    // 남은 시간 계산
    getTimeLeft(startTime, days) {
        const endTime = startTime + (days * 24 * 60 * 60 * 1000);
        const now = Date.now();
        const timeLeft = endTime - now;
        
        if (timeLeft <= 0) return '종료됨';
        
        const daysLeft = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
        const hoursLeft = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        
        if (daysLeft > 0) return `${daysLeft}일 ${hoursLeft}시간`;
        return `${hoursLeft}시간`;
    }

    // 포크 생성
    createFork(prType) {
        const collab = this.collaborations.current;
        if (!collab) return;

        const fork = {
            id: 'fork-' + Date.now(),
            proposalId: collab.proposalId,
            prType: prType,
            createdAt: Date.now(),
            author: this.currentUser.uid,
            authorName: this.currentUser.displayName,
            files: {} // 실제로는 시스템 파일들의 복사본
        };

        this.forks.push(fork);
        this.saveToStorage('governance_forks', this.forks);

        // PR 생성 모달 열기
        this.openPRCreateModal(prType, fork.id);
    }

    // PR 생성 모달 열기
    openPRCreateModal(prType, forkId) {
        const modal = document.getElementById('prCreateModal');
        const title = document.getElementById('prCreateTitle');
        
        title.innerHTML = `<i class="fas fa-code-branch"></i> ${prType === 'core' ? 'Core' : 'Complementary'} PR 생성`;
        
        modal.dataset.prType = prType;
        modal.dataset.forkId = forkId;
        modal.classList.add('active');
    }

    // PR 생성 모달 닫기
    closePRCreateModal() {
        const modal = document.getElementById('prCreateModal');
        modal.classList.remove('active');
        
        // 입력 필드 초기화
        document.getElementById('prTitle').value = '';
        document.getElementById('prDescription').value = '';
        document.getElementById('prFiles').value = '';
    }

    // PR 생성
    createPR() {
        const modal = document.getElementById('prCreateModal');
        const prType = modal.dataset.prType;
        const forkId = modal.dataset.forkId;
        
        const title = document.getElementById('prTitle').value.trim();
        const description = document.getElementById('prDescription').value.trim();
        const files = document.getElementById('prFiles').value.trim();

        if (!title || !description || !files) {
            alert('모든 필드를 입력해주세요.');
            return;
        }

        const collab = this.collaborations.current;
        if (!collab) return;

        const pr = {
            id: 'pr-' + Date.now(),
            title,
            description,
            files,
            forkId,
            author: this.currentUser.uid,
            authorName: this.currentUser.displayName,
            createdAt: Date.now()
        };

        // PR 추가
        if (!this.prs[collab.proposalId]) {
            this.prs[collab.proposalId] = {
                core: { prs: [], votes: {} },
                complementary: { prs: [], votes: {} }
            };
        }

        if (prType === 'core') {
            collab.corePRs.push(pr);
            this.prs[collab.proposalId].core.prs.push(pr);
            
            // 첫 PR이면 Core PR 단계 시작
            if (collab.stage === 'waiting') {
                collab.stage = 'core';
                collab.stageStartedAt = Date.now();
            }
        } else {
            collab.complementaryPRs.push(pr);
            this.prs[collab.proposalId].complementary.prs.push(pr);
        }

        this.saveToStorage('governance_collaborations', this.collaborations);
        this.saveToStorage('governance_prs', this.prs);

        this.closePRCreateModal();
        this.renderCollaboration();
        
        this.showToast('PR이 성공적으로 생성되었습니다!');
    }

    // PR 투표
    votePR(prId, stage) {
        if (!this.currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }

        const collab = this.collaborations.current;
        if (!collab) return;

        const userId = this.currentUser.uid;
        const prVotes = this.prs[collab.proposalId][stage].votes;

        // 기존 투표 제거
        Object.keys(prVotes).forEach(id => {
            prVotes[id] = prVotes[id].filter(uid => uid !== userId);
        });

        // 새로운 투표 추가
        if (!prVotes[prId]) {
            prVotes[prId] = [];
        }
        prVotes[prId].push(userId);

        this.saveToStorage('governance_prs', this.prs);
        this.renderCollaboration();
        
        this.showToast('투표가 완료되었습니다!');
    }

    // Core PR 단계 종료
    finalizeCorePRStage() {
        const collab = this.collaborations.current;
        if (!collab || collab.stage !== 'core') return;

        const prVotes = this.prs[collab.proposalId].core.votes;
        let topPR = null;
        let maxVotes = 0;

        // 가장 많은 투표를 받은 PR 찾기
        Object.entries(prVotes).forEach(([prId, votes]) => {
            if (votes.length > maxVotes) {
                maxVotes = votes.length;
                topPR = prId;
            }
        });

        // DCA 검증 - None Good PR보다 많은 투표를 받은 PR들
        const noneGoodVotes = prVotes['none-good-core']?.length || 0;
        collab.corePRs.forEach(pr => {
            const prVoteCount = prVotes[pr.id]?.length || 0;
            if (prVoteCount > noneGoodVotes) {
                this.verifyCollaborationDCA(pr.id, 'core');
            }
        });

        // None Good PR이 가장 많은 투표를 받았으면 재시작
        if (topPR === 'none-good-core') {
            collab.corePRs = [];
            collab.stageStartedAt = Date.now();
            this.prs[collab.proposalId].core = { prs: [], votes: {} };
            
            this.showToast('None Good PR이 선정되어 Core PR 단계가 재시작됩니다.');
        } else if (topPR) {
            // Core PR 선정
            collab.selectedCorePR = topPR;
            collab.stage = 'complementary';
            collab.stageStartedAt = Date.now();
            
            // Core PR 작성자에게 40% 보상 지급
            const donations = this.donations[collab.proposal.id] || [];
            const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
            const corePRReward = totalDonations * 0.40;
            
            const selectedPR = collab.corePRs.find(pr => pr.id === topPR);
            console.log(`Core PR 작성자 ${selectedPR.authorName}에게 ${corePRReward}B 지급`);
            
            this.showToast('Core PR이 선정되었습니다! Complementary PR 단계가 시작됩니다.');
        }

        this.saveToStorage('governance_collaborations', this.collaborations);
        this.renderCollaboration();
    }

    // Complementary PR 단계 종료
    finalizeComplementaryPRStage() {
        const collab = this.collaborations.current;
        if (!collab || collab.stage !== 'complementary') return;

        const prVotes = this.prs[collab.proposalId].complementary.votes;
        let topPR = null;
        let maxVotes = 0;

        // 가장 많은 투표를 받은 PR 찾기
        Object.entries(prVotes).forEach(([prId, votes]) => {
            if (votes.length > maxVotes) {
                maxVotes = votes.length;
                topPR = prId;
            }
        });

        // DCA 검증 - None Good PR보다 많은 투표를 받은 PR들
        const noneGoodVotes = prVotes['none-good-complementary']?.length || 0;
        collab.complementaryPRs.forEach(pr => {
            const prVoteCount = prVotes[pr.id]?.length || 0;
            if (prVoteCount > noneGoodVotes) {
                this.verifyCollaborationDCA(pr.id, 'complementary');
            }
        });

        // None Good PR이 가장 많은 투표를 받았으면 재시작
        if (topPR === 'none-good-complementary') {
            collab.complementaryPRs = [];
            collab.stageStartedAt = Date.now();
            this.prs[collab.proposalId].complementary = { prs: [], votes: {} };
            
            this.showToast('None Good PR이 선정되어 Complementary PR 단계가 재시작됩니다.');
        } else if (topPR) {
            // Complementary PR 선정
            collab.selectedComplementaryPR = topPR;
            
            // Complementary PR 작성자에게 35% 보상 지급
            const donations = this.donations[collab.proposal.id] || [];
            const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
            const complePRReward = totalDonations * 0.35;
            
            const selectedPR = collab.complementaryPRs.find(pr => pr.id === topPR);
            console.log(`Complementary PR 작성자 ${selectedPR.authorName}에게 ${complePRReward}B 지급`);
            
            // 시스템에 변경사항 적용 (실제로는 파일 시스템 업데이트)
            this.applyChangesToSystem(collab);
            
            // 평가 단계로 이동
            this.moveToEvaluation(collab);
            
            this.showToast('협업이 완료되었습니다! 평가 단계로 이동합니다.');
        }

        this.saveToStorage('governance_collaborations', this.collaborations);
    }

    // 시스템에 변경사항 적용
    applyChangesToSystem(collab) {
        console.log('시스템에 PR 변경사항 적용 중...');
        // 실제로는 선정된 PR들의 변경사항을 시스템 파일에 적용
        // 자동 배포 프로세스 실행
    }

    // 평가 단계로 이동
    moveToEvaluation(collab) {
        const evaluation = {
            id: 'eval-' + Date.now(),
            proposalId: collab.proposal.id,
            proposal: collab.proposal,
            corePR: collab.corePRs.find(pr => pr.id === collab.selectedCorePR),
            complementaryPR: collab.complementaryPRs.find(pr => pr.id === collab.selectedComplementaryPR),
            status: 'evaluating',
            startedAt: Date.now(),
            feedbacks: []
        };

        this.evaluations.push(evaluation);
        this.saveToStorage('governance_evaluations', this.evaluations);

        // 현재 협업 종료
        this.collaborations.current = null;
        this.collaborations.history = this.collaborations.history || [];
        this.collaborations.history.push(collab);
        this.saveToStorage('governance_collaborations', this.collaborations);

        // 다음 대기 제안 확인
        this.checkAndStartCollaboration();
    }

    // 평가 단계 로드
    loadEvaluations() {
        this.renderEvaluations();
    }

    // 평가 렌더링
    renderEvaluations() {
        const container = document.getElementById('evaluationList');
        if (!container) return;

        // 필터링된 평가 목록
        const filteredEvaluations = this.evaluations.filter(evaluation => {
            if (this.currentEvaluationFilter === 'evaluating') {
                return evaluation.status === 'evaluating';
            } else if (this.currentEvaluationFilter === 'completed') {
                return evaluation.status === 'completed';
            }
            return true;
        });

        // 정렬 (최신순)
        filteredEvaluations.sort((a, b) => b.startedAt - a.startedAt);

        if (filteredEvaluations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-star"></i>
                    <p>${this.currentEvaluationFilter === 'evaluating' ? '평가 중인 안건이 없습니다.' : '완료된 평가가 없습니다.'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredEvaluations.map(evaluation => {
            const feedbacks = this.feedbacks[evaluation.id] || [];
            const timeLeft = evaluation.status === 'evaluating' ? this.getTimeLeft(evaluation.startedAt, 21) : '';
            
            return `
                <div class="evaluation-card ${evaluation.status === 'completed' ? 'completed' : ''}" 
                     onclick="window.governanceApp.showEvaluationDetail('${evaluation.id}')">
                    <div class="evaluation-header">
                        <h3 class="evaluation-title">${evaluation.proposal.title}</h3>
                        ${evaluation.status === 'evaluating' ? 
                            `<span class="evaluation-time">${timeLeft} 남음</span>` :
                            `<span class="evaluation-completed">완료됨</span>`
                        }
                    </div>
                    <div class="evaluation-info">
                        <div class="evaluation-pr-info">
                            <span class="pr-badge core">Core PR: ${evaluation.corePR.title}</span>
                            <span class="pr-badge complementary">Comple PR: ${evaluation.complementaryPR.title}</span>
                        </div>
                        <div class="evaluation-stats">
                            <div class="evaluation-stat">
                                <i class="fas fa-comments"></i>
                                <span>${feedbacks.length} 피드백</span>
                            </div>
                        </div>
                    </div>
                    ${evaluation.status === 'evaluating' ? `
                        <div class="evaluation-actions" onclick="event.stopPropagation()">
                            <button class="evaluation-action-btn" onclick="window.governanceApp.openFeedbackModal('${evaluation.id}')">
                                <i class="fas fa-comment"></i>
                                피드백 작성
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // 평가 상세 보기
    showEvaluationDetail(evaluationId) {
        const evaluation = this.evaluations.find(e => e.id === evaluationId);
        if (!evaluation) return;

        const modal = document.getElementById('proposalDetailModal');
        const title = document.getElementById('proposalDetailTitle');
        const content = document.getElementById('proposalDetailContent');

        const feedbacks = this.feedbacks[evaluationId] || [];
        const donations = this.donations[evaluation.proposalId] || [];
        const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);

        title.innerHTML = `<i class="fas fa-star"></i> ${evaluation.proposal.title} - 평가`;
        
        content.innerHTML = `
            <div class="evaluation-detail">
                <div class="evaluation-detail-section">
                    <h4>제안 정보</h4>
                    <p>${evaluation.proposal.description}</p>
                    <div class="proposal-labels">
                        ${evaluation.proposal.labels.map(label => `<span class="proposal-label">${label}</span>`).join('')}
                    </div>
                </div>
                
                <div class="evaluation-detail-section">
                    <h4>적용된 PR</h4>
                    <div class="pr-summary">
                        <div class="pr-summary-item">
                            <h5>Core PR</h5>
                            <p class="pr-title">${evaluation.corePR.title}</p>
                            <p class="pr-author">by ${evaluation.corePR.authorName}</p>
                            <p class="pr-description">${evaluation.corePR.description}</p>
                        </div>
                        <div class="pr-summary-item">
                            <h5>Complementary PR</h5>
                            <p class="pr-title">${evaluation.complementaryPR.title}</p>
                            <p class="pr-author">by ${evaluation.complementaryPR.authorName}</p>
                            <p class="pr-description">${evaluation.complementaryPR.description}</p>
                        </div>
                    </div>
                </div>
                
                <div class="evaluation-detail-section">
                    <h4>피드백 (${feedbacks.length}개)</h4>
                    ${this.renderFeedbackList(feedbacks, evaluation.status === 'evaluating')}
                </div>
                
                <div class="evaluation-detail-section">
                    <h4>보상 정보</h4>
                    <div class="reward-info">
                        <div class="reward-item">
                            <span class="reward-label">총 모금액:</span>
                            <span class="reward-value">${totalDonations}B</span>
                        </div>
                        <div class="reward-item">
                            <span class="reward-label">제안자 (15%):</span>
                            <span class="reward-value">${(totalDonations * 0.15).toFixed(2)}B</span>
                        </div>
                        <div class="reward-item">
                            <span class="reward-label">Core PR (40%):</span>
                            <span class="reward-value">${(totalDonations * 0.40).toFixed(2)}B</span>
                        </div>
                        <div class="reward-item">
                            <span class="reward-label">Complementary PR (35%):</span>
                            <span class="reward-value">${(totalDonations * 0.35).toFixed(2)}B</span>
                        </div>
                        <div class="reward-item">
                            <span class="reward-label">1위 평가자 (10%):</span>
                            <span class="reward-value">${(totalDonations * 0.10).toFixed(2)}B</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        modal.classList.add('active');
    }

    // 피드백 목록 렌더링
    renderFeedbackList(feedbacks, canVote) {
        if (!feedbacks || feedbacks.length === 0) {
            return '<p class="no-feedback">아직 피드백이 없습니다.</p>';
        }

        // None Good Feedback 추가
        const noneGoodVotes = feedbacks.filter(f => f.id === 'none-good-feedback').length;
        let feedbackHtml = `
            <div class="feedback-item none-good">
                <div class="feedback-header">
                    <span class="feedback-author">None Good Feedback</span>
                    <div class="feedback-votes">
                        <i class="fas fa-vote-yea"></i>
                        <span>${noneGoodVotes}</span>
                    </div>
                </div>
                <p class="feedback-content">모든 피드백이 부적절한 경우 선택</p>
                ${canVote ? `
                    <button class="feedback-vote-btn" onclick="window.governanceApp.voteFeedback('none-good-feedback')">
                        <i class="fas fa-vote-yea"></i> 투표
                    </button>
                ` : ''}
            </div>
        `;

        // 일반 피드백들
        const regularFeedbacks = feedbacks.filter(f => f.id !== 'none-good-feedback');
        feedbackHtml += regularFeedbacks.map(feedback => `
            <div class="feedback-item">
                <div class="feedback-header">
                    <span class="feedback-author">${feedback.authorName}</span>
                    <div class="feedback-votes">
                        <i class="fas fa-vote-yea"></i>
                        <span>${feedback.votes || 0}</span>
                    </div>
                </div>
                <p class="feedback-content">${feedback.content}</p>
                ${canVote ? `
                    <button class="feedback-vote-btn" onclick="window.governanceApp.voteFeedback('${feedback.id}')">
                        <i class="fas fa-vote-yea"></i> 투표
                    </button>
                ` : ''}
            </div>
        `).join('');

        return feedbackHtml;
    }

    // 피드백 모달 열기
    openFeedbackModal(evaluationId) {
        const modal = document.getElementById('feedbackModal');
        modal.dataset.evaluationId = evaluationId;
        modal.classList.add('active');
    }

    // 피드백 모달 닫기
    closeFeedbackModal() {
        const modal = document.getElementById('feedbackModal');
        modal.classList.remove('active');
        document.getElementById('feedbackContent').value = '';
    }

    // 피드백 생성
    createFeedback() {
        const modal = document.getElementById('feedbackModal');
        const evaluationId = modal.dataset.evaluationId;
        const content = document.getElementById('feedbackContent').value.trim();

        if (!content) {
            alert('피드백 내용을 입력해주세요.');
            return;
        }

        const feedback = {
            id: 'feedback-' + Date.now(),
            evaluationId,
            content,
            author: this.currentUser.uid,
            authorName: this.currentUser.displayName,
            createdAt: Date.now(),
            votes: 0
        };

        // 피드백 추가
        if (!this.feedbacks[evaluationId]) {
            this.feedbacks[evaluationId] = [];
        }

        // 첫 피드백이면 None Good Feedback 자동 추가
        if (this.feedbacks[evaluationId].length === 0) {
            this.feedbacks[evaluationId].push({
                id: 'none-good-feedback',
                evaluationId,
                content: '모든 피드백이 부적절한 경우 선택',
                votes: 0
            });
        }

        this.feedbacks[evaluationId].push(feedback);
        this.saveToStorage('governance_feedbacks', this.feedbacks);

        this.closeFeedbackModal();
        this.renderEvaluations();
        
        this.showToast('피드백이 등록되었습니다!');
    }

    // 피드백 투표
    voteFeedback(feedbackId) {
        // 실제 구현 시 사용자별 투표 관리
        console.log('피드백 투표:', feedbackId);
        this.showToast('피드백에 투표했습니다!');
    }

    // 평가 보상 분배
    distributeEvaluationReward(evaluationId) {
        const evaluation = this.evaluations.find(e => e.id === evaluationId);
        if (!evaluation) return;

        const feedbacks = this.feedbacks[evaluationId] || [];
        const regularFeedbacks = feedbacks.filter(f => f.id !== 'none-good-feedback');
        
        if (regularFeedbacks.length === 0) return;

        // None Good Feedback 투표 수
        const noneGoodFeedback = feedbacks.find(f => f.id === 'none-good-feedback');
        const noneGoodVotes = noneGoodFeedback?.votes || 0;

        // DCA 검증 - None Good Feedback보다 많은 투표를 받은 피드백들
        regularFeedbacks.forEach(feedback => {
            if (feedback.votes > noneGoodVotes) {
                this.verifyEvaluationDCA(feedback.id, evaluationId);
            }
        });

        // 가장 많은 투표를 받은 피드백 찾기
        let topFeedback = null;
        let maxVotes = 0;

        regularFeedbacks.forEach(feedback => {
            if (feedback.votes > maxVotes) {
                maxVotes = feedback.votes;
                topFeedback = feedback;
            }
        });

        if (topFeedback) {
            const donations = this.donations[evaluation.proposalId] || [];
            const totalDonations = donations.reduce((sum, d) => sum + d.amount, 0);
            const evaluatorReward = totalDonations * 0.10;
            
            console.log(`1위 평가자 ${topFeedback.authorName}에게 ${evaluatorReward}B 지급`);
        }
    }

    async loadInitialData() {
        // 서버에서 거버넌스 데이터 로드
        try {
            await this.loadProposals();
            console.log('거버넌스 시스템 초기화 완료');
        } catch (error) {
            console.error('초기 데이터 로드 실패:', error);
        }
    }

    // 제안 목록 로드
    async loadProposals() {
        try {
            // 로컬 스토리지에서 데이터 로드
            this.proposals = this.loadFromStorage('governance_proposals') || [];
            this.votes = this.loadFromStorage('governance_votes') || {};
            this.donations = this.loadFromStorage('governance_donations') || {};
            
            // 사용자 잔액 로드
            const savedBalance = localStorage.getItem('userBalance');
            if (savedBalance) {
                this.userBalance = parseFloat(savedBalance);
            }
            
            this.renderProposals();
            console.log('📋 제안 목록 로드 완료:', this.proposals.length + '개');
        } catch (error) {
            console.error('제안 목록 로드 실패:', error);
            this.proposals = [];
            this.votes = {};
            this.donations = {};
        }
    }

    // 시스템 파일 로드
    loadSystemFiles() {
        const fileList = document.getElementById('systemFileList');
        if (!fileList) {
            console.warn('systemFileList 요소를 찾을 수 없습니다. 잠시 후 다시 시도합니다.');
            setTimeout(() => this.loadSystemFiles(), 500);
            return;
        }

        // 검증자 가이드 파일만 표시
        const files = [
            { name: 'docs/', type: 'folder', path: 'docs', isOpen: true },
            { name: 'validator-guide.md', type: 'file', path: 'docs/validator-guide.md', parent: 'docs', size: '28B' }
        ];

        fileList.innerHTML = files.map(file => {
            if (file.type === 'folder') {
                return `
                    <div class="file-item folder" data-path="${file.path}">
                        <div class="file-info" onclick="window.governanceApp.toggleFolder('${file.path}')">
                            <i class="fas ${file.isOpen ? 'fa-folder-open' : 'fa-folder'}"></i>
                            <span class="file-name">${file.name}</span>
                        </div>
                    </div>
                `;
            } else {
                const isInFolder = file.parent;
                const folderFile = files.find(f => f.path === file.parent);
                const shouldShow = !isInFolder || (folderFile && folderFile.isOpen);
                
                                 return `
                     <div class="file-item ${isInFolder ? 'nested' : ''}" data-path="${file.path}" style="${shouldShow ? '' : 'display: none;'}">
                         <div class="file-info" onclick="window.governanceApp.viewFile('${file.path}', '${file.name}')" style="cursor: pointer;">
                             <i class="fas ${this.getFileIcon(file.name)}"></i>
                             <span class="file-name">${file.name}</span>
                             <span class="file-size">${file.size}</span>
                         </div>
                     </div>
                 `;
            }
        }).join('');


    }

    // 파일 아이콘 결정
    getFileIcon(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            'md': 'fa-file-alt',
            'js': 'fa-file-code',
            'json': 'fa-file-code',
            'html': 'fa-file-code',
            'css': 'fa-file-code',
            'txt': 'fa-file-alt',
            'yml': 'fa-file-code',
            'yaml': 'fa-file-code'
        };
        return iconMap[ext] || 'fa-file';
    }

    // 폴더 토글
    toggleFolder(folderPath) {
        const fileList = document.getElementById('systemFileList');
        const folderItem = fileList.querySelector(`[data-path="${folderPath}"]`);
        const folderIcon = folderItem.querySelector('i');
        
        // 폴더 상태 토글
        const isOpen = folderIcon.classList.contains('fa-folder-open');
        folderIcon.className = `fas ${isOpen ? 'fa-folder' : 'fa-folder-open'}`;
        
        // 하위 파일들 표시/숨김
        const nestedItems = fileList.querySelectorAll('.nested');
        nestedItems.forEach(item => {
            const itemPath = item.dataset.path;
            if (itemPath.startsWith(folderPath + '/')) {
                item.style.display = isOpen ? 'none' : 'flex';
            }
        });
    }

    // 구버전 loadProposals 함수 제거됨 - renderProposals 함수 사용

    // 구버전 loadCollabs 함수 제거됨 - renderCollaboration 함수 사용

    // 구버전 loadMerges 함수 제거됨 - renderEvaluations 함수 사용

    loadForks() {
        const forkList = document.getElementById('forkList');
        if (!forkList) return;

        const userForks = this.forks.filter(fork => fork.author === this.currentUser.uid);

        if (userForks.length === 0) {
            forkList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-code-branch"></i>
                    <p>아직 생성한 포크가 없습니다.</p>
                    <p class="empty-subtitle">협업 단계에서 포크를 생성하여 PR을 제출할 수 있습니다.</p>
                </div>
            `;
            return;
        }

        forkList.innerHTML = userForks.map(fork => {
            const proposal = this.proposals.find(p => p.id === fork.proposalId);
            return `
                <div class="fork-card">
                    <div class="fork-header">
                        <h3 class="fork-title">
                            <i class="fas fa-code-branch"></i>
                            ${fork.prType === 'core' ? 'Core' : 'Complementary'} PR 포크
                        </h3>
                        <span class="fork-date">${new Date(fork.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="fork-info">
                        <p class="fork-proposal">제안: ${proposal ? proposal.title : '알 수 없음'}</p>
                        <p class="fork-id">포크 ID: ${fork.id}</p>
                    </div>
                    <div class="fork-actions">
                        <button class="fork-action-btn" onclick="window.governanceApp.viewForkDetails('${fork.id}')">
                            <i class="fas fa-eye"></i> 상세보기
                        </button>
                        <button class="fork-action-btn edit" onclick="window.governanceApp.editFork('${fork.id}')">
                            <i class="fas fa-edit"></i> 수정하기
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    getStatusText(status) {
        const statusMap = {
            'reviewing': '검토중',
            'approved': '승인됨',
            'voting': '투표중',
            'completed': '완료',
            'pending': '대기중',
            'merged': '병합됨',
            'active': '활성',
            'inactive': '비활성'
        };
        return statusMap[status] || status;
    }

    // 필터 함수들
    filterProposals(filterType) {
        // 구현 예정
        console.log('🔍 제안 필터:', filterType);
    }

    filterCollabs(filterType) {
        // 구현 예정
        console.log('🔍 협업 필터:', filterType);
    }

    filterMerges(filterType) {
        // 구현 예정
        console.log('🔍 병합 필터:', filterType);
    }

    // 액션 함수들
    viewFile(path, fileName) {
        console.log('👁️ 파일 보기:', path, fileName);
        
        // 파일 내용 가져오기
        const fileContent = this.getFileContent(path);
        
        // 파일 보기 모달 표시
        this.showFileModal(fileName, fileContent, path);
    }

    // 파일 내용 가져오기 (실제 파일 내용 시뮬레이션)
    getFileContent(path) {
        const fileContents = {
            'docs/validator-guide.md': '# 검증자 가이드\n\n## 개요\nBROTHERHOOD 검증자 노드 운영 가이드입니다.\n\n## 시작하기\n1. 노드 소프트웨어 설치\n2. 설정 파일 구성\n3. 검증자 등록\n4. 노드 시작\n\n## 요구사항\n- 최소 4GB RAM\n- 100GB 저장공간\n- 안정적인 인터넷 연결\n\n## 보상 체계\n검증자는 블록 생성 및 트랜잭션 검증에 대한 보상을 받습니다.',
            
            'docs/protocol_overview.md': '# BROTHERHOOD 개요\n\nBROTHERHOOD는 기여한 만큼 보장받는 사회규약을 실현하기 위해 설계된 기여기반 탈중앙 사회시스템입니다.\n\n## 문제\n\n구성원과 공동체간 기여-보장의 등가교환은 공동체유지 및 운영의 핵심원리이지만, 다음과 같은 현대사회의 구조적 결함으로 인해 구성원의 기여에 대한 보장이 실질적으로 이루어지지 않고 있습니다.\n\n1. **비생산적 경제구조**: 생산에 기반하지 않는 화폐발행은 물가대비 임금상승분 격차를 만들고, 구성원은 점진적으로 기여에 대한 분배권을 잃어가며 결국 경기침체와 자산시장붕괴를 맞닥뜨립니다.\n\n2. **불안정한 연금구조**: 사회보장제도는 생산인구의 기여에 달려있으나 분배권의 점진적 상실은 생산위축을 유발하여 생존권마저 상실하게 될 뿐더러, 미래유예적 연금수급 구조는 생존권의 실질적 보장이라 보기 어렵습니다.\n\n3. **대의 정치구조**: 의사결정의 효율을 위해 구성원은 참정의 대리인을 선출하고, 참정권은 대리인에게 위임됩니다.\n\n## 대안\n\n백야 프로토콜은 DAO공동체에 대한 기여활동을 기반으로 화폐토큰과 참정토큰을 발행함으로써 기여분배권 및 기여생존권, 기여참정권을 보장합니다.\n\n## 핵심 구조\n\n### DAO-consortium\n공통의 목적을 가진 탈중앙화 자율 조직으로, 프로토콜상 각각의 모든 DAO는 공통목적과 이에 대한 기여활동을 지정합니다.\n\n### CVCM (기여-검증-계산-발행)\n기여-> 검증-> 계산-> 발행 메커니즘으로, 구성원의 기여를 증명하여 화폐(B-token)를 발행합니다.',
            
            'docs/relay-architecture.md': '# 릴레이 아키텍처\n\n## 개요\n백야 프로토콜의 P2P 릴레이 서버 아키텍처 설명서입니다.\n\n## 구성요소\n- **릴레이 서버**: 노드 간 통신 중계\n- **피어 매니저**: 연결된 피어 관리\n- **메시지 라우팅**: 메시지 전달 최적화\n\n## 네트워크 토폴로지\n\n클라이언트 <-> 릴레이 서버 <-> 피어 네트워크\n\n## 보안 고려사항\n- 메시지 암호화\n- 피어 인증\n- DDoS 방어',
            
            'docs/railway-deployment-guide.md': '# Railway 배포 가이드\n\n## 개요\nRailway 플랫폼을 사용한 백야 프로토콜 배포 가이드입니다.\n\n## 준비사항\n1. Railway 계정 생성\n2. GitHub 저장소 연결\n3. 환경 변수 설정\n\n## 배포 단계\n1. 프로젝트 생성\n2. 서비스 설정\n3. 빌드 및 배포\n4. 도메인 연결\n\n## 환경 변수\n- NODE_ENV=production\n- PORT=3000\n- DATABASE_URL=...',
            
            'docs/railway-environment-variables.md': '# Railway 환경 변수\n\n## 필수 환경 변수\n\n### 기본 설정\n- NODE_ENV: 실행 환경 (production/development)\n- PORT: 서버 포트 (기본값: 3000)\n\n### 데이터베이스\n- DATABASE_URL: 데이터베이스 연결 URL\n- REDIS_URL: Redis 캐시 서버 URL\n\n### 인증\n- JWT_SECRET: JWT 토큰 암호화 키\n- FIREBASE_API_KEY: Firebase API 키\n\n### 네트워크\n- RELAY_SERVER_URL: 릴레이 서버 주소\n- P2P_PORT: P2P 네트워크 포트\n\n## 설정 방법\nRailway 대시보드에서 Variables 탭을 통해 설정합니다.',
            
            'docs/devdao-contribution-guide.md': '# 개발 DAO 기여 가이드\n\n## 개요\n백야 프로토콜 개발 DAO에 기여하는 방법을 설명합니다.\n\n## 기여 방법\n\n### 1. 코드 기여\n- GitHub 이슈 해결\n- 새로운 기능 개발\n- 버그 수정\n- 코드 리뷰\n\n### 2. 문서화\n- 기술 문서 작성\n- API 문서 업데이트\n- 사용자 가이드 작성\n\n### 3. 테스트\n- 단위 테스트 작성\n- 통합 테스트 수행\n- 버그 리포팅\n\n### 4. 커뮤니티 활동\n- 질문 답변\n- 토론 참여\n- 이벤트 참가\n\n## 보상 체계\n각 기여 활동에 대해 DCA(Decentralized Contribution Activity) 토큰이 지급됩니다.\n\n## 시작하기\n1. 저장소 포크\n2. 개발 환경 설정\n3. 이슈 선택\n4. 개발 시작\n5. PR 제출',
            
            'docs/firebase-setup-guide.md': '# Firebase 설정 가이드\n\n## 개요\n백야 프로토콜에서 Firebase 인증 및 데이터베이스 설정 방법을 설명합니다.\n\n## Firebase 프로젝트 생성\n1. Firebase Console 접속\n2. 새 프로젝트 생성\n3. 웹 앱 추가\n4. 설정 정보 복사\n\n## 인증 설정\n1. Authentication 활성화\n2. 로그인 방법 설정\n   - 이메일/비밀번호\n   - Google 로그인\n   - GitHub 로그인\n\n## Firestore 설정\n1. Cloud Firestore 생성\n2. 보안 규칙 설정\n3. 인덱스 구성\n\n## 환경 변수 설정\nconst firebaseConfig = {\n  apiKey: "your-api-key",\n  authDomain: "your-auth-domain",\n  projectId: "your-project-id",\n  storageBucket: "your-storage-bucket",\n  messagingSenderId: "your-messaging-sender-id",\n  appId: "your-app-id"\n};\n\n## 보안 고려사항\n- API 키 보호\n- 보안 규칙 설정\n- 사용자 권한 관리',
            
            'package.json': '{\n  "name": "baekya-protocol",\n  "version": "1.0.0",\n  "description": "백야 프로토콜 - 기여기반 탈중앙 사회시스템",\n  "main": "src/index.js",\n  "scripts": {\n    "start": "node server.js",\n    "dev": "nodemon server.js",\n    "test": "jest",\n    "build": "webpack --mode production"\n  },\n  "keywords": [\n    "blockchain",\n    "dao",\n    "decentralized",\n    "governance",\n    "contribution"\n  ],\n  "author": "Baekya Protocol Team",\n  "license": "MIT",\n  "dependencies": {\n    "express": "^4.18.2",\n    "socket.io": "^4.7.2",\n    "crypto": "^1.0.1",\n    "node-rsa": "^1.1.1"\n  },\n  "devDependencies": {\n    "jest": "^29.5.0",\n    "nodemon": "^3.0.1"\n  }\n}',
            
            'README.md': '# 백야 프로토콜\n\n기여기반 탈중앙 사회시스템\n\n## 개요\n백야 프로토콜은 기여한 만큼 보장받는 사회규약을 실현하기 위해 설계된 혁신적인 블록체인 프로토콜입니다.\n\n## 주요 기능\n- 기여 기반 토큰 발행\n- 탈중앙 거버넌스\n- P2P 네트워크\n- DAO 시스템\n\n## 시작하기\nnpm install\nnpm start\n\n## 문서\n자세한 문서는 docs/ 폴더를 참조하세요.'
        };

        return fileContents[path] || '# ' + fileName + '\n\n파일 내용을 로드할 수 없습니다.\n경로: ' + path + '\n\n이 파일은 시스템에서 관리되는 파일입니다.';
    }

    // 파일 보기 모달 표시
    showFileModal(fileName, content, path) {
        const modal = document.createElement('div');
        modal.className = 'file-modal';
        modal.innerHTML = `
            <div class="file-modal-content">
                <div class="file-modal-header">
                    <div class="file-modal-title">
                        <i class="fas ${this.getFileIcon(fileName)}"></i>
                        <span>${fileName}</span>
                        <span class="file-path">${path}</span>
                    </div>
                    <button class="file-modal-close" onclick="this.closest('.file-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="file-modal-body">
                    <pre><code>${this.escapeHtml(content)}</code></pre>
                </div>
                <div class="file-modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.file-modal').remove()">
                        닫기
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // 모달 외부 클릭 시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    // HTML 이스케이프
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    viewProposal(id) {
        console.log('👁️ 제안 상세보기:', id);
        // 제안 상세보기 모달 구현 예정
    }

    voteProposal(id, voteType) {
        console.log('🗳️ 제안 투표:', id, voteType);
        // 투표 기능 구현 예정
    }

    viewCollab(id) {
        console.log('👁️ 협업 상세보기:', id);
        // 협업 상세보기 모달 구현 예정
    }

    joinCollab(id) {
        console.log('🤝 협업 참여:', id);
        // 협업 참여 기능 구현 예정
    }

    viewMerge(id) {
        console.log('👁️ 병합 상세보기:', id);
        // 병합 상세보기 모달 구현 예정
    }

    reviewMerge(id) {
        console.log('📋 병합 검토:', id);
        // 병합 검토 기능 구현 예정
    }

    viewFork(id) {
        console.log('👁️ 포크 상세보기:', id);
        // 포크 상세보기 모달 구현 예정
    }

    openFork(id) {
        console.log('🚀 포크 열기:', id);
        // 포크 개발 환경 열기 구현 예정
    }

    // 모달 함수들
    openProposalCreateModal() {
        console.log('📝 새 제안 모달 열기');
        
        // 기존 모달 제거
        const existingModal = document.querySelector('.modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 잔액 확인
        if (this.userBalance < 1) {
            alert('잔액이 부족합니다. 제안 생성에는 1B가 필요합니다.');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content proposal-modal">
                <div class="modal-header">
                    <h2><i class="fas fa-lightbulb"></i> 새 제안 생성</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>제안 제목 *</label>
                        <input type="text" id="proposalTitle" placeholder="제안 제목을 입력하세요" maxlength="100">
                    </div>
                    <div class="form-group">
                        <label>제안 설명 *</label>
                        <textarea id="proposalDescription" placeholder="제안 내용을 상세히 설명해주세요" rows="6"></textarea>
                    </div>
                    <div class="form-group">
                        <label>라벨 (선택사항)</label>
                        <div class="label-options">
                            <label class="label-option">
                                <input type="checkbox" value="기능개선"> 기능개선
                            </label>
                            <label class="label-option">
                                <input type="checkbox" value="버그수정"> 버그수정
                            </label>
                            <label class="label-option">
                                <input type="checkbox" value="새기능"> 새기능
                            </label>
                            <label class="label-option">
                                <input type="checkbox" value="문서화"> 문서화
                            </label>
                            <label class="label-option">
                                <input type="checkbox" value="보안"> 보안
                            </label>
                        </div>
                    </div>
                    <div class="cost-info">
                        <i class="fas fa-info-circle"></i>
                        제안 생성 비용: 1B (모금함으로 이동)
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        취소
                    </button>
                    <button class="btn btn-primary" id="createProposalBtn">
                        <i class="fas fa-plus"></i> 제안 생성 (1B)
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // 모달 외부 클릭 시 닫기
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // 제안 생성 버튼 이벤트 리스너 추가
        const createBtn = modal.querySelector('#createProposalBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                this.createProposal();
            });
        }
    }

    // 제안 생성 함수
    async createProposal() {
        // 모달 내의 모든 input과 textarea 요소 찾기
        const modal = document.querySelector('.modal-overlay');
        if (!modal) {
            alert('모달을 찾을 수 없습니다.');
            return;
        }
        
        const titleElement = modal.querySelector('#proposalTitle');
        const descriptionElement = modal.querySelector('#proposalDescription');
        
        if (!titleElement || !descriptionElement) {
            alert('입력 필드를 찾을 수 없습니다.');
            return;
        }
        
        const title = titleElement.value ? titleElement.value.trim() : '';
        const description = descriptionElement.value ? descriptionElement.value.trim() : '';
        
        const labelCheckboxes = modal.querySelectorAll('.label-option input[type="checkbox"]:checked');
        const labels = Array.from(labelCheckboxes).map(cb => cb.value);

        // 유효성 검사
        if (!title || title.length === 0) {
            alert('제안 제목을 입력해주세요.');
            return;
        }

        if (!description || description.length === 0) {
            alert('제안 설명을 입력해주세요.');
            return;
        }

        if (this.userBalance < 1) {
            alert('잔액이 부족합니다.');
            return;
        }

        // 제안 생성 (로컬 처리 + 블록체인 연동)
        const proposal = {
            id: 'proposal-' + Date.now(),
            title: title,
            description: description,
            labels: labels,
            author: this.currentUser.displayName,
            authorId: this.currentUser.did || this.currentUser.uid,
            createdAt: Date.now(),
            status: 'new',
            votes: {
                good: 0,
                bad: 0,
                voters: {}
            },
            funding: {
                amount: 1,
                donors: {
                    [this.currentUser.did || this.currentUser.uid]: 1
                }
            }
        };

        try {
            // 1. 메인 앱의 블록체인에 트랜잭션 전송 (먼저 실행)
            const result = await this.sendTransactionToMainApp('GOVERNANCE_PROPOSAL', {
                proposalId: proposal.id,
                title: proposal.title,
                author: proposal.author,
                cost: 1
            });

            // 2. 블록체인 트랜잭션 성공 여부 확인
            if (!result.success) {
                throw new Error(result.error || '블록체인 트랜잭션 실패');
            }

            // 3. 로컬 저장 (블록체인 성공 시에만)
            this.proposals.push(proposal);
            this.saveToStorage('governance_proposals', this.proposals);

            // 4. 잔액 차감 (블록체인 성공 시에만)
            this.userBalance -= 1;
            localStorage.setItem('userBalance', this.userBalance.toString());

            // 5. 성공 처리
            modal.remove();
            this.renderProposals();
            
            console.log('✅ 제안 생성 완료:', proposal);
            alert('제안이 성공적으로 생성되었습니다! 블록체인에 기록되었습니다.');

        } catch (error) {
            console.error('제안 생성 실패:', error);
            alert(`제안 생성 중 오류가 발생했습니다: ${error.message}`);
        }
    }

    openCollabCreateModal() {
        console.log('🤝 새 협업 모달 열기');
        // 협업 생성 모달 구현 예정
    }

    openMergeCreateModal() {
        console.log('🔀 새 병합 요청 모달 열기');
        // 병합 요청 생성 모달 구현 예정
    }

    createPersonalFork() {
        console.log('🍴 새 포크 생성');
        // 포크 생성 기능 구현 예정
    }

    // DCA 자동 검증 및 보상 처리
    checkAndRewardDCA(userId, dcaType, proposalId) {
        const dcaRewards = {
            'proposal': 120,      // 제안활동
            'collaboration': 250, // 협업활동
            'evaluation': 80      // 평가활동
        };

        const reward = dcaRewards[dcaType];
        if (!reward) return;

        // DCA 기록 저장
        const dcaRecords = this.loadFromStorage('governance_dca_records') || {};
        if (!dcaRecords[userId]) {
            dcaRecords[userId] = [];
        }

        dcaRecords[userId].push({
            type: dcaType,
            proposalId: proposalId,
            reward: reward,
            timestamp: Date.now(),
            verified: true
        });

        this.saveToStorage('governance_dca_records', dcaRecords);

        // 메인 앱에 DCA 완료 알림
        if (window.opener && window.opener.dapp) {
            window.opener.dapp.notifyDCACompletion('governance-dao', dcaType, reward);
        }

        console.log(`DCA 검증 완료: ${userId} - ${dcaType} - ${reward}B`);
    }

    // 제안이 협업대기탭으로 이동 시 DCA 검증
    verifyProposalDCA(proposal) {
        if (proposal.status === 'waiting' && !proposal.dcaVerified) {
            this.checkAndRewardDCA(proposal.author, 'proposal', proposal.id);
            proposal.dcaVerified = true;
            this.saveToStorage('governance_proposals', this.proposals);
        }
    }

    // PR이 None Good PR보다 많은 투표를 받았을 때 DCA 검증
    verifyCollaborationDCA(prId, stage) {
        const collab = this.collaborations.current;
        if (!collab) return;

        const pr = stage === 'core' ? 
            collab.corePRs.find(p => p.id === prId) : 
            collab.complementaryPRs.find(p => p.id === prId);
        
        if (!pr || pr.dcaVerified) return;

        const prVotes = this.prs[collab.proposalId][stage].votes;
        const noneGoodVotes = prVotes[`none-good-${stage}`]?.length || 0;
        const prVoteCount = prVotes[prId]?.length || 0;

        if (prVoteCount > noneGoodVotes) {
            this.checkAndRewardDCA(pr.author, 'collaboration', pr.id);
            pr.dcaVerified = true;
            this.saveToStorage('governance_collaborations', this.collaborations);
        }
    }

    // 피드백이 None Good Feedback보다 많은 투표를 받았을 때 DCA 검증
    verifyEvaluationDCA(feedbackId, evaluationId) {
        const feedbacks = this.feedbacks[evaluationId] || [];
        const feedback = feedbacks.find(f => f.id === feedbackId);
        
        if (!feedback || feedback.dcaVerified || feedback.id === 'none-good-feedback') return;

        const noneGoodFeedback = feedbacks.find(f => f.id === 'none-good-feedback');
        const noneGoodVotes = noneGoodFeedback?.votes || 0;

        if (feedback.votes > noneGoodVotes) {
            this.checkAndRewardDCA(feedback.author, 'evaluation', feedback.id);
            feedback.dcaVerified = true;
            this.saveToStorage('governance_feedbacks', this.feedbacks);
        }
    }

    // 거버넌스 DAO 통계 가져오기
    getGovernanceStats() {
        const stats = {
            totalProposals: this.proposals.length,
            activeProposals: this.proposals.filter(p => p.status === 'new').length,
            waitingProposals: this.proposals.filter(p => p.status === 'waiting').length,
            currentCollaboration: this.collaborations.current ? 1 : 0,
            evaluatingCount: this.evaluations.filter(e => e.status === 'evaluating').length,
            completedCount: this.evaluations.filter(e => e.status === 'completed').length,
            totalDonations: 0,
            totalRewards: 0
        };

        // 총 모금액 계산
        Object.values(this.donations).forEach(donationList => {
            donationList.forEach(donation => {
                stats.totalDonations += donation.amount;
            });
        });

        // 총 보상액 계산 (실제 지급된 보상)
        const dcaRecords = this.loadFromStorage('governance_dca_records') || {};
        Object.values(dcaRecords).forEach(userRecords => {
            userRecords.forEach(record => {
                stats.totalRewards += record.reward;
            });
        });

        return stats;
    }

    // 사용자의 거버넌스 활동 내역 가져오기
    getUserGovernanceActivity(userId) {
        const activity = {
            proposals: [],
            prs: [],
            feedbacks: [],
            votes: 0,
            donations: 0,
            rewards: 0
        };

        // 제안 활동
        activity.proposals = this.proposals.filter(p => p.author === userId);

        // PR 활동
        Object.values(this.prs).forEach(proposalPRs => {
            if (proposalPRs.core) {
                proposalPRs.core.prs.forEach(pr => {
                    if (pr.author === userId) activity.prs.push(pr);
                });
            }
            if (proposalPRs.complementary) {
                proposalPRs.complementary.prs.forEach(pr => {
                    if (pr.author === userId) activity.prs.push(pr);
                });
            }
        });

        // 피드백 활동
        Object.values(this.feedbacks).forEach(evaluationFeedbacks => {
            evaluationFeedbacks.forEach(feedback => {
                if (feedback.author === userId && feedback.id !== 'none-good-feedback') {
                    activity.feedbacks.push(feedback);
                }
            });
        });

        // 투표 수 계산
        Object.values(this.votes).forEach(proposalVotes => {
            if (proposalVotes.good.includes(userId)) activity.votes++;
            if (proposalVotes.bad.includes(userId)) activity.votes++;
        });

        // 모금액 계산
        Object.values(this.donations).forEach(donationList => {
            donationList.forEach(donation => {
                if (donation.userId === userId) {
                    activity.donations += donation.amount;
                }
            });
        });

        // 보상액 계산
        const dcaRecords = this.loadFromStorage('governance_dca_records') || {};
        if (dcaRecords[userId]) {
            dcaRecords[userId].forEach(record => {
                activity.rewards += record.reward;
            });
        }

        return activity;
    }

    // 포크 상세보기
    viewForkDetails(forkId) {
        const fork = this.forks.find(f => f.id === forkId);
        if (!fork) return;
        
        this.showToast('포크 상세보기 기능은 준비 중입니다.');
    }

    // 포크 수정
    editFork(forkId) {
        const fork = this.forks.find(f => f.id === forkId);
        if (!fork) return;
        
        this.showToast('포크 수정 기능은 준비 중입니다.');
    }

    // PR 코멘트 보기
    viewPRComments(prId, stage) {
        this.showToast('PR 코멘트 기능은 준비 중입니다.');
    }
}

// 전역 변수로 거버넌스 앱 인스턴스 생성
window.governanceApp = new GovernanceApp();

// 메인 페이지로 이동하는 함수
function navigateToMain() {
    console.log('🔄 메인 페이지로 이동');
    
    // 현재 활성화된 탭헤더 제목을 로딩 메시지로 변경
    const activeHeaderTab = document.querySelector('.mobile-header-tab.active');
    if (activeHeaderTab) {
        const titleElement = activeHeaderTab.querySelector('.mobile-system-title span, .mobile-governance-title span, .mobile-fork-title span');
        if (titleElement) {
            titleElement.innerHTML = '<i class="fas fa-home"></i> 메인 페이지 이동중...';
        }
    }
    
    // 현재 탭을 비활성화하여 깜빡임 방지
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.opacity = '0';
    });
    
    // 즉시 페이지 이동
    setTimeout(() => {
        window.location.replace('index.html');
    }, 100);
} 