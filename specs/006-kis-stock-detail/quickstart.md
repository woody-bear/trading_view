# Quickstart: 006-kis-stock-detail

## 개발 환경 설정

```bash
# 백엔드
cd backend && source .venv/bin/activate
# KIS API 키 설정 (.env에 아래 값 필요)
# KIS_APP_KEY=PSxxx
# KIS_APP_SECRET=xxx
# KIS_ACCOUNT_NO=00000000-01

# 프론트엔드
cd frontend && pnpm install
```

## 핵심 변경 파일

| 파일 | 변경 |
|------|------|
| `backend/services/kis_client.py` | `get_stock_detail()`, `get_orderbook()` 추가 |
| `backend/routes/prices.py` | 2개 엔드포인트 추가 |
| `frontend/src/components/StockFundamentals.tsx` | 신규: 투자지표 + 52주 범위 |
| `frontend/src/components/OrderbookPanel.tsx` | 신규: 호가창 |
| `frontend/src/components/RiskWarningBanner.tsx` | 신규: 위험경고 배너 |
| `frontend/src/pages/SignalDetail.tsx` | 위 컴포넌트 통합 |

## 검증 방법

```bash
# 1. 백엔드 API 테스트
curl http://localhost:8000/api/stocks/005930/detail?market=KR
curl http://localhost:8000/api/stocks/005930/orderbook?market=KR

# 2. KIS 미연동 시 graceful 처리 확인
# .env에서 KIS_APP_KEY 주석 처리 후 재시작
curl http://localhost:8000/api/stocks/005930/detail
# → {"status": "unavailable", "reason": "kis_not_configured"}

# 3. 프론트엔드 확인
# 한국 종목 상세 → 투자지표/호가/경고 표시
# 미국 종목 상세 → 투자지표만 표시
# 암호화폐 상세 → KIS 패널 숨김
```

## 의존성

- pykis 라이브러리 (이미 설치됨)
- KIS API 키 (선택, 없으면 graceful degradation)
