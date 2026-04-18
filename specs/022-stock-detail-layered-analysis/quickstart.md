# Quickstart — 022 검증 절차

## 0. 사전 준비
- 브랜치: `022-stock-detail-layered-analysis` 체크아웃
- Python venv 활성화, `pnpm install` 완료

## 1. 백엔드 단위/통합 테스트
```bash
cd backend
pytest tests/unit/test_asset_class.py -v
pytest tests/integration/test_company_endpoint.py -v
```
기대: 모두 PASS, 미지원 자산군 200 응답 + `metrics: null` + 정확한 `asset_class` 검증.

## 2. 백엔드 재시작 (SR-02)
```bash
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```
스모크:
```bash
curl -s "http://localhost:8000/company/005930?market=KR" | jq '.asset_class, .metrics.per'
curl -s "http://localhost:8000/company/AAPL?market=US"  | jq '.asset_class, .metrics.per'
curl -s "http://localhost:8000/company/069500?market=KR" | jq '.asset_class, .metrics'   # KODEX 200 → ETF, null
curl -s "http://localhost:8000/company/BTC-USD?market=CRYPTO" | jq '.asset_class, .metrics'
```

## 3. 프론트 빌드 + 실행 (SR-03/04)
```bash
cd frontend
pnpm build         # dist/ 갱신 — 백엔드 SPA 서빙용
pnpm dev           # 개발 핫리로드
```

## 4. 시나리오 검증

| # | 종목 | URL | 기대 |
|---|------|-----|------|
| 1 | 005930 (KR 주식) | `/detail/KR/005930` | 기본 차트 탭, 가치 탭 활성·카드 7종 노출 |
| 2 | AAPL (US 주식) | `/detail/US/AAPL?tab=value` | 진입 시 가치 탭 활성, USD 표기 |
| 3 | 069500 (KR ETF) | `/detail/KR/069500` | 가치 탭 disabled, 클릭/탭 시 안내 |
| 4 | BTC-USD (Crypto) | `/detail/CRYPTO/BTC-USD` | 가치 탭 disabled, hover/탭 안내 |

각 시나리오에서 확인:
- ✅ 1차 탭 진입 시 차트가 0.5초 이내 렌더 (SC-001)
- ✅ 가치 탭 데이터 1.5초 이내 노출 (SC-002, p95)
- ✅ 탭 전환 후 1차 복귀 시 기간·지표 토글 유지 (FR-010)
- ✅ 뒤로가기로 이전 탭 복원 (FR-005)

## 5. 모바일 검증 (DevTools mobile or 실기기)
- 가치 탭 본문을 위/아래로 스와이프 → 카드 단위로 자석 정렬되는지 (FR-012)
- 상단 탭 스트립 sticky 유지, 하단 BottomNav와 중첩 없음 (FR-009)
- 비활성 탭(ETF/Crypto) 탭 시 토스트 노출

## 6. 회귀 체크
- 기존 차트 기능(BB/RSI/MACD/스퀴즈/BUY-SELL 마커)이 1차 탭에서 동일 위치·동일 동작인지 비교 (FR-002)
- 차트 마커 BUY/SELL 라벨 규칙(`rules/chart-buy-label.md`, `rules/chart-sell-label.md`) 준수 — 본 작업은 차트 로직 무변경이므로 라벨 룰 회귀 없음 확인.

## 7. 최종 재시작 순서 (SR-05)
1. 백엔드 종료 → 재시작
2. `pnpm build`
3. `pnpm dev` 재기동
