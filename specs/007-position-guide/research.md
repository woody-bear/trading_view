# Research: 포지션 가이드

## Decision 1: 데이터 소스

**Decision**: 기존 SignalDetail의 `s` 객체 (current_signal + chartData.current)에서 직접 참조
**Rationale**: 별도 API 호출 없이 이미 로드된 데이터 사용 → 즉시 표시
**Alternatives**: 백엔드 포지션 판정 API (오버킬), localStorage 포지션 상태 저장 (이 기능 범위 밖)

### 사용 가능한 지표 (SignalDetail `s` 객체)

| 필드 | 타입 | 용도 |
|------|------|------|
| `s.signal_state` | string | BUY/SELL/NEUTRAL 판정 |
| `s.rsi` | number | RSI 30/40/65/70 기준 |
| `s.bb_pct_b` | number | BB %B 하단(0.2)/상단(0.8) |
| `s.ema_20` | number | EMA20 vs EMA50 비교 |
| `s.ema_50` | number | BULL 트렌드 판정 |
| `s.squeeze_level` | number | 스퀴즈 레벨 |
| `s.confidence` | number | 신호 강도 |

## Decision 2: 가이드 상태 판정 로직

**Decision**: 프론트엔드 순수 함수로 구현 (입력: 지표값 → 출력: 단계별 활성/대기)
**Rationale**: 지표 기준값이 고정이므로 서버 로직 불필요. 컴포넌트 내 인라인 판정.

## Decision 3: 배치 위치

**Decision**: 차트 아래, 투자지표(StockFundamentals) 위
**Rationale**: 차트에서 신호를 확인한 직후 "다음 행동"을 바로 볼 수 있는 위치
