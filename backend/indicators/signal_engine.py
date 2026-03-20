from dataclasses import dataclass, field
from typing import Optional

import pandas as pd
from loguru import logger

from indicators.bollinger import calculate_bb, detect_squeeze
from indicators.ema import calculate_ema
from indicators.macd import calculate_macd
from indicators.rsi import calculate_rsi
from indicators.volume import calculate_volume_ratio


@dataclass
class IndicatorValues:
    price: Optional[float] = None
    change_pct: Optional[float] = None
    rsi: Optional[float] = None
    bb_pct_b: Optional[float] = None
    bb_width: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_middle: Optional[float] = None
    bb_lower: Optional[float] = None
    squeeze_level: Optional[int] = None
    macd_line: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    macd_hist_prev: Optional[float] = None
    volume_ratio: Optional[float] = None
    ema_20: Optional[float] = None
    ema_50: Optional[float] = None
    ema_200: Optional[float] = None


@dataclass
class SignalResult:
    state: str = "NEUTRAL"  # BUY, SELL, NEUTRAL
    confidence: float = 0.0
    grade: str = ""  # STRONG, NORMAL, WEAK, ""
    indicators: IndicatorValues = field(default_factory=IndicatorValues)


SENSITIVITY_PRESETS = {
    "strict": {
        "label": "엄격",
        "required_conditions": 4,
        "rsi_buy": 30, "rsi_sell": 70,
        "bb_buy": 0.05, "bb_sell": 0.95,
        "volume_min": 1.2,
        "base_score": 80, "min_confidence": 60,
    },
    "normal": {
        "label": "보통",
        "required_conditions": 3,
        "rsi_buy": 35, "rsi_sell": 65,
        "bb_buy": 0.15, "bb_sell": 0.85,
        "volume_min": 1.1,
        "base_score": 70, "min_confidence": 55,
    },
    "sensitive": {
        "label": "민감",
        "required_conditions": 2,
        "rsi_buy": 40, "rsi_sell": 60,
        "bb_buy": 0.25, "bb_sell": 0.75,
        "volume_min": 1.0,
        "base_score": 60, "min_confidence": 50,
    },
}


def load_sensitivity() -> str:
    """설정 파일에서 민감도 읽기."""
    import json
    from pathlib import Path
    cfg_path = Path(__file__).parent.parent / "data" / "settings.json"
    try:
        data = json.loads(cfg_path.read_text())
        return data.get("sensitivity", "strict")
    except Exception:
        return "strict"


def save_sensitivity(level: str):
    """설정 파일에 민감도 저장."""
    import json
    from pathlib import Path
    cfg_path = Path(__file__).parent.parent / "data" / "settings.json"
    try:
        data = json.loads(cfg_path.read_text()) if cfg_path.exists() else {}
    except Exception:
        data = {}
    data["sensitivity"] = level
    cfg_path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


