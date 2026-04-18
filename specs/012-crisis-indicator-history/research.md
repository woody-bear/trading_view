# Research: 위기 이벤트 시장 지표 히스토리

**Branch**: `012-crisis-indicator-history` | **Date**: 2026-04-02

## Decision 1: 시장 지표 데이터 소스 및 커버리지

**Decision**: yfinance를 기본 데이터 소스로 사용, `period='max'` 파라미터로 전체 기간 조회. 데이터 가용 범위에 따라 지표 카테고리를 3단계로 분류.

**Findings**:
| 티커 | 시작일 | 커버리지 |
|------|--------|---------|
| ^GSPC (S&P500) | 1950-01-03 | 전 이벤트 ✓ |
| ^IXIC (NASDAQ) | 1971-02-05 | 1971 이후 ✓ |
| ^TNX (미국채10년) | 1962-01-02 | 1962 이후 ✓ |
| DX-Y.NYB (달러인덱스) | 1971-01-04 | 1971 이후 ✓ |
| ^KS11 (코스피) | 1996-12-11 | 1997 이후 |
| GC=F (금 선물) | 2000-08-30 | 2000 이후 |
| CL=F (WTI 원유) | 2000-08-23 | 2000 이후 |
| KRW=X (원/달러) | 2003-12-01 | 2003 이후 |

- 1973년 오일쇼크: ^GSPC, ^TNX 2개 지표만 완전 커버 (50%)
- 2000년 이후 이벤트: 모든 8개 지표 완전 커버 (100%)
- 8개 지표 전체 초기 다운로드: ~11초 (rate limit 없음, 안전)

**현재 코드 제약**: `chart_cache.py`의 `_yf_period()`가 최대 5년으로 제한 → 위기 이벤트용 별도 fetcher에서 `period='max'` 직접 사용 필요.

**Rationale**: yfinance는 기존 프로젝트에서 이미 사용 중이며, 위기 이벤트용 데이터는 정적 특성(이미 지나간 사건)이라 월 1회 갱신으로 충분. 추가 유료 서비스 불필요.

**Alternatives considered**: Alpha Vantage (무료 티어 하루 25콜 제한), FRED API (거시경제 지표에 좋지만 주가지수 미지원).

---

## Decision 2: "가장 유사한 과거 이벤트" 자동 매칭 방식

**Decision**: 큐레이터가 수동으로 `best_comparison_event_id`를 설정 (Option C). 카테고리 기반 폴백 (Option A)을 보조 전략으로 사용.

**Rationale**:
- 패턴 매칭(DTW/상관계수)은 현재 진행 중인 이벤트가 14일 미만인 경우 데이터 부족으로 오매칭 위험이 높음
- 투자 판단 목적에서는 "이란-미국 갈등 → 1973년 오일쇼크"처럼 맥락을 아는 전문가 판단이 알고리즘보다 신뢰성 높음
- 15-20개 이벤트 규모에서 큐레이터 유지 비용 최소 (새 이벤트당 ~30분)

**Alternatives considered**:
- 상관계수/DTW 패턴 매칭: 진행 중 이벤트 초기 오매칭 위험, ML 인프라 필요 → 기각
- 카테고리만: 같은 카테고리 내 이벤트도 성격이 다름 (1973 오일쇼크 vs 2022 러-우 전쟁) → 단독 사용 기각

**구현**: CrisisEvent에 `best_comparison_event_id` (nullable FK) 추가. NULL이면 카테고리 폴백 사용.

---

## Decision 3: 모바일 제스처 충돌 해결 — 좌우 스와이프 vs 차트 드래그

**Decision**: Zone-based separation (구역 분리). 상단 영역 = 이벤트 전환 스와이프(touch-action: pan-y), 차트 영역 = lightweight-charts 드래그(touch-action: manipulation).

**Pattern**:
```
[이벤트 선택 칩 / 헤더 영역]  ← touch-action: pan-y (브라우저가 좌우 스와이프 처리)
[차트 영역]                    ← touch-action: manipulation (lightweight-charts가 드래그 처리)
[요약 통계 카드]               ← 스크롤
```

**Rationale**: 브라우저 네이티브 처리 활용, 커스텀 JS 제스처 로직 불필요. 기존 프로젝트의 `scrollSnapType: y mandatory` 패턴과 일관성 유지. Bloomberg 모바일 앱과 동일 방식.

**Alternatives considered**:
- 속도 임계값(velocity threshold): 커스텀 JS 구현 필요, 엣지케이스 많음 → 복잡도 대비 이점 없음
- 전체화면 스와이프만 (차트 드래그 없음): SC-001 "3초 내 차트 표시" + FR-010 "스와이프로 탐색" 양립 가능하나 차트 인터랙션성 저하 → 기각

---

## Decision 4: 데이터 저장 전략 — 기존 캐시 구조 활용

**Decision**: 새로운 SQLite 테이블 `crisis_event`, `market_indicator`, `indicator_data_point`, `event_indicator_stats`를 추가. 기존 `chart_cache` 테이블과 분리.

**Rationale**:
- 위기 이벤트 데이터는 정적 (1950-현재, 월 1회 갱신) → chart_cache의 TTL 기반 캐시와 성격이 다름
- 위기 이벤트마다 데이터 범위가 다름 (±180일) — 기존 chart_cache 스키마와 맞지 않음
- 분리하면 유지보수 및 백업이 명확해짐

**Alternatives considered**: 기존 chart_cache 확장 — 이벤트 ID 없이 symbol 기반인 기존 스키마와 충돌 → 기각

---

## Decision 5: 데이터 갱신 주기 — 현재 진행 중 이벤트

**Decision**: 현재 진행 중 이벤트의 시장 데이터는 **일별 갱신** (기존 APScheduler 크론 활용, 새벽 2시 KST). 과거 완료 이벤트 데이터는 초기 1회 적재 후 변경 없음.

**Rationale**: SC-007 "3초 내 자동 표시" 충족을 위해 실시간 조회보다 캐시 선제 갱신 방식이 안전. 1일 지연은 장중 변동보다 위기 패턴 비교라는 사용 목적에 충분.

**Alternatives considered**: 실시간 가격 조회 (기존 SSE 활용) — 위기 이벤트 비교는 일별 변화가 핵심이므로 분봉 불필요 → 오버엔지니어링.
