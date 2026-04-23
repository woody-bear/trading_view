# Implementation Plan: List Screens Realtime Price Flicker

**Branch**: `030-list-price-flicker` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/030-list-price-flicker/spec.md`

---

## Summary

관심종목·추천종목·눌림목·대형주 목록 화면에서 현재가와 등락률이 5초마다 일괄 갱신되며, 가격 변동 시 0.8초간 깜빡이는 시각 효과를 추가한다. 상승=초록, 하락=파란색(한국 증권 관례). 백엔드 변경은 없고, 기존 `POST /prices/batch` 엔드포인트와 `livePrices` 상태 패턴을 프론트엔드 4개 화면에 일관 적용한다.

---

## Technical Context

**Language/Version**: TypeScript 5 / React 18 (frontend), Python 3.11 (backend)  
**Primary Dependencies**: React, Tailwind CSS, React Query, Zustand, Vite  
**Storage**: N/A — 신규 DB 테이블 없음, in-memory 상태만 사용  
**Testing**: 수동 브라우저 검증 (pnpm dev / pnpm build)  
**Target Platform**: Web (모바일 + PC 반응형)  
**Project Type**: Web application (SPA + FastAPI)  
**Performance Goals**: 5초 폴링 주기, 50개 종목 동시 렌더 시 UI 응답 저하 없음  
**Constraints**: 백엔드 변경 없음, 기존 컴포넌트 패턴 준수, `usePriceFlash` 훅 수정 금지 (SignalDetail 영향 방지)  
**Scale/Scope**: 프론트엔드 4개 컴포넌트·파일 수정, CSS 변수 1개 추가

---

## Constitution Check

| 규칙 | 판정 | 근거 |
|------|------|------|
| R-01 (한 번에 하나의 관심사) | ✅ | 각 컴포넌트 수정을 독립 단계로 분리 |
| R-02 (기존 네이밍 컨벤션) | ✅ | `--blue`, `flashColor`, `livePrice` — 기존 패턴 일치 |
| R-03 (매직 넘버 금지) | ✅ | 폴링 간격은 상수 `PRICE_POLL_INTERVAL_MS = 5_000`, 플래시 지속은 `FLASH_DURATION_MS = 800` |
| R-06 (기존 유틸리티 재사용) | ✅ | `fetchBatchPrices`, `extractSymbols`, `setLivePrices` 패턴 재사용 |
| R-08 (타입 정의) | ✅ | `livePrice?: LivePriceEntry` prop 타입 명시 |
| FE-01 (단일 책임 원칙) | ✅ | 각 카드가 자신의 flash 상태만 관리 |
| FE-03 (API 호출 집중) | ✅ | `fetchBatchPrices`는 기존 `client.ts`에 이미 존재 |
| FE-05 (에러/로딩 처리) | ✅ | 가격 수신 실패 시 `item.price` fallback 유지 |

**Gate 결과**: ✅ 모든 헌법 규칙 통과 — 진행 가능

---

## Project Structure

### Documentation (this feature)

```text
specs/030-list-price-flicker/
├── plan.md          ← 이 파일
├── research.md      ← Phase 0 완료
├── data-model.md    ← Phase 1 완료
├── quickstart.md    ← Phase 1 완료
├── contracts/
│   └── price-batch-api.md  ← Phase 1 완료
└── tasks.md         ← /speckit.tasks 명령으로 생성
```

### Source Code (수정 대상 파일)

```text
frontend/
└── src/
    ├── styles/
    │   └── tokens.css              ← --blue, --blue-bg 변수 추가
    ├── components/
    │   └── WatchlistPanel.tsx      ← livePrices prop 추가, MiniWatchCard flash + 파란색
    └── pages/
        ├── Dashboard.tsx           ← 폴링 5s, extractSymbols watchlist 포함, WatchlistPanel livePrices 전달
        └── Scan.tsx                ← livePrices={{}} 버그 수정 → livePrices={livePrices}

# 백엔드 변경 없음
```

**Structure Decision**: 기존 Web application 구조 유지. 신규 파일 없음, 기존 5개 파일 수정.

---

## 구현 단계

### Step 1: CSS 변수 추가 (tokens.css)

`--blue: oklch(0.60 0.18 240)` 및 `--blue-bg` 추가.  
이 변수를 이후 모든 컴포넌트에서 참조.

### Step 2: BuyCard 색상 수정 (Dashboard.tsx)

**현재 문제**: flash 하락 색상 `var(--down)` (빨간), 등락률 음수 색상 `var(--down)` (빨간)  
**수정**: 두 곳 모두 `var(--blue)` 로 변경.  
- `flashColor` ternary: `'var(--up)' : 'var(--down)'` → `'var(--up)' : 'var(--blue)'`
- 등락률 색상: `sparkUp ? 'var(--up)' : 'var(--down)'` → `sparkUp ? 'var(--up)' : 'var(--blue)'`

### Step 3: 폴링 간격 단축 (Dashboard.tsx)

`setInterval(refreshPrices, 30_000)` → `setInterval(refreshPrices, 5_000)`  
상수 `PRICE_POLL_INTERVAL_MS = 5_000` 으로 추출.

### Step 4: WatchlistPanel에 livePrices 연결 (Dashboard.tsx)

`extractSymbols()`에 watchlist signals 심볼 추가.  
`<WatchlistPanel ... livePrices={livePrices} />` prop 전달.

### Step 5: WatchlistPanel 수정

- `livePrices?: Record<string, any>` prop 수신
- `MiniWatchCard`에 `livePrice` prop 전달
- `MiniWatchCard` 내부: `useRef` + `useState` flash 로직 추가 (BuyCard 패턴 동일)
- 등락률 색상: `var(--down)` → `var(--blue)` (음수), `var(--up)` (양수), `var(--fg-2)` (0%)

### Step 6: Scan.tsx 버그 수정

`<SectorGrouped items={sortedBuy} livePrices={{}} .../>` 총 3곳에서  
`livePrices={{}}` → `livePrices={livePrices}` 로 수정.

---

## 리스크 및 완화책

| 리스크 | 가능성 | 완화 |
|--------|--------|------|
| 5초 폴링 시 서버 과부하 | 낮음 | CRYPTO 제외, 이미 livePrices 변경 감지로 불필요한 리렌더 방지 |
| BuyCard memo 무효화 | 낮음 | `setLivePrices`의 참조 교체 최소화 로직 기존 유지 |
| WatchlistPanel prop 변경으로 기존 기능 깨짐 | 낮음 | prop은 optional (`livePrices?`) — 미전달 시 undefined fallback |
| `--blue` 변수가 다른 컴포넌트에 오용 | 낮음 | 명칭을 `--list-down`으로 하는 안도 있었으나 재사용 가능성 고려 `--blue` 선택 |
