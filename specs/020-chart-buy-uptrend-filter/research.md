# Research: 020 — 차트 BUY 상승장 조건 + 저점 상승 체크

**Source**: `.claude/docs/상승조건저점체크조건검사.md` (2026-04-12 분석)

---

## 결정 1: 상승 추세 조건 강도

**Decision**: 옵션 C — 신호 유형과 무관하게 EMA20 기울기 양수 + higher lows 두 조건 모두 적용

**Rationale**:
- 옵션 A (기존 `_check_trend()` BULL 필수): EMA200 정렬 필요 → 상승 초기 종목 과다 탈락
- 옵션 B (EMA20 > EMA50 + slope): dead cross 필터로 EMA20 > EMA50은 이미 보장 → slope만 추가
- SQZ BUY는 횡보 해제 신호이지만, 방향성 없이 해제되는 경우도 있어 EMA slope 조건으로 방향 확인 필요

**Alternatives Considered**:
- BULL trend 완전 요구 → 너무 엄격, 상승 전환 초기 종목 탈락
- 조건 미적용 → 290080 같은 NEUTRAL 종목 계속 포함

---

## 결정 2: EMA20 기울기 lookback

**Decision**: lookback = 10봉 (약 2주치 일봉)

**Rationale**:
- 5봉(1주): 단기 노이즈에 민감
- 10봉(2주): 단기 추세 포착, 적절한 지연
- 20봉(1개월): 반응이 너무 늦어 이미 진행된 상승 초입에서만 탐지

---

## 결정 3: 스윙 저점 window

**Decision**: window = 2 (앞뒤 2봉보다 낮아야 스윙 저점)

**Rationale**:
- window=1: 노이즈 많음, 작은 음봉도 저점 인식
- window=2: 일봉 기준 적절한 밸런스 (Dow Theory의 swing point 기준)
- window=3+: 저점 수가 너무 드물어 min_swings=2 충족 어려움

---

## 결정 4: higher lows lookback

**Decision**: lookback = 40봉 (약 2개월치 일봉)

**Rationale**:
- 20봉(1개월): 너무 짧아 일시적 반등도 추세로 오인 가능
- 40봉(2개월): 중기 추세 확인에 적합, 스윙 저점 2개 이상 포착 확률 높음
- 60봉(3개월): 너무 길어 상승 전환 초입 종목 탈락

---

## 결정 5: 저점 부족 시 처리

**Decision**: True 반환 (필터 패스)

**Rationale**:
- 신규상장, 거래재개, ETF 등 거래일 수 부족 종목에서 스윙 저점이 2개 미만일 수 있음
- 억울한 탈락 방지 — 이미 SCAN_MIN_CANDLES=60 조건이 있어 1년치 데이터 부족 종목은 미진입

---

## 결정 6: unified_scanner 적용 범위

**Decision**: 이번 작업 제외, 021 이슈로 분리

**Rationale**:
- `unified_scanner.py`는 별도 스캔 경로 (메모리 캐시 기반 실시간 스캔)
- 동일 함수(`_ema20_slope_positive`, `_check_higher_lows`)를 임포트해서 재사용 가능
- 먼저 `full_market_scanner.py`에서 검증 후 적용하는 것이 안전

---

## 기술 조사: Higher Lows 알고리즘

### 표준 접근법 (Dow Theory 기반)
- **Swing Low**: 로컬 최저점 — 앞뒤 N봉보다 낮은 봉
- **Higher Lows**: 연속된 swing low가 이전보다 높은 패턴
- TradingView Pine Script: `ta.pivotlow(source, leftbars, rightbars)` — 동일 개념

### 구현 복잡도
- window=2 적용 시: O(n) 단순 루프, 성능 영향 없음
- 1년치 일봉(약 250봉) 기준 연산 < 1ms

### 주의사항
- Pandas Series에서 직접 `.values` 배열로 처리 (인덱스 오프셋 문제 회피)
- 스윙 저점 탐색 시 마지막 2봉(`len-2`, `len-1`)은 미래 확인 불가 → 탐색 범위에서 제외
