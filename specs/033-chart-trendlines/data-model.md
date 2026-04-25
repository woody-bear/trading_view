# Data Model: 차트 추세선 채널 (033-chart-trendlines)

> **신규 DB 테이블 없음** — 모든 데이터는 on-demand 계산 + 서버 in-memory 캐시 (60s TTL)

---

## Backend Python Types

### SwingPoint

```python
@dataclass
class SwingPoint:
    index: int          # df 내 위치 (0-based)
    time: int           # Unix timestamp (초)
    price: float        # 고점(high) 또는 저점(low) 가격
    kind: Literal['high', 'low']
```

### ChannelLine

```python
@dataclass
class ChannelLine:
    start_time: int     # 첫 번째 스윙 포인트 timestamp
    start_price: float
    end_time: int       # 오늘(현재 날짜) timestamp으로 연장
    end_price: float    # 선형 연장 가격
    slope: float        # 단위: price per second
    intercept: float
```

### TrendChannel

```python
@dataclass
class TrendChannel:
    kind: Literal['downtrend', 'uptrend']
    main: ChannelLine       # 하락채널=상단선, 상승채널=하단선
    parallel: ChannelLine   # 하락채널=하단선, 상승채널=상단선
    valid: bool             # 스윙 포인트 2개 이상 존재 여부
```

### PhaseStep

```python
@dataclass
class PhaseStep:
    stage: int              # 1~5
    label: str              # "하락추세선 돌파" 등
    completed: bool
    completed_time: int | None    # 완료 시점 timestamp
    completed_price: float | None # 완료 시점 종가
    volume_ratio: float | None    # 직전 5거래일 평균 대비 배율
```

### TrendPhaseResult

```python
@dataclass
class TrendPhaseResult:
    current_stage: int      # 0=시작 전, 1~5=진행 중/완료, 5=전환 완성
    steps: list[PhaseStep]
    inflection_times: list[int]  # 볼륨 하이라이트용 캔들 timestamps
    insufficient: bool      # 데이터 부족 또는 채널 계산 불가
    message: str | None     # insufficient=True 시 안내 메시지
```

### PeriodResult (API 응답 단위)

```python
@dataclass
class PeriodResult:
    down_channel: TrendChannel | None
    up_channel: TrendChannel | None
    phase: TrendPhaseResult
    candle_count: int       # 해당 기간의 실제 캔들 수
```

---

## Frontend TypeScript Types

```typescript
// 기존 TrendLine 타입 재사용 (client.ts line 174)
// 채널 라인은 TrendLine 포맷으로 변환하여 TrendLinesOverlay에 전달

export interface TrendChannelLine {
  kind: 'downtrend_main' | 'downtrend_parallel' | 'uptrend_main' | 'uptrend_parallel'
  start: { time: number; price: number }
  end: { time: number; price: number }
  style: { color: string; dashed: boolean }
}

export interface TrendPhaseStep {
  stage: number
  label: string
  completed: boolean
  completed_time: number | null
  completed_price: number | null
  volume_ratio: number | null
}

export interface TrendPeriodResult {
  lines: TrendChannelLine[]          // TrendLine[] 호환 (오버레이용)
  phase: {
    current_stage: number
    steps: TrendPhaseStep[]
    inflection_times: number[]       // 볼륨 하이라이트 timestamp 목록
    insufficient: boolean
    message: string | null
  }
  candle_count: number
}

export interface TrendlineChannelsResponse {
  symbol: string
  market: string
  periods: {
    '1m': TrendPeriodResult
    '3m': TrendPeriodResult
    '6m': TrendPeriodResult
    '12m': TrendPeriodResult
  }
  evaluated_at: string
}
```

---

## 색상 매핑

| 라인 종류 | color | dashed |
|-----------|-------|--------|
| downtrend_main | `#ef4444` (빨강) | false |
| downtrend_parallel | `#ef4444` | true |
| uptrend_main | `#22c55e` (초록) | false |
| uptrend_parallel | `#22c55e` | true |
| 볼륨 하이라이트 바 | `rgba(251,191,36,0.8)` (노랑) | N/A |

---

## 상태 전이도 (5단계 추세 전환)

```
[0: 미진행]
    │ 하락추세선(main) 종가 상향 돌파
    ▼
[1: 하락추세선 돌파 완료]
    │ 하락채널 평행선 ±2% 반등 확인
    ▼
[2: 평행추세선 지지 완료]
    │ 하락채널 평행선 종가 상향 돌파
    ▼
[3: 평행추세선 돌파 완료]
    │ 상승채널 하단선(main) ±2% 반등 확인
    ▼
[4: 상승추세선 지지 완료]
    │ 상승채널 상단선(parallel) 종가 상향 돌파
    ▼
[5: 매수급소 완성 — 추세 전환 완성]
```
