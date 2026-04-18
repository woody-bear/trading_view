# Research — Phase 0

**Feature**: 023-kr-naver-fundamentals
**Date**: 2026-04-15

## R1. 외부 소스 선정

- **Decision**: 네이버 파이낸스 종목 메인 페이지
  `https://finance.naver.com/item/main.naver?code={6자리}` — 공개 페이지, 인증 불필요.
- **Rationale**: 토스·네이버 수준의 KR 펀더멘털을 가장 안정적으로 얻을 수 있으며, 공개 HTML이라 API 키·계약 불필요. 이미 `httpx`·`bs4`가 프로젝트에 설치되어 추가 의존성 없음.
- **Alternatives considered**:
  - `pykrx 1.0.51`: 내부 버그(get_market_fundamental에서 컬럼 매핑 실패) → 불안정.
  - `FinanceDataReader 0.9.110`: KRX 엔드포인트 접근 실패 기록.
  - DART OpenAPI: 분기 공시 기준이지만 PER/PBR/시총 등 시장 지표 미제공(계산 필요) → 본 스펙 범위 초과.
  - KIS API: KR 실시간 시세용, 펀더멘털 엔드포인트 부재.

## R2. 파싱 전략

- **Decision**: `BeautifulSoup` DOM 기반 탐색 — `div.aside_invest_info` 블록 내부의 `<th>PER</th><td>18.9</td>` 구조 등 라벨→값 매핑. 정규식은 인코딩 깨짐으로 취약.
- **Rationale**: HTML 구조 변경 영향을 최소화하기 위해 가장 안정적인 토큰(id/class 또는 header 라벨)에 의존. 텍스트 정규식은 EUC-KR 응답에서 한글 라벨이 깨지면 매칭 실패.
- **Alternatives considered**:
  - 정규식: 인코딩 이슈로 한글 라벨 매칭 불안정.
  - JSON 숨은 엔드포인트(`/item/coinfo.naver` 등): 비공식·변경 잦음.

## R3. 인코딩

- **Decision**: `response.content.decode('euc-kr', errors='ignore')` 명시 디코딩.
- **Rationale**: httpx 자동 인코딩 감지가 cp949/euc-kr에서 때때로 오탐 → 직접 지정해 안정화.

## R4. 캐시 전략

- **Decision**: 모듈 레벨 in-memory dict, **TTL 24시간** (Clarifications Q1 확정), symbol 단위 키.
- **Rationale**: 분기 단위 갱신 데이터이므로 일 단위 신선도로 충분. 네이버 호출 최소화로 rate limit·차단 위험 완화. 메모리 부담 미미(470 종목 × 수 KB 미만).
- **Alternatives considered**:
  - Redis/DB: 단일 프로세스 운영 환경에서는 과잉. 재시작 시 캐시 소실은 감수.

## R5. 동시 요청 중복 방지

- **Decision**: `dict[str, asyncio.Lock]` 맵으로 symbol별 Lock 보유. 같은 symbol에 다중 사용자 요청이 몰리면 첫 요청만 네트워크, 나머지는 대기 후 동일 캐시 공유.
- **Rationale**: 전체 스캔 경로는 차단(FR-005)하지만, 동일 종목 상세에 두 사용자가 동시 진입 시 중복 호출 방지 필요.

## R6. User-Agent

- **Decision**: 일반 데스크톱 브라우저 UA 헤더 고정.
- **Rationale**: 기본 httpx UA는 봇으로 인식될 여지 → 브라우저 UA로 안정성 확보.

## R7. 실패율 관측 (FR-008)

- **Decision**: 모듈 레벨 `_stats = {"ok": 0, "fail": 0, "recent_fails": deque(maxlen=10)}`. `/api/system/naver-stats`로 간이 노출.
- **Rationale**: HTML 구조 변경 시 조기 감지 필요. 전용 모니터링 인프라 없이 최소 관측성 확보.

## R8. 값 추출·정규화

- **Decision**:
  - PER/PBR: "18.9배" → `18.9` (float)
  - EPS/BPS: "58,954원" 또는 "174,538" → `58954` (int)
  - 음수/결측("-", "N/A"): `None`
- **Rationale**: 프론트 MetricCard가 이미 이 타입을 기대. 통화는 원/KRW 고정(KR 전용).

## R9. 기준일(reporting_period) 갱신

- **Decision**: 네이버 페이지의 "EPS (YYYY.MM)" 표기를 추출해 "YYYY-Q#" 포맷으로 변환, `reporting_period` 필드 덮어쓰기(네이버가 있을 때).
- **Rationale**: 022에서 yfinance `mostRecentQuarter`로 설정되는 값을 네이버 실제 공시 기준일로 대체하면 정확도 향상.

## R10. 스킵 대상 (FR-009)

- **Decision**: 다음 조건 중 하나라도 해당 시 네이버 호출 스킵:
  - `market == "CRYPTO"` 또는 ETF 리스트 포함 (KR_ETF_SYMBOLS)
  - symbol이 6자리 숫자가 아님 (US 티커 등)
  - `asset_class != STOCK_KR`
- **Rationale**: 대상 외 호출은 무의미 + 네이버 서버 리소스 절약.
