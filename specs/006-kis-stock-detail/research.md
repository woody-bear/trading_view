# Research: KIS API 필드 조사

## Decision 1: 투자지표 데이터 소스

**Decision**: pykis `stock.quote().indicator` 사용
**Rationale**: 이미 `get_quote()` 호출 시 함께 반환되는 데이터. 추가 API 호출 불필요.
**Alternatives**: yfinance info (느림, 불안정), 직접 크롤링 (유지보수 부담)

### 가용 필드 (KisDomesticIndicator)

| 필드 | 타입 | 설명 |
|------|------|------|
| `eps` | Decimal | 주당순이익 |
| `bps` | Decimal | 주당순자산 |
| `per` | Decimal | 주가수익비율 |
| `pbr` | Decimal | 주가순자산비율 |
| `week52_high` | Decimal | 52주 최고가 |
| `week52_low` | Decimal | 52주 최저가 |
| `week52_high_date` | date | 52주 최고가 날짜 |
| `week52_low_date` | date | 52주 최저가 날짜 |

## Decision 2: 시가총액/업종/위험도 소스

**Decision**: pykis `stock.quote()` 본체 필드 사용
**Rationale**: quote 응답에 이미 포함. 별도 API 불필요.

### 가용 필드 (KisDomesticQuote)

| 필드 | 타입 | 설명 |
|------|------|------|
| `market_cap` | Decimal | 시가총액 |
| `sector_name` | str | 업종명 |
| `halt` | bool | 매매정지 여부 |
| `overbought` | bool | 단기과열 여부 |
| `risk` | str | 위험도 (none/caution/warning/risk) |
| `high_limit` | Decimal | 상한가 |
| `low_limit` | Decimal | 하한가 |
| `base_price` | Decimal | 기준가 |

## Decision 3: 호가 데이터 소스

**Decision**: pykis `stock.orderbook()` 사용
**Rationale**: 국내 주식 10호가, 미국 주식 10호가(NYSE/NASDAQ) 제공.

### 가용 필드 (KisDomesticOrderbook)

| 필드 | 타입 | 설명 |
|------|------|------|
| `asks` | list[{price, volume}] | 매도호가 10단계 |
| `bids` | list[{price, volume}] | 매수호가 10단계 |
| `ask_price` | item | 매도 1호가 |
| `bid_price` | item | 매수 1호가 |

## Decision 4: 캐싱 전략

**Decision**: 메모리 캐시 (dict + TTL)
**Rationale**: SQLite 저장은 과도. 투자지표는 5분, 호가는 캐시 없음(실시간).
**Alternatives**: Redis (오버킬), DB 캐시 (불필요한 I/O)

| 데이터 | 캐시 TTL | 근거 |
|--------|---------|------|
| 투자지표 (PER/PBR 등) | 5분 | 장 중에도 거의 변동 없음 |
| 52주 고/저 | 5분 | 일 단위 변동 |
| 호가 | 없음 | 실시간 필요 |
| 위험 상태 | 5분 | 자주 변동 안 함 |

## Decision 5: 미국/암호화폐 종목 처리

**Decision**: KIS API가 미국 주식도 PER/PBR/52주 제공 → 표시. 호가는 미국만 표시. 암호화폐는 KIS 데이터 없으므로 숨김.
**Rationale**: pykis의 KisForeignQuote/KisForeignIndicator가 미국 종목도 지원.

| 시장 | 투자지표 | 호가 | 위험경고 | 가격제한 |
|------|---------|------|---------|---------|
| KR | O | O (10호가) | O | O |
| US | O | O (10호가, NYSE/NASDAQ) | X (항상 none) | X |
| CRYPTO | X | X | X | X |
