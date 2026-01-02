/**
 * extension/pdf-offscreen-main.js
 * PDF Offscreen Document 메인 로직 (ES Module 버전)
 * CSP 준수 + ES Module import 방식
 * 
 * @version 2.1.0 - ping 처리 추가
 */

console.log('[PDF Offscreen] 🔵 ES Module 방식으로 시작...');

// ===== PDF.js ES Module Import =====
import * as pdfjsLib from './lib/pdf.mjs';

console.log('[PDF Offscreen] ✅ PDF.js 모듈 import 완료');

// ===== 전역 변수 =====
let isReady = false;
let initializationError = null;

// ===== 텍스트 정리 함수 =====

function cleanText(text) {
    if (!text) return '';
    
    text = text.replace(/\s{3,}/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    
    text = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
    
    return text.trim();
}

function countWords(text) {
    if (!text) return 0;
    
    const words = text.match(/[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]+/g);
    return words ? words.length : 0;
}

// ===== PDF 텍스트 추출 함수 =====

async function extractPDFText(pdfData, url) {
    try {
        console.log('[PDF Offscreen] PDF 추출 시작');
        console.log('[PDF Offscreen] 데이터 크기:', pdfData.length, 'bytes');

        if (!pdfjsLib) {
            throw new Error('PDF.js 라이브러리가 로드되지 않았습니다.');
        }

        const uint8Array = new Uint8Array(pdfData);

        sendProgress({
            stage: 'extract',
            progress: 55,
            message: chrome.i18n.getMessage('pdfProcessing')
        });

        const loadingTask = pdfjsLib.getDocument({
            data: uint8Array,
            useSystemFonts: true,
        });

        const pdf = await loadingTask.promise;
        console.log(`[PDF Offscreen] PDF 로드 완료: ${pdf.numPages} 페이지`);

        sendProgress({
            stage: 'extract',
            progress: 60,
            message: `총 ${pdf.numPages} 페이지 발견`
        });

        const maxPages = Math.min(pdf.numPages, 100);

        // ✨ 텍스트와 위치 정보를 함께 저장
        const textPromises = [];
        const textItems = []; // 각 텍스트 아이템의 상세 정보 저장

        for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            const pagePromise = pdf.getPage(pageNum)
                .then(async page => {
                    const textContent = await page.getTextContent();
                    const viewport = page.getViewport({ scale: 1.0 });

                    const pageText = textContent.items.map(item => item.str).join(' ');

                    // ✨ 각 텍스트 아이템의 위치 정보 저장
                    textContent.items.forEach(item => {
                        if (item.str && item.str.trim().length > 0) {
                            const transform = item.transform;
                            textItems.push({
                                text: item.str,
                                page: pageNum,
                                x: transform[4], // x 좌표
                                y: transform[5], // y 좌표
                                width: item.width,
                                height: item.height,
                                pageWidth: viewport.width,
                                pageHeight: viewport.height
                            });
                        }
                    });

                    const progress = 60 + Math.floor((pageNum / maxPages) * 35);
                    sendProgress({
                        stage: 'extract',
                        progress: progress,
                        currentPage: pageNum,
                        totalPages: maxPages,
                        message: chrome.i18n.getMessage('pdfExtractingProgress').replace('{page}', pageNum).replace('{total}', maxPages)
                    });

                    console.log(`[PDF Offscreen] 페이지 ${pageNum}/${maxPages} 완료 (${pageText.length}자)`);
                    return pageText;
                });

            textPromises.push(pagePromise);
        }

        const pageTexts = await Promise.all(textPromises);
        let extractedText = pageTexts.join('\n\n');

        console.log(`[PDF Offscreen] 총 ${textItems.length}개의 텍스트 아이템 위치 정보 저장`);

        sendProgress({
            stage: 'extract',
            progress: 95,
            message: chrome.i18n.getMessage('pdfExtractingInProgress')
        });

        extractedText = cleanText(extractedText);

        const maxLength = 100000;
        if (extractedText.length > maxLength) {
            console.warn(`[PDF Offscreen] 텍스트 길이 제한 (${extractedText.length} → ${maxLength})`);
            extractedText = extractedText.substring(0, maxLength) + '\n\n... (이하 생략)';
        }

        const result = {
            success: true,
            text: extractedText,
            textItems: textItems, // ✨ 위치 정보 포함
            metadata: {
                url: url,
                totalPages: pdf.numPages,
                extractedPages: maxPages,
                charCount: extractedText.length,
                wordCount: countWords(extractedText),
                hasPositionData: textItems.length > 0 // ✨ 위치 정보 유무
            }
        };

        console.log('[PDF Offscreen] 추출 완료:', result.metadata);

        sendProgress({
            stage: 'extract',
            progress: 100,
            message: chrome.i18n.getMessage('pdfExtractionComplete')
        });
        
        return result;

    } catch (error) {
        console.error('[PDF Offscreen] 추출 실패:', error);
        
        sendProgress({
            stage: 'error',
            progress: 0,
            message: error.message
        });
        
        return {
            success: false,
            error: error.message,
            text: '',
            metadata: null
        };
    }
}

