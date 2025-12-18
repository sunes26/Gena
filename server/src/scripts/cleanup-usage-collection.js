/**
 * /usage 컬렉션 정리 스크립트
 *
 * 마이그레이션 완료 후 남아있는 /usage 컬렉션을 정리합니다.
 *
 * 실행 방법:
 * node src/scripts/cleanup-usage-collection.js [--dry-run]
 *
 * 옵션:
 * --dry-run: 실제 삭제 없이 시뮬레이션만 수행
 */

const admin = require('firebase-admin');
const { initializeFirebase, getFirestore } = require('../config/firebase');

// 배치 크기 (Firestore 제한: 500)
const BATCH_SIZE = 500;

/**
 * 컬렉션의 모든 문서 삭제
 */
async function deleteCollection(db, collectionRef, batchSize = BATCH_SIZE) {
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

/**
 * 쿼리 결과 배치 삭제
 */
async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  // 재귀적으로 다음 배치 처리
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

/**
 * /usage 컬렉션 정리
 */
async function cleanupUsageCollection(db, dryRun = false) {
  const usageCollectionRef = db.collection('usage');
  const userDocs = await usageCollectionRef.listDocuments();

  console.log(`\n✅ 발견된 사용자 문서: ${userDocs.length}개\n`);

  if (userDocs.length === 0) {
    console.log('✅ /usage 컬렉션이 이미 비어있습니다.\n');
    return 0;
  }

  let totalDeleted = 0;

  for (const userDocRef of userDocs) {
    const userId = userDocRef.id;
    console.log(`📂 사용자: ${userId}`);

    // daily 서브컬렉션 삭제
    const dailyRef = userDocRef.collection('daily');
    const dailySnapshot = await dailyRef.get();

    if (dailySnapshot.size > 0) {
      console.log(`  📁 daily: ${dailySnapshot.size}개 문서 발견`);

      if (!dryRun) {
        await deleteCollection(db, dailyRef);
        console.log(`  ✅ daily: ${dailySnapshot.size}개 문서 삭제 완료`);
        totalDeleted += dailySnapshot.size;
      } else {
        console.log(`  🔍 [DRY RUN] daily: ${dailySnapshot.size}개 문서 삭제 예정`);
      }
    }

    // 사용자 문서 삭제
    if (!dryRun) {
      await userDocRef.delete();
      console.log(`  ✅ 사용자 문서 삭제 완료\n`);
    } else {
      console.log(`  🔍 [DRY RUN] 사용자 문서 삭제 예정\n`);
    }
  }

  return totalDeleted;
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('🗑️  /usage 컬렉션 정리 시작...\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN 모드: 실제 삭제는 수행되지 않습니다.\n');
  }

  // Firebase 초기화
  await initializeFirebase();
  const db = getFirestore();

  // 정리 실행
  const totalDeleted = await cleanupUsageCollection(db, dryRun);

  // 결과 출력
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (dryRun) {
    console.log(`🔍 [DRY RUN] 삭제 예정: ${totalDeleted}개 문서`);
  } else {
    console.log(`✅ 정리 완료: ${totalDeleted}개 문서 삭제됨`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  process.exit(0);
}

// 에러 처리
main().catch(error => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
