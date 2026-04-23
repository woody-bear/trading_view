# Data Model: 030 List Screens Realtime Price Flicker

**Phase 1 output** | 2026-04-23

---

## UI 상태 모델

### LivePrices (런타임 캐시, 컴포넌트 로컬 상태)

```
livePrices: Record<symbol: string, LivePriceEntry>
```

| 필드 | 타입 | 출처 | 설명 |
|------|------|------|------|
| `price` | number | POST /prices/batch | 현재가 |
| `change_pct` | number | POST /prices/batch | 등락률 (%) |
| `open` | number | POST /prices/batch | 시가 |
| `high` | number | POST /prices/batch | 고가 |
| `low` | number | POST /prices/batch | 저가 |
| `volume` | number | POST /prices/batch | 거래량 |

- **변경 감지**: `price !== prev.price || change_pct !== prev.change_pct` 시 참조 교체 → memo 컴포넌트 리렌더 트리거
- **키(Key)**: `symbol` 문자열 (예: `"005930"`, `"AAPL"`)
- **수명**: 화면 마운트 ~ 언마운트 (페이지 이탈 시 폐기)

---

## Flash 상태 모델 (컴포넌트별)

각 카드 컴포넌트(`BuyCard`, `MiniWatchCard`)가 독립적으로 관리.

```
flashState: {
  direction: 'up' | 'down' | null
  prevPrice: number          // useRef
}
```

### 상태 전이

```
[idle: null]
    ↓ price 변경 감지 (useEffect)
    ↓ price > prevPrice  →  direction = 'up'   → flashColor = var(--up)
    ↓ price < prevPrice  →  direction = 'down'  → flashColor = var(--blue)
    ↓ setTimeout(800ms)
[idle: null] ← flashColor = var(--fg-0)
```

---

## 등락률 색상 규칙

```
change_pct > 0   →  color: var(--up)    (초록)
change_pct < 0   →  color: var(--blue)  (파란색)
change_pct === 0 →  color: var(--fg-2)  (기본 텍스트, 회색)
```

---

## 신규 CSS 변수

파일: `frontend/src/styles/tokens.css`

```css
/* 추가 */
--blue: oklch(0.60 0.18 240);      /* 목록 화면 하락/음수 색상 (한국 증권 관례) */
--blue-bg: oklch(0.94 0.06 240);   /* 파란색 배경 (chip 등 향후 사용 대비) */
```

---

## 데이터 흐름

```
[setInterval 5s]
    ↓
extractSymbols()        // 화면에 표시된 모든 종목 심볼 수집
    ↓
POST /prices/batch      // KR + US (CRYPTO 제외)
    ↓
setLivePrices(prev → next)   // 변경된 심볼만 참조 교체
    ↓
SectorGrouped(livePrices)
    ↓
BuyCard(livePrice={livePrices[symbol]})
    ↓
price = livePrice?.price ?? item.price
    ↓
useEffect([price]) → flash 상태 업데이트 → 색상 변경 + 800ms 타이머
```

```
Dashboard.tsx
    ↓ livePrices prop
WatchlistPanel.tsx
    ↓ livePrice={livePrices[signal.symbol]}
MiniWatchCard
    ↓ 동일한 flash 로직
```

---

## 컴포넌트별 수정 범위

| 파일 | 수정 유형 | 주요 변경 내용 |
|------|----------|--------------|
| `tokens.css` | 추가 | `--blue`, `--blue-bg` 변수 추가 |
| `Dashboard.tsx` | 수정 | 폴링 간격 30s→5s, extractSymbols에 watchlist 심볼 추가, WatchlistPanel에 livePrices 전달 |
| `Dashboard.tsx (BuyCard)` | 수정 | flash 색상: `var(--down)` → `var(--blue)`, 등락률 음수 색상: `var(--down)` → `var(--blue)` |
| `Scan.tsx` | 수정 | `livePrices={{}}` → `livePrices={livePrices}` (하드코딩 버그 수정) |
| `WatchlistPanel.tsx` | 수정 | `livePrices` prop 수신, `MiniWatchCard`에 flash 로직 + 파란색 하락 색상 추가 |

---

## 불변 사항

- 백엔드 코드 변경 없음
- DB 스키마 변경 없음
- 새 컴포넌트·훅 생성 없음 (기존 패턴 내에서 수정만)
- `usePriceFlash` 훅 자체는 수정하지 않음 (SignalDetail 영향 방지)
