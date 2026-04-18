# Research: BUY 신호 이유 한줄 설명

## 1. 현재 네비게이션 데이터 전달 방식

**Decision**: React Router v6 `navigate(path, { state: { buySignal: item } })` 방식 사용

**Rationale**:
- SignalDetail은 현재 `useParams(symbol)` + `useSearchParams(market)`만 사용
- `useLocation().state`는 미사용 — 추가 없이 신호 데이터 수용 가능
- URL에 모든 지표 값을 쿼리 파라미터로 넣으면 URL이 지저분해지고 북마크/공유 시 오작동
- 페이지 새로고침 시 state는 유실되지만, 이 기능은 리스트 → 상세 진입 컨텍스트용이므로 허용 가능

**Alternatives considered**:
- URL query params: 데이터 구조가 복잡, URL 가독성 저하 → 기각
- Zustand/전역 상태: 오버엔지니어링, 단순 일회성 컨텍스트에 부적합 → 기각
- 상세 진입 시 scan API 재호출: 추가 네트워크, 응답 지연 → 기각

---

## 2. 현재 BUY 신호 item 필드 확인

**Decision**: 기존 scan item 데이터로 충분 — 추가 API 불필요

**Rationale**: 코드베이스 분석 결과 BuyCard item 및 Scan.tsx BUY item 모두 아래 필드 포함:
- `last_signal`: 'BUY' | 'SQZ BUY'
- `last_signal_date`: 'YYYY-MM-DD'
- `rsi`: number (< 40 조건 통과한 값)
- `volume_ratio`: number
- `macd_hist`: number
- `squeeze_level`: 0~3
- `trend`: 'BULL' | 'BEAR' | 'NEUTRAL'
- `bb_pct_b`: number (0~100 스케일)

Dashboard.tsx의 `full_market_scanner` 결과와 Scan.tsx의 `fetchFullScanLatest/fetchUnifiedCache` 결과 모두 동일 필드 구조.

**Alternatives considered**:
- 백엔드에서 이유 문장 생성 후 API로 내려주기: 오버엔지니어링, 유연성 저하 → 기각

---

## 3. 문장 생성 방식

**Decision**: 순수 클라이언트 사이드 템플릿 함수 (`buyReason.ts`)

**Rationale**:
- 네트워크 0ms, 즉시 표시
- LLM 호출 없이 결정론적 출력 → 테스트 용이
- 신호 조건이 2가지(BUY/SQZ BUY)로 단순 — 템플릿으로 충분한 다양성 확보 가능
- 수치 강조를 위해 문자열이 아닌 `ReasonPart[]` 구조 반환 → React에서 span 태그로 렌더링

**Alternatives considered**:
- 단순 string 반환 후 정규식 파싱으로 강조: 취약하고 복잡 → 기각
- dangerouslySetInnerHTML: XSS 위험 → 기각

---

## 4. 표시 조건 판별

**Decision**: `useLocation().state?.buySignal` null 체크로 판별

**Rationale**:
- 리스트 → 상세 진입: state에 buySignal 존재 → 배너 표시
- 검색/URL 직접/관심종목 진입: state 없음 → 배너 숨김
- 페이지 새로고침: state 유실 → 배너 숨김 (의도된 동작, 리스트 재진입 유도)

---

## 5. PositionGuide 이동 (기완료)

**Decision**: SignalDetail.tsx에서 PositionGuide를 가격 영역 아래로 이동 — 이미 적용됨

**Rationale**: BuySignalBanner → PositionGuide 순서로 배치하면 "왜 BUY?" → "어떻게 진입?" 논리 흐름이 자연스러움.
