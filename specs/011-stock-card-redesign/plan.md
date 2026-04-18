# Implementation Plan: 메인페이지 종목 카드 항목 및 디자인 개선

**Branch**: `011-stock-card-redesign` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)

## Summary

메인페이지 4개 섹션(관심종목·차트 BUY·투자과열·추천)의 종목 카드에 시장 유형 배지, 신호 강도, 지표 조건 라벨을 추가하고, 전체 사이트 컬러 테마를 한 단계 밝은 mid-dark 네이비 톤으로 조정한다. 라벨 로직은 공유 유틸리티(`indicatorLabels.ts`)로 통합하고, `/api/signals`에 `market_type` 필드를 추가한다.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18) + Python 3.12
**Primary Dependencies**: React 18, Tailwind CSS v4, Zustand, React Query / FastAPI, SQLAlchemy 2.0 async
**Storage**: SQLite WAL — stock_master 테이블 읽기 전용 (market_type 조회), 스키마 변경 없음
**Testing**: pnpm tsc --noEmit (프론트엔드 타입 검증)
**Target Platform**: 웹 브라우저 (모바일 375px + PC 1280px+)
**Project Type**: Web application (프론트엔드 중심, 백엔드 소폭 변경)
**Performance Goals**: 라벨 렌더링 추가로 인한 체감 지연 없음 (클라이언트 사이드 계산, 추가 API 호출 없음)
**Constraints**: 추가 외부 API 없음, 기존 카드 클릭 동작 불변
**Scale/Scope**: 4개 카드 컴포넌트 + 1개 공유 유틸리티 + CSS 변수 5개 + 백엔드 1개 라우트

## Constitution Check

Constitution이 프로젝트별 커스텀되지 않아 일반 원칙 적용:
- ✅ 기존 동작 유지 (카드 클릭 → 상세 페이지)
- ✅ DB 스키마 변경 없음 (기존 stock_master 읽기만)
- ✅ 추가 외부 의존성 없음
- ✅ 클라이언트 사이드 계산 (성능 영향 최소)

## Project Structure

### Documentation (this feature)

```text
specs/011-stock-card-redesign/
├── plan.md          ← 현재 파일
├── research.md      ← 기술 조사 결과
├── data-model.md    ← 라벨 타입 + CSS 변수 변경값
├── contracts/
│   └── label-utility.md  ← indicatorLabels 유틸 계약
├── quickstart.md    ← 검증 시나리오
└── tasks.md         ← (speckit.tasks 실행 시 생성)
```

### Source Code 변경 범위

```text
frontend/src/
├── index.css                          ← CSS 변수 5개 수정 (--bg, --card, --border, --navy, --muted)
├── utils/
│   └── indicatorLabels.ts             ← NEW: 공유 라벨 유틸리티
├── types/index.ts                     ← Signal 타입에 market_type 추가
├── components/
│   └── SignalCard.tsx                 ← 기존 중복 로직 제거 → 공유 유틸 사용
└── pages/
    └── Dashboard.tsx                  ← BuyCard·PickCard·overheat 공유 유틸 사용

backend/
└── routes/signals.py                  ← /api/signals: market_type 필드 추가 (stock_master 조인)
```

## Implementation Architecture

### 레이어 1: CSS 변수 (index.css)

```css
:root {
  --bg:     #141E2E;  /* 기존 #0D1117 */
  --card:   #1C2840;  /* 기존 #161B22 */
  --border: #2E3F5C;  /* 기존 #30363D */
  --navy:   #223358;  /* 기존 #1B2A4A */
  --muted:  #94A3B8;  /* 기존 #8B949E */
}
```

### 레이어 2: 백엔드 market_type 추가 (routes/signals.py)

- `/api/signals` 라우트에서 stock_master를 symbol 기준으로 조회
- market_type 컬럼 값을 응답에 추가
- stock_master에 없는 경우 → market 값으로 폴백(KR/US/CRYPTO)

### 레이어 3: 공유 유틸리티 (utils/indicatorLabels.ts)

```typescript
export interface Badge { label: string; cls: string; priority: number }

export function marketBadge(marketType: string): Badge
export function signalStrengthBadge(state: string, grade: string): Badge | null
export function indicatorBadges(data: IndicatorData, maxCount?: number): Badge[]
export function buildCardBadges(fixed: Badge[], indicators: Badge[]): Badge[]
```

### 레이어 4: 카드 컴포넌트 적용

**SignalCard.tsx**:
- `indicatorBadges()` 유틸 import
- Signal 타입에서 `market_type` 사용
- 라벨 행 렌더링 (고정 + 지표 최대 4개)

**Dashboard.tsx (BuyCard)**:
- 기존 `reasons` 배열 → `indicatorBadges()` 유틸로 교체
- market_type 배지 추가

**Dashboard.tsx (PickCard)**:
- 기존 인라인 라벨 → `indicatorBadges()` 유틸로 교체
- market_type 배지 추가

**Dashboard.tsx (overheat 카드)**:
- 기존 인라인 라벨 → `indicatorBadges()` 유틸로 교체
- market_type 배지 추가

## 핵심 설계 결정

1. **공유 유틸리티 우선**: 4개 카드에 동일 함수 → 색상·기준값 불일치 방지
2. **고정 + 제한 분리**: market_type·신호강도는 항상 표시, 지표 최대 4개
3. **백엔드 소폭 변경**: signals.py만 수정, DB 마이그레이션 없음
4. **CSS 변수만 수정**: 테마 변경이 전체 페이지에 자동 적용

## 실행 계획 요약

| 단계 | 작업 | 파일 |
|------|------|------|
| 1 | CSS 변수 변경 | index.css |
| 2 | 백엔드 market_type 추가 | routes/signals.py |
| 3 | Signal 타입 업데이트 | types/index.ts |
| 4 | 공유 유틸리티 작성 | utils/indicatorLabels.ts |
| 5 | SignalCard 리팩터 | components/SignalCard.tsx |
| 6 | Dashboard 카드들 리팩터 | pages/Dashboard.tsx |
| 7 | 타입 검증 | pnpm tsc --noEmit |
