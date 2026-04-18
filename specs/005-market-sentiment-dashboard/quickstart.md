# Quickstart: 시장 방향성 대시보드

**Branch**: `005-market-sentiment-dashboard`

## 변경 대상 파일

### 백엔드 신규
- `backend/services/sentiment_analyzer.py` — 지표 조회 + 합성 공포지수 계산 + 분위기 판정
- `backend/routes/sentiment.py` — GET /sentiment/overview, GET /sentiment/history

### 백엔드 수정
- `backend/routes/__init__.py` — sentiment_router 등록

### 프론트엔드 신규
- `frontend/src/components/SentimentPanel.tsx` — 방향성 대시보드 컴포넌트 (게이지 + 미니카드 + 추이차트)

### 프론트엔드 수정
- `frontend/src/pages/Dashboard.tsx` — SentimentPanel 임베드 (검색 바 아래)
- `frontend/src/api/client.ts` — fetchSentiment, fetchSentimentHistory 함수

## 테스트 시나리오

1. **지표 조회**: /api/sentiment/overview → VIX, 코스피, S&P500, 나스닥, 환율 모두 반환 확인
2. **합성 공포지수**: VIX 수준에 따라 0~100 범위 값 확인
3. **분위기 요약**: 지수 등락에 따라 "위험 회피/낙관적/혼조세" 라벨 확인
4. **대시보드 표시**: 메인화면에 게이지 + 5개 미니카드 표시 확인
5. **30일 추이**: /api/sentiment/history → 30개 데이터포인트 + 미니 라인차트 확인
6. **자동 갱신**: 5분 후 데이터가 자동 갱신되는지 확인
7. **에러 처리**: yfinance 다운 시 "데이터를 불러올 수 없습니다" 안내 확인
