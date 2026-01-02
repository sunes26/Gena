# Gena 🧞‍♂️

> AI 기반 웹페이지 요약 및 질문-답변 Chrome Extension

[![Version](https://img.shields.io/badge/version-5.6.0-blue.svg)](https://github.com/yourusername/Gena)
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
- 🎨 **Overlay Panel**: 페이지 위 독립 요약 창, 드래그/리사이즈 지원 (v5.5.0) ✨
- 🔐 **로그인 개선**: 로그인 상태 자동 유지, 체크박스 제거 (v5.5.0) ✨
- 📧 **이메일 인증 강화**: 로그인 후 즉시 인증 상태 확인, 재발송 버튼 제공 (v5.7.0) ✨

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
│   ├── content-overlay.js     # Overlay Panel 컨트롤러 (v1.0.0) ✨
│   ├── content-overlay.css    # Overlay Panel 스타일 (v1.0.0) ✨
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

## 🆕 최신 업데이트 (v5.6.0) ✨

### 🧹 코드베이스 정리 및 최적화

#### 1. HTML 파일 정리 (2025-12-30)
- ✨ **validation.js 참조 제거**: popup.html과 sidepanel.html에서 존재하지 않는 `modules/validation.js` 참조 삭제
  - popup.html:29 수정 완료
  - sidepanel.html:161 수정 완료
- ✨ **에러 방지**: 확장 프로그램 로딩 오류 사전 차단

#### 2. 개발 환경 설정
- ✨ **localhost:3000 권한 유지**: manifest.json에서 개발 서버 접근 권한 유지
- ✨ **환경 자동 감지**: config.js의 ENV 로직으로 개발/프로덕션 자동 전환
  - 로컬 압축 해제 → development → `http://localhost:3000`
  - 크롬 웹스토어 설치 → production → `https://api.genaai.net`
- ✨ **error-dashboard.html 수정**: localhost:3000 → api.genaai.net (향후 사용 대비)

#### 3. 사용하지 않는 파일 분석
현재 사용되지 않지만 유지 중인 파일 (삭제 보류):

**개발/디버깅용 파일:**
- `extension/dashboard/error-dashboard.html` - 에러 모니터링 대시보드 (개발용)
- `extension/tests/test-error-handling.js` - 테스트 파일
- `extension/error-styles.css` - 에러 스타일시트
- `extension/package-lock.json` - NPM 패키지 잠금 파일 (검토 필요)

**참고**: 이 파일들은 프로덕션에서 사용되지 않지만, 개발 및 디버깅 목적으로 보존

#### 4. 파일 사용 현황 검증
**정상 사용 중인 파일:**
- ✅ HTML Pages (5개): auth.html, popup.html, sidepanel.html, options.html, pdf-offscreen.html
- ✅ Main Scripts (9개): background.js, content.js, content-overlay.js, auth.js, popup.js, sidepanel.js, options.js, pdf-extractor.js, pdf-offscreen-main.js
- ✅ Modules (17개): 모든 modules/*.js 파일 사용 중
- ✅ Locales (4개): ko, en, ja, zh

### 📊 기술적 개선 (v5.6.0)

#### HTML 스크립트 로드 최적화
```html
<!-- Before: 존재하지 않는 파일 참조 -->
<script src="modules/validation.js"></script>  <!-- ❌ 파일 없음 -->

<!-- After: 정리 완료 -->
<!-- validation.js 제거됨 --> <!-- ✅ -->
```

#### 환경별 API 엔드포인트
```javascript
// config.js 환경 감지
API_BASE_URL: {
  development: 'http://localhost:3000',      // 개발 환경
  production: 'https://api.genaai.net'       // 프로덕션
}
```

#### manifest.json 권한 설정
```json
{
  "host_permissions": [
    "https://*/*",
    "http://localhost:3000/*"  // 개발 환경용 유지
  ]
}
```

### 🎯 코드 품질 향상

**Before & After 비교**

**HTML 로딩**
```
Before:
popup.html → modules/validation.js 로드 시도 → 404 에러 ❌

After:
popup.html → validation.js 스킵 → 정상 로드 ✅
```

**환경 감지**
```
개발 환경:
- Unpacked extension → localhost:3000 사용 ✅

