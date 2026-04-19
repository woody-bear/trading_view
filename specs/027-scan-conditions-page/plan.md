# Implementation Plan: 조회조건 페이지

**Branch**: `027-scan-conditions-page` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/027-scan-conditions-page/spec.md`

## Summary

차트 라벨(BUY/SQZ BUY/SELL) 발생 기준과 메인페이지 추천종목·눌림목 스냅샷 생성 파이프라인을 사용자에게 공개하는 신규 페이지 `ScanConditions.tsx`를 추가한다. 페이지는 **반응형 이원화** 방식으로 표현된다:

- **PC (≥768px)**: (a) 매수 통합 BUY 파이프라인 Mermaid 플로우차트 + (b) SELL 별도 Mermaid 플로우차트
- **모바일 (<768px)**: Mermaid 도표를 **렌더링하지 않고**, 동일 정보를 단계별 조건표(table/카드 리스트)로 제공

두 표현 방식은 `conditions.ts`의 단일 **Step 데이터 소스**에서 파생된다 — 의미적 일관성을 보장하면서 PC는 Mermaid DSL로, 모바일은 React 컴포넌트로 렌더링한다. 동시에 조건 정의 로직을 프론트엔드(`conditions.ts`)와 백엔드(`scan_conditions.py`) 양쪽에 단일 소스로 모듈화하여 유지보수성을 확보한다.

## Technical Context

**Language/Version**: TypeScript 5 / React 18 (frontend), Python 3.11 (backend)  
**Primary Dependencies**:  
- 프론트: React Router 7.13, lucide-react, Tailwind CSS, **mermaid (신규, 동적 import · PC 전용 로드)**  
- 백엔드: FastAPI, pandas, pandas_ta_classic (기존)  

**Storage**: 본 기능은 신규 테이블·DB 변경 없음. 정적 콘텐츠 페이지 + 백엔드 함수 재구성.  
**Testing**: 프론트는 수동 검증(브라우저, PC + 모바일 에뮬레이션). 백엔드는 기존 스캔 결과 회귀 테스트(리팩토링 전후 동일 결과 확인).  
**Target Platform**: 웹 SPA (PC + 모바일 반응형). 백엔드가 `frontend/dist/`를 SPA로 직접 서빙.  
**Project Type**: Web application (frontend + backend)  
**Performance Goals**:
- 페이지 로드 1초 이내 (SC-001)
- 모바일: Mermaid 번들 로드 **생략**하여 모바일 사용자 비용 절감
- PC: Mermaid 청크는 동적 import로 코드 스플리팅

**Constraints**:
- PC↔모바일 분기 기준: Tailwind `md` breakpoint = 768px
- 모바일 조건표: 가로 스크롤 없이 세로 스크롤만으로 전체 확인 가능
- 백엔드 리팩토링 시 기존 스캔 결과와 100% 동일한 결과 보장
- 프론트엔드/백엔드 모듈은 직접 연동하지 않음(각자 단일 소스 유지)

**Scale/Scope**: 신규 페이지 1개, 신규 모듈 2개(프론트 조건 상수 + 백엔드 조건 모듈), 신규 컴포넌트 3개(FlowchartView PC 전용, ConditionStepTable 모바일 전용, ConditionsLayout), 기존 파일 수정 3~4개(라우트/네비/스캐너).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 적용 검토 | 결과 |
|------|----------|------|
| 1. 이해 먼저, 코딩 다음 | spec → clarify(4회) → plan 순으로 진행. 관련 파일 사전 조사 완료. | ✅ Pass |
| 2. 작은 단위로 쪼개고 검증 | 작업을 (a) 백엔드 모듈 추출 → (b) 프론트 조건 상수 → (c) PC 도표 컴포넌트 → (d) 모바일 조건표 컴포넌트 → (e) 페이지 통합 → (f) 라우트/탭 등록 6단계로 분리. | ✅ Pass |
| 3. 기존 코드 존중 | 백엔드 리팩토링은 함수 추출 + 위임 호출만. 기존 동작 변경 없음. SC-007 회귀 검증 명시. | ✅ Pass |
| 4. 모든 결정에는 이유가 있다 | clarify 세션 4건 근거 기록. 라이브러리 선정·모바일 전략 근거는 research.md. | ✅ Pass |
| 5. 사용자 의도 우선 | 통합 파이프라인 구조(Q3)·모바일 도표 제외(Q4) 모두 사용자 직접 결정. | ✅ Pass |

| 코딩 규칙 | 검토 |
|-----------|------|
| R-03 매직 넘버 금지 | 모든 임계값(RSI 30/35/40, 쿨다운 5, 신호 탐색 20, 반응형 breakpoint 768px 등)을 상수로. ✅ |
| R-08 타입 힌트 | TypeScript 인터페이스(Step, StepKind, FlowchartViewProps, ConditionStepTableProps) + Python type hints 모두 정의. ✅ |
| FE-01 단일 책임 | `ScanConditions.tsx` 페이지, `FlowchartView.tsx` PC 도표, `ConditionStepTable.tsx` 모바일 조건표로 3개 분리. ✅ |
| FE-04 하드코딩 금지 | 신규 API 추가 없음. ✅ |
| FE-05 에러/로딩/빈 상태 | PC mermaid 로드 loading/ready/error 처리. 모바일 조건표는 정적 데이터이므로 로딩 상태 없음 (빈 배열 방어만). ✅ |
| PY-01 async 기본 | 백엔드 추출 함수는 순수 동기 함수(기존 동일, I/O 없음). ✅ |
| SR-01~SR-06 서버 재시작 | tasks 마지막 단계로 포함. ✅ |

**판정**: 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/027-scan-conditions-page/
├── plan.md                  # 본 파일 (/speckit.plan 출력)
├── spec.md                  # 사용자 요구 + clarify 4회 결과
├── research.md              # Phase 0 출력 — 라이브러리·모바일 전략 근거
├── data-model.md            # Phase 1 출력 — Step entity + 모바일 조건표 데이터 구조
├── quickstart.md            # Phase 1 출력 — PC/모바일 수동 검증 절차
├── contracts/
│   └── ui-contract.md       # PC 도표 + 모바일 조건표 UI 계약
├── checklists/
│   └── requirements.md      # spec 체크리스트
└── tasks.md                 # /speckit.tasks 출력 (이 명령에서는 생성 안 함, 기존 tasks.md는 별도 재생성 필요)
```

