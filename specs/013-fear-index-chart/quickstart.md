# Quickstart: 공포지수 차트 개선 (013-fear-index-chart)

## 개발 환경 실행

```bash
# 백엔드
cd backend && source .venv/bin/activate
uvicorn app:app --reload --port 8000

# 프론트엔드 (새 터미널)
cd frontend && pnpm dev
```

## 기능 검증 시나리오

### Scenario 1: Fear & Greed 기간 탭 전환

1. `http://localhost:3000` 접속
2. 홈 화면 상단 시장 지표 패널에서 기간 탭 확인 (1개월 | 3개월 | 1년)
3. "3개월" 클릭 → 90일 차트 로드 확인 (1초 이내)
4. 차트 배경 색상 구간 확인: 하단 25% 빨강, 중간 50% 회색, 상단 25% 초록
5. 차트 위에 마우스 오버(PC) 또는 터치(모바일) → 날짜·수치 툴팁 확인

### Scenario 2: VIX 차트 확장

1. 시장 지표 패널의 VIX 미니카드 클릭
2. VIX 히스토리 차트가 패널 내부에 펼쳐짐 확인
3. VIX 20 (오렌지 점선), VIX 30 (빨강 점선) 수평 기준선 확인
4. VIX > 30 구간에 붉은 음영 확인
5. 다시 VIX 카드 클릭 → 차트 접힘 확인

### Scenario 3: 5분 갱신 시 상태 유지

1. "1년" 탭 선택 후 VIX 차트 확장
2. 5분 대기 (또는 React Query devtools로 강제 refetch)
3. 선택된 탭 "1년" 유지 확인, VIX 차트 확장 상태 유지 확인

### Scenario 4: 모바일 터치 동작

1. 크롬 DevTools 모바일 에뮬레이터 (iPhone 390px)
2. 페이지 스크롤 시 차트가 스크롤 방해 없음 확인
3. 차트 내부에서 좌우 드래그 → 차트 이동 확인
4. 차트 내부 터치 → 툴팁 표시 확인

## API 직접 확인

```bash
# Fear & Greed 90일
curl "http://localhost:8000/api/sentiment/history?days=90"

# Fear & Greed 365일
curl "http://localhost:8000/api/sentiment/history?days=365"

# VIX 히스토리 365일
curl "http://localhost:8000/api/sentiment/vix-history?days=365"
```

## 수용 기준 체크리스트

- [ ] 기간 탭 전환 시 1초 이내 차트 갱신
- [ ] 공포/중립/탐욕 구간 색상 배경 표시
- [ ] 차트 hover/touch 시 툴팁 표시
- [ ] VIX 카드 클릭 시 VIX 차트 확장/축소
- [ ] VIX 20·30 점선 기준선 표시
- [ ] VIX >30 구간 빨간 음영
- [ ] 5분 갱신 후 탭·VIX 확장 상태 유지
- [ ] 모바일 터치 차트 조작 가능, 페이지 스크롤 비방해
