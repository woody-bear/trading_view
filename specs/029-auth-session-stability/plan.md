# Implementation Plan: Auth Session Stability & Centralized Management

**Branch**: `029-auth-session-stability` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)

## Summary

인증 이벤트(로그아웃·사일런트 실패·자동 복구)를 단일 서비스 계층으로 집중시켜 구조화된 `[AUTH]` 콘솔 로그를 남긴다. 동시에 페이지 새로고침 시 관심종목·스크랩 쿼리가 인증 초기화 완료 전에 발사되는 Race Condition을 제거하고, 백엔드 JWKS 캐시에 TTL을 적용한다.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5 / React 18 (frontend)  
**Primary Dependencies**: FastAPI, PyJWT (backend) · Supabase JS Client, Zustand, React Query, Axios (frontend)  
**Storage**: N/A — 신규 테이블 없음. ReturnUrl은 localStorage, JWKS는 메모리 캐시  
**Testing**: 수동 브라우저 검증 (DevTools 콘솔 확인), pytest (backend auth.py TTL 로직)  
**Target Platform**: Web (Chrome DevTools 기준 콘솔 로그)  
**Project Type**: Web application (fullstack feature)  
**Performance Goals**: 로그아웃 중복 방지 잠금 오버헤드 < 1ms  
**Constraints**: 자동 복구 재시도 최대 1회 제한, JWKS TTL 1시간  
**Scale/Scope**: 6개 파일 수정·1개 파일 신규 생성

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | Note |
|------|--------|------|
| R-01 (관심사 분리) | ✅ Pass | authService.ts 신규 파일로 side-effect 분리 |
| R-02 (네이밍 컨벤션) | ✅ Pass | `signOutWithReason`, `logAuthEvent` — camelCase 일관성 |
| R-03 (매직 넘버 금지) | ✅ Pass | TTL=3600, 잠금 플래그 모두 상수 또는 모듈 레벨 변수 |
| R-04 (주석 Why) | ✅ Pass | 잠금 메커니즘, JWKS TTL 이유만 주석 |
| R-06 (유틸리티 재사용) | ✅ Pass | 기존 스켈레톤 컴포넌트 재사용, 기존 authStore loading state 재사용 |
| R-08 (타입 힌트) | ✅ Pass | TypeScript 타입, Python 타입 힌트 모두 포함 |
| FE-01 (단일 책임) | ✅ Pass | authService.ts: 인증 로직만, 컴포넌트는 렌더링만 |
| FE-02 (상태 관리) | ✅ Pass | Zustand authStore 재사용, 신규 전역 상태 없음 |
| FE-03 (API 집중) | ✅ Pass | signOut 관련 API 호출은 authService.ts에서 처리 |
| PY-06 (loguru) | ⚠️ N/A | backend/auth.py는 로그 추가 없음 — TTL 로직만 추가 |
| rules/ 편집 없음 | ✅ Pass | scan-symbols, chart-buy/sell-label 미접촉 |

**결론**: 모든 게이트 통과. 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/029-auth-session-stability/
├── plan.md              ← 이 파일
├── research.md          ← Phase 0 완료
├── spec.md              ← 요구사항 완료
├── data-model.md        ← Phase 1 출력
├── contracts/
│   └── auth-service.md  ← Phase 1 출력
└── checklists/
    └── requirements.md  ← 완료
```

### Source Code (repository root)

```text
backend/
└── auth.py                         # JWKS TTL 캐시 추가

frontend/src/
├── lib/
│   └── authService.ts              # 신규 — 중앙 인증 서비스
├── api/
│   └── client.ts                   # signOut 호출 2곳 → signOutWithReason
├── components/
│   └── UserMenu.tsx                # signOut → signOutWithReason
├── pages/
│   ├── AuthCallback.tsx            # ReturnUrl 복귀 처리
│   └── Scrap.tsx                   # authLoading 게이팅 추가
└── (수정 불필요)
    ├── store/authStore.ts          # loading state 이미 정확
    ├── components/AuthProvider.tsx # 이미 올바름
    └── pages/Dashboard.tsx        # enabled: !authLoading && !!user 이미 적용
```

**Structure Decision**: Option 2 (Web application). 프론트엔드 lib/ 계층에 authService.ts 신규 추가, 백엔드 auth.py에 TTL 로직 추가. 신규 디렉토리 없음.

---

## Phase 0: Research — Completed

**Output**: [research.md](./research.md)

**핵심 결정 요약**:

| 항목 | 결정 |
|------|------|
| 중앙 서비스 위치 | `frontend/src/lib/authService.ts` |
| 로그아웃 잠금 | 모듈 레벨 `let _signingOut = false` |
| ReturnUrl 저장 | `localStorage['auth_return_url']` |
| 로그 형식 | `[AUTH] {TYPE} \| reason={} \| source={} \| url={} \| ts={}` |
| Scrap 수정 방법 | useEffect 조건에 `authLoading` 추가 |
| JWKS TTL | `_jwks_cache_time: float = 0.0` + 3600초 |

---

## Phase 1: Design & Contracts — Completed

**Outputs**: [data-model.md](./data-model.md), [contracts/auth-service.md](./contracts/auth-service.md)

---

## Implementation Checklist (Phase 2 입력)

아래 항목은 `/speckit.tasks`로 태스크 분해 후 구현:

1. `backend/auth.py` — JWKS TTL 캐시 (`_jwks_cache_time`, TTL=3600)
2. `frontend/src/lib/authService.ts` — 신규: `signOutWithReason`, `logAuthEvent`, `_signingOut` 잠금
3. `frontend/src/api/client.ts` — lines 266, 275의 `signOut()` → `signOutWithReason` + SILENT_FAILURE 로그
4. `frontend/src/components/UserMenu.tsx` — `signOut()` → `signOutWithReason('user_requested', 'UserMenu')`
5. `frontend/src/pages/AuthCallback.tsx` — `localStorage['auth_return_url']` 복귀 처리
6. `frontend/src/pages/Scrap.tsx` — `if (user && !authLoading)` + `authLoading` 의존성 추가
