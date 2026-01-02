﻿/**
 * extension\background.js
 * Gena Enhanced Background Service Worker - All-in-One
 * TokenManager, ErrorHandler, 모든 기능 통합
 *
 * ✨ v5.1.0 업데이트:
 * - Firebase Auth 자동 복구 추가 (onStartup)
 * - Keep-Alive ping 응답 강화 (Firebase Auth 상태 포함)
 * - 타임아웃 180초로 통일
 * - PDF 진행 상황 중계 기능 추가
 * - Side Panel 자동 복원 기능 추가 (방법 6)
 * - 탭 전환 시 Side Panel 자동 닫힘/열림 처리
 *
 * @version 5.1.0
 */

// Config 로드 (Service Worker에서 사용하기 위해)
importScripts('config.js');

console.log('[Background] 🔵 Gena 시작 (v5.1.0 - Side Panel 자동 복원)');

// =====================================================
// 1. ErrorHandler 모듈 (통합)
// =====================================================

const ErrorType = {
  NETWORK: 'network',
  API: 'api',
  VALIDATION: 'validation',
  STORAGE: 'storage',
  UNKNOWN: 'unknown'
};

const ErrorSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

class ErrorHandler {
  constructor() {
    this.errors = [];
    this.maxErrors = 50;
    console.log('[ErrorHandler] 초기화 완료 (최대 로그: 50개)');
  }
  
  handle(error, context = '', severity = ErrorSeverity.ERROR) {
    const errorType = this.classifyError(error);
    this.logError(error, context, severity, errorType);
    return this.getUserMessage(error);
  }
  
  logError(error, context = '', severity = ErrorSeverity.ERROR, type = null) {
    const errorType = type || this.classifyError(error);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      context: context,
      message: error.message || String(error),
      name: error.name || 'Error',
      type: errorType,
      severity: severity,
      stack: error.stack ? error.stack.substring(0, 500) : null
    };
    
    this.errors.push(logEntry);
    
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }
    
    const logPrefix = `[${severity.toUpperCase()}] ${context}`;
    
    switch (severity) {
      case ErrorSeverity.INFO:
        console.info(logPrefix, error);
        break;
      case ErrorSeverity.WARNING:
        console.warn(logPrefix, error);
        break;
      case ErrorSeverity.CRITICAL:
        console.error(`🚨 ${logPrefix}`, error);
        break;
      case ErrorSeverity.ERROR:
      default:
        console.error(logPrefix, error);
    }
  }
  
  classifyError(error) {
    const message = (error.message || '').toLowerCase();
    const name = (error.name || '').toLowerCase();
    
    if (message.includes('failed to fetch') || 
        message.includes('network') || 
        message.includes('인터넷') ||
        name.includes('network')) {
      return ErrorType.NETWORK;
    }
    
    if (message.includes('api') || 
        message.includes('unauthorized') || 
        message.includes('401') ||
        message.includes('429') ||
        message.includes('rate') ||
        message.includes('한도')) {
      return ErrorType.API;
    }
    
    if (message.includes('50자') || 
        message.includes('최소') || 
        message.includes('최대') ||
        message.includes('유효') ||
        message.includes('validation')) {
      return ErrorType.VALIDATION;
    }
    
    if (message.includes('storage') || 
        message.includes('quota') ||
        message.includes('저장') ||
        name.includes('quotaexceeded')) {
      return ErrorType.STORAGE;
    }
    
    return ErrorType.UNKNOWN;
  }
  
  getUserMessage(error) {
    const message = (error.message || '').toLowerCase();

    if (message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('인터넷')) {
      return chrome.i18n.getMessage('errorNetworkConnection');
    }

    if (message.includes('timeout') || message.includes('시간')) {
      return chrome.i18n.getMessage('errorTimeout');
    }

    if (message.includes('api key') ||
        message.includes('unauthorized') ||
        message.includes('401')) {
      return chrome.i18n.getMessage('errorApiKey');
    }

    if (message.includes('429') ||
        message.includes('rate') ||
        message.includes('한도')) {
      return chrome.i18n.getMessage('errorRateLimit');
    }

    if (message.includes('500') ||
        message.includes('502') ||
        message.includes('503')) {
      return chrome.i18n.getMessage('errorServerIssue');
    }

    if (message.includes('50자') ||
        message.includes('최소') ||
        message.includes('최대')) {
      return error.message;
    }

    if (message.includes('quota') || message.includes('저장')) {
      return chrome.i18n.getMessage('errorStorageQuota');
    }

    return error.message || chrome.i18n.getMessage('errorGeneric');
  }
  
  async retry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        if (this.isNonRetryableError(error)) {
          this.logError(error, 'retry-skipped', ErrorSeverity.WARNING);
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[Retry] ${attempt + 1}/${maxRetries} - ${delay}ms 대기`);
        
        await this.sleep(delay);
      }
    }
    
    this.logError(lastError, 'retry-failed', ErrorSeverity.ERROR);
    throw lastError;
  }
  
  isNonRetryableError(error) {
    const message = (error.message || '').toLowerCase();
    
    if (message.includes('api key') || 
        message.includes('unauthorized') || 
        message.includes('401')) {
      return true;
    }
    
    if (message.includes('50자') || 
        message.includes('최소') || 
        message.includes('최대') ||
        message.includes('유효한')) {
      return true;
    }
    
    if (message.includes('400')) {
      return true;
    }
    
    return false;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getRecentErrors(limit = 10) {
    const validLimit = Math.min(Math.max(1, limit), this.maxErrors);
    return this.errors.slice(-validLimit);
  }
  
  getErrorsByType(type, limit = 10) {
    const filtered = this.errors.filter(err => err.type === type);
    return filtered.slice(-limit);
  }
  
  getErrorsBySeverity(minSeverity, limit = 10) {
    const severityOrder = {
      [ErrorSeverity.INFO]: 0,
      [ErrorSeverity.WARNING]: 1,
      [ErrorSeverity.ERROR]: 2,
      [ErrorSeverity.CRITICAL]: 3
    };
    
    const minLevel = severityOrder[minSeverity] || 0;
    const filtered = this.errors.filter(err => 
      severityOrder[err.severity] >= minLevel
    );
    
    return filtered.slice(-limit);
  }
  
  getErrorStats() {
    const stats = {
      total: this.errors.length,
      byType: {},
      bySeverity: {}
    };
    
    Object.values(ErrorType).forEach(type => {
      stats.byType[type] = 0;
    });
    
    Object.values(ErrorSeverity).forEach(severity => {
      stats.bySeverity[severity] = 0;
    });
    
    this.errors.forEach(err => {
      stats.byType[err.type] = (stats.byType[err.type] || 0) + 1;
      stats.bySeverity[err.severity] = (stats.bySeverity[err.severity] || 0) + 1;
    });
    
    return stats;
  }
  
  clearErrors() {
    const count = this.errors.length;
    this.errors = [];
    console.log(`[ErrorHandler] 에러 로그 초기화 (${count}개 삭제)`);
  }
}

const errorHandler = new ErrorHandler();

if (typeof self !== 'undefined') {
  self.ErrorHandler = ErrorHandler;
  self.ErrorType = ErrorType;
  self.ErrorSeverity = ErrorSeverity;
  self.errorHandler = errorHandler;
}

if (typeof globalThis !== 'undefined') {
  globalThis.ErrorHandler = ErrorHandler;
  globalThis.ErrorType = ErrorType;
  globalThis.ErrorSeverity = ErrorSeverity;
  globalThis.errorHandler = errorHandler;
}

console.log('[ErrorHandler] ✅ Module loaded');

// =====================================================
// 2. TokenManager 모듈 (통합)
// =====================================================

class TokenManager {
  constructor() {
    this.API_BASE_URL = 'https://api.genaai.net';
    this.TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000;
    this.isRefreshing = false;
    this.refreshSubscribers = [];
  }

  decodeToken(token) {
    if (!token || typeof token !== 'string') {
      return null;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('[TokenManager] Invalid JWT format');
        return null;
      }

      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(payload));
      
      return decoded;
    } catch (error) {
      console.error('[TokenManager] Token decode error:', error);
      return null;
    }
  }

  isTokenExpired(token, threshold = this.TOKEN_REFRESH_THRESHOLD) {
    const decoded = this.decodeToken(token);
    
    if (!decoded || !decoded.exp) {
      return true;
    }

    const expirationTime = decoded.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiry = expirationTime - currentTime;

    return timeUntilExpiry <= threshold;
  }

  getTimeUntilExpiry(token) {
    const decoded = this.decodeToken(token);
    
    if (!decoded || !decoded.exp) {
      return 0;
    }

    const expirationTime = decoded.exp * 1000;
    const currentTime = Date.now();
    const timeRemaining = expirationTime - currentTime;

    return Math.max(0, timeRemaining);
  }

  async saveTokens(accessToken, refreshToken, rememberMe = true) {
    try {
      const tokenData = {
        accessToken,
        refreshToken,
        savedAt: Date.now(),
        rememberMe: rememberMe
      };

      const decoded = this.decodeToken(accessToken);
      if (decoded && decoded.exp) {
        tokenData.expiresAt = decoded.exp * 1000;
      }

      if (rememberMe) {
        // 로그인 상태 유지 ON - 영구 저장
        await chrome.storage.local.set({ tokens: tokenData });
        console.log('[TokenManager] ✅ Tokens saved to LOCAL (영구 저장)');
      } else {
        // 로그인 상태 유지 OFF - 세션만 저장
        await chrome.storage.session.set({ tokens: tokenData });
        console.log('[TokenManager] ✅ Tokens saved to SESSION (브라우저 닫으면 삭제)');
      }

      this.scheduleTokenRefresh(accessToken);

    } catch (error) {
      console.error('[TokenManager] Save tokens error:', error);
      throw new Error('토큰 저장에 실패했습니다.');
    }
  }

  async getAccessToken() {
    try {
      // local과 session 둘 다 확인
      let result = await chrome.storage.local.get('tokens');

      if (!result.tokens) {
        result = await chrome.storage.session.get('tokens');
      }

      if (!result.tokens || !result.tokens.accessToken) {
        return null;
      }

      return result.tokens.accessToken;
    } catch (error) {
      console.error('[TokenManager] Get access token error:', error);
      return null;
    }
  }

  async getRefreshToken() {
    try {
      // local과 session 둘 다 확인
      let result = await chrome.storage.local.get('tokens');

      if (!result.tokens) {
        result = await chrome.storage.session.get('tokens');
      }

      if (!result.tokens || !result.tokens.refreshToken) {
        return null;
      }

      return result.tokens.refreshToken;
    } catch (error) {
      console.error('[TokenManager] Get refresh token error:', error);
      return null;
    }
  }

  async hasValidToken() {
    const accessToken = await this.getAccessToken();
    
    if (!accessToken) {
      return false;
    }

    return !this.isTokenExpired(accessToken);
  }

  async refreshAccessToken() {
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.refreshSubscribers.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;

    try {
      if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth()) {
        const error = new Error('Firebase Auth를 사용할 수 없습니다');
        error.code = 'FIREBASE_NOT_AVAILABLE';
        throw error;
      }

      const currentUser = firebase.auth().currentUser;

      if (!currentUser) {
        const error = new Error('로그인이 필요합니다');
        error.code = 'NO_CURRENT_USER';
        throw error;
      }

      console.log('[TokenManager] 🔄 Firebase 토큰 갱신 시작...');

      const newIdToken = await currentUser.getIdToken(true);
      const newRefreshToken = currentUser.refreshToken;

      await this.saveTokens(newIdToken, newRefreshToken);

      console.log('[TokenManager] ✅ 토큰 갱신 성공');

      this.refreshSubscribers.forEach(subscriber => {
        subscriber.resolve(newIdToken);
      });
      this.refreshSubscribers = [];

      return newIdToken;

    } catch (error) {
      console.error('[TokenManager] ❌ 토큰 갱신 실패:', error);

      this.refreshSubscribers.forEach(subscriber => {
        subscriber.reject(error);
      });
      this.refreshSubscribers = [];

      throw error;
    } finally {
      this.isRefreshing = false;
    }
  }

  scheduleTokenRefresh(accessToken) {
    const timeUntilExpiry = this.getTimeUntilExpiry(accessToken);
    
    if (timeUntilExpiry <= 0) {
      console.warn('[TokenManager] Token already expired');
      return;
    }

    const refreshTime = Math.max(
      1,
      Math.floor((timeUntilExpiry - this.TOKEN_REFRESH_THRESHOLD) / 60000)
    );

    chrome.alarms.create('token-refresh', {
      delayInMinutes: refreshTime
    });

    console.log(`[TokenManager] Token refresh scheduled in ${refreshTime} minutes`);
  }

  async clearTokens() {
    try {
      // local과 session 둘 다 삭제
      await chrome.storage.local.remove('tokens');
      await chrome.storage.session.remove('tokens');

      chrome.alarms.clear('token-refresh');

      console.log('[TokenManager] Tokens cleared (both LOCAL and SESSION)');
    } catch (error) {
      console.error('[TokenManager] Clear tokens error:', error);
      throw new Error('토큰 삭제에 실패했습니다.');
    }
  }

  async getTokenInfo() {
    const accessToken = await this.getAccessToken();
    const refreshToken = await this.getRefreshToken();

    if (!accessToken) {
      return {
        isAuthenticated: false,
        message: '토큰이 없습니다.'
      };
    }

    const decoded = this.decodeToken(accessToken);
    const isExpired = this.isTokenExpired(accessToken);
    const timeUntilExpiry = this.getTimeUntilExpiry(accessToken);

    return {
      isAuthenticated: true,
      isExpired,
      timeUntilExpiry,
      emailVerified: decoded?.email_verified || false,
      expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null,
      user: {
        id: decoded?.sub || decoded?.userId,
        email: decoded?.email
      }
    };
  }

  /**
   * 사용자의 이메일 인증 상태를 새로고침
   * Firebase Auth에서 최신 ID 토큰을 가져와 email_verified 상태 업데이트
   * (Gena_Page의 user.reload() 패턴과 동일)
   */
  async refreshEmailVerificationStatus() {
    try {
      console.log('[TokenManager] 이메일 인증 상태 새로고침 시작');

      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('로그인이 필요합니다.');
      }

      const firebaseConfig = CONFIG.getFirebaseConfig();
      const API_KEY = firebaseConfig.apiKey;

      // 1. Firebase REST API로 새로운 ID 토큰 발급 (최신 상태 반영)
      console.log('[TokenManager] 🔄 Firebase REST API로 토큰 갱신 중...');
      const tokenUrl = `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`;

      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error?.message || '토큰 갱신 실패');
      }

      const tokenData = await tokenResponse.json();
      const newIdToken = tokenData.id_token;
      const newRefreshToken = tokenData.refresh_token;

      // 2. 새로운 토큰 저장
      await this.saveTokens(newIdToken, newRefreshToken);

      console.log('[TokenManager] ✅ 토큰 갱신 완료');

      // 3. 갱신된 토큰으로 최신 사용자 정보 가져오기
      const lookupUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`;

      const lookupResponse = await fetch(lookupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          idToken: newIdToken
        })
      });

      if (!lookupResponse.ok) {
        const errorData = await lookupResponse.json();
        throw new Error(errorData.error?.message || '사용자 정보 조회 실패');
      }

      const lookupData = await lookupResponse.json();
      const userData = lookupData.users?.[0];

      if (!userData) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }

      const emailVerified = userData.emailVerified || false;

      console.log('[TokenManager] 🔐 최신 이메일 인증 상태:', {
        email: userData.email,
        emailVerified: emailVerified,
        uid: userData.localId
      });

      console.log('[TokenManager] ✅ 이메일 인증 상태 새로고침 완료');

      return {
        success: true,
        emailVerified: emailVerified,
        email: userData.email
      };

    } catch (error) {
      console.error('[TokenManager] 이메일 인증 상태 새로고침 실패:', error);
      throw error;
    }
  }
}

