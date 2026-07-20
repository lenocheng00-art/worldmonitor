from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, List

from .audit import AuditStore
from .config import Settings
from .errors import BridgeError
from .futu_client import FutuAdapter
from .models import AccountSnapshot, CreateProposedOrderRequest, ProposedOrder
from .snapshot import SnapshotService, clean_text, decimal_or_none


OPEN_MARKET_STATES = {"MORNING", "AFTERNOON", "FUTURE_DAY_OPEN", "NIGHT_OPEN", "NIGHT"}
FINAL_ORDER_STATES = {"FILLED_ALL", "CANCELLED_ALL", "FAILED", "DISABLED", "DELETED"}


def canonical_quantity(value: Decimal) -> str:
    return format(value.normalize(), "f")


def confirmation_phrase(order: ProposedOrder) -> str:
    return f"CONFIRM {order.code} {order.side} {canonical_quantity(order.quantity)} {order.proposedOrderId}"


class TradingService:
    def __init__(self, settings: Settings, snapshots: SnapshotService, adapter: FutuAdapter, audit: AuditStore):
        self.settings = settings
        self.snapshots = snapshots
        self.adapter = adapter
        self.audit = audit
        self._orders: Dict[str, ProposedOrder] = {}

    def list(self) -> List[ProposedOrder]:
        self._expire()
        return sorted(self._orders.values(), key=lambda item: item.createdAt, reverse=True)

    def create(self, request: CreateProposedOrderRequest) -> ProposedOrder:
        self._expire()
        if request.idempotencyKey in self.audit.submitted_idempotency_keys() or any(
            item.idempotencyKey == request.idempotencyKey for item in self._orders.values()
        ):
            raise BridgeError("duplicate_idempotency_key", "Idempotency key has already been used", 409)
        if self.settings.sell_only and request.side != "SELL":
            raise BridgeError("sell_only", "Bridge is configured for SELL orders only", 403)
        if request.side == "BUY" and not self.settings.live_buy_enabled:
            raise BridgeError("buy_disabled", "LIVE_BUY_ENABLED is false", 403)
        snapshot = self.snapshots.get_snapshot(force=True)
        position = next((item for item in snapshot.positions if item.code == request.code), None)
        if position is None and request.side == "SELL":
            raise BridgeError("position_not_found", "Cannot propose a sale without a current position", 409)
        if position and not position.costValid:
            raise BridgeError("cost_unavailable", "Cost data is invalid; proposal blocked", 409)
        if not position or position.quoteStatus in {"stale", "unavailable"}:
            raise BridgeError("quote_stale", "A fresh quote is required to create a proposal", 409)
        if position.currentPrice is None or position.bidPrice is None or position.askPrice is None or not position.quoteUpdateTime:
            raise BridgeError("incomplete_quote", "Current price, bid, ask, and quote time are required", 409)
        if position.portfolioWeight is None or snapshot.account.totalAssets in {None, Decimal("0")}:
            raise BridgeError("account_value_unavailable", "Account value and current position weight are required", 409)
        if request.side == "SELL" and request.quantity > position.availableQuantity:
            raise BridgeError("insufficient_position", "Quantity exceeds available position", 409)
        current = position.quantity
        projected = current - request.quantity if request.side == "SELL" else current + request.quantity
        total_assets = snapshot.account.totalAssets
        current_weight = position.portfolioWeight
        price = position.currentPrice
        projected_market_value = projected * price
        projected_weight = projected_market_value / total_assets * Decimal("100") if total_assets else Decimal("0")
        now = datetime.now(timezone.utc)
        blocked = self._configuration_blocks()
        proposal = ProposedOrder(
            proposedOrderId=str(uuid.uuid4()), code=request.code, side=request.side,
            quantity=request.quantity, limitPrice=request.limitPrice, reason=request.reason,
            triggeringRule=request.triggeringRule, currentPosition=current,
            projectedPosition=projected, currentWeight=current_weight,
            projectedWeight=projected_weight.quantize(Decimal("0.0001")),
            bid=position.bidPrice, ask=position.askPrice,
            quoteTime=position.quoteUpdateTime,
            expiresAt=now + timedelta(seconds=self.settings.futu_proposed_order_ttl_seconds),
            idempotencyKey=request.idempotencyKey, status="PENDING_CONFIRMATION",
            submissionBlockedReasons=blocked, createdAt=now,
        )
        self._orders[proposal.proposedOrderId] = proposal
        self.audit.append("proposed_order_created", {
            "proposedOrderId": proposal.proposedOrderId, "code": proposal.code, "side": proposal.side,
            "quantity": proposal.quantity, "limitPrice": proposal.limitPrice,
            "idempotencyKey": proposal.idempotencyKey, "blockedReasons": blocked,
        })
        return proposal

    def confirm(self, order_id: str, phrase: str) -> ProposedOrder:
        self._expire()
        proposal = self._orders.get(order_id)
        if proposal is None:
            raise BridgeError("proposal_not_found", "Proposed order was not found", 404)
        if proposal.status != "PENDING_CONFIRMATION":
            raise BridgeError("proposal_not_pending", f"Proposed order status is {proposal.status}", 409)
        if phrase != confirmation_phrase(proposal):
            raise BridgeError("invalid_confirmation_phrase", "Typed confirmation phrase does not match", 403)
        blocks = self._configuration_blocks()
        if blocks:
            proposal.submissionBlockedReasons = blocks
            raise BridgeError("live_trading_blocked", "Live order submission is disabled", 403, {"reasons": blocks})
        if proposal.idempotencyKey in self.audit.submitted_idempotency_keys():
            raise BridgeError("duplicate_submission", "Order has already been submitted", 409)
        snapshot = self.snapshots.get_snapshot(force=True)
        position = next((item for item in snapshot.positions if item.code == proposal.code), None)
        self._validate_fresh_state(proposal, snapshot, position)
        account_id = self.settings.futu_target_acc_id
        if account_id is None:
            raise BridgeError("account_selection_required", "FUTU_TARGET_ACC_ID is required", 409)
        open_orders = self.adapter.list_orders(account_id, proposal.code)
        for order in open_orders:
            status = clean_text(order.get("order_status")).upper()
            side = clean_text(order.get("trd_side")).upper()
            if status not in FINAL_ORDER_STATES and proposal.side in side:
                raise BridgeError("similar_order_pending", "A matching unfinished order already exists", 409)
        self._validate_limits(proposal, snapshot, position)
        try:
            response = self.adapter.place_limit_order(
                account_id, proposal.code, proposal.side, float(proposal.quantity),
                float(proposal.limitPrice), f"wm:{proposal.proposedOrderId[:20]}",
            )
        except Exception:
            proposal.status = "REJECTED"
            self.audit.append("order_submission_failed", {
                "proposedOrderId": proposal.proposedOrderId, "code": proposal.code,
                "idempotencyKey": proposal.idempotencyKey,
            })
            raise
        order_id_value = clean_text(response.get("order_id"))
        proposal.status = "SUBMITTED"
        proposal.submittedOrderId = order_id_value or None
        proposal.orderStatus = clean_text(response.get("order_status")) or "SUBMITTED"
        # One read-back only. A failed read-back is reported; the original order is never retried.
        if order_id_value:
            readback = self.adapter.list_orders(account_id, proposal.code)
            matched = next((item for item in readback if clean_text(item.get("order_id")) == order_id_value), None)
            if matched:
                proposal.orderStatus = clean_text(matched.get("order_status")) or proposal.orderStatus
        notional = proposal.quantity * proposal.limitPrice
        self.audit.append("order_submitted", {
            "proposedOrderId": proposal.proposedOrderId, "orderId": proposal.submittedOrderId,
            "orderStatus": proposal.orderStatus, "code": proposal.code, "side": proposal.side,
            "quantity": proposal.quantity, "limitPrice": proposal.limitPrice,
            "notional": notional, "idempotencyKey": proposal.idempotencyKey,
        })
        return proposal

    def _configuration_blocks(self) -> List[str]:
        blocks = []
        if not self.settings.live_trading_enabled:
            blocks.append("LIVE_TRADING_ENABLED=false")
        if self.settings.kill_switch:
            blocks.append("KILL_SWITCH=true")
        if not self.settings.require_human_confirmation:
            blocks.append("REQUIRE_HUMAN_CONFIRMATION must be true")
        if not self.settings.hard_limits_configured:
            blocks.append("one or more hard risk limits are unset")
        if not self.settings.futu_target_acc_id:
            blocks.append("FUTU_TARGET_ACC_ID is unset")
        return blocks

    def _validate_fresh_state(self, proposal, snapshot, position) -> None:
        if not snapshot.freshness.openDConnected:
            raise BridgeError("opend_disconnected", "OpenD is disconnected", 409)
        if snapshot.account.maskedAccountId != ("****" + self.settings.futu_target_acc_id[-4:]):
            raise BridgeError("account_mismatch", "Selected account changed", 409)
        if position is None:
            raise BridgeError("position_not_found", "Position changed before confirmation", 409)
        if not position.costValid:
            raise BridgeError("cost_unavailable", "Cost became invalid before confirmation", 409)
        if position.quoteStatus in {"stale", "unavailable", "delayed"}:
            raise BridgeError("quote_not_tradeable", f"Quote status is {position.quoteStatus}", 409)
        if clean_text(position.marketState).upper() not in OPEN_MARKET_STATES:
            raise BridgeError("market_closed", f"Market state is {position.marketState or 'unknown'}", 409)
        if proposal.side == "SELL" and proposal.quantity > position.availableQuantity:
            raise BridgeError("insufficient_position", "Available position changed", 409)
        if proposal.side == "BUY" and not self.settings.live_buy_enabled:
            raise BridgeError("buy_disabled", "LIVE_BUY_ENABLED is false", 403)

    def _validate_limits(self, proposal, snapshot, position) -> None:
        notional = proposal.quantity * proposal.limitPrice
        if notional > self.settings.max_order_notional_usd:
            raise BridgeError("max_order_notional", "Order exceeds MAX_ORDER_NOTIONAL_USD", 409)
        daily_count, daily_notional = self.audit.daily_submission_totals()
        if daily_count >= self.settings.max_daily_orders:
            raise BridgeError("max_daily_orders", "MAX_DAILY_ORDERS reached", 409)
        if daily_notional + notional > self.settings.max_daily_notional_usd:
            raise BridgeError("max_daily_notional", "Order exceeds MAX_DAILY_NOTIONAL_USD", 409)
        projected_quantity = position.quantity - proposal.quantity if proposal.side == "SELL" else position.quantity + proposal.quantity
        total_assets = snapshot.account.totalAssets or Decimal("0")
        projected_weight = projected_quantity * proposal.limitPrice / total_assets * Decimal("100") if total_assets else Decimal("0")
        if projected_weight > self.settings.max_position_weight:
            raise BridgeError("max_position_weight", "Projected position exceeds MAX_POSITION_WEIGHT", 409)
        reference = position.bidPrice if proposal.side == "SELL" else position.askPrice
        if reference in {None, Decimal("0")}:
            raise BridgeError("missing_bid_ask", "Current bid/ask is required", 409)
        slippage_bps = abs(proposal.limitPrice - reference) / reference * Decimal("10000")
        if slippage_bps > self.settings.max_slippage_bps:
            raise BridgeError("max_slippage", "Limit price exceeds MAX_SLIPPAGE_BPS", 409)
        if proposal.side == "BUY" and (snapshot.account.buyingPower or Decimal("0")) < notional:
            raise BridgeError("insufficient_buying_power", "Buying power is insufficient", 409)

    def _expire(self) -> None:
        now = datetime.now(timezone.utc)
        for proposal in self._orders.values():
            if proposal.status == "PENDING_CONFIRMATION" and now >= proposal.expiresAt:
                proposal.status = "EXPIRED"
                self.audit.append("proposed_order_expired", {"proposedOrderId": proposal.proposedOrderId})
