# BUY 차트 스캔 개선 작업계획

작성일: 2026-04-10  
참조: `.claude/docs/buy스캔분석.md`

---

## 목표

| 항목 | 현재 | 목표 |
|------|------|------|
| 스캔 횟수 | 9회 + 10분마다 독립 스캔 | 9회 (독립 스캔 제거) |
| 텔레그램 횟수 | 4회 | 4회 (동일) |
| KR 표시 종목 수 | 2개 (인메모리) / 무제한 (스냅샷) | **5개** |
| US 표시 종목 수 | 2개 (인메모리) / 무제한 (스냅샷) | **5개** |
| 데이터 소스 | 스냅샷 + 인메모리 혼용 | **스냅샷 단일 소스** |

---

## 변경 항목 (5개, 독립적)

| # | 파일 | 내용 | 난이도 |
|---|------|------|--------|
| ① | `buy_signal_alert.py` | 텔레그램 종목 KR 5 + US 5 제한 | 낮음 |
| ② | `full_market_scanner.py` | 스냅샷 반환 시 KR 5 + US 5 제한 | 낮음 |
| ③ | `scheduler.py` + `chart_scanner.py` + `routes/signals.py` | 독립 스캔 제거 → 스냅샷 조회로 교체 | 중간 |
| ④ | `unified_scanner.py` | chart_buy KR 2→5, US 2→5 | 낮음 |
| ⑤ | `Dashboard.tsx` | unified_scanner 폴백 제거 → 스냅샷 단일 소스 | 중간 |

---

## ① 텔레그램 종목 수 — `buy_signal_alert.py`

### 문제

`get_recent_buy_signals()`가 confidence 상위 20개를 시장 구분 없이 반환.  
KR 장중 스캔 직후에는 KR 종목만 채워질 수 있음.

```python
# backend/services/buy_signal_alert.py:30-38 — 현재
result = await session.execute(
    select(ScanSnapshotItem)
    .where(
        ScanSnapshotItem.snapshot_id == snap,
        ScanSnapshotItem.category == "chart_buy",
    )
    .order_by(ScanSnapshotItem.confidence.desc())
    .limit(20)   ← 시장 구분 없음
)
items = result.scalars().all()
```

### 수정 코드

```python
# .limit(20) 제거 후 Python에서 KR/US 각 5개 추출
result = await session.execute(
    select(ScanSnapshotItem)
    .where(
        ScanSnapshotItem.snapshot_id == snap,
        ScanSnapshotItem.category == "chart_buy",
    )
    .order_by(ScanSnapshotItem.confidence.desc())
)
items = result.scalars().all()

# 시장별 각 5개 제한
kr_items = [i for i in items if i.market == "KR"][:5]
us_items = [i for i in items if i.market == "US"][:5]
items = kr_items + us_items
```

> `signals` 리스트 생성 이후 코드는 변경 없음.

---

## ② 스냅샷 반환 수량 — `full_market_scanner.py`

### 문제

`get_latest_snapshot()`이 chart_buy 항목을 수량 제한 없이 모두 반환.

```python
# backend/services/full_market_scanner.py:639 — 현재
final_chart_buy = live_chart_buy_items if live_chart_buy_items else chart_buy_items
# → confidence 내림차순 전체 반환
```

### 수정 코드

`get_latest_snapshot()` 함수 내부에 헬퍼 추가, 두 군데 적용.

```python
# 함수 내부 헬퍼 (get_latest_snapshot 로컬)
def _cap(items: list[dict]) -> list[dict]:
    kr = [i for i in items if i["market"] == "KR"][:5]
    us = [i for i in items if i["market"] == "US"][:5]
    return kr + us

# 변경 전
final_chart_buy = live_chart_buy_items if live_chart_buy_items else chart_buy_items

# 변경 후
final_chart_buy = _cap(live_chart_buy_items if live_chart_buy_items else chart_buy_items)
```

`live_chart_buy_items`만 반환하는 early return 경로(snapshot 없는 경우)도 동일하게 적용:

```python
# backend/services/full_market_scanner.py:598 — 현재
return {
    ...
    "chart_buy": {"items": live_chart_buy_items},
    ...
}

# 변경 후
return {
    ...
    "chart_buy": {"items": _cap(live_chart_buy_items)},
    ...
}
```

> `_cap` 헬퍼는 함수 밖 모듈 레벨에 두면 중복 없이 재사용 가능.

---

## ③ 독립 스캔 제거 — 3개 파일

### 3-A. `scheduler.py` — `scan_latest_buy()` 호출 블록 제거