const tokenManager = new TokenManager();

if (typeof self !== 'undefined') {
  self.TokenManager = TokenManager;
  self.tokenManager = tokenManager;
}

if (typeof globalThis !== 'undefined') {
  globalThis.TokenManager = TokenManager;
  globalThis.tokenManager = tokenManager;
}

console.log('[TokenManager] ✅ Module loaded');

// =====================================================
// 3. Background Service Worker 메인 로직
// =====================================================

console.log('[Background] ✅ Modules loaded successfully');

// ✨ 현재 활성 탭 추적 (v5.1.0 추가)
let currentActiveTabId = null;

// ===== 사이트 관리자 =====
class SiteManager {
  constructor() {
    this.specialSites = {
      'twitter.com': { spa: true, waitTime: 3000 },
      'x.com': { spa: true, waitTime: 3000 },
      'facebook.com': { spa: true, waitTime: 3000 },
      'instagram.com': { spa: true, waitTime: 3000 },
      'linkedin.com': { spa: true, waitTime: 2000 },
      'youtube.com': { spa: true, waitTime: 2000 },
      'notion.so': { spa: true, waitTime: 3000, requiresAuth: true },
      'docs.google.com': { requiresAuth: true, limited: true },
      'drive.google.com': { requiresAuth: true },
      'medium.com': { cookieWall: true, waitTime: 2000 },
      'tistory.com': { waitTime: 1500 },
      'blog.naver.com': { iframe: true, waitTime: 2000 },
      'velog.io': { spa: true, waitTime: 1500 },
      'nytimes.com': { paywall: true, waitTime: 2000 },
      'wsj.com': { paywall: true },
      'economist.com': { paywall: true },
      'arxiv.org': { pdf: true },
      'scholar.google.com': { waitTime: 1500 },
      'jstor.org': { requiresAuth: true },
      'ieee.org': { requiresAuth: true },
      'github.com': { spa: true, waitTime: 1500 },
      'gitlab.com': { spa: true, waitTime: 1500 },
      'stackoverflow.com': { waitTime: 1000 }
    };
    
    this.restrictedPatterns = [
      /^chrome:\/\//,
      /^chrome-extension:\/\//,
      /^edge:\/\//,
      /^about:/,
      /^file:\/\//,
      /^moz-extension:\/\//,
      /^safari-extension:\/\//,
      /^javascript:/i,
      /^data:/i,
      /^vbscript:/i
    ];
  }
  
  getSiteInfo(url) {
    try {
      if (!url) {
        return { type: 'unknown' };
      }
      
      if (typeof url !== 'string') {
        console.warn('[Security] Invalid URL type:', typeof url);
        return { type: 'unknown' };
      }
      
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      for (const [site, info] of Object.entries(this.specialSites)) {
        if (hostname.includes(site)) {
          return { ...info, site, hostname };
        }
      }
      
      return { hostname, type: 'generic' };
    } catch (error) {
      console.error('[Security] URL 파싱 오류:', error.message);
      errorHandler.handle(error, 'get-site-info');
      return { type: 'unknown' };
    }
  }
  
  isRestricted(url) {
    if (!url || typeof url !== 'string') {
      return true;
    }

    // ✨ PDF 파일은 제한 페이지에서 제외
    const urlLower = url.toLowerCase();
    if (urlLower.endsWith('.pdf') ||
        urlLower.includes('.pdf?') ||
        urlLower.includes('.pdf#') ||
        (urlLower.startsWith('file://') && urlLower.includes('.pdf'))) {
      return false;
    }

    return this.restrictedPatterns.some(pattern => pattern.test(url));
  }
  
  getWaitTime(url) {
    const siteInfo = this.getSiteInfo(url);
    const waitTime = siteInfo.waitTime || 1000;
    return Math.min(waitTime, 10000);
  }
}

// ===== 콘텐츠 스크립트 관리자 =====
class ContentScriptManager {
  constructor() {
    this.injectedTabs = new Set();
    this.pendingInjections = new Map();
  }
  
  async inject(tabId, files = ['content.js', 'content-overlay.js'], css = ['content-styles.css']) {
    if (!Number.isInteger(tabId) || tabId < 0) {
      console.error('[Security] Invalid tabId:', tabId);
      const error = new Error('Invalid tab ID');
      errorHandler.handle(error, 'inject-content-script');
      throw error;
    }
    
    if (this.injectedTabs.has(tabId)) {
      console.log(`탭 ${tabId}: 이미 주입됨`);
      return true;
    }
    
    if (this.pendingInjections.has(tabId)) {
      console.log(`탭 ${tabId}: 주입 대기 중`);
      return this.pendingInjections.get(tabId);
    }
    
    const injectionPromise = this.performInjection(tabId, files, css);
    this.pendingInjections.set(tabId, injectionPromise);
    
    try {
      await injectionPromise;
      this.injectedTabs.add(tabId);
      this.pendingInjections.delete(tabId);
      return true;
    } catch (error) {
      this.pendingInjections.delete(tabId);
      errorHandler.handle(error, 'content-script-injection');
      throw error;
    }
  }
  
  async performInjection(tabId, jsFiles, cssFiles) {
    try {
      const tab = await chrome.tabs.get(tabId);
      
      if (!tab.url || siteManager.isRestricted(tab.url)) {
        throw new Error('제한된 URL');
      }
      
      if (tab.status !== 'complete') {
        await this.waitForTabComplete(tabId);
      }
      
      if (cssFiles && cssFiles.length > 0) {
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: cssFiles
        });
      }
      
      await chrome.scripting.executeScript({
        target: { tabId },
        files: jsFiles
      });
      
      console.log(`탭 ${tabId}: 스크립트 주입 완료`);
      
      const waitTime = siteManager.getWaitTime(tab.url);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      return true;
    } catch (error) {
      console.error(`탭 ${tabId} 주입 실패:`, error.message);
      throw error;
    }
  }
  
  async waitForTabComplete(tabId, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkTab = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);
          
          if (tab.status === 'complete') {
            resolve();
            return;
          }
          
          if (Date.now() - startTime > timeout) {
            reject(new Error('탭 로드 타임아웃'));
            return;
          }
          
          setTimeout(checkTab, 500);
        } catch (error) {
          reject(error);
        }
      };
      
      checkTab();
    });
  }
  
  async check(tabId) {
    if (!this.injectedTabs.has(tabId)) {
      return false;
    }
    
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return response && response.success;
    } catch (error) {
      this.injectedTabs.delete(tabId);
      return false;
    }
  }
  
  cleanup(tabId) {
    this.injectedTabs.delete(tabId);
    this.pendingInjections.delete(tabId);
  }
  
  reset() {
    this.injectedTabs.clear();
    this.pendingInjections.clear();
  }
}

