# Research: 026-buylist-market-sentiment

**Date**: 2026-04-19  
**Branch**: `026-buylist-market-sentiment`

---

## Decision 1: EMA 10선 추가

**Decision**: `backend/indicators/ema.py`의 `calculate_ema()`에 EMA 10 추가

**Context**: 현재 EMA 계산 함수는 5/20/50/60/120/200선을 지원하지만 **EMA 10이 없음**. 정배열 조건(5>10>20>60>120)에 EMA 10이 필수.

**Rationale**: `pandas_ta_classic` 라이브러리를 이미 사용 중이므로 단순히 기간 파라미터 추가만 필요. 기존 함수의 반환 dict에 `ema_10` 키 추가로 하위 호환성 유지.

**Alternatives considered**:
- EMA 10 대신 SMA 10 사용 → 정배열 정의가 EMA 기준이므로 기각
- 별도 함수 생성 → R-06(기존 유틸 재사용) 위반이므로 기각

---

## Decision 2: 섹터(업종) 정보 저장 방식

**Decision**: `StockMaster` 테이블에 `sector` VARCHAR(100) 컬럼 추가 (DB 마이그레이션 포함), yfinance `info.sector`로 US 종목 채우기, KR 종목은 `market_type` 기반 매핑으로 대체

**Context**: 현재 StockMaster에 sector/업종 필드 없음. 거래량 급등 상위 섹터 표시를 위해 필요.

**Rationale**:
- US 종목: yfinance `Ticker(symbol).info['sector']` 제공 (안정적)
- KR 종목: pykrx는 업종 코드 제공하나 추가 매핑 테이블 필요 — 단기적으로 `market_type`(KOSPI/KOSDAQ)을 섹터 대체값으로 사용
- CRYPTO: `암호화폐`로 고정
- Nullable로 선언 + DEFAULT `"기타"` → 기존 데이터 하위 호환

**Alternatives considered**:
- yfinance on-demand 메모리 캐시만 사용 → 재시작 시 손실, 1000+ 종목 cold start 느림
- 별도 sector 테이블 → 현재 기능 범위 초과

**DB-01 준수**: 롤백 SQL: `ALTER TABLE stock_master DROP COLUMN sector;`

---

## Decision 3: 시장분위기 집계 API 설계

**Decision**: 새 엔드포인트 `GET /scan/market-sentiment` 추가, 백엔드 in-memory 캐시 30분 TTL

**Context**: EMA 정배열/역배열 판정 + 거래량 급등 집계는 ~1,200 종목 × OHLCV 데이터 로드가 필요. 매 요청마다 실행 시 성능 문제 발생.

**Rationale**:
- 스캔 스냅샷 데이터(이미 DB에 있는 마지막 스캔 결과)를 재사용하면 OHLCV 재다운로드 불필요
- `scan_snapshot_items` 테이블에 `ema_20`, `ema_50` 이미 저장 → EMA 정배열 판정은 추가 컬럼 필요
- 거래량 급등은 기존 스냅샷에 없으므로 최신 OHLCV를 간략히 조회

**캐시 전략**: 30분 TTL (스캔 주기와 동일하거나 짧게). `functools.lru_cache`보다 `cachetools.TTLCache` 사용(이미 프로젝트에서 사용 중).

**Alternatives considered**:
- 실시간 계산 → 1,200 종목 × 120봉 데이터 → API 응답 10초+ 예상, 기각
- 스케줄러로 사전 계산 후 DB 저장 → 구현 범위 초과, 기각

---

## Decision 4: CRYPTO 시총 분포 추가

**Decision**: `GET /scan/symbols/market-cap-distribution` 응답에 CRYPTO 집계 추가

**Context**: 현재 API는 KR/US만 반환. spec에서 시총 분포 차트 순서를 KR→US→CRYPTO로 요구.

**Rationale**: yfinance로 BTC-USD 등 CRYPTO 10종목의 `info['marketCap']` 조회 가능. 단, USD 기준이며 Binance 거래량과 달리 USD 단일 통화로 처리.

**CRYPTO 시총 분류**: 대형(>$10B) / 중형($1B~$10B) / 소형(<$1B) — US ETF 기준 동일 적용.

---

## Decision 5: EMA 정배열/역배열 데이터 소스

**Decision**: 최신 스캔 스냅샷의 EMA 컬럼 값 활용 + 부족한 EMA 10/60 계산을 위한 보완 로직

**Context**: `scan_snapshot_items`에는 `ema_20`, `ema_50`만 저장됨. 정배열(5>10>20>60>120) 판정에는 EMA 5/10/20/60/120 모두 필요.

**Rationale**: 스냅샷에 없는 EMA값은 `yfinance`로 최근 200봉만 로드 → pandas_ta_classic으로 계산. 1,200 종목 × 200봉은 배치 처리로 수용 가능. 캐시 30분으로 반복 호출 방어.

**실제 구현 단순화**: 스냅샷에 이미 있는 `ema_20`, `ema_50` 외에, EMA 5/10/60/120 계산 결과를 in-memory로만 유지 (DB 저장 안 함).
