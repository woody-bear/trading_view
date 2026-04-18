from pydantic import BaseModel


class EmaAlignmentStats(BaseModel):
    golden: int
    death: int
    other: int
    total: int
    golden_pct: float
    death_pct: float
    other_pct: float


class VolumeSpikePeriod(BaseModel):
    period_days: int
    spike_count: int
    total: int
    spike_pct: float
    top_sector: str


class VolumeSpikeStats(BaseModel):
    periods: list[VolumeSpikePeriod]


class MarketSentimentByMarket(BaseModel):
    ema_alignment: EmaAlignmentStats
    volume_spike: VolumeSpikeStats


class MarketSentimentResponse(BaseModel):
    KR: MarketSentimentByMarket
    US: MarketSentimentByMarket
    CRYPTO: MarketSentimentByMarket
    computed_at: str
