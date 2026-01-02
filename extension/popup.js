/**
 * extension\popup.js
 * Gena Popup Main Script
 * 요약 버튼 클릭 시 Side Panel로 리다이렉트
 *
 * ✨ v5.1.3 Hotfix:
 * - 로그인 화면 아이콘 깨짐 수정 (Font -> SVG 교체)
 * - 레이아웃 강제 고정 유지
 *
 * @version 5.1.3
 */

class AppController {
  constructor() {
    this.currentPageContent = '';
    this.currentPageInfo = {
      title: '',
      url: '',
      domain: '',
      isPDF: false,
    };
    this.currentUser = null;
    this.usage = {
      daily: 0,
      limit: 5,
    };
    this.isPremium = false;
    this.initialized = false;
    this.usageLoaded = false;

    // ✨ Rate Limit Countdown
    this.rateLimitCountdown = null;
    this.rateLimitTimer = null;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      console.log('[Popup] 초기화 시작');

      // ✅ [Hotfix] JS 초기화 시작 시점에 강제로 너비 고정
      document.documentElement.style.width = '320px';
      document.body.style.width = '320px';
      document.documentElement.style.height = '360px';
      document.body.style.height = '360px';

      // ✨ 제한된 페이지 확인 (최우선)
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && window.isRestrictedPage && window.isRestrictedPage(tab.url)) {
        console.log('[Popup] 제한된 페이지 감지 - 경고만 표시:', tab.url);
        await window.languageManager.initialize();
        this.showRestrictedPageWarning(tab.url);
        document.body.classList.add('loaded');
        this.initialized = true;
        return;
      }

      // ✅ 제한된 페이지가 아니면 popup을 닫음 (overlay로 전환)
      console.log('[Popup] 일반 페이지 - popup 닫기');
      window.close();
      return;

      const isAuthenticated = await this.checkAuthStatusDirect();

      if (!isAuthenticated) {
        console.log('[Auth] 로그인 필요 - 안내 화면 표시');
        this.showLoginRequiredScreen();
        
        // ✅ 로그인 화면도 페이드인
        document.body.classList.add('loaded');
        return;
      }

      await window.languageManager.initialize();
      await window.settingsManager.initialize();

      this.updateUITexts();
      await this.loadCurrentTab();

      // ✅ 사용량 조회 전에 먼저 캐시된 데이터나 storage 확인
      await this.loadUsageFromStorage();

      // ✅ 이벤트 리스너 먼저 설정 (storage 변경 감지)
      this.setupEventListeners();
      this.setupStorageListener();

      // ✅ 서버에서 최신 사용량 조회 (백그라운드)
      this.checkUsage();

      window.languageManager.applyLanguageFont();
      this.displayUserInfo();

      this.initialized = true;
      console.log('[Popup] 초기화 완료');
      
