# Gena 🧞‍♂️

> AI 기반 웹페이지 요약 및 질문-답변 Chrome Extension

[![Version](https://img.shields.io/badge/version-5.3.0-blue.svg)](https://github.com/yourusername/Gena)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Coming%20Soon-orange.svg)]()
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange.svg)](https://firebase.google.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-brightgreen.svg)](https://openai.com/)

## 📋 목차

- [프로젝트 소개](#-프로젝트-소개)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [시스템 아키텍처](#-시스템-아키텍처)
- [설치 및 실행](#-설치-및-실행)
- [프로젝트 구조](#-프로젝트-구조)
- [API 엔드포인트](#-api-엔드포인트)
- [핵심 모듈 및 서비스](#-핵심-모듈-및-서비스)
- [개발 가이드](#-개발-가이드)
- [Firebase 설정](#-firebase-설정)
- [환경 변수](#-환경-변수)
- [배포](#-배포)
- [보안 및 인증](#-보안-및-인증)
- [에러 처리](#-에러-처리)
- [모니터링](#-모니터링)
- [로드맵](#-로드맵)
- [라이선스](#-라이선스)

## 🎯 프로젝트 소개

**Gena**는 OpenAI GPT-4o-mini를 활용하여 웹페이지를 즉시 요약하고, 내용에 대해 질문할 수 있는 올인원 Chrome Extension입니다. 정보 과부하 시대에 효율적인 콘텐츠 소비를 돕습니다.

### 핵심 가치

- ⚡ **빠른 요약**: 긴 글, 뉴스, 논문을 3-5줄로 즉시 요약
- 📄 **PDF 지원**: PDF 파일 텍스트 자동 추출 및 요약 (180초 타임아웃, 프리미엄 전용)
- 💬 **대화형 Q&A**: 요약 후 추가 질문으로 깊이 있는 이해 (프리미엄 전용)
- 🌏 **다국어 지원**: 한국어, 영어, 일본어, 중국어 완벽 지원
- 🔐 **Firebase 인증**: 영구 로그인 및 자동 토큰 갱신
- ☁️ **클라우드 동기화**: 여러 기기에서 히스토리 공유 (Firestore)
- 🎨 **현대적 UI**: Material Design 기반의 직관적 Side Panel 인터페이스
- ✨ **실시간 진행 상황**: PDF 추출 단계별 시각적 피드백
- 🛡️ **Circuit Breaker**: OpenAI API 장애 시 자동 복구
- 📧 **이메일 통합**: 회원가입, 비밀번호 재설정 이메일 자동 발송
- 🔄 **Service Worker Keep-Alive**: PDF 처리 시 안정적인 백그라운드 작업
- 🔔 **Side Panel 자동 복원**: 탭 전환 후 복귀 시 자동 재열림 (v5.1.0) ✨
- 📛 **스마트 배지**: 5분 이후 복귀 시 요약 보기 배지 표시 (v5.1.0) ✨
- 🔒 **보안 강화**: JWT SECRET 512비트, Firestore 보안 규칙 강화 (v5.2.0) ✨
- ⚡ **성능 최적화**: ChatService 분리, Rate Limit 최적화 (v5.2.0) ✨

### 타겟 사용자

- 정보 수집이 많은 직장인 (마케터, 연구원, 기자)
- 학생 및 연구자
- 영어 콘텐츠를 소비하는 한국인
- 기업의 리서치팀, 컨설팅팀

## ✨ 주요 기능

### 무료 버전
- ✅ 하루 3회 웹페이지 요약
- ✅ 요약 길이 자동 최적화 (콘텐츠 길이 기반)
- ✅ 로컬 히스토리 저장
- ✅ 4개 언어 지원 (한국어, 영어, 일본어, 중국어)
- ✅ Rate Limiting (요약 분당 10회, 히스토리 분당 30회)
- ✅ Modern Side Panel UI
- ✅ Side Panel 자동 복원 (v5.1.0) ✨
- ✅ Extension context 에러 복구 (v5.1.0) ✨

### 프리미엄 버전
- 🌟 무제한 요약
- 🌟 **PDF 파일 요약 지원** (ES Module 기반, 180초 타임아웃, 실시간 진행 표시)
- 🌟 **무제한 질문 기능** (채팅 스타일 Q&A UI)
- 🌟 클라우드 히스토리 동기화 (Firestore)
- 🌟 고급 요약 옵션 (very_detailed, ultra_detailed)
- 🌟 다국어 번역 + 요약
- 🌟 광고 제거
- 🌟 우선 지원
- 🌟 Rate Limiting (분당 100회)

### 기업용 기능 (예정)
- 👥 팀 대시보드 및 협업 기능
- 📊 사용량 통계 및 분석
- 🔒 관리자 권한 관리
- 🔌 API 액세스

## 🛠 기술 스택

### Frontend (Chrome Extension)
- **언어**: JavaScript (ES6+), HTML5, CSS3
- **프레임워크**: Vanilla JS (Chrome Extension Manifest V3)
- **UI 라이브러리**: Material Icons, Inter Font
- **다국어**: Chrome i18n API + I18nManager (v6.0.0)
- **PDF 처리**: PDF.js (ES Module, .mjs) v2.0.0

### Backend (Proxy Server)
- **언어**: Node.js 18+ + Express.js
- **데이터베이스**: 
  - **Firebase Firestore** (사용자 데이터, 히스토리, 구독 정보, 토큰 관리)
  - Firebase Realtime Database (실시간 동기화, 선택사항)
- **인증**: Firebase Authentication + JWT (v9.0.2)
- **AI 모델**: OpenAI GPT-4o-mini (gpt-4o-mini)
- **결제**: Stripe (v14.25.0)
- **이메일**: Nodemailer (Gmail SMTP / SendGrid)
- **비밀번호 해싱**: bcryptjs (10 salt rounds)
- **컨테이너**: Docker + Docker Compose
- **호스팅**: 
  - Google Cloud Run (권장)
  - AWS (EC2, S3)
  - Vercel

### 보안
- **인증**: Firebase Auth (LOCAL persistence) + JWT Token (512비트 SECRET)
- **데이터 암호화**: Firestore 자동 암호화 (AES-256)
- **비밀번호 해싱**: bcrypt (10 rounds)
- **입력 검증**: express-validator (v7.2.1)
- **보안 헤더**: helmet (v7.2.0)
- **Rate Limiting**:
  - 요약 API: 분당 10회 (무료), 무제한 (프리미엄)
  - 히스토리 조회: 분당 30회 (무료), 무제한 (프리미엄)
  - 인증 API: 분당 5회 (모든 사용자)
  - Global IP: 분당 100회 (DDoS 방지)
- **Circuit Breaker**: ChatService 구현 (5회 실패 시 차단)
- **Firestore 보안 규칙**: 관리자/사용자 권한 분리, _test 컬렉션 보호

## 🏗 시스템 아키텍처
```
┌─────────────────────────────────────────────────────────┐
│                   Chrome Extension                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │ Side Panel │  │  Content   │  │ Background │       │
│  │   (UI)     │  │  Script    │  │  Service   │       │
│  │  v7.1.0    │  │  v5.1.0    │  │  v5.1.0    │       │
│  │            │  │            │  │            │       │
│  │ ✨ 자동    │  │ ✨ 배지    │  │ ✨ 상태    │       │
│  │   복원     │  │   표시     │  │   저장     │       │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘       │
│        │               │               │               │
│        │         ┌─────┴─────┐         │               │
│        │         │ PDF       │         │               │
│        │         │ Offscreen │         │               │
│        │         │ v2.1.0    │         │               │
│        │         │ (ES Mod.) │         │               │
│        │         └───────────┘         │               │
│        │                               │               │
│        │         ┌──────────────┐      │               │
│        │         │ Keep-Alive   │      │               │
│        │         │  (15초 주기)  │      │               │
│        │         │  v7.0.0      │      │               │
│        │         └──────────────┘      │               │
└────────┼───────────────┼───────────────┼──────────────┘
         │               │               │
         │        ┌──────┴───────┐       │
         │        │ PDF Progress │       │
         │        │  Messages    │       │
         │        └──────────────┘       │
         │                               │
         └───────────────┴───────────────┘
                         │
                         │ HTTPS (JWT Bearer Token)
                         ▼
         ┌───────────────────────────────┐
         │  Proxy Server (Node.js/Express)│
         │  ┌──────────┐  ┌──────────┐   │
         │  │ Express  │  │  Helmet  │   │
         │  │  Router  │  │Rate Limit│   │
         │  │          │  │ Circuit  │   │
         │  │          │  │ Breaker  │   │
         │  └────┬─────┘  └──────────┘   │
         └───────┼────────────────────────┘
                 │
      ┌──────────┼──────────┬──────────┐
      │          │          │          │
      ▼          ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ OpenAI  │ │Firebase │ │ Stripe  │ │  SMTP   │
│   API   │ │ Cloud   │ │   API   │ │ Server  │
│         │ │  - Auth │ │         │ │(Email)  │
│ Circuit │ │  -Store │ │         │ │         │
│ Breaker │ │ -Tokens │ │         │ │         │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```

### Side Panel 자동 복원 플로우 (v5.1.0) ✨
```
┌───────────────────────────────────────────────────────────┐
│              Side Panel 자동 복원 플로우                   │
└───────────────────────────────────────────────────────────┘

1. 사용자가 탭 A에서 요약 실행
   │
   ├─→ [Side Panel] 요약 완료 후 상태 저장
   │   └─→ Background에 saveSidePanelState 메시지 전송
   │
   ├─→ [Background] Firestore에 탭 상태 저장
   │   └─→ sidePanelState_{tabId}: {
   │         tabId, hasSummary: true, timestamp, lastAccessed
   │       }
   │
   └─→ [Background] 해당 탭에서 Side Panel 활성화
       └─→ chrome.sidePanel.setOptions({ tabId, enabled: true })

2. 사용자가 탭 B로 이동
   │
   ├─→ [Side Panel] 탭 변경 감지 (onActivated)
   │   └─→ 현재 탭 ID와 다른 탭으로 이동 감지
   │
   ├─→ [Side Panel] window.close() 호출
   │   └─→ Side Panel 자동으로 닫힘 ✅
   │
   └─→ [Background] 이전 탭 Side Panel 비활성화
       └─→ chrome.sidePanel.setOptions({
             tabId: previousTabId,
             enabled: false
           })

3. 사용자가 탭 A로 복귀 (5분 이내)
   │
   ├─→ [Background] chrome.tabs.onActivated 트리거
   │
   ├─→ [Background] handleSidePanelRestore() 호출
   │   ├─→ autoReopenSidePanel 설정 확인
   │   ├─→ Firestore에서 탭 상태 조회
   │   └─→ 경과 시간 체크: Date.now() - lastAccessed
   │
   ├─→ [Background] 5분 이내 감지
   │   ├─→ chrome.sidePanel.setOptions({ enabled: true })
   │   ├─→ chrome.sidePanel.open({ windowId })
   │   └─→ 상태 업데이트 (lastAccessed 갱신)
   │
   └─→ [Side Panel] 자동으로 다시 열림 ✅

4. 사용자가 탭 A로 복귀 (5분 이후)
   │
   ├─→ [Background] handleSidePanelRestore() 호출
   │
   ├─→ [Background] 5분 이후 감지
   │   └─→ Content Script에 showSummaryBadge 메시지 전송
   │
   ├─→ [Content] 배지 생성 및 표시
   │   ├─→ 우하단에 "요약 보기" 배지 표시 📛
   │   ├─→ 페이드인 애니메이션
   │   └─→ Material Icons 사용
   │
   └─→ 사용자가 배지 클릭
       ├─→ [Content] Extension context 유효성 체크
       │   ├─→ chrome.runtime.id 존재 확인
       │   └─→ 무효화된 경우: 새로고침 안내 알림 표시 🔄
       │
       ├─→ [Content] openSidePanel 메시지 전송
       │
       ├─→ [Background] Side Panel 열기
       │
       └─→ [Content] 배지 페이드아웃 및 제거

※ 타임아웃: 5분 (300초)
※ Extension context: 확장 프로그램 재로드 시 자동 복구
※ 배지 스타일: Material Design + Gradient
※ 설정: autoReopenSidePanel (기본값 true)
```

### Extension Context Invalidated 복구 플로우 (v5.1.0) ✨
```
┌───────────────────────────────────────────────────────────┐
│           Extension Context 에러 복구 플로우               │
└───────────────────────────────────────────────────────────┘

확장 프로그램 재로드/업데이트
  ↓
기존 Content Script의 Extension context 무효화
  ↓
사용자가 배지 클릭
  ↓
[Content] chrome.runtime.id 체크
  ├─→ 존재함: 정상 동작 (Side Panel 열기) ✅
  └─→ undefined: Extension context 무효화됨 ⚠️
      ↓
      [Content] showReloadNotification() 호출
      ↓
      새로고침 안내 알림 표시
      ├─→ 그라데이션 배경 (보라색)
      ├─→ "확장 프로그램이 업데이트되었습니다" 메시지
      ├─→ "페이지를 새로고침해주세요" 안내
      ├─→ "새로고침" 버튼
      └─→ "✕" 닫기 버튼
      ↓
      사용자가 "새로고침" 클릭
      ↓
      window.location.reload()
      ↓
      페이지 새로고침
      ↓
      Content Script 재주입
      ↓
      정상 동작 ✅

※ 타임아웃: 알림 10초 후 자동 닫힘
※ 애니메이션: slideInFromTop, slideOutToTop
※ 스타일: Material Design + Glassmorphism
```

### PDF 처리 플로우 (v7.0.0)
```
┌───────────────────────────────────────────────────────────┐
│                     PDF 추출 플로우                        │
└───────────────────────────────────────────────────────────┘

1. 사용자가 Side Panel에서 "요약하기" 클릭
   │
   ├─→ [Side Panel] PDF URL 감지
   │
   ├─→ [Side Panel] Keep-Alive 시작 (15초 주기 ping)
   │
   ├─→ [Side Panel] Background에 extractPDF 메시지 전송
   │
   └─→ [Background] 메시지 수신

2. Background Service Worker 처리
   │
   ├─→ [Background] PDF 다운로드 시작 (fetch)
   │   └─→ 진행 상황: 0% → 50% (다운로드 중)
   │
   ├─→ [Background] Offscreen Document 생성/활성화
   │   └─→ 진행 상황: 50% → 55% (준비 중)
   │
   ├─→ [Background] Offscreen에 PDF 데이터 전송
   │
   └─→ [Offscreen] PDF.js로 텍스트 추출
       ├─→ 진행 상황: 55% → 60% (분석 중)
       ├─→ 진행 상황: 60% → 95% (페이지별 추출)
       └─→ 진행 상황: 95% → 100% (정리 중)

3. 결과 반환 및 Keep-Alive 종료
   │
   ├─→ [Offscreen] 추출 완료 → Background 전송
   │
   ├─→ [Background] pdfExtractionComplete 메시지 발송
   │
   ├─→ [Side Panel] 결과 수신 및 Keep-Alive 중지
   │
   └─→ [Side Panel] 텍스트 요약 진행

※ 타임아웃: 180초 (ACK 10초 + 추출 180초)
※ Keep-Alive: PDF 처리 중 Service Worker 유지
※ 진행 상황: 실시간 UI 업데이트 (0% → 100%)
```

### Firebase Firestore 데이터 구조
```
firestore/
├── users/{userId}
│   ├── id: string (Firebase Auth UID)
│   ├── email: string
│   ├── name: string | null
│   ├── extensionId: string
│   ├── isPremium: boolean
│   ├── role: 'user' | 'admin' | 'moderator'
│   ├── subscriptionPlan: 'free' | 'pro' | 'team' | 'enterprise'
│   ├── stripeCustomerId: string | null
│   ├── createdAt: timestamp
│   ├── updatedAt: timestamp
│   ├── lastLoginAt: timestamp
│   ├── metadata: object
│   │   ├── emailVerified: boolean
│   │   ├── loginCount: number
│   │   ├── signupMethod: 'email' | 'google'
│   │   └── ...
│   │
│   ├── /history/{historyId}  ← 서브컬렉션
│   │   ├── userId: string
│   │   ├── title: string (1-500자)
│   │   ├── url: string
│   │   ├── summary: string (1-10000자)
│   │   ├── qaHistory: array<{question, answer, timestamp}>
│   │   ├── metadata: object
│   │   │   ├── language: 'ko' | 'en' | 'ja' | 'zh'
│   │   │   ├── model: string
│   │   │   ├── wordCount: number
│   │   │   ├── tags: array<string>
│   │   │   └── domain: string
│   │   ├── timestamp: number (JavaScript timestamp)
│   │   ├── createdAt: timestamp
│   │   ├── updatedAt: timestamp
│   │   └── deletedAt: timestamp | null (soft delete)
│   │
│   ├── /daily/{date}  ← 서브컬렉션 (사용량 추적)
│   │   ├── userId: string
│   │   ├── date: string (YYYY-MM-DD)
│   │   ├── count: number (요약 횟수)
│   │   ├── questionCount: number (질문 횟수)
│   │   ├── isPremium: boolean
│   │   ├── summaries: array<object>  ← 요약 상세 정보
│   │   │   ├── title: string
│   │   │   ├── url: string
│   │   │   ├── summary: string
│   │   │   ├── model: string
│   │   │   ├── language: string
│   │   │   ├── wordCount: number
│   │   │   ├── historyId: string | null
│   │   │   └── timestamp: timestamp
│   │   └── createdAt: timestamp
│   │
│   └── /tokens/{tokenId}  ← 서브컬렉션 (비밀번호 재설정, 이메일 인증)
│       ├── id: string
│       ├── userId: string
│       ├── token: string (해시된 토큰)
│       ├── type: 'password-reset' | 'email-verification'
│       ├── used: boolean
│       ├── expiresAt: timestamp
│       ├── createdAt: timestamp
│       └── usedAt: timestamp | null
│
├── subscriptions/{userId}
│   ├── userId: string
│   ├── plan: 'free' | 'pro' | 'team' | 'enterprise'
│   ├── status: 'active' | 'canceled' | 'past_due'
│   ├── stripeSubscriptionId: string | null
│   ├── currentPeriodStart: timestamp
│   ├── currentPeriodEnd: timestamp
│   ├── limits: object
│   │   ├── dailySummaries: number | Infinity
│   │   ├── dailyQuestions: number | Infinity
│   │   └── historyStorage: number
│   ├── usage: object
│   │   ├── summariesUsed: number
│   │   ├── questionsUsed: number
│   │   └── lastResetAt: timestamp
│   ├── createdAt: timestamp
│   └── updatedAt: timestamp
│
└── usageHistory/{usageId}
    ├── userId: string
    ├── type: 'summary' | 'question' | 'api' | 'pdf'
    ├── date: string (YYYY-MM-DD)
    ├── metadata: object
    │   ├── title: string
    │   ├── url: string
    │   ├── model: string
    │   ├── tokensUsed: number
    │   └── ...
    └── createdAt: timestamp
```

## 📁 프로젝트 구조

```
Gena/
├── docker-compose.yml          # Docker Compose 설정 (루트)
├── package-lock.json           # NPM 패키지 잠금 파일 (루트)
├── readme.md                   # 프로젝트 README (이 파일)
├── SECURITY.md                 # 보안 가이드
│
├── extension/                  # Chrome Extension
│   ├── manifest.json          # Extension 매니페스트 (v3, v2.3.1)
│   ├── config.js              # 중앙 설정 파일
│   ├── package-lock.json      # Extension NPM 패키지 잠금 파일
│   │
│   ├── auth.html              # 인증 페이지
│   ├── auth.css               # 인증 페이지 스타일
│   ├── auth.js                # 인증 로직
│   │
│   ├── firebase-app.js        # Firebase App SDK (v10.8.0)
│   ├── firebase-auth.js       # Firebase Auth SDK (v10.8.0)
│   │
│   ├── sidepanel.html         # Side Panel HTML (v7.0) ✨
│   ├── sidepanel.css          # 채팅 스타일 Q&A UI (v6.0) ✨
│   ├── sidepanel.js           # Side Panel 로직 (v7.0.0, Keep-Alive) ✨
│   │
│   ├── options.html           # 설정 페이지 HTML
│   ├── options.css            # 프리미엄 잠금 오버레이 (v2.3.0) ✨
│   ├── options.js             # 설정 페이지 로직 (v2.3.0) ✨
│   │
│   ├── popup.html             # Popup HTML (레거시)
│   ├── popup.css              # Popup 스타일
│   ├── popup.js               # Popup 로직
│   │
│   ├── background.js          # Background Service Worker (v5.0.0)
│   ├── content.js             # Content Script (v5.1.0)
│   ├── content-styles.css     # Content Script 스타일
│   ├── error-styles.css       # 에러 스타일
│   │
│   ├── pdf-extractor.js       # PDF 추출 로직 (v2.0.0, ES Module) ✨
│   ├── pdf-offscreen.html     # Offscreen HTML (ES Module) ✨
│   ├── pdf-offscreen-main.js  # Offscreen 메인 (v2.1.0, ping 처리) ✨
│   │
│   ├── _locales/              # 다국어 리소스
│   │   ├── ko/messages.json   # 한국어
│   │   ├── en/messages.json   # 영어
│   │   ├── ja/messages.json   # 일본어
│   │   └── zh/messages.json   # 중국어
│   │
│   ├── dashboard/             # 에러 대시보드
│   │   └── error-dashboard.html
│   │
│   ├── icons/                 # 아이콘 파일들
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   ├── icon128.png
│   │   └── logo.png
│   │
│   ├── lib/                   # 라이브러리
│   │   ├── pdf.mjs            # PDF.js (ES Module) ✨
│   │   ├── pdf.mjs.map        # PDF.js Source Map
│   │   ├── pdf.worker.mjs     # PDF.js Worker ✨
│   │   ├── pdf.worker.mjs.map # Worker Source Map
│   │   ├── pdf.sandbox.mjs    # PDF.js Sandbox ✨
│   │   ├── pdf.sandbox.mjs.map # Sandbox Source Map
│   │   └── cmaps/             # PDF.js 문자 맵 (CJK 지원)
│   │       ├── 78-EUC-H.bcmap
│   │       ├── Adobe-CNS1-*.bcmap
│   │       ├── Adobe-GB1-*.bcmap
│   │       ├── Adobe-Japan1-*.bcmap
│   │       ├── Adobe-Korea1-*.bcmap
│   │       ├── UniCNS-*.bcmap
│   │       ├── UniGB-*.bcmap
│   │       ├── UniJIS-*.bcmap
│   │       ├── UniKS-*.bcmap
│   │       └── ... (총 200+ cmap 파일)
│   │
│   └── modules/               # 핵심 모듈
│       ├── api-client.js      # API 클라이언트 (레거시)
│       ├── api-service.js     # API 호출 (v6.2.0)
│       ├── auth-manager.js    # 인증 관리 (v4.0.0)
│       ├── error-handler.js   # 에러 핸들러
│       ├── history-manager.js # 히스토리 관리
│       ├── i18n-manager.js    # 국제화 관리 (신규) ✨
│       ├── language-manager.js # 다국어 관리 (v6.0.0)
│       ├── qa-manager.js      # Q&A 관리 ✨
│       ├── security.js        # 보안 유틸리티
│       ├── settings-manager.js # 설정 관리
│       ├── storage-manager.js # 스토리지 관리
│       ├── sync-manager.js    # 동기화 관리
│       ├── token-manager.js   # 토큰 관리
│       ├── ui-components.js   # UI 컴포넌트
│       ├── ui-manager.js      # UI 관리
│       ├── usage-manager.js   # 사용량 관리
│       └── utils.js           # 유틸리티
│
└── server/                    # Node.js Proxy Server
    ├── .gitignore            # Git 제외 파일 목록 (보안 중요!)
    ├── .dockerignore         # Docker 제외 파일 목록
    ├── .gcloudignore         # Google Cloud 제외 파일 목록
    ├── .firebaserc           # Firebase 프로젝트 설정
    ├── Dockerfile            # Docker 이미지 빌드 설정
    ├── docker-compose.yml    # Docker Compose 설정 (서버용)
    ├── package.json          # 서버 의존성
    ├── package-lock.json     # 서버 패키지 잠금 파일
    ├── .env                  # 환경 변수 (보안!) ⚠️ Git 제외 필수
    ├── serviceAccountKey.json # Firebase 서비스 계정 키 (보안!) ⚠️ Git 제외 필수
    ├── user-db.js            # 사용자 데이터베이스 (개발용)
    │
    ├── firebase.json         # Firebase 설정
    ├── firestore.rules       # Firestore 보안 규칙
    ├── firestore.indexes.json # Firestore 인덱스
    │
    ├── scripts/              # 유틸리티 스크립트
    │   └── firebase-init.js  # Firebase 초기화 스크립트
    │
    └── src/
        ├── server.js         # 메인 서버 파일 (Cloud Run 최적화)
        ├── app.js            # Express 앱 설정
        │
        ├── config/
        │   └── firebase.js   # Firebase Admin 초기화
        │
        ├── constants/
        │   └── index.js      # 전역 상수 정의
        │
        ├── routes/
        │   ├── index.js      # 메인 라우터
        │   └── api/
        │       ├── auth.js   # 인증 API (v3.0.0)
        │       ├── chat.js   # 채팅/요약 API
        │       ├── usage.js  # 사용량 조회 API
        │       └── history.js # 히스토리 관리 API
        │
        ├── middleware/
        │   ├── auth.js       # JWT 인증 미들웨어 (v3.0.0)
        │   ├── errorHandler.js # 에러 핸들러 (v2.0.0)
        │   ├── rateLimiter.js # Rate Limiting (v1.0.0)
        │   └── validator.js  # 입력 검증 (v2.2.0)
        │
        ├── services/
        │   ├── AuthService.js     # Firebase Auth 서비스 (v3.0.0)
        │   ├── ChatService.js     # 채팅/요약 서비스 (v1.0.0) ✨ 신규
        │   ├── EmailService.js    # 이메일 발송 서비스
        │   ├── TokenService.js    # 토큰 관리 서비스
        │   ├── UsageService.js    # 사용량 추적 (v2.1.0)
        │   └── HistoryService.js  # 히스토리 관리
        │
        ├── tests/            # 테스트 파일
        │   └── password.test.js # 비밀번호 유틸리티 테스트
        │
        └── utils/            # 유틸리티
            ├── jwt.js        # JWT 토큰 유틸리티
            ├── password.js   # 비밀번호 해싱 유틸리티
            ├── password-README.md # 비밀번호 유틸리티 가이드
            └── tokenUtils.js # 토큰 생성 유틸리티

⚠️ 주의사항:
- .env, serviceAccountKey.json은 절대 Git에 커밋하지 마세요!
- 모든 보안 관련 파일은 .gitignore에 포함되어 있는지 확인하세요.
- 문서 파일들은 루트의 SECURITY.md와 프로젝트 문서를 참조하세요.
```

## 🌐 API 엔드포인트

### 시스템 엔드포인트
```
GET  /                  - API 정보 및 엔드포인트 목록
GET  /health            - 헬스체크 (서버 상태 및 의존성 확인)
```

### 인증 API (`/api/auth`)
```
POST   /api/auth/signup              - 회원가입 (Firebase Auth + 이메일 발송)
POST   /api/auth/login               - 로그인 (ID Token 검증)
POST   /api/auth/logout              - 로그아웃
GET    /api/auth/me                  - 현재 사용자 정보 조회
PUT    /api/auth/profile             - 프로필 업데이트
POST   /api/auth/change-password     - 비밀번호 변경
POST   /api/auth/forgot-password     - 비밀번호 재설정 요청 (이메일 발송)
POST   /api/auth/reset-password      - 비밀번호 재설정 완료
POST   /api/auth/verify-email        - 이메일 인증 확인
POST   /api/auth/resend-verification - 인증 이메일 재발송
POST   /api/auth/google-signin       - Google OAuth 로그인
DELETE /api/auth/account             - 계정 삭제
```

### 채팅/요약 API (`/api/chat`)
```
POST /api/chat                  - 채팅/요약 요청 (ChatService 사용, Circuit Breaker 적용)
GET  /api/chat/circuit-breaker  - Circuit Breaker 상태 조회
```

**Rate Limit:**
- 무료 사용자: 분당 10회 (하루 3회 요약 제한 고려)
- 프리미엄 사용자: 무제한

### 사용량 조회 API (`/api/usage`)
```
GET  /api/usage            - 현재 사용량 조회
POST /api/usage/increment  - 사용량 증가 (내부용)
GET  /api/usage/statistics - 사용량 통계 (기간별)
GET  /api/usage/check      - 사용 가능 여부 확인
GET  /api/usage/reset-info - 리셋 시간 정보
```

### 히스토리 관리 API (`/api/history`)
```
GET    /api/history/statistics     - 히스토리 통계
GET    /api/history                - 히스토리 목록 조회 (페이지네이션, 검색)
POST   /api/history                - 히스토리 저장
GET    /api/history/:historyId     - 단일 히스토리 조회
POST   /api/history/:historyId/qa  - Q&A 추가
DELETE /api/history/:historyId     - 히스토리 삭제 (soft/hard)
```

**Rate Limit:**
- 무료 사용자: 분당 30회 (무제한 조회 보호)
- 프리미엄 사용자: 무제한

## 🆕 최신 업데이트 (v5.2.0) ✨

### 보안 강화
- 🔒 **JWT SECRET 강화**: 32자 → 88자 (512비트 엔트로피)
- 🔒 **Firestore 보안 규칙 강화**: _test 컬렉션 관리자 전용 접근
- 🔒 **미사용 함수 제거**: hasRole(), isValidArray() 주석 처리
- 🔒 **도메인 통일**: 모든 도메인명 소문자로 통일 (gena.com)

### 성능 최적화
- ⚡ **ChatService 분리**: 비즈니스 로직 165줄 → 서비스로 이동
- ⚡ **Circuit Breaker**: ChatService에 통합 (5회 실패 시 차단)
- ⚡ **Rate Limit 최적화**: 엔드포인트별 맞춤 설정
  - 요약 API: 분당 10회 (무료), 무제한 (프리미엄)
  - 히스토리 조회: 분당 30회 (무료), 무제한 (프리미엄)
  - 인증 API: 분당 5회 (모든 사용자)
  - Global IP: 분당 100회 (DDoS 방지)

### 코드 품질 개선
- ✨ **TODO 주석 개선**: 실행 가능한 가이드라인으로 변경
- ✨ **환경 감지 개선**: 에러 핸들링 및 로깅 추가
- ✨ **.gitignore 수정**: SECURITY.md 제외 제거

---

## 🆕 v5.1.0 업데이트 ✨

### Side Panel 자동 복원 기능
- ✨ **탭 전환 시 Side Panel 자동 닫힘**: 다른 탭 이동 시 window.close() 호출
- ✨ **5분 이내 복귀 시 자동 재열림**: chrome.sidePanel.open() 자동 호출
- ✨ **5분 이후 복귀 시 배지 표시**: 우하단에 "요약 보기" 배지 (Material Design)
- ✨ **상태 저장**: Firestore에 탭별 Side Panel 상태 저장
- ✨ **설정 옵션**: autoReopenSidePanel (기본값 true)

### Extension Context 에러 복구
- ✨ **Extension context 유효성 체크**: chrome.runtime.id 존재 확인
- ✨ **새로고침 안내 알림**: 확장 프로그램 업데이트 시 친절한 안내
- ✨ **자동 복구 플로우**: 페이지 새로고침으로 간단히 해결
- ✨ **에러 방지**: 모든 runtime 통신에 context 체크 추가

### 배지 UI/UX
- ✨ **Material Design 스타일**: 그라데이션 배경 (보라색)
- ✨ **페이드인/아웃 애니메이션**: 부드러운 전환 효과
- ✨ **반응형 디자인**: 모바일 화면 대응
- ✨ **다크모드 지원**: prefers-color-scheme 대응
- ✨ **접근성**: focus-visible, prefers-reduced-motion

### Background Service Worker 강화
- ✨ **SidePanelStateManager 클래스**: 탭별 상태 관리
- ✨ **handleSidePanelRestore() 함수**: 5분 타임아웃 체크
- ✨ **탭 활성화 리스너**: 이전 탭 비활성화 + 현재 탭 복원
- ✨ **상태 정리**: 탭 삭제 시 자동 정리

### Settings Manager 업데이트
- ✨ **autoReopenSidePanel 설정 추가**: 기본값 true
- ✨ **shouldAutoReopenSidePanel() 헬퍼**: 설정 조회 간소화
- ✨ **마이그레이션**: 기존 사용자 자동 업데이트

### 개발자 경험 개선
- ✨ **상세한 로그**: 각 단계별 console.log
- ✨ **디버깅 정보**: 경과 시간, 상태 정보 출력
- ✨ **에러 핸들링**: 모든 예외 상황 처리

## 🐛 알려진 이슈

### v5.1.0
- [ ] 배지 클릭 시 Side Panel 포커스 개선 필요
- [ ] 여러 탭에서 동시 요약 시 상태 충돌 가능성
- [ ] 배지 스타일 일부 사이트에서 z-index 충돌 가능
- [ ] Extension context 체크 성능 최적화 필요

### v2.7.0
- [x] PDF 추출 타임아웃 시 Keep-Alive 정리 (해결됨)
- [x] Service Worker 응답 없음 시 재시도 로직 (해결됨)
- [ ] PDF 진행 상황 UI 모바일 대응 필요

### v2.3.0
- [ ] SendGrid 이메일 전송 테스트 필요
- [ ] 이메일 템플릿 국제화
- [ ] PDF 특수 문자 처리 개선

## 📈 로드맵

### Phase 1: MVP 안정화 (완료 ✅)
- [x] 기본 요약 기능
- [x] Q&A 기능
- [x] 로컬 히스토리
- [x] 다국어 지원 (4개 언어)
- [x] PDF 추출 기능 (ES Module, 180초 타임아웃)
- [x] Side Panel UI (v7.0.0)
- [x] Keep-Alive 구현 (v7.0.0)
- [x] **Side Panel 자동 복원 (v5.1.0)** ✅

### Phase 2: 서버 인프라 (완료 ✅)
- [x] Firebase Firestore 연동
- [x] Firebase Authentication
- [x] 클라우드 동기화
- [x] PDF 요약 (프리미엄 전용)
- [x] Circuit Breaker 구현
- [x] PDF 진행 상황 UI (v7.0.0)
- [x] **Extension context 복구 (v5.1.0)** ✅

### Phase 3: 사용자 시스템 (완료 ✅)
- [x] 인증 시스템 (Firebase Auth)
- [x] 사용자 대시보드
- [x] 무료 티어 (일 3회)
- [x] 이메일 발송 서비스
- [x] 비밀번호 재설정
- [x] 비밀번호 보안 강화
- [x] 프리미엄 기능 잠금 UI (v2.3.0)
- [x] **스마트 배지 시스템 (v5.1.0)** ✅
- [ ] 추천 시스템

### Phase 4: 결제 시스템 (진행 중 🚧)
- [ ] Stripe 통합
- [ ] 가격 플랜 (Free, Pro, Team, Enterprise)
- [ ] 프리미엄 기능 잠금
- [ ] 구독 관리 대시보드

### Phase 5: 제품 고도화 (예정 📅)
- [ ] 고급 요약 옵션
- [ ] 성능 최적화 (캐싱, CDN)
- [ ] 분석 도구
- [ ] OCR 지원
- [ ] 배지 애니메이션 개선
- [ ] 멀티 윈도우 지원

### Phase 6: 출시 준비 (예정 📅)
- [ ] Chrome 웹스토어 등록
- [ ] 마케팅 준비
- [ ] 초기 사용자 피드백

## 🤝 기여

기여는 언제나 환영합니다! 

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 코드 기여 가이드

- 모든 코드는 JSDoc 주석 포함
- Firestore 보안 규칙 준수
- 에러 핸들러 사용 필수
- 다국어 지원
- Extension context 유효성 체크
- Rate Limiting 고려
- 테스트 코드 작성

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📧 연락처

- 프로젝트 링크: [https://github.com/sunes26/Gena](https://github.com/sunes26/Gena)

## 🙏 감사의 말

- **OpenAI** - GPT-4o-mini API
- **Google Firebase** - Firestore, Auth
- **Chrome Extensions** - 플랫폼 및 Side Panel API
- **Mozilla PDF.js** - PDF 처리 (ES Module)
- **Material Design** - UI 디자인
- **Stripe** - 결제 인프라
- **Nodemailer** - 이메일 발송
- **bcryptjs** - 비밀번호 해싱
- **Express.js** - 백엔드 프레임워크

## 📚 추가 자료

- [보안 가이드](SECURITY.md)
- [기획서](__AI_웹페이지_요약봇_크롬_확장프로그램_기획서)
- [개발 로드맵](__SummaryGenie_개발_로드맵_ver_2.0)

---

**Made with ❤️ by Gena Team**

**Version**: 5.3.0 | **Last Updated**: 2025-12-18

---

## 🎉 v5.3.0 하이라이트 (2025-12-18)

### 🔄 사용량 추적 시스템 마이그레이션

#### 데이터 구조 통합
- **변경 전**: `/usage/{userId}/daily/{date}` (분리된 컬렉션)
- **변경 후**: `/users/{userId}/daily/{date}` (통합된 구조)
- **마이그레이션 완료**: 8개 문서 (2명의 사용자, 100% 성공)
- **다운타임**: 없음

#### 변경 사유
1. **데이터 일관성 향상**: 모든 사용자 데이터를 `/users` 컬렉션 아래로 통합
2. **Security Rules 단순화**: 중복 규칙 제거, 관리 복잡도 감소
3. **유지보수성 개선**: 서브컬렉션으로 관리하여 orphaned documents 자동 방지

#### 코드 변경사항
- `UsageService.js`: 4개 메서드 경로 업데이트
- `firestore.rules`: 불필요한 `/users/{userId}/usage` 규칙 삭제
- 문법 오류 수정: `forEach` → `for...of` (async/await 지원)

### 🧹 코드베이스 정리

#### 삭제된 Firestore Rules (6개)
```javascript
❌ /users/{userId}/tokens          // Firebase Auth로 대체
❌ /users/{userId}/usage            // 중복 규칙 (마이그레이션 완료)
❌ /users/{userId}/pdf_summaries    // 미구현 기능
❌ /stats                           // 미구현 관리자 기능
❌ /reports                         // 미구현 관리자 기능
❌ isPremiumUser() 함수             // 미사용 헬퍼 함수
```

#### 삭제된 파일 (4개)
```
❌ server/src/services/TokenService.js           // 미사용 서비스
❌ server/src/scripts/cleanup-usage-collection.js    // 일회성 마이그레이션
❌ server/src/scripts/migrate-usage-to-users.js      // 일회성 마이그레이션
❌ server/src/scripts/verify-usage-migration.js      // 검증 스크립트
```

#### 유지된 스크립트
```
✅ server/src/scripts/cleanup-orphaned-docs.js   // 유지보수용 스크립트
```

### 🔒 보안 및 데이터 무결성

#### 마이그레이션 검증 완료
- ✅ `/usage` 컬렉션 완전히 비어있음
- ✅ `/users/{userId}/daily` 경로에 8개 문서 정상 존재
- ✅ UsageService 정상 초기화
- ✅ 경로 변경 검증 완료 (`collection('users')` 사용)

#### 배포 완료
```bash
✅ Firestore Rules 배포 완료 (경고 없음)
✅ 데이터 마이그레이션 완료
✅ 서버 동작 검증 완료
```

### 📊 최종 Firestore 구조 (v5.3.0)

#### 사용 중인 Collections
```
/users/{userId}
  ├── /history/{historyId}        # 요약 히스토리
  ├── /daily/{date}                # 일일 사용량 (통합 완료) ✨
  └── (기본 사용자 정보)

/subscription/{subscriptionId}     # Paddle 구독 (웹사이트)
/payments/{paymentId}              # 결제 내역 (웹사이트)
/pending_transactions/{transactionId}  # 임시 트랜잭션 (웹사이트)

/webhook_events/{eventId}          # 웹훅 이벤트 (웹사이트)
/processed_webhook_events/{eventId}  # 처리된 웹훅 (웹사이트)
/webhook_logs/{logId}              # 웹훅 로그 (웹사이트)

/_health/{document}                # 헬스체크
/_test/{document}                  # 테스트용
```

### 🎯 마이그레이션 영향

#### Before & After 비교
| 항목 | Before | After |
|------|--------|-------|
| 사용량 컬렉션 | `/usage` 별도 | `/users` 통합 |
| Security Rules | 8개 규칙 | 2개 규칙 |
| 코드 파일 | TokenService 포함 | 불필요 파일 삭제 |
| 마이그레이션 스크립트 | 3개 유지 | 모두 삭제 |
| Firestore Rules 경고 | 1개 경고 | 0개 경고 |

#### 성능 및 비용 영향
- **읽기/쓰기 비용**: 동일 (경로만 변경)
- **인덱스**: 기존 daily 인덱스 활용 (변경 없음)
- **보안**: 향상 (불필요한 규칙 제거)
- **유지보수**: 개선 (코드베이스 정리)

### 📝 마이그레이션 이력

```bash
# 마이그레이션 실행
2025-12-18 16:56 - migrate-usage-to-users.js 생성
2025-12-18 16:59 - cleanup-usage-collection.js 생성
2025-12-18 17:03 - verify-usage-migration.js 생성

# 마이그레이션 결과
✅ 8개 문서 마이그레이션 완료
✅ /usage 컬렉션 정리 완료
✅ 검증 완료

# 코드 정리
2025-12-18 17:15 - Firestore Rules 배포 (미사용 규칙 삭제)
2025-12-18 17:30 - isPremiumUser() 함수 삭제 및 재배포
2025-12-18 18:32 - 마이그레이션 스크립트 삭제
```

### 🔍 최종 검토 결과

#### Firestore Rules
- ✅ 모든 헬퍼 함수 사용 중
- ✅ 미사용 규칙 모두 정리
- ✅ 경고 없이 컴파일 성공
- ✅ 실제 사용 중인 컬렉션만 보호

#### Firestore Indexes
- ✅ history 인덱스 6개 (HistoryService 사용)
- ✅ daily 인덱스 3개 (UsageService 사용)
- ✅ 모든 인덱스 유효하며 배포됨

#### 서버 코드 보안
- ✅ 코드 주입 취약점 없음
- ✅ 환경 변수 사용 안전
- ✅ JSON 파싱 안전 (try-catch 블록)

---

## 🎉 v5.2.0 하이라이트

### 🔒 보안 개선사항

1. **JWT SECRET 강화**: 256비트 → 512비트 엔트로피 (보안 강도 4배 향상)
2. **Firestore 보안 규칙**: _test 컬렉션 공개 접근 차단 → 관리자 전용
3. **도메인 통일**: 모든 도메인명 소문자로 통일하여 보안 정책 일관성 향상

### ⚡ 성능 개선사항

1. **ChatService 분리**: routes/api/chat.js에서 165줄 비즈니스 로직 제거
2. **Circuit Breaker 통합**: ChatService에 OpenAI API 장애 복구 로직 통합
3. **Rate Limit 최적화**:
   - 요약 API: 10회/분 (하루 3회 제한 고려)
   - 히스토리: 30회/분 (무제한 조회 보호)
   - 인증: 5회/분 (무차별 대입 방지)
   - Global: 100회/분 (DDoS 방지)

### 🎨 코드 품질

- ✅ TODO 주석 → 실행 가능한 가이드라인
- ✅ 환경 감지 로직 에러 핸들링 강화
- ✅ 미사용 함수 정리 (주석 처리)
- ✅ .gitignore 수정 (SECURITY.md 공개)

---

## 🎉 v5.1.0 하이라이트

### 🚀 주요 개선사항

1. **Side Panel 자동 복원**: 탭 전환 후에도 요약 상태 유지
2. **스마트 배지**: 5분 이후 복귀 시 요약 보기 알림
3. **Extension Context 복구**: 확장 프로그램 업데이트 시 자동 복구
4. **탭 전환 시 자동 닫힘**: 다른 탭 이동 시 Side Panel 자동 종료
5. **Firestore 상태 관리**: 탭별 Side Panel 상태 영구 저장

### 🎨 사용자 경험

- ✅ 자연스러운 탭 전환 경험
- ✅ 요약 상태 자동 복원 (5분 이내)
- ✅ 친절한 에러 복구 안내
- ✅ Material Design 배지
- ✅ 부드러운 애니메이션

### 🔧 기술적 성과

- ✅ Chrome Side Panel API 완벽 활용
- ✅ Extension context 안정성 향상
- ✅ Firestore 기반 상태 관리
- ✅ 에러 핸들링 강화
- ✅ 개발자 경험 개선