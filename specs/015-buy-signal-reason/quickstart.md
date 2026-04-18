# Quickstart: BUY 신호 이유 한줄 설명

## 검증 시나리오

### 시나리오 1: SQZ BUY + 상승추세 + 거래량 급증

```
입력: { last_signal: 'SQZ BUY', trend: 'BULL', volume_ratio: 3.2, last_signal_date: '2026-04-02' }
기대 출력: "스퀴즈 압축이 해소되며 상승추세에서 거래량이 [3.2배] 급증했습니다 (04-02)"
배너 표시: ✅
강조 수치: 3.2
```

### 시나리오 2: BUY + RSI 강한 과매도 + 상승추세

```
입력: { last_signal: 'BUY', rsi: 24, trend: 'BULL', volume_ratio: 1.2, last_signal_date: '2026-04-01' }
기대 출력: "RSI [24] 강한 과매도 구간에서 BB 하단 반등 · 상승추세 유지 (04-01)"
배너 표시: ✅
강조 수치: 24
```

### 시나리오 3: BUY + RSI 과매도 + 거래량 급증 + MACD 상향

```
입력: { last_signal: 'BUY', rsi: 36, volume_ratio: 2.8, macd_hist: 0.15, last_signal_date: '2026-04-03' }
기대 출력: "RSI [36] 과매도 + 거래량 [2.8배] 급증 + MACD 상향 · 복합 매수 신호 (04-03)"
배너 표시: ✅
강조 수치: 36, 2.8
```

### 시나리오 4: BUY + 기본 (최소 데이터)

```
입력: { last_signal: 'BUY', rsi: 38 }
기대 출력: "RSI [38] 과매도 구간에서 볼린저 밴드 하단을 되돌리며 반등 신호 발생"
배너 표시: ✅
강조 수치: 38
```

### 시나리오 5: BUY 리스트 외 진입 (비표시)

```
입력: navigate state 없음 (검색/URL 직접/관심종목 탭)
기대 결과: BuySignalBanner 렌더링 안 됨
배너 표시: ❌
```

### 시나리오 6: 지표 데이터 없음 (Fallback)

```
입력: { last_signal: 'BUY', last_signal_date: '2026-04-02' }
기대 출력: "BUY 신호가 감지됐습니다 (04-02)"
배너 표시: ✅ (fallback 문장)
```

## 통합 테스트 순서

1. Dashboard 모바일 스냅 → 차트 BUY 신호 섹션에서 종목 카드 탭
2. SignalDetail 진입 → 가격 영역 아래 BuySignalBanner 확인
3. BuySignalBanner → PositionGuide 순서 확인
4. 브라우저 새로고침 → 배너 사라짐 확인
5. 검색으로 동일 종목 진입 → 배너 없음 확인

## 개발 실행 방법

```bash
cd frontend && pnpm dev
# localhost:3000 → 모바일 에뮬레이터로 확인
# 차트 BUY 신호 리스트 → 종목 카드 탭 → 상세 화면 상단 배너 확인
```
