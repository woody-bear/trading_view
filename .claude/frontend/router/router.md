---
purpose: React Router 라우트 트리·보호 라우트·네비게이션 구조 설명.
reader: Claude가 라우트를 추가·수정하거나 인증 가드를 조정할 때.
update-trigger: 라우트 트리 변경; 보호 라우트 정책 변경; 네비게이션 구조 변경.
last-audit: 2026-04-18
---

# Frontend — 라우터 (react-router-dom)

> 소스: `frontend/src/App.tsx`

## 라우트 구조

```
BrowserRouter
  └── AuthProvider
       └── Routes
            ├── /                    → Dashboard
            ├── /scan                → Scan
            ├── /settings            → Settings
            ├── /alerts              → AlertHistory
            ├── /buy-list            → BuyList
            ├── /scrap               → Scrap
            ├── /auth/callback       → AuthCallback
            ├── /forex               → Forex (환율전망)
            └── /:symbol             → SignalDetail (동적 라우트)
```

## 네비게이션 구조

### PC 상단 네비 (`hidden md:flex`)
- 로고 "추세추종 연구소" → `/`
- BUY조회종목리스트 → `/buy-list`
- BUY사례스크랩 → `/scrap`
- 설정 아이콘 → `/settings`
- 로그인/UserMenu (우상단)

### 모바일 하단 BottomNav (`md:hidden`)
- `components/BottomNav.tsx` 참조

## 인증 가드

별도의 ProtectedRoute 컴포넌트 없음.  
각 페이지에서 `useAuthStore().user`를 확인하여 인증 처리:

```typescript
// 로그인 필요 시 페이지 내부에서 처리
const { user } = useAuthStore()
if (!user) return <LoginPromptModal />
```

## QueryClient 설정

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,          // 1분 캐시
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
})
```

## 동적 라우트 주의

`/:symbol`은 모든 경로의 fallback이므로 **순서상 마지막**에 위치.  
신규 경로 추가 시 `/:symbol` 앞에 배치해야 함.
