# Research: Toss UI Redesign (014)

**Date**: 2026-04-03 | **Branch**: `014-toss-ui-redesign`

---

## Decision 1: CSS 변수 기반 컬러 토큰 전략

**Decision**: `frontend/src/index.css`의 `:root` CSS 커스텀 프로퍼티를 Toss 색상으로 교체.
**Rationale**: 프로젝트가 이미 `var(--bg)`, `var(--card)`, `var(--buy)`, `var(--sell)` 등 CSS 변수 체계를 갖추고 있어 변수 값만 바꾸면 `var(--...)` 패턴을 쓰는 컴포넌트에 즉시 적용된다. Tailwind config 변경은 불필요.
**Alternatives considered**:
- Tailwind `@theme` 확장 — CSS 변수가 이미 존재하므로 이중 관리 발생, 기각
- 컴포넌트별 인라인 스타일 — 파급 범위가 너무 넓어 유지보수 불가, 기각

**New variable values**:
```css
--bg:      #000000   /* 순수 블랙 배경 */
--card:    #1c1c1e   /* 토스 카드 배경 */
--border:  #2c2c2e   /* 구분선 */
--text:    #ffffff   /* 주 텍스트 */
--muted:   #8e8e93   /* 보조 텍스트 */
--buy:     #ff4b6a   /* 상승 (토스 핑크-레드) */
--sell:    #4285f4   /* 하락 (토스 블루) */
--neutral: #636366   /* 중립/비활성 */
/* --navy, --gold 제거 (더 이상 사용 안 함) */
```

---

## Decision 2: 하드코딩 색상 교체 범위

**Decision**: `text-green-400` / `text-red-400` 및 `#22c55e` / `#ef4444` 등 하드코딩된 색상을 CSS 변수(`text-[var(--buy)]`, `text-[var(--sell)]`)로 교체.
**Rationale**: CSS 변수 체계로 통일하면 미래 색상 변경 시 단일 파일만 수정하면 된다.
**Scope** (영향 파일):
- `src/components/SignalCard.tsx` — change_pct 색상, 상승/하락추세 뱃지
- `src/components/SentimentPanel.tsx` — Fear&Greed 게이지, 지수 방향 색상
- `src/components/StockFundamentals.tsx` — 52주 고점, 상한가 색상
- `src/utils/indicatorLabels.ts` — BUY/SELL 뱃지 클래스
- `src/components/BottomNav.tsx` — 활성 탭 `--gold` → `--buy`

---

## Decision 3: lightweight-charts v5 캔들 색상 변경

**Decision**: `IndicatorChart.tsx`의 `CandlestickSeries` 옵션에서 `upColor: '#ff4b6a'`, `downColor: '#4285f4'`로 교체.
**Rationale**: lightweight-charts v5는 series 생성 시 `upColor`/`downColor`/`wickUpColor`/`wickDownColor` 옵션으로 직접 색상 지정 가능. CSS 변수 참조 불가(캔버스 기반)이므로 hex 직접 사용.
**Chart background & grid**:
- `layout.background.color`: `#000000` (CSS `--bg`와 동일)
- `grid.vertLines.color`: `#2c2c2e` (CSS `--border`와 동일)
- `grid.horzLines.color`: `rgba(44,44,46,0.5)` (약 15% 투명도)

---

## Decision 4: Tailwind CSS v4 — darkMode 설정 불필요

**Decision**: `darkMode` 설정 없이 CSS 변수 값만 교체.
**Rationale**: Tailwind v4는 `tailwind.config.js` 없이 `@import "tailwindcss"`로 동작. 이미 dark-only 앱이므로 `prefers-color-scheme` 미디어 쿼리나 `.dark` 클래스 불필요. CSS 변수만 변경하면 충분.

---

## Decision 5: 카드 border-radius 및 padding 기준

**Decision**: 기존 `rounded-lg` (8px) → `rounded-xl` (12px), padding `p-3` → `p-4` (16px)로 통일.
**Rationale**: 토스증권 카드는 더 크고 둥근 모서리와 넉넉한 여백을 사용. `rounded-xl`은 Tailwind 기본 12px.

---

## Decision 6: BottomNav 활성 색상 & 반투명 처리

**Decision**: 활성 탭 색상 `var(--gold)` → `var(--buy)` (`#ff4b6a`), 배경 `var(--bg)/95` → `rgba(0,0,0,0.85)` + `backdrop-blur-md`.
**Rationale**: 토스증권 탭바는 반투명 배경에 핑크-레드 활성 색상 사용.

---

## Decision 7: 기존 기능 보존 전략

**Decision**: 백엔드 무변경, 프론트엔드 로직 무변경. 오직 CSS 클래스, 인라인 스타일, 색상 상수만 수정.
**Rationale**: SC-005, FR-013 요구사항. API 호출, 상태 관리, 라우팅, 이벤트 핸들러는 일절 건드리지 않는다.

---

## Decision 8: 수직 스냅 스크롤 유지

**Decision**: Dashboard의 `scrollSnapType: 'y mandatory'` 구조 유지. 좌우 스와이프 변경 없음.
**Rationale**: 사용자 clarification — 상하 스와이프로 유지, 하단 탭바 네비게이션 유지.
