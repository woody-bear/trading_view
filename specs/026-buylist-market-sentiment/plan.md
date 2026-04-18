# Implementation Plan: BUY 종목리스트 개편 + 시장분위기 누적막대 차트

**Branch**: `026-buylist-market-sentiment` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/026-buylist-market-sentiment/spec.md`

---

## Summary

BUY 종목 리스트 화면의 타이틀·텍스트 정리 + 시총 분포 차트 순서 조정 + EMA 정배열/역배열 비율 차트 + 거래량 급등 비율 차트(시장별 KR/US/CRYPTO, 상위 섹터 표시)를 추가한다.

백엔드는 새 집계 서비스(`market_sentiment_service.py`) + API 엔드포인트 + StockMaster sector 컬럼 마이그레이션을 수행하고, 프론트엔드는 기존 BuyList.tsx + 신규 차트 컴포넌트 2개를 추가한다.

---

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5 / React 18 (frontend)  
**Primary Dependencies**: FastAPI, SQLAlchemy, pandas_ta_classic, yfinance, cachetools (backend) · React Query, Zustand, Tailwind (frontend)  
**Storage**: SQLite/PostgreSQL (기존) — StockMaster.sector 컬럼 추가 마이그레이션 1건  
**Testing**: pytest (backend), 브라우저 수동 검증 (frontend)  
**Target Platform**: Linux server (backend) / Web browser (frontend)  
**Project Type**: Web application (FastAPI + React SPA)  
**Performance Goals**: 캐시 hit 시 API 응답 < 100ms, cold start < 10s  
**Constraints**: 기존 MarketCapDistributionBar 컴포넌트 재사용; 기존 calculate_ema() 함수 확장  
**Scale/Scope**: ~1,200 종목 (KR 470 / US 718 / CRYPTO 10)

---

## Constitution Check

| 규칙 | 검증 | 비고 |
|------|------|------|
| R-01 한 번에 하나의 관심사 | ✅ | 백엔드 서비스·마이그레이션·API 각각 분리 |
| R-02 기존 네이밍 컨벤션 준수 | ✅ | snake_case (backend), camelCase (frontend) |
| R-03 매직 넘버 금지 | ✅ | 300%, 20일 평균, 룩백 기간은 상수로 추출 |
| R-06 기존 유틸 재사용 | ✅ | calculate_ema() 확장, MarketCapDistributionBar 재사용 |
| R-08 타입 힌트 / TS 타입 | ✅ | Pydantic 스키마 + TypeScript interface |
| PY-01 async def 우선 | ✅ | 새 서비스 함수 async 작성 |
| PY-02 Pydantic 스키마 | ✅ | MarketSentimentResponse 등 신규 스키마 |
| FE-01 단일 책임 컴포넌트 | ✅ | EmaAlignmentBar / VolumeSpikeBar 분리 |
| FE-02 서버 상태 → React Query | ✅ | useMarketSentiment 훅 |
| FE-03 API 호출 client.ts 집중 | ✅ | fetchMarketSentiment 함수 추가 |
| FE-05 에러/로딩/empty 처리 | ✅ | 스켈레톤 + 에러 상태 |
| DB-01 롤백 SQL 동반 | ✅ | `ALTER TABLE stock_master DROP COLUMN sector` |
| DB-02 NOT NULL에 DEFAULT | ✅ | sector DEFAULT '기타' |
| SR-01~SR-05 재시작 필수 | ✅ | 작업 완료 후 백엔드 재시작 + pnpm build |

---

## Project Structure

### Documentation (this feature)

```text
specs/026-buylist-market-sentiment/
├── plan.md              ← 이 파일
├── research.md          ← Phase 0 완료
├── data-model.md        ← Phase 1 완료
├── quickstart.md        ← Phase 1 완료
├── contracts/
│   └── market-sentiment-api.md
└── tasks.md             ← /speckit.tasks 가 생성
```

### Source Code (변경 대상)

```text
backend/
├── alembic/versions/
│   └── xxxx_add_sector_to_stock_master.py  [신규]
├── indicators/
│   └── ema.py                               [수정] EMA 10 추가
├── services/
│   └── market_sentiment_service.py          [신규] EMA 집계 + 거래량 급등 집계
│   └── market_cap_distribution.py           [수정] CRYPTO 추가
├── routes/
│   └── market_scan.py                       [수정] GET /scan/market-sentiment 추가
└── schemas/
    └── market_sentiment.py                  [신규] Pydantic 스키마

