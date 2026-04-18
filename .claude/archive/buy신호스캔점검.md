# 차트 BUY 신호 스캔 점검 보고서

작성일: 2026-04-09

---

## 1. 메인화면 BUY 신호 표시 조건

### 데이터 흐름

```
메인화면(Dashboard.tsx) 마운트
  → fetchFullScanLatest()  → GET /scan/full/latest  (full_market_scanner 스냅샷)
  → fetchUnifiedCache()    → GET /scan/unified       (unified_scanner 인메모리 캐시)
  → 둘 중 더 최신 타임스탬프 결과 선택 → setBuyItems(result.chart_buy.items)
```

`Dashboard.tsx:643–672` — 마운트 시 두 스캐너 결과를 동시에 로드하여 `completed_at` / `scan_time` 기준으로 더 최신 데이터를 화면에 표시.

### 표시 기준

| 조건 | 내용 |
|------|------|
| 신호 종류 | 마지막 차트 마커가 **BUY** 또는 **SQZ BUY** |
| 유효 기간 | **10거래일 이내** (주말·공휴일 제외, 실제 거래일 기준) |
| 거래량 필터 | 신호일 거래량 > **직전 5거래일 평균 × 1.5** (데이터 부족 시 건너뜀) |
| 데드크로스 제외 | EMA20 < EMA50 종목 자동 제외 (`_is_dead_cross`) |
| 반환 수량 | KR **2개** + US **2개** = 최대 4개 |
| 정렬 | BULL 추세 종목 우선 (`Dashboard.tsx:795`) |

> **주의**: UI 상 "3일 이내 BUY 신호 종목이 없습니다" 문구가 표시되지만, 실제 백엔드 필터 기준은 **10거래일**이다. 프론트엔드 빈 상태 텍스트만 "3일"을 언급하는 것이며 데이터 필터 기준이 아님.

---

## 2. 스캔 시간 — KR / US 분리 스케줄

스케줄러: `backend/scheduler.py`

### 관심종목 실시간 스캔 (signal_engine 기반)
| 스케줄 | 설명 |
|--------|------|
| **매 10분 interval** | `_scheduled_scan` → `run_scan()` + `scan_latest_buy("1d")` |
| 대상 | 관심종목 watchlist 전체 |

### 전체 시장 스캔 — KR (full_market_scanner)
| 시각 (KST) | 요일 | 대상 종목 |
|-----------|------|----------|
| **9:30, 10:30, 11:30, 12:30, 13:30, 14:30, 15:30** (매시 :30) | 평일 | 코스피200 + 코스닥150 + KRX섹터 (~351종목) |

### 전체 시장 스캔 — US+CRYPTO (full_market_scanner)
| 시각 (KST) | 요일 | 대상 종목 |
|-----------|------|----------|
| **19:50** | 평일 | S&P500 + 나스닥100 + 암호화폐 (~522종목) |
| **03:50** | 화~토 (월밤~금밤) | 동일 |

> KR과 US는 **별도 함수, 별도 스케줄**로 완전히 분리되어 있음.  
> `_scheduled_full_market_scan_kr()` → `run_full_scan(markets=["KR"])`  
> `_scheduled_full_market_scan_us()` → `run_full_scan(markets=["US", "CRYPTO"])`

---

## 3. 텔레그램 알림 vs 메인화면 표시 조건 비교

### 텔레그램 BUY 알림 스케줄
| 시각 (KST) | 요일 | 설명 |
|-----------|------|------|
| **10:30** | 평일 | 국내 BUY 알림 (9:30 KR 스캔 직후) |
| **15:00** | 평일 | 국내 BUY 알림 (14:30 KR 스캔 직후) |
| **20:00** | 평일 | 미국 BUY 알림 (19:50 US 스캔 직후) |
| **04:00** | 화~토 | 미국 BUY 알림 (03:50 US 스캔 직후) |

### 조건 비교

| 항목 | 텔레그램 알림 | 메인화면 표시 |
|------|------------|-------------|
| **데이터 원본** | `scan_snapshot_item` (DB, category='chart_buy') | `unified_scanner` 인메모리 캐시 또는 `scan_snapshot` (더 최신 선택) |
| **신호 판정 로직** | `_simulate_signals` (Pine Script BUY/SQZ BUY) | 동일 |
| **유효 기간** | 10거래일 이내 | 10거래일 이내 (동일) |
| **거래량 필터** | 신호일 > 직전 5거래일 평균 × 1.5 | 동일 |
| **데드크로스 제외** | O (`_is_dead_cross`) | O (동일) |
| **반환 수량** | 최대 20개 (신뢰도 내림차순) | KR 2개 + US 2개 |
| **신뢰도 등급** | STRONG(90+) / NORMAL(70+) / WEAK(60+) 표시 | 없음 |

