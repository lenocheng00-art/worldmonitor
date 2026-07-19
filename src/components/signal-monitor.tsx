"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Cloud, Inbox, Loader2, RadioTower, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AutomationBurnInStats, AutomationRunSummary } from "@/lib/automation-types";
import { useDecisionLoop } from "@/lib/decision-loop-store";
import type { ProcessSourceResponse } from "@/lib/research/research-engine";

export function SignalMonitor() {
  const { state, error } = useDecisionLoop();
  const [sourceText, setSourceText] = useState("");
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [extractionBusy, setExtractionBusy] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState<string>();
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
    setExtractionMessage(undefined);
    try {
      const response = await fetch("/api/research/process-source", {
        method: "POST",
        headers: { "content-type": "application/json", "x-worldmonitor-client": "research-tracking-v2" },
        body: JSON.stringify({ sourceText: sourceText.trim() }),
      });
      const payload = await response.json() as ProcessSourceResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Source processing failed.");
      setCreatedCount(payload.acceptedSignals);
      setExtractionMessage(`${payload.extractedSignals} atomic · ${payload.attachedToExistingChains} attached · ${payload.newLogicChains} new chain · ${payload.metricsCreated} metrics${payload.reviewRequired ? ` · ${payload.reviewRequired} review` : ""}`);
      if (payload.extractedSignals) setSourceText("");
      window.dispatchEvent(new Event("focus"));
    } catch (requestError) {
      setExtractionMessage(requestError instanceof Error ? requestError.message : "Source processing failed.");
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
              {createdCount === null ? "Signals enter Signal Inbox immediately; repeated evidence updates the existing Signal." : createdCount ? `${createdCount} extracted Signal${createdCount === 1 ? "" : "s"} processed in the cloud Inbox.` : "No supported signal pattern was found."}
              {extractionMessage ? <div className="mt-1 text-xs">{extractionMessage}</div> : null}
            </div>
            <Button onClick={() => void extractAndSave()} disabled={!sourceText.trim() || extractionBusy}>{extractionBusy ? <Loader2 className="size-4 animate-spin" /> : <Inbox className="size-4" />} Extract to Signal Inbox</Button>
          </div>
        </CardContent>
      </Card>

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
