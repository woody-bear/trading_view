# Research: 메인페이지 종목 카드 항목 및 디자인 개선

## Decision 1: 섹터 데이터 없음 → market_type 배지로 대체

**Decision**: 섹터/업종 라벨 대신 market_type 배지(KOSPI/KOSDAQ/SP500/NQ100/R1000)를 사용한다.

**Rationale**: stock_master 테이블과 CurrentSignal 모델 모두 sector/업종 컬럼이 존재하지 않는다. 국내·미국 모두 market_type(KOSPI/KOSDAQ/NASDAQ100/SP500/RUSSELL1000)이 해당 종목의 시장 특성을 설명하는 가장 유효한 분류다.

**Alternatives considered**: yfinance 섹터 실시간 조회 → 지연·비용 발생으로 기각. DB에 섹터 컬럼 추가 → 이번 범위 초과로 기각.

---

## Decision 2: 관심종목(SignalCard) market_type 노출을 위한 백엔드 변경 필요

**Decision**: `/api/signals` 엔드포인트에 `market_type` 필드를 추가한다 (stock_master 조인).

**Rationale**: 현재 signals API는 `market`(KR/US/CRYPTO)만 반환하고 `market_type`(KOSPI/KOSDAQ/SP500 등)은 없다. 시장 유형 배지를 관심종목 카드에 표시하려면 이 정보가 필요하다. BuyCard·PickCard·overheat은 이미 `market_type`을 가지고 있다.

**Implementation**: signals 라우트에서 watchlist 심볼로 stock_master를 조인하거나 캐시 조회하여 market_type 추가.

**Alternatives considered**: 프론트엔드에서 market을 보고 KR→"한국주식"으로 표시 → 너무 큰 카테고리여서 정보 가치 낮음. 기각.

---

## Decision 3: 공유 라벨 유틸리티 파일 도입

**Decision**: `frontend/src/utils/indicatorLabels.ts` 신규 파일로 라벨 생성 로직을 공통화한다.

**Rationale**: 현재 SignalCard.tsx와 Dashboard.tsx에 중복된 라벨 로직이 각각 존재한다. 4개 카드 타입 모두 동일한 색상 체계·기준값을 써야 하므로 단일 출처(single source of truth)가 필요하다.

**Structure**:
```typescript
type Badge = { label: string; cls: string; priority: number }
function marketBadge(marketType: string): Badge       // 시장 유형 (항상)
function signalBadge(state, grade): Badge | null       // 신호 강도 (있을 때)
function indicatorBadges(data): Badge[]               // 지표 조건 (최대 4개)
```

---

## Decision 4: 지표 라벨 우선순위 및 최대 4개 제한

**Decision**: 지표 조건 라벨은 아래 우선순위 순서로 최대 4개 선택한다.
1. 스퀴즈 레벨 (MAX SQ > MID SQ > LOW SQ)
2. RSI 상태 (과매도 < 과매수 < 낮음)
3. BB %B 상태 (하단 > 상단)
4. 거래량 (폭증 > 급증 > 증가)
5. MACD 방향 (↑)

**Rationale**: 스퀴즈+RSI+BB가 이 시스템의 핵심 매수 조건이므로 우선 표시. 거래량·MACD는 보조 확인 지표.

---

## Decision 5: 컬러 테마 조정값

**Decision**: CSS 변수를 아래와 같이 조정한다.

| 변수 | 현재값 | 변경값 | 설명 |
|------|--------|--------|------|
| `--bg` | #0D1117 | #141E2E | 페이지 배경 (한 단계 밝게) |
| `--card` | #161B22 | #1C2840 | 카드 배경 (한 단계 밝게) |
| `--border` | #30363D | #2E3F5C | 테두리 (카드와 조화) |
| `--navy` | #1B2A4A | #223358 | 헤더 네비 (한 단계 밝게) |
| `--muted` | #8B949E | #94A3B8 | 흐린 텍스트 (slate-400으로 약간 밝게) |

**Rationale**: 현재 #0D1117은 GitHub dark 테마 수준으로 매우 어둡다. 한 단계 올린 진한 네이비 계열(#141E2E)은 눈부심 없이 카드(#1C2840)와 명확한 대비를 형성한다. 흰색 텍스트 가독성 유지.

**Alternatives considered**: slate-800 계열(#1e293b) → 너무 회색빛, 현재 네이비 톤과 불일치. 기각.

---

## Decision 6: signal_grade 값 및 표시 방식

**Decision**: signal_grade는 "STRONG"/"NORMAL"/"WEAK" 3단계. signal_state(BUY/SELL)와 조합하여 "STRONG BUY", "WEAK BUY", "STRONG SELL"로 표시. NORMAL은 별도 강도 라벨 없이 BUY/SELL만 표시.

**Rationale**: NORMAL은 일반 조건이므로 라벨 추가 불필요. STRONG/WEAK만 의미 있는 강도 표시.
