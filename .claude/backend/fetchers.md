---
purpose: backend/fetchers/ 외부 데이터 수신(yfinance/pykrx/ccxt/KIS) 모듈 설명.
reader: Claude가 외부 데이터 소스 추가·수정, 폴백 로직·캐시를 다룰 때.
update-trigger: fetchers/ 파일 추가·제거; 외부 API 엔드포인트/인증 변경; 캐시 TTL·폴백 순서 변경.
last-audit: 2026-04-18
---

# Backend — 데이터 수집 (fetchers/)

> 소스: `backend/fetchers/`

## 역할

외부 데이터 소스에서 OHLCV 캔들 데이터를 수집하는 레이어.  
라우터/서비스는 fetcher를 통해 데이터를 받고, 직접 yfinance/pykrx를 호출하지 않는다.

## 파일 구조

| 파일 | 소스 | 대상 시장 |
|------|------|----------|
| `base.py` | - | 공통 인터페이스 정의 |
| `us_fetcher.py` | yfinance | 미국 주식 (S&P500, NASDAQ100 등) |
| `kr_fetcher.py` | yfinance + pykrx | 한국 주식 (KOSPI, KOSDAQ) |
| `crypto_fetcher.py` | ccxt (Binance) | 암호화폐 |

## 데이터 소스 선택 로직

`watchlist.data_source` 값에 따라 fetcher 선택:

| data_source | fetcher |
|-------------|---------|
| `auto` | 시장(market)에 따라 자동 선택 |
| `yfinance` | us_fetcher (KR도 yfinance 가능) |
| `pykrx` | kr_fetcher (pykrx 강제) |
| `ccxt` | crypto_fetcher |

## yfinance 사용 시 주의사항

- **전체 시장 스캔**은 `yfinance.download()` 배치 모드 사용 (100개씩)
- 한국 종목 심볼은 `.KS` (KOSPI) / `.KQ` (KOSDAQ) 접미사 필요
  - 예: `005930` → `005930.KS`
- `threads=False` 설정 (안정성)
- 타임아웃: 청크당 120초
- Rate limit 방지: 청크 간 1초 대기

## pykrx fallback

한투 API(KIS) 미설정 시 pykrx로 한국 주식 실시간 가격 조회.  
`services/kis_websocket.py`가 비활성화된 경우 자동 fallback.

## 암호화폐

- ccxt Binance 거래소 사용
- 심볼 형식: `BTC/USDT`, `ETH/USDT` 등
- `BINANCE_API_KEY`, `BINANCE_API_SECRET` 환경변수 (선택)
