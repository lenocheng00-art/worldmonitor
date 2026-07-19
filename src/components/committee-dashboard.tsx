"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookmarkPlus,
  BrainCircuit,
  FlaskConical,
  Loader2,
  Scale,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfidenceBar } from "@/components/research-ui";
import { CommitteeResearchPanel } from "@/components/research/research-tracking-panels";
import {
  initialDecisionLoopState,
  type AgentVote,
  type CommitteeDecision,
  type CommitteeReport,
} from "@/lib/decision-loop-data";
import { useDecisionLoop } from "@/lib/decision-loop-store";
import { cn } from "@/lib/utils";

const decisions: CommitteeDecision[] = ["WATCH", "RESEARCH_MORE", "REJECT", "APPROVE"];

export function CommitteeDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    state,
    ready,
    sendSignalToCommittee,
    sendLogicChainToCommittee,
    updateCommitteeReport,
    runBacktest,
    addToWatchlist,
  } = useDecisionLoop();
  const requestedReport = searchParams.get("report");
  const [selectedId, setSelectedId] = useState(requestedReport ?? state.committeeReports[0]?.id ?? "");
  const [selectedResearchChainId, setSelectedResearchChainId] = useState("");
  const [running, setRunning] = useState(false);
  const selected = state.committeeReports.find((report) => report.id === selectedId) ?? state.committeeReports[0];

  useEffect(() => {
    if (requestedReport) setSelectedId(requestedReport);
  }, [requestedReport]);

  const pending = useMemo(() => [
    ...state.logicChains
      .filter((chain) => !chain.linkedCommitteeReportId)
      .map((chain) => ({ id: chain.id, type: "Logic Chain", title: chain.title, score: chain.confidenceScore })),
  ], [state.logicChains]);

  function reviewOpportunity(id: string, type: string) {
    if (type === "Logic Chain") setSelectedResearchChainId(id);
    setRunning(true);
    window.setTimeout(() => {
      const report = type === "Logic Chain" ? sendLogicChainToCommittee(id) : sendSignalToCommittee(id);
      if (report) setSelectedId(report.id);
      setRunning(false);
    }, 350);
  }

  const activeResearchChainId = selected?.linkedLogicChainId ?? selectedResearchChainId ?? pending[0]?.id;

  function runLinkedBacktest(report: CommitteeReport) {
    const signal = state.signals.find((item) => item.id === report.triggerSignalId);
    const strategy = {
      ...initialDecisionLoopState.backtestStrategies[1],
      id: `strategy-${Date.now()}`,
      name: `${report.topic} committee validation`,
      triggerSignalId: report.triggerSignalId,
      linkedLogicChainId: report.linkedLogicChainId,
      tickers: report.relatedTickers,
    };
    const result = runBacktest(strategy, {
      signalId: report.triggerSignalId,
      logicChainId: report.linkedLogicChainId,
      committeeReportId: report.id,
    });
    if (signal) updateCommitteeReport(report.id, { linkedBacktestId: result.id });
    router.push(`/backtest-lab?result=${result.id}`);
  }

  if (!ready) {
    return <Card><CardContent className="flex min-h-96 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" /> Restoring committee workspace</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.25fr_0.85fr]">
        <Card className="h-fit overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="size-4 text-primary" /> Committee Queue</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {pending.length ? pending.map((item) => (
              <button key={`${item.type}-${item.id}`} onClick={() => reviewOpportunity(item.id, item.type)} className="w-full px-4 py-4 text-left transition hover:bg-muted/50" disabled={running}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold leading-5">{item.title}</span>
                  <span className="text-xs font-semibold text-primary">{item.score}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant="outline">{item.type}</Badge>
                  <span className="text-xs text-muted-foreground">Review</span>
                </div>
              </button>
            )) : (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">No pending opportunities. New signals will appear here.</div>
            )}
            {running ? <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Six agents are deliberating</div> : null}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4 text-primary" /> Agent Debate</CardTitle>
              {selected ? <Badge variant="outline">{selected.agentVotes.length} agents</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {selected ? selected.agentVotes.map((vote) => <AgentRow key={vote.agentName} vote={vote} />) : <EmptyCommittee />}
            {activeResearchChainId ? <CommitteeResearchPanel logicChainId={activeResearchChainId} /> : null}
          </CardContent>
        </Card>

        {selected ? (
          <DecisionTicket
            report={selected}
            onChange={(patch) => updateCommitteeReport(selected.id, patch)}
            onBacktest={() => runLinkedBacktest(selected)}
            onWatchlist={() => selected.relatedTickers.forEach((ticker) => addToWatchlist(ticker, selected.id, selected.triggerSignalId))}
          />
        ) : (
          <Card className="h-fit"><CardContent className="py-12 text-center text-sm text-muted-foreground">Select an opportunity to create a decision ticket.</CardContent></Card>
        )}
      </section>

      <section>
        <div className="mb-3 text-sm font-semibold">Committee History</div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {state.committeeReports.map((report) => (
            <button
              key={report.id}
              onClick={() => setSelectedId(report.id)}
              className={cn("min-w-72 rounded-md border bg-card p-4 text-left", selected?.id === report.id && "border-primary ring-1 ring-primary")}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="line-clamp-2 text-sm font-semibold">{report.topic}</span>
                <Badge variant="outline">{report.finalDecision}</Badge>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{report.finalConfidenceScore}/100 confidence · {report.relatedTickers.join(", ")}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function AgentRow({ vote }: { vote: AgentVote }) {
  const Icon = vote.view === "Bullish" ? ArrowUpRight : vote.view === "Bearish" ? ArrowDownRight : Scale;
  return (
    <div className="border-b pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{vote.agentName}</div>
        <Badge variant={vote.view === "Bullish" ? "secondary" : vote.view === "Bearish" ? "destructive" : "outline"}>
          <Icon className="mr-1 size-3.5" /> {vote.view} · {vote.confidence}
        </Badge>
      </div>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <AgentField label="Key Reason" value={vote.keyReason} />
        <AgentField label="Key Risk" value={vote.keyRisk} />
        <AgentField label="Suggested Action" value={vote.suggestedAction} />
        <div><Label>Follow-up Data</Label><div className="mt-1 flex flex-wrap gap-1">{vote.followUpData.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}</div></div>
      </div>
    </div>
  );
}

function DecisionTicket({ report, onChange, onBacktest, onWatchlist }: {
  report: CommitteeReport;
  onChange: (patch: Partial<CommitteeReport>) => void;
  onBacktest: () => void;
  onWatchlist: () => void;
}) {
  return (
    <Card className="h-fit xl:sticky xl:top-24">
      <CardHeader className="border-b bg-primary text-primary-foreground">
        <div className="text-xs font-semibold uppercase text-primary-foreground/70">Investment Decision Ticket</div>
        <CardTitle className="mt-2 text-lg text-primary-foreground">{report.topic}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <label className="block"><Label>Final Decision</Label><select value={report.finalDecision} onChange={(event) => onChange({ finalDecision: event.target.value as CommitteeDecision })} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">{decisions.map((decision) => <option key={decision}>{decision}</option>)}</select></label>
        <div><Label>Confidence</Label><div className="mt-2"><ConfidenceBar value={report.finalConfidenceScore} /></div><input type="range" min="0" max="100" value={report.finalConfidenceScore} onChange={(event) => onChange({ finalConfidenceScore: Number(event.target.value) })} className="mt-2 w-full" /></div>
        <TicketInput label="Position Sizing" value={report.positionSizing} onChange={(value) => onChange({ positionSizing: value })} />
        <TicketInput label="Time Horizon" value={report.timeHorizon} onChange={(value) => onChange({ timeHorizon: value })} />
        <TicketInput label="Stop Loss Logic" value={report.stopLossLogic} onChange={(value) => onChange({ stopLossLogic: value })} />
        <TicketInput label="Invalidation Condition" value={report.invalidationCondition} onChange={(value) => onChange({ invalidationCondition: value })} />
        <div><Label>Follow-up Indicators</Label><div className="mt-2 flex flex-wrap gap-1.5">{report.followUpIndicators.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}</div></div>
        {(report.related_asset_ids ?? []).length ? (
          <details className="rounded-md border bg-muted/30 p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">Legacy Metadata</summary>
            <div className="mt-3 flex flex-wrap gap-1.5">{report.related_asset_ids?.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}</div>
          </details>
        ) : null}
        <div className="grid gap-2 border-t pt-4">
          <Button onClick={onBacktest}><FlaskConical className="size-4" /> Run Backtest</Button>
          <Button variant="outline" onClick={onWatchlist} disabled={report.finalDecision !== "APPROVE"}>
            <BookmarkPlus className="size-4" /> Add Approved Tickers to Watchlist
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Watchlist promotion is enabled after APPROVE. Backtest: {report.linkedBacktestId ?? "Waiting to run"}
        </div>
        <CommitteeResearchPanel logicChainId={report.linkedLogicChainId} />
      </CardContent>
    </Card>
  );
}

function TicketInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><Label>{label}</Label><textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-16 w-full resize-y rounded-md border bg-background p-2 text-sm leading-5" /></label>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase text-muted-foreground">{children}</div>;
}
function AgentField({ label, value }: { label: string; value: string }) {
  return <div><Label>{label}</Label><p className="mt-1 leading-5">{value}</p></div>;
}
function EmptyCommittee() {
  return <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center"><Users className="size-7 text-muted-foreground" /><div><div className="font-semibold">No committee report</div><p className="text-sm text-muted-foreground">Select a pending opportunity to convene the agents.</p></div></div>;
}
