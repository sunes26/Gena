﻿/**
 * extension\content.js
 * Gena Content Script
 * 웹페이지에서 콘텐츠를 추출하는 스크립트
 * 
 * ✨ v5.1.0 업데이트:
 * - Side Panel 자동 복원 배지 표시 기능 추가 (showSummaryBadge)
 * - PDF 추출 기능 추가 (extractPDF 메서드)
 * - 노이즈 제거 대폭 강화 (4단계 필터링)
 * - 광고/프로모션 제거 강화 (속성 기반 필터링 추가)
 * - CTA 버튼 텍스트 자동 감지 및 제거
 * - 메타 텍스트 패턴 제거 (공유하기, 댓글 수 등)
 * - 이미지 alt 텍스트 필터링 개선
 * - Extension context invalidated 에러 처리 추가
 * 
 * @version 5.1.0
 */

if (!window.GenaInitialized) {
  window.GenaInitialized = true;

  /**
   * 콘텐츠 추출기 클래스
   */
  class ContentExtractor {
    constructor() {
      this.config = {
        minContentLength: 100,
        maxContentLength: 50000
      };
    }

    /**
     * 메인 추출 함수
     * ✨ v5.1: PDF 감지 및 처리 추가
     */
    async extract() {
      console.log('[ContentExtractor] 추출 시작');

      try {
        // 🆕 PDF 페이지 감지
        if (window.pdfExtractor && window.pdfExtractor.isPDFPage()) {
          console.log('[ContentExtractor] PDF 페이지 감지 - PDF 추출 시도');
          return await this.extractPDF();
        }

        // 동적 콘텐츠 대기
        await this.waitForContent();

        // 메인 콘텐츠 추출
        const mainContent = this.extractMainContent();

        // iframe 콘텐츠 추출
        const iframeContent = this.extractFromIframes();

        // Shadow DOM 콘텐츠 추출 (1단계만)
        const shadowContent = this.extractFromShadowDOM();

        // 콘텐츠 결합
        const combinedContent = [mainContent, iframeContent, shadowContent]
          .filter(c => c && c.length > 0)
          .join('\n\n---\n\n');

        // 메타데이터 추출
        const metadata = this.extractMetadata();

        // 콘텐츠 정제
        const cleanedContent = this.cleanContent(combinedContent);

        return {
          content: cleanedContent,
          metadata: metadata,
          stats: {
            charCount: cleanedContent.length,
            wordCount: this.countWords(cleanedContent)
          }
        };

      } catch (error) {
        console.error('[ContentExtractor] 추출 오류:', error);
        throw error;
      }
    }

    /**
     * PDF 콘텐츠 추출
     * ✨ v5.1: PDF 추출 기능 추가
     */
    async extractPDF() {
      try {
        console.log('[ContentExtractor] PDF 추출 시작');
        
        if (!window.pdfExtractor) {
          throw new Error('PDF Extractor를 사용할 수 없습니다');
        }
        
        // PDF 텍스트 추출
        const result = await window.pdfExtractor.extractText();
        
        if (!result.success || !result.text) {
          throw new Error(result.error || 'PDF 추출 실패');
        }
        
        console.log('[ContentExtractor] PDF 추출 완료:', result.metadata);
        
        return {
          content: result.text,
          metadata: {
            ...this.extractMetadata(),
            isPDF: true,
            pdfPages: result.metadata?.extractedPages,
            pdfTotalPages: result.metadata?.totalPages
          },
          stats: {
            charCount: result.metadata?.charCount || 0,
            wordCount: result.metadata?.wordCount || 0
          }
        };
        
      } catch (error) {
        console.error('[ContentExtractor] PDF 추출 오류:', error);
        throw error;
      }
    }

    /**
     * 동적 콘텐츠 로딩 대기
     */
    async waitForContent() {
      return new Promise((resolve) => {
        const selectors = ['article', 'main', '[role="main"]', '.content', '#content'];
        const maxWait = 3000;
        const startTime = Date.now();

        const check = () => {
          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.length > this.config.minContentLength) {
              console.log('[ContentExtractor] 콘텐츠 발견:', selector);
              resolve();
              return;
            }
          }

          if (Date.now() - startTime > maxWait) {
            console.log('[ContentExtractor] 대기 시간 초과');
            resolve();
            return;
          }

          setTimeout(check, 500);
        };

        check();
      });
    }

    /**
     * 메인 콘텐츠 추출
     */
    extractMainContent() {
      // 우선순위 선택자
      const selectors = [
        'article',
        'main',
        '[role="main"]',
        '[role="article"]',
        '.article',
        '.post',
        '.content',
        '#content',
        '.post-content',
        '.entry-content',
        '.article-content',
        '.blog-post'
      ];

      // 가장 적합한 요소 찾기
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const content = this.extractTextFromElement(element);
          if (content.length > this.config.minContentLength) {
            console.log('[ContentExtractor] 메인 콘텐츠 발견:', selector);
            return content;
          }
        }
      }

      // 폴백: body 전체
      console.log('[ContentExtractor] 폴백: body에서 추출');
      return this.extractTextFromElement(document.body);
    }

    /**
     * 요소에서 텍스트 추출
     * ✨ v5.0 강화: 노이즈 제거 대폭 개선
     */
    extractTextFromElement(element) {
      if (!element) return '';

      // 복제하여 원본 보호
      const clone = element.cloneNode(true);

      // 🎯 1차 제거: 기본 노이즈 요소
      const removeSelectors = [
        'script', 'style', 'noscript', 'svg', 'iframe',
        'nav', 'header', 'footer', 'aside',
        '.sidebar', '.navigation', '.menu',
        '.advertisement', '.ads', '.ad', '.banner',
        '.popup', '.modal', '.social-share', '.comments',
        
        // 🆕 추가 제거 항목
        // 광고 관련
        '[class*="ad-"]', '[id*="ad-"]', '[class*="ads-"]', '[id*="ads-"]',
        '.sponsored', '.promotion', '.promo',
        
        // 네비게이션/메뉴
        '[role="navigation"]', '[role="menu"]', '[role="menubar"]',
        '.breadcrumb', '.breadcrumbs', '.nav', '.navbar',
        
        // CTA 버튼/배너
        '.cta', '.call-to-action', '.subscribe', '.newsletter',
        '.signup', '.sign-up', '.download-app',
        
        // 댓글/소셜
        '.comment-section', '.comment-list', '.discussion',
        '.social-buttons', '.share-buttons', '.social-media',
        
        // 관련 콘텐츠
        '.related', '.related-posts', '.related-articles',
        '.recommended', '.recommendations', '.you-may-like',
        '.more-from', '.trending',
        
        // 저자/메타정보 (본문 아닌 경우)
        '.author-bio', '.author-info', '.byline',
        '.published-date', '.last-updated', '.metadata',
        
        // 기타 노이즈
        '.cookie-banner', '.cookie-notice', '.gdpr',
        '.disclaimer', '.legal-notice',
        'form', 'button:not(article button)', 'input', 'select', 'textarea'
      ];

      removeSelectors.forEach(selector => {
        try {
          clone.querySelectorAll(selector).forEach(el => el.remove());
        } catch (e) {
          // 잘못된 선택자 무시
        }
      });

      // 🎯 2차 제거: 속성 기반 필터링
      const allElements = clone.querySelectorAll('*');
      allElements.forEach(el => {
        // aria-hidden 요소 제거
        if (el.getAttribute('aria-hidden') === 'true') {
          el.remove();
          return;
        }
        
        // display:none 또는 visibility:hidden 요소 제거
        const style = el.getAttribute('style') || '';
        if (style.includes('display:none') || style.includes('display: none') ||
            style.includes('visibility:hidden') || style.includes('visibility: hidden')) {
          el.remove();
          return;
        }
        
        // 광고 키워드가 포함된 class/id 제거
        const className = (el.className || '').toString().toLowerCase();
        const id = (el.id || '').toLowerCase();
        const adKeywords = ['advertisement', 'sponsored', 'promo', 'banner', 'popup'];
        
        if (adKeywords.some(keyword => className.includes(keyword) || id.includes(keyword))) {
          el.remove();
        }
      });

      // 🎯 3차 제거: 링크 텍스트 필터링
      clone.querySelectorAll('a').forEach(link => {
        const text = (link.textContent || '').toLowerCase();
        const spamKeywords = [
          '더 읽기', 'read more', 'もっと見る', '阅读更多',
          '구독', 'subscribe', '購読', '订阅',
          '가입', 'sign up', 'サインアップ', '注册',
          '다운로드', 'download', 'ダウンロード', '下载',
          '광고', 'advertisement', '広告', '广告'
        ];
        
        if (spamKeywords.some(keyword => text.includes(keyword))) {
          link.remove();
        }
      });

      // 텍스트 추출
      let text = clone.textContent || '';

      // 🎯 4차 정제: 불필요한 텍스트 패턴 제거
      // "이 기사를 공유하세요" 같은 메타 텍스트 제거
      const metaPatterns = [
        /공유하기|share this|シェア|分享/gi,
        /댓글\s*\d+|comments?\s*\d*|コメント\s*\d*|评论\s*\d*/gi,
        /조회수\s*\d+|views?\s*\d+|閲覧数\s*\d+|浏览量\s*\d+/gi,
        /좋아요\s*\d+|likes?\s*\d+|いいね\s*\d+|点赞\s*\d+/gi,
        /기자\s*:|\breporter\s*:|記者\s*:|记者\s*:/gi,
        /제보하기|send tip|情報提供|爆料/gi
      ];
      
      metaPatterns.forEach(pattern => {
        text = text.replace(pattern, '');
      });

      // 이미지 alt 텍스트 추가 (의미 있는 것만)
      const images = clone.querySelectorAll('img[alt]');
      const imageTexts = Array.from(images)
        .map(img => img.getAttribute('alt'))
        .filter(alt => alt && alt.length > 3 && alt.length < 200)
        .filter(alt => {
          // 의미 없는 alt 제외
          const lowerAlt = alt.toLowerCase();
          return !lowerAlt.includes('logo') && 
                 !lowerAlt.includes('icon') && 
                 !lowerAlt.includes('banner');
        })
        .map(alt => `[이미지: ${alt}]`);

      if (imageTexts.length > 0) {
        text += '\n\n' + imageTexts.join('\n');
      }

      return text;
    }

    /**
     * iframe에서 콘텐츠 추출
     */
    extractFromIframes() {
      const contents = [];
      const iframes = document.querySelectorAll('iframe');

      for (const iframe of iframes) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const content = iframeDoc.body?.textContent || '';
            if (content.length > this.config.minContentLength) {
              console.log('[ContentExtractor] iframe 콘텐츠 발견');
              contents.push(content);
            }
          }
        } catch (error) {
          // 크로스 오리진 iframe 접근 불가
        }
      }

      return contents.join('\n\n');
    }

    /**
     * Shadow DOM에서 콘텐츠 추출 (1단계만)
     */
    extractFromShadowDOM() {
      const contents = [];
      const elements = document.querySelectorAll('*');

      for (const element of elements) {
        if (element.shadowRoot) {
          const shadowText = element.shadowRoot.textContent || '';
          if (shadowText.length > 50) {
            console.log('[ContentExtractor] Shadow DOM 발견:', element.tagName);
            contents.push(shadowText);
          }
        }
      }

      return contents.join('\n\n');
    }

    /**
     * 메타데이터 추출
     */
    extractMetadata() {
      const metadata = {
        title: document.title || '',
        url: window.location.href,
        domain: window.location.hostname,
        language: document.documentElement.lang || 'unknown',
        description: '',
        author: '',
        keywords: []
      };

      // 메타 태그 파싱
      const metaTags = document.querySelectorAll('meta');
      metaTags.forEach(meta => {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        const content = meta.getAttribute('content');

        if (!name || !content) return;

        if (name === 'description' || name === 'og:description') {
          metadata.description = content;
        }
        if (name === 'author') {
          metadata.author = content;
        }
        if (name === 'keywords') {
          metadata.keywords = content.split(',').map(k => k.trim());
        }
      });

      return metadata;
    }

    /**
     * 콘텐츠 정제
     */
    cleanContent(content) {
      if (!content) return '';

      // 과도한 공백 정리
      content = content.replace(/\n{3,}/g, '\n\n');
      content = content.replace(/[ \t]{2,}/g, ' ');

      // 특수 문자 정리
      content = content.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Zero-width
      content = content.replace(/\u00A0/g, ' '); // Non-breaking space

      // 줄 시작/끝 공백 제거
      content = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

      // 길이 제한
      if (content.length > this.config.maxContentLength) {
        content = content.substring(0, this.config.maxContentLength) + '...';
      }

      return content.trim();
    }

    /**
     * 단어 수 계산
     */
    countWords(text) {
      if (!text) return 0;
      const words = text.match(/[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]+/g);
      return words ? words.length : 0;
    }
  }

  /**
   * ✨ v5.1.0: 요약 보기 배지 표시
   */
  function showSummaryBadge() {
    console.log('[Content] 요약 배지 표시 요청');

    // 중복 체크
    const existingBadge = document.getElementById('Gena-summary-badge');
    if (existingBadge) {
      console.log('[Content] 기존 배지가 이미 존재함');
      return;
    }

    // 배지 생성
    const badge = document.createElement('div');
    badge.id = 'Gena-summary-badge';
    badge.className = 'Gena-summary-badge';
    
    badge.innerHTML = `
      <span class="material-icons Gena-badge-icon">description</span>
      <span class="Gena-badge-text">요약 보기</span>
      <button class="Gena-badge-close" aria-label="닫기">
        <span class="material-icons">close</span>
      </button>
    `;

    document.body.appendChild(badge);

    // 페이드인 효과
    setTimeout(() => {
      badge.classList.add('Gena-badge-show');
    }, 100);

    // 배지 클릭 이벤트 (✨ Extension context 체크 추가)
    badge.addEventListener('click', async (e) => {
      if (e.target.closest('.Gena-badge-close')) {
        return; // 닫기 버튼은 별도 처리
      }

      try {
        // ✅ Extension context 유효성 체크
        if (!chrome.runtime?.id) {
          console.error('[Content] Extension context 무효화됨 - 페이지 새로고침 필요');
          showReloadNotification();
          return;
        }

        console.log('[Content] 배지 클릭 - Side Panel 열기');
        
        await chrome.runtime.sendMessage({
          action: 'openSidePanel'
        });

        console.log('[Content] Side Panel 열림 요청 완료');
        
        // 배지 제거
        badge.classList.add('Gena-badge-hide');
        setTimeout(() => {
          badge.remove();
        }, 300);

      } catch (error) {
        console.error('[Content] Side Panel 열기 실패:', error);

        // Extension context 에러인 경우
        if (error.message && error.message.includes('Extension context invalidated')) {
          showReloadNotification();
        } else {
          // 다른 에러는 배지만 제거
          badge.classList.add('Gena-badge-hide');
          setTimeout(() => {
            badge.remove();
          }, 300);
        }
      }
    });

    // 닫기 버튼 이벤트
    const closeBtn = badge.querySelector('.Gena-badge-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('[Content] 배지 닫기 버튼 클릭');
        
        badge.classList.add('Gena-badge-hide');
        setTimeout(() => {
          badge.remove();
        }, 300);
      });
    }

    console.log('[Content] 요약 배지 표시 완료');
  }

  /**
   * ✨ Extension context 무효화 시 새로고침 안내
   */
  function showReloadNotification() {
    // 기존 알림 제거
    const existingNotification = document.getElementById('Gena-reload-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'Gena-reload-notification';
    notification.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      animation: slideInFromTop 0.3s ease-out;
      max-width: 400px;
    `;

    notification.innerHTML = `
      <span style="font-size: 20px;">🔄</span>
      <div style="flex: 1;">
        <div style="font-weight: 600; margin-bottom: 4px;">확장 프로그램이 업데이트되었습니다</div>
        <div style="font-size: 12px; opacity: 0.9;">페이지를 새로고침해주세요</div>
      </div>
      <button id="Gena-reload-btn" style="
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        font-size: 13px;
        transition: all 0.2s;
        white-space: nowrap;
      " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
         onmouseout="this.style.background='rgba(255,255,255,0.2)'">
        새로고침
      </button>
      <button id="Gena-close-notification" style="
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        margin-left: 4px;
        opacity: 0.7;
        font-size: 18px;
        line-height: 1;
      " onmouseover="this.style.opacity='1'" 
         onmouseout="this.style.opacity='0.7'">
        ✕
      </button>
    `;

    // 애니메이션 CSS 추가
    if (!document.getElementById('Gena-reload-notification-styles')) {
      const style = document.createElement('style');
      style.id = 'Gena-reload-notification-styles';
      style.textContent = `
        @keyframes slideInFromTop {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes slideOutToTop {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(-100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // 새로고침 버튼
    const reloadBtn = notification.querySelector('#Gena-reload-btn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }

    // 닫기 버튼
    const closeBtn = notification.querySelector('#Gena-close-notification');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        notification.style.animation = 'slideOutToTop 0.3s ease-in';
        setTimeout(() => {
          notification.remove();
        }, 300);
      });
    }

    // 10초 후 자동 제거
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideOutToTop 0.3s ease-in';
        setTimeout(() => {
          notification.remove();
        }, 300);
      }
    }, 10000);

    console.log('[Content] 새로고침 안내 알림 표시');
  }

  /**
   * 메시지 리스너
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // ✅ Extension context 체크
    if (!chrome.runtime?.id) {
      console.warn('[Content] Extension context 무효화됨 - 메시지 무시');
      return false;
    }

    console.log('[Content] 메시지 수신:', request.action);

    try {
      switch (request.action) {
        case 'extractContent':
          console.log('[ContentExtractor] 추출 요청 받음');

          const extractor = new ContentExtractor();

          extractor.extract()
            .then(result => {
              console.log('[ContentExtractor] 추출 완료:', result.stats);
              sendResponse({
                success: true,
                content: result.content,
                metadata: result.metadata,
                stats: result.stats
              });
            })
            .catch(error => {
              console.error('[ContentExtractor] 추출 실패:', error);
              sendResponse({
                success: false,
                error: error.message,
                content: ''
              });
            });

          return true; // 비동기 응답

        case 'showSummaryBadge':
          showSummaryBadge();
          sendResponse({ success: true });
          break;

        case 'checkPDFExtractor':
          console.log('[ContentExtractor] PDF Extractor 초기화 확인 요청');
          
          const initialized = typeof window.pdfExtractor !== 'undefined' && 
                             window.pdfExtractor !== null &&
                             typeof window.pdfExtractor.extractText === 'function';
          
          console.log('[ContentExtractor] PDF Extractor 초기화 상태:', initialized);
          
          sendResponse({
            initialized: initialized,
            available: initialized
          });
          break;

        case 'ping':
          sendResponse({ success: true });
          break;

        default:
          console.warn('[Content] 알 수 없는 액션:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[Content] 메시지 처리 오류:', error);
      sendResponse({ success: false, error: error.message });
    }

    return false; // 동기 응답
  });

  // 초기화 로그
  console.log('[Content] Content script 초기화 완료');
}