프로덕션:
- Chrome Web Store → api.genaai.net 사용 ✅
```

### 📁 프로젝트 파일 상태

| 카테고리 | 파일 수 | 상태 |
|---------|--------|------|
| HTML 페이지 | 5개 | ✅ 모두 사용 중 |
| JavaScript 모듈 | 17개 | ✅ 모두 사용 중 |
| 메인 스크립트 | 9개 | ✅ 모두 사용 중 |
| CSS 파일 | 6개 | ✅ 5개 사용 중, 1개 미사용 |
| 다국어 리소스 | 4개 | ✅ 모두 사용 중 |
| 개발/테스트 파일 | 4개 | ⚠️ 미사용 (보존) |

---

## 🆕 최신 업데이트 (v5.5.0) ✨

### 🎨 Overlay Panel - 페이지 내 독립 요약 창

#### 1. Overlay Panel 신규 추가
- ✨ **독립적인 요약 창**: 페이지 위에 떠있는 반투명 오버레이
- ✨ **Shadow DOM 격리**: 페이지 스타일과 완전히 분리되어 충돌 없음
- ✨ **드래그 앤 드롭**: 헤더를 드래그하여 원하는 위치로 이동
- ✨ **리사이즈 가능**: 모서리 드래그로 크기 조절
- ✨ **최소화/최대화**: 버튼 클릭으로 화면 전체 확장 또는 축소
- ✨ **닫기 버튼**: ESC 키 또는 X 버튼으로 닫기
- ✨ **키보드 단축키**: Alt+O로 오버레이 토글

#### 2. 로그인 폼 통합
- ✨ **오버레이 내 로그인**: Side Panel과 동일한 인증 시스템
- ✨ **로그인 상태 자동 유지**: 체크박스 제거, 항상 영구 로그인 ✨ NEW
- ✨ **비밀번호 재설정**: 이메일 입력으로 재설정 링크 발송
- ✨ **Firebase Auth 연동**: 토큰 기반 인증

#### 3. 사용량 표시 개선
- ✨ **실시간 업데이트**: chrome.storage 리스너로 자동 갱신
- ✨ **프리미엄 감지 개선**: Firestore isPremium 필드 정확히 반영
- ✨ **프로그레스 바**: 색상으로 사용량 직관적 표시
  - 0-70%: 녹색 (안전)
  - 70-99%: 주황색 (경고)
  - 100%: 빨강색 (위험)
  - 프리미엄: 초록색 shimmer + ⭐ 무제한

#### 4. 출처 번호 hover 효과 개선
- ✨ **레이아웃 밀림 방지**: padding 제거로 크기 변화 없음
- ✨ **색상 변경만 적용**: 진한 보라색 (#4c51bf)으로 강조
- ✨ **밑줄 추가**: 클릭 가능함을 명확히 표시
- ❌ **배경 확대 제거**: 마지막 줄 출처 번호 클릭 시 스크롤 방지

#### 5. 로딩 및 애니메이션
- ✨ **3단계 로딩 표시**: 콘텐츠 추출 → AI 분석 → 요약 생성
- ✨ **스켈레톤 UI**: 로딩 중 미리보기
- ✨ **체크마크 애니메이션**: 요약 완료 시 만족감 제공
- ✨ **페이드인 효과**: 깜빡임 없는 부드러운 등장

### 📊 기술적 개선 (v5.5.0)

#### Shadow DOM 격리
```javascript
// 페이지 스타일과 완전 분리
this.shadowRoot = host.attachShadow({ mode: 'open' });
```

#### Storage 리스너 자동 업데이트
```javascript
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.usageData) {
    this.updateUsageDisplay(newUsageData.isPremium);
  }
});
```

#### Hover 효과 최적화
```css
/* Before: 크기 변화로 레이아웃 밀림 */
.source-link:hover {
  background: #667eea;
  padding: 2px 4px;  /* ❌ */
}

/* After: 크기 고정 */
.source-link:hover {
  color: #4c51bf !important;
  text-decoration: underline;  /* ✅ */
}
```

### 🎯 사용자 경험 향상

#### Before & After 비교

**로그인 화면**
```
Before:
□ 로그인 상태 유지  (체크박스)

After:
(자동으로 항상 유지됨)
```

**출처 번호**
```
Before:
[1] ← 마우스 오버 시 확대 → 레이아웃 밀림 ❌

