/**
 * Firestore 기반 사용량 추적 서비스
 * 사용자의 일일 요약/질문 횟수를 추적하고 관리합니다.
 *
 * 데이터 구조:
 * /users/{userId}/daily/{YYYY-MM-DD}
 * {
 *   userId: string,
 *   date: string,
 *   summary_count: number,
 *   question_count: number,
 *   total_count: number,
 *   isPremium: boolean,
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp
 * }
 *
 * @module UsageService
 */

const { getFirestore } = require('../config/firebase');
const admin = require('firebase-admin');

/**
 * 기본 무료 사용자 일일 한도
 * 허용 범위: 1-100
 * @type {number}
 */
console.log('🔧 [UsageService] process.env.FREE_USER_DAILY_LIMIT:', process.env.FREE_USER_DAILY_LIMIT);
const FREE_USER_DAILY_LIMIT = parseInt(process.env.FREE_USER_DAILY_LIMIT) || 3;
console.log('🔧 [UsageService] FREE_USER_DAILY_LIMIT 최종값:', FREE_USER_DAILY_LIMIT);
/**
 * 캐시 유효 기간 (밀리초)
 * 허용 범위: 30000(30초) - 300000(5분)
 * 기본값: 60000(1분)
 * @type {number}
 */
const CACHE_TTL = 60000; // 1분

/**
 * 최대 캐시 항목 수 (메모리 누수 방지)
 * @type {number}
 */
const MAX_CACHE_SIZE = 1000;

/**
 * 사용량 데이터 보관 기간 (일)
 * 허용 범위: 30-365
 * 기본값: 30일
 * @type {number}
 */
const DATA_RETENTION_DAYS = parseInt(process.env.DATA_RETENTION_DAYS) || 30;

/**
 * Firestore 기반 사용량 추적 서비스 클래스
 * Singleton 패턴으로 구현
 */
class UsageService {
  constructor() {
    /**
     * Firestore 데이터베이스 인스턴스
     * @type {admin.firestore.Firestore | null}
     * @private
     */
    this.db = null;
    
    /**
     * 메모리 캐시 (Firestore 읽기 비용 절감)
     * 구조: Map<string, {data: Object, expiry: number}>
     * @type {Map<string, Object>}
     * @private
     */
    this.cache = new Map();
    
    /**
     * Fallback 메모리 저장소 (Firestore 실패 시)
     * 구조: Map<string, {count: number, timestamp: number}>
     * @type {Map<string, Object>}
     * @private
     */
    this.fallbackStore = new Map();
    
    /**
     * Firestore 사용 가능 여부
     * @type {boolean}
     * @private
     */
    this.isFirestoreAvailable = false;
    
    this._initializeFirestore();
    this._startCleanupScheduler();
  }
  
  /**
   * Firestore 초기화
   * @private
   * @async
   * @returns {Promise<void>}
   */
  async _initializeFirestore() {
    try {
      this.db = getFirestore();
      
      // Firestore 연결 테스트
      await this.db.collection('_health').doc('test').set({ 
        timestamp: admin.firestore.FieldValue.serverTimestamp() 
      });
      
      this.isFirestoreAvailable = true;
      console.log('✅ UsageService: Firestore 초기화 완료');
    } catch (error) {
      console.error('⚠️ UsageService: Firestore 초기화 실패, 메모리 모드로 전환:', error.message);
      this.isFirestoreAvailable = false;
    }
  }
  
  /**
   * 서비스 재초기화
   * Firebase가 초기화된 후 호출하여 Firestore 연결을 재시도
   * 
   * @async
   * @returns {Promise<void>}
   * 
   * @example
   * await usageService.initialize();
   */
  async initialize() {
    console.log('🔄 UsageService 재초기화 시작...');
    await this._initializeFirestore();
  }
  
  /**
   * 캐시 키 생성
   * @private
   * @param {string} userId - 사용자 ID
   * @param {string} date - 날짜 (YYYY-MM-DD)
   * @returns {string} 캐시 키
   */
  _getCacheKey(userId, date) {
    return `usage:${userId}:${date}`;
  }
  
