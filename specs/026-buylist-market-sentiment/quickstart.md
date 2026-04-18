# Quickstart: 026-buylist-market-sentiment

**Date**: 2026-04-19

---

## 검증 순서

### 1. 텍스트 변경 확인

```bash
# 브라우저에서 /buy-list 페이지 접속
# 확인: 타이틀 "종목리스트" 표시
# 확인: "전체 스캔 대상 종목" 텍스트 없음
```

### 2. 백엔드 서버 시작

```bash
cd /Users/woody/workflow/trading_view
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### 3. 신규 API 엔드포인트 테스트

```bash
# 시장분위기 집계
curl http://localhost:8000/scan/market-sentiment | python3 -m json.tool

# 응답 검증:
# - KR.ema_alignment.golden_pct + death_pct + other_pct == 100
# - KR.volume_spike.periods 길이 == 3 (20/30/60일)
# - computed_at 필드 존재

# 시총 분포 (CRYPTO 추가 확인)
curl http://localhost:8000/scan/symbols/market-cap-distribution | python3 -m json.tool
# 응답에 KR, US, CRYPTO 모두 있어야 함
```

### 4. 프론트엔드 빌드 및 확인

```bash
cd frontend
pnpm build
pnpm dev
```

브라우저 확인 체크리스트:
- [ ] 시총 분포 차트: KR → US → CRYPTO 순서
- [ ] EMA 배열 차트: KR행 / US행 / CRYPTO행 세로 나열
- [ ] EMA 배열 각 행: 정배열(초록) / 역배열(빨강) / 기타(회색) 3구간 + 종목수·비율 레이블
- [ ] 거래량 급등 차트: KR행 / US행 / CRYPTO행 세로 나열
- [ ] 거래량 급등 각 행: 20일 / 30일 / 60일 룩백 수치 + top_sector 표시
- [ ] 차트 영역 너비 화면의 30%, 왼쪽 정렬
- [ ] 배치 순서: 시총 분포 → EMA 배열 → 거래량 급등

### 5. DB 마이그레이션 확인

```bash
# alembic 마이그레이션 실행 후
sqlite3 trading_view.db "SELECT symbol, sector FROM stock_master LIMIT 5;"
# sector 컬럼이 있어야 하고, US 종목은 yfinance 섹터값, KR은 KOSPI/KOSDAQ, CRYPTO는 "암호화폐"
```
