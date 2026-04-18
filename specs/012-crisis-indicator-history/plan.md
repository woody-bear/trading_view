# Implementation Plan: 위기 이벤트 시장 지표 히스토리

**Branch**: `012-crisis-indicator-history` | **Date**: 2026-04-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/012-crisis-indicator-history/spec.md`

## Summary

전쟁·팬데믹·금융위기 등 글로벌 위기 이벤트의 과거 시장 지표 움직임을 조회하고, 현재 진행 중인 이벤트와 과거 유사 이벤트를 나란히 비교하는 읽기 전용 페이지를 추가한다. 페이지 진입 즉시 "현재 진행 중 이벤트 vs 큐레이터 선정 과거 이벤트" 비교 차트가 자동 표시되며, 모바일은 좌우 스와이프로만 조작한다.

## Technical Context

**Language/Version**: Python 3.12 (backend) + TypeScript 5.x / React 18 (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.0 async, yfinance (backend) / React 18, lightweight-charts v5, React Query, Tailwind CSS (frontend)
**Storage**: SQLite WAL — `backend/data/ubb_pro.db` (4개 신규 테이블 추가, 기존 스키마 변경 없음)
**Testing**: pytest (backend), pnpm test (frontend)
**Target Platform**: Web (모바일 + 데스크톱), 단일 포트 8000 (FastAPI + React SPA)
**Project Type**: Web application (frontend + backend 분리)
**Performance Goals**: 차트 표시 <3초 (SC-001, SC-007), 커스텀 기준선 추가 <2초 (SC-008)
**Constraints**: 로그인 불필요, 데이터 범위 1950년~현재, 일별 데이터(분봉 불필요)
**Scale/Scope**: 15~20개 이벤트, 8개 지표, 1인 시스템 SQLite

## Constitution Check

Constitution 파일이 템플릿 상태 (프로젝트 규칙 미기입). CLAUDE.md 기준으로 평가:

- ✓ Docker 미사용 — SQLite + FastAPI 단일 서버 유지
- ✓ 기존 yfinance 활용 — 새 의존성 최소화 (`period='max'` 파라미터 추가만)
- ✓ 기존 chart_cache 패턴 활용 — 별도 crisis_cache 테이블로 분리
- ✓ 단일 포트 8000 — FastAPI StaticFiles로 React 서빙 유지
- ✓ 로그인 불필요 — Bearer 인증 없이 공개 접근 (기존 interceptor 통과)

**Gate violations**: 없음

## Project Structure

### Documentation (this feature)

```text
specs/012-crisis-indicator-history/
├── plan.md              ✓ This file
├── research.md          ✓ Phase 0 완료
├── data-model.md        ✓ Phase 1 완료
├── quickstart.md        ✓ Phase 1 완료
├── contracts/
│   └── api.md           ✓ Phase 1 완료
└── tasks.md             (Phase 2 — /speckit.tasks 명령으로 생성)
```

### Source Code Layout

```text
backend/
├── routers/
│   └── crisis.py                   ← 신규: /api/crisis/* 엔드포인트 5개
├── services/
│   └── crisis_service.py           ← 신규: 조회·통계·자동매칭 로직
├── fetchers/
│   └── crisis_fetcher.py           ← 신규: yfinance period='max' 조회
├── models/
│   ├── (기존 models.py)            ← 변경 없음
│   └── crisis_models.py            ← 신규: ORM 모델 4개
├── alembic/versions/
│   └── xxxx_add_crisis_tables.py   ← 신규: DB 마이그레이션
└── app.py                          ← 수정: crisis.py 라우터 등록

frontend/src/
├── pages/
│   └── Crisis.tsx                  ← 신규: 위기 히스토리 페이지 진입점
├── components/crisis/
│   ├── CrisisCompareChart.tsx      ← 신규: 비교 차트 (lightweight-charts)
│   ├── CrisisEventList.tsx         ← 신규: 이벤트 목록 + 필터
│   ├── CrisisStatCard.tsx          ← 신규: 요약 통계 카드
│   └── CrisisCustomBaseline.tsx    ← 신규: 커스텀 시작일 입력
├── api/client.ts                   ← 수정: crisis API 함수 추가
└── App.tsx                         ← 수정: /crisis 라우트 추가 + 탭 네비게이션
```

## Implementation Strategy

### Phase 순서

1. **Phase 1 — 기초**: DB 모델 + 마이그레이션 + 시드 데이터
2. **Phase 2 — 백엔드 US1**: 이벤트 목록 + 개별 지표 차트 API (P1)
3. **Phase 3 — 백엔드 US2**: 요약 통계 API (P2)
4. **Phase 4 — 백엔드 US3**: 비교 차트 API + 기본값 API + 커스텀 기준선 (P3)
5. **Phase 5 — 프론트엔드 US1**: 이벤트 목록 + 단일 이벤트 차트 (P1)
6. **Phase 6 — 프론트엔드 US2**: 통계 카드 + 필터 (P2)
7. **Phase 7 — 프론트엔드 US3**: 자동 비교 차트 + 모바일 스와이프 + 커스텀 입력 (P3)
8. **Phase 8 — 마무리**: 라우터 등록 + 탭 네비게이션 + 데이터 시드 스크립트

### 핵심 설계 결정 (research.md 참조)

- **자동 매칭**: `best_comparison_event_id` 큐레이터 설정 → 없으면 카테고리 폴백
- **제스처 충돌 해결**: 상단 이벤트 선택 영역 `touch-action: pan-y`, 차트 영역 `touch-action: manipulation`
- **데이터 조회**: `period='max'` yfinance — 기존 5년 제한 우회
- **갱신 주기**: 진행 중 이벤트만 APScheduler 일별 갱신 (새벽 2시 KST)
- **커스텀 기준선**: DB 미저장, 요청 시 동적 조회 + 메모리 캐시 1시간

## Complexity Tracking

| 항목 | 이유 |
|------|------|
| 4개 신규 DB 테이블 | 기존 chart_cache와 데이터 성격이 달라 분리 필요 (이벤트 기준 ±180일, 정적) |
| self-referential FK | best_comparison_event_id — 큐레이터 매칭을 DB 레벨에서 표현하는 가장 단순한 방법 |
