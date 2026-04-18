# Research: BUY 차트 라벨 클릭 — 사례 스크랩 추가

**Branch**: `010-chart-buy-scrap` | **Phase**: 0 | **Date**: 2026-04-01

---

## 1. lightweight-charts v5 BUY 마커 호버 오버레이

**Decision**: `subscribeCrosshairMove` + `timeToCoordinate` + `priceToCoordinate`로 BUY 마커 위 DOM 오버레이 배치

**Rationale**:
- lightweight-charts v5는 차트 내 커스텀 DOM 요소를 직접 렌더링하지 않으므로 외부 div를 절대 위치로 오버레이
- `subscribeCrosshairMove(param)` → `param.time`이 BUY 마커 시간과 일치 → 버튼 표시
- `timeScale().timeToCoordinate(markerTime)` → x 픽셀, `series.priceToCoordinate(markerPrice)` → y 픽셀
- 차트 컨테이너 div에 `position: relative`, 오버레이 div에 `position: absolute`

**기존 코드 활용**: IndicatorChart.tsx에 이미 `subscribeCrosshairMove`가 구현되어 있음 (마커 색 강조용). 이 핸들러를 확장하여 오버레이 위치·표시 여부도 함께 제어.

**가장자리 처리**: 오버레이 div 기본 위치 = 마커 상단 중앙. x < 80px이면 오른쪽으로 이동, x > width-80px이면 왼쪽으로 이동.

**모바일**: `window.matchMedia('(hover: hover)').matches`가 false이면 hover 오버레이 대신 `subscribeClick`으로 동일 버튼 표시 (탭 후 사라지는 토스트 유사 방식).

**Alternatives considered**:
- lightweight-charts Custom Plugins (ISeriesPrimitive): v5에서 지원하나 복잡도 높고 문서 부족. DOM 오버레이가 더 단순.
- Tooltip 내장: v5 Tooltip plugin은 커서 기반이라 버튼 인터랙션 불가.

---

## 2. 특정 날짜 지표값 조회

**Decision**: 신규 엔드포인트 `GET /api/chart/indicators-at?symbol=&market=&date=`

**Rationale**:
- 저장 버튼 클릭 시 `signal_date`의 RSI·BB·MACD·스퀴즈레벨 등을 정확하게 수집해야 함
- `/api/chart/quick`은 전체 캔들 배열 반환 → 프론트에서 날짜 필터링 가능하나 오버킬
- 전용 엔드포인트가 더 가볍고 명확함 (지표만 반환, 캔들 제외)
- 구현: `get_chart_data()` 호출 → DataFrame에서 `date` 행 찾기 → `_calc(df, timestamps)`에서 해당 인덱스 값 추출

**Alternatives considered**:
- 프론트에서 `/api/chart/quick` 결과 캐시 후 date 필터링: 지표값이 캐시에 있을 보장 없음, 복잡도 증가

---

## 3. user_id 스코핑 (로그인 사용자 전용)

**Decision**: PatternCase에 `user_id UUID nullable` 추가, 기존 Supabase JWT 인증 패턴 그대로 사용

**Rationale**:
- 기존 Watchlist 테이블과 동일한 패턴: `user_id UUID NOT NULL` + RLS
- 백엔드는 Authorization Bearer 토큰 검증 → `user_id` 추출 → DB 쿼리에 WHERE 절 추가
- 기존 사례는 user_id=NULL → 마이그레이션 시 호환성 유지

**구현**: 기존 `require_user()` 의존성 함수가 있는지 확인 필요. 없으면 JWT decode 헬퍼 추가.

**Alternatives considered**:
- 미로그인 허용: 스펙에서 명시적으로 미로그인 비활성화 요구

---

## 4. source 필드 (차트 자동 vs 수동)

**Decision**: PatternCase에 `source VARCHAR(20)` 추가 (`'chart'` | `'manual'`)

**Rationale**:
- 기존 `pattern_type` 필드는 squeeze_breakout/oversold_bounce/custom — 신호 유형 구분용
- `source`는 입력 경로(차트 자동/수동)를 구분하는 별도 개념 → 독립 필드가 명확
- 기존 데이터는 `source = 'manual'` (기본값)

**마이그레이션**: `016_add_source_user_id_pattern_case.py` — source + user_id 컬럼 추가

---

## 5. 메모 디바운스 자동저장

**Decision**: React `useRef<ReturnType<typeof setTimeout>>` + 1500ms debounce → `PATCH /api/pattern-cases/{id}` (notes 필드만)

**Rationale**:
- 별도 저장 버튼 없음 (spec FR-007)
- `useEffect` + 의존성 `[notes]`로 debounce 구현 — 간단하고 예측 가능
- 저장 상태 표시: `saving` boolean으로 "저장 중..." / "저장됨" 토글

---

## 6. 중복 저장 방지

**Decision**: `GET /api/pattern-cases/check?symbol=&signal_date=&user_id=` 엔드포인트 추가

**Rationale**:
- 저장 버튼 클릭 시 중복 체크 먼저 수행 → 이미 있으면 경고 표시 후 저장 안 함
- DB 단에서도 unique constraint 추가 (user_id + symbol + signal_date)

**스크랩됨 표시**: 차트 마커 렌더링 시 `scrapedDates: Set<string>`(ISO date 문자열) prop 전달 → BUY 마커 중 scrapedDates에 있는 것은 색상 변경(골드) + "저장됨" 오버레이 텍스트
