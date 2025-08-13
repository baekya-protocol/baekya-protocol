@echo off
setlocal enabledelayedexpansion

REM BROTHERHOOD 릴레이 노드 시작 스크립트 (Windows)
REM 사용법: start-relay.bat [옵션]

REM 기본 설정
set DEFAULT_PORT=8080
set DEFAULT_NAME=BROTHERHOOD-Relay-%COMPUTERNAME%
set DEFAULT_REGION=auto
set DEFAULT_MAX_CONNECTIONS=1000

REM 색상 설정 (Windows에서 지원되는 경우)
set RED=[91m
set GREEN=[92m
set YELLOW=[93m
set BLUE=[94m
set PURPLE=[95m
set NC=[0m

REM 배너 출력
:print_banner
echo %BLUE%
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    🌟 BROTHERHOOD 🌟                        ║
echo ║                    릴레이 노드 시스템                         ║
echo ║                                                              ║
echo ║  사용자 ←→ 릴레이 노드 ←→ 검증자                            ║
echo ║                                                              ║
echo ║  💡 탈중앙화 네트워크의 중계 역할을 담당합니다               ║
echo ╚══════════════════════════════════════════════════════════════╝
echo %NC%
goto :eof

REM 도움말 출력
:show_help
echo %GREEN%BROTHERHOOD 릴레이 노드 시작 스크립트%NC%
echo.
echo 사용법: %~nx0 [옵션]
echo.
echo 옵션:
echo   --port PORT              포트 번호 (기본값: %DEFAULT_PORT%)
echo   --name NAME              노드 이름 (기본값: %DEFAULT_NAME%)
echo   --region REGION          지역 설정 (기본값: %DEFAULT_REGION%)
echo   --max-connections NUM    최대 연결 수 (기본값: %DEFAULT_MAX_CONNECTIONS%)
echo   --service                Windows 서비스로 등록
echo   --help                   이 도움말 표시
echo.
echo 예시:
echo   %~nx0                                       기본 설정으로 시작
echo   %~nx0 --port 9090 --name "Seoul-Relay"     사용자 정의 설정
echo   %~nx0 --service                            Windows 서비스로 등록
echo.
echo %YELLOW%💡 팁: 처음 실행 시 npm install을 먼저 실행하세요%NC%
goto :eof

REM 필수 요구사항 확인
:check_requirements
echo %BLUE%🔍 시스템 요구사항 확인 중...%NC%

REM Node.js 확인
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%❌ Node.js가 설치되지 않았습니다%NC%
    echo Node.js 14 이상을 설치해주세요: https://nodejs.org
    exit /b 1
)

for /f "tokens=1 delims=.v" %%a in ('node --version') do set NODE_MAJOR=%%a
if %NODE_MAJOR:~1% lss 14 (
    echo %RED%❌ Node.js 버전이 너무 낮습니다 (필요: v14+)%NC%
    exit /b 1
)

echo %GREEN%✅ Node.js %NODE_VERSION%%NC%

REM npm 확인
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %RED%❌ npm이 설치되지 않았습니다%NC%
    exit /b 1
)

echo %GREEN%✅ npm 확인됨%NC%

REM 릴레이 서버 파일 확인
if not exist "relay-node-server.js" (
    echo %RED%❌ relay-node-server.js 파일이 없습니다%NC%
    echo 현재 디렉토리에 릴레이 서버 파일이 있는지 확인해주세요
    exit /b 1
)

echo %GREEN%✅ 릴레이 서버 파일 확인됨%NC%
goto :eof

REM 의존성 설치
:install_dependencies
echo %BLUE%📦 의존성 확인 중...%NC%

REM package.json이 없으면 생성
if not exist "package.json" (
    echo %YELLOW%📄 package.json 생성 중...%NC%
    (
        echo {
        echo   "name": "brotherhood-relay-node",
        echo   "version": "1.0.0",
        echo   "description": "BROTHERHOOD 릴레이 노드",
        echo   "main": "relay-node-server.js",
        echo   "scripts": {
        echo     "start": "node relay-node-server.js",
        echo     "dev": "node relay-node-server.js"
        echo   },
        echo   "dependencies": {
        echo     "ws": "^8.14.2",
        echo     "express": "^4.18.2",
        echo     "cors": "^2.8.5"
        echo   },
        echo   "keywords": ["blockchain", "relay", "p2p", "brotherhood"],
        echo   "author": "BROTHERHOOD Community",
        echo   "license": "MIT"
        echo }
    ) > package.json
)

REM node_modules가 없으면 설치
if not exist "node_modules" (
    echo %BLUE%⬇️ 의존성 설치 중...%NC%
    call npm install
    if %errorlevel% neq 0 (
        echo %RED%❌ 의존성 설치 실패%NC%
        exit /b 1
    )
    echo %GREEN%✅ 의존성 설치 완료%NC%
) else (
    echo %GREEN%✅ 의존성이 이미 설치됨%NC%
)
goto :eof

REM 포트 사용 가능 여부 확인
:check_port
set PORT_TO_CHECK=%1
netstat -an | find ":%PORT_TO_CHECK% " | find "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo %RED%❌ 포트 %PORT_TO_CHECK%가 이미 사용 중입니다%NC%
    echo 다른 포트를 사용하거나 사용 중인 프로세스를 종료해주세요
    exit /b 1
)

echo %GREEN%✅ 포트 %PORT_TO_CHECK% 사용 가능%NC%
goto :eof

REM 네트워크 정보 표시
:show_network_info
echo %PURPLE%🌐 네트워크 정보:%NC%

REM IP 주소 확인
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    set LOCAL_IP=%%a
    set LOCAL_IP=!LOCAL_IP: =!
    goto :ip_found
)
set LOCAL_IP=확인불가
:ip_found

echo   📍 로컬 IP: %LOCAL_IP%
echo   🌐 포트: %PORT%
echo   🔗 WebSocket 엔드포인트: ws://%LOCAL_IP%:%PORT%

REM 방화벽 정보
echo %YELLOW%  ⚠️ Windows 방화벽이 활성화되어 있다면 포트 %PORT%를 열어주세요%NC%
echo.
goto :eof

REM Windows 서비스 설치
:install_service
echo %BLUE%🔧 Windows 서비스로 설치 중...%NC%

REM PM2가 있는지 확인
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo %YELLOW%📦 PM2 설치 중... (Windows 서비스 관리용)%NC%
    call npm install -g pm2
    call npm install -g pm2-windows-service
)

REM PM2로 서비스 시작
call pm2 start relay-node-server.js --name "brotherhood-relay" -- --port %PORT% --name "%NAME%" --region %REGION% --max-connections %MAX_CONNECTIONS%
call pm2 save
call pm2-service-install -n "BrotherhoodRelay"

echo %GREEN%✅ Windows 서비스로 설치됨%NC%
echo 서비스 관리:
echo   시작: net start BrotherhoodRelay
echo   중지: net stop BrotherhoodRelay
echo   상태: pm2 status
goto :eof

REM 릴레이 노드 시작
:start_relay
set cmd=node relay-node-server.js

REM 매개변수 추가
if not "%PORT%"=="%DEFAULT_PORT%" (
    set cmd=%cmd% --port %PORT%
)

if not "%NAME%"=="%DEFAULT_NAME%" (
    set cmd=%cmd% --name "%NAME%"
)

if not "%REGION%"=="%DEFAULT_REGION%" (
    set cmd=%cmd% --region %REGION%
)

if not "%MAX_CONNECTIONS%"=="%DEFAULT_MAX_CONNECTIONS%" (
    set cmd=%cmd% --max-connections %MAX_CONNECTIONS%
)

echo %GREEN%🚀 릴레이 노드 시작 중...%NC%
echo 명령어: %cmd%
echo.

if "%INSTALL_SERVICE%"=="true" (
    call :install_service
    goto :eof
)

echo %BLUE%⚙️ 릴레이 노드 실행 중... (Ctrl+C로 중지)%NC%
echo.

REM 실행
%cmd%
goto :eof

REM 메인 함수
:main
call :print_banner

REM 기본값 설정
set PORT=%DEFAULT_PORT%
set NAME=%DEFAULT_NAME%
set REGION=%DEFAULT_REGION%
set MAX_CONNECTIONS=%DEFAULT_MAX_CONNECTIONS%
set INSTALL_SERVICE=false

REM 매개변수 파싱
:parse_args
if "%~1"=="" goto :args_done

if "%~1"=="--port" (
    set PORT=%~2
    shift
    shift
    goto :parse_args
)

if "%~1"=="--name" (
    set NAME=%~2
    shift
    shift
    goto :parse_args
)

if "%~1"=="--region" (
    set REGION=%~2
    shift
    shift
    goto :parse_args
)

if "%~1"=="--max-connections" (
    set MAX_CONNECTIONS=%~2
    shift
    shift
    goto :parse_args
)

if "%~1"=="--service" (
    set INSTALL_SERVICE=true
    shift
    goto :parse_args
)

if "%~1"=="--help" (
    call :show_help
    exit /b 0
)

echo %RED%❌ 알 수 없는 옵션: %~1%NC%
echo 도움말을 보려면 %~nx0 --help를 실행하세요
exit /b 1

:args_done

echo %BLUE%🛠️ 릴레이 노드 설정:%NC%
echo   📛 이름: %NAME%
echo   🌐 포트: %PORT%
echo   📍 지역: %REGION%
echo   👥 최대 연결: %MAX_CONNECTIONS%
if "%INSTALL_SERVICE%"=="true" (
    echo   ⚙️ 모드: Windows 서비스 설치
) else (
    echo   ⚙️ 모드: 일반 실행
)
echo.

call :check_requirements
if %errorlevel% neq 0 exit /b %errorlevel%

call :install_dependencies
if %errorlevel% neq 0 exit /b %errorlevel%

call :check_port %PORT%
if %errorlevel% neq 0 exit /b %errorlevel%

call :show_network_info
call :start_relay

goto :eof

REM 스크립트 실행
call :main %*



