---
purpose: backend/utils/ 공통 유틸리티 모듈의 역할·주요 함수·재사용 규칙 설명.
reader: Claude가 백엔드 유틸리티 함수를 추가·수정하거나 기존 함수 재사용 위치를 찾을 때.
update-trigger: backend/utils/ 하위 새 모듈 추가·제거; 시장 시간/휴장일 판정 로직 변경; 공용 헬퍼 시그니처 변경.
last-audit: 2026-04-18
---

# Backend Utils

`backend/utils/` 는 특정 라우트·서비스에 속하지 않는 **공통 헬퍼**를 담는다. 도메인 서비스는 `services/`에, 외부 데이터 수신은 `fetchers/`에 두고 이 폴더는 **범용 시간·포맷·도메인 공통 계산**만 포함한다.

## 파일 인벤토리

| 모듈 | 용도 |
|------|------|
| `market_hours.py` | KR/US 시장 개장 상태, 장 구분(프리·정규·애프터), 휴장일 반영 판정 |
| `__init__.py` | 패키지 선언(export 없음) |

## `market_hours.py` 핵심 API

- 시장 상태 enum/문자열 반환 함수(정규장·프리마켓·애프터마켓·휴장).
- `context/db.md`의 `market_calendar` 캐시와 연계.
- 참고: `routes/market_scan.py`의 `/market/status` 엔드포인트, `services/price_feed.py`가 소비.

## 확장 규칙

- 특정 비즈니스 도메인(스캔·신호)에 종속된 계산은 여기가 아니라 `services/`에 둔다.
- 순수 함수만 허용(side effect 없음). DB·외부 API 호출은 금지.
- 새 모듈 추가 시 이 문서에 파일 행을 추가하고 `last-audit`을 갱신한다.
