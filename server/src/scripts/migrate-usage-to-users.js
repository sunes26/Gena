/**
 * Usage 컬렉션 마이그레이션 스크립트
 *
 * /usage/{userId}/daily/{date} → /users/{userId}/daily/{date}로 데이터 이동
 *
 * 실행 방법:
 * node src/scripts/migrate-usage-to-users.js [--dry-run]
 *
 * 옵션:
 * --dry-run: 실제 마이그레이션 없이 시뮬레이션만 수행
 */

const admin = require('firebase-admin');
const { initializeFirebase, getFirestore } = require('../config/firebase');

// 배치 크기 (Firestore 제한: 500)
const BATCH_SIZE = 500;

/**
 * 사용자의 daily 데이터 마이그레이션
 */
async function migrateUserDailyData(db, userId, dryRun = false) {
  const sourceRef = db.collection('usage').doc(userId).collection('daily');
  const targetRef = db.collection('users').doc(userId).collection('daily');

  // 소스 데이터 읽기
  const snapshot = await sourceRef.get();

  if (snapshot.empty) {
    return { migrated: 0, errors: [] };
  }

  console.log(`  📦 발견된 daily 문서: ${snapshot.size}개`);

  let migratedCount = 0;
  const errors = [];

  if (!dryRun) {
    // 배치로 처리
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const targetDocRef = targetRef.doc(doc.id);

        // 타겟에 이미 문서가 있는지 확인
        const existingDoc = await targetDocRef.get();

        if (existingDoc.exists) {
          console.log(`  ⚠️  이미 존재함: ${doc.id} (건너뜀)`);
          continue;
        }

        // 타겟에 복사
        batch.set(targetDocRef, data);
        batchCount++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`  ✅ 배치 커밋: ${batchCount}개 문서`);
          migratedCount += batchCount;
          batch = db.batch();
          batchCount = 0;
        }
      } catch (error) {
        console.error(`  ❌ 마이그레이션 실패: ${doc.id}`, error.message);
        errors.push({ docId: doc.id, error: error.message });
      }
    }

    // 남은 배치 커밋
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  ✅ 최종 배치 커밋: ${batchCount}개 문서`);
      migratedCount += batchCount;
    }

    // 마이그레이션 성공 후 소스 삭제
    if (migratedCount > 0 && errors.length === 0) {
      console.log(`  🗑️  소스 데이터 삭제 중...`);
      await deleteCollection(db, sourceRef);
      console.log(`  ✅ 소스 데이터 삭제 완료`);
    }
  } else {
    console.log(`  🔍 [DRY RUN] ${snapshot.size}개 문서 마이그레이션 예정`);
    migratedCount = snapshot.size;
  }

  return { migrated: migratedCount, errors };
}

/**
 * 컬렉션의 모든 문서 삭제
 */
async function deleteCollection(db, collectionRef) {
  const snapshot = await collectionRef.limit(BATCH_SIZE).get();

  if (snapshot.empty) {
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  // 재귀적으로 다음 배치 처리
  if (snapshot.size >= BATCH_SIZE) {
    await deleteCollection(db, collectionRef);
  }
}

/**
 * 전체 마이그레이션
 */
async function migrateAllUsage(db, dryRun = false) {
  const usageCollectionRef = db.collection('usage');
  const userDocs = await usageCollectionRef.listDocuments();

  console.log(`\n✅ 발견된 사용자: ${userDocs.length}명\n`);

  if (userDocs.length === 0) {
    console.log('⚠️  마이그레이션할 데이터가 없습니다.\n');
    return { totalMigrated: 0, totalErrors: 0 };
  }

  let totalMigrated = 0;
  let totalErrors = 0;

  for (const userDocRef of userDocs) {
    const userId = userDocRef.id;
    console.log(`\n📂 사용자: ${userId}`);

    const result = await migrateUserDailyData(db, userId, dryRun);

    totalMigrated += result.migrated;
    totalErrors += result.errors.length;

    if (result.errors.length > 0) {
      console.log(`  ⚠️  오류 발생: ${result.errors.length}건`);
      result.errors.forEach(err => {
        console.log(`    - ${err.docId}: ${err.error}`);
      });
    } else if (result.migrated > 0) {
      console.log(`  ✅ 마이그레이션 완료: ${result.migrated}개 문서`);
    }
  }

  return { totalMigrated, totalErrors };
}

/**
 * /usage 컬렉션 삭제 (모든 데이터 마이그레이션 후)
 */
async function cleanupUsageCollection(db, dryRun = false) {
  if (dryRun) {
    console.log('\n🔍 [DRY RUN] /usage 컬렉션 삭제는 실제 실행 시 수행됩니다.\n');
    return;
  }

  console.log('\n🗑️  /usage 컬렉션 정리 중...');

  const usageCollectionRef = db.collection('usage');
  const userDocs = await usageCollectionRef.listDocuments();

  if (userDocs.length === 0) {
    console.log('✅ /usage 컬렉션이 비어있습니다.\n');
    return;
  }

  for (const userDocRef of userDocs) {
    // daily 서브컬렉션 삭제
    const dailyRef = userDocRef.collection('daily');
    await deleteCollection(db, dailyRef);

    // 사용자 문서 삭제
    await userDocRef.delete();
    console.log(`  ✅ 삭제 완료: ${userDocRef.id}`);
  }

  console.log('✅ /usage 컬렉션 정리 완료\n');
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('🚀 Usage → Users 마이그레이션 시작...\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN 모드: 실제 마이그레이션은 수행되지 않습니다.\n');
  }

  // Firebase 초기화
  await initializeFirebase();
  const db = getFirestore();

  // 마이그레이션 실행
  const result = await migrateAllUsage(db, dryRun);

  // /usage 컬렉션 정리
  if (result.totalErrors === 0 && result.totalMigrated > 0) {
    await cleanupUsageCollection(db, dryRun);
  }

  // 결과 출력
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (dryRun) {
    console.log(`🔍 [DRY RUN] 마이그레이션 예정: ${result.totalMigrated}개 문서`);
  } else {
    console.log(`✅ 마이그레이션 완료: ${result.totalMigrated}개 문서`);
    if (result.totalErrors > 0) {
      console.log(`⚠️  오류 발생: ${result.totalErrors}건`);
    }
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(result.totalErrors > 0 ? 1 : 0);
}

// 에러 처리
main().catch(error => {
  console.error('❌ 치명적 오류 발생:', error);
  process.exit(1);
});