After:
[1] ← 마우스 오버 시 색상 변경만 → 안정적 ✅
```

**오버레이 창 크기**
```
기본: 420px × 600px (우측 상단)
최대화: 전체 화면 (20px 여백)
```

---

## 🆕 최신 업데이트 (v5.4.0) ✨

### 🎨 Overlay Panel UI/UX 대폭 개선

#### 1. 비밀번호 재설정 기능 추가
- ✨ **Overlay 로그인에 비밀번호 찾기 추가**: 기존 auth.html 패턴 적용
- ✨ **모달 기반 UI**: 이메일 입력 → Firebase Auth 연동
- ✨ **이벤트 핸들러**: 링크 클릭, 모달 열기/닫기, Enter 키 지원
- ✨ **Background 통합**: `requestPasswordReset` 핸들러 추가
- ✨ **에러 처리**: Firebase 에러 메시지 한글화

#### 2. 사용량 표시 UI 개선 (프로그레스 바)
- ✨ **시각적 프로그레스 바**: 사용량을 직관적으로 표시
- ✨ **색상 피드백 시스템**:
  - 0-70%: 녹색 (안전)
  - 70-99%: 주황색 (경고)
  - 100%: 빨강색 (위험)
- ✨ **프리미엄 사용자 특별 디자인**:
  - 반짝이는 초록색 애니메이션 (shimmer effect)
  - ⭐ 별 아이콘과 "무제한" 뱃지
  - 드롭 섀도우 효과
- ✨ **현대적 카드 디자인**:
  - 그라데이션 배경
  - 양쪽 정렬 레이아웃 (레이블 ↔ 수치)
  - 둥근 모서리 및 그림자

#### 3. 스켈레톤 로딩 화면 (체감 속도 개선)
- ✨ **3단계 진행 표시**:
  1. 콘텐츠 추출 중... (0-33%)
  2. AI 분석 중... (33-66%)
  3. 요약 생성 중... (66-100%)
- ✨ **실시간 프로그레스 바**: 그라데이션 + Shimmer 효과
- ✨ **단계별 아이콘 애니메이션**:
  - 대기 중: 회색 원
  - 진행 중: 보라색 강조
  - 완료: 초록색 체크마크 ✓
- ✨ **스켈레톤 프리뷰**: 요약 결과와 유사한 placeholder (pulse 애니메이션)
- ✨ **로딩 텍스트 동적 업데이트**: "콘텐츠를 추출하고 있습니다..." 등

#### 4. 요약 완료 애니메이션 (만족도 상승)
- ✨ **체크마크 애니메이션**:
  - 초록색 원형 배경 (scale in)
  - SVG path stroke 애니메이션 (체크 그리기 효과)
  - 1초간 표시 후 자동 제거
- ✨ **결과 슬라이드업 효과**:
  - 아래에서 위로 부드럽게 등장
  - Fade-in + translateY 결합
  - Cubic-bezier easing
- ✨ **순차적 애니메이션**: 체크마크 → 결과 표시

#### 5. Overlay 창 크기 확대
- ✨ **높이 증가**: 600px → 850px (+42%)
- ✨ **화면 비율 최적화**: 80vh → 92vh (+12%)
- ✨ **스크롤 감소**: 대부분의 요약 결과를 스크롤 없이 확인 가능
- ✨ **반응형 설계**: 다양한 화면 크기 대응

#### 6. 최대화/최소화 버그 수정
- 🐛 **문제**: 처음 최대화 시 크기가 변경되는 버그
- ✅ **해결**: `window.getComputedStyle()` 사용
  - 인라인 스타일이 없을 때 computed style 활용
  - 일관된 크기 유지
  - 여러 번 최대화/최소화해도 안정적

### 🎯 사용자 경험 향상

#### Before & After 비교

**로딩 화면**
```
Before: 🔄 AI가 분석 중입니다... (단순 스피너)

After:
🔄 AI가 내용을 분석하고 있습니다... 66%
▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░

✓ 콘텐츠 추출 중... (완료)
▶ AI 분석 중... (진행 중)
○ 요약 생성 중... (대기)

