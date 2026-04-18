# Implementation Plan: 종목 상세화면 2단 분석 뷰 (1차 차트 → 2차 가치)

**Branch**: `022-stock-detail-layered-analysis` | **Date**: 2026-04-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-stock-detail-layered-analysis/spec.md`

## Summary

종목 상세화면(`SignalDetail`)을 **2개 탭 구조**로 재구성한다.

- **1차 탭 — 차트 분석**: 기존 차트·지표·신호 마커 UX를 손대지 않고 그대로 래핑.
- **2차 탭 — 가치 분석**: KR·US 개별 주식에 한해 시가총액·PER·PBR·ROE·EPS·배당수익률·섹터를 **중요도 순**으로 카드형 표시. ETF·암호화폐·지수·외환은 탭을 disabled로 노출하고 툴팁/토스트로 미지원 안내.
- **모바일 가치 분석 본문**은 CSS Scroll Snap (`scroll-snap-type: y mandatory`) 적용해 섹션 단위로 정렬.
- **URL 동기화**: `?tab=chart|value` 쿼리로 딥링크·뒤로가기 지원.

기술 접근: 기존 백엔드 `GET /company/{symbol}?market=` 엔드포인트가 metrics(per/pbr/roe/eps/dividend_yield/market_cap 등) + company.sector를 이미 제공하므로 **백엔드 신규 엔드포인트 불필요**. 자산군 판정 로직(asset_class)만 신설하여 가치 탭 활성화 여부에 사용. 프론트 신규 탭 컴포넌트(`ValueAnalysisTab`) + 상태(URL 쿼리·세션 단위 차트 토글 보존) 추가.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5 / React 18 (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy, pydantic-settings, yfinance, pykrx (backend) · React Router, React Query, Zustand, lightweight-charts, Tailwind (frontend)
**Storage**: 기존 SQLite/PostgreSQL — 본 기능은 **신규 테이블 없음**. `/company/{symbol}` 응답은 백엔드 in-memory 1h TTL 캐시 재사용. 프론트는 React Query 캐시(staleTime 1h) 사용.
**Testing**: pytest (backend), Vitest + React Testing Library (frontend), 수동 브라우저 검증
**Target Platform**: 웹(데스크톱 + 모바일 PWA), 백엔드 = uvicorn 단일 인스턴스
**Project Type**: Web (FastAPI 백엔드 + React SPA, dist 번들을 백엔드가 서빙)
**Performance Goals**: 1차 탭 렌더 < 0.5s (SC-001), 2차 탭 데이터 노출 p95 < 1.5s (SC-002)
**Constraints**: 회귀 금지(FR-002), 모바일 BottomNav와 중첩 금지(FR-009), CSS Scroll Snap는 모바일 한정(FR-012)
**Scale/Scope**: 종목 ~1,198개 (KR ~470 + US ~718 + CRYPTO 10), 동시 사용자 수십명 수준

## Constitution Check

> 프로젝트 `.specify/memory/constitution.md`는 미작성(템플릿 placeholder) 상태. 본 기능은 `CLAUDE.md`의 운영 원칙(보호 규칙·작업 분해 프로토콜·코딩 규칙·서버 재시작 규칙)을 사실상의 헌법으로 간주하여 다음 게이트를 평가한다.

| 게이트 | 결과 | 비고 |
|--------|------|------|
| `rules/` 보호 파일 변경 없음 | ✅ Pass | 차트 분석 1차 탭은 기존 동작 유지(FR-002), BUY/SELL 라벨 로직 무변경 |
| 기존 동작 회귀 금지 | ✅ Pass | 1차 탭은 기존 컴포넌트 래핑 |
| 신규 DB 스키마 없음 / 기존 컬럼만 사용 | ✅ Pass | 본 기능 한정으로 마이그레이션 불필요 |
| 환경 변수·시크릿 하드코딩 금지 | ✅ Pass | 신규 외부 키 없음 |
| 사용자 입력 검증 | ✅ Pass | 자산군 판정은 서버 측 결정 사용 |
| 작업 후 백엔드 재시작 + 프론트 재빌드 (SR-01~05) | ✅ 계획 반영 | quickstart.md에 명시 |

**위반 없음** → Phase 0 진행.

## Project Structure

### Documentation (this feature)

```text
specs/022-stock-detail-layered-analysis/
├── plan.md              # This file
├── research.md          # Phase 0 산출물
├── data-model.md        # Phase 1 산출물
├── quickstart.md        # Phase 1 산출물
├── contracts/
│   └── company.openapi.yaml
├── checklists/requirements.md
└── spec.md
```

### Source Code (repository root)

```text
backend/
├── routes/
│   └── company.py                 # (수정) 응답에 asset_class 필드 추가
├── services/
│   └── asset_class.py             # (신규) symbol+market → AssetClass 판정
└── tests/
    ├── unit/test_asset_class.py
    └── integration/test_company_endpoint.py

