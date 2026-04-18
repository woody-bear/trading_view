# Implementation Plan: 020 — 차트 BUY 신호 상승장 조건 + 저점 상승 체크

**Branch**: `020-chart-buy-uptrend-filter` | **Date**: 2026-04-12 | **Spec**: [spec.md](./spec.md)  
**근거**: [상승조건저점체크조건검사.md](../../.claude/docs/상승조건저점체크조건검사.md)

---

## Summary

`chart_buy` 신호 품질 개선. 현재는 EMA 데드크로스 없음 + BUY/SQZ BUY 마커 + 거래량 필터만 적용되어,
추세가 NEUTRAL인 종목도 통과됨(290080 케이스). EMA20 기울기 조건과 저점 상승(higher lows) 조건을
`full_market_scanner.py` 한 파일에만 추가해 chart_buy 신호 품질을 높인다.

---

## Technical Context

**Language/Version**: Python 3.12  
**Primary Dependencies**: pandas, pandas-ta, yfinance (기존 그대로)  
**Storage**: SQLite WAL — `scan_snapshot_item` 테이블 읽기 (스키마 변경 없음)  
**Testing**: pytest (`backend/` 디렉토리)  
**Target Platform**: FastAPI 단일 서버 (로컬 macOS)  
**Project Type**: backend service (분석 로직 추가)  
**Performance Goals**: 기존 스캔 속도 유지 — 함수 추가는 O(n) 루프, n ≤ 250봉
**Constraints**: `SCAN_MIN_CANDLES=60` 유지 (추가 조건 최소 44봉 요건 충족)  
**Scale/Scope**: 단일 파일 수정, 함수 2개 추가, 기존 함수 1개 수정

---

## Constitution Check

프로젝트 constitution 미정의 → CLAUDE.md Critical Rules 기준 적용

| 규칙 | 확인 |
|------|------|
| 스캔 종목 ↔ 조회 종목 동기화 | 해당 없음 (스캔 로직 변경, 종목 추가/제거 없음) |
| DB 스키마 변경 여부 | 없음 (scan_snapshot_item 컬럼 추가 없음) |
| 단일 포트 8000 유지 | 영향 없음 |
| 기존 chart_cache 캐시 구조 | 영향 없음 |

**게이트 통과** ✅

---

## Project Structure

```text
backend/
├── services/
│   └── full_market_scanner.py     ← 핵심 수정 파일
└── tests/
    └── test_uptrend_filter.py     ← 신규 테스트

specs/020-chart-buy-uptrend-filter/
├── spec.md
├── plan.md                        ← 이 파일
├── research.md
└── tasks.md
```

---

## Phase 0: Research

**결과**: `.claude/docs/상승조건저점체크조건검사.md` 에 완료

### 핵심 결정사항

| 결정 | 선택 | 이유 |
|------|------|------|
| 상승 조건 강도 | 옵션 C (신호 유형별 분리) | SQZ BUY는 횡보 해제 신호라 EMA200 정렬 요구 부적합 |
| EMA20 기울기 lookback | 10봉 | 2주치 일봉, 단기 추세 포착에 적합 |
| 스윙 저점 window | 2봉 | 일봉 기준 노이즈/신호 균형 최적 |
| higher lows lookback | 40봉 | 약 2개월, 중기 추세 파악에 적합 |
| 저점 부족 시 처리 | True 반환 (필터 패스) | 신규상장·거래재개 종목 불이익 방지 |
| unified_scanner 적용 | 이번 범위 제외 | 별도 동작 경로, 다음 이슈로 분리 |

---

## Phase 1: 설계

### 1-1. 신규 함수 설계

#### `_ema20_slope_positive(e20_series, lookback=10) -> bool`

```python
"""EMA20 최근 lookback봉이 우상향인지 확인."""
입력: ema_20 pandas Series, lookback 정수
출력: True(기울기 양수) / False
조건: 유효값 부족 시 False 반환
```

#### `_check_higher_lows(df, lookback=40, min_swings=2) -> bool`

```python
"""최근 lookback봉 내 스윙 저점 2개 이상이 상승 추세인지 확인."""
입력: OHLCV DataFrame, lookback 정수, min_swings 정수
출력: True(higher lows 확인 또는 저점 부족) / False
스윙 저점: 앞뒤 2봉보다 낮은 봉의 low값
```

### 1-2. `_analyze_ticker()` 수정 설계

**수정 위치**: `full_market_scanner.py` 302~308줄 (chart_buy 분기)

```
[현재]
buy_signal → pvf 통과 → chart_buy 추가

[수정 후]
buy_signal → pvf 통과
  → e20_rising = _ema20_slope_positive(ema["ema_20"], 10)
  → higher_lows = _check_higher_lows(df, 40, 2)
  → if e20_rising AND higher_lows → chart_buy 추가
  → else → 제외 (debug 로그)
```

**SQZ BUY / 일반 BUY 조건 동일 적용** (신호 유형별 분리는 향후 튜닝 시 고려)

### 1-3. 데이터 흐름

```
yfinance OHLCV (1y, 1d)
  ↓
calculate_ema() → ema_20 Series
  ↓
_ema20_slope_positive(ema_20, lookback=10)
  ↓
_check_higher_lows(df["low"], lookback=40)
  ↓
두 조건 모두 True → chart_buy 카테고리 추가
```

### 1-4. 기대 동작 변화

| 케이스 | 현재 | 수정 후 |
|--------|------|---------|
| 290080 (trend=NEUTRAL, RSI=63.2, SQZ BUY) | ✅ chart_buy | ❌ 제외 예상 |
| 정상 상승 종목 (EMA 우상향 + higher lows) | ✅ chart_buy | ✅ chart_buy 유지 |
| 데이터 부족 (스윙 저점 1개 이하) | ✅ chart_buy | ✅ chart_buy 유지 (필터 패스) |
| EMA20 하락 중이나 BUY 신호 발생 | ✅ chart_buy | ❌ 제외 |

---

## Phase 2: 작업 태스크

> `/speckit.tasks` 로 tasks.md 생성 예정

### 태스크 목록 (초안)

```
T1. _ema20_slope_positive() 함수 작성 + 단위 테스트
T2. _check_higher_lows() 함수 작성 + 단위 테스트
T3. _analyze_ticker() chart_buy 분기 조건 수정
T4. debug 로그 추가
T5. 290080 케이스 실제 검증 스크립트 작성
T6. 서버 재시작 + 스캔 결과 확인
```

---

## 리스크 및 주의사항

| 리스크 | 대응 |
|--------|------|
| chart_buy 개수가 너무 줄어들 수 있음 | 290080 외 다른 정상 종목이 제외되는지 실제 스캔으로 검증 필요 |
| higher_lows 파라미터 과도한 엄격성 | min_swings=2 / lookback=40 → 부족 시 True로 패스하므로 안전 |
| unified_scanner 미적용으로 불일치 | 이번 범위 아님. 별도 이슈(021)로 추적 권장 |
