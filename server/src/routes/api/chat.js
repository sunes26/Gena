/**
 * 채팅 API 라우터
 * OpenAI API를 통한 요약 및 질문 응답 처리
 *
 * ✨ v2.2 업데이트:
 * - ChatService로 비즈니스 로직 분리
 * - 요약 시 상세 정보를 UsageService에 전달
 * - 날짜 → 요약ID → 상세 정보 구조로 저장
 *
 * @module routes/api/chat
 */

const express = require('express');
const router = express.Router();

// Constants
const {
  OPENAI,
  ERROR_CODES,
  ERROR_MESSAGES,
  HTTP_STATUS,
  FEATURE_TYPES
} = require('../../constants');

// Middleware
const { authenticate } = require('../../middleware/auth');
const { chatValidator, validate } = require('../../middleware/validator');
const { chatLimiter } = require('../../middleware/rateLimiter');

// Services
const chatService = require('../../services/ChatService');
const usageService = require('../../services/UsageService');
const { historyService } = require('../../services/HistoryService');

// ===== Circuit Breaker와 OpenAI 호출은 ChatService로 이동됨 =====

// ===== POST / 엔드포인트 =====

/**
 * 채팅/요약 요청 처리
 * ✨ 수정: 요약 상세 정보를 UsageService에 전달
 *
 * @route POST /api/chat
 * @middleware authenticate - JWT 인증 필수 (이메일 인증 필수)
 * @middleware validate(chatValidator) - 요청 데이터 검증
 * @middleware chatLimiter - Rate limiting
 */
