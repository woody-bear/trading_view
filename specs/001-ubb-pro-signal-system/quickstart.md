# 빠른 시작 가이드: UBB Pro Signal System

**피처**: `001-ubb-pro-signal-system` | **날짜**: 2026-03-16

## 사전 요구사항

- Python 3.12+
- Node.js 20 LTS
- pnpm (`npm install -g pnpm`)
- uv (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- 텔레그램 봇 토큰 + 채팅 ID (선택 — 없어도 대시보드 사용 가능)

## 1단계: 초기 설치

```bash
# 저장소 루트에서
cd backend
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
mkdir -p data

# DB 초기화
alembic upgrade head

# 프론트엔드
cd ../frontend
pnpm install

# 환경변수
cd ..
cp .env.example .env
# .env 편집: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 입력
```

## 2단계: 개발 모드 실행

```bash
# 터미널 1: 백엔드
cd backend && source .venv/bin/activate
uvicorn app:app --reload --port 8000

# 터미널 2: 프론트엔드
cd frontend
pnpm dev
```

- 백엔드 API: http://localhost:8000/api
- Swagger UI: http://localhost:8000/docs
- 프론트엔드: http://localhost:3000

## 3단계: 첫 종목 등록

```bash
# API로 한국 주식 추가
curl -X POST http://localhost:8000/api/watchlist \
  -H "Content-Type: application/json" \
  -d '{"market": "KR", "symbol": "005930", "timeframe": "1h"}'

# 미국 주식 추가
curl -X POST http://localhost:8000/api/watchlist \
  -H "Content-Type: application/json" \
  -d '{"market": "US", "symbol": "AAPL", "timeframe": "1h"}'

# 비트코인 추가
curl -X POST http://localhost:8000/api/watchlist \
  -H "Content-Type: application/json" \
  -d '{"market": "CRYPTO", "symbol": "BTC/USDT", "timeframe": "1h"}'
```

또는 대시보드 웹 UI에서 "종목 추가" 페이지를 통해 등록.

## 4단계: 수동 스캔 테스트

```bash
# 즉시 스캔 실행
curl -X POST http://localhost:8000/api/scan/trigger

# 현재 신호 확인
curl http://localhost:8000/api/signals
```

## 5단계: 운영 모드

```bash
# 프론트엔드 빌드 + 단일 포트 실행
./scripts/start.sh --build
# → http://localhost:8000 에서 API + 대시보드 접근
```

## 6단계: TradingView 웹훅 (선택)

```bash
# ngrok으로 외부 노출
ngrok http 8000
# → TradingView Alert URL에 https://xxxx.ngrok.io/api/webhook/tradingview 입력
# → .env에 TV_WEBHOOK_SECRET 설정 후 TradingView Alert 헤더에 동일 값 추가
```

## 확인 포인트

| 항목 | 확인 방법 |
|------|-----------|
| 백엔드 정상 동작 | `GET /api/system/health` → `{"status": "healthy"}` |
| DB 연결 | `backend/data/ubb_pro.db` 파일 생성 확인 |
| 스케줄러 동작 | 로그에서 10분 간격 스캔 메시지 확인 |
| 텔레그램 연동 | 설정 후 수동 스캔으로 신호 전환 발생 시 알림 수신 |
| WebSocket 연동 | 대시보드에서 스캔 결과 실시간 업데이트 확인 |

## 문제 해결

- **ImportError**: `source .venv/bin/activate` 확인
- **DB 오류**: `alembic upgrade head` 재실행
- **텔레그램 미발송**: `.env`의 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` 확인
- **한국 주식 데이터 없음**: 장외 시간에는 데이터가 갱신되지 않을 수 있음 (15분 지연 포함)
- **포트 충돌**: `lsof -i:8000`으로 기존 프로세스 확인 후 종료
