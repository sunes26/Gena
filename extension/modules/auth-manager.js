/**
 * extension\modules\auth-manager.js
 * Firebase Authentication 기반 인증 관리자
 *
 * @version 4.1.0 - 로그인 유지 기능 개선
 *
 * ✨ v4.1.0 주요 변경사항:
 * - rememberMe에 따른 동적 Firebase Persistence 설정
 *   - rememberMe = true → LOCAL (브라우저 닫아도 로그인 유지)
 *   - rememberMe = false → SESSION (브라우저 닫으면 로그아웃)
 *
 * ✨ v4.0.0 주요 변경사항:
 * - Firebase Persistence 설정 추가
 * - onIdTokenChanged 리스너 추가 (자동 토큰 갱신)
 * - Refresh Token 저장 로직 추가
 */

class AuthManager {
  constructor(apiBaseURL, tokenManager) {
    this.apiClient = new ApiClient(apiBaseURL, tokenManager);
    this.tokenManager = tokenManager;
    this.currentUser = null;
    this.firebaseAuth = null;
    
    // Firebase 초기화
    this.initializeFirebase();
    
    this.debug = (typeof CONFIG !== 'undefined' && CONFIG) ? CONFIG.isDebug() : false;
    
    if (this.debug) {
      console.log('[AuthManager] Initialized with Firebase Auth v4.1.0');
    }
  }

