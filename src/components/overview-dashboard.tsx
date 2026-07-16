"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Eye,
  GitBranch,
  Inbox,
  RadioTower,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LogicChain, Signal } from "@/lib/decision-loop-data";
import { useDecisionLoop } from "@/lib/decision-loop-store";

export function OverviewDashboard() {
  const { state } = useDecisionLoop();
  const { signals, logicChains, committeeReports, watchlist } = state;
  const now = new Date();
  const todaySignals = signals.filter((signal) => isSameDay(signal.createdAt, now));
  const attentionSignals = signals
    .map((signal) => ({ signal, reasons: attentionReasons(signal, logicChains, now) }))
    .filter((item) => item.reasons.length)
    .sort((a, b) => b.signal.priorityScore - a.signal.priorityScore)
    .slice(0, 6);
  const activeChains = logicChains
    .filter((chain) => chain.validationStatus !== "Broken")
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 5);
  const committeeQueue = logicChains
    .filter((chain) => !chain.linkedCommitteeReportId)
    .flatMap((chain) => {
      const signal = signals.find((item) => item.id === chain.triggerSignalId);
      return chain.affectedAssets.map((ticker) => ({
        id: `${chain.id}-${ticker}`,
        ticker,
        signal,
        chain,
        priority: signal?.priorityScore ?? chain.confidenceScore,
      }));
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
  const recentWatchlist = [...watchlist]
    .sort((a, b) => new Date(b.updatedAt ?? b.addedAt).getTime() - new Date(a.updatedAt ?? a.addedAt).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/20">
        <CardHeader className="border-b bg-primary text-primary-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg text-primary-foreground">
              <RadioTower className="size-5" /> Today&apos;s Signals
            </CardTitle>
            <Button asChild variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link href="/signal-inbox">Open inbox <ArrowRight className="size-4" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-px bg-border p-0 sm:grid-cols-2 xl:grid-cols-4">
          <SignalMetric label="New today" value={todaySignals.length} icon={Inbox} />
          <SignalMetric label="High priority" value={todaySignals.filter((signal) => signal.priorityScore >= 80).length} icon={AlertTriangle} />
          <SignalMetric label="Awaiting action" value={todaySignals.filter((signal) => signal.status === "NEW").length} icon={CalendarClock} />
          <SignalMetric label="Logic Chain created" value={todaySignals.filter((signal) => signal.linkedLogicChainId).length} icon={GitBranch} />
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /> Signals Requiring Attention</CardTitle>
              <Badge variant="outline">{attentionSignals.length} shown</Badge>
            </div>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {attentionSignals.length ? attentionSignals.map(({ signal, reasons }) => (
              <Link key={signal.id} href={`/signal-inbox?ticker=${signal.relatedTickers[0] ?? ""}`} className="block px-5 py-4 transition hover:bg-muted/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{signal.title}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {reasons.map((reason) => <Badge key={reason} variant={reason === "High priority" ? "destructive" : "outline"}>{reason}</Badge>)}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-primary">{signal.priorityScore}</span>
                </div>
              </Link>
            )) : <EmptyRow text="No signals currently require attention." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><GitBranch className="size-4 text-primary" /> Active Logic Chains</CardTitle>
              <Button asChild variant="ghost" size="sm"><Link href="/logic-chains">View all <ArrowRight className="size-4" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {activeChains.length ? activeChains.map((chain) => {
              const signal = signals.find((item) => item.id === chain.triggerSignalId);
              const latestTimeline = chain.timeline[chain.timeline.length - 1];
              const latestEvidence = chain.evidenceFor[chain.evidenceFor.length - 1];
              return (
                <Link key={chain.id} href={`/logic-chains?focus=${chain.id}`} className="block px-5 py-4 transition hover:bg-muted/40">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{chain.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Trigger: {signal?.title ?? chain.triggerEvent}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <Badge variant="outline">{chain.validationStatus}</Badge>
                      <Badge variant={chain.confidenceScore >= 50 ? "secondary" : "destructive"}>{chain.confidenceScore >= 50 ? "Bull" : "Bear"}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div><span className="text-muted-foreground">Latest validation · </span>{latestTimeline?.analysis_summary ?? latestEvidence ?? "Awaiting evidence"}</div>
                    <div><span className="text-muted-foreground">Next update · </span>{signal?.next_track_at ? formatDate(signal.next_track_at) : chain.nextDataPoint}</div>
                  </div>
                </Link>
              );
            }) : <EmptyRow text="Promote a Signal to create the first Logic Chain." />}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><Users className="size-4 text-primary" /> Committee Queue</CardTitle>
              <Button asChild variant="ghost" size="sm"><Link href="/committee">Open Committee <ArrowRight className="size-4" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>{["Ticker", "Source Signal", "Logic Chain", "Priority", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {committeeQueue.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-semibold text-primary">{item.ticker}</td>
                      <td className="max-w-56 truncate px-4 py-3">{item.signal?.title ?? "Linked signal unavailable"}</td>
                      <td className="max-w-56 truncate px-4 py-3">{item.chain.title}</td>
                      <td className="px-4 py-3 font-semibold">{item.priority}</td>
                      <td className="px-4 py-3"><Badge variant="outline">READY</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!committeeQueue.length ? <EmptyRow text="All active Logic Chains have a Committee case." /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2"><Eye className="size-4 text-primary" /> Watchlist Changes</CardTitle>
              <Button asChild variant="ghost" size="sm"><Link href="/watchlist">View Watchlist <ArrowRight className="size-4" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {recentWatchlist.length ? recentWatchlist.map((item) => {
              const report = committeeReports.find((candidate) => candidate.id === item.sourceObjectId);
              return (
                <div key={item.ticker} className="flex items-center gap-3 px-5 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-primary">{item.ticker.slice(0, 2)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{item.ticker}</span>
                      <Badge variant="outline">{item.changeType ?? "Added"}</Badge>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{report?.topic ?? item.suggestedAction}</div>
                  </div>
                  <Badge variant={item.committeeView === "APPROVE" ? "secondary" : "outline"}>{item.committeeView}</Badge>
                </div>
              );
            }) : <EmptyRow text="Approved Committee ideas will appear here." />}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SignalMetric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Inbox }) {
  return (
    <div className="flex items-center gap-4 bg-card px-5 py-5">
      <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="size-5" /></div>
      <div><div className="text-2xl font-semibold">{value}</div><div className="text-xs font-medium text-muted-foreground">{label}</div></div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground"><CheckCircle2 className="size-4" />{text}</div>;
}

function attentionReasons(signal: Signal, logicChains: LogicChain[], now: Date) {
  const reasons: string[] = [];
  const chain = logicChains.find((item) => item.id === signal.linkedLogicChainId);
  if (signal.status === "NEW") reasons.push("New");
  if (signal.status === "TRACKING") reasons.push("Tracking");
  if (!signal.linkedLogicChainId) reasons.push("Missing logic chain");
  if (chain && !chain.followUpIndicators.length) reasons.push("Missing monitoring metrics");
  if (isStale(signal, now)) reasons.push("Update overdue");
  if (signal.priorityScore >= 80) reasons.push("High priority");
  return reasons;
}

function isStale(signal: Signal, now: Date) {
  if (signal.next_track_at) return new Date(signal.next_track_at).getTime() < now.getTime();
  const age = now.getTime() - new Date(signal.updatedAt).getTime();
  const staleAfterDays = signal.tracking_frequency === "daily" ? 1 : signal.tracking_frequency === "every_2_days" ? 2 : signal.tracking_frequency === "weekly" ? 7 : 30;
  return age > staleAfterDays * 86_400_000;
}

function isSameDay(value: string, day: Date) {
  const date = new Date(value);
  return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
