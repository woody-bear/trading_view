# Quickstart — 024 검증 절차

## 0. 사전 준비

- 브랜치: `024-trend-trading-signals` 체크아웃
- 백엔드 venv 활성화, `pnpm install` 완료
- 022·023 기능(가치 분석 탭·네이버 보강·EmaOnlyChart) 정상 동작 확인

## 1. 백엔드 단위 테스트 (추세 분류 룰)

```bash
cd backend
.venv/bin/python -m pytest tests/unit/test_trend_analysis.py -v
```
기대: 인위적 시계열 fixture 4종(uptrend·downtrend·sideways·triangle) + 엣지 케이스(insufficient_data·unknown) 모두 PASS.

## 2. 백엔드 통합 테스트 (엔드포인트)

```bash
.venv/bin/python -m pytest tests/integration/test_trend_endpoint.py -v
```
기대:
- 응답 스키마(`TrendAnalysisResponse`) 일치
- 데이터 부족 시 200 + `type: insufficient_data` + 빈 signals
- 분류 불가 시 200 + `type: unknown` + 빈 signals
- 정상 분류 시 lines·signals 채워짐

## 3. 백엔드 재시작 (SR-02)

```bash
# uvicorn만 재시작 — cloudflared(PID 67781) 보존
for pid in $(lsof -ti:8000); do
  name=$(ps -p $pid -o comm=)
  [[ "$name" == *python* ]] && kill $pid
done
sleep 2
.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000
```

## 4. 라이브 엔드포인트 스모크

```bash
echo "=== 상승 추세 종목 ==="
curl -s "http://localhost:8000/api/trend-analysis/MU?market=US" | jq '{type: .classification.type, conf: .classification.confidence, lines_count: (.lines | length), buy: (.buy_signals | length), sell: (.sell_signals | length)}'

echo "=== 박스권/혼조 종목 ==="
curl -s "http://localhost:8000/api/trend-analysis/AAPL?market=US" | jq '{type: .classification.type}'

echo "=== KR 종목 (SK하이닉스) ==="
curl -s "http://localhost:8000/api/trend-analysis/000660?market=KR" | jq '{type: .classification.type}'

echo "=== 데이터 부족 (가상) ==="
curl -s "http://localhost:8000/api/trend-analysis/UNKNOWN_NEW?market=US" | jq '.classification.type'
```

## 5. 프론트 빌드 + 실행 (SR-03/04)

```bash
cd frontend
pnpm build
pnpm dev
```

## 6. 브라우저 수동 확인 시나리오

1. **MU 상세 진입** → 차트 분석 탭 → EmaOnlyChart 직하단에 **"추세 분석" 카드** 노출
   - 상단: 추세 라벨 (예: "📈 상승추세")
   - 중단: 매수 후보 구간 + 가격
   - 하단: 매도 후보 1·2단계 + 가격
   - 우상단: "추세선 표시" 토글 (기본 OFF)
   - 맨 아래: 면책 문구 1줄
2. **토글 ON** → 메인 캔들 차트에 **추세선 점선** 오버레이 (지지선·저항선·박스·삼각수렴)
3. **토글 OFF** → 차트 라인 즉시 사라짐
4. **AAPL** / **SK하이닉스** / **KODEX 200** / **신규 상장 종목** — 각각 추세 분류 결과 다양성 확인
5. **데이터 부족** 종목 → "분석을 위한 데이터가 부족합니다 (120봉 미만)" 안내
6. **분류 불가** 종목 → "명확한 추세 없음 — 매매 시점 미표시" 안내

## 7. 회귀 체크 (FR-013 — 완전 격리)

```bash
# 1) 스캔 결과 변경 0건 확인
curl -s "http://localhost:8000/api/scan/full/latest" > /tmp/before.json
# (잠시 대기 또는 새 스캔 트리거)
curl -s "http://localhost:8000/api/scan/full/latest" > /tmp/after.json
diff /tmp/before.json /tmp/after.json  # 차이 없어야 함 (스캔이 안 돌면 동일)

# 2) trend_analysis 모듈에 금지 import 0건 확인
rg "(full_market_scanner|chart_buy|ScanSnapshot|rules/chart-buy|rules/chart-sell|buy_signal_alert|telegram)" \
   backend/services/trend_analysis.py backend/routes/trend_analysis.py
# 결과: empty

# 3) 차트 BUY/SELL 마커 동작 — 이전과 동일 위치·동일 색상으로 표시되는지 시각 확인
```

## 8. SC-002 육안 검증 (KR·US 30종목 샘플)

```bash
# 백엔드 스크립트로 30종목 분류 결과 일괄 출력 (PowerShell/bash 한 줄로)
for sym in 005930 000660 035720 005380 051910 000270 207940 035420 068270 006400 \
            AAPL MSFT GOOGL AMZN META TSLA NVDA AMD INTC NFLX \
            JPM BAC WFC GS MS V MA JNJ PG KO; do
  market="US"; [[ "$sym" =~ ^[0-9]{6}$ ]] && market="KR"
  type=$(curl -s "http://localhost:8000/api/trend-analysis/${sym}?market=${market}" | jq -r '.classification.type')
  echo "${sym} ${market} → ${type}"
done
```
- 결과를 차트와 육안 비교, **80% 이상 일치**이면 SC-002 합격.

## 9. 최종 재시작 순서 (SR-01~05)

1. uvicorn 재시작 (cloudflared 보존)
2. `pnpm build`
3. `pnpm dev` 재기동
4. 브라우저 강제 리로드 (Cmd+Shift+R)
