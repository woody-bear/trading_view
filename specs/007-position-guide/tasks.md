# Tasks: 분할매수/매도 포지션 가이드

**Input**: Design documents from `/specs/007-position-guide/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Not requested.
**Organization**: Tasks grouped by user story. 프론트엔드 전용 — 백엔드 변경 없음.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 SignalDetail.tsx에서 가이드에 필요한 지표 필드(rsi, bb_pct_b, ema_20, ema_50, signal_state) 가용 여부 확인 + chartData.current 구조 파악 in `frontend/src/pages/SignalDetail.tsx`

**Checkpoint**: 가이드 판정에 필요한 모든 지표값이 기존 데이터에서 접근 가능함을 확인

---

## Phase 2: User Story 1 — BUY 분할매수 가이드 (Priority: P1) 🎯 MVP

**Goal**: BUY 신호 종목에서 3단계 분할매수 가이드 표시 (1차 30% / 2차 30% / 3차 40%)

**Independent Test**: BUY 신호 종목 상세화면에서 3단계 가이드 카드 표시, 현재 RSI/BB/EMA 기준 활성/대기 상태 확인

- [x] T002 [US1] `PositionGuide.tsx` 컴포넌트 생성 — BUY 상태일 때 3단계 분할매수 가이드 표시. 각 단계: 라벨, 비중(%), 조건, 현재 지표값, 활성(초록)/대기(회색) 상태. 하단 면책 문구 포함 in `frontend/src/components/PositionGuide.tsx`
- [x] T003 [US1] `SignalDetail.tsx`에 PositionGuide 통합 — 차트 아래, RiskWarningBanner 아래, StockFundamentals 위에 배치. props로 signal_state + rsi + bb_pct_b + ema_20 + ema_50 전달 in `frontend/src/pages/SignalDetail.tsx`

**Checkpoint**: BUY 종목에서 3단계 가이드가 즉시 표시, 지표 연동 확인

---

## Phase 3: User Story 2 — SELL 분할매도 가이드 (Priority: P1)

**Goal**: SELL 신호 종목에서 2단계 분할매도 가이드 표시 (1차 50% / 잔여 전량)

**Independent Test**: SELL 신호 종목 상세화면에서 2단계 매도 가이드 표시, RSI 기준 활성/대기 확인

- [x] T004 [US2] `PositionGuide.tsx`에 SELL 가이드 추가 — SELL 상태일 때 2단계 분할매도 가이드 표시. 1단계: RSI>65+BB상단, 2단계: RSI>70 in `frontend/src/components/PositionGuide.tsx`

**Checkpoint**: SELL 종목에서 2단계 매도 가이드 정상 표시

---

## Phase 4: User Story 3 — NEUTRAL 관망 가이드 (Priority: P2)

**Goal**: NEUTRAL 상태에서 관망 안내 + BUY/SELL 조건까지 거리 표시

**Independent Test**: NEUTRAL 종목에서 "신호 대기 중" 안내 + RSI 기준 다음 신호까지 거리 확인

- [x] T005 [US3] `PositionGuide.tsx`에 NEUTRAL 가이드 추가 — "매수·매도 조건 미충족 — 신호 대기 중" + "RSI X → 40 이하 시 BUY 가이드 활성화" 거리 안내 in `frontend/src/components/PositionGuide.tsx`

**Checkpoint**: NEUTRAL 종목에서 관망 안내 + 조건 거리 표시

---

## Phase 5: Polish

- [x] T006 프론트엔드 빌드 검증 — `pnpm build` 통과 확인 in `frontend/`
- [x] T007 통합 검증 — BUY/SELL/NEUTRAL 종목 각각 상세화면에서 가이드 정상 표시 확인

---

## Dependencies

- **T001 → T002**: 지표 필드 확인 후 컴포넌트 구현
- **T002 → T003**: 컴포넌트 생성 후 통합
- **T002 → T004**: BUY 구현 후 SELL 분기 추가 (같은 파일)
- **T004 → T005**: SELL 후 NEUTRAL 분기 추가 (같은 파일)
- **T003,T005 → T006,T007**: 모든 구현 후 빌드/검증

## Implementation Strategy

### MVP (Phase 1~2만)
T001 → T002 → T003 → 빌드 → BUY 가이드만 우선 확인

### Full Delivery
MVP + T004 (SELL) + T005 (NEUTRAL) + T006~T007 (빌드/검증)