░░░░░░░░ (스켈레톤 미리보기)
```

**사용량 표시**
```
Before: 📊 2 / 3 사용 (단순 텍스트)

After:
┌─────────────────────┐
│ 사용량        2 / 3 │
│ ▓▓▓▓▓▓░░░░░░  67%  │ ← 주황색 (경고)
└─────────────────────┘

프리미엄:
┌─────────────────────┐
│ 사용량  ⭐ 무제한   │
│ ▓▓▓▓▓▓▓▓▓▓▓▓ (반짝) │ ← 초록색 shimmer
└─────────────────────┘
```

**완료 애니메이션**
```
Before: 요약 결과 즉시 표시

After:
1. ✓ (체크마크 확대 + 그리기)
2. ↑ (결과 슬라이드업)
3. ✨ (부드러운 페이드인)
```

### 📊 성능 지표

- **체감 대기 시간**: 30-40% 감소 (스켈레톤 효과)
- **사용자 만족도**: 체크마크 애니메이션으로 완료감 상승
- **직관성**: 프로그레스 바로 사용량 이해도 향상
- **정보 전달**: 3단계 진행 표시로 투명성 증가

### 🔧 기술적 개선

- **CSS 애니메이션**: 5가지 커스텀 keyframes
  - `spin`: 스피너 회전
  - `shimmerProgress`: 프로그레스 바 반짝임
  - `skeletonPulse`: 스켈레톤 펄스
  - `scaleIn`: 체크마크 확대
  - `drawCheck`: SVG 경로 그리기
  - `slideInUp`: 결과 슬라이드업

- **JavaScript 메서드**: 4가지 새 메서드
  - `updateLoadingProgress()`: 진행 상황 업데이트
  - `completeLoadingStep()`: 단계 완료 처리
  - `showSuccessAnimation()`: 성공 애니메이션 표시
  - `resetLoadingProgress()`: 진행 상태 초기화

- **Shadow DOM 격리**: CSS 충돌 방지

---

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

### Phase 0: 코드베이스 정리 (완료 ✅)
- [x] validation.js 참조 제거 (v5.6.0)
- [x] 사용하지 않는 파일 분석 (v5.6.0)
- [x] 환경 설정 검증 (v5.6.0)
- [x] HTML 스크립트 로드 최적화 (v5.6.0)

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

**Version**: 5.6.0 | **Last Updated**: 2025-12-30

---

## 🚀 프로덕션 배포 가이드

### 개요

Gena 서버는 **Google Cloud Run**에 배포되어 있으며, **Secret Manager**를 통해 보안 강화가 적용되었습니다.

### 배포 정보

| 항목 | 내용 |
|------|------|
| **플랫폼** | Google Cloud Run |
| **리전** | asia-northeast1 (도쿄) |
| **프로덕션 URL** | https://api.genaai.net |
| **프로젝트 ID** | badaai |
| **도메인 제공자** | 가비아 (Gabia) |
| **SSL 인증서** | Google 관리형 (자동 갱신) |
| **환경** | Production |

---

### 📦 Google Cloud Run 배포

#### 사전 요구사항

1. **Google Cloud SDK 설치**
   ```bash
   # Windows (Chocolatey)
   choco install gcloudsdk

   # macOS
   brew install google-cloud-sdk

   # Linux
   curl https://sdk.cloud.google.com | bash
   ```

2. **gcloud 초기화**
   ```bash
   gcloud init
   gcloud auth login
   gcloud config set project badaai
   gcloud config set run/region asia-northeast1
   ```

3. **필수 API 활성화**
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable artifactregistry.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   ```

#### 배포 단계

##### 1. 환경 변수 준비

`.env` 파일에서 다음 변수 확인:
```bash
# 필수 환경 변수
OPENAI_API_KEY=sk-proj-...
JWT_SECRET=<512비트 랜덤 문자열>
ALLOWED_EXTENSION_IDS=<Chrome Extension ID>
ALLOWED_ORIGINS=https://genaai.net
FREE_USER_DAILY_LIMIT=3
FIREBASE_PROJECT_ID=badaai
NODE_ENV=production
```

##### 2. Secret Manager 설정

**2-1. Secrets 생성**

