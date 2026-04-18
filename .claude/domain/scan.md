---
purpose: 전체 시장 스캔 조건·카테고리 판정(chart_buy, 관심 등) 도메인 규칙.
reader: Claude가 스캔 결과 분류 로직이나 카테고리 기준을 수정할 때.
update-trigger: 스캔 카테고리 추가·제거; 판정 조건 임계값 변경; 거래량 필터 기준 변경.
last-audit: 2026-04-18
---

# Domain — 전체 시장 스캔 조건

> 소스: `backend/services/full_market_scanner.py`, `backend/services/unified_scanner.py`  
> 스캔 대상 종목 리스트: `.claude/rules/scan-symbols.md`

## 스캔 시스템 구조

| 시스템 | 방식 | 용도 |
|--------|------|------|
| full_market_scanner | DB 스냅샷 (백그라운드) | 정기 스케줄 스캔, 텔레그램 알림 원본 |
| unified_scanner | 인메모리 캐시 | 새로고침 버튼 (실시간성 보완) |

---

## 공통 설정

| 항목 | 값 |
|------|-----|
| 데이터 기간 | 1년 (1y) |
| 봉 간격 | 일봉 (1d) |
| 최소 캔들 수 | 60개 |
| 청크 크기 | 100개 |
| 청크 타임아웃 | 120초 |
| 스냅샷 보관 수 | 최근 10개 |

---

## 신뢰도 점수 (0~100)

> 모든 종목에 대해 계산되며, 카테고리 분류와는 독립적으로 산출된다.

| 조건 | 점수 |
|------|------|
| 스퀴즈 레벨 × 25 | 최대 75 |
| BULL 트렌드 | +15 |
| RSI < 40 | +10 |
| BB %B < 0.3 | +5 |
| MACD > 0 | +5 |
| 거래량 비율 > 1.0 | +5 |

---

## 카테고리 1 — chart_buy

> **표시 기준 상세**: `.claude/rules/chart-buy-label.md`

### 판정 파이프라인

```
_analyze_ticker()
  [1] EMA Dead Cross 체크 → EMA20 < EMA50이면 전체 스킵 (종목 자체 제외)
  [2] _check_buy_signal_precise() → BUY / SQZ BUY 마커 탐색 (10거래일 이내)
  [3] _passes_volume_filter() → 신호일 거래량 > 직전 5일 평균 × 1.5
  → 모두 통과 시 chart_buy 분류
```

---

## 카테고리 2 — overheat (투자과열)

> 한국(KR) 개별주 전용. ETF 제외.

### 진입 조건

```
market == "KR"
AND is_etf == False
AND volume_ratio >= 0.1  (거래량 데이터 존재)
AND (
    RSI >= 70
    OR (RSI >= 65 AND volume_ratio >= 2.0)
)
```

| 조건 | 설명 |
|------|------|
| RSI >= 70 | 단독 과열 판정 |
| RSI >= 65 AND 거래량 2배+ | 거래량 급증 동반 시 완화된 RSI 기준 |

> Dead Cross(EMA20 < EMA50) 종목은 `_analyze_ticker()` 초입에서 이미 제외되므로, overheat 판정 대상에도 포함되지 않는다.

---

## 대시보드 표시 정책

| 항목 | 값 |
|------|-----|
| chart_buy 표시 제한 | KR 최대 5개 + US 최대 5개 (`_cap_chart_buy()`) |
| overheat 표시 제한 | 없음 (전체 표시) |
| 실시간 저장 | chart_buy는 청크 완료 시 즉시 DB 저장 (스캔 중에도 대시보드에 표시) |
| 프론트 폴링 | 스캔 진행 중이면 5초 간격으로 `/api/scan/full/latest` 폴링 |
| 정렬 | BULL 트렌드 종목 우선 |

---

## 스케줄

| 대상 | 시각 (KST) | 요일 |
|------|-----------|------|
| KR 전체 스캔 | 9:30, 10:00~15:30 매시:00/:30 | 평일 |
| US+CRYPTO 스캔 | 19:50 | 평일 |
| US+CRYPTO 스캔 | 03:50 | 화~토 |
| BUY 텔레그램 (KR) | 10:30, 15:00 | 평일 |
| BUY 텔레그램 (US) | 20:00, 04:00 | 평일/화~토 |

---

## 성능

| 항목 | 값 |
|------|-----|
| 전체 종목 수 | ~1,198 (KR ~470 + US ~718 + CRYPTO 10) |
| API 응답 속도 | ~31ms (DB 즉시 반환) |

---

## Signal Engine (관심종목 모니터링)

watchlist 관심종목에 대해 30분마다 별도 실행하는 신호 엔진.  
전체 시장 스캔과 판정 로직이 다름.

### 민감도 프리셋

| 설정 | 조건 수 | RSI | BB %B |
|------|---------|-----|-------|
| strict | 4/4 | < 30 | < 0.05 |
| normal | 3/4 | < 35 | < 0.15 |
| sensitive | 2/4 | < 40 | < 0.25 |

→ 상세: `.claude/backend/indicators.md`
