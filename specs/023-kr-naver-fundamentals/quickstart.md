# Quickstart — 023 검증 절차

## 0. 사전 준비
- 브랜치: `023-kr-naver-fundamentals`
- Python venv 활성화
- 022 기능(가치 분석 탭)이 main에 머지되어 동작 중

## 1. 백엔드 단위 테스트 (파싱)
```bash
cd backend
.venv/bin/python -m pytest tests/unit/test_naver_fundamentals.py -v
```
기대: HTML fixture 기반 파싱이 PER/PBR/EPS/BPS + reporting_period를 정확히 추출.

## 2. 백엔드 통합 테스트 (보강·폴백)
```bash
.venv/bin/python -m pytest tests/integration/test_company_endpoint.py -v -k naver
```
시나리오:
- KR 개별주 + 네이버 성공 → metric_sources에 `"per":"naver"` 포함
- KR 개별주 + 네이버 타임아웃 → metric_sources 전부 `"yfinance"`, 200 유지
- US 종목 → 네이버 호출 스킵, 기존 동작 동일
- ETF → 네이버 호출 스킵

## 3. 백엔드 재시작 (SR-02)
```bash
lsof -ti:8000 | xargs -I{} ps -p {} -o comm=      # cloudflared 섞여있지 않은지 확인
# uvicorn PID만 골라 kill 후 재기동
.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000
```

## 4. 라이브 스모크
```bash
# SK하이닉스 — 네이버 보강 성공 기대
curl -s "http://localhost:8000/api/company/000660?market=KR" | \
  jq '{per: .metrics.per, pbr: .metrics.pbr, eps: .metrics.eps, bps: .metrics.bps, sources: .metric_sources, rp: .reporting_period}'

# 삼성전자
curl -s "http://localhost:8000/api/company/005930?market=KR" | \
  jq '{per: .metrics.per, pbr: .metrics.pbr, sources: .metric_sources}'

# AAPL — 네이버 스킵 확인 (sources 전부 yfinance)
curl -s "http://localhost:8000/api/company/AAPL?market=US" | jq '.metric_sources'

# 관측 엔드포인트
curl -s "http://localhost:8000/api/system/naver-stats" | jq .
```

## 5. 프론트 빌드 + 실행 (SR-03/04)
```bash
cd frontend
pnpm build   # dist 갱신
pnpm dev     # 개발 서버
```

## 6. 브라우저 수동 확인
1. SK하이닉스 상세 → 가치 분석 탭 → PER/PBR/EPS/BPS 카드에 값 노출 + sublabel "… · 네이버"
2. AAPL 상세 → 가치 분석 탭 → sublabel "… · yfinance"
3. KODEX 200 (069500) → 가치 분석 탭 disabled → 네이버 호출 로그 없음 (관측 엔드포인트 변화 없음)
4. 네이버 페이지 변경 시뮬레이션 — hosts 파일로 `finance.naver.com` → 127.0.0.1 일시 매핑 → 재요청 시 카드 값은 yfinance 기반으로 표시되어야 함 (폴백)

## 7. 회귀 체크
- 022의 ValueAnalysisTab 렌더링(11개 카드·중요도 순·하이라이트) 유지
- `rules/chart-buy-label.md` / `rules/chart-sell-label.md` 무영향 (스캔·차트 로직 변경 없음)
- 전체 스캔(`/api/scan/full/latest`)에 네이버 호출 포함되지 않음 — 스캔 완료 시간 변동 없음

## 8. 최종 재시작 순서 (SR-05)
1. uvicorn 재시작 (cloudflared 보존)
2. `pnpm build`
3. `pnpm dev` 재기동
4. Cmd+Shift+R로 브라우저 강제 리로드