class SignalEngine:
    MIN_CANDLES = 200

    def __init__(self, sensitivity: str = ""):
        level = sensitivity or load_sensitivity()
        self.preset = SENSITIVITY_PRESETS.get(level, SENSITIVITY_PRESETS["strict"])
        self.sensitivity = level

    def calculate_indicators(self, df: pd.DataFrame) -> Optional[IndicatorValues]:
        """모든 지표를 일괄 계산하고 최신 값을 반환."""
        if len(df) < self.MIN_CANDLES:
            logger.warning(f"캔들 부족: {len(df)}/{self.MIN_CANDLES}")
            return None

        # 입력 데이터 NaN forward-fill
        df = df.ffill()

        iv = IndicatorValues()

        # 가격 — 등락률은 당일 시가 기준
        iv.price = float(df["close"].iloc[-1])
        today_open = float(df["open"].iloc[-1])
        if today_open != 0:
            iv.change_pct = ((iv.price - today_open) / today_open) * 100

        # BB
        bb = calculate_bb(df)
        if bb["pct_b"] is not None:
            iv.bb_pct_b = self._safe_last(bb["pct_b"])
            iv.bb_width = self._safe_last(bb["width"])
            iv.bb_upper = self._safe_last(bb["upper"])
            iv.bb_middle = self._safe_last(bb["middle"])
            iv.bb_lower = self._safe_last(bb["lower"])

        # RSI
        rsi = calculate_rsi(df)
        iv.rsi = self._safe_last(rsi)

        # MACD
        macd = calculate_macd(df)
        if macd["histogram"] is not None:
            iv.macd_line = self._safe_last(macd["macd_line"])
            iv.macd_signal = self._safe_last(macd["signal_line"])
            iv.macd_hist = self._safe_last(macd["histogram"])
            iv.macd_hist_prev = self._safe_last(macd["histogram"], offset=-2)

        # EMA
        ema = calculate_ema(df)
        iv.ema_20 = self._safe_last(ema["ema_20"])
        iv.ema_50 = self._safe_last(ema["ema_50"])
        iv.ema_200 = self._safe_last(ema["ema_200"])

        # Volume
        vol = calculate_volume_ratio(df)
        iv.volume_ratio = self._safe_last(vol)

        # Squeeze
        sqz = detect_squeeze(df)
        iv.squeeze_level = int(sqz.iloc[-1]) if not pd.isna(sqz.iloc[-1]) else 0

        return iv

    def judge_signal(self, iv: IndicatorValues, prev_state: str = "NEUTRAL") -> SignalResult:
        """지표 값으로 BUY/SELL/NEUTRAL 판정."""
        if iv is None:
            return SignalResult()

        # NaN 안전 체크
        if any(v is None for v in [iv.rsi, iv.bb_pct_b, iv.macd_hist, iv.volume_ratio]):
            return SignalResult(state="NEUTRAL", indicators=iv)

        p = self.preset
        buy_score = self._check_buy_conditions(iv)
        sell_score = self._check_sell_conditions(iv)

        buy_confidence = self._calculate_confidence(iv, "BUY") if buy_score >= p["required_conditions"] else 0
        sell_confidence = self._calculate_confidence(iv, "SELL") if sell_score >= p["required_conditions"] else 0

        # 신호 판정
        if buy_confidence >= p["min_confidence"]:
            state = "BUY"
            confidence = buy_confidence
        elif sell_confidence >= p["min_confidence"]:
            state = "SELL"
            confidence = sell_confidence
        else:
            # NEUTRAL 복귀 판정
            state = self._check_neutral_return(iv, prev_state)
            confidence = 0.0

        grade = self._grade(confidence) if state in ("BUY", "SELL") else ""

        return SignalResult(state=state, confidence=confidence, grade=grade, indicators=iv)

    def _check_buy_conditions(self, iv: IndicatorValues) -> int:
        """매수 필수 조건 4개 체크. 충족 개수 반환."""
        p = self.preset
        count = 0
        if iv.bb_pct_b is not None and iv.bb_pct_b <= p["bb_buy"]:
            count += 1
        if iv.rsi is not None and iv.rsi < p["rsi_buy"]:
            count += 1
        if iv.macd_hist is not None and iv.macd_hist_prev is not None and iv.macd_hist > iv.macd_hist_prev:
            count += 1
        if iv.volume_ratio is not None and iv.volume_ratio > p["volume_min"]:
            count += 1
        return count

    def _check_sell_conditions(self, iv: IndicatorValues) -> int:
        """매도 필수 조건 4개 체크. 충족 개수 반환."""
        p = self.preset
        count = 0
        if iv.bb_pct_b is not None and iv.bb_pct_b >= p["bb_sell"]:
            count += 1
        if iv.rsi is not None and iv.rsi > p["rsi_sell"]:
            count += 1
        if iv.macd_hist is not None and iv.macd_hist_prev is not None and iv.macd_hist < iv.macd_hist_prev:
            count += 1
        if iv.volume_ratio is not None and iv.volume_ratio > p["volume_min"]:
            count += 1
        return count

    def _calculate_confidence(self, iv: IndicatorValues, direction: str) -> float:
        """신호 강도 0~100 산정."""
        score = float(self.preset["base_score"])

        # 스퀴즈 해제 보너스
        if iv.squeeze_level == 0:
            if direction == "BUY" and iv.macd_hist is not None and iv.macd_hist > 0:
                score += 15
            elif direction == "SELL" and iv.macd_hist is not None and iv.macd_hist < 0:
                score += 15

        # EMA 정배열/역배열 보너스
        if all(v is not None for v in [iv.ema_20, iv.ema_50, iv.ema_200]):
            if direction == "BUY" and iv.ema_20 > iv.ema_50 > iv.ema_200:
                score += 5
            elif direction == "SELL" and iv.ema_20 < iv.ema_50 < iv.ema_200:
                score += 5

        # RSI 극단치 가산
        if iv.rsi is not None:
            if direction == "BUY":
                if iv.rsi < 20:
                    score += 10
                elif iv.rsi < 25:
                    score += 5
            elif direction == "SELL":
                if iv.rsi > 80:
                    score += 10
                elif iv.rsi > 75:
                    score += 5

        return min(100.0, score)

    def _check_neutral_return(self, iv: IndicatorValues, prev_state: str) -> str:
        """NEUTRAL 복귀 조건 판정."""
        if prev_state == "BUY":
            # RSI > 50 AND 가격 > BB 중간선
            if (iv.rsi is not None and iv.rsi > 50 and
                    iv.price is not None and iv.bb_middle is not None and iv.price > iv.bb_middle):
                return "NEUTRAL"
            # 또는 MACD 하락 전환
            if iv.macd_hist is not None and iv.macd_hist_prev is not None and iv.macd_hist < iv.macd_hist_prev:
                return "NEUTRAL"
            return "BUY"

        if prev_state == "SELL":
            # RSI < 50 AND 가격 < BB 중간선
            if (iv.rsi is not None and iv.rsi < 50 and
                    iv.price is not None and iv.bb_middle is not None and iv.price < iv.bb_middle):
                return "NEUTRAL"
            # 또는 MACD 상승 전환
            if iv.macd_hist is not None and iv.macd_hist_prev is not None and iv.macd_hist > iv.macd_hist_prev:
                return "NEUTRAL"
            return "SELL"

        return "NEUTRAL"

    @staticmethod
    def _grade(confidence: float) -> str:
        if confidence >= 90:
            return "STRONG"
        if confidence >= 70:
            return "NORMAL"
        if confidence >= 60:
            return "WEAK"
        return ""

    @staticmethod
    def _safe_last(series, offset: int = -1) -> Optional[float]:
        if series is None:
            return None
        try:
            val = series.iloc[offset]
            if pd.isna(val):
                return None
            return float(val)
        except (IndexError, TypeError):
            return None
