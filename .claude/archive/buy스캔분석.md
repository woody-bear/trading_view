# 차트 BUY 신호 스캔 현황 분석

작성일: 2026-04-10  
목적: KR 5개 + US 5개, 9회 스캔, 4회 텔레그램, 스냅샷 기반으로의 개선 전 현황 파악

---

## 1. 현재 스캔 파이프라인 전체 구조

```
[APScheduler]
  ├─ 10분 interval  → _scheduled_scan()
  │     ├─ scanner.run_scan()           # 관심종목 신호 스캔
  │     └─ chart_scanner.scan_latest_buy("1d")  ← ❶ 독립 스캔 (문제)
  │
  ├─ KR 7회 (9:30~15:30 :30마다)  → _scheduled_full_market_scan_kr()
  │     └─ full_market_scanner.run_full_scan(markets=["KR"])
  │           → ScanSnapshot + ScanSnapshotItem (category='chart_buy') DB 저장
  │
  ├─ US 2회 (19:50 KST, 03:50 KST) → _scheduled_full_market_scan_us()
  │     └─ full_market_scanner.run_full_scan(markets=["US","CRYPTO"])
  │           → ScanSnapshot + ScanSnapshotItem (category='chart_buy') DB 저장
  │
  ├─ BUY 텔레그램 4회 (10:30, 15:00, 20:00, 04:00 KST)
  │     └─ buy_signal_alert.send_scheduled_buy_alert()
  │           └─ get_recent_buy_signals()  → 최신 스냅샷 DB 조회 ← ❷ 이미 스냅샷 기반
  │
  └─ [새로고침 버튼] (019 브랜치 변경 후)
        └─ full_market_scanner.run_full_scan()  → ScanSnapshot DB 저장
              → 완료 후 GET /scan/full/latest (스냅샷 조회)
```

---

## 2. 스캔 횟수 (현재 = 목표)

| 스캔 ID | 시각 (KST) | 요일 | 대상 | 종목 수 |
|---------|----------|------|------|--------|
| full_market_scan_kr | 9:30, 10:30, 11:30, 12:30, 13:30, 14:30, 15:30 | 평일 | KR | ~351종목 |
| full_market_scan_us_evening | 19:50 | 평일 | US+CRYPTO | ~522종목 |
| full_market_scan_us_dawn | 03:50 | 화~토 | US+CRYPTO | ~522종목 |
| **합계** | **9회** | | | |

> **현재 이미 9회 스캔 구조** — 스케줄 변경 불필요

---

## 3. 텔레그램 전송 (현재 = 목표)

| 알림 ID | 시각 (KST) | 요일 | 함수 |
|---------|----------|------|------|
| buy_alert_1030 | 10:30 | 평일 | `send_scheduled_buy_alert()` |
| buy_alert_1500 | 15:00 | 평일 | `send_scheduled_buy_alert()` |
| buy_alert_us_2000 | 20:00 | 평일 | `send_scheduled_buy_alert()` |
| buy_alert_us_0400 | 04:00 | 화~토 | `send_scheduled_buy_alert()` |

> **현재 이미 4회 전송 구조** — 스케줄 변경 불필요

---

## 4. BUY 신호 종목 수량 — 현재 vs 목표

### 텔레그램 (`buy_signal_alert.py`)

```python
# get_recent_buy_signals() — 현재
.order_by(ScanSnapshotItem.confidence.desc())
.limit(20)   ← 시장 구분 없이 confidence 상위 20개

# 목표
KR 5개 + US 5개 = 최대 10개
```

### 대시보드 표시 — `full_market_scanner.get_latest_snapshot()`

```python
# full_market_scanner.get_latest_snapshot() — 현재
# chart_buy items은 수량 제한 없이 모두 반환
final_chart_buy = live_chart_buy_items if live_chart_buy_items else chart_buy_items
# → items 전체 반환 (confidence 내림차순)
```

### 대시보드 표시 — `unified_scanner.scan_all()`

```python
# unified_scanner.py:281-282 — 현재
kr_buy = [r for r in buy_items if r["market"] == "KR"][:2]   ← KR 2개
us_buy = [r for r in buy_items if r["market"] == "US"][:2]   ← US 2개

# 목표
KR 5개 + US 5개
```

### 대시보드 표시 — `chart_scanner.scan_latest_buy()` (❶ 독립 스캔)