// ===== 추출 작업 관리자 =====
class ExtractionManager {
  constructor() {
    this.activeExtractions = new Map();
    this.extractionHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * ✨ PDF URL 감지
   * sidepanel.js의 isPDFUrl()과 동일한 로직
   */
  isPDFUrl(url) {
    if (!url) return false;

    const urlLower = url.toLowerCase();

    // 1. 직접 PDF URL
    if (urlLower.endsWith('.pdf') ||
        urlLower.includes('.pdf?') ||
        urlLower.includes('.pdf#')) {
      return true;
    }

    if (urlLower.startsWith('chrome-extension://') && urlLower.includes('.pdf')) {
      return true;
    }

    if (urlLower.startsWith('file://') && urlLower.includes('.pdf')) {
      return true;
    }

    // 2. PDF 뷰어 사이트
    if (urlLower.includes('drive.google.com/file/d/') ||
        (urlLower.includes('dropbox.com') && (urlLower.includes('/s/') || urlLower.includes('/sh/'))) ||
        urlLower.includes('onedrive.live.com') ||
        urlLower.includes('1drv.ms') ||
        urlLower.includes('arxiv.org/pdf/')) {
      return true;
    }

    return false;
  }

  /**
   * ✨ PDF 콘텐츠 추출
   * PDFOffscreenManager를 사용해서 PDF 텍스트 추출
   */
  async extractPDFContent(tabId, url, title) {
    console.log('[ExtractionManager] PDF 추출 시작:', url);

    try {
      // 1. PDF 다운로드
      console.log('[ExtractionManager]', chrome.i18n.getMessage('pdfDownloading'));
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`${chrome.i18n.getMessage('pdfExtractionFailed')}: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfData = Array.from(new Uint8Array(arrayBuffer));

      console.log(`[ExtractionManager] PDF 다운로드 완료: ${pdfData.length} bytes`);

      // 2. Offscreen 문서 생성
      await pdfOffscreenManager.createOffscreenDocument();

      // 3. PDF 텍스트 추출
      console.log('[ExtractionManager] PDF 텍스트 추출 중...');

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('PDF 추출 시간 초과 (180초)'));
        }, 180000);

        chrome.runtime.sendMessage(
          {
            action: 'extractPDFFromOffscreen',
            pdfData: pdfData,
            url: url
          },
          (response) => {
            clearTimeout(timeout);

            if (chrome.runtime.lastError) {
              reject(new Error(`메시지 전송 실패: ${chrome.runtime.lastError.message}`));
              return;
            }

            if (!response) {
              reject(new Error('Offscreen에서 응답이 없습니다'));
              return;
            }

            if (!response.success) {
              reject(new Error(response.error || 'PDF 추출 실패'));
              return;
            }

            resolve(response);
          }
        );
      });

      console.log('[ExtractionManager] ✅ PDF 추출 완료:', result.text?.length, '문자');
      console.log('[ExtractionManager] 📍 textItems 개수:', result.textItems?.length || 0);

      // 4. 결과 포맷팅
      return {
        success: true,
        content: result.text || '',
        textItems: result.textItems || null, // ✨ PDF 위치 정보 포함
        metadata: {
          title: title || '',
          url: url,
          isPDF: true,
          extractedPages: result.metadata?.extractedPages || 0,
          totalPages: result.metadata?.totalPages || 0,
          hasPositionData: result.metadata?.hasPositionData || false // ✨ 위치 정보 유무
        },
        stats: {
          charCount: result.text?.length || 0,
          wordCount: result.metadata?.wordCount || 0
        },
        tabId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ExtractionManager] PDF 추출 오류:', error);
      throw new Error(`PDF 추출 실패: ${error.message}`);
    }
  }

  async startExtraction(tabId, options = {}) {
    const validatedOptions = this.validateExtractionOptions(options);
    
    if (this.activeExtractions.has(tabId)) {
      console.log(`탭 ${tabId}: 이미 추출 중`);
      return this.activeExtractions.get(tabId);
    }
    
    const extraction = this.performExtraction(tabId, validatedOptions);
    this.activeExtractions.set(tabId, extraction);
    
    try {
      const result = await extraction;
      this.addToHistory(tabId, result);
      this.activeExtractions.delete(tabId);
      return result;
    } catch (error) {
      this.activeExtractions.delete(tabId);
      errorHandler.handle(error, 'extraction');
      throw error;
    }
  }
  
  validateExtractionOptions(options) {
    const defaults = {
      includeImages: true,
      includeTables: true,
      includeCode: true,
      maxScrolls: 3
    };
    
    const validated = { ...defaults };
    
    if (typeof options.includeImages === 'boolean') {
      validated.includeImages = options.includeImages;
    }
    if (typeof options.includeTables === 'boolean') {
      validated.includeTables = options.includeTables;
    }
    if (typeof options.includeCode === 'boolean') {
      validated.includeCode = options.includeCode;
    }
    if (typeof options.maxScrolls === 'number' && options.maxScrolls >= 0 && options.maxScrolls <= 10) {
      validated.maxScrolls = options.maxScrolls;
    }
    
    return validated;
  }
  
  async performExtraction(tabId, options) {
    try {
      const tab = await chrome.tabs.get(tabId);
      console.log('[ExtractionManager] 추출 시작:', tab.url.substring(0, 50) + '...');

      // ✨ PDF 감지 - PDF이면 PDFOffscreenManager 사용
      const isPDF = this.isPDFUrl(tab.url);
      if (isPDF) {
        console.log('[ExtractionManager] ✅ PDF URL 감지 - PDF 추출 로직 사용');
        return await this.extractPDFContent(tabId, tab.url, tab.title);
      }

      const isInjected = await contentScriptManager.check(tabId);
      if (!isInjected) {
        await contentScriptManager.inject(tabId);
      }

      const siteInfo = siteManager.getSiteInfo(tab.url);

      if (siteInfo.requiresAuth) {
        console.warn('인증이 필요한 사이트:', siteInfo.site);
      }

      if (siteInfo.paywall) {
        console.warn('페이월 사이트:', siteInfo.site);
      }

      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'extractContent',
        options: options
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || '콘텐츠 추출 실패');
      }
      
      if (!response.content || response.content.length < 50) {
        throw new Error('추출된 콘텐츠가 너무 짧습니다');
      }

      // ✨ 이미 PDF는 extractPDFContent()로 처리되므로 여기는 일반 웹페이지만
      return {
        ...response,
        tabId,
        url: tab.url,
        title: tab.title,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('추출 오류:', error.message);
      
      try {
        const fallbackResult = await this.fallbackExtraction(tabId);
        return fallbackResult;
      } catch (fallbackError) {
        errorHandler.handle(error, 'perform-extraction');
        throw error;
      }
    }
  }
  
  async fallbackExtraction(tabId) {
    console.log('[ExtractionManager] 폴백 추출 시도');

    // ✨ Tab 정보 가져오기 (PDF 감지용)
    const tab = await chrome.tabs.get(tabId);
    const isPDF = this.isPDFUrl(tab.url);

    console.log('[ExtractionManager] 폴백 추출 - PDF 여부:', isPDF, 'URL:', tab.url);

    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const content = document.body.innerText || document.body.textContent || '';
        const title = document.title;
        const url = window.location.href;

        return {
          content: content.substring(0, 10000),
          metadata: { title, url },
          stats: {
            wordCount: content.split(/\s+/).length,
            charCount: content.length,
            extractionMethod: { type: 'fallback' }
          }
        };
      }
    });

    if (result && result[0] && result[0].result) {
      const extractedData = result[0].result;

      // ✨ PDF이면 metadata에 isPDF 추가
      if (isPDF) {
        extractedData.metadata.isPDF = true;
        console.log('[ExtractionManager] ✅ 폴백 추출 - PDF 플래그 추가');
      }

      return {
        success: true,
        ...extractedData,
        tabId,
        timestamp: new Date().toISOString()
      };
    }

    throw new Error('폴백 추출도 실패');
  }
  
  addToHistory(tabId, result) {
    this.extractionHistory.unshift({
      tabId,
      url: result.url,
      title: result.title,
      timestamp: result.timestamp,
      stats: result.stats
    });
    
    if (this.extractionHistory.length > this.maxHistorySize) {
      this.extractionHistory = this.extractionHistory.slice(0, this.maxHistorySize);
    }
    
    this.saveHistory();
  }
  
  async saveHistory() {
    try {
      await chrome.storage.local.set({
        extractionHistory: this.extractionHistory.slice(0, 20)
      });
    } catch (error) {
      console.error('히스토리 저장 실패:', error.message);
      errorHandler.handle(error, 'save-extraction-history');
    }
  }
  
  async loadHistory() {
    try {
      const result = await chrome.storage.local.get('extractionHistory');
      if (result.extractionHistory) {
        this.extractionHistory = result.extractionHistory;
      }
    } catch (error) {
      console.error('히스토리 로드 실패:', error.message);
      errorHandler.handle(error, 'load-extraction-history');
    }
  }
}

// ===== PDF Offscreen Document 관리자 =====
class PDFOffscreenManager {
  constructor() {
    this.offscreenDocumentPath = 'pdf-offscreen.html';
    this.isCreating = false;
    this.creationPromise = null;
  }

  async hasOffscreenDocument() {
    try {
      if (!chrome.offscreen) {
        console.warn('[PDF Offscreen] Offscreen API 사용 불가 (Chrome 114+ 필요)');
        return false;
      }

      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(this.offscreenDocumentPath)]
      });

      return existingContexts.length > 0;
    } catch (error) {
      console.error('[PDF Offscreen] 문서 확인 오류:', error);
      return false;
    }
  }

  async waitForOffscreenReady(timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timeout')), 1000);
          
          chrome.runtime.sendMessage(
            { action: 'offscreenReady' },
            (response) => {
              clearTimeout(timer);
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              resolve(response);
            }
          );
        });
        
        if (response && response.ready) {
          console.log('[PDF Offscreen] ✅ Document 준비 완료');
          return true;
        }
      } catch (error) {
        console.log('[PDF Offscreen] 준비 대기 중...', Date.now() - startTime, 'ms');
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    throw new Error('Offscreen Document 준비 타임아웃');
  }

  async createOffscreenDocument() {
    if (this.isCreating && this.creationPromise) {
      console.log('[PDF Offscreen] 이미 생성 중...');
      return this.creationPromise;
    }

    if (await this.hasOffscreenDocument()) {
      console.log('[PDF Offscreen] 이미 존재함 - Ready 확인 중...');
      await this.waitForOffscreenReady();
      return true;
    }

    if (!chrome.offscreen) {
      throw new Error('Offscreen API를 사용할 수 없습니다. Chrome 114+ 버전을 사용해주세요.');
    }

    this.isCreating = true;
    this.creationPromise = (async () => {
      try {
        console.log('[PDF Offscreen] 문서 생성 시작...');

        await chrome.offscreen.createDocument({
          url: this.offscreenDocumentPath,
          reasons: ['DOM_SCRAPING'],
          justification: 'PDF 파일에서 텍스트를 추출하기 위해 PDF.js 라이브러리를 로드합니다.'
        });

        console.log('[PDF Offscreen] 문서 생성 완료 - Ready 대기 중...');

        await this.waitForOffscreenReady();

        return true;

      } catch (error) {
        console.error('[PDF Offscreen] 문서 생성/준비 실패:', error);
        throw error;
      } finally {
        this.isCreating = false;
        this.creationPromise = null;
      }
    })();

    return this.creationPromise;
  }

  async closeOffscreenDocument() {
    try {
      if (!chrome.offscreen) {
        return;
      }

      if (await this.hasOffscreenDocument()) {
        await chrome.offscreen.closeDocument();
        console.log('[PDF Offscreen] 문서 닫힘');
      }
    } catch (error) {
      console.error('[PDF Offscreen] 문서 닫기 오류:', error);
    }
  }
}

// ===== 토큰 자동 갱신 관리자 =====
class TokenRefreshManager {
  constructor(tokenMgr) {
    this.tokenManager = tokenMgr;
    this.isOnline = true;
    this.lastRefreshAttempt = 0;
    this.MIN_REFRESH_INTERVAL = 60000; // 1분 (중복 갱신 방지)
    this.REFRESH_BEFORE_EXPIRY = 10 * 60 * 1000; // 만료 10분 전에 갱신
  }

  async setupTokenRefreshAlarm() {
    try {
      await chrome.alarms.clear('token-refresh');

      // ✨ 3분마다 체크 (더 정확한 타이밍)
      chrome.alarms.create('token-refresh', {
        delayInMinutes: 1, // 1분 후 첫 체크
        periodInMinutes: 3 // 이후 3분마다 체크
      });

      console.log('[TokenRefresh] ✅ Alarm set: 첫 체크 1분 후, 이후 3분마다');

      // 디버깅: 현재 토큰 상태 확인
      try {
        const tokenInfo = await tokenManager.getTokenInfo();
        if (tokenInfo.isAuthenticated) {
          console.log('[TokenRefresh] 📊 현재 토큰 상태:', {
            만료까지: `${tokenInfo.timeUntilExpiryMinutes}분`,
            만료시각: tokenInfo.expiresAt
          });
        }
      } catch (e) {
        console.warn('[TokenRefresh] 토큰 정보 조회 실패:', e.message);
      }
    } catch (error) {
      console.error('[TokenRefresh] Setup alarm error:', error);
      errorHandler.handle(error, 'setup-token-refresh-alarm');
    }
  }

  async checkAndRefreshToken() {
    try {
      if (!tokenManager) {
        console.warn('[TokenRefresh] TokenManager not initialized yet');
        return;
      }

      const now = Date.now();

      // 중복 갱신 방지 (1분 이내 재시도 차단)
      if (now - this.lastRefreshAttempt < this.MIN_REFRESH_INTERVAL) {
        console.log('[TokenRefresh] ⏭️ Too soon to refresh again');
        return;
      }

      const refreshToken = await tokenManager.getRefreshToken();

      if (!refreshToken) {
        console.log('[TokenRefresh] ℹ️ No refresh token found (user not logged in)');
        return;
      }

      // ✨ 토큰 만료 시점 정확히 계산
      const accessToken = await tokenManager.getAccessToken();

      if (!accessToken) {
        console.log('[TokenRefresh] ℹ️ No access token found');
        return;
      }

      const timeUntilExpiry = tokenManager.getTimeUntilExpiry(accessToken);
      const expiryMinutes = Math.floor(timeUntilExpiry / 60000);

      console.log(`[TokenRefresh] 🕐 Token expires in ${expiryMinutes} minutes`);

      // ✨ 만료 10분 전부터 갱신 시도
      if (timeUntilExpiry <= this.REFRESH_BEFORE_EXPIRY) {
        console.log('[TokenRefresh] ⚠️ Token expiring soon, attempting refresh...');

        this.lastRefreshAttempt = now;

        try {
          await tokenManager.refreshAccessToken();
          console.log('[TokenRefresh] ✅ Token refreshed successfully');
          this.notifyTokenRefreshSuccess();

        } catch (refreshError) {
          console.error('[TokenRefresh] ❌ Refresh failed:', refreshError);
          this.notifyTokenRefreshFailure();
          errorHandler.handle(refreshError, 'auto-refresh-token');
        }
      } else {
        console.log('[TokenRefresh] ✅ Token is still valid');
      }
    } catch (error) {
      console.error('[TokenRefresh] ❌ Check and refresh error:', error);
      errorHandler.handle(error, 'check-and-refresh-token');
    }
  }

  notifyTokenRefreshSuccess() {
    console.log('[TokenRefresh] Token auto-refreshed successfully');
  }

  notifyTokenRefreshFailure() {
    // 백그라운드 알림 제거 - 사용자가 확장 프로그램을 열 때 자동으로 로그인 화면이 표시됨
    console.log('[TokenRefresh] Token refresh failed - user will see login screen when opening extension');
  }

  openLoginPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('auth.html')
    });
  }
}

// ===== Side Panel 상태 관리자 (v5.1.0 추가) =====
class SidePanelStateManager {
  constructor() {
    this.REOPEN_TIMEOUT = 5 * 60 * 1000; // 5분
  }

  /**
   * Side Panel 상태 저장
   */
  async savePanelState(tabId, hasSummary = true) {
    try {
      const state = {
        tabId: tabId,
        hasSummary: hasSummary,
        timestamp: Date.now(),
        lastAccessed: Date.now()
      };

      await chrome.storage.local.set({ [`sidePanelState_${tabId}`]: state });
      console.log(`[SidePanel] 상태 저장: 탭 ${tabId}`);
      
    } catch (error) {
      console.error('[SidePanel] 상태 저장 오류:', error);
      errorHandler.handle(error, 'save-panel-state');
    }
  }

  /**
   * Side Panel 상태 조회
   */
  async getPanelState(tabId) {
    try {
      const result = await chrome.storage.local.get(`sidePanelState_${tabId}`);
      return result[`sidePanelState_${tabId}`] || null;
      
    } catch (error) {
      console.error('[SidePanel] 상태 조회 오류:', error);
      return null;
    }
  }

  /**
   * Side Panel 상태 삭제
   */
  async clearPanelState(tabId) {
    try {
      await chrome.storage.local.remove(`sidePanelState_${tabId}`);
      console.log(`[SidePanel] 상태 삭제: 탭 ${tabId}`);
      
    } catch (error) {
      console.error('[SidePanel] 상태 삭제 오류:', error);
    }
  }

  /**
   * 배지 표시 여부 체크
   */
  shouldShowBadge(state) {
    if (!state || !state.hasSummary) {
      return false;
    }

    const elapsed = Date.now() - state.lastAccessed;
    return elapsed >= this.REOPEN_TIMEOUT;
  }
}

// ===== 전역 인스턴스 생성 =====
const siteManager = new SiteManager();
const contentScriptManager = new ContentScriptManager();
const extractionManager = new ExtractionManager();
const pdfOffscreenManager = new PDFOffscreenManager();
const tokenRefreshManager = new TokenRefreshManager(tokenManager);
const sidePanelStateManager = new SidePanelStateManager();

console.log('[Background] ✅ All managers initialized');

// =====================================================
// ✨ 4. Firebase Auth 자동 복구 (v5.0.0 추가)
// =====================================================

/**
 * Firebase 초기화 대기 헬퍼 함수
 */
async function waitForFirebase(timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      if (typeof firebase !== 'undefined' && 
          firebase.auth && 
          firebase.auth()) {
        console.log('[Background] ✅ Firebase 준비 완료');
        return true;
      }
    } catch (error) {
      // Firebase 아직 로드 안 됨
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.warn('[Background] ⚠️ Firebase 초기화 타임아웃');
  return false;
}

// ===== Service Worker 이벤트 핸들러 =====

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Gena Enhanced 설치:', details.reason);
  
  try {
    if (details.reason === 'install') {
      await chrome.storage.local.set({
        settings: {
          language: 'ko',
          includeImages: true,
          includeTables: true,
          includeCode: true,
          maxScrolls: 3,
          autoExtract: false,
          useProxy: true,
          proxyUrl: 'http://localhost:3000/api/chat'
        }
      });
      
      createContextMenus();
      
      await tokenRefreshManager.setupTokenRefreshAlarm();
    } else if (details.reason === 'update') {
      contentScriptManager.reset();
      
      await tokenRefreshManager.setupTokenRefreshAlarm();
    }
    
    await extractionManager.loadHistory();
  } catch (error) {
    console.error('설치/업데이트 처리 오류:', error);
    errorHandler.handle(error, 'on-installed');
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[Background] 🔵 Service Worker 재시작 - Firebase Auth 복구 시작');
  
  try {
    const firebaseReady = await waitForFirebase();
    
    if (!firebaseReady) {
      console.warn('[Background] ⚠️ Firebase 초기화 실패');
      return;
    }
    
    const currentUser = firebase.auth().currentUser;
    
    if (currentUser) {
      console.log('[Background] ✅ Firebase 로그인 상태 복구:', currentUser.email);
      
      try {
        const newIdToken = await currentUser.getIdToken(true);
        const refreshToken = currentUser.refreshToken;
        
        await tokenManager.saveTokens(newIdToken, refreshToken);
        
        console.log('[Background] ✅ 세션 복구 완료');
        
        const tokenInfo = await tokenManager.getTokenInfo();
        console.log('[Background] 토큰 만료:', tokenInfo.expiresAt);
        console.log('[Background] 남은 시간:', Math.floor(tokenInfo.timeUntilExpiry / 60000), '분');
        
      } catch (tokenError) {
        console.error('[Background] ⚠️ 토큰 갱신 실패:', tokenError.message);
      }
      
    } else {
      console.log('[Background] ℹ️ 로그인 상태 없음 (정상)');
      
      const result = await chrome.storage.local.get('tokens');
      if (result.tokens) {
        console.log('[Background] ⚠️ Chrome Storage에 토큰 있으나 Firebase 세션 없음');
        console.log('[Background] 토큰 정보:', {
          hasAccessToken: !!result.tokens.accessToken,
          hasRefreshToken: !!result.tokens.refreshToken,
          savedAt: new Date(result.tokens.savedAt).toISOString()
        });
      }
    }
    
  } catch (error) {
    console.error('[Background] ❌ 세션 복구 실패:', error);
    errorHandler.handle(error, 'firebase-auth-recovery');
  }
  
  try {
    await tokenRefreshManager.setupTokenRefreshAlarm();
    console.log('[Background] ✅ Token Refresh Alarm 재설정 완료');
  } catch (alarmError) {
    console.error('[Background] ⚠️ Alarm 설정 실패:', alarmError);
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'token-refresh') {
    console.log('[Alarm] Token refresh alarm triggered');
    await tokenRefreshManager.checkAndRefreshToken();
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log('[Background] 확장 프로그램 아이콘 클릭 - Overlay 열기');

    if (!tab || !tab.id) {
      console.warn('[Background] 유효한 탭이 없음');
      return;
    }

    // ✨ PDF 페이지 확인 및 스크립트 강제 주입 (제한된 페이지 확인보다 먼저!)
    const extractionManager = new ExtractionManager();
    if (extractionManager.isPDFUrl(tab.url)) {
      console.log('[Background] PDF 페이지 감지 - content script 강제 주입:', tab.url);

      try {
        // PDF 페이지에 content script 강제 주입
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['pdf-extractor.js', 'content.js', 'content-overlay.js']
        });

        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content-styles.css', 'content-overlay.css']
        });

        console.log('[Background] PDF 페이지 스크립트 주입 완료');

        // 스크립트 초기화 대기
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (injectError) {
        console.error('[Background] PDF 페이지 스크립트 주입 실패:', injectError);

        // file:// PDF 권한 안내
        if (tab.url.startsWith('file://')) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: chrome.i18n.getMessage('notificationPdfPermissionTitle'),
            message: chrome.i18n.getMessage('notificationPdfPermissionMessage'),
            priority: 2
          });
          return;
        }
      }
    }

    // ✨ 제한된 페이지 확인 (PDF 이후)
    if (siteManager.isRestricted(tab.url)) {
      console.warn('[Background] 제한된 페이지 - Popup으로 경고 표시:', tab.url);

      // Popup 열기 (제한된 페이지 경고 표시)
      try {
        // 현재 탭에만 popup 설정
        await chrome.action.setPopup({
          tabId: tab.id,
          popup: 'popup.html'
        });

        // Popup 열기
        await chrome.action.openPopup();

        // 잠시 후 popup 설정 제거 (다른 탭에 영향 주지 않도록)
        setTimeout(() => {
          chrome.action.setPopup({
            tabId: tab.id,
            popup: ''
          });
        }, 100);
      } catch (popupError) {
        console.error('[Background] Popup 열기 실패:', popupError);
      }

      return;
    }

    try {
      // Overlay 토글 메시지 전송
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'toggleOverlay'
      });

      console.log('[Background] Overlay 토글 응답:', response);
      console.log('[Background] Overlay 토글 완료 ✅');
    } catch (error) {
      console.error('[Background] Overlay 토글 실패:', error);

      // Content script가 주입되지 않았을 수 있으므로 주입 시도
      try {
        console.log('[Background] Content script 주입 시도...');
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['pdf-extractor.js', 'content.js', 'content-overlay.js']
        });

        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content-styles.css', 'content-overlay.css']
        });

        // 주입 후 초기화 대기 (200ms - PDF 파일을 위해 증가)
        await new Promise(resolve => setTimeout(resolve, 200));

        // 주입 후 다시 시도
        await chrome.tabs.sendMessage(tab.id, {
          action: 'toggleOverlay'
        });

        console.log('[Background] Content script 주입 및 Overlay 열기 완료 ✅');
      } catch (injectError) {
        console.error('[Background] Content script 주입 실패:', injectError);

        // PDF 파일의 경우 file:// 권한 안내
        if (tab.url && tab.url.startsWith('file://')) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: chrome.i18n.getMessage('notificationPdfPermissionTitle'),
            message: chrome.i18n.getMessage('notificationPdfPermissionMessage2'),
            priority: 2
          });
        }

        errorHandler.handle(injectError, 'inject-content-script');
      }
    }

  } catch (error) {
    console.error('[Background] 액션 클릭 처리 오류:', error);
    errorHandler.handle(error, 'action-click');
  }
});

// ===== 키보드 단축키 핸들러 =====
chrome.commands.onCommand.addListener(async (command) => {
  try {
    console.log('[Background] 커맨드 수신:', command);

    if (command === 'toggle-overlay') {
      // 현재 활성 탭에서 오버레이 토글
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      if (!activeTab) {
        console.warn('[Background] 활성 탭을 찾을 수 없음');
        return;
      }

      try {
        await chrome.tabs.sendMessage(activeTab.id, {
          action: 'toggleOverlay'
        });
        console.log('[Background] 오버레이 토글 메시지 전송 완료');
      } catch (error) {
        console.error('[Background] 오버레이 토글 실패:', error);
        errorHandler.handle(error, 'toggle-overlay-command');
      }
    }
  } catch (error) {
    console.error('[Background] 커맨드 처리 오류:', error);
    errorHandler.handle(error, 'command-handler');
  }
});

function createContextMenus() {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'extract-content',
        title: '페이지 콘텐츠 추출',
        contexts: ['page']
      });
      
      chrome.contextMenus.create({
        id: 'extract-selection',
        title: '선택 영역 추출',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'separator-1',
        type: 'separator',
        contexts: ['page', 'selection']
      });

      chrome.contextMenus.create({
        id: 'extract-with-images',
        title: '이미지 포함 추출',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'extract-simplified',
        title: '간단 추출 (텍스트만)',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'separator-2',
        type: 'separator',
        contexts: ['page']
      });
      
      chrome.contextMenus.create({
        id: 'open-side-panel',
        title: 'Gena Side Panel 열기',
        contexts: ['page']
      });
    });
  } catch (error) {
    console.error('컨텍스트 메뉴 생성 오류:', error);
    errorHandler.handle(error, 'create-context-menus');
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;
  
  try {
    if (info.menuItemId === 'open-side-panel') {
      if (chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } else {
        console.warn('[Background] Side Panel API 사용 불가');
        chrome.tabs.create({
          url: chrome.runtime.getURL('sidepanel.html')
        });
      }
      return;
    }
    
    let options = {};
    
    switch (info.menuItemId) {
      case 'extract-content':
        options = { includeImages: true, includeTables: true };
        break;
        
      case 'extract-selection':
        const selectionText = info.selectionText ? 
          info.selectionText.substring(0, 5000) : '';
        options = { selection: selectionText };
        break;
        
      case 'extract-with-images':
        options = { includeImages: true, enrichImages: true };
        break;
        
      case 'extract-simplified':
        options = { includeImages: false, includeTables: false, includeCode: false };
        break;
    }
    
    const result = await extractionManager.startExtraction(tab.id, options);
    
    chrome.runtime.sendMessage({
      action: 'extractionComplete',
      data: result
    });
    
  } catch (error) {
    console.error('추출 오류:', error.message);
    errorHandler.handle(error, 'context-menu-click');
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: chrome.i18n.getMessage('notificationContentExtractionFailed'),
      message: chrome.i18n.getMessage('notificationContentExtractionFailedMessage')
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] 메시지 수신:', request.action);
  
  try {
    switch (request.action) {
      case 'ping':
        console.log('[Background] 🔵 Ping 받음 - Service Worker 활성 상태 유지');
        
        let authStatus = 'unknown';
        let userEmail = null;
        
        try {
          if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth()) {
            const currentUser = firebase.auth().currentUser;
            if (currentUser) {
              authStatus = 'authenticated';
              userEmail = currentUser.email;
            } else {
              authStatus = 'not_authenticated';
            }
          } else {
            authStatus = 'firebase_not_loaded';
          }
        } catch (error) {
          authStatus = 'error';
          console.error('[Background] Firebase Auth 상태 확인 오류:', error);
        }
        
        sendResponse({ 
          success: true, 
          message: 'pong', 
          timestamp: Date.now(),
          authStatus: authStatus,
          userEmail: userEmail
        });
        break;
        
      case 'extractContent':
        handleExtractContent(request, sender, sendResponse);
        return true;
        
      case 'checkContentScript':
        handleCheckContentScript(request, sender, sendResponse);
        return true;
        
      case 'getExtractionHistory':
        sendResponse({
          success: true,
          history: extractionManager.extractionHistory
        });
        break;
        
      case 'getSiteInfo':
        handleGetSiteInfo(request, sender, sendResponse);
        break;
        
      case 'injectContentScript':
        handleInjectContentScript(request, sender, sendResponse);
        return true;

      case 'openLoginPage':
        tokenRefreshManager.openLoginPage();
        sendResponse({ success: true });
        break;

      case 'loginUser':
        handleLoginUser(request, sender, sendResponse);
        return true;

      case 'checkTokenStatus':
        handleCheckTokenStatus(request, sender, sendResponse);
        return true;

      case 'refreshToken':
        handleRefreshToken(request, sender, sendResponse);
        return true;

      case 'logout':
        handleLogout(request, sender, sendResponse);
        return true;

      case 'requestPasswordReset':
        handleRequestPasswordReset(request, sender, sendResponse);
        return true;

      case 'openSidePanel':
        handleOpenSidePanel(request, sender, sendResponse);
        return true;

      case 'openOptionsPage':
        chrome.runtime.openOptionsPage();
        sendResponse({ success: true });
        return true;

      case 'generateWebLoginToken':
        handleGenerateWebLoginToken(request, sender, sendResponse);
        return true;

      case 'extractPDF':
        handleExtractPDF(request, sender, sendResponse);
        return true;
      
      case 'saveSidePanelState':
        handleSaveSidePanelState(request, sender, sendResponse);
        return true;
      
      case 'getSidePanelState':
        handleGetSidePanelState(request, sender, sendResponse);
        return true;
      
      case 'clearSidePanelState':
        handleClearSidePanelState(request, sender, sendResponse);
        return true;

      case 'toggleOverlay':
        handleToggleOverlay(request, sender, sendResponse);
        return true;

      case 'summarizeContent':
        // ✨ async 함수는 즉시 실행하고 에러 처리
        handleSummarizeContent(request, sender, sendResponse).catch(error => {
          console.error('[Background] summarizeContent 핸들러 에러:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true;  // 비동기 응답 대기

      case 'askQuestion':
        handleAskQuestion(request, sender, sendResponse);
        return true;

      case 'resendVerificationEmail':
        handleResendVerificationEmail(request, sender, sendResponse).catch(error => {
          console.error('[Background] resendVerificationEmail 핸들러 에러:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true;

      case 'refreshEmailVerificationStatus':
        handleRefreshEmailVerificationStatus(request, sender, sendResponse).catch(error => {
          console.error('[Background] refreshEmailVerificationStatus 핸들러 에러:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true;
    }
  } catch (error) {
    console.error('[Background] 메시지 핸들러 오류:', error);
    errorHandler.handle(error, 'message-handler');
    sendResponse({ success: false, error: error.message });
  }

  return false;
});

async function handleExtractContent(request, sender, sendResponse) {
  try {
    const tabId = request.tabId || sender.tab?.id;
    
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      });
      
      if (!activeTab) {
        throw new Error('활성 탭을 찾을 수 없습니다');
      }
      
      const result = await extractionManager.startExtraction(
        activeTab.id, 
        request.options
      );
      sendResponse({ success: true, ...result });
    } else {
      const result = await extractionManager.startExtraction(
        tabId, 
        request.options
      );
      sendResponse({ success: true, ...result });
    }
  } catch (error) {
    errorHandler.handle(error, 'handle-extract-content');
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

async function handleCheckContentScript(request, sender, sendResponse) {
  try {
    const tabId = request.tabId || sender.tab?.id;
    const isInjected = await contentScriptManager.check(tabId);
    
    sendResponse({ 
      success: true, 
      injected: isInjected 
    });
  } catch (error) {
    errorHandler.handle(error, 'check-content-script');
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

function handleGetSiteInfo(request, sender, sendResponse) {
  try {
    const url = request.url || sender.tab?.url;
    const siteInfo = siteManager.getSiteInfo(url);
    const isRestricted = siteManager.isRestricted(url);
    
    sendResponse({
      success: true,
      siteInfo,
      isRestricted
    });
  } catch (error) {
    errorHandler.handle(error, 'get-site-info');
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

async function handleInjectContentScript(request, sender, sendResponse) {
  try {
    const tabId = request.tabId || sender.tab?.id;
    await contentScriptManager.inject(tabId);
    
    sendResponse({ success: true });
  } catch (error) {
    errorHandler.handle(error, 'inject-content-script-handler');
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

async function handleCheckTokenStatus(request, sender, sendResponse) {
  try {
    const tokenInfo = await tokenManager.getTokenInfo();
    sendResponse({ 
      success: true, 
      tokenInfo 
    });
  } catch (error) {
    errorHandler.handle(error, 'check-token-status');
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

async function handleRefreshToken(request, sender, sendResponse) {
  try {
    const newToken = await tokenManager.refreshAccessToken();
    sendResponse({ 
      success: true, 
      accessToken: newToken 
    });
  } catch (error) {
    errorHandler.handle(error, 'handle-refresh-token');
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * 사용자 사용량 정보 가져오기 및 저장
 * ✅ usage-manager.js 패턴과 동일하게 /api/usage 엔드포인트 사용
 */
async function fetchAndSaveUserUsage(idToken) {
  try {
    const API_BASE_URL = CONFIG.getApiUrl();
    const endpoint = `${API_BASE_URL}/api/usage`;

    console.log('[Background] 🔍 사용량 조회 중...');
    console.log('[Background] 📍 API URL:', endpoint);
    console.log('[Background] 🔑 Token 길이:', idToken?.length || 0);

    // ✅ 올바른 엔드포인트: /api/usage (usage-manager.js와 동일)
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Background] 📡 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '응답 없음');
      console.error('[Background] ❌ API 에러 응답:', errorText);
      throw new Error(`사용량 조회 실패: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('[Background] 📦 API 응답 원본:', JSON.stringify(result, null, 2));

    // ✅ 백엔드 응답 형식 검증
    if (!result.success || !result.usage) {
      console.error('[Background] ❌ 응답 형식 오류:', {
        hasSuccess: !!result.success,
        hasUsage: !!result.usage
      });
      throw new Error('유효하지 않은 응답 형식입니다');
    }

    // ✅ 백엔드 형식을 프론트엔드 형식으로 변환 (usage-manager.js와 동일)
    const usageData = {
      isPremium: result.isPremium || false,
      dailyUsed: result.usage.used || 0,
      dailyLimit: result.usage.limit === 'unlimited' ? Infinity : (result.usage.limit || 3),
      questionUsed: result.usage.questionUsed || 0,
      questionLimit: result.usage.questionLimit === 'unlimited' ? Infinity : (result.usage.questionLimit || 3),
      resetAt: result.usage.resetAt
    };

    console.log('[Background] 💾 저장할 데이터:', JSON.stringify(usageData, null, 2));

    await chrome.storage.local.set({ usageData });
    console.log('[Background] ✅ 사용량 데이터 저장 완료!');

  } catch (error) {
    console.error('[Background] ❌ 사용량 정보 조회 실패:', error.message);
    console.error('[Background] 전체 에러:', error);

    // ✅ 실패 시 기본값 저장 (usage-manager.js와 동일)
    const defaultUsageData = {
      isPremium: false,
      dailyUsed: 0,
      dailyLimit: 3,
      questionUsed: 0,
      questionLimit: 3
    };
    await chrome.storage.local.set({ usageData: defaultUsageData });
    console.log('[Background] ⚠️ 기본 사용량 데이터 저장:', defaultUsageData);
  }
}

/**
 * 사용자 언어 설정 조회 및 저장
 */
async function fetchAndSaveUserLanguage(idToken) {
  try {
    const API_BASE_URL = CONFIG.getApiUrl();
    const endpoint = `${API_BASE_URL}/api/auth/language`;

    console.log('[Background] 🔍 언어 설정 조회 중...');

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Background] 📡 언어 설정 응답 상태:', response.status);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '응답 없음');
      console.error('[Background] ❌ 언어 설정 조회 API 에러:', errorText);
      throw new Error(`언어 설정 조회 실패: ${response.status}`);
    }

    const result = await response.json();
    console.log('[Background] 📦 언어 설정 응답:', result);

    if (!result.success) {
      throw new Error('유효하지 않은 응답 형식입니다');
    }

    // 언어 설정 저장
    const settings = await chrome.storage.local.get(['settings']);
    const currentSettings = settings.settings || {};

    if (result.language) {
      // 사용자가 언어를 명시적으로 설정한 경우
      currentSettings.language = result.language;
      console.log('[Background] ✅ 사용자 언어 설정 적용:', result.language);
    } else {
      // 사용자가 언어를 설정하지 않은 경우 (브라우저 언어 사용)
      delete currentSettings.language;
      console.log('[Background] ✅ 브라우저 언어 사용 (사용자 설정 없음)');
    }

    await chrome.storage.local.set({ settings: currentSettings });
    console.log('[Background] ✅ 언어 설정 저장 완료');

  } catch (error) {
    console.error('[Background] ❌ 언어 설정 조회 실패:', error.message);
    // 언어 설정 실패 시 기존 설정 유지 (아무것도 하지 않음)
  }
}

