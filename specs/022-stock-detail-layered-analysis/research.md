# Research — Phase 0

**Feature**: 022-stock-detail-layered-analysis
**Date**: 2026-04-14

## R1. 가치 분석 데이터 소스

- **Decision**: 기존 `backend/routes/company.py`의 `GET /company/{symbol}?market=`를 그대로 사용한다.
- **Rationale**: 이미 yfinance `Ticker.info`에서 PER/PBR/ROE/ROA/EPS/BPS/시가총액/배당수익률/영업이익률/부채비율/통화/섹터를 추출해 1h TTL 메모리 캐시까지 갖추고 있다. KR 종목은 `.KS`/`.KQ` 접미사 처리, US 종목은 ticker 그대로 매핑되어 시장별 구분이 이미 구현되어 있다.
- **Alternatives considered**:
  - DART OpenAPI(국내 공시) → 분기·연간 재무제표는 정확하나 PER/PBR/시가총액 등 시장 지표는 별도 계산 필요 → 본 스펙(요약 카드) 범위 초과.
  - Alpha Vantage / Finnhub(US) → 신규 키 발급·요금제 관리 부담 vs 본 기능에 필요한 값은 yfinance가 충분.

## R2. 자산군(AssetClass) 판정

- **Decision**: 신설 모듈 `backend/services/asset_class.py`에서 다음 우선순위로 판정한다.
  1. `market == "CRYPTO"` → `CRYPTO`
  2. `market in ("KR","KOSPI","KOSDAQ")` 그리고 `symbol in KR_ETF_SYMBOLS` → `ETF`
  3. `market == "US"` 그리고 `symbol in US_ETF_TICKERS` → `ETF`
  4. `market in ("KR","KOSPI","KOSDAQ")` → `STOCK_KR`
  5. `market == "US"` → `STOCK_US`
  6. 그 외 → `INDEX` (현 스캔 범위에 없음, 안전 폴백)
- **Rationale**: ETF 마스터 리스트는 이미 `scan_symbols_list.py`에 정의되어 있어 추가 데이터 수집 없이 즉시 판정 가능. 시장 코드만으로 분기되는 단순한 결정 트리이므로 단위 테스트가 명료하다.
- **Alternatives considered**:
  - yfinance `info["quoteType"]`(EQUITY/ETF/CRYPTOCURRENCY/INDEX 등) 사용 → 네트워크 호출이 매번 필요 + 일부 종목에서 결측. 보조 검증용으로만 활용 가능.
  - DB 컬럼 `StockMaster.asset_class` 신설 → 마이그레이션 비용. 향후 종목 마스터 정비 시 도입 검토.

## R3. 벤치마크(업종 평균) 라벨

- **Decision**: 1차 범위에서는 벤치마크 데이터 미수집. 응답 DTO에 `comparison_label` 필드만 정의하고 항상 `null`로 전달한다. 프론트는 라벨이 `null`이면 수치만 표시.
- **Rationale**: 업종 평균을 만들려면 업종별 종목 군집 + 분기별 갱신 인프라가 필요. 본 스펙 Assumptions 마지막 항목이 "벤치마크 데이터가 없을 경우 라벨 없이 수치만 표시해도 수용 가능"으로 명시.
- **Alternatives considered**:
  - 섹터별 PER 중앙값 사전 계산(스케줄러 작업) → 별도 작업 단위로 분리 가능, 본 기능 외부.

## R4. 모바일 스크롤 동작 (FR-012)

- **Decision**: 가치 분석 본문 컨테이너에 `scroll-snap-type: y mandatory`, 각 카드(또는 카드 그룹)에 `scroll-snap-align: start`. `@media (max-width: 768px)`로 모바일에 한정. PC는 일반 스크롤.
- **Rationale**: 순수 CSS로 자연스러운 자석 정렬을 제공, 추가 라이브러리 불필요. iOS Safari·Android Chrome 모두 안정 지원.
- **Alternatives considered**:
  - `IntersectionObserver` + JS scrollTo → 구현 복잡, 관성 스크롤과 충돌 가능.
  - 풀페이지 스와이프 라이브러리(swiper, fullpage.js) → 번들 크기 증가, 1차 탭 차트와의 일관성 저하.

## R5. 탭 URL 동기화 (FR-005)

- **Decision**: react-router `useSearchParams()`로 `?tab=chart|value` 읽기·쓰기. 잘못된 값/누락은 `chart`로 폴백. 탭 전환은 history `push`(뒤로가기로 이전 탭 복원).
- **Rationale**: 기존 페이지가 react-router를 이미 사용 중이므로 추가 의존성 없음. 딥링크·공유 URL이 자연스럽게 동작 (SC-005).
- **Alternatives considered**:
  - 라우트 자체를 `/detail/:symbol/chart` vs `/detail/:symbol/value`로 분리 → URL이 길어지고, 1차 탭의 기존 URL과의 호환을 깨뜨릴 수 있음.

## R6. 세션 단위 차트 토글 보존 (FR-010)

- **Decision**: Zustand 스토어 `detailViewStore`에 `Record<symbol, ChartUiState>` 저장. 새로고침 시 휘발(persist 미사용).
- **Rationale**: 같은 세션에서 탭을 왕복해도 차트 기간/지표 토글이 유지되면 재조작 비용이 줄어든다. Persist 시 세션 간 잔존 상태로 인한 혼선이 더 큰 비용.
- **Alternatives considered**:
  - URL 쿼리에 차트 상태까지 직렬화 → URL 비대화·공유 의미 약화.
  - LocalStorage persist → 향후 사용자 프로필 기능과 충돌 우려, 본 단계에서는 보류.

## R7. 캐시 정합성 (FR-008)

- **Decision**: 백엔드 1h TTL 메모리 캐시(기존) + React Query `staleTime: 60min`, `gcTime: 30min`, `refetchOnWindowFocus: false`.
- **Rationale**: 가치 지표는 분기 단위로 변하는 정보이므로 1h 신선도로 충분. 사용자 체감 즉시성을 위해 stale-while-revalidate 패턴 활용.

## R8. ETF·Crypto·미지원 자산군 처리

- **Decision**: 백엔드는 미지원 자산군에서도 200 응답 + `asset_class` 정확 표기 + `metrics: null`을 반환한다. 프론트는 `asset_class`로 탭 disabled 여부를 결정하고 클릭 시 PC 툴팁/모바일 토스트로 안내.
- **Rationale**: 클라이언트 책임을 단순화하고, 동일 엔드포인트로 일관성 유지. 4xx 사용 시 React Query 에러 처리·재시도 로직과 충돌.
