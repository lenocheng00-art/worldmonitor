"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Cloud, GitBranch, Inbox, Link2, Loader2, RadioTower, RefreshCw, SearchCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AutomationBurnInStats, AutomationRunSummary } from "@/lib/automation-types";
import { useDecisionLoop } from "@/lib/decision-loop-store";
import type { ProcessSourceResponse } from "@/lib/research/research-engine";

export function SignalMonitor() {
  const router = useRouter();
  const { state, error, refresh } = useDecisionLoop();
  const [sourceText, setSourceText] = useState("");
  const [extractionBusy, setExtractionBusy] = useState(false);
  const [extractionError, setExtractionError] = useState<string>();
  const [pipelineResult, setPipelineResult] = useState<ProcessSourceResponse>();
  const [automationRun, setAutomationRun] = useState<AutomationRunSummary>();
  const [automationRuns, setAutomationRuns] = useState<AutomationRunSummary[]>([]);
  const [automationStats, setAutomationStats] = useState<AutomationBurnInStats>();
  const [automationBusy, setAutomationBusy] = useState(false);
  const [automationError, setAutomationError] = useState<string>();
  const alanSignals = state.signals.filter((signal) => signal.original_source === "Alan Chan").slice(0, 8);

  const loadAutomationStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/automation/signals", { cache: "no-store" });
      const payload = await response.json() as { run?: AutomationRunSummary; runs?: AutomationRunSummary[]; stats?: AutomationBurnInStats; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Automation status is unavailable.");
      setAutomationRun(payload.run);
      setAutomationRuns(payload.runs ?? []);
      setAutomationStats(payload.stats);
      setAutomationError(undefined);
    } catch (requestError) {
      setAutomationError(requestError instanceof Error ? requestError.message : "Automation status is unavailable.");
    }
  }, []);

  useEffect(() => {
    void loadAutomationStatus();
  }, [loadAutomationStatus]);

  async function runNow() {
    if (automationBusy || automationRun?.status === "Running") return;
    setAutomationBusy(true);
    setAutomationError(undefined);
    try {
      const response = await fetch("/api/automation/signals", {
        method: "POST",
        headers: { "content-type": "application/json", "x-worldmonitor-client": "signal-operations-v1.8" },
        body: JSON.stringify({ mode: "manual" }),
      });
      const payload = await response.json() as { run?: AutomationRunSummary; runs?: AutomationRunSummary[]; stats?: AutomationBurnInStats; error?: string };
      if (!response.ok || !payload.run) throw new Error(payload.error ?? "Automation run failed.");
      setAutomationRun(payload.run);
      setAutomationRuns(payload.runs ?? []);
      setAutomationStats(payload.stats);
    } catch (requestError) {
      setAutomationError(requestError instanceof Error ? requestError.message : "Automation run failed.");
    } finally {
      setAutomationBusy(false);
    }
  }

  async function extractAndSave() {
    if (!sourceText.trim() || extractionBusy) return;
    setExtractionBusy(true);
    setExtractionError(undefined);
    setPipelineResult(undefined);
    try {
      const originalText = sourceText.trim();
      const sourcePostId = await manualSourcePostId(originalText);
      const response = await fetch("/api/research/process-source", {
        method: "POST",
        headers: { "content-type": "application/json", "x-worldmonitor-client": "research-tracking-v2" },
        body: JSON.stringify({
          sourcePostId,
          sourceName: "Alan Chan",
          originalText,
          submittedAt: new Date().toISOString(),
          processMode: "full_pipeline",
        }),
      });
      const payload = await response.json() as ProcessSourceResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Source processing failed.");
      setPipelineResult(payload);
      if (payload.extractedSignals) setSourceText("");
      await refresh();
      router.refresh();
    } catch (requestError) {
      setExtractionError(requestError instanceof Error ? requestError.message : "Source processing failed.");
    } finally {
      setExtractionBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}
      <Card className="overflow-hidden border-primary/20">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><RadioTower className="size-4 text-primary" /> Alan Chan Source Text</CardTitle>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Paste source text to extract structured Signals. Industry Chain is no longer required; category context is retained as tags.</p>
            </div>
            <Badge variant="outline" className="gap-1.5"><Cloud className="size-3.5" /> Supabase primary</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <textarea
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Paste Alan Chan members-only source text here…"
            className="min-h-52 w-full resize-y rounded-md border bg-background p-4 text-sm leading-6 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              One submission runs the authoritative Source → Signal → Logic Chain → Metric → Committee pipeline. Repeated content is idempotent.
            </div>
            <Button onClick={() => void extractAndSave()} disabled={!sourceText.trim() || extractionBusy}>{extractionBusy ? <Loader2 className="size-4 animate-spin" /> : <Inbox className="size-4" />} Extract to Signal Box</Button>
          </div>
        </CardContent>
      </Card>

      {extractionBusy ? <PipelineProcessing /> : null}
      {extractionError ? <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900" data-testid="pipeline-error">{extractionError}</div> : null}
      {pipelineResult ? <PipelineResultPanel result={pipelineResult} onRefresh={refresh} /> : null}

      <Card>
        <CardHeader className="border-b py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Automation Status</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Idempotent Signal and Logic validation; due every 48 hours.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => void loadAutomationStatus()} disabled={automationBusy} aria-label="Refresh automation status">
                <RefreshCw className="size-4" /> Refresh
              </Button>
              <Button size="sm" onClick={() => void runNow()} disabled={automationBusy || automationRun?.status === "Running"}>
                {automationBusy || automationRun?.status === "Running" ? <Loader2 className="size-4 animate-spin" /> : <RadioTower className="size-4" />}
                Run Now
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {automationError ? <div className="mb-4 border-l-2 border-red-500 bg-red-50 px-3 py-2 text-xs text-red-900">{automationError}</div> : null}
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-9">
            <AutomationMetric label="Last Run" value={formatTimestamp(automationRun?.finishedAt ?? automationRun?.startedAt)} />
            <AutomationMetric label="Next Run" value={formatTimestamp(automationRun?.nextRunAt)} />
            <AutomationMetric label="Sources" value={automationRun?.sourcesProcessed ?? 0} />
            <AutomationMetric label="Created" value={automationRun?.signalsCreated ?? 0} />
            <AutomationMetric label="Updated" value={automationRun?.signalsUpdated ?? 0} />
            <AutomationMetric label="Duplicates" value={automationRun?.duplicatesPrevented ?? 0} />
            <AutomationMetric label="Logic Chains" value={automationRun?.logicChainsUpdated ?? 0} />
            <AutomationMetric label="Errors" value={automationRun?.errors.length ?? 0} />
            <AutomationMetric label="Run Status" value={automationRun?.status ?? "Not run"} />
          </div>
          <div className="mt-5 border-t pt-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last 7 Runs</div>
            <div className="grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <BurnInMetric label="Cron Success Rate" value={formatPercent(automationStats?.cronSuccessRate)} />
              <BurnInMetric label="Signals Created" value={automationStats?.signalsCreated ?? 0} />
              <BurnInMetric label="Signals Updated" value={automationStats?.signalsUpdated ?? 0} />
              <BurnInMetric label="Duplicates Prevented" value={automationStats?.duplicatesPrevented ?? 0} />
              <BurnInMetric label="Needs Review Rate" value={formatPercent(automationStats?.needsReviewRate)} />
              <BurnInMetric label="Notifications Created" value={automationStats?.notificationsCreated ?? 0} />
              <BurnInMetric label="Data Fetch Failure Rate" value={formatPercent(automationStats?.dataFetchFailureRate)} />
              <BurnInMetric label="Average Run Duration" value={formatDuration(automationStats?.averageRunDurationMs)} />
            </div>
            <div className="mt-4 divide-y border-y text-xs">
              {automationRuns.length ? automationRuns.map((run) => (
                <div key={run.id} className="grid gap-1 py-2 sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
                  <span>{formatTimestamp(run.startedAt)}</span>
                  <span className="font-medium">{run.status}{run.result ? ` · ${run.result}` : ""}</span>
                  <span>{formatDuration(run.processingDurationMs)}</span>
                  <span className={run.errors.length ? "text-red-700" : "text-muted-foreground"}>{run.errors.length} errors</span>
                </div>
              )) : <div className="py-3 text-muted-foreground">No burn-in runs recorded yet.</div>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Recent Source Signals</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/signal-inbox">Open Inbox <ArrowRight className="size-4" /></Link></Button>
          </div>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {alanSignals.length ? alanSignals.map((signal) => (
            <div key={signal.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{signal.title}</div>
                <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{signal.summary}</div>
              </div>
              <span className="text-sm font-semibold text-primary">{signal.priorityScore}</span>
              <Badge variant="outline">{signal.status}</Badge>
              <Badge variant={signal.linkedLogicChainId ? "secondary" : "outline"}>{signal.linkedLogicChainId ? "Logic linked" : "Needs Logic"}</Badge>
            </div>
          )) : <div className="px-5 py-10 text-center text-sm text-muted-foreground">No Alan Chan Signals have been imported.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

const pipelineSteps = [
  { label: "Extracting signals", icon: Inbox },
  { label: "Resolving entities", icon: SearchCheck },
  { label: "Matching logic chains", icon: GitBranch },
  { label: "Compiling metrics", icon: RadioTower },
  { label: "Updating committee", icon: Users },
] as const;

function PipelineProcessing() {
  return (
    <Card className="border-primary/20" data-testid="pipeline-processing">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Loader2 className="size-4 animate-spin text-primary" /> Processing full research pipeline</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {pipelineSteps.map(({ label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-3 text-xs font-medium">
            <Icon className="size-4 text-primary" /><span>{label}</span><Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PipelineResultPanel({ result, onRefresh }: { result: ProcessSourceResponse; onRefresh: () => Promise<unknown> }) {
  const summary = useMemo(() => [
    ["Signals created", result.created.signals],
    ["Logic Chains created", result.created.logicChains],
    ["Existing Chains attached", result.attached.existingLogicChains],
    ["Metrics compiled", result.created.metrics],
    ["Evidence initialized", result.created.evidence],
    ["Committee objects", result.created.committeeObjects],
  ] as const, [result]);
  const firstSignal = result.resultIds.signalIds[0];
  const firstChain = result.resultIds.logicChainIds[0];
  return (
    <Card className="overflow-hidden border-emerald-200" data-testid="pipeline-result-summary">
      <CardHeader className="border-b bg-emerald-50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base text-emerald-950"><Check className="size-4" /> Extraction complete</CardTitle>
            <p className="mt-1 text-xs text-emerald-900/70">{result.sourcePostId} · {result.status.replaceAll("_", " ")}</p>
          </div>
          <Badge variant={result.errors.length ? "destructive" : result.reviewRequired.signalIds.length ? "outline" : "secondary"}>
            {result.reviewRequired.signalIds.length ? `${result.reviewRequired.signalIds.length} require review` : "Pipeline complete"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {summary.map(([label, value]) => <ResultMetric key={label} label={label} value={value} />)}
        </div>
        <div className="rounded-md bg-muted/35 px-4 py-3 text-xs text-muted-foreground">
          Duplicates prevented · {result.duplicates.signals} Signals · {result.duplicates.logicChains} Logic Chains · {result.duplicates.metrics} Metrics
          {result.created.confidenceEvents ? ` · ${result.created.confidenceEvents} confidence events initialized` : ""}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline"><Link href={firstSignal ? `/signal-inbox?signal=${encodeURIComponent(firstSignal)}` : "/signal-inbox"}>View Signals <ArrowRight className="size-4" /></Link></Button>
          <Button asChild size="sm" variant="outline"><Link href={firstChain ? `/logic-chains?focus=${encodeURIComponent(firstChain)}` : "/logic-chains"}>View Logic Chains <ArrowRight className="size-4" /></Link></Button>
          {result.reviewMatches.length ? <Button asChild size="sm" variant="outline"><a href="#match-review-queue">Review Matches <ArrowRight className="size-4" /></a></Button> : null}
          <Button asChild size="sm" variant="outline"><Link href={firstChain ? `/committee?chain=${encodeURIComponent(firstChain)}` : "/committee"}>View Committee <ArrowRight className="size-4" /></Link></Button>
        </div>
        {result.entityResolutions.length ? (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entity resolution</div>
            <div className="flex flex-wrap gap-2">
              {result.entityResolutions.map((item) => (
                <Badge key={`${item.canonicalName}-${item.resolutionStatus}`} variant={item.resolutionStatus === "VALIDATED" ? "secondary" : "outline"}>
                  {item.canonicalName} · {item.tickers.join(", ") || item.resolutionStatus}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {result.warnings.length || result.errors.length ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
            {[...result.warnings, ...result.errors].map((warning) => <div key={warning}>• {warning}</div>)}
          </div>
        ) : null}
        {result.reviewMatches.length ? <ReviewMatchQueue initialMatches={result.reviewMatches} onRefresh={onRefresh} /> : null}
      </CardContent>
    </Card>
  );
}

function ReviewMatchQueue({ initialMatches, onRefresh }: { initialMatches: ProcessSourceResponse["reviewMatches"]; onRefresh: () => Promise<unknown> }) {
  const router = useRouter();
  const [matches, setMatches] = useState(initialMatches);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<string>();

  async function resolveMatch(match: ProcessSourceResponse["reviewMatches"][number], action: "attach" | "reject") {
    if (busy || (action === "attach" && !match.candidateLogicChainId)) return;
    setBusy(`${match.id}:${action}`);
    setMessage(undefined);
    try {
      const response = action === "attach"
        ? await fetch(`/api/research/logic-chains/${encodeURIComponent(match.candidateLogicChainId!)}/attach-signal`, {
          method: "POST", headers: researchHeaders(), body: JSON.stringify({ signalId: match.signalId, relationType: "context" }),
        })
        : await fetch(`/api/research/matches/${encodeURIComponent(match.id)}`, {
          method: "PATCH", headers: researchHeaders(), body: JSON.stringify({ action: "reject" }),
        });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `${action === "attach" ? "Manual attach" : "Reject match"} failed.`);
      setMatches((current) => current.filter((item) => item.id !== match.id));
      setMessage(action === "attach" ? "Signal attached to the selected Logic Chain." : "Candidate rejected; Signal remains in Needs Review.");
      await onRefresh();
      router.refresh();
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Match review failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div id="match-review-queue" className="scroll-mt-24 border-t pt-5" data-testid="match-review-queue">
      <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 text-amber-600" /> Logic Chain Review Queue</div>
      <div className="mt-3 space-y-3">
        {matches.length ? matches.map((match) => (
          <div key={match.id} className="rounded-md border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="text-sm font-semibold">{match.signalTitle}</div><div className="mt-1 text-xs text-muted-foreground">Candidate: {match.candidateLogicChainTitle ?? "No eligible existing Chain"}</div></div>
              <Badge variant="outline">Match {Math.round(match.matchScore * 100)}%</Badge>
            </div>
            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-[1fr_auto]">
              <div className="space-y-1 text-muted-foreground">{match.reasons.map((reason) => <div key={reason}>• {reason}</div>)}</div>
              <div className="text-right text-muted-foreground">Auto attach ≥ {Math.round(match.autoAttachThreshold * 100)}%<br />Review ≥ {Math.round(match.reviewThreshold * 100)}%</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void resolveMatch(match, "attach")} disabled={!match.candidateLogicChainId || Boolean(busy)}>{busy === `${match.id}:attach` ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Manual Attach</Button>
              <Button size="sm" variant="outline" onClick={() => void resolveMatch(match, "reject")} disabled={Boolean(busy)}>Reject Match</Button>
            </div>
          </div>
        )) : <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Review queue cleared.</div>}
      </div>
      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md bg-muted/35 p-3"><div className="text-2xl font-semibold text-primary">{value}</div><div className="mt-1 text-[11px] leading-4 text-muted-foreground">{label}</div></div>;
}

function researchHeaders() {
  return { "content-type": "application/json", "x-worldmonitor-client": "research-tracking-v2" };
}

async function manualSourcePostId(sourceText: string) {
  const normalized = sourceText.normalize("NFKC").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9\u3400-\u9fff.=<>±%$]+/g, " ").trim();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  return `manual:${hash}`;
}

function AutomationMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-0 rounded-md border bg-muted/20 p-3"><div className="text-[11px] uppercase text-muted-foreground">{label}</div><div className="mt-1 truncate text-sm font-semibold">{value}</div></div>;
}

function BurnInMetric({ label, value }: { label: string; value: string | number }) {
  return <div><div className="text-[11px] text-muted-foreground">{label}</div><div className="mt-0.5 font-semibold">{value}</div></div>;
}

function formatTimestamp(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatPercent(value?: number) {
  return `${value ?? 0}%`;
}

function formatDuration(value?: number) {
  if (value === undefined) return "—";
  return value < 1_000 ? `${value} ms` : `${(value / 1_000).toFixed(1)} s`;
}
