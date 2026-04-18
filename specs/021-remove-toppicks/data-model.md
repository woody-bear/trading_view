# Data Model: 추천종목(TopPicks) 기능 완전 삭제

**Branch**: `021-remove-toppicks` | **Date**: 2026-04-12

## 삭제 대상 엔티티

### DailyTopPick (daily_top_pick 테이블) — 삭제

| 컬럼 | 타입 | 설명 |
|------|------|------|
| scan_date | String | 스캔 날짜 (YYYY-MM-DD), PK 구성 |
| market_type | String | KOSPI / KOSDAQ / US, PK 구성 |
| rank | Integer | 시장별 순위 (1, 2, 3) |
| symbol | String | 종목 심볼 |
| name | String | 종목명 |
| price | Float | 현재가 |
| change_pct | Float | 변화율 |
| signal_state | String | 항상 "SQUEEZE" |
| confidence | Float | 신뢰도 점수 |
| grade | String | 등급 (SQ Lv1 등) |
| rsi | Float | RSI 지표 |
| bb_pct_b | Float | Bollinger Band %B |
| squeeze_level | Integer | 스퀴즈 레벨 |
| macd_hist | Float | MACD Histogram |
| volume_ratio | Float | 거래량 비율 |
| created_at | DateTime | 레코드 생성 시간 |

**삭제 방법**: Alembic migration으로 `DROP TABLE daily_top_pick`

---

## 부분 변경 대상 엔티티

### ScanSnapshotItem (scan_snapshot_item 테이블) — 구조 유지, 데이터 생성 중단

| category 값 | 현재 상태 | 변경 후 |
|------------|---------|--------|
| `picks` | full_market_scanner.py에서 생성 | 신규 생성 중단 (기존 데이터 유지) |
| `chart_buy` | 유지 | 변경 없음 |
| `overheat` | 유지 | 변경 없음 |
| `max_sq` | 유지 | 변경 없음 |

**테이블 스키마 변경 없음** — `category="picks"` 분류 코드만 제거

---

## 유지 엔티티 (영향 없음)

| 테이블 | 상태 |
|--------|------|
| watchlist | 변경 없음 |
| current_signal | 변경 없음 |
| signal_history | 변경 없음 |
| alert_log | 변경 없음 |
| ohlcv_cache | 변경 없음 |
| chart_cache | 변경 없음 |
| stock_master | 변경 없음 |
| scan_snapshot | 변경 없음 |
| scan_snapshot_item | 구조 변경 없음 (데이터 생성 로직만 변경) |
| system_log | 변경 없음 |
