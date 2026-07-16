from __future__ import annotations

import os
from datetime import datetime
from typing import Any

from .config import TradingConfig
from .models import Bar, Side


class FutuDependencyError(RuntimeError):
    pass


class FutuPaperAdapter:
    """A simulation-only adapter. This class contains no path to TrdEnv.REAL."""

    def __init__(self, config: TradingConfig) -> None:
        if config.mode != "SIMULATE" or config.execution.live_trading_enabled:
            raise ValueError("FutuPaperAdapter only supports simulation")
        self.config = config

    @staticmethod
    def _sdk() -> dict[str, Any]:
        try:
            from futu import (  # type: ignore[import-not-found]
                KLType,
                OpenQuoteContext,
                OpenSecTradeContext,
                OrderType,
                RET_OK,
                TrdEnv,
                TrdMarket,
                TrdSide,
            )
        except ImportError as error:
            raise FutuDependencyError(
                "futu-api is not installed; install quant/requirements-futu.txt after OpenD is ready"
            ) from error
        return locals()

    def fetch_recent_bars(self, symbol: str) -> list[Bar]:
        sdk = self._sdk()
        quote_context = sdk["OpenQuoteContext"](host=self.config.futu.host, port=self.config.futu.port)
        try:
            ktype = getattr(sdk["KLType"], self.config.strategy.timeframe)
            ret, data, _ = quote_context.request_history_kline(
                symbol,
                ktype=ktype,
                max_count=self.config.futu.history_bars,
            )
            if ret != sdk["RET_OK"]:
                raise RuntimeError(f"Futu history request failed: {data}")
            bars: list[Bar] = []
            for _, row in data.iterrows():
                bars.append(Bar(
                    timestamp=datetime.fromisoformat(str(row["time_key"])),
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=float(row["volume"]),
                ))
            return bars
        finally:
            quote_context.close()

    def place_simulated_limit_order(self, symbol: str, side: Side, quantity: int, price: float) -> Any:
        if not self.config.execution.simulated_order_submission_enabled:
            raise PermissionError("simulated order submission is disabled in config.json")
        if os.getenv("ENABLE_FUTU_SIMULATED_ORDERS") != "YES":
            raise PermissionError("set ENABLE_FUTU_SIMULATED_ORDERS=YES to submit paper orders")
        if quantity <= 0 or price <= 0:
            raise ValueError("quantity and price must be positive")

        sdk = self._sdk()
        market = getattr(sdk["TrdMarket"], self.config.futu.market)
        context = sdk["OpenSecTradeContext"](
            filter_trdmarket=market,
            host=self.config.futu.host,
            port=self.config.futu.port,
        )
        try:
            trade_side = sdk["TrdSide"].BUY if side == Side.BUY else sdk["TrdSide"].SELL
            ret, data = context.place_order(
                price=price,
                qty=quantity,
                code=symbol,
                trd_side=trade_side,
                order_type=sdk["OrderType"].NORMAL,
                trd_env=sdk["TrdEnv"].SIMULATE,
            )
            if ret != sdk["RET_OK"]:
                raise RuntimeError(f"Futu simulated order failed: {data}")
            return data
        finally:
            context.close()
