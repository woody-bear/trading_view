---
purpose: 모바일 레이아웃·스냅 스크롤·BottomNav 등 모바일 전용 CSS 규칙.
reader: Claude가 모바일 화면의 레이아웃·인터랙션을 수정할 때.
update-trigger: 모바일 브레이크포인트 변경; BottomNav 구조 변경; 스냅 스크롤 정책 변경.
last-audit: 2026-04-18
---

# Frontend CSS — 모바일 레이아웃

> 소스: `frontend/src/pages/Dashboard.tsx`, `frontend/src/components/BottomNav.tsx`  
> Tailwind 분기 기준: **`md` (768px)**  — `md:` 미만이 모바일

---

## 폰트 스케일 (@theme — index.css)

> 변경 시 `frontend/src/index.css`의 `@theme` 블록 수정

| 클래스 | 크기 | 용도 |
|--------|------|------|
| `text-micro` | 9px | 최소 뱃지, 설명 주석 |
| `text-caption` | 11px | 보조 레이블, 날짜, 단위 |
| `text-label` | 13px | 기본 라벨, BottomNav 탭 |
| `text-body` | 15px | 본문 텍스트, 항목 설명 |
| `text-value` | 18px | 수치, 가격, 지표값 |
| `text-title` | 22px | 카드 종목명, 항목 헤더 |
| `text-display` | 34px | 스냅 섹션 헤더 |

> PC 전용 크기는 표준 Tailwind 클래스(`text-xs`, `text-sm` 등) 그대로 사용.  
> 모바일/PC 분기 패턴 예시: `text-value md:text-micro`

---

## 기본 원칙

| 항목 | 값 |
|------|-----|
| 분기 breakpoint | `md` (768px 미만 = 모바일) |
| 레이아웃 방식 | 모바일 전용 JSX 블록 별도 작성 (`md:hidden` 컨테이너) |
| 네비게이션 | 하단 탭바 (`BottomNav.tsx`, `md:hidden`) |
| 상단 네비게이션 | 없음 (PC TopNav는 `hidden md:flex`) |

---

## 모바일 레이아웃 구조 (Dashboard 기준)

```
┌─────────────────────────────┐  ← fixed inset-x-0 top-0
│  스냅 스크롤 컨테이너        │     bottom: 64px (BottomNav 높이)
│  ┌───────────────────────┐  │
│  │  섹션 1: 시장지표       │  │  height: 100dvh - 64px (scrollSnapAlign: start)
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  섹션 2: 관심종목       │  │  height: 100dvh - 64px
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  섹션 3: 스캔 결과      │  │  height: 100dvh - 64px
│  └───────────────────────┘  │
└─────────────────────────────┘
┌─────────────────────────────┐  ← fixed bottom-0, height: 64px
│  BottomNav (하단 탭바)       │
└─────────────────────────────┘
```

---

## 스냅 스크롤 구현

```typescript
// 스냅 스크롤 컨테이너
style={{
  bottom: '64px',              // BottomNav 높이만큼 확보
  overflowY: 'scroll',
  scrollSnapType: 'y mandatory',
  WebkitOverflowScrolling: 'touch',
  overscrollBehavior: 'none',
}}

// 각 스냅 섹션
style={{ height: sH, scrollSnapAlign: 'start' }}
// sH = window.innerHeight - 64 (BottomNav 제외 전체 높이)
```

---

## BottomNav 탭 구성

| 탭 | 경로 | 아이콘 |
|----|------|--------|
| 홈 | `/` | Home |
| 스캔 | `/scan` | BarChart3 |
| BUY종목 | `/buy-list` | TrendingUp |
| 스크랩 | `/scrap` | BookMarked |
| 설정 | `/settings` | Settings |

```css
/* BottomNav 핵심 클래스 */
fixed bottom-0 left-0 right-0 z-50 md:hidden
height: 64px
padding-bottom: env(safe-area-inset-bottom, 0px)  /* iOS 홈 인디케이터 대응 */
```

---

## 모바일 전용 Tailwind 패턴

| 패턴 | 용도 |
|------|------|
| `md:hidden` | 모바일에서만 표시 |
| `hidden md:block` | PC에서만 표시 (모바일 숨김) |
| `fixed inset-x-0 top-0` | 모바일 전체화면 컨테이너 |
| `pb-[64px]` | BottomNav 공간 확보 |

---

## 모바일 카드/리스트 스타일

```
- 배경 없음 (bg-card 미적용)
- 1열 레이아웃
- px-3 좌우 패딩
- space-y-2 ~ space-y-3 항목 간격
```

---

## 페이지별 모바일 구조

| 페이지 | 모바일 컨테이너 | 특이사항 |
|--------|---------------|---------|
| Dashboard | `md:hidden fixed inset-x-0` 스냅 스크롤 | 3섹션 스냅 |
| Scan | `md:hidden fixed inset-x-0` | 단일 스크롤 |
| BuyList | `md:hidden fixed inset-x-0` | 단일 스크롤 |
| Settings | `md:hidden fixed inset-x-0` | 단일 스크롤 |
| Scrap | `md:hidden fixed inset-x-0 flex flex-col` | 단일 스크롤 |
