# Implementation Plan: BUY 차트 라벨 클릭 — 사례 스크랩 추가

**Branch**: `010-chart-buy-scrap` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)

## Summary

차트 BUY 마커 위에 마우스를 올리면 DOM 오버레이 저장 버튼이 표시되고, 클릭 시 서버에서 해당 날짜 지표값을 조회하여 PatternCase(스크랩)로 저장한다. 기존 Scrap.tsx 페이지를 스펙에 맞게 개선한다(인라인 메모 자동저장, 인라인 삭제 확인, 출처 뱃지, 차트 보기 버튼).

**핵심 전략**: 기존 `IndicatorChart.tsx`의 `subscribeCrosshairMove`·`subscribeClick`을 확장하여 오버레이 추가. 기존 `pattern_cases.py` CRUD에 source/user_id 필드와 신규 엔드포인트 추가. 기존 `Scrap.tsx` 컴포넌트를 스펙 요구사항에 맞게 재구성.

---

## Technical Context

**Language/Version**: Python 3.12 (backend) + TypeScript 5.x / React 18 (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0 async, Alembic / React 18, lightweight-charts v5, React Query, Tailwind CSS, Zustand
**Storage**: SQLite WAL (aiosqlite) — `pattern_case` 테이블 컬럼 2개 추가 (source, user_id)
**Testing**: pytest (backend) + vitest/pnpm test (frontend)
**Target Platform**: Web (localhost:3000 → :8000 단일 포트)
**Project Type**: Web application (backend API + frontend SPA)
**Performance Goals**: SC-001 저장 버튼 0.3초 이내 표시, SC-002 저장 후 3초 이내 목록 반영
**Constraints**: Docker 미사용, 단일 SQLite 파일, 단일 포트 8000

---

## Constitution Check

Constitution 파일이 템플릿 상태(미작성). 프로젝트 내재 원칙으로 평가:

| 원칙 | 상태 | 비고 |
|------|------|------|
| 기존 구조 확장 (신규 파일 최소화) | ✅ | 기존 파일 수정 위주, 신규: 마이그레이션 1개 + API 1개 |
| SQLite 단일 DB | ✅ | 기존 pattern_case 테이블 컬럼 추가만 |
| 단일 포트 (FastAPI StaticFiles) | ✅ | 변경 없음 |
| 인증: Supabase JWT | ✅ | 기존 watchlist 패턴 동일하게 적용 |
| 복잡성 최소화 | ✅ | 집계 뷰 없음, 수동 패턴 학습 |

**Gate 통과. 위반 없음.**

---

## Project Structure

### Documentation (this feature)

```text
specs/010-chart-buy-scrap/
├── plan.md              ← 이 파일
├── research.md          ← Phase 0 완료
├── data-model.md        ← Phase 1 완료
├── contracts/
│   └── api.md           ← Phase 1 완료
└── tasks.md             ← /speckit.tasks 명령어로 생성
```

### Source Code (변경 파일)

```text
backend/
├── models.py                                     # PatternCase: source + user_id 컬럼 추가
├── routes/
│   ├── pattern_cases.py                          # source/user_id 추가, /check 엔드포인트, 중복 체크
│   └── quick_chart.py                            # /api/chart/indicators-at 엔드포인트 추가
└── alembic/versions/
    └── 016_add_source_user_id_pattern_case.py    # 신규 마이그레이션

frontend/src/
├── components/charts/
│   └── IndicatorChart.tsx                        # 호버 오버레이 + scrapedDates prop + onScrapSave
├── pages/
│   ├── SignalDetail.tsx                          # scrapedDates 조회, onScrapSave 핸들러
│   └── Scrap.tsx                                 # 인라인 메모, 인라인 삭제, 출처 뱃지, 차트 보기
└── api/
    └── client.ts                                 # indicators-at, pattern-cases/check API 함수 추가
```

---

## Phase 0: Research 완료

→ [research.md](./research.md) 참조

**해결된 NEEDS CLARIFICATION:**

| 항목 | 결정 |
|------|------|
| 호버 오버레이 구현 방식 | `subscribeCrosshairMove` + `timeToCoordinate`로 DOM div 절대 위치 |
| 지표값 조회 방식 | 신규 `GET /api/chart/indicators-at` 엔드포인트 |
| 중복 방지 | DB unique constraint + `GET /api/pattern-cases/check` |
| user_id 스코핑 | PatternCase에 user_id 컬럼 추가, Supabase JWT 인증 |
| source 구분 | 별도 `source` 컬럼 (`chart` / `manual`) |
| 메모 자동저장 | React debounce 1.5s + PATCH notes 필드 |

---

## Phase 1: Design 완료

### 1. 데이터 모델 변경

→ [data-model.md](./data-model.md) 참조

**PatternCase 테이블 변경 요약**:
- `source VARCHAR(20)` 추가 (default `'manual'`)
- `user_id UUID` 추가 (nullable, 기존 데이터 호환)
- UNIQUE constraint: `(user_id, symbol, signal_date)`
- INDEX: `idx_pattern_case_user`

### 2. API 계약

→ [contracts/api.md](./contracts/api.md) 참조

**신규 엔드포인트 요약**:
- `GET /api/pattern-cases/check?symbol=&signal_date=` — 중복 확인
- `GET /api/chart/indicators-at?symbol=&market=&date=` — 특정 날짜 지표값

**수정 엔드포인트**:
- `GET /api/pattern-cases` — user_id 필터 추가
- `POST /api/pattern-cases` — source 필드 추가, 중복 시 409

### 3. 프론트엔드 컴포넌트 설계

**IndicatorChart.tsx 오버레이 흐름**:
```
subscribeCrosshairMove(param)
  ├── param.time === BUY 마커 time
  │   ├── timeToCoordinate(time) → x
  │   ├── priceToCoordinate(close) → y
  │   ├── 가장자리 보정 (x < 80 → 오른쪽, x > width-80 → 왼쪽)
  │   └── setOverlay({ visible: true, x, y, time, isScraped })
  └── param.time !== BUY 마커 time
      └── setOverlay({ visible: false })

오버레이 버튼 클릭 → onScrapSave(markerTime, date) 콜백
```

**Scrap.tsx CaseAccordion 변경**:
```
[헤더] 패턴뱃지 | 제목 · 종목 · 날짜 | 진행중/수익률 | 태그들 | 출처뱃지 | ▼
[바디]
  IndicatorTable (기존 유지)
  [textarea placeholder="매수 이유, 패턴 특징..."] — 1.5s debounce 자동저장
  저장 상태: "저장 중..." / "저장됨" (3초 후 사라짐)
  [차트 보기 버튼] [삭제 버튼]
    └── 삭제 확인: "정말 삭제하시겠습니까? [확인] [취소]"
```

---

## 구현 순서 및 의존성

```
[US0] 기반 작업 (필수 선행)
  T001: DB 마이그레이션 (source + user_id 컬럼)
  T002: models.py PatternCase 클래스 업데이트
  T003: pattern_cases.py — source/user_id + /check 엔드포인트
  T004: quick_chart.py — /api/chart/indicators-at 엔드포인트
  T005: client.ts — 신규 API 함수

[US1] 차트 BUY 라벨 호버 → 저장 (P1, 의존: T001~T005)
  T006: IndicatorChart.tsx — scrapedDates prop + 스크랩됨 마커 색상
  T007: IndicatorChart.tsx — 호버 오버레이 (subscribeCrosshairMove 확장)
  T008: SignalDetail.tsx — scrapedDates 조회 + onScrapSave 핸들러

[US2] 스크랩 목록 조회 및 삭제 (P2, 의존: T001~T003)
  T009: Scrap.tsx — PatternCase 타입 source 필드 추가
  T010: Scrap.tsx — CaseAccordion 헤더 출처 뱃지 추가
  T011: Scrap.tsx — 인라인 삭제 확인 UI (window.confirm 제거)
  T012: Scrap.tsx — "차트 보기" 버튼 추가

[US3] 사례 메모 추가 (P3, 의존: T009)
  T013: Scrap.tsx — 인라인 textarea + debounce 자동저장 (모달 폼 제거)
```

---

## 주요 기술 결정 기록

| 결정 | 이유 |
|------|------|
| PatternCase.source 필드 추가 (pattern_type 재사용 안 함) | pattern_type은 신호 유형, source는 입력 경로 — 개념이 다름 |
| 마이그레이션으로 user_id nullable 추가 | 기존 데이터 유지, 점진적 적용 |
| 오버레이를 차트 컨테이너 div에 absolute 배치 | lightweight-charts 내부 DOM 접근 불가, 외부 레이어가 유일한 방법 |
| /api/chart/indicators-at 신규 엔드포인트 | chart_cache 재활용으로 yfinance 재호출 불필요 |
| Scrap.tsx 모달 폼 유지, notes만 인라인 전환 | title/symbol/price 등 기타 필드는 기존 모달 유지, notes만 인라인으로 UX 개선 |

---

## 복잡성 추적

위반 없음 — Constitution Check 통과.
