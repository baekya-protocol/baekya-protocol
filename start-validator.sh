#!/bin/bash

# 백야 프로토콜 검증자 실행 스크립트
# Usage: ./start-validator.sh [-a "010-1234-5678"] [-n "testnet|mainnet"] [-p 3001] [-d]

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# 기본값
ADDRESS=""
NETWORK="testnet"
PORT=0
DAEMON=false

# 도움말 함수
show_help() {
    echo -e "${CYAN}백야 프로토콜 검증자 실행 스크립트${NC}"
    echo ""
    echo -e "${WHITE}사용법:${NC}"
    echo "  $0 [옵션]"
    echo ""
    echo -e "${WHITE}옵션:${NC}"
    echo "  -a, --address ADDRESS    통신주소 (010-XXXX-XXXX 형식)"
    echo "  -n, --network NETWORK    네트워크 (testnet|mainnet|local, 기본값: testnet)"
    echo "  -p, --port PORT          포트 번호 (기본값: 자동 설정)"
    echo "  -d, --daemon             백그라운드 실행"
    echo "  -h, --help               이 도움말 표시"
    echo ""
    echo -e "${WHITE}예시:${NC}"
    echo "  $0 -a \"010-1234-5678\" -n testnet"
    echo "  $0 --address \"010-1234-5678\" --network mainnet --daemon"
    exit 0
}

# 옵션 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--address)
            ADDRESS="$2"
            shift 2
            ;;
        -n|--network)
            NETWORK="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -d|--daemon)
            DAEMON=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo -e "${RED}❌ 알 수 없는 옵션: $1${NC}"
            echo "도움말을 보려면: $0 --help"
            exit 1
            ;;
    esac
done

# 헤더 출력
echo -e "${CYAN}🌟 백야 프로토콜 검증자 시작${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 네트워크별 기본 포트 설정
if [ $PORT -eq 0 ]; then
    case $NETWORK in
        mainnet)
            PORT=8080
            ;;
        testnet)
            PORT=3001
            ;;
        *)
            PORT=3000
            ;;
    esac
fi

# 명령어 생성
COMMAND="node src/index.js --validator"

case $NETWORK in
    mainnet)
        COMMAND="$COMMAND --mainnet"
        echo -e "${YELLOW}🔗 네트워크: 메인넷 (PRODUCTION)${NC}"
        echo -e "${RED}⚠️  주의: 실제 B-토큰 보상이 지급됩니다!${NC}"
        ;;
    testnet)
        COMMAND="$COMMAND --testnet"
        echo -e "${GREEN}🔗 네트워크: 테스트넷${NC}"
        ;;
    *)
        echo -e "${BLUE}🔗 네트워크: 로컬 개발환경${NC}"
        ;;
esac

if [ -n "$ADDRESS" ]; then
    COMMAND="$COMMAND --address $ADDRESS"
    echo -e "${GREEN}📞 통신주소: $ADDRESS${NC}"
else
    echo -e "${YELLOW}📞 통신주소: 실행 시 입력 필요${NC}"
fi

echo -e "${CYAN}🚪 포트: $PORT${NC}"
echo -e "${MAGENTA}👤 역할: 검증자 (VALIDATOR)${NC}"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 메인넷 실행 확인
if [ "$NETWORK" = "mainnet" ]; then
    echo -n -e "${RED}메인넷에서 검증자를 실행하시겠습니까? (y/N): ${NC}"
    read -r confirmation
    if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ 실행이 취소되었습니다.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}🚀 검증자 실행 중...${NC}"
echo -e "${GRAY}명령어: $COMMAND${NC}"

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js가 설치되지 않았습니다. Node.js를 설치한 후 다시 시도해주세요.${NC}"
    echo -e "${YELLOW}   다운로드: https://nodejs.org${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js 버전: $NODE_VERSION${NC}"

# 의존성 설치 확인
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 의존성 설치 중...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 의존성 설치 실패${NC}"
        exit 1
    fi
fi

# 로그 디렉토리 생성
if [ ! -d "logs" ]; then
    mkdir -p logs
    echo -e "${GREEN}📁 로그 디렉토리 생성됨${NC}"
fi

echo ""
echo -e "${CYAN}💡 유용한 정보:${NC}"
echo -e "${WHITE}   • 검증자 보상: 10분마다 자동 분배${NC}"
echo -e "${WHITE}   • 웹 대시보드: http://localhost:$((PORT + 1000))${NC}"
echo -e "${WHITE}   • 로그 확인: tail -f logs/validator.log${NC}"
echo -e "${WHITE}   • 중지하기: Ctrl+C 또는 kill \$(cat validator.pid)${NC}"
echo ""

# 실행 방식 결정
if [ "$DAEMON" = true ]; then
    # 백그라운드 실행
    LOG_FILE="logs/validator-$(date +%Y%m%d-%H%M%S).log"
    
    echo -e "${GREEN}✅ 검증자를 백그라운드에서 시작합니다...${NC}"
    
    # nohup으로 백그라운드 실행
    nohup $COMMAND > "$LOG_FILE" 2>&1 &
    PID=$!
    
    # PID 저장
    echo $PID > validator.pid
    
    echo -e "${GREEN}✅ 검증자가 백그라운드에서 시작되었습니다!${NC}"
    echo -e "${YELLOW}   프로세스 ID: $PID${NC}"
    echo -e "${YELLOW}   로그 파일: $LOG_FILE${NC}"
    echo -e "${YELLOW}   PID 파일: validator.pid${NC}"
    echo -e "${YELLOW}   중지하기: kill $PID 또는 kill \$(cat validator.pid)${NC}"
    echo ""
    echo -e "${CYAN}실시간 로그 확인:${NC}"
    echo -e "${WHITE}   tail -f $LOG_FILE${NC}"
    
else
    # 백그라운드 실행 여부 확인
    echo -n -e "${CYAN}백그라운드에서 실행하시겠습니까? (y/N): ${NC}"
    read -r background
    
    if [[ "$background" =~ ^[Yy]$ ]]; then
        # 백그라운드 실행
        LOG_FILE="logs/validator-$(date +%Y%m%d-%H%M%S).log"
        
        echo -e "${GREEN}✅ 검증자를 백그라운드에서 시작합니다...${NC}"
        
        nohup $COMMAND > "$LOG_FILE" 2>&1 &
        PID=$!
        
        echo $PID > validator.pid
        
        echo -e "${GREEN}✅ 검증자가 백그라운드에서 시작되었습니다!${NC}"
        echo -e "${YELLOW}   프로세스 ID: $PID${NC}"
        echo -e "${YELLOW}   로그 파일: $LOG_FILE${NC}"
        echo -e "${YELLOW}   PID 파일: validator.pid${NC}"
        echo -e "${YELLOW}   중지하기: kill $PID 또는 kill \$(cat validator.pid)${NC}"
        
    else
        # 포그라운드 실행
        echo -e "${GREEN}✅ 검증자를 시작합니다...${NC}"
        echo ""
        
        # 직접 실행
        exec $COMMAND
    fi
fi 