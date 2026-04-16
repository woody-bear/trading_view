"""추세 분류 알고리즘 단위 테스트 — 인위적 시계열 fixture 6종."""

import numpy as np
import pytest

from services.trend_analysis import _classify, _compute_buy_signals, _compute_sell_signals, WINDOW_SIZE


def _make_uptrend(n=WINDOW_SIZE):
    """우상향 + 사인파 진동 — 피크/트로프 검출 보장."""
    t = np.arange(n, dtype=float)
    base = 100 + t * 0.8  # 우상향 기울기
    wave = np.sin(t / 6 * np.pi) * 8  # 진폭 8, 주기 ~12봉
    c = base + wave
    return c, c + 3, c - 3


def _make_downtrend(n=WINDOW_SIZE):
    t = np.arange(n, dtype=float)
    base = 200 - t * 0.8
    wave = np.sin(t / 6 * np.pi) * 8
    c = base + wave
    return c, c + 3, c - 3


def _make_sideways(n=WINDOW_SIZE):
    t = np.arange(n, dtype=float)
    wave = np.sin(t / 8 * np.pi) * 4  # 좁은 변동
    c = 150 + wave
    return c, c + 2, c - 2


def _make_triangle(n=WINDOW_SIZE):
    """저점↑ 고점↓ — 삼각수렴."""
    t = np.arange(n, dtype=float)
    spread = np.linspace(20, 2, n)
    wave = np.sin(t / 6 * np.pi) * spread
    c = 150 + wave
    return c, c + 1, c - 1


def _make_short(n=50):
    t = np.arange(n, dtype=float)
    c = 100 + t * 0.3 + np.sin(t / 5 * np.pi) * 3
    return c, c + 1, c - 1


def _make_noisy(n=WINDOW_SIZE):
    np.random.seed(99)
    c = 100 + np.random.randn(n) * 15
    return c, c + 5, c - 5


class TestClassify:
    def test_uptrend(self):
        c, h, lo = _make_uptrend()
        result = _classify(c, h, lo)
        assert result["type"] == "uptrend"
        assert result["confidence"] > 0

    def test_downtrend(self):
        c, h, lo = _make_downtrend()
        result = _classify(c, h, lo)
        assert result["type"] == "downtrend"

    def test_sideways(self):
        c, h, lo = _make_sideways()
        result = _classify(c, h, lo)
        assert result["type"] == "sideways"

    def test_triangle(self):
        c, h, lo = _make_triangle()
        result = _classify(c, h, lo)
        assert result["type"] == "triangle"

    def test_insufficient_data(self):
        c, h, lo = _make_short()
        result = _classify(c, h, lo)
        assert result["type"] == "insufficient_data"

    def test_noisy_unknown(self):
        c, h, lo = _make_noisy()
        result = _classify(c, h, lo)
        assert result["type"] in ("unknown", "sideways")


class TestBuySignals:
    def test_uptrend_buy(self):
        c, h, lo = _make_uptrend()
        cls = _classify(c, h, lo)
        sigs = _compute_buy_signals(cls)
        assert len(sigs) >= 1
        assert any(s["kind"] == "buy_candidate" for s in sigs)

    def test_downtrend_strong_watch(self):
        c, h, lo = _make_downtrend()
        cls = _classify(c, h, lo)
        sigs = _compute_buy_signals(cls)
        kinds = [s["kind"] for s in sigs]
        assert "watch" in kinds or "buy_candidate" in kinds

    def test_sideways_buy(self):
        c, h, lo = _make_sideways()
        cls = _classify(c, h, lo)
        sigs = _compute_buy_signals(cls)
        assert len(sigs) >= 1

    def test_unknown_no_signals(self):
        result = _classify(np.array([100.0] * 50), np.array([101.0] * 50), np.array([99.0] * 50))
        sigs = _compute_buy_signals(result)
        assert len(sigs) == 0


class TestSellSignals:
    def test_uptrend_sell(self):
        c, h, lo = _make_uptrend()
        cls = _classify(c, h, lo)
        sigs = _compute_sell_signals(cls)
        assert len(sigs) >= 1
        kinds = [s["kind"] for s in sigs]
        assert "sell_candidate_1" in kinds or "sell_candidate_2" in kinds

    def test_triangle_sell_only_strong(self):
        c, h, lo = _make_triangle()
        cls = _classify(c, h, lo)
        sigs = _compute_sell_signals(cls)
        kinds = [s["kind"] for s in sigs]
        if sigs:
            assert "sell_candidate_2" in kinds


class TestIsNear:
    def test_is_near_flag(self):
        c, h, lo = _make_uptrend()
        cls = _classify(c, h, lo)
        sigs = _compute_buy_signals(cls) + _compute_sell_signals(cls)
        for s in sigs:
            if s["price"] is not None and s["distance_pct"] is not None:
                assert s["is_near"] == (abs(s["distance_pct"]) <= 2.0)
