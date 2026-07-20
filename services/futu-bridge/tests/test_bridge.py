from datetime import datetime, timezone
from pathlib import Path
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from futu_bridge.app import create_app
from futu_bridge.audit import AuditStore
from futu_bridge.config import Settings
from futu_bridge.errors import AccountSelectionRequired, BridgeError
from futu_bridge.models import CreateProposedOrderRequest
from futu_bridge.risk import RiskEngine
from futu_bridge.snapshot import SnapshotService
from futu_bridge.trading import TradingService, confirmation_phrase


class FakeAdapter:
    def socket_health(self):
        return False

    def list_accounts(self):
        return [
            {"acc_id": "12345678", "trd_env": "REAL", "acc_type": "CASH"},
            {"acc_id": "99887766", "trd_env": "REAL", "acc_type": "MARGIN"},
        ]

    def read_account_bundle(self, account_id):
        assert account_id == "99887766"
        return ([{
            "total_assets": 10000, "us_cash": 2000, "market_val": 8000,
            "available_funds": 1500, "usd_net_cash_power": 2500,
        }], [{
            "code": "US.RAM", "stock_name": "RAM", "position_market": "US", "currency": "USD",
            "qty": 100, "can_sell_qty": 100, "cost_price_valid": True,
            "average_cost": 17.5, "diluted_cost": 16.75, "cost_price": 15,
            "market_val": 9672, "pl_val": 100, "pl_val_valid": True,
            "pl_ratio": 6, "pl_ratio_valid": True,
        }])

    def get_quotes(self, codes, attempts=3):
        return [{
            "code": "US.RAM", "last_price": 20, "bid_price": 19.99, "ask_price": 20.01,
            "update_time": datetime.now(timezone.utc).isoformat(), "price_frame_type": "REAL_TIME",
            "change_rate": 4,
        }]

    def get_market_states(self, codes):
        return {"US.RAM": "AFTERNOON"}

    def list_orders(self, account_id, code=""):
        return []

    def place_limit_order(self, *args, **kwargs):
        raise AssertionError("place_limit_order must not be reached in gate tests")


def make_settings(**overrides):
    values = {
        "FUTU_TARGET_ACC_ID": "99887766",
        "FUTU_BRIDGE_TOKEN": "test-token",
        "FUTU_MACOS_NOTIFICATIONS_ENABLED": False,
        "FUTU_CRITICAL_POSITION_WEIGHT": "90",
    }
    values.update(overrides)
    return Settings(**values)


def test_non_loopback_binding_is_rejected():
    with pytest.raises(ValueError, match="loopback"):
        Settings(FUTU_BRIDGE_BIND_HOST="0.0.0.0")


def test_human_confirmation_cannot_be_disabled():
    with pytest.raises(ValueError, match="cannot be disabled"):
        Settings(REQUIRE_HUMAN_CONFIRMATION=False)


def test_explicit_account_selection_and_cost_precedence():
    service = SnapshotService(make_settings(), FakeAdapter())
    snapshot = service.get_snapshot(force=True)
    position = snapshot.positions[0]
    assert snapshot.account.maskedAccountId == "****7766"
    assert position.averageCost == Decimal("17.5")
    assert position.dilutedCost == Decimal("16.75")
    assert position.portfolioWeight == Decimal("96.7200")
    payload = snapshot.model_dump(mode="json")
    assert payload["positions"][0]["dilutedCost"] == 16.75


def test_missing_target_never_defaults_to_first_account():
    service = SnapshotService(make_settings(FUTU_TARGET_ACC_ID=None), FakeAdapter())
    with pytest.raises(AccountSelectionRequired):
        service.get_snapshot(force=True)


def test_critical_concentration_alert_is_created():
    settings = make_settings()
    service = SnapshotService(settings, FakeAdapter())
    alerts = RiskEngine(settings).evaluate(service.get_snapshot(force=True))
    alert = next(item for item in alerts if item.type == "portfolio_weight_above")
    assert alert.severity == "CRITICAL"
    assert alert.code == "US.RAM"


def test_health_is_public_but_v1_requires_token():
    settings = make_settings()
    app = create_app(settings=settings, adapter=FakeAdapter(), snapshots=SnapshotService(settings, FakeAdapter()))
    client = TestClient(app)
    assert client.get("/health").status_code == 200
    assert client.get("/v1/accounts").status_code == 401
    response = client.get("/v1/accounts", headers={"Authorization": "Bearer test-token"})
    assert response.status_code == 200
    assert response.json()["accounts"][0]["maskedAccountId"] == "****5678"


def test_proposal_stays_blocked_until_all_live_controls_are_enabled(tmp_path: Path):
    settings = make_settings(FUTU_AUDIT_PATH=tmp_path / "audit.jsonl")
    adapter = FakeAdapter()
    snapshots = SnapshotService(settings, adapter)
    trading = TradingService(settings, snapshots, adapter, AuditStore(settings.audit_path))
    proposal = trading.create(CreateProposedOrderRequest(
        code="US.RAM", side="SELL", quantity="10", limitPrice="19.99",
        reason="Concentration review", triggeringRule="ram-concentration",
        idempotencyKey="ram-risk-20260720",
    ))
    assert "LIVE_TRADING_ENABLED=false" in proposal.submissionBlockedReasons
    assert "KILL_SWITCH=true" in proposal.submissionBlockedReasons
    assert "one or more hard risk limits are unset" in proposal.submissionBlockedReasons
    with pytest.raises(BridgeError, match="Live order submission is disabled"):
        trading.confirm(proposal.proposedOrderId, confirmation_phrase(proposal))


def test_plain_button_or_wrong_phrase_never_confirms(tmp_path: Path):
    settings = make_settings(
        FUTU_AUDIT_PATH=tmp_path / "audit.jsonl",
        LIVE_TRADING_ENABLED=True,
        KILL_SWITCH=False,
        MAX_ORDER_NOTIONAL_USD="10000",
        MAX_DAILY_ORDERS=2,
        MAX_DAILY_NOTIONAL_USD="20000",
        MAX_POSITION_WEIGHT="100",
        MAX_SLIPPAGE_BPS="25",
        MAX_QUOTE_AGE_SECONDS=120,
    )
    adapter = FakeAdapter()
    snapshots = SnapshotService(settings, adapter)
    trading = TradingService(settings, snapshots, adapter, AuditStore(settings.audit_path))
    proposal = trading.create(CreateProposedOrderRequest(
        code="US.RAM", side="SELL", quantity="10", limitPrice="19.99",
        reason="Concentration review", triggeringRule="ram-concentration",
        idempotencyKey="ram-risk-phrase-test",
    ))
    with pytest.raises(BridgeError, match="Typed confirmation phrase does not match"):
        trading.confirm(proposal.proposedOrderId, "CONFIRM")
