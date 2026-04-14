"""자산군(AssetClass) 판정 — 가치 분석 탭 활성화 여부 결정용.

규칙 (우선순위 순):
1. market == "CRYPTO"                         → CRYPTO
2. KR 시장 + symbol in KR_ETF_SYMBOLS         → ETF
3. US 시장 + symbol in US_ETF_TICKERS         → ETF
4. market in (KR/KOSPI/KOSDAQ)                → STOCK_KR
5. market == "US"                             → STOCK_US
6. 그 외                                       → INDEX (안전 폴백)

가치 분석 탭은 STOCK_KR·STOCK_US에서만 활성화된다.
"""

from enum import Enum

from services.scan_symbols_list import KR_ETF_SYMBOLS, US_ETF_TICKERS


class AssetClass(str, Enum):
    STOCK_KR = "STOCK_KR"
    STOCK_US = "STOCK_US"
    ETF = "ETF"
    CRYPTO = "CRYPTO"
    INDEX = "INDEX"
    FX = "FX"


_KR_MARKETS = {"KR", "KOSPI", "KOSDAQ"}


def classify(symbol: str, market: str) -> AssetClass:
    if market == "CRYPTO":
        return AssetClass.CRYPTO

    if market in _KR_MARKETS:
        if symbol in KR_ETF_SYMBOLS:
            return AssetClass.ETF
        return AssetClass.STOCK_KR

    if market == "US":
        if symbol in US_ETF_TICKERS:
            return AssetClass.ETF
        return AssetClass.STOCK_US

    return AssetClass.INDEX


def supports_valuation(asset_class: AssetClass) -> bool:
    return asset_class in (AssetClass.STOCK_KR, AssetClass.STOCK_US)
