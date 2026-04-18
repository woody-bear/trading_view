# Tasks: 020 — 차트 BUY 신호 상승장 조건 + 저점 상승 체크

**Input**: `/specs/020-chart-buy-uptrend-filter/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅

**Organization**: 필수(Must) 3개 + 선택(Should) 1개 요구사항을 user story로 구분, 각각 독립 구현·테스트 가능

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 동시 실행 가능 (다른 파일, 의존성 없음)
- **[Story]**: 해당 user story 레이블 (US1~US4)
- 각 태스크에 정확한 파일 경로 포함

---

## Phase 1: Setup (코드 현황 파악)

**Purpose**: 수정 대상 파일의 현재 구조 확인 — chart_buy 분기 위치, ema 변수명, df 구조

- [X] T001 `backend/services/full_market_scanner.py` 302~320줄 읽기 — `_analyze_ticker()` chart_buy 분기 코드 현황 및 `ema`, `df` 변수 구조 확인

---

## Phase 2: Foundational (테스트 파일 골격 생성)

**Purpose**: 두 신규 함수의 테스트 파일을 먼저 생성해 이후 US1·US2 테스트를 독립 추가할 수 있게 준비

**⚠️ CRITICAL**: 테스트 파일 없이는 US1·US2 테스트 태스크 실행 불가

- [X] T002 `backend/tests/test_uptrend_filter.py` 파일 생성 — import 블록(`pandas`, `numpy`, 두 함수 경로) + 빈 테스트 모듈 골격만 작성

**Checkpoint**: 테스트 파일 존재 확인 → US1·US2 병렬 진행 가능

---

## Phase 3: User Story 1 — EMA20 기울기 조건 (Priority: P1 Must) 🎯 MVP

**Goal**: `_ema20_slope_positive(e20_series, lookback=10) -> bool` 함수 구현 및 검증
**Independent Test**: `pytest backend/tests/test_uptrend_filter.py -k "ema20_slope"` 단독 통과

### Tests for User Story 1

> **NOTE: 테스트를 먼저 작성하고 FAIL 확인 후 구현**

- [X] T003 [P] [US1] `backend/tests/test_uptrend_filter.py`에 `_ema20_slope_positive` 단위 테스트 추가 — 케이스: ①우상향 Series → True, ②우하향 Series → False, ③유효값 10봉 미만 → False, ④lookback 기본값(10) 동작

### Implementation for User Story 1

- [X] T004 [US1] `backend/services/full_market_scanner.py` 모듈 상단(기존 내부 함수들 바로 위)에 `_ema20_slope_positive(e20_series: pd.Series, lookback: int = 10) -> bool` 함수 추가 — `e20_series.iloc[-1] > e20_series.iloc[-lookback]` 비교, 유효값 부족 시 False 반환

**Checkpoint**: `pytest backend/tests/test_uptrend_filter.py -k "ema20_slope"` 전체 통과

---

## Phase 4: User Story 2 — 저점 상승(Higher Lows) 조건 (Priority: P2 Must)

**Goal**: `_check_higher_lows(df, lookback=40, min_swings=2) -> bool` 함수 구현 및 검증
**Independent Test**: `pytest backend/tests/test_uptrend_filter.py -k "higher_lows"` 단독 통과

### Tests for User Story 2

> **NOTE: 테스트를 먼저 작성하고 FAIL 확인 후 구현**

- [X] T005 [P] [US2] `backend/tests/test_uptrend_filter.py`에 `_check_higher_lows` 단위 테스트 추가 — 케이스: ①스윙 저점 2개 상승 → True, ②스윙 저점 2개 하락 → False, ③스윙 저점 1개(부족) → True(필터 패스), ④스윙 저점 0개 → True(필터 패스), ⑤window=2 기준 스윙 저점 정확 탐지

### Implementation for User Story 2

- [X] T006 [US2] `backend/services/full_market_scanner.py`에 `_check_higher_lows(df: pd.DataFrame, lookback: int = 40, min_swings: int = 2) -> bool` 함수 추가 — `df["low"].values` 배열 기반, window=2 스윙 저점 탐색(마지막 2봉 제외), 최근 `lookback`봉 범위, 저점 `min_swings`개 미만 시 True 반환

**Checkpoint**: `pytest backend/tests/test_uptrend_filter.py -k "higher_lows"` 전체 통과

---

## Phase 5: User Story 3 — _analyze_ticker() 통합 수정 (Priority: P3 Must)

**Goal**: `_analyze_ticker()` chart_buy 분기에 두 조건(EMA20 slope + higher lows)을 AND 조건으로 통합
**Independent Test**: 서버 기동 후 `/api/scan/unified` or 스캔 트리거 → chart_buy 결과에서 290080 미포함 확인

### Implementation for User Story 3

- [X] T007 [US3] `backend/services/full_market_scanner.py` `_analyze_ticker()` chart_buy 분기(T001에서 확인한 위치)를 수정 — `pvf` 통과 후 `e20_rising = _ema20_slope_positive(ema["ema_20"], 10)`, `higher_lows = _check_higher_lows(df, 40, 2)` 계산, `e20_rising and higher_lows` 일 때만 chart_buy 추가

**Checkpoint**: `_analyze_ticker()` 로컬 실행 또는 스캔 API 호출로 290080 제외, 정상 상승 종목 포함 확인

---

## Phase 6: User Story 4 — 디버그 로그 (Priority: P4 Should)

**Goal**: chart_buy 필터 통과/탈락 이유를 `logger.debug`로 기록해 파라미터 튜닝 지원
**Independent Test**: `LOG_LEVEL=DEBUG`로 서버 기동 후 스캔 실행 → 각 종목별 EMA slope·higher lows 결과 로그 출력 확인

### Implementation for User Story 4

- [X] T008 [US4] `backend/services/full_market_scanner.py` T007 수정 부분에 `logger.debug` 로그 추가 — 탈락 시 `f"{ticker}: chart_buy 제외 — e20_rising={e20_rising}, higher_lows={higher_lows}"`, 통과 시 `f"{ticker}: chart_buy 통과"` 기록

**Checkpoint**: DEBUG 레벨 로그에서 종목별 필터 결과 출력 확인

---

## Phase 7: Polish & 검증

**Purpose**: 전체 테스트 실행 + 실제 스캔 데이터 기반 290080 제외 최종 확인

- [X] T009 [P] `backend/` 디렉토리에서 `pytest tests/test_uptrend_filter.py -v` 실행 — 전체 테스트 통과 확인
- [X] T010 `backend/tests/verify_290080.py` 검증 스크립트 작성 — yfinance로 290080.KS 1년치 일봉 다운로드, `_ema20_slope_positive`·`_check_higher_lows` 직접 호출해 실제 필터 결과 출력

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 즉시 시작 가능
- **Foundational (Phase 2)**: Phase 1 완료 후 — US1·US2 테스트 작성 전 필요
- **US1 (Phase 3)**: Phase 2 완료 후 — T003(테스트)·T004(구현) 순서 준수
- **US2 (Phase 4)**: Phase 2 완료 후 — Phase 3과 **병렬 가능** (다른 함수, 독립 범위)
- **US3 (Phase 5)**: Phase 3 + Phase 4 **모두 완료** 후 — 두 함수를 모두 호출
- **US4 (Phase 6)**: Phase 5 완료 후 — T007 수정 위치에 로그 추가
- **Polish (Phase 7)**: Phase 6 완료 후

### User Story Dependencies

- **US1 (P1)**: Phase 2 완료 후 독립 시작 가능
- **US2 (P2)**: Phase 2 완료 후 US1과 병렬 시작 가능 (서로 다른 함수)
- **US3 (P3)**: US1 + US2 모두 완료 필요
- **US4 (P4)**: US3 완료 필요 (수정 위치에 로그 삽입)

### Within Each User Story

- 테스트 먼저 작성 → FAIL 확인 → 구현 → PASS 확인
- Phase 3·4는 병렬 처리 가능 (담당자 2명인 경우)

### Parallel Opportunities

- T003(US1 테스트) + T005(US2 테스트): Phase 2 완료 후 병렬 가능
- T004(US1 구현) + T006(US2 구현): 각 테스트 작성 후 병렬 가능
- T009(pytest) + T010(290080 검증): 독립 실행 가능

---

## Parallel Example: US1 + US2 동시 진행

```bash
# Phase 2 완료 후 US1·US2 병렬 작업:
Task A: "T003 — _ema20_slope_positive 테스트 작성 (test_uptrend_filter.py)"
Task B: "T005 — _check_higher_lows 테스트 작성 (test_uptrend_filter.py)"

# 테스트 FAIL 확인 후 병렬 구현:
Task A: "T004 — _ema20_slope_positive 함수 구현 (full_market_scanner.py)"
Task B: "T006 — _check_higher_lows 함수 구현 (full_market_scanner.py)"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3만 완성)

1. Phase 1: `_analyze_ticker()` 코드 현황 파악
2. Phase 2: 테스트 파일 골격 생성
3. Phase 3: `_ema20_slope_positive()` TDD 구현
4. Phase 4: `_check_higher_lows()` TDD 구현 (Phase 3과 병렬 가능)
5. Phase 5: `_analyze_ticker()` 통합 수정
6. **STOP and VALIDATE**: 290080이 chart_buy에서 제외되는지 확인
7. Phase 6: 디버그 로그 추가 (선택)

### 단일 파일 수정 전략

- 수정 파일: `backend/services/full_market_scanner.py` 1개
- 신규 테스트: `backend/tests/test_uptrend_filter.py` 1개
- DB 스키마 변경 없음 → 마이그레이션 불필요
- 서버 재시작만으로 즉시 반영

---

## Notes

- [P] 태스크 = 다른 파일 또는 독립 범위, 동시 실행 가능
- [Story] 레이블로 각 태스크가 어느 요구사항에 해당하는지 추적
- `_check_higher_lows`에서 `.values` 배열 사용 → pandas 인덱스 오프셋 문제 회피 (research.md 참고)
- 스윙 저점 탐색 시 마지막 2봉(`len-2`, `len-1`) 제외 — 미래 봉 확인 불가 (window=2 기준)
- `unified_scanner.py` 적용은 이번 범위 외 → 021 이슈로 분리 (research.md 결정 6 참고)