```python
# chart_scanner.py:136-138 — 현재
kr_items = [r for r in results if r["market"] == "KR"][:2]   ← KR 2개
us_items = [r for r in results if r["market"] == "US"][:2]   ← US 2개 (019 수정 후)

# 목표: 이 독립 스캔 자체를 제거하고 스냅샷 조회로 대체
```

---

## 5. 현재 문제점

### ❶ chart_scanner.scan_latest_buy() — 불필요한 중복 스캔

`scheduler._scheduled_scan()` (10분마다)에서 `chart_scanner.scan_latest_buy("1d")`를 호출한다.

```python
# scheduler.py:183-188
async def _scheduled_scan():
    await run_scan()
    try:
        from services.chart_scanner import scan_latest_buy
        await scan_latest_buy("1d")   ← 10분마다 전종목 yfinance 독립 다운로드
    except Exception as e:
        ...
```

`chart_scanner.scan_latest_buy()`는 yfinance에서 KR+US 전종목(~873종목) 일봉을 **직접 다운로드**하고 인메모리 캐시에만 저장한다. 이 결과는 `GET /scan/full/latest`와 **별개**이며 DB에 저장되지 않는다.

- 현재 역할: `Dashboard.tsx` 마운트 시 `fetchFullScanLatest()`의 폴백 데이터  
- 문제: full_market_scanner와 완전히 중복 + 10분마다 과도한 네트워크 사용 + 스냅샷과 불일치

### ❷ 텔레그램 시장별 균형 없음

```python
# buy_signal_alert.get_recent_buy_signals() — 현재
.limit(20)   ← confidence 순 20개, KR만 또는 US만 채워질 수 있음
```

KR 장중 스캔 직후 텔레그램에는 KR 종목만 포함될 가능성 높음. 목표인 KR 5개 + US 5개 균형 보장 안 됨.

### ❸ 대시보드 스냅샷 vs 인메모리 혼용

`Dashboard.tsx` 마운트 로직:

```typescript
// Dashboard.tsx:643-672 (기존)
const [fullResult, unifiedResult] = await Promise.all([
  fetchFullScanLatest(),     // DB 스냅샷
  fetchUnifiedCache(),       // unified_scanner 인메모리
])
// 더 최신 타임스탬프 선택 → setBuyItems
```

**스냅샷 없으면 unified_scanner 인메모리를 사용** — 인메모리는 서버 재시작 시 초기화된다.

### ❹ 스냅샷 chart_buy 수량 제한 없음

`full_market_scanner.get_latest_snapshot()`이 반환하는 `chart_buy.items`에 수량 제한이 없어 대시보드가 받는 종목 수가 스캔마다 다르다.

---

## 6. 데이터 흐름 요약

```
[스캔 DB 저장]
full_market_scanner.run_full_scan()
  → ScanSnapshotItem (category='chart_buy', 수량 제한 없음)
  → ScanSnapshot (status='completed')

[텔레그램]
send_scheduled_buy_alert()
  → get_recent_buy_signals()
    → SELECT ... WHERE category='chart_buy' ORDER BY confidence DESC LIMIT 20
    ← KR/US 구분 없는 confidence 상위 20개

[대시보드 마운트]
GET /scan/full/latest → get_latest_snapshot()
  → chart_buy.items: 전체 반환 (수량 제한 없음)
  (또는 unified_scanner 인메모리 폴백 — KR 2개 + US 2개)

[10분 스캔 인메모리]
chart_scanner.scan_latest_buy()  ← 독립 스캔, DB 미저장
  → _latest_buy_cache: KR 2개 + US 2개 (메모리)
  (대시보드가 직접 이 캐시를 읽지는 않음 — 현재 미사용 상태에 가까움)
```

---

## 7. 변경 필요 파일 목록

| 파일 | 변경 내용 | 우선순위 |
|------|----------|--------|
| `backend/services/buy_signal_alert.py` | `get_recent_buy_signals()` KR 5개 + US 5개 제한 | **필수** |
| `backend/services/full_market_scanner.py` | `get_latest_snapshot()` chart_buy KR 5개 + US 5개 제한 | **필수** |
| `backend/scheduler.py` | `_scheduled_scan()` — `chart_scanner.scan_latest_buy()` 호출 제거 | **필수** |
| `backend/services/chart_scanner.py` | 독립 스캔 제거 → 스냅샷 조회로 대체 또는 파일 전체 제거 | **필수** |
| `backend/services/unified_scanner.py` | chart_buy KR 2→5개, US 2→5개 | 보조 |
| `frontend/src/pages/Dashboard.tsx` | unified_scanner 폴백 제거 → 스냅샷 단일 소스 | 보조 |

