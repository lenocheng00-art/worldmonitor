from __future__ import annotations

import importlib
import socket
import time
from contextlib import contextmanager
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .config import Settings
from .errors import BridgeError, OpenDUnavailable


def dataframe_records(value: Any) -> List[Dict[str, Any]]:
    if hasattr(value, "to_dict"):
        return list(value.to_dict(orient="records"))
    if isinstance(value, list):
        return value
    return []


class FutuAdapter:
    """Thin synchronous wrapper around the official futu-api package."""

    def __init__(self, settings: Settings):
        self.settings = settings

    @staticmethod
    def _sdk():
        return importlib.import_module("futu")

    def socket_health(self) -> bool:
        try:
            with socket.create_connection(
                (self.settings.futu_opend_host, self.settings.futu_opend_port), timeout=0.5
            ):
                return True
        except OSError:
            return False

    @contextmanager
    def trade_context(self):
        sdk = self._sdk()
        market = getattr(sdk.TrdMarket, self.settings.futu_trd_market.upper(), sdk.TrdMarket.US)
        context = None
        try:
            context = sdk.OpenSecTradeContext(
                filter_trdmarket=market,
                host=self.settings.futu_opend_host,
                port=self.settings.futu_opend_port,
            )
            yield context, sdk
        except BridgeError:
            raise
        except Exception as exc:
            raise OpenDUnavailable(self._safe_error(exc)) from exc
        finally:
            if context is not None:
                context.close()

    @contextmanager
    def quote_context(self):
        sdk = self._sdk()
        context = None
        try:
            context = sdk.OpenQuoteContext(
                host=self.settings.futu_opend_host,
                port=self.settings.futu_opend_port,
            )
            yield context, sdk
        except BridgeError:
            raise
        except Exception as exc:
            raise OpenDUnavailable(self._safe_error(exc)) from exc
        finally:
            if context is not None:
                context.close()

    @staticmethod
    def _safe_error(exc: Exception) -> str:
        # Never include request payloads or account identifiers in error text.
        return f"{exc.__class__.__name__}: OpenD request failed"

    @staticmethod
    def _result(ret: Any, data: Any, sdk: Any, operation: str) -> Any:
        if ret != sdk.RET_OK:
            raise BridgeError("futu_api_error", f"{operation} failed", 502)
        return data

    def list_accounts(self) -> List[Dict[str, Any]]:
        with self.trade_context() as (context, sdk):
            ret, data = context.get_acc_list()
            return dataframe_records(self._result(ret, data, sdk, "get_acc_list"))

    def read_account_bundle(self, account_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        with self.trade_context() as (context, sdk):
            acc_id = int(account_id)
            ret, account_data = context.accinfo_query(
                trd_env=sdk.TrdEnv.REAL,
                acc_id=acc_id,
                refresh_cache=True,
            )
            account_records = dataframe_records(self._result(ret, account_data, sdk, "accinfo_query"))
            ret, position_data = context.position_list_query(
                trd_env=sdk.TrdEnv.REAL,
                acc_id=acc_id,
                refresh_cache=True,
            )
            position_records = dataframe_records(
                self._result(ret, position_data, sdk, "position_list_query")
            )
            return account_records, position_records

    def get_quotes(self, codes: Iterable[str], attempts: int = 3) -> List[Dict[str, Any]]:
        code_list = list(dict.fromkeys(codes))
        if not code_list:
            return []
        last_error: Optional[Exception] = None
        for attempt in range(attempts):
            try:
                with self.quote_context() as (context, sdk):
                    ret, data = context.get_market_snapshot(code_list)
                    return dataframe_records(self._result(ret, data, sdk, "get_market_snapshot"))
            except (BridgeError, OpenDUnavailable) as exc:
                last_error = exc
                if attempt + 1 < attempts:
                    time.sleep(0.25 * (2**attempt))
        raise last_error or OpenDUnavailable()

    def get_market_states(self, codes: Iterable[str]) -> Dict[str, str]:
        code_list = list(dict.fromkeys(codes))
        if not code_list:
            return {}
        with self.quote_context() as (context, sdk):
            ret, data = context.get_market_state(code_list)
            rows = dataframe_records(self._result(ret, data, sdk, "get_market_state"))
            return {str(row.get("code")): str(row.get("market_state")) for row in rows}

    def list_orders(self, account_id: str, code: str = "") -> List[Dict[str, Any]]:
        with self.trade_context() as (context, sdk):
            ret, data = context.order_list_query(
                code=code,
                trd_env=sdk.TrdEnv.REAL,
                acc_id=int(account_id),
                refresh_cache=True,
            )
            return dataframe_records(self._result(ret, data, sdk, "order_list_query"))

    def place_limit_order(
        self, account_id: str, code: str, side: str, quantity: float, limit_price: float, remark: str
    ) -> Dict[str, Any]:
        with self.trade_context() as (context, sdk):
            trd_side = sdk.TrdSide.SELL if side == "SELL" else sdk.TrdSide.BUY
            ret, data = context.place_order(
                price=limit_price,
                qty=quantity,
                code=code,
                trd_side=trd_side,
                order_type=sdk.OrderType.NORMAL,
                trd_env=sdk.TrdEnv.REAL,
                acc_id=int(account_id),
                remark=remark,
            )
            rows = dataframe_records(self._result(ret, data, sdk, "place_order"))
            if not rows:
                raise BridgeError("empty_order_response", "OpenD returned no order record", 502)
            return rows[0]
