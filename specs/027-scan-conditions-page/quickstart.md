# Quickstart — 조회조건 페이지 검증

**Branch**: `027-scan-conditions-page`  
**Date**: 2026-04-19

---

## 0. 사전 준비

```bash
# 백엔드 실행
cd /Users/woody/workflow/trading_view
.venv/bin/uvicorn app:app --reload --host 0.0.0.0 --port 8000

# 프론트 빌드 + 실행
cd frontend
pnpm install            # mermaid 의존성 추가됨
pnpm build              # dist/ 갱신
pnpm dev                # 개발 서버 (선택)
```

브라우저 DevTools → Toggle Device Toolbar로 PC(1280px) / 모바일(375px) 전환 테스트.

---

## 1. 페이지 접근 확인 (US4)

### 1.1 PC 헤더 탭

- [ ] 브라우저에서 `http://localhost:8000/` 접근
- [ ] PC 헤더에 '조회조건' 탭 표시
- [ ] 클릭 → URL `/conditions`로 변경, 탭 활성 스타일

### 1.2 모바일 BottomNav

- [ ] 브라우저 폭 375px
- [ ] BottomNav '조회조건' 아이콘(ListChecks) + 라벨 표시
- [ ] 클릭 시 페이지 이동, 활성 색상

### 1.3 직접 URL

- [ ] 새 탭 `http://localhost:8000/conditions` → 페이지 정상 렌더

---

## 2. PC 화면 — 매수 통합 파이프라인 플로우차트 (US1 PC)

브라우저 폭 ≥ 768px

### 2.1 도표 렌더링

- [ ] "매수 통합 파이프라인" 제목 + 설명
- [ ] Mermaid SVG 렌더 (10초 이내)
- [ ] 진입부에 BUY 분기와 SQZ BUY 분기 좌우 구분

### 2.2 BUY 분기 노드 (FR-005)

- [ ] BB 하단 터치/돌파 → RSI 필터 → 모멘텀 상승 → BUY 라벨
- [ ] BB 하단 복귀 경로 별도 분기
- [ ] RSI 프리셋 3종(strict 30 / normal 35 / sensitive 40) 표시

### 2.3 SQZ BUY 분기 (FR-006)

- [ ] 스퀴즈 해제 → 모멘텀 양수 → 모멘텀 상승 → SQZ BUY 라벨

### 2.4 후속 필터 (FR-007)

- [ ] 라벨 발생 → merge → 다음 순서:
  1. 데드크로스 판정 (통과/제외)
  2. 최근 20거래일 이내 신호 (유/무)
  3. 데이터 신선도 7일 이내 (통과/초과)
  4. 거래량 필터 미적용 표기
- [ ] "추천종목 확정" 노드 도달

### 2.5 눌림목 분기 (FR-008)

- [ ] "눌림목 필터 통과?" 분기 노드
- [ ] Yes → "눌림목 확정"
- [ ] No → "추천종목으로만 분류"
- [ ] 필터 조건(EMA20>60>120 + EMA5 하락) 명시

### 2.6 쿨다운 (FR-009)

- [ ] 라벨 발생 노드 근처 "5봉 쿨다운" 노트

---

## 3. PC 화면 — SELL 별도 플로우차트 (US2 PC)

- [ ] 하단 "SELL 라벨 (별도)" 섹션
- [ ] 안내 문구 "SELL 라벨은 차트 표시 전용이며 추천종목/눌림목 선정에 사용되지 않음" (FR-010a)
- [ ] Mermaid SVG: BB 상단 터치/돌파 → RSI > 60 → 모멘텀 하락 → SELL 라벨 + BB 상단 복귀 경로
- [ ] 쿨다운 5봉 표시

---

## 4. 모바일 화면 — 조건표 표시 (US1 모바일 + US2 모바일) 🌟 Q4 결정

브라우저 폭 < 768px (예: 375px)

### 4.1 매수 영역 — 조건표 (카드 리스트)