### Source Code (repository root)

```text
backend/
├── services/
│   ├── full_market_scanner.py        # [수정] scan_conditions에서 import 후 호출로 교체
│   └── scan_conditions.py            # [신규] 조건 상수 + 필터 함수 단일 소스
└── routes/
    └── charts.py                     # [참조] _simulate_signals — 변경 없음

frontend/
├── package.json                      # [수정] mermaid 의존성 추가 (동적 import)
├── src/
│   ├── App.tsx                       # [수정] /conditions 라우트 + PC TopNav 항목 추가
│   ├── components/
│   │   ├── BottomNav.tsx             # [수정] '조회조건' 탭 추가
│   │   └── conditions/
│   │       ├── FlowchartView.tsx     # [신규] PC 전용 — mermaid 동적 import + SVG 렌더
│   │       ├── ConditionStepTable.tsx# [신규] 모바일 전용 — Step[] 데이터를 table/카드 리스트로 렌더
│   │       └── ConditionsSection.tsx # [신규] PC ↔ 모바일 분기 래퍼 (Tailwind `hidden md:block` / `md:hidden`)
│   ├── constants/                    # [신규 디렉토리]
│   │   └── conditions.ts             # [신규] Step[] 데이터 + PC용 Mermaid DSL + 상수 객체
│   └── pages/
│       └── ScanConditions.tsx        # [신규] 조회조건 페이지 (매수 + SELL 두 섹션)
└── dist/                             # 빌드 산출물 (재빌드 필요)
```

**Structure Decision**:

1. **프론트엔드 반응형 분리**: `ConditionsSection.tsx` 래퍼가 Tailwind `hidden md:block`과 `md:hidden` 클래스로 PC↔모바일 분기. 모바일 분기에서는 `FlowchartView` 자체가 마운트되지 않아 mermaid 라이브러리 로드도 발생하지 않음.
2. **단일 데이터 소스 (Step[])**: `conditions.ts`에 `buyPipelineSteps: Step[]`과 `sellFlowchartSteps: Step[]`을 정의하고, 이 데이터를 (a) Mermaid DSL 문자열로 프로그래매틱 변환(PC용) (b) `ConditionStepTable`이 직접 렌더(모바일용) 양쪽에서 사용.
3. **백엔드 단일 모듈**: `scan_conditions.py` 한 파일에 조건 상수 + 필터 함수를 통합.
4. **신규 백엔드 API 없음**.

## Complexity Tracking

> Constitution Check 위반 없음.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (없음) | — | — |