/**
 * 로그인 처리 핸들러 (Firebase REST API 사용)
 */
async function handleLoginUser(request, sender, sendResponse) {
  try {
    const { email, password, rememberMe } = request;

    console.log('[Background] 로그인 시도:', email);

    if (!email || !password) {
      throw new Error('이메일과 비밀번호를 입력해주세요.');
    }

    // Firebase Auth REST API로 로그인
    const firebaseConfig = CONFIG.getFirebaseConfig();
    const API_KEY = firebaseConfig.apiKey;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password: password,
        returnSecureToken: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Firebase 에러 처리
      const errorMessage = getFirebaseAuthErrorMessage(data.error?.message || 'UNKNOWN_ERROR');
      throw new Error(errorMessage);
    }

    console.log('[Background] Firebase 로그인 성공:', data.email);
    console.log('[Background] 로그인 상태 유지:', rememberMe ? 'ON (영구)' : 'OFF (세션만)');

    // ID Token과 Refresh Token 저장 (rememberMe에 따라 storage 선택)
    await tokenManager.saveTokens(data.idToken, data.refreshToken, rememberMe);

    console.log('[Background] 토큰 저장 완료');

    // ✨ 이메일 인증 상태 확인 및 Firestore 동기화
    try {
      const decoded = tokenManager.decodeToken(data.idToken);
      if (decoded && decoded.email_verified === true) {
        console.log('[Background] 🔐 이메일 인증 완료 감지 - Firestore 동기화 시도');

        // Firestore 업데이트를 위해 백엔드 API 호출
        const backendUrl = CONFIG.getApiUrl();
        const syncResponse = await fetch(`${backendUrl}/api/auth/verify-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.idToken}`
          }
        });

        if (syncResponse.ok) {
          console.log('[Background] ✅ Firestore emailVerified 동기화 완료');
        } else {
          console.warn('[Background] ⚠️ Firestore 동기화 실패 (무시)');
        }
      }
    } catch (syncError) {
      console.warn('[Background] ⚠️ 이메일 인증 상태 동기화 실패 (무시):', syncError.message);
      // 로그인은 성공했으므로 계속 진행
    }

    // Token Refresh Alarm 재설정
    await tokenRefreshManager.setupTokenRefreshAlarm();

    // 사용자 정보 가져오기 (프리미엄 여부, 사용량)
    try {
      await fetchAndSaveUserUsage(data.idToken);
    } catch (usageError) {
      console.warn('[Background] 사용량 정보 가져오기 실패:', usageError);
      // 로그인은 성공했으므로 계속 진행
    }

    // 사용자 언어 설정 가져오기
    try {
      await fetchAndSaveUserLanguage(data.idToken);
    } catch (languageError) {
      console.warn('[Background] 언어 설정 가져오기 실패:', languageError);
      // 로그인은 성공했으므로 계속 진행
    }

    sendResponse({
      success: true,
      message: chrome.i18n.getMessage('loginSuccess'),
      user: {
        email: data.email,
        localId: data.localId
      }
    });

  } catch (error) {
    console.error('[Background] 로그인 실패:', error);
    errorHandler.handle(error, 'handle-login-user');
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Firebase Auth 에러 메시지 로컬라이징
 */
function getFirebaseAuthErrorMessage(errorCode) {
  const errorKeys = {
    'EMAIL_NOT_FOUND': 'errorEmailNotFound',
    'INVALID_PASSWORD': 'errorInvalidPassword',
    'USER_DISABLED': 'errorUserDisabled',
    'TOO_MANY_ATTEMPTS_TRY_LATER': 'errorTooManyAttempts',
    'INVALID_LOGIN_CREDENTIALS': 'errorInvalidCredentials',
    'INVALID_EMAIL': 'errorInvalidEmail',
    'UNKNOWN_ERROR': 'errorUnknown'
  };

  const messageKey = errorKeys[errorCode] || 'errorUnknown';
  return chrome.i18n.getMessage(messageKey);
}

async function handleLogout(request, sender, sendResponse) {
  try {
    console.log('[Background] 로그아웃 처리 시작');

    await tokenManager.clearTokens();

    await chrome.alarms.clear('token-refresh');

    console.log('[Background] 로그아웃 완료');

    sendResponse({
      success: true,
      message: chrome.i18n.getMessage('logoutSuccess')
    });
  } catch (error) {
    console.error('[Background] 로그아웃 오류:', error);
    errorHandler.handle(error, 'handle-logout');
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 비밀번호 재설정 이메일 발송 처리
 */
async function handleRequestPasswordReset(request, sender, sendResponse) {
  try {
    const { email } = request;

    console.log('[Background] 비밀번호 재설정 요청:', email);

    if (!email) {
      throw new Error('이메일을 입력해주세요.');
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('올바른 이메일 형식이 아닙니다.');
    }

    // Firebase Auth REST API로 비밀번호 재설정 이메일 발송
    const firebaseConfig = CONFIG.getFirebaseConfig();
    const API_KEY = firebaseConfig.apiKey;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email: email.trim().toLowerCase()
      })
    });

    const data = await response.json();

    if (!response.ok) {
      // Firebase 에러 처리
      const errorMessage = getFirebaseAuthErrorMessage(data.error?.message || 'UNKNOWN_ERROR');
      throw new Error(errorMessage);
    }

    console.log('[Background] 비밀번호 재설정 이메일 발송 성공:', email);

    sendResponse({
      success: true,
      message: chrome.i18n.getMessage('passwordResetEmailSent')
    });
  } catch (error) {
    console.error('[Background] 비밀번호 재설정 요청 오류:', error);
    errorHandler.handle(error, 'handle-password-reset');
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

async function handleOpenSidePanel(request, sender, sendResponse) {
  try {
    const tabId = request.tabId || sender.tab?.id;
    
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ 
        active: true, 
        currentWindow: true 
      });
      
      if (!activeTab) {
        throw new Error('활성 탭을 찾을 수 없습니다');
      }
      
      if (chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: activeTab.windowId });
      } else {
        chrome.tabs.create({
          url: chrome.runtime.getURL('sidepanel.html')
        });
      }
    } else {
      const tab = await chrome.tabs.get(tabId);
      if (chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } else {
        chrome.tabs.create({
          url: chrome.runtime.getURL('sidepanel.html')
        });
      }
    }
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('[Background] Side Panel 열기 오류:', error);
    errorHandler.handle(error, 'open-side-panel-handler');
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

