# Futu Account Bridge V1

A localhost-only Python sidecar between Futu OpenD and WorldMonitor. It keeps `futu-api`, account selection, quotes, and restricted live-order controls out of the Next.js/Vercel runtime.

## Setup

```bash
cd services/futu-bridge
python3 -m venv .venv
.venv/bin/pip install -r requirements.lock
cp .env.example .env
# Set FUTU_TARGET_ACC_ID and a strong FUTU_BRIDGE_TOKEN locally only.
.venv/bin/futu-bridge
```

OpenD must be running at `127.0.0.1:11111`. The service refuses a non-loopback bind address. `GET /health` is intentionally non-sensitive; every `/v1/*` endpoint requires `Authorization: Bearer <FUTU_BRIDGE_TOKEN>` or `X-Futu-Bridge-Token`.

## Account selection

`GET /v1/accounts` returns masked IDs only. If more than one account is available, the bridge never uses `acc_index=0`; copy the intended raw `acc_id` into the local `.env` as `FUTU_TARGET_ACC_ID`. The raw ID must never be committed.

## Restricted live trading

Signals may create a `ProposedOrder`, but order submission remains blocked until all hard limits are configured, `LIVE_TRADING_ENABLED=true`, `KILL_SWITCH=false`, and the exact one-time phrase is supplied:

```text
CONFIRM <code> <side> <quantity> <proposedOrderId>
```

The bridge only submits limit orders, defaults to sell-only, re-reads account/position/open-order/quote/market state immediately before submission, and records an audit event. It never calls `unlock_trade`, retries a failed order, cancels an order, or changes its price. Unlocking must be done manually in the OpenD GUI.

## Useful endpoints

- `GET /health`
- `GET /v1/accounts`
- `GET /v1/account/snapshot`
- `GET /v1/positions`
- `POST /v1/quotes/refresh`
- `GET /v1/risk/alerts`
- `POST /v1/risk/alerts/{alert_id}/ack`
- `POST /v1/proposed-orders`
- `GET /v1/proposed-orders`
- `POST /v1/proposed-orders/{order_id}/confirm`
