#!/bin/bash

# BROTHERHOOD 릴레이 노드 시작 스크립트
# 사용법: ./start-relay.sh [옵션]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 기본 설정
DEFAULT_PORT=8080
DEFAULT_NAME="BROTHERHOOD-Relay-$(hostname)"
DEFAULT_REGION="auto"
DEFAULT_MAX_CONNECTIONS=1000

# 배너 출력
print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    🌟 BROTHERHOOD 🌟                        ║"
    echo "║                    릴레이 노드 시스템                         ║"
    echo "║                                                              ║"
    echo "║  사용자 ←→ 릴레이 노드 ←→ 검증자                            ║"
    echo "║                                                              ║"
    echo "║  💡 탈중앙화 네트워크의 중계 역할을 담당합니다               ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 도움말 출력
show_help() {
    echo -e "${GREEN}BROTHERHOOD 릴레이 노드 시작 스크립트${NC}"
    echo ""
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  -p, --port PORT              포트 번호 (기본값: $DEFAULT_PORT)"
    echo "  -n, --name NAME              노드 이름 (기본값: $DEFAULT_NAME)"
    echo "  -r, --region REGION          지역 설정 (기본값: $DEFAULT_REGION)"
    echo "  -m, --max-connections NUM    최대 연결 수 (기본값: $DEFAULT_MAX_CONNECTIONS)"
    echo "  -d, --daemon                 백그라운드 실행"
    echo "  -l, --log-file FILE          로그 파일 경로"
    echo "  -h, --help                   이 도움말 표시"
    echo ""
    echo "예시:"
    echo "  $0                                    # 기본 설정으로 시작"
    echo "  $0 --port 9090 --name \"Seoul-Relay\" # 사용자 정의 설정"
    echo "  $0 --daemon --log-file relay.log     # 백그라운드 실행"
    echo ""
    echo -e "${YELLOW}💡 팁: 처음 실행 시 npm install을 먼저 실행하세요${NC}"
}

# 필수 요구사항 확인
check_requirements() {
    echo -e "${BLUE}🔍 시스템 요구사항 확인 중...${NC}"
    
    # Node.js 확인
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js가 설치되지 않았습니다${NC}"
        echo "Node.js 14 이상을 설치해주세요: https://nodejs.org"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 14 ]; then
        echo -e "${RED}❌ Node.js 버전이 너무 낮습니다 (현재: v$NODE_VERSION, 필요: v14+)${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Node.js $(node --version)${NC}"
    
    # npm 확인
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm이 설치되지 않았습니다${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ npm $(npm --version)${NC}"
    
    # 릴레이 서버 파일 확인
    if [ ! -f "relay-node-server.js" ]; then
        echo -e "${RED}❌ relay-node-server.js 파일이 없습니다${NC}"
        echo "현재 디렉토리에 릴레이 서버 파일이 있는지 확인해주세요"
        exit 1
    fi
    
    echo -e "${GREEN}✅ 릴레이 서버 파일 확인됨${NC}"
}

# 의존성 설치
install_dependencies() {
    echo -e "${BLUE}📦 의존성 확인 중...${NC}"
    
    # package.json이 없으면 생성
    if [ ! -f "package.json" ]; then
        echo -e "${YELLOW}📄 package.json 생성 중...${NC}"
        cat > package.json << EOF
{
  "name": "brotherhood-relay-node",
  "version": "1.0.0",
  "description": "BROTHERHOOD 릴레이 노드",
  "main": "relay-node-server.js",
  "scripts": {
    "start": "node relay-node-server.js",
    "dev": "node relay-node-server.js"
  },
  "dependencies": {
    "ws": "^8.14.2",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "keywords": ["blockchain", "relay", "p2p", "brotherhood"],
  "author": "BROTHERHOOD Community",
  "license": "MIT"
}
EOF
    fi
    
    # node_modules가 없으면 설치
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}⬇️ 의존성 설치 중...${NC}"
        npm install
        echo -e "${GREEN}✅ 의존성 설치 완료${NC}"
    else
        echo -e "${GREEN}✅ 의존성이 이미 설치됨${NC}"
    fi
}

# 포트 사용 가능 여부 확인
check_port() {
    local port=$1
    
    if command -v lsof &> /dev/null; then
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
            echo -e "${RED}❌ 포트 $port가 이미 사용 중입니다${NC}"
            echo "다른 포트를 사용하거나 사용 중인 프로세스를 종료해주세요"
            exit 1
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln | grep ":$port " >/dev/null; then
            echo -e "${RED}❌ 포트 $port가 이미 사용 중입니다${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ 포트 $port 사용 가능${NC}"
}