async function handleExtractPDF(request, sender, sendResponse) {
  console.log('[Background] PDF 추출 요청 받음:', request.url);
  
  sendResponse({
    success: true,
    status: 'processing',
    message: chrome.i18n.getMessage('pdfExtractingText')
  });
  
  processPDFExtraction(request, sender).catch(error => {
    console.error('[Background] PDF 처리 중 오류:', error);
  });
}

async function processPDFExtraction(request, sender) {
  try {
    console.log('[Background] PDF 처리 시작:', request.url);

    if (!request.url) {
      sendProgressUpdate(sender, {
        stage: 'error',
        progress: 0,
        message: 'PDF URL이 제공되지 않았습니다.'
      });
      return;
    }

    sendProgressUpdate(sender, {
      stage: 'download',
      progress: 10,
      message: chrome.i18n.getMessage('pdfDownloading')
    });

    console.log('[Background]', chrome.i18n.getMessage('pdfDownloading'));
    
    let pdfData;
    try {
      const response = await fetch(request.url);
      
      if (!response.ok) {
        throw new Error(`${chrome.i18n.getMessage('pdfExtractionFailed')}: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      pdfData = Array.from(new Uint8Array(arrayBuffer));

      console.log(`[Background] ${chrome.i18n.getMessage('pdfExtractionComplete')}: ${pdfData.length} bytes`);

      sendProgressUpdate(sender, {
        stage: 'download',
        progress: 30,
        message: chrome.i18n.getMessage('pdfExtractionComplete')
      });
      
    } catch (fetchError) {
      console.error('[Background]', chrome.i18n.getMessage('pdfExtractionFailed'), fetchError);

      sendProgressUpdate(sender, {
        stage: 'error',
        progress: 0,
        message: chrome.i18n.getMessage('pdfExtractionFailed')
      });
      
      throw new Error(`PDF 파일을 가져올 수 없습니다: ${fetchError.message}`);
    }

    sendProgressUpdate(sender, {
      stage: 'offscreen',
      progress: 40,
      message: chrome.i18n.getMessage('pdfPreparingTools')
    });

    await pdfOffscreenManager.createOffscreenDocument();

    sendProgressUpdate(sender, {
      stage: 'extract',
      progress: 50,
      message: chrome.i18n.getMessage('pdfExtractingText')
    });

    console.log('[Background] Offscreen에 데이터 전송 중...');

    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('PDF 추출 시간 초과 (180초)'));
      }, 180000);

      chrome.runtime.sendMessage(
        {
          action: 'extractPDFFromOffscreen',
          pdfData: pdfData,
          url: request.url
        },
        (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            reject(new Error(`메시지 전송 실패: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          if (!response) {
            reject(new Error('Offscreen Document로부터 응답이 없습니다.'));
            return;
          }
          
          resolve(response);
        }
      );
    });

    sendProgressUpdate(sender, {
      stage: 'complete',
      progress: 100,
      message: chrome.i18n.getMessage('pdfExtractionComplete')
    });

    console.log('[Background] PDF 추출 성공');

    console.log('[Background] 최종 결과 전송 중...');
    chrome.runtime.sendMessage({
      action: 'pdfExtractionComplete',
      result: result
    }).then(() => {
      console.log('[Background] ✅ 최종 결과 전송 완료');
    }).catch(err => {
      console.warn('[Background] ⚠️ 최종 결과 전송 실패:', err.message);
    });

  } catch (error) {
    console.error('[Background] PDF 추출 실패:', error);
    errorHandler.handle(error, 'extract-pdf');

    sendProgressUpdate(sender, {
      stage: 'error',
      progress: 0,
      message: error.message
    });
    
    console.log('[Background] 에러 결과 전송 중...');
    chrome.runtime.sendMessage({
      action: 'pdfExtractionComplete',
      result: {
        success: false,
        error: error.message
      }
    }).catch(err => {
      console.warn('[Background] ⚠️ 에러 전송 실패:', err.message);
    });
  }
}

