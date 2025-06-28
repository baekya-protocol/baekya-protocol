# 백야 프로토콜 Docker 이미지

# Node.js 18 베이스 이미지
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# 웹 앱 빌드
RUN npm run build

# 포트 노출
EXPOSE 3000

# 환경 변수
ENV NODE_ENV=production
ENV PORT=3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/status || exit 1

# 앱 시작
CMD ["node", "web-server.js"] 