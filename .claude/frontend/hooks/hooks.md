---
purpose: frontend/src/hooks/ 커스텀 훅(useSwipe·useWebSocket 등) 목록·시그니처.
reader: Claude가 커스텀 훅을 추가·수정하거나 재사용 위치를 찾을 때.
update-trigger: hooks/ 파일 추가·제거; 훅 반환 타입·의존성 배열 시그니처 변경.
last-audit: 2026-04-18
---

# Frontend — 커스텀 훅 (hooks/)

> 소스: `frontend/src/hooks/`

## 훅 목록

| 파일 | 훅명 | 용도 |
|------|------|------|
| `useWebSocket.ts` | `useWebSocket` | WebSocket 연결 + 메시지 처리 |
| `useRealtimePrice.ts` | `useRealtimePrice` | 실시간 가격 구독 |
| `usePriceFlash.ts` | `usePriceFlash` | 가격 변동 시 깜빡임 효과 |
| `useBuyPoint.ts` | `useBuyPoint` | BUY 포인트 계산 |
| `usePageSwipe.ts` | `usePageSwipe` | 모바일 스와이프 네비게이션 |

---

## 훅별 상세

### useWebSocket

```typescript
// App.tsx에서 앱 레벨로 1회 호출
useWebSocket()

// 동작:
// 1. WebSocket /ws 연결
// 2. signal_update 메시지 → signalStore.updateSignal()
// 3. price_update 메시지 → signalStore.updatePrices()
// 4. 연결 끊김 시 자동 재연결
```

### useRealtimePrice

```typescript
// SignalDetail.tsx에서 사용
const { price, change } = useRealtimePrice(symbol, market)

// 동작:
// 1. signalStore에서 실시간 가격 구독
// 2. 한투 WebSocket(KR) 또는 배치 폴링(US) 경유
```

### usePriceFlash

```typescript
// SignalCard.tsx에서 사용
const { flashClass } = usePriceFlash(price)

// 동작:
// 가격 변동 감지 → 상승이면 'flash-green', 하락이면 'flash-red'
// 0.8초 후 클래스 제거
```

### useBuyPoint

```typescript
// PositionGuide.tsx에서 사용
const buyPoints = useBuyPoint(symbol, market, entryPrice)

// 동작:
// 분할매수 가이드 계산 (1차/2차/3차 매수가)
```

### usePageSwipe

```typescript
// 모바일에서 페이지 간 스와이프 제스처 처리
// react-router-dom navigate와 연동
```

---

## 새 훅 작성 패턴

```typescript
// hooks/useMyHook.ts
import { useState, useEffect } from 'react'

export function useMyHook(param: string) {
  const [data, setData] = useState<DataType | null>(null)

  useEffect(() => {
    // 구독/정리 로직
    return () => {
      // cleanup
    }
  }, [param])

  return { data }
}
```

- 훅 파일명: `use` 접두사 + camelCase
- 정리(cleanup) 반드시 return
- 의존성 배열 정확히 명시
