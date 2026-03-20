from fetchers.base import BaseFetcher
from fetchers.crypto_fetcher import CryptoFetcher
from fetchers.kr_fetcher import KRFetcher
from fetchers.us_fetcher import USFetcher


def get_fetcher(market: str) -> BaseFetcher:
    fetchers = {
        "KR": KRFetcher,
        "US": USFetcher,
        "CRYPTO": CryptoFetcher,
    }
    cls = fetchers.get(market)
    if cls is None:
        raise ValueError(f"지원하지 않는 시장: {market}")
    return cls()
