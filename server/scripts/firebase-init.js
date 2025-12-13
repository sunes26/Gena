/**
 * Firebase 초기 설정 스크립트
 * Firestore 컬렉션 및 초기 데이터 설정
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initializeFirebase() {
  console.log('🚀 Firebase 초기화 시작...\n');
  
  try {
    // Firebase Admin 초기화 - 여러 방법 시도
    let initialized = false;
    
    // 방법 1: 직접 파일 읽기 (가장 안전)
    const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      console.log('📁 serviceAccountKey.json 파일 발견');
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
      initialized = true;
    }
    // 방법 2: GOOGLE_APPLICATION_CREDENTIALS 환경변수
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('📁 GOOGLE_APPLICATION_CREDENTIALS 환경변수 사용');
      const credPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      if (fs.existsSync(credPath)) {
        const serviceAccount = require(credPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        initialized = true;
      } else {
        console.error(`❌ 파일을 찾을 수 없음: ${credPath}`);
      }
    }
    // 방법 3: FIREBASE_SERVICE_ACCOUNT_KEY 환경변수 (문자열)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      console.log('📁 FIREBASE_SERVICE_ACCOUNT_KEY 환경변수 사용');
      try {
        // JSON 파싱 시도
        let serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        
        // 작은따옴표 제거
        if (serviceAccountStr.startsWith("'") && serviceAccountStr.endsWith("'")) {
          serviceAccountStr = serviceAccountStr.slice(1, -1);
        }
        
        const serviceAccount = JSON.parse(serviceAccountStr);
        
        // private_key의 줄바꿈 문자 복원
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        initialized = true;
      } catch (parseError) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY 파싱 실패:', parseError.message);
        console.log('\n💡 해결 방법:');
        console.log('1. serviceAccountKey.json 파일을 server 폴더에 저장하거나');
        console.log('2. .env 파일에 GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json 설정\n');
      }
    }
    // 방법 4: Firebase Emulator (개발 환경)
    else if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Firebase 인증 정보 없음 - Emulator 모드로 실행');
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
      process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
      admin.initializeApp({
        projectId: 'Gena-dev'
      });
      initialized = true;
    }
    
    if (!initialized) {
      console.error('\n❌ Firebase 인증 정보를 찾을 수 없습니다.\n');
      console.log('다음 중 하나의 방법을 사용하세요:\n');
      console.log('방법 1: serviceAccountKey.json 파일 사용 (권장)');
      console.log('  1. Firebase Console에서 서비스 계정 키 다운로드');
      console.log('  2. server/serviceAccountKey.json으로 저장');
      console.log('  3. npm run firebase:init 재실행\n');
      console.log('방법 2: 환경변수 사용');
      console.log('  1. .env 파일에 GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json 추가');
      console.log('  2. npm run firebase:init 재실행\n');
      process.exit(1);
    }
    
    const db = admin.firestore();
    console.log('✅ Firebase Admin SDK 초기화 완료\n');
    
    // Firestore 설정
    db.settings({
      timestampsInSnapshots: true,
      ignoreUndefinedProperties: true
    });
    
    // 1. Firestore 보안 규칙 설정 안내
    console.log('📋 Firestore 보안 규칙 설정');
    console.log('다음 규칙을 Firebase Console에서 설정하세요:\n');
    console.log(getSecurityRules());
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 2. 컬렉션 생성 (더미 문서로 초기화)
    console.log('📁 컬렉션 초기화...');
    
    const collections = ['users', 'subscriptions', 'usageHistory'];
    
    for (const collection of collections) {
      try {
        const ref = db.collection(collection).doc('_init');
        await ref.set({
          initialized: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        await ref.delete();
        console.log(`  ✅ ${collection} 컬렉션 생성됨`);
      } catch (error) {
        console.log(`  ⚠️ ${collection} 컬렉션 생성 중 오류 (이미 존재할 수 있음)`);
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 3. 복합 인덱스 생성 안내
    console.log('🔍 복합 인덱스 생성');
    console.log('다음 명령어를 실행하여 인덱스를 생성하세요:\n');
    console.log('  npx firebase deploy --only firestore:indexes');
    console.log('\n또는 Firebase Console에서 수동으로 생성:\n');
    
    const indexes = [
      'users: extensionId (ASC), createdAt (DESC)',
      'subscriptions: userId (ASC), status (ASC)',
      'usageHistory: userId (ASC), date (DESC), type (ASC)',
      'usageHistory: userId (ASC), createdAt (DESC)'
    ];
    
    indexes.forEach((index, i) => {
      console.log(`  ${i + 1}. ${index}`);
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // 4. 테스트 사용자 생성 (개발 환경에서만)
    if (process.env.NODE_ENV === 'development') {
      console.log('🧪 테스트 데이터 생성...');
      
      try {
        const testUserId = 'test-user-' + Date.now();
        const testUser = {
          email: 'test@gena.com',
          extensionId: 'test-extension-id',
          plan: 'free',
          role: 'user',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const userRef = db.collection('users').doc(testUserId);
        await userRef.set(testUser);
        
        const testSubscription = {
          userId: testUserId,
          plan: 'free',
          status: 'active',
          limits: {
            dailySummaries: 5,
            monthlyQuestions: 50,
            pdfSupport: false,
            historyDays: 7,
            teamMembers: 0,
            apiCalls: 100
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const subRef = db.collection('subscriptions').doc(testUserId);
        await subRef.set(testSubscription);
        
        console.log('  ✅ 테스트 사용자 생성됨: test@gena.com');
      } catch (error) {
        console.log('  ⚠️ 테스트 사용자 생성 실패 (이미 존재할 수 있음)');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Firebase 초기화 완료!\n');
    
    console.log('다음 단계:');
    console.log('1. Firebase Console에서 Authentication 활성화');
    console.log('2. Firestore 보안 규칙 설정');
    console.log('3. 복합 인덱스 생성 (npx firebase deploy --only firestore:indexes)');
    console.log('4. npm start로 서버 시작');
    
  } catch (error) {
    console.error('❌ 초기화 실패:', error.message);
    console.log('\n상세 오류:');
    console.log(error);
    process.exit(1);
  }
}

function getSecurityRules() {
  return `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 자신의 데이터 읽기/쓰기
    match /users/{userId} {
      allow read: if request.auth != null && 
        (request.auth.uid == userId || 
         request.auth.token.admin == true);
      allow write: if request.auth != null && 
        (request.auth.uid == userId || 
         request.auth.token.admin == true);
    }
    
    // 구독 정보는 사용자 본인 또는 관리자만
    match /subscriptions/{userId} {
      allow read: if request.auth != null && 
        (request.auth.uid == userId || 
         request.auth.token.admin == true);
      allow write: if request.auth != null && 
        request.auth.token.admin == true;
    }
    
    // 사용 기록은 사용자 본인만 읽기
    match /usageHistory/{document} {
      allow read: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow write: if false; // 서버에서만 쓰기
    }
  }
}`;
}

// 스크립트 실행
initializeFirebase().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});