# Implementation Plan: PC 스캔 화면 최상단 BUY 신호 5개 스트립

**Branch**: `032-scan-buy-strip-pc` | **Date**: 2026-04-23 | **Spec**: `specs/032-scan-buy-strip-pc/spec.md`

## Summary

PC 스캔 화면(`PcScanPanel`) 최상단에 최신 BUY 신호 종목 최대 5개를 `BuyCard` 형식의 독립 섹션으로 추가한다. 탭(추천종목·눌림목·대형주) 위에 위치하며 탭 전환 시에도 항상 표시된다. 신규 백엔드 없이 기존 `fetchFullScanLatest()` + `BuyCard` 컴포넌트를 재사용하는 **프론트엔드 전용** 작업이다.

## Technical Context

**Language/Version**: TypeScript 5 / React 18  
**Primary Dependencies**: React Query (`@tanstack/react-query`), Tailwind CSS, Vite  
**Storage**: N/A — 신규 테이블 없음, 기존 스냅샷 API 재사용  
**Testing**: 수동 브라우저 검증 (manual browser verification)  
**Target Platform**: Web (PC ≥ 768px)  
**Project Type**: Web application (SPA, React + FastAPI)  
**Performance Goals**: 기존 스캔 탭 로드 시간 이내 표시 (추가 API 호출 없음, 캐시 공유)  
**Constraints**: 모바일 미표시 (768px 미만), BUY 없을 때 빈 영역 없음  
**Scale/Scope**: 최대 5개 카드, 단일 컴포넌트 추가

## Constitution Check

| Rule | Status | Note |
|------|--------|------|
| R-01 한 번에 하나의 관심사 | ✅ Pass | PC 스트립 표시만 |
| R-06 기존 유틸 재사용 | ✅ Pass | `BuyCard`, `fetchFullScanLatest` 재사용 |
| FE-01 단일 책임 | ✅ Pass | `PcBuyStrip` 컴포넌트 단독 책임 |
| FE-02 서버 상태 → React Query | ✅ Pass | 기존 `quick-buy-strip` queryKey 공유 |
| FE-05 빈 상태 처리 | ✅ Pass | items=0 → null 반환 |
| DB-01~04 | ✅ N/A | DB 변경 없음 |
| SR-03 pnpm build | ✅ Required | 작업 완료 후 빌드 필수 |

**Gate result**: PASS — 모든 헌장 규칙 충족, 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/032-scan-buy-strip-pc/
├── plan.md              ← 이 파일
├── research.md          ← Phase 0
├── data-model.md        ← Phase 1
├── quickstart.md        ← Phase 1
└── tasks.md             ← /speckit.tasks 생성 예정
```

### Source Code (변경 파일)

```text
frontend/src/
└── pages/
    └── Dashboard.tsx     ← PcBuyStrip 컴포넌트 추가 + PcScanPanel 상단에 삽입

# 변경 없는 파일
frontend/src/components/QuickBuyStrip.tsx   ← 모바일 홈 BUY 스트립, 그대로 유지
backend/                                     ← 변경 없음
```

**Structure Decision**: 프론트엔드 단일 파일(`Dashboard.tsx`) 수정. `PcBuyStrip`을 동일 파일 내 컴포넌트로 선언하여 `BuyCard`, `livePrices` 상태에 직접 접근.

## Implementation Design

### PcBuyStrip 컴포넌트

```
PcBuyStrip
  ├── useQuery('quick-buy-strip', fetchFullScanLatest, { staleTime: 120s, refetchInterval: 300s })
  ├── items = data?.chart_buy?.items?.slice(0, 5) ?? []
  ├── if items.length === 0 → return null (빈 영역 없음)
  └── render:
      └── div (hidden on mobile: md:block 또는 hidden md:flex)
          ├── 섹션 헤더: "최근 BUY" + count chip
          └── grid repeat(5, 1fr) gap
              └── BuyCard × max 5 (livePrice 주입)
```

### 삽입 위치 (Dashboard.tsx, PcScanPanel)

```
PcScanPanel
  ├── [NEW] PcBuyStrip       ← 탭 위 독립 섹션 (상단 고정)
  ├── ScanStatusPanel        ← 기존 위치 유지
  ├── scanning 중 메시지     ← 기존
  ├── 추천종목 섹션          ← 기존
  ├── 눌림목 섹션            ← 기존
  └── 대형주 섹션            ← 기존
```

### 반응형 처리

- `hidden md:block` 또는 CSS `@media (min-width: 768px)` 사용
- 모바일(768px 미만)에서 완전히 숨김
- PC에서 `grid-cols-5` (카드 5개 1행 표시)
- 카드 3개 이하면 `grid-cols-[item수]` 대신 `grid-cols-5`로 고정 (나머지 열 빈 공간)

### 데이터 공유

- `QuickBuyStrip`(모바일)과 동일한 queryKey `'quick-buy-strip'` 사용
- React Query 캐시 자동 공유 → 추가 API 호출 없음
- `livePrices`는 `PcScanPanel`의 부모(`PcLayout`)에서 prop으로 전달 또는 내부 재사용

## Complexity Tracking

해당 없음 — 헌장 위반 없음.
