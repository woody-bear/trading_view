# Contract: POST /prices/batch

**Type**: REST API (Backend → Frontend)  
**Status**: 기존 구현 완료 — 변경 불필요  
**File**: `backend/routes/prices.py`

---

## Request

```
POST /api/prices/batch
Content-Type: application/json
```

```json
{
  "symbols": [
    { "symbol": "005930", "market": "KR" },
    { "symbol": "AAPL",   "market": "US" }
  ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `symbols` | array | ✅ | 심볼 목록 |
| `symbols[].symbol` | string | ✅ | 종목 코드 |
| `symbols[].market` | string | ✅ | `"KR"` / `"US"` (CRYPTO 미지원) |

**제약**: CRYPTO 시장은 KIS API 미지원으로 요청 목록에서 제외해야 함.

---

## Response

```json
{
  "prices": {
    "005930": {
      "price": 70000,
      "change_pct": 0.71,
      "open": 69500,
      "high": 70200,
      "low": 69300,
      "volume": 1234567
    },
    "AAPL": {
      "price": 175.50,
      "change_pct": -0.43,
      "open": 174.80,
      "high": 176.00,
      "low": 174.20,
      "volume": 9876543
    }
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `prices` | object | 심볼을 키로 하는 가격 데이터 맵 |
| `prices[symbol].price` | number | 현재가 |
| `prices[symbol].change_pct` | number | 등락률 (양수=상승, 음수=하락) |
| `prices[symbol].open` | number | 시가 |
| `prices[symbol].high` | number | 고가 |
| `prices[symbol].low` | number | 저가 |
| `prices[symbol].volume` | number | 거래량 |

**에러 처리**: 개별 심볼 조회 실패 시 해당 심볼만 결과에서 제외 (전체 요청 실패 아님).

---

## Frontend 호출 패턴

```typescript
// frontend/src/api/client.ts — 기존 함수
fetchBatchPrices(symbols: { symbol: string; market: string }[])
  → Promise<Record<string, LivePriceEntry>>
```

**호출 간격**: 5,000ms (`setInterval`)  
**호출 시점**: 화면 마운트 후 즉시 1회 + 이후 5초마다  
**정리(cleanup)**: 화면 언마운트 시 `clearInterval`
