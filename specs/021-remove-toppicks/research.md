# Research: 추천종목(TopPicks) 기능 완전 삭제

**Branch**: `021-remove-toppicks` | **Date**: 2026-04-12

> 이 기능은 코드 삭제 작업으로, 사전 분석이 완료된 상태에서 진행한다.
> NEEDS CLARIFICATION 없음 — 모든 의존성이 확인되었음.

## 분석 결과 요약

### Decision 1: 삭제 범위 확정

**Decision**: Frontend UI + API Client + Backend Route/Service + DB 테이블 전체 삭제

**Rationale**:
- `TopPicks.tsx`는 이미 `App.tsx`에서 라우트 미등록 상태 (dead page)
- `BottomNav.tsx`에 picks 탭 없음 (네비게이션 수정 불필요)
- `market_scanner.py`는 `market_scan.py` 라우터에서만 import → 함께 삭제 안전
- `daily_top_pick` 테이블은 `market_scanner.py`에서만 읽기/쓰기

**Alternatives considered**: UI만 제거하고 백엔드 유지 → 불필요한 코드 잔존, 유지보수 부담

---

### Decision 2: full_market_scanner.py 처리 방식

**Decision**: `categories.append("picks")` 3줄 제거, 나머지 스캔 로직 유지

**Rationale**:
- `chart_buy`, `overheat`, `max_sq` 카테고리는 **독립 조건**으로 picks와 무관
- `ScanSnapshotItem` 테이블 자체는 다른 카테고리가 사용하므로 유지
- picks 분류 조건만 제거해도 스캐너 전체 동작에 영향 없음

**Alternatives considered**: full_market_scanner.py 전체 삭제 → 다른 스캔 기능(BUY/과열) 손상

---

### Decision 3: DB 마이그레이션 방식

**Decision**: 새 Alembic revision 파일 생성 → `DROP TABLE daily_top_pick`

**Rationale**:
- 기존 migration `2e6619788423_add_daily_top_pick.py`에 downgrade가 있으나,
  `alembic downgrade`는 연쇄 다운그레이드 위험이 있음
- 새 revision 파일로 forward migration으로 DROP하는 것이 안전

**Alternatives considered**: 기존 migration downgrade → 다른 테이블에 영향 가능성

---

### Decision 4: ScanSnapshotItem 기존 데이터 처리

**Decision**: 기존 `category="picks"` 데이터는 그대로 유지, 신규 생성만 중단

**Rationale**:
- 기존 데이터 삭제 시 쿼리/트랜잭션 복잡도 증가
- 읽는 코드가 제거되므로 기존 데이터는 무해함
- 시간이 지나면 scan_snapshot 테이블 TTL 또는 수동 정리로 처리 가능

---

## 파일별 변경 세부 내역

### frontend/src/pages/Dashboard.tsx

제거 대상:
- `mobileScan` 상태의 `picks` 필드
- `allPicks` 배열 생성 로직 (코스피 2 + 코스닥 2 + 미국 1)
- picks 관련 렌더링 블록 (Section/Card)
- `fetchLatestPicks` import (사용 제거 후)

유지 대상:
- `buyItems`, `overheatItems` 상태 및 렌더링
- `fetchFullScanLatest()` 호출 자체 (다른 데이터에 사용)

### frontend/src/pages/Scan.tsx

제거 대상:
- `scanData` 상태의 `picks` 필드
- `allPicks` 계산 로직
- Section 3 "추천종목" 전체 렌더링 블록

유지 대상:
- `buyItems`, `overheatItems` 관련 모든 코드
- `fetchFullScanLatest()`, `fetchUnifiedCache()` 호출

### frontend/src/api/client.ts

제거 대상:
- `fetchLatestPicks()` 함수 (`api.get('/scan/market/latest')`)
- `scanMarket()` 함수 (`api.post('/scan/market')`)

유지 대상:
- `runUnifiedScan()`, `fetchUnifiedCache()`, `fetchScanStatus()`
- `fetchFullScanLatest()`, `fetchFullScanStatus()`, `triggerFullScan()`

### backend/routes/market_scan.py

제거 대상:
- `POST /api/scan/market` 엔드포인트 (라인 46~71)
- `GET /api/scan/market/latest` 엔드포인트 (라인 74~102)
- `_save_daily()` 내부 함수 (라인 105~126)
- `market_scanner` 관련 import

유지 대상:
- `GET /api/scan/status`
- `POST /api/scan/unified`, `GET /api/scan/unified`
- `/scan/full/*` 엔드포인트 전체
- `GET /api/scan/symbols`

### backend/services/market_scanner.py

- 파일 전체 삭제 (ScanResult, _check_trend, scan_market 함수)
- `market_scan.py`에서만 import됨 → 라우터 정리 후 안전하게 삭제

### backend/services/full_market_scanner.py

제거 대상 (3줄):
```python
# 라인 296~300 근처
if last_sq >= 1 and trend == "BULL":
    categories.append("picks")
```

유지 대상:
- `chart_buy` 분류 조건
- `overheat` 분류 조건
- `max_sq` 분류 조건
- `ScanSnapshot`, `ScanSnapshotItem` INSERT 로직 전체

### backend/models.py

제거 대상:
- `DailyTopPick` 클래스 (라인 157~181)
- 관련 Index 정의

### Alembic migration (신규)

```python
# 새 revision 파일
def upgrade():
    op.drop_table('daily_top_pick')

def downgrade():
    # daily_top_pick 재생성 (원복용)
    op.create_table('daily_top_pick', ...)
```
