---
purpose: PC 레이아웃·TopNav·그리드·CSS 변수 정의.
reader: Claude가 PC 뷰의 레이아웃·반응형 규칙을 수정할 때.
update-trigger: PC 브레이크포인트 변경; TopNav 구조 변경; 공용 CSS 변수 추가·이름 변경.
last-audit: 2026-04-18
---

# Frontend CSS — PC 레이아웃

> 소스: `frontend/src/App.tsx`, `frontend/src/pages/Dashboard.tsx`  
> Tailwind 분기 기준: **`md` (768px 이상)**  — `md:` 이상이 PC

---

## 기본 원칙

| 항목 | 값 |
|------|-----|
| 분기 breakpoint | `md` (768px 이상 = PC) |
| 레이아웃 방식 | PC 전용 JSX 블록 별도 작성 (`hidden md:block` 컨테이너) |
| 네비게이션 | 상단 TopNav (`hidden md:flex bg-[var(--navy)]`) |
| 하단 | 저작권 footer (`hidden md:block`) |

---

## 전체 PC 레이아웃 구조 (App.tsx)

```
┌─────────────────────────────────────────┐
│  TopNav (hidden md:flex)                │  ← 상단 고정
│  로고 | 관심종목 | BUY종목 | 스캔 | ... │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  <main> 콘텐츠 영역                      │  ← 페이지별 렌더
│  pb-16 (푸터 여백)                       │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  Footer (hidden md:block)               │  ← 하단 고정
└─────────────────────────────────────────┘
```

---

## PC 콘텐츠 컨테이너 패턴

```css
/* 대부분의 페이지 PC 루트 컨테이너 */
hidden md:block p-3 md:p-6 max-w-7xl mx-auto
```

| 항목 | 값 |
|------|-----|
| 최대 너비 | `max-w-7xl` (1280px) |
| 패딩 | `p-3` → `md:p-6` |
| 중앙 정렬 | `mx-auto` |

---

## PC 그리드 레이아웃

```css
/* Dashboard 관심종목 그리드 */
grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4

/* BuyList 카드 그리드 */
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3
```

---

## Dashboard PC 구조

```
┌─────────────────┬──────────────────────────────┐
│  관심종목         │  전체 시장 스캔                 │
│  (좌측 컬럼)     │  (우측 컬럼, md:block)          │
│                 │  ┌──────────────────────────┐  │
│  검색 + 카드     │  │  MAX SQ 섹션              │  │
│  (2열/3열 그리드)│  │  차트 BUY 신호 섹션        │  │
│                 │  │  └ EMA 추세 바 (w-1/2)   │  │
│                 │  │  └ BuyCard 목록           │  │
│                 │  │  과열종목 섹션             │  │
│                 │  └──────────────────────────┘  │
└─────────────────┴──────────────────────────────┘
```

---

## CSS 변수 (index.css :root)

| 변수 | 값 | 용도 |
|------|----|------|
| `--bg` | `#000000` | 페이지 배경 |
| `--card` | `#1c1c1e` | 카드 배경 |
| `--border` | `#2c2c2e` | 구분선 |
| `--text` | `#ffffff` | 기본 텍스트 |
| `--muted` | `#8e8e93` | 보조 텍스트 |
| `--buy` | `#ff4b6a` | BUY 색상 |
| `--sell` | `#4285f4` | SELL 색상 |
| `--neutral` | `#636366` | 중립 색상 |
| `--gold` | `#f59e0b` | 강조 색상 |

> 다크 테마 고정. 라이트 모드 없음.

---

## PC 전용 Tailwind 패턴

| 패턴 | 용도 |
|------|------|
| `hidden md:block` | PC에서만 표시 |
| `hidden md:flex` | PC에서만 flex 표시 |
| `md:grid-cols-2 lg:grid-cols-3` | 반응형 그리드 |
| `md:p-6` | PC 패딩 증가 |
| `max-w-7xl mx-auto` | 콘텐츠 최대 너비 중앙 정렬 |

---

## TopNav 구성 (App.tsx)

```
로고 | 홈 | BUY종목 | 스캔 | 관심종목 | 스크랩 | 환율 | 설정
                                                  [UserMenu]
```

- 배경: `bg-[var(--navy)]` (TopNav 전용 색상)
- 높이: `py-3` (고정 높이 없음, 콘텐츠 기반)
- 활성 탭: `text-[var(--buy)]` 강조
