/**
 * 마이그레이션 검증 스크립트
 *
 * 1. /usage 컬렉션이 비어있는지 확인
 * 2. /users/{userId}/daily 경로에 데이터가 존재하는지 확인
 * 3. UsageService가 올바른 경로를 사용하는지 확인
 */

const { initializeFirebase, getFirestore } = require('../config/firebase');

async function verifyMigration() {
  console.log('🔍 마이그레이션 검증 시작...\n');

  // Firebase 초기화 (UsageService require 전에 먼저 초기화)
  await initializeFirebase();
  const db = getFirestore();

  // UsageService는 Firebase 초기화 후 require
  const usageService = require('../services/UsageService');
  await usageService.initialize();

  // 1. /usage 컬렉션 확인
  console.log('1️⃣  /usage 컬렉션 확인');
  const usageCollectionRef = db.collection('usage');
  const usageDocs = await usageCollectionRef.listDocuments();

  if (usageDocs.length === 0) {
    console.log('   ✅ /usage 컬렉션이 비어있습니다.\n');
  } else {
    console.log(`   ⚠️  /usage 컬렉션에 ${usageDocs.length}개의 문서가 남아있습니다!\n`);
    return false;
  }

  // 2. /users/{userId}/daily 경로 확인
  console.log('2️⃣  /users/{userId}/daily 경로 확인');
  const usersCollectionRef = db.collection('users');
  const userDocs = await usersCollectionRef.listDocuments();

  console.log(`   📦 총 사용자 수: ${userDocs.length}명`);

  let totalDailyDocs = 0;
  for (const userDocRef of userDocs) {
    const dailyRef = userDocRef.collection('daily');
    const dailySnapshot = await dailyRef.get();

    if (dailySnapshot.size > 0) {
      console.log(`   ✅ ${userDocRef.id}: ${dailySnapshot.size}개 daily 문서`);
      totalDailyDocs += dailySnapshot.size;
    }
  }

  if (totalDailyDocs > 0) {
    console.log(`\n   ✅ 총 ${totalDailyDocs}개의 daily 문서가 /users 경로에 존재합니다.\n`);
  } else {
    console.log('   ⚠️  /users 경로에 daily 문서가 없습니다!\n');
    return false;
  }

  // 3. UsageService 테스트
  console.log('3️⃣  UsageService 동작 확인');

  if (!usageService.isAvailable()) {
    console.log('   ⚠️  UsageService가 사용 불가능합니다!\n');
    return false;
  }

  console.log('   ✅ UsageService가 정상적으로 초기화되었습니다.\n');

  // 4. 코드 확인
  console.log('4️⃣  코드 경로 확인');
  const fs = require('fs');
  const path = require('path');
  const usageServicePath = path.join(__dirname, '../services/UsageService.js');
  const usageServiceCode = fs.readFileSync(usageServicePath, 'utf-8');

  const hasOldPath = usageServiceCode.includes("collection('usage')");
  const hasNewPath = usageServiceCode.includes("collection('users')");

  if (hasOldPath) {
    console.log("   ⚠️  UsageService.js에 아직 collection('usage')가 남아있습니다!\n");
    return false;
  }

  if (hasNewPath) {
    console.log("   ✅ UsageService.js가 collection('users')를 사용하고 있습니다.\n");
  } else {
    console.log("   ⚠️  UsageService.js에서 collection('users')를 찾을 수 없습니다!\n");
    return false;
  }

  return true;
}

async function main() {
  try {
    const success = await verifyMigration();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (success) {
      console.log('✅ 마이그레이션 검증 성공!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      process.exit(0);
    } else {
      console.log('❌ 마이그레이션 검증 실패!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 검증 중 오류 발생:', error);
    process.exit(1);
  }
}

main();