**결론**: 신호 판정 로직과 거래량 필터는 동일. 다만 텔레그램은 DB의 full_market_scanner 스냅샷 기반이고, 메인화면은 unified_scanner 인메모리 캐시도 폴백으로 사용한다. **두 경로 모두 `_simulate_signals`를 호출하므로 BUY 판정 기준은 동일**하다.

---

## 4. BUY 신호 판정 핵심 로직 (공통)

`backend/routes/charts.py:_simulate_signals` (Pine Script 재현)

### BUY 신호 조건
```
buy_signal =
  (BB 하단 터치/돌파 AND RSI < 40 AND MACD 모멘텀 상승) OR
  (BB 하단 복귀     AND RSI < 40)

SQZ BUY =
  스퀴즈 해제(직전봉 SQ>0 → 현재봉 SQ=0) AND 모멘텀 양수 AND 상승 중
```

### 쿨다운
- 동일 방향 신호 **5봉** 이내 중복 방지

### 거래량 필터 (`_passes_volume_filter`, `full_market_scanner.py:191`)
```python
signal_vol > avg_vol * 1.5
# 직전 5거래일 중 거래량 0 제외한 평균
# 데이터 부족(신규상장, 거래정지 재개, 거래량 0) → True (필터 건너뜀)
```

---

## 5. 새로고침 버튼 동작

`Dashboard.tsx:770` — 오른쪽 상단 **새로고침** 버튼

### 호출 흐름
```
클릭 → runScan()
  → POST /scan/unified   (unified_scanner.scan_all 백그라운드 실행)
  → 5초 폴링 GET /scan/status 으로 완료 대기 (최대 10분, 120회)
  → 완료 후 GET /scan/unified 로 최신 캐시 로드
  → applyResult() → setBuyItems, setPicks, setOverheatItems 갱신
```

### unified_scanner.scan_all 처리 내용
`backend/services/unified_scanner.py:160–308`

- yfinance로 전체 종목(KR+US+CRYPTO) **일봉 2년치** 배치 다운로드
- 종목별: BB, RSI, MACD, 거래량, EMA, 스퀴즈 계산
- 데드크로스 제외 → `_simulate_signals` 호출 → BUY 마커 확인
- 10거래일 이내 + 거래량 필터 통과 → `buy_items`에 추가
- 결과: KR 2개 + US 2개 (`kr_buy[:2] + us_buy[:2]`)
- 인메모리 캐시(`_cache`)에 저장 — 서버 재시작 시 초기화됨

### 주의 사항
- 새로고침은 `unified_scanner`를 실행하며, `full_market_scanner`(DB 저장)와 **별도**임
- 새로고침으로 스캔한 결과는 DB에 저장되지 않음 (인메모리만)
- 텔레그램 알림은 `full_market_scanner` DB 스냅샷 기반이므로 새로고침과 무관

---

## 6. 거래량 필터 변경 제안 실증 분석

### 제안 내용
현재: `signal_vol > avg_5d × 1.5`  
제안: `(signal-1 + signal + signal+1) 3일 합 > avg_10d × 1.5 × 일수`

### 실증 분석 결과

**분석 범위**: KR 80종목 + US 40종목, 2년치 일봉, 총 870개 BUY 신호

| 항목 | 현재 필터 | 제안 필터 |
|------|---------|---------|
| **통과 (pass)** | 167개 (19.2%) | 195개 (22.4%) |
| **탈락 (fail)** | 703개 (80.8%) | 675개 (77.6%) |
| **데이터 부족 skip** | **0개 (0%)** | **0개 (0%)** |

### 핵심 결론: "데이터 부족 건너뜀"은 실제로 발생하지 않는다

870개 BUY 신호 전체에서 `skip_no_prior`, `skip_all_zero`, `skip_zero_vol` 중 **단 한 건도 발생하지 않았다.**

현재 코드에서 skip이 발생하는 조건:
- `signal_idx < 1` → 전체 2년치 데이터에서 첫 번째 봉에서 신호가 나오는 경우 없음
- 직전 5일 거래량이 모두 0 → 정상 거래 종목(KR/US 주요 종목)에서는 발생 안 함
- 신호일 거래량 = 0 → 거래정지 종목은 신호 자체가 발생하지 않음

