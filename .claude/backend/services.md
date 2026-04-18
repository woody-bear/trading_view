---
purpose: backend/services/ 하위 비즈니스 로직 서비스 모듈의 역할·의존성·주요 함수.
reader: Claude가 서비스 로직 추가/수정 또는 서비스 간 호출 흐름을 이해할 때.
update-trigger: services/ 파일 추가·제거; public 함수 시그니처 변경; 서비스 간 의존 방향 변경.
last-audit: 2026-04-18
---

# Backend — 서비스 레이어 (services/)

> 소스: `backend/services/`

## 서비스 파일 목록

| 파일 | 역할 | 호출 위치 |
|------|------|----------|
| `full_market_scanner.py` | **전체 시장 스캔 + DB 스냅샷 저장** | scheduler, routes/market_scan |
| `unified_scanner.py` | 통합 스캔 (인메모리 캐시, 새로고침용) | routes/market_scan |
| `scanner.py` | 관심종목 신호 스캔 (watchlist 기반) | scheduler |
| `chart_cache.py` | 차트 OHLCV 캐시 관리 + 무결성 검증 | app.py lifespan, routes/charts |
| `buy_signal_alert.py` | BUY 텔레그램 알림 발송 | scheduler |
| `sell_signal_alert.py` | SELL 텔레그램 알림 발송 | scanner.py |
| `telegram_bot.py` | 텔레그램 봇 공통 유틸 | buy/sell_signal_alert |
| `kis_client.py` | 한투 API 클라이언트 (시세, 종목 정보) | routes/prices, stocks |
| `kis_websocket.py` | 한투 실시간 WebSocket (KR 종목 체결가) | app.py lifespan |
| `price_feed.py` | 실시간 가격 피드 (WebSocket 브로드캐스트) | app.py lifespan |
| `forex_analyzer.py` | 환율 분석 로직 (DXY, 적정환율) | routes/forex |
| `sentiment_analyzer.py` | 시장 심리 분석 (VIX, Fear&Greed 등) | routes/sentiment |
| `stock_master.py` | stock_master DB 관리 (한투 FTP 동기화) | app.py lifespan |
| `scan_symbols_list.py` | 스캔 대상 종목 리스트 상수 정의 | full_market_scanner |
| `symbol_validator.py` | 심볼 유효성 검사 | routes/watchlist |

---

## 핵심 서비스 상세

### full_market_scanner.py — 전체 시장 스캔

전체 스캔 파이프라인:
```
run_full_scan(markets)
  → _load_symbols()          # scan_symbols_list에서 종목 로드
  → 100개씩 청크 분할
  → yfinance 배치 다운로드 (타임아웃 120초)
  → _analyze_ticker()        # 지표 계산 + 카테고리 판정
      ├── _check_trend()     # BULL/BEAR/NEUTRAL
      ├── _is_dead_cross()   # EMA20 < EMA50 → 스킵
      ├── _check_buy_signal_precise()  # BUY/SQZ BUY 판정
      ├── _passes_volume_filter()      # 거래량 1.5배 필터
      ├── _ema20_slope_positive()      # EMA20 기울기 체크
      └── _check_higher_lows()         # 스윙 저점 상승 체크
  → ScanSnapshot + ScanSnapshotItem DB 저장
  → 오래된 스냅샷 정리 (최근 10개 보관)

get_latest_snapshot(session)
  → 최신 completed 스냅샷 즉시 반환 (~30ms)
  → picks, max_sq, chart_buy 항목 분리하여 반환
```

**카테고리 판정 기준:**
- `picks`: squeeze_level >= 2 AND trend == "BULL" AND EMA20 >= EMA50
- `max_sq`: squeeze_level >= 3 AND trend == "BULL" AND EMA20 >= EMA50
- `chart_buy`: BUY/SQZ BUY 신호 AND 거래량 필터 AND EMA20 기울기 AND 저점 상승

### scanner.py — 관심종목 신호 스캔

```
run_scan()
  → watchlist에서 활성 종목 조회
  → 각 종목 OHLCV 조회 (fetcher 경유)
  → signal_engine.py로 신호 판정
  → 신호 변환(BUY→SELL 등) 감지 시 signal_history 저장
  → 변환 감지 시 sell_signal_alert 호출
```

### buy_signal_alert.py — BUY 텔레그램 알림

```
send_scheduled_buy_alert()
  → get_recent_buy_signals(session)
      → scan_snapshot_item에서 최신 chart_buy 조회
      → KR 상위 N개 + US 상위 N개 반환
  → telegram_bot.send_message()로 발송
  → alert_log DB 저장
```

---

## 서비스 추가 시 패턴

```python
# backend/services/my_service.py
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

async def my_function(session: AsyncSession) -> dict:
    try:
        # 비즈니스 로직
        ...
        return {"result": ...}
    except Exception as e:
        logger.error(f"my_function 실패: {e}")
        raise
```

- 로깅은 반드시 `loguru.logger` 사용 (print 금지)
- DB 세션은 파라미터로 받아서 사용 (직접 생성 금지)
- 예외는 로그 후 상위로 전파 (라우터에서 HTTPException 변환)
