from __future__ import annotations

import math
import threading
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

from .config import Settings
from .errors import AccountSelectionRequired, BridgeError
from .futu_client import FutuAdapter
from .models import AccountData, AccountSnapshot, AccountSummary, Freshness, PositionData


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def clean_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value)
    return default if text.lower() in {"nan", "none", "n/a", "--"} else text


def decimal_or_none(value: Any) -> Optional[Decimal]:
    if value is None or isinstance(value, bool):
        return None
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    if not result.is_finite():
        return None
    return result


def truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "1", "yes"}


def mask_account_id(value: Any) -> str:
    text = clean_text(value)
    if len(text) <= 4:
        return "****"
    return f"****{text[-4:]}"


def quote_age_seconds(value: Optional[str], now: datetime, code: str) -> Optional[float]:
    if not value:
        return None
    normalized = value.strip().replace("Z", "+00:00")
    parsed: Optional[datetime] = None
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
            try:
                parsed = datetime.strptime(normalized, fmt)
                break
            except ValueError:
                continue
    if parsed is None:
        return None
    if parsed.tzinfo is None:
        market = code.split(".", 1)[0].upper() if "." in code else ""
        zone_name = {
            "US": "America/New_York",
            "HK": "Asia/Hong_Kong",
            "SH": "Asia/Shanghai",
            "SZ": "Asia/Shanghai",
            "JP": "Asia/Tokyo",
            "SG": "Asia/Singapore",
            "AU": "Australia/Sydney",
            "CA": "America/Toronto",
        }.get(market)
        if not zone_name:
            return None
        parsed = parsed.replace(tzinfo=ZoneInfo(zone_name))
    return max(0.0, (now - parsed.astimezone(timezone.utc)).total_seconds())


