# Data Model: 종목 카드 라벨 시스템

> 이 기능은 기존 DB 스키마 변경 없음. 라벨은 기존 API 데이터에서 클라이언트 사이드 계산.
> 유일한 백엔드 변경: `/api/signals` 응답에 `market_type` 필드 추가.

## Signal (관심종목) — 변경사항

```
Signal (기존 필드 유지 + 신규)
├── market_type: string  ← NEW (stock_master 조인으로 추가)
│   예) "KOSPI" | "KOSDAQ" | "NASDAQ100" | "SP500" | "RUSSELL1000"
└── (기존 필드: watchlist_id, symbol, signal_state, confidence, signal_grade, rsi, bb_pct_b, squeeze_level, macd_hist, volume_ratio, ...)
```

## Badge (클라이언트 전용 타입)

```typescript
interface Badge {
  label: string    // 표시 텍스트
  cls: string      // Tailwind 클래스 (색상)
  priority: number // 정렬 우선순위 (낮을수록 먼저)
}
```

## 라벨 그룹 구조

```
카드 라벨 영역
├── [고정 그룹] 항상 표시
│   ├── 시장 유형 배지  (market_type → KOSPI/KOSDAQ/SP500/NQ100/R1000/CRYPTO)
│   └── 신호 강도       (signal_grade + signal_state → STRONG BUY / WEAK BUY / STRONG SELL)
│
└── [지표 그룹] 조건 충족 시, 우선순위 순 최대 4개
    ├── 스퀴즈 (MAX SQ / MID SQ / LOW SQ)
    ├── RSI    (과매도 <30 / 낮음 30~45 / 과매수 >70)
    ├── BB %B  (하단 <20% / 상단 >80%)
    ├── 거래량 (급증 ≥2x / 폭증 ≥3x)
    └── MACD   (MACD↑ when hist > 0)
```

## 색상 매핑 (CSS 클래스 기준)

| 조건 | 라벨 | Tailwind 클래스 |
|------|------|----------------|
| BUY / STRONG BUY | `BUY` / `STRONG BUY` | `text-green-400 bg-green-400/15 border border-green-400/30` |
| WEAK BUY | `WEAK BUY` | `text-green-300 bg-green-300/10` |
| SELL / STRONG SELL | `SELL` / `STRONG SELL` | `text-red-400 bg-red-400/15 border border-red-400/30` |
| RSI < 30 | `RSI 과매도` | `text-emerald-400 bg-emerald-400/10` |
| RSI 30~45 | `RSI 낮음` | `text-blue-400 bg-blue-400/10` |
| RSI > 70 | `RSI 과매수` | `text-red-400 bg-red-400/10` |
| BB < 20% | `BB 하단` | `text-cyan-400 bg-cyan-400/10` |
| BB > 80% | `BB 상단` | `text-orange-400 bg-orange-400/10` |
| SQ Lv3 | `MAX SQ` | `text-red-400 bg-red-400/10` |
| SQ Lv2 | `MID SQ` | `text-orange-400 bg-orange-400/10` |
| SQ Lv1 | `LOW SQ` | `text-yellow-400 bg-yellow-400/10` |
| vol ≥ 3x | `거래량 폭증` | `text-purple-400 bg-purple-400/10` |
| vol ≥ 2x | `거래량 급증` | `text-purple-300 bg-purple-300/10` |
| MACD hist > 0 | `MACD↑` | `text-teal-400 bg-teal-400/10` |
| KOSPI | `KOSPI` | `text-blue-300 bg-blue-500/15` |
| KOSDAQ | `KOSDAQ` | `text-purple-300 bg-purple-500/15` |
| SP500 | `S&P500` | `text-emerald-300 bg-emerald-500/15` |
| NASDAQ100 | `NQ100` | `text-blue-400 bg-blue-400/15` |
| RUSSELL1000 | `R1000` | `text-orange-300 bg-orange-400/15` |
| CRYPTO | `CRYPTO` | `text-yellow-300 bg-yellow-400/15` |

## CSS 변수 변경

```css
/* index.css :root */
--bg:     #141E2E  /* 기존 #0D1117 */
--card:   #1C2840  /* 기존 #161B22 */
--border: #2E3F5C  /* 기존 #30363D */
--navy:   #223358  /* 기존 #1B2A4A */
--muted:  #94A3B8  /* 기존 #8B949E */
```
