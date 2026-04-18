---
purpose: frontend/src/lib/ 외부 서비스 클라이언트 래퍼(Supabase 등) 설명.
reader: Claude가 Supabase 인증/DB 호출 관련 코드를 추가·수정할 때.
update-trigger: frontend/src/lib/ 하위 클라이언트 추가·교체; Supabase 환경 변수/프로젝트 변경; 인증 흐름 변경.
last-audit: 2026-04-18
---

# Frontend Library Clients

`frontend/src/lib/` 는 **외부 서비스 클라이언트 초기화** 전용이다. 유틸리티(`utils/`)와 달리 여기는 **상태를 가진 싱글톤** 클라이언트를 export 한다.

## 파일 인벤토리

| 모듈 | 용도 |
|------|------|
| `supabase.ts` | Supabase 클라이언트 싱글톤(auth·user profile 용도) |

## `supabase.ts`

- 환경 변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Vite는 `VITE_` prefix 필수).
- 싱글톤으로 export — `createClient`를 모듈 스코프에서 1회만 호출.
- 주요 소비처: `store/authStore.ts`, `pages/Login*.tsx`, 보호 라우트.

## 확장 규칙

- 새 외부 SDK(예: Sentry, Mixpanel)를 추가하면 각각 이 폴더에 래퍼를 둔다.
- 환경 변수가 없을 때 에러 대신 적절한 기본값/경고를 제공.
- 클라이언트 인스턴스는 **함수로 export 하지 말고 상수로 export**(앱 전체에서 동일 세션 공유).
- 테스트에서 mock이 필요하면 래퍼 함수 계층을 추가해 주입 가능성 확보.
