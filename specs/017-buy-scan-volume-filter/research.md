# Research: 차트 BUY 스캔 거래량 필터

**Feature**: 017-buy-scan-volume-filter
**Date**: 2026-04-06

## Decision: 거래량 필터 구현 방식

**Chosen**: `df["volume"]` 컬럼 직접 활용 (추가 다운로드 불필요)
**Rationale**: yfinance `download()` 호출 시 `volume` 컬럼이 이미 포함됨. `_extract()` / `_extract_ticker()`에서 `volume` 컬럼을 유지하므로 추가 데이터 수집 없이 필터 구현 가능.
**Alternatives considered**: ccxt API로 크립토 거래량 별도 조회 — 불필요 (yfinance BTC-USD 등도 volume 포함).

## Decision: 공통 헬퍼 위치

**Chosen**: `full_market_scanner.py`에 `_passes_volume_filter()` 정의, `chart_scanner.py`에서 임포트
**Rationale**: `chart_scanner.py`가 이미 `full_market_scanner._load_symbols`를 임포트하고 있어 동일 패턴 유지.
**Alternatives considered**: `chart_scanner.py`에 인라인 구현 — 중복 코드 발생으로 기각.

## Decision: 5거래일 미만 이력 처리

**Chosen**: `True` 반환 (필터 건너뜀)
**Rationale**: FR-004 명시 요건. 신규 상장 종목을 불필요하게 제외하지 않음.

## Decision: 거래량 0 처리

**Chosen**: 평균 계산에서 제외 (0 제거 후 mean), 신호일 거래량이 0이면 필터 건너뜀
**Rationale**: 거래 정지일의 0은 실제 거래 없음을 의미 — 평균 왜곡 방지.

## Verification

실시간 시뮬레이션 (2026-04-06 기준):
- 삼지전자: 신호일 거래량 1.50x 평균 → 통과
- PLUS우량회사채50: 신호일 거래량 1.07x 평균 → 통과
- 나머지 4종목: 평균 미달 → 필터링
- 결론: 5거래일 기준이 합리적인 선별 강도임을 확인
