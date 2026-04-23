# Quickstart: 031 BUY Signal Age Label

**Phase 1 output** | 2026-04-23

---

## 로컬 개발 환경에서 기능 테스트

### 1. 서버 시작

```bash
# 백엔드 (터미널 1)
cd /Users/woody/workflow/trading_view
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# 프론트엔드 (터미널 2)
cd /Users/woody/workflow/trading_view/frontend
pnpm dev
```

### 2. P1 검증 — 스캔 결과 카드 경과일 라벨

1. `http://localhost:5173` 접속
2. 대시보드 PC 화면의 추천종목·눌림목·대형주 섹션 확인
3. 각 종목 카드에서 기존 날짜 문자열(`2026-04-XX`) 대신 "N일 전" 또는 "오늘" 형식의 라벨 확인
4. 7일 이하 종목: 강조 색상 라벨, 8일 이상 종목: 흐린 색상 라벨 확인

### 3. P2 검증 — 관심종목 카드 경과일 라벨

1. 대시보드 PC 화면에서 관심종목 패널 확인
2. BUY 신호 상태 종목에서 "N일 전" 라벨 확인
3. SELL/NEUTRAL 상태 종목에서 라벨 미표시 확인

### 4. 스캔 페이지 검증

1. `/scan` 경로로 이동
2. 추천종목·눌림목·대형주 탭에서 동일한 경과일 라벨 확인

---

## 색상 검증 기준

| 시나리오 | 기대 표시 |
|---------|---------|
| 신호 발생일 = 오늘 | "오늘" (강조 색상) |
| 신호 발생일 = 3일 전 | "3일 전" (강조 색상) |
| 신호 발생일 = 7일 전 | "7일 전" (강조 색상) |
| 신호 발생일 = 8일 전 | "8일 전" (흐린 색상) |
| 신호 발생일 = 20일 전 | "20일 전" (흐린 색상) |
| 신호 발생일 데이터 없음 | 라벨 미표시 |
| SELL/NEUTRAL 상태 관심종목 | 라벨 미표시 |

---

## 빌드 후 확인

```bash
cd /Users/woody/workflow/trading_view/frontend
pnpm build
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

`http://localhost:8000` 에서 동일하게 검증.
