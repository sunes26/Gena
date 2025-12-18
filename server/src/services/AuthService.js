/**
 * 인증 서비스 - Firebase Authentication 사용
 * 사용자 회원가입, 로그인, 프로필 관리 기능 제공
 * Singleton 패턴으로 구현
 * 
 * @module services/AuthService
 * @version 3.0.0 - Firebase Authentication 전환
 * 
 * 📝 주요 변경사항:
 * - bcrypt 제거 → Firebase Auth가 비밀번호 관리
 * - passwordHash 제거 → Firebase가 자동 처리
 * - Firebase ID Token 검증 추가
 * - 이메일 인증 링크 생성 기능 추가
 * - OAuth 로그인 지원 준비
 */

const { getFirestore, getAdmin, isFirebaseInitialized } = require('../config/firebase');
const { maskUserId } = require('../utils/privacy');
const {
  ValidationError,
  AuthenticationError,
  NotFoundError,
  DatabaseError
} = require('../middleware/errorHandler');
const {
  COLLECTIONS,
  USER_ROLES,
  SUBSCRIPTION_PLANS,
  ERROR_MESSAGES
} = require('../constants');

/**
 * 이메일 유효성 검증 정규식
 * RFC 5322 기본 패턴
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 인증 서비스 클래스
 * Firebase Authentication + Firestore 사용
 */
class AuthService {
  constructor() {
    /**
     * Firestore 데이터베이스 인스턴스
     * @type {admin.firestore.Firestore | null}
     * @private
     */
    this.db = null;

    /**
     * Firebase Auth 인스턴스
     * @type {admin.auth.Auth | null}
     * @private
     */
    this.auth = null;

    /**
     * Firebase 사용 가능 여부
     * @type {boolean}
     * @private
     */
    this.isFirestoreAvailable = false;

    // Firebase 초기화 (생성자에서 시도)
    this._initializeFirebase();
  }

  /**
   * Firebase 초기화 (내부 메서드)
   * @private
   */
  _initializeFirebase() {
    try {
      if (isFirebaseInitialized()) {
        this.db = getFirestore();
        this.auth = getAdmin().auth();
        this.isFirestoreAvailable = true;
        console.log('✅ AuthService: Firebase Auth & Firestore 연결 성공');
      } else {
        console.warn('⚠️  AuthService: Firebase가 초기화되지 않았습니다');
      }
    } catch (error) {
      console.error('❌ AuthService: Firebase 초기화 실패:', error.message);
      this.isFirestoreAvailable = false;
    }
  }

  /**
   * Firebase 재초기화 (server.js에서 호출)
   * Firebase 초기화 후 이 메서드를 호출하여 연결
   * 
   * @returns {Promise<void>}
   * @throws {Error} Firebase 초기화 실패 시
   */
  async initialize() {
    try {
      if (isFirebaseInitialized()) {
        this.db = getFirestore();
        this.auth = getAdmin().auth();
        this.isFirestoreAvailable = true;
        console.log('✅ AuthService: Firebase Auth 재초기화 완료');
      } else {
        throw new Error('Firebase가 초기화되지 않았습니다');
      }
    } catch (error) {
      console.error('❌ AuthService: 재초기화 실패:', error.message);
      this.isFirestoreAvailable = false;
      throw error;
    }
  }

  /**
   * Firebase 사용 가능 여부 확인
   * @returns {boolean} 사용 가능 여부
   */
  isAvailable() {
    return this.isFirestoreAvailable && this.db !== null && this.auth !== null;
  }

  /**
   * Firebase 연결 확인
   * @private
   * @throws {DatabaseError} Firebase를 사용할 수 없는 경우
   */
  _checkFirebase() {
    if (!this.isAvailable()) {
      throw new DatabaseError('Firebase를 사용할 수 없습니다');
    }
  }

