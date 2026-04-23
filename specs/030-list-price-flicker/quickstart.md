# Quickstart: 030 List Screens Realtime Price Flicker

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

### 2. 브라우저에서 확인

1. `http://localhost:5173` 접속
2. 대시보드 화면 진입
3. **추천종목 / 눌림목 / 대형주** 섹션에서 종목 카드 확인
4. 5초 대기 → 가격 변동 시 초록/파란 깜빡임 확인

### 3. 관심종목 테스트

1. 좌측 관심종목 패널 또는 관심종목 탭 진입
2. 등록된 종목의 현재가·등락률 확인
3. 5초마다 가격이 업데이트되며 깜빡임 발생 여부 확인

### 4. 스캔 페이지 테스트

1. `/scan` 경로 접속 또는 메뉴에서 스캔 페이지 이동
2. **추천종목 / 눌림목 / 대형주** 탭 이동하며 각 탭에서 깜빡임 확인

---

## 색상 검증 방법

| 시나리오 | 기대 색상 |
|----------|----------|
| 가격 상승 후 0.8초 | 초록색 깜빡임 (`var(--up)`) |
| 가격 하락 후 0.8초 | 파란색 깜빡임 (`var(--blue)`) |
| 변동 없음 | 깜빡임 없음 |
| 등락률 양수 (정적) | 초록색 텍스트 |
| 등락률 음수 (정적) | 파란색 텍스트 |
| 등락률 0.00% | 기본 텍스트 색 |

---

## 빌드 후 확인

```bash
# 프론트엔드 빌드 (백엔드가 dist/ 서빙)
cd /Users/woody/workflow/trading_view/frontend
pnpm build

# 백엔드 재시작
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

`http://localhost:8000` 에서 동일하게 검증.