---

## 8. 변경 전/후 비교

| 항목 | 현재 | 목표 |
|------|------|------|
| 스캔 횟수 | 9회 (KR 7 + US 2) + 10분마다 chart_scanner 독립 스캔 | 9회 (KR 7 + US 2), 독립 스캔 제거 |
| 텔레그램 횟수 | 4회 (10:30, 15:00, 20:00, 04:00) | 동일 |
| 텔레그램 종목 수 | confidence 상위 20개 (시장 불균형 가능) | KR 5개 + US 5개 |
| 대시보드 종목 수 | 제한 없음 (스냅샷) 또는 KR 2 + US 2 (인메모리) | KR 5개 + US 5개 (스냅샷 단일 소스) |
| 데이터 소스 | 스냅샷 + 인메모리 혼용 | 스냅샷 단일 소스 |
| ETF 포함 | 포함 (scan_symbols_list에 ETF 있음) | 포함 유지 |

---

## 9. 핵심 수정 포인트

### A. 텔레그램 — `buy_signal_alert.get_recent_buy_signals()`

```python
# 현재
.limit(20)

# 변경 후
# KR/US 각각 상위 5개 추출
kr_items = [i for i in items if i.market == "KR"][:5]
us_items = [i for i in items if i.market == "US"][:5]
signals = kr_items + us_items
```

### B. 대시보드 스냅샷 — `full_market_scanner.get_latest_snapshot()`

```python
# 현재 (수량 제한 없음)
final_chart_buy = live_chart_buy_items if live_chart_buy_items else chart_buy_items

# 변경 후 (KR 5개 + US 5개)
def _limit_chart_buy(items):
    kr = [i for i in items if i["market"] == "KR"][:5]
    us = [i for i in items if i["market"] == "US"][:5]
    return kr + us

final_chart_buy = _limit_chart_buy(live_chart_buy_items if live_chart_buy_items else chart_buy_items)
```

### C. 독립 스캔 제거 — `scheduler._scheduled_scan()` 내부 일부

`_scheduled_scan()`은 두 가지를 수행한다:
1. `run_scan()` — 관심종목 신호 변환 감지 + 텔레그램 알림 (BUY/SELL 포함) **← 유지**
2. `scan_latest_buy("1d")` — 전체 시장 차트 BUY 독립 스캔 **← 이 부분만 제거**

```python
# _scheduled_scan() 전체가 아니라 이 블록만 제거
try:
    from services.chart_scanner import scan_latest_buy
    await scan_latest_buy("1d")        # 전종목 yfinance 독립 다운로드 — DB 미저장
except Exception as e:
    logger.warning(f"차트 BUY 스캔 실패: {e}")
```

### D. `chart_scanner.py` — 스냅샷 조회로 대체

독립 스캔 제거 후 `get_cache()` 호출처가 없으면 파일 전체 제거 가능.  
만약 `GET /chart-scanner/cache` 같은 엔드포인트가 있다면 스냅샷 조회로 교체.

---

## 10. ETF 포함 여부 확인

`scan_symbols_list.py`에 ETF 전용 심볼이 포함되어 있으며, `full_market_scanner._load_symbols()`에서 `is_etf` 필드가 함께 로드된다. **현재 chart_buy 분류에서 ETF를 별도로 제외하지 않으므로 이미 포함되어 있다.**

```python
# full_market_scanner._load_symbols()
symbols.append({
    ...
    "is_etf": row.is_etf,   ← ETF 여부 포함
})

# _analyze_ticker() — chart_buy 분류에 is_etf 체크 없음 → ETF 포함
if buy_signal:
    if _passes_volume_filter(...):
        categories.append("chart_buy")   ← ETF도 포함됨
```

---

## 파일 위치 참조

| 파일 | 경로 |
|------|------|
| 스케줄러 | `backend/scheduler.py` |
| 전체 시장 스캔 (DB) | `backend/services/full_market_scanner.py` |
| 통합 스캔 (인메모리) | `backend/services/unified_scanner.py` |
| 차트 BUY 독립 스캔 | `backend/services/chart_scanner.py` |
| 텔레그램 BUY 알림 | `backend/services/buy_signal_alert.py` |
| 스캔 API 엔드포인트 | `backend/routes/market_scan.py` |
| 종목 리스트 | `backend/services/scan_symbols_list.py` |
| 대시보드 | `frontend/src/pages/Dashboard.tsx` |
