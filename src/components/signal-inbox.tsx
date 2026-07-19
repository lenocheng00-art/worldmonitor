"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  BookmarkPlus,
  Archive,
  FlaskConical,
  GitBranch,
  Inbox,
  Loader2,
  Plus,
  RadioTower,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignalResearchPanel } from "@/components/research/research-tracking-panels";
import { type Signal, type SignalStatus } from "@/lib/decision-loop-data";
import { useDecisionLoop } from "@/lib/decision-loop-store";
import type { ProcessSourceResponse } from "@/lib/research/research-engine";
import { canEnterCommittee } from "@/lib/signal-operations";
import { cn } from "@/lib/utils";

const statuses: SignalStatus[] = ["NEW", "NEEDS_REVIEW", "TRACKING", "PROMOTED", "CONFIRMED", "INVALIDATED", "DISMISSED", "ARCHIVED"];

export function SignalInbox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    state,
    ready,
    error,
    refresh,
    createLogicChainFromSignal,
    sendSignalToCommittee,
    updateSignalStatus,
  } = useDecisionLoop();
  const requestedTicker = searchParams.get("ticker");
  const requestedSignal = searchParams.get("signal");
  const visibleSignals = useMemo(
    () => requestedTicker
      ? state.signals.filter((signal) => signal.status !== "ARCHIVED" && signal.relatedTickers.includes(requestedTicker))
      : state.signals.filter((signal) => signal.status !== "ARCHIVED"),
    [requestedTicker, state.signals],
  );
  const [activeStatus, setActiveStatus] = useState<SignalStatus | "All">("All");
  const filterSource = activeStatus === "ARCHIVED" ? state.signals : visibleSignals;
  const filtered = filterSource.filter((signal) => activeStatus === "All" || signal.status === activeStatus);
  const [selectedId, setSelectedId] = useState(requestedSignal ?? filtered[0]?.id ?? "");
  const [pasteText, setPasteText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importError, setImportError] = useState<string>();
  const [busyAction, setBusyAction] = useState("");
  const selected = filtered.find((signal) => signal.id === selectedId) ?? filtered[0];

  useEffect(() => {
    if (requestedSignal && filtered.some((signal) => signal.id === requestedSignal)) {
      setSelectedId(requestedSignal);
      return;
    }
    if (filtered.length && !filtered.some((signal) => signal.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, requestedSignal, selectedId]);

  async function importText() {
    if (!pasteText.trim() || busyAction) return;
    setBusyAction("import");
    setImportError(undefined);
    try {
      const response = await fetch("/api/research/process-source", {
        method: "POST",
        headers: { "content-type": "application/json", "x-worldmonitor-client": "research-tracking-v2" },
        body: JSON.stringify({ originalText: pasteText.trim(), sourceName: "Manual Signal Inbox", submittedAt: new Date().toISOString(), processMode: "full_pipeline" }),
      });
      const payload = await response.json() as ProcessSourceResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Signal extraction failed.");
      setPasteText("");
      setShowImport(false);
      await refresh();
      router.refresh();
    } catch (requestError) {
      setImportError(requestError instanceof Error ? requestError.message : "Signal extraction failed.");
    } finally {
      setBusyAction("");
    }
  }

  function perform(action: string, callback: () => void) {
    setBusyAction(action);
    window.setTimeout(() => {
      callback();
      setBusyAction("");
    }, 250);
  }

  if (!ready) {
    return <WorkbenchState icon={Loader2} title="Loading research state" description="Restoring linked signals and prior decisions." spin />;
  }

  return (
    <div className="space-y-4">
      {error ? <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button size="sm" variant={activeStatus === "All" ? "default" : "outline"} onClick={() => setActiveStatus("All")}>
            All <Badge className="ml-1 bg-white/20">{visibleSignals.length}</Badge>
          </Button>
          {statuses.map((status) => (
            <Button key={status} size="sm" variant={activeStatus === status ? "default" : "outline"} onClick={() => setActiveStatus(status)}>
              {status} <span className="text-xs opacity-70">{visibleSignals.filter((signal) => signal.status === status).length}</span>
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowImport((value) => !value)}>
          <Plus className="size-4" /> Import signal
        </Button>
      </div>

      {showImport ? (
        <Card>
          <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_auto]">
            <textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder="Paste an Alan Chan post or create a manual research signal."
              className="min-h-28 w-full resize-y rounded-md border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex gap-2 lg:flex-col">
              <Button onClick={() => void importText()} disabled={!pasteText.trim() || busyAction === "import"}>
                {busyAction === "import" ? <Loader2 className="size-4 animate-spin" /> : <RadioTower className="size-4" />} Extract and create
              </Button>
              <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
            </div>
            {importError ? <div className="text-xs text-red-700 lg:col-span-2">{importError}</div> : null}
          </CardContent>
        </Card>
      ) : null}

      {!filtered.length ? (
        <WorkbenchState
          icon={Inbox}
          title="No signals in this queue"
          description="Import an Alan Chan post, paste a signal, or create a manual research item."
          action={<Button onClick={() => setShowImport(true)}><Plus className="size-4" /> Create signal</Button>}
        />
      ) : (
        <section className="grid min-h-[640px] gap-4 xl:grid-cols-[0.7fr_1.25fr_0.75fr]">
          <Card className="h-fit overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Signal Queue</CardTitle>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {filtered.map((signal) => (
                <button
                  key={signal.id}
                  onClick={() => setSelectedId(signal.id)}
                  className={cn(
                    "w-full px-4 py-4 text-left transition hover:bg-muted/50",
                    selected?.id === signal.id && "bg-muted",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold leading-5">{signal.title}</span>
                    <span className="shrink-0 text-xs font-semibold text-primary">{signal.priorityScore}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{signal.status}</Badge>
                    <span className="text-xs text-muted-foreground">{signal.source}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {selected ? <SignalDetail signal={selected} /> : null}

          {selected ? (
            <Card className="h-fit xl:sticky xl:top-24">
              <CardHeader className="border-b">
                <CardTitle className="text-base">Action Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-5">
                <ActionButton
                  icon={GitBranch}
                  label={selected.linkedLogicChainId ? "Open Logic Chain" : "Create Logic Chain"}
                  busy={busyAction === "logic"}
                  onClick={() => perform("logic", () => {
                    const chain = createLogicChainFromSignal(selected.id);
                    if (chain) router.push(`/logic-chains?focus=${chain.id}`);
                  })}
                />
                <ActionButton
                  icon={BookmarkPlus}
                  label="Track"
                  busy={busyAction === "track"}
                  disabled={selected.qualityStatus !== "READY"}
                  onClick={() => perform("track", () => {
                    const chain = createLogicChainFromSignal(selected.id);
                    if (chain) updateSignalStatus(selected.id, "TRACKING");
                  })}
                />
                <ActionButton
                  icon={Archive}
                  label="Archive"
                  busy={busyAction === "archive"}
                  onClick={() => perform("archive", () => updateSignalStatus(selected.id, "ARCHIVED"))}
                />
                <ActionButton
                  icon={Users}
                  label={selected.linkedCommitteeReportId ? "Open Committee Review" : selected.linkedLogicChainId ? "Send Logic Chain to Committee" : "Create Logic Chain first"}
                  busy={busyAction === "committee"}
                  disabled={!selected.linkedCommitteeReportId && !canEnterCommittee(selected)}
                  onClick={() => perform("committee", () => {
                    const report = sendSignalToCommittee(selected.id);
                    if (report) router.push(`/committee?report=${report.id}`);
                  })}
                />
                <ActionButton
                  icon={FlaskConical}
                  label={selected.linkedBacktestId ? "Open Backtest" : "Backtest after Committee"}
                  busy={busyAction === "backtest"}
                  disabled={!selected.linkedBacktestId}
                  onClick={() => perform("backtest", () => {
                    if (selected.linkedBacktestId) router.push(`/backtest-lab?result=${selected.linkedBacktestId}`);
                  })}
                />
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-700"
                  onClick={() => updateSignalStatus(selected.id, "DISMISSED")}
                  disabled={selected.status === "DISMISSED"}
                >
                  <Ban className="size-4" /> Dismiss
                </Button>
                <div className="border-t pt-4 text-xs leading-5 text-muted-foreground">
                  Every action writes status and linked IDs into the unified research state.
                </div>
              </CardContent>
            </Card>
          ) : null}
        </section>
      )}
    </div>
  );
}

function SignalDetail({ signal }: { signal: Signal }) {
  const timeline = [
    { label: "Created", active: true },
    { label: "Tracking", active: signal.status === "TRACKING" || Boolean(signal.linkedLogicChainId) },
    { label: "Promoted", active: signal.status === "PROMOTED" || Boolean(signal.linkedLogicChainId) },
    { label: "Committee queued", active: Boolean(signal.linkedCommitteeReportId) },
    { label: "Archived", active: signal.status === "ARCHIVED" },
  ];
  return (
    <Card className="h-fit">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant="outline">{signal.source}</Badge>
            <CardTitle className="mt-3 text-xl">{signal.title}</CardTitle>
          </div>
          <Badge variant={signal.status === "DISMISSED" ? "destructive" : "secondary"}>{signal.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <Detail label="Original Text" value={signal.originalText} />
        <Detail label="Extracted Signal" value={signal.extractedSignal} />
        {signal.atomicClaim ? <Detail label="Atomic Claim" value={signal.atomicClaim} /> : null}
        <Detail label="Trigger Event" value={signal.triggerEvent ?? "Needs review"} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Tags label="Related Tickers" values={signal.relatedTickers} empty="No ticker mapped" />
          <Detail label="Priority Score" value={`${signal.priorityScore}/100`} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Tags label="Monitoring Metrics" values={(signal.monitoringMetrics ?? []).map((metric) => metric.label)} empty="Missing — Needs Review" />
          <Tags label="Quality Gate" values={signal.qualityIssues?.length ? signal.qualityIssues : ["Ready"]} empty="Needs review" />
          <Tags label="Confirmation Conditions" values={signal.confirmationConditions ?? []} empty="Missing — Needs Review" />
          <Tags label="Invalidation Conditions" values={signal.invalidationConditions ?? []} empty="Missing — Needs Review" />
        </div>
        <div className="border-t pt-5">
          <div className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Status Timeline</div>
          <div className="grid gap-2 sm:grid-cols-5">
            {timeline.map((item, index) => (
              <div key={item.label} className="relative">
                <div className={cn("mb-2 h-1.5 rounded-full", item.active ? "bg-primary" : "bg-muted")} />
                <div className={cn("text-xs", item.active ? "font-semibold" : "text-muted-foreground")}>
                  {index + 1}. {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 border-t pt-5 sm:grid-cols-3">
          <LinkedId label="Logic Chain" value={signal.linkedLogicChainId} />
          <LinkedId label="Committee" value={signal.linkedCommitteeReportId} />
          <LinkedId label="Backtest" value={signal.linkedBacktestId} />
        </div>
        {(signal.normalizedEntities?.length || signal.explicitConditions?.length || signal.qualityScoreV2 !== undefined) ? (
          <SignalResearchPanel
            signalId={signal.id}
            logicChainId={signal.linkedLogicChainId}
            entities={signal.normalizedEntities ?? []}
            conditions={signal.explicitConditions ?? []}
            reviewRequired={signal.reviewRequired}
          />
        ) : null}
        {(signal.relatedIndustryChains.length || (signal.related_asset_ids ?? []).length) ? (
          <details className="rounded-md border bg-muted/30 p-4">
            <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">Legacy Metadata</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Tags label="Industry Chain (legacy)" values={signal.relatedIndustryChains} empty="None" />
              <Tags label="Portfolio Asset IDs (legacy)" values={signal.related_asset_ids ?? []} empty="None" />
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActionButton({ icon: Icon, label, busy, disabled, onClick }: {
  icon: typeof GitBranch; label: string; busy: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <Button className="w-full justify-start" variant="outline" onClick={onClick} disabled={busy || disabled}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {label}
    </Button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div><p className="mt-2 text-sm leading-6">{value}</p></div>;
}

function Tags({ label, values, empty }: { label: string; values: string[]; empty: string }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.length ? values.map((value) => <Badge key={value} variant="outline">{value}</Badge>) : <span className="text-sm text-muted-foreground">{empty}</span>}
      </div>
    </div>
  );
}

function LinkedId({ label, value }: { label: string; value?: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 truncate text-xs font-medium">{value ?? "Not linked"}</div></div>;
}

function WorkbenchState({ icon: Icon, title, description, action, spin }: {
  icon: typeof Inbox; title: string; description: string; action?: React.ReactNode; spin?: boolean;
}) {
  return (
    <Card><CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
      <Icon className={cn("size-7 text-muted-foreground", spin && "animate-spin")} />
      <div><div className="font-semibold">{title}</div><div className="mt-1 text-sm text-muted-foreground">{description}</div></div>
      {action}
    </CardContent></Card>
  );
}
