# Implementation Plan: 차트 BUY 스캔 거래량 필터 추가

**Branch**: `017-buy-scan-volume-filter` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)

## Summary

차트 BUY 신호 스캔(full_market_scanner + chart_scanner)에 거래량 필터를 추가한다. BUY 신호 발생일 거래량이 직전 5거래일 평균을 초과하는 종목만 결과에 포함시키며, 데이터 부족 시 필터를 건너뛴다. 프론트엔드 조건 표기(BuyList.tsx)도 업데이트한다. 총 변경 파일: 3개.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5.x / React 18 (frontend)
**Primary Dependencies**: pandas (데이터 처리), yfinance (OHLCV 데이터), FastAPI (기존), React Query / Tailwind CSS (기존)
**Storage**: SQLite WAL (aiosqlite) — `scan_snapshot_item` 테이블 읽기 전용 (스키마 변경 없음)
**Testing**: 수동 검증 (시뮬레이션 완료 — scan_simulation.py 사용)
**Target Platform**: Linux/macOS 서버 단일 프로세스 (Docker 없음)
**Project Type**: 단일 FastAPI 서비스 (웹 서비스 + 스케줄러 통합)
**Performance Goals**: 거래량 필터 추가로 인한 스캔 소요시간 증가 < 10% (pandas 슬라이싱이므로 사실상 0 overhead)
**Constraints**: 기존 dead-cross 필터 → 거래량 필터 → BUY 신호 판정 순서 유지
**Scale/Scope**: 1,543종목 스캔 (국내 502 + 미국 1,041)

## Constitution Check

Constitution 파일이 템플릿 상태 (프로젝트별 원칙 미정의). 기본 검토:

- **단순성 원칙**: 헬퍼 함수 1개 추가 + 호출 지점 2곳 수정. 최소 변경 범위. ✅
- **DB 스키마 변경 없음**: `scan_snapshot_item` 테이블 구조 그대로. ✅
- **기존 파이프라인 순서 유지**: dead-cross → (NEW) 거래량 필터 → BUY 신호. ✅
- **Gate**: 위반 없음 — Complexity Tracking 불필요.

## Project Structure

### Documentation (this feature)

```text
specs/017-buy-scan-volume-filter/
├── plan.md              ← 이 파일
├── research.md          ← Phase 0 output
├── data-model.md        ← N/A (DB 스키마 변경 없음)
└── tasks.md             ← /speckit.tasks 출력
```

### Source Code (변경 대상 파일)

```text
backend/
├── services/
│   ├── full_market_scanner.py   ← _passes_volume_filter() 정의 + _check_buy_signal_precise() 호출
│   └── chart_scanner.py         ← scan_latest_buy() 내 거래량 필터 적용
frontend/
└── src/
    └── pages/
        └── BuyList.tsx          ← 조건 배지 텍스트 업데이트 (거래량 5일 평균 이상)
```

**Structure Decision**: 기존 Option 2 (Backend + Frontend 분리) 구조 유지. 신규 파일 없음.

---

## Phase 0: Research

### 결정사항

**Decision**: `_passes_volume_filter(df, signal_idx)` 헬퍼를 `full_market_scanner.py`에 정의하고 `chart_scanner.py`에서 import하여 재사용한다.

**Rationale**: 두 스캐너가 공통으로 사용하는 로직이므로 DRY 원칙 적용. full_market_scanner가 더 무거운 파일이지만, chart_scanner가 이미 `_calc_all`, `_simulate_signals`를 `routes/charts.py`에서 import하는 패턴을 따름.

**Alternatives considered**:
- `chart_scanner.py`에 정의하고 `full_market_scanner.py`가 import → 의존 방향이 역전됨 (부적절)
- 별도 `services/volume_filter.py` 파일 → 단일 함수에 파일 하나는 과도한 분리

---

**Decision**: 신호 인덱스 탐색은 `df.index`의 날짜와 `signal_date` 문자열 비교로 처리한다.

**Rationale**: yfinance 반환 DataFrame의 index는 `DatetimeTZAware` 타입이므로 `.date()` 메서드로 Python `date` 객체 변환 후 비교. 시뮬레이션(scan_simulation.py)에서 검증 완료.

**Code pattern**:
```python
signal_date = datetime.strptime(buy_date, "%Y-%m-%d").date()
matching = [i for i, idx in enumerate(df.index) if idx.date() == signal_date]
signal_idx = matching[0] if matching else len(df) - 1
```

---

**Decision**: 거래량 필터 통과 조건 — `signal_vol > avg_vol` (엄격한 초과, `>=` 아님).

**Rationale**: 평균과 동일한 거래량은 "평균보다 높은" 조건을 충족하지 못한다는 사용자 의도에 맞음. 시뮬레이션에서 0.96x → 미충족, 1.07x / 1.86x → 충족 결과 확인.

---

**Decision**: 데이터 부족(5거래일 미만 이력, 거래량 0, 데이터 없음) 시 `True` 반환 (필터 건너뜀).

**Rationale**: 신규상장 · 거래정지 후 재개 종목에서 오류로 제외되는 것을 방지. spec FR-004, Edge Cases 요구사항과 일치.

---

**Decision**: `full_market_scanner._check_buy_signal_precise()`에서 BUY 신호 확인 후, 동일 df에서 signal_idx를 계산하여 `_passes_volume_filter()` 호출.

