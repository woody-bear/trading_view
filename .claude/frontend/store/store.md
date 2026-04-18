---
purpose: frontend의 전역·서버·로컬 상태 관리 전략(Zustand + React Query) 설명.
reader: Claude가 상태를 추가·수정하거나 서버 상태 캐싱 전략을 조정할 때.
update-trigger: 새 Zustand store 추가; React Query key 규칙 변경; persist 저장 대상 변경.
last-audit: 2026-04-18
---

# Frontend — 상태 관리 (store/ + stores/ + React Query)

> 소스: `frontend/src/store/` (authStore) · `frontend/src/stores/` (signalStore, toastStore, detailViewStore, trendOverlayStore)
>
> ⚠️ **코드 상 `store/`와 `stores/`가 혼재한다.** 본 문서는 양쪽을 통합해 설명한다. 코드 정규화는 본 문서와 별개의 리팩토링 이슈로 다룬다.

## 상태 관리 구조

| 상태 유형 | 라이브러리 | 용도 |
|----------|-----------|------|
| 서버 상태 (API 데이터) | TanStack React Query | watchlist, scan 결과, 차트 등 |
| 클라이언트 상태 (전역) | Zustand | 인증, 실시간 신호, 토스트 |
| 로컬 UI 상태 | React useState | 폼, 토글, 로딩 등 |

---

## Zustand 스토어

### authStore.ts — 인증 상태

> 소스: `frontend/src/store/authStore.ts`

```typescript
interface AuthState {
  user: User | null            // Supabase 사용자 객체
  session: Session | null      // Supabase 세션
  loading: boolean             // 초기 로딩 상태
  authError: string | null     // 인증 에러 메시지
  setUser: (user) => void
  setSession: (session) => void
  setLoading: (loading) => void
  setAuthError: (error) => void
  clear: () => void
}
const useAuthStore = create<AuthState>()(persist(...))
// persist: user만 localStorage에 저장 (session은 Supabase 자체 관리)
```

**사용:**
```typescript
const { user } = useAuthStore()
if (!user) return <LoginPromptModal />
```

**초기화:** `AuthProvider.tsx`에서 `supabase.auth.onAuthStateChange()` 이벤트로 자동 설정

---

### signalStore.ts — 실시간 신호/가격

> 소스: `frontend/src/stores/signalStore.ts`

```typescript
interface SignalStore {
  signals: Signal[]                        // Signal[] 배열 (types/index.ts의 Signal 타입)
  setSignals: (s: Signal[]) => void        // 전체 교체
  updateSignal: (s: Signal) => void        // watchlist_id 매칭으로 단건 갱신
  updatePrices: (updates: PriceUpdate[]) => void  // 배치 가격 업데이트
}

interface PriceUpdate {
  watchlist_id: number
  symbol: string
  market: string
  price: number
  open: number
  high: number
  low: number
  volume: number
  change_pct: number
}
const useSignalStore = create<SignalStore>(...)
```

**사용:**
```typescript
const { signals, setSignals, updateSignal } = useSignalStore()
// setSignals: API 응답으로 전체 신호 목록 설정
// updateSignal: WebSocket 메시지 수신 시 단건 갱신 (watchlist_id 매칭)
// updatePrices: 10초 배치 가격 업데이트 (price, change_pct 갱신)
```

---

### toastStore.ts — 알림 토스트

```typescript
interface ToastState {
  toasts: Toast[]
  addToast: (message, type?) => void
  removeToast: (id) => void
}
const useToastStore = create<ToastState>(...)
```

**사용:**
```typescript
const { addToast } = useToastStore()
addToast("저장되었습니다", "success")
addToast("오류가 발생했습니다", "error")
```

---

### detailViewStore.ts — 종목 상세 화면 UI 설정

> 소스: `frontend/src/stores/detailViewStore.ts`

종목 키별로 차트 UI 상태(민감도 프리셋 등)를 보관. 종목 간 전환 시 상태 복원.

```typescript
interface ChartUiState {
  sensitivity: string   // 'strict' | 'normal' | 'sensitive'
}
const useDetailViewStore = create<...>({ byKey: {}, get, set })
```

**사용:** `StockDetail` 페이지·차트 컴포넌트에서 `key = \`${market}:${symbol}\``로 상태를 조회/수정.

---

### trendOverlayStore.ts — 추세 분석 오버레이 토글

> 소스: `frontend/src/stores/trendOverlayStore.ts`

추세 차트 위의 라인 오버레이(이동평균/가이드선 등) 표시 여부를 전역으로 제어.

```typescript
interface TrendOverlayStore { showLines: boolean; toggle: () => void }
```

**사용:** `TrendAnalysisCard` 또는 상세 페이지 오버레이 버튼.

---

## React Query 패턴

### 조회 (useQuery)

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['signals'],
  queryFn: fetchSignals,
  staleTime: 60000,           // 1분 (전역 기본값)
  refetchInterval: 10000,     // 10초 자동 리패치
})
```

### 변경 (useMutation)

```typescript
const mutation = useMutation({
  mutationFn: addSymbol,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['watchlist'] })
    addToast("관심종목이 추가되었습니다")
  },
  onError: () => addToast("추가 실패", "error"),
})
```

### queryKey 규칙

```typescript
['signals']                          // 관심종목 신호
['watchlist']                        // 관심종목 목록
['scan', 'full', 'latest']          // 전체 스캔 최신
['scan', 'full', 'history']         // 스캔 이력
['chart', symbol, timeframe]        // 차트 데이터
['company', symbol, market]         // 회사 정보
['sentiment']                        // 시장 심리
```

---

## localStorage 사용

| 키 | 값 | 용도 |
|----|-----|------|
| `timeframe` | "1h", "1d" 등 | 차트 봉 단위 설정 |

```typescript
// Settings.tsx에서 저장
localStorage.setItem('timeframe', selectedTimeframe)

// SignalDetail.tsx에서 읽기
const timeframe = localStorage.getItem('timeframe') || '1d'
```