function sendProgress(data) {
    try {
        chrome.runtime.sendMessage({
            action: 'pdfProgress',
            data: data
        }).catch(err => {
            console.log('[PDF Offscreen] 진행 상황 전송 실패:', err.message);
        });
    } catch (error) {
        console.log('[PDF Offscreen] 진행 상황 전송 오류:', error.message);
    }
}

// ===== 메시지 리스너 =====

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[PDF Offscreen] 메시지 받음:', request.action);
    
    // ✨ ping 처리 추가 (Background의 Keep-Alive)
    if (request.action === 'ping') {
        // ping은 무시 (Background가 처리함)
        return;
    }
    
    if (request.action === 'offscreenReady') {
        console.log('[PDF Offscreen] Ready 확인 응답:', isReady);
        
        if (initializationError) {
            sendResponse({ 
                ready: false, 
                error: initializationError 
            });
        } else {
            sendResponse({ 
                ready: isReady,
                version: pdfjsLib?.version || 'ES Module'
            });
        }
        return;
    }
    
    if (request.action === 'extractPDFFromOffscreen') {
        console.log('[PDF Offscreen] PDF 추출 요청 수신');

        if (!pdfjsLib) {
            console.error('[PDF Offscreen] PDF.js가 로드되지 않음');
            sendResponse({
                success: false,
                error: initializationError || 'PDF.js 라이브러리가 로드되지 않았습니다.',
                text: '',
                metadata: null
            });
            return;
        }

        if (!request.pdfData || !Array.isArray(request.pdfData)) {
            console.error('[PDF Offscreen] PDF 데이터가 없음');
            sendResponse({
                success: false,
                error: 'PDF 데이터가 제공되지 않았습니다.',
                text: '',
                metadata: null
            });
            return;
        }

        if (request.pdfData.length === 0) {
            console.error('[PDF Offscreen] PDF 데이터가 비어있음');
            sendResponse({
                success: false,
                error: 'PDF 데이터가 비어있습니다.',
                text: '',
                metadata: null
            });
            return;
        }

        extractPDFText(request.pdfData, request.url)
            .then(result => {
                console.log('[PDF Offscreen] 추출 결과 전송:', result.success ? '성공' : '실패');
                sendResponse(result);
            })
            .catch(error => {
                console.error('[PDF Offscreen] 추출 중 예외 발생:', error);
                sendResponse({
                    success: false,
                    error: error.message,
                    text: '',
                    metadata: null
                });
            });

        return true;
    }

    // ✨ 처리하지 않는 액션은 다른 리스너(background.js)가 처리하도록 false 반환
    console.log('[PDF Offscreen] 처리하지 않는 액션 - 다른 리스너로 전달:', request.action);
    return false;
});

// ===== 초기화 =====

async function initializeOffscreen() {
    console.log('[PDF Offscreen] 🔵 초기화 시작...');
    
    try {
        // 1. PDF.js 모듈이 이미 import되었는지 확인
        if (!pdfjsLib) {
            const errorMsg = 'PDF.js 모듈 import 실패';
            console.error('[PDF Offscreen] ❌', errorMsg);
            initializationError = errorMsg;
            isReady = false;
            
            notifyBackgroundReady(false, errorMsg);
            return;
        }

        // 2. Worker 설정
        console.log('[PDF Offscreen] Worker 설정 중...');
        
        // ✨ ES Module의 Worker 경로는 상대 경로로 설정
        pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.mjs';
        
        console.log('[PDF Offscreen] Worker URL:', pdfjsLib.GlobalWorkerOptions.workerSrc);

        // 3. 준비 완료
        isReady = true;
        initializationError = null;
        
        console.log('[PDF Offscreen] ✅ 초기화 완료');
        console.log('[PDF Offscreen] - PDF.js 타입: ES Module (.mjs)');
        console.log('[PDF Offscreen] - Worker:', pdfjsLib.GlobalWorkerOptions.workerSrc);
        
        // 4. Background에 준비 완료 능동 알림
        notifyBackgroundReady(true);
        
    } catch (error) {
        console.error('[PDF Offscreen] ❌ 초기화 오류:', error);
        initializationError = error.message;
        isReady = false;
        
        notifyBackgroundReady(false, error.message);
    }
}

/**
 * Background에 준비 완료 능동 알림
 */
function notifyBackgroundReady(ready, error = null) {
    try {
        chrome.runtime.sendMessage({
            action: 'offscreenInitialized',
            ready: ready,
            error: error,
            version: 'ES Module',
            timestamp: Date.now()
        }).then(() => {
            console.log('[PDF Offscreen] ✅ Background에 초기화 상태 전송 완료');
        }).catch(err => {
            console.warn('[PDF Offscreen] ⚠️ Background 알림 실패:', err.message);
        });
    } catch (error) {
        console.warn('[PDF Offscreen] ⚠️ 메시지 전송 불가:', error.message);
    }
}

// ===== 자동 초기화 (ES Module이므로 즉시 실행) =====

// DOM 로드 대기 없이 즉시 초기화 (ES Module은 defer 속성 기본)
initializeOffscreen();

console.log('[PDF Offscreen] 🔵 ES Module 스크립트 설정 완료');