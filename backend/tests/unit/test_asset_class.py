"""asset_class.classify 단위 테스트."""

import pytest

from services.asset_class import AssetClass, classify, supports_valuation


@pytest.mark.parametrize(
    "symbol,market,expected",
    [
        # KR 개별주
        ("005930", "KR", AssetClass.STOCK_KR),      # 삼성전자
        ("005930", "KOSPI", AssetClass.STOCK_KR),
        ("035720", "KOSDAQ", AssetClass.STOCK_KR),
        # US 개별주
        ("AAPL", "US", AssetClass.STOCK_US),
        ("MSFT", "US", AssetClass.STOCK_US),
        # KR ETF
        ("069500", "KR", AssetClass.ETF),            # KODEX 200
        # US ETF
        ("SPY", "US", AssetClass.ETF),
        ("QQQ", "US", AssetClass.ETF),
        # CRYPTO (symbol 무관하게 market 우선)
        ("BTC-USD", "CRYPTO", AssetClass.CRYPTO),
        ("ETH-USD", "CRYPTO", AssetClass.CRYPTO),
        # 알 수 없는 market → INDEX 폴백
        ("^KS11", "INDEX", AssetClass.INDEX),
        ("EURUSD=X", "FX", AssetClass.INDEX),
    ],
)
def test_classify(symbol: str, market: str, expected: AssetClass):
    assert classify(symbol, market) == expected


def test_supports_valuation():
    assert supports_valuation(AssetClass.STOCK_KR) is True
    assert supports_valuation(AssetClass.STOCK_US) is True
    assert supports_valuation(AssetClass.ETF) is False
    assert supports_valuation(AssetClass.CRYPTO) is False
    assert supports_valuation(AssetClass.INDEX) is False
    assert supports_valuation(AssetClass.FX) is False


def test_asset_class_is_str_enum():
    """Pydantic/JSON 직렬화에서 .value 없이 바로 문자열로 노출되도록 str enum 보장."""
    assert AssetClass.STOCK_KR == "STOCK_KR"
    assert AssetClass.CRYPTO.value == "CRYPTO"
