---
purpose: 작업 완료 후 검증 프로토콜(구문 검사·서버 기동·엔드포인트 테스트) 절차.
reader: Claude가 작업 완료 후 반드시 따라야 하는 검증 단계를 확인할 때.
update-trigger: 새 검증 도구 도입; 서버 재시작 절차 변경; 엔드포인트 테스트 명령 변경.
last-audit: 2026-04-18
---

# 검증 프로토콜

> 코드 변경 후 반드시 수행할 검증 단계.

---

## 백엔드 검증

### 1. 구문 검사

```bash
# 단일 파일
python -m py_compile backend/services/full_market_scanner.py

# 전체 backend
find backend -name "*.py" | xargs python -m py_compile
```

### 2. 서버 기동 테스트

```bash
cd backend
uvicorn app:app --reload --port 8000
```

- 서버가 에러 없이 시작되는지 확인
- `INFO: Application startup complete.` 메시지 확인

### 3. 핵심 엔드포인트 테스트

```bash
# 헬스체크
curl http://localhost:8000/api/health

# 스캔 결과 조회
curl http://localhost:8000/api/scan/full/latest

# 관심종목 신호 조회 (인증 필요)
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/signals
```

### 4. 테스트 실행 (tests/ 디렉토리 존재 시)

```bash
cd backend
pytest tests/ -v
```

---

## 프론트엔드 검증

### 1. TypeScript 타입 검사

```bash
cd frontend
npx tsc --noEmit
```

### 2. 빌드 테스트

```bash
cd frontend
npm run build
```

### 3. 개발 서버 기동

```bash
cd frontend
npm run dev
```

- 브라우저에서 http://localhost:5173 확인
- 콘솔 에러 없는지 확인
- 주요 기능 동작 확인

---

## 변경 규모별 검증 기준

| 등급 | 필수 검증 |
|------|----------|
| S (단일 파일, 10줄 이내) | 구문 검사 |
| M (2~5개 파일) | 구문 검사 + 서버 기동 + 핵심 엔드포인트 |
| L (새 기능) | 전체 검증 + 수동 테스트 + 검증 보고서 작성 |
| XL (스키마 변경) | 전체 검증 + 마이그레이션 롤백 확인 |

---

## 검증 보고서 양식 (M 이상)

```
✅ 검증 보고서
━━━━━━━━━━━━━
• 구문 검사: 통과 / 실패
• 테스트 실행: 통과 / 실패 / 해당없음
• 서버 기동: 통과 / 실패
• 수동 테스트: [수행한 테스트 설명]
• 잔여 이슈: [있으면 기술]
```

---

## 작업 완료 후 서버 재시작 (모든 등급 필수)

> 코드 변경이 있으면 작업 등급과 무관하게 아래 순서로 재시작한다.

### 1. 백엔드 재시작

```bash
cd backend
source .venv/bin/activate
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

- `INFO: Application startup complete.` 메시지 확인
- 에러 없이 기동되면 통과

### 2. 프론트엔드 재빌드 + 재시작

```bash
cd frontend
pnpm build   # dist/ 갱신 — 백엔드가 이 폴더를 SPA로 서빙
pnpm dev     # 개발 서버 재시작 (localhost:5173)
```

- 빌드 에러 없이 완료되면 통과
- 브라우저에서 http://localhost:5173 열어 콘솔 에러 없음 확인

> **왜 항상 재빌드하나?**  
> 백엔드가 `frontend/dist/`를 직접 서빙하는 구조이므로, 빌드 누락 시  
> 프론트엔드 변경이 실제 서비스에 반영되지 않는다.  
> 백엔드만 변경한 경우에도 재빌드로 연동 오류를 조기에 발견할 수 있다.

---

## 주의사항

- **stale 데이터 주의**: yfinance 데이터 캐시로 인해 거래량 필터 등이 오작동할 수 있음  
  → 확인 시 `backend/services/chart_cache/` 캐시 파일 삭제 후 재테스트
- **프론트엔드 재빌드**: 백엔드 API 변경 시 프론트엔드 React Query 캐시 무효화 필요  
  → 브라우저 개발자도구 > Application > Storage > Clear site data