class SnapshotService:
    def __init__(self, settings: Settings, adapter: Optional[FutuAdapter] = None):
        self.settings = settings
        self.adapter = adapter or FutuAdapter(settings)
        self._lock = threading.Lock()
        self._cached: Optional[Tuple[datetime, AccountSnapshot]] = None

    def list_accounts(self) -> List[AccountSummary]:
        summaries: List[AccountSummary] = []
        for row in self.adapter.list_accounts():
            if clean_text(row.get("trd_env")).upper() not in {"REAL", "TRDENV.REAL"}:
                continue
            markets = row.get("trdmarket_auth") or []
            if not isinstance(markets, list):
                markets = [markets]
            summaries.append(
                AccountSummary(
                    maskedAccountId=mask_account_id(row.get("acc_id")),
                    tradingEnvironment="REAL",
                    accountType=clean_text(row.get("acc_type")) or None,
                    markets=[clean_text(item) for item in markets if clean_text(item)],
                )
            )
        return summaries

    def _select_account(self, raw_accounts: List[Dict[str, Any]]) -> Tuple[str, AccountSummary]:
        real_accounts = [
            row
            for row in raw_accounts
            if clean_text(row.get("trd_env")).upper() in {"REAL", "TRDENV.REAL"}
        ]
        summaries = [
            AccountSummary(
                maskedAccountId=mask_account_id(row.get("acc_id")),
                tradingEnvironment="REAL",
                accountType=clean_text(row.get("acc_type")) or None,
                markets=[],
            )
            for row in real_accounts
        ]
        target = self.settings.futu_target_acc_id
        if not target:
            raise AccountSelectionRequired(summaries)
        selected = next((row for row in real_accounts if clean_text(row.get("acc_id")) == target), None)
        if selected is None:
            raise BridgeError(
                "account_mismatch",
                "FUTU_TARGET_ACC_ID does not match an accessible real account",
                409,
                {"accounts": [item.model_dump(mode="json") for item in summaries]},
            )
        return target, next(item for item in summaries if item.maskedAccountId == mask_account_id(target))

    def get_snapshot(self, force: bool = False) -> AccountSnapshot:
        with self._lock:
            now = utc_now()
            if not force and self._cached:
                fetched_at, snapshot = self._cached
                if (now - fetched_at).total_seconds() < self.settings.futu_snapshot_ttl_seconds:
                    return snapshot
            snapshot = self._fetch(now)
            self._cached = (now, snapshot)
            return snapshot

    def _fetch(self, now: datetime) -> AccountSnapshot:
        raw_accounts = self.adapter.list_accounts()
        account_id, summary = self._select_account(raw_accounts)
        account_rows, position_rows = self.adapter.read_account_bundle(account_id)
        if not account_rows:
            raise BridgeError("empty_account", "OpenD returned no account asset record", 502)
        account_fetched_at = utc_now()
        positions_fetched_at = account_fetched_at
        errors: List[str] = []
        nonzero_codes = [
            clean_text(row.get("code"))
            for row in position_rows
            if (decimal_or_none(row.get("qty")) not in {None, Decimal("0")})
        ]
        quote_rows: List[Dict[str, Any]] = []
        market_states: Dict[str, str] = {}
        quotes_fetched_at: Optional[datetime] = None
        if nonzero_codes:
            try:
                quote_rows = self.adapter.get_quotes(nonzero_codes)
                market_states = self.adapter.get_market_states(nonzero_codes)
                quotes_fetched_at = utc_now()
            except BridgeError:
                errors.append("quotes_unavailable")
        account = self._map_account(account_rows[0], summary)
        quotes = {clean_text(row.get("code")): row for row in quote_rows}
        positions = [
            self._map_position(row, quotes.get(clean_text(row.get("code"))), market_states, account, now, errors)
            for row in position_rows
            if decimal_or_none(row.get("qty")) not in {None, Decimal("0")}
        ]
        stale = bool(errors) or any(item.quoteStatus in {"stale", "unavailable"} for item in positions)
        return AccountSnapshot(
            account=account,
            positions=positions,
            freshness=Freshness(
                accountFetchedAt=account_fetched_at,
                positionsFetchedAt=positions_fetched_at,
                quotesFetchedAt=quotes_fetched_at,
                openDConnected=True,
                stale=stale,
                errors=sorted(set(errors)),
            ),
        )

    def _map_account(self, row: Dict[str, Any], summary: AccountSummary) -> AccountData:
        currency = self.settings.futu_base_currency.upper()
        prefix = {"USD": "us", "HKD": "hk", "CNH": "cn", "JPY": "jp", "SGD": "sg"}.get(currency)
        cash = decimal_or_none(row.get(f"{prefix}_cash")) if prefix else None
        buying_power = None
        for key in ([f"{currency.lower()}_net_cash_power", f"{prefix}_net_cash_power"] if prefix else []):
            buying_power = decimal_or_none(row.get(key))
            if buying_power is not None:
                break
        total_assets = decimal_or_none(row.get("total_assets"))
        return AccountData(
            maskedAccountId=summary.maskedAccountId,
            tradingEnvironment="REAL",
            currency=currency,
            totalAssets=total_assets,
            netAssets=total_assets,
            cash=cash if cash is not None else decimal_or_none(row.get("cash")),
            securitiesMarketValue=decimal_or_none(row.get("market_val")),
            availableFunds=decimal_or_none(row.get("available_funds")),
            buyingPower=buying_power if buying_power is not None else decimal_or_none(row.get("power")),
        )

    def _map_position(
        self,
        row: Dict[str, Any],
        quote: Optional[Dict[str, Any]],
        market_states: Dict[str, str],
        account: AccountData,
        now: datetime,
        errors: List[str],
    ) -> PositionData:
        code = clean_text(row.get("code"))
        cost_valid = truthy(row.get("cost_price_valid"))
        legacy_cost = decimal_or_none(row.get("cost_price")) if cost_valid else None
        average_cost = decimal_or_none(row.get("average_cost")) if cost_valid else None
        diluted_cost = decimal_or_none(row.get("diluted_cost")) if cost_valid else None
        if average_cost is None and diluted_cost is None and legacy_cost is not None:
            average_cost = legacy_cost
            diluted_cost = legacy_cost
            errors.append(f"legacy_cost_price_fallback:{code}")
        quantity = decimal_or_none(row.get("qty")) or Decimal("0")
        market_value = decimal_or_none(row.get("market_val"))
        quote_time = clean_text(quote.get("update_time")) if quote else None
        quote_status = "unavailable"
        if quote:
            frame = clean_text(quote.get("price_frame_type")).upper()
            age = quote_age_seconds(quote_time, now, code)
            max_age = self.settings.max_quote_age_seconds
            if max_age is not None and (age is None or age > max_age):
                quote_status = "stale"
            elif "DELAY" in frame:
                quote_status = "delayed"
            elif "REAL" in frame:
                quote_status = "realtime"
            else:
                quote_status = "unknown"
        total_assets = account.totalAssets
        weight = None
        if market_value is not None and total_assets not in {None, Decimal("0")}:
            weight = (market_value / total_assets * Decimal("100")).quantize(Decimal("0.0001"))
        pnl_valid = truthy(row.get("pl_val_valid"))
        ratio_valid = truthy(row.get("pl_ratio_valid"))
        return PositionData(
            code=code,
            name=clean_text(row.get("stock_name"), code),
            market=clean_text(row.get("position_market"), code.split(".", 1)[0] if "." in code else ""),
            currency=clean_text(row.get("currency"), account.currency),
            quantity=quantity,
            availableQuantity=decimal_or_none(row.get("can_sell_qty")) or Decimal("0"),
            averageCost=average_cost,
            dilutedCost=diluted_cost,
            costValid=cost_valid and (average_cost is not None or diluted_cost is not None),
            currentPrice=decimal_or_none(quote.get("last_price")) if quote else None,
            bidPrice=decimal_or_none(quote.get("bid_price")) if quote else None,
            askPrice=decimal_or_none(quote.get("ask_price")) if quote else None,
            marketValue=market_value,
            unrealizedPnl=decimal_or_none(row.get("pl_val")) if pnl_valid else None,
            pnlRatio=decimal_or_none(row.get("pl_ratio")) if ratio_valid else None,
            portfolioWeight=weight,
            dailyChangePercent=decimal_or_none(quote.get("change_rate")) if quote else None,
            quoteUpdateTime=quote_time or None,
            quoteStatus=quote_status,
            marketState=market_states.get(code),
        )