      // ✅ 깜빡임 방지: 초기화 완료 후 페이드인
      document.body.classList.add('loaded');
      
    } catch (error) {
      console.error('[Popup] 초기화 오류:', error);
      window.errorHandler.handle(error, 'popup-initialization');
      this.showError('initializationError');
      
      // ✅ 에러 발생 시에도 페이지 표시
      document.body.classList.add('loaded');
    }
  }

  /**
   * ✅ storage에서 캐시된 사용량 먼저 로드 (깜빡임 방지)
   */
  async loadUsageFromStorage() {
    try {
      const result = await chrome.storage.local.get(['usageData']);

      if (result.usageData) {
        console.log('[Popup] Storage에서 캐시된 사용량 로드:', result.usageData);

        this.usage.daily = result.usageData.isPremium
          ? 0
          : result.usageData.dailyUsed || 0;
        this.usage.limit = result.usageData.isPremium
          ? Infinity
          : result.usageData.dailyLimit || 3;

        this.isPremium = result.usageData.isPremium || false;

        // ✅ 즉시 UI 업데이트
        this.updateUsageDisplay();
        this.usageLoaded = true;
      } else {
        console.log('[Popup] Storage에 캐시된 사용량 없음 - 서버 조회 대기');
      }
    } catch (error) {
      console.error('[Popup] Storage 로드 오류:', error);
    }
  }

  /**
   * ✅ storage 변경 감지 리스너 (실시간 업데이트)
   */
  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.usageData) {
        console.log('[Popup] Storage 변경 감지 - 사용량 업데이트');

        const newUsageData = changes.usageData.newValue;

        if (newUsageData) {
          this.usage.daily = newUsageData.isPremium
            ? 0
            : newUsageData.dailyUsed || 0;
          this.usage.limit = newUsageData.isPremium
            ? Infinity
            : newUsageData.dailyLimit || 3;

          this.isPremium = newUsageData.isPremium || false;

          // ✅ UI 즉시 업데이트
          this.updateUsageDisplay();
        }
      }
    });

    console.log('[Popup] Storage 리스너 설정 완료');
  }

  showLoginRequiredScreen() {
    // ✅ [Hotfix] 아이콘 폰트 로딩 실패 대비 SVG 직접 주입
    document.body.innerHTML = `
      <div style="
        width: 380px !important;
        min-width: 380px !important;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
        font-family: 'Inter', sans-serif;
        height: 100vh;
        box-sizing: border-box;
        overflow: hidden;
      ">
        <div style="
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          flex-shrink: 0;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="white">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        </div>
        
        <h2 style="
          color: #212121;
          margin-bottom: 12px;
          font-size: 20px;
          font-weight: 600;
          white-space: nowrap;
        ">${chrome.i18n.getMessage('loginRequired')}</h2>

        <p style="
          color: #757575;
          margin-bottom: 32px;
          line-height: 1.6;
          font-size: 14px;
          white-space: nowrap;
        ">
          ${chrome.i18n.getMessage('loginRequiredDesc')}
        </p>

        <button id="loginBtn" style="
          width: 100%;
          max-width: 280px;
          background: #2196F3;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 32px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 16px;
        " onmouseover="this.style.background='#1976D2'" onmouseout="this.style.background='#2196F3'">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"/>
          </svg>
          ${chrome.i18n.getMessage('loginButton')}
        </button>

        <button id="signupBtn" style="
          width: 100%;
          max-width: 280px;
          background: transparent;
          color: #2196F3;
          border: 2px solid #2196F3;
          border-radius: 8px;
          padding: 10px 32px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        " onmouseover="this.style.background='#E3F2FD'" onmouseout="this.style.background='transparent'">
          ${chrome.i18n.getMessage('signupPrompt')}
        </button>
      </div>
    `;

    document.getElementById('loginBtn').addEventListener('click', () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL('auth.html'),
      });
      window.close();
    });

    document.getElementById('signupBtn').addEventListener('click', () => {
      // 사용자 언어 감지 - 한국어가 아니면 영어로 표시
      const userLang = chrome.i18n.getUILanguage().split('-')[0]; // 'ko', 'en', 'ja' etc.
      const signupUrl = userLang === 'ko'
        ? 'https://www.genaai.net/signup'
        : 'https://www.genaai.net/signup?lang=en';

      chrome.tabs.create({ url: signupUrl });
      window.close();
    });
  }

  async checkAuthStatusDirect() {
    try {
      console.log('[Auth] 직접 storage에서 토큰 확인');

      const result = await chrome.storage.local.get('tokens');

      if (!result.tokens || !result.tokens.accessToken) {
        console.log('[Auth] 토큰 없음');
        return false;
      }

      const token = result.tokens.accessToken;
      const parts = token.split('.');

      if (parts.length !== 3) {
        console.warn('[Auth] 잘못된 토큰 형식');
        return false;
      }

      try {
        const payload = JSON.parse(
          atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        );
        const exp = payload.exp * 1000;
        const now = Date.now();

        if (exp <= now) {
          console.warn('[Auth] 토큰 만료됨');
          return false;
        }

        console.log('[Auth] 토큰 유효함 - 서버에서 사용자 정보 조회');

        const API_BASE_URL = 'http://localhost:3000';

        try {
          const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();

            this.currentUser = {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              isPremium: data.user.isPremium,
            };

            this.isPremium = data.user.isPremium;

            console.log('[Auth] 프리미엄 상태:', this.isPremium);
            return true;
          } else {
            console.warn('[Auth] 사용자 정보 조회 실패:', response.status);
          }
        } catch (apiError) {
          console.error('[Auth] API 호출 오류:', apiError);
        }

        console.log('[Auth] 폴백: 토큰에서 기본 정보 사용');
        this.currentUser = {
          id: payload.sub || payload.userId,
          email: payload.email,
          name: payload.name,
          isPremium: false,
        };

        this.isPremium = false;
        return true;
      } catch (decodeError) {
        console.error('[Auth] 토큰 디코딩 실패:', decodeError);
        return false;
      }
    } catch (error) {
      console.error('[Auth] 토큰 체크 오류:', error);
      return false;
    }
  }

  displayUserInfo() {
    if (!this.currentUser) return;

    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement && this.currentUser.email) {
      userEmailElement.textContent = this.currentUser.email;
    }

    const userNameElement = document.getElementById('userName');
    if (userNameElement && this.currentUser.name) {
      userNameElement.textContent = this.currentUser.name;
    }
  }

  updateUITexts() {
    const summarizeBtn = document.getElementById('summarizeBtn');
    if (summarizeBtn) {
      const buttonText = summarizeBtn.querySelector(
        'span[data-i18n="summarizeButton"]'
      );
      if (buttonText) {
        buttonText.textContent =
          window.languageManager.getMessage('summarizeButton');
      }
    }

    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
      const analyzingMessages = [
        '현재 페이지를 분석 중...',
        'Analyzing current page...',
        '現在のページを分析中...',
        '正在分析当前页面...',
      ];

      if (analyzingMessages.includes(pageTitle.textContent)) {
        pageTitle.textContent =
          window.languageManager.getMessage('analyzingPage');
      }
    }

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      const message = window.languageManager.getMessage(key);

      if (message && message !== key) {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          element.placeholder = message;
        } else {
          element.textContent = message;
        }
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
      const key = element.getAttribute('data-i18n-title');
      const message = window.languageManager.getMessage(key);

      if (message && message !== key) {
        element.title = message;
      }
    });
  }

  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.url) {
        throw new Error(window.languageManager.getMessage('errorExtractContent'));
      }

      const isPDF = window.isPDFUrl ? window.isPDFUrl(tab.url) : false;

      this.currentPageInfo = {
        title: tab.title || window.languageManager.getMessage('noTitle'),
        url: tab.url,
        domain: new URL(tab.url).hostname,
        isPDF: isPDF,
      };

      window.uiManager.displayPageInfo(this.currentPageInfo);

      if (isPDF) {
        console.log('[Popup] PDF 페이지 감지:', tab.url);
        this.handlePDFPage();
        return;
      }

      if (window.isRestrictedPage(tab.url)) {
        window.uiManager.disablePage();
        this.showRestrictedPageWarning(tab.url);
      }
    } catch (error) {
      console.error('[Popup] 탭 정보 로드 오류:', error);
      window.errorHandler.handle(error, 'load-current-tab');
      this.showError('errorExtractContent');
    }
  }

  showRestrictedPageWarning(url) {
    console.log('[Popup] 제한된 페이지 감지:', url);

    // ✨ Update warning title and message with i18n
    const warningTitle = document.getElementById('warningTitle');
    const warningMessage = document.getElementById('warningMessage');

    let pageType = chrome.i18n.getMessage('restrictedPageTitle');
    let description = chrome.i18n.getMessage('restrictedPageMessage');

    if (url.startsWith('chrome://')) {
      pageType = chrome.i18n.getMessage('chromeInternalPage');
      description = chrome.i18n.getMessage('chromeInternalPageDesc');
    } else if (url.startsWith('chrome-extension://')) {
      pageType = chrome.i18n.getMessage('extensionPage');
      description = chrome.i18n.getMessage('extensionPageDesc');
    } else if (url.startsWith('edge://')) {
      pageType = chrome.i18n.getMessage('edgePage');
      description = chrome.i18n.getMessage('edgePageDesc');
    } else if (url.includes('chrome.google.com/webstore') || url.includes('microsoftedge.microsoft.com/addons')) {
      pageType = chrome.i18n.getMessage('webStorePage');
      description = chrome.i18n.getMessage('webStorePageDesc');
    }

    if (warningTitle) warningTitle.textContent = pageType;
    if (warningMessage) warningMessage.textContent = description;

    const summarizeBtn = document.getElementById('summarizeBtn');
    if (summarizeBtn) {
      summarizeBtn.disabled = true;
      const buttonText = summarizeBtn.querySelector('span[data-i18n]');
      if (buttonText) {
        buttonText.textContent = chrome.i18n.getMessage('summaryUnavailable');
      }
    }

    const infoMessage = document.querySelector('.info-message');
    if (infoMessage) {
      infoMessage.innerHTML = `
        <span class="material-icons">block</span>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-weight: 600;">${pageType}</span>
          <span style="font-size: 12px; opacity: 0.9;">${description}</span>
        </div>
      `;
      infoMessage.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
      infoMessage.style.color = 'white';
      infoMessage.style.display = 'flex';
      infoMessage.style.gap = '12px';
      infoMessage.style.alignItems = 'center';
    }

    // Toast 제거 - 팝업만 표시
  }

  handlePDFPage() {
    const summarizeBtn = document.getElementById('summarizeBtn');

    if (!this.isPremium) {
      console.log('[Popup] PDF 요약 차단 - 무료 사용자');

      if (summarizeBtn) {
        summarizeBtn.disabled = false;
        const buttonIcon = summarizeBtn.querySelector('.btn-icon');
        const buttonText = summarizeBtn.querySelector('span[data-i18n]');

        if (buttonIcon) {
          buttonIcon.innerHTML = `
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            <path d="M9 12l2 2 4-4"/>
          `;
        }

        if (buttonText) {
          buttonText.textContent = chrome.i18n.getMessage('pdfSummaryPremium');
        }
      }

      const infoMessage = document.querySelector('.info-message');
      if (infoMessage) {
        infoMessage.innerHTML = `
          <span class="material-icons">info</span>
          <span>${chrome.i18n.getMessage('pdfPremiumOnly')}</span>
        `;
        infoMessage.style.background =
          'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        infoMessage.style.color = 'white';
      }
    } else {
      console.log('[Popup] PDF 요약 허용 - 프리미엄 사용자');

      if (summarizeBtn) {
        summarizeBtn.disabled = false;
        const buttonText = summarizeBtn.querySelector('span[data-i18n]');
        if (buttonText) {
          buttonText.textContent = chrome.i18n.getMessage('pdfSummarize');
        }
      }
    }
  }

  async summarizePage() {
    try {
      console.log('[Popup] 요약 버튼 클릭 - Overlay Panel 열기');

      if (this.currentPageInfo.isPDF && !this.isPremium) {
        console.log('[Popup] PDF 요약 차단 - 업그레이드 모달 표시');
        this.showPDFUpgradeModal();
        return;
      }

      await chrome.storage.local.set({
        autoSummarize: true,
        summaryLength: this.currentPageInfo.isPDF ? 'detailed' : window.settingsManager.getSummaryLength(),
      });

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // ✨ 오버레이 패널 열기 (Background를 통해)
      try {
        console.log('[Popup] Background에 오버레이 토글 요청');
        console.log('[Popup] 대상 탭 ID:', tab.id);
        console.log('[Popup] 페이지 URL:', tab.url);

        const response = await chrome.runtime.sendMessage({
          action: 'toggleOverlay',
          tabId: tab.id
        });

        console.log('[Popup] 응답 받음:', response);

        if (response && response.success) {
          console.log('[Popup] 오버레이 열기 성공 ✅');
          // 성공 시에만 팝업 닫기
          window.close();
        } else {
          console.error('[Popup] 오버레이 토글 실패 - 응답:', response);
          throw new Error(response?.error || '오버레이 토글 실패');
        }
      } catch (error) {
        console.error('[Popup] 오버레이 열기 실패:', error);
        console.error('[Popup] 오류 상세:', error.message, error.stack);

        // 🚫 임시로 폴백 비활성화 (디버깅 목적)
        // TODO: 디버깅 완료 후 폴백 복원
        alert(chrome.i18n.getMessage('overlayOpenFailed') + error.message + chrome.i18n.getMessage('checkConsole'));

        // 오류 발생 시 팝업을 닫지 않음 (사용자가 오류를 볼 수 있도록)
        return;

        /* 폴백: 오버레이가 실패하면 Side Panel 열기
        if (chrome.sidePanel && chrome.sidePanel.open) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        } else {
          chrome.tabs.create({
            url: chrome.runtime.getURL('sidepanel.html'),
          });
        }
        */
      }
    } catch (error) {
      console.error('[Popup] 요약 실행 오류:', error);
      window.errorHandler.handle(error, 'open-overlay-for-summary');
      this.showError('errorSummarize');
    }
  }

  showPDFUpgradeModal() {
    const existingModal = document.getElementById('pdfUpgradeModal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'pdfUpgradeModal';
    modal.className = 'modal';

    modal.innerHTML = `
      <div class="modal-content upgrade-modal" style="max-width: 420px;">
        <div class="modal-header">
          <h2>${chrome.i18n.getMessage('pdfFeatureTitle')}</h2>
          <button class="icon-btn close-modal">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="modal-body" style="text-align: center; padding: 32px 24px;">
          <div class="upgrade-icon" style="margin-bottom: 24px;">
            <span class="material-icons" style="font-size: 64px; color: #667eea;">picture_as_pdf</span>
          </div>
          <h3 style="margin-bottom: 16px; font-size: 20px; color: #212121;">${chrome.i18n.getMessage('pdfPremiumOnly')}</h3>
          <p class="upgrade-description" style="margin-bottom: 24px; color: #757575; line-height: 1.6;">
            ${chrome.i18n.getMessage('pdfUpgradeDescription').replace('\\n', '<br>')}
          </p>
          <div class="premium-benefits" style="text-align: left; margin-bottom: 24px; padding: 20px; background: #f5f5f5; border-radius: 12px;">
            <h4 style="margin-bottom: 12px; font-size: 16px; color: #212121;">${chrome.i18n.getMessage('premiumBenefits')}</h4>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span class="material-icons" style="color: #4CAF50; font-size: 20px;">check_circle</span>
                <span style="color: #616161;">${chrome.i18n.getMessage('benefitUnlimitedPDF')}</span>
              </li>
              <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span class="material-icons" style="color: #4CAF50; font-size: 20px;">check_circle</span>
                <span style="color: #616161;">${chrome.i18n.getMessage('benefitUnlimitedWeb')}</span>
              </li>
              <li style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span class="material-icons" style="color: #4CAF50; font-size: 20px;">check_circle</span>
                <span style="color: #616161;">${chrome.i18n.getMessage('benefitUnlimitedQuestions')}</span>
              </li>
              <li style="display: flex; align-items: center; gap: 8px;">
                <span class="material-icons" style="color: #4CAF50; font-size: 20px;">check_circle</span>
                <span style="color: #616161;">${chrome.i18n.getMessage('benefitPrioritySupport')}</span>
              </li>
            </ul>
          </div>
          <div class="upgrade-price" style="margin-bottom: 24px;">
            <span class="price" style="font-size: 32px; font-weight: 700; color: #2196F3;">$4.99</span>
            <span class="period" style="color: #757575;">${chrome.i18n.getMessage('pricePerMonth')}</span>
          </div>
        </div>
        <div class="modal-footer" style="display: flex; gap: 12px; padding: 16px 24px;">
          <button class="secondary-btn close-modal" style="flex: 1; padding: 12px; border: 1px solid #e0e0e0; background: white; border-radius: 8px; cursor: pointer; font-weight: 500; color: #616161;">
            ${chrome.i18n.getMessage('buttonLater')}
          </button>
          <button class="primary-btn upgrade-btn" style="flex: 1; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span class="material-icons" style="font-size: 20px;">workspace_premium</span>
            ${chrome.i18n.getMessage('buttonUpgrade')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        modal.remove();
      });
    });

    const upgradeBtn = modal.querySelector('.upgrade-btn');
    upgradeBtn.addEventListener('click', () => {
      chrome.tabs.create({
        url: 'https://genaai.net/premium',
      });
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  showToast(messageKey) {
    const message = window.languageManager.getMessage(messageKey);
    if (message && message !== messageKey) {
      window.uiManager.showToast(message);
    } else {
      window.uiManager.showToast(messageKey);
    }
  }

  showError(messageKey) {
    const message = window.languageManager.getMessage(messageKey);
    if (message && message !== messageKey) {
      window.uiManager.showError(message);
    } else {
      window.uiManager.showError(messageKey);
    }
  }

  async checkUsage() {
    try {
      if (!window.usageManager) {
        console.warn('[Popup] usageManager 미로드 - 기본값 사용');
        this.usage.daily = 0;
        this.usage.limit = 5;
        this.updateUsageDisplay();
        return;
      }

      console.log('[Popup] 서버에서 사용량 조회 시작...');
      const usageStatus = await window.usageManager.getUsageStatus();

      console.log('[Popup] 사용량 조회 응답:', usageStatus);

      this.usage.daily = usageStatus.isPremium ? 0 : usageStatus.dailyUsed;
      this.usage.limit = usageStatus.isPremium ? Infinity : usageStatus.dailyLimit;
      this.isPremium = usageStatus.isPremium;

      // ✅ 서버 조회 후 최종 업데이트
      this.updateUsageDisplay();
      this.usageLoaded = true;

      console.log('[Popup] 사용량 조회 완료:', {
        isPremium: usageStatus.isPremium,
        used: this.usage.daily,
        limit: this.usage.limit,
      });
    } catch (error) {
      console.error('[Popup] 사용량 확인 오류:', error);
      window.errorHandler.handle(error, 'check-usage');

      // ✅ 오류 발생 시 기본값으로 폴백 (깜빡임 없이)
      if (!this.usageLoaded) {
        this.usage.daily = 0;
        this.usage.limit = 3;
        this.updateUsageDisplay();
      }
    }
  }

  /**
   * ✅ 사용량 표시 업데이트 (깜빡임 제거)
   * - 프리미엄: 즉시 "✨ 무제한" 표시
   * - 무료: 정확한 "오늘 X회/Y회" 표시
   * - 플레이스홀더나 중간 상태 절대 표시 안 함
   */
  updateUsageDisplay() {
    const usageText = document.getElementById('usageText');
    if (!usageText) {
      console.warn('[Popup] usageText 요소를 찾을 수 없습니다');
      return;
    }

    // ✅ 프리미엄 우선 체크
    if (this.isPremium) {
      const currentLang = window.languageManager?.getCurrentLanguage() || 'ko';

      let unlimitedText;
      switch (currentLang) {
        case 'en':
          unlimitedText = 'Unlimited';
          break;
        case 'ja':
          unlimitedText = '無制限';
          break;
        case 'zh':
          unlimitedText = '无限';
          break;
        case 'ko':
        default:
          unlimitedText = '무제한';
          break;
      }

      usageText.textContent = `✨ ${unlimitedText}`;
      usageText.style.color = '#4CAF50';
      usageText.style.opacity = '1';
      console.log('[Popup] 프리미엄 사용자 - 표시:', usageText.textContent);
      return;
    }

    // ✅ 무료 사용자: 정확한 사용량 표시
    const usedCount = this.usage.daily || 0;
    const totalLimit = this.usage.limit || 3;

    const currentLang = window.languageManager?.getCurrentLanguage() || 'ko';

    let message;
    switch (currentLang) {
      case 'en':
        message = `Today: ${usedCount}/${totalLimit}`;
        break;
      case 'ja':
        message = `今日: ${usedCount}/${totalLimit}`;
        break;
      case 'zh':
        message = `今日: ${usedCount}/${totalLimit}`;
        break;
      case 'ko':
      default:
        message = `오늘 ${usedCount}회/${totalLimit}회`;
        break;
    }

    usageText.textContent = message;
    usageText.style.color = '';
    usageText.style.opacity = '1';
    console.log('[Popup] 무료 사용자 - 표시:', message);

    // ✅ 버튼 활성화/비활성화
    const summarizeBtn = document.getElementById('summarizeBtn');
    if (summarizeBtn) {
      if (usedCount >= totalLimit) {
        summarizeBtn.disabled = true;
        const buttonText = summarizeBtn.querySelector(
          'span[data-i18n="summarizeButton"]'
        );
        if (buttonText) {
          buttonText.textContent =
            window.languageManager.getMessage('dailyLimitExceeded');
        }
        console.log('[Popup] 버튼 비활성화 - 사용 한도 초과');
      } else {
        summarizeBtn.disabled = false;
        const buttonText = summarizeBtn.querySelector(
          'span[data-i18n="summarizeButton"]'
        );
        if (buttonText) {
          buttonText.textContent =
            window.languageManager.getMessage('summarizeButton');
        }
        console.log('[Popup] 버튼 활성화');
      }
    }
  }

  setupEventListeners() {
    const elements = window.uiManager.elements;

    if (elements.summarizeBtn) {
      elements.summarizeBtn.addEventListener('click', () => this.summarizePage());
    }

    if (elements.settingsBtn) {
      elements.settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }
  }

  async logout() {
    try {
      console.log('[Auth] 로그아웃 시작');

      await chrome.storage.local.remove('tokens');

      chrome.tabs.create({
        url: chrome.runtime.getURL('auth.html'),
      });

      window.close();
    } catch (error) {
      console.error('[Auth] 로그아웃 오류:', error);
      window.errorHandler.handle(error, 'logout');
      this.showToast('logoutFailed');
    }
  }

  cleanup() {
    this.initialized = false;
    console.log('[Popup] cleanup 완료');
  }
}

// 앱 컨트롤러 인스턴스 생성
const app = new AppController();

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
  app.initialize().catch((error) => {
    console.error('[Popup] 앱 초기화 실패:', error);
    window.errorHandler.handle(error, 'app-initialization');
  });
});

// 창 닫기 전 정리
window.addEventListener('beforeunload', () => {
  app.cleanup();
});