# 네트워크 정보 표시
show_network_info() {
    echo -e "${PURPLE}🌐 네트워크 정보:${NC}"
    
    # IP 주소 확인
    if command -v ip &> /dev/null; then
        LOCAL_IP=$(ip route get 1 | sed -n 's/.*src \([0-9.]*\).*/\1/p')
    elif command -v ifconfig &> /dev/null; then
        LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n1)
    else
        LOCAL_IP="확인불가"
    fi
    
    echo "  📍 로컬 IP: $LOCAL_IP"
    echo "  🌐 포트: $PORT"
    echo "  🔗 WebSocket 엔드포인트: ws://$LOCAL_IP:$PORT"
    
    # 방화벽 정보
    if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
        echo -e "${YELLOW}  ⚠️ UFW 방화벽이 활성화되어 있습니다. 포트 $PORT를 열어주세요:${NC}"
        echo "     sudo ufw allow $PORT"
    fi
    
    echo ""
}

# 릴레이 노드 시작
start_relay() {
    local cmd="node relay-node-server.js"
    
    # 매개변수 추가
    if [ "$PORT" != "$DEFAULT_PORT" ]; then
        cmd="$cmd --port $PORT"
    fi
    
    if [ "$NAME" != "$DEFAULT_NAME" ]; then
        cmd="$cmd --name \"$NAME\""
    fi
    
    if [ "$REGION" != "$DEFAULT_REGION" ]; then
        cmd="$cmd --region $REGION"
    fi
    
    if [ "$MAX_CONNECTIONS" != "$DEFAULT_MAX_CONNECTIONS" ]; then
        cmd="$cmd --max-connections $MAX_CONNECTIONS"
    fi
    
    echo -e "${GREEN}🚀 릴레이 노드 시작 중...${NC}"
    echo "명령어: $cmd"
    echo ""
    
    if [ "$DAEMON" = true ]; then
        # 백그라운드 실행
        echo -e "${BLUE}⚙️ 백그라운드 모드로 실행 중...${NC}"
        
        if [ -n "$LOG_FILE" ]; then
            nohup $cmd > "$LOG_FILE" 2>&1 &
            echo "로그 파일: $LOG_FILE"
        else
            nohup $cmd > relay-node.log 2>&1 &
            echo "로그 파일: relay-node.log"
        fi
        
        local PID=$!
        echo "프로세스 ID: $PID"
        echo "$PID" > relay-node.pid
        
        echo -e "${GREEN}✅ 릴레이 노드가 백그라운드에서 시작되었습니다${NC}"
        echo ""
        echo "📊 상태 확인: curl http://localhost:$PORT/status"
        echo "🛑 중지: kill $PID (또는 kill \$(cat relay-node.pid))"
        echo "📜 로그 확인: tail -f ${LOG_FILE:-relay-node.log}"
        
    else
        # 포그라운드 실행
        echo -e "${BLUE}⚙️ 포그라운드 모드로 실행 중... (Ctrl+C로 중지)${NC}"
        echo ""
        
        # 신호 처리
        trap 'echo -e "\n${YELLOW}🛑 릴레이 노드 중지 중...${NC}"; exit 0' INT TERM
        
        # 실행
        eval $cmd
    fi
}

# 매개변수 파싱
PORT=$DEFAULT_PORT
NAME=$DEFAULT_NAME
REGION=$DEFAULT_REGION
MAX_CONNECTIONS=$DEFAULT_MAX_CONNECTIONS
DAEMON=false
LOG_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -n|--name)
            NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -m|--max-connections)
            MAX_CONNECTIONS="$2"
            shift 2
            ;;
        -d|--daemon)
            DAEMON=true
            shift
            ;;
        -l|--log-file)
            LOG_FILE="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ 알 수 없는 옵션: $1${NC}"
            echo "도움말을 보려면 $0 --help를 실행하세요"
            exit 1
            ;;
    esac
done

# 메인 실행
main() {
    print_banner
    
    echo -e "${BLUE}🛠️ 릴레이 노드 설정:${NC}"
    echo "  📛 이름: $NAME"
    echo "  🌐 포트: $PORT"
    echo "  📍 지역: $REGION"
    echo "  👥 최대 연결: $MAX_CONNECTIONS"
    echo "  ⚙️ 모드: $(if [ "$DAEMON" = true ]; then echo "백그라운드"; else echo "포그라운드"; fi)"
    echo ""
    
    check_requirements
    install_dependencies
    check_port $PORT
    show_network_info
    start_relay
}

# 스크립트 실행
main