```python
# backend/scheduler.py:183-188 — 제거 대상
async def _scheduled_scan():
    active = get_active_markets()
    result = await run_scan()       # ← 유지 (관심종목 신호 스캔)

    # ↓↓↓ 이 블록만 제거 ↓↓↓
    try:
        from services.chart_scanner import scan_latest_buy
        await scan_latest_buy("1d")
    except Exception as e:
        logger.warning(f"차트 BUY 스캔 실패: {e}")
    # ↑↑↑ 여기까지 제거 ↑↑↑
```

### 3-B. `routes/signals.py` — 스냅샷 조회로 교체

현재 `GET /signals/latest-buy`와 `POST /signals/latest-buy/refresh`가 `chart_scanner`를 직접 호출.

```python
# backend/routes/signals.py:75-94 — 현재
@router.get("/signals/latest-buy")
async def get_latest_buy():
    from services.chart_scanner import get_cache, scan_latest_buy
    results, scan_time = get_cache()
    if not results and not scan_time:
        results = await scan_latest_buy()
        _, scan_time = get_cache()
    return {"items": results, "scan_time": scan_time, "count": len(results)}

@router.post("/signals/latest-buy/refresh")
async def refresh_latest_buy():
    from services.chart_scanner import scan_latest_buy
    results = await scan_latest_buy()
    return {"items": results, "count": len(results), "status": "refreshed"}
```

```python
# 변경 후 — 스냅샷 단일 소스
@router.get("/signals/latest-buy")
async def get_latest_buy():
    """최신 스냅샷에서 chart_buy 종목 반환 (KR 5 + US 5)."""
    from services.full_market_scanner import get_latest_snapshot
    snapshot = await get_latest_snapshot()
    if not snapshot:
        return {"items": [], "scan_time": None, "count": 0}
    items = snapshot.get("chart_buy", {}).get("items", [])
    scan_time = snapshot.get("completed_at")
    return {"items": items, "scan_time": scan_time, "count": len(items)}

@router.post("/signals/latest-buy/refresh")
async def refresh_latest_buy():
    """스냅샷 재조회 (실시간 스캔 없음 — full_market_scanner 스냅샷 기반)."""
    from services.full_market_scanner import get_latest_snapshot
    snapshot = await get_latest_snapshot()
    if not snapshot:
        return {"items": [], "count": 0, "status": "no_snapshot"}
    items = snapshot.get("chart_buy", {}).get("items", [])
    return {"items": items, "count": len(items), "status": "ok"}
```

### 3-C. `chart_scanner.py` — 파일 전체 제거

`routes/signals.py` 교체 완료 후 `chart_scanner.py`를 참조하는 곳이 없으므로 파일 삭제.

참조처 전체 목록 (교체 전 확인):

| 파일 | 참조 | 처리 |
|------|------|------|
| `scheduler.py` | `scan_latest_buy` | 3-A에서 블록 제거 |
| `routes/signals.py` | `get_cache`, `scan_latest_buy` | 3-B에서 스냅샷으로 교체 |

> 위 두 곳 외에 `chart_scanner`를 import하는 파일 없음 → 삭제 가능.

---

## ④ unified_scanner 수량 — `unified_scanner.py`

### 문제

인메모리 스캔 결과도 KR 2개 + US 2개로 제한됨 (대시보드 폴백 경로).

```python
# backend/services/unified_scanner.py:281-282 — 현재
kr_buy = [r for r in buy_items if r["market"] == "KR"][:2]
us_buy = [r for r in buy_items if r["market"] == "US"][:2]
```

### 수정 코드

```python
# 변경 후
kr_buy = [r for r in buy_items if r["market"] == "KR"][:5]
us_buy = [r for r in buy_items if r["market"] == "US"][:5]
```

> ⑤ Dashboard 폴백 제거 후에는 이 경로가 실질적으로 사용되지 않지만,  
> API를 직접 호출하는 경우를 위해 통일해 둔다.

---

## ⑤ 대시보드 스냅샷 단일 소스 — `Dashboard.tsx`

### 문제

3군데에서 `fetchUnifiedCache()` 폴백이 존재:

| 위치 | 코드 | 설명 |
|------|------|------|
| `line 82~90` | 모바일 스냅 로드 | 스냅샷 실패 시 unified 폴백 |
| `line 649~673` | 마운트 데이터 로드 | 둘 다 로드해 더 최신 선택 |
| `line 709~718` | 스캔 완료 후 결과 로드 | 스냅샷 실패 시 unified 폴백 |

