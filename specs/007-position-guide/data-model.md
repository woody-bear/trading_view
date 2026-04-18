# Data Model: 포지션 가이드

## Entities

### PositionStep (가이드 단계)

프론트엔드 전용 — DB 저장 없음. 컴포넌트 내부 판정.

| Field | Type | Description |
|-------|------|-------------|
| label | string | 단계 라벨 ("1차 진입 30%") |
| condition | string | 조건 설명 ("RSI < 40 + BB 하단") |
| ratio | number | 비중 (0.3 = 30%) |
| active | boolean | 현재 조건 충족 여부 |
| currentValue | string | 현재 지표값 ("RSI 35.2") |

### GuideState (가이드 전체 상태)

| Field | Type | Description |
|-------|------|-------------|
| type | 'buy' / 'sell' / 'neutral' | 가이드 종류 |
| steps | PositionStep[] | 단계 목록 (buy=3, sell=2, neutral=0) |
| activeCount | number | 활성 단계 수 |
| summary | string | 요약 문장 ("1/3 단계 진입 가능") |

## State Transitions

없음 — 읽기 전용 판정. 지표 변화에 따라 활성/대기가 자동 전환.
