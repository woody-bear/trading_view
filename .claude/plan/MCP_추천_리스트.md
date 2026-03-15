# UBB Pro Signal System — 유용한 MCP 서버 리스트

## 개발 단계별 MCP 추천

---

## 1. 필수 (개발 전반)

### @anthropic/sqlite-mcp
```
용도: SQLite DB 직접 조회/조작
활용:
  - 개발 중 watchlist, signal_history, current_signal 테이블 실시간 확인
  - 스키마 변경 테스트
  - 신호 데이터 디버깅 (잘못된 신호 추적)
설치: npx -y @anthropic/sqlite-mcp backend/data/ubb_pro.db
```

### @anthropic/filesystem-mcp
```
용도: 파일 시스템 읽기/쓰기/검색
활용:
  - 프로젝트 파일 탐색 및 편집
  - 로그 파일 (logs/) 실시간 확인
  - .env 설정 파일 관리
설치: npx -y @anthropic/filesystem-mcp /Users/woody/workflow/trading_view
```

### @anthropic/git-mcp
```
용도: Git 작업 자동화
활용:
  - 커밋, 브랜치 관리
  - 변경 이력 추적
  - Phase별 작업 브랜치 관리 (phase-1a, phase-1b, phase-2 등)
설치: npx -y @anthropic/git-mcp
```

---

## 2. 백엔드 개발

### @anthropic/fetch-mcp
```
용도: HTTP 요청 실행
활용:
  - FastAPI 엔드포인트 테스트 (localhost:8000/api/*)
  - yfinance/ccxt API 응답 확인
  - TradingView 웹훅 시뮬레이션 (POST /api/webhook/tradingview)
  - 텔레그램 Bot API 직접 호출 테스트
설치: npx -y @anthropic/fetch-mcp
```

### @nicholasoxford/desktop-notifier-mcp
```
용도: 데스크톱 알림
활용:
  - 긴 테스트/빌드 완료 알림
  - 개발 중 신호 전환 감지 시 로컬 알림 테스트
설치: npx -y @nicholasoxford/desktop-notifier-mcp
```

---

## 3. 프론트엔드 개발

### @anthropic/puppeteer-mcp
```
용도: 브라우저 자동화/스크린샷
활용:
  - 대시보드 UI 렌더링 확인 (localhost:3000 스크린샷)
  - 컴포넌트별 시각적 테스트
  - TradingView Lightweight Charts 렌더링 검증
설치: npx -y @anthropic/puppeteer-mcp
```

### @anthropic/brave-search-mcp
```
용도: 웹 검색
활용:
  - React/Shadcn/ui 컴포넌트 사용법 검색
  - TradingView Lightweight Charts API 문서 조회
  - pandas-ta 지표 함수 파라미터 확인
설치: npx -y @anthropic/brave-search-mcp (BRAVE_API_KEY 필요)
```

---

## 4. 데이터/금융 관련

### @toolia/yahoo-finance-mcp
```
용도: Yahoo Finance 데이터 조회
활용:
  - yfinance fetcher 개발 시 실시간 데이터 검증
  - 한국 주식 (005930.KS) 티커 유효성 확인
  - OHLCV 데이터 형식 사전 확인
설치: npx -y @toolia/yahoo-finance-mcp
```

### @anthropic/memory-mcp
```
용도: 대화 간 정보 영속 저장
활용:
  - 지표 파라미터 튜닝 결과 기록
  - 디버깅 중 발견한 이슈/해결책 메모
  - Phase별 진행 상황 추적
설치: npx -y @anthropic/memory-mcp
```

---

## 5. 운영/모니터링

### @anthropic/shell-mcp (또는 @anthropic/bash-mcp)
```
용도: 셸 명령 실행
활용:
  - uvicorn 서버 시작/종료
  - pytest 실행
  - alembic 마이그레이션
  - lsof -i:8000 포트 확인
설치: npx -y @anthropic/shell-mcp
```

### @punkpeye/telegram-mcp
```
용도: 텔레그램 Bot API 직접 연동
활용:
  - 봇 메시지 발송 테스트
  - 채팅 ID 확인
  - 알림 포맷 미리보기 (마크다운 렌더링 확인)
  - 웹훅 설정 확인
설치: npx -y @punkpeye/telegram-mcp (TELEGRAM_BOT_TOKEN 필요)
```

---

## 6. 문서/협업

### @anthropic/github-mcp
```
용도: GitHub 이슈/PR 관리
활용:
  - Phase별 이슈 생성 및 추적
  - 코드 리뷰
  - 릴리즈 관리
설치: npx -y @anthropic/github-mcp (GITHUB_TOKEN 필요)
```

---

## Claude Code 설정 예시 (~/.claude/settings.json)

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@anthropic/sqlite-mcp", "/Users/woody/workflow/trading_view/backend/data/ubb_pro.db"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/filesystem-mcp", "/Users/woody/workflow/trading_view"]
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@anthropic/fetch-mcp"]
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@anthropic/git-mcp"]
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@anthropic/puppeteer-mcp"]
    },
    "telegram": {
      "command": "npx",
      "args": ["-y", "@punkpeye/telegram-mcp"],
      "env": {
        "TELEGRAM_BOT_TOKEN": "${TELEGRAM_BOT_TOKEN}"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/github-mcp"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

---

## Phase별 우선순위

| Phase | 필수 MCP | 선택 MCP |
|-------|----------|----------|
| **1a (MVP)** | sqlite, filesystem, fetch, shell | yahoo-finance |
| **1b (확장)** | + telegram | memory |
| **2 (대시보드)** | + puppeteer | brave-search |
| **3 (웹훅)** | fetch (웹훅 테스트) | - |
| **4 (고도화)** | github | desktop-notifier |

---

## 주의사항

```
- MCP 서버는 npx로 실행되므로 Node.js가 필수 (이미 프론트엔드용으로 설치됨)
- 환경변수(토큰 등)가 필요한 MCP는 .env에서 관리하되 settings.json에 직접 노출하지 않음
- sqlite MCP는 DB 파일 경로가 정확해야 함 (backend/data/ubb_pro.db)
- 동시에 너무 많은 MCP를 활성화하면 메모리 사용량 증가 → 현재 Phase에 필요한 것만 활성화
```
