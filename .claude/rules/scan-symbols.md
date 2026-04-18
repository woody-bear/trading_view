---
purpose: 스캔 대상 종목 리스트(KR/US/CRYPTO) 정의 — 보호된 비즈니스 규칙.
reader: Claude가 스캔 대상 종목을 추가·제거하기 전(사용자 승인 필수).
update-trigger: 종목 리스트 변경; StockMaster 동기화 규칙 변경.
last-audit: 2026-04-18
requires-approval: true
protected-since: 2026-04-12
---

# Rules — 스캔 대상 종목 리스트

> ⚠️ **이 파일은 보호된 비즈니스 규칙입니다.**  
> 수정 시 반드시 사용자에게 확인 후 진행하세요.

소스: `backend/services/scan_symbols_list.py`, `backend/services/full_market_scanner.py`

---

## 국내 (KR)

| 그룹 | 변수명 | 종목 수 | 비고 |
|------|--------|--------|------|
| 코스피200 | `KOSPI200_SYMBOLS` | 200 | KOSPI 대형주 |
| 코스닥150 | `KOSDAQ150_SYMBOLS` | 150 | KOSDAQ 대형주 |
| KRX 추가 | `KRX_EXTRA` | 5 | 반도체 ETF 등 |
| 국내 ETF | `KR_ETF_SYMBOLS` | ~100 | KODEX/TIGER/KBSTAR/RISE/ACE/HANARO/SOL |
| **전체 합산** | `ALL_KR_SYMBOLS` | **~470** | 중복 제거 union |

> KR ETF 운용사: KODEX(삼성), TIGER(미래에셋), KBSTAR(KB), RISE(KB), ACE(한국투자), HANARO(NH), SOL(신한)

---

## 미국 (US)

| 그룹 | 변수명 | 종목 수 | 비고 |
|------|--------|--------|------|
| S&P500 | `SP500_TICKERS` | ~500 | 미국 대형주 |
| 나스닥100 추가 | `NASDAQ100_EXTRA_TICKERS` | ~50 | S&P500 미포함 나스닥100 |
| 다우존스30 | `DJIA30_TICKERS` | 30 | S&P500 포함 — 별도 스캔 안 함 |
| 미국 ETF | `US_ETF_TICKERS` | ~100 | SPY/QQQ/IWM 등 주요 ETF |
| **전체 합산** | `ALL_US_TICKERS` | **~718** | SP500 ∪ NASDAQ100_EXTRA ∪ US_ETF |

> DJIA30는 `DJIA30_TICKERS`로 정의되어 있으나 `ALL_US_TICKERS`에 포함(S&P500 내 중복)되어 별도 스캔 불필요.

---

## 암호화폐 (CRYPTO)

소스: `backend/services/full_market_scanner.py` — `_CRYPTO` dict (라인 38)

| 티커 | 심볼 | 이름 |
|------|------|------|
| BTC-USD | BTC/USDT | Bitcoin |
| ETH-USD | ETH/USDT | Ethereum |
| SOL-USD | SOL/USDT | Solana |
| BNB-USD | BNB/USDT | BNB |
| XRP-USD | XRP/USDT | Ripple |
| ADA-USD | ADA/USDT | Cardano |
| DOGE-USD | DOGE/USDT | Dogecoin |
| AVAX-USD | AVAX/USDT | Avalanche |
| LINK-USD | LINK/USDT | Chainlink |
| DOT-USD | DOT/USDT | Polkadot |

> 총 10종목. yfinance 티커로 데이터 수신, Binance 심볼로 ccxt 거래량 보완.

---

## 전체 합계

| 시장 | 종목 수 |
|------|--------|
| KR | ~470 |
| US | ~718 |
| CRYPTO | 10 |
| **총계** | **~1,198** |

---

## 스캔 분리 방식

```python
# KR 전용 스캔
await run_full_scan(markets=["KR"])        # ~470 종목

# US+CRYPTO 스캔
await run_full_scan(markets=["US", "CRYPTO"])  # ~728 종목

# 전체 스캔
await run_full_scan(markets=None)          # ~1,198 종목
```

---

## 변경 규칙

- 종목 추가/삭제 시 `scan_symbols_list.py` 수정
- 암호화폐 추가 시 `full_market_scanner.py`의 `_CRYPTO` dict 수정
- 변경 후 `StockMaster` 테이블 동기화 필요 (`refresh_stock_master()` 호출)