**Rationale**: `_check_buy_signal_precise`가 이미 `buy_date` 문자열을 반환하므로, 이를 이용해 df에서 인덱스 탐색. df 재다운로드 불필요.

**Integration point**:
```python
# full_market_scanner.py _analyze_ticker() 내부
buy_signal, buy_date = _check_buy_signal_precise(df, last_rsi, last_sq)
if buy_signal:
    if _passes_volume_filter(df, buy_date):  # NEW
        categories.append("chart_buy")
```

---

**Decision**: `chart_scanner.scan_latest_buy()` 내 BUY 신호 확인 후 거래량 필터 적용.

**Integration point**:
```python
# chart_scanner.py scan_latest_buy() 내부
if last["text"] not in ("BUY", "SQZ BUY"):
    continue
signal_dt = datetime.utcfromtimestamp(last["time"])
if (datetime.utcnow() - signal_dt) > timedelta(days=3):
    continue

# NEW: 거래량 필터
if not _passes_volume_filter_by_date(df, signal_dt.date()):
    continue
```

---

### 검증된 시뮬레이션 결과 (2026-04-07)

1,543종목 스캔 결과:
- BUY 신호 (3일이내): 14개
- 거래량 필터 통과: **2개**
  - HOLX (Hologic) — S&P500, 거래량비율 18.57x
  - KBSTAR 단기채권 ETF (272560) — 국내ETF, 거래량비율 1.86x

---

## Phase 1: Design

### 헬퍼 함수 시그니처

```python
# backend/services/full_market_scanner.py 에 추가

def _passes_volume_filter(df: pd.DataFrame, buy_date: str) -> bool:
    """BUY 신호 발생일 거래량이 직전 5거래일 평균보다 높은지 확인.

    Args:
        df: OHLCV DataFrame (index: DatetimeTZAware, columns: open/high/low/close/volume)
        buy_date: BUY 신호 발생일 문자열 (YYYY-MM-DD)

    Returns:
        True  — 필터 통과 (거래량 충족, 또는 데이터 부족으로 건너뜀)
        False — 필터 미통과 (거래량 미달)
    """
    from datetime import datetime as dt
    signal_date = dt.strptime(buy_date, "%Y-%m-%d").date()
    matching = [i for i, idx in enumerate(df.index) if idx.date() == signal_date]
    if not matching:
        return True  # 날짜 찾지 못함 → 건너뜀

    signal_idx = matching[0]
    if signal_idx < 1:
        return True  # 이전 거래일 없음 → 건너뜀

    prior = df["volume"].iloc[max(0, signal_idx - 5):signal_idx]
    prior_nonzero = prior[prior > 0]
    if len(prior_nonzero) < 1:
        return True  # 이전 거래량 데이터 없음 → 건너뜀

    avg_vol = float(prior_nonzero.mean())
    signal_vol = float(df["volume"].iloc[signal_idx])
    if signal_vol == 0:
        return True  # 신호일 거래량 0 → 건너뜀

    return signal_vol > avg_vol
```

### 적용 위치

#### 1. `full_market_scanner.py` — `_analyze_ticker()` 수정

```python
# 변경 전 (line ~267-269):
buy_signal, buy_date = _check_buy_signal_precise(df, last_rsi, last_sq)
if buy_signal:
    categories.append("chart_buy")

# 변경 후:
buy_signal, buy_date = _check_buy_signal_precise(df, last_rsi, last_sq)
if buy_signal and _passes_volume_filter(df, buy_date):
    categories.append("chart_buy")
```

#### 2. `chart_scanner.py` — `scan_latest_buy()` 수정

```python
# 변경 전 (line ~96-101):
last = markers[-1]
if last["text"] not in ("BUY", "SQZ BUY"):
    continue
signal_dt = datetime.utcfromtimestamp(last["time"])
if (datetime.utcnow() - signal_dt) > timedelta(days=3):
    continue
# → results.append(...)

# 변경 후:
last = markers[-1]
if last["text"] not in ("BUY", "SQZ BUY"):
    continue
signal_dt = datetime.utcfromtimestamp(last["time"])
if (datetime.utcnow() - signal_dt) > timedelta(days=3):
    continue

from services.full_market_scanner import _passes_volume_filter
buy_date_str = signal_dt.strftime("%Y-%m-%d")
if not _passes_volume_filter(df, buy_date_str):
    continue
# → results.append(...)
```

#### 3. `BuyList.tsx` — 조건 배지 텍스트 수정

```tsx
// 차트 BUY 신호 섹션의 조건 배지:
// 변경 전: "최근 BUY 신호" 또는 유사 텍스트
// 변경 후: "BUY 신호 + 거래량 5일 평균 이상"
```

### data-model.md

해당 없음 — DB 스키마 변경 없음. `scan_snapshot_item.category = 'chart_buy'` 그대로 사용.

### contracts/

해당 없음 — API 응답 구조 변경 없음. 필터링 조건만 추가되므로 기존 `chart_buy.items[]` 배열 스키마 동일.

---

## Constitution Check (Post-Design)

- 변경 파일: 3개 (full_market_scanner.py, chart_scanner.py, BuyList.tsx)
- 신규 파일: 0개
- DB 마이그레이션: 없음
- API 계약 변경: 없음
- 순환 import 없음 (`chart_scanner` → `full_market_scanner._passes_volume_filter`: 단방향)
- 성능: pandas `iloc` 슬라이싱 5개 행 — 무시할 수 있는 오버헤드

**최종 판정: 모든 Gate 통과** ✅