**따라서 제안 필터로 변경해도 "skip 현상 해소" 효과는 없다.**

### 제안 필터의 실제 효과

| 변경 유형 | 건수 | 의미 |
|---------|------|------|
| fail → pass (더 느슨해짐) | **77개** | 신호일 거래량은 낮지만 ±1일에 거래량 급등 |
| pass → fail (더 엄격해짐) | **49개** | 신호일 거래량 급등이 ±1일로 희석 |
| 순 변화 | +28개 통과 증가 | 전반적으로 약간 더 느슨한 필터 |

### fail→pass 대표 사례 (현재 탈락 → 제안 통과)

```
000990.KS  2025-06-04  신호일 1.12x → ±1일 합 3.04x  (전일 거래량 급증)
007390.KQ  2025-03-24  신호일 0.34x → ±1일 합 5.08x  (다음날 거래량 폭발)
000670.KS  2025-03-07  신호일 0.68x → ±1일 합 5.28x  (전일 거래량 폭발)
```
→ 신호일 자체보다 전후 하루에 거래량이 집중된 패턴. 분할 매집/청산 징후일 수 있음.

### pass→fail 대표 사례 (현재 통과 → 제안 탈락)

```
삼성전자  2026-04-09  신호일 1.57x → ±1일 합 1.36x  (오늘 신호, 다음날 미포함)
003490.KS 2026-02-23  신호일 2.35x → ±1일 합 1.05x  (양 옆날이 조용함)
```
→ 신호일 거래량이 명확히 높아도 ±1일이 평범하면 희석되어 탈락.

### 권고

제안 필터 변경은 **효과가 없다** (skip 문제가 실제로 없음). 오히려:
- 신호일 당일의 명확한 거래량 급등 신호 49건이 탈락
- 전후일 거래량 패턴에 의존하는 77건이 통과 → 노이즈 증가 가능성

현재 필터(`signal_vol > avg_5d × 1.5`)가 더 직관적이고 신호일 집중력을 유지하는 데 유리하다.

---

## 7. 발견된 불일치 / 잠재적 문제

### ① 수량 제한 불일치
- `unified_scanner` 결과: `us_buy[:2]` (미국 2개)
- `chart_scanner` 결과: `us_items[:1]` (미국 1개)
- 두 스캐너가 서로 다른 US 상한을 적용함.
  - 관련 파일: `unified_scanner.py:281–282`, `chart_scanner.py:136–138`

### ② 새로고침 → full_market_scanner 미실행
- 새로고침 버튼은 `unified_scanner`만 실행하고 `full_market_scanner`(DB 저장)는 실행하지 않음
- 따라서 새로고침 후 텔레그램 알림이 발송되어도, 새로고침으로 발견된 종목이 포함되지 않을 수 있음

### ③ UI 텍스트 "3일 이내" vs 실제 기준 "10거래일"
- `Dashboard.tsx`의 빈 상태 메시지: "3일 이내 BUY 신호 종목이 없습니다"
- 실제 백엔드 필터: 10거래일 이내
- 사용자에게 혼동을 줄 수 있는 표현 불일치

### ④ 차트 BUY 마커 RSI 기준 고정값
- `_simulate_signals`에서 BUY 필터: `rsi_buy_filter = r < 40` (고정값)
- `signal_engine`은 민감도 프리셋(strict: 30, normal: 35, sensitive: 40)을 적용
- 차트 마커는 민감도 설정을 반영하지 않음 (항상 40 기준)

---

## 파일 참조

| 파일 | 역할 |
|------|------|
| `backend/scheduler.py` | KR/US 스캔 스케줄, 텔레그램 알림 스케줄 |
| `backend/services/unified_scanner.py` | 새로고침 버튼 스캔 (인메모리) |
| `backend/services/full_market_scanner.py` | 정기 스케줄 스캔 (DB 저장) |
| `backend/services/chart_scanner.py` | 10분 스캔 연동 차트 BUY 스캔 |
| `backend/services/buy_signal_alert.py` | 텔레그램 BUY 알림 발송 |
| `backend/routes/charts.py:_simulate_signals` | Pine Script BUY 판정 공통 로직 |
| `backend/routes/market_scan.py` | `/scan/unified`, `/scan/full/*` 엔드포인트 |
| `frontend/src/pages/Dashboard.tsx` | 메인화면, 새로고침 버튼 |
