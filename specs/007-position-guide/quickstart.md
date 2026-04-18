# Quickstart: 007-position-guide

## 변경 파일

| 파일 | 변경 |
|------|------|
| `frontend/src/components/PositionGuide.tsx` | 신규 |
| `frontend/src/pages/SignalDetail.tsx` | PositionGuide 통합 |

## 검증

```bash
# 빌드 확인
cd frontend && pnpm build

# 시나리오 1: BUY 종목 (RSI < 40)
# → 차트 아래에 3단계 매수 가이드 표시, 1단계 활성

# 시나리오 2: SELL 종목 (RSI > 65)
# → 2단계 매도 가이드 표시

# 시나리오 3: NEUTRAL 종목
# → "신호 대기 중" 관망 안내

# 시나리오 4: 모든 가이드 하단에 면책 문구 확인
```
