# Data Model: 종목 상세 확장 데이터

## Entities

### StockDetail (종목 상세 정보)

투자지표 + 기업정보 + 위험상태 + 가격제한을 통합한 응답 모델.
별도 DB 테이블 없음 — KIS API 실시간 조회 + 메모리 캐시(5분 TTL).

| Field | Type | Description |
|-------|------|-------------|
| symbol | string | 종목코드 |
| name | string | 종목명 |
| market | string | KR / US |
| sector_name | string? | 업종명 |
| market_cap | number | 시가총액 (원/달러) |
| eps | number | 주당순이익 |
| bps | number | 주당순자산 |
| per | number | 주가수익비율 |
| pbr | number | 주가순자산비율 |
| week52_high | number | 52주 최고가 |
| week52_low | number | 52주 최저가 |
| week52_high_date | string | 52주 최고가 날짜 (YYYY-MM-DD) |
| week52_low_date | string | 52주 최저가 날짜 (YYYY-MM-DD) |
| week52_position | number | 52주 범위 내 현재 위치 (0~100%) |
| halt | boolean | 매매정지 여부 |
| overbought | boolean | 단기과열 여부 |
| risk | string | 위험도 (none/caution/warning/risk) |
| base_price | number | 기준가 |
| high_limit | number | 상한가 |
| low_limit | number | 하한가 |
| price | number | 현재가 |
| change_pct | number | 등락률 |

### Orderbook (호가 데이터)

실시간 호가. 캐시 없음 — 매 요청 시 KIS API 직접 조회.

| Field | Type | Description |
|-------|------|-------------|
| symbol | string | 종목코드 |
| asks | list[OrderbookItem] | 매도호가 (최대 10단계, 가격 오름차순) |
| bids | list[OrderbookItem] | 매수호가 (최대 10단계, 가격 내림차순) |
| total_ask_volume | number | 매도 총잔량 |
| total_bid_volume | number | 매수 총잔량 |
| bid_ratio | number | 매수비율 (0~100%) |

### OrderbookItem

| Field | Type | Description |
|-------|------|-------------|
| price | number | 호가 가격 |
| volume | number | 호가 잔량 |

## Relationships

- StockDetail은 SignalDetail 페이지에서 차트 데이터와 함께 표시
- Orderbook은 StockDetail과 동일 종목에 대해 독립적으로 조회
- 한국 주식만 위험경고/가격제한 표시, 미국은 투자지표만
- 암호화폐는 두 엔티티 모두 해당 없음

## State Transitions

없음 — 읽기 전용 데이터.