function sendProgressUpdate(sender, data) {
  try {
    if (sender && sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'pdfProgress',
        data: data
      }).catch(err => {
        console.warn('[Background] 진행 상황 전송 실패:', err.message);
      });
    }
  } catch (error) {
    console.warn('[Background] 진행 상황 전송 오류:', error.message);
  }
}

/**
 * ✨ v5.1.0: Side Panel 상태 저장 핸들러
 */
async function handleSaveSidePanelState(request, sender, sendResponse) {
  try {
    const tabId = request.tabId || sender.tab?.id;
    const hasSummary = request.hasSummary;

    if (!tabId) {
      return sendResponse({ success: false, error: 'tabId 없음' });
    }

    console.log('[Background] Side Panel 상태 저장:', { tabId, hasSummary });

    await sidePanelStateManager.savePanelState(tabId, hasSummary);

    // ✨ 요약 완료 시 해당 탭에서 Side Panel 활성화
    if (hasSummary) {
      await chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidepanel.html',
        enabled: true
      });
      console.log('[Background] ✅ 탭 Side Panel 활성화:', tabId);
    }

    sendResponse({ 
      success: true,
      state: await sidePanelStateManager.getPanelState(tabId)
    });

  } catch (error) {
    console.error('[Background] Side Panel 상태 저장 오류:', error);
    errorHandler.handle(error, 'save-sidepanel-state');
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetSidePanelState(request, sender, sendResponse) {
  try {
    const tabId = request.tabId || sender.tab?.id;
    
    if (!tabId) {
      throw new Error('Tab ID가 없습니다');
    }
    
    const state = await sidePanelStateManager.getPanelState(tabId);
    
    sendResponse({ 
      success: true, 
      state: state 
    });
    
  } catch (error) {
    console.error('[Background] Side Panel 상태 조회 오류:', error);
    errorHandler.handle(error, 'get-sidepanel-state');
    sendResponse({ success: false, error: error.message });
  }
}

async function handleClearSidePanelState(request, sender, sendResponse) {
  try {
    const tabId = request.tabId || sender.tab?.id;

    if (!tabId) {
      throw new Error('Tab ID가 없습니다');
    }

    await sidePanelStateManager.clearPanelState(tabId);

    sendResponse({ success: true });

  } catch (error) {
    console.error('[Background] Side Panel 상태 삭제 오류:', error);
    errorHandler.handle(error, 'clear-sidepanel-state');
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * ✨ 콘텐츠 요약 핸들러
 */
async function handleSummarizeContent(request, sender, sendResponse) {
  try {
    const { content, length = 'medium', pageInfo, textItems = null } = request;

    if (!content || content.length < 10) {
      throw new Error('콘텐츠가 너무 짧습니다 (최소 10자)');
    }

    console.log('[Background] 요약 요청:', {
      length,
      contentLength: content.length,
      isPDF: pageInfo?.isPDF
    });

    // 1. 토큰 가져오기
    const accessToken = await tokenManager.getAccessToken();

    if (!accessToken) {
      throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
    }

    // 2. 요약 길이에 따른 max_tokens 설정 (구조화된 형식을 위해 증가)
    const maxTokensMap = {
      'short': 800,
      'medium': 1500,
      'detailed': 4000,  // ✨ 학술적 분석을 위해 증가 (3000 → 4000)
      'very_detailed': 3500,
      'ultra_detailed': 5000
    };
    const maxTokens = maxTokensMap[length] || 1500;

    // 3. Messages 배열 생성 (구조화된 요약 프롬프트)
    // ✨ PDF 또는 detailed 모드 감지
    const isPDF = pageInfo?.isPDF || false;
    const isAcademicMode = isPDF || length === 'detailed';

    // 콘텐츠를 문단으로 분리하여 번호 부여
    // ✨ 스마트 문단 분리: PDF와 웹 콘텐츠 모두 지원
    let paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20);

    // PDF 콘텐츠는 보통 줄바꿈이 적어서 문단이 너무 적음 → 문장 기반 분리 사용
    if (paragraphs.length < 5) {
      console.log('[Background] 📊 문단이 너무 적음 (' + paragraphs.length + '개) - 문장 기반 분리 시도');

      // 문장으로 분리 (마침표, 물음표, 느낌표 뒤)
      const sentences = content
        .split(/([.?!。])\s*/)
        .reduce((acc, part, i, arr) => {
          if (i % 2 === 0) {
            const sentence = part + (arr[i + 1] || '');
            if (sentence.trim().length > 20) {
              acc.push(sentence.trim());
            }
          }
          return acc;
        }, []);

      // 문장을 2-3개씩 묶어서 문단으로 만들기 (더 세밀한 출처 추적)
      paragraphs = [];
      const sentencesPerParagraph = 2;
      for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
        const chunk = sentences.slice(i, i + sentencesPerParagraph).join(' ').trim();
        if (chunk.length > 30) {
          paragraphs.push(chunk);
        }
      }

      console.log('[Background] 📊 문장 기반 분리 완료:', paragraphs.length, '개 문단 생성');
      console.log('[Background] 📊 전체 문장 수:', sentences.length);
    }

    const numberedContent = paragraphs.map((p, i) => `[${i + 1}] ${p.substring(0, 300)}...`).join('\n\n');

    // ✨ PDF 위치 정보가 있으면 문단별 페이지 번호 매칭
    let paragraphsWithPosition = paragraphs.map((p, i) => ({ text: p, index: i }));

    console.log('[Background] 🔍 textItems 확인:', {
      hasTextItems: !!textItems,
      isArray: Array.isArray(textItems),
      length: textItems?.length || 0,
      sample: textItems?.[0]
    });

    if (textItems && textItems.length > 0) {
      console.log('[Background] 📍 PDF 위치 정보로 문단 페이지 매칭 시작...');
      console.log('[Background] 📍 textItems 총 개수:', textItems.length);

      paragraphsWithPosition = paragraphs.map((paragraph, index) => {
        // 문단의 첫 5-10자로 매칭 시도 (단어 기반은 PDF에서 잘 안됨)
        const searchText = paragraph
          .trim()
          .substring(0, 50)
          .toLowerCase()
          .replace(/\s+/g, '');

        // textItems를 페이지별로 그룹화하고 텍스트 결합
        const pageTexts = {};
        textItems.forEach(item => {
          if (!pageTexts[item.page]) {
            pageTexts[item.page] = { text: '', items: [], page: item.page };
          }
          pageTexts[item.page].text += item.text;
          pageTexts[item.page].items.push(item);
        });

        // 각 페이지에서 검색
        let matchedPage = 1;
        let matchedItems = [];
        let found = false;

        for (const pageNum in pageTexts) {
          const pageData = pageTexts[pageNum];
          const pageText = pageData.text.toLowerCase().replace(/\s+/g, '');

          if (pageText.includes(searchText)) {
            matchedPage = parseInt(pageNum);
            matchedItems = pageData.items.slice(0, 5); // 처음 5개 아이템
            found = true;
            break;
          }
        }

        if (index < 3) {
          console.log(`[Background] 📍 문단 ${index + 1} 매칭:`, {
            found,
            page: matchedPage,
            searchText: searchText.substring(0, 20) + '...',
            hasItems: matchedItems.length > 0
          });
        }

        return {
          text: paragraph,
          index: index,
          page: matchedPage,
          positions: matchedItems.length > 0 ? matchedItems : null
        };
      });

      console.log('[Background] 📍 문단 페이지 매칭 완료');
      console.log('[Background] 📍 샘플:', paragraphsWithPosition.slice(0, 3).map(p => ({
        index: p.index + 1,
        page: p.page,
        preview: p.text.substring(0, 30) + '...'
      })));
    }

    console.log('[Background] 📊 문단 분석:');
    console.log('  - 전체 문단 수:', paragraphs.length);
    console.log('  - 첫 3개 문단 번호 샘플:',
      paragraphs.slice(0, 3).map((p, i) => `[${i + 1}] ${p.substring(0, 50)}...`)
    );

    // ✨ 학술적/전문적 프롬프트 (PDF 또는 자세한 요약용)
    const academicPrompt = `당신은 전문 데이터 분석가이자 학술 연구원입니다. 제공된 문서를 깊이 있게 분석하여, 구어체나 과도하게 단순화된 설명은 배제하고 핵심 정보와 전문적 통찰만을 체계적으로 요약해주세요.

**[분석 지침]**
- **톤앤매너**: 격식 있고 전문적인 학술적 문체 유지
- **핵심 중심**: 논문의 초록(Abstract), 핵심 주장, 데이터 결과, 결론 중심으로 정리
- **전문성**: 원문의 전문 용어와 프레임워크 명칭을 그대로 사용하여 정확성 유지
- **구조화**: 아래 템플릿의 구조를 엄격히 준수

**[출력 템플릿]**

### 1. 개요 및 목적 (Overview & Purpose)
- 문서의 핵심 주제와 연구/작성 목적 (1~2문장)
- 주요 문제 제기 또는 가설 (핵심 질문)

### 2. 핵심 개념 및 프레임워크 (Key Concepts & Frameworks)
• **주요 용어 1**: 정의 및 맥락
• **주요 용어 2**: 정의 및 맥락
• **이론적 배경**: 인용된 모델, 선행 연구, 분석 프레임워크
(필요시 3개, 4개 이상 추가 가능)

### 3. 주요 분석 내용 및 핵심 발견 (Core Analysis & Findings)
**3-1. 연구 방법론 / 접근 방식**
- 연구 설계, 데이터 수집 방법, 분석 기법

**3-2. 핵심 결과 / 발견사항**
• 발견 1: 구체적 데이터 또는 논거
• 발견 2: 구체적 데이터 또는 논거
• 발견 3: 구체적 데이터 또는 논거
(필요시 더 많은 발견사항 추가)

**3-3. 비교 분석 (해당 시)**
- 대조되는 관점, 모델, 또는 데이터 비교

### 4. 결론 및 실무적 시사점 (Conclusion & Implications)
- **최종 결론**: 연구의 핵심 주장 또는 종합적 판단
- **이론적 기여**: 학문적 의의 또는 기존 연구와의 차별점
- **실무적 적용**: 해당 분야나 산업에 주는 구체적 가치 및 활용 방안
- **향후 연구 제언**: 한계점 및 추가 연구 필요 영역

### 5. 핵심 키워드 (Key Terminology)
문서를 관통하는 핵심 단어 5~8개 나열

---
**중요 원칙:**
- 각 섹션마다 충분한 내용 작성 (최소 2~3문장 이상)
- 단순 나열이 아닌 논리적 연결성 있는 서술
- 원문의 깊이와 전문성을 반영한 분석적 요약`;

    // 기본 프롬프트 (일반 웹페이지용)
    const casualPrompt = `당신은 전문 요약 도우미입니다. 주어진 텍스트를 분석하여 다음 형식 중 하나로 요약해주세요.

중요:
- 형식 제목(예: "[형식 1] 기본 범용")은 절대 출력하지 마세요
- 마크다운 굵은 글씨(**텍스트**)는 사용하지 마세요
- 이모지 헤더와 일반 텍스트만 사용하세요
- 각 핵심 포인트/장점/단점/단계의 끝에 해당 정보의 출처 문단 번호를 [1], [2] 형식으로 반드시 표기하세요
- 핵심 포인트는 최소 3개 이상이며, 내용에 따라 4개, 5개, 그 이상도 작성 가능합니다

[형식 1] 기본 범용 (뉴스, 블로그, 일반 정보)
📝 한 줄 요약
핵심을 1문장으로

🔑 핵심 포인트
• 주제 1: 설명 (1~2문장) [1]
• 주제 2: 설명 (1~2문장) [3]
• 주제 3: 설명 (1~2문장) [5]
(필요시 4개, 5개 이상도 가능)

💡 인사이트 & 결론
최종 결론이나 의미

[형식 2] 정보성/기술 (튜토리얼, 가이드)
🎯 목표 및 대상
목표: 해결하려는 문제
대상: 대상 독자

🛠️ 핵심 단계
1. 단계 설명 [2]
2. 단계 설명 [4]
3. 단계 설명 [6]
(필요시 4개, 5개 이상도 가능)

⚠️ 주의사항 및 팁
놓치지 말아야 할 내용

[형식 3] 비교/리뷰 (제품, 서비스)
📊 종합 평가
한 줄 평: 핵심 평가
평가: ⭐⭐⭐⭐☆

✅ 장점
• 장점 1 [1]
• 장점 2 [3]
(필요시 더 많이)

❌ 단점
• 단점 1 [2]
• 단점 2 [4]
(필요시 더 많이)

💰 최종 판단
추천 가이드

글의 성격에 가장 적합한 형식을 선택하여 깔끔하게 요약하세요.`;

    // ✨ 모드에 따라 적절한 프롬프트 선택
    const systemPrompt = isAcademicMode ? academicPrompt : casualPrompt;

    console.log('[Background] 요약 모드:', {
      isAcademicMode,
      isPDF,
      length,
      promptType: isAcademicMode ? '학술적/전문적' : '일반'
    });

    // ✨ GPT에게 전송되는 번호 매겨진 콘텐츠 샘플 확인
    console.log('[Background] 📤 GPT에게 전송되는 번호 매겨진 콘텐츠 샘플 (처음 500자):');
    console.log(numberedContent.substring(0, 500) + '...');

    // ✨ 사용자 메시지도 모드에 따라 조정
    const userMessage = isAcademicMode
      ? `다음은 분석할 학술 문서/전문 자료입니다. 위의 템플릿을 엄격히 따라 체계적이고 깊이 있게 분석해주세요.

**[문서 내용]**
${content}

**[요구사항]**
- 각 섹션을 충실히 작성하되, 내용이 없는 섹션은 "해당 없음" 표기
- 최소 2,000자 이상의 상세한 분석 제공
- 전문 용어는 그대로 사용하며 필요시 간단한 정의 추가
- 논리적 흐름과 체계성 유지`
      : `다음 내용을 ${length === 'short' ? '짧게' : length === 'detailed' ? '자세히' : '적절한 길이로'} 요약해주세요.
각 문단은 [번호]로 표시되어 있습니다. 각 핵심 포인트/장점/단점/단계의 끝에 출처 문단 번호를 반드시 표기하세요.

${numberedContent}`;

    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: userMessage
      }
    ];

    // 4. API 서버에 요약 요청
    const API_URL = 'http://localhost:3000/api/chat';

    const body = {
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.7
    };

    // PageInfo가 있으면 추가
    if (pageInfo) {
      if (pageInfo.title) body.title = pageInfo.title;
      if (pageInfo.url) body.url = pageInfo.url;
      body.language = 'ko';
      // ✨ PDF 플래그 추가 (validator가 file:// 프로토콜 허용하도록)
      if (pageInfo.isPDF) body.isPDF = true;
    }

    console.log('[Background] 🔍 요약 요청 pageInfo:', JSON.stringify(pageInfo, null, 2));
    console.log('[Background] 🔍 API 요청 body:', JSON.stringify(body, null, 2));

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API 호출 실패: ${response.status}`);
    }

    const data = await response.json();

    console.log('[Background] 요약 완료');
    console.log('[Background] API 응답 데이터:', data);

    // API 응답에서 요약 텍스트 추출
    let summaryText = '';
    if (data.summary) {
      summaryText = data.summary;
    } else if (data.message) {
      summaryText = data.message;
    } else if (data.content) {
      summaryText = data.content;
    } else if (data.choices && data.choices[0]?.message?.content) {
      // OpenAI 형식 응답
      summaryText = data.choices[0].message.content;
    } else {
      console.warn('[Background] 알 수 없는 응답 형식:', data);
      summaryText = JSON.stringify(data);
    }

    console.log('[Background] 추출된 요약:', summaryText.substring(0, 100) + '...');

    // ✨ 출처 번호 확인
    const citationMatches = summaryText.match(/\[(\d+)\]/g);
    if (citationMatches) {
      const uniqueCitations = [...new Set(citationMatches)];
      console.log('[Background] 📌 요약에 포함된 출처 번호:', uniqueCitations.slice(0, 20).join(', '));
      console.log('[Background] 📌 고유 출처 번호 개수:', uniqueCitations.length);
      console.log('[Background] 📌 전체 출처 인용 횟수:', citationMatches.length);
    } else {
      console.warn('[Background] ⚠️ 요약에 출처 번호가 없습니다!');
    }

    // ✅ 요약 성공 후 사용량 업데이트
    try {
      console.log('[Background] 요약 성공 - 사용량 갱신 중...');
      await fetchAndSaveUserUsage(accessToken);
      console.log('[Background] 사용량 갱신 완료');
    } catch (usageError) {
      console.warn('[Background] 사용량 갱신 실패 (요약은 성공):', usageError);
    }

    sendResponse({
      success: true,
      summary: summaryText,
      paragraphs: paragraphs, // 원본 문단 정보 전달 (하위 호환성)
      paragraphsWithPosition: paragraphsWithPosition // ✨ 위치 정보 포함
    });

  } catch (error) {
    console.error('[Background] 요약 오류:', error);
    errorHandler.handle(error, 'summarize-content');
    sendResponse({
      success: false,
      error: error.message,
      errorCode: error.errorCode,
      statusCode: error.statusCode,
      requiresEmailVerification: error.requiresEmailVerification
    });
  }
}

/**
 * ✨ 질문 답변 핸들러
 */
async function handleAskQuestion(request, sender, sendResponse) {
  try {
    const { question, content, pageInfo } = request;

    if (!question || question.length < 2) {
      throw new Error('질문이 너무 짧습니다 (최소 2자)');
    }

    if (!content || content.length < 10) {
      throw new Error('콘텐츠가 너무 짧습니다');
    }

    console.log('[Background] 질문 처리 시작:', { question: question.substring(0, 50) + '...', contentLength: content.length });

    // 1. 토큰 가져오기
    const accessToken = await tokenManager.getAccessToken();

    if (!accessToken) {
      throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
    }

    // 2. Messages 배열 생성 (질문 답변 프롬프트)
    const messages = [
      {
        role: 'system',
        content: '당신은 전문 질문 답변 도우미입니다. 주어진 페이지 내용을 바탕으로 사용자의 질문에 명확하고 정확하게 답변해주세요.'
      },
      {
        role: 'user',
        content: `다음은 웹페이지의 내용입니다:\n\n${content}\n\n질문: ${question}`
      }
    ];

    // 3. API 서버에 질문 요청
    const API_URL = 'http://localhost:3000/api/chat';

    const body = {
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    };

    // PageInfo가 있으면 추가
    if (pageInfo) {
      if (pageInfo.title) body.title = pageInfo.title;
      if (pageInfo.url) body.url = pageInfo.url;
      body.language = 'ko';
      // ✨ PDF 플래그 추가 (validator가 file:// 프로토콜 허용하도록)
      if (pageInfo.isPDF) body.isPDF = true;
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API 호출 실패: ${response.status}`);
    }

    const data = await response.json();

    console.log('[Background] 질문 답변 완료');

    // API 응답에서 답변 텍스트 추출
    let answerText = '';
    if (data.answer) {
      answerText = data.answer;
    } else if (data.message) {
      answerText = data.message;
    } else if (data.content) {
      answerText = data.content;
    } else if (data.choices && data.choices[0]?.message?.content) {
      answerText = data.choices[0].message.content;
    } else {
      console.warn('[Background] 알 수 없는 응답 형식:', data);
      answerText = JSON.stringify(data);
    }

    console.log('[Background] 추출된 답변:', answerText.substring(0, 100) + '...');

    sendResponse({
      success: true,
      answer: answerText
    });

  } catch (error) {
    console.error('[Background] 질문 답변 오류:', error);
    errorHandler.handle(error, 'ask-question');
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * ✨ 인증 이메일 재발송 핸들러
 */
async function handleResendVerificationEmail(request, sender, sendResponse) {
  try {
    console.log('[Background] 인증 이메일 재발송 요청');

    // 1. ID 토큰 가져오기
    const accessToken = await tokenManager.getAccessToken();

    if (!accessToken) {
      throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
    }

    // 2. Firebase Auth REST API로 인증 이메일 발송
    const firebaseConfig = CONFIG.getFirebaseConfig();
    const API_KEY = firebaseConfig.apiKey;
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestType: 'VERIFY_EMAIL',
        idToken: accessToken
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || '인증 이메일 재발송에 실패했습니다.');
    }

    console.log('[Background] 인증 이메일 재발송 성공');

    sendResponse({
      success: true,
      message: '인증 이메일이 재발송되었습니다.'
    });

  } catch (error) {
    console.error('[Background] 인증 이메일 재발송 오류:', error);
    errorHandler.handle(error, 'resend-verification-email');
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * ✨ 이메일 인증 상태 새로고침 핸들러
 * Gena_Page의 user.reload() 패턴과 동일
 */
async function handleRefreshEmailVerificationStatus(request, sender, sendResponse) {
  try {
    console.log('[Background] 이메일 인증 상태 새로고침 요청');

    const result = await tokenManager.refreshEmailVerificationStatus();

    sendResponse({
      success: true,
      emailVerified: result.emailVerified,
      email: result.email
    });

  } catch (error) {
    console.error('[Background] 이메일 인증 상태 새로고침 오류:', error);
    errorHandler.handle(error, 'refresh-email-verification-status');
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * ✨ 1회용 웹 로그인 토큰 생성 핸들러
 * Extension에서 웹사이트로 자동 로그인하기 위한 토큰 생성
 */
async function handleGenerateWebLoginToken(request, sender, sendResponse) {
  try {
    const { redirectPath } = request;
    console.log('[Background] 1회용 웹 로그인 토큰 생성 요청:', redirectPath);

    // 1. ID 토큰 가져오기
    const accessToken = await tokenManager.getAccessToken();

    if (!accessToken) {
      throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
    }

    // 2. 백엔드에 토큰 생성 요청
    const backendUrl = CONFIG.getApiUrl();
    const url = `${backendUrl}/api/auth/generate-web-login-token`;

    console.log('[Background] 백엔드 URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    console.log('[Background] 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      let errorMessage = '토큰 생성에 실패했습니다.';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        console.error('[Background] 에러 응답:', errorData);
      } catch (e) {
        console.error('[Background] 에러 응답 파싱 실패');
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // 3. redirectPath가 있으면 URL에 추가
    let redirectUrl = data.redirectUrl;
    if (redirectPath && redirectPath !== '/subscription') {
      // URL에 redirect 파라미터 추가
      const url = new URL(redirectUrl);
      url.searchParams.set('redirect', redirectPath);
      redirectUrl = url.toString();
    }

    console.log('[Background] ✅ 1회용 웹 로그인 토큰 생성 성공');

    sendResponse({
      success: true,
      token: data.token,
      redirectUrl: redirectUrl
    });

  } catch (error) {
    console.error('[Background] 1회용 웹 로그인 토큰 생성 오류:', error);
    errorHandler.handle(error, 'generate-web-login-token');
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * ✨ 오버레이 토글 핸들러 (Content Script 주입 확인 포함)
 */
async function handleToggleOverlay(request, sender, sendResponse) {
  try {
    let tabId = request.tabId || sender.tab?.id;
    let tab = sender.tab;

    if (!tabId) {
      // 현재 활성 탭 가져오기
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      if (!activeTab) {
        throw new Error('활성 탭을 찾을 수 없습니다');
      }

      tabId = activeTab.id;
      tab = activeTab;
    } else if (!tab) {
      // tabId는 있지만 tab 정보가 없으면 가져오기
      tab = await chrome.tabs.get(tabId);
    }

    console.log('[Background] 오버레이 토글 요청 - 탭:', tabId, 'URL:', tab.url);

    // ✨ 제한된 페이지 확인
    if (siteManager.isRestricted(tab.url)) {
      console.warn('[Background] 제한된 페이지 - 오버레이 사용 불가:', tab.url);
      throw new Error('이 페이지에서는 Gena를 사용할 수 없습니다. 일반 웹페이지에서 시도해주세요.');
    }

    // 1️⃣ Content Script 주입 확인
    const isInjected = await contentScriptManager.check(tabId);

    if (!isInjected) {
      console.log('[Background] Content Script 미주입 - 주입 시도');
      try {
        await contentScriptManager.inject(tabId);
        console.log('[Background] Content Script 주입 완료');

        // 주입 후 잠시 대기 (스크립트 초기화 시간)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (injectError) {
        console.error('[Background] Content Script 주입 실패:', injectError);
        throw new Error('페이지에 스크립트를 주입할 수 없습니다');
      }
    }

    // 2️⃣ 오버레이 토글 메시지 전송
    try {
      console.log('[Background] 오버레이 토글 메시지 전송 중...');
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'toggleOverlay'
      });
      console.log('[Background] 오버레이 토글 메시지 응답:', response);
      console.log('[Background] 오버레이 토글 완료 ✅');
      sendResponse({ success: true });
    } catch (messageError) {
      console.error('[Background] 메시지 전송 실패:', messageError);
      console.error('[Background] 메시지 오류 상세:', messageError.message, messageError.stack);
      throw new Error('오버레이 토글 메시지 전송 실패');
    }

  } catch (error) {
    console.error('[Background] 오버레이 토글 오류:', error);
    errorHandler.handle(error, 'toggle-overlay');
    sendResponse({ success: false, error: error.message });
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (changeInfo.url) {
      console.log('URL 변경 감지');
      contentScriptManager.cleanup(tabId);
    }
    
    if (changeInfo.status === 'complete') {
      const settings = await chrome.storage.local.get('settings');
      
      if (settings.settings?.autoExtract && !siteManager.isRestricted(tab.url)) {
        try {
          const result = await extractionManager.startExtraction(tabId, {
            auto: true
          });
          console.log('자동 추출 완료');
        } catch (error) {
          console.error('자동 추출 실패:', error.message);
          errorHandler.handle(error, 'auto-extraction');
        }
      }
    }
  } catch (error) {
    console.error('탭 업데이트 처리 오류:', error);
    errorHandler.handle(error, 'tab-updated');
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  contentScriptManager.cleanup(tabId);
  extractionManager.activeExtractions.delete(tabId);
  
  sidePanelStateManager.clearPanelState(tabId);
});

/**
 * ✨ 탭 활성화 시 처리 (Side Panel 유지)
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const newTabId = activeInfo.tabId;
  const windowId = activeInfo.windowId;

  try {
    console.log('[Background] 탭 활성화:', newTabId);

    // ✨ 현재 활성 탭 업데이트
    currentActiveTabId = newTabId;

    // SPA 자동 주입
    const tab = await chrome.tabs.get(newTabId);

    if (!tab || !tab.url) {
      return;
    }

    if (siteManager.isRestricted(tab.url)) {
      return;
    }

    const siteInfo = siteManager.getSiteInfo(tab.url);
    if (siteInfo.spa) {
      const isInjected = await contentScriptManager.check(newTabId);
      if (!isInjected) {
        console.log('[Background] SPA 감지:', tab.url);

        try {
          await contentScriptManager.inject(newTabId);
          console.log('[Background] SPA에 content script 주입 완료');
        } catch (error) {
          console.log('[Background] Content script 주입 실패:', error.message);
        }
      }
    }

  } catch (error) {
    console.error('[Background] 탭 활성화 처리 오류:', error);
    errorHandler.handle(error, 'tab-activated');
  }
});

chrome.runtime.onSuspend.addListener(() => {
  console.log('[Background] Service Worker 종료 중...');
  pdfOffscreenManager.closeOffscreenDocument();
});

console.log('🚀 Gena Enhanced Background Service 시작 완료 (v5.1.0 - Side Panel 자동 복원)');