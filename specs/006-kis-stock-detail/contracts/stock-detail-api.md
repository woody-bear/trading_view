# API Contract: 종목 상세 확장

## GET /api/stocks/{symbol}/detail

종목 투자지표 + 기업정보 + 위험상태 + 가격제한 통합 조회.

**Parameters**:
- `symbol` (path, required): 종목코드 (예: `005930`, `AAPL`)
- `market` (query, optional): 시장 힌트 (`KR`, `KOSPI`, `KOSDAQ`, `US`). 생략 시 자동 판별.

**Response 200**:
```json
{
  "symbol": "005930",
  "name": "삼성전자",
  "market": "KR",
  "sector_name": "전기전자",
  "market_cap": 428000000000000,
  "eps": 4091,
  "bps": 43611,
  "per": 13.52,
  "pbr": 1.27,
  "week52_high": 88800,
  "week52_low": 53000,
  "week52_high_date": "2025-07-11",
  "week52_low_date": "2025-11-15",
  "week52_position": 42.5,
  "halt": false,
  "overbought": false,
  "risk": "none",
  "base_price": 55300,
  "high_limit": 71800,
  "low_limit": 38800,
  "price": 55400,
  "change_pct": 0.18
}
```

**Response 404** (KIS 미연동 또는 종목 없음):
```json
{
  "status": "unavailable",
  "reason": "kis_not_configured"
}
```

**Caching**: 메모리 캐시 5분 TTL. 동일 종목 재요청 시 캐시 반환.

---

## GET /api/stocks/{symbol}/orderbook

매도/매수 호가 조회.

**Parameters**:
- `symbol` (path, required): 종목코드
- `market` (query, optional): 시장 힌트

**Response 200**:
```json
{
  "symbol": "005930",
  "asks": [
    {"price": 55500, "volume": 12340},
    {"price": 55600, "volume": 8920},
    {"price": 55700, "volume": 15600},
    {"price": 55800, "volume": 5430},
    {"price": 55900, "volume": 3210}
  ],
  "bids": [
    {"price": 55400, "volume": 18750},
    {"price": 55300, "volume": 22100},
    {"price": 55200, "volume": 9870},
    {"price": 55100, "volume": 6540},
    {"price": 55000, "volume": 4320}
  ],
  "total_ask_volume": 45500,
  "total_bid_volume": 61580,
  "bid_ratio": 57.5
}
```

**Response 404**:
```json
{
  "status": "unavailable",
  "reason": "kis_not_configured"
}
```

**Caching**: 없음 (실시간 데이터).

---

## 에러 처리

| 상황 | HTTP | 응답 |
|------|------|------|
| KIS API 미설정 | 200 | `{"status": "unavailable", "reason": "kis_not_configured"}` |
| KIS API 호출 실패 | 200 | `{"status": "unavailable", "reason": "api_error"}` |
| 암호화폐 종목 | 200 | `{"status": "unavailable", "reason": "not_supported"}` |

200으로 반환하여 프론트엔드가 graceful하게 처리 가능.
