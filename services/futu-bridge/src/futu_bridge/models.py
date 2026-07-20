from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, PlainSerializer


JsonDecimal = Annotated[Decimal, PlainSerializer(lambda value: float(value), return_type=float, when_used="json")]


class BridgeModel(BaseModel):
    pass


class AccountSummary(BridgeModel):
    maskedAccountId: str
    tradingEnvironment: str
    accountType: Optional[str] = None
    markets: List[str] = Field(default_factory=list)


class AccountData(BridgeModel):
    maskedAccountId: str
    tradingEnvironment: str
    currency: str
    totalAssets: Optional[JsonDecimal] = None
    netAssets: Optional[JsonDecimal] = None
    cash: Optional[JsonDecimal] = None
    securitiesMarketValue: Optional[JsonDecimal] = None
    availableFunds: Optional[JsonDecimal] = None
    buyingPower: Optional[JsonDecimal] = None


class PositionData(BridgeModel):
    code: str
    name: str
    market: str
    currency: str
    quantity: JsonDecimal
    availableQuantity: JsonDecimal
    averageCost: Optional[JsonDecimal] = None
    dilutedCost: Optional[JsonDecimal] = None
    costValid: bool
    currentPrice: Optional[JsonDecimal] = None
    bidPrice: Optional[JsonDecimal] = None
    askPrice: Optional[JsonDecimal] = None
    marketValue: Optional[JsonDecimal] = None
    unrealizedPnl: Optional[JsonDecimal] = None
    pnlRatio: Optional[JsonDecimal] = None
    portfolioWeight: Optional[JsonDecimal] = None
    dailyChangePercent: Optional[JsonDecimal] = None
    quoteUpdateTime: Optional[str] = None
    quoteStatus: Literal["realtime", "delayed", "unknown", "stale", "unavailable"] = "unavailable"
    marketState: Optional[str] = None


class Freshness(BridgeModel):
    accountFetchedAt: Optional[datetime] = None
    positionsFetchedAt: Optional[datetime] = None
    quotesFetchedAt: Optional[datetime] = None
    openDConnected: bool
    stale: bool
    errors: List[str] = Field(default_factory=list)


class AccountSnapshot(BridgeModel):
    account: AccountData
    positions: List[PositionData]
    freshness: Freshness


RuleType = Literal[
    "portfolio_weight_above",
    "price_below",
    "price_above",
    "drawdown_from_cost_above",
    "daily_change_above",
    "quote_stale",
    "openD_disconnected",
    "proposed_order_pending",
]


class RiskRule(BridgeModel):
    id: str
    type: RuleType
    code: Optional[str] = None
    threshold: Optional[JsonDecimal] = None
    severity: Literal["INFO", "WARNING", "CRITICAL"] = "WARNING"
    cooldownSeconds: Optional[int] = None


class RiskAlert(BridgeModel):
    id: str
    dedupKey: str
    type: RuleType
    severity: Literal["INFO", "WARNING", "CRITICAL"]
    status: Literal["ACTIVE", "ACKNOWLEDGED"] = "ACTIVE"
    code: Optional[str] = None
    triggeringRule: str
    message: str
    currentPrice: Optional[JsonDecimal] = None
    averageCost: Optional[JsonDecimal] = None
    dilutedCost: Optional[JsonDecimal] = None
    currentWeight: Optional[JsonDecimal] = None
    suggestedSide: Optional[Literal["BUY", "SELL"]] = None
    suggestedQuantity: Optional[JsonDecimal] = None
    suggestedLimitPrice: Optional[JsonDecimal] = None
    quoteTime: Optional[str] = None
    expiresAt: Optional[datetime] = None
    createdAt: datetime
    lastTriggeredAt: datetime


class CreateProposedOrderRequest(BridgeModel):
    code: str
    side: Literal["BUY", "SELL"]
    quantity: JsonDecimal = Field(gt=0)
    limitPrice: JsonDecimal = Field(gt=0)
    reason: str = Field(min_length=3, max_length=500)
    triggeringRule: str = Field(min_length=1, max_length=200)
    idempotencyKey: str = Field(min_length=8, max_length=128)


class ProposedOrder(BridgeModel):
    proposedOrderId: str
    code: str
    side: Literal["BUY", "SELL"]
    quantity: JsonDecimal
    limitPrice: JsonDecimal
    reason: str
    triggeringRule: str
    currentPosition: JsonDecimal
    projectedPosition: JsonDecimal
    currentWeight: JsonDecimal
    projectedWeight: JsonDecimal
    bid: JsonDecimal
    ask: JsonDecimal
    quoteTime: str
    expiresAt: datetime
    idempotencyKey: str
    status: Literal["PENDING_CONFIRMATION", "SUBMITTED", "REJECTED", "EXPIRED"]
    submissionBlockedReasons: List[str] = Field(default_factory=list)
    createdAt: datetime
    submittedOrderId: Optional[str] = None
    orderStatus: Optional[str] = None


class ConfirmOrderRequest(BridgeModel):
    confirmationPhrase: str


class ErrorBody(BridgeModel):
    error: str
    message: str
    requestId: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
