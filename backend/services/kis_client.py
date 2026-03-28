"""한국투자증권 Open API 클라이언트 — 인증 + REST 현재가 조회."""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING

from loguru import logger

from config import get_settings

if TYPE_CHECKING:
    from pykis import PyKis

_lock = threading.Lock()
_instance: KISService | None = None


class KISService:
    """한투 API 싱글턴 서비스."""

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.kis_configured:
            raise RuntimeError("KIS API 키가 설정되지 않았습니다")

        from pykis import KisAuth, PyKis

        account_no = settings.KIS_ACCOUNT_NO or "00000000-01"
        # 계좌번호 형식 검증: 8자리숫자-2자리숫자
        if not account_no[0].isdigit():
            account_no = "00000000-01"  # placeholder → 더미 계좌 (현재가 조회만 가능)
            logger.warning("계좌번호 미설정 — 더미 계좌로 초기화 (현재가 조회만 가능)")

        hts_id = account_no.replace("-", "")[:8]

        auth = KisAuth(
            id=hts_id,
            account=account_no,
            appkey=settings.KIS_APP_KEY,
            secretkey=settings.KIS_APP_SECRET,
            virtual=settings.KIS_PAPER_TRADING,
        )

        # virtual=True면 두 번째 인자(virtual_auth), False면 첫 번째(auth)
        if settings.KIS_PAPER_TRADING:
            self.kis: PyKis = PyKis(None, auth, keep_token=True)
        else:
            self.kis = PyKis(auth, keep_token=True)

        logger.info(
            f"한투 API 초기화 완료 (모의투자: {settings.KIS_PAPER_TRADING})"
        )

    def get_quote(self, symbol: str) -> dict | None:
        """REST API로 국내 주식 현재가 조회. 장전/장후에는 예상 체결가 반환."""
        try:
            stock = self.kis.stock(symbol)
            quote = stock.quote()
            prev = quote.prev_price or quote.price
            price = float(quote.price)

            # 가격이 0이면 개장 전/후 — 호가창 예상 체결가 조회
            if not price and prev:
                expected = self._get_expected_price(symbol)
                if expected:
                    return expected

            change_pct = ((quote.price - prev) / prev * 100) if prev else 0
            return {
                "price": price,
                "open": float(quote.open or quote.price),
                "high": float(quote.high or quote.price),
                "low": float(quote.low or quote.price),
                "volume": float(quote.volume or 0),
                "change_pct": round(float(change_pct), 2),
            }
        except Exception as e:
            logger.debug(f"한투 REST 현재가 조회 실패 [{symbol}]: {e}")
            return None

    def _get_expected_price(self, symbol: str) -> dict | None:
        """호가/예상체결 API에서 예상 체결가 조회 (장전/장후)."""
        try:
            ob = self.kis.stock(symbol).orderbook()
            raw = ob.raw
            output2 = raw.get("output2", {})
            antc_cnpr = float(output2.get("antc_cnpr", 0))  # 예상 체결가
            if not antc_cnpr:
                return None
            antc_vrss = float(output2.get("antc_cntg_vrss", 0))  # 예상 전일대비
            antc_rate = float(output2.get("antc_cntg_prdy_ctrt", 0))  # 예상 등락률
            antc_vol = float(output2.get("antc_vol", 0))  # 예상 거래량
            return {
                "price": antc_cnpr,
                "open": antc_cnpr,
                "high": antc_cnpr,
                "low": antc_cnpr,
                "volume": antc_vol,
                "change_pct": round(antc_rate, 2),
                "is_expected": True,  # 프론트에서 "예상" 표시용
            }
        except Exception as e:
            logger.debug(f"예상 체결가 조회 실패 [{symbol}]: {e}")
            return None


    def get_stock_detail(self, symbol: str) -> dict | None:
        """종목 투자지표 + 기업정보 + 위험상태 + 가격제한 통합 조회. 5분 캐시."""
        # 캐시 확인
        import time
        cache_key = f"detail:{symbol}"
        if cache_key in _detail_cache:
            data, ts = _detail_cache[cache_key]
            if time.time() - ts < 300:  # 5분 TTL
                return data

        try:
            stock = self.kis.stock(symbol)
            quote = stock.quote()
            ind = quote.indicator

            price = float(quote.price)
            w52h = float(ind.week52_high) if ind.week52_high else 0
            w52l = float(ind.week52_low) if ind.week52_low else 0
            w52_range = w52h - w52l
            w52_pos = ((price - w52l) / w52_range * 100) if w52_range > 0 else 50

            result = {
                "symbol": symbol,
                "name": str(quote.name) if hasattr(quote, 'name') else symbol,
                "market": "KR",
                "sector_name": str(quote.sector_name) if quote.sector_name else None,
                "market_cap": float(quote.market_cap) if quote.market_cap else 0,
                "eps": float(ind.eps) if ind.eps else 0,
                "bps": float(ind.bps) if ind.bps else 0,
                "per": float(ind.per) if ind.per else 0,
                "pbr": float(ind.pbr) if ind.pbr else 0,
                "week52_high": w52h,
                "week52_low": w52l,
                "week52_high_date": ind.week52_high_date.isoformat() if ind.week52_high_date else None,
                "week52_low_date": ind.week52_low_date.isoformat() if ind.week52_low_date else None,
                "week52_position": round(w52_pos, 1),
                "halt": bool(quote.halt) if hasattr(quote, 'halt') else False,
                "overbought": bool(quote.overbought) if hasattr(quote, 'overbought') else False,
                "risk": str(quote.risk) if hasattr(quote, 'risk') else "none",
                "base_price": float(quote.base_price) if hasattr(quote, 'base_price') and quote.base_price else 0,
                "high_limit": float(quote.high_limit) if hasattr(quote, 'high_limit') and quote.high_limit else 0,
                "low_limit": float(quote.low_limit) if hasattr(quote, 'low_limit') and quote.low_limit else 0,
                "price": price,
                "change_pct": round(float(quote.rate), 2) if hasattr(quote, 'rate') and quote.rate else 0,
            }

            _detail_cache[cache_key] = (result, time.time())
            return result
        except Exception as e:
            logger.debug(f"종목 상세 조회 실패 [{symbol}]: {e}")
            return None

    def get_orderbook(self, symbol: str) -> dict | None:
        """매도/매수 호가 조회."""
        try:
            stock = self.kis.stock(symbol)
            ob = stock.orderbook()

            asks = [{"price": float(item.price), "volume": int(item.volume)} for item in ob.asks[:5]]
            bids = [{"price": float(item.price), "volume": int(item.volume)} for item in ob.bids[:5]]

            total_ask = sum(a["volume"] for a in asks)
            total_bid = sum(b["volume"] for b in bids)
            total = total_ask + total_bid
            bid_ratio = round(total_bid / total * 100, 1) if total > 0 else 50

            return {
                "symbol": symbol,
                "asks": asks,
                "bids": bids,
                "total_ask_volume": total_ask,
                "total_bid_volume": total_bid,
                "bid_ratio": bid_ratio,
            }
        except Exception as e:
            logger.debug(f"호가 조회 실패 [{symbol}]: {e}")
            return None


# 투자지표 메모리 캐시 {key: (data, timestamp)}
_detail_cache: dict[str, tuple[dict, float]] = {}


def get_kis_service() -> KISService | None:
    """KIS 서비스 싱글턴 반환. 미설정 시 None."""
    global _instance
    if _instance is not None:
        return _instance
    settings = get_settings()
    if not settings.kis_configured:
        return None
    with _lock:
        if _instance is None:
            try:
                _instance = KISService()
            except Exception as e:
                logger.error(f"한투 API 초기화 실패: {e}")
                return None
    return _instance


def reset_kis_service() -> None:
    """설정 변경 시 인스턴스 재생성용."""
    global _instance
    _instance = None
