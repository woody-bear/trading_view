# UI Contract: BuySignalBanner 컴포넌트

## 컴포넌트 시그니처

```typescript
interface BuySignalBannerProps {
  item: BuySignalItem   // navigate state에서 전달받은 BUY 신호 데이터
}

function BuySignalBanner({ item }: BuySignalBannerProps): JSX.Element
```

## 표시 계약

| 조건 | 결과 |
|------|------|
| `item.last_signal === 'BUY'` | BB 반전 계열 문장 표시 |
| `item.last_signal === 'SQZ BUY'` | 스퀴즈 해소 계열 문장 표시 |
| `item.last_signal_date` 존재 | 문장 끝에 `(MM-DD)` 추가 |
| `item.rsi` 존재 | RSI 수치 강조 표시 |
| `item.volume_ratio` ≥ 2 | 거래량 수치 강조 표시 |

## generateBuyReason 유틸 계약

```typescript
// 입력: BuySignalItem
// 출력: ReasonPart[] (텍스트 파트 배열, 강조 여부 포함)
function generateBuyReason(item: BuySignalItem): ReasonPart[]
```

**결정론적 출력 보장**:
- 동일 입력 → 항상 동일 출력
- 빈 배열 반환 금지 (지표 누락 시 fallback 문장 반환)

**Fallback**:
```typescript
// 지표가 전혀 없을 때
[{ text: 'BUY 신호가 감지됐습니다' }]

// last_signal_date만 있을 때
[{ text: 'BUY 신호가 감지됐습니다' }, { text: ' (MM-DD)' }]
```

## 시각 계약

```
┌──────────────────────────────────────────┐
│ 🟢  RSI [28] 과매도 구간에서 BB 하단     │
│     반등 · 상승추세 유지  (04-02)        │
└──────────────────────────────────────────┘
```

- 배경: `bg-[var(--buy)]/10` (연한 BUY 색상)
- 테두리: `border border-[var(--buy)]/30`
- 강조 수치: `text-[var(--buy)] font-bold`
- 일반 텍스트: `text-[var(--text)]`
- 위치: 가격 영역 아래, PositionGuide 위 (`mb-3` 여백)

## BuyCard/Scan navigate 계약

```typescript
// Dashboard.tsx BuyCard + Scan.tsx BUY item 공통
nav(
  `/${item.symbol.replace(/\//g, '_')}?market=${item.market_type || item.market}`,
  { state: { buySignal: item } }   // ← 추가
)
```

## 비표시 계약

SignalDetail에서 `useLocation().state?.buySignal`이 falsy이면 BuySignalBanner를 렌더링하지 않는다.
진입 경로: 검색, URL 직접 입력, 관심종목 탭, 페이지 새로고침 → 모두 비표시.
