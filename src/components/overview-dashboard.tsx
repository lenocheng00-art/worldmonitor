"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  FlaskConical,
  GitBranch,
  RadioTower,
  Shield,
  WifiOff,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfidenceBar } from "@/components/research-ui";
import { macroRegime, researchStocks } from "@/lib/research-data";
import { useDecisionLoop } from "@/lib/decision-loop-store";
import { cn } from "@/lib/utils";
import type { FutuAccountSnapshot, FutuAccountView } from "@/lib/futu-account";

export function OverviewDashboard({ futuAccount }: { futuAccount: FutuAccountView }) {
  const { state } = useDecisionLoop();
  const { signals, committeeReports, backtestResults, logicChains, watchlist } = state;
  const topSignals = signals.slice(0, 3);
  const latestDecision = committeeReports[0];
  const bestBacktest = [...backtestResults].sort((a, b) => b.sharpeRatio - a.sharpeRatio)[0];
  const movers = [...researchStocks]
    .sort((a, b) => Math.abs(Number.parseFloat(b.change)) - Math.abs(Number.parseFloat(a.change)))
    .slice(0, 5);

  const pendingReviews = signals.filter((signal) => !signal.linkedCommitteeReportId).length;
  const waitingBacktests = committeeReports.filter((report) => !report.linkedBacktestId).length;
  const actionSignals = signals.filter((signal) => ["New", "Tracking", "Linked"].includes(signal.status)).slice(0, 3);
  const criticalAlerts = futuAccount.alerts.filter((alert) => alert.severity === "CRITICAL" && alert.status === "ACTIVE");

  return (
    <div className="space-y-4">
      {criticalAlerts.length ? (
        <Card className="border-red-300 bg-red-50 text-red-950">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-700" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Critical account alert</div>
              {criticalAlerts.slice(0, 2).map((alert) => (
                <p key={alert.id} className="mt-1 text-sm leading-5">{alert.message}</p>
              ))}
              <p className="mt-2 text-xs text-red-800">Alert only — no order is submitted without the exact typed confirmation phrase.</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card className="overflow-hidden border-primary/20">
        <CardHeader className="border-b bg-primary text-primary-foreground">
          <CardTitle className="flex items-center gap-2 text-lg text-primary-foreground">
            <ArrowUpCircle className="size-5" /> Today&apos;s Decision Brief
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 pt-5 md:grid-cols-2 xl:grid-cols-5">
          <BriefItem label="Research Priorities" value="Validate AI capex breadth and rate sensitivity" href="/logic-chains" />
          <BriefItem label="Signals Requiring Action" value={`${actionSignals.length} high-priority items`} href="/signal-inbox" />
          <BriefItem label="Pending Committee" value={`${pendingReviews} reviews`} href="/committee" />
          <BriefItem label="Backtests Waiting" value={`${waitingBacktests} hypotheses`} href="/backtest-lab" />
          <BriefItem label="Watchlist Actions" value={`${watchlist.length} candidates`} href="/stocks" />
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
      <Card className="hidden md:block xl:col-span-5">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Macro Regime</CardTitle>
            <Badge variant="outline">{macroRegime.stance}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="text-3xl font-semibold">Balanced, rate-sensitive</div>
          <p className="text-sm leading-6 text-muted-foreground">{macroRegime.summary}</p>
          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <OverviewMetric label="Rates" value="Higher for longer" />
            <OverviewMetric label="Liquidity" value="Slightly restrictive" />
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/macro">Open macro dashboard <ArrowRight className="size-4" /></Link>
          </Button>
        </CardContent>
      </Card>

      <FutuAccountRiskCard view={futuAccount} />

      <Card className="xl:col-span-5">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTower className="size-4 text-primary" />
              Top Signals Today
            </CardTitle>
            <Badge variant="outline">{signals.length} tracked</Badge>
          </div>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {topSignals.length ? topSignals.map((signal) => (
            <div key={signal.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{signal.title}</span>
                <Badge variant={["Backtested", "Actioned"].includes(signal.status) ? "secondary" : "outline"}>{signal.status}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{signal.extractedSignal}</p>
            </div>
          )) : (
            <div className="space-y-3 px-5 py-6">
              <div className="text-sm text-muted-foreground">No imported signals yet.</div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm"><Link href="/alan-chan">Import Alan Chan Signal</Link></Button>
                <Button asChild size="sm" variant="outline"><Link href="/signal-inbox">Paste Signal</Link></Button>
                <Button asChild size="sm" variant="outline"><Link href="/signal-inbox">Create Manual Signal</Link></Button>
              </div>
            </div>
          )}
          <div className="px-5 py-4">
            <Button asChild variant="outline" size="sm">
              <Link href="/signal-inbox">Open signal inbox <ArrowRight className="size-4" /></Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="hidden md:block xl:col-span-7">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="size-4 text-primary" />
            Strongest Logic Chains
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          {logicChains.slice(0, 2).map((chain) => (
            <div key={chain.id} className="grid gap-3 border-b pb-5 last:border-0 last:pb-0 sm:grid-cols-[1fr_120px]">
              <div>
                <div className="font-semibold">{chain.title}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {chain.transmissionPath.slice(0, 4).map((step, index) => (
                    <div key={step} className="contents">
                      <span className="rounded-md bg-muted px-2 py-1 text-xs">{step}</span>
                      {index < 3 ? <ArrowRight className="size-3 text-muted-foreground" /> : null}
                    </div>
                  ))}
                </div>
              </div>
              <ConfidenceBar value={chain.confidenceScore} />
            </div>
          ))}
          <Button asChild variant="outline" size="sm"><Link href="/logic-chains">Open logic chains <ArrowRight className="size-4" /></Link></Button>
        </CardContent>
      </Card>

      <Card className="xl:col-span-5">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4 text-primary" />
            Watchlist Movers
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {movers.map((stock) => {
            const positive = stock.change.startsWith("+");
            const Icon = positive ? ArrowUpRight : ArrowDownRight;

            return (
              <div key={stock.ticker} className="flex items-center gap-3 px-5 py-3">
                <div className="w-14 font-semibold">{stock.ticker}</div>
                <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{stock.company}</div>
                <div className="text-sm font-medium">{stock.price}</div>
                <div className={cn("flex w-20 items-center justify-end gap-1 text-sm font-semibold", positive ? "text-emerald-700" : "text-red-700")}>
                  <Icon className="size-3.5" />
                  {stock.change}
                </div>
              </div>
            );
          })}
          <div className="px-5 py-4"><Button asChild variant="outline" size="sm"><Link href="/stocks">Open position candidates <ArrowRight className="size-4" /></Link></Button></div>
        </CardContent>
      </Card>

      {latestDecision ? (
        <Card className="xl:col-span-6">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" />
                Latest Committee Decision
              </CardTitle>
              <Badge variant="outline">{latestDecision.finalDecision}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div>
              <div className="text-xl font-semibold">{latestDecision.topic}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{signals.find((signal) => signal.id === latestDecision.triggerSignalId)?.extractedSignal ?? "Committee-generated research opportunity."}</p>
            </div>
            <div className="grid gap-3 border-y py-4 sm:grid-cols-3">
              <OverviewMetric label="Confidence" value={`${latestDecision.finalConfidenceScore}/100`} />
              <OverviewMetric label="Time horizon" value={latestDecision.timeHorizon} />
              <OverviewMetric label="Tickers" value={latestDecision.relatedTickers.slice(0, 3).join(", ")} />
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/committee">Review committee report <ArrowRight className="size-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {bestBacktest ? (
        <Card className="xl:col-span-6">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="size-4 text-primary" />
                Best Backtest Result
              </CardTitle>
              <Badge variant="secondary">Sharpe {bestBacktest.sharpeRatio.toFixed(2)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <OverviewMetric label="Total return" value={`+${bestBacktest.totalReturn}%`} />
              <OverviewMetric label="Annualized" value={`+${bestBacktest.annualizedReturn}%`} />
              <OverviewMetric label="Max drawdown" value={`${bestBacktest.maxDrawdown}%`} />
              <OverviewMetric label="Win rate" value={`${bestBacktest.winRate}%`} />
            </div>
            <p className="border-t pt-4 text-sm leading-6 text-muted-foreground">{bestBacktest.conclusion}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/backtest-lab">Open backtest lab <ArrowRight className="size-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      </section>
    </div>
  );
}

function BriefItem({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="group block border-l-2 border-primary pl-3">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold leading-5 group-hover:text-primary">{value}</div>
    </Link>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function FutuAccountRiskCard({ view }: { view: FutuAccountView }) {
  const snapshot = view.snapshot;
  const ram = snapshot?.positions.find((position) => position.code === "US.RAM" || position.code.endsWith(".RAM"));
  const largest = snapshot?.positions.reduce<FutuAccountSnapshot["positions"][number] | null>((current, position) => {
    if (!current) return position;
    return (position.portfolioWeight ?? -1) > (current.portfolioWeight ?? -1) ? position : current;
  }, null);
  const critical = view.alerts.some((alert) => alert.severity === "CRITICAL" && alert.status === "ACTIVE");
  const stateLabel = view.status === "connected" ? (critical ? "Critical" : "Connected") : "Disconnected / Stale";

  return (
    <Card className={cn("xl:col-span-7", critical && "border-red-300")}>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {view.status === "connected" ? <Shield className="size-4 text-primary" /> : <WifiOff className="size-4 text-muted-foreground" />}
            Futu Account Risk
          </CardTitle>
          <Badge variant={critical ? "destructive" : "outline"}>{stateLabel}</Badge>
        </div>
      </CardHeader>
      {!snapshot ? (
        <CardContent className="space-y-3 pt-5">
          <div className="text-lg font-semibold">No live account snapshot</div>
          <p className="text-sm leading-6 text-muted-foreground">{view.error ?? "Start the localhost Bridge and Futu OpenD to load account data."}</p>
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            WorldMonitor will not substitute cached or mock values while the Bridge is disconnected.
          </div>
        </CardContent>
      ) : (
        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OverviewMetric label="Total assets" value={formatMoney(snapshot.account.totalAssets, snapshot.account.currency)} />
            <OverviewMetric label="Cash" value={formatMoney(snapshot.account.cash, snapshot.account.currency)} />
            <OverviewMetric label="Securities value" value={formatMoney(snapshot.account.securitiesMarketValue, snapshot.account.currency)} />
            <OverviewMetric label="Largest position" value={largest ? `${largest.code} ${formatPercent(largest.portfolioWeight)}` : "unavailable"} />
          </div>
          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <OverviewMetric label="RAM quantity" value={formatNumber(ram?.quantity)} />
            <OverviewMetric label="RAM average cost" value={formatMoney(ram?.averageCost, ram?.currency ?? snapshot.account.currency)} />
            <OverviewMetric label="RAM diluted cost" value={formatMoney(ram?.dilutedCost, ram?.currency ?? snapshot.account.currency)} />
            <OverviewMetric label="RAM current price" value={formatMoney(ram?.currentPrice, ram?.currency ?? snapshot.account.currency)} />
            <OverviewMetric label="RAM unrealized P&L" value={formatMoney(ram?.unrealizedPnl, ram?.currency ?? snapshot.account.currency)} />
            <OverviewMetric label="RAM account weight" value={formatPercent(ram?.portfolioWeight)} />
            <OverviewMetric label="Quote status" value={ram?.quoteStatus ?? "unavailable"} />
            <OverviewMetric label="OpenD / updated" value={`${snapshot.freshness.openDConnected ? "Connected" : "Disconnected"} · ${formatTimestamp(snapshot.freshness.quotesFetchedAt)}`} />
          </div>
          <p className="text-xs text-muted-foreground">
            Account {snapshot.account.maskedAccountId} · Real account, read through the localhost server only. Average cost and diluted cost are shown separately.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function formatMoney(value: number | null | undefined, currency: string) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unavailable";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unavailable";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unavailable";
  return `${value.toFixed(2)}%`;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unavailable" : date.toLocaleString();
}
