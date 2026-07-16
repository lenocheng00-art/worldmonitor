# Satellite Quant V1

Simulation-first quantitative trading engine for a standalone HKD 300,000 satellite account.

## Safety defaults

- `SIMULATE` mode only; configuration validation rejects any other mode.
- Live trading is hard-disabled.
- No margin and no averaging down.
- 0.5% equity risk per trade.
- 10% maximum position size.
- 1.5% daily loss lock and 8% maximum drawdown lock.
- Futu paper-order submission is disabled by default and needs both a config change and the `ENABLE_FUTU_SIMULATED_ORDERS=YES` environment variable.

## Commands

Run from `correct-worldmonitor`:

```bash
PYTHONPATH=quant python3 -m quant_trader validate
PYTHONPATH=quant python3 -m quant_trader demo-backtest
PYTHONPATH=quant python3 -m unittest discover -s quant/tests -v
```

The demo uses deterministic synthetic bars only and writes `quant/runtime/state.json`, which the dashboard reads.

## Futu OpenD paper-data check

Install and log in to Futu OpenD manually, then install the optional SDK:

```bash
python3 -m pip install -r quant/requirements-futu.txt
PYTHONPATH=quant python3 -m quant_trader futu-paper-check
```

`futu-paper-check` reads historical bars and evaluates the current signal. It never submits an order. The simulation order adapter exists behind two independent locks for a later, explicitly approved stage.

## CSV backtest format

Required columns:

```text
timestamp,open,high,low,close,volume
2026-01-05T09:30:00,20.0,20.2,19.9,20.1,100000
```

Prices are treated as USD and normalized to HKD using `fx_rates.USDHKD` from `config.json`.