frontend/src/
├── api/
│   └── client.ts                            [수정] fetchMarketSentiment + CRYPTO 타입
├── components/
│   ├── EmaAlignmentBar.tsx                  [신규] EMA 정배열/역배열 100% 누적 바
│   └── VolumeSpikeBar.tsx                   [신규] 거래량 급등 비율 100% 누적 바
└── pages/
    └── BuyList.tsx                          [수정] 텍스트 변경 + 차트 3종 추가
```

**Structure Decision**: 웹 애플리케이션(Option 2). 기존 backend/frontend 구조 그대로 유지.

---

## Implementation Phases

### Phase A: 백엔드 기반 (의존성 없음)

**A-1. EMA 10 추가** — `backend/indicators/ema.py`
- `calculate_ema()` 함수에 `period=10` 추가
- 반환 dict에 `ema_10` 키 포함

**A-2. DB 마이그레이션** — `backend/alembic/versions/`
- `sector VARCHAR(100) DEFAULT '기타'` 컬럼 추가
- StockMaster 기존 US 종목에 yfinance `info['sector']` 채우는 one-time populate 스크립트
- KR 종목: market_type 기반 초기값 (KOSPI/KOSDAQ)
- CRYPTO: "암호화폐"

**A-3. Pydantic 스키마** — `backend/schemas/market_sentiment.py`
- `EmaAlignmentStats`, `VolumeSpikePeriod`, `VolumeSpikeStats`, `MarketSentimentByMarket`, `MarketSentimentResponse`

### Phase B: 백엔드 서비스/API (A-1, A-2, A-3 완료 후)

**B-1. market_sentiment_service.py** 신규 작성
- `async def compute_market_sentiment() -> MarketSentimentResponse`
- 캐시 30분 TTL (`cachetools.TTLCache`)
- EMA 집계: 최신 스냅샷 종목 목록 → yfinance OHLCV(200봉) 배치 로드 → EMA 5/10/20/60/120 계산 → 정배열/역배열 판정
- 거래량 급등 집계: 최근 60영업일 OHLCV → 직전 20일 평균 계산 → 20/30/60일 룩백 판정
- top_sector: 60일 급등 종목 → StockMaster.sector JOIN → 최다 섹터

**B-2. market_scan.py** 수정
- `GET /scan/market-sentiment` 라우터 추가
- `compute_market_sentiment()` 호출 후 응답 반환

**B-3. market_cap_distribution.py** 수정
- `_CRYPTO` 종목 목록의 시총 조회 로직 추가
- `compute_distribution()` 응답에 CRYPTO 키 추가

### Phase C: 프론트엔드 (B-1, B-2, B-3 완료 후)

**C-1. client.ts 수정**
- `MarketSentimentResponse` 등 TypeScript 타입 추가
- `fetchMarketSentiment()` 함수 추가
- `MarketCapDistributionResponse`에 CRYPTO 타입 반영

**C-2. EmaAlignmentBar.tsx 신규**
- Props: `market: string`, `data: EmaAlignmentStats | null`, `loading: boolean`
- 3구간 100% 누적 바: golden(초록)/death(빨강)/other(회색)
- 각 구간에 종목 수 + 비율(%) 레이블
- 너비: 부모 컨테이너 기준 100% (부모가 30% 컨테이너)

**C-3. VolumeSpikeBar.tsx 신규**
- Props: `market: string`, `data: VolumeSpikeStats | null`, `loading: boolean`
- 룩백 3행(20/30/60일): 각 행에 급등 비율 바 + top_sector 레이블
- 행 구성: 급등(주황)/나머지(회색) 2구간 + 비율(%) + 섹터명

**C-4. BuyList.tsx 수정**
- 텍스트 변경: 772번줄 `BUY 조회종목 리스트` → `종목리스트`
- 텍스트 삭제: 773번줄 `전체 스캔 대상 종목` 제거
- 시총 분포 차트 순서: KR → US → CRYPTO
- 새 차트 영역 추가:
  - `useQuery`로 `fetchMarketSentiment()` 호출
  - 30% 너비 왼쪽 정렬 컨테이너
  - 배치 순서: 시총 분포 → EMA 배열(KR/US/CRYPTO 행) → 거래량 급등(KR/US/CRYPTO 행)

---

## Complexity Tracking

| 항목 | 이유 | 단순화 대안 기각 이유 |
|------|------|----------------------|
| DB 마이그레이션 (sector 컬럼) | 거래량 급등 상위 섹터 표시에 업종 데이터 필수 | in-memory 캐시만으로는 cold start 시 1,200 종목 yfinance 호출 불가 |
| 거래량 급등 계산 시 OHLCV 배치 로드 | 기존 스냅샷에 거래량 급등 여부 미저장 | 스냅샷 재사용 불가 — 30분 캐시로 성능 보완 |
