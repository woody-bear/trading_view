# Implementation Plan: KR 개별주 PER/PBR/EPS/BPS 네이버 파이낸스 보강

**Branch**: `023-kr-naver-fundamentals` | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/023-kr-naver-fundamentals/spec.md`

## Summary

KR 개별 상장주식(코스피·코스닥)에 한해 네이버 파이낸스 종목 페이지에서 **PER·PBR·EPS·BPS** 4개 지표를 on-demand 크롤링하여 yfinance 결측을 보강한다.

- 보강 모듈: `backend/services/naver_fundamentals.py` 신설 (HTTP fetch + HTML 파싱 + 24h 캐시)
- 적용 지점: 기존 `routes/company.py`의 응답 후처리 단계 (KR 개별주 전용 분기)
- 응답 확장: metrics에 대응하는 `metric_sources` 맵 추가 (`{"per": "naver", "roe": "yfinance", ...}`)
- 프론트: `MetricCard.sublabel`을 기존 설명 + ` · ` + 소스명(한글)으로 조합
- 실패 처리: 어떤 단계에서 실패해도 200 + yfinance 폴백, 종목별·단계별 구조화 로그 + 실패율 카운터

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5 / React 18 (frontend)
**Primary Dependencies**: FastAPI, yfinance, httpx(이미 설치), BeautifulSoup(bs4, 이미 설치) (backend) · React Query, Zustand (frontend, 022에서 도입)
**Storage**: 신규 테이블 없음. 네이버 보강 결과는 **in-memory dict 캐시**(24h TTL) + 기존 company in-memory 캐시 재사용.
**Testing**: pytest (backend) — 파싱 단위 테스트(HTML fixture) + 실패 폴백 통합 테스트, 프론트 수동 검증
**Target Platform**: 웹 (데스크톱·모바일 PWA)
**Project Type**: Web (FastAPI + React SPA)
**Performance Goals**: 가치 탭 p95 < 1.5s (SC-002) — on-demand 크롤링 포함, 캐시 히트 시 즉시 응답
**Constraints**:
  - 네이버 호출 **전체 스캔 경로 금지** (FR-005): rate limit·IP 차단 방지
  - 타임아웃 3초, 실패 시 조용히 폴백 (FR-003)
  - User-Agent 헤더 설정, 동시 동일 종목 요청 중복 방지(in-flight dedup)
**Scale/Scope**: KR 스캔 대상 ~470종목. 활성 사용자 수십명 기준 일일 호출량은 캐시 히트로 대부분 흡수.

## Constitution Check

> `.specify/memory/constitution.md`는 placeholder 상태 — `CLAUDE.md` 운영 원칙을 실질 헌법으로 적용.

| 게이트 | 결과 | 비고 |
|--------|------|------|
| `rules/*.md` 보호 파일 변경 없음 | ✅ | 스캔·BUY/SELL 라벨 로직 무변경 |
| 기존 동작 회귀 없음 | ✅ | yfinance 경로 그대로 유지, 보강은 overlay |
| 신규 DB 스키마 없음 | ✅ | 인메모리 캐시만 사용 |
| 환경 변수·시크릿 하드코딩 금지 | ✅ | 공개 페이지, 인증 불필요 |
| 사용자 입력 검증 | ✅ | symbol 6자리 숫자만 네이버 호출 대상 |
| 작업 후 서버 재시작 (SR-01~05) | ✅ | quickstart에 명시 |
| 외부 소스 과다 호출 방지 (FR-005) | ✅ | on-demand만, 24h 캐시, in-flight dedup |

**위반 없음** → Phase 0 진행.

## Project Structure

### Documentation
```text
specs/023-kr-naver-fundamentals/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── company.openapi.yaml   # metric_sources 필드 추가
├── checklists/requirements.md
└── spec.md
```

### Source Code
```text
backend/
├── services/
│   └── naver_fundamentals.py    # (신규) fetch + parse + cache + dedup
├── routes/
│   └── company.py               # (수정) KR 개별주에 한해 보강 후처리 + metric_sources
└── tests/
    ├── fixtures/naver_000660.html  # (신규) HTML 샘플
    ├── unit/test_naver_fundamentals.py  # (신규) 파싱 단위 테스트
    └── integration/test_company_endpoint.py  # (보강) 네이버 보강·폴백 경로 추가

frontend/
├── src/
│   ├── api/client.ts                   # (수정) CompanyInfoResponse.metric_sources 타입
│   └── components/ValueAnalysisTab.tsx # (수정) sublabel에 소스명 조합
```

**Structure Decision**: 022의 풀스택 구조 그대로 확장. 백엔드 신규 서비스 모듈 1개 + 기존 엔드포인트 후처리만 추가(하위 호환). 프론트는 타입 1필드 + sublabel 렌더 로직만 수정.

## Phase 0 — Research

별도 산출물: [research.md](./research.md)

핵심 결정:
1. **외부 소스**: 네이버 파이낸스 종목 메인 페이지 (`https://finance.naver.com/item/main.naver?code={6자리}`) — 공개 페이지, 인증 없음.
2. **파싱 전략**: `aside_invest_info` 블록을 `BeautifulSoup` + 라벨 기반 탐색. 정규식 폴백은 인코딩 이슈로 불안정 → DOM 기반 접근.
3. **인코딩**: 응답은 EUC-KR(실제 cp949). `response.content.decode('euc-kr', errors='ignore')`로 명시적 디코드.
4. **캐시 전략**: 모듈 레벨 dict `{symbol: (payload, expires_at)}` TTL=24h (FR-004 확정). 메모리 경량(수십 KB).
5. **동시 요청 중복 방지**: asyncio Lock 맵(`{symbol: Lock}`) — 동시 진입 시 첫 요청만 네트워크, 나머지는 결과 공유.
6. **User-Agent**: 일반 브라우저 UA 설정으로 봇 차단 회피.
7. **실패율 관측(FR-008)**: 모듈 내 `_stats` dict에 성공/실패 카운터 + 최근 실패 10건 링 버퍼. `/api/system/naver-stats` 엔드포인트로 노출.
8. **값 단위 정합**:
   - PER/PBR: `배` 단위 → 숫자만 추출 (e.g., "18.9배" → 18.9)
   - EPS/BPS: `원` 단위 → 쉼표 제거 후 정수 (e.g., "58,954원" → 58954)
9. **스킵 대상**: `market == "CRYPTO"` / ETF 심볼 / 6자리 숫자가 아닌 symbol → 호출 안 함 (FR-009).
10. **기준일 추출**: 네이버 페이지의 "(2025.12)" 표기 → 분기 라벨 "2025-Q4"로 변환하여 `reporting_period` 갱신.

## Phase 1 — Design & Contracts

### Data Model
[data-model.md](./data-model.md) — `NaverFundamentalsPayload` (응답 DTO), `MetricSourceMap`, `NaverCacheEntry`(서버 상태), `NaverFetchStats`(관측).

### Contracts
[contracts/company.openapi.yaml](./contracts/company.openapi.yaml) — 기존 `GET /company/{symbol}` 응답에 **`metric_sources: {metric_name: 'naver'|'yfinance'}`** 필드 추가 (하위 호환). `reporting_period`는 네이버 보강 시 갱신.

### Quickstart
[quickstart.md](./quickstart.md) — 단위 테스트 → 백엔드 재시작 → SK하이닉스(000660)·삼성전자(005930) curl 확인(보강 적용) → AAPL 확인(무영향) → 프론트 빌드·리로드 → 브라우저 가치 탭에서 sublabel 소스명 확인.

### Agent context update
`.specify/scripts/bash/update-agent-context.sh claude` — httpx+bs4 사용이 프로젝트 내 기존 패턴이므로 변경 미미 예상.

## Constitution Check (Post-Design Re-Eval)

| 게이트 | 결과 |
|--------|------|
| 보호 규칙 변경 없음 | ✅ |
| yfinance 원 경로 동작 보존 (폴백 자동) | ✅ |
| 응답 하위 호환 (필드 추가만) | ✅ |
| 외부 의존성 신규 도입 없음 (httpx·bs4 기존) | ✅ |
| 관측 가능성 (stats endpoint) | ✅ |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (없음) | — | — |

## Phase 2 Outline (`/speckit.tasks`에서 생성 예정)

작업 등급: **M (Medium)**. 예상 작업 그룹:
1. 백엔드 `naver_fundamentals.py` 신설 + HTML fixture·파싱 단위 테스트
2. `routes/company.py` 보강 후처리 + `metric_sources`·`reporting_period` 갱신 + 통합 테스트
3. 관측 엔드포인트 `/api/system/naver-stats` (간이)
4. 프론트 `CompanyInfoResponse` 타입 + `ValueAnalysisTab`의 sublabel 조합
5. 검증(4종 시나리오: 000660 보강 / AAPL 무영향 / KODEX ETF 스킵 / 네이버 강제 실패 폴백) + 재시작
