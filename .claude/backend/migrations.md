---
purpose: backend/alembic/ 마이그레이션 생성·실행·롤백 절차와 현재까지의 마이그레이션 이력 개요.
reader: Claude가 DB 스키마를 변경하거나 새 테이블·컬럼을 추가·제거할 때.
update-trigger: 새 alembic 리비전 추가; 마이그레이션 명명 규칙 변경; env.py 설정 변경.
last-audit: 2026-04-18
---

# Alembic Migrations

`backend/alembic/`은 SQLAlchemy 모델(`backend/models.py`) 변경을 DB에 반영하는 **선언적 마이그레이션** 도구다.

## 구조

| 경로 | 역할 |
|------|------|
| `alembic.ini` | 설정(리비전 디렉터리, 로깅) |
| `alembic/env.py` | 런타임: SQLAlchemy `Base.metadata` 연결, 자동 생성 시 대상 |
| `alembic/versions/*.py` | 개별 리비전 — 각 파일은 `upgrade()` / `downgrade()` 보유 |

## 네이밍 규칙

- 신규 리비전 파일명: **3자리 순번 prefix + 설명** (예: `019_add_market_cap_to_stock_master.py`).
- 순번은 `ls alembic/versions/ | sort | tail -5` 로 마지막 번호 확인 후 +1.
- 초기 혼재 리비전(`1ac8ad4cd49b_add_scan_snapshot.py` 등 hash prefix)은 역사적. 신규는 반드시 숫자 순번 사용.

## 절차

### 새 마이그레이션 생성

1. `backend/models.py` 수정.
2. 터미널: `cd backend && alembic revision -m "add foo"` → `versions/` 밑에 빈 리비전 생성.
3. 생성된 파일에서 `upgrade()`·`downgrade()`를 수기로 채운다. `autogenerate`는 테이블명 diff에 오검출이 있어 **수기 권장**.
4. NOT NULL 컬럼 추가 시 반드시 DEFAULT 값 지정(헌장 DB-02).

### 실행

- 개발·운영 공통: `alembic upgrade head`.
- 롤백: `alembic downgrade -1` (마지막 리비전 1개 되돌림).

## 주의

- 마이그레이션은 되돌리기 어려운 작업. 프로덕션 적용 전 반드시 롤백 SQL도 함께 작성·검증(헌장 DB-01).
- `StockMaster`, `ScanSnapshot` 등 대용량 테이블 변경 시 배치 필요 여부 확인.
- 데이터 시드는 마이그레이션에서 하지 않는다(별도 스크립트 `backend/scripts/`).

## 최근 이력 (참고)

- `019_add_market_cap_to_stock_master.py` — StockMaster에 market_cap 컬럼 추가(2026-04).
- `018_add_volume_spike_count_to_scan_snapshot.py` — 스캔 스냅샷에 거래량 급등 카운트 추가.
- `017_pattern_case_exit_to_profit.py` — 패턴 케이스 수익 전환 컬럼.

전체 이력은 `alembic/versions/` 파일명 참조.
