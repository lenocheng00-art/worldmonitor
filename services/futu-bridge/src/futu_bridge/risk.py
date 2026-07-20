from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Iterable, List, Optional

from pydantic import TypeAdapter

from .config import Settings
from .models import AccountSnapshot, ProposedOrder, RiskAlert, RiskRule
from .notifications import NotificationService


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class RiskEngine:
    def __init__(self, settings: Settings, notifications: Optional[NotificationService] = None):
        self.settings = settings
        self.notifications = notifications or NotificationService(settings)
        self._alerts: Dict[str, RiskAlert] = {}
        self.rules = TypeAdapter(List[RiskRule]).validate_python(settings.risk_rules)

    def evaluate(
        self,
        snapshot: Optional[AccountSnapshot],
        proposed_orders: Iterable[ProposedOrder] = (),
        open_d_connected: Optional[bool] = None,
    ) -> List[RiskAlert]:
        connected = snapshot.freshness.openDConnected if snapshot else bool(open_d_connected)
        candidates: List[RiskAlert] = []
        if not connected:
            candidates.append(self._make_alert("openD_disconnected", "CRITICAL", None, "builtin:openD", "OpenD is disconnected"))
        if snapshot:
            for position in snapshot.positions:
                if position.portfolioWeight is not None and position.portfolioWeight >= self.settings.futu_critical_position_weight:
                    candidates.append(
                        self._position_alert(
                            "portfolio_weight_above",
                            "CRITICAL",
                            position,
                            "builtin:critical_concentration",
                            f"{position.code} is {position.portfolioWeight}% of account assets",
                        )
                    )
                if position.quoteStatus in {"stale", "unavailable"}:
                    candidates.append(
                        self._position_alert(
                            "quote_stale", "CRITICAL", position, "builtin:quote_freshness", f"{position.code} quote is {position.quoteStatus}"
                        )
                    )
            for rule in self.rules:
                candidates.extend(self._evaluate_rule(rule, snapshot, proposed_orders))
        for proposal in proposed_orders:
            if proposal.status == "PENDING_CONFIRMATION":
                candidates.append(
                    self._make_alert(
                        "proposed_order_pending",
                        "CRITICAL",
                        proposal.code,
                        proposal.triggeringRule,
                        f"Proposed {proposal.side} {proposal.quantity} {proposal.code} awaits typed confirmation",
                        suggested_side=proposal.side,
                        suggested_quantity=proposal.quantity,
                        suggested_limit=proposal.limitPrice,
                        quote_time=proposal.quoteTime,
                        expires_at=proposal.expiresAt,
                    )
                )
        return self._merge(candidates)

    def _evaluate_rule(self, rule: RiskRule, snapshot: AccountSnapshot, proposals: Iterable[ProposedOrder]) -> List[RiskAlert]:
        alerts: List[RiskAlert] = []
        positions = [p for p in snapshot.positions if not rule.code or p.code == rule.code]
        for position in positions:
            value: Optional[Decimal] = None
            triggered = False
            if rule.type == "portfolio_weight_above":
                value = position.portfolioWeight
                triggered = value is not None and rule.threshold is not None and value > rule.threshold
            elif rule.type == "price_below":
                value = position.currentPrice
                triggered = value is not None and rule.threshold is not None and value < rule.threshold
            elif rule.type == "price_above":
                value = position.currentPrice
                triggered = value is not None and rule.threshold is not None and value > rule.threshold
            elif rule.type == "drawdown_from_cost_above":
                cost = position.dilutedCost or position.averageCost
                if cost and position.currentPrice is not None:
                    value = (cost - position.currentPrice) / cost * Decimal("100")
                    triggered = rule.threshold is not None and value > rule.threshold
            elif rule.type == "daily_change_above":
                value = abs(position.dailyChangePercent) if position.dailyChangePercent is not None else None
                triggered = value is not None and rule.threshold is not None and value > rule.threshold
            elif rule.type == "quote_stale":
                triggered = position.quoteStatus in {"stale", "unavailable"}
            if triggered:
                alerts.append(
                    self._position_alert(
                        rule.type,
                        rule.severity,
                        position,
                        rule.id,
                        f"{rule.id} triggered for {position.code}" + (f" at {value}" if value is not None else ""),
                    )
                )
        if rule.type == "openD_disconnected" and not snapshot.freshness.openDConnected:
            alerts.append(self._make_alert(rule.type, rule.severity, None, rule.id, "OpenD is disconnected"))
        if rule.type == "proposed_order_pending":
            for proposal in proposals:
                if proposal.status == "PENDING_CONFIRMATION" and (not rule.code or proposal.code == rule.code):
                    alerts.append(
                        self._make_alert(
                            rule.type,
                            rule.severity,
                            proposal.code,
                            rule.id,
                            f"{proposal.code} proposed order awaits confirmation",
                            suggested_side=proposal.side,
                            suggested_quantity=proposal.quantity,
                            suggested_limit=proposal.limitPrice,
                            quote_time=proposal.quoteTime,
                            expires_at=proposal.expiresAt,
                        )
                    )
        return alerts

    def _position_alert(self, type_, severity, position, rule, message) -> RiskAlert:
        suggested_side = "SELL" if type_ in {"portfolio_weight_above", "price_below", "drawdown_from_cost_above"} else None
        return self._make_alert(
            type_, severity, position.code, rule, message,
            current_price=position.currentPrice,
            average_cost=position.averageCost,
            diluted_cost=position.dilutedCost,
            current_weight=position.portfolioWeight,
            suggested_side=suggested_side,
            quote_time=position.quoteUpdateTime,
        )

    def _make_alert(
        self, type_, severity, code, rule, message, *, current_price=None, average_cost=None,
        diluted_cost=None, current_weight=None, suggested_side=None, suggested_quantity=None,
        suggested_limit=None, quote_time=None, expires_at=None,
    ) -> RiskAlert:
        now = now_utc()
        dedup_key = f"{type_}:{rule}:{code or 'bridge'}"
        alert_id = hashlib.sha256(dedup_key.encode()).hexdigest()[:16]
        return RiskAlert(
            id=alert_id,
            dedupKey=dedup_key,
            type=type_, severity=severity, code=code, triggeringRule=rule, message=message,
            currentPrice=current_price, averageCost=average_cost, dilutedCost=diluted_cost,
            currentWeight=current_weight, suggestedSide=suggested_side,
            suggestedQuantity=suggested_quantity, suggestedLimitPrice=suggested_limit,
            quoteTime=quote_time, expiresAt=expires_at, createdAt=now, lastTriggeredAt=now,
        )

    def _merge(self, candidates: List[RiskAlert]) -> List[RiskAlert]:
        active_keys = {candidate.dedupKey for candidate in candidates}
        for key in list(self._alerts):
            if key not in active_keys:
                del self._alerts[key]
        for candidate in candidates:
            existing = self._alerts.get(candidate.dedupKey)
            if existing:
                candidate.createdAt = existing.createdAt
                candidate.status = existing.status
            self._alerts[candidate.dedupKey] = candidate
            rule = next((item for item in self.rules if item.id == candidate.triggeringRule), None)
            cooldown = rule.cooldownSeconds if rule and rule.cooldownSeconds else self.settings.futu_notification_cooldown_seconds
            if candidate.status == "ACTIVE":
                self.notifications.notify(candidate, cooldown)
        return self.current()

    def current(self) -> List[RiskAlert]:
        return sorted(self._alerts.values(), key=lambda item: (item.severity != "CRITICAL", item.createdAt))

    def acknowledge(self, alert_id: str) -> RiskAlert:
        alert = next((item for item in self._alerts.values() if item.id == alert_id), None)
        if alert is None:
            raise KeyError(alert_id)
        alert.status = "ACKNOWLEDGED"
        return alert
