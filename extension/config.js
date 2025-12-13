/**
 * extension\config.js
 * Gena 중앙 설정 파일
 * 환경별 API URL 및 앱 설정 관리
 * 
 * @version 1.0.0
 */

const CONFIG = {
  /**
   * 현재 실행 환경 자동 감지
   *
   * ✅ Chrome Extension 환경:
   *    - manifest.update_url 존재 → production (크롬 웹스토어 배포)
   *    - manifest.update_url 없음 → development (로컬 로드)
   *
   * ✅ 웹 환경 (랜딩 페이지 등):
   *    - localhost / 127.0.0.1 → development
   *    - gena.com 도메인 → production
   *
   * ℹ️ 기본값: development (안전한 기본값)
   */
  ENV: (() => {
    try {
      // 1. Chrome Extension 환경 체크
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
        const manifest = chrome.runtime.getManifest();

        // update_url이 있으면 크롬 웹스토어에서 설치된 것 (프로덕션)
        // 참고: https://developer.chrome.com/docs/extensions/mv3/autoupdate/
        if (manifest.update_url) {
          console.log('[Config] Environment: production (Chrome Web Store)');
          return 'production';
        }

        console.log('[Config] Environment: development (Unpacked Extension)');
        return 'development';
      }

      // 2. 웹 환경 체크 (랜딩 페이지 등)
      if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname.toLowerCase();

        // 로컬 개발 환경
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          console.log('[Config] Environment: development (localhost)');
          return 'development';
        }

        // 프로덕션 도메인
        if (hostname.includes('gena.com')) {
          console.log('[Config] Environment: production (gena.com)');
          return 'production';
        }
      }

      // 3. 기본값: development
      console.log('[Config] Environment: development (default)');
      return 'development';

    } catch (error) {
      // 에러 발생 시 안전한 기본값 사용
      console.warn('[Config] Environment detection failed, using development:', error.message);
      return 'development';
    }
  })(),
  
  /**
   * 환경별 API Base URL
   */
  API_BASE_URL: {
    development: 'http://localhost:3000',
    production: 'https://api.gena.com'
  },

  /**
   * 환경별 프론트엔드 URL (이메일 링크 등에 사용)
   */
  FRONTEND_URL: {
    development: 'http://localhost:3000',
    production: 'https://gena.com'
  },
  
  /**
   * API 타임아웃 설정 (밀리초)
   */
  API_TIMEOUT: {
    development: 30000, // 30초 (개발 환경에서는 길게)
    production: 10000   // 10초
  },
  
  /**
   * 재시도 설정
   */
  MAX_RETRIES: {
    development: 5,
    production: 3
  },
  
  /**
   * 디버그 모드
   */
  DEBUG: {
    development: true,
    production: false
  },
  
  /**
   * 현재 환경의 API URL 반환
   * @returns {string} API Base URL
   */
  getApiUrl() {
    const url = this.API_BASE_URL[this.ENV];
    if (this.DEBUG[this.ENV]) {
      console.log(`[Config] API URL (${this.ENV}):`, url);
    }
    return url || this.API_BASE_URL.development;
  },
  
  /**
   * 현재 환경의 프론트엔드 URL 반환
   * @returns {string} Frontend URL
   */
  getFrontendUrl() {
    return this.FRONTEND_URL[this.ENV] || this.FRONTEND_URL.development;
  },
  
  /**
   * 현재 환경의 API 타임아웃 반환
   * @returns {number} 타임아웃 (밀리초)
   */
  getApiTimeout() {
    return this.API_TIMEOUT[this.ENV] || this.API_TIMEOUT.development;
  },
  
  /**
   * 현재 환경의 최대 재시도 횟수 반환
   * @returns {number} 최대 재시도 횟수
   */
  getMaxRetries() {
    return this.MAX_RETRIES[this.ENV] || this.MAX_RETRIES.development;
  },
  
  /**
   * 디버그 모드 여부 반환
   * @returns {boolean} 디버그 모드 활성화 여부
   */
  isDebug() {
    return this.DEBUG[this.ENV] || false;
  },
  
  /**
   * 개발 환경 여부 확인
   * @returns {boolean} 개발 환경이면 true
   */
  isDevelopment() {
    return this.ENV === 'development';
  },
  
  /**
   * 프로덕션 환경 여부 확인
   * @returns {boolean} 프로덕션 환경이면 true
   */
  isProduction() {
    return this.ENV === 'production';
  },
  
  /**
   * 설정 정보 출력 (디버그용)
   */
  printConfig() {
    if (this.isDebug()) {
      console.log('='.repeat(60));
      console.log('📋 Gena Configuration');
      console.log('='.repeat(60));
      console.log(`🌍 Environment: ${this.ENV}`);
      console.log(`🔗 API URL: ${this.getApiUrl()}`);
      console.log(`🌐 Frontend URL: ${this.getFrontendUrl()}`);
      console.log(`⏱️  API Timeout: ${this.getApiTimeout()}ms`);
      console.log(`🔄 Max Retries: ${this.getMaxRetries()}`);
      console.log(`🐛 Debug Mode: ${this.isDebug()}`);
      console.log('='.repeat(60));
    }
  }
};

// 초기화 시 설정 정보 출력
CONFIG.printConfig();

// CommonJS & ES Module 호환
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

// 브라우저 환경 (전역 변수)
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

/**
 * Firebase 설정
 */
CONFIG.FIREBASE = {
  apiKey: "AIzaSyCgY7q7s_kLPoVWjJKajVfpyVOR_InqRWo",
  authDomain: "badaai.firebaseapp.com",
  projectId: "badaai",
  storageBucket: "badaai.firebasestorage.app",
  messagingSenderId: "203450855233",
  appId: "1:203450855233:web:39e0ff6aea7c5b2f743bc0"
};

/**
 * Firebase 설정 반환
 * @returns {Object} Firebase Config
 */
CONFIG.getFirebaseConfig = function() {
  return this.FIREBASE;
};

// Firebase 설정 출력 (디버그용)
if (CONFIG.isDebug()) {
  console.log('🔥 Firebase Config:', CONFIG.FIREBASE.projectId);
}