- [ ] "매수 통합 파이프라인" 제목 + 설명
- [ ] **Mermaid 도표가 표시되지 않음** (완전 미표시)
- [ ] 단계별 카드가 위→아래로 배치됨
- [ ] 각 카드 구성:
  - [ ] 단계 번호 배지 (1, 2, 3…) — 분기는 "1'" 같은 대안 번호 허용
  - [ ] kind 배지 (진입/필터/분기/결과/노트 등)
  - [ ] 단계 라벨
  - [ ] 상세 설명 (조건식)
  - [ ] branches 존재 시 "✅ 통과 → …", "❌ 제외" 목록
  - [ ] note 존재 시 📝 배지 + 텍스트
- [ ] 모든 카드 합쳐서 최소 8단계 이상 (SC-002a)
- [ ] **가로 스크롤 없음** — 세로 스크롤만으로 전체 확인

### 4.2 BUY 진입부 카드

- [ ] BUY 판정 카드: BB 하단 터치/돌파 + RSI 프리셋 + 모멘텀 상승 + BUY 라벨
- [ ] SQZ BUY 판정 카드: 스퀴즈 해제 + 모멘텀 양수/상승 + SQZ BUY 라벨

### 4.3 후속 필터 카드

- [ ] 데드크로스 제외
- [ ] 최근 20거래일 이내 신호
- [ ] 데이터 신선도 7일 이내
- [ ] 거래량 필터 미적용
- [ ] 추천종목 확정

### 4.4 눌림목 분기 카드

- [ ] 눌림목 필터 조건 명시
- [ ] 통과/미통과 분기 결과 표시

### 4.5 RSI 프리셋 표

- [ ] 카드 리스트 하단 또는 적절한 위치에 프리셋 3종 표 (strict/normal/sensitive)

### 4.6 SELL 영역 — 조건표

- [ ] 매수 영역 하단 "SELL 라벨 (별도)" 섹션 표시
- [ ] 안내 문구 표시
- [ ] 단계별 카드 최소 3개 이상 (SC-003a)
- [ ] **Mermaid 도표 미표시** (모바일이므로)

---

## 5. 번들 분리 검증 — 모바일 mermaid 미로드 🌟 Q4 핵심

### 5.1 빌드 산출물 확인

```bash
cd /Users/woody/workflow/trading_view/frontend
pnpm build
ls -la dist/assets/ | grep -i mermaid
```

- [ ] mermaid 관련 별도 chunk 파일 존재 (예: `mermaid-DXXXX.js`)
- [ ] 해당 chunk가 main bundle(예: `index-XXXX.js`)과 분리되어 있음

### 5.2 모바일 Network 탭 검증

브라우저 DevTools → Network → Preserve log + Cache 비활성 → 모바일 에뮬레이션(375px)

- [ ] `/conditions` 진입
- [ ] Network 탭에 **mermaid chunk가 로드되지 않음** 확인
- [ ] 페이지 로드 시간 1초 이내 (SC-001)

### 5.3 PC Network 탭 검증

브라우저 폭 ≥ 768px로 전환

- [ ] `/conditions` 진입 (또는 새로고침)
- [ ] Network 탭에 **mermaid chunk가 새로 로드됨**
- [ ] SVG 렌더 완료 후 ready 상태

---

## 6. 프론트엔드 모듈화 검증 (SC-006)

```bash
# conditions.ts의 Step 배열 임의 변경
# 예: BUY_PIPELINE_STEPS 중 한 Step의 label 수정
```

- [ ] `frontend/src/constants/conditions.ts`만 수정
- [ ] `pnpm build` 후 페이지 새로고침
- [ ] PC 도표의 해당 노드 라벨 변경 반영
- [ ] 모바일 카드의 해당 단계 라벨도 동일하게 변경 반영
- [ ] 변경 원복

---

## 7. 백엔드 모듈화 검증 (SC-007, US3)

### 7.1 회귀 테스트

```bash
# 리팩토링 전 main 브랜치
git checkout main
.venv/bin/python -c "
import asyncio
from backend.services.full_market_scanner import run_full_scan
result = asyncio.run(run_full_scan(markets=['KR']))
print('chart_buy:', sorted(r['symbol'] for r in result if 'chart_buy' in r.get('categories', [])))
print('pullback_buy:', sorted(r['symbol'] for r in result if 'pullback_buy' in r.get('categories', [])))
" > /tmp/before.txt

# 본 브랜치 복귀 후 동일 실행
git checkout 027-scan-conditions-page
# (동일 명령) > /tmp/after.txt

diff /tmp/before.txt /tmp/after.txt
```

