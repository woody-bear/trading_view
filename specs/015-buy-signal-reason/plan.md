# Implementation Plan: BUY 신호 이유 한줄 설명

**Branch**: `015-buy-signal-reason` | **Date**: 2026-04-05 | **Spec**: [spec.md](./spec.md)

## Summary

BUY 신호 리스트(Dashboard/Scan)에서 종목 상세로 진입할 때 신호 발생 이유를 한 문장으로 표시한다. 신호 데이터는 React Router `navigate` state로 전달하고, 프론트엔드에서 템플릿 기반으로 즉시 문장을 생성한다. 백엔드 변경 없음.

## Technical Context

**Language/Version**: TypeScript 5.x (React 18)
**Primary Dependencies**: React Router v6, React 18, Tailwind CSS v4
**Storage**: N/A (DB 스키마 변경 없음 — 신호 데이터는 이미 scan item에 포함)
**Testing**: pnpm test (Vitest)
**Target Platform**: 모바일 + 데스크탑 웹 (모바일 우선)
**Project Type**: 프론트엔드 전용 UI 기능
**Performance Goals**: 진입 즉시(0ms 추가 네트워크) 이유 문장 표시
**Constraints**: 외부 API 호출 없음, 템플릿 기반 순수 클라이언트 사이드 생성
**Scale/Scope**: 5개 화면(Dashboard/Scan/SignalDetail) + 2개 신규 파일

## Constitution Check

Constitution이 미작성 템플릿 상태 → 별도 게이트 없음. 프로젝트 일반 원칙 적용:
- ✅ 단순성: 신규 파일 2개(유틸 + 컴포넌트), 기존 3개 파일 소수 수정
- ✅ 외부 의존성 없음: 기존 스택만 사용
- ✅ DB 변경 없음

## Project Structure

### Documentation (this feature)

```text
specs/015-buy-signal-reason/
├── plan.md          ✅ (this file)
├── research.md      ✅
├── data-model.md    ✅
├── contracts/       ✅
│   └── buy-reason-component.md
├── quickstart.md    ✅
└── tasks.md         (→ /speckit.tasks)
```

### Source Code (변경 파일)

```text
frontend/src/
├── utils/
│   └── buyReason.ts            # NEW: 이유 문장 생성 유틸리티
├── components/
│   └── BuySignalBanner.tsx     # NEW: 이유 배너 컴포넌트
└── pages/
    ├── SignalDetail.tsx         # MODIFY: useLocation + BuySignalBanner 삽입
    ├── Dashboard.tsx            # MODIFY: BuyCard nav에 state 추가
    └── Scan.tsx                 # MODIFY: BUY item nav에 state 추가
```

### 레이아웃 변경 (SignalDetail)

```
가격 영역
  ↓
[BuySignalBanner]   ← NEW (BUY 리스트 진입 시만 표시)
  ↓
[PositionGuide]     ← 기존 위치에서 여기로 이동 (완료)
  ↓
위험경고 배너
  ↓
차트
  ↓
StockFundamentals ...
```

## Data Flow

```
Dashboard/Scan BuyCard onClick
  → nav(`/${symbol}?market=KR`, { state: { buySignal: item } })
        ↓
SignalDetail mount
  → const { state } = useLocation()
  → if (state?.buySignal) → generateBuyReason(state.buySignal) → BuySignalBanner
  → else → BuySignalBanner 숨김
```

## 문장 생성 로직 (buyReason.ts)

### 입력 타입

```typescript
interface BuySignalItem {
  last_signal: 'BUY' | 'SQZ BUY'
  last_signal_date?: string        // 'YYYY-MM-DD'
  rsi?: number
  volume_ratio?: number
  macd_hist?: number
  squeeze_level?: number           // 0=NO SQ (방금 해소), 1~3=압축중
  trend?: 'BULL' | 'BEAR' | 'NEUTRAL'
}
```

### 출력 타입 (강조 수치를 별도 파트로)

```typescript
interface ReasonPart {
  text: string
  highlight?: boolean   // true이면 색상 강조
}

type BuyReason = ReasonPart[]
```

### 템플릿 선택 트리

```
last_signal === 'SQZ BUY'
  ├─ trend=BULL + volume_ratio ≥ 2
  │    → "스퀴즈 압축이 해소되며 상승추세에서 거래량이 " [vol]배 " 급증했습니다"
  ├─ trend=BULL
  │    → "스퀴즈 압축이 해소되며 상승추세에서 매수 모멘텀이 시작됐습니다"
  └─ else
       → "스퀴즈 압축이 해소되며 반등 모멘텀이 발생했습니다"

last_signal === 'BUY'
  ├─ rsi < 30 + trend=BULL + volume_ratio ≥ 2
  │    → "RSI " [rsi] " 강한 과매도 + 거래량 " [vol]배 " 급증 + 상승추세 BB 반등"
  ├─ rsi < 30 + trend=BULL
  │    → "RSI " [rsi] " 강한 과매도 구간에서 BB 하단 반등 · 상승추세 유지"
  ├─ volume_ratio ≥ 2 + macd_hist > 0
  │    → "RSI " [rsi] " 과매도 + 거래량 " [vol]배 " 급증 + MACD 상향 · 복합 매수 신호"
  ├─ volume_ratio ≥ 2
  │    → "RSI " [rsi] " 과매도 구간에서 거래량이 " [vol]배 " 급증하며 BB 하단 반등"
  ├─ macd_hist > 0
  │    → "RSI " [rsi] " 과매도 + BB 하단 반등 + MACD 상향 전환이 확인됐습니다"
  ├─ trend=BULL
  │    → "RSI " [rsi] " 과매도 구간에서 BB 하단 반등 · 상승추세 유지"
  └─ default
       → "RSI " [rsi] " 과매도 구간에서 볼린저 밴드 하단을 되돌리며 반등 신호 발생"

공통 후미 처리:
  last_signal_date가 있으면 → 문장 끝에 " (MM-DD)" 추가
```
