/**
 * extension\sidepanel.js
 * Gena Side Panel Main Script
 * popup.js 기반으로 Side Panel 전용 기능 추가
 *
 * ✨ v7.0.0 업데이트:
 * - PDF 타임아웃 180초로 통일
 * - Service Worker Keep-Alive 구현 (15초 주기)
 * - PDF 진행 상황 실시간 UI 업데이트
 * - 페이드인 효과로 깜빡임 방지
 * - Side Panel 상태 저장 기능 추가 (v7.1.0)
 *
 * @version 7.1.0
 */

class SidePanelController {
  constructor() {
    this.currentPageContent = '';
    this.currentPageInfo = {
      title: '',
      url: '',
      domain: '',
    };
    this.currentSummary = '';
    this.currentHistoryId = null;
    this.currentUser = null;
    this.usage = {
      daily: 0,
      limit: 5,
    };
    this.isPremium = false;
    this.settingsUnsubscribe = null;
    this.initialized = false;

    // 실시간 사용량 업데이트 리스너
    this.storageChangeListener = null;
    this.visibilityChangeListener = null;
    this.focusListener = null;
    this.usagePollingInterval = null;

    // Side Panel 전용: 활성 탭 추적
    this.currentTabId = null;

    // ✨ Service Worker Keep-Alive
    this.keepAliveInterval = null;
    this.progressListener = null;

    // ✨ Rate Limit Countdown
    this.rateLimitCountdown = null;
    this.rateLimitTimer = null;

    // ✨ PDF Progress Tracking (for time estimation)
    this.pdfStartTime = null;
    this.pdfLastProgress = 0;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      console.log('[SidePanel] 초기화 시작');

      // Background 없이 직접 토큰 체크
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
      await window.historyManager.initialize();

      // ✨ SettingsManager의 language 설정을 I18nManager에 동기화
      const settings = window.settingsManager.getSettings();
      const currentLocale = window.languageManager.getCurrentLocale();

      if (settings.language && settings.language !== currentLocale) {
        console.log(`[SidePanel] 언어 동기화: ${currentLocale} → ${settings.language}`);
        await window.languageManager.changeLanguage(settings.language);
      }

      // ✨ 사이드패널 제목 설정 (언어별)
      document.title = window.languageManager.getMessage('appTitle') || 'Gena';

      this.updateUITexts();
      await this.loadCurrentTab();
      await window.qaManager.initialize();
      await this.checkUsage();

      await this.checkPremiumAndToggleQuestion();

      this.setupEventListeners();
      this.setupSettingsChangeListener();
      this.setupRealtimeUsageUpdate();
      this.setupTabChangeListener();
      this.setupProgressListener();
      window.languageManager.applyLanguageFont();

      this.displayUserInfo();

      this.initialized = true;
      console.log('[SidePanel] 초기화 완료');

      // ✅ 깜빡임 방지: 초기화 완료 후 페이드인
      document.body.classList.add('loaded');

      await this.checkAutoSummarize();
    } catch (error) {
      console.error('[SidePanel] 초기화 오류:', error);
      window.errorHandler.handle(error, 'sidepanel-initialization');
      this.showError('initializationError');

      // ✅ 에러 발생 시에도 페이지 표시
      document.body.classList.add('loaded');
    }
  }

  /**
   * ✨ 진행 상황 리스너 설정
   */
  setupProgressListener() {
    this.progressListener = (message, sender, sendResponse) => {
      if (message.action === 'pdfProgress') {
        this.updatePDFProgress(message.data);
      }
    };
    
    chrome.runtime.onMessage.addListener(this.progressListener);
    console.log('[SidePanel] 진행 상황 리스너 설정 완료');
  }

  /**
   * ✨ PDF 진행 상황 UI 업데이트
   */
  updatePDFProgress(data) {
    const container = document.getElementById('pdfProgressContainer');
    const progressBar = document.getElementById('pdfProgressBar');
    const progressText = document.getElementById('pdfProgressText');
    const progressDetail = document.getElementById('pdfProgressDetail');

    if (!container || !progressBar || !progressText || !progressDetail) {
      return;
    }

    // 컨테이너 표시
    container.classList.remove('hidden');

    // 진행률 계산
    const percentage = data.progress || 0;
    progressBar.style.width = `${percentage}%`;

    // ✨ 시작 시간 기록 (처음 progress 업데이트 시)
    if (this.pdfStartTime === null && percentage > 0 && percentage < 100) {
      this.pdfStartTime = Date.now();
      this.pdfLastProgress = percentage;
    }

    // ✨ 예상 남은 시간 계산
    let estimatedTimeText = '';
    if (this.pdfStartTime && percentage > this.pdfLastProgress && percentage < 100) {
      const elapsedMs = Date.now() - this.pdfStartTime;
      const progressMade = percentage - this.pdfLastProgress;
      const remainingProgress = 100 - percentage;

      // 평균 속도 기반 예상 시간 (최소 5초 이상 경과 시에만 표시)
      if (elapsedMs >= 5000) {
        const estimatedRemainingMs = (elapsedMs / progressMade) * remainingProgress;
        const estimatedSeconds = Math.ceil(estimatedRemainingMs / 1000);

        if (estimatedSeconds > 60) {
          const minutes = Math.floor(estimatedSeconds / 60);
          const seconds = estimatedSeconds % 60;
          estimatedTimeText = ` (약 ${minutes}분 ${seconds}초 남음)`;
        } else if (estimatedSeconds > 0 && estimatedSeconds <= 120) {
          estimatedTimeText = ` (약 ${estimatedSeconds}초 남음)`;
        }
      }
    }

    // 단계별 메시지
    switch (data.stage) {
      case 'download':
        progressText.textContent = chrome.i18n.getMessage('pdfDownloading');
        progressDetail.textContent = (data.message || chrome.i18n.getMessage('pdfFetchingFile')) + estimatedTimeText;
        break;

      case 'offscreen':
        progressText.textContent = chrome.i18n.getMessage('pdfPreparingProcessing');
        progressDetail.textContent = (data.message || chrome.i18n.getMessage('pdfPreparingTools')) + estimatedTimeText;
        break;

      case 'extract':
        progressText.textContent = chrome.i18n.getMessage('pdfExtractingText');
        if (data.currentPage && data.totalPages) {
          progressDetail.textContent = chrome.i18n.getMessage('pdfExtractingProgress').replace('{page}', data.currentPage).replace('{total}', data.totalPages) + estimatedTimeText;
        } else {
          progressDetail.textContent = (data.message || chrome.i18n.getMessage('pdfExtractingInProgress')) + estimatedTimeText;
        }
        break;

      case 'complete':
        // ✨ 완료 시 타이머 초기화
        this.pdfStartTime = null;
        this.pdfLastProgress = 0;

        progressText.textContent = chrome.i18n.getMessage('pdfExtractionComplete');
        progressDetail.textContent = data.message || chrome.i18n.getMessage('pdfExtractionCompleted');
        // 2초 후 숨김
        setTimeout(() => {
          container.classList.add('hidden');
        }, 2000);
        break;

      case 'error':
        // ✨ 에러 시 타이머 초기화
        this.pdfStartTime = null;
        this.pdfLastProgress = 0;

        progressText.textContent = chrome.i18n.getMessage('pdfExtractionFailed');
        progressDetail.textContent = data.message || chrome.i18n.getMessage('pdfErrorOccurred');
        progressBar.style.background = 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)';
        // 3초 후 숨김
        setTimeout(() => {
          container.classList.add('hidden');
          progressBar.style.background = '';
        }, 3000);
        break;

      default:
        progressText.textContent = chrome.i18n.getMessage('pdfProcessing');
        progressDetail.textContent = (data.message || chrome.i18n.getMessage('pdfPleaseWait')) + estimatedTimeText;
    }

    console.log('[SidePanel] 진행 상황 업데이트:', data);
  }

  /**
   * ✅ 자동 요약 플래그 확인 및 실행
   */
  async checkAutoSummarize() {
    try {
      const result = await chrome.storage.local.get('autoSummarize');

      if (result.autoSummarize === true) {
        console.log('[SidePanel] 자동 요약 시작');

        await chrome.storage.local.remove('autoSummarize');

        setTimeout(() => {
          this.summarizePage();
        }, 500);
      }
    } catch (error) {
      console.error('[SidePanel] 자동 요약 확인 오류:', error);
    }
  }

  /**
   * ✅ Side Panel 전용: 활성 탭 변경 감지
   */
  setupTabChangeListener() {
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    console.log('[SidePanel] 탭 변경 감지:', activeInfo.tabId);

    // ✨ 탭 변경 시 이전 요약 유지 (초기화 X)
    // 새로운 탭 정보만 업데이트
    this.currentTabId = activeInfo.tabId;
    await this.loadCurrentTab();

    console.log('[SidePanel] ℹ️ 탭 전환 완료 - 이전 요약 유지됨');
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tabId === this.currentTabId && changeInfo.status === 'complete') {
      console.log('[SidePanel] 탭 업데이트 완료');
      await this.loadCurrentTab();
    }
  });
}

  /**
   * ✅ 질문 섹션 오버레이 텍스트만 업데이트 (언어 변경 시)
   */
  updateQuestionOverlayText() {
    const questionSection = document.getElementById('questionSection');

    if (!questionSection) {
      return;
    }

    const overlay = questionSection.querySelector('.question-lock-overlay');

    if (overlay) {
      const lockTitle = overlay.querySelector('.question-lock-title');
      const lockDescription = overlay.querySelector('.question-lock-description');
      const upgradeBtn = overlay.querySelector(
        '#upgradeFromQuestion span:last-child'
      );
      const overlayHint = overlay.querySelector('.question-overlay-hint');

      if (lockTitle) {
        lockTitle.textContent =
          window.languageManager.getMessage('questionFeatureTitle');
      }

      if (lockDescription) {
        lockDescription.innerHTML = window.languageManager.getMessage(
          'questionFeatureDescription'
        );
      }

      if (upgradeBtn) {
        upgradeBtn.textContent =
          window.languageManager.getMessage('upgradeToPremium');
      }

      if (overlayHint) {
        overlayHint.textContent = window.languageManager.getMessage('overlayHint');
      }

      console.log('[SidePanel] 질문 섹션 오버레이 텍스트 업데이트 완료');
    }
  }

  /**
   * ✅ 프리미엄 상태 확인 및 질문 섹션 제어
   */
  async checkPremiumAndToggleQuestion() {
    try {
      console.log('[SidePanel] 질문 섹션 - 프리미엄 상태 확인 중...');

      let isPremium = false;

      if (window.usageManager) {
        try {
          const usageStatus = await window.usageManager.getUsageStatus();
          isPremium = usageStatus.isPremium === true;
          console.log('[SidePanel] usageManager 기반 프리미엄 상태:', isPremium);
        } catch (usageError) {
          console.warn('[SidePanel] usageManager 조회 실패, tokenManager로 대체');
        }
      }

      if (!isPremium && window.tokenManager) {
        try {
          const token = await window.tokenManager.getAccessToken();

          if (token) {
            const decoded = window.tokenManager.decodeToken(token);
            isPremium = decoded?.isPremium === true;
            console.log('[SidePanel] tokenManager 기반 프리미엄 상태:', isPremium);
          }
        } catch (tokenError) {
          console.warn('[SidePanel] tokenManager 조회 실패');
        }
      }

      this.toggleQuestionSection(isPremium);
    } catch (error) {
      console.error('[SidePanel] 질문 섹션 프리미엄 확인 오류:', error);
      window.errorHandler.handle(error, 'check-premium-status-question');
      this.toggleQuestionSection(false);
    }
  }

  /**
   * ✅ 질문 섹션 잠금/해제
   */
  toggleQuestionSection(isPremium) {
    const questionSection = document.getElementById('questionSection');

    if (!questionSection) {
      console.warn('[SidePanel] 질문 섹션을 찾을 수 없습니다');
      return;
    }

    if (isPremium) {
      questionSection.style.position = '';
      questionSection.style.minHeight = '';
      questionSection.classList.remove('locked');

      const existingOverlay = questionSection.querySelector(
        '.question-lock-overlay'
      );
      if (existingOverlay) {
        existingOverlay.remove();
      }

      const questionInput = questionSection.querySelector('#questionInput');
      const askBtn = questionSection.querySelector('#askBtn');
      const clearQABtn = questionSection.querySelector('#clearQABtn');

      if (questionInput) {
        questionInput.disabled = false;
        questionInput.style.pointerEvents = 'auto';
        questionInput.style.opacity = '1';
      }

      if (askBtn) {
        askBtn.disabled = false;
        askBtn.style.pointerEvents = 'auto';
        askBtn.style.opacity = '1';
      }

      if (clearQABtn) {
        clearQABtn.disabled = false;
        clearQABtn.style.pointerEvents = 'auto';
        clearQABtn.style.opacity = '1';
      }

      console.log('[SidePanel] ✅ 질문 섹션 활성화 (프리미엄 사용자)');
    } else {
      questionSection.style.position = 'relative';
      questionSection.style.minHeight = '180px';
      questionSection.classList.add('locked');

      const questionInput = questionSection.querySelector('#questionInput');
      const askBtn = questionSection.querySelector('#askBtn');
      const clearQABtn = questionSection.querySelector('#clearQABtn');

      if (questionInput) {
        questionInput.disabled = true;
        questionInput.style.pointerEvents = 'none';
        questionInput.style.opacity = '0.3';
      }

      if (askBtn) {
        askBtn.disabled = true;
        askBtn.style.pointerEvents = 'none';
        askBtn.style.opacity = '0.3';
      }

      if (clearQABtn) {
        clearQABtn.disabled = true;
        clearQABtn.style.pointerEvents = 'none';
        clearQABtn.style.opacity = '0.3';
      }

      if (!questionSection.querySelector('.question-lock-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'question-lock-overlay';
        overlay.innerHTML = `
          <div class="question-lock-content">
            <div class="question-lock-header">
              <span class="material-icons question-lock-icon">help_outline</span>
              <p class="question-lock-title">${window.languageManager.getMessage(
                'questionFeatureTitle'
              )}</p>
            </div>
            <p class="question-lock-description">
              ${window.languageManager.getMessage('questionFeatureDescription')}
            </p>
            <button class="question-upgrade-btn" id="upgradeFromQuestion">
              <span class="material-icons">workspace_premium</span>
              <span>${window.languageManager.getMessage(
                'upgradeToPremium'
              )}</span>
            </button>
            <p class="question-overlay-hint">${window.languageManager.getMessage(
              'overlayHint'
            )}</p>
          </div>
        `;

        questionSection.appendChild(overlay);

        const upgradeBtn = overlay.querySelector('#upgradeFromQuestion');
        if (upgradeBtn) {
          upgradeBtn.addEventListener('click', async () => {
            // 1회용 토큰으로 자동 로그인 후 구독 페이지로 이동
            await this.openWebsiteWithAutoLogin('/subscription');
          });
        }
      }

      console.log('[SidePanel] 🔒 질문 섹션 잠금 (무료 사용자)');
    }
  }

  showLoginRequiredScreen() {
    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
        font-family: 'Roboto', sans-serif;
        height: 100vh;
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
        ">
          <span class="material-icons" style="color: white; font-size: 48px;">lock</span>
        </div>
        
        <h2 style="
          color: #212121;
          margin-bottom: 12px;
          font-size: 20px;
          font-weight: 500;
        ">${chrome.i18n.getMessage('loginRequired')}</h2>

        <p style="
          color: #757575;
          margin-bottom: 32px;
          line-height: 1.6;
          font-size: 14px;
        ">
          ${chrome.i18n.getMessage('loginRequiredDesc')}
        </p>

        <button id="loginBtn" style="
          background: #2196F3;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 32px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        " onmouseover="this.style.background='#1976D2'" onmouseout="this.style.background='#2196F3'">
          <span class="material-icons">login</span>
          ${chrome.i18n.getMessage('loginButton')}
        </button>

        <button id="signupBtn" style="
          background: transparent;
          color: #2196F3;
          border: 2px solid #2196F3;
          border-radius: 8px;
          padding: 10px 32px;
          font-size: 14px;
          font-weight: 500;
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
    });

    document.getElementById('signupBtn').addEventListener('click', () => {
      // 사용자 언어 감지 - 한국어가 아니면 영어로 표시
      const userLang = chrome.i18n.getUILanguage().split('-')[0]; // 'ko', 'en', 'ja' etc.
      const signupUrl = userLang === 'ko'
        ? 'https://www.genaai.net/signup'
        : 'https://www.genaai.net/signup?lang=en';

      chrome.tabs.create({ url: signupUrl });
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

  setupSettingsChangeListener() {
    this.settingsUnsubscribe = window.settingsManager.onSettingsChange(
      (newSettings, oldSettings) => {
        console.log('[SidePanel] 설정 변경 감지');

        if (newSettings.language !== oldSettings.language) {
          window.languageManager.changeLanguage(newSettings.language).then(() => {
            // ✨ 사이드패널 제목 업데이트
            document.title = window.languageManager.getMessage('appTitle') || 'Gena';
            this.updateUITexts();
            this.updateUsageDisplay();
            window.languageManager.applyLanguageFont();
            this.updateQuestionOverlayText();
          });
        }

        if (newSettings.theme !== oldSettings.theme) {
          window.settingsManager.applyTheme(newSettings.theme);
        }

        if (
          newSettings.useProxy !== oldSettings.useProxy ||
          newSettings.apiKey !== oldSettings.apiKey
        ) {
          this.updateUsageDisplay();
        }
      }
    );
  }

  setupRealtimeUsageUpdate() {
    console.log('[Usage Update] 실시간 사용량 업데이트 설정');

    this.storageChangeListener = (changes, areaName) => {
      if (areaName === 'local' && changes.usageData) {
        console.log(
          '[Usage Update] Storage에서 사용량 변경 감지:',
          changes.usageData.newValue
        );

        if (changes.usageData.newValue) {
          const usageData = changes.usageData.newValue;
          this.usage.daily = usageData.dailyUsed || 0;
          this.usage.limit = usageData.dailyLimit || 5;

          this.updateUsageDisplay();
          console.log('[Usage Update] 사용량 UI 업데이트 완료 (Storage 기반)');
        }
      }
    };
    chrome.storage.onChanged.addListener(this.storageChangeListener);

    this.visibilityChangeListener = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[Usage Update] Side Panel이 다시 보임 - 사용량 조회');
        await this.checkUsage();
      }
    };
    document.addEventListener(
      'visibilitychange',
      this.visibilityChangeListener
    );

    this.focusListener = async () => {
      console.log('[Usage Update] Side Panel에 포커스 - 사용량 조회');
      await this.checkUsage();
    };
    window.addEventListener('focus', this.focusListener);

    this.usagePollingInterval = setInterval(async () => {
      if (document.visibilityState === 'visible') {
        console.log('[Usage Update] 주기적 폴링 - 사용량 조회');
        await this.checkUsage();
      }
    }, 30000);

    console.log('[Usage Update] 실시간 업데이트 리스너 등록 완료');
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

    this.updateUsageDisplay();

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

    this.updateQuestionOverlayText();
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

      this.currentTabId = tab.id;

      this.currentPageInfo = {
        title: tab.title || window.languageManager.getMessage('noTitle'),
        url: tab.url,
        domain: new URL(tab.url).hostname,
      };

      window.uiManager.displayPageInfo(this.currentPageInfo);

      if (window.isRestrictedPage(tab.url)) {
        window.uiManager.disablePage();
        this.showToast('errorRestrictedPage');
      }
    } catch (error) {
      console.error('[SidePanel] 탭 정보 로드 오류:', error);
      window.errorHandler.handle(error, 'load-current-tab');
      this.showError('errorExtractContent');
    }
  }

  async extractPageContent() {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.url) {
        throw new Error(window.languageManager.getMessage('errorExtractContent'));
      }

      console.log('[SidePanel] 현재 탭 URL:', tab.url);

      // ✨ Google Drive/Dropbox 폴더 페이지 감지
      const urlLower = tab.url.toLowerCase();
      if ((urlLower.includes('drive.google.com/drive/') && !urlLower.includes('/file/d/')) ||
          (urlLower.includes('dropbox.com') && urlLower.includes('/home'))) {
        throw new Error(window.languageManager.getMessage('errorDriveFolderPage'));
      }

      // ✨ PDF 감지: URL 기반 또는 DOM 스캔
      let pdfUrl = null;
      let isPDF = this.isPDFUrl(tab.url);

      if (isPDF) {
        pdfUrl = tab.url;
        console.log('[SidePanel] PDF URL 감지:', pdfUrl);
      } else {
        // URL로 감지 안 되면 DOM에서 PDF embed/iframe 찾기
        console.log('[SidePanel] DOM에서 PDF 검색 중...');
        const domPDF = await this.hasPDFInDOM(tab.id);
        if (domPDF.found) {
          isPDF = true;
          pdfUrl = domPDF.url;
          console.log('[SidePanel] ✅ DOM에서 PDF 발견 (' + domPDF.type + '):', pdfUrl);
        }
      }

      if (isPDF && pdfUrl) {
        // ✨ PDF 뷰어 URL을 다운로드 가능한 URL로 변환
        const directPdfUrl = this.convertToDirectPDFUrl(pdfUrl);
        console.log('[SidePanel] PDF 추출 시작');
        console.log('[SidePanel] 원본 URL:', pdfUrl);
        console.log('[SidePanel] 변환된 URL:', directPdfUrl);

        try {
          this.startKeepAlive();

          this.updatePDFProgress({
            stage: 'download',
            progress: 0,
            message: chrome.i18n.getMessage('pdfFetchingFile')
          });

          console.log('[SidePanel] 🔵 Service Worker 깨우는 중...');
          await this.wakeUpServiceWorker();
          console.log('[SidePanel] 🔵 Service Worker 활성화 완료');

          console.log('[SidePanel] 🔵 PDF 추출 메시지 전송');

          const ackResponse = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('ACK 응답 타임아웃 (10초)'));
            }, 10000);

            chrome.runtime.sendMessage(
              {
                action: 'extractPDF',
                url: directPdfUrl  // ✨ 변환된 다운로드 URL 사용
              },
              (response) => {
                clearTimeout(timeout);
                
                if (chrome.runtime.lastError) {
                  console.error('[SidePanel] 🔴 런타임 에러:', chrome.runtime.lastError);
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }
                
                if (!response) {
                  reject(new Error('응답이 비어있습니다'));
                  return;
                }
                
                resolve(response);
              }
            );
          });

          console.log('[SidePanel] ✅ ACK 응답 받음:', ackResponse);

          if (!ackResponse.success) {
            throw new Error(ackResponse.error || 'PDF 추출 요청 실패');
          }

          const result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              this.stopKeepAlive();
              reject(new Error('PDF 추출 타임아웃 (180초)'));
            }, 180000);

            const completionListener = (message, sender, sendResponse) => {
              if (message.action === 'pdfExtractionComplete') {
                clearTimeout(timeout);
                chrome.runtime.onMessage.removeListener(completionListener);
                
                console.log('[SidePanel] ✅ PDF 추출 완료 메시지 받음');
                resolve(message.result);
              }
            };

            chrome.runtime.onMessage.addListener(completionListener);
          });

          this.stopKeepAlive();

          console.log('[SidePanel] PDF 추출 결과:', result);

          if (!result || !result.success) {
            throw new Error(result?.error || 'PDF 추출 실패');
          }

          if (!result.text || result.text.length < 50) {
            throw new Error('PDF에서 텍스트를 찾을 수 없습니다. 이미지 기반 PDF는 지원하지 않습니다.');
          }

          this.updatePDFProgress({
            stage: 'complete',
            progress: 100,
            message: chrome.i18n.getMessage('pdfExtractionCompleted')
          });

          const contentValidation = window.validateInput(result.text, {
            type: 'string',
            required: true,
            minLength: 50,
            maxLength: 100000,
          });

          if (!contentValidation.valid) {
            throw new Error(`PDF 콘텐츠 검증 실패: ${contentValidation.error}`);
          }

          this.currentPageContent = contentValidation.sanitized;

          if (result.metadata) {
            this.currentPageInfo.isPDF = true;
            this.currentPageInfo.pdfPages = result.metadata.extractedPages;
            this.currentPageInfo.pdfTotalPages = result.metadata.totalPages;
          }

          console.log('[SidePanel] ✅ PDF 콘텐츠 추출 완료:', 
            this.currentPageContent.length, '문자');

          return this.currentPageContent;

        } catch (pdfError) {
          console.error('[SidePanel] PDF 추출 실패:', pdfError);

          this.stopKeepAlive();

          this.updatePDFProgress({
            stage: 'error',
            progress: 0,
            message: pdfError.message
          });

          let errorMessage = 'PDF를 추출할 수 없습니다.';

          if (pdfError.message.includes('Chrome 114+')) {
            errorMessage = 'PDF 추출 기능은 Chrome 114 이상 버전에서만 사용할 수 있습니다.';
          } else if (pdfError.message.includes('텍스트를 찾을 수 없습니다')) {
            errorMessage = pdfError.message;
          } else if (pdfError.message.includes('접근')) {
            errorMessage = 'PDF 파일에 접근할 수 없습니다.';
          } else if (pdfError.message.includes('타임아웃') || pdfError.message.includes('시간')) {
            errorMessage = 'PDF 추출 시간이 초과되었습니다. 파일이 너무 크거나 복잡할 수 있습니다.';
          } else if (pdfError.message.includes('응답이 비어있습니다') || pdfError.message.includes('ACK')) {
            errorMessage = 'Service Worker가 응답하지 않습니다. 확장 프로그램을 새로고침해주세요.';
          } else if (pdfError.message.includes('Service Worker')) {
            errorMessage = 'Service Worker 통신 오류가 발생했습니다. 확장 프로그램을 새로고침해주세요.';
          }

          throw new Error(errorMessage);
        }
      }

      if (window.isRestrictedPage && window.isRestrictedPage(tab.url)) {
        throw new Error(window.languageManager.getMessage('errorRestrictedPage'));
      }

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });

        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content-styles.css'],
        });

        console.log('[SidePanel] Content script 주입 완료');
      } catch (injectError) {
        console.log('[SidePanel] Content script 주입 실패 (이미 주입되었을 수 있음):', injectError.message);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'extractContent',
        });

        if (response && response.content) {
          const contentValidation = window.validateInput(response.content, {
            type: 'string',
            required: true,
            minLength: 50,
            maxLength: 50000,
          });

          if (!contentValidation.valid) {
            throw new Error(`콘텐츠 검증 실패: ${contentValidation.error}`);
          }

          this.currentPageContent = contentValidation.sanitized;
          console.log('[SidePanel] 콘텐츠 추출 및 검증 완료:', this.currentPageContent.length, '문자');
          return this.currentPageContent;
        }
      } catch (messageError) {
        console.log('[SidePanel] Content script 통신 오류 - 백업 방법 사용:', messageError.message);
      }

      console.log('[SidePanel] 백업 방법으로 콘텐츠 추출 시도');

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const unwantedElements = document.querySelectorAll('script, style, noscript, iframe');
          unwantedElements.forEach((el) => el.remove());

          const contentSelectors = [
            'article',
            'main',
            '[role="main"]',
            '.content',
            '#content',
            '.post-content',
            '.entry-content',
          ];

          for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element && element.innerText.trim().length > 100) {
              return element.innerText.trim().substring(0, 10000);
            }
          }

          return document.body.innerText.trim().substring(0, 10000);
        },
      });

      if (result && result.result) {
        const contentValidation = window.validateInput(result.result, {
          type: 'string',
          required: true,
          minLength: 50,
          maxLength: 50000,
        });

        if (!contentValidation.valid) {
          throw new Error(`콘텐츠 검증 실패: ${contentValidation.error}`);
        }

        this.currentPageContent = contentValidation.sanitized;
        console.log('[SidePanel] 백업 방법으로 콘텐츠 추출 및 검증 완료:', this.currentPageContent.length, '문자');
        return this.currentPageContent;
      }

      throw new Error(window.languageManager.getMessage('errorExtractContent'));

    } catch (error) {
      console.error('[SidePanel] 콘텐츠 추출 오류:', error);
      window.errorHandler.handle(error, 'extract-page-content');
      
      this.stopKeepAlive();
      
      throw error;
    }
  }

  startKeepAlive() {
    console.log('[Keep-Alive] 시작 - 15초 주기');
    
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    this.keepAliveInterval = setInterval(async () => {
      try {
        await chrome.runtime.sendMessage({ action: 'ping' });
        console.log('[Keep-Alive] 🔵 Ping 전송 성공');
      } catch (error) {
        console.warn('[Keep-Alive] ⚠️ Ping 실패:', error.message);
      }
    }, 15000);
  }

  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      console.log('[Keep-Alive] 중지');
    }
  }

  async wakeUpServiceWorker() {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    const PING_TIMEOUT = 5000;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[SidePanel] Service Worker 깨우기 시도 ${attempt}/${MAX_RETRIES}`);
        
        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Ping 타임아웃'));
          }, PING_TIMEOUT);

          chrome.runtime.sendMessage(
            { action: 'ping' },
            (response) => {
              clearTimeout(timeout);
              
              if (chrome.runtime.lastError) {
                console.log(`[SidePanel] 시도 ${attempt} - 런타임 에러:`, chrome.runtime.lastError.message);
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              
              resolve(response);
            }
          );
        });
        
        if (response && response.success) {
          console.log(`[SidePanel] ✅ Service Worker 활성화 성공 (시도 ${attempt}/${MAX_RETRIES})`);
          return;
        }
        
        console.log(`[SidePanel] 시도 ${attempt} - 응답 없음, 재시도...`);
        
      } catch (error) {
        console.warn(`[SidePanel] 시도 ${attempt}/${MAX_RETRIES} 실패:`, error.message);
        
        if (attempt < MAX_RETRIES) {
          console.log(`[SidePanel] ${RETRY_DELAY}ms 대기 후 재시도...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY));
        } else {
          console.warn('[SidePanel] ⚠️ Service Worker 응답 없음 - 진행 시도');
          return;
        }
      }
    }
    
    console.warn('[SidePanel] ⚠️ 모든 재시도 실패 - PDF 추출 진행');
  }

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

    // 2. ✨ PDF 뷰어 사이트 감지
    // Google Drive PDF 뷰어
    if (urlLower.includes('drive.google.com/file/d/')) {
      return true;
    }

    // Dropbox PDF 뷰어
    if (urlLower.includes('dropbox.com') &&
        (urlLower.includes('/s/') || urlLower.includes('/sh/'))) {
      return true;
    }

    // OneDrive PDF 뷰어
    if (urlLower.includes('onedrive.live.com') ||
        urlLower.includes('1drv.ms')) {
      return true;
    }

    // arXiv PDF
    if (urlLower.includes('arxiv.org/pdf/')) {
      return true;
    }

    return false;
  }

  /**
   * ✨ PDF 뷰어 URL을 다운로드 가능한 URL로 변환
   */
  convertToDirectPDFUrl(url) {
    const urlLower = url.toLowerCase();

    // Google Drive: /file/d/FILE_ID/view → /uc?export=download&id=FILE_ID
    if (urlLower.includes('drive.google.com/file/d/')) {
      const match = url.match(/\/file\/d\/([^\/]+)/);
      if (match && match[1]) {
        const fileId = match[1];
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }

    // Dropbox: ?dl=0 → ?dl=1
    if (urlLower.includes('dropbox.com')) {
      return url.replace(/[?&]dl=0/i, '?dl=1');
    }

    // OneDrive: embed 파라미터 추가
    if (urlLower.includes('onedrive.live.com') || urlLower.includes('1drv.ms')) {
      return url + (url.includes('?') ? '&' : '?') + 'download=1';
    }

    // 기타 경우는 원본 URL 반환
    return url;
  }

  /**
   * ✨ DOM에서 PDF embed/iframe 찾기
   */
  async hasPDFInDOM(tabId) {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // PDF embed 찾기
          const pdfEmbed = document.querySelector('embed[type="application/pdf"]');
          if (pdfEmbed && pdfEmbed.src) {
            return { found: true, url: pdfEmbed.src, type: 'embed' };
          }

          // PDF object 찾기
          const pdfObject = document.querySelector('object[type="application/pdf"]');
          if (pdfObject && pdfObject.data) {
            return { found: true, url: pdfObject.data, type: 'object' };
          }

          // PDF iframe 찾기
          const iframes = document.querySelectorAll('iframe');
          for (const iframe of iframes) {
            const src = iframe.src || '';
            if (src.toLowerCase().includes('.pdf')) {
              return { found: true, url: src, type: 'iframe' };
            }
          }

          return { found: false };
        }
      });

      if (result && result[0] && result[0].result) {
        return result[0].result;
      }

      return { found: false };
    } catch (error) {
      console.error('[SidePanel] DOM PDF 감지 오류:', error);
      return { found: false };
    }
  }

  determineOptimalLength(contentLength) {
    if (contentLength < 1000) {
      console.log(
        '[SidePanel] 자동 길이 선택: short (콘텐츠 길이:',
        contentLength,
        ')'
      );
      return 'short';
    } else if (contentLength < 3000) {
      console.log(
        '[SidePanel] 자동 길이 선택: medium (콘텐츠 길이:',
        contentLength,
        ')'
      );
      return 'medium';
    } else if (contentLength < 7000) {
      console.log(
        '[SidePanel] 자동 길이 선택: detailed (콘텐츠 길이:',
        contentLength,
        ')'
      );
      return 'detailed';
    } else if (contentLength < 15000) {
      console.log(
        '[SidePanel] 자동 길이 선택: very_detailed (콘텐츠 길이:',
        contentLength,
        ')'
      );
      return 'very_detailed';
    } else {
      console.log(
        '[SidePanel] 자동 길이 선택: ultra_detailed (콘텐츠 길이:',
        contentLength,
        ')'
      );
      return 'ultra_detailed';
    }
  }

  /**
   * ✨ v6.3 - 캐시 키 생성
   */
  generateSummaryCacheKey(url) {
    return `summary_cache_${url}`;
  }

  /**
   * ✨ v6.3 - 캐시 인덱스 조회 (LRU 관리용)
   */
  async getCacheIndex() {
    try {
      const result = await chrome.storage.local.get('summary_cache_index');
      return result.summary_cache_index || [];
    } catch (error) {
      console.error('[SidePanel] 캐시 인덱스 조회 오류:', error);
      return [];
    }
  }

  /**
   * ✨ v6.3 - 캐시 인덱스 저장
   */
  async saveCacheIndex(index) {
    try {
      await chrome.storage.local.set({ summary_cache_index: index });
    } catch (error) {
      console.error('[SidePanel] 캐시 인덱스 저장 오류:', error);
    }
  }

  /**
   * ✨ v6.3 - 캐시된 요약 조회
   */
  async getCachedSummary(url) {
    try {
      const cacheKey = this.generateSummaryCacheKey(url);
      const result = await chrome.storage.local.get(cacheKey);

      if (result[cacheKey]) {
        const cached = result[cacheKey];
        // 1시간 이내의 캐시만 사용
        if (Date.now() - cached.timestamp < 3600000) {
          console.log('[SidePanel] 캐시된 요약 발견 (1시간 이내)');

          // LRU: 접근 시간 업데이트
          await this.updateCacheAccessTime(url);

          return cached;
        } else {
          // 만료된 캐시 삭제
          console.log('[SidePanel] 만료된 캐시 삭제:', url);
          await this.removeCacheEntry(url);
        }
      }
      return null;
    } catch (error) {
      console.error('[SidePanel] 캐시 조회 오류:', error);
      return null;
    }
  }

  /**
   * ✨ v6.3 - 캐시 접근 시간 업데이트 (LRU)
   */
  async updateCacheAccessTime(url) {
    try {
      const index = await this.getCacheIndex();
      const entry = index.find(item => item.url === url);

      if (entry) {
        entry.lastAccess = Date.now();
        await this.saveCacheIndex(index);
      }
    } catch (error) {
      console.error('[SidePanel] 캐시 접근 시간 업데이트 오류:', error);
    }
  }

  /**
   * ✨ v6.3 - 캐시 엔트리 삭제
   */
  async removeCacheEntry(url) {
    try {
      const cacheKey = this.generateSummaryCacheKey(url);
      await chrome.storage.local.remove(cacheKey);

      // 인덱스에서도 제거
      const index = await this.getCacheIndex();
      const newIndex = index.filter(item => item.url !== url);
      await this.saveCacheIndex(newIndex);

      console.log('[SidePanel] 캐시 엔트리 삭제 완료:', url);
    } catch (error) {
      console.error('[SidePanel] 캐시 삭제 오류:', error);
    }
  }

  /**
   * ✨ v6.3 - 요약 캐시 저장 (최대 50개 제한, LRU)
   */
  async saveSummaryCache(url, summary, historyId) {
    try {
      const MAX_CACHE_SIZE = 50;
      const cacheKey = this.generateSummaryCacheKey(url);

      // 캐시 인덱스 조회
      let index = await this.getCacheIndex();

      // 이미 존재하는 캐시인지 확인
      const existingIndex = index.findIndex(item => item.url === url);

      if (existingIndex >= 0) {
        // 기존 캐시 업데이트
        index[existingIndex].lastAccess = Date.now();
        index[existingIndex].timestamp = Date.now();
      } else {
        // 새 캐시 추가 전 크기 확인
        if (index.length >= MAX_CACHE_SIZE) {
          // LRU: 가장 오래 접근하지 않은 캐시 삭제
          index.sort((a, b) => a.lastAccess - b.lastAccess);
          const oldestEntry = index.shift();

          console.log(`[SidePanel] 캐시 크기 제한 (${MAX_CACHE_SIZE}개) 도달 - 가장 오래된 캐시 삭제:`, oldestEntry.url);

          // 가장 오래된 캐시 삭제
          const oldestKey = this.generateSummaryCacheKey(oldestEntry.url);
          await chrome.storage.local.remove(oldestKey);
        }

        // 새 캐시 인덱스 추가
        index.push({
          url,
          timestamp: Date.now(),
          lastAccess: Date.now()
        });
      }

      // 인덱스 저장
      await this.saveCacheIndex(index);

      // 실제 캐시 데이터 저장
      await chrome.storage.local.set({
        [cacheKey]: {
          summary,
          historyId,
          timestamp: Date.now(),
          url
        }
      });

      console.log(`[SidePanel] 요약 캐시 저장 완료 (${index.length}/${MAX_CACHE_SIZE})`);
    } catch (error) {
      console.error('[SidePanel] 캐시 저장 오류:', error);
    }
  }

  async summarizePage() {
    try {
      // ✨ v6.3 - 중복 요약 방지: 캐시 확인
      const cached = await this.getCachedSummary(this.currentPageInfo.url);

      if (cached) {
        const message = window.languageManager.getMessage('useCachedSummary') ||
          '이 페이지는 최근에 요약한 기록이 있습니다. 기존 요약을 사용하시겠습니까?';

        if (confirm(message)) {
          console.log('[SidePanel] 캐시된 요약 사용');
          this.currentSummary = cached.summary;
          this.currentHistoryId = cached.historyId;

          window.uiManager.displaySummary(this.currentSummary);

          // 캐시 사용 알림 표시
          const noticeMessage = window.languageManager.getMessage('cachedSummaryNotice') ||
            '캐시된 요약 (최근 1시간 이내)';
          this.showToast(noticeMessage, 'info');

          // Q&A 초기화
          const content = await this.extractPageContent();
          await window.qaManager.initialize(cached.historyId, content);
          await this.checkPremiumAndToggleQuestion();

          return;
        }
      }

      const canUse = await window.usageManager.canSummarize();

      if (!canUse.allowed) {
        if (canUse.reason === 'DAILY_LIMIT_EXCEEDED') {
          this.showUpgradeModal('summary');
          return;
        }
        throw new Error(window.languageManager.getMessage('errorDailyLimit'));
      }

      if (!window.settingsManager.isApiReady()) {
        this.showToast('errorApiNotConfigured');
        return;
      }

      window.uiManager.showLoading(true);
      window.uiManager.resetSections();

      const content = await this.extractPageContent();

      // ✨ v6.3 - 강화된 콘텐츠 길이 검증
      if (!content || content.length < 100) {
        throw new Error(window.languageManager.getMessage('errorExtractContent'));
      }

      // 100-500자: 경고 메시지와 함께 사용자 확인
      if (content.length < 500) {
        const warningMessage = window.languageManager.getMessage('contentTooShortWarning') ||
          `콘텐츠가 너무 짧습니다 (${content.length}자).\n요약 품질이 낮을 수 있습니다. 계속하시겠습니까?`;

        const confirmed = confirm(warningMessage);
        if (!confirmed) {
          window.uiManager.showLoading(false);
          this.showToast('summaryCancelled');
          return;
        }
      }

      console.log('[SidePanel] 요약 시작 - 콘텐츠 길이:', content.length);

      const optimalLength = this.determineOptimalLength(content.length);

      console.log('[SidePanel] 자동 설정:', {
        length: optimalLength,
        contentLength: content.length
      });

      // ✨ v6.3 - maxTokens는 api-service.js에서 자동 계산 (중복 제거)
      this.currentSummary = await window.apiService.summarizeText(
        content,
        optimalLength,
        this.currentPageInfo,
        null  // maxTokens는 api-service.js에서 자동 계산
      );
      console.log(
        '[SidePanel] 요약 완료 (길이:',
        this.currentSummary.length,
        '문자)'
      );

      window.uiManager.displaySummary(this.currentSummary);

      const historyId = await this.saveSummaryHistory();
      this.currentHistoryId = historyId;

      await window.qaManager.initialize(historyId, content);

      await this.checkPremiumAndToggleQuestion();

      await this.updateUsage();

      // ✨ Side Panel 상태 저장
      await this.saveSidePanelState();

      // ✨ v6.3 - 요약 캐시 저장
      await this.saveSummaryCache(this.currentPageInfo.url, this.currentSummary, historyId);

      this.showToast('toastSaved');
      
    } catch (error) {
      console.error('[SidePanel] 요약 오류:', error);

      // ✨ Rate Limit 에러인 경우 카운트다운 표시
      if (error.statusCode === 429 && error.retryAfter) {
        this.handleRateLimitError(error.retryAfter);
      } else {
        // ✨ 구체적인 에러 메시지 표시
        let errorMessage = error.message;

        // ErrorHandler의 사용자 친화적 메시지 변환 활용
        if (window.errorHandler) {
          errorMessage = window.errorHandler.getUserMessage(error);
        }

        // 에러 로깅
        window.errorHandler?.handle(error, 'summarize-page');

        // 구체적인 에러 메시지 표시
        window.uiManager.showError(errorMessage);
      }
    } finally {
      window.uiManager.showLoading(false);
    }
  }

  /**
   * ✨ Side Panel 상태 저장
   */
  async saveSidePanelState() {
    try {
      if (!this.currentTabId) {
        console.warn('[SidePanel] Tab ID가 없어서 상태 저장 불가');
        return;
      }

      console.log('[SidePanel] 탭 상태 저장:', this.currentTabId);

      await chrome.runtime.sendMessage({
        action: 'saveSidePanelState',
        tabId: this.currentTabId,
        hasSummary: !!this.currentSummary
      });

      console.log('[SidePanel] 상태 저장 완료');

    } catch (error) {
      console.error('[SidePanel] 상태 저장 오류:', error);
      window.errorHandler.handle(error, 'save-sidepanel-state');
    }
  }

  /**
   * ✨ 이전 요약 복원 (페이지 재방문 시)
   * @returns {boolean} 복원 성공 여부
   */
  async restorePreviousSummary() {
    try {
      if (!this.currentTabId) {
        console.log('[SidePanel] Tab ID가 없어서 복원 불가');
        return false;
      }

      console.log('[SidePanel] 이전 요약 복원 시도:', this.currentTabId);

      // 1. Background에서 상태 조회
      const response = await chrome.runtime.sendMessage({
        action: 'getSidePanelState',
        tabId: this.currentTabId
      });

      if (!response || !response.success || !response.state) {
        console.log('[SidePanel] 복원할 상태 없음');
        return false;
      }

      const state = response.state;

      if (!state.hasSummary) {
        console.log('[SidePanel] 요약이 저장되지 않은 상태');
        return false;
      }

      console.log('[SidePanel] 상태 발견:', state);

      // 2. 히스토리에서 가장 최근 요약 검색 (현재 URL 기준)
      const currentUrl = this.currentPageInfo.url;

      if (!currentUrl) {
        console.warn('[SidePanel] 현재 URL 없음');
        return false;
      }

      const allHistory = await window.historyManager.getAllHistory();

      // 현재 URL과 일치하는 가장 최근 히스토리 찾기
      const matchingHistory = allHistory.find(item => item.url === currentUrl);

      if (!matchingHistory) {
        console.log('[SidePanel] 히스토리에서 일치하는 요약을 찾을 수 없음');
        return false;
      }

      console.log('[SidePanel] ✅ 이전 요약 발견:', matchingHistory.id);

      // 3. 요약 복원
      this.currentSummary = matchingHistory.summary;
      this.currentHistoryId = matchingHistory.id;

      // 4. UI 업데이트
      window.uiManager.displaySummary(this.currentSummary);

      // 5. Q&A 초기화 (이전 대화 내용도 복원)
      const pageContent = matchingHistory.pageContent || '';
      await window.qaManager.initialize(matchingHistory.id, pageContent);

      console.log('[SidePanel] ✅ 이전 요약 복원 완료');

      return true;

    } catch (error) {
      console.error('[SidePanel] 요약 복원 오류:', error);
      window.errorHandler.handle(error, 'restore-previous-summary');
      // 에러가 발생해도 사용자 경험을 방해하지 않도록 조용히 처리
      return false;
    }
  }

  async askQuestion() {
    const questionInput = window.uiManager.getElement('questionInput');
    const questionText = questionInput.value.trim();

    const validation = window.validateInput(questionText, {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 5000,
      pattern: /^[^<>]*$/,
    });

    if (!validation.valid) {
      console.warn('[SidePanel] 질문 검증 실패:', validation.error);
      this.showToast('enterQuestion');
      return;
    }

    const question = validation.sanitized;

    const canUse = await window.usageManager.canAskQuestion();

    if (!canUse.allowed) {
      if (canUse.reason === 'QUESTION_LIMIT_EXCEEDED') {
        this.showUpgradeModal('question');
        return;
      }
      throw new Error(window.languageManager.getMessage('errorDailyLimit'));
    }

    if (!window.settingsManager.isApiReady()) {
      this.showToast('errorApiNotConfigured');
      return;
    }

    try {
      console.log('[SidePanel] 질문 처리 중 - 길이:', question.length);

      await window.qaManager.processQuestion(question);

      await this.updateUsage();

      questionInput.value = '';

      console.log('[SidePanel] 질문 처리 완료');
    } catch (error) {
      console.error('[SidePanel] 질문 처리 오류:', error);

      // ✨ 구체적인 에러 메시지 표시
      let errorMessage = error.message || window.languageManager.getMessage('errorAnswer');

      // ErrorHandler의 사용자 친화적 메시지 변환 활용
      if (window.errorHandler && error.message) {
        errorMessage = window.errorHandler.getUserMessage(error);
      }

      // 에러 로깅
      window.errorHandler?.handle(error, 'ask-question');

      // 구체적인 에러 메시지 표시
      window.uiManager.showError(errorMessage);
    }
  }

  copySummary() {
    if (!this.currentSummary) {
      this.showToast('nothingToCopy');
      return;
    }

    navigator.clipboard
      .writeText(this.currentSummary)
      .then(() => {
        console.log('[SidePanel] 요약 복사 완료');
        this.showToast('toastCopied');
        window.uiManager.animateCopyButton();
      })
      .catch((err) => {
        console.error('[SidePanel] 복사 실패:', err);
        window.errorHandler.handle(err, 'copy-summary');
        this.showToast('copyFailed');
      });
  }

  async saveSummaryHistory() {
    const settings = window.settingsManager.getSettings();

    if (!settings.saveHistory) {
      console.log('[SidePanel] 히스토리 저장 비활성화됨');
      return null;
    }

    try {
      const historyItem = await window.historyManager.addHistory({
        title: this.currentPageInfo.title,
        url: this.currentPageInfo.url,
        summary: this.currentSummary,
        pageContent: this.currentPageContent, // ✨ 페이지 콘텐츠 저장 (Q&A 복원용)
        qaHistory: [],
        metadata: {
          domain: this.currentPageInfo.domain,
          language: window.languageManager.getCurrentLanguage(),
          userId: this.currentUser?.id,
        },
      });

      await window.storageManager.updateUsageStatistics();

      console.log(
        '[SidePanel] 히스토리 저장 완료:',
        historyItem.id.substring(0, 10) + '...'
      );

      return historyItem.id;
    } catch (error) {
      console.error('[SidePanel] 히스토리 저장 오류:', error);
      window.errorHandler.handle(error, 'save-history');
      return null;
    }
  }

  async checkUsage() {
    try {
      console.log('[Usage] getUsageStatus 호출 시작...');
      const usageStatus = await window.usageManager.getUsageStatus();

      console.log('[Usage] getUsageStatus 응답:', usageStatus);

      this.usage.daily = usageStatus.isPremium ? 0 : usageStatus.dailyUsed;
      this.usage.limit = usageStatus.isPremium
        ? Infinity
        : usageStatus.dailyLimit;

      this.updateUsageDisplay();

      console.log('[SidePanel] 사용량 조회 완료:', {
        isPremium: usageStatus.isPremium,
        used: this.usage.daily,
        limit: this.usage.limit,
      });
    } catch (error) {
      console.error('[SidePanel] 사용량 확인 오류:', error);
      window.errorHandler.handle(error, 'check-usage');

      this.usage.daily = 0;
      this.usage.limit = 5;
      this.updateUsageDisplay();
    }
  }

  async updateUsage() {
    try {
      await this.checkUsage();
    } catch (error) {
      console.error('[SidePanel] 사용량 업데이트 오류:', error);
      window.errorHandler.handle(error, 'update-usage');
    }
  }

  updateUsageDisplay() {
    const usageText = document.getElementById('usageText');
    if (!usageText) {
      console.warn('[Usage Display] usageText 요소를 찾을 수 없습니다');
      return;
    }

    const isPremium = window.usageManager.isPremium();
    console.log('[Usage Display] 프리미엄 상태:', isPremium);

    if (isPremium) {
      const unlimitedMsg =
        window.languageManager.getMessage('unlimited') || '무제한';
      usageText.textContent = `✨ ${unlimitedMsg}`;
      usageText.style.color = '#4CAF50';
      console.log('[Usage Display] 프리미엄 사용자 - 표시:', usageText.textContent);
    } else {
      const usedCount = this.usage.daily;
      const totalLimit = this.usage.limit;

      console.log('[Usage Display] 무료 사용자 - 사용량:', {
        usedCount,
        totalLimit,
      });

      const currentLang = window.languageManager.getCurrentLanguage();
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

      console.log('[Usage Display] 최종 메시지:', message);

      usageText.textContent = message;
      usageText.style.color = '';
    }

    const summarizeBtn = document.getElementById('summarizeBtn');
    if (!isPremium && this.usage.daily >= this.usage.limit) {
      if (summarizeBtn) {
        summarizeBtn.disabled = true;
        const buttonText = summarizeBtn.querySelector('span:last-child');
        if (buttonText) {
          buttonText.textContent =
            window.languageManager.getMessage('dailyLimitExceeded');
        }
        console.log('[Usage Display] 버튼 비활성화 - 사용 한도 초과');
      }
    } else {
      if (summarizeBtn) {
        summarizeBtn.disabled = false;
        const buttonText = summarizeBtn.querySelector('span:last-child');
        if (buttonText) {
          buttonText.textContent =
            window.languageManager.getMessage('summarizeButton');
        }
        console.log('[Usage Display] 버튼 활성화');
      }
    }
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

  /**
   * ✨ Rate Limit 에러 처리 (카운트다운 포함)
   * @param {number} retryAfter - 재시도 가능까지 남은 초
   */
  handleRateLimitError(retryAfter) {
    console.log(`[SidePanel] Rate limit hit - retry after ${retryAfter} seconds`);

    // 기존 타이머 정리
    if (this.rateLimitTimer) {
      clearInterval(this.rateLimitTimer);
      this.rateLimitTimer = null;
    }

    this.rateLimitCountdown = retryAfter;

    // 요약 버튼 비활성화
    const summarizeBtn = window.uiManager.getElement('summarizeBtn');
    if (summarizeBtn) {
      summarizeBtn.disabled = true;
    }

    // 초기 메시지 표시
    this.displayRateLimitMessage();

    // 카운트다운 타이머 시작
    this.rateLimitTimer = setInterval(() => {
      this.rateLimitCountdown--;

      if (this.rateLimitCountdown <= 0) {
        // 카운트다운 완료
        clearInterval(this.rateLimitTimer);
        this.rateLimitTimer = null;
        this.rateLimitCountdown = null;

        // 버튼 다시 활성화
        if (summarizeBtn) {
          summarizeBtn.disabled = false;
        }

        // 완료 메시지
        const clearedMessage = window.languageManager.getMessage('rateLimitCleared') || 'Rate Limit이 해제되었습니다. 다시 시도해주세요.';
        window.uiManager.showToast(clearedMessage);
      } else {
        // 카운트다운 업데이트
        this.displayRateLimitMessage();
      }
    }, 1000);
  }

  /**
   * ✨ Rate Limit 카운트다운 메시지 표시
   */
  displayRateLimitMessage() {
    const seconds = this.rateLimitCountdown;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    let timeText;
    if (minutes > 0) {
      timeText = `${minutes}분 ${remainingSeconds}초`;
    } else {
      timeText = `${remainingSeconds}초`;
    }

    const message = `분당 10회 요약 제한을 초과했습니다. ${timeText} 후 다시 시도해주세요.`;
    window.uiManager.showError(message);
  }

  /**
   * ✨ 리셋 시간을 사용자 친화적 형식으로 변환
   * @param {string} resetTimeISO - ISO 형식의 리셋 시간
   * @returns {string} - "내일 오전 12시에 초기화됩니다" 형식의 문자열
   */
  formatResetTime(resetTimeISO) {
    if (!resetTimeISO) {
      return '내일 오전 12시에 초기화됩니다';
    }

    const resetDate = new Date(resetTimeISO);
    const now = new Date();

    // 날짜 차이 계산 (일 단위)
    const resetDay = new Date(resetDate.getFullYear(), resetDate.getMonth(), resetDate.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = resetDay.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // 시간 형식 (오전/오후 12시 형식)
    const hour = resetDate.getHours();
    const minute = resetDate.getMinutes();
    const ampm = hour < 12 ? '오전' : '오후';
    const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    const timeStr = minute === 0
      ? `${ampm} ${displayHour}시`
      : `${ampm} ${displayHour}시 ${minute}분`;

    // 날짜에 따른 메시지
    if (diffDays === 0) {
      return `오늘 ${timeStr}에 초기화됩니다`;
    } else if (diffDays === 1) {
      return `내일 ${timeStr}에 초기화됩니다`;
    } else if (diffDays === 2) {
      return `모레 ${timeStr}에 초기화됩니다`;
    } else {
      const month = resetDate.getMonth() + 1;
      const day = resetDate.getDate();
      return `${month}월 ${day}일 ${timeStr}에 초기화됩니다`;
    }
  }

  /**
   * 1회용 웹 로그인 토큰을 생성하고 웹사이트로 자동 로그인
   * @param {string} redirectPath - 로그인 후 리다이렉트할 경로 (기본: /subscription)
   */
  async openWebsiteWithAutoLogin(redirectPath = '/subscription') {
    try {
      // Firebase 로그인 확인
      const user = await new Promise((resolve) => {
        window.auth.onAuthStateChanged(resolve);
      });

      if (!user) {
        console.error('로그인이 필요합니다');
        alert(window.languageManager.getMessage('pleaseLogin') || '먼저 로그인해주세요');
        return;
      }

      // Firebase ID Token 가져오기
      const idToken = await user.getIdToken();

      // 백엔드에 1회용 토큰 요청
      const response = await fetch(
        `${window.CONFIG.BACKEND_URL}/api/auth/generate-web-login-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('토큰 생성 실패');
      }

      const data = await response.json();

      if (!data.success || !data.redirectUrl) {
        throw new Error('토큰 생성 실패');
      }

      // 웹사이트 URL에 리다이렉트 경로 추가
      const url = new URL(data.redirectUrl);
      url.searchParams.set('redirect', redirectPath);

      // 새 탭으로 웹사이트 열기
      chrome.tabs.create({
        url: url.toString(),
      });

      console.log('✅ 웹사이트로 자동 로그인 리다이렉트 완료');
    } catch (error) {
      console.error('웹 로그인 토큰 생성 실패:', error);
      // 실패 시 기본 URL로 이동 (로그인 필요)
      chrome.tabs.create({
        url: `https://genaai.net${redirectPath}`,
      });
    }
  }

  showUpgradeModal(type) {
    const existingModal = document.getElementById('upgradeModal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'upgradeModal';
    modal.className = 'modal';

    const typeText =
      type === 'summary'
        ? window.languageManager.getMessage('summaryFeature') || '요약'
        : window.languageManager.getMessage('questionFeature') || '질문';

    const remaining = window.usageManager.getRemainingCount(
      type === 'summary'
        ? window.USAGE_TYPE.SUMMARY
        : window.USAGE_TYPE.QUESTION
    );

    const resetTime = window.usageManager.getResetTime();
    const resetTimeText = this.formatResetTime(resetTime);

    modal.innerHTML = `
      <div class="modal-content upgrade-modal">
        <div class="modal-header">
          <h2>${
            window.languageManager.getMessage('upgradeToPremium') ||
            '프리미엄 업그레이드'
          }</h2>
          <button class="icon-btn close-modal">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="modal-body">
          <div class="upgrade-icon">
            <span class="material-icons">lock</span>
          </div>
          <h3>${
            window.languageManager.getMessage('dailyLimitReached') ||
            '오늘의 무료 사용량을 모두 소진했습니다'
          }</h3>
          <p class="upgrade-description">
            ${typeText} 기능을 계속 사용하려면 프리미엄으로 업그레이드하세요.
          </p>
          <div class="usage-info">
            <div class="info-row">
              <span class="info-label">${
                window.languageManager.getMessage('remainingToday') ||
                '오늘 남은 횟수'
              }:</span>
              <span class="info-value">${remaining}회</span>
            </div>
            <div class="info-row reset-time-row">
              <span class="info-value-full">🕐 ${resetTimeText}</span>
            </div>
          </div>
          <div class="premium-benefits">
            <h4>✨ ${
              window.languageManager.getMessage('premiumBenefits') ||
              '프리미엄 혜택'
            }</h4>
            <ul>
              <li>
                <span class="material-icons">check_circle</span>
                ${
                  window.languageManager.getMessage('unlimitedSummaries') ||
                  '무제한 요약'
                }
              </li>
              <li>
                <span class="material-icons">check_circle</span>
                ${
                  window.languageManager.getMessage('unlimitedQuestions') ||
                  '무제한 질문'
                }
              </li>
              <li>
                <span class="material-icons">check_circle</span>
                ${
                  window.languageManager.getMessage('prioritySupport') ||
                  '우선 지원'
                }
              </li>
              <li>
                <span class="material-icons">check_circle</span>
                ${
                  window.languageManager.getMessage('advancedFeatures') ||
                  '고급 기능'
                }
              </li>
            </ul>
          </div>
          <div class="upgrade-price">
            <span class="price">$4.99</span>
            <span class="period">/ ${
              window.languageManager.getMessage('month') || '월'
            }</span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="secondary-btn close-modal">
            ${window.languageManager.getMessage('maybeLater') || '나중에'}
          </button>
          <button class="primary-btn upgrade-btn">
            <span class="material-icons">workspace_premium</span>
            ${
              window.languageManager.getMessage('upgradeToPremium') ||
              '프리미엄 업그레이드'
            }
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
    upgradeBtn.addEventListener('click', async () => {
      // 1회용 토큰으로 자동 로그인 후 구독 페이지로 이동
      await this.openWebsiteWithAutoLogin('/subscription');
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  setupEventListeners() {
    const elements = window.uiManager.elements;

    // ✨ 요약하기 버튼 이벤트 리스너 추가
    if (elements.summarizeBtn) {
      elements.summarizeBtn.addEventListener('click', async () => {
        console.log('[SidePanel] 요약하기 버튼 클릭');

        // 1. UI 초기화 (이전 요약 내용 제거)
        this.currentSummary = null;
        window.uiManager.reset();

        // 2. 요약 시작
        await this.summarizePage();
      });
    }

    if (elements.copyBtn) {
      elements.copyBtn.addEventListener('click', () => this.copySummary());
    }

    if (elements.askBtn) {
      elements.askBtn.addEventListener('click', () => this.askQuestion());
    }

    if (elements.settingsBtn) {
      elements.settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }

    const closePanelBtn = document.getElementById('closePanelBtn');
    if (closePanelBtn) {
      closePanelBtn.addEventListener('click', () => {
        window.close();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.close();
      }
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    if (elements.questionInput) {
      elements.questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.askQuestion();
        }
      });
    }

    // ✨ v6.3 - 피드백 버튼 이벤트 리스너
    const feedbackGoodBtn = document.getElementById('feedbackGood');
    const feedbackBadBtn = document.getElementById('feedbackBad');

    if (feedbackGoodBtn) {
      feedbackGoodBtn.addEventListener('click', () => this.submitFeedback('good'));
    }

    if (feedbackBadBtn) {
      feedbackBadBtn.addEventListener('click', () => this.submitFeedback('bad'));
    }
  }

  /**
   * ✨ v6.3 - 피드백 제출
   */
  async submitFeedback(rating) {
    try {
      if (!this.currentHistoryId) {
        console.warn('[SidePanel] 피드백 제출 실패: historyId 없음');
        return;
      }

      console.log(`[SidePanel] 피드백 제출: ${rating}`);

      // Firestore에 피드백 저장
      await window.historyManager.updateHistory(this.currentHistoryId, {
        'feedback.rating': rating,
        'feedback.timestamp': Date.now()
      });

      // 피드백 UI 숨기고 감사 메시지 표시
      const feedbackSection = document.getElementById('summaryFeedback');
      const feedbackButtons = feedbackSection?.querySelector('.feedback-buttons');
      const feedbackQuestion = feedbackSection?.querySelector('.feedback-question');
      const thankYouMessage = document.getElementById('feedbackThankYou');

      if (feedbackButtons) feedbackButtons.classList.add('hidden');
      if (feedbackQuestion) feedbackQuestion.classList.add('hidden');
      if (thankYouMessage) thankYouMessage.classList.remove('hidden');

      // 2초 후 전체 피드백 섹션 숨김
      setTimeout(() => {
        if (feedbackSection) feedbackSection.classList.add('hidden');
      }, 2000);

      console.log('[SidePanel] 피드백 저장 완료');
    } catch (error) {
      console.error('[SidePanel] 피드백 제출 오류:', error);
      window.errorHandler?.handle(error, 'submit-feedback');
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
    if (this.settingsUnsubscribe) {
      this.settingsUnsubscribe();
      this.settingsUnsubscribe = null;
    }

    if (this.storageChangeListener) {
      chrome.storage.onChanged.removeListener(this.storageChangeListener);
      this.storageChangeListener = null;
      console.log('[Usage Update] Storage 리스너 제거');
    }

    if (this.visibilityChangeListener) {
      document.removeEventListener(
        'visibilitychange',
        this.visibilityChangeListener
      );
      this.visibilityChangeListener = null;
      console.log('[Usage Update] Visibility 리스너 제거');
    }

    if (this.focusListener) {
      window.removeEventListener('focus', this.focusListener);
      this.focusListener = null;
      console.log('[Usage Update] Focus 리스너 제거');
    }

    if (this.usagePollingInterval) {
      clearInterval(this.usagePollingInterval);
      this.usagePollingInterval = null;
      console.log('[Usage Update] 폴링 인터벌 제거');
    }

    this.stopKeepAlive();

    if (this.progressListener) {
      chrome.runtime.onMessage.removeListener(this.progressListener);
      this.progressListener = null;
      console.log('[SidePanel] 진행 상황 리스너 제거');
    }

    this.initialized = false;
    console.log('[SidePanel] cleanup 완료');
  }
}

const sidePanelApp = new SidePanelController();

document.addEventListener('DOMContentLoaded', () => {
  sidePanelApp.initialize().catch((error) => {
    console.error('[SidePanel] 앱 초기화 실패:', error);
    window.errorHandler.handle(error, 'sidepanel-initialization');
  });
});

window.addEventListener('beforeunload', () => {
  sidePanelApp.cleanup();
});