from __future__ import annotations

import argparse
import json
from pathlib import Path

from .backtest import BacktestEngine
from .config import load_config
from .data import generate_demo_bars, load_csv
from .futu_adapter import FutuPaperAdapter
from .state import write_state
from .strategy import TrendBreakoutStrategy


def _print_backtest_summary(path: Path, payload: dict[str, object]) -> None:
    result = payload["result"]
    assert isinstance(result, dict)
    print(json.dumps({
        "state_file": str(path),
        "status": payload["status"],
        "source": payload["source"],
        "summary": {
            "initial_equity_hkd": result["initial_capital_hkd"],
            "final_equity_hkd": result["final_equity_hkd"],
            "total_return_pct": result["total_return_pct"],
            "max_drawdown_pct": result["max_drawdown_pct"],
            "completed_trades": result["completed_trades"],
        },
    }, indent=2))


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="WorldMonitor simulation-first quant engine")
    parser.add_argument("--config", default=str(Path(__file__).resolve().parents[1] / "config.json"))
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("validate", help="validate configuration and safety locks")
    demo = subparsers.add_parser("demo-backtest", help="run a deterministic smoke-test backtest")
    demo.add_argument("--bars", type=int, default=600)
    csv_test = subparsers.add_parser("backtest-csv", help="backtest a timestamp/open/high/low/close/volume CSV")
    csv_test.add_argument("path")
    subparsers.add_parser("futu-paper-check", help="fetch Futu bars and evaluate the latest signal without ordering")
    return parser


def main() -> int:
    args = _parser().parse_args()
    config = load_config(args.config)

    if args.command == "validate":
        print(json.dumps({
            "status": "ok",
            "mode": config.mode,
            "initial_capital_hkd": config.initial_capital_hkd,
            "live_trading_enabled": config.execution.live_trading_enabled,
        }, indent=2))
        return 0

    if args.command == "demo-backtest":
        result = BacktestEngine(config).run(generate_demo_bars(args.bars))
        payload = {"status": "demo_complete", "source": "synthetic", "result": result.to_dict()}
        path = write_state(payload)
        _print_backtest_summary(path, payload)
        return 0

    if args.command == "backtest-csv":
        result = BacktestEngine(config).run(load_csv(args.path))
        payload = {"status": "backtest_complete", "source": str(args.path), "result": result.to_dict()}
        path = write_state(payload)
        _print_backtest_summary(path, payload)
        return 0

    if args.command == "futu-paper-check":
        bars = FutuPaperAdapter(config).fetch_recent_bars(config.strategy.execution_symbol)
        strategy = TrendBreakoutStrategy(config.strategy)
        signal = None
        for bar in bars:
            signal = strategy.on_bar(bar, 0)
        payload = {
            "status": "paper_check_complete",
            "mode": config.mode,
            "symbol": config.strategy.execution_symbol,
            "bars": len(bars),
            "latest_signal": signal.action.value if signal else "NO_DATA",
            "reason": signal.reason if signal else "No bars returned",
        }
        path = write_state(payload)
        print(json.dumps({"state_file": str(path), **payload}, indent=2))
        return 0

    return 1
