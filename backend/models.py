from datetime import datetime

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
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Watchlist(Base):
    __tablename__ = "watchlist"
    __table_args__ = (UniqueConstraint("market", "symbol", name="uq_market_symbol"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
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


class DailyTopPick(Base):
    """일일 시장 스캔 Top 종목 — 하루 1번 기록."""
    __tablename__ = "daily_top_pick"
    __table_args__ = (
        Index("idx_daily_top_pick_date", "scan_date", "market_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    market_type: Mapped[str] = mapped_column(String(10), nullable=False)  # KOSPI / KOSDAQ
    rank: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=True)
    change_pct: Mapped[float] = mapped_column(Float, nullable=True)
    signal_state: Mapped[str] = mapped_column(String(10), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=True)
    grade: Mapped[str] = mapped_column(String(20), nullable=True)
    rsi: Mapped[float] = mapped_column(Float, nullable=True)
    bb_pct_b: Mapped[float] = mapped_column(Float, nullable=True)
    squeeze_level: Mapped[int] = mapped_column(Integer, nullable=True)
    macd_hist: Mapped[float] = mapped_column(Float, nullable=True)
    volume_ratio: Mapped[float] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ChartCache(Base):
    """차트 캔들 캐시 — 종목코드 기반 (워치리스트 무관)."""
    __tablename__ = "chart_cache"
    __table_args__ = (
        UniqueConstraint("symbol", "market", "timeframe", "timestamp", name="uq_chart_cache"),
        Index("idx_chart_cache_lookup", "symbol", "market", "timeframe"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    market: Mapped[str] = mapped_column(String(10), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(5), nullable=False)
    timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    open: Mapped[float] = mapped_column(Float, nullable=False)
    high: Mapped[float] = mapped_column(Float, nullable=False)
    low: Mapped[float] = mapped_column(Float, nullable=False)
    close: Mapped[float] = mapped_column(Float, nullable=False)
    volume: Mapped[float] = mapped_column(Float, nullable=False)


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