frontend/
├── src/
│   ├── pages/SignalDetail.tsx                  # (수정) 탭 골격 도입
│   ├── components/
│   │   ├── DetailTabs.tsx                      # (신규) 탭 스트립 + URL 동기화
│   │   ├── ValueAnalysisTab.tsx                # (신규)
│   │   └── value/{MetricCard,UnsupportedNotice}.tsx
│   ├── api/client.ts                           # (수정) 응답 타입 + asset_class
│   ├── hooks/useDetailTab.ts                   # (신규)
│   ├── store/detailViewStore.ts                # (신규) 차트 토글 세션 보존
│   ├── types/company.ts                        # (수정)
│   └── styles/value-tab.css                    # (신규) 모바일 scroll-snap
└── tests/components/ValueAnalysisTab.test.tsx
```

**Structure Decision**: 풀스택 Web 구조. 백엔드는 자산군 판정 헬퍼만 신설하고 기존 `/company/{symbol}` 응답에 `asset_class` 필드만 추가한다(하위 호환). 프론트는 SignalDetail에 탭 골격을 도입하되 1차 탭은 **현 컴포넌트 트리 그대로 래핑**해 회귀 위험을 최소화한다.

## Phase 0 — Research

별도 산출물: [research.md](./research.md)

핵심 결정:

1. **데이터 소스 통합**: 신규 소스 도입 없이 기존 yfinance 기반 `routes/company.py` 재사용. KR/US 모두 yfinance가 PER·PBR·ROE·EPS·시총·배당·섹터를 제공.
2. **자산군 판정**: `services/asset_class.py` 신설. (symbol, market) → `AssetClass ∈ {STOCK_KR, STOCK_US, ETF, CRYPTO, INDEX, FX}`.
3. **벤치마크 라벨(FR-004)**: 1차 범위에서는 벤치마크 데이터 미수집 → `comparison_label` 필드는 `null`로 노출, 카드는 수치만 표시 (스펙 Assumptions 허용).
4. **모바일 스냅 스크롤(FR-012)**: 순수 CSS (`scroll-snap-type/align`) + `@media (max-width: 768px)` 한정.
5. **URL 상태(FR-005)**: react-router 쿼리 `?tab=chart|value`. 잘못된 값 → `chart` 폴백, 탭 전환 시 history `push`로 뒤로가기 지원.
6. **세션 보존(FR-010)**: Zustand `detailViewStore`에 symbol 단위 키로 차트 토글 보관, 새로고침 시 초기화 허용.
7. **캐시 전략(FR-008)**: 백엔드 1h TTL 메모리 캐시(기존) + React Query staleTime 60min.

## Phase 1 — Design & Contracts

### Data Model
[data-model.md](./data-model.md) — AssetClass / ValuationSnapshot(응답) / DetailViewState(프론트).

### Contracts
[contracts/company.openapi.yaml](./contracts/company.openapi.yaml) — 기존 `GET /company/{symbol}` 응답에 `asset_class` 필드 추가 (하위 호환). 미지원 자산군이라도 200 응답 + `metrics: null`.

### Quickstart
[quickstart.md](./quickstart.md) — 백엔드 단위 테스트 → 재시작 → curl 검증 → 프론트 빌드/실행 → 4종 시나리오(005930·AAPL·KODEX 200·BTC-USD) → 모바일 스냅·URL 딥링크 검증.

### Agent context update
`.specify/scripts/bash/update-agent-context.sh claude` — 신규 기술 없음 (변경 없을 가능성 높음).

## Constitution Check (Post-Design Re-Eval)

| 게이트 | 결과 |
|--------|------|
| 보호 규칙(`rules/*.md`) 변경 없음 | ✅ |
| 기존 차트 분석 회귀 없음 (1차 탭 = 기존 컴포넌트 래핑) | ✅ |
| 백엔드 응답 하위 호환 (필드 추가만) | ✅ |
| 새 외부 의존성 없음 | ✅ |
| 작업 후 재시작 절차 명문화 | ✅ (quickstart) |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (없음) | — | — |

## Phase 2 Outline (계획만 — `/speckit.tasks`에서 생성)

작업 등급: **M (Medium)**. 예상 작업 그룹:
1. 백엔드 자산군 판정 + 응답 필드 (단위 테스트 포함)
2. 프론트 탭 골격 + URL 동기화 훅
3. 가치 분석 탭 카드 컴포넌트 + 미지원 안내
4. 모바일 스냅 스크롤 CSS + 회귀 검증
5. 통합 검증(시나리오 4종) + 백엔드/프론트 재시작
