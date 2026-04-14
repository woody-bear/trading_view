import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class Watchlist(Base):
    __tablename__ = "watchlist"
    __table_args__ = (UniqueConstraint("market", "symbol", name="uq_market_symbol"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    market: Mapped[str] = mapped_column(String(10), nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    timeframe: Mapped[str] = mapped_column(String(5), default="1h")
    data_source: Mapped[str] = mapped_column(String(20), default="auto")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    current_signal: Mapped["CurrentSignal | None"] = relationship(
        back_populates="watchlist", cascade="all, delete-orphan", uselist=False
    )
    signal_history: Mapped[list["SignalHistory"]] = relationship(
        back_populates="watchlist", cascade="all, delete-orphan"
    )
    ohlcv_cache: Mapped[list["OHLCVCache"]] = relationship(
        back_populates="watchlist", cascade="all, delete-orphan"
    )


class CurrentSignal(Base):
    __tablename__ = "current_signal"

    watchlist_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("watchlist.id", ondelete="CASCADE"), primary_key=True
    )
    signal_state: Mapped[str] = mapped_column(String(10), nullable=False, default="NEUTRAL")
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    change_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    rsi: Mapped[float | None] = mapped_column(Float, nullable=True)
    bb_pct_b: Mapped[float | None] = mapped_column(Float, nullable=True)
    bb_width: Mapped[float | None] = mapped_column(Float, nullable=True)
    squeeze_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    macd_hist: Mapped[float | None] = mapped_column(Float, nullable=True)
    volume_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    ema_20: Mapped[float | None] = mapped_column(Float, nullable=True)
    ema_50: Mapped[float | None] = mapped_column(Float, nullable=True)
    ema_200: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    watchlist: Mapped["Watchlist"] = relationship(back_populates="current_signal")


class SignalHistory(Base):
    __tablename__ = "signal_history"
    __table_args__ = (Index("idx_signal_history_watchlist", "watchlist_id", "detected_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    watchlist_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("watchlist.id", ondelete="CASCADE"), nullable=False
    )
    signal_state: Mapped[str] = mapped_column(String(10), nullable=False)
    prev_state: Mapped[str | None] = mapped_column(String(10), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    timeframe: Mapped[str | None] = mapped_column(String(5), nullable=True)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    rsi: Mapped[float | None] = mapped_column(Float, nullable=True)
    bb_pct_b: Mapped[float | None] = mapped_column(Float, nullable=True)
    bb_width: Mapped[float | None] = mapped_column(Float, nullable=True)
    squeeze_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    macd_hist: Mapped[float | None] = mapped_column(Float, nullable=True)
    volume_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    ema_20: Mapped[float | None] = mapped_column(Float, nullable=True)
    ema_50: Mapped[float | None] = mapped_column(Float, nullable=True)
    ema_200: Mapped[float | None] = mapped_column(Float, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    watchlist: Mapped["Watchlist"] = relationship(back_populates="signal_history")
    alert_log: Mapped["AlertLog | None"] = relationship(
        back_populates="signal_history", cascade="all, delete-orphan", uselist=False
    )


class AlertLog(Base):
    __tablename__ = "alert_log"
    __table_args__ = (Index("idx_alert_log_sent", "sent_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    signal_history_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("signal_history.id", ondelete="CASCADE"), nullable=True
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="telegram")
    alert_type: Mapped[str] = mapped_column(String(20), nullable=False, default="realtime")
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    symbol_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    signal_history: Mapped["SignalHistory | None"] = relationship(back_populates="alert_log")


class SystemLog(Base):
    __tablename__ = "system_log"
    __table_args__ = (Index("idx_system_log_level", "level", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    level: Mapped[str] = mapped_column(String(10), nullable=False)
    source: Mapped[str | None] = mapped_column(String(30), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class OHLCVCache(Base):
    __tablename__ = "ohlcv_cache"
    __table_args__ = (
        UniqueConstraint("watchlist_id", "timeframe", "timestamp", name="uq_ohlcv"),
        Index("idx_ohlcv_cache", "watchlist_id", "timeframe", "timestamp"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    watchlist_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("watchlist.id", ondelete="CASCADE"), nullable=False
    )
    timeframe: Mapped[str] = mapped_column(String(5), nullable=False)
    timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    open: Mapped[float] = mapped_column(Float, nullable=False)
    high: Mapped[float] = mapped_column(Float, nullable=False)
    low: Mapped[float] = mapped_column(Float, nullable=False)
    close: Mapped[float] = mapped_column(Float, nullable=False)
    volume: Mapped[float] = mapped_column(Float, nullable=False)

    watchlist: Mapped["Watchlist"] = relationship(back_populates="ohlcv_cache")



class ScanSnapshot(Base):
    """전체 시장 스캔 스냅샷 — 1회 스캔 실행 기록."""
    __tablename__ = "scan_snapshot"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="running")  # running/completed/failed
    total_symbols: Mapped[int] = mapped_column(Integer, default=0)
    scanned_count: Mapped[int] = mapped_column(Integer, default=0)
    picks_count: Mapped[int] = mapped_column(Integer, default=0)
    max_sq_count: Mapped[int] = mapped_column(Integer, default=0)
    buy_count: Mapped[int] = mapped_column(Integer, default=0)
    dead_cross_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    alive_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    # 10거래일 이내 1봉이라도 '당일 거래량 > 직전 5거래일 평균 × 1.5'를 만족한 종목 수 (CRYPTO 제외)
    volume_spike_count: Mapped[int | None] = mapped_column(Integer, nullable=True, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    items: Mapped[list["ScanSnapshotItem"]] = relationship(
        back_populates="snapshot", cascade="all, delete-orphan"
    )


class ScanSnapshotItem(Base):
    """전체 시장 스캔 종목별 결과."""
    __tablename__ = "scan_snapshot_item"
    __table_args__ = (
        Index("idx_snapshot_item_filter", "snapshot_id", "market_type", "category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    snapshot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("scan_snapshot.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(20), nullable=False)  # picks/max_sq/chart_buy
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    market: Mapped[str] = mapped_column(String(10), nullable=False)  # KR/US/CRYPTO
    market_type: Mapped[str] = mapped_column(String(10), nullable=False)  # KOSPI/KOSDAQ/US/CRYPTO
    price: Mapped[float | None] = mapped_column(Float, nullable=True)
    change_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    rsi: Mapped[float | None] = mapped_column(Float, nullable=True)
    bb_pct_b: Mapped[float | None] = mapped_column(Float, nullable=True)
    bb_width: Mapped[float | None] = mapped_column(Float, nullable=True)
    squeeze_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    macd_hist: Mapped[float | None] = mapped_column(Float, nullable=True)
    volume_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    trend: Mapped[str | None] = mapped_column(String(10), nullable=True)
    last_signal: Mapped[str | None] = mapped_column(String(20), nullable=True)
    last_signal_date: Mapped[str | None] = mapped_column(String(10), nullable=True)

    snapshot: Mapped["ScanSnapshot"] = relationship(back_populates="items")


class StockMaster(Base):
    """종목 마스터 — 한투 API 전종목 검색용."""
    __tablename__ = "stock_master"
    __table_args__ = (
        Index("idx_stock_master_search", "market", "name"),
        UniqueConstraint("market", "symbol", name="uq_stock_master"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    market: Mapped[str] = mapped_column(String(10), nullable=False)  # KR / US
    market_type: Mapped[str] = mapped_column(String(10), nullable=False)  # KOSPI/KOSDAQ/NASDAQ/NYSE/AMEX
    is_etf: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserProfile(Base):
    """Supabase auth.users 공개 정보 미러."""
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserAlertConfig(Base):
    """사용자별 텔레그램 알림 설정."""
    __tablename__ = "user_alert_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False)
    telegram_bot_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    telegram_chat_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserPositionState(Base):
    """포지션 가이드 매수 완료 체크 상태 (기기 간 동기화)."""
    __tablename__ = "user_position_state"
    __table_args__ = (UniqueConstraint("user_id", "symbol", "market", name="uq_user_position"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    market: Mapped[str] = mapped_column(String(10), nullable=False)
    completed_stages: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PatternCase(Base):
    """BUY 신호 우수 사례 스크랩 — 승률 좋은 조건 기록."""
    __tablename__ = "pattern_case"
    __table_args__ = (
        Index("idx_pattern_case_date", "signal_date"),
        Index("idx_pattern_case_type", "pattern_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    stock_name: Mapped[str] = mapped_column(String(100), nullable=False)
    market: Mapped[str] = mapped_column(String(10), nullable=False)
    market_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    pattern_type: Mapped[str] = mapped_column(String(30), nullable=False, default="custom")
    signal_date: Mapped[str] = mapped_column(String(10), nullable=False)
    entry_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    profit_krw: Mapped[float | None] = mapped_column(Float, nullable=True)
    result_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    hold_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rsi: Mapped[float | None] = mapped_column(Float, nullable=True)
    bb_pct_b: Mapped[float | None] = mapped_column(Float, nullable=True)
    bb_width: Mapped[float | None] = mapped_column(Float, nullable=True)
    macd_hist: Mapped[float | None] = mapped_column(Float, nullable=True)
    volume_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    ema_alignment: Mapped[str | None] = mapped_column(String(10), nullable=True)
    squeeze_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    conditions_met: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


