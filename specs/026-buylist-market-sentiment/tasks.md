# Tasks: BUY 종목리스트 개편 + 시장분위기 누적막대 차트

**Input**: Design documents from `/specs/026-buylist-market-sentiment/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1~US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (공유 인프라)

**Purpose**: 마이그레이션 환경 확인 및 신규 파일 스캐폴딩

- [X] T001 기존 alembic 마이그레이션 이력 확인 및 최신 리비전 점검 `backend/alembic/versions/`
- [X] T002 [P] `backend/schemas/market_sentiment.py` 빈 파일 생성 (스키마 모듈 슬롯 확보)
- [X] T003 [P] `backend/services/market_sentiment_service.py` 빈 파일 생성

---

## Phase 2: Foundational (블로킹 전제 조건)

**Purpose**: 모든 유저 스토리 구현 전 완료되어야 하는 DB·지표 기반 작업

**⚠️ CRITICAL**: Phase 2 완료 전 Phase 3+ 시작 불가

- [X] T004 `backend/indicators/ema.py`의 `calculate_ema()` 함수에 EMA 10 추가 — 반환 dict에 `ema_10` 키 포함, 기존 키 유지
- [X] T005 Alembic 마이그레이션 파일 작성 — `backend/alembic/versions/a1b2c3d4e5f6_add_sector_to_stock_master.py` (`sector VARCHAR(100) DEFAULT '기타'`, 롤백 포함) + StockMaster 모델 sector 필드 추가
- [X] T006 마이그레이션 실행 후 StockMaster sector 초기값 채우기 스크립트 작성 `backend/scripts/populate_sector.py` — US: yfinance `info['sector']`, KR: market_type 매핑(KOSPI/KOSDAQ), CRYPTO: "암호화폐"
- [X] T007 `backend/schemas/market_sentiment.py`에 Pydantic 스키마 정의 — `EmaAlignmentStats`, `VolumeSpikePeriod`, `VolumeSpikeStats`, `MarketSentimentByMarket`, `MarketSentimentResponse`

**Checkpoint**: EMA 10 계산 가능 + sector 컬럼 존재 → Phase 3~5 병렬 시작 가능

---

## Phase 3: User Story 1 - 화면 텍스트 정리 (Priority: P1) 🎯 MVP

**Goal**: 타이틀 "종목리스트" 변경, "전체 스캔 대상 종목" 텍스트 삭제

**Independent Test**: 브라우저에서 /buy-list 진입 후 타이틀 및 삭제 텍스트 육안 확인

- [X] T008 [US1] `frontend/src/pages/BuyList.tsx:772` 타이틀 텍스트 "BUY 조회종목 리스트" → "종목리스트" 변경
- [X] T009 [US1] `frontend/src/pages/BuyList.tsx:773` "전체 스캔 대상 종목" 텍스트 노드 삭제
- [X] T010 [US1] `pnpm build` 실행 후 브라우저에서 텍스트 변경 확인

**Checkpoint**: 화면 타이틀·텍스트 정리 완료, 기존 기능 이상 없음

---

## Phase 4: User Story 2 - 시총 분포 차트 순서 조정 (Priority: P2)

**Goal**: 시총 분포 100% 누적 막대 차트를 KR → US → CRYPTO 순서로 재정렬, CRYPTO 분포 추가

**Independent Test**: 시총 분포 차트에서 KR 행이 위, US 중간, CRYPTO 아래로 표시됨

- [X] T011 [US2] `backend/services/market_cap_distribution.py` 수정 — `compute_distribution()` 내 CRYPTO 10종목 시총 yfinance 조회 로직 추가 및 반환 dict에 `crypto` 키 포함
- [X] T012 [US2] `backend/routes/market_scan.py` `/scan/symbols/market-cap-distribution` 엔드포인트 응답에 CRYPTO 포함 확인 (서비스 변경 반영)
- [X] T013 [US2] `frontend/src/api/client.ts` — `MarketCapDistributionResponse` 타입에 `crypto?` 키 추가
- [X] T014 [US2] `frontend/src/pages/BuyList.tsx` 시총 분포 차트 렌더링 순서 KR → US → CRYPTO 로 변경 (3열 grid)
- [ ] T015 [US2] 백엔드 재시작 후 `curl /scan/symbols/market-cap-distribution` 응답에 crypto 키 확인 및 브라우저 차트 순서 육안 확인

**Checkpoint**: 시총 분포 차트 KR→US→CRYPTO 순서 표시, CRYPTO 분포 데이터 존재

---

## Phase 5: User Story 3 - EMA 정배열/역배열 비율 차트 (Priority: P2)

**Goal**: KR/US/CRYPTO 시장별 EMA 정배열·역배열·기타 비율 100% 누적 막대 차트 표시

**Independent Test**: EMA 배열 차트 3행(KR/US/CRYPTO) 각각 정배열+역배열+기타 = 100% 확인

- [X] T016 [P] [US3] `backend/services/market_sentiment_service.py` EMA 집계 로직 구현 — 시장별 종목 목록 조회 → yfinance 200봉 OHLCV 배치 로드 → `calculate_ema()` → EMA5>10>20>60>120 정배열 / 역배열 판정 → `EmaAlignmentStats` 반환. 캔들 120봉 미만 종목 제외. 30분 TTL 캐시
- [X] T017 [P] [US3] `frontend/src/api/client.ts` 타입 추가 — `EmaAlignmentStats`, `MarketSentimentByMarket`, `MarketSentimentResponse` + `fetchMarketSentiment()` 함수 (`GET /scan/market-sentiment`)
- [X] T018 [US3] `backend/services/market_sentiment_service.py` 거래량 급등 집계 로직 구현 — 시장별 최근 60영업일 OHLCV → 직전 20일 평균 → 룩백 20/30/60일 판정 → `VolumeSpikeStats` 반환. StockMaster.sector JOIN으로 top_sector 산출
- [X] T019 [US3] `backend/services/market_sentiment_service.py` `compute_market_sentiment()` async 함수 완성 — EMA 집계 + 거래량 급등 집계 결합 → `MarketSentimentResponse` 반환
- [X] T020 [US3] `backend/routes/market_scan.py` `GET /scan/market-sentiment` 라우터 추가 — `compute_market_sentiment()` 호출, Pydantic 응답 모델 적용
- [X] T021 [P] [US3] `frontend/src/components/EmaAlignmentBar.tsx` 신규 컴포넌트 작성 — 정배열(#22c55e)/역배열(#ef4444)/기타(#6b7280) 3구간 100% 누적 바 + 로딩 스켈레톤
- [X] T022 [US3] `frontend/src/pages/BuyList.tsx` EMA 배열 차트 영역 추가 — 시총 분포 아래, 거래량 급등 위. KR/US/CRYPTO 행 세로 나열. 컨테이너 너비 30% 왼쪽 정렬
- [ ] T023 [US3] 백엔드 재시작 후 `curl /scan/market-sentiment` 응답 검증 (KR.ema_alignment.golden_pct + death_pct + other_pct ≈ 100) 및 브라우저 차트 확인

**Checkpoint**: EMA 배열 차트 3행 정상 렌더링, 비율 합계 100% 검증

---

## Phase 6: User Story 4 - 거래량 급등 비율 차트 + 상위 섹터 표시 (Priority: P3)

**Goal**: KR/US/CRYPTO 시장별 룩백 20/30/60일 거래량 급등 비율 차트 + 상위 섹터명 표시

**Independent Test**: 거래량 급등 차트 3행(KR/US/CRYPTO) 각 행에 20/30/60일 수치와 섹터명 확인

- [X] T024 [P] [US4] `frontend/src/components/VolumeSpikeBar.tsx` 신규 컴포넌트 작성 — 룩백 3행(20/30/60일): 급등 비율(주황 #f97316)/나머지(회색) 2구간 + 비율(%) + top_sector 레이블. 로딩 스켈레톤 포함
- [X] T025 [US4] `frontend/src/pages/BuyList.tsx` 거래량 급등 차트 영역 추가 — EMA 배열 차트 아래. KR/US/CRYPTO 행 세로 나열. 동일 30% 너비 왼쪽 정렬 컨테이너
- [ ] T026 [US4] 브라우저에서 거래량 급등 차트 확인 — 20/30/60일 3개 수치 표시, top_sector 텍스트 노출, 에러/로딩 상태 확인

**Checkpoint**: 거래량 급등 차트 + 섹터 표시 정상 동작

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 전체 화면 통합 검증 및 마무리

- [ ] T027 `frontend/src/pages/BuyList.tsx` 전체 레이아웃 검토 — 배치 순서(시총→EMA→거래량), 30% 너비 정렬, 모바일/PC 뷰 이상 없음 확인
- [ ] T028 [P] 빈 상태(종목 0개) 및 데이터 로딩 실패 시 에러 표시 UI 검증 (FE-05 준수)
- [ ] T029 백엔드 재시작 + `pnpm build` + `pnpm dev` 순서로 전체 스택 재시작 후 `quickstart.md` 체크리스트 전 항목 통과 확인
- [ ] T030 [P] `backend/scripts/populate_sector.py` 실행 완료 여부 및 StockMaster 샘플 종목 sector 값 확인 (`sqlite3` 또는 DB 클라이언트)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능
- **Phase 2 (Foundational)**: Phase 1 완료 후 — **모든 유저 스토리 블로킹**
- **Phase 3 (US1 텍스트)**: Phase 2 완료 후 독립 시작 가능
- **Phase 4 (US2 시총)**: Phase 2 완료 후 독립 시작 가능
- **Phase 5 (US3 EMA)**: Phase 2 완료 후 독립 시작 가능 (T016, T017은 Phase 5 내 병렬 가능)
- **Phase 6 (US4 거래량)**: Phase 5의 `compute_market_sentiment()` 서비스(T019) 완료 후 시작 (서비스 재사용)
- **Phase 7 (Polish)**: Phase 3~6 완료 후

### User Story Dependencies

- **US1 (P1)**: 독립적 — Phase 2 완료 후 바로 시작 가능
- **US2 (P2)**: 독립적 — Phase 2 완료 후 바로 시작 가능
- **US3 (P2)**: 독립적 — Phase 2 완료 후 바로 시작 가능
- **US4 (P3)**: US3 Phase 5의 T019(서비스 완성) 의존 — 백엔드 서비스 공유

### Within Each User Story

- 백엔드 서비스 → 라우터 → 프론트 타입 → 컴포넌트 → 페이지 연동 순서
- 각 유저 스토리 완료 후 체크포인트에서 독립 검증

---

## Parallel Opportunities

### Phase 2 내 병렬

```bash
T004 (EMA 10 추가)       ← 독립
T005 (마이그레이션 파일) ← 독립
T007 (Pydantic 스키마)   ← 독립
# T006은 T005 완료 후 실행
```

### Phase 5 내 병렬

```bash
T016 (백엔드 EMA 집계 로직)    ← 독립
T017 (프론트 타입 + API 함수)  ← 독립
T021 (EmaAlignmentBar 컴포넌트) ← 독립
# T018은 T016 완료 후 / T019는 T016+T018 완료 후 / T022는 T017+T021 완료 후
```

### Phase 3~5 간 병렬 (Phase 2 완료 후)

```bash
US1 (T008~T010)   ← 독립 병렬 가능
US2 (T011~T015)   ← 독립 병렬 가능
US3 (T016~T023)   ← 독립 병렬 가능
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational (EMA 10 + 마이그레이션 + 스키마)
3. Phase 3 US1 — 텍스트 변경 2줄
4. **STOP & VALIDATE**: 브라우저 텍스트 확인

### Incremental Delivery

1. Setup + Foundational → 기반 완료
2. US1 텍스트 정리 → 즉시 배포 가능
3. US2 시총 CRYPTO 추가 → 차트 순서 확인
4. US3 EMA 배열 차트 → 시장 추세 분위기 파악 가능
5. US4 거래량 급등 → 자금 흐름 섹터 파악 가능
6. Polish → 통합 검증
