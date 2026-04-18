# Implementation Plan: Toss/Domino UI Redesign (014)

**Branch**: `014-toss-ui-redesign` | **Date**: 2026-04-03 | **Spec**: [spec.md](spec.md)

## Summary

토스증권/도미노 디자인 패턴으로 앱 전체 UI를 리디자인한다. 핵심 변경사항:
1. `index.css` CSS 변수 값 교체 (배경/카드/상승/하락 색상)
2. 하드코딩 색상(`text-green-400`, `text-red-400`, hex 상수)을 CSS 변수로 통일
3. 차트 캔들/격자선 색상 변경 (lightweight-charts v5 API)
4. 하단 탭바 활성 색상 및 반투명 처리
5. 카드 border-radius, padding, 정보 나열 방식 개선

**백엔드 변경 없음 — 프론트엔드 전용.**

## Technical Context

**Language/Version**: TypeScript 5.x (React 18)
**Primary Dependencies**: React 18, Tailwind CSS v4 (`@tailwindcss/vite`), lightweight-charts v5, Zustand, React Query
**Storage**: N/A (DB 스키마 변경 없음)
**Testing**: pnpm test (Vitest)
**Target Platform**: Web SPA — 모바일(360px+) + PC(768px+)
**Project Type**: web-app
**Performance Goals**: 60fps 렌더링 유지, 색상 변경으로 인한 리플로우 없음
**Constraints**: 기존 기능 100% 보존, 모바일 360px 기준 텍스트 잘림 없음
**Scale/Scope**: 프론트엔드 파일 ~15개 수정

## Constitution Check

*constitution.md가 템플릿 상태 (프로젝트별 원칙 미정의)*

- 기존 기능 보존: SC-005, FR-013 명시 → 구현 시 로직 변경 금지
- 백엔드 무변경: 확인됨
- Tailwind v4 + CSS 변수 패턴: 기존 코드와 일관성 유지

## Project Structure

### Documentation (this feature)

```text
specs/014-toss-ui-redesign/
├── plan.md              ← 이 파일
├── research.md          ← 완료 (Phase 0)
├── data-model.md        ← 완료 (Phase 1)
├── contracts/
│   └── ui-tokens.md     ← 완료 (Phase 1)
├── quickstart.md        ← 완료 (Phase 1)
├── checklists/
│   └── requirements.md  ← 완료
└── tasks.md             ← /speckit.tasks 에서 생성
```

### Source Code (수정 대상 파일)

```text
frontend/
├── src/
│   ├── index.css                              # [핵심] CSS 변수 값 교체
│   ├── components/
│   │   ├── BottomNav.tsx                      # 활성 색상 + 반투명 배경
│   │   ├── SignalCard.tsx                     # 상승/하락 색상, 뱃지
│   │   ├── SentimentPanel.tsx                 # Fear&Greed 게이지 색상, 차트
│   │   ├── StockFundamentals.tsx              # 레이블-왼쪽/값-오른쪽 패턴
│   │   └── charts/
│   │       └── IndicatorChart.tsx             # 캔들 색상, 차트 배경/격자
│   ├── pages/
│   │   ├── Dashboard.tsx                      # 섹션 헤더 색상 (기능 변경 없음)
│   │   ├── SignalDetail.tsx                   # 카드 레이아웃, 색상
│   │   ├── Forex.tsx                          # 차트 배경/격자 색상
│   │   ├── TopPicks.tsx                       # 카드 색상
│   │   ├── Scan.tsx                           # 카드 색상
│   │   └── Settings.tsx                       # 레이블-왼쪽/값-오른쪽 확인
│   └── utils/
│       └── indicatorLabels.ts                 # BUY/SELL 뱃지 색상 클래스
```

**Structure Decision**: 기존 Option 2 (web application) 구조 유지. 백엔드 변경 없음.

## Implementation Strategy

### Phase 1 (핵심 — 즉각 효과): CSS 변수 교체
`index.css` 한 파일 수정으로 `var(--...)` 패턴을 쓰는 모든 컴포넌트에 자동 적용.
`--gold` 제거 → BottomNav에서 `var(--buy)` 사용.

### Phase 2 (확산): 하드코딩 색상 통일
`text-green-400`, `text-red-400`, `#22c55e`, `#ef4444` 등 직접 작성된 색상을 CSS 변수로 교체.

### Phase 3 (차트): lightweight-charts 설정 변경
캔들 색상, 차트 배경, 격자선 색상을 Toss 스타일로.

### Phase 4 (레이아웃): 카드 radius + 정보 나열 방식
`rounded-lg` → `rounded-xl`, `p-3` → `p-4`, 레이블-왼쪽/값-오른쪽 패턴 일관성.

### Phase 5 (네비): BottomNav 스타일 완성
반투명 배경, 활성 핑크-레드, 아이콘+텍스트 크기 조정.
