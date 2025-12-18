/**
 * Orphaned Documents 정리 스크립트
 *
 * 사용자 삭제 후 남아있는 서브컬렉션 문서를 정리합니다:
 * - /users/{userId}/history/*
 * - /users/{userId}/daily/*
 * - /users/{userId}/tokens/*
 *
 * 실행 방법:
 * node src/scripts/cleanup-orphaned-docs.js [--dry-run] [--user-id=USER_ID]
 *
 * 옵션:
 * --dry-run: 실제 삭제 없이 시뮬레이션만 수행
 * --user-id: 특정 사용자의 문서만 정리
 */

const admin = require('firebase-admin');
const { initializeFirebase, getFirestore } = require('../config/firebase');

// 배치 크기 (Firestore 제한: 500)
const BATCH_SIZE = 500;

/**
 * 서브컬렉션의 모든 문서 삭제
 */
async function deleteCollection(db, collectionPath, batchSize = BATCH_SIZE) {
  const collectionRef = db.collection(collectionPath);
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
    // 삭제할 문서 없음
    resolve();
    return;
  }

  // 배치 삭제
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
 * 사용자의 모든 서브컬렉션 삭제
 */
async function deleteUserSubcollections(db, userId, dryRun = false) {
  const subcollections = ['history', 'daily', 'tokens'];
  let totalDeleted = 0;

  for (const subcollection of subcollections) {
    const collectionPath = `users/${userId}/${subcollection}`;

    // 문서 수 확인
    const snapshot = await db.collection(collectionPath).get();
    const count = snapshot.size;

    if (count > 0) {
      console.log(`  📁 ${subcollection}: ${count}개 문서 발견`);

      if (!dryRun) {
        await deleteCollection(db, collectionPath);
        console.log(`  ✅ ${subcollection}: ${count}개 문서 삭제 완료`);
        totalDeleted += count;
      } else {
        console.log(`  🔍 [DRY RUN] ${subcollection}: ${count}개 문서 삭제 예정`);
      }
    }
  }

  return totalDeleted;
}

/**
 * Orphaned 문서 찾기
 */
async function findOrphanedDocuments(db) {
  const usersSnapshot = await db.collection('users').get();
  const existingUserIds = new Set();

  usersSnapshot.forEach(doc => {
    existingUserIds.add(doc.id);
  });

  console.log(`✅ 존재하는 사용자: ${existingUserIds.size}명`);

  // Firebase Authentication에서 삭제된 사용자 확인
  const auth = admin.auth();
  const orphanedUsers = [];

  for (const userId of existingUserIds) {
    try {
      await auth.getUser(userId);
      // 사용자 존재함
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Firebase Auth에는 없지만 Firestore에는 있음 = Orphaned
        orphanedUsers.push(userId);
      }
    }
  }

  return orphanedUsers;
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const userIdArg = args.find(arg => arg.startsWith('--user-id='));
  const targetUserId = userIdArg ? userIdArg.split('=')[1] : null;

  console.log('🧹 Orphaned Documents 정리 시작...\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN 모드: 실제 삭제는 수행되지 않습니다.\n');
  }

  // Firebase 초기화
  await initializeFirebase();
  const db = getFirestore();

  let totalDeleted = 0;

  if (targetUserId) {
    // 특정 사용자만 정리
    console.log(`🔍 사용자 ${targetUserId}의 서브컬렉션 정리 중...\n`);

    const userDoc = await db.collection('users').doc(targetUserId).get();

    if (!userDoc.exists) {
      console.log(`⚠️  사용자 문서가 존재하지 않습니다: ${targetUserId}`);
    }

    totalDeleted = await deleteUserSubcollections(db, targetUserId, dryRun);

  } else {
    // Orphaned 문서 자동 탐지
    console.log('🔍 Orphaned 문서 탐지 중...\n');

    const orphanedUsers = await findOrphanedDocuments(db);

    if (orphanedUsers.length === 0) {
      console.log('✅ Orphaned 문서가 없습니다.\n');
      return;
    }

    console.log(`⚠️  발견된 Orphaned 사용자: ${orphanedUsers.length}명\n`);

    for (const userId of orphanedUsers) {
      console.log(`🗑️  사용자 ${userId} 정리 중...`);
      const deleted = await deleteUserSubcollections(db, userId, dryRun);
      totalDeleted += deleted;
      console.log();
    }
  }

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
