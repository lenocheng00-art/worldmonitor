from __future__ import annotations

from collections import deque

from .config import StrategyConfig
from .models import Action, Bar, Signal


def _ema(values: list[float], period: int) -> float:
    multiplier = 2 / (period + 1)
    result = values[0]
    for value in values[1:]:
        result = value * multiplier + result * (1 - multiplier)
    return result


class TrendBreakoutStrategy:
    def __init__(self, config: StrategyConfig) -> None:
        self.config = config
        self.bars: deque[Bar] = deque(maxlen=max(config.slow_ema * 3, config.breakout_lookback + 2))
        self.stop_price: float | None = None
        self.take_profit_price: float | None = None

    def on_entry_fill(self, price: float, stop_distance: float) -> None:
        self.stop_price = price - stop_distance
        self.take_profit_price = price + stop_distance * (
            self.config.take_profit_atr_multiple / self.config.stop_atr_multiple
        )

    def on_exit_fill(self) -> None:
        self.stop_price = None
        self.take_profit_price = None

    def on_bar(self, bar: Bar, position_quantity: int) -> Signal:
        prior_bars = list(self.bars)
        self.bars.append(bar)
        warmup = max(self.config.slow_ema, self.config.breakout_lookback + 1, self.config.atr_period + 1)
        if len(self.bars) < warmup:
            return Signal(Action.HOLD, "warming up indicators")

        bars = list(self.bars)
        closes = [item.close for item in bars]
        fast = _ema(closes[-self.config.fast_ema * 3 :], self.config.fast_ema)
        slow = _ema(closes[-self.config.slow_ema * 3 :], self.config.slow_ema)

        true_ranges: list[float] = []
        atr_bars = bars[-(self.config.atr_period + 1) :]
        for previous, current in zip(atr_bars, atr_bars[1:]):
            true_ranges.append(max(
                current.high - current.low,
                abs(current.high - previous.close),
                abs(current.low - previous.close),
            ))
        atr = sum(true_ranges) / len(true_ranges)
        stop_distance = atr * self.config.stop_atr_multiple

        if position_quantity > 0:
            if self.stop_price is not None and bar.close <= self.stop_price:
                return Signal(Action.EXIT_LONG, "ATR stop loss reached")
            if self.take_profit_price is not None and bar.close >= self.take_profit_price:
                return Signal(Action.EXIT_LONG, "ATR take profit reached")
            if bar.close < fast:
                return Signal(Action.EXIT_LONG, "close fell below fast EMA")
            if self.config.flat_before_close and (bar.timestamp.hour, bar.timestamp.minute) >= (
                self.config.flat_hour,
                self.config.flat_minute,
            ):
                return Signal(Action.EXIT_LONG, "flat-before-close rule")
            return Signal(Action.HOLD, "long position remains valid")

        prior_highs = [item.high for item in prior_bars[-self.config.breakout_lookback :]]
        breakout_level = max(prior_highs) if prior_highs else bar.high
        if fast > slow and bar.close > breakout_level:
            return Signal(Action.ENTER_LONG, "trend-aligned breakout", stop_distance)
        return Signal(Action.HOLD, "entry conditions not met", stop_distance)