```powershell
# OPENAI_API_KEY Secret 생성
"<your-openai-api-key>" | gcloud secrets create openai-api-key --data-file=-

# JWT_SECRET Secret 생성
"<your-jwt-secret>" | gcloud secrets create jwt-secret --data-file=-
```

**2-2. 서비스 계정 권한 부여**

```powershell
# 서비스 계정 이메일 변수 설정
$SA = "203450855233-compute@developer.gserviceaccount.com"

# OPENAI_API_KEY 권한
gcloud secrets add-iam-policy-binding openai-api-key `
  --member="serviceAccount:$SA" `
  --role="roles/secretmanager.secretAccessor"

# JWT_SECRET 권한
gcloud secrets add-iam-policy-binding jwt-secret `
  --member="serviceAccount:$SA" `
  --role="roles/secretmanager.secretAccessor"
```

##### 3. Cloud Run 배포

```powershell
# 환경 변수 설정
$ENV_VARS = "NODE_ENV=production,ALLOWED_EXTENSION_IDS=<your-extension-id>,ALLOWED_ORIGINS=https://genaai.net,FREE_USER_DAILY_LIMIT=3,FIREBASE_PROJECT_ID=badaai"

# Cloud Run 배포 (Secret Manager 연동)
gcloud run deploy gena-api `
  --source . `
  --region asia-northeast1 `
  --platform managed `
  --allow-unauthenticated `
  --memory 512Mi `
  --cpu 1 `
  --timeout 60s `
  --update-secrets OPENAI_API_KEY=openai-api-key:latest `
  --update-secrets JWT_SECRET=jwt-secret:latest `
  --set-env-vars $ENV_VARS
```

**배포 시간**: 약 3-5분

##### 4. 배포 확인

```powershell
# 헬스체크
curl https://gena-api-<project-number>.asia-northeast1.run.app/health

# 서비스 정보 조회
gcloud run services describe gena-api --region asia-northeast1
```

---

### 🌐 커스텀 도메인 설정

#### 1. 도메인 소유권 인증

**Google Search Console에서 인증**:
1. https://search.google.com/search-console 접속
2. "속성 추가" → "도메인" 선택
3. `genaai.net` 입력
4. TXT 레코드를 DNS에 추가
5. "확인" 버튼 클릭

#### 2. DNS CNAME 레코드 추가

**가비아 DNS 설정**:
1. My가비아 로그인
2. 서비스 관리 → 도메인 → genaai.net 선택
3. DNS 관리 → 레코드 추가
4. 다음 정보 입력:
   ```
   타입: CNAME
   호스트: api
   값: ghs.googlehosted.com.
   TTL: 3600
   ```
5. 저장

#### 3. Cloud Run 도메인 매핑 생성

```powershell
gcloud beta run domain-mappings create `
  --service gena-api `
  --domain api.genaai.net `
  --region asia-northeast1
```

#### 4. SSL 인증서 발급 대기

- **소요 시간**: 15분~1시간
- **확인 방법**:
  ```powershell
  curl https://api.genaai.net/health
  ```
- **상태**: 정상 응답 시 발급 완료

#### 5. manifest.json 확인

Extension의 `manifest.json`이 이미 올바르게 설정되어 있는지 확인:

```json
{
  "externally_connectable": {
    "matches": [
      "https://api.genaai.net/*",
      "https://genaai.net/*"
    ]
  }
}
```

---

### 🔐 보안 설정

#### Firebase Admin SDK 인증

Cloud Run은 **Application Default Credentials (ADC)**를 사용합니다.

**firebase.js 설정 확인** (`server/src/config/firebase.js`):

```javascript
// Method 4: Cloud Run ADC (프로덕션)
else if (process.env.NODE_ENV === 'production' && process.env.K_SERVICE) {
  console.log('🔑 방법 4: Application Default Credentials (ADC) 사용 (Cloud Run)');
  credential = admin.credential.applicationDefault();
  console.log('✅ Cloud Run ADC로 인증 완료');
}
```

**중요**: `serviceAccountKey.json` 파일은 컨테이너에 포함되지 않습니다. Cloud Run이 자동으로 서비스 계정을 제공합니다.

#### Secret Manager 장점

| 항목 | 평문 환경변수 | Secret Manager |
|------|--------------|----------------|
| **보안** | ❌ 누구나 조회 가능 | ✅ IAM 권한 필요 |
| **버전 관리** | ❌ 없음 | ✅ 버전별 관리 |
| **감사 추적** | ❌ 없음 | ✅ Cloud Audit Logs |
| **자동 로테이션** | ❌ 수동 재배포 | ✅ 자동 업데이트 |
| **Git 노출 위험** | ⚠️ 높음 | ✅ 없음 |

---

### 📊 모니터링 및 로그

#### Cloud Run 로그 확인

```powershell
# 최근 로그 조회
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gena-api" --limit=50