  /**
   * Firebase 초기화
   * ✨ v4.0.0: Persistence 설정 및 자동 토큰 갱신 리스너 추가
   */
  async initializeFirebase() {
    try {
      const firebaseConfig = CONFIG.getFirebaseConfig();
      
      // Firebase App 초기화
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase 초기화 완료');
      }
      
      // Firebase Auth 인스턴스
      this.firebaseAuth = firebase.auth();
      
      // ✨ 1. 기본 로그인 설정 (SESSION persistence - 브라우저 닫으면 로그아웃)
      // 실제 persistence는 login() 메서드에서 rememberMe 값에 따라 동적 설정
      await this.firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
      console.log('✅ Firebase Persistence 기본값: SESSION (브라우저 세션 유지)');
      
      // 언어 설정
      this.firebaseAuth.languageCode = 'ko';
      
      // ✨ 2. 토큰 자동 갱신 리스너
      this.firebaseAuth.onIdTokenChanged(async (user) => {
        if (user) {
          try {
            console.log('[Firebase Auth] 🔄 토큰 갱신 감지:', user.email);
            
            // Firebase가 자동으로 갱신한 새 토큰 가져오기
            const newIdToken = await user.getIdToken();
            
            // 기존 Refresh Token 유지 (또는 새로 가져오기)
            const existingRefreshToken = await this.tokenManager.getRefreshToken();
            const refreshToken = existingRefreshToken || user.refreshToken;
            
            // TokenManager에 업데이트
            await this.tokenManager.saveTokens(newIdToken, refreshToken);
            
            console.log('[Firebase Auth] ✅ 토큰 자동 갱신 완료');
          } catch (error) {
            console.error('[Firebase Auth] ❌ 토큰 갱신 실패:', error);
          }
        } else {
          console.log('[Firebase Auth] 로그아웃 상태');
        }
      });
      
      // ✨ 3. Auth 상태 변경 리스너 (기존 로직 유지)
      this.firebaseAuth.onAuthStateChanged(async (user) => {
        if (user) {
          console.log('[Firebase Auth] 사용자 로그인:', user.email);
          this.currentUser = user;
        } else {
          console.log('[Firebase Auth] 사용자 로그아웃');
          this.currentUser = null;
        }
      });
      
    } catch (error) {
      console.error('❌ Firebase 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 이메일 형식 검증
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 비밀번호 강도 검증
   */
  validatePassword(password) {
    if (password.length < 8) {
      return { valid: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: '비밀번호에 대문자를 포함해야 합니다.' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: '비밀번호에 소문자를 포함해야 합니다.' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: '비밀번호에 숫자를 포함해야 합니다.' };
    }
    return { valid: true, message: '비밀번호가 안전합니다.' };
  }

  /**
   * 회원가입 - Firebase Authentication 사용
   * ✨ v4.0.0: Firebase Refresh Token 저장 추가
   */
  async signup(email, password, name, confirmPassword) {
    // 입력값 검증
    if (!this.validateEmail(email)) {
      throw new Error('유효한 이메일 주소를 입력해주세요.');
    }

    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.message);
    }

    if (!name || name.trim().length < 2) {
      throw new Error('이름은 최소 2자 이상이어야 합니다.');
    }

    if (password !== confirmPassword) {
      throw new Error('비밀번호가 일치하지 않습니다.');
    }

    try {
      console.log('[AuthManager] Firebase 회원가입 시작:', email);
      
      // 1️⃣ Firebase Authentication에 사용자 생성
      const userCredential = await this.firebaseAuth.createUserWithEmailAndPassword(
        email.trim().toLowerCase(),
        password
      );
      
      const user = userCredential.user;
      console.log('✅ Firebase 사용자 생성:', user.uid);
      
      // 2️⃣ 프로필 업데이트 (displayName)
      await user.updateProfile({
        displayName: name.trim()
      });
      
      // 3️⃣ 이메일 인증 메일 발송
      await user.sendEmailVerification({
        url: CONFIG.getFrontendUrl() + '/email-verified',
        handleCodeInApp: false
      });
      
      console.log('✅ 이메일 인증 메일 발송');
      
      // 4️⃣ Firebase ID Token 가져오기
      const idToken = await user.getIdToken();
      
      // ✨ 5️⃣ Firebase Refresh Token 가져오기 (중요!)
      const firebaseRefreshToken = user.refreshToken;
      console.log('✅ Firebase Refresh Token 획득');
      
      // 6️⃣ 서버에 회원가입 알림 (Firestore 프로필 생성)
      try {
        const response = await this.apiClient.post('/api/auth/signup', {
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          confirmPassword
        }, { skipAuth: true });
        
        console.log('✅ 서버 회원가입 완료');
      } catch (serverError) {
        console.warn('⚠️ 서버 회원가입 실패 (Firebase는 성공):', serverError.message);
      }
      
      // ✨ 7️⃣ ID Token과 Refresh Token 모두 저장
      await this.tokenManager.saveTokens(idToken, firebaseRefreshToken);
      console.log('✅ 토큰 저장 완료 (Access + Refresh)');
      
      this.currentUser = user;
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified
        },
        message: '회원가입이 완료되었습니다. 이메일 인증을 완료해주세요.'
      };
      
    } catch (error) {
      console.error('[AuthManager] 회원가입 실패:', error);
      
      // Firebase 에러 메시지 한글화
      const errorMessage = this.getFirebaseErrorMessage(error.code);
      throw new Error(errorMessage);
    }
  }

  /**
   * 로그인 - Firebase Authentication 사용
   * ✨ v4.0.0: Firebase Refresh Token 저장 추가
   * ✨ v4.1.0: rememberMe에 따른 동적 Persistence 설정
   */
  async login(email, password, rememberMe = false) {
    if (!this.validateEmail(email)) {
      throw new Error('유효한 이메일 주소를 입력해주세요.');
    }

    if (!password || password.length < 8) {
      throw new Error('비밀번호를 입력해주세요.');
    }

    try {
      console.log('[AuthManager] Firebase 로그인 시도:', email);
      console.log('[AuthManager] 로그인 상태 유지:', rememberMe ? 'ON (영구 로그인)' : 'OFF (세션만 유지)');

      // 1️⃣ rememberMe에 따라 Firebase Persistence 설정
      const persistence = rememberMe
        ? firebase.auth.Auth.Persistence.LOCAL   // 브라우저 닫아도 로그인 유지
        : firebase.auth.Auth.Persistence.SESSION; // 브라우저 닫으면 로그아웃

      await this.firebaseAuth.setPersistence(persistence);
      console.log('✅ Firebase Persistence 설정:', rememberMe ? 'LOCAL' : 'SESSION');

      // 2️⃣ Firebase Authentication 로그인
      const userCredential = await this.firebaseAuth.signInWithEmailAndPassword(
        email.trim().toLowerCase(),
        password
      );
      
      const user = userCredential.user;
      console.log('✅ Firebase 로그인 성공:', user.uid);

      // 3️⃣ Firebase ID Token 가져오기
      const idToken = await user.getIdToken();

      // ✨ 4️⃣ Firebase Refresh Token 가져오기 (중요!)
      const firebaseRefreshToken = user.refreshToken;
      console.log('✅ Firebase Refresh Token 획득');

      // 5️⃣ 서버에 로그인 알림 (선택사항)
      try {
        await this.apiClient.post('/api/auth/login', {
          idToken
        }, { skipAuth: true });

        console.log('✅ 서버 로그인 완료');
      } catch (serverError) {
        console.warn('⚠️ 서버 로그인 실패 (Firebase는 성공):', serverError.message);
      }

      // ✨ 6️⃣ ID Token과 Refresh Token 모두 저장
      await this.tokenManager.saveTokens(idToken, firebaseRefreshToken);
      console.log('✅ 토큰 저장 완료 (Access + Refresh)');

      // 7️⃣ 로그인 상태 유지 설정 저장 (디버깅용)
      await this.saveRememberMe(rememberMe);
      
      this.currentUser = user;
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified
        },
        message: '로그인되었습니다.'
      };
      
    } catch (error) {
      console.error('[AuthManager] 로그인 실패:', error);
      
      const errorMessage = this.getFirebaseErrorMessage(error.code);
      throw new Error(errorMessage);
    }
  }

  /**
   * 로그아웃
   */
  async logout() {
    try {
      console.log('[AuthManager] 로그아웃 시도');
      
      // 1️⃣ Firebase 로그아웃
      await this.firebaseAuth.signOut();
      
      // 2️⃣ 로컬 토큰 삭제
      await this.tokenManager.clearTokens();
      
      this.currentUser = null;
      
      console.log('✅ 로그아웃 완료');
      
      return {
        success: true,
        message: '로그아웃되었습니다.'
      };
      
    } catch (error) {
      console.error('[AuthManager] 로그아웃 실패:', error);
      throw new Error('로그아웃 중 오류가 발생했습니다.');
    }
  }

  /**
   * 현재 로그인한 사용자 정보 조회
   */
  async getCurrentUser() {
    if (this.currentUser) {
      return {
        uid: this.currentUser.uid,
        email: this.currentUser.email,
        displayName: this.currentUser.displayName,
        emailVerified: this.currentUser.emailVerified
      };
    }
    
    const user = this.firebaseAuth.currentUser;
    if (user) {
      this.currentUser = user;
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified
      };
    }
    
    return null;
  }

  /**
   * 로그인 상태 확인
   */
  async isLoggedIn() {
    const user = this.firebaseAuth.currentUser;
    return user !== null;
  }

  /**
   * 로그인 상태 유지 설정 저장
   */
  async saveRememberMe(rememberMe) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ rememberMe }, resolve);
    });
  }

  /**
   * 로그인 상태 유지 설정 조회
   */
  async getRememberMe() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['rememberMe'], (result) => {
        resolve(result.rememberMe || false);
      });
    });
  }

  /**
   * 비밀번호 재설정 요청
   */
  async requestPasswordReset(email) {
    if (!this.validateEmail(email)) {
      throw new Error('유효한 이메일 주소를 입력해주세요.');
    }

    try {
      console.log('[AuthManager] 비밀번호 재설정 요청:', email);
      
      await this.firebaseAuth.sendPasswordResetEmail(
        email.trim().toLowerCase(),
        {
          url: CONFIG.getFrontendUrl() + '/reset-password-complete',
          handleCodeInApp: false
        }
      );
      
      return {
        success: true,
        message: '비밀번호 재설정 이메일이 전송되었습니다.'
      };
      
    } catch (error) {
      console.error('[AuthManager] 비밀번호 재설정 실패:', error);
      const errorMessage = this.getFirebaseErrorMessage(error.code);
      throw new Error(errorMessage);
    }
  }

  /**
   * Firebase 에러 메시지 한글화
   */
  getFirebaseErrorMessage(errorCode) {
    const errorMessages = {
      'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
      'auth/invalid-email': '유효하지 않은 이메일 주소입니다.',
      'auth/operation-not-allowed': '이메일/비밀번호 로그인이 비활성화되어 있습니다.',
      'auth/weak-password': '비밀번호가 너무 약합니다. 최소 8자 이상 입력해주세요.',
      'auth/user-disabled': '비활성화된 계정입니다.',
      'auth/user-not-found': '등록되지 않은 이메일입니다.',
      'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
      'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
      'auth/too-many-requests': '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.',
      'auth/network-request-failed': '네트워크 연결을 확인해주세요.'
    };

    // 디버깅: 에러 코드 로깅
    if (!errorMessages[errorCode]) {
      console.warn('[AuthManager] 알 수 없는 Firebase 에러 코드:', errorCode);
    }

    return errorMessages[errorCode] || '인증 중 오류가 발생했습니다. 이메일과 비밀번호를 확인해주세요.';
  }
}

// 전역으로 사용할 수 있도록 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManager;
}