# Research: 030 List Screens Realtime Price Flicker

**Phase 0 output** | 2026-04-23

---

## 1. 기존 가격 업데이트 인프라 현황

### Decision: 백엔드 신규 개발 불필요
- **What was chosen**: 기존 `POST /prices/batch` 엔드포인트 재사용
- **Rationale**: `backend/routes/prices.py`에 배치 가격 조회 엔드포인트가 이미 구현되어 있음. 심볼 배열을 받아 현재가·등락률을 한 번에 반환.
- **Alternatives considered**: SSE 스트림 엔드포인트(`GET /api/prices/stream/{symbol}`) — 종목별 1개 연결이 필요해 목록의 수십 종목에 적용 시 연결 과부하 우려. 배치 폴링이 훨씬 저렴.

### Decision: 프론트엔드 폴링 간격 5초
- **What was chosen**: 5,000ms 간격 `setInterval`
- **Rationale**: Dashboard.tsx의 기존 주석에 "5초는 CPU 부하 원인"이라는 메모가 있었으나, 그 당시 간격이 30초였던 이유는 과거 성능 우려였음. 현재 목록 화면은 CRYPTO를 제외하고 KR·US만 배치 요청하며 서버 응답이 가볍고 프론트 렌더도 `memo`로 보호되어 있으므로 5초는 허용 가능. 사용자 경험상 30초는 너무 길어 깜빡임 효과를 거의 볼 수 없음.
- **Alternatives considered**: 30초 유지 — 사용자 요청(3~5초)과 너무 큰 괴리. 3초 — 서버 부하 다소 우려, 5초보다 이점 미미.

---

## 2. 깜빡임(Flash) 구현 방식

### Decision: BuyCard·MiniWatchCard 내부 로컬 상태 방식 유지
- **What was chosen**: 각 카드 컴포넌트가 `useRef` + `useState`로 이전 가격을 추적하고 변동 시 flash 상태를 설정. `usePriceFlash` 훅을 참조 구현으로 사용하되, 실제 flash 색상은 inline style + CSS 변수로 적용.
- **Rationale**: 기존 `SignalCard`, `BuyCard` 모두 이 패턴을 이미 사용 중이므로 새 패턴 도입 없이 일관성 유지 (R-06: 기존 유틸리티 재사용).
- **Alternatives considered**: `usePriceFlash` 훅의 Tailwind class 그대로 사용 — 훅이 `text-red-400` 하드코딩이라 파란색 지원 불가. 훅 수정 시 SignalDetail에 영향 가능성.

---

## 3. 하락 색상: 파란색(Blue)

### Decision: 새 CSS 변수 `--blue` 추가 (`frontend/src/styles/tokens.css`)
- **What was chosen**: `--blue: oklch(0.60 0.18 240)` — 한국 증권 관례의 파란색 계열
- **Rationale**: 기존 `--down` 변수는 빨간색(oklch 25)으로 설정되어 있어 전역 변경 시 BUY/SELL 신호 색상 등 다른 컴포넌트에 의도치 않은 영향을 줌. 별도 변수를 사용해 목록 화면의 하락·음수 색상만 파란색으로 지정.
- **Alternatives considered**: `--down` 전역 변경 — 사이드 이펙트 범위가 너무 큼. `text-blue-400` Tailwind 클래스 — inline style 패턴과 혼용 불일치.

---

## 4. 영향 범위 파악

### Dashboard.tsx 현재 상태
| 항목 | 현재 | 변경 필요 |
|------|------|----------|
| livePrices 상태 | ✅ 존재 | 폴링 간격 30s → 5s |
| 추천/눌림목/대형주 live 연동 | ✅ BuyCard에 livePrice 전달 | BuyCard 플래시 색상 수정 |
| 관심종목 live 연동 | ❌ WatchlistPanel에 미전달 | livePrices 전달 + extractSymbols 확장 |
| 하락 색상 | 빨간색 (var(--down)) | 파란색 (var(--blue)) |

### Scan.tsx 현재 상태
| 항목 | 현재 | 변경 필요 |
|------|------|----------|
| livePrices 상태 | ✅ 존재 + 폴링 있음 | 있음 (기존 로직 확인 필요) |
| SectorGrouped에 전달 | ❌ `livePrices={{}}` 하드코딩 버그 | `livePrices={livePrices}` 로 수정 |

### WatchlistPanel.tsx 현재 상태
| 항목 | 현재 | 변경 필요 |
|------|------|----------|
| 라이브 가격 | ❌ 없음 | Dashboard에서 prop으로 전달 |
| Flash 애니메이션 | ❌ 없음 | MiniWatchCard에 추가 |
| 등락률 색상 | var(--down) 빨간색 | var(--blue) 파란색 |

---

## 5. CRYPTO 처리

- 기존 `refreshPrices()`가 CRYPTO를 `filtered = syms.filter(s => s.market !== 'CRYPTO')`로 이미 제외함.
- 이유: 한국투자증권(KIS) API가 CRYPTO를 지원하지 않음.
- 결론: CRYPTO 종목은 라이브 가격 업데이트 없이 스캔 시점 가격만 표시. 추가 처리 불필요.

---

## 6. 해결된 NEEDS CLARIFICATION 목록

없음 — 스펙 명확화 세션에서 모두 해결됨.
