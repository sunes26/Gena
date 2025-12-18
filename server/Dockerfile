# ===================================================================
# Gena Server - Google Cloud Run 최적화 빌드 (프로덕션)
# Node.js 18 기반, Firebase 실제 인증, 포트 3000
# ===================================================================

# ===== Stage 1: Dependencies =====
FROM node:18-alpine AS dependencies

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일만 먼저 복사 (레이어 캐싱 최적화)
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production && \
    npm cache clean --force

# ===== Stage 2: Production =====
FROM node:18-alpine AS production

# 메타데이터
LABEL maintainer="Gena Team"
LABEL version="2.1.0"
LABEL description="AI-powered web summarization service - Production Build"

# 비루트 사용자 생성 (보안)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 복사
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# 애플리케이션 소스 복사
COPY --chown=nodejs:nodejs . .

# 🔥 Firebase 인증 방법:
# - Cloud Run: 기본 서비스 계정 사용 (ADC - Application Default Credentials)
# - 로컬 개발: serviceAccountKey.json 사용 (별도로 마운트)
# ⚠️ 보안: serviceAccountKey.json은 이미지에 포함하지 않음!

# ===== 환경변수 기본값 설정 =====
ENV NODE_ENV=production
# PORT는 Cloud Run이 동적으로 할당 (기본값: 8080)

# 애플리케이션 설정
ENV FREE_USER_DAILY_LIMIT=3
ENV DATA_RETENTION_DAYS=30
ENV RATE_LIMIT_WINDOW_MS=60000
ENV RATE_LIMIT_MAX_REQUESTS=30
ENV CACHE_TTL=60000

# ===== 헬스체크 설정 =====
# Cloud Run은 자체 헬스체크를 사용하므로 HEALTHCHECK 비활성화
# HEALTHCHECK는 Cloud Run에서 무시됨

# 포트 노출 (Cloud Run은 8080이 기본값)
EXPOSE 8080

# 비루트 사용자로 전환 (보안 강화)
USER nodejs

# ===== 애플리케이션 시작 =====
CMD ["node", "src/server.js"]

# ===================================================================
# 빌드 및 실행 명령어:
#
# 1. 프로덕션 이미지 빌드:
#    docker build -t Gena-server:production .
#
# 2. 로컬 테스트 실행:
#    docker run -d \
#      --name Gena-server \
#      -p 3000:3000 \
#      -e OPENAI_API_KEY=your-key \
#      -e JWT_SECRET=your-secret-min-32-chars \
#      -e ALLOWED_EXTENSION_IDS=your-extension-id \
#      -e NODE_ENV=production \
#      -e FREE_USER_DAILY_LIMIT=3 \
#      --restart unless-stopped \
#      Gena-server:production
#
# 3. 환경변수 확인:
#    docker exec Gena-server env | grep FREE_USER_DAILY_LIMIT
#
# 4. 로그 확인:
#    docker logs -f Gena-server
#
# 5. Cloud Run 배포:
#    gcloud run deploy Gena-server \
#      --image gcr.io/PROJECT_ID/Gena-server:v1 \
#      --platform managed \
#      --region asia-northeast3 \
#      --allow-unauthenticated \
#      --memory 512Mi \
#      --cpu 1 \
#      --port 3000 \
#      --set-env-vars FREE_USER_DAILY_LIMIT=3
# ===================================================================