# Data Model: BUY 신호 이유 한줄 설명

> DB 스키마 변경 없음 — 순수 프론트엔드 타입 정의

## BuySignalItem (기존 scan item 재활용)

이미 `full_market_scanner` / `unified_cache`에서 내려오는 chart_buy 항목 구조.
**변경 없음** — 기존 필드를 navigate state로 그대로 전달.

| 필드 | 타입 | 설명 | BUY 이유 사용 |
|------|------|------|--------------|
| `last_signal` | `'BUY' \| 'SQZ BUY'` | 신호 유형 | ✅ 핵심 분기 |
| `last_signal_date` | `string` (YYYY-MM-DD) | 신호 발생일 | ✅ 문장 후미 |
| `rsi` | `number` | RSI(14) 값 | ✅ 강조 수치 |
| `volume_ratio` | `number` | 평균 대비 거래량 배율 | ✅ 강조 수치 |
| `macd_hist` | `number` | MACD 히스토그램 | ✅ 분기 조건 |
| `squeeze_level` | `0 \| 1 \| 2 \| 3` | 스퀴즈 레벨 | ✅ SQZ 판별 |
| `trend` | `'BULL' \| 'BEAR' \| 'NEUTRAL'` | EMA 추세 | ✅ 분기 조건 |
| `bb_pct_b` | `number` (0~100) | BB 위치 | 참고용 |
| `symbol` | `string` | 종목 코드 | — |
| `name` / `display_name` | `string` | 종목명 | — |
| `market_type` | `string` | 시장 구분 | — |

---

## ReasonPart (신규 — 프론트엔드 전용)

문장을 강조 구간과 일반 구간으로 분리한 파트 배열.

```typescript
interface ReasonPart {
  text: string         // 표시할 텍스트
  highlight?: boolean  // true이면 var(--buy) 색상 + font-bold 적용
}

type BuyReason = ReasonPart[]
```

**예시**:
```typescript
// "RSI 28 과매도 구간에서 BB 하단 반등 · 상승추세 유지 (04-02)"
[
  { text: 'RSI ' },
  { text: '28', highlight: true },
  { text: ' 과매도 구간에서 BB 하단 반등 · 상승추세 유지' },
  { text: ' (04-02)', highlight: false },
]
```

---

## EntryContext (navigate state)

```typescript
// navigate 호출 시 전달
interface NavigateState {
  buySignal?: BuySignalItem   // BUY 리스트 진입 시만 포함
  _snapStart?: 'last'         // 기존 스와이프 네비게이션용 (변경 없음)
}
```

SignalDetail에서 `useLocation().state as NavigateState`로 읽음.
`buySignal`이 null/undefined이면 BuySignalBanner를 렌더링하지 않음.