### 수정 방향 — 스냅샷 단일 소스

**모바일 스냅 (line 82~90)**

```typescript
// 변경 전
fetchFullScanLatest().then(r => {
  if (r?.status !== 'no_data' && r?.picks) {
    setMobileScan({ ... r.chart_buy?.items ... })
  } else {
    fetchUnifiedCache().then(r2 => {   // ← 폴백 제거
      setMobileScan({ ... r2?.chart_buy?.items ... })
    }).catch(() => {})
  }
})

// 변경 후
fetchFullScanLatest().then(r => {
  if (r?.status !== 'no_data' && r?.chart_buy) {
    setMobileScan({ buyItems: r.chart_buy?.items || [], overheatItems: r.overheat?.items || [], picks: r.picks })
  }
}).catch(() => {})
```

**마운트 데이터 로드 (line 643~673)**

```typescript
// 변경 전 — 둘 다 호출해 더 최신 선택
Promise.all([fetchFullScanLatest(), fetchUnifiedCache()])
  .then(([full, unified]) => { ... 타임스탬프 비교 ... })

// 변경 후 — 스냅샷만
fetchFullScanLatest().catch(() => null).then(full => {
  if (full?.status !== 'no_data' && full?.picks) {
    applyResult(full)
  }
})
```

**스캔 완료 후 결과 로드 (line 705~718)**

```typescript
// 변경 전
const full = await fetchFullScanLatest()
if (full?.status !== 'no_data' && full?.picks) {
  applyResult(full)
} else {
  const result = await fetchUnifiedCache()   // ← 폴백 제거
  applyResult(result)
}

// 변경 후
const full = await fetchFullScanLatest()
if (full?.status !== 'no_data' && full?.picks) {
  applyResult(full)
}
```

> `fetchUnifiedCache`, `runUnifiedScan` import에서도 제거 가능 (미사용 시).

---

## 적용 순서 권고

독립적인 변경이므로 어떤 순서로도 적용 가능. 위험도 낮은 순으로:

```
① (텔레그램 수량)  →  ② (스냅샷 수량)  →  ④ (unified 수량)
  →  ③ (독립 스캔 제거: 3-A → 3-B → 3-C 순서로)  →  ⑤ (Dashboard 폴백 제거)
```

- **①②**: 백엔드 1~2줄, 동작 변화 거의 없음 — 즉시 적용 가능
- **④**: unified_scanner 수량 통일 — 1줄 변경
- **③**: 3-A 제거 후 3-B 교체 확인 → 3-C 파일 삭제 (순서 중요)
- **⑤**: 폴백 제거로 스냅샷 없을 때 빈 화면 가능 — ③ 완료 후 적용

---

## 검증 체크리스트

### ①
- [ ] 텔레그램 테스트 전송 후 KR 최대 5개 + US 최대 5개 확인
- [ ] KR 장중 스캔 직후 전송 시 US 0개여도 KR 5개만 표시 (정상)

### ②
- [ ] `GET /scan/full/latest` 응답 `chart_buy.items`에서 KR ≤ 5개 + US ≤ 5개 확인

### ③
- [ ] `GET /signals/latest-buy` 응답이 스냅샷 데이터를 반환하는지 확인
- [ ] `POST /signals/latest-buy/refresh` 호출 후 스캔 없이 즉시 응답 반환 확인
- [ ] `chart_scanner.py` 삭제 후 서버 재시작 에러 없음 확인

### ④
- [ ] `GET /scan/unified` 응답 `chart_buy.items`에서 KR ≤ 5개 + US ≤ 5개 확인

### ⑤
- [ ] 서버 재시작 후 대시보드 마운트 시 스냅샷 데이터 정상 표시
- [ ] 스냅샷 없는 상태에서 빈 화면 처리 확인 (graceful empty state)
- [ ] `fetchUnifiedCache` 호출이 네트워크 탭에서 사라졌는지 확인

---

## 파일별 변경 요약

| 파일 | 변경 유형 | 변경 규모 |
|------|----------|---------|
| `backend/services/buy_signal_alert.py` | 수정 | 5줄 |
| `backend/services/full_market_scanner.py` | 수정 | 10줄 |
| `backend/scheduler.py` | 수정 (제거) | -5줄 |
| `backend/routes/signals.py` | 수정 | 15줄 교체 |
| `backend/services/chart_scanner.py` | **파일 삭제** | -155줄 |
| `backend/services/unified_scanner.py` | 수정 | 2줄 |
| `frontend/src/pages/Dashboard.tsx` | 수정 | 20줄 교체 |
