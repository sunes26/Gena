/**
 * extension\content-overlay.js
 * Gena Overlay Panel Controller
 * 페이지 위에 표시되는 오버레이 창 제어
 *
 * @version 1.0.0
 */

console.log('[OverlayPanel] 스크립트 파일 로드 시작');
console.log('[OverlayPanel] 이미 초기화되었는지 확인:', !!window.GenaOverlayInitialized);

// ✨ 이미 로드되었으면 중복 실행 방지
if (window.GenaOverlayInitialized) {
  console.log('[OverlayPanel] ⚠️ 이미 초기화됨 - 중복 로드 방지');
  throw new Error('OverlayPanel already initialized - preventing duplicate load');
}

console.log('[OverlayPanel] 새 인스턴스 생성 시작');
window.GenaOverlayInitialized = true;

// ✨ 중복 선언 방지를 위해 조건부로 클래스 정의
if (!window.OverlayPanelManager) {
  /**
   * 오버레이 패널 관리자
   */
  window.OverlayPanelManager = class OverlayPanelManager {
    constructor() {
      this.overlay = null;
      this.shadowRoot = null;
      this.isDragging = false;
      this.isResizing = false;
      this.dragOffset = { x: 0, y: 0 };
      this.isMinimized = false;
      this.isMaximized = false;
      this.previousPosition = null;
      this.previousSize = null;
      this.usage = {
        daily: 0,
        limit: 3  // 일반 사용자 기본 한도
      };
      this.paragraphs = []; // 원본 문단 저장
      this.isLoggedIn = false; // 로그인 상태
      this.showingLoginForm = false; // 로그인 폼 표시 상태
      this.emailVerified = false; // 이메일 인증 상태

      // ✨ v6.3 - 언어 설정
      this.currentLanguage = 'ko';
      this.messages = {};
      this.supportedLanguages = ['ko', 'en', 'ja', 'zh'];

      console.log('[OverlayPanel] 초기화');

      // 언어 초기화
      this.initializeLanguage();
    }

    /**
     * 언어 초기화
     * ✨ v6.3 - 로그인 전: 브라우저 언어, 로그인 후: 사용자 설정 언어
     */
    async initializeLanguage() {
      try {
        // 1. 먼저 로그인 상태 확인
        const response = await chrome.runtime.sendMessage({ action: 'checkTokenStatus' });
        const isLoggedIn = response && response.isAuthenticated;

        if (isLoggedIn) {
          // 로그인한 경우: 설정에서 사용자가 선택한 언어 사용
          const settings = await chrome.storage.local.get(['settings']);

          if (settings.settings && settings.settings.language) {
            if (this.supportedLanguages.includes(settings.settings.language)) {
              this.currentLanguage = settings.settings.language;
            }
          } else {
            // 저장된 언어 없으면 브라우저 언어 사용
            const uiLanguage = chrome.i18n.getUILanguage();
            const browserLang = uiLanguage.substring(0, 2);

            if (this.supportedLanguages.includes(browserLang)) {
              this.currentLanguage = browserLang;
            }
          }
          console.log('[OverlayPanel] 로그인 상태 - 사용자 언어:', this.currentLanguage);
        } else {
          // 로그인하지 않은 경우: 무조건 브라우저 언어만 사용
          const uiLanguage = chrome.i18n.getUILanguage();
          const browserLang = uiLanguage.substring(0, 2);

          if (this.supportedLanguages.includes(browserLang)) {
            this.currentLanguage = browserLang;
          }
          console.log('[OverlayPanel] 로그인 전 - 브라우저 언어:', this.currentLanguage);
        }

        // 메시지 로드
        await this.loadMessages();

        console.log('[OverlayPanel] 언어 초기화 완료:', this.currentLanguage);
      } catch (error) {
        console.error('[OverlayPanel] 언어 초기화 실패:', error);
      }
    }

    /**
     * 메시지 로드
     */
    async loadMessages() {
      try {
        const response = await fetch(chrome.runtime.getURL(`_locales/${this.currentLanguage}/messages.json`));
        const data = await response.json();

        // 메시지 캐시 생성
        this.messages = {};
        for (const key in data) {
          this.messages[key] = data[key].message;
        }
      } catch (error) {
        console.error('[OverlayPanel] 메시지 로드 실패:', error);
      }
    }

    /**
     * 메시지 가져오기
     * @param {string} key - 메시지 키
     * @param {object} substitutions - 플레이스홀더 치환값
     * @returns {string}
     */
    getMessage(key, substitutions) {
      let message = this.messages[key] || key;

      // 플레이스홀더 치환
      if (substitutions) {
        for (const [placeholder, value] of Object.entries(substitutions)) {
          message = message.replace(`{${placeholder}}`, value);
        }
      }

      return message;
    }

    /**
     * 오버레이 생성
     * ✨ v6.3 - 언어 로드 완료 후 생성
     */
    async create() {
      if (this.overlay) {
        console.log('[OverlayPanel] 이미 존재함 - 토글');
        this.toggle();
        return;
      }

      console.log('[OverlayPanel] 생성 시작');

      // ✨ 언어 로드 대기
      if (!this.messages || Object.keys(this.messages).length === 0) {
        await this.initializeLanguage();
      }

      try {
        // Shadow Host 생성
        const host = document.createElement('div');
        host.id = 'gena-overlay-host';
        // ✅ 호스트를 화면 전체에 배치 - pointer-events는 auto로 설정
        host.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          pointer-events: none !important;
          z-index: 2147483647 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          background: transparent !important;
        `;
        console.log('[OverlayPanel] Shadow Host 생성 완료');

        // Shadow DOM 생성 (스타일 격리)
        this.shadowRoot = host.attachShadow({ mode: 'open' });
        console.log('[OverlayPanel] Shadow Root 생성 완료');

        // 스타일 추가
        const style = document.createElement('style');
        style.textContent = this.getStyles();
        this.shadowRoot.appendChild(style);
        console.log('[OverlayPanel] 스타일 추가 완료');

        // Material Icons 제거 - SVG 사용으로 변경

        // 오버레이 컨테이너 생성
        this.overlay = document.createElement('div');
        this.overlay.className = 'gena-overlay-container';
        this.overlay.innerHTML = this.getTemplate();
        console.log('[OverlayPanel] 오버레이 컨테이너 생성 완료');

        this.shadowRoot.appendChild(this.overlay);
        console.log('[OverlayPanel] Shadow Root에 오버레이 추가 완료');

        // 명시적으로 pointer-events 설정 (CSS만으로 안될 경우 대비)
        this.overlay.style.pointerEvents = 'auto';

        document.body.appendChild(host);
        console.log('[OverlayPanel] Body에 Host 추가 완료');

        // 페이드 인 애니메이션 트리거 (약간의 딜레이)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.overlay.classList.add('fade-in');
            console.log('[OverlayPanel] 페이드 인 애니메이션 시작 ✨');
          });
        });

        // 오버레이 전체에서 키보드 이벤트가 페이지로 전파되지 않도록 차단
        host.addEventListener('keydown', (e) => {
          e.stopPropagation();
        }, true);

        host.addEventListener('keyup', (e) => {
          e.stopPropagation();
        }, true);

        host.addEventListener('keypress', (e) => {
          e.stopPropagation();
        }, true);

        console.log('[OverlayPanel] 키보드 이벤트 전파 차단 설정 완료');

        // DOM 확인
        const appendedHost = document.getElementById('gena-overlay-host');
        console.log('[OverlayPanel] DOM 확인 - Host 존재:', !!appendedHost);
        console.log('[OverlayPanel] DOM 확인 - Overlay 존재:', !!this.overlay);
        console.log('[OverlayPanel] DOM 확인 - Overlay 클래스:', this.overlay.className);

        // 🔴 테스트: 오버레이가 실제로 화면에 나타났는지 확인
        console.log('[OverlayPanel] 오버레이 위치:', {
          top: this.overlay.style.top,
          right: this.overlay.style.right,
          width: this.overlay.style.width,
          height: this.overlay.style.height
        });

        // 🔴 테스트: 화면에 오버레이가 보이는지 사용자에게 알림
        setTimeout(() => {
          const rect = host.getBoundingClientRect();
          console.log('[OverlayPanel] Host 위치 정보:', {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0
          });
        }, 100);

        // 이벤트 리스너 설정
        this.setupEventListeners();
        console.log('[OverlayPanel] 이벤트 리스너 설정 완료');

        // ✅ Storage 변경 감지 리스너 설정 (popup.js 패턴)
        this.setupStorageListener();

        // 초기 페이지 정보 로드
        this.loadPageInfo();
        console.log('[OverlayPanel] 페이지 정보 로드 완료');

        // 로그인 상태 확인
        this.checkLoginStatus();
        console.log('[OverlayPanel] 로그인 상태 확인 요청');

        // 사용량 확인
        this.checkUsage();
        console.log('[OverlayPanel] 사용량 확인 요청');

        // 자동 요약 비활성화 - 수동으로만 요약 가능
        // this.checkAutoSummarize();

        console.log('[OverlayPanel] 생성 완료 ✅');

        // ✨ 언어 적용
        this.applyLanguageToUI();
      } catch (error) {
        console.error('[OverlayPanel] 생성 중 오류 발생:', error);
        throw error;
      }
    }

    /**
     * UI에 언어 적용
     * ✨ v6.3 - 동적으로 텍스트 업데이트
     */
    applyLanguageToUI() {
      if (!this.shadowRoot) return;

      // 버튼 title 속성
      const settingsBtn = this.shadowRoot.getElementById('settingsBtn');
      const minimizeBtn = this.shadowRoot.getElementById('minimizeBtn');
      const maximizeBtn = this.shadowRoot.getElementById('maximizeBtn');
      const closeBtn = this.shadowRoot.getElementById('closeBtn');

      if (settingsBtn) settingsBtn.title = this.getMessage('overlaySettings');
      if (minimizeBtn) minimizeBtn.title = this.getMessage('overlayMinimize');
      if (maximizeBtn) maximizeBtn.title = this.getMessage('overlayMaximize');
      if (closeBtn) closeBtn.title = this.getMessage('overlayClose');

      // 페이지 정보 라벨
      const pageInfoLabel = this.shadowRoot.querySelector('.page-info-label');
      if (pageInfoLabel) pageInfoLabel.textContent = this.getMessage('currentPage') || '현재 페이지';

      // 로그인 안내 (초기 화면)
      const loginNoticeTitle = this.shadowRoot.querySelector('.login-notice-text h3');
      if (loginNoticeTitle) loginNoticeTitle.textContent = this.getMessage('loginRequired') || '로그인이 필요합니다';

      const loginNoticeText = this.shadowRoot.querySelector('.login-notice-text p');
      if (loginNoticeText) loginNoticeText.textContent = this.getMessage('overlayLoginPrompt');

      const showLoginFormBtn = this.shadowRoot.querySelector('#showLoginFormBtn span');
      if (showLoginFormBtn) showLoginFormBtn.textContent = this.getMessage('overlayLoginButton');

      // 로그인 폼
      const loginFormTitle = this.shadowRoot.querySelector('#loginFormContainer h3');
      if (loginFormTitle) loginFormTitle.textContent = this.getMessage('login') || '로그인';

      const loginFormDesc = this.shadowRoot.querySelector('.login-form-header > p');
      if (loginFormDesc) loginFormDesc.textContent = this.getMessage('overlayLoginTitle');

      const emailLabel = this.shadowRoot.querySelector('label[for="loginEmail"]');
      if (emailLabel) emailLabel.textContent = this.getMessage('email') || '이메일';

      const passwordLabel = this.shadowRoot.querySelector('label[for="loginPassword"]');
      if (passwordLabel) passwordLabel.textContent = this.getMessage('password') || '비밀번호';

      const emailInput = this.shadowRoot.getElementById('loginEmail');
      if (emailInput) emailInput.placeholder = this.getMessage('overlayEmailPlaceholder');

      const passwordInput = this.shadowRoot.getElementById('loginPassword');
      if (passwordInput) passwordInput.placeholder = this.getMessage('overlayPasswordPlaceholder');

      const forgotPasswordLink = this.shadowRoot.getElementById('forgotPasswordLink');
      if (forgotPasswordLink) forgotPasswordLink.textContent = this.getMessage('overlayForgotPassword');

      const loginSubmitBtn = this.shadowRoot.querySelector('#loginSubmitBtn .btn-text');
      if (loginSubmitBtn) loginSubmitBtn.textContent = this.getMessage('overlayLoginSubmit');

      const backBtn = this.shadowRoot.getElementById('backToNoticeBtn');
      if (backBtn) backBtn.title = this.getMessage('overlayBackButton');

      // 로그인 성공 메시지
      const successTitle = this.shadowRoot.querySelector('.success-title');
      if (successTitle) successTitle.textContent = this.getMessage('loginSuccess') || '로그인 성공!';

      const successMessage = this.shadowRoot.querySelector('.success-message');
      if (successMessage) successMessage.textContent = this.getMessage('overlayLoginSuccess');

      // 비밀번호 재설정 모달
      const resetTitle = this.shadowRoot.querySelector('#passwordResetModal h3');
      if (resetTitle) resetTitle.textContent = this.getMessage('overlayPasswordResetTitle');

      const resetDesc = this.shadowRoot.querySelector('.modal-description');
      if (resetDesc) resetDesc.textContent = this.getMessage('overlayPasswordResetDesc');

      const resetEmailLabel = this.shadowRoot.querySelector('label[for="resetEmail"]');
      if (resetEmailLabel) resetEmailLabel.textContent = this.getMessage('email') || '이메일';

      const resetEmailInput = this.shadowRoot.getElementById('resetEmail');
      if (resetEmailInput) resetEmailInput.placeholder = this.getMessage('overlayEmailPlaceholder');

      const resetSubmitBtn = this.shadowRoot.querySelector('#resetSubmitBtn .btn-text');
      if (resetSubmitBtn) resetSubmitBtn.textContent = this.getMessage('overlayPasswordResetSubmit');

      // 요약 버튼
      const summarizeBtn = this.shadowRoot.querySelector('#summarizeBtn span');
      if (summarizeBtn) summarizeBtn.textContent = this.getMessage('overlaySummarizeButton');

      // 복사 버튼
      const copyBtn = this.shadowRoot.getElementById('copyBtn');
      if (copyBtn) copyBtn.title = this.getMessage('overlayCopyButton');

      // Placeholder 텍스트
      const questionInput = this.shadowRoot.getElementById('questionInput');
      if (questionInput) questionInput.placeholder = this.getMessage('overlayQuestionPlaceholder');

      // 전송 버튼
      const askBtn = this.shadowRoot.getElementById('askBtn');
      if (askBtn) askBtn.title = this.getMessage('overlayAskButton');

      // 요약 결과 제목
      const resultTitle = this.shadowRoot.querySelector('.result-title');
      if (resultTitle) resultTitle.textContent = this.getMessage('overlaySummaryResult');

      // 페이지 제목 (초기 상태)
      const pageTitle = this.shadowRoot.getElementById('pageTitle');
      if (pageTitle && pageTitle.textContent === '페이지를 분석 중...') {
        pageTitle.textContent = this.getMessage('analyzingPage');
      }

      // 로딩 텍스트 (초기 상태)
      const loadingText = this.shadowRoot.getElementById('loadingText');
      if (loadingText && loadingText.textContent === '페이지를 분석하고 있습니다...') {
        loadingText.textContent = this.getMessage('analyzingPageLong');
      }

      // AI 분석 중 텍스트
      const aiAnalyzing = this.shadowRoot.querySelector('#loadingIndicator span');
      if (aiAnalyzing && aiAnalyzing.textContent === 'AI 분석 중...') {
        aiAnalyzing.textContent = this.getMessage('aiAnalyzing');
      }

      // 사용량 라벨
      const usageLabel = this.shadowRoot.querySelector('#usageSection .usage-label span');
      if (usageLabel) usageLabel.textContent = this.getMessage('usage');

      // 뒤로 버튼 텍스트
      const backBtnText = this.shadowRoot.querySelector('#backToNoticeBtn span');
      if (backBtnText) backBtnText.textContent = this.getMessage('back');

      // 취소 버튼
      const cancelBtn = this.shadowRoot.getElementById('modalCancelBtn');
      if (cancelBtn) cancelBtn.textContent = this.getMessage('cancel');

      // 로딩 단계 텍스트
      const step1Text = this.shadowRoot.querySelector('#step1 span');
      if (step1Text) step1Text.textContent = this.getMessage('extracting');

      const step2Text = this.shadowRoot.querySelector('#step2 span');
      if (step2Text) step2Text.textContent = this.getMessage('aiAnalyzing');

      const step3Text = this.shadowRoot.querySelector('#step3 span');
      if (step3Text) step3Text.textContent = this.getMessage('generatingSummary');

      // AI 채팅 라벨
      const questionLabel = this.shadowRoot.querySelector('.question-label');
      if (questionLabel) questionLabel.textContent = this.getMessage('overlayAiChat');

      // 회원가입 푸터
      const signupFooter = this.shadowRoot.querySelector('.form-footer p');
      if (signupFooter) {
        const signupText = this.getMessage('overlaySignupPrompt');
        const signupLink = this.getMessage('overlaySignupLink');
        signupFooter.innerHTML = `${signupText} <a href="https://www.genaai.net/signup" target="_blank" class="signup-link">${signupLink}</a>`;
      }

      // 사용량 카운트 초기값
      const usageCount = this.shadowRoot.getElementById('usageCount');
      if (usageCount && usageCount.textContent === '확인 중...') {
        usageCount.textContent = this.getMessage('checkingUsage');
      }

      console.log('[OverlayPanel] 언어 적용 완료');
    }

    /**
     * CSS 스타일 가져오기
     */
    getStyles() {
      // content-overlay.css의 내용을 인라인으로 삽입
      return `
        ${this.getInlineCSS()}
      `;
    }

    /**
     * 인라인 CSS (content-overlay.css와 동일)
     */
    getInlineCSS() {
      return `
        /* 기본 리셋 */
        * {
          box-sizing: border-box;
        }

        /* 전역 hidden 클래스 */
        .hidden {
          display: none !important;
        }

        /* 오버레이 컨테이너 */
        .gena-overlay-container {
          position: fixed !important;
          top: 20px;
          right: 20px;
          width: 420px;  /* ✨ v6.3 - !important 제거 (리사이즈 가능하도록) */
          max-width: 90vw;  /* ✨ v6.3 - !important 제거 */
          height: 850px;  /* ✨ v6.3 - !important 제거 (리사이즈 가능하도록) */
          max-height: 92vh;  /* ✨ v6.3 - !important 제거 */
          background: #ffffff !important;
          border-radius: 16px !important;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.08) !important;
          z-index: 2147483647 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          font-size: 14px !important;
          color: #1a1a1a !important;
          opacity: 0 !important;
          transform: translateY(-20px) scale(0.95) !important;
          transition: opacity 0.3s ease, transform 0.3s ease !important;
          pointer-events: auto !important;
          cursor: default !important;
        }

        /* 모든 내부 요소도 클릭 가능하도록 */
        .gena-overlay-container * {
          pointer-events: auto !important;
        }

        /* 페이드 인 애니메이션 */
        .gena-overlay-container.fade-in {
          opacity: 1 !important;
          transform: translateY(0) scale(1) !important;
        }

        .gena-overlay-hidden {
          opacity: 0 !important;
          transform: scale(0.95) translateY(-20px) !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }

        .gena-overlay-minimized {
          height: auto !important;
          max-height: none !important;
        }

        .gena-overlay-minimized .gena-overlay-content {
          display: none;
        }

        .gena-overlay-maximized {
          top: 20px !important;
          right: 20px !important;
          left: 20px !important;
          bottom: 20px !important;
          width: auto !important;
          height: auto !important;
          max-width: none !important;
          max-height: none !important;
        }

        /* 헤더 */
        .gena-overlay-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 20px;
          cursor: move;
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          pointer-events: auto !important;
        }

        .gena-overlay-header:active {
          cursor: grabbing;
        }

        .gena-overlay-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 16px;
        }

        .gena-overlay-logo-icon {
          width: 24px;
          height: 24px;
          border-radius: 6px;
        }

        .gena-overlay-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .gena-overlay-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
          padding: 0;
        }

        .gena-overlay-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        /* 컨텐츠 */
        .gena-overlay-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 20px;
          background: #ffffff;
        }

        .gena-overlay-content::-webkit-scrollbar {
          width: 8px;
        }

        .gena-overlay-content::-webkit-scrollbar-track {
          background: #f5f5f5;
        }

        .gena-overlay-content::-webkit-scrollbar-thumb {
          background: #d0d0d0;
          border-radius: 4px;
        }

        /* ✨ v6.3 - 모든 테두리에서 리사이즈 가능 */
        .resize-edge {
          position: absolute;
          z-index: 10;
        }

        /* 상단 테두리 */
        .resize-edge-top {
          top: 0;
          left: 5px;
          right: 5px;
          height: 5px;
          cursor: ns-resize;
        }

        /* 우측 테두리 */
        .resize-edge-right {
          top: 5px;
          right: 0;
          bottom: 5px;
          width: 5px;
          cursor: ew-resize;
        }

        /* 하단 테두리 */
        .resize-edge-bottom {
          bottom: 0;
          left: 5px;
          right: 5px;
          height: 5px;
          cursor: ns-resize;
        }

        /* 좌측 테두리 */
        .resize-edge-left {
          top: 5px;
          left: 0;
          bottom: 5px;
          width: 5px;
          cursor: ew-resize;
        }

        /* 모서리 */
        .resize-corner {
          position: absolute;
          width: 10px;
          height: 10px;
          z-index: 11;
        }

        .resize-corner-tl {
          top: 0;
          left: 0;
          cursor: nwse-resize;
        }

        .resize-corner-tr {
          top: 0;
          right: 0;
          cursor: nesw-resize;
        }

        .resize-corner-bl {
          bottom: 0;
          left: 0;
          cursor: nesw-resize;
        }

        .resize-corner-br {
          bottom: 0;
          right: 0;
          cursor: nwse-resize;
        }

        /* 사이드패널 스타일 재사용 */
        .page-info-modern {
          margin-bottom: 20px;
        }

        .page-info-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #666;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .page-info-display {
          background: #f8f9fa;
          padding: 12px 16px;
          border-radius: 10px;
          border: 1px solid #e9ecef;
        }

        .page-title-main {
          font-weight: 600;
          font-size: 14px;
          color: #1a1a1a;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .page-url-sub {
          font-size: 12px;
          color: #6c757d;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .primary-btn-modern {
          width: 100%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 14px 20px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: transform 0.2s, box-shadow 0.2s;
          margin-bottom: 16px;
        }

        .primary-btn-modern:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .primary-btn-modern:disabled {
          background: linear-gradient(135deg, #a0a0a0 0%, #808080 100%);
          cursor: not-allowed;
          transform: none;
        }

        .loading-indicator-modern {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 24px;
          background: #ffffff;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .loading-indicator-modern.hidden {
          display: none;
        }

        .loading-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .spinner-modern {
          width: 32px;
          height: 32px;
          border: 3px solid #e9ecef;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-text {
          font-size: 14px;
          font-weight: 600;
          color: #495057;
        }

        .loading-progress {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .progress-step {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: #6c757d;
          transition: all 0.3s ease;
        }

        .progress-step.active {
          color: #667eea;
          font-weight: 600;
        }

        .progress-step.completed {
          color: #4CAF50;
        }

        .step-icon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #e9ecef;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.3s ease;
        }

        .progress-step.active .step-icon {
          border-color: #667eea;
          background: rgba(102, 126, 234, 0.1);
        }

        .progress-step.completed .step-icon {
          border-color: #4CAF50;
          background: #4CAF50;
        }

        .step-icon svg {
          width: 12px;
          height: 12px;
          stroke: white;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .progress-step.completed .step-icon svg {
          opacity: 1;
        }

        .progress-bar-container {
          width: 100%;
          height: 4px;
          background: #e9ecef;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          border-radius: 2px;
          transition: width 0.5s ease;
          position: relative;
        }

        .progress-bar-fill::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          animation: shimmerProgress 1.5s infinite;
        }

        @keyframes shimmerProgress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        /* 스켈레톤 프리뷰 */
        .skeleton-preview {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-top: 8px;
        }

        .skeleton-line {
          height: 12px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          border-radius: 6px;
          animation: skeletonPulse 1.5s infinite;
        }

        .skeleton-line.short {
          width: 60%;
        }

        .skeleton-line.medium {
          width: 80%;
        }

        .skeleton-line.long {
          width: 100%;
        }

        @keyframes skeletonPulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .summary-result-modern {
          background: #ffffff;
          border: 1px solid #e9ecef;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          animation: slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .summary-result-modern.hidden {
          display: none;
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* 요약 완료 체크마크 애니메이션 */
        .success-checkmark {
          width: 60px;
          height: 60px;
          margin: 0 auto 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 8px 24px rgba(76, 175, 80, 0.3);
        }

        @keyframes scaleIn {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .success-checkmark svg {
          width: 32px;
          height: 32px;
          stroke: white;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .checkmark-path {
          stroke-dasharray: 50;
          stroke-dashoffset: 50;
          animation: drawCheck 0.5s ease-out 0.3s forwards;
        }

        @keyframes drawCheck {
          to {
            stroke-dashoffset: 0;
          }
        }

        .result-header-modern {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e9ecef;
        }

        .result-title {
          flex: 1;
          font-size: 15px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0;
        }

        .icon-btn-small-modern {
          background: transparent;
          border: none;
          color: #6c757d;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, color 0.2s;
          padding: 0;
        }

        .icon-btn-small-modern:hover {
          background: #f8f9fa;
          color: #1a1a1a;
        }

        .summary-text-modern {
          font-size: 14px;
          line-height: 1.8;
          color: #1a1a1a;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        /* 소스 링크 */
        .source-link:hover {
          color: #4c51bf !important;
          text-decoration: underline;
        }

        /* 질문 섹션 */
        .question-section-modern {
          margin-bottom: 16px;
        }

        .question-section-modern.hidden {
          display: none;
        }

        .question-header-modern {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: #667eea;
          font-weight: 600;
          font-size: 13px;
        }

        .question-input-wrapper-modern {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .question-input-modern {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e9ecef;
          border-radius: 10px;
          font-size: 14px;
          color: #1a1a1a;
          background: #f8f9fa;
          transition: border-color 0.2s, background 0.2s;
        }

        .question-input-modern:focus {
          outline: none;
          border-color: #667eea;
          background: #ffffff;
        }

        .question-input-modern::placeholder {
          color: #adb5bd;
        }

        .ask-btn-modern {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 10px;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .ask-btn-modern:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .ask-btn-modern:disabled {
          background: linear-gradient(135deg, #a0a0a0 0%, #808080 100%);
          cursor: not-allowed;
          transform: none;
        }

        /* 채팅 메시지 컨테이너 */
        .chat-messages-container {
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 12px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .chat-messages-container:empty {
          display: none;
        }

        .chat-messages-container::-webkit-scrollbar {
          width: 6px;
        }

        .chat-messages-container::-webkit-scrollbar-track {
          background: #e9ecef;
          border-radius: 3px;
        }

        .chat-messages-container::-webkit-scrollbar-thumb {
          background: #adb5bd;
          border-radius: 3px;
        }

        /* 채팅 메시지 */
        .chat-message {
          display: flex;
          gap: 8px;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .chat-message.user {
          flex-direction: row-reverse;
        }

        .chat-message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 16px;
        }

        .chat-message.user .chat-message-avatar {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .chat-message.ai .chat-message-avatar {
          background: #ffffff;
          color: #495057;
          padding: 2px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .chat-message-content {
          flex: 1;
          max-width: 80%;
        }

        .chat-message-bubble {
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.6;
          word-wrap: break-word;
        }

        .chat-message.user .chat-message-bubble {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .chat-message.ai .chat-message-bubble {
          background: white;
          color: #1a1a1a;
          border: 1px solid #e9ecef;
          border-bottom-left-radius: 4px;
        }

        .chat-message-time {
          font-size: 11px;
          color: #adb5bd;
          margin-top: 4px;
          padding: 0 4px;
        }

        /* 로딩 메시지 */
        .chat-message.loading .chat-message-bubble {
          background: white;
          border: 1px solid #e9ecef;
          color: #667eea;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .chat-loading-dots {
          display: flex;
          gap: 4px;
        }

        .chat-loading-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #667eea;
          animation: bounce 1.4s infinite ease-in-out;
        }

        .chat-loading-dot:nth-child(1) {
          animation-delay: -0.32s;
        }

        .chat-loading-dot:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }

        /* 로그인 초기 안내 */
        .login-notice-simple {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 32px;
          margin: 16px 0;
          min-height: 450px;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          border-radius: 16px;
          text-align: center;
        }

        .login-notice-icon {
          width: 80px;
          height: 80px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .login-notice-icon svg {
          color: #667eea;
        }

        .login-notice-text h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .login-notice-text p {
          margin: 0 0 20px 0;
          font-size: 14px;
          color: #6c757d;
          line-height: 1.6;
        }

        .login-btn-modern {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .login-btn-modern:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }

        .login-btn-modern:active {
          transform: translateY(0);
        }

        /* 로그인 폼 (전체 화면) */
        .login-form-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          padding: 20px;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          border-radius: 16px;
          overflow-y: auto;
          overflow-x: hidden;
          z-index: 10;
          display: flex;
          flex-direction: column;
        }

        /* 뒤로가기 버튼 */
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #333;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 16px;
          width: fit-content;
        }

        .back-btn:hover {
          background: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .back-btn svg {
          flex-shrink: 0;
        }

        .login-form-header {
          text-align: center;
          margin-bottom: 16px;
        }

        .login-icon {
          width: 52px;
          height: 52px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .login-icon svg {
          color: #667eea;
        }

        .login-form-header h3 {
          margin: 0 0 8px 0;
          font-size: 20px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .login-form-header p {
          margin: 0;
          font-size: 13px;
          color: #6c757d;
          line-height: 1.5;
        }

        .login-form-body {
          background: white;
          padding: 18px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .form-group {
          margin-bottom: 14px;
        }

        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #333;
          margin-bottom: 6px;
        }

        .form-group input[type="email"],
        .form-group input[type="password"],
        .form-group input[type="text"] {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .form-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group input.error {
          border-color: #ef4444;
        }

        .password-input-container {
          position: relative;
        }

        .password-input-container input {
          padding-right: 40px !important;
        }

        .password-toggle-btn {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #6c757d;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease;
        }

        .password-toggle-btn:hover {
          color: #333;
        }

        .form-error {
          display: block;
          font-size: 12px;
          color: #ef4444;
          margin-top: 4px;
          min-height: 16px;
        }

        .form-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .forgot-password-link {
          color: #667eea;
          text-decoration: none;
          font-size: 13px;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .forgot-password-link:hover {
          color: #764ba2;
          text-decoration: underline;
        }

        .checkbox-container {
          display: flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
          font-size: 13px;
          color: #333;
        }

        .checkbox-container input[type="checkbox"] {
          margin: 0 8px 0 0;
          cursor: pointer;
        }

        .login-submit-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .login-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }

        .login-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-loader {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .form-footer {
          margin-top: 16px;
          text-align: center;
        }

        .form-footer p {
          margin: 0;
          font-size: 13px;
          color: #6c757d;
        }

        .signup-link {
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
        }

        .signup-link:hover {
          text-decoration: underline;
        }

        /* 로그인 성공 애니메이션 (전체 화면) */
        .login-success-animation {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          padding: 40px 24px;
          background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
          border-radius: 16px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 10;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .success-icon {
          width: 100px;
          height: 100px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          box-shadow: 0 8px 24px rgba(76, 175, 80, 0.2);
          animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .success-icon svg {
          filter: drop-shadow(0 2px 4px rgba(76, 175, 80, 0.3));
        }

        .success-title {
          margin: 0 0 12px 0;
          font-size: 24px;
          font-weight: 700;
          color: #2e7d32;
          animation: slideUp 0.4s ease-out 0.2s both;
        }

        .success-message {
          margin: 0;
          font-size: 15px;
          color: #558b2f;
          animation: slideUp 0.4s ease-out 0.3s both;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* 이메일 인증 컨테이너 - 오버레이 직접 배치 */
        .email-verification-container {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: center;
          width: 100%;
          flex: 1;
          animation: fadeIn 0.3s ease-out;
        }

        .email-verification-container.hidden {
          display: none;
        }

        .email-verification-container .email-verification-modal {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .usage-counter-modern {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 16px;
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border: 1px solid #e9ecef;
          border-radius: 12px;
          margin: 16px 0 0 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .usage-header {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .usage-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #6c757d;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .usage-label svg {
          width: 16px;
          height: 16px;
        }

        .usage-info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .usage-count {
          font-size: 14px;
          font-weight: 700;
          color: #495057;
        }

        .upgrade-btn-mini {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 14px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
        }

        .upgrade-btn-mini:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
        }

        .upgrade-btn-mini:active {
          transform: translateY(0);
        }

        .upgrade-btn-mini svg {
          width: 12px;
          height: 12px;
        }

        .usage-count.premium {
          color: #4CAF50;
        }

        .usage-count.warning {
          color: #ff9800;
        }

        .usage-count.danger {
          color: #f44336;
        }

        .usage-progress-container {
          width: 100%;
          height: 6px;
          background: #e9ecef;
          border-radius: 3px;
          overflow: hidden;
          position: relative;
        }

        .usage-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%);
          border-radius: 3px;
          transition: width 0.3s ease, background 0.3s ease;
          position: relative;
        }

        .usage-progress-bar.warning {
          background: linear-gradient(90deg, #ff9800 0%, #ffb74d 100%);
        }

        .usage-progress-bar.danger {
          background: linear-gradient(90deg, #f44336 0%, #ef5350 100%);
        }

        .usage-progress-bar.premium {
          background: linear-gradient(90deg, #4CAF50 0%, #66BB6A 50%, #4CAF50 100%);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .premium-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%);
          color: white;
          font-size: 11px;
          font-weight: 700;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 6px rgba(76, 175, 80, 0.3);
        }

        .premium-badge svg {
          width: 12px;
          height: 12px;
        }

        /* 비밀번호 재설정 모달 */
        .password-reset-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .password-reset-modal.hidden {
          display: none;
        }

        .modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
        }

        .modal-dialog {
          position: relative;
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 440px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: modalSlideIn 0.3s ease-out;
        }

        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 24px 16px 24px;
          border-bottom: 1px solid #e9ecef;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #212529;
        }

        .modal-close-btn {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #6c757d;
          transition: color 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close-btn:hover {
          color: #212529;
        }

        .modal-body {
          padding: 24px;
        }

        .modal-description {
          margin: 0 0 20px 0;
          font-size: 14px;
          color: #6c757d;
          line-height: 1.5;
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          padding: 16px 24px 24px 24px;
        }

        .btn-secondary {
          flex: 1;
          padding: 12px;
          background: #e9ecef;
          color: #495057;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-secondary:hover {
          background: #dee2e6;
        }

        .btn-primary {
          flex: 1;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `;
    }

    /**
     * HTML 템플릿
     */
    getTemplate() {
      return `
        <div class="gena-overlay-header">
          <div class="gena-overlay-logo">
            <img src="${chrome.runtime.getURL('icons/icon48.png')}" class="gena-overlay-logo-icon" alt="Gena">
            <span>Gena</span>
          </div>
          <div class="gena-overlay-controls">
            <button class="gena-overlay-btn" id="settingsBtn" title="${this.getMessage('overlaySettings')}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button class="gena-overlay-btn" id="minimizeBtn" title="${this.getMessage('overlayMinimize')}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button class="gena-overlay-btn" id="maximizeBtn" title="${this.getMessage('overlayMaximize')}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
              </svg>
            </button>
            <button class="gena-overlay-btn" id="closeBtn" title="${this.getMessage('overlayClose')}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <div class="gena-overlay-content">
          <!-- 페이지 정보 -->
          <div id="pageInfoSection" class="page-info-modern">
            <label class="page-info-label">현재 페이지</label>
            <div class="page-info-display">
              <div id="pageTitle" class="page-title-main">페이지를 분석 중...</div>
              <div id="pageUrl" class="page-url-sub"></div>
            </div>
          </div>

          <!-- 로그인 안내 (초기 화면) -->
          <div id="loginNotice" class="login-notice-simple hidden">
            <div class="login-notice-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div class="login-notice-text">
              <h3>로그인이 필요합니다</h3>
              <p>Gena의 AI 요약 기능을 사용하려면 로그인해주세요.</p>
            </div>
            <button id="showLoginFormBtn" class="login-btn-modern">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                <polyline points="10 17 15 12 10 7"></polyline>
                <line x1="15" y1="12" x2="3" y2="12"></line>
              </svg>
              <span>로그인하기</span>
            </button>
          </div>

          <!-- 로그인 폼 (로그인 안 된 경우) -->
          <div id="loginFormContainer" class="login-form-container hidden">
            <button id="backToNoticeBtn" class="back-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              <span>뒤로</span>
            </button>
            <div class="login-form-header">
              <div class="login-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <h3>로그인</h3>
              <p>Gena AI 요약 서비스를 이용하시려면 로그인해주세요</p>
            </div>

            <div class="login-form-body">
              <div class="form-group">
                <label for="loginEmail">이메일</label>
                <input
                  type="email"
                  id="loginEmail"
                  placeholder="email@example.com"
                  autocomplete="email"
                >
                <span class="form-error" id="emailError"></span>
              </div>

              <div class="form-group">
                <label for="loginPassword">비밀번호</label>
                <div class="password-input-container">
                  <input
                    type="password"
                    id="loginPassword"
                    placeholder="${chrome.i18n.getMessage('passwordPlaceholder')}"
                    autocomplete="current-password"
                  >
                  <button type="button" class="password-toggle-btn" id="passwordToggle">
                    <svg class="eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
                <span class="form-error" id="passwordError"></span>
              </div>

              <div class="form-options">
                <!-- 로그인 상태는 항상 유지됩니다 -->
                <a href="#" class="forgot-password-link" id="forgotPasswordLink">비밀번호 찾기</a>
              </div>

              <button id="loginSubmitBtn" class="login-submit-btn">
                <span class="btn-text">로그인</span>
                <span class="btn-loader hidden">
                  <svg class="spinner" width="20" height="20" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="white" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
                  </svg>
                </span>
              </button>

              <div class="form-footer">
                <p>계정이 없으신가요? <a href="https://www.genaai.net/signup" target="_blank" class="signup-link">회원가입</a></p>
              </div>
            </div>
          </div>

          <!-- 로그인 성공 애니메이션 -->
          <div id="loginSuccessAnimation" class="login-success-animation hidden">
            <div class="success-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h3 class="success-title">로그인 성공!</h3>
            <p class="success-message">요약 화면으로 이동합니다...</p>
          </div>

          <!-- 이메일 인증 필요 (오버레이 직접 배치) -->
          <div id="emailVerificationContainer" class="email-verification-container hidden"></div>

          <!-- 비밀번호 재설정 모달 -->
          <div id="passwordResetModal" class="password-reset-modal hidden">
            <div class="modal-overlay"></div>
            <div class="modal-dialog">
              <div class="modal-header">
                <h3>비밀번호 재설정</h3>
                <button class="modal-close-btn" id="modalCloseBtn">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
              <div class="modal-body">
                <p class="modal-description">가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.</p>
                <div class="form-group">
                  <label for="resetEmail">이메일</label>
                  <input
                    type="email"
                    id="resetEmail"
                    placeholder="email@example.com"
                    autocomplete="email"
                  >
                  <span class="form-error" id="resetEmailError"></span>
                </div>
              </div>
              <div class="modal-footer">
                <button class="btn-secondary" id="modalCancelBtn">취소</button>
                <button class="btn-primary" id="resetSubmitBtn">
                  <span class="btn-text">재설정 링크 전송</span>
                  <span class="btn-loader hidden">
                    <svg class="spinner" width="20" height="20" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="white" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- 요약 버튼 -->
          <button id="summarizeBtn" class="primary-btn-modern">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
              <path d="M8 10h8M8 14h8M8 18h8"/>
            </svg>
            <span>페이지 요약하기</span>
          </button>

          <!-- 로딩 -->
          <div id="loadingIndicator" class="loading-indicator-modern hidden">
            <!-- 로딩 헤더 -->
            <div class="loading-header">
              <div class="spinner-modern"></div>
              <span class="loading-text" id="loadingText">페이지를 분석하고 있습니다...</span>
            </div>

            <!-- 진행률 바 -->
            <div class="progress-bar-container">
              <div class="progress-bar-fill" id="progressBarFill" style="width: 0%"></div>
            </div>

            <!-- 진행 단계 -->
            <div class="loading-progress">
              <div class="progress-step" id="step1">
                <div class="step-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span>콘텐츠 추출 중...</span>
              </div>
              <div class="progress-step" id="step2">
                <div class="step-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span>AI 분석 중...</span>
              </div>
              <div class="progress-step" id="step3">
                <div class="step-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span>요약 생성 중...</span>
              </div>
            </div>

            <!-- 스켈레톤 프리뷰 -->
            <div class="skeleton-preview">
              <div class="skeleton-line long"></div>
              <div class="skeleton-line medium"></div>
              <div class="skeleton-line long"></div>
              <div class="skeleton-line short"></div>
            </div>
          </div>

          <!-- 요약 결과 -->
          <div id="summaryResult" class="summary-result-modern hidden">
            <div class="result-header-modern">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <h3 class="result-title">요약 결과</h3>
              <button id="copyBtn" class="icon-btn-small-modern" title="${chrome.i18n.getMessage('buttonCopy')}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <div id="summaryText" class="summary-text-modern"></div>
          </div>

          <!-- 질문하기 (채팅 형식) -->
          <div id="questionSection" class="question-section-modern hidden">
            <div class="question-header-modern">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span class="question-label">AI 채팅</span>
            </div>

            <!-- 채팅 메시지 영역 -->
            <div id="chatMessages" class="chat-messages-container"></div>

            <!-- 입력 영역 -->
            <div class="question-input-wrapper-modern">
              <input type="text" id="questionInput" class="question-input-modern" placeholder="${chrome.i18n.getMessage('questionPlaceholder')}">
              <button id="askBtn" class="ask-btn-modern" title="${chrome.i18n.getMessage('buttonSend')}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </div>

          <!-- 사용량 -->
          <div id="usageSection" class="usage-counter-modern">
            <div class="usage-header">
              <div class="usage-label">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="20" x2="12" y2="10"/>
                  <line x1="18" y1="20" x2="18" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="16"/>
                </svg>
                <span>사용량</span>
              </div>
              <div class="usage-info-row">
                <div id="usageCount" class="usage-count">확인 중...</div>
                <button id="upgradeButton" class="upgrade-btn-mini" style="display: none;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <span>업그레이드</span>
                </button>
              </div>
            </div>
            <div class="usage-progress-container">
              <div id="usageProgressBar" class="usage-progress-bar" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <!-- ✨ v6.3 - 모든 테두리 리사이즈 핸들 -->
        <div class="resize-edge resize-edge-top" data-resize="top"></div>
        <div class="resize-edge resize-edge-right" data-resize="right"></div>
        <div class="resize-edge resize-edge-bottom" data-resize="bottom"></div>
        <div class="resize-edge resize-edge-left" data-resize="left"></div>

        <div class="resize-corner resize-corner-tl" data-resize="top-left"></div>
        <div class="resize-corner resize-corner-tr" data-resize="top-right"></div>
        <div class="resize-corner resize-corner-bl" data-resize="bottom-left"></div>
        <div class="resize-corner resize-corner-br" data-resize="bottom-right"></div>
      `;
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
      const header = this.shadowRoot.querySelector('.gena-overlay-header');
      const settingsBtn = this.shadowRoot.getElementById('settingsBtn');
      const closeBtn = this.shadowRoot.getElementById('closeBtn');
      const minimizeBtn = this.shadowRoot.getElementById('minimizeBtn');
      const maximizeBtn = this.shadowRoot.getElementById('maximizeBtn');
      const summarizeBtn = this.shadowRoot.getElementById('summarizeBtn');
      const copyBtn = this.shadowRoot.getElementById('copyBtn');

      // ✨ v6.3 - 모든 리사이즈 핸들 선택
      const resizeHandles = this.shadowRoot.querySelectorAll('[data-resize]');

      // 드래그
      header.addEventListener('mousedown', (e) => this.startDrag(e));
      document.addEventListener('mousemove', (e) => this.drag(e));
      document.addEventListener('mouseup', () => this.stopDrag());

      // ✨ v6.3 - 모든 테두리/모서리에 리사이즈 이벤트 추가
      resizeHandles.forEach((handle) => {
        handle.addEventListener('mousedown', (e) => {
          this.startResize(e);
        });
      });
      document.addEventListener('mousemove', (e) => this.resize(e));
      document.addEventListener('mouseup', () => this.stopResize());

      // 컨트롤 버튼
      settingsBtn.addEventListener('click', () => this.openSettings());
      closeBtn.addEventListener('click', () => this.close());
      minimizeBtn.addEventListener('click', () => this.minimize());
      maximizeBtn.addEventListener('click', () => this.maximize());

      // 기능 버튼
      summarizeBtn.addEventListener('click', () => this.summarize());
      copyBtn.addEventListener('click', () => this.copySummary());

      // 업그레이드 버튼
      const upgradeButton = this.shadowRoot.getElementById('upgradeButton');
      if (upgradeButton) {
        upgradeButton.addEventListener('click', () => {
          this.openWebsiteWithAutoLogin('/subscription');
        });
      }

      // 로그인 안내 - 로그인하기 버튼
      const showLoginFormBtn = this.shadowRoot.getElementById('showLoginFormBtn');
      if (showLoginFormBtn) {
        showLoginFormBtn.addEventListener('click', () => this.showLoginForm());
      }

      // 로그인 폼 - 뒤로가기 버튼
      const backToNoticeBtn = this.shadowRoot.getElementById('backToNoticeBtn');
      if (backToNoticeBtn) {
        backToNoticeBtn.addEventListener('click', () => this.hideLoginForm());
      }

      // 로그인 폼
      const loginSubmitBtn = this.shadowRoot.getElementById('loginSubmitBtn');
      const loginPassword = this.shadowRoot.getElementById('loginPassword');
      const passwordToggle = this.shadowRoot.getElementById('passwordToggle');

      if (loginSubmitBtn) {
        loginSubmitBtn.addEventListener('click', () => this.handleLogin());
      }

      if (loginPassword) {
        // Enter 키로 로그인
        loginPassword.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') this.handleLogin();
        });
      }

      if (passwordToggle) {
        // 비밀번호 표시/숨기기 토글
        passwordToggle.addEventListener('click', () => {
          const input = this.shadowRoot.getElementById('loginPassword');
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';

          // 아이콘 변경
          passwordToggle.innerHTML = isPassword
            ? '<svg class="eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
            : '<svg class="eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
        });
      }

      // 비밀번호 찾기 링크
      const forgotPasswordLink = this.shadowRoot.getElementById('forgotPasswordLink');
      if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.showPasswordResetModal();
        });
      }

      // 비밀번호 재설정 모달
      const modalCloseBtn = this.shadowRoot.getElementById('modalCloseBtn');
      const modalCancelBtn = this.shadowRoot.getElementById('modalCancelBtn');
      const modalOverlay = this.shadowRoot.querySelector('.modal-overlay');
      const resetSubmitBtn = this.shadowRoot.getElementById('resetSubmitBtn');
      const resetEmail = this.shadowRoot.getElementById('resetEmail');

      if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => this.hidePasswordResetModal());
      }

      if (modalCancelBtn) {
        modalCancelBtn.addEventListener('click', () => this.hidePasswordResetModal());
      }

      if (modalOverlay) {
        modalOverlay.addEventListener('click', () => this.hidePasswordResetModal());
      }

      if (resetSubmitBtn) {
        resetSubmitBtn.addEventListener('click', () => this.handlePasswordReset());
      }

      if (resetEmail) {
        // Enter 키로 비밀번호 재설정 요청
        resetEmail.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.handlePasswordReset();
          }
        });
      }

      // 질문 기능
      const questionInput = this.shadowRoot.getElementById('questionInput');
      const askBtn = this.shadowRoot.getElementById('askBtn');

      if (questionInput && askBtn) {
        askBtn.addEventListener('click', () => this.askQuestion());

        // Enter 키로 질문 전송
        questionInput.addEventListener('keypress', (e) => {
          e.stopPropagation(); // 이벤트가 페이지로 전파되는 것 방지
          if (e.key === 'Enter') {
            e.preventDefault();
            this.askQuestion();
          }
        });

        // 모든 키보드 이벤트가 페이지로 전파되지 않도록 차단
        questionInput.addEventListener('keydown', (e) => {
          e.stopPropagation(); // 페이지의 단축키가 실행되지 않도록 방지
        });

        questionInput.addEventListener('keyup', (e) => {
          e.stopPropagation(); // 페이지의 단축키가 실행되지 않도록 방지
        });

        questionInput.addEventListener('input', (e) => {
          e.stopPropagation(); // 입력 이벤트도 차단
        });

        // 포커스 이벤트도 차단
        questionInput.addEventListener('focus', (e) => {
          e.stopPropagation();
          console.log('[OverlayPanel] 입력 필드 포커스 - 이벤트 전파 차단');
        });

        questionInput.addEventListener('blur', (e) => {
          e.stopPropagation();
        });
      }

      // 소스 링크 클릭 이벤트 (이벤트 위임)
      this.shadowRoot.addEventListener('click', (e) => {
        if (e.target.classList.contains('source-link')) {
          e.preventDefault();
          e.stopPropagation();
          const paragraphNum = parseInt(e.target.dataset.paragraph);
          this.scrollToParagraph(paragraphNum);
        }
      });
    }

    /**
     * ✅ Storage 변경 감지 리스너 설정 (popup.js 패턴)
     * - background.js가 usageData를 storage에 저장하면 자동 감지
     * - UI 즉시 업데이트 (수동 checkUsage() 호출 불필요)
     */
    setupStorageListener() {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.usageData) {
          console.log('[OverlayPanel] 🔔 Storage 변경 감지 - 사용량 자동 업데이트');

          const newUsageData = changes.usageData.newValue;

          if (newUsageData) {
            const isPremium = newUsageData.isPremium || false;

            this.usage.daily = newUsageData.dailyUsed || 0;
            this.usage.limit = newUsageData.dailyLimit || 3;

            console.log('[OverlayPanel] 📊 업데이트된 사용량:', {
              isPremium,
              daily: this.usage.daily,
              limit: this.usage.limit
            });

            // ✅ UI 즉시 업데이트
            this.updateUsageDisplay(isPremium);
          }
        }
      });

      console.log('[OverlayPanel] ✅ Storage 리스너 설정 완료');
    }

    /**
     * 드래그 시작
     * ✨ v6.3 - 최대화 상태에서도 드래그 가능하도록 수정
     */
    startDrag(e) {
      // ✨ v6.3 - 버튼 클릭 시 드래그 방지 (SVG 자식 요소도 고려)
      const clickedElement = e.target;
      const isButton = clickedElement.tagName === 'BUTTON' ||
                       clickedElement.closest('button') ||
                       clickedElement.closest('.gena-overlay-btn');

      if (isButton) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // ✨ 최대화 상태에서 드래그 시작하면 자동으로 복원
      if (this.isMaximized) {
        this.isMaximized = false;
        this.overlay.classList.remove('gena-overlay-maximized');

        // 드래그 시작 위치를 기준으로 새 위치 설정
        const rect = this.overlay.getBoundingClientRect();
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.height = `${rect.height}px`;
        this.overlay.style.top = `${rect.top}px`;
        this.overlay.style.left = `${rect.left}px`;
        this.overlay.style.right = 'auto';
        this.overlay.style.bottom = 'auto';

        // 최대화 버튼 아이콘 복원
        const btn = this.shadowRoot.querySelector('#maximizeBtn');
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>`;
      }

      this.isDragging = true;
      const rect = this.overlay.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      console.log('[OverlayPanel] 드래그 시작:', this.dragOffset);
    }

    /**
     * 드래그 중
     */
    drag(e) {
      if (!this.isDragging) return;

      e.preventDefault();
      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;

      // 화면 경계 체크
      const maxX = window.innerWidth - this.overlay.offsetWidth;
      const maxY = window.innerHeight - this.overlay.offsetHeight;

      const boundedX = Math.max(0, Math.min(x, maxX));
      const boundedY = Math.max(0, Math.min(y, maxY));

      this.overlay.style.left = `${boundedX}px`;
      this.overlay.style.top = `${boundedY}px`;
      this.overlay.style.right = 'auto';
      this.overlay.style.bottom = 'auto';

      console.log('[OverlayPanel] 드래그 위치:', { x: boundedX, y: boundedY });
    }

    /**
     * 드래그 종료
     */
    stopDrag() {
      this.isDragging = false;
    }

    /**
     * 리사이즈 시작
     * ✨ v6.3 - 모든 테두리/모서리에서 리사이즈 가능
     */
    startResize(e) {
      e.preventDefault();
      e.stopPropagation();

      // ✨ 최대화 상태에서 리사이즈 시작하면 자동으로 복원
      if (this.isMaximized) {
        this.isMaximized = false;
        this.overlay.classList.remove('gena-overlay-maximized');

        const rect = this.overlay.getBoundingClientRect();
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.height = `${rect.height}px`;
        this.overlay.style.top = `${rect.top}px`;
        this.overlay.style.left = `${rect.left}px`;
        this.overlay.style.right = 'auto';
        this.overlay.style.bottom = 'auto';

        const btn = this.shadowRoot.querySelector('#maximizeBtn');
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>`;
      }

      this.isResizing = true;
      this.resizeDirection = e.target.getAttribute('data-resize');
      this.initialMouseX = e.clientX;
      this.initialMouseY = e.clientY;

      const rect = this.overlay.getBoundingClientRect();
      this.initialWidth = rect.width;
      this.initialHeight = rect.height;
      this.initialTop = rect.top;
      this.initialLeft = rect.left;
    }

    /**
     * 리사이즈 중
     * ✨ v6.3 - 방향별 리사이즈 처리
     */
    resize(e) {
      if (!this.isResizing) return;

      e.preventDefault();
      const deltaX = e.clientX - this.initialMouseX;
      const deltaY = e.clientY - this.initialMouseY;

      const direction = this.resizeDirection;
      let newWidth = this.initialWidth;
      let newHeight = this.initialHeight;
      let newTop = this.initialTop;
      let newLeft = this.initialLeft;

      // 방향별 리사이즈 처리
      if (direction.includes('right')) {
        newWidth = Math.max(320, this.initialWidth + deltaX);
      }
      if (direction.includes('left')) {
        newWidth = Math.max(320, this.initialWidth - deltaX);
        newLeft = this.initialLeft + (this.initialWidth - newWidth);
      }
      if (direction.includes('bottom')) {
        newHeight = Math.max(200, this.initialHeight + deltaY);
      }
      if (direction.includes('top')) {
        newHeight = Math.max(200, this.initialHeight - deltaY);
        newTop = this.initialTop + (this.initialHeight - newHeight);
      }

      // 스타일 적용
      this.overlay.style.width = `${newWidth}px`;
      this.overlay.style.height = `${newHeight}px`;
      this.overlay.style.top = `${newTop}px`;
      this.overlay.style.left = `${newLeft}px`;
      this.overlay.style.right = 'auto';
      this.overlay.style.bottom = 'auto';
    }

    /**
     * 리사이즈 종료
     */
    stopResize() {
      this.isResizing = false;
      this.resizeDirection = null;
    }

    /**
     * 최소화
     */
    minimize() {
      this.isMinimized = !this.isMinimized;
      this.overlay.classList.toggle('gena-overlay-minimized', this.isMinimized);

      const btn = this.shadowRoot.querySelector('#minimizeBtn');
      btn.innerHTML = this.isMinimized
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <line x1="12" y1="5" x2="12" y2="19"></line>
             <line x1="5" y1="12" x2="19" y2="12"></line>
           </svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <line x1="5" y1="12" x2="19" y2="12"></line>
           </svg>`;
    }

    /**
     * 최대화
     * ✨ v6.3 - 첫 최대화부터 전체 화면 채우기 수정
     */
    maximize() {
      const btn = this.shadowRoot.querySelector('#maximizeBtn');

      if (this.isMaximized) {
        // 복원
        this.overlay.classList.remove('gena-overlay-maximized');

        // ✨ 저장된 인라인 스타일이 있으면 복원, 없으면 CSS 기본값 사용
        if (this.previousPosition) {
          this.overlay.style.top = this.previousPosition.top;
          this.overlay.style.left = this.previousPosition.left;
          this.overlay.style.right = this.previousPosition.right;
          this.overlay.style.bottom = this.previousPosition.bottom;
        }
        if (this.previousSize) {
          this.overlay.style.width = this.previousSize.width;
          this.overlay.style.height = this.previousSize.height;
        }
        this.isMaximized = false;

        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>`;
      } else {
        // ✨ 최대화 전 인라인 스타일만 저장 (computed style 제외)
        // 사용자가 드래그/리사이즈한 경우에만 인라인 스타일이 존재함
        this.previousPosition = {
          top: this.overlay.style.top,
          left: this.overlay.style.left,
          right: this.overlay.style.right,
          bottom: this.overlay.style.bottom
        };
        this.previousSize = {
          width: this.overlay.style.width,
          height: this.overlay.style.height
        };

        this.overlay.classList.add('gena-overlay-maximized');
        this.isMaximized = true;

        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
        </svg>`;
      }
    }

    /**
     * 설정 열기
     * ✨ v6.3 - 옵션 페이지 열기
     */
    openSettings() {
      // Background script를 통해 옵션 페이지 열기 (content script는 직접 호출 불가)
      chrome.runtime.sendMessage({ action: 'openOptionsPage' });
    }

    /**
     * 1회용 토큰으로 웹사이트 자동 로그인
     * Extension에서 웹사이트로 자동 로그인하여 지정된 페이지로 이동
     *
     * @param {string} redirectPath - 로그인 후 이동할 경로 (예: '/subscription')
     */
    async openWebsiteWithAutoLogin(redirectPath = '/subscription') {
      try {
        console.log('[OverlayPanel] 웹사이트 자동 로그인 시작:', redirectPath);

        // 1. 로그인 상태 확인
        if (!this.isLoggedIn) {
          console.error('[OverlayPanel] 로그인이 필요합니다');
          alert('로그인이 필요합니다. 먼저 로그인해주세요.');
          return;
        }

        // 2. Background script를 통해 1회용 토큰 생성 요청
        const response = await chrome.runtime.sendMessage({
          action: 'generateWebLoginToken',
          redirectPath: redirectPath
        });

        if (!response || !response.success) {
          throw new Error(response?.error || '토큰 생성에 실패했습니다');
        }

        console.log('[OverlayPanel] 1회용 토큰 생성 성공');

        // 3. 받은 redirectUrl로 새 탭 열기
        window.open(response.redirectUrl, '_blank');

        console.log('[OverlayPanel] ✅ 웹사이트로 이동:', response.redirectUrl);

      } catch (error) {
        console.error('[OverlayPanel] 웹사이트 자동 로그인 실패:', error);
        alert(`자동 로그인에 실패했습니다: ${error.message}`);
      }
    }

    /**
     * 닫기
     */
    close() {
      this.overlay.classList.add('gena-overlay-hidden');
      setTimeout(() => {
        const host = document.getElementById('gena-overlay-host');
        if (host) {
          host.remove();
        }
        this.overlay = null;
        this.shadowRoot = null;
        window.GenaOverlayInitialized = false;
      }, 200);
    }

    /**
     * 토글
     */
    toggle() {
      if (this.overlay) {
        const isHidden = this.overlay.classList.contains('gena-overlay-hidden');

        console.log('[OverlayPanel] 토글 - 현재 상태:', {
          isHidden,
          classList: Array.from(this.overlay.classList)
        });

        if (isHidden) {
          // 표시
          console.log('[OverlayPanel] 오버레이 표시');
          this.overlay.classList.remove('gena-overlay-hidden');
          this.overlay.style.pointerEvents = 'auto'; // 클릭 가능
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.overlay.classList.add('fade-in');
            });
          });
        } else {
          // 숨김
          console.log('[OverlayPanel] 오버레이 숨김');
          this.overlay.classList.remove('fade-in');
          this.overlay.classList.add('gena-overlay-hidden');
          this.overlay.style.pointerEvents = 'none'; // 클릭 통과
        }
      } else {
        console.warn('[OverlayPanel] 토글 실패 - overlay가 존재하지 않음');
      }
    }

    /**
     * 페이지 정보 로드
     */
    loadPageInfo() {
      const titleEl = this.shadowRoot.getElementById('pageTitle');
      const urlEl = this.shadowRoot.getElementById('pageUrl');

      titleEl.textContent = document.title || this.getMessage('noTitle');
      urlEl.textContent = window.location.href;
    }

    /**
     * 로그인 상태 확인
     */
    async checkLoginStatus() {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'checkTokenStatus'
        });

        console.log('[OverlayPanel] 로그인 상태:', response);

        // tokenInfo.isAuthenticated가 true이고 만료되지 않았는지 확인
        this.isLoggedIn = response && response.success &&
                         response.tokenInfo &&
                         response.tokenInfo.isAuthenticated &&
                         !response.tokenInfo.isExpired;

        // 이메일 인증 상태 확인
        this.emailVerified = response && response.tokenInfo &&
                            response.tokenInfo.emailVerified === true;

        console.log('[OverlayPanel] 로그인 여부:', this.isLoggedIn);
        console.log('[OverlayPanel] 이메일 인증 여부:', this.emailVerified);

        // ✨ 로그인되었지만 이메일 미인증인 경우, 최신 인증 상태 확인
        // (Gena_Page의 user.reload() 패턴과 동일)
        if (this.isLoggedIn && !this.emailVerified) {
          console.log('[OverlayPanel] 이메일 인증 상태 새로고침 시도...');
          try {
            const refreshResponse = await chrome.runtime.sendMessage({
              action: 'refreshEmailVerificationStatus'
            });

            if (refreshResponse && refreshResponse.success) {
              this.emailVerified = refreshResponse.emailVerified === true;
              console.log('[OverlayPanel] 🔐 최신 이메일 인증 상태:', this.emailVerified);
            }
          } catch (refreshError) {
            console.warn('[OverlayPanel] 이메일 인증 상태 새로고침 실패 (무시):', refreshError.message);
            // 실패해도 기존 상태 유지
          }
        }

        // UI 업데이트
        this.updateLoginUI();

      } catch (error) {
        console.error('[OverlayPanel] 로그인 상태 확인 실패:', error);
        this.isLoggedIn = false;
        this.emailVerified = false;
        this.updateLoginUI();
      }
    }

    /**
     * 로그인 UI 업데이트
     */
    updateLoginUI() {
      const loginNotice = this.shadowRoot.getElementById('loginNotice');
      const loginFormContainer = this.shadowRoot.getElementById('loginFormContainer');
      const loginSuccessAnimation = this.shadowRoot.getElementById('loginSuccessAnimation');
      const summarizeBtn = this.shadowRoot.getElementById('summarizeBtn');
      const pageInfoSection = this.shadowRoot.getElementById('pageInfoSection');
      const usageSection = this.shadowRoot.getElementById('usageSection');
      const emailVerificationContainer = this.shadowRoot.getElementById('emailVerificationContainer');

      // 컨트롤 버튼들
      const settingsBtn = this.shadowRoot.getElementById('settingsBtn');
      const minimizeBtn = this.shadowRoot.getElementById('minimizeBtn');
      const maximizeBtn = this.shadowRoot.getElementById('maximizeBtn');

      if (this.isLoggedIn && !this.emailVerified) {
        // 상태 1-A: 로그인됨 + 이메일 미인증 - 인증 안내 표시
        loginNotice.classList.add('hidden');
        loginFormContainer.classList.add('hidden');
        loginSuccessAnimation.classList.add('hidden');
        summarizeBtn.classList.add('hidden');

        // 이메일 인증 안내 표시
        this.showEmailVerificationRequiredInSummaryArea();

        // ✅ 페이지 정보와 사용량 모두 숨김 (이메일 인증 컨테이너만 표시)
        if (pageInfoSection) pageInfoSection.classList.add('hidden');
        if (usageSection) usageSection.classList.add('hidden');

        // ✅ 컨트롤 버튼 표시
        if (settingsBtn) settingsBtn.classList.remove('hidden');
        if (minimizeBtn) minimizeBtn.classList.remove('hidden');
        if (maximizeBtn) maximizeBtn.classList.remove('hidden');

        // ✅ 오버레이 크기 정상으로 복원
        if (!this.isMaximized) {
          this.overlay.style.setProperty('height', '600px', 'important');
        }
      } else if (this.isLoggedIn && this.emailVerified) {
        // 상태 1-B: 로그인됨 + 이메일 인증됨 - 정상 사용
        loginNotice.classList.add('hidden');
        loginFormContainer.classList.add('hidden');
        loginSuccessAnimation.classList.add('hidden');
        summarizeBtn.classList.remove('hidden');
        summarizeBtn.disabled = false;

        // ✅ 이메일 인증 컨테이너 숨기기
        if (emailVerificationContainer) emailVerificationContainer.classList.add('hidden');

        // ✅ 페이지 정보와 사용량 표시
        if (pageInfoSection) pageInfoSection.classList.remove('hidden');
        if (usageSection) usageSection.classList.remove('hidden');

        // ✅ 컨트롤 버튼 표시
        if (settingsBtn) settingsBtn.classList.remove('hidden');
        if (minimizeBtn) minimizeBtn.classList.remove('hidden');
        if (maximizeBtn) maximizeBtn.classList.remove('hidden');

        // ✅ 오버레이 크기 정상으로 복원
        if (!this.isMaximized) {
          this.overlay.style.setProperty('height', '600px', 'important');
        }
      } else if (this.showingLoginForm) {
        // 상태 2: 로그인 폼 표시 중 - 로그인 폼만 표시
        loginNotice.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
        loginSuccessAnimation.classList.add('hidden');
        summarizeBtn.classList.add('hidden');
        summarizeBtn.disabled = true;

        // ✅ 이메일 인증 컨테이너 숨기기
        if (emailVerificationContainer) emailVerificationContainer.classList.add('hidden');

        // ✅ 페이지 정보와 사용량 숨김
        if (pageInfoSection) pageInfoSection.classList.add('hidden');
        if (usageSection) usageSection.classList.add('hidden');

        // ✅ 컨트롤 버튼 숨김
        if (settingsBtn) settingsBtn.classList.add('hidden');
        if (minimizeBtn) minimizeBtn.classList.add('hidden');
        if (maximizeBtn) maximizeBtn.classList.add('hidden');

        // ✅ 오버레이 크기 원래대로 유지
        if (!this.isMaximized) {
          this.overlay.style.setProperty('height', '600px', 'important');
        }
      } else {
        // 상태 3: 초기 상태 - 로그인 안내만 표시
        loginNotice.classList.remove('hidden');
        loginFormContainer.classList.add('hidden');
        loginSuccessAnimation.classList.add('hidden');
        summarizeBtn.classList.add('hidden');
        summarizeBtn.disabled = true;

        // ✅ 이메일 인증 컨테이너 숨기기
        if (emailVerificationContainer) emailVerificationContainer.classList.add('hidden');

        // ✅ 페이지 정보와 사용량 숨김
        if (pageInfoSection) pageInfoSection.classList.add('hidden');
        if (usageSection) usageSection.classList.add('hidden');

        // ✅ 컨트롤 버튼 숨김
        if (settingsBtn) settingsBtn.classList.add('hidden');
        if (minimizeBtn) minimizeBtn.classList.add('hidden');
        if (maximizeBtn) maximizeBtn.classList.add('hidden');

        // ✅ 오버레이 크기 원래대로 유지
        if (!this.isMaximized) {
          this.overlay.style.setProperty('height', '600px', 'important');
        }
      }
    }

    /**
     * 로그인 폼 표시
     */
    showLoginForm() {
      console.log('[OverlayPanel] 로그인 폼 표시');
      this.showingLoginForm = true;
      this.updateLoginUI();
    }

    /**
     * 로그인 폼 숨김 (초기 화면으로 돌아가기)
     */
    hideLoginForm() {
      console.log('[OverlayPanel] 로그인 폼 숨김');
      this.showingLoginForm = false;
      this.updateLoginUI();

      // 입력 필드 초기화
      const emailInput = this.shadowRoot.getElementById('loginEmail');
      const passwordInput = this.shadowRoot.getElementById('loginPassword');
      const emailError = this.shadowRoot.getElementById('emailError');
      const passwordError = this.shadowRoot.getElementById('passwordError');

      if (emailInput) emailInput.value = '';
      if (passwordInput) passwordInput.value = '';
      if (emailError) emailError.textContent = '';
      if (passwordError) passwordError.textContent = '';
      if (emailInput) emailInput.classList.remove('error');
      if (passwordInput) passwordInput.classList.remove('error');
    }

    /**
     * 로그인 처리
     */
    async handleLogin() {
      const emailInput = this.shadowRoot.getElementById('loginEmail');
      const passwordInput = this.shadowRoot.getElementById('loginPassword');
      const loginBtn = this.shadowRoot.getElementById('loginSubmitBtn');
      const emailError = this.shadowRoot.getElementById('emailError');
      const passwordError = this.shadowRoot.getElementById('passwordError');

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const rememberMe = true; // 항상 로그인 상태 유지

      // 에러 초기화
      emailError.textContent = '';
      passwordError.textContent = '';
      emailInput.classList.remove('error');
      passwordInput.classList.remove('error');

      // 유효성 검사
      let hasError = false;

      if (!email) {
        emailError.textContent = this.getMessage('pleaseEnterEmail');
        emailInput.classList.add('error');
        hasError = true;
      } else if (!this.validateEmail(email)) {
        emailError.textContent = this.getMessage('invalidEmailFormat');
        emailInput.classList.add('error');
        hasError = true;
      }

      if (!password) {
        passwordError.textContent = this.getMessage('pleaseEnterPassword');
        passwordInput.classList.add('error');
        hasError = true;
      }

      if (hasError) return;

      // 로딩 상태
      this.setButtonLoading(loginBtn, true);

      try {
        console.log('[OverlayPanel] 로그인 시도:', email);

        const response = await chrome.runtime.sendMessage({
          action: 'loginUser',
          email,
          password,
          rememberMe
        });

        if (response.success) {
          console.log('[OverlayPanel] 로그인 성공!');

          // 성공 애니메이션 표시
          this.showLoginSuccess();

          // 1초 후 기본 화면으로 전환
          setTimeout(() => {
            this.isLoggedIn = true;
            this.showingLoginForm = false;

            // ✅ 사용량은 storage 리스너가 자동으로 업데이트 (popup.js 패턴)
            // background.js에서 fetchAndSaveUserUsage() 호출 → storage 저장 → 리스너 감지 → UI 업데이트

            this.updateLoginUI();
          }, 1000);

        } else {
          throw new Error(response.error || this.getMessage('loginFailed'));
        }

      } catch (error) {
        console.error('[OverlayPanel] 로그인 실패:', error);
        passwordError.textContent = error.message;
        this.setButtonLoading(loginBtn, false);
      }
    }

    /**
     * 이메일 유효성 검사
     */
    validateEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }

    /**
     * 비밀번호 재설정 모달 표시
     */
    showPasswordResetModal() {
      console.log('[OverlayPanel] 비밀번호 재설정 모달 표시');
      const modal = this.shadowRoot.getElementById('passwordResetModal');
      const resetEmail = this.shadowRoot.getElementById('resetEmail');

      if (modal) {
        modal.classList.remove('hidden');

        // 이메일 필드에 포커스
        if (resetEmail) {
          setTimeout(() => resetEmail.focus(), 100);
        }
      }
    }

    /**
     * 비밀번호 재설정 모달 숨김
     */
    hidePasswordResetModal() {
      console.log('[OverlayPanel] 비밀번호 재설정 모달 숨김');
      const modal = this.shadowRoot.getElementById('passwordResetModal');
      const resetEmail = this.shadowRoot.getElementById('resetEmail');
      const resetEmailError = this.shadowRoot.getElementById('resetEmailError');

      if (modal) {
        modal.classList.add('hidden');
      }

      // 입력 필드 및 에러 초기화
      if (resetEmail) {
        resetEmail.value = '';
        resetEmail.classList.remove('error');
      }

      if (resetEmailError) {
        resetEmailError.textContent = '';
      }
    }

    /**
     * 비밀번호 재설정 요청 처리
     */
    async handlePasswordReset() {
      const resetEmail = this.shadowRoot.getElementById('resetEmail');
      const resetEmailError = this.shadowRoot.getElementById('resetEmailError');
      const resetSubmitBtn = this.shadowRoot.getElementById('resetSubmitBtn');

      const email = resetEmail.value.trim();

      // 에러 초기화
      resetEmailError.textContent = '';
      resetEmail.classList.remove('error');

      // 유효성 검사
      if (!email) {
        resetEmailError.textContent = this.getMessage('pleaseEnterEmail');
        resetEmail.classList.add('error');
        return;
      }

      if (!this.validateEmail(email)) {
        resetEmailError.textContent = this.getMessage('invalidEmailFormat');
        resetEmail.classList.add('error');
        return;
      }

      // 로딩 상태
      this.setButtonLoading(resetSubmitBtn, true);

      try {
        console.log('[OverlayPanel] 비밀번호 재설정 요청:', email);

        const response = await chrome.runtime.sendMessage({
          action: 'requestPasswordReset',
          email
        });

        if (response.success) {
          console.log('[OverlayPanel] 비밀번호 재설정 이메일 발송 성공');

          // 모달 닫기
          this.hidePasswordResetModal();

          // 성공 메시지 표시 (임시 알림)
          this.showTemporaryMessage(this.getMessage('passwordResetEmailSent'), 'success');

        } else {
          throw new Error(response.error || this.getMessage('passwordResetRequestFailed'));
        }

      } catch (error) {
        console.error('[OverlayPanel] 비밀번호 재설정 요청 실패:', error);
        resetEmailError.textContent = error.message;
      } finally {
        this.setButtonLoading(resetSubmitBtn, false);
      }
    }

    /**
     * 임시 메시지 표시 (성공/에러 알림)
     */
    showTemporaryMessage(message, type = 'info') {
      // 간단한 알림을 위해 기존 에러 필드 활용
      const emailError = this.shadowRoot.getElementById('emailError');
      if (emailError) {
        emailError.textContent = message;
        emailError.style.color = type === 'success' ? '#4caf50' : '#ef4444';

        // 5초 후 메시지 제거
        setTimeout(() => {
          emailError.textContent = '';
          emailError.style.color = '';
        }, 5000);
      }
    }

    /**
     * 버튼 로딩 상태 설정
     */
    setButtonLoading(button, loading) {
      const btnText = button.querySelector('.btn-text');
      const btnLoader = button.querySelector('.btn-loader');

      if (loading) {
        button.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
      } else {
        button.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
      }
    }

    /**
     * 로그인 성공 애니메이션 표시
     */
    showLoginSuccess() {
      const loginFormContainer = this.shadowRoot.getElementById('loginFormContainer');
      const loginSuccessAnimation = this.shadowRoot.getElementById('loginSuccessAnimation');

      loginFormContainer.classList.add('hidden');
      loginSuccessAnimation.classList.remove('hidden');

      console.log('[OverlayPanel] 로그인 성공 애니메이션 표시');
    }

    /**
     * 사용량 확인
     */
    async checkUsage() {
      try {
        // chrome.storage에서 직접 사용량 데이터 읽기
        const result = await chrome.storage.local.get('usageData');

        console.log('[OverlayPanel] Storage 원본 데이터:', JSON.stringify(result.usageData, null, 2));

        if (result.usageData) {
          const usageData = result.usageData;
          const isPremium = usageData.isPremium || false;

          this.usage.daily = usageData.dailyUsed || 0;
          // ✅ storage에 저장된 dailyLimit 사용 (Infinity 또는 숫자)
          // Infinity는 premium, 그 외는 실제 limit 값 (기본 3)
          this.usage.limit = usageData.dailyLimit || 3;

          console.log('[OverlayPanel] 사용량 조회 완료:', {
            isPremium,
            daily: this.usage.daily,
            limit: this.usage.limit,
            dailyLimit_원본: usageData.dailyLimit
          });

          this.updateUsageDisplay(isPremium);
        } else {
          console.warn('[OverlayPanel] Storage에 사용량 데이터 없음 - 기본값 사용');
          this.usage.daily = 0;
          this.usage.limit = 3; // 일반 사용자 기본 한도
          this.updateUsageDisplay(false);
        }
      } catch (error) {
        console.error('[OverlayPanel] 사용량 확인 오류:', error);
        this.usage.daily = 0;
        this.usage.limit = 3;
        this.updateUsageDisplay(false);
      }
    }

    /**
     * 사용량 표시 업데이트
     */
    updateUsageDisplay(isPremium = false) {
      const usageCount = this.shadowRoot.getElementById('usageCount');
      const usageProgressBar = this.shadowRoot.getElementById('usageProgressBar');
      const upgradeButton = this.shadowRoot.getElementById('upgradeButton');

      if (!usageCount || !usageProgressBar) return;

      // 기존 클래스 제거
      usageCount.classList.remove('premium', 'warning', 'danger');
      usageProgressBar.classList.remove('premium', 'warning', 'danger');

      if (isPremium) {
        // 프리미엄 사용자
        usageCount.innerHTML = `<span class="premium-badge"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> ${this.getMessage('unlimited')}</span>`;
        usageCount.classList.add('premium');
        usageProgressBar.style.width = '100%';
        usageProgressBar.classList.add('premium');

        // 프리미엄 사용자는 업그레이드 버튼 숨김
        if (upgradeButton) upgradeButton.style.display = 'none';
      } else {
        // 일반 사용자
        const used = this.usage.daily;
        const limit = this.usage.limit;
        const percentage = Math.min((used / limit) * 100, 100);

        usageCount.textContent = this.getMessage('usageCount', { count: used, limit: limit });
        usageProgressBar.style.width = `${percentage}%`;

        // 사용량에 따른 색상 변경
        if (percentage >= 100) {
          // 100% 이상 - 빨강 (위험)
          usageCount.classList.add('danger');
          usageProgressBar.classList.add('danger');
        } else if (percentage >= 70) {
          // 70% 이상 - 주황 (경고)
          usageCount.classList.add('warning');
          usageProgressBar.classList.add('warning');
        }
        // 70% 미만 - 기본 녹색 (안전)

        // 무료 사용자는 업그레이드 버튼 표시
        if (upgradeButton) {
          upgradeButton.style.display = 'flex';
          // 버튼 텍스트 다국어 처리
          const buttonText = upgradeButton.querySelector('span');
          if (buttonText) {
            buttonText.textContent = this.getMessage('buttonUpgrade');
          }
        }
      }
    }

    /**
     * 자동 요약 확인
     */
    async checkAutoSummarize() {
      try {
        const result = await chrome.storage.local.get('autoSummarize');

        if (result.autoSummarize) {
          console.log('[OverlayPanel] 자동 요약 시작');

          // autoSummarize 플래그 제거
          await chrome.storage.local.remove('autoSummarize');

          // 약간의 딜레이 후 요약 시작 (UI가 완전히 로드되도록)
          setTimeout(() => {
            this.summarize();
          }, 300);
        }
      } catch (error) {
        console.error('[OverlayPanel] 자동 요약 확인 오류:', error);
      }
    }

    /**
     * 요약하기
     */
    async summarize() {
      console.log('[OverlayPanel] 요약 시작');

      const summarizeBtn = this.shadowRoot.getElementById('summarizeBtn');
      const loadingIndicator = this.shadowRoot.getElementById('loadingIndicator');
      const summaryResult = this.shadowRoot.getElementById('summaryResult');
      const summaryText = this.shadowRoot.getElementById('summaryText');

      // 버튼 비활성화
      summarizeBtn.disabled = true;
      loadingIndicator.classList.remove('hidden');
      summaryResult.classList.add('hidden');

      // 진행 상태 초기화
      this.resetLoadingProgress();
      this.updateLoadingProgress(1, 0);

      try {
        // 1️⃣ 콘텐츠 추출
        console.log('[OverlayPanel] 콘텐츠 추출 요청 전송...');
        this.updateLoadingProgress(1, 33, this.getMessage('overlayLoadingExtract'));

        const extractResponse = await chrome.runtime.sendMessage({
          action: 'extractContent'
        });

        console.log('[OverlayPanel] 콘텐츠 추출 응답:', extractResponse);

        if (!extractResponse || !extractResponse.success) {
          throw new Error(extractResponse?.error || this.getMessage('contentExtractionFailed'));
        }

        console.log('[OverlayPanel] 콘텐츠 추출 완료, 길이:', extractResponse.content?.length);
        console.log('[OverlayPanel] 🔍 extractResponse.metadata:', extractResponse.metadata);
        console.log('[OverlayPanel] 🔍 extractResponse.textItems:', {
          hasTextItems: !!extractResponse.textItems,
          length: extractResponse.textItems?.length || 0,
          sample: extractResponse.textItems?.[0]
        });

        // ✨ PDF 여부 확인 및 처리
        const isPDF = extractResponse.metadata?.isPDF || false;
        this.isPDF = isPDF; // ✨ 클래스 속성으로 저장 (출처 팝업에서 사용)
        console.log('[OverlayPanel] 🔍 isPDF 값:', isPDF);

        if (isPDF) {
          console.log('[OverlayPanel] ✅ PDF 감지 - 자세한 요약 적용 (요약 완료 후 최대화)');
        } else {
          console.log('[OverlayPanel] ℹ️ 일반 웹페이지 - 기본 모드');
        }

        // 1단계 완료
        this.completeLoadingStep(1);
        await this.delay(300);

        // 2️⃣ AI 분석
        console.log('[OverlayPanel] 요약 요청 전송...');
        this.updateLoadingProgress(2, 66, this.getMessage('overlayLoadingAnalyze'));

        const summaryRequest = {
          action: 'summarizeContent',
          content: extractResponse.content,
          length: isPDF ? 'detailed' : 'medium',
          textItems: extractResponse.textItems || null, // ✨ PDF 위치 정보 추가
          pageInfo: {
            title: document.title,
            url: window.location.href,
            isPDF: isPDF  // ✨ PDF 플래그 추가
          }
        };

        console.log('[OverlayPanel] 🔍 요약 요청 데이터:', {
          action: summaryRequest.action,
          contentLength: summaryRequest.content?.length,
          length: summaryRequest.length,
          pageInfo: summaryRequest.pageInfo
        });

        const summaryResponse = await chrome.runtime.sendMessage(summaryRequest);

        console.log('[OverlayPanel] 요약 응답:', summaryResponse);

        if (!summaryResponse || !summaryResponse.success) {
          const error = new Error(summaryResponse?.error || this.getMessage('summaryFailed'));
          // 에러 코드 및 상태 정보 복사
          error.errorCode = summaryResponse?.errorCode;
          error.statusCode = summaryResponse?.statusCode;
          error.requiresEmailVerification = summaryResponse?.requiresEmailVerification;
          throw error;
        }

        console.log('[OverlayPanel] 요약 완료, 결과 길이:', summaryResponse.summary?.length);

        // 2단계 완료
        this.completeLoadingStep(2);
        await this.delay(300);

        // 3️⃣ 요약 생성
        this.updateLoadingProgress(3, 90, this.getMessage('overlayLoadingGenerate'));

        // 3. 문단 정보 저장
        if (summaryResponse.paragraphs) {
          this.paragraphs = summaryResponse.paragraphs;
          console.log('[OverlayPanel] 문단 정보 저장:', this.paragraphs.length, '개');
        }

        // ✨ PDF 위치 정보 저장
        if (summaryResponse.paragraphsWithPosition) {
          this.paragraphsWithPosition = summaryResponse.paragraphsWithPosition;
          console.log('[OverlayPanel] 📍 PDF 위치 정보 저장:', this.paragraphsWithPosition.length, '개');
        }

        // 4. 결과 포맷팅
        const formattedSummary = this.formatSummaryText(summaryResponse.summary || this.getMessage('noSummaryResults'));

        // 3단계 완료
        this.completeLoadingStep(3);
        this.updateLoadingProgress(3, 100, this.getMessage('complete'));
        await this.delay(500);

        // 5️⃣ 완료 애니메이션과 함께 결과 표시
        loadingIndicator.classList.add('hidden');

        // 체크마크 애니메이션 표시
        await this.showSuccessAnimation();

        // ✨ PDF 요약 완료 시 자동 최대화
        if (isPDF) {
          console.log('[OverlayPanel] PDF 요약 완료 - 최대화 모드 전환');
          this.maximize();
        }

        // 요약 결과 표시
        summaryText.innerHTML = formattedSummary;
        summaryResult.classList.remove('hidden');
        console.log('[OverlayPanel] 요약 결과 UI 업데이트 완료 ✅');

        // 6. 질문 섹션 표시
        const questionSection = this.shadowRoot.getElementById('questionSection');
        if (questionSection) {
          questionSection.classList.remove('hidden');
        }

        // ✅ 사용량은 storage 리스너가 자동으로 업데이트 (popup.js 패턴)
        // background.js에서 fetchAndSaveUserUsage() 호출 → storage 저장 → 리스너 감지 → UI 업데이트

      } catch (error) {
        console.error('[OverlayPanel] 요약 실패:', error);

        // 이메일 미인증 에러 처리
        if (error.errorCode === 'EMAIL_NOT_VERIFIED' ||
            error.requiresEmailVerification ||
            error.statusCode === 403 ||
            error.message?.includes('이메일 인증')) {
          this.showEmailVerificationRequired();
        } else {
          // 일반 에러
          summaryText.textContent = `${this.getMessage('error')}: ${error.message}`;
          summaryResult.classList.remove('hidden');
        }

        loadingIndicator.classList.add('hidden');
      } finally {
        summarizeBtn.disabled = false;
      }
    }

    /**
     * 이메일 인증 필요 UI 표시 (요약 영역에)
     */
    showEmailVerificationRequiredInSummaryArea() {
      this.showEmailVerificationRequired();
    }

    /**
     * 이메일 인증 필요 UI 표시
     * ✨ Gena_Page 디자인 참고 - 현대적이고 세련된 UI
     * ✨ 오버레이 창에 직접 배치 (요약 탭 밖에 위치)
     */
    showEmailVerificationRequired() {
      console.log('[OverlayPanel] 이메일 인증 필요 안내 표시');

      const emailVerificationContainer = this.shadowRoot.getElementById('emailVerificationContainer');
      const summaryResult = this.shadowRoot.getElementById('summaryResult');

      if (!emailVerificationContainer) {
        console.error('[OverlayPanel] 이메일 인증 컨테이너를 찾을 수 없습니다');
        return;
      }

      // ✅ 요약 결과 숨기기
      if (summaryResult) {
        summaryResult.classList.add('hidden');
      }

      // 이메일 인증 안내 메시지 HTML - Gena_Page 스타일 (오버레이 창에 꽉 차도록)
      const message = `
        <div class="email-verification-modal" style="
          width: 100%;
          height: 100%;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          margin: 0;
          display: flex;
          flex-direction: column;
        ">
          <!-- 그라데이션 헤더 -->
          <div style="
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
            padding: 24px 20px;
            text-align: center;
            position: relative;
          ">
            <!-- 아이콘 배경 -->
            <div style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 56px;
              height: 56px;
              background: rgba(255, 255, 255, 0.2);
              backdrop-filter: blur(10px);
              border-radius: 50%;
              margin-bottom: 12px;
            ">
              <svg style="width: 28px; height: 28px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>

            <h3 style="
              margin: 0 0 6px 0;
              color: white;
              font-size: 22px;
              font-weight: 700;
              letter-spacing: -0.3px;
            ">이메일 인증 필요</h3>

            <p style="
              margin: 0;
              color: rgba(255, 255, 255, 0.9);
              font-size: 14px;
            ">서비스 이용을 위해 인증이 필요합니다</p>
          </div>

          <!-- 본문 -->
          <div style="
            flex: 1;
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          ">
            <!-- 인증 필요 이유 -->
            <div style="
              margin-bottom: 14px;
              padding: 12px 14px;
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 8px;
            ">
              <p style="
                margin: 0;
                color: #1e40af;
                font-size: 13px;
                line-height: 1.5;
              ">
                🔒 보안을 위해 이메일 인증을 완료해주세요.
              </p>
            </div>

            <!-- 안내 단계 -->
            <div style="
              margin-bottom: 16px;
              padding: 12px 14px;
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
            ">
              <h4 style="
                margin: 0 0 8px 0;
                color: #111827;
                font-size: 14px;
                font-weight: 600;
              ">📋 인증 방법</h4>
              <ol style="
                margin: 0;
                padding-left: 20px;
                color: #6b7280;
                font-size: 13px;
                line-height: 1.5;
              ">
                <li>가입 시 보내드린 <strong>이메일 확인</strong></li>
                <li>이메일의 <strong>인증 링크 클릭</strong></li>
                <li><strong>페이지 새로고침</strong></li>
              </ol>
            </div>

            <!-- 버튼 그룹 -->
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
              <!-- 재발송 버튼 -->
              <button id="resendEmailBtn" style="
                flex: 1;
                background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06);
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
              " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 10px -3px rgba(0, 0, 0, 0.1), 0 3px 5px -2px rgba(0, 0, 0, 0.05)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px -1px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06)';">
                <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <span>재발송</span>
              </button>

              <!-- 인증 확인 버튼 -->
              <button id="checkVerificationBtn" style="
                flex: 1;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06);
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
              " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 10px -3px rgba(0, 0, 0, 0.1), 0 3px 5px -2px rgba(0, 0, 0, 0.05)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px -1px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06)';">
                <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>인증 확인</span>
              </button>
            </div>

            <!-- 도움말 -->
            <p style="
              margin: 0;
              text-align: center;
              color: #9ca3af;
              font-size: 12px;
            ">
              💡 스팸 메일함도 확인해보세요
            </p>
          </div>
        </div>
      `;

      emailVerificationContainer.innerHTML = message;
      emailVerificationContainer.classList.remove('hidden');

      // 재발송 버튼 이벤트 리스너
      const resendBtn = this.shadowRoot.getElementById('resendEmailBtn');
      if (resendBtn) {
        resendBtn.addEventListener('click', () => this.resendVerificationEmail());
      }

      // 인증 확인 버튼 이벤트 리스너
      const checkBtn = this.shadowRoot.getElementById('checkVerificationBtn');
      if (checkBtn) {
        checkBtn.addEventListener('click', () => this.checkEmailVerification());
      }
    }

    /**
     * 인증 이메일 재발송
     * ✨ 현대적인 버튼 상태 애니메이션
     * ✨ Background script에서 Firebase sendEmailVerification 사용
     */
    async resendVerificationEmail() {
      console.log('[OverlayPanel] 인증 이메일 재발송 요청');

      const resendBtn = this.shadowRoot.getElementById('resendEmailBtn');
      if (!resendBtn) return;

      try {
        // 버튼 비활성화 - 로딩 상태
        resendBtn.disabled = true;
        resendBtn.innerHTML = `
          <svg style="width: 18px; height: 18px; animation: spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"/>
            <path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
          </svg>
          <span>발송 중...</span>
          <style>
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          </style>
        `;

        // Background script를 통해 Firebase sendEmailVerification 호출
        const response = await chrome.runtime.sendMessage({
          action: 'resendVerificationEmail'
        });

        if (response && response.success) {
          console.log('[OverlayPanel] 인증 이메일 재발송 성공');

          // 성공 상태
          resendBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
          resendBtn.innerHTML = `
            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span>발송 완료!</span>
          `;

          // 3초 후 원래 상태로 복구
          setTimeout(() => {
            resendBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)';
            resendBtn.innerHTML = `
              <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span>인증 이메일 재발송</span>
            `;
            resendBtn.disabled = false;
          }, 3000);
        } else {
          throw new Error(response?.error || '재발송에 실패했습니다');
        }
      } catch (error) {
        console.error('[OverlayPanel] 인증 이메일 재발송 실패:', error);

        // 실패 상태
        resendBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        resendBtn.innerHTML = `
          <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
          <span>재발송 실패</span>
        `;

        // 3초 후 원래 상태로 복구
        setTimeout(() => {
          resendBtn.style.background = 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)';
          resendBtn.innerHTML = `
            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
            <span>인증 이메일 재발송</span>
          `;
          resendBtn.disabled = false;
        }, 3000);
      }
    }

    /**
     * 이메일 인증 확인
     * ✨ Gena_Page의 user.reload() 패턴과 동일
     * ✨ 버튼 상태 애니메이션
     */
    async checkEmailVerification() {
      console.log('[OverlayPanel] 이메일 인증 상태 확인 요청');

      const checkBtn = this.shadowRoot.getElementById('checkVerificationBtn');
      if (!checkBtn) return;

      try {
        // 버튼 비활성화 - 로딩 상태
        checkBtn.disabled = true;
        checkBtn.innerHTML = `
          <svg style="width: 18px; height: 18px; animation: spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"/>
            <path d="M12 2a10 10 0 0110 10" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
          </svg>
          <span>확인 중...</span>
          <style>
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          </style>
        `;

        // Background script를 통해 이메일 인증 상태 새로고침
        const response = await chrome.runtime.sendMessage({
          action: 'refreshEmailVerificationStatus'
        });

        if (response && response.success) {
          console.log('[OverlayPanel] 이메일 인증 상태 확인 완료:', response.emailVerified);

          if (response.emailVerified) {
            // 인증 완료!
            this.emailVerified = true;

            // 성공 상태
            checkBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            checkBtn.innerHTML = `
              <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <span>인증 완료!</span>
            `;

            // 1초 후 UI 업데이트 (이메일 인증 컨테이너 숨기고 정상 UI 표시)
            setTimeout(() => {
              this.updateLoginUI();
            }, 1000);
          } else {
            // 아직 미인증
            checkBtn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
            checkBtn.innerHTML = `
              <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span>미인증</span>
            `;

            // 3초 후 원래 상태로 복구
            setTimeout(() => {
              checkBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
              checkBtn.innerHTML = `
                <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>인증 확인</span>
              `;
              checkBtn.disabled = false;
            }, 3000);
          }
        } else {
          throw new Error(response?.error || '인증 확인에 실패했습니다');
        }
      } catch (error) {
        console.error('[OverlayPanel] 이메일 인증 확인 실패:', error);

        // 실패 상태
        checkBtn.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
        checkBtn.innerHTML = `
          <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
          <span>확인 실패</span>
        `;

        // 3초 후 원래 상태로 복구
        setTimeout(() => {
          checkBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
          checkBtn.innerHTML = `
            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>인증 확인</span>
          `;
          checkBtn.disabled = false;
        }, 3000);
      }
    }

    /**
     * 로딩 진행 상태 초기화
     */
    resetLoadingProgress() {
      // 모든 단계 초기화
      for (let i = 1; i <= 3; i++) {
        const stepElement = this.shadowRoot.getElementById(`step${i}`);
        if (stepElement) {
          stepElement.classList.remove('active', 'completed');
        }
      }

      // 진행률 바 초기화
      const progressBar = this.shadowRoot.getElementById('progressBarFill');
      if (progressBar) {
        progressBar.style.width = '0%';
      }

      // 로딩 텍스트 초기화
      const loadingText = this.shadowRoot.getElementById('loadingText');
      if (loadingText) {
        loadingText.textContent = this.getMessage('analyzingPageLong');
      }
    }

    /**
     * 로딩 진행 상태 업데이트
     */
    updateLoadingProgress(step, percentage, message = null) {
      const progressBar = this.shadowRoot.getElementById('progressBarFill');
      const loadingText = this.shadowRoot.getElementById('loadingText');
      const stepElement = this.shadowRoot.getElementById(`step${step}`);

      // 진행률 바 업데이트
      if (progressBar) {
        progressBar.style.width = `${percentage}%`;
      }

      // 로딩 텍스트 업데이트
      if (loadingText && message) {
        loadingText.textContent = message;
      }

      // 현재 단계 활성화
      if (stepElement) {
        stepElement.classList.add('active');
      }
    }

    /**
     * 로딩 단계 완료 처리
     */
    completeLoadingStep(step) {
      const stepElement = this.shadowRoot.getElementById(`step${step}`);
      if (stepElement) {
        stepElement.classList.remove('active');
        stepElement.classList.add('completed');
      }
    }

    /**
     * 딜레이 헬퍼
     */
    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 성공 애니메이션 표시
     */
    async showSuccessAnimation() {
      const summaryResult = this.shadowRoot.getElementById('summaryResult');

      // 체크마크 생성
      const checkmark = document.createElement('div');
      checkmark.className = 'success-checkmark';
      checkmark.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
          <polyline class="checkmark-path" points="20 6 9 17 4 12"></polyline>
        </svg>
      `;

      // 임시로 요약 결과 영역에 추가
      summaryResult.insertBefore(checkmark, summaryResult.firstChild);
      summaryResult.classList.remove('hidden');

      // 애니메이션 후 제거
      await this.delay(1000);
      checkmark.remove();
    }

    /**
     * 요약 텍스트 포맷팅
     */
    formatSummaryText(text) {
      if (!text) return '';

      // HTML 이스케이프 (이모지는 유지)
      let formatted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // 마크다운 굵은 글씨 제거 (**텍스트** → 텍스트)
      formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1');

      // 형식 제목 제거 (예: **[형식 1] 기본 범용...**)
      formatted = formatted.replace(/\[형식 \d+\][^\n]*/g, '');

      // ✅ 마크다운 헤더 처리 (줄바꿈 변환 전)
      // ### 헤더 (h3)
      formatted = formatted.replace(
        /(^|\n)###\s*(.+?)(\n|$)/g,
        '$1<H3>$2</H3>$3'
      );

      // ## 헤더 (h2)
      formatted = formatted.replace(
        /(^|\n)##\s*(.+?)(\n|$)/g,
        '$1<H2>$2</H2>$3'
      );

      // # 헤더 (h1)
      formatted = formatted.replace(
        /(^|\n)#\s*(.+?)(\n|$)/g,
        '$1<H1>$2</H1>$3'
      );

      // ✅ 줄바꿈 변환 전에 이모지 헤더 먼저 처리
      // 섹션 헤더 스타일링 (이모지로 시작하는 줄)
      formatted = formatted.replace(
        /(^|\n)(📝|🔑|💡|🎯|🛠️|⚠️|📊|✅|❌|💰|📋|🔬|🏷️)\s*(.+?)(\n|$)/g,
        '$1<HEADER>$2 $3</HEADER>$4'
      );

      // 불릿 포인트 처리 (줄바꿈 변환 전)
      formatted = formatted.replace(
        /(^|\n)•\s*(.+?)(\n|$)/g,
        '$1<BULLET>$2</BULLET>$3'
      );

      // 번호 리스트 처리 (줄바꿈 변환 전)
      formatted = formatted.replace(
        /(^|\n)(\d+)\.\s*(.+?)(\n|$)/g,
        '$1<NUMBER data-num="$2">$3</NUMBER>$4'
      );

      // 줄바꿈을 <br>로 변환
      formatted = formatted.replace(/\n/g, '<br>');

      // 임시 태그를 실제 스타일로 변환
      // 마크다운 헤더 변환
      formatted = formatted.replace(
        /<H1>(.+?)<\/H1>/g,
        '<div style="margin-top: 24px; margin-bottom: 16px; font-weight: 800; font-size: 22px; color: #1a1a1a; border-bottom: 3px solid #667eea; padding-bottom: 8px;">$1</div>'
      );

      formatted = formatted.replace(
        /<H2>(.+?)<\/H2>/g,
        '<div style="margin-top: 20px; margin-bottom: 12px; font-weight: 700; font-size: 19px; color: #1a1a1a; border-bottom: 2px solid #a0aec0; padding-bottom: 6px;">$1</div>'
      );

      formatted = formatted.replace(
        /<H3>(.+?)<\/H3>/g,
        '<div style="margin-top: 18px; margin-bottom: 10px; font-weight: 700; font-size: 17px; color: #2d3748; padding-left: 8px; border-left: 4px solid #667eea;">$1</div>'
      );

      // 이모지 헤더 변환
      formatted = formatted.replace(
        /<HEADER>(.+?)<\/HEADER>/g,
        '<div style="margin-top: 16px; margin-bottom: 8px; font-weight: 700; font-size: 17px; color: #667eea;">$1</div>'
      );

      formatted = formatted.replace(
        /<BULLET>(.+?)<\/BULLET>/g,
        '<div style="display: flex; align-items: flex-start; margin-bottom: 8px; padding-left: 12px; font-size: 14px;"><span style="margin-right: 8px; flex-shrink: 0; color: #667eea; font-weight: 600;">•</span><span style="flex: 1; line-height: 1.6;">$1</span></div>'
      );

      formatted = formatted.replace(
        /<NUMBER data-num="(\d+)">(.+?)<\/NUMBER>/g,
        '<div style="display: flex; align-items: flex-start; margin-bottom: 8px; padding-left: 12px; font-size: 14px;"><span style="margin-right: 8px; flex-shrink: 0; color: #667eea; font-weight: 600; min-width: 20px;">$1.</span><span style="flex: 1; line-height: 1.6;">$2</span></div>'
      );

      // 별점 스타일링
      formatted = formatted.replace(
        /(⭐+)/g,
        '<span style="color: #ffc107; font-size: 16px;">$1</span>'
      );

      // 문단 번호 [1], [2] 등을 클릭 가능한 링크로 변환
      const linkCount = (formatted.match(/\[(\d+)\]/g) || []).length;
      console.log('[OverlayPanel] 문단 링크 발견:', linkCount, '개');

      formatted = formatted.replace(
        /\[(\d+)\]/g,
        '<a href="#" class="source-link" data-paragraph="$1" style="color: #667eea; text-decoration: none; font-weight: 600; margin-left: 4px; cursor: pointer; transition: all 0.2s;">[$1]</a>'
      );

      // 전체를 div로 감싸기 - 기본 폰트 크기 14px
      formatted = `<div style="line-height: 1.8; color: #1a1a1a; font-size: 14px;">${formatted}</div>`;

      console.log('[OverlayPanel] 포맷팅 완료, 링크 변환:', linkCount, '개');
      return formatted;
    }

    /**
     * 채팅 메시지 추가
     */
    addChatMessage(text, isUser = false) {
      const chatMessages = this.shadowRoot.getElementById('chatMessages');
      if (!chatMessages) return;

      const messageDiv = document.createElement('div');
      messageDiv.className = `chat-message ${isUser ? 'user' : 'ai'}`;

      const avatar = document.createElement('div');
      avatar.className = 'chat-message-avatar';

      if (isUser) {
        avatar.textContent = '👤';
      } else {
        // Gena 아이콘 사용
        const icon = document.createElement('img');
        icon.src = chrome.runtime.getURL('icons/icon48.png');
        icon.style.width = '100%';
        icon.style.height = '100%';
        icon.style.borderRadius = '50%';
        icon.alt = 'Gena';
        avatar.appendChild(icon);
      }

      const content = document.createElement('div');
      content.className = 'chat-message-content';

      const bubble = document.createElement('div');
      bubble.className = 'chat-message-bubble';
      bubble.innerHTML = isUser ? text : this.formatSummaryText(text);

      const time = document.createElement('div');
      time.className = 'chat-message-time';
      const now = new Date();
      time.textContent = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

      content.appendChild(bubble);
      content.appendChild(time);

      messageDiv.appendChild(avatar);
      messageDiv.appendChild(content);

      chatMessages.appendChild(messageDiv);

      // 스크롤을 맨 아래로
      chatMessages.scrollTop = chatMessages.scrollHeight;

      return messageDiv;
    }

    /**
     * 로딩 메시지 추가
     */
    addLoadingMessage() {
      const chatMessages = this.shadowRoot.getElementById('chatMessages');
      if (!chatMessages) return null;

      const messageDiv = document.createElement('div');
      messageDiv.className = 'chat-message ai loading';
      messageDiv.id = 'loadingMessage';

      const avatar = document.createElement('div');
      avatar.className = 'chat-message-avatar';

      // Gena 아이콘 사용
      const icon = document.createElement('img');
      icon.src = chrome.runtime.getURL('icons/icon48.png');
      icon.style.width = '100%';
      icon.style.height = '100%';
      icon.style.borderRadius = '50%';
      icon.alt = 'Gena';
      avatar.appendChild(icon);

      const content = document.createElement('div');
      content.className = 'chat-message-content';

      const bubble = document.createElement('div');
      bubble.className = 'chat-message-bubble';
      bubble.innerHTML = `
        <span>답변 생성 중</span>
        <div class="chat-loading-dots">
          <div class="chat-loading-dot"></div>
          <div class="chat-loading-dot"></div>
          <div class="chat-loading-dot"></div>
        </div>
      `;

      content.appendChild(bubble);
      messageDiv.appendChild(avatar);
      messageDiv.appendChild(content);

      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      return messageDiv;
    }

    /**
     * 질문하기
     */
    async askQuestion() {
      const questionInput = this.shadowRoot.getElementById('questionInput');
      const askBtn = this.shadowRoot.getElementById('askBtn');

      const question = questionInput.value.trim();
      if (!question) {
        console.warn('[OverlayPanel] 질문이 비어있습니다');
        return;
      }

      console.log('[OverlayPanel] 질문 처리 시작:', question);

      // 사용자 메시지 추가
      this.addChatMessage(question, true);

      // 입력 필드 초기화
      questionInput.value = '';

      // 버튼 비활성화
      askBtn.disabled = true;

      // 로딩 메시지 추가
      const loadingMessage = this.addLoadingMessage();

      try {
        // 콘텐츠 추출
        const extractResponse = await chrome.runtime.sendMessage({
          action: 'extractContent'
        });

        if (!extractResponse || !extractResponse.success) {
          throw new Error(extractResponse?.error || this.getMessage('contentExtractionFailed'));
        }

        // 질문 전송
        const answerResponse = await chrome.runtime.sendMessage({
          action: 'askQuestion',
          question: question,
          content: extractResponse.content,
          pageInfo: {
            title: document.title,
            url: window.location.href
          }
        });

        if (!answerResponse || !answerResponse.success) {
          throw new Error(answerResponse?.error || this.getMessage('answerGenerationFailed'));
        }

        console.log('[OverlayPanel] 답변 완료');

        // 로딩 메시지 제거
        if (loadingMessage) {
          loadingMessage.remove();
        }

        // AI 답변 메시지 추가
        this.addChatMessage(answerResponse.answer || this.getMessage('cannotGenerateAnswer'), false);

        // 사용량 업데이트
        this.checkUsage();

      } catch (error) {
        console.error('[OverlayPanel] 질문 처리 실패:', error);

        // 로딩 메시지 제거
        if (loadingMessage) {
          loadingMessage.remove();
        }

        // 오류 메시지 추가
        this.addChatMessage(`${this.getMessage('error')}: ${error.message}`, false);
      } finally {
        askBtn.disabled = false;
      }
    }

    /**
     * 문단으로 스크롤 및 하이라이트
     */
    scrollToParagraph(paragraphNum) {
      if (!this.paragraphs || this.paragraphs.length === 0) {
        console.warn('[OverlayPanel] 문단 정보가 없습니다');
        return;
      }

      const paragraphIndex = paragraphNum - 1;
      if (paragraphIndex < 0 || paragraphIndex >= this.paragraphs.length) {
        console.warn('[OverlayPanel] 유효하지 않은 문단 번호:', paragraphNum);
        return;
      }

      const targetParagraph = this.paragraphs[paragraphIndex];
      console.log('[OverlayPanel] 대상 문단:', targetParagraph.substring(0, 100) + '...');

      // ✨ PDF인 경우 PDF 뷰어에서 텍스트 검색 및 하이라이트
      if (this.isPDF) {
        this.highlightInPDF(paragraphNum, targetParagraph);
        return;
      }

      // 텍스트 정규화 함수
      const normalize = (text) => {
        return text
          .replace(/\s+/g, ' ')  // 모든 공백을 단일 공백으로
          .replace(/[^\w\s가-힣]/g, '') // 특수문자 제거 (한글, 영문, 숫자만)
          .trim()
          .toLowerCase();
      };

      // 의미 있는 텍스트 추출 (첫 20자 이상의 단어)
      const words = targetParagraph.split(/\s+/).filter(w => w.length > 1);
      const searchWords = words.slice(0, 5).join(' '); // 첫 5개 단어
      const normalizedSearch = normalize(searchWords);

      console.log('[OverlayPanel] 검색 키워드:', searchWords);

      // 모든 텍스트 노드 순회하여 찾기
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            // Shadow DOM 내부는 제외
            if (node.parentElement?.closest('#gena-overlay-host')) {
              return NodeFilter.FILTER_REJECT;
            }
            // 보이지 않는 요소 제외
            const parent = node.parentElement;
            if (parent && (parent.offsetParent === null ||
                window.getComputedStyle(parent).display === 'none' ||
                window.getComputedStyle(parent).visibility === 'hidden')) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        },
        false
      );

      let foundNode = null;
      let currentNode;
      let bestMatch = null;
      let bestMatchScore = 0;

      while (currentNode = walker.nextNode()) {
        const text = currentNode.textContent;
        const normalizedText = normalize(text);

        // 정확한 매칭 시도
        if (normalizedText.includes(normalizedSearch)) {
          foundNode = currentNode;
          console.log('[OverlayPanel] 정확한 매칭 발견');
          break;
        }

        // 부분 매칭 점수 계산
        let matchScore = 0;
        const searchWordsArr = normalizedSearch.split(' ');
        searchWordsArr.forEach(word => {
          if (word.length > 2 && normalizedText.includes(word)) {
            matchScore++;
          }
        });

        if (matchScore > bestMatchScore) {
          bestMatchScore = matchScore;
          bestMatch = currentNode;
        }
      }

      // 정확한 매칭을 찾지 못했으면 최선의 매칭 사용
      if (!foundNode && bestMatch && bestMatchScore >= 2) {
        foundNode = bestMatch;
        console.log('[OverlayPanel] 부분 매칭 사용 (점수:', bestMatchScore, ')');
      }

      if (foundNode) {
        // 부모 엘리먼트 찾기 (p, div, article 등)
        let element = foundNode.parentElement;
        while (element && element !== document.body) {
          const tagName = element.tagName.toLowerCase();
          if (['p', 'div', 'article', 'section', 'li', 'td'].includes(tagName)) {
            break;
          }
          element = element.parentElement;
        }

        if (!element) element = foundNode.parentElement;

        // 하이라이트 애니메이션
        const originalBg = element.style.backgroundColor;
        const originalTransition = element.style.transition;
        const originalBoxShadow = element.style.boxShadow;

        element.style.transition = 'all 0.3s ease';
        element.style.backgroundColor = '#fff3cd';
        element.style.boxShadow = '0 0 0 3px rgba(255, 193, 7, 0.3)';

        // 스크롤
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // 3초 후 하이라이트 제거
        setTimeout(() => {
          element.style.backgroundColor = originalBg;
          element.style.boxShadow = originalBoxShadow;
          setTimeout(() => {
            element.style.transition = originalTransition;
          }, 300);
        }, 3000);

        console.log('[OverlayPanel] 문단으로 스크롤 완료 ✅');
      } else {
        console.warn('[OverlayPanel] 페이지에서 문단을 찾을 수 없습니다');
        alert(this.getMessage('paragraphNotFound'));
      }
    }

    /**
     * PDF에서 출처 표시 (페이지 알림 방식)
     */
    async highlightInPDF(paragraphNum, paragraphText) {
      console.log('[OverlayPanel] PDF 출처 표시:', paragraphNum);

      // 위치 정보 확인
      if (!this.paragraphsWithPosition || this.paragraphsWithPosition.length === 0) {
        console.warn('[OverlayPanel] PDF 위치 정보가 없습니다');
        this.showToast(this.getMessage('locationInfoUnavailable'));
        return;
      }

      const paragraphIndex = paragraphNum - 1;
      const paragraphData = this.paragraphsWithPosition[paragraphIndex];

      if (!paragraphData || !paragraphData.page) {
        console.warn('[OverlayPanel] 문단 페이지 정보 없음:', paragraphNum);
        this.showToast(this.getMessage('pageInfoNotFound'));
        return;
      }

      try {
        console.log('[OverlayPanel] 📍 출처 위치:', {
          page: paragraphData.page,
          text: paragraphText.substring(0, 100)
        });

        // 오버레이를 최소화하여 PDF가 보이도록
        const wasMaximized = this.isMaximized;
        if (wasMaximized) {
          this.minimize();
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        // 페이지 번호와 함께 화면에 큰 알림 표시
        this.showPageIndicator(paragraphNum, paragraphData.page, paragraphText);

      } catch (error) {
        console.error('[OverlayPanel] PDF 출처 표시 오류:', error);
        this.showToast(this.getMessage('sourceDisplayFailed'));
      }
    }

    /**
     * PDF 페이지 안내 표시
     */
    showPageIndicator(sourceNum, pageNum, text) {
      // 기존 인디케이터 제거
      const existing = document.querySelector('.gena-page-indicator');
      if (existing) existing.remove();

      // 인디케이터 생성
      const indicator = document.createElement('div');
      indicator.className = 'gena-page-indicator';
      indicator.innerHTML = `
        <div class="page-indicator-content">
          <div class="page-indicator-header">
            <span class="page-indicator-icon">📄</span>
            <span class="page-indicator-title">${this.getMessage('sourceNumber', { num: sourceNum })}</span>
            <button class="page-indicator-close">✕</button>
          </div>
          <div class="page-indicator-page">
            ${this.getMessage('pageNumber', { num: pageNum })}
          </div>
          <div class="page-indicator-text">
            "${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"
          </div>
        </div>
      `;

      // 스타일 적용
      indicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 0;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        z-index: 2147483647;
        min-width: 400px;
        max-width: 600px;
        animation: pageIndicatorSlideIn 0.3s ease-out;
      `;

      document.body.appendChild(indicator);

      // 닫기 버튼 이벤트
      const closeBtn = indicator.querySelector('.page-indicator-close');
      closeBtn.addEventListener('click', () => {
        indicator.style.animation = 'pageIndicatorSlideOut 0.3s ease-in';
        setTimeout(() => indicator.remove(), 300);
      });

      // 5초 후 자동 제거
      setTimeout(() => {
        if (document.body.contains(indicator)) {
          indicator.style.animation = 'pageIndicatorSlideOut 0.3s ease-in';
          setTimeout(() => indicator.remove(), 300);
        }
      }, 5000);

      console.log('[OverlayPanel] ✅ 페이지 안내 표시 완료');
    }

    /**
     * PDF 하이라이트 오버레이 생성
     */
    createPDFHighlightOverlay(paragraphData, pdfEmbed) {
      // 기존 하이라이트 제거
      const existingHighlights = document.querySelectorAll('.gena-pdf-highlight');
      existingHighlights.forEach(h => h.remove());

      const position = paragraphData.positions[0]; // 첫 번째 위치 사용
      const pdfRect = pdfEmbed.getBoundingClientRect();

      console.log('[OverlayPanel] 🔍 위치 계산 디버그:', {
        position: position,
        pdfRect: {
          left: pdfRect.left,
          top: pdfRect.top,
          width: pdfRect.width,
          height: pdfRect.height
        }
      });

      // PDF 뷰어 크기 가져오기
      const viewerWidth = pdfRect.width;
      const viewerHeight = pdfRect.height;

      // PDF 원본 크기 대비 뷰어 크기 비율 계산
      const scaleX = viewerWidth / position.pageWidth;
      const scaleY = viewerHeight / position.pageHeight;

      console.log('[OverlayPanel] 🔍 스케일:', { scaleX, scaleY });

      // 좌표 변환 (PDF 좌표계 → 브라우저 좌표계)
      const highlightX = pdfRect.left + (position.x * scaleX);
      const highlightY = pdfRect.top + (position.y * scaleY); // PDF 좌표는 상단 기준

      console.log('[OverlayPanel] 🔍 최종 좌표:', {
        highlightX,
        highlightY,
        width: position.width * scaleX,
        height: position.height * scaleY
      });

      // 하이라이트 div 생성
      const highlight = document.createElement('div');
      highlight.className = 'gena-pdf-highlight';

      // ✨ 최소 크기 보장 (너무 작으면 안보임)
      const minWidth = 100;
      const minHeight = 20;
      const finalWidth = Math.max(position.width * scaleX, minWidth);
      const finalHeight = Math.max(position.height * scaleY, minHeight);

      highlight.style.cssText = `
        position: fixed;
        left: ${highlightX}px;
        top: ${highlightY}px;
        width: ${finalWidth}px;
        height: ${finalHeight}px;
        background: rgba(255, 235, 59, 0.6);
        border: 3px solid rgba(255, 193, 7, 1);
        pointer-events: none;
        z-index: 2147483646;
        animation: pdfHighlightPulse 0.5s ease-in-out 3;
        box-shadow: 0 0 20px rgba(255, 193, 7, 0.8);
        border-radius: 4px;
      `;

      console.log('[OverlayPanel] 🔍 하이라이트 스타일:', {
        left: highlightX,
        top: highlightY,
        width: finalWidth,
        height: finalHeight
      });

      document.body.appendChild(highlight);

      // 해당 위치로 스크롤
      window.scrollTo({
        top: highlightY - window.innerHeight / 2,
        behavior: 'smooth'
      });

      // 5초 후 하이라이트 제거
      setTimeout(() => {
        highlight.style.opacity = '0';
        highlight.style.transition = 'opacity 0.5s';
        setTimeout(() => highlight.remove(), 500);
      }, 5000);

      console.log('[OverlayPanel] ✅ 하이라이트 오버레이 생성 완료');
    }

    /**
     * 요약 복사
     */
    copySummary() {
      const summaryText = this.shadowRoot.getElementById('summaryText').textContent;

      navigator.clipboard.writeText(summaryText).then(() => {
        console.log('[OverlayPanel] 복사 완료');
        this.showToast(this.getMessage('overlayCopied'));
      }).catch(err => {
        console.error('[OverlayPanel] 복사 실패:', err);
      });
    }

    /**
     * Toast 메시지 표시
     */
    showToast(message) {
      // Toast는 Shadow DOM 밖에 표시 (body에 직접 추가)
      const toast = document.createElement('div');
      toast.className = 'gena-overlay-toast';
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '1';
      }, 10);

      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    }
  }
} // ✨ if (!window.OverlayPanelManager) 종료

// 전역 인스턴스 - 중복 생성 방지
if (!window.genaOverlayManager) {
  window.genaOverlayManager = new window.OverlayPanelManager();
  console.log('[OverlayPanel] OverlayPanelManager 인스턴스 생성 완료');
} else {
  console.log('[OverlayPanel] ⚠️ 인스턴스 이미 존재 - 재사용');
}

// 메시지 리스너 제거 - content.js에서 이미 처리함 (중복 방지)

console.log('[OverlayPanel] 스크립트 로드 완료 ✅');
console.log('[OverlayPanel] window.genaOverlayManager:', window.genaOverlayManager);
