# 🌟 BROTHERHOOD 릴레이 노드 가이드

BROTHERHOOD 네트워크의 릴레이 노드를 운영하여 탈중앙화 네트워크에 기여하세요!

## 📋 목차

- [개요](#개요)
- [시스템 요구사항](#시스템-요구사항)
- [릴레이 노드 시작하기](#릴레이-노드-시작하기)
- [설정 옵션](#설정-옵션)
- [모니터링](#모니터링)
- [문제 해결](#문제-해결)
- [보상 시스템](#보상-시스템)

## 🎯 개요

### 릴레이 노드란?

릴레이 노드는 BROTHERHOOD 네트워크에서 **사용자와 검증자 간의 통신을 중계**하는 중요한 역할을 담당합니다.

```
사용자(D-App) ←→ 릴레이 노드 ←→ 검증자 노드
```

### 주요 기능
- 📡 **트랜잭션 중계**: 사용자의 트랜잭션을 검증자에게 전달
- 📦 **블록 정보 전파**: 새로운 블록 정보를 사용자에게 전달
- 🔄 **자동 로드 밸런싱**: 네트워크 부하 분산
- 📊 **연결 상태 모니터링**: 실시간 네트워크 상태 추적

## 💻 시스템 요구사항

### 최소 사양
- **OS**: Windows 10+, macOS 10.14+, Ubuntu 18.04+
- **Node.js**: v14.0.0 이상
- **RAM**: 2GB 이상
- **Storage**: 1GB 이상 여유 공간
- **Network**: 안정적인 인터넷 연결 (업로드 1Mbps+)

### 권장 사양
- **RAM**: 4GB 이상
- **Network**: 업로드 10Mbps+, 낮은 레이턴시
- **고정 IP**: 안정적인 서비스 제공을 위해 권장

## 🚀 릴레이 노드 시작하기

### 1. 프로젝트 다운로드

```bash
git clone https://github.com/brotherhood/baekya-protocol.git
cd baekya-protocol
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 릴레이 노드 시작

#### 🐧 Linux/macOS 사용자

```bash
# 실행 권한 부여
chmod +x start-relay.sh

# 기본 설정으로 시작
./start-relay.sh

# 사용자 정의 설정
./start-relay.sh --port 9090 --name "Seoul-Relay" --region korea

# 백그라운드 실행
./start-relay.sh --daemon --log-file relay.log
```

#### 🪟 Windows 사용자

```cmd
# 기본 설정으로 시작
start-relay.bat

# 사용자 정의 설정
start-relay.bat --port 9090 --name "Seoul-Relay" --region korea

# Windows 서비스로 설치
start-relay.bat --service
```

#### 🔧 직접 실행 (고급 사용자)

```bash
node relay-node-server.js --port 8080 --name "My-Relay" --region korea
```

## ⚙️ 설정 옵션

| 옵션 | 설명 | 기본값 | 예시 |
|------|------|--------|------|
| `--port` | 서버 포트 번호 | 8080 | `--port 9090` |
| `--name` | 릴레이 노드 이름 | `BROTHERHOOD-Relay-{호스트명}` | `--name "Seoul-Relay"` |
| `--region` | 지역 설정 | `auto` | `--region korea` |
| `--max-connections` | 최대 동시 연결 수 | 1000 | `--max-connections 500` |

### 지역 코드
- `korea` - 대한민국
- `asia` - 아시아 (한국 제외)
- `us-west` - 미국 서부
- `us-east` - 미국 동부
- `europe` - 유럽
- `auto` - 자동 감지

## 📊 모니터링

### 웹 인터페이스

릴레이 노드가 실행되면 다음 웹 인터페이스를 통해 모니터링할 수 있습니다:

```
📊 상태 확인: http://localhost:8080/status
🏥 헬스체크: http://localhost:8080/health
🌐 네트워크 정보: http://localhost:8080/network
```

### 상태 확인 명령어

```bash
# 릴레이 노드 상태 확인
curl http://localhost:8080/status

# 간단한 헬스체크
curl http://localhost:8080/health
```

### 로그 모니터링

```bash
# 실시간 로그 확인
tail -f relay-node.log

# 에러 로그만 확인
grep "ERROR" relay-node.log
```

## 🔧 문제 해결

### 자주 발생하는 문제

#### 1. 포트가 이미 사용 중
```
❌ 포트 8080가 이미 사용 중입니다
```

**해결방법:**
```bash
# 다른 포트 사용
./start-relay.sh --port 9090

# 또는 사용 중인 프로세스 종료 (Linux/macOS)
sudo lsof -ti:8080 | xargs kill -9
```

#### 2. Node.js 버전 호환성
```
❌ Node.js 버전이 너무 낮습니다
```

**해결방법:**
```bash
# Node.js 최신 LTS 버전 설치
# Windows: https://nodejs.org 에서 다운로드
# Linux: 
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 3. 방화벽 차단
```
⚠️ 외부에서 접근할 수 없습니다
```

**해결방법:**
```bash
# Ubuntu/Debian
sudo ufw allow 8080

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload

# Windows
# 제어판 > 시스템 및 보안 > Windows Defender 방화벽 > 고급 설정
# 인바운드 규칙 > 새 규칙 > 포트 > TCP > 8080
```

### 릴레이 노드 중지

```bash
# 포그라운드 실행 중인 경우
Ctrl + C

# 백그라운드 실행 중인 경우
kill $(cat relay-node.pid)

# Windows 서비스인 경우
net stop BrotherhoodRelay
```

## 💰 보상 시스템

### 릴레이 노드 운영 보상

릴레이 노드를 성공적으로 운영하면 다음과 같은 보상을 받을 수 있습니다:

- 📈 **네트워크 기여도에 따른 B-Token 보상**
- 🏆 **우수 릴레이 노드 인센티브**
- 🌟 **커뮤니티 기여자 배지**

### 보상 조건

1. **안정성**: 99% 이상 업타임 유지
2. **성능**: 평균 응답시간 100ms 미만
3. **용량**: 일일 최소 100개 트랜잭션 중계
4. **지속성**: 30일 이상 연속 운영

## 🛡️ 보안 고려사항

### 기본 보안 설정

1. **방화벽 설정**: 필요한 포트만 개방
2. **정기 업데이트**: 릴레이 노드 소프트웨어 최신 버전 유지
3. **모니터링**: 비정상적인 트래픽 패턴 감시
4. **백업**: 설정 파일 정기 백업

### 권장 보안 조치

```bash
# SSL 인증서 설정 (프로덕션 환경)
# nginx 또는 apache를 통한 리버스 프록시 구성

# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 로그 로테이션 설정
sudo logrotate -f /etc/logrotate.conf
```

## 📞 지원 및 커뮤니티

### 기술 지원

- 🐛 **이슈 리포트**: [GitHub Issues](https://github.com/brotherhood/baekya-protocol/issues)
- 📧 **이메일 지원**: support@brotherhood.network
- 💬 **Discord 커뮤니티**: [BROTHERHOOD Discord](https://discord.gg/brotherhood)

### 커뮤니티 참여

- 🌟 **기여하기**: 코드 기여, 버그 리포트, 문서 개선
- 📢 **피드백**: 사용 경험 및 개선 제안
- 🤝 **네트워킹**: 다른 릴레이 노드 운영자들과 교류

---

## 🎉 시작해보세요!

지금 바로 릴레이 노드를 시작하여 BROTHERHOOD 네트워크의 중요한 구성원이 되어보세요!

```bash
# 한 줄로 시작하기
curl -sSL https://raw.githubusercontent.com/brotherhood/baekya-protocol/main/install-relay.sh | bash
```

**BROTHERHOOD 네트워크와 함께 탈중앙화의 미래를 만들어갑시다! 🚀**



