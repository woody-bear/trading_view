# Implementation Plan: 주가 추세 기반 매매 타이밍 섹션 (차트 분석 화면)

**Branch**: `024-trend-trading-signals` | **Date**: 2026-04-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-trend-trading-signals/spec.md`

## Summary

차트 분석 탭의 EmaOnlyChart 직하단에 **"추세 분석" 카드 섹션**을 추가한다. 종목의 최근 120봉(약 6개월) 일봉 가격만 사용해 4가지 추세(상승·하락·평행·삼각수렴)를 자동 분류하고, 추세에 대응하는 **매수 후보 구간 / 매도 후보 구간**을 중립 톤으로 표시. 차트 오버레이(추세선·박스·삼각수렴선)는 기본 OFF 토글로 제공.

**완전 격리** — 기존 스캔·BUY 신호 판정·마커·스냅샷·보호 규칙에 어떠한 변경·참조 없음 (FR-013). 신규 엔드포인트(`/api/trend-analysis/{symbol}`), 신규 서비스 모듈(`services/trend_analysis.py`), 신규 프론트 컴포넌트(`TrendAnalysisCard`)만 추가.

기술 접근: 고점·저점 피크 검출 + 선형 회귀 기반 단순 룰 (numpy/pandas만 사용, ML/외부 의존성 없음). 계산 입력은 `/api/chart/quick`과 동일 OHLC 소스 재사용.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5 / React 18 (frontend)
**Primary Dependencies**:
  - Backend: FastAPI, numpy, pandas (이미 설치) · scipy.signal.find_peaks 선택적
  - Frontend: React Query, Zustand, lightweight-charts (022에서 도입)
**Storage**: DB 신규 테이블 없음. 서버 in-memory 캐시 60초 TTL + 프론트 React Query staleTime 5분
**Testing**: pytest — 추세 분류 룰 단위 테스트(인위적 시계열 fixture 4종), 엔드포인트 통합 테스트
**Target Platform**: 웹 (데스크톱 + 모바일 PWA)
**Project Type**: Web (FastAPI + React SPA)
**Performance Goals**: 차트 분석 탭 최초 렌더 지연 +0.3초 이내(SC-005), 분류 계산은 120개 OHLC에서 수 밀리초
**Constraints**:
  - 일봉(1d)만 1차 지원 (FR-002)
  - 최소 120거래일 필요 (FR-007)
  - 스캔·BUY 판정·알림·스케줄러·보호 규칙 무변경 (FR-013)
  - 매매 라벨은 중립 톤(📍 매수 후보 / ⚠️ 매도 후보 / 🟡 관망)
**Scale/Scope**: 종목 상세 진입 시 1회 호출, 동시 사용자 수십명, 초당 수 건 규모. 서버 부하 미미.

## Constitution Check

> `.specify/memory/constitution.md`는 placeholder 상태 — `CLAUDE.md`의 운영 원칙을 사실상 헌법으로 평가.

| 게이트 | 결과 | 비고 |
|--------|------|------|
| `.claude/rules/*.md` 변경 없음 | ✅ | 스캔/BUY/SELL 라벨 규칙 참조조차 하지 않음 |
| 기존 스캔·알림 파이프라인 회귀 없음 | ✅ | FR-013 명시 |
| DB 신규 테이블 없음 | ✅ | 인메모리/요청별 계산 |
| 신규 외부 의존성 최소 | ✅ | numpy·pandas·scipy 전부 기존 설치 |
| 환경 변수·시크릿 하드코딩 금지 | ✅ | 외부 API 없음 |
| 작업 후 서버 재시작 (SR-01~05) | ✅ | quickstart 명시 |
| 보호 파일 수정 금지 | ✅ | 읽기도 없음 |

**위반 없음** → Phase 0 진행.

## Project Structure

### Documentation
```text
specs/024-trend-trading-signals/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── trend-analysis.openapi.yaml
├── checklists/requirements.md
└── spec.md
```

### Source Code
```text
backend/
├── services/
│   └── trend_analysis.py          # (신규) 추세 분류 + 추세선 산출 + 매매 시점 계산
├── routes/
│   └── trend_analysis.py          # (신규) GET /api/trend-analysis/{symbol}
└── tests/
    ├── unit/test_trend_analysis.py           # (신규) 4종 fixture + 피크 검출 테스트
    └── integration/test_trend_endpoint.py    # (신규) 엔드포인트 응답 계약

frontend/
├── src/
│   ├── api/client.ts              # (수정) fetchTrendAnalysis(symbol, market) 추가
│   ├── components/charts/
│   │   ├── TrendAnalysisCard.tsx  # (신규) 카드 본체 — 라벨·매수·매도·토글·면책
│   │   └── TrendLinesOverlay.tsx  # (신규, 옵션) IndicatorChart에 라인 오버레이 주입
│   ├── hooks/
│   │   └── useTrendAnalysis.ts    # (신규) React Query 래퍼 (staleTime 5분)
│   ├── stores/
│   │   └── trendOverlayStore.ts   # (신규) 토글 상태 (Zustand, 세션 보존)
│   └── pages/SignalDetail.tsx     # (수정) EmaOnlyChart 직하단에 <TrendAnalysisCard> 마운트
```

**Structure Decision**: 기존 풀스택 구조 그대로 확장. 백엔드 서비스 모듈 1개 + 신규 라우터 1개 + 단위·통합 테스트. 프론트는 카드 컴포넌트 + 오버레이(옵션) + React Query 훅 + Zustand 토글 스토어. 기존 파일 수정은 `api/client.ts`·`SignalDetail.tsx`·`IndicatorChart.tsx`(토글 ON 시 라인 주입)에 한정.

## Phase 0 — Research

별도 산출물: [research.md](./research.md)

핵심 결정:

1. **추세 분류 알고리즘**: 최근 120봉을 입력으로 받아
   - **피크 검출** (`scipy.signal.find_peaks` 또는 롤링 윈도우 기반 단순 구현)로 주요 고점·저점 인덱스 추출
   - 고점·저점 각각에 대해 **선형 회귀**로 기울기 계산
   - 네 가지 분기:
     - 둘 다 기울기 > ε → **상승추세** (지지선=저점 회귀, 저항선=고점 회귀)
     - 둘 다 기울기 < -ε → **하락추세**
     - 둘 다 기울기 ≈ 0 + 가격 변동폭 좁음 → **평행(박스권)**
     - 저점 기울기 > ε + 고점 기울기 < -ε → **삼각수렴**
     - 그 외 → **분류 불가**
   - ε(기울기 임계)는 가격대비 정규화: `|slope| / last_close * 100 > 0.05%`/일 정도로 시작, SC-002 육안 80% 기준으로 튜닝
2. **매수·매도 후보 산출 (FR-004·005, PDF 규칙 그대로)**:
   - 상승추세 매수: 최근 지지선 연장 가격, 또는 저항선 돌파 임박
   - 상승추세 매도 1차: 저항선 가격. 2차: 지지선 이탈 시
   - 하락추세 매수: 지지선 가격 — 단 기울기 깊으면 "🟡 관망"
   - 하락추세 매도 1차: 저항선. 2차: 지지선 붕괴 시
   - 평행(박스): 매수=박스 저점, 매도=박스 고점
   - 삼각수렴: 매수=고점 추세선 돌파 예상가, 매도=저점 추세선 이탈 예상가
3. **성능**: 120봉 × numpy 연산 = 수 밀리초. 서버 TTL 60초 캐시로 연타 요청 흡수. FR-009 "실시간 재계산 X" 요구와 부합.
4. **FR-013 완전 격리 구현 전략**:
   - 신규 파일만 추가, 기존 파일 수정은 최소(`api/client.ts`·`SignalDetail.tsx`·`IndicatorChart.tsx` 세 파일)
   - `full_market_scanner`·BUY/SELL 판정·스케줄러·알림·`rules/*.md` import 금지 (구현 후 grep로 검증)
5. **오버레이(FR-006)**: `IndicatorChart.tsx`에 `trendLines?: TrendLine[]` prop 추가. 비어 있으면 렌더 안 함. 토글 OFF 시 빈 배열 전달 = 오버레이 없음.
6. **라이브러리 평가**:
   - `scipy.signal.find_peaks`: 이미 설치돼 있는지 확인. 없으면 롤링 맥스/민 단순 구현.
   - 신규 패키지 추가 없음 목표.
7. **장 상태 통합(옵션)**: 새로 도입된 `get_market_status()`로 "장 개장 전/휴장" 시 섹션 상단에 보조 문구("⏰ 장 개장 전 — 어제 종가 기준 분석") 추가 가능. 필수 아님.

## Phase 1 — Design & Contracts

### Data Model
[data-model.md](./data-model.md)

핵심 엔티티 (모두 응답 DTO — DB 테이블 없음):
- **TrendClassification**: 추세 분류 결과 (type·confidence·window_size)
- **TrendLine**: 차트 오버레이용 라인 (kind·start·end·price)
- **TradingSignal**: 매매 후보 (kind·price·condition·distance_pct)
- **TrendAnalysisResponse**: API 응답 최상위 (classification + lines[] + buy_signals[] + sell_signals[] + disclaimer)

### Contracts
[contracts/trend-analysis.openapi.yaml](./contracts/trend-analysis.openapi.yaml)

`GET /api/trend-analysis/{symbol}?market=KR|US`:
- 200: TrendAnalysisResponse
- 데이터 부족: `classification.type = "insufficient_data"` + signals 빈 배열
- 분류 불가: `classification.type = "unknown"` + signals 빈 배열

### Quickstart
[quickstart.md](./quickstart.md)

검증 시퀀스:
1. 백엔드 단위 테스트 — 인위적 시계열 fixture 4종(상승/하락/평행/삼각) 입력 → 각각 예상 분류 결과 매칭
2. 백엔드 재시작
3. 라이브 엔드포인트 스모크 (AAPL / SK하이닉스 / KODEX 200 등)
4. 프론트 빌드 + dev
5. 브라우저에서 종목 상세 → 차트 분석 탭 → "추세 분석" 카드 확인 → 토글 ON 시 차트 라인 오버레이
6. 회귀 체크 — `/api/scan/full/latest` 응답·BUY 마커·알림 변경 없음 확인

### Agent context update
`.specify/scripts/bash/update-agent-context.sh claude` 실행 — 신규 기술 스택 없음이라 변경 미미 예상.

## Constitution Check (Post-Design Re-Eval)

| 게이트 | 결과 |
|--------|------|
| 보호 규칙 무변경 | ✅ |
| 스캔·BUY 파이프라인 회귀 0 | ✅ (FR-013 + grep 검증) |
| 응답 하위 호환 | ✅ (신규 엔드포인트) |
| 외부 의존성 신규 도입 없음 | ✅ (numpy·pandas·scipy 전부 기존) |
| 서버 재시작 절차 | ✅ (quickstart) |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (없음) | — | — |

## Phase 2 Outline (`/speckit.tasks`에서 생성)

작업 등급: **M (Medium)**. 예상 작업 그룹:
1. 백엔드 `services/trend_analysis.py` 알고리즘 (피크 검출 + 회귀 + 분류)
2. 백엔드 단위 테스트 (4종 fixture · 엣지 케이스 · 분류 불가)
3. 백엔드 라우터 `routes/trend_analysis.py` + 응답 계약 + 통합 테스트
4. 프론트 `useTrendAnalysis` 훅 + API 타입
5. 프론트 `TrendAnalysisCard` (라벨·매수·매도·토글·면책)
6. 프론트 Zustand `trendOverlayStore` (토글 상태)
7. 프론트 `IndicatorChart` 오버레이 prop + `TrendLinesOverlay` 렌더
8. `SignalDetail.tsx` 마운트 + 토글 연결
9. Polish: 4종 실제 종목 시각 검증(SC-002 육안 80%) · 회귀 체크 · 재시작
