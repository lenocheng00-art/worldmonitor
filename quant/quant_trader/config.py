from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class RiskConfig:
    risk_per_trade_pct: float
    max_position_pct: float
    max_gross_exposure_pct: float
    max_daily_loss_pct: float
    max_drawdown_pct: float
    max_open_positions: int
    allow_margin: bool
    allow_average_down: bool


@dataclass(frozen=True)
class StrategyConfig:
    name: str
    execution_symbol: str
    timeframe: str
    fast_ema: int
    slow_ema: int
    breakout_lookback: int
    atr_period: int
    stop_atr_multiple: float
    take_profit_atr_multiple: float
    flat_before_close: bool
    flat_hour: int
    flat_minute: int


@dataclass(frozen=True)
class ExecutionConfig:
    slippage_bps: float
    commission_hkd: float
    simulated_order_submission_enabled: bool
    live_trading_enabled: bool


@dataclass(frozen=True)
class FutuConfig:
    host: str
    port: int
    market: str
    history_bars: int


@dataclass(frozen=True)
class TradingConfig:
    name: str
    mode: str
    initial_capital_hkd: float
    base_currency: str
    usd_hkd: float
    universe: tuple[str, ...]
    risk: RiskConfig
    strategy: StrategyConfig
    execution: ExecutionConfig
    futu: FutuConfig

    def validate(self) -> None:
        if self.mode != "SIMULATE":
            raise ValueError("V1 is hard-locked to SIMULATE mode")
        if self.execution.live_trading_enabled:
            raise ValueError("live_trading_enabled must remain false in V1")
        if self.initial_capital_hkd <= 0:
            raise ValueError("initial_capital_hkd must be positive")
        if self.base_currency != "HKD":
            raise ValueError("V1 requires HKD as the base currency")
        if self.usd_hkd <= 0:
            raise ValueError("USDHKD must be positive")
        if not self.universe:
            raise ValueError("universe cannot be empty")
        if self.strategy.execution_symbol not in self.universe:
            raise ValueError("execution_symbol must be included in universe")
        if not 0 < self.risk.risk_per_trade_pct <= 0.02:
            raise ValueError("risk_per_trade_pct must be in (0, 0.02]")
        if not 0 < self.risk.max_position_pct <= 0.25:
            raise ValueError("max_position_pct must be in (0, 0.25]")
        if not self.risk.max_position_pct <= self.risk.max_gross_exposure_pct <= 1:
            raise ValueError("max_gross_exposure_pct must cover one position and be <= 1")
        if not 0 < self.risk.max_daily_loss_pct < self.risk.max_drawdown_pct < 1:
            raise ValueError("daily loss must be positive and lower than max drawdown")
        if self.risk.allow_margin:
            raise ValueError("margin is disabled in V1")
        if self.risk.allow_average_down:
            raise ValueError("averaging down is disabled in V1")
        if self.strategy.fast_ema >= self.strategy.slow_ema:
            raise ValueError("fast_ema must be lower than slow_ema")
        if self.strategy.breakout_lookback < 2 or self.strategy.atr_period < 2:
            raise ValueError("lookback periods must be at least 2")


def _section(data: dict[str, Any], key: str) -> dict[str, Any]:
    value = data.get(key)
    if not isinstance(value, dict):
        raise ValueError(f"missing configuration section: {key}")
    return value


def load_config(path: str | Path | None = None) -> TradingConfig:
    config_path = Path(path) if path else Path(__file__).resolve().parents[1] / "config.json"
    data = json.loads(config_path.read_text(encoding="utf-8"))
    risk = _section(data, "risk")
    strategy = _section(data, "strategy")
    execution = _section(data, "execution")
    futu = _section(data, "futu")
    fx_rates = _section(data, "fx_rates")

    config = TradingConfig(
        name=str(data["name"]),
        mode=str(data["mode"]),
        initial_capital_hkd=float(data["initial_capital_hkd"]),
        base_currency=str(data["base_currency"]),
        usd_hkd=float(fx_rates["USDHKD"]),
        universe=tuple(str(symbol) for symbol in data["universe"]),
        risk=RiskConfig(**risk),
        strategy=StrategyConfig(**strategy),
        execution=ExecutionConfig(**execution),
        futu=FutuConfig(**futu),
    )
    config.validate()
    return config
