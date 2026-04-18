---
purpose: backend/models.py 내 SQLAlchemy 모델의 컬럼·관계·인덱스 정의 개요.
reader: Claude가 DB 테이블을 추가·수정하거나 모델 간 관계를 이해할 때.
update-trigger: backend/models.py에 모델·컬럼 추가·제거; 관계 변경; 인덱스·제약조건 변경.
last-audit: 2026-04-18
---

# Backend — 모델 (models.py)

> 소스: `backend/models.py`  
> 상세 스키마는 `.claude/context/db.md` 참조

## ORM 패턴

```python
# SQLAlchemy 2.0 스타일
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class Watchlist(Base):
    __tablename__ = "watchlist"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    # ...
    current_signal: Mapped["CurrentSignal | None"] = relationship(...)
```

## 모델 목록

| 모델 클래스 | 테이블명 | 설명 |
|-------------|---------|------|
| `Watchlist` | `watchlist` | 관심종목 (핵심 엔티티) |
| `CurrentSignal` | `current_signal` | 최신 신호 캐시 (1:1) |
| `SignalHistory` | `signal_history` | 신호 전환 이력 |
| `AlertLog` | `alert_log` | 텔레그램 발송 이력 |
| `OHLCVCache` | `ohlcv_cache` | 차트 캔들 캐시 |
| `ScanSnapshot` | `scan_snapshot` | 전체 시장 스캔 실행 기록 |
| `ScanSnapshotItem` | `scan_snapshot_item` | 스캔 결과 종목별 데이터 |
| `StockMaster` | `stock_master` | 전종목 마스터 (검색용) |
| `UserProfile` | `user_profiles` | Supabase 사용자 정보 |
| `UserAlertConfig` | `user_alert_config` | 사용자별 텔레그램 설정 |
| `UserPositionState` | `user_position_state` | 포지션 분할매수 상태 |
| `PatternCase` | `pattern_case` | BUY 패턴 스크랩 |
| `SystemLog` | `system_log` | 시스템 이벤트 로그 |

## 관계 (relationship)

```
Watchlist
  ├── current_signal    → CurrentSignal (1:1, cascade delete)
  ├── signal_history    → List[SignalHistory] (1:N, cascade delete)
  └── ohlcv_cache       → List[OHLCVCache] (1:N, cascade delete)

SignalHistory
  └── alert_log         → AlertLog (1:0..1, cascade delete)

ScanSnapshot
  └── items             → List[ScanSnapshotItem] (1:N, cascade delete)
```

## 특수 타입

- `UUID`: `sqlalchemy.dialects.postgresql.UUID(as_uuid=True)` → SQLite에서도 동작
- `JSONB`: `sqlalchemy.dialects.postgresql.JSONB` → `user_position_state.completed_stages`
  - SQLite에서는 TEXT로 저장됨 (Alembic 마이그레이션에서 처리)

## 새 모델 추가 시 체크리스트

```
□ Base 상속 확인
□ __tablename__ 정의
□ 필요한 UniqueConstraint, Index 추가
□ relationship에 cascade="all, delete-orphan" 설정
□ alembic revision --autogenerate -m "add_xxx" 실행
□ NOT NULL 컬럼에 DEFAULT 값 지정
```
