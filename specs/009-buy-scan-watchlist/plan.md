# Implementation Plan: BUY 사인조회 주식목록 페이지

**Branch**: `009-buy-scan-watchlist` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-buy-scan-watchlist/spec.md`

## Summary

전체 스캔 대상 종목(3,779개)을 국내/미국 탭으로 분류해 표 형식으로 보여주는 신규 페이지(`/buy-list`) 추가. 상단에 스캔 스케줄 상황판(KR 7회 + US 2회), 종목 검색창, 총 종목수 요약 표시. 백엔드에 `/api/scan/symbols` 엔드포인트 1개 추가, 프론트엔드에 BuyList 페이지 컴포넌트 + 네비게이션 변경.

## Technical Context

**Language/Version**: Python 3.12 (backend) / TypeScript 5.x React 18 (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0 async (backend) / React Query, Tailwind CSS (frontend)
**Storage**: SQLite WAL — stock_master 테이블 읽기 전용 + ScanSnapshot 기존 읽기
**Testing**: ruff (Python lint) / pnpm lint (frontend)
**Target Platform**: Web (PC + Mobile 반응형, md breakpoint 768px)
**Project Type**: Web service (단일 FastAPI + React SPA, 포트 8000)
**Performance Goals**: 페이지 로드 3초 이내 3,779개 목록 표시 / 검색 필터 즉각 반응
**Constraints**: DB 스키마 변경 없음 / 기존 API 최대한 재사용
**Scale/Scope**: 신규 파일 1개(BuyList.tsx) + 기존 파일 4개 수정 + 신규 API 엔드포인트 1개

## Constitution Check

Constitution 파일이 템플릿 상태 (프로젝트별 원칙 미정의). 위반 사항 없음. 기존 코드 패턴(FastAPI 라우터 추가, React 페이지 추가) 준수.

## Project Structure

### Documentation (this feature)

```text
specs/009-buy-scan-watchlist/
├── plan.md              ✅ (this file)
├── research.md          ✅
├── data-model.md        ✅
├── contracts/
│   └── api.md           ✅
└── tasks.md             (Phase 2 — /speckit.tasks)
```

### Source Code

```text
backend/
├── routes/
│   └── market_scan.py        # GET /scan/symbols 엔드포인트 추가
└── services/
    └── stock_master.py       # get_all_symbols() 함수 추가

frontend/src/
├── pages/
│   └── BuyList.tsx            # 신규 페이지 컴포넌트
├── api/
│   └── client.ts              # fetchScanSymbols() 함수 추가
├── App.tsx                    # /buy-list 라우트 추가
└── components/
    └── BottomNav.tsx          # 6번째 탭 추가
```

**Structure Decision**: 기존 backend/frontend 분리 구조 그대로. 신규 파일은 BuyList.tsx 1개뿐이며 나머지는 기존 파일 수정.

## Phase 0: Research ✅

→ [research.md](./research.md)

**주요 결정사항 요약**:

| 결정 | 내용 |
|------|------|
| 종목 데이터 소스 | 기존 stock_master DB 읽기 전용, 신규 API 1개 |
| 성능 전략 | 클라이언트 사이드 필터링 (가상 스크롤 불필요) |
| 스캔 슬롯 수 | 9개: KR 9:30~15:30 (7회) + US 19:50/03:50 (2회) |
| 기존 API 재사용 | fetchFullScanHistory(20), fetchFullScanStatus |
| DB 스키마 변경 | 없음 |

**실제 종목 수 (DB 확인)**:
- KOSPI 일반주: 934개
- KOSPI ETF: 870개
- KOSDAQ: 1,784개
- NASDAQ: 107개
- NYSE ETF: 84개
- **합계: 3,779개**

## Phase 1: Design ✅

→ [data-model.md](./data-model.md) / [contracts/api.md](./contracts/api.md)

### 백엔드 구현 설계

#### GET /api/scan/symbols

```python
# backend/services/stock_master.py에 추가
async def get_all_symbols() -> dict:
    async with async_session() as session:
        rows = (await session.execute(
            select(StockMaster).order_by(StockMaster.market_type, StockMaster.symbol)
        )).scalars().all()
        breakdown = {"kospi": 0, "kospi_etf": 0, "kosdaq": 0, "nasdaq": 0, "nyse_etf": 0}
        symbols = []
        for r in rows:
            if r.market_type == "KOSPI" and not r.is_etf: breakdown["kospi"] += 1
            elif r.market_type == "KOSPI" and r.is_etf:   breakdown["kospi_etf"] += 1
            elif r.market_type == "KOSDAQ":                breakdown["kosdaq"] += 1
            elif r.market_type == "NASDAQ":                breakdown["nasdaq"] += 1
            elif r.market_type == "NYSE":                  breakdown["nyse_etf"] += 1
            symbols.append({"symbol": r.symbol, "name": r.name,
                            "market": r.market, "market_type": r.market_type, "is_etf": r.is_etf})
        return {"total": len(symbols), "breakdown": breakdown, "symbols": symbols}

# backend/routes/market_scan.py에 추가
@router.get("/scan/symbols")
async def get_scan_symbols():
    from services.stock_master import get_all_symbols
    return await get_all_symbols()
```

### 프론트엔드 레이아웃 설계

```
┌─────────────────────────────────────────────────┐
│  총 3,779개 스캔 중  국내 3,588  미국 191        │  ← 요약 배너
├─────────────────────────────────────────────────┤
│  스캔 상황판                                     │
│  [09:30 ✓] [10:30 ✓] [11:30 ⟳] [12:30 ○] ...  │  ← 9개 슬롯 가로 스크롤
├─────────────────────────────────────────────────┤
│  🔍 종목명 또는 코드 검색...           [X]       │  ← 검색창
├─────────────────────────────────────────────────┤
│  [국내]  [미국]                                  │  ← 탭
├─────────────────────────────────────────────────┤
│  코스피 (934개)                                  │
│  #   코드     종목명          구분               │
│  1   005930   삼성전자                           │
│  ...                                            │
│  코스피 ETF (870개)                              │
│  ...                                            │
│  코스닥 (1,784개)                                │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

### 스캔 슬롯 상태 시각화

| 상태 | 색상 | 아이콘 |
|------|------|--------|
| completed | text-green-400, bg-green-400/10 | CheckCircle |
| running | text-orange-400, animate-pulse | RefreshCw (spin) |
| pending | text-slate-500, bg-slate-500/10 | Clock |

### 네비게이션 변경

**PC 헤더** (App.tsx): `추천 / 환율 / BUY조회` 순으로 링크 추가 (cyan 색상)

**모바일 탭** (BottomNav.tsx): 5탭 → 6탭 (추천 다음에 BUY조회 삽입, TrendingUp 아이콘)

**라우트** (App.tsx): `/:symbol` 앞에 `/buy-list` 명시 추가 (충돌 방지)

## Complexity Tracking

복잡도 위반 없음. 신규 파일 1개, 기존 파일 4개 수정, 신규 API 엔드포인트 1개.