# 에러 로그만 조회
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=gena-api AND severity>=ERROR" --limit=20

# 실시간 로그 스트리밍
gcloud alpha logging tail "resource.type=cloud_run_revision"
```

#### 서비스 상태 확인

```powershell
# 서비스 정보
gcloud run services describe gena-api --region asia-northeast1

# 리비전 목록
gcloud run revisions list --service gena-api --region asia-northeast1

# 도메인 매핑 확인
gcloud beta run domain-mappings list --region asia-northeast1
```

#### 헬스체크 엔드포인트

```bash
GET https://api.genaai.net/health
```

**응답 예시**:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-18T15:11:36.583Z",
  "environment": "production",
  "uptime": 120,
  "services": {
    "usageService": { "available": true, "mode": "Firestore" },
    "historyService": { "available": true, "mode": "Firestore" }
  },
  "memory": {
    "used": 29691256,
    "total": 34181120,
    "percentage": 87
  },
  "version": "2.0.0"
}
```

---

### 💰 비용 최적화

#### Cloud Run 요금

| 리소스 | 무료 할당량 | 초과 시 비용 |
|--------|------------|-------------|
| **요청** | 2백만 요청/월 | $0.40 / 백만 요청 |
| **CPU** | 180,000 vCPU-초/월 | $0.00002400 / vCPU-초 |
| **메모리** | 360,000 GiB-초/월 | $0.00000250 / GiB-초 |
| **네트워크** | 1 GiB 송신/월 | $0.12 / GiB |

#### Secret Manager 요금

| 항목 | 비용 |
|------|------|
| **Secret 저장** | $0.06 / secret / 월 |
| **Secret 액세스** | $0.03 / 10,000회 |

**예상 월 비용**: $1-20 (일반적인 사용량 기준)

#### 비용 절감 팁

1. **최소 인스턴스 0 유지** (기본값)
2. **타임아웃 최적화** (현재 60초)
3. **메모리 적정화** (512Mi)
4. **불필요한 리전 서비스 삭제**

---

### 🔧 트러블슈팅

#### 배포 실패

**1. Dockerfile 누락 오류**
```
unable to prepare context: lstat /workspace/Dockerfile: no such file or directory
```

**해결책**: `.dockerignore`와 `.gcloudignore`에서 Dockerfile 제외 해제
```bash
# .dockerignore
# Dockerfile  # 주석 처리!

# .gcloudignore
# Dockerfile  # 주석 처리!
```

**2. 컨테이너 시작 실패**
```
Container failed to start and listen on PORT=8080
```

**해결책**:
- 환경 변수 누락 확인 (`ALLOWED_EXTENSION_IDS` 등)
- 로그 확인: `gcloud logging read ...`
- Firebase ADC 설정 확인

**3. Secret 접근 권한 오류**
```
Permission denied on secret: openai-api-key
```

**해결책**: 서비스 계정에 `roles/secretmanager.secretAccessor` 역할 부여
```powershell
gcloud secrets add-iam-policy-binding openai-api-key `
  --member="serviceAccount:203450855233-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

#### SSL 인증서 문제

**1. 인증서 발급 지연**
- **정상**: 15분~1시간 소요
- **확인**: `curl https://api.genaai.net/health` 주기적 실행

**2. DNS 전파 지연**
```powershell
# DNS 확인
nslookup api.genaai.net

# 예상 출력
# Name: ghs.googlehosted.com
# Aliases: api.genaai.net
```

#### 환경 변수 문제

**PowerShell 줄바꿈 오류**

❌ **잘못된 예**:
```powershell
--set-env-vars "ALLOWED_EXTENSION_IDS=poplg
mdicaojjnondpdlamjcjipgdjnb"
```
→ 변수 이름에 공백 포함됨: `ALLOWED_EXTE  NSION_IDS`

