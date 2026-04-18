---
purpose: frontend/src/components/ 하위 공통 컴포넌트(SignalCard/차트/모달 등) 목록·인터페이스.
reader: Claude가 컴포넌트를 추가·수정하거나 재사용 위치를 찾을 때.
update-trigger: components/ 파일 추가·제거; 핵심 컴포넌트 props 시그니처 변경.
last-audit: 2026-04-18
---

# Frontend — 컴포넌트 (components/)

> 소스: `frontend/src/components/`

## 컴포넌트 목록

### 레이아웃/네비게이션

| 컴포넌트 | 용도 |
|---------|------|
| `BottomNav.tsx` | 모바일 하단 탭 네비게이션 |
| `AuthProvider.tsx` | Supabase 인증 상태 초기화 + 전파 |
| `LoginButton.tsx` | Google 로그인 버튼 |
| `UserMenu.tsx` | 로그인 사용자 메뉴 (아바타 + 로그아웃) |
| `LoginPromptModal.tsx` | 비로그인 사용자에게 로그인 유도 모달 |

### 주요 UI 컴포넌트

| 컴포넌트 | 용도 |
|---------|------|
| `SignalCard.tsx` | 관심종목 카드 (가격, 지표, 스퀴즈 도트, 실시간 가격 깜빡임) |
| `BuySignalBanner.tsx` | BUY 신호 배너 (홈화면 상단) |
| `RiskWarningBanner.tsx` | 투자 위험 고지 배너 |
| `PositionGuide.tsx` | 분할매수 포지션 가이드 (종목 상세) |

### 차트 관련

| 컴포넌트 | 용도 |
|---------|------|
| `charts/` | lightweight-charts 래퍼 컴포넌트들 |
| `RevenueSegmentChart.tsx` | 매출 구성 파이 차트 |

### 종목 상세 패널

| 컴포넌트 | 용도 |
|---------|------|
| `CompanyInfoPanel.tsx` | 회사 정보 (로고, 설명, 섹터) |
| `InvestmentMetricsPanel.tsx` | 투자 지표 (PER, PBR, ROE 등) |
| `OrderbookPanel.tsx` | 호가창 (KR 종목 전용) |
| `SentimentPanel.tsx` | 시장 심리 지표 패널 |
| `StockFundamentals.tsx` | 종목 기본 재무 데이터 |

### 공통 UI (ui/)

| 컴포넌트 | 용도 |
|---------|------|
| `Toast.tsx` | 알림 토스트 (toastStore 연동) |

---

## SignalCard 주요 동작

```
props: watchlist 항목 + 실시간 가격 + 신호 상태

표시 요소:
  - 종목명 + 심볼 + 시장 배지
  - 현재가 + 등락률
  - RSI / %B / 거래량비율 지표
  - 스퀴즈 레벨 도트 (4단계 색상)
  - 추세 배지 (BULL/BEAR)
  - 가격 깜빡임 (상승=초록, 하락=빨강, 0.8초)

인터랙션:
  - 카드 클릭 → /:symbol?market=XX 이동
  - 삭제 버튼 (PC: hover 시 표시) → confirm → DELETE
```

---

## 컴포넌트 작성 규칙

```typescript
// [FE-01] 단일 책임 원칙
// [FE-05] 에러/로딩/빈 상태 반드시 처리

function MyComponent({ data }: Props) {
  if (!data) return <div>로딩 중...</div>
  if (data.length === 0) return <div>데이터 없음</div>
  return <div>...</div>
}
```

- props 타입은 `types/index.ts` 또는 인라인 interface 정의
- Tailwind CSS 사용, 인라인 style 최소화
- 모바일 우선 (`sm:`, `md:` breakpoint 활용)
