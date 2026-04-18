# Tasks: KR 개별주 PER/PBR/EPS/BPS 네이버 파이낸스 보강

**Input**: Design documents from `/specs/023-kr-naver-fundamentals/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/company.openapi.yaml, quickstart.md

**Tests**: 스펙(FR-007·FR-008·US2 Acceptance)에서 명시 요청 → 단위·통합 테스트 포함.

**Organization**: US1 / US2 / US3 단위 + Setup · Foundational · Polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 파일 다르고 선행 의존 없을 때 병렬
- **[Story]**: US1(주요 KR 대형주 보강) / US2(폴백) / US3(출처 표기)

## Path Conventions
풀스택 Web — `backend/`, `frontend/src/`. 22 기능 기반 위에 얹는다.

---

## Phase 1: Setup

- [X] T001 [P] `backend/tests/fixtures/` 디렉토리 생성 + 네이버 파이낸스 SK하이닉스 페이지 스냅샷 저장 (`backend/tests/fixtures/naver_000660.html`) — 실제 `curl` 응답을 `euc-kr` 디코딩해 저장, 테스트 입력으로 사용
- [X] T002 [P] `backend/tests/fixtures/naver_005930.html` 저장 (삼성전자, 우선주 아닌 보통주)

---

## Phase 2: Foundational (Blocking)

**Purpose**: 모든 스토리가 의존하는 네이버 크롤러 모듈 골격 + 스킵 판정 + 캐시 구조.

- [X] T003 `backend/services/naver_fundamentals.py` 신설 — 모듈 레벨 `_cache`, `_locks`, `_stats(ok/fail/recent_fails deque)` 정의, `NAVER_URL_TEMPLATE`, `TTL_SECONDS = 86400`, `TIMEOUT_SECONDS = 3`, `UA_HEADER` 상수, `NaverFundamentalsPayload` TypedDict 선언 (data-model §1·§4·§5 참조)
- [X] T004 `backend/services/naver_fundamentals.py`에 `_is_target(symbol: str, asset_class: str, market: str) -> bool` 헬퍼 추가 — FR-009 스킵 규칙(STOCK_KR + 6자리 숫자 symbol만 True). 단위 테스트로 커버 (T005와 함께)
- [X] T005 `backend/tests/unit/test_naver_fundamentals.py` 신설 — `_is_target` 스킵 규칙 파라메트릭 테스트 (005930/KR→True, AAPL/US→False, 069500/KR→True only if not in ETF set → False 예상, BTC-USD/CRYPTO→False)

**Checkpoint**: 모듈 뼈대·스킵 판정 준비 완료. US1 병렬 진행 가능.

---

## Phase 3: US1 — 주요 KR 대형주 보강 (P1) 🎯 MVP

**Goal**: 네이버에서 PER/PBR/EPS/BPS + reporting_period를 추출해 yfinance 결측을 대체.

**Independent Test**: SK하이닉스(000660) 상세 → 가치 탭 진입 시 PER 18.9배 등 실제 값 4개가 `—` 없이 노출.

- [X] T006 [US1] `backend/services/naver_fundamentals.py`에 `_parse_html(html: str) -> NaverFundamentalsPayload` 추가 — `BeautifulSoup(html, 'html.parser')` 사용, `div.aside_invest_info` 내 `<th>PER</th>...<em>18.9</em>` 라벨 기반 탐색으로 PER/PBR/EPS/BPS 각각 추출. "YYYY.MM" → "YYYY-Q#" 변환으로 `reporting_period` 계산. 각 필드 실패는 개별 None (research R2·R8·R9)
- [X] T007 [P] [US1] `backend/tests/unit/test_naver_fundamentals.py`에 `test_parse_sk_hynix(fixture)` 추가 — fixtures/naver_000660.html 입력 → `per≈18.9, pbr≈6.4, eps==58954, bps==174538, reporting_period=="2025-Q4"` 검증
- [X] T008 [P] [US1] 동일 테스트 파일에 `test_parse_samsung(fixture)` — fixtures/naver_005930.html 기반 파싱 검증
- [X] T009 [US1] `backend/services/naver_fundamentals.py`에 `async def fetch(symbol: str) -> NaverFundamentalsPayload | None` 추가 — 캐시 확인 → miss 시 `_locks[symbol]` 아래서 `httpx.AsyncClient.get(url, headers=UA, timeout=3)` → `content.decode('euc-kr', 'ignore')` → `_parse_html` → 캐시 저장 + `_stats.ok += 1`. 동일 symbol 동시 진입 시 하나만 네트워크 요청 (research R3·R4·R5)
- [X] T010 [US1] `backend/routes/company.py`의 `_fetch_company` 또는 엔드포인트 후처리 단계에서 `asset_class == STOCK_KR` + `_is_target` 통과 시 `await naver_fundamentals.fetch(symbol)` 호출 → 반환된 non-None 값으로 `metrics.per/pbr/eps/bps` **덮어쓰기**, `reporting_period`도 네이버 값 있으면 교체. 네이버 반환이 None이면 yfinance 원값 유지 (FR-002)
- [X] T011 [P] [US1] `backend/tests/integration/test_company_endpoint.py`에 `test_stock_kr_enriched_by_naver` 추가 — `naver_fundamentals.fetch`를 monkeypatch로 고정 값 반환, KR 종목 응답에서 per/pbr/eps/bps가 네이버 값으로 나오는지 검증

**Checkpoint US1**: KR 대형주에서 네 지표 결측 제거.

---

## Phase 4: US2 — 보강 실패 시 폴백 (P1)

**Goal**: 네이버 실패 시 조용히 yfinance 값 폴백, 서비스 무중단.

**Independent Test**: 네이버 요청을 강제 타임아웃시킨 상태에서 `/api/company/000660?market=KR` → 200 응답, per는 yfinance(None 또는 값) 그대로.

- [ ] T012 [US2] `backend/services/naver_fundamentals.py::fetch` 예외 처리 확장 — `httpx.TimeoutException`/`HTTPError` → `_stats.fail += 1` + `_stats.recent_fails.append({symbol, stage:"network", error, ts})` + `return None`. 디코드 실패(`UnicodeDecodeError`) → stage="decode", 파싱 실패(`KeyError/IndexError/ValueError`) → stage="parse" (FR-003·FR-007)
- [ ] T013 [P] [US2] `backend/tests/integration/test_company_endpoint.py`에 `test_stock_kr_naver_timeout_falls_back` — monkeypatch로 `fetch`가 None 반환 강제 → 응답 200, per는 yfinance 원값(테스트에선 fake), metric_sources는 전부 "yfinance"
- [ ] T014 [P] [US2] 동일 파일에 `test_stock_kr_naver_partial_failure` — monkeypatch로 `{per:18.9, pbr:None, eps:58954, bps:None}` 반환 → per/eps는 네이버, pbr/bps는 yfinance 폴백, 응답 200
- [ ] T015 [US2] `backend/routes/system.py`에 `GET /api/system/naver-stats` 추가 — `naver_fundamentals._stats` 읽어 `{ok, fail, success_rate, recent_fails}` 직렬화 반환 (FR-008). 라우터 등록 확인
- [ ] T015a [P] [US2] `backend/tests/unit/test_naver_fundamentals.py`에 `test_concurrent_fetch_dedup` 추가 — SC-004(중복 호출 0%) 자동 검증:
  - `httpx.AsyncClient.get`을 monkeypatch로 **호출 카운터 + 고정 HTML 반환** fake로 치환
  - `asyncio.gather`로 동일 symbol "000660"에 대해 `fetch()`를 5번 동시 호출
  - 기대: 네트워크 호출 카운터 == **1** (첫 진입만 네트워크, 나머지 4개는 Lock 대기 후 캐시 공유)
  - 기대: 5개 결과 payload 모두 동일 객체

**Checkpoint US2**: 네이버 장애 상황에서도 기존 UX 유지.

---

## Phase 5: US3 — 출처 표기 (P2)

**Goal**: 각 지표 카드에 "네이버" 또는 "yfinance" 소스 라벨 표기.

**Independent Test**: 가치 탭에서 PER 카드 sublabel이 `"주가/순이익 · 네이버"`, ROE 카드 sublabel이 `"자기자본이익률 · yfinance"`로 노출.

- [ ] T016 [US3] `backend/routes/company.py` — 응답에 `metric_sources: dict[str, "naver"|"yfinance"]` 필드 추가. 네이버 보강 성공한 지표는 "naver", 나머지는 "yfinance". 스킵 대상(US/Crypto/ETF)은 모든 키 "yfinance". (data-model §2)
- [ ] T017 [P] [US3] `backend/tests/integration/test_company_endpoint.py`에 `test_metric_sources_labels` — KR 보강 성공 응답에 `metric_sources.per == "naver"`, `metric_sources.roe == "yfinance"` 검증
- [ ] T018 [P] [US3] `frontend/src/api/client.ts` — `type MetricSource = 'naver' | 'yfinance'` 추가, `CompanyInfoResponse.metric_sources?: Partial<Record<keyof InvestmentMetrics, MetricSource>> & { sector?: MetricSource }` 필드 타입 추가
- [ ] T019 [US3] `frontend/src/components/ValueAnalysisTab.tsx` 수정 — 카드 구성 시 각 metric 키의 `data.metric_sources?.[key]`를 읽어 한글 라벨로 매핑(`naver`→"네이버", `yfinance`→"yfinance"). 기존 sublabel 뒤에 `· ${sourceLabel}`로 병합 (Q4 결정). 라벨이 없으면 소스 표기 생략
- [ ] T020 [P] [US3] `frontend/src/components/ValueAnalysisTab.tsx` — 헤더의 `reporting_period` 표시는 그대로 유지하되, 네이버 보강으로 갱신된 기준일이 올 경우 자연스럽게 반영됨을 수동 확인(코드 변경 없음)

**Checkpoint US3**: 사용자가 각 값의 소스를 상시 확인 가능.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T021 [P] 수동 시나리오 4종 실행 (quickstart §6):
  1) 000660 KR — PER 18.9 등 노출 + "네이버" 라벨
  2) 005930 KR — 네 지표 노출
  3) AAPL US — sublabel 전부 "yfinance", 네이버 호출 없음 (stats 불변)
  4) 069500 KR ETF — 가치 탭 disabled 유지, 네이버 호출 없음
- [ ] T022 [P] `/api/system/naver-stats` 호출 결과 확인 — 1,2번 시나리오 후 `ok >= 2`, `recent_fails` 비어있음
- [ ] T023 네이버 강제 실패 시뮬레이션 — `naver_fundamentals.fetch`를 임시로 `raise Exception` 주입하거나 DNS 차단으로 테스트 → 응답 200 유지 + stats.fail 증가
- [ ] T024 회귀 체크 — 022 가치 탭의 11개 카드 구성·하이라이트·중요도 순서 그대로 유지, `rules/*.md` 보호 파일 무변경, 전체 스캔(`/api/scan/full/latest`) 완료 시간 변동 없음 (SC-006)
- [ ] T025 SR-01~05 준수 — cloudflared 보존 확인 후 uvicorn만 재시작 → `pnpm build` → `pnpm dev` → 강제 리로드(Cmd+Shift+R) (quickstart §3·§5·§8)
- [ ] T026 [P] KR 대형주 30종목 커버리지 측정 스크립트 — SC-001 달성 여부 숫자 증명. `backend/scripts/audit_naver_coverage.py` 신설:
  - 샘플 심볼: `KOSPI200_SYMBOLS`에서 앞 30개 (또는 시총 상위 하드코딩 리스트)
  - 각 symbol에 대해 `await naver_fundamentals.fetch(sym)` 호출 (1초 간격 sleep로 네이버 부하 완화)
  - PER/PBR/EPS/BPS 4개 중 non-None 개수 집계
  - 출력 형식: `"symbol: per=X pbr=Y eps=Z bps=W (채움 N/4)"` + 마지막에 `"전체 30종목 평균 N.M개 채워짐 (P% 커버리지)"`
  - 실행: `cd backend && .venv/bin/python scripts/audit_naver_coverage.py`
  - 합격 기준 (SC-001): **30종목 평균 ≥ 3.0개** 충족 시 PASS. 미달 시 네이버 페이지 구조 변경 의심 → T006 파싱 로직 점검

---

## Dependencies

```
Setup(T001-T002)       HTML fixtures
        │
Foundational(T003-T005) 모듈 뼈대·스킵 판정
        │
        ├─ US1(T006-T011)  파싱·fetch·통합
        │       │
        │       └─ US2(T012-T015a)  폴백·stats·엔드포인트·dedup 테스트
        │                │
        │                └─ US3(T016-T020) metric_sources + 프론트 sublabel
        │
        └─ Polish(T021-T026) 수동 검증·재시작·30종목 커버리지 측정(SC-001)
```

스토리 독립성:
- US1이 최소 MVP (네 지표 결측 복구만으로도 사용자 가치 성립)
- US2는 운영 안정성 — US1 후 바로 이어 진행
- US3는 UX 보조 — US1 + US2 완료 후 진행

## Parallel Execution Examples

**Setup 병렬**: T001 ‖ T002 (다른 fixture 파일)

**US1 파싱 테스트 병렬**:
```
T006 → 이후 T007 ‖ T008 ‖ T011 (서로 다른 테스트 케이스, 같은 파일이라도 함수 단위 분리 시 순차로 추가해도 OK)
```

**US2 실패 시나리오 병렬**: T013 ‖ T014 (monkeypatch 분리, 서로 간섭 없음)

**US3 병렬**: T017 (백엔드 테스트) ‖ T018 (프론트 타입) — 파일 다름

**Polish 병렬**: T021 ‖ T022

## Implementation Strategy (MVP-first)

1. **1차 릴리즈 (US1)**: Setup + Foundational + Phase3 — KR 대형주 PER/PBR/EPS/BPS 결측 복구. 사용자 체감 가치 가장 큰 지점.
2. **2차 릴리즈 (US2)**: 폴백 + 관측. 네이버 장애 노출 위험 제거.
3. **3차 릴리즈 (US3)**: 출처 라벨. UX 투명성·신뢰도 보강.
4. **Polish**: 4종 시나리오 회귀·스캔 속도 무변동 확인 후 재시작.