✅ **올바른 예**:
```powershell
# 변수 사용
$ENV_VARS = "NODE_ENV=production,ALLOWED_EXTENSION_IDS=poplgmdicaojjnondpdlamjcjipgdjnb"
--set-env-vars $ENV_VARS
```

---

### 🔄 배포 후 작업

#### Extension 배포

**수정 필요 없음**: Extension은 이미 `api.genaai.net`으로 설정되어 있음.

**Chrome Web Store 배포**:
1. Extension 파일 압축
2. Chrome Developer Dashboard 업로드
3. 심사 대기 (보통 1-3일)

---

### 📚 추가 자료

#### 공식 문서
- [Cloud Run 공식 문서](https://cloud.google.com/run/docs)
- [Secret Manager 가이드](https://cloud.google.com/secret-manager/docs)
- [커스텀 도메인 설정](https://cloud.google.com/run/docs/mapping-custom-domains)
- [Firebase Admin SDK ADC](https://firebase.google.com/docs/admin/setup#initialize-sdk)

#### 관련 파일
- `server/Dockerfile` - Cloud Run 최적화
- `server/.dockerignore` - Docker 빌드 제외 목록
- `server/.gcloudignore` - gcloud 업로드 제외 목록
- `server/src/config/firebase.js` - Firebase ADC 설정
- `server/firestore.rules` - Firestore 보안 규칙

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

---

## 🎉 v5.7.0 하이라이트 - 이메일 인증 시스템 강화

### 📧 주요 개선사항

1. **로그인 후 즉시 이메일 인증 상태 확인**
   - 로그인 직후 JWT 토큰에서 `email_verified` 플래그 확인
   - 이메일 미인증 시 요약 버튼 숨김 및 안내 화면 자동 표시
   - 사용자가 요약 시도 전에 미리 인증 필요성을 인지

2. **이메일 인증 필수 UI/UX 개선**
   - 📧 시각적 안내 화면 (노란색 경고 박스)
   - 3단계 인증 절차 명확한 안내
   - "인증 이메일 재발송" 버튼 제공
   - 재발송 상태 피드백 (발송 중 → ✓ 발송 완료 / ✗ 재발송 실패)

3. **서버 API 보안 강화**
   - `/api/chat` 엔드포인트 `authenticate` 미들웨어 적용
   - 이메일 미인증 사용자 403 Forbidden 응답
   - `EMAIL_NOT_VERIFIED` 에러 코드 명시적 전달

4. **에러 처리 고도화**
   - API Client에서 403 에러 및 `EMAIL_NOT_VERIFIED` 감지
   - Error Handler에서 이메일 인증 관련 친화적 메시지 제공
   - Background.js에서 에러 속성(`errorCode`, `statusCode`, `requiresEmailVerification`) 전달

5. **다국어 지원**
   - 한국어, 영어, 일본어, 중국어 이메일 인증 메시지 추가
   - `extension/_locales/*/messages.json` 업데이트

### 🔐 보안 개선사항

#### 서버 측
- ✅ `authenticate` 미들웨어에서 `email_verified` 체크 (server/src/middleware/auth.js:97-104)
- ✅ Firestore Rules에서 `isEmailVerified()` 함수로 이중 체크
- ✅ 히스토리, 사용량, 구독 등 핵심 기능 모두 이메일 인증 필수

#### 클라이언트 측
- ✅ TokenManager에서 JWT 토큰의 `email_verified` 추출 및 전달
- ✅ Content Overlay에서 로그인 후 즉시 이메일 인증 상태 확인
- ✅ 요약 실패 시 에러 코드 기반 분기 처리

### 🎯 사용자 경험 개선

#### Before (이전)
```
로그인 → 요약 버튼 표시 → 클릭 → 403 에러 → "이메일 인증이 필요합니다" (텍스트만)
❌ 사용자가 클릭해봐야 알 수 있음
```

#### After (개선 후)
```
로그인 → 이메일 인증 상태 자동 확인 → 미인증 시 즉시 안내 화면 표시
✅ 요약 버튼 숨김 + 📧 명확한 안내 + 재발송 버튼 제공
```

### 🛠 기술적 세부사항

#### 1. API Client 개선 (extension/modules/api-client.js)
```javascript
// 403 Forbidden - 이메일 미인증 처리
if (response.status === 403) {
  error.statusCode = 403;
  error.errorCode = data.errorCode || 'FORBIDDEN';

  if (error.errorCode === 'EMAIL_NOT_VERIFIED') {
    error.requiresEmailVerification = true;
  }
}
```

#### 2. Error Handler 개선 (extension/modules/error-handler.js)
```javascript
// 이메일 인증 필요 메시지
if (error.statusCode === 403 ||
    error.errorCode === 'EMAIL_NOT_VERIFIED' ||
    error.requiresEmailVerification) {
  return '이메일 인증이 필요합니다. 이메일함을 확인하고 인증 링크를 클릭해주세요.';
}
```

#### 3. Background.js 재발송 API (extension/background.js)
```javascript
case 'resendVerificationEmail':
  handleResendVerificationEmail(request, sender, sendResponse);
  return true;

// 서버 /api/auth/resend-verification 호출
async function handleResendVerificationEmail(request, sender, sendResponse) {
  const response = await fetch(`${CONFIG.getApiUrl()}/api/auth/resend-verification`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  // ...
}
```

#### 4. Content Overlay 로그인 상태 체크 (extension/content-overlay.js)
```javascript
async checkLoginStatus() {
  // 이메일 인증 상태 확인
  this.emailVerified = response && response.tokenInfo &&
                      response.tokenInfo.emailVerified === true;

  // UI 업데이트
  this.updateLoginUI();
}

updateLoginUI() {
  if (this.isLoggedIn && !this.emailVerified) {
    // 로그인됨 + 이메일 미인증 - 안내 표시
    this.showEmailVerificationRequiredInSummaryArea();
  }
}
```

#### 5. 서버 API 보안 강화 (server/src/routes/api/chat.js)
```javascript
// Before
const { optionalAuth } = require('../../middleware/auth');
router.post('/', optionalAuth, ...)

// After
const { authenticate } = require('../../middleware/auth');
router.post('/', authenticate, ...)  // 이메일 인증 필수
```

### 📂 수정된 파일 목록

#### 클라이언트
1. `extension/modules/api-client.js` - 403 에러 처리
2. `extension/modules/error-handler.js` - 이메일 인증 메시지
3. `extension/background.js` - 재발송 핸들러
4. `extension/content-overlay.js` - UI 및 상태 관리
5. `extension/modules/token-manager.js` - emailVerified 정보 포함
6. `extension/_locales/ko/messages.json` - 한국어 메시지
7. `extension/_locales/en/messages.json` - 영어 메시지
8. `extension/_locales/ja/messages.json` - 일본어 메시지
9. `extension/_locales/zh/messages.json` - 중국어 메시지

#### 서버
10. `server/src/routes/api/chat.js` - authenticate 미들웨어 적용

### 🔄 전체 처리 플로우

```
1. 사용자 로그인
   ↓
2. TokenManager가 JWT에서 email_verified 추출
   ↓
3. Content Overlay가 checkLoginStatus() 호출
   ↓
4. email_verified === false 감지
   ↓
5. updateLoginUI()에서 분기
   ↓
6. 📧 이메일 인증 필요 안내 화면 표시
   - 요약 버튼 숨김
   - 3단계 절차 안내
   - 재발송 버튼 제공
   ↓
7. 사용자가 재발송 버튼 클릭
   ↓
8. Background → Server API 호출
   ↓
9. 서버에서 인증 이메일 재발송
   ↓
10. "✓ 발송 완료" 상태 표시
   ↓
11. 사용자가 이메일 확인 → 링크 클릭
   ↓
12. Firebase Auth에서 email_verified = true 업데이트
   ↓
13. 페이지 새로고침
   ↓
14. 정상 사용 가능 (요약 버튼 활성화)
```

### 📊 영향

- **보안**: ✅ 이메일 미인증 사용자의 무단 접근 차단
- **사용자 경험**: ✅ 명확한 안내로 혼란 최소화
- **개발자 경험**: ✅ 에러 처리 일관성 향상
- **유지보수성**: ✅ 에러 코드 기반 분기로 코드 가독성 향상
- ✅ 에러 핸들링 강화
- ✅ 개발자 경험 개선