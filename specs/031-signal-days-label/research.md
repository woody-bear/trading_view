# Research: BUY Signal Age Label

**Phase 0 output** | 2026-04-23

---

## Decision 1: 경과일 계산 방식 — 달력 일수 vs 거래일

- **Decision**: 달력 일수(calendar days) 사용
- **Rationale**: 거래일 환산은 공휴일 DB가 필요해 복잡도가 올라감. 사용자에게도 "오늘로부터 3일"이 더 직관적. 스캔 신호는 거래일 기준이지만 경과 표시에서는 달력 일수로도 충분.
- **Alternatives considered**: 거래일 기준 — 공휴일/주말 제외 계산. 복잡도 과도.

## Decision 2: P2 관심종목 `last_signal_date` 공급 방법 — JOIN vs 모델 필드 추가

- **Decision**: `signals.py`에서 `ScanSnapshotItem` LEFT JOIN (symbol 기준 최신 `last_signal_date`)
- **Rationale**: `CurrentSignal` 모델에 `last_signal_date` 컬럼을 추가하면 DB 마이그레이션 필요. JOIN 방식은 기존 테이블만 사용하고 마이그레이션 없이 구현 가능. 쿼리 부하도 기존 signals 호출이 페이지 로드 1회뿐이라 무시 가능.
- **Alternatives considered**: `CurrentSignal` 모델에 컬럼 추가 — DB 마이그레이션 필요, 불필요한 스키마 변경. 기각.

## Decision 3: 신선도 임계값 — 7일

- **Decision**: 7일 이하 = 신선(강조색), 8일 이상 = 오래됨(흐린색)
- **Rationale**: 10거래일(약 2주) 이내를 스캔 유효 기간으로 설정하는 관행. 1거래주(5거래일 ≈ 7일)를 신선 기준으로 설정.
- **Alternatives considered**: 5일(1거래주 엄밀), 14일(2거래주). 7일이 가장 직관적.

## Decision 4: 라벨 위치 — 기존 날짜 텍스트 교체

- **Decision**: BuyCard의 기존 `{item.last_signal_date}` 원본 문자열 표시를 `fmtSignalAge` 결과 chip으로 교체
- **Rationale**: 기존에 이미 날짜를 표시하는 자리가 있음. 동일 위치에 더 유용한 형식으로 교체하면 레이아웃 변경 최소화.
- **Alternatives considered**: 날짜 옆에 추가 표시 — 정보 중복, 공간 낭비.

## Decision 5: `fmtSignalAge` 위치 — `format.ts` 추가

- **Decision**: 기존 `frontend/src/utils/format.ts`에 함수 추가
- **Rationale**: R-06 규칙(기존 유틸 재사용). 날짜 포맷은 format.ts의 책임 범위.
- **Alternatives considered**: 별도 `dateUtils.ts` 파일 — 불필요한 파일 분산.