- [ ] `diff` 빈 출력(완전 일치) 또는 시장 시세 변동에 따른 경미한 차이만 존재

### 7.2 단일 모듈 변경

- [ ] `backend/services/scan_conditions.py`의 `SIGNAL_LOOKBACK_DAYS`를 20 → 15로 변경
- [ ] `full_market_scanner.py`는 수정하지 않음
- [ ] 백엔드 재시작 + 새 스캔 실행 → 신호 탐색 범위가 15일로 동작
- [ ] 변경 원복

---

## 8. 활성 탭 시각 구분 (FR-013)

- [ ] `/conditions` 진입 시 PC nav + BottomNav 모두 '조회조건' 활성 스타일
- [ ] 다른 페이지 이동 시 비활성 복귀

---

## 9. 에러 폴백 (FE-05)

- [ ] (개발 모드, PC) conditions.ts의 `BUY_PIPELINE_MERMAID`에 의도적 오타 삽입
- [ ] PC 진입 시 에러 메시지 + 원본 DSL `<pre>` 표시
- [ ] 변경 원복

---

## 10. 반응형 전환 테스트

- [ ] 페이지 오픈 상태에서 브라우저 폭을 점진적으로 축소(1280 → 375)
- [ ] 768px 경계에서 PC 도표가 사라지고 모바일 조건표가 나타남
- [ ] 다시 확대하면 반대 방향 전환
- [ ] 전환 시 레이아웃 깨짐 없음, 콘솔 에러 없음

---

## 11. 성능 (SC-001)

- [ ] DevTools Network로 `/conditions` 진입 시 PC 1초 이내 로드
- [ ] 모바일은 mermaid chunk 미로드로 더 빠르게 로드

---

## 12. 최종 체크리스트

- [ ] 1.1 ~ 1.3 페이지 접근 통과
- [ ] 2.1 ~ 2.6 PC 매수 파이프라인 통과
- [ ] 3 PC SELL 플로우차트 통과
- [ ] 4.1 ~ 4.6 모바일 조건표 통과 🌟
- [ ] 5.1 ~ 5.3 번들 분리 검증 통과 🌟
- [ ] 6 프론트 모듈화 통과
- [ ] 7.1 ~ 7.2 백엔드 모듈화 + 회귀 통과
- [ ] 8 활성 탭 구분 통과
- [ ] 10 반응형 전환 통과
- [ ] 11 성능 통과
- [ ] 백엔드 재시작 + 프론트 재빌드 + 프론트 서버 재시작 완료 (SR-01~SR-06)
- [ ] 커밋 작성 (feat: 조회조건 페이지 — PC 도표 + 모바일 조건표)

---

## 트러블슈팅

| 증상 | 확인 |
|------|------|
| PC 도표 비어있음 | DevTools 콘솔에 mermaid 에러 확인, DSL 문법 점검 |
| 모바일에서 도표가 여전히 렌더됨 | `ConditionsSection`의 `hidden md:block` / `md:hidden` 클래스 확인 |
| 모바일에서 mermaid chunk가 로드됨 | Vite 코드 스플리팅 확인. `FlowchartView`에서 정적 import 대신 `await import('mermaid')` 사용 여부 점검 |
| 조건표 카드 순서가 Mermaid 도표와 다름 | `Step[]` 배열 순서가 단일 소스 — 양쪽 동일해야 함. `stepsToMermaidFlowchart` 변환 로직 점검 |
| 백엔드 회귀 테스트 불일치 | 옮긴 함수 본문 `git diff`로 100% 동일 검증 |
| 반응형 전환 시 빈 화면 | Tailwind breakpoint `md:` 설정 및 Tailwind 빌드 확인 |
| BottomNav 6개 탭 가로 공간 부족 | 아이콘 크기/간격 조정 필요 |
