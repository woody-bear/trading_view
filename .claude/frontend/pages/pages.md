---
purpose: frontend/src/pages/ 각 페이지 기능·API 호출·라우트 매핑.
reader: Claude가 페이지를 추가·수정하거나 페이지 간 데이터 흐름을 파악할 때.
update-trigger: pages/ 파일 추가·제거; 페이지별 API 호출 세트 변경; 라우트 경로 변경.
last-audit: 2026-04-18
---

# Frontend — 페이지 (pages/)

> 소스: `frontend/src/pages/`

## 페이지 목록

| 파일 | 경로 | 설명 |
|------|------|------|
| `Dashboard.tsx` | `/` | 홈화면 — 관심종목 + 전체 시장 스캔 |
| `BuyList.tsx` | `/buy-list` | BUY 스캔 종목 전체 목록 |
| `Scan.tsx` | `/scan` | 전체 시장 스캔 상세 |
| `SignalDetail.tsx` | `/:symbol` | 종목 상세 — 차트 + 지표 + 회사정보 |
| `Forex.tsx` | `/forex` | 환율 분석 (적정환율 + 추이) |
| `Settings.tsx` | `/settings` | 앱 설정 |
| `Scrap.tsx` | `/scrap` | BUY 패턴 케이스 스크랩 |
| `AlertHistory.tsx` | `/alerts` | 텔레그램 알림 이력 |
| `AuthCallback.tsx` | `/auth/callback` | Google OAuth 콜백 처리 |

---

## 페이지별 상세

### Dashboard.tsx — 홈화면

**주요 기능:**
- 관심종목 목록 (시장별 그룹: KR → US → CRYPTO)
- 종목 검색 + 관심종목 추가
- 전체 시장 스캔 결과 (PC만 표시: `hidden md:block`)
  - 추천종목 / MAX SQ / 차트 BUY 신호 섹션
- 실시간 가격 반영 (WebSocket + 10초 배치 갱신)

**API 호출:**
- `GET /api/signals` — 관심종목 신호 (React Query, 10초 리패치)
- `GET /api/scan/full/latest` — 전체 스캔 스냅샷
- `POST /api/prices/batch` — 10초 간격 배치 가격
- `WebSocket /ws` — 실시간 가격/신호

**레이아웃:**
- 모바일: 카드 배경 없음, 1열
- PC: `bg-card` 박스, 2열(md) / 3열(lg)

---

### BuyList.tsx — BUY 스캔 목록

**주요 기능:**
- 전체 스캔 스냅샷의 chart_buy 종목 전체 표시
- 시장 필터 (KOSPI / KOSDAQ / US / 전체)
- 각 종목: 신호일, 지표값, 차트 링크

**API 호출:**
- `GET /api/scan/full/latest` — 최신 스냅샷

---

### Scan.tsx — 전체 시장 스캔 상세

**주요 기능:**
- 스캔 이력 10개 표시
- 수동 스캔 트리거 버튼
- 진행 중 프로그레스바 (5초 폴링)
- 스냅샷별 picks / max_sq / chart_buy 결과

**API 호출:**
- `GET /api/scan/full/latest`
- `GET /api/scan/full/history`
- `POST /api/scan/full/trigger`
- `GET /api/scan/full/status` (폴링)

---

### SignalDetail.tsx — 종목 상세

**URL 패턴:** `/:symbol?market=KR` (market 쿼리 파라미터)

**주요 기능:**
- lightweight-charts 캔들 차트 + BUY/SELL 마커
- 실시간 가격 (useRealtimePrice 훅)
- 지표 패널: RSI, BB, MACD, EMA, 스퀴즈
- 회사 정보 패널 (CompanyInfoPanel)
- 투자 지표 패널 (InvestmentMetricsPanel)
- 매출 구성 차트 (RevenueSegmentChart)
- 호가창 패널 (OrderbookPanel) — KR만
- 시장 심리 패널 (SentimentPanel)
- 포지션 가이드 (PositionGuide)

**API 호출:**
- `GET /api/signals/by-symbol/{symbol}`
- `GET /api/chart/by-symbol/{symbol}`
- `GET /api/company/{symbol}`
- `GET /api/financials/{symbol}`
- `GET /api/stocks/{symbol}/orderbook` (KR)

---

### Forex.tsx — 환율

**주요 기능:**
- 탭 1: 적정환율 (분석 + 게이지)
- 탭 2: 환율추이 (lightweight-charts 3개)
- 기간 선택: 1M / 3M / 6M / 1Y

**API 호출:**
- `GET /api/forex/analysis?period=3M`
- `GET /api/forex/chart`

---

### Settings.tsx — 설정

**주요 기능:**
- BUY/SELL 신호 민감도 선택 (strict/normal/sensitive)
- 차트 봉 단위 선택 (15m~1w)
- 텔레그램 봇 설정 + 테스트
- 한국투자증권 API 설정 + 연결 테스트

**API 호출:**
- `GET/PUT /api/settings/sensitivity`
- `GET/PUT /api/settings/telegram`
- `POST /api/settings/telegram/test`
- `GET/PUT /api/settings/kis`
- `POST /api/settings/kis/test`

---

### Scrap.tsx — 패턴 케이스 스크랩

**주요 기능:**
- BUY 신호 우수 사례 등록/조회
- 패턴 유형 필터
- 결과율(result_pct) 표시

**API 호출:**
- `GET/POST/PATCH/DELETE /api/pattern-cases`

---

### AlertHistory.tsx — 알림 이력

**주요 기능:**
- 텔레그램 알림 발송 이력 목록
- alert_type 필터

**API 호출:**
- `GET /api/alerts/history`
