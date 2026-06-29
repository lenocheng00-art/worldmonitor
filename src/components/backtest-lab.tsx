"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookmarkPlus,
  CheckCircle2,
  FlaskConical,
  History,
  Play,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/research-ui";
import {
  initialDecisionLoopState,
  type BacktestResult,
  type BacktestStrategy,
  type EquityPoint,
} from "@/lib/decision-loop-data";
import { useDecisionLoop } from "@/lib/decision-loop-store";
import { cn } from "@/lib/utils";

export function BacktestLab() {
  const searchParams = useSearchParams();
  const { state, runBacktest: saveBacktest, addToWatchlist } = useDecisionLoop();
  const mockStrategies = state.backtestStrategies.length ? state.backtestStrategies : initialDecisionLoopState.backtestStrategies;
  const requestedStrategy = searchParams.get("strategy");
  const requestedResult = searchParams.get("result");
  const preset = requestedStrategy === "nfp-shock"
    ? mockStrategies[0]
    : requestedStrategy === "alan-signal"
      ? mockStrategies[2]
      : mockStrategies[1];
  const [strategy, setStrategy] = useState<BacktestStrategy>({
    ...preset,
    linkedLogicChainId: searchParams.get("logic") ?? preset.linkedLogicChainId,
  });
  const results = state.backtestResults;
  const [selectedResultId, setSelectedResultId] = useState(requestedResult ?? results[0]?.id ?? "");
  const [running, setRunning] = useState(false);

  const selectedResult = useMemo(
    () => results.find((result) => result.id === selectedResultId) ?? results[0],
    [results, selectedResultId],
  );
  const selectedStrategy = state.backtestStrategies.find((item) => item.id === selectedResult?.strategyId);

  useEffect(() => {
    if (requestedResult) setSelectedResultId(requestedResult);
  }, [requestedResult]);

  useEffect(() => {
    if (selectedStrategy) setStrategy({ ...selectedStrategy });
  }, [selectedStrategy]);

  function loadPreset(next: BacktestStrategy) {
    setStrategy({ ...next });
  }

  function runBacktest() {
    setRunning(true);
    window.setTimeout(() => {
      const result = saveBacktest(strategy, {
        signalId: strategy.triggerSignalId,
        logicChainId: strategy.linkedLogicChainId,
        committeeReportId: searchParams.get("committee") ?? undefined,
      });
      setSelectedResultId(result.id);
      setRunning(false);
    }, 450);
  }

  if (!selectedResult) return null;

  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[0.82fr_1fr_0.72fr]">
        <StrategyBuilder
          strategy={strategy}
          setStrategy={setStrategy}
          running={running}
          runBacktest={runBacktest}
          loadPreset={loadPreset}
          presets={mockStrategies.slice(0, 3)}
        />
        <ResultSummary result={selectedResult} name={selectedStrategy?.name ?? "Custom strategy run"} />
        <DecisionSummary
          result={selectedResult}
          onCommittee={() => window.location.assign(`/committee?report=${selectedResult.linkedCommitteeReportId ?? ""}`)}
          onWatchlist={() => strategy.tickers.forEach((ticker) => addToWatchlist(ticker, selectedResult.id, selectedResult.linkedSignalId))}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" />
              Equity Curve
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <LineChart points={selectedResult.equityCurve} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowDownRight className="size-4 text-red-600" />
              Drawdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <DrawdownChart points={selectedResult.drawdownCurve} />
          </CardContent>
        </Card>
      </section>

      <section id="trade-log" className="scroll-mt-24 space-y-4">
        <SectionHeader
          icon={History}
          title="Trade Log"
          description="Event-level entries, exits, returns, and rule-level explanations."
          action={<Badge variant="outline">{selectedResult.tradeLog.length} sample trades</Badge>}
        />
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">Exit</th>
                  <th className="px-4 py-3">Prices</th>
                  <th className="px-4 py-3">Return</th>
                  <th className="px-4 py-3">Rule / reason</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedResult.tradeLog.map((trade) => (
                  <tr key={trade.id}>
                    <td className="px-4 py-3 font-semibold">{trade.ticker}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{trade.side}</Badge></td>
                    <td className="px-4 py-3">{trade.entryDate}</td>
                    <td className="px-4 py-3">{trade.exitDate}</td>
                    <td className="px-4 py-3">{trade.entryPrice} → {trade.exitPrice}</td>
                    <td className={cn("px-4 py-3 font-semibold", trade.return.startsWith("+") ? "text-emerald-700" : "text-red-700")}>
                      {trade.return}
                    </td>
                    <td className="max-w-sm px-4 py-3 text-muted-foreground">{trade.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={BarChart3}
          title="Backtest Run History"
          description="Reproducible result cards are retained for committee comparison."
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => setSelectedResultId(result.id)}
              className={cn(
                "rounded-lg border bg-card p-4 text-left transition hover:border-primary/50",
                result.id === selectedResult.id && "border-primary ring-1 ring-primary",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{state.backtestStrategies.find((item) => item.id === result.strategyId)?.name ?? "Custom strategy run"}</span>
                <span className="text-sm font-semibold text-emerald-700">+{result.totalReturn}%</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Metric label="Sharpe" value={result.sharpeRatio.toFixed(2)} />
                <Metric label="Max DD" value={`${result.maxDrawdown}%`} />
                <Metric label="Trades" value={String(result.tradeCount)} />
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function StrategyBuilder({
  strategy,
  setStrategy,
  running,
  runBacktest,
  loadPreset,
  presets,
}: {
  strategy: BacktestStrategy;
  setStrategy: React.Dispatch<React.SetStateAction<BacktestStrategy>>;
  running: boolean;
  runBacktest: () => void;
  loadPreset: (strategy: BacktestStrategy) => void;
  presets: BacktestStrategy[];
}) {
  return (
    <Card className="h-fit">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="size-4 text-primary" />
          Strategy Definition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {presets.map((preset) => (
            <Button key={preset.id} variant={strategy.id === preset.id ? "default" : "outline"} size="sm" className="shrink-0" onClick={() => loadPreset(preset)}>
              {preset.id === "strategy-nfp-shock" ? "NFP Shock" : preset.id === "strategy-ai-capex" ? "AI Capex" : "Alan Signal"}
            </Button>
          ))}
        </div>
        <FormInput label="Strategy Name" value={strategy.name} onChange={(value) => setStrategy((current) => ({ ...current, name: value }))} />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormInput label="Tickers" value={strategy.tickers.join(", ")} onChange={(value) => setStrategy((current) => ({ ...current, tickers: splitList(value) }))} />
          <FormInput label="Benchmark" value={strategy.benchmark} onChange={(value) => setStrategy((current) => ({ ...current, benchmark: value }))} />
          <FormInput label="Start Date" type="date" value={strategy.startDate} onChange={(value) => setStrategy((current) => ({ ...current, startDate: value }))} />
          <FormInput label="End Date" type="date" value={strategy.endDate} onChange={(value) => setStrategy((current) => ({ ...current, endDate: value }))} />
        </div>
        <FormTextarea label="Entry Rule" value={strategy.entryRules.join("\n")} onChange={(value) => setStrategy((current) => ({ ...current, entryRules: splitLines(value) }))} />
        <FormTextarea label="Exit Rule" value={strategy.exitRules.join("\n")} onChange={(value) => setStrategy((current) => ({ ...current, exitRules: splitLines(value) }))} />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormInput label="Position Size" value={strategy.positionSize} onChange={(value) => setStrategy((current) => ({ ...current, positionSize: value }))} />
          <FormInput label="Rebalance" value={strategy.rebalanceFrequency} onChange={(value) => setStrategy((current) => ({ ...current, rebalanceFrequency: value }))} />
          <FormInput label="Stop Loss" value={strategy.stopLoss} onChange={(value) => setStrategy((current) => ({ ...current, stopLoss: value }))} />
          <FormInput label="Take Profit" value={strategy.takeProfit} onChange={(value) => setStrategy((current) => ({ ...current, takeProfit: value }))} />
          <FormInput label="Signal Source" value={strategy.signalSource} onChange={(value) => setStrategy((current) => ({ ...current, signalSource: value }))} />
          <FormInput label="Linked Signal" value={strategy.triggerSignalId ?? ""} onChange={(value) => setStrategy((current) => ({ ...current, triggerSignalId: value }))} />
          <FormInput label="Logic Chain" value={strategy.linkedLogicChainId ?? ""} onChange={(value) => setStrategy((current) => ({ ...current, linkedLogicChainId: value }))} />
        </div>
        <Button className="w-full" onClick={runBacktest} disabled={running}>
          <Play className="size-4" />
          {running ? "Running simulation..." : "Run mock backtest"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ResultSummary({ result, name }: { result: BacktestResult; name: string }) {
  const excess = result.totalReturn - result.benchmarkReturn;
  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="border-b bg-primary text-primary-foreground">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase text-primary-foreground/70">Backtest Result</div>
            <CardTitle className="mt-2 text-2xl text-primary-foreground">{name}</CardTitle>
          </div>
          <Badge className="bg-white text-primary hover:bg-white">Mock engine</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <ResultMetric label="Total Return" value={`+${result.totalReturn}%`} tone="positive" />
          <ResultMetric label="Annualized" value={`+${result.annualizedReturn}%`} tone="positive" />
          <ResultMetric label="Max Drawdown" value={`${result.maxDrawdown}%`} tone="negative" />
          <ResultMetric label="Sharpe Ratio" value={result.sharpeRatio.toFixed(2)} tone="neutral" />
          <ResultMetric label="Win Rate" value={`${result.winRate}%`} tone="neutral" />
          <ResultMetric label="Trades" value={String(result.tradeCount)} tone="neutral" />
          <ResultMetric label="Avg Holding" value={result.avgHoldingPeriod} tone="neutral" />
          <ResultMetric label="Benchmark" value={`+${result.benchmarkReturn}%`} tone="neutral" />
        </div>
        <div className="grid gap-4 border-y py-5 sm:grid-cols-2">
          <Metric label="Excess return" value={`${excess > 0 ? "+" : ""}${excess.toFixed(1)}%`} />
          <Metric label="Benchmark comparison" value={`${result.totalReturn > result.benchmarkReturn ? "Outperformed" : "Underperformed"} by ${Math.abs(excess).toFixed(1)}%`} />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground">Conclusion</div>
          <p className="mt-1 text-sm leading-6">{result.conclusion}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionSummary({ result, onCommittee, onWatchlist }: {
  result: BacktestResult;
  onCommittee: () => void;
  onWatchlist: () => void;
}) {
  const validates = result.sharpeRatio >= 1 && result.totalReturn > result.benchmarkReturn;
  return (
    <Card className="h-fit xl:sticky xl:top-24">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="size-4 text-primary" /> Decision Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div><div className="text-xs font-semibold uppercase text-muted-foreground">Does this validate the thesis?</div><Badge className="mt-2" variant={validates ? "secondary" : "destructive"}>{validates ? "Yes - conditional validation" : "No - thesis not validated"}</Badge></div>
        <Metric label="Best Trade" value={result.bestTrade} />
        <Metric label="Worst Trade" value={result.worstTrade} />
        <div><div className="text-xs font-semibold uppercase text-muted-foreground">Main Risk</div><p className="mt-1 text-sm leading-6">{result.mainRisk}</p></div>
        <div className="border-y py-4"><div className="text-xs font-semibold uppercase text-muted-foreground">Decision Implication</div><p className="mt-1 text-sm leading-6">{result.decisionImplication}</p></div>
        <Button className="w-full" variant="outline" onClick={onCommittee}>Send result back to Committee</Button>
        <Button className="w-full" variant="outline" onClick={onWatchlist}><BookmarkPlus className="size-4" /> Add to Watchlist</Button>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div>Signal: {result.linkedSignalId ?? "Not linked"}</div>
          <div>Logic: {result.linkedLogicChainId ?? "Not linked"}</div>
          <div>Committee: {result.linkedCommitteeReportId ?? "Not linked"}</div>
          <div>Portfolio Assets: {(result.related_asset_ids ?? []).join(", ") || "Not linked"}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function LineChart({ points }: { points: EquityPoint[] }) {
  const width = 720;
  const height = 260;
  const padding = 28;
  const allValues = points.flatMap((point) => [point.strategy, point.benchmark]);
  const min = Math.min(...allValues) - 8;
  const max = Math.max(...allValues) + 8;
  const coordinates = (key: "strategy" | "benchmark") =>
    points.map((point, index) => {
      const x = padding + (index / (points.length - 1)) * (width - padding * 2);
      const y = height - padding - ((point[key] - min) / (max - min)) * (height - padding * 2);
      return `${x},${y}`;
    }).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="aspect-[2.75/1] w-full" role="img" aria-label="Strategy and benchmark equity curves">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1={padding} x2={width - padding} y1={height * ratio} y2={height * ratio} stroke="hsl(var(--border))" strokeWidth="1" />
        ))}
        <polyline points={coordinates("benchmark")} fill="none" stroke="#94a3b8" strokeWidth="3" />
        <polyline points={coordinates("strategy")} fill="none" stroke="#1d4ed8" strokeWidth="4" />
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{points[0].label}</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-700" /> Strategy</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-400" /> Benchmark</span>
        </div>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

function DrawdownChart({ points }: { points: Array<{ label: string; value: number }> }) {
  const width = 720;
  const height = 260;
  const padding = 28;
  const min = Math.min(...points.map((point) => point.value), -1);
  const coordinates = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = padding + (Math.abs(point.value) / Math.abs(min)) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  const area = `${padding},${padding} ${coordinates} ${width - padding},${padding}`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="aspect-[2.75/1] w-full" role="img" aria-label="Strategy drawdown curve">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1={padding} x2={width - padding} y1={height * ratio} y2={height * ratio} stroke="hsl(var(--border))" strokeWidth="1" />
        ))}
        <polygon points={area} fill="#fee2e2" />
        <polyline points={coordinates} fill="none" stroke="#dc2626" strokeWidth="4" />
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{points[0].label}</span>
        <span>Maximum drawdown {min}%</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}

function ResultMetric({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" | "neutral" }) {
  const Icon = tone === "positive" ? ArrowUpRight : tone === "negative" ? ArrowDownRight : Trophy;
  const className = tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-700" : "text-primary";
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label}
        <Icon className={cn("size-3.5", className)} />
      </div>
      <div className={cn("mt-2 text-xl font-semibold", className)}>{value}</div>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

function FormTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full resize-y rounded-md border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function splitLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}
