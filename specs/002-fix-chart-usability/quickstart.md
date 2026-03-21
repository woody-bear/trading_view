# Quickstart: 차트 사용성 개선

**Branch**: `002-fix-chart-usability`

## 개발 환경

```bash
# Backend
cd backend && source .venv/bin/activate
uvicorn app:app --reload --port 8000

# Frontend (별도 터미널)
cd frontend && pnpm dev
```

## 변경 대상 파일

### 백엔드 신규
- `backend/utils/market_hours.py` — 시장별 장 마감 시간 / 영업일 판단

### 백엔드 수정
- `backend/services/chart_cache.py` — 미완성 캔들 제거 + 시간대 인식 freshness
- `backend/routes/quick_chart.py` — `market_open` 플래그 추가

### 프론트엔드 신규
- `frontend/src/stores/toastStore.ts` — 전역 토스트 상태 관리
- `frontend/src/components/ui/Toast.tsx` — 토스트 렌더링 컴포넌트
- `frontend/src/components/charts/ChartErrorBoundary.tsx` — 차트 에러 격리
- `frontend/src/components/charts/ChartSkeleton.tsx` — 차트 스켈레톤 UI
- `frontend/src/components/charts/ChartEmptyState.tsx` — 차트 데이터 없음 안내
- `frontend/src/components/ui/ConnectionIndicator.tsx` — 연결 상태 3단계 표시
- `frontend/src/hooks/useBuyPoint.ts` — 매수지점 localStorage CRUD 훅

### 프론트엔드 수정
- `frontend/src/hooks/useRealtimePrice.ts` — 연결 상태 3단계로 확장
- `frontend/src/pages/SignalDetail.tsx` — 스켈레톤 UI, 토스트, 에러 처리 통합
- `frontend/src/components/charts/IndicatorChart.tsx` — open 보존, 마커 방어/호버/클릭, throttle, 당일 캔들, 매수지점
- `frontend/src/App.tsx` — Toast 컨테이너 마운트

## 테스트 시나리오

### 핵심: 마지막 일봉 정확성
1. **장중 미완성 캔들 제거**: KR 종목(005930) 장중 조회 → 마지막 캔들이 전일 종가이고, 실시간 가격으로 당일 캔들이 별도 생성되는지 확인
2. **장 마감 후 정상 캔들**: 15:30 KST 이후 KR 종목 조회 → 당일 완성 캔들이 정상 표시되는지 확인
3. **실시간 open 보존**: 차트 로드 후 SSE 가격 수신 → 마지막 캔들의 open이 변하지 않는지 확인
4. **캐시 freshness**: 장 마감 후 조회 → 다음 영업일 장 시작 전까지 재다운로드 없이 캐시 유지

### UX 개선
5. **빈 차트 안내**: `http://localhost:3000/INVALID123` 접근 → 안내 메시지 확인
6. **스켈레톤 UI**: Chrome DevTools > Network > Slow 3G 설정 후 종목 상세 진입
7. **토스트**: 백엔드 중지 상태에서 민감도 변경 시도 → 에러 토스트 확인
8. **연결 상태**: 네트워크 차단 후 인디케이터 변화 관찰
9. **에러 격리**: IndicatorChart에 임의 throw 추가 → 차트만 에러, 나머지 정상
10. **마커 오류**: API 응답의 markers에 잘못된 time 값 주입 → 차트 정상, 경고 표시

### 마커 상호작용
11. **마커 호버**: BUY 마커 위치에 크로스헤어 이동 → 마커 색상이 밝은 녹색으로 변경, 벗어나면 복원
12. **매수지점 기록**: BUY 마커 클릭 → 차트에 가격 수평선 + "매수 ₩50,000" 라벨 표시
13. **매수지점 수익률**: 실시간 가격 변동 → 매수 라벨에 수익률(%) 업데이트
14. **매수지점 토글**: 같은 BUY 마커 재클릭 → 매수지점 삭제, 다른 BUY 마커 클릭 → 대체
15. **매수지점 영속성**: 페이지 새로고침 후 재방문 → localStorage에서 복원되어 수평선 유지
