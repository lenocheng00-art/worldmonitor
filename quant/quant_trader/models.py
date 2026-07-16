from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class Action(str, Enum):
    HOLD = "HOLD"
    ENTER_LONG = "ENTER_LONG"
    EXIT_LONG = "EXIT_LONG"


@dataclass(frozen=True)
class Bar:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0

    def __post_init__(self) -> None:
        if min(self.open, self.high, self.low, self.close) <= 0:
            raise ValueError("bar prices must be positive")
        if self.high < max(self.open, self.close) or self.low > min(self.open, self.close):
            raise ValueError("invalid OHLC bar")


@dataclass(frozen=True)
class Signal:
    action: Action
    reason: str
    stop_distance: float = 0.0


@dataclass(frozen=True)
class OrderIntent:
    symbol: str
    side: Side
    quantity: int
    reason: str


@dataclass(frozen=True)
class Fill:
    timestamp: datetime
    symbol: str
    side: Side
    quantity: int
    price_hkd: float
    commission_hkd: float
    reason: str

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["timestamp"] = self.timestamp.isoformat()
        payload["side"] = self.side.value
        return payload


@dataclass
class Position:
    quantity: int = 0
    average_price_hkd: float = 0.0

    @property
    def is_open(self) -> bool:
        return self.quantity > 0


@dataclass
class Portfolio:
    cash_hkd: float
    positions: dict[str, Position] = field(default_factory=dict)
    realized_pnl_hkd: float = 0.0

    def position(self, symbol: str) -> Position:
        return self.positions.setdefault(symbol, Position())

    def market_value_hkd(self, prices_hkd: dict[str, float]) -> float:
        return sum(position.quantity * prices_hkd.get(symbol, 0.0) for symbol, position in self.positions.items())

    def equity_hkd(self, prices_hkd: dict[str, float]) -> float:
        return self.cash_hkd + self.market_value_hkd(prices_hkd)

    def apply_fill(self, fill: Fill) -> float:
        if fill.quantity <= 0:
            raise ValueError("fill quantity must be positive")
        position = self.position(fill.symbol)
        notional = fill.quantity * fill.price_hkd

        if fill.side == Side.BUY:
            required_cash = notional + fill.commission_hkd
            if required_cash > self.cash_hkd + 1e-9:
                raise ValueError("insufficient cash; margin is not allowed")
            total_cost = position.quantity * position.average_price_hkd + notional
            position.quantity += fill.quantity
            position.average_price_hkd = total_cost / position.quantity
            self.cash_hkd -= required_cash
            return 0.0

        if fill.quantity > position.quantity:
            raise ValueError("cannot sell more than the current position")
        realized = fill.quantity * (fill.price_hkd - position.average_price_hkd) - fill.commission_hkd
        self.cash_hkd += notional - fill.commission_hkd
        position.quantity -= fill.quantity
        self.realized_pnl_hkd += realized
        if position.quantity == 0:
            position.average_price_hkd = 0.0
        return realized
