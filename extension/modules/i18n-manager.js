/**
 * extension\modules\i18n-manager.js
 * 다국어 지원 관리 모듈
 * Chrome Extension의 i18n API를 확장하여 런타임 언어 전환 지원
 * 
 * @version 1.0.0
 * @features
 * - 런타임 언어 전환 (한국어/영어)
 * - chrome.storage를 통한 언어 설정 저장
 * - 페이지의 모든 텍스트를 동적으로 업데이트
 * - data-i18n 속성을 사용한 자동 번역
 * 
 * @usage
 * // HTML에 data-i18n 속성 추가
 * <button data-i18n="loginButton">로그인</button>
 * 
 * // JavaScript에서 직접 가져오기
 * const text = i18nManager.getMessage('loginButton');
 */
class I18nManager {
  /**
   * I18nManager 생성자
   * @param {string} defaultLocale - 기본 언어 ('ko' 또는 'en')
   */
  constructor(defaultLocale = 'ko') {
    this.currentLocale = defaultLocale;
    this.messages = {};
    this.supportedLocales = ['ko', 'en'];
    
    // 로케일 정보
    this.localeInfo = {
      'ko': { name: '한국어', nativeName: '한국어', flag: '🇰🇷' },
      'en': { name: 'English', nativeName: 'English', flag: '🇺🇸' }
    };
    
    this.debug = false;
  }

  /**
   * 초기화: 저장된 언어 설정 로드 및 메시지 파일 로드
   * @returns {Promise<string>} - 현재 언어 코드
   */
  async initialize() {
    try {
      // 저장된 언어 설정 로드
      const savedLocale = await this.getSavedLocale();
      this.currentLocale = savedLocale || this.detectBrowserLocale();
      
      if (this.debug) {
        console.log('[I18nManager] Initialized with locale:', this.currentLocale);
      }
      
      // 메시지 파일 로드
      await this.loadMessages(this.currentLocale);
      
      return this.currentLocale;
    } catch (error) {
      console.error('[I18nManager] Initialization error:', error);
      this.currentLocale = 'ko'; // 폴백
      await this.loadMessages(this.currentLocale);
      return this.currentLocale;
    }
  }

  /**
   * 브라우저의 기본 언어 감지
   * @returns {string} - 언어 코드 ('ko' 또는 'en')
   */
  detectBrowserLocale() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split('-')[0]; // 'ko-KR' -> 'ko'
    