  /**
   * 이메일 유효성 검증
   * @private
   * @param {string} email - 검증할 이메일
   * @throws {ValidationError} 이메일이 유효하지 않은 경우
   */
  _validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('이메일을 입력해주세요');
    }

    if (!EMAIL_REGEX.test(email)) {
      throw new ValidationError('유효하지 않은 이메일 형식입니다');
    }
  }

  /**
   * 사용자 데이터 새니타이징 (민감 정보 제거)
   * @private
   * @param {Object} userData - 사용자 데이터
   * @returns {Object} 새니타이징된 사용자 데이터
   */
  _sanitizeUserData(userData) {
    const { passwordHash, ...safeData } = userData;
    return safeData;
  }

  // ===== 회원가입 (Firebase Authentication) =====

  /**
   * 회원가입 - Firebase Authentication 사용
   * 
   * @param {string} email - 사용자 이메일
   * @param {string} password - 사용자 비밀번호 (8자 이상)
   * @param {string} [name] - 사용자 이름 (선택)
   * @returns {Promise<Object>} 생성된 사용자 정보
   * @returns {Object} returns.user - 사용자 정보 (Firestore)
   * @returns {string} returns.customToken - Firebase 커스텀 토큰
   * @returns {string} returns.emailVerificationLink - 이메일 인증 링크
   * @returns {string} returns.uid - Firebase UID
   * @throws {ValidationError} 입력값이 유효하지 않은 경우
   * @throws {DatabaseError} 이메일이 이미 존재하는 경우
   * 
   * @example
   * const result = await authService.signup(
   *   'user@example.com',
   *   'SecureP@ss123',
   *   'John Doe'
   * );
   * // result.customToken을 클라이언트에 전달
   * // result.emailVerificationLink를 이메일로 발송
   */
  async signup(email, password, name = null) {
    this._checkFirebase();

    // 입력 검증
    this._validateEmail(email);

    if (!password || typeof password !== 'string') {
      throw new ValidationError('비밀번호를 입력해주세요');
    }

    if (password.length < 8) {
      throw new ValidationError('비밀번호는 최소 8자 이상이어야 합니다');
    }

    // 이메일 소문자 변환
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // 1. Firebase Authentication에 사용자 생성
      const userRecord = await this.auth.createUser({
        email: normalizedEmail,
        password: password,
        displayName: name || null,
        emailVerified: false // 이메일 인증 필수
      });

      console.log(`✅ Firebase Auth 사용자 생성: ${userRecord.uid}`);

      // 2. Firestore에 사용자 프로필 저장
      const now = new Date();
      const userData = {
        id: userRecord.uid, // Firebase Auth UID 사용
        email: normalizedEmail,
        name: name || null,
        isPremium: false,
        role: USER_ROLES.USER,
        subscriptionPlan: SUBSCRIPTION_PLANS.FREE,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        metadata: {
          emailVerified: false,
          loginCount: 1,
          signupMethod: 'email'
        }
      };

      await this.db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set(userData);

      console.log(`✅ Firestore 프로필 생성: ${userRecord.uid}`);

      // 3. 커스텀 토큰 생성 (클라이언트에서 signInWithCustomToken 사용)
      const customToken = await this.auth.createCustomToken(userRecord.uid, {
        email: normalizedEmail,
        isPremium: false,
        role: USER_ROLES.USER
      });

      // 4. 이메일 인증 링크 생성
      const emailVerificationLink = await this.auth.generateEmailVerificationLink(
        normalizedEmail,
        {
          url: `${process.env.FRONTEND_URL}/email-verified`,
          handleCodeInApp: true
        }
      );

      console.log(`✅ 회원가입 성공: ${normalizedEmail} (UID: ${userRecord.uid})`);

      return {
        user: this._sanitizeUserData(userData),
        customToken,
        emailVerificationLink, // EmailService로 발송
        uid: userRecord.uid
      };

    } catch (error) {
      // Firebase 특정 에러 처리
      if (error.code === 'auth/email-already-exists') {
        throw new ValidationError(ERROR_MESSAGES.DUPLICATE_EMAIL);
      }
      if (error.code === 'auth/invalid-email') {
        throw new ValidationError('유효하지 않은 이메일입니다');
      }
      if (error.code === 'auth/weak-password') {
        throw new ValidationError('비밀번호가 너무 약합니다 (최소 8자)');
      }

      console.error('회원가입 실패:', error);
      throw new DatabaseError(`회원가입 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  // ===== Firebase ID Token 검증 =====

  /**
   * Firebase ID Token 검증
   * 클라이언트에서 받은 ID Token을 검증
   * 
   * @param {string} idToken - Firebase ID Token
   * @returns {Promise<Object>} 디코딩된 토큰 정보
   * @returns {string} returns.uid - 사용자 UID
   * @returns {string} returns.email - 사용자 이메일
   * @returns {boolean} returns.email_verified - 이메일 인증 여부
   * @throws {AuthenticationError} 토큰이 유효하지 않은 경우
   * 
   * @example
   * const decodedToken = await authService.verifyIdToken(idToken);
   * console.log(decodedToken.uid); // 'abc123...'
   */
  async verifyIdToken(idToken) {
    this._checkFirebase();

    try {
      const decodedToken = await this.auth.verifyIdToken(idToken, true); // checkRevoked=true
      return decodedToken;
    } catch (error) {
      if (error.code === 'auth/id-token-expired') {
        throw new AuthenticationError('토큰이 만료되었습니다');
      }
      if (error.code === 'auth/id-token-revoked') {
        throw new AuthenticationError('토큰이 취소되었습니다');
      }
      if (error.code === 'auth/argument-error') {
        throw new AuthenticationError('유효하지 않은 토큰 형식입니다');
      }
      throw new AuthenticationError('유효하지 않은 토큰입니다');
    }
  }

  // ===== 사용자 조회 =====

  /**
   * UID로 사용자 조회
   * 
   * @param {string} userId - 사용자 고유 식별자 (Firebase UID)
   * @returns {Promise<Object>} 사용자 정보 (비밀번호 해시 제외)
   * @throws {ValidationError} userId가 유효하지 않은 경우
   * @throws {NotFoundError} 사용자를 찾을 수 없는 경우
   * 
   * @example
   * const user = await authService.getUserById('abc123uid');
   */
  async getUserById(userId) {
    this._checkFirebase();

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('유효하지 않은 사용자 ID입니다');
    }

    try {
      const userDoc = await this.db
        .collection(COLLECTIONS.USERS)
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      const userData = userDoc.data();
      return this._sanitizeUserData(userData);

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      console.error('사용자 조회 실패:', error);
      throw new DatabaseError(`사용자 조회 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /**
   * 이메일로 사용자 조회
   * Firebase Auth와 Firestore 모두 조회
   * 
   * @param {string} email - 사용자 이메일
   * @returns {Promise<Object>} 사용자 정보
   * @throws {ValidationError} 이메일이 유효하지 않은 경우
   * @throws {NotFoundError} 사용자를 찾을 수 없는 경우
   * 
   * @example
   * const user = await authService.getUserByEmail('user@example.com');
   */
  async getUserByEmail(email) {
    this._checkFirebase();

    this._validateEmail(email);
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Firebase Auth에서 조회
      const userRecord = await this.auth.getUserByEmail(normalizedEmail);
      
      // Firestore에서 프로필 조회
      const userDoc = await this.db
        .collection(COLLECTIONS.USERS)
        .doc(userRecord.uid)
        .get();

      if (!userDoc.exists) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      const userData = userDoc.data();
      return this._sanitizeUserData(userData);

    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      console.error('사용자 조회 실패:', error);
      throw new DatabaseError(`사용자 조회 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  // ===== 프로필 업데이트 =====

  /**
   * 사용자 프로필 업데이트
   * 
   * @param {string} userId - 사용자 고유 식별자
   * @param {Object} updates - 업데이트할 필드
   * @param {string} [updates.name] - 사용자 이름
   * @param {boolean} [updates.isPremium] - 프리미엄 여부
   * @param {string} [updates.subscriptionPlan] - 구독 플랜
   * @returns {Promise<Object>} 업데이트된 사용자 정보
   * @throws {ValidationError} 입력값이 유효하지 않은 경우
   * @throws {NotFoundError} 사용자를 찾을 수 없는 경우
   * 
   * @example
   * const updatedUser = await authService.updateProfile('user123', {
   *   name: 'Jane Doe',
   *   isPremium: true
   * });
   */
  async updateProfile(userId, updates) {
    this._checkFirebase();

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('유효하지 않은 사용자 ID입니다');
    }

    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('업데이트할 정보를 제공해주세요');
    }

    // 수정 불가 필드 제거
    const forbiddenFields = ['id', 'email', 'passwordHash', 'createdAt', 'role'];
    const sanitizedUpdates = { ...updates };
    forbiddenFields.forEach(field => delete sanitizedUpdates[field]);

    // 업데이트할 필드가 없는 경우
    if (Object.keys(sanitizedUpdates).length === 0) {
      throw new ValidationError('업데이트할 유효한 필드가 없습니다');
    }

    try {
      const userRef = this.db.collection(COLLECTIONS.USERS).doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new NotFoundError(ERROR_MESSAGES.USER_NOT_FOUND);
      }

      // updatedAt 추가
      sanitizedUpdates.updatedAt = new Date();

      // 1. Firestore 업데이트 먼저 수행 (SSOT)
      await userRef.update(sanitizedUpdates);
      console.log(`✅ Firestore 프로필 업데이트 성공: ${maskUserId(userId)}`);

      // 2. Firebase Auth 동기화 (실패해도 Firestore는 이미 성공)
      if (sanitizedUpdates.name) {
        try {
          await this.auth.updateUser(userId, {
            displayName: sanitizedUpdates.name
          });
          console.log(`✅ Firebase Auth displayName 동기화 성공: ${maskUserId(userId)}`);
        } catch (authError) {
          // Firebase Auth 동기화 실패는 치명적이지 않음 (Firestore가 SSOT)
          console.warn(`⚠️ Firebase Auth 동기화 실패 (Firestore는 성공): ${maskUserId(userId)}`, authError.message);
          // 계속 진행 (에러 던지지 않음)
        }
      }

      // 업데이트된 사용자 데이터 조회
      const updatedDoc = await userRef.get();
      const updatedData = updatedDoc.data();

      console.log(`✅ 프로필 업데이트 완료: ${maskUserId(userId)}`);
      return this._sanitizeUserData(updatedData);

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      console.error('프로필 업데이트 실패:', error);
      throw new DatabaseError(`프로필 업데이트 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  // ===== 비밀번호 변경 (Firebase Auth) =====

  /**
   * 비밀번호 변경
   * Firebase Authentication의 비밀번호 업데이트 사용
   * 
   * @param {string} userId - 사용자 고유 식별자
   * @param {string} newPassword - 새 비밀번호
   * @returns {Promise<Object>} 성공 메시지
   * @throws {ValidationError} 입력값이 유효하지 않은 경우
   * 
   * @example
   * await authService.changePassword('user123', 'NewP@ss456');
   */
  async changePassword(userId, newPassword) {
    this._checkFirebase();

    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('유효하지 않은 사용자 ID입니다');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new ValidationError('비밀번호는 최소 8자 이상이어야 합니다');
    }

    try {
      // Firebase Auth에서 비밀번호 업데이트
      await this.auth.updateUser(userId, {
        password: newPassword
      });

      // Firestore updatedAt 업데이트
      await this.db.collection(COLLECTIONS.USERS).doc(userId).update({
        updatedAt: new Date()
      });

      console.log(`✅ 비밀번호 변경 성공: ${userId}`);

      return {
        success: true,
        message: '비밀번호가 성공적으로 변경되었습니다'
      };

    } catch (error) {
      console.error('비밀번호 변경 실패:', error);
      throw new DatabaseError(`비밀번호 변경 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  // ===== 이메일 인증 =====

  /**
   * 이메일 인증 링크 생성
   * 
   * @param {string} email - 사용자 이메일
   * @returns {Promise<string>} 이메일 인증 링크
   * 
   * @example
   * const link = await authService.generateEmailVerificationLink('user@example.com');
   * // EmailService로 발송
   */
  async generateEmailVerificationLink(email) {
    this._checkFirebase();
    this._validateEmail(email);

    try {
      const link = await this.auth.generateEmailVerificationLink(
        email,
        {
          url: `${process.env.FRONTEND_URL}/email-verified`,
          handleCodeInApp: true
        }
      );

      return link;
    } catch (error) {
      console.error('이메일 인증 링크 생성 실패:', error);
      throw new DatabaseError('이메일 인증 링크 생성 중 오류가 발생했습니다');
    }
  }

  /**
   * 이메일 인증 상태 업데이트
   * 
   * @param {string} userId - 사용자 UID
   * @param {boolean} verified - 인증 여부
   * @returns {Promise<void>}
   */
  async updateEmailVerificationStatus(userId, verified = true) {
    this._checkFirebase();

    try {
      // Firebase Auth에서 업데이트
      await this.auth.updateUser(userId, {
        emailVerified: verified
      });

      // Firestore에도 업데이트
      await this.db.collection(COLLECTIONS.USERS).doc(userId).update({
        'metadata.emailVerified': verified,
        'metadata.emailVerifiedAt': verified ? new Date() : null,
        updatedAt: new Date()
      });

      console.log(`✅ 이메일 인증 상태 업데이트: ${userId} - ${verified}`);
    } catch (error) {
      console.error('이메일 인증 상태 업데이트 실패:', error);
      throw error;
    }
  }

  // ===== 비밀번호 재설정 링크 생성 =====

  /**
   * 비밀번호 재설정 링크 생성
   * 
   * @param {string} email - 사용자 이메일
   * @returns {Promise<string>} 비밀번호 재설정 링크
   * 
   * @example
   * const link = await authService.generatePasswordResetLink('user@example.com');
   */
  async generatePasswordResetLink(email) {
    this._checkFirebase();
    this._validateEmail(email);

    try {
      const link = await this.auth.generatePasswordResetLink(
        email,
        {
          url: `${process.env.FRONTEND_URL}/reset-password-complete`,
          handleCodeInApp: true
        }
      );

      return link;
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // 보안: 사용자 존재 여부 노출 방지
        console.log('비밀번호 재설정 요청 (사용자 없음):', email);
        return null;
      }
      console.error('비밀번호 재설정 링크 생성 실패:', error);
      throw new DatabaseError('비밀번호 재설정 링크 생성 중 오류가 발생했습니다');
    }
  }
}

// Singleton 인스턴스 생성 및 export
const authService = new AuthService();

module.exports = authService;