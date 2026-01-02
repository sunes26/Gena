/**
 * ChatService - 채팅 및 요약 비즈니스 로직
 * OpenAI API 호출, Circuit Breaker 패턴 적용
 *
 * @module services/ChatService
 * @version 1.0.0
 */

const {
  OPENAI,
  CIRCUIT_BREAKER
} = require('../constants');

const {
  ValidationError,
  OpenAIError,
  NetworkError
} = require('../middleware/errorHandler');

// ===== Circuit Breaker 구현 =====

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || CIRCUIT_BREAKER.FAILURE_THRESHOLD;
    this.timeout = options.timeout || CIRCUIT_BREAKER.TIMEOUT;
    this.resetTimeout = options.resetTimeout || CIRCUIT_BREAKER.RESET_TIMEOUT;

    this.state = 'CLOSED';
    this.failures = 0;
    this.nextAttempt = Date.now();
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        const remainingSeconds = Math.ceil((this.nextAttempt - Date.now()) / 1000);
        const error = new Error('CIRCUIT_BREAKER_OPEN');
        error.code = 'CIRCUIT_BREAKER_OPEN';
        error.remainingSeconds = remainingSeconds;
        error.retryAfter = remainingSeconds;
        throw error;
      }
      this.state = 'HALF_OPEN';
      console.log(`[Circuit Breaker] ${this.name} is now HALF_OPEN`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= CIRCUIT_BREAKER.HALF_OPEN_SUCCESS_THRESHOLD) {
        this.state = 'CLOSED';
        this.successCount = 0;
        console.log(`[Circuit Breaker] ${this.name} is now CLOSED`);
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.error(`[Circuit Breaker] ${this.name} is now OPEN (failures: ${this.failures})`);
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// ===== ChatService 클래스 =====

class ChatService {
  constructor() {
    this.circuitBreaker = new CircuitBreaker('OpenAI', {
      failureThreshold: CIRCUIT_BREAKER.FAILURE_THRESHOLD,
      resetTimeout: CIRCUIT_BREAKER.RESET_TIMEOUT
    });

    console.log('[ChatService] 초기화 완료 (Circuit Breaker 적용)');
  }

  /**
   * OpenAI API 호출
   *
   * @param {string} model - 사용할 모델
   * @param {Array} messages - 메시지 배열
   * @param {number} maxTokens - 최대 토큰 수
   * @param {number} temperature - 온도 (0-2)
   * @returns {Promise<Object>} OpenAI API 응답
   */
  async callOpenAI(model, messages, maxTokens, temperature) {
    const modelToUse = model || process.env.FALLBACK_MODEL || OPENAI.DEFAULT_MODEL;

    if (!OPENAI.AVAILABLE_MODELS.includes(modelToUse)) {
      throw new ValidationError(`지원하지 않는 모델입니다: ${modelToUse}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI.API_TIMEOUT);

    try {
      console.log(`[OpenAI] API 호출 시작 - 모델: ${modelToUse}, 메시지 수: ${messages.length}`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: messages,
          temperature: temperature !== undefined ? temperature : OPENAI.DEFAULT_TEMPERATURE,
          max_tokens: maxTokens || OPENAI.DEFAULT_MAX_TOKENS
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.json();
        console.error('[OpenAI] API 오류:', {
          status: response.status,
          error: error.error?.message
        });

        throw new OpenAIError(
          `OpenAI API error: ${response.status} - ${error.error?.message || 'Unknown error'}`
        );
      }

      const data = await response.json();
      console.log(`[OpenAI] API 호출 성공 - 토큰 사용: ${data.usage?.total_tokens || 'N/A'}`);

      return data;

    } catch (error) {
      clearTimeout(timeout);

      if (error.name === 'AbortError') {
        console.error('[OpenAI] API 타임아웃');
        throw new NetworkError('OpenAI API 요청 시간이 초과되었습니다');
      }

      throw error;
    }
  }

  /**
   * Circuit Breaker를 통한 OpenAI API 호출
   *
   * @param {string} model - 사용할 모델
   * @param {Array} messages - 메시지 배열
   * @param {number} maxTokens - 최대 토큰 수
   * @param {number} temperature - 온도 (0-2)
   * @returns {Promise<Object>} OpenAI API 응답
   */
  async chat(model, messages, maxTokens, temperature) {
    return await this.circuitBreaker.execute(async () => {
      return await this.callOpenAI(model, messages, maxTokens, temperature);
    });
  }

  /**
   * Circuit Breaker 상태 조회
   *
   * @returns {Object} Circuit Breaker 상태
   */
  getCircuitBreakerState() {
    return this.circuitBreaker.getState();
  }
}

// ===== Singleton 인스턴스 =====

const chatService = new ChatService();

// ===== Export =====

module.exports = chatService;
