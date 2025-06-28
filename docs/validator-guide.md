 # 백야 프로토콜 검증자 가이드

백야 프로토콜의 네트워크 검증자로 참여하여 B-토큰 보상을 받는 방법에 대한 완전한 가이드입니다.

## 목차

1. [개요](#개요)
2. [검증자란?](#검증자란)
3. [시스템 요구사항](#시스템-요구사항)
4. [풀노드 설정](#풀노드-설정)
5. [검증자 등록](#검증자-등록)
6. [보상 시스템](#보상-시스템)
7. [모니터링](#모니터링)
8. [문제 해결](#문제-해결)
9. [FAQ](#faq)

## 개요

백야 프로토콜에서 검증자는 네트워크의 보안과 안정성을 담당하는 핵심 참여자입니다. 검증자는 거래를 검증하고 새로운 블록을 생성하며, 이에 대한 보상으로 B-토큰을 받습니다.

### 검증자의 역할

- **거래 검증**: 네트워크에서 발생하는 모든 거래의 유효성을 검증
- **블록 생성**: 검증된 거래들을 모아 새로운 블록을 생성
- **네트워크 보안**: 프로토콜의 PoC(Proof of Contribution) 합의 메커니즘 참여
- **분산 네트워크 유지**: P2P 네트워크를 통한 블록체인 데이터 동기화

## 검증자란?

### 풀노드 vs 검증자

| 구분 | 풀노드 | 검증자 |
|------|--------|--------|
| **역할** | 블록체인 데이터 저장 및 동기화 | 거래 검증 및 블록 생성 |
| **보상** | 없음 | B-토큰 보상 |
| **요구사항** | 기본 시스템 | 높은 가용성 및 성능 |
| **책임** | 데이터 저장 | 네트워크 보안 |

### 검증자 선택 메커니즘

백야 프로토콜은 **PoC(Proof of Contribution)** 합의 메커니즘을 사용합니다:

1. **기여도 점수**: 각 검증자의 프로토콜 기여도에 따라 점수 부여
2. **확률적 선택**: 기여도에 비례한 확률로 블록 생성자 선택
3. **공정한 분배**: 모든 활성 검증자에게 참여 기회 제공

## 시스템 요구사항

### 최소 요구사항

```
CPU: 2코어 이상
RAM: 4GB 이상
Storage: 100GB 이상 (SSD 권장)
Network: 안정적인 인터넷 연결 (업로드 10Mbps 이상)
OS: Ubuntu 20.04+, CentOS 8+, Windows 10+, macOS 10.15+
```

### 권장 요구사항

```
CPU: 4코어 이상
RAM: 8GB 이상
Storage: 500GB SSD
Network: 전용 인터넷 연결 (업로드 100Mbps 이상)
Backup: 정기적인 데이터 백업 시스템
```

### 네트워크 포트

- **P2P 포트**: 8080 (메인넷), 3001 (테스트넷), 3000 (로컬)
- **API 포트**: P2P 포트 + 1000

## 풀노드 설정

### 1. 소스코드 다운로드

```bash
git clone https://github.com/your-org/baekya-protocol.git
cd baekya-protocol
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 풀노드 실행

#### 로컬 테스트넷
```bash
npm start
```

#### 공개 테스트넷
```bash
node src/index.js --testnet
```

#### 메인넷
```bash
node src/index.js --mainnet
```

### 4. 통신주소 입력

풀노드 실행 시 통신주소를 입력하라는 프롬프트가 나타납니다:

```
📞 노드 운영자의 통신주소를 입력하세요 (010-XXXX-XXXX): 010-1234-5678
✅ 통신주소 확인: 010-1234-5678
```

**중요**: 입력한 통신주소로 검증 보상이 전송되므로 정확히 입력해야 합니다.

#### 명령줄에서 통신주소 지정

```bash
node src/index.js --testnet --address 010-1234-5678
```

## 검증자 등록

### 1. 검증자 모드로 실행

```bash
# 테스트넷 검증자
node src/index.js --testnet --validator --address 010-1234-5678

# 메인넷 검증자
node src/index.js --mainnet --validator --address 010-1234-5678
```

### 2. 자동 등록 과정

검증자 모드로 실행하면 다음과 같은 과정이 자동으로 진행됩니다:

```
🔐 인증 시스템 초기화...
📞 통신주소 설정 중...
✅ 통신주소 확인: 010-1234-5678
🆔 새로운 노드 DID 생성: a1b2c3d4e5f6g7h8...
🔑 노드 운영자 계정 생성됨:
   - 아이디: node_01012345678
   - 비밀번호: node010123456781731234567890
   - 통신주소: 010-1234-5678
   - DID: a1b2c3d4e5f6g7h8...
👤 검증자로 등록 중...
✅ 검증자 등록 완료:
   - DID: a1b2c3d4e5f6g7h8...
   - 통신주소: 010-1234-5678
   - 스테이크: 1000 B-Token
💰 검증자 보상 자동 수집 시작...
```

### 3. 등록 확인

검증자 등록이 완료되면 다음 정보를 안전한 곳에 보관하세요:

- **노드 운영자 아이디**: 웹 인터페이스 로그인용
- **비밀번호**: 계정 접근용
- **통신주소**: 보상 수령용
- **DID**: 검증자 식별자

## 보상 시스템

### 보상 구조

백야 프로토콜의 검증자 보상은 **거래 수수료(TF) 분배**를 통해 이루어집니다:

#### 수수료 분배 비율

```
총 거래 수수료 = 100%
├── 검증자 풀: 60%
└── DAO 금고: 40%
```

#### 검증자 간 보상 분배

검증자 풀의 보상은 **스테이크 비율**에 따라 분배됩니다:

```
개별 검증자 보상 = 검증자 풀 총액 × (개인 스테이크 / 전체 스테이크)
```

### 보상 수령 과정

1. **거래 발생**: 네트워크에서 B-토큰/P-토큰 거래 발생
2. **수수료 징수**: 거래 금액의 0.1% (B-토큰) 또는 0.01% (P-토큰)
3. **풀 누적**: 수수료의 60%가 검증자 풀에 누적
4. **자동 분배**: 10분마다 스테이크 비율에 따라 자동 분배
5. **보상 수령**: 연결된 통신주소로 B-토큰 전송

### 보상 계산 예시

**시나리오**: 10명의 검증자, 각각 1000 B-Token 스테이크

```
1. 거래 발생: 1000 B-Token 전송
2. 거래 수수료: 1000 × 0.1% = 1 B-Token
3. 검증자 풀 할당: 1 × 60% = 0.6 B-Token
4. 개별 보상: 0.6 ÷ 10 = 0.06 B-Token (각 검증자)
```

**일일 예상 보상** (거래량에 따라 변동):

| 일일 거래량 | 검증자 풀 수수료 | 개별 보상 (10명 기준) |
|-------------|------------------|---------------------|
| 100,000 B | 60 B | 6 B |
| 1,000,000 B | 600 B | 60 B |
| 10,000,000 B | 6,000 B | 600 B |

## 모니터링

### 노드 상태 확인

#### 로그 모니터링

```bash
# 실시간 로그 확인
tail -f logs/validator.log

# 특정 키워드 검색
grep "검증자 보상" logs/validator.log
grep "ERROR" logs/validator.log
```

#### 주요 로그 메시지

```bash
# 정상 작동
✅ 검증자 등록 완료
💰 검증자 보상 자동 수집 시작
🎁 검증자 보상 수집 완료: 0.060000 B-Token

# 주의 필요
⚠️ 체인이 뒤처져 있음 - 동기화 요청
🔄 더 긴 체인 발견

# 오류 상황
❌ 검증자 등록 실패
❌ 검증자 보상 수집 실패
❌ P2P 네트워크 연결 실패
```

### 성능 지표

#### 시스템 리소스
```bash
# CPU 사용률
top -p $(pgrep -f "node.*index.js")

# 메모리 사용량
ps aux | grep "node.*index.js"

# 디스크 사용량
du -sh baekya-protocol/
```

#### 네트워크 상태
```bash
# 포트 확인
netstat -tulpn | grep :8080

# 연결된 피어 수
curl http://localhost:9080/api/network/status
```

### 자동 모니터링 스크립트

```bash
#!/bin/bash
# validator-monitor.sh

LOG_FILE="logs/validator.log"
ALERT_EMAIL="your-email@domain.com"

# 프로세스 확인
if ! pgrep -f "node.*index.js.*validator" > /dev/null; then
    echo "ERROR: Validator process not running" | mail -s "Validator Alert" $ALERT_EMAIL
    # 자동 재시작
    nohup node src/index.js --mainnet --validator --address YOUR_ADDRESS > logs/validator.log 2>&1 &
fi

# 최근 보상 확인 (1시간 이내)
if ! grep -q "검증자 보상 수집 완료" <(tail -n 100 $LOG_FILE | grep "$(date '+%Y-%m-%d %H')"); then
    echo "WARNING: No rewards collected in the last hour" | mail -s "Validator Warning" $ALERT_EMAIL
fi

# 디스크 용량 확인
DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 90 ]; then
    echo "ERROR: Disk usage is $DISK_USAGE%" | mail -s "Disk Alert" $ALERT_EMAIL
fi
```

### 대시보드 접근

웹 브라우저에서 노드 상태를 확인할 수 있습니다:

```
http://localhost:9080 (테스트넷: 4001, 메인넷: 9080)
```

**주요 정보**:
- 현재 블록 높이
- 연결된 피어 수
- 누적 보상
- 검증자 순위

## 문제 해결

### 일반적인 문제

#### 1. 통신주소 오류

**증상**: `❌ 잘못된 통신주소 형식`

**해결책**:
```bash
# 올바른 형식 확인
010-1234-5678 (O)
01012345678   (X)
010 1234 5678 (X)
```

#### 2. 포트 충돌

**증상**: `Error: listen EADDRINUSE`

**해결책**:
```bash
# 사용 중인 포트 확인
netstat -tulpn | grep :8080

# 프로세스 종료
kill -9 $(lsof -t -i:8080)

# 다른 포트 사용
node src/index.js --mainnet --validator --port 8081
```

#### 3. 동기화 문제

**증상**: `체인이 뒤처져 있음`

**해결책**:
```bash
# 노드 재시작
pm2 restart validator

# 수동 동기화
node src/scripts/sync-blockchain.js
```

#### 4. 보상 미수령

**증상**: 보상 알림은 있지만 잔액 증가 없음

**해결책**:
1. 통신주소 확인
2. 웹 인터페이스에서 지갑 새로고침
3. 블록체인 동기화 상태 확인

### 고급 문제 해결

#### 로그 분석

```bash
# 오류 로그만 필터링
grep -E "(ERROR|FAIL|❌)" logs/validator.log

# 보상 관련 로그
grep "보상" logs/validator.log | tail -10

# 네트워크 관련 로그
grep -E "(피어|peer|network)" logs/validator.log
```

#### 데이터베이스 복구

```bash
# 백업에서 복구
cp -r backup/blockchain-data/* data/

# 체인 재검증
node src/scripts/validate-chain.js
```

#### 네트워크 진단

```bash
# 피어 연결 테스트
telnet peer1.baekya.network 8080
telnet peer2.baekya.network 8080

# DNS 확인
nslookup baekya.network
```

## 보안 권장사항

### 서버 보안

1. **방화벽 설정**
```bash
# UFW 방화벽 설정
sudo ufw enable
sudo ufw allow 8080/tcp
sudo ufw allow 22/tcp
sudo ufw deny 3000/tcp  # API 포트는 로컬만
```

2. **SSH 보안**
```bash
# 키 기반 인증 설정
ssh-keygen -t rsa -b 4096
# 패스워드 인증 비활성화
```

3. **자동 업데이트**
```bash
# 보안 업데이트 자동 설치
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

### 계정 보안

1. **비밀번호 관리**
   - 생성된 노드 운영자 비밀번호를 안전한 곳에 보관
   - 비밀번호 관리자 사용 권장

2. **백업**
   - 계정 정보 정기 백업
   - 복수 위치에 분산 저장

3. **접근 제어**
   - 서버 접근 권한 최소화
   - 정기적인 접근 로그 확인

## 운영 팁

### 효율적인 운영

1. **프로세스 관리자 사용**
```bash
# PM2 설치
npm install -g pm2

# 검증자 실행
pm2 start "node src/index.js --mainnet --validator --address 010-1234-5678" --name validator

# 자동 재시작 설정
pm2 startup
pm2 save
```

2. **로그 로테이션**
```bash
# logrotate 설정
sudo nano /etc/logrotate.d/baekya-validator

/path/to/baekya-protocol/logs/*.log {
    daily
    rotate 30
    compress
    missingok
    notifempty
    sharedscripts
}
```

3. **모니터링 알림**
```bash
# Telegram 봇 알림 설정
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
     -d chat_id=$CHAT_ID \
     -d text="Validator $HOSTNAME started successfully"
```

### 성능 최적화

1. **SSD 사용**: 블록체인 데이터는 SSD에 저장
2. **네트워크 최적화**: 전용 인터넷 회선 사용
3. **리소스 모니터링**: 정기적인 성능 체크

## FAQ

### Q1. 검증자가 되려면 얼마나 많은 B-토큰이 필요한가요?

**A**: 현재 최소 스테이크는 1000 B-Token이며, 이는 검증자 등록 시 자동으로 설정됩니다. 추가 스테이킹을 통해 보상 비율을 높일 수 있습니다.

### Q2. 보상은 얼마나 자주 받나요?

**A**: 검증자 보상은 10분마다 자동으로 분배됩니다. 실제 보상 금액은 네트워크의 거래량에 따라 달라집니다.

### Q3. 노드를 오프라인으로 만들면 어떻게 되나요?

**A**: 일시적인 오프라인은 문제없지만, 장기간 비활성 상태일 경우 검증자 풀에서 제외될 수 있습니다. 가용성 유지가 중요합니다.

### Q4. 통신주소를 변경할 수 있나요?

**A**: 현재는 검증자 등록 시 설정한 통신주소 변경이 제한적입니다. 변경이 필요한 경우 새로운 검증자로 등록해야 합니다.

### Q5. 메인넷과 테스트넷의 차이는 무엇인가요?

**A**: 
- **테스트넷**: 개발 및 테스트 목적, 실제 가치 없는 토큰
- **메인넷**: 실제 운영 네트워크, 실제 가치 있는 B-토큰 보상

### Q6. 여러 대의 서버에서 검증자를 운영할 수 있나요?

**A**: 하나의 통신주소당 하나의 검증자만 등록 가능합니다. 다른 통신주소로는 별도 검증자 등록이 가능합니다.

### Q7. 검증자 보상은 어떻게 확인하나요?

**A**: 
1. 터미널 로그 확인
2. 웹 대시보드 접속
3. 백야 프로토콜 웹앱의 지갑 탭에서 확인

### Q8. 최소 하드웨어 요구사항을 만족하지 못하면 어떻게 되나요?

**A**: 성능 저하로 인해 블록 생성 기회를 놓치거나 네트워크에서 제외될 수 있습니다. 권장 사양 이상 사용을 추천합니다.

### 기술 지원

문제가 발생하면 다음 정보와 함께 이슈를 제출해주세요:

1. **시스템 정보**: OS, Node.js 버전
2. **네트워크**: 메인넷/테스트넷
3. **로그 파일**: 관련 에러 로그
4. **재현 방법**: 문제 발생 과정

### 기여하기

백야 프로토콜은 오픈소스 프로젝트입니다. 다음과 같은 방법으로 기여할 수 있습니다:

- **코드 기여**: Pull Request 제출
- **버그 리포트**: Issue 등록
- **문서 개선**: 가이드 업데이트
- **커뮤니티 참여**: 다른 사용자 도움

---

**면책조항**: 이 가이드는 정보 제공 목적으로 작성되었습니다. 검증자 운영은 기술적 위험을 수반할 수 있으며, 하드웨어 장애, 네트워크 문제 등으로 인한 손실에 대해 프로토콜 개발팀은 책임지지 않습니다. 검증자 운영 전 충분한 테스트를 권장합니다.

**버전**: v1.0.0  
**최종 업데이트**: 2024년 11월  
**다음 업데이트 예정**: 2024년 12월