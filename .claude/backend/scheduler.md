---
purpose: backend/scheduler.py APScheduler 등록 작업 목록·시간대·트리거 규칙 설명.
reader: Claude가 배치·크론 작업을 추가·수정하거나 실행 주기를 조정할 때.
update-trigger: scheduler.py에 job 추가·제거; trigger 변경; KST/UTC 시간대 정책 변경.
last-audit: 2026-04-18
---

# Backend — 스케줄러 (scheduler.py)

> 소스: `backend/scheduler.py`  
> 라이브러리: APScheduler 3.x (AsyncIOScheduler)

## 등록된 작업 목록

| Job ID | 이름 | 주기 | 시간 (KST) | 요일 |
|--------|------|------|-----------|------|
| `signal_scan` | 신호 스캔 | 30분 interval | 상시 | 매일 |
| `buy_alert_1030` | BUY 알림 10:30 | cron | 10:30 | 평일 |
| `buy_alert_1500` | BUY 알림 15:00 | cron | 15:00 | 평일 |
| `full_market_scan_kr_930` | 국내 시장 스캔 9:30 | cron | 9:30 | 평일 |
| `full_market_scan_kr_*` | 국내 시장 스캔 | cron | 10:00~15:30 (매시:00/:30) | 평일 |
| `full_market_scan_us_evening` | 미국 스캔 저녁 | cron | 19:50 | 평일 |
| `full_market_scan_us_dawn` | 미국 스캔 새벽 | cron | 03:50 | 화~토 |
| `buy_alert_us_2000` | 미국 BUY 알림 20:00 | cron | 20:00 | 평일 |
| `buy_alert_us_0400` | 미국 BUY 알림 04:00 | cron | 04:00 | 화~토 |
| `sell_alert_kr` | KR SELL 체크 (30분마다) | cron | 09:00~15:30 (매시:00/:30) | 평일 |
| `sell_alert_us_2000` | US SELL 체크 20:00 | cron | 20:00 | 평일 |
| `sell_alert_us_0400` | US SELL 체크 04:00 | cron | 04:00 | 화~토 |

---

## 작업별 상세

### signal_scan (30분 interval)
```
_scheduled_scan()
  → run_scan()  # 관심종목 신호 스캔 + SELL 알림
```
- 관심종목 watchlist 전체 스캔
- 신호 전환(BUY↔SELL↔NEUTRAL) 감지 시 텔레그램 발송

### 국내 전체 시장 스캔 (KR)
```
_scheduled_full_market_scan_kr()
  → full_market_scanner.run_full_scan(markets=["KR"])
```
- 스캔 대상: 코스피200 + 코스닥150 + KRX섹터 + KR ETF
- 결과: ScanSnapshot + ScanSnapshotItem DB 저장
- 소요: 약 5~7분

### 미국/암호화폐 전체 시장 스캔 (US+CRYPTO)
```
_scheduled_full_market_scan_us()
  → full_market_scanner.run_full_scan(markets=["US", "CRYPTO"])
```
- 스캔 대상: S&P500 + NASDAQ100 + DJIA30 + US ETF + 암호화폐 10종

### BUY 텔레그램 알림
```
_scheduled_buy_alert()
  → buy_signal_alert.send_scheduled_buy_alert()
```
- 최신 스냅샷에서 chart_buy 종목 조회
- KR N개 + US N개 텔레그램 발송
- 상세 기준: `.claude/rules/chart-buy-label.md`

### SELL 텔레그램 알림
```
_scheduled_sell_alert_kr()  → sell_signal_alert.send_scheduled_sell_alert(market="KR")
_scheduled_sell_alert_us()  → sell_signal_alert.send_scheduled_sell_alert(market="US")
```
- 관심종목(watchlist) 중 SELL 신호 발생 종목 텔레그램 발송
- KR: 장중 30분마다 (09:00~15:30 평일)
- US: KST 20:00 (평일), 04:00 (화~토)

---

## 스케줄러 설정 옵션

```python
scheduler.add_job(
    func,
    trigger="cron" or "interval",
    max_instances=1,     # 중복 실행 방지
    coalesce=True,       # 밀린 실행 합치기
    misfire_grace_time=600,  # 지연 허용 시간(초)
    replace_existing=True,   # 재등록 시 교체
)
```

---

## 스케줄러 기동/종료

```python
# app.py lifespan
scheduler.start()   # FastAPI 시작 시
scheduler.shutdown() # FastAPI 종료 시
```

---

## 새 스케줄 추가 패턴

```python
# scheduler.py에 함수 + job 등록
async def _my_scheduled_job():
    logger.info("작업 시작")
    try:
        await my_service.do_something()
    except Exception as e:
        logger.error(f"작업 실패: {e}")

# setup_scheduler() 내부에 추가
scheduler.add_job(
    _my_scheduled_job,
    trigger="cron",
    hour=9, minute=0,
    day_of_week="mon-fri",
    timezone=KST,
    max_instances=1,
    coalesce=True,
    id="my_job_id",
    name="작업명",
    replace_existing=True,
)
```
