# Implementation Plan: 시장 방향성 대시보드

**Branch**: `005-market-sentiment-dashboard` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)

## Summary

메인화면에 VIX 기반 합성 공포/탐욕 지수(0~100) 게이지 + 주요 시장 지표(VIX, 코스피, S&P500, 나스닥, USD/KRW) 미니 카드 + 30일 추이 차트를 표시. CNN Fear & Greed API가 차단되어 있으므로 yfinance VIX 데이터로 자체 계산. 추가 의존성 0개.

## Technical Context

**Language/Version**: Python 3.12 + TypeScript 5.x (React 18)
**Primary Dependencies**: yfinance (기존), pandas (기존), lightweight-charts (기존)
**Storage**: 없음 (실시간 조회, DB 변경 없음)
**Target Platform**: 웹 (PC + 모바일 반응형)
**Constraints**: 추가 의존성 0개, 외부 유료 API 0개

## Constitution Check

| Gate | Status |
|------|--------|
| Docker 미사용 | PASS |
| SQLite 단일 DB | PASS — DB 변경 없음 |
| 추가 의존성 | PASS — 0개 |

## Project Structure

```text
backend/
├── services/
│   └── sentiment_analyzer.py   # 신규: 지표 조회 + 공포지수 계산
└── routes/
    ├── __init__.py              # 수정: sentiment_router 등록
    └── sentiment.py             # 신규: /sentiment/overview, /sentiment/history

frontend/src/
├── components/
│   └── SentimentPanel.tsx       # 신규: 게이지 + 미니카드 + 추이차트
├── pages/
│   └── Dashboard.tsx            # 수정: SentimentPanel 임베드
└── api/
    └── client.ts                # 수정: fetchSentiment, fetchSentimentHistory
```

## Implementation Approach

### Layer 1: 백엔드 — 데이터 조회 + 계산 (US1+US2)
1. **sentiment_analyzer.py** — yfinance로 VIX/지수/환율 병렬 조회, 합성 공포지수 계산, 분위기 판정
2. **routes/sentiment.py** — GET /sentiment/overview + GET /sentiment/history
3. **routes/__init__.py** — 라우터 등록

### Layer 2: 프론트엔드 — 대시보드 UI (US1+US2+US3)
4. **SentimentPanel.tsx** — 반원형 게이지(Fear & Greed) + 5개 미니카드 + 분위기 라벨 + 30일 추이 차트
5. **Dashboard.tsx** — SentimentPanel 임베드 (검색 바 아래)
6. **client.ts** — API 함수 추가

### Layer 3: 자동 갱신 (US4)
7. **React Query** — refetchInterval: 300000 (5분)
8. **"마지막 갱신" 타임스탬프** — updated_at 표시

### 의존 관계
```
Layer 1 (백엔드, 순차)
  sentiment_analyzer.py → routes/sentiment.py → __init__.py
        │
Layer 2 (프론트, Layer 1 이후)
  SentimentPanel.tsx → Dashboard.tsx → client.ts
        │
Layer 3 (Layer 2 이후)
  자동 갱신 + 타임스탬프
```

## Key Design: 합성 공포/탐욕 지수

CNN Fear & Greed API 차단으로 VIX 기반 자체 계산:

```
VIX → Fear/Greed Score (0~100):
  VIX >= 35  →  5  (Extreme Fear)
  VIX 25~35  → 20  (Fear)
  VIX 18~25  → 40  (Neutral)
  VIX 12~18  → 65  (Greed)
  VIX <= 12  → 85  (Extreme Greed)

+ S&P500 20일 수익률 보정 (±10점)
+ 코스피 등락률 보정 (±5점)
→ 최종 0~100 클램프
```

라벨: `"시장 변동성 지수"` (CNN 공포지수가 아님을 명확히)