    // 지원하는 언어인지 확인
    return this.supportedLocales.includes(langCode) ? langCode : 'ko';
  }

  /**
   * 저장된 언어 설정 가져오기
   * @returns {Promise<string|null>} - 저장된 언어 코드 또는 null
   */
  async getSavedLocale() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['locale'], (result) => {
        resolve(result.locale || null);
      });
    });
  }

  /**
   * 언어 설정 저장
   * @param {string} locale - 저장할 언어 코드
   * @returns {Promise<void>}
   */
  async saveLocale(locale) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ locale }, () => {
        if (this.debug) {
          console.log('[I18nManager] Locale saved:', locale);
        }
        resolve();
      });
    });
  }

  /**
   * 메시지 파일 로드
   * @param {string} locale - 언어 코드
   * @returns {Promise<void>}
   */
  async loadMessages(locale) {
    try {
      const messagesPath = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
      const response = await fetch(messagesPath);
      
      if (!response.ok) {
        throw new Error(`Failed to load messages for locale: ${locale}`);
      }
      
      const messages = await response.json();
      this.messages[locale] = messages;
      
      if (this.debug) {
        console.log(`[I18nManager] Loaded ${Object.keys(messages).length} messages for ${locale}`);
      }
    } catch (error) {
      console.error('[I18nManager] Load messages error:', error);
      // 폴백: 빈 객체
      this.messages[locale] = {};
    }
  }

  /**
   * 메시지 가져오기
   * @param {string} key - 메시지 키
   * @param {Array<string>} [substitutions] - 치환할 값들
   * @returns {string} - 번역된 메시지
   */
  getMessage(key, substitutions = []) {
    const locale = this.currentLocale;
    const messages = this.messages[locale] || {};
    const messageObj = messages[key];
    
    if (!messageObj) {
      console.warn(`[I18nManager] Missing translation for key: ${key}`);
      return key; // 키를 그대로 반환
    }
    
    let message = messageObj.message || key;
    
    // 치환 처리 ($1, $2, ...)
    if (substitutions.length > 0) {
      substitutions.forEach((value, index) => {
        const placeholder = `$${index + 1}`;
        message = message.replace(placeholder, value);
      });
    }
    
    return message;
  }

  /**
   * 현재 언어 가져오기
   * @returns {string} - 현재 언어 코드
   */
  getCurrentLocale() {
    return this.currentLocale;
  }

  /**
   * 지원하는 언어 목록 가져오기
   * @returns {Array<Object>} - { code, name, nativeName, flag }
   */
  getSupportedLocales() {
    return this.supportedLocales.map(code => ({
      code,
      name: this.localeInfo[code].name,
      nativeName: this.localeInfo[code].nativeName,
      flag: this.localeInfo[code].flag
    }));
  }

  /**
   * 언어 변경
   * @param {string} locale - 새로운 언어 코드
   * @returns {Promise<boolean>} - 성공 여부
   */
  async changeLocale(locale) {
    if (!this.supportedLocales.includes(locale)) {
      console.error('[I18nManager] Unsupported locale:', locale);
      return false;
    }

    try {
      // 메시지 파일이 없으면 로드
      if (!this.messages[locale]) {
        await this.loadMessages(locale);
      }

      // 언어 변경
      this.currentLocale = locale;
      await this.saveLocale(locale);

      if (this.debug) {
        console.log('[I18nManager] Locale changed to:', locale);
      }

      // 페이지의 모든 텍스트 업데이트
      this.updatePageText();

      return true;
    } catch (error) {
      console.error('[I18nManager] Change locale error:', error);
      return false;
    }
  }

  /**
   * 언어 변경 (changeLocale의 별칭 - 더 직관적인 이름)
   * @param {string} language - 새로운 언어 코드
   * @returns {Promise<boolean>} - 성공 여부
   */
  async changeLanguage(language) {
    return this.changeLocale(language);
  }

  /**
   * 페이지의 모든 data-i18n 속성을 가진 요소의 텍스트 업데이트
   */
  updatePageText() {
    // data-i18n 속성을 가진 모든 요소 찾기
    const elements = document.querySelectorAll('[data-i18n]');
    
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const text = this.getMessage(key);
      
      // 텍스트 노드만 업데이트 (자식 요소 보존)
      if (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE) {
        element.textContent = text;
      } else {
        // placeholder 속성이 있는 경우
        if (element.hasAttribute('placeholder')) {
          element.setAttribute('placeholder', text);
        } else {
          element.textContent = text;
        }
      }
    });

    // data-i18n-placeholder 속성 처리
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      const text = this.getMessage(key);
      element.setAttribute('placeholder', text);
    });

    // data-i18n-title 속성 처리
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      const text = this.getMessage(key);
      element.setAttribute('title', text);
    });

    // data-i18n-aria-label 속성 처리
    const ariaElements = document.querySelectorAll('[data-i18n-aria-label]');
    ariaElements.forEach(element => {
      const key = element.getAttribute('data-i18n-aria-label');
      const text = this.getMessage(key);
      element.setAttribute('aria-label', text);
    });

    if (this.debug) {
      console.log('[I18nManager] Updated text for', elements.length, 'elements');
    }
  }

  /**
   * 언어별 텍스트 매핑
   * auth.html 전용 하드코딩 텍스트
   */
  getAuthText(key) {
    const texts = {
      'ko': {
        'login': '로그인',
        'signup': '회원가입',
        'email': '이메일',
        'password': '비밀번호',
        'passwordConfirm': '비밀번호 확인',
        'name': '이름',
        'rememberMe': '로그인 상태 유지',
        'forgotPassword': '비밀번호 찾기',
        'loginButton': '로그인',
        'signupButton': '회원가입',
        'noAccount': '계정이 없으신가요?',
        'hasAccount': '이미 계정이 있으신가요?',
        'emailPlaceholder': 'email@example.com',
        'passwordPlaceholder': '비밀번호를 입력하세요',
        'passwordConfirmPlaceholder': '비밀번호를 다시 입력하세요',
        'namePlaceholder': '홍길동',
        'passwordRequirement': '8자 이상, 영문 대소문자, 숫자 포함',
        'passwordWeak': '약함',
        'passwordMedium': '보통',
        'passwordStrong': '강함',
        'resetPasswordTitle': '비밀번호 재설정',
        'resetPasswordDesc': '가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다.',
        'sendResetLink': '재설정 링크 전송',
        'cancel': '취소',
        'close': '닫기',
        'loginSuccess': '로그인 성공!',
        'loginSuccessDesc': 'Gena 확장 프로그램 아이콘을\n클릭하여 사용을 시작하세요.',
        'or': '또는',
        'language': '언어'
      },
      'en': {
        'login': 'Login',
        'signup': 'Sign Up',
        'email': 'Email',
        'password': 'Password',
        'passwordConfirm': 'Confirm Password',
        'name': 'Name',
        'rememberMe': 'Remember me',
        'forgotPassword': 'Forgot password?',
        'loginButton': 'Login',
        'signupButton': 'Sign Up',
        'noAccount': "Don't have an account?",
        'hasAccount': 'Already have an account?',
        'emailPlaceholder': 'email@example.com',
        'passwordPlaceholder': 'Enter your password',
        'passwordConfirmPlaceholder': 'Re-enter your password',
        'namePlaceholder': 'John Doe',
        'passwordRequirement': 'Min 8 characters, uppercase, lowercase, and numbers',
        'passwordWeak': 'Weak',
        'passwordMedium': 'Medium',
        'passwordStrong': 'Strong',
        'resetPasswordTitle': 'Reset Password',
        'resetPasswordDesc': 'Enter your email address and we will send you a password reset link.',
        'sendResetLink': 'Send Reset Link',
        'cancel': 'Cancel',
        'close': 'Close',
        'loginSuccess': 'Login Successful!',
        'loginSuccessDesc': 'Click the Gena extension icon\nto start using it.',
        'or': 'or',
        'language': 'Language'
      }
    };

    return texts[this.currentLocale]?.[key] || key;
  }
}

// 전역으로 사용할 수 있도록 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = I18nManager;
}