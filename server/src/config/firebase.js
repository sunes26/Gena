/**
 * Firebase Admin SDK 초기화 및 설정
 * Singleton 패턴으로 구현되어 애플리케이션 전체에서 하나의 인스턴스만 사용
 * 
 * 지원하는 초기화 방법:
 * 1. serviceAccountKey.json 파일 (프로덕션 권장)
 * 2. GOOGLE_APPLICATION_CREDENTIALS 환경변수 (파일 경로)
 * 3. FIREBASE_SERVICE_ACCOUNT_KEY 환경변수 (JSON 문자열)
 * 4. Firebase Emulator (개발 환경)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/**
 * Firebase Admin 앱 인스턴스
 * Singleton 패턴을 위한 전역 변수
 * @type {admin.app.App | null}
 */
let firebaseApp = null;

/**
 * Firestore 데이터베이스 인스턴스
 * 초기화 후 캐싱하여 재사용
 * @type {admin.firestore.Firestore | null}
 */
let firestoreInstance = null;

/**
 * Firebase 초기화 상태
 * true: 초기화 완료, false: 미초기화
 * @type {boolean}
 */
let isInitialized = false;

/**
 * Firebase Admin SDK를 초기화합니다.
 * 여러 방법을 순차적으로 시도하여 가장 적합한 방법으로 초기화합니다.
 * 
 * @async
 * @returns {Promise<admin.app.App>} 초기화된 Firebase Admin 앱 인스턴스
 * @throws {Error} 초기화 실패 시 발생하는 에러
 * 
 * @example
 * const app = await initializeFirebase();
 * console.log('Firebase 초기화 완료:', app.name);
 */
async function initializeFirebase() {
  // 이미 초기화된 경우 기존 인스턴스 반환
  if (isInitialized && firebaseApp) {
    console.log('✅ Firebase는 이미 초기화되었습니다.');
    return firebaseApp;
  }

  console.log('🚀 Firebase Admin SDK 초기화 시작...');

  try {
    let credential = null;
    let initMethod = 'unknown';

    // 방법 1: serviceAccountKey.json 파일 직접 읽기 (가장 안전하고 권장)
    // server/serviceAccountKey.json 경로
    const serviceAccountPath = path.join(__dirname, '..', '..', 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      console.log('📁 방법 1: serviceAccountKey.json 파일 사용');
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      credential = admin.credential.cert(serviceAccount);
      initMethod = 'serviceAccountKey.json';
    }
    // 방법 2: GOOGLE_APPLICATION_CREDENTIALS 환경변수 (파일 경로)
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('📁 방법 2: GOOGLE_APPLICATION_CREDENTIALS 환경변수 사용');
      const credPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      
      if (!fs.existsSync(credPath)) {
        throw new Error(`서비스 계정 키 파일을 찾을 수 없습니다: ${credPath}`);
      }
      
      const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      credential = admin.credential.cert(serviceAccount);
      initMethod = 'GOOGLE_APPLICATION_CREDENTIALS';
    }
    // 방법 3: FIREBASE_SERVICE_ACCOUNT_KEY 환경변수 (JSON 문자열)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.log('📁 방법 3: FIREBASE_SERVICE_ACCOUNT_KEY 환경변수 사용');

      try {
        let serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        // 작은따옴표로 감싸진 경우 제거
        if (serviceAccountStr.startsWith("'") && serviceAccountStr.endsWith("'")) {
          serviceAccountStr = serviceAccountStr.slice(1, -1);
        }

        const serviceAccount = JSON.parse(serviceAccountStr);

        // private_key의 줄바꿈 문자 복원
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        credential = admin.credential.cert(serviceAccount);
        initMethod = 'FIREBASE_SERVICE_ACCOUNT_KEY';
      } catch (parseError) {
        throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY 파싱 실패: ${parseError.message}`);
      }
    }
    // 방법 4: Application Default Credentials (Cloud Run, GCE, GKE)
    else if (process.env.NODE_ENV === 'production' && process.env.K_SERVICE) {
      console.log('☁️  방법 4: Application Default Credentials (Cloud Run)');
      credential = admin.credential.applicationDefault();
      initMethod = 'ADC (Cloud Run)';
    }
    // 방법 5: Firebase Emulator (개발 환경)
    else if (process.env.NODE_ENV === 'development') {
      console.log('⚠️  방법 4: Firebase Emulator 모드 (개발 환경)');
      
      process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
      process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
      
      firebaseApp = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'Gena-dev'
      });
      
      isInitialized = true;
      console.log('✅ Firebase Emulator 모드로 초기화 완료');
      return firebaseApp;
    }
    // 인증 정보를 찾을 수 없는 경우
    else {
      const errorMessage = `
❌ Firebase 인증 정보를 찾을 수 없습니다.

다음 중 하나의 방법을 사용하세요:

방법 1: serviceAccountKey.json 파일 사용 (권장)
  1. Firebase Console에서 서비스 계정 키 다운로드
  2. server/serviceAccountKey.json으로 저장
  3. 서버 재시작

방법 2: 환경변수 사용 (파일 경로)
  1. .env 파일에 추가:
     GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
  2. 서버 재시작

방법 3: 환경변수 사용 (JSON 문자열)
  1. .env 파일에 추가:
     FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
  2. 서버 재시작

방법 4: 개발 환경 (Emulator)
  1. NODE_ENV=development 설정
  2. Firebase Emulator 실행
      `;
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error(errorMessage);
      } else {
        console.warn(errorMessage);
        throw new Error('Firebase 인증 정보 누락');
      }
    }

    // Firebase Admin 초기화
    if (credential) {
      const config = {
        credential: credential
      };
      
      // Database URL이 제공된 경우 추가
      if (process.env.FIREBASE_DATABASE_URL) {
        config.databaseURL = process.env.FIREBASE_DATABASE_URL;
      }
      
      firebaseApp = admin.initializeApp(config);
      isInitialized = true;
      
      console.log(`✅ Firebase 초기화 완료 (${initMethod})`);
      console.log(`📦 프로젝트: ${firebaseApp.options.credential.projectId || 'N/A'}`);
      
      return firebaseApp;
    }

  } catch (error) {
    console.error('❌ Firebase 초기화 실패:', error.message);
    
    if (process.env.NODE_ENV === 'production') {
      console.error('상세 오류:', error);
      process.exit(1);
    } else {
      console.warn('⚠️  개발 환경에서 Firebase 초기화 실패 - 계속 진행');
      throw error;
    }
  }
}

/**
 * Firestore 데이터베이스 인스턴스를 반환합니다.
 * 초기화되지 않은 경우 에러를 발생시킵니다.
 * 
 * @returns {admin.firestore.Firestore} Firestore 데이터베이스 인스턴스
 * @throws {Error} Firebase가 초기화되지 않은 경우
 * 
 * @example
 * const db = getFirestore();
 * const users = await db.collection('users').get();
 */
function getFirestore() {
  if (!isInitialized || !firebaseApp) {
    throw new Error('Firebase가 초기화되지 않았습니다. initializeFirebase()를 먼저 호출하세요.');
  }

  // Firestore 인스턴스 캐싱
  if (!firestoreInstance) {
    firestoreInstance = admin.firestore();
    
    // Firestore 설정
    firestoreInstance.settings({
      timestampsInSnapshots: true,
      ignoreUndefinedProperties: true
    });
  }

  return firestoreInstance;
}

/**
 * Firebase Admin 인스턴스를 반환합니다.
 * 
 * @returns {admin.app.App} Firebase Admin 앱 인스턴스
 * @throws {Error} Firebase가 초기화되지 않은 경우
 * 
 * @example
 * const app = getAdmin();
 * const auth = app.auth();
 */
function getAdmin() {
  if (!isInitialized || !firebaseApp) {
    throw new Error('Firebase가 초기화되지 않았습니다. initializeFirebase()를 먼저 호출하세요.');
  }

  return firebaseApp;
}

/**
 * Firestore 연결을 테스트합니다.
 * 테스트 문서를 생성하고 읽은 후 삭제하여 연결 상태를 확인합니다.
 * 
 * @async
 * @returns {Promise<boolean>} 연결 성공 여부 (true: 성공, false: 실패)
 * 
 * @example
 * const isConnected = await testConnection();
 * if (isConnected) {
 *   console.log('Firestore 연결 정상');
 * }
 */
async function testConnection() {
  try {
    console.log('🔍 Firestore 연결 테스트 시작...');
    
    const db = getFirestore();
    const testCollection = db.collection('_test');
    const testDocId = `test-${Date.now()}`;
    
    // 1. 쓰기 테스트
    await testCollection.doc(testDocId).set({
      message: 'Connection test',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('  ✅ 쓰기 테스트 성공');
    
    // 2. 읽기 테스트
    const doc = await testCollection.doc(testDocId).get();
    if (!doc.exists) {
      throw new Error('테스트 문서를 읽을 수 없습니다.');
    }
    console.log('  ✅ 읽기 테스트 성공');
    
    // 3. 삭제 테스트
    await testCollection.doc(testDocId).delete();
    console.log('  ✅ 삭제 테스트 성공');
    
    console.log('✅ Firestore 연결 테스트 완료');
    return true;
    
  } catch (error) {
    console.error('❌ Firestore 연결 테스트 실패:', error.message);
    
    if (process.env.NODE_ENV === 'production') {
      console.error('상세 오류:', error);
      return false;
    } else {
      console.warn('⚠️  개발 환경에서 연결 테스트 실패 - 계속 진행');
      return false;
    }
  }
}

/**
 * Firebase 초기화 상태를 반환합니다.
 * 
 * @returns {boolean} 초기화 여부 (true: 초기화됨, false: 미초기화)
 */
function isFirebaseInitialized() {
  return isInitialized;
}

/**
 * 환경변수를 검증합니다.
 * 필수 환경변수가 설정되어 있는지 확인합니다.
 * 
 * @returns {Object} 검증 결과 객체
 * @property {boolean} valid - 검증 성공 여부
 * @property {string[]} missingVars - 누락된 환경변수 목록
 * @property {string[]} warnings - 경고 메시지 목록
 */
function validateEnvironment() {
  const result = {
    valid: true,
    missingVars: [],
    warnings: []
  };

  // 필수 환경변수 확인
  const hasServiceAccountKey = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const hasCredentialsPath = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasServiceAccountFile = fs.existsSync(
    path.join(__dirname, '..', '..', '..', 'serviceAccountKey.json')
  );
  const isDevelopment = process.env.NODE_ENV === 'development';

  // 인증 정보 확인
  if (!hasServiceAccountKey && !hasCredentialsPath && !hasServiceAccountFile && !isDevelopment) {
    result.valid = false;
    result.missingVars.push('FIREBASE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS or serviceAccountKey.json');
  }

  // 선택적 환경변수 경고
  if (!process.env.FIREBASE_DATABASE_URL && !isDevelopment) {
    result.warnings.push('FIREBASE_DATABASE_URL이 설정되지 않았습니다. Realtime Database를 사용하지 않는 경우 무시하세요.');
  }

  if (!process.env.FIREBASE_PROJECT_ID && !isDevelopment) {
    result.warnings.push('FIREBASE_PROJECT_ID가 설정되지 않았습니다. 서비스 계정 키에 포함된 프로젝트 ID가 사용됩니다.');
  }

  return result;
}

module.exports = {
  initializeFirebase,
  getFirestore,
  getAdmin,
  testConnection,
  isFirebaseInitialized,
  validateEnvironment
};