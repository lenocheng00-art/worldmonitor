import {
  Activity,
  Ban,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  RadioTower,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuantDashboardStatus } from "@/lib/quant-status";

const currency = new Intl.NumberFormat("en-HK", {
  style: "currency",
  currency: "HKD",
  maximumFractionDigits: 0,
});

const percent = (value: number) => `${(value * 100).toFixed(value < 0.01 ? 1 : 0)}%`;

export function QuantTradingDashboard({ status }: { status: QuantDashboardStatus }) {
  const riskBudget = status.initialCapitalHkd * status.risk.riskPerTradePct;
  const positionBudget = status.initialCapitalHkd * status.risk.maxPositionPct;
  const dailyLossBudget = status.initialCapitalHkd * status.risk.maxDailyLossPct;
  const drawdownBudget = status.initialCapitalHkd * status.risk.maxDrawdownPct;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-emerald-200">
        <CardContent className="flex flex-col gap-5 bg-emerald-50/70 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">Satellite Quant V1</h2>
                <Badge className="bg-emerald-700">{status.mode}</Badge>
                <Badge variant="outline" className="border-red-300 bg-white text-red-700">Live locked</Badge>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                The engine is isolated from the main portfolio and treats HKD 300,000 as its complete bankroll. Reloads, margin, averaging down, and live execution are excluded from the risk model.
              </p>
            </div>
          </div>
          <div className="rounded-lg border bg-white px-5 py-3 text-right">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Initial equity</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{currency.format(status.initialCapitalHkd)}</div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CircleDollarSign} label="Risk per trade" value={currency.format(riskBudget)} detail={percent(status.risk.riskPerTradePct)} />
        <MetricCard icon={Gauge} label="Maximum position" value={currency.format(positionBudget)} detail={percent(status.risk.maxPositionPct)} />
        <MetricCard icon={Ban} label="Daily loss lock" value={currency.format(dailyLossBudget)} detail={percent(status.risk.maxDailyLossPct)} tone="warning" />
        <MetricCard icon={ShieldCheck} label="Drawdown lock" value={currency.format(drawdownBudget)} detail={percent(status.risk.maxDrawdownPct)} tone="warning" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr_0.9fr]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Strategy specification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <Definition label="Strategy" value={status.strategyName} />
            <Definition label="Execution symbol" value={status.symbol} />
            <Definition label="Timeframe" value={status.timeframe} />
            <Definition label="Entry" value="EMA-aligned 20-bar breakout" />
            <Definition label="Exit" value="ATR stop / take-profit / fast EMA / 15:50 flat" />
            <Definition label="Gross exposure ceiling" value={percent(status.risk.maxGrossExposurePct)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2"><Bot className="size-4 text-primary" /> Safety gates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            <Gate ok={!status.risk.allowMargin} label="Margin disabled" />
            <Gate ok={!status.risk.allowAverageDown} label="Averaging down disabled" />
            <Gate ok={!status.execution.liveTradingEnabled} label="Live trading disabled" />
            <Gate ok={!status.execution.simulatedOrdersEnabled} label="Paper order submission still locked" />
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Paper orders require both a configuration change and a local environment acknowledgement. The dashboard has no order button.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2"><RadioTower className="size-4 text-primary" /> Runtime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <Definition label="Status" value={humanize(status.runtimeStatus)} />
            <Definition label="Data source" value={status.source ?? "Not run yet"} />
            {status.result ? (
              <>
                <Definition label="Final equity" value={currency.format(status.result.final_equity_hkd ?? 0)} />
                <Definition label="Return" value={`${(status.result.total_return_pct ?? 0).toFixed(2)}%`} />
                <Definition label="Max drawdown" value={`${(status.result.max_drawdown_pct ?? 0).toFixed(2)}%`} />
                <Definition label="Completed trades" value={String(status.result.completed_trades ?? 0)} />
              </>
            ) : (
              <p className="rounded-md border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                Run the deterministic demo backtest to create the first runtime snapshot.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2"><Activity className="size-4 text-primary" /> Activation sequence</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 md:grid-cols-4">
          <Step number="01" title="Validate" detail="Run config validation and unit tests." complete />
          <Step number="02" title="Backtest" detail="Load real 5-minute history and inspect drawdown stability." />
          <Step number="03" title="Paper observe" detail="Connect OpenD for market data with no order submission." />
          <Step number="04" title="Paper execute" detail="Enable simulated orders only after a reviewed run." />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = "default" }: {
  icon: typeof Gauge;
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
          <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
          <div className={tone === "warning" ? "mt-1 text-xs font-medium text-red-700" : "mt-1 text-xs text-muted-foreground"}>{detail} of equity</div>
        </div>
        <Icon className={tone === "warning" ? "size-5 text-red-600" : "size-5 text-primary"} />
      </CardContent>
    </Card>
  );
}

function Definition({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"><span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span><span className="max-w-[65%] text-right text-sm font-medium">{value}</span></div>;
}

function Gate({ ok, label }: { ok: boolean; label: string }) {
  return <div className="flex items-center gap-2 text-sm"><CheckCircle2 className={ok ? "size-4 text-emerald-700" : "size-4 text-red-600"} /><span>{label}</span></div>;
}

function Step({ number, title, detail, complete = false }: { number: string; title: string; detail: string; complete?: boolean }) {
  return <div className="rounded-lg border p-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">{number}</span>{complete && <Badge variant="secondary">Ready</Badge>}</div><div className="mt-4 font-semibold">{title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>;
}

function humanize(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
