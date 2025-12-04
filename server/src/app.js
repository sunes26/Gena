/**
 * Express 애플리케이션 설정
 * 미들웨어, 라우터, 에러 핸들러 구성
 * 
 * ✅ v2.0 업데이트:
 * - CORS 설정 개선 (Chrome Extension ID 정확히 매칭)
 * - .env의 ALLOWED_ORIGINS 환경변수 활용
 * - 개발/프로덕션 환경 분리 강화
 * 
 * @module app
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Constants
const {
  BODY_LIMITS,
  CORS: CORS_CONFIG,
  HTTP_STATUS,
  LOGGING,
  ENVIRONMENTS
} = require('./constants');

// Middleware
const { globalLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Routes
const routes = require('./routes');

// ===== CORS 설정 함수 =====

/**
 * 허용된 오리진 목록 생성
 * 환경변수 우선 사용 → 기본값 fallback
 * 
 * @returns {Array<string|RegExp>} 허용된 오리진 목록
 */
function getAllowedOrigins() {
  const isDevelopment = process.env.NODE_ENV === ENVIRONMENTS.DEVELOPMENT;
  
  // ===== 개발 환경 =====
  if (isDevelopment) {
    // 환경변수에서 ALLOWED_ORIGINS 읽기
    const envOrigins = process.env.ALLOWED_ORIGINS;
    
    if (envOrigins) {
      const origins = envOrigins.split(',').map(origin => origin.trim());
      const patterns = [];
      
      origins.forEach(origin => {
        // chrome-extension://* 패턴
        if (origin === 'chrome-extension://*') {
          // Chrome Extension ID 형식: 32자 소문자 (a-z)
          patterns.push(/^chrome-extension:\/\/[a-z]{32}$/);
        }
        // http://localhost:* 패턴
        else if (origin === 'http://localhost:*') {
          patterns.push(/^http:\/\/localhost:\d+$/);
          patterns.push(/^http:\/\/127\.0\.0\.1:\d+$/);
        }
        // https://localhost:* 패턴
        else if (origin === 'https://localhost:*') {
          patterns.push(/^https:\/\/localhost:\d+$/);
          patterns.push(/^https:\/\/127\.0\.0\.1:\d+$/);
        }
        // 정확한 URL
        else {
          patterns.push(origin);
        }
      });
      
      console.log('[CORS] 개발 환경 - 허용된 오리진 패턴:', patterns.length, '개');
      return patterns;
    }
    
    // 기본값 (환경변수 없을 경우)
    return [
      /^chrome-extension:\/\/[a-z]{32}$/,
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/
    ];
  } 
  
  // ===== 프로덕션 환경 =====
  else {
    // 환경변수에서 ALLOWED_EXTENSION_IDS 읽기
    const allowedIds = process.env.ALLOWED_EXTENSION_IDS 
      ? process.env.ALLOWED_EXTENSION_IDS.split(',').map(id => id.trim())
      : [];
    
    if (allowedIds.length === 0) {
      console.warn('⚠️ [CORS] 프로덕션 환경이지만 ALLOWED_EXTENSION_IDS가 설정되지 않았습니다!');
      console.warn('⚠️ [CORS] 모든 Chrome Extension 요청이 차단됩니다.');
    }
    
    const origins = allowedIds.map(id => `chrome-extension://${id}`);
    console.log('[CORS] 프로덕션 환경 - 허용된 Extension ID:', allowedIds.length, '개');
    
    return origins;
  }
}

/**
 * 오리진 검증 함수
 * 
 * @param {string} origin - 요청 오리진
 * @returns {boolean} 허용 여부
 */
function isOriginAllowed(origin) {
  // 오리진이 없는 경우 (예: Postman, 서버 to 서버)
  if (!origin) {
    return true;
  }
  
  const allowedOrigins = getAllowedOrigins();
  const isDevelopment = process.env.NODE_ENV === ENVIRONMENTS.DEVELOPMENT;
  
  // 허용 목록 확인
  const allowed = allowedOrigins.some(pattern => {
    // RegExp 패턴 매칭
    if (pattern instanceof RegExp) {
      return pattern.test(origin);
    }
    // 문자열 정확 매칭
    return pattern === origin;
  });
  
  return allowed;
}

// ===== 요청 로깅 미들웨어 =====

/**
 * 요청 로깅 미들웨어
 * 모든 요청의 메서드, 경로, 응답 시간, 상태 코드 기록
 * 
 * @param {Object} req - Express request 객체
 * @param {Object} res - Express response 객체
 * @param {Function} next - Express next 함수
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // 응답 완료 시 로깅
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= HTTP_STATUS.BAD_REQUEST 
      ? LOGGING.LEVELS.ERROR 
      : LOGGING.LEVELS.INFO;
    
    // 에러 로그 또는 디버그 모드에서만 출력
    if (logLevel === LOGGING.LEVELS.ERROR || process.env.LOG_LEVEL === LOGGING.LEVELS.DEBUG) {
      console.log(
        `[${new Date().toISOString()}] ` +
        `${req.method} ${req.path} - ` +
        `${res.statusCode} (${duration}ms) - ` +
        `Origin: ${req.headers.origin || 'none'}`
      );
    }
  });
  
  next();
}

// ===== Express 앱 생성 함수 =====

/**
 * Express 애플리케이션 생성 및 구성
 * 
 * @returns {express.Application} 구성된 Express 앱
 * 
 * @example
 * const createApp = require('./src/app');
 * const app = createApp();
 * app.listen(3000);
 */
function createApp() {
  const app = express();
  
  // ===== 1. 보안 헤더 설정 =====
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  
  // ===== 2. CORS 설정 (가장 중요!) =====
  app.use(cors({
    origin: function (origin, callback) {
      const allowed = isOriginAllowed(origin);
      
      if (!allowed) {
        console.warn(`⚠️ CORS 차단: ${origin}`);
        return callback(new Error('CORS policy: Origin not allowed'), false);
      }
      
      // 개발 환경에서 허용된 오리진 로그
      if (process.env.NODE_ENV === ENVIRONMENTS.DEVELOPMENT && origin) {
        console.log(`✅ CORS 허용: ${origin}`);
      }
      
      callback(null, true);
    },
    credentials: true,
    allowedHeaders: CORS_CONFIG.ALLOWED_HEADERS,
    exposedHeaders: CORS_CONFIG.EXPOSED_HEADERS,
    methods: CORS_CONFIG.ALLOWED_METHODS,
    maxAge: CORS_CONFIG.MAX_AGE
  }));
  
  // ===== 3. Body Parser 설정 =====
  app.use(express.json({ limit: BODY_LIMITS.JSON }));
  app.use(express.urlencoded({ extended: true, limit: BODY_LIMITS.URL_ENCODED }));
  
  // ===== 4. 정적 파일 제공 (선택) =====
  if (process.env.SERVE_STATIC === 'true') {
    app.use(express.static('public'));
  }
  
  // ===== 5. 요청 로깅 =====
  app.use(requestLogger);
  
  // ===== 6. 글로벌 Rate Limiting =====
  app.use(globalLimiter);
  
  // ===== 7. 라우터 연결 =====
  app.use('/', routes);
  
  // ===== 8. 404 핸들러 =====
  app.use(notFoundHandler);
  
  // ===== 9. 전역 에러 핸들러 =====
  app.use(errorHandler);
  
  return app;
}

// ===== Export =====

module.exports = createApp;