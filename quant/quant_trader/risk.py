from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from math import floor

from .config import RiskConfig


@dataclass(frozen=True)
class RiskDecision:
    allowed: bool
    quantity: int
    reason: str


class RiskManager:
    def __init__(self, config: RiskConfig, initial_equity_hkd: float) -> None:
        self.config = config
        self.peak_equity_hkd = initial_equity_hkd
        self.day_start_equity_hkd = initial_equity_hkd
        self.current_day: date | None = None
        self.locked_reason: str | None = None

    def update_equity(self, trading_day: date, equity_hkd: float) -> None:
        if self.current_day != trading_day:
            self.current_day = trading_day
            self.day_start_equity_hkd = equity_hkd
        self.peak_equity_hkd = max(self.peak_equity_hkd, equity_hkd)

        daily_loss = 1 - equity_hkd / self.day_start_equity_hkd if self.day_start_equity_hkd else 0.0
        drawdown = 1 - equity_hkd / self.peak_equity_hkd if self.peak_equity_hkd else 0.0
        if daily_loss >= self.config.max_daily_loss_pct:
            self.locked_reason = f"daily loss limit reached ({daily_loss:.2%})"
        if drawdown >= self.config.max_drawdown_pct:
            self.locked_reason = f"maximum drawdown reached ({drawdown:.2%})"

    def size_entry(
        self,
        *,
        equity_hkd: float,
        cash_hkd: float,
        price_hkd: float,
        stop_distance_hkd: float,
        current_gross_hkd: float,
        existing_quantity: int,
        open_positions: int,
    ) -> RiskDecision:
        if self.locked_reason:
            return RiskDecision(False, 0, self.locked_reason)
        if existing_quantity > 0 and not self.config.allow_average_down:
            return RiskDecision(False, 0, "averaging down is disabled")
        if open_positions >= self.config.max_open_positions:
            return RiskDecision(False, 0, "maximum open positions reached")
        if price_hkd <= 0 or stop_distance_hkd <= 0:
            return RiskDecision(False, 0, "invalid price or stop distance")

        risk_budget = equity_hkd * self.config.risk_per_trade_pct
        position_budget = equity_hkd * self.config.max_position_pct
        gross_budget = max(0.0, equity_hkd * self.config.max_gross_exposure_pct - current_gross_hkd)
        cash_budget = cash_hkd if not self.config.allow_margin else float("inf")
        quantity = floor(min(
            risk_budget / stop_distance_hkd,
            position_budget / price_hkd,
            gross_budget / price_hkd,
            cash_budget / price_hkd,
        ))
        if quantity < 1:
            return RiskDecision(False, 0, "risk budget is too small for one share")
        return RiskDecision(True, quantity, "entry is within all risk limits")
