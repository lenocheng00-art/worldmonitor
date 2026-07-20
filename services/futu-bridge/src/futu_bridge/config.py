from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(SERVICE_ROOT / ".env"),
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
        case_sensitive=False,
    )

    futu_opend_host: str = Field("127.0.0.1", validation_alias="FUTU_OPEND_HOST")
    futu_opend_port: int = Field(11111, validation_alias="FUTU_OPEND_PORT")
    futu_trd_env: str = Field("REAL", validation_alias="FUTU_TRD_ENV")
    futu_trd_market: str = Field("US", validation_alias="FUTU_TRD_MARKET")
    futu_target_acc_id: Optional[str] = Field(None, validation_alias="FUTU_TARGET_ACC_ID")
    futu_base_currency: str = Field("USD", validation_alias="FUTU_BASE_CURRENCY")
    futu_bridge_token: Optional[str] = Field(None, validation_alias="FUTU_BRIDGE_TOKEN")
    futu_bridge_bind_host: str = Field("127.0.0.1", validation_alias="FUTU_BRIDGE_BIND_HOST")
    futu_bridge_bind_port: int = Field(8787, validation_alias="FUTU_BRIDGE_BIND_PORT")
    futu_request_timeout_seconds: float = Field(8.0, validation_alias="FUTU_REQUEST_TIMEOUT_SECONDS")
    futu_snapshot_ttl_seconds: float = Field(10.0, validation_alias="FUTU_SNAPSHOT_TTL_SECONDS")
    futu_critical_position_weight: Decimal = Field(Decimal("90"), validation_alias="FUTU_CRITICAL_POSITION_WEIGHT")
    futu_notification_cooldown_seconds: int = Field(900, validation_alias="FUTU_NOTIFICATION_COOLDOWN_SECONDS")
    futu_macos_notifications_enabled: bool = Field(True, validation_alias="FUTU_MACOS_NOTIFICATIONS_ENABLED")
    futu_proposed_order_ttl_seconds: int = Field(120, validation_alias="FUTU_PROPOSED_ORDER_TTL_SECONDS")
    futu_risk_rules_json: str = Field("[]", validation_alias="FUTU_RISK_RULES_JSON")

    live_trading_enabled: bool = Field(False, validation_alias="LIVE_TRADING_ENABLED")
    live_buy_enabled: bool = Field(False, validation_alias="LIVE_BUY_ENABLED")
    require_human_confirmation: bool = Field(True, validation_alias="REQUIRE_HUMAN_CONFIRMATION")
    sell_only: bool = Field(True, validation_alias="SELL_ONLY")
    kill_switch: bool = Field(True, validation_alias="KILL_SWITCH")

    max_order_notional_usd: Optional[Decimal] = Field(None, validation_alias="MAX_ORDER_NOTIONAL_USD")
    max_daily_orders: Optional[int] = Field(None, validation_alias="MAX_DAILY_ORDERS")
    max_daily_notional_usd: Optional[Decimal] = Field(None, validation_alias="MAX_DAILY_NOTIONAL_USD")
    max_position_weight: Optional[Decimal] = Field(None, validation_alias="MAX_POSITION_WEIGHT")
    max_slippage_bps: Optional[Decimal] = Field(None, validation_alias="MAX_SLIPPAGE_BPS")
    max_quote_age_seconds: Optional[int] = Field(None, validation_alias="MAX_QUOTE_AGE_SECONDS")
    audit_path: Path = Field(SERVICE_ROOT / "var/audit.jsonl", validation_alias="FUTU_AUDIT_PATH")

    @model_validator(mode="after")
    def enforce_safety_invariants(self) -> "Settings":
        if self.futu_bridge_bind_host not in {"127.0.0.1", "localhost", "::1"}:
            raise ValueError("FUTU_BRIDGE_BIND_HOST must be loopback-only")
        if self.futu_trd_env.upper() != "REAL":
            raise ValueError("FUTU_TRD_ENV must remain REAL for this bridge")
        if not self.require_human_confirmation:
            raise ValueError("REQUIRE_HUMAN_CONFIRMATION cannot be disabled")
        return self

    @property
    def hard_limits_configured(self) -> bool:
        return all(
            value is not None
            for value in (
                self.max_order_notional_usd,
                self.max_daily_orders,
                self.max_daily_notional_usd,
                self.max_position_weight,
                self.max_slippage_bps,
                self.max_quote_age_seconds,
            )
        )

    @property
    def risk_rules(self) -> List[Dict[str, Any]]:
        try:
            value = json.loads(self.futu_risk_rules_json)
        except json.JSONDecodeError as exc:
            raise ValueError("FUTU_RISK_RULES_JSON must be valid JSON") from exc
        if not isinstance(value, list):
            raise ValueError("FUTU_RISK_RULES_JSON must be a JSON array")
        return value
