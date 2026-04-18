# Contract: indicatorLabels 유틸리티

**파일**: `frontend/src/utils/indicatorLabels.ts`

## 타입

```typescript
export interface Badge {
  label: string
  cls: string
  priority: number
}
```

## 함수 계약

### `marketBadge(marketType: string): Badge`
시장 유형 배지를 반환한다. 항상 하나를 반환 (unknown 폴백 포함).

```
입력: "KOSPI" | "KOSDAQ" | "NASDAQ100" | "SP500" | "RUSSELL1000" | "CRYPTO" | string
출력: Badge { label, cls, priority: 0 }
```

### `signalStrengthBadge(state: string, grade: string): Badge | null`
신호 강도 배지. NORMAL은 null 반환.

```
입력: state = "BUY"|"SELL"|"NEUTRAL", grade = "STRONG"|"NORMAL"|"WEAK"
출력:
  - STRONG + BUY  → Badge("STRONG BUY", green+border, 1)
  - WEAK   + BUY  → Badge("WEAK BUY",   green, 1)
  - STRONG + SELL → Badge("STRONG SELL", red+border, 1)
  - WEAK   + SELL → Badge("WEAK SELL",  red, 1)
  - 그 외          → null
```

### `indicatorBadges(data: IndicatorData, maxCount?: number): Badge[]`
지표 조건 라벨 목록. 우선순위 순, 기본 최대 4개.

```typescript
interface IndicatorData {
  squeeze_level?: number   // 0~3
  rsi?: number             // 0~100
  bb_pct_b?: number        // 0~1 스케일
  volume_ratio?: number    // 1.0x ~
  macd_hist?: number
}
```

```
출력: Badge[] — 우선순위 정렬, maxCount 이하
우선순위:
  10: MAX SQ (lv3)
  11: MID SQ (lv2)
  12: LOW SQ (lv1)
  20: RSI 과매도 (<30)
  21: RSI 과매수 (>70)
  22: RSI 낮음 (30~45)
  30: BB 하단 (<0.2)
  31: BB 상단 (>0.8)
  40: 거래량 폭증 (≥3x)
  41: 거래량 급증 (≥2x)
  50: MACD↑ (hist>0)
```

## 사용 예

```typescript
// SignalCard
const fixed = [
  marketBadge(s.market_type),
  signalStrengthBadge(s.signal_state, s.signal_grade),
].filter(Boolean)
const indicators = indicatorBadges({ squeeze_level: s.squeeze_level, rsi: s.rsi, ... })
const allBadges = [...fixed, ...indicators]
```