  /**
   * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
   * @private
   * @returns {string} 오늘 날짜
   */
  _getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  /**
   * 특정 날짜 문자열 생성
   * @private
   * @param {Date} date - Date 객체
   * @returns {string} YYYY-MM-DD 형식 날짜
   */
  _formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  /**
   * 캐시에서 데이터 조회
   * @private
   * @param {string} cacheKey - 캐시 키
   * @returns {Object | null} 캐시된 데이터 또는 null
   */
  _getFromCache(cacheKey) {
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    
    // 만료된 캐시 삭제
    if (cached) {
      this.cache.delete(cacheKey);
    }
    
    return null;
  }
  
  /**
   * 캐시에 데이터 저장
   * @private
   * @param {string} cacheKey - 캐시 키
   * @param {Object} data - 저장할 데이터
   */
  _setCache(cacheKey, data) {
    // 최대 크기 초과 시 가장 오래된 항목 삭제 (LRU)
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      console.log(`⚠️ 캐시 크기 제한(${MAX_CACHE_SIZE}) 도달: 가장 오래된 항목 삭제`);
    }

    this.cache.set(cacheKey, {
      data: data,
      expiry: Date.now() + CACHE_TTL
    });
  }
  
  /**
   * 캐시 무효화
   * @private
   * @param {string} cacheKey - 캐시 키
   */
  _invalidateCache(cacheKey) {
    this.cache.delete(cacheKey);
  }
  
  /**
   * 사용량 추적 (요약 또는 질문)
   * 
   * @async
   * @param {string} userId - 사용자 ID
   * @param {string} type - 사용 유형 ('summary' | 'question')
   * @param {boolean} isPremium - 프리미엄 여부
   * @returns {Promise<Object>} 사용량 정보
   * @property {number} current - 현재 사용량
   * @property {number} limit - 일일 한도
   * @property {number} remaining - 남은 사용 가능 횟수
   * @property {boolean} isPremium - 프리미엄 여부
   * 
   * @throws {Error} userId가 없거나 type이 잘못된 경우
   * 
   * @example
   * // 요약 사용량 추적
   * const usage = await usageService.trackUsage('user123', 'summary', false);
   * 
   * // 질문 사용량 추적
   * const usage = await usageService.trackUsage('user123', 'question', false);
   */
  async trackUsage(userId, type = 'summary', isPremium = false) {
    // 입력 검증
    if (!userId) {
      throw new Error('userId는 필수입니다');
    }
    
    if (!['summary', 'question'].includes(type)) {
      throw new Error('type은 "summary" 또는 "question"이어야 합니다');
    }
    
    const today = this._getTodayDate();
    const cacheKey = this._getCacheKey(userId, today);
    
    // Firestore 사용 가능 여부 확인
    if (!this.isFirestoreAvailable) {
      return this._trackUsageInMemory(userId, type, isPremium);
    }
    
    try {
      const docRef = this.db
        .collection('users')
        .doc(userId)
        .collection('daily')
        .doc(today);
      
      // Firestore Transaction으로 race condition 방지
      const result = await this.db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        
        let newData;
        
        if (!doc.exists) {
          // 새 문서 생성
          newData = {
            userId: userId,
            date: today,
            summary_count: type === 'summary' ? 1 : 0,
            question_count: type === 'question' ? 1 : 0,
            total_count: 1,
            isPremium: isPremium,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          transaction.set(docRef, newData);
        } else {
          // 기존 문서 업데이트
          const currentData = doc.data();
          
          const incrementField = type === 'summary' ? 'summary_count' : 'question_count';
          
          newData = {
            ...currentData,
            [incrementField]: (currentData[incrementField] || 0) + 1,
            total_count: (currentData.total_count || 0) + 1,
            isPremium: isPremium,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          transaction.update(docRef, {
            [incrementField]: admin.firestore.FieldValue.increment(1),
            total_count: admin.firestore.FieldValue.increment(1),
            isPremium: isPremium,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        return newData;
      });
      
      // 캐시 무효화
      this._invalidateCache(cacheKey);
      
      // 한도 계산
      const limit = isPremium ? Infinity : FREE_USER_DAILY_LIMIT;
      const current = result.total_count;
      const remaining = isPremium ? Infinity : Math.max(0, limit - current);
      
      console.log(`📊 사용량 추적: ${userId} - ${type} (${current}/${limit})`);
      
      return {
        current,
        limit,
        remaining,
        isPremium
      };
      
    } catch (error) {
      console.error('❌ trackUsage Firestore 오류:', error.message);
      
      // Fallback: 메모리 기반
      return this._trackUsageInMemory(userId, type, isPremium);
    }
  }
  
  /**
   * Fallback: 메모리 기반 사용량 추적
   * Firestore 실패 시 사용
   * 
   * @private
   * @param {string} userId - 사용자 ID
   * @param {string} type - 사용 유형
   * @param {boolean} isPremium - 프리미엄 여부
   * @returns {Object} 사용량 정보
   */
  _trackUsageInMemory(userId, type, isPremium) {
    const today = this._getTodayDate();
    const key = `${userId}:${today}`;
    
    const current = this.fallbackStore.get(key) || { count: 0, timestamp: Date.now() };
    current.count += 1;
    current.timestamp = Date.now();
    
    this.fallbackStore.set(key, current);
    
    const limit = isPremium ? Infinity : FREE_USER_DAILY_LIMIT;
    const remaining = isPremium ? Infinity : Math.max(0, limit - current.count);
    
    console.warn(`⚠️ 메모리 모드로 사용량 추적: ${userId} - ${type} (${current.count}/${limit})`);
    
    return {
      current: current.count,
      limit,
      remaining,
      isPremium
    };
  }
  
  /**
   * 사용량 조회
   * 캐시를 우선 사용하고, 없으면 Firestore에서 조회
   * 
   * @async
   * @param {string} userId - 사용자 ID
   * @param {boolean} isPremium - 프리미엄 여부
   * @returns {Promise<Object>} 사용량 정보
   */
  async getUsage(userId, isPremium = false) {
    if (!userId) {
      throw new Error('userId는 필수입니다');
    }
    
    const today = this._getTodayDate();
    const cacheKey = this._getCacheKey(userId, today);
    
    // 1. 캐시 확인
    const cached = this._getFromCache(cacheKey);
    if (cached) {
      const limit = isPremium ? Infinity : FREE_USER_DAILY_LIMIT;
      return {
        used: cached.total_count || 0,
        limit,
        remaining: isPremium ? Infinity : Math.max(0, limit - (cached.total_count || 0)),
        questionUsed: cached.question_count || 0,
        questionLimit: isPremium ? Infinity : FREE_USER_DAILY_LIMIT,
        isPremium
      };
    }
    
    // 2. Firestore 조회
    if (!this.isFirestoreAvailable) {
      return this._getUsageFromMemory(userId, isPremium);
    }
    
    try {
      const docRef = this.db
        .collection('users')
        .doc(userId)
        .collection('daily')
        .doc(today);
      
      const doc = await docRef.get();
      
      if (!doc.exists) {
        const limit = isPremium ? Infinity : FREE_USER_DAILY_LIMIT;
        return {
          used: 0,
          limit,
          remaining: isPremium ? Infinity : limit,
          questionUsed: 0,
          questionLimit: isPremium ? Infinity : FREE_USER_DAILY_LIMIT,
          isPremium
        };
      }
      
      const data = doc.data();
      
      // 캐시 저장
      this._setCache(cacheKey, data);
      
      const limit = isPremium ? Infinity : FREE_USER_DAILY_LIMIT;
      const used = data.total_count || 0;
      
      return {
        used,
        limit,
        remaining: isPremium ? Infinity : Math.max(0, limit - used),
        questionUsed: data.question_count || 0,
        questionLimit: isPremium ? Infinity : FREE_USER_DAILY_LIMIT,
        isPremium
      };
      
    } catch (error) {
      console.error('❌ getUsage Firestore 오류:', error.message);
      return this._getUsageFromMemory(userId, isPremium);
    }
  }
  
  /**
   * Fallback: 메모리에서 사용량 조회
   * @private
   */
  _getUsageFromMemory(userId, isPremium) {
    const today = this._getTodayDate();
    const key = `${userId}:${today}`;
    
    const stored = this.fallbackStore.get(key);
    const used = stored ? stored.count : 0;
    const limit = isPremium ? Infinity : FREE_USER_DAILY_LIMIT;
    
    return {
      used,
      limit,
      remaining: isPremium ? Infinity : Math.max(0, limit - used),
      questionUsed: 0,
      questionLimit: isPremium ? Infinity : FREE_USER_DAILY_LIMIT,
      isPremium
    };
  }
  
  /**
   * 사용 한도 체크
   * 
   * @async
   * @param {string} userId - 사용자 ID
   * @param {boolean} isPremium - 프리미엄 여부
   * @returns {Promise<boolean>} 사용 가능 여부
   */
  async checkLimit(userId, isPremium = false) {
    if (isPremium) {
      return true;
    }
    
    const usage = await this.getUsage(userId, isPremium);
    const canUse = usage.used < usage.limit;
    
    if (!canUse) {
      console.warn(`⚠️ 사용 한도 초과: ${userId} (${usage.used}/${usage.limit})`);
    }
    
    return canUse;
  }
  
  /**
   * 사용 통계 조회 (최근 N일)
   * 
   * @async
   * @param {string} userId - 사용자 ID
   * @param {number} days - 조회 기간 (일) (1-90)
   * @returns {Promise<Object>} 통계 정보
   */
  async getStatistics(userId, days = 7) {
    if (!userId) {
      throw new Error('userId는 필수입니다');
    }
    
    if (days < 1 || days > 90) {
      throw new Error('days는 1-90 사이여야 합니다');
    }
    
    if (!this.isFirestoreAvailable) {
      return this._getStatisticsFromMemory(userId, days);
    }
    
    try {
      const dates = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        dates.push(this._formatDate(date));
      }
      
      const dailyRef = this.db
        .collection('users')
        .doc(userId)
        .collection('daily');
      
      const promises = dates.map(date => dailyRef.doc(date).get());
      const docs = await Promise.all(promises);
      
      let totalSummary = 0;
      let totalQuestion = 0;
      let totalCount = 0;
      
      const dailyBreakdown = docs.map((doc, index) => {
        const date = dates[index];
        
        if (!doc.exists) {
          return {
            date,
            summary_count: 0,
            question_count: 0,
            total_count: 0
          };
        }
        
        const data = doc.data();
        
        totalSummary += data.summary_count || 0;
        totalQuestion += data.question_count || 0;
        totalCount += data.total_count || 0;
        
        return {
          date,
          summary_count: data.summary_count || 0,
          question_count: data.question_count || 0,
          total_count: data.total_count || 0
        };
      });
      
      const todayData = dailyBreakdown[0];
      
      return {
        today: {
          summary_count: todayData.summary_count,
          question_count: todayData.question_count,
          total_count: todayData.total_count
        },
        week: {
          summary_count: totalSummary,
          question_count: totalQuestion,
          total_count: totalCount,
          days: days
        },
        total: {
          summary_count: totalSummary,
          question_count: totalQuestion,
          total_count: totalCount
        },
        dailyBreakdown: dailyBreakdown.reverse()
      };
      
    } catch (error) {
      console.error('❌ getStatistics Firestore 오류:', error.message);
      return this._getStatisticsFromMemory(userId, days);
    }
  }
  
  /**
   * Fallback: 메모리에서 통계 조회
   * @private
   */
  _getStatisticsFromMemory(userId, days) {
    const today = this._getTodayDate();
    const key = `${userId}:${today}`;
    
    const stored = this.fallbackStore.get(key);
    const todayCount = stored ? stored.count : 0;
    
    return {
      today: {
        summary_count: todayCount,
        question_count: 0,
        total_count: todayCount
      },
      week: {
        summary_count: todayCount,
        question_count: 0,
        total_count: todayCount,
        days: days
      },
      total: {
        summary_count: todayCount,
        question_count: 0,
        total_count: todayCount
      },
      dailyBreakdown: [
        {
          date: today,
          summary_count: todayCount,
          question_count: 0,
          total_count: todayCount
        }
      ]
    };
  }
  
  /**
   * 오래된 데이터 아카이브
   * 
   * @async
   * @returns {Promise<number>} 아카이브된 문서 수
   */
  async resetIfNeeded() {
    if (!this.isFirestoreAvailable) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - DATA_RETENTION_DAYS);
      const cutoffTime = cutoffDate.getTime();
      
      let deletedCount = 0;
      
      for (const [key, value] of this.fallbackStore.entries()) {
        if (value.timestamp < cutoffTime) {
          this.fallbackStore.delete(key);
          deletedCount++;
        }
      }
      
      console.log(`🗑️ 메모리 정리: ${deletedCount}개 항목 삭제`);
      return deletedCount;
    }
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - DATA_RETENTION_DAYS);
      const cutoffDateStr = this._formatDate(cutoffDate);
      
      console.log(`🗄️ 아카이브 시작: ${cutoffDateStr} 이전 데이터`);

      const usersCollectionRef = this.db.collection('users');
      const usersSnapshot = await usersCollectionRef.listDocuments();
      
      let archivedCount = 0;
      const batchSize = 500;
      let batch = this.db.batch();
      let batchCount = 0;
      
      for (const userDocRef of usersSnapshot) {
        const dailyRef = userDocRef.collection('daily');
        
        const oldDocsSnapshot = await dailyRef
          .where('date', '<', cutoffDateStr)
          .where('archived', '!=', true)
          .get();
        
        for (const doc of oldDocsSnapshot.docs) {
          batch.update(doc.ref, {
            archived: true,
            archivedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          batchCount++;
          archivedCount++;

          if (batchCount >= batchSize) {
            try {
              await batch.commit();
              console.log(`✅ 배치 커밋 성공: ${batchSize}개 문서`);
            } catch (batchError) {
              console.error(`❌ 배치 커밋 실패: ${batchCount}개 항목 미처리`, batchError);
              throw new Error(`배치 작업 실패: ${batchError.message}`);
            }
            batch = this.db.batch();
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        try {
          await batch.commit();
          console.log(`✅ 최종 배치 커밋 성공: ${batchCount}개 문서`);
        } catch (batchError) {
          console.error(`❌ 최종 배치 커밋 실패: ${batchCount}개 항목 미처리`, batchError);
          throw new Error(`최종 배치 작업 실패: ${batchError.message}`);
        }
      }
      
      console.log(`✅ 아카이브 완료: ${archivedCount}개 문서`);
      return archivedCount;
      
    } catch (error) {
      console.error('❌ resetIfNeeded Firestore 오류:', error.message);
      return 0;
    }
  }
  
  /**
   * 정리 스케줄러 시작
   * @private
   */
  _startCleanupScheduler() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetIfNeeded();
      
      setInterval(() => {
        this.resetIfNeeded();
      }, 86400000);
      
    }, timeUntilMidnight);
    
    console.log(`⏰ 정리 스케줄러 시작: 다음 실행 ${tomorrow.toISOString()}`);
  }
  
  /**
   * 캐시 전체 삭제
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ 캐시 전체 삭제');
  }
  
  /**
   * Firestore 사용 가능 여부 반환
   * @returns {boolean} Firestore 연결 상태
   */
  isAvailable() {
    return this.isFirestoreAvailable;
  }
}

// Singleton 인스턴스 생성 및 export
const usageService = new UsageService();

module.exports = usageService;