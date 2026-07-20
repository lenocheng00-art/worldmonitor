from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Optional

import anyio
from fastapi import Depends, FastAPI, Header, Request
from fastapi.responses import JSONResponse

from .audit import AuditStore
from .config import Settings
from .errors import BridgeError
from .futu_client import FutuAdapter
from .models import ConfirmOrderRequest, CreateProposedOrderRequest, ErrorBody
from .risk import RiskEngine
from .snapshot import SnapshotService
from .trading import TradingService

logger = logging.getLogger("futu_bridge")
logging.basicConfig(level=logging.INFO, format="%(message)s")


async def run_blocking(settings: Settings, function, *args, **kwargs):
    with anyio.fail_after(settings.futu_request_timeout_seconds):
        return await anyio.to_thread.run_sync(lambda: function(*args, **kwargs))


def create_app(
    settings: Optional[Settings] = None,
    adapter: Optional[FutuAdapter] = None,
    snapshots: Optional[SnapshotService] = None,
    risk: Optional[RiskEngine] = None,
    trading: Optional[TradingService] = None,
) -> FastAPI:
    settings = settings or Settings()
    adapter = adapter or FutuAdapter(settings)
    snapshots = snapshots or SnapshotService(settings, adapter)
    risk = risk or RiskEngine(settings)
    trading = trading or TradingService(settings, snapshots, adapter, AuditStore(settings.audit_path))
    app = FastAPI(title="WorldMonitor Futu Bridge", version="0.1.0", docs_url=None, redoc_url=None)
    app.state.settings = settings
    app.state.adapter = adapter
    app.state.snapshots = snapshots
    app.state.risk = risk
    app.state.trading = trading

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.monotonic()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        logger.info(json.dumps({
            "event": "request", "requestId": request_id, "method": request.method,
            "path": request.url.path, "status": response.status_code,
            "durationMs": round((time.monotonic() - started) * 1000, 1),
        }, separators=(",", ":")))
        return response

    @app.exception_handler(BridgeError)
    async def bridge_error(request: Request, exc: BridgeError):
        body = ErrorBody(
            error=exc.code, message=exc.message,
            requestId=getattr(request.state, "request_id", None), details=exc.details,
        )
        return JSONResponse(status_code=exc.status_code, content=body.model_dump(mode="json"))

    @app.exception_handler(TimeoutError)
    async def timeout_error(request: Request, _exc: TimeoutError):
        body = ErrorBody(
            error="opend_timeout", message="OpenD request timed out",
            requestId=getattr(request.state, "request_id", None),
        )
        return JSONResponse(status_code=504, content=body.model_dump(mode="json"))

    async def require_token(
        authorization: Optional[str] = Header(None),
        x_futu_bridge_token: Optional[str] = Header(None),
    ):
        if not settings.futu_bridge_token:
            raise BridgeError("bridge_token_unconfigured", "FUTU_BRIDGE_TOKEN is not configured", 503)
        supplied = authorization.removeprefix("Bearer ") if authorization else x_futu_bridge_token
        if supplied != settings.futu_bridge_token:
            raise BridgeError("unauthorized", "Valid bridge token required", 401)

    @app.get("/health")
    async def health():
        connected = await run_blocking(settings, adapter.socket_health)
        return {
            "status": "ok" if connected else "degraded",
            "openDConnected": connected,
            "tradingEnvironment": "REAL",
            "liveTradingEnabled": settings.live_trading_enabled,
            "killSwitch": settings.kill_switch,
            "humanConfirmationRequired": True,
            "hardLimitsConfigured": settings.hard_limits_configured,
        }

    @app.get("/v1/accounts", dependencies=[Depends(require_token)])
    async def accounts():
        return {"accounts": await run_blocking(settings, snapshots.list_accounts)}

    @app.get("/v1/account/snapshot", dependencies=[Depends(require_token)])
    async def account_snapshot():
        snapshot = await run_blocking(settings, snapshots.get_snapshot)
        risk.evaluate(snapshot, trading.list())
        return snapshot

    @app.get("/v1/positions", dependencies=[Depends(require_token)])
    async def positions():
        snapshot = await run_blocking(settings, snapshots.get_snapshot)
        return {"positions": snapshot.positions, "freshness": snapshot.freshness}

    @app.post("/v1/quotes/refresh", dependencies=[Depends(require_token)])
    async def refresh_quotes():
        snapshot = await run_blocking(settings, snapshots.get_snapshot, True)
        risk.evaluate(snapshot, trading.list())
        return snapshot

    @app.get("/v1/risk/alerts", dependencies=[Depends(require_token)])
    async def risk_alerts():
        try:
            snapshot = await run_blocking(settings, snapshots.get_snapshot)
            alerts = risk.evaluate(snapshot, trading.list())
        except BridgeError:
            connected = await run_blocking(settings, adapter.socket_health)
            alerts = risk.evaluate(None, trading.list(), open_d_connected=connected)
        return {"alerts": alerts}

    @app.post("/v1/risk/alerts/{alert_id}/ack", dependencies=[Depends(require_token)])
    async def acknowledge_alert(alert_id: str):
        try:
            return risk.acknowledge(alert_id)
        except KeyError as exc:
            raise BridgeError("alert_not_found", "Risk alert was not found", 404) from exc

    @app.post("/v1/proposed-orders", dependencies=[Depends(require_token)])
    async def create_proposed_order(body: CreateProposedOrderRequest):
        proposal = await run_blocking(settings, trading.create, body)
        risk.evaluate(await run_blocking(settings, snapshots.get_snapshot), trading.list())
        return proposal

    @app.get("/v1/proposed-orders", dependencies=[Depends(require_token)])
    async def proposed_orders():
        return {"orders": trading.list()}

    @app.post("/v1/proposed-orders/{order_id}/confirm", dependencies=[Depends(require_token)])
    async def confirm_order(order_id: str, body: ConfirmOrderRequest):
        return await run_blocking(settings, trading.confirm, order_id, body.confirmationPhrase)

    return app


app = create_app()