router.post('/',
  authenticate,
  validate(chatValidator),
  chatLimiter,
  async (req, res, next) => {
    try {
      // 사용자 정보 처리 (인증 필수)
      const userId = req.user.userId;
      const email = req.user.email;
      const isPremium = req.user.isPremium || false;
      
      const { model, messages, max_tokens, temperature } = req.body;
      
      console.log('[Chat] 요청 수신:', {
        userId,
        email,
        isPremium: isPremium ? 'premium' : 'free',
        authenticated: !!req.user,
        model: model || 'default',
        messageCount: messages.length
      });
      
      // ===== 🆕 0. PDF 프리미엄 체크 (Phase 2) =====
      // 📌 validator.js의 chatValidator에서 isPDF 플래그를 받아 URL 검증 방식이 달라짐:
      //    - isPDF === true: file://, chrome-extension:// 프로토콜 허용
      //    - isPDF === false: http://, https:// 프로토콜만 허용
      const isPDFRequest = req.body.isPDF === true;
      
      if (isPDFRequest && !isPremium) {
        console.warn(`[Chat] PDF 요약 차단 - 무료 사용자: ${userId}`);
        
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: true,
          message: 'PDF 요약은 프리미엄 전용 기능입니다',
          code: 'PDF_PREMIUM_REQUIRED',
          statusCode: HTTP_STATUS.FORBIDDEN,
          feature: 'PDF Summary',
          isPDF: true,
          upgrade: {
            message: 'PDF 요약 기능을 사용하려면 프리미엄으로 업그레이드하세요',
            benefits: [
              'PDF 문서 무제한 요약',
              '웹페이지 무제한 요약',
              '히스토리 클라우드 저장',
              '우선 지원'
            ],
            link: 'https://gena.com/pricing'
          }
        });
      }
      
      if (isPDFRequest && isPremium) {
        console.log('[Chat] PDF 요약 허용 - 프리미엄 사용자:', userId);
      }
      
      // ===== 1. 사용량 체크 =====
      const canUse = await usageService.checkLimit(userId, isPremium);
      
      if (!canUse) {
        const usage = await usageService.getUsage(userId, isPremium);
        
        console.warn(`[Chat] 사용 한도 초과 - userId: ${userId}, used: ${usage.used}/${usage.limit}`);
        
        return res.status(HTTP_STATUS.FORBIDDEN).json({
          error: true,
          message: isPremium 
            ? '일시적인 사용 제한입니다' 
            : ERROR_MESSAGES.DAILY_LIMIT_EXCEEDED,
          code: ERROR_CODES.USAGE_LIMIT_EXCEEDED,
          statusCode: HTTP_STATUS.FORBIDDEN,
          usage: {
            used: usage.used,
            limit: usage.limit === Infinity ? 'unlimited' : usage.limit,
            remaining: usage.remaining === Infinity ? 'unlimited' : usage.remaining
          },
          upgrade: !isPremium ? {
            message: '프리미엄으로 업그레이드하면 무제한으로 사용할 수 있습니다',
            link: '/pricing'
          } : null
        });
      }
      
      // ===== 2. OpenAI API 호출 (Circuit Breaker 포함, ChatService 사용) =====
      const apiResponse = await chatService.chat(model, messages, max_tokens, temperature);
      
      // 🆕 요약 결과 텍스트 추출
      const summaryText = apiResponse.choices[0]?.message?.content || '';
      
      // ===== 3. 히스토리 저장 (인증된 사용자만) =====
      let savedHistoryId = null;
      
      if (req.user?.userId && req.body.saveHistory !== false) {
        try {
          // title과 url이 제공되지 않으면 저장하지 않음
          if (req.body.title && req.body.url && summaryText) {
            const historyData = {
              title: req.body.title.substring(0, 500),
              url: req.body.url,
              summary: summaryText.substring(0, 10000),
              qaHistory: [],
              metadata: {
                language: req.body.language || 'ko',
                model: model || OPENAI.DEFAULT_MODEL,
                wordCount: summaryText.length,
                tags: []
              }
            };
            
            savedHistoryId = await historyService.saveHistory(userId, historyData);
            console.log(`📚 히스토리 자동 저장 완료: ${userId} - ${historyData.title}`);
          }
        } catch (historyError) {
          // 히스토리 저장 실패해도 요약 응답은 정상 반환
          console.error('⚠️ 히스토리 저장 실패:', {
            userId,
            error: historyError.message
          });
        }
      }
      
      // ===== 4. 🆕 사용량 기록 + 요약 상세 정보 저장 =====
      // 요약 상세 정보 객체 생성
      const summaryDetail = req.body.title && req.body.url && summaryText ? {
        title: req.body.title.substring(0, 500),
        url: req.body.url,
        summary: summaryText.substring(0, 10000),
        model: model || OPENAI.DEFAULT_MODEL,
        language: req.body.language || 'ko',
        wordCount: summaryText.length,
        historyId: savedHistoryId // HistoryService와 연결
      } : null;
      
      // 사용량 추적 (요약 상세 정보 포함)
      const usageInfo = await usageService.trackUsage(
        userId, 
        FEATURE_TYPES.SUMMARY, 
        isPremium,
        summaryDetail // 🆕 요약 상세 정보 전달
      );
      
      console.log(`[Chat] 사용량 기록 완료 - userId: ${userId}, current: ${usageInfo.current}/${usageInfo.limit}`);
      
      // ===== 5. 응답 =====
      res.json({
        ...apiResponse,
        usage: {
          ...apiResponse.usage,
          userUsage: {
            userId,
            current: usageInfo.current,
            limit: usageInfo.limit === Infinity ? 'unlimited' : usageInfo.limit,
            remaining: usageInfo.remaining === Infinity ? 'unlimited' : usageInfo.remaining,
            isPremium: usageInfo.isPremium,
            authenticated: !!req.user
          }
        }
      });
      
    } catch (error) {
      console.error('[Chat] 에러 발생:', {
        userId: req.user?.userId || 'anonymous',
        error: error.message,
        stack: error.stack
      });
      
      next(error);
    }
  }
);

// ===== Circuit Breaker 상태 조회 엔드포인트 =====

router.get('/circuit-breaker', (req, res) => {
  const state = chatService.getCircuitBreakerState();

  res.json({
    success: true,
    circuitBreaker: state,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;