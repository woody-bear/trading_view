# Tasks: 차트 BUY 스캔 거래량 필터 추가

**Feature**: `017-buy-scan-volume-filter`
**Spec**: specs/017-buy-scan-volume-filter/spec.md
**Plan**: specs/017-buy-scan-volume-filter/plan.md
**Total Tasks**: 5
**Generated**: 2026-04-07 (리셋 — 이전 구현 리버트됨)

---

## Phase 1: Setup

_없음 — 기존 파이프라인에 조건 추가, 새 파일/의존성 없음_

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: `_passes_volume_filter()` 헬퍼 정의 — US1 두 파일 모두 의존

**⚠️ CRITICAL**: T001 완료 전 US1 작업 불가

- [x] T001 `_passes_volume_filter(df, buy_date)` 헬퍼를 `backend/services/full_market_scanner.py`의 `_is_dead_cross()` 아래에 추가

  ```python
  def _passes_volume_filter(df: pd.DataFrame, buy_date: str) -> bool:
      """BUY 신호 발생일 거래량이 직전 5거래일 평균보다 높은지 확인.
      데이터 부족(신규상장, 거래정지 후 재개, 거래량 0) 시 True 반환(건너뜀).
      """
      from datetime import datetime as dt
      signal_date = dt.strptime(buy_date, "%Y-%m-%d").date()
      matching = [i for i, idx in enumerate(df.index) if idx.date() == signal_date]
      if not matching:
          return True
      signal_idx = matching[0]
      if signal_idx < 1:
          return True
      prior = df["volume"].iloc[max(0, signal_idx - 5):signal_idx]
      prior_nonzero = prior[prior > 0]
      if len(prior_nonzero) < 1:
          return True
      avg_vol = float(prior_nonzero.mean())
      signal_vol = float(df["volume"].iloc[signal_idx])
      if signal_vol == 0:
          return True
      return signal_vol > avg_vol
  ```

**Checkpoint**: 헬퍼 정의 완료 → US1 구현 시작 가능

---

## Phase 3: User Story 1 — 거래량 동반 BUY 신호만 스캔 결과에 포함 (Priority: P1) 🎯 MVP

**Goal**: 거래량 미달 BUY 신호가 스캔 결과 및 텔레그램 알림에 0건 포함됨

**Independent Test**: `scan_simulation.py` 실행 시 "★ 통과" 목록에 거래량비율 < 1.0인 종목이 없으면 합격

### Implementation for User Story 1

- [x] T002 [US1] `backend/services/full_market_scanner.py`의 `_analyze_ticker()` 내 BUY 신호 판정 블록(line ~267–269) 수정

  ```python
  # 변경 전
  buy_signal, buy_date = _check_buy_signal_precise(df, last_rsi, last_sq)
  if buy_signal:
      categories.append("chart_buy")

  # 변경 후
  buy_signal, buy_date = _check_buy_signal_precise(df, last_rsi, last_sq)
  if buy_signal and _passes_volume_filter(df, buy_date):
      categories.append("chart_buy")
  ```

- [x] T003 [P] [US1] `backend/services/chart_scanner.py`의 `scan_latest_buy()` 내 3일 이내 신호 확인 직후(line ~101), `results.append(...)` 직전에 거래량 필터 추가

  ```python
  # 3일 이내 체크 후 추가:
  from services.full_market_scanner import _passes_volume_filter
  buy_date_str = signal_dt.strftime("%Y-%m-%d")
  if not _passes_volume_filter(df, buy_date_str):
      continue
  ```

**Checkpoint**: 백엔드 필터 완성. `scan_simulation.py` 재실행으로 검증.

---

## Phase 4: User Story 2 — 스캔 결과 화면에 거래량 조건 표기 (Priority: P2)

**Goal**: 차트 BUY 섹션 배지/설명에 "거래량 5일 평균 이상" 조건 명시

**Independent Test**: BuyList 페이지의 차트 BUY 신호 섹션에서 거래량 조건 문구 확인

### Implementation for User Story 2

- [x] T004 [P] [US2] `frontend/src/pages/BuyList.tsx`의 차트 BUY 신호 섹션 조건 배지/텍스트에 "거래량 5일 평균 이상" 또는 "거래량↑(5일)" 문구 추가

**Checkpoint**: 프론트엔드 조건 표기 완료

---

## Phase 5: Polish

- [x] T005 `backend/scan_simulation.py` 삭제 (임시 시뮬레이션 파일, 프로덕션 불필요)

---

## Dependencies & Execution Order

```
T001 (Foundational)
  ├── T002 [US1] full_market_scanner.py
  └── T003 [US1] chart_scanner.py    ← T002와 병렬 가능 (다른 파일)

T004 [US2] BuyList.tsx               ← T001과 무관, T002/T003과 병렬 가능

T005 (Polish)                        ← 모두 완료 후
```

### Parallel Opportunities

- T002 + T003: T001 완료 후 동시 실행 가능 (서로 다른 파일)
- T004: T001~T003과 무관하게 동시 실행 가능 (프론트엔드 파일)

---

## Implementation Strategy

### MVP

1. **T001** — 헬퍼 함수 추가
2. **T002 + T003** — 백엔드 두 스캐너에 필터 적용 (병렬)
3. **검증** — `python scan_simulation.py` 재실행: 거래량 미충족 종목이 "★" 목록에 없어야 함
4. **T004** — 프론트엔드 배지 업데이트
5. **T005** — 임시 파일 정리
