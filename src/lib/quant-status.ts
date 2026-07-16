import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export type QuantRuntimeResult = {
  initial_capital_hkd?: number;
  final_equity_hkd?: number;
  total_return_pct?: number;
  max_drawdown_pct?: number;
  sharpe_ratio?: number;
  completed_trades?: number;
  win_rate_pct?: number;
  risk_lock_reason?: string | null;
};

export type QuantDashboardStatus = {
  configured: boolean;
  runtimeStatus: string;
  source: string | null;
  initialCapitalHkd: number;
  mode: string;
  symbol: string;
  timeframe: string;
  strategyName: string;
  risk: {
    riskPerTradePct: number;
    maxPositionPct: number;
    maxGrossExposurePct: number;
    maxDailyLossPct: number;
    maxDrawdownPct: number;
    allowMargin: boolean;
    allowAverageDown: boolean;
  };
  execution: {
    simulatedOrdersEnabled: boolean;
    liveTradingEnabled: boolean;
  };
  result: QuantRuntimeResult | null;
};

async function readJson(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getQuantDashboardStatus(): Promise<QuantDashboardStatus> {
  const root = process.cwd();
  const config = await readJson(path.join(root, "quant", "config.json"));
  const runtime = await readJson(path.join(root, "quant", "runtime", "state.json"));
  if (!config) {
    throw new Error("quant/config.json is missing or invalid");
  }

  const strategy = config.strategy as Record<string, unknown>;
  const risk = config.risk as Record<string, unknown>;
  const execution = config.execution as Record<string, unknown>;
  const runtimeResult = runtime?.result as Record<string, unknown> | undefined;
  return {
    configured: true,
    runtimeStatus: String(runtime?.status ?? "configured_not_started"),
    source: runtime?.source ? String(runtime.source) : null,
    initialCapitalHkd: Number(config.initial_capital_hkd),
    mode: String(config.mode),
    symbol: String(strategy.execution_symbol),
    timeframe: String(strategy.timeframe),
    strategyName: String(strategy.name),
    risk: {
      riskPerTradePct: Number(risk.risk_per_trade_pct),
      maxPositionPct: Number(risk.max_position_pct),
      maxGrossExposurePct: Number(risk.max_gross_exposure_pct),
      maxDailyLossPct: Number(risk.max_daily_loss_pct),
      maxDrawdownPct: Number(risk.max_drawdown_pct),
      allowMargin: Boolean(risk.allow_margin),
      allowAverageDown: Boolean(risk.allow_average_down),
    },
    execution: {
      simulatedOrdersEnabled: Boolean(execution.simulated_order_submission_enabled),
      liveTradingEnabled: Boolean(execution.live_trading_enabled),
    },
    result: runtimeResult ? {
      initial_capital_hkd: Number(runtimeResult.initial_capital_hkd),
      final_equity_hkd: Number(runtimeResult.final_equity_hkd),
      total_return_pct: Number(runtimeResult.total_return_pct),
      max_drawdown_pct: Number(runtimeResult.max_drawdown_pct),
      sharpe_ratio: Number(runtimeResult.sharpe_ratio),
      completed_trades: Number(runtimeResult.completed_trades),
      win_rate_pct: Number(runtimeResult.win_rate_pct),
      risk_lock_reason: runtimeResult.risk_lock_reason ? String(runtimeResult.risk_lock_reason) : null,
    } : null,
  };
}
