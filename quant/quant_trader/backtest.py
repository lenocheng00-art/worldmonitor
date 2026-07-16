from __future__ import annotations

from dataclasses import asdict, dataclass
from math import floor, sqrt
from statistics import mean, pstdev
from typing import Any, Iterable

from .config import TradingConfig
from .models import Action, Bar, Fill, OrderIntent, Portfolio, Side
from .risk import RiskManager
from .strategy import TrendBreakoutStrategy


@dataclass(frozen=True)
class EquityPoint:
    timestamp: str
    equity_hkd: float
    drawdown_pct: float


@dataclass(frozen=True)
class BacktestResult:
    strategy_name: str
    symbol: str
    initial_capital_hkd: float
    final_equity_hkd: float
    total_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    completed_trades: int
    win_rate_pct: float
    fills: tuple[Fill, ...]
    equity_curve: tuple[EquityPoint, ...]
    risk_lock_reason: str | None

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["fills"] = [fill.to_dict() for fill in self.fills]
        payload["equity_curve"] = [asdict(point) for point in self.equity_curve]
        return payload


class BacktestEngine:
    def __init__(self, config: TradingConfig) -> None:
        self.config = config

    def run(self, bars: Iterable[Bar], periods_per_year: int = 252 * 78) -> BacktestResult:
        ordered_bars = sorted(bars, key=lambda item: item.timestamp)
        if len(ordered_bars) < self.config.strategy.slow_ema + 2:
            raise ValueError("not enough bars for the configured slow EMA")

        symbol = self.config.strategy.execution_symbol
        portfolio = Portfolio(self.config.initial_capital_hkd)
        risk = RiskManager(self.config.risk, self.config.initial_capital_hkd)
        strategy = TrendBreakoutStrategy(self.config.strategy)
        pending: OrderIntent | None = None
        pending_stop_distance_hkd = 0.0
        fills: list[Fill] = []
        closed_trade_returns: list[float] = []
        equity_curve: list[EquityPoint] = []
        period_returns: list[float] = []
        peak_equity = self.config.initial_capital_hkd
        previous_equity = self.config.initial_capital_hkd

        for bar in ordered_bars:
            open_hkd = bar.open * self.config.usd_hkd
            close_hkd = bar.close * self.config.usd_hkd
            position = portfolio.position(symbol)

            if pending:
                slippage = self.config.execution.slippage_bps / 10_000
                fill_price = open_hkd * (1 + slippage if pending.side == Side.BUY else 1 - slippage)
                quantity = pending.quantity
                if pending.side == Side.BUY:
                    affordable = floor(max(0.0, portfolio.cash_hkd - self.config.execution.commission_hkd) / fill_price)
                    quantity = min(quantity, affordable)
                else:
                    quantity = min(quantity, position.quantity)

                if quantity > 0:
                    fill = Fill(
                        timestamp=bar.timestamp,
                        symbol=symbol,
                        side=pending.side,
                        quantity=quantity,
                        price_hkd=fill_price,
                        commission_hkd=self.config.execution.commission_hkd,
                        reason=pending.reason,
                    )
                    entry_cost = position.average_price_hkd * quantity if pending.side == Side.SELL else 0.0
                    realized = portfolio.apply_fill(fill)
                    fills.append(fill)
                    if pending.side == Side.BUY:
                        strategy.on_entry_fill(fill_price / self.config.usd_hkd, pending_stop_distance_hkd / self.config.usd_hkd)
                    else:
                        strategy.on_exit_fill()
                        if entry_cost > 0:
                            closed_trade_returns.append(realized / entry_cost)
                pending = None
                pending_stop_distance_hkd = 0.0

            prices = {symbol: close_hkd}
            equity = portfolio.equity_hkd(prices)
            risk.update_equity(bar.timestamp.date(), equity)
            position = portfolio.position(symbol)
            signal = strategy.on_bar(bar, position.quantity)

            if signal.action == Action.ENTER_LONG:
                decision = risk.size_entry(
                    equity_hkd=equity,
                    cash_hkd=portfolio.cash_hkd,
                    price_hkd=close_hkd,
                    stop_distance_hkd=signal.stop_distance * self.config.usd_hkd,
                    current_gross_hkd=portfolio.market_value_hkd(prices),
                    existing_quantity=position.quantity,
                    open_positions=sum(1 for item in portfolio.positions.values() if item.is_open),
                )
                if decision.allowed:
                    pending = OrderIntent(symbol, Side.BUY, decision.quantity, signal.reason)
                    pending_stop_distance_hkd = signal.stop_distance * self.config.usd_hkd
            elif signal.action == Action.EXIT_LONG and position.quantity > 0:
                pending = OrderIntent(symbol, Side.SELL, position.quantity, signal.reason)

            peak_equity = max(peak_equity, equity)
            drawdown = (equity / peak_equity - 1) * 100
            equity_curve.append(EquityPoint(bar.timestamp.isoformat(), round(equity, 2), round(drawdown, 4)))
            if previous_equity > 0:
                period_returns.append(equity / previous_equity - 1)
            previous_equity = equity

        final_bar = ordered_bars[-1]
        final_position = portfolio.position(symbol)
        if final_position.quantity > 0:
            price_hkd = final_bar.close * self.config.usd_hkd * (1 - self.config.execution.slippage_bps / 10_000)
            quantity = final_position.quantity
            entry_cost = final_position.average_price_hkd * quantity
            fill = Fill(
                timestamp=final_bar.timestamp,
                symbol=symbol,
                side=Side.SELL,
                quantity=quantity,
                price_hkd=price_hkd,
                commission_hkd=self.config.execution.commission_hkd,
                reason="end-of-test liquidation",
            )
            realized = portfolio.apply_fill(fill)
            fills.append(fill)
            strategy.on_exit_fill()
            if entry_cost > 0:
                closed_trade_returns.append(realized / entry_cost)

        final_equity = portfolio.cash_hkd
        total_return = (final_equity / self.config.initial_capital_hkd - 1) * 100
        max_drawdown = abs(min((point.drawdown_pct for point in equity_curve), default=0.0))
        volatility = pstdev(period_returns) if len(period_returns) > 1 else 0.0
        sharpe = mean(period_returns) / volatility * sqrt(periods_per_year) if volatility > 0 else 0.0
        wins = sum(1 for item in closed_trade_returns if item > 0)
        win_rate = wins / len(closed_trade_returns) * 100 if closed_trade_returns else 0.0

        return BacktestResult(
            strategy_name=self.config.strategy.name,
            symbol=symbol,
            initial_capital_hkd=self.config.initial_capital_hkd,
            final_equity_hkd=round(final_equity, 2),
            total_return_pct=round(total_return, 4),
            max_drawdown_pct=round(max_drawdown, 4),
            sharpe_ratio=round(sharpe, 4),
            completed_trades=len(closed_trade_returns),
            win_rate_pct=round(win_rate, 2),
            fills=tuple(fills),
            equity_curve=tuple(equity_curve),
            risk_lock_reason=risk.locked_reason,
        )
