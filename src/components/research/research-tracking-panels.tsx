"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Link2, Loader2, Pause, Pencil, Play, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CommitteeResearchObject } from "@/lib/research/committee-sync";
import type { ConfidenceEvent, Evidence, LogicChainRecord, LogicChainSignal, TrackingMetric } from "@/lib/research/schemas";

type ChainDetail = {
  chain: LogicChainRecord;
  metrics: TrackingMetric[];
  evidence: Evidence[];
  relations: LogicChainSignal[];
  confidenceEvents: ConfidenceEvent[];
  committee: CommitteeResearchObject | null;
};

type ChainOption = Pick<LogicChainRecord, "id" | "title" | "status" | "confidenceScore">;

export function SignalResearchPanel({ signalId, logicChainId, entities, conditions, reviewRequired }: {
  signalId: string;
  logicChainId?: string;
  entities: Array<{ canonicalName: string; aliases: string[] }>;
  conditions: Array<{ metric: string; operator: string; threshold: string | number | null; duration: string | null }>;
  reviewRequired?: boolean;
}) {
  const [metrics, setMetrics] = useState<TrackingMetric[]>([]);
  const [chainOptions, setChainOptions] = useState<ChainOption[]>([]);
  const [relation, setRelation] = useState<LogicChainSignal>();
  const [targetChain, setTargetChain] = useState(logicChainId ?? "");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [metricResponse, chainResponse, detailResponse] = await Promise.all([
        fetch(`/api/research/metrics?signalId=${encodeURIComponent(signalId)}`, { cache: "no-store" }),
        fetch("/api/research/logic-chains", { cache: "no-store" }),
        logicChainId ? fetch(`/api/research/logic-chains/${encodeURIComponent(logicChainId)}`, { cache: "no-store" }) : Promise.resolve(null),
      ]);
      if (!metricResponse.ok || !chainResponse.ok || (detailResponse && !detailResponse.ok)) throw new Error("Research Tracking details are unavailable.");
      const metricPayload = await metricResponse.json() as { metrics: TrackingMetric[] };
      const chainPayload = await chainResponse.json() as { logicChains: ChainOption[] };
      setMetrics(metricPayload.metrics);
      setChainOptions(chainPayload.logicChains);
      if (detailResponse) {
        const detailPayload = await detailResponse.json() as ChainDetail;
        setRelation(detailPayload.relations.find((item) => item.signalId === signalId));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Research Tracking details are unavailable.");
    }
  }, [logicChainId, signalId]);

  useEffect(() => { void load(); }, [load]);

  async function attach() {
    if (!targetChain || targetChain === logicChainId || busy) return;
    setBusy("attach");
    setMessage(undefined);
    try {
      const response = await fetch(`/api/research/logic-chains/${encodeURIComponent(targetChain)}/attach-signal`, {
        method: "POST",
        headers: researchHeaders(),
        body: JSON.stringify({ signalId, relationType: "context" }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Manual attachment failed.");
      setMessage("Signal attached. Reloading will show the authoritative Supabase link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Manual attachment failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4 rounded-md border bg-muted/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Research Tracking V2</div>
        {reviewRequired ? <Badge variant="destructive"><AlertTriangle className="mr-1 size-3" /> Review required</Badge> : <Badge variant="secondary"><Check className="mr-1 size-3" /> Structured</Badge>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TokenList label="Normalized Entities" values={entities.map((entity) => entity.canonicalName)} empty="No resolved entity" />
        <TokenList label="Explicit Conditions" values={conditions.map((condition) => `${condition.metric} · ${condition.operator}${condition.threshold === null ? "" : ` ${condition.threshold}`}${condition.duration ? ` · ${condition.duration}` : ""}`)} empty="No executable condition" />
      </div>
      {relation ? <div className="grid gap-3 rounded-md border bg-background p-3 text-xs sm:grid-cols-3"><div><PanelLabel>Matched Chain</PanelLabel><div className="mt-1 truncate font-medium">{chainOptions.find((chain) => chain.id === relation.logicChainId)?.title ?? relation.logicChainId}</div></div><div><PanelLabel>Match Score</PanelLabel><div className="mt-1 font-medium">{Math.round(relation.matchScore * 100)}%</div></div><div><PanelLabel>Relation</PanelLabel><div className="mt-1 font-medium">{relation.relationType}</div></div></div> : null}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Compiled Metrics</div>
        <div className="space-y-2">
          {metrics.length ? metrics.map((metric) => <EditableMetric key={metric.id} metric={metric} onSaved={load} />) : <div className="text-sm text-muted-foreground">No compiled metric.</div>}
        </div>
      </div>
      <div className="grid gap-2 border-t pt-4 sm:grid-cols-[1fr_auto]">
        <select value={targetChain} onChange={(event) => setTargetChain(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">Attach to a different Logic Chain…</option>
          {chainOptions.map((chain) => <option key={chain.id} value={chain.id}>{chain.title} · {chain.status} · {chain.confidenceScore}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={() => void attach()} disabled={!targetChain || targetChain === logicChainId || busy === "attach"}>
          {busy === "attach" ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />} Attach
        </Button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}

export function LogicChainResearchPanel({ chainId }: { chainId: string }) {
  const { detail, error, loading, reload } = useChainDetail(chainId);
  if (loading) return <PanelState><Loader2 className="size-4 animate-spin" /> Loading tracking evidence</PanelState>;
  if (error || !detail) return <PanelState><AlertTriangle className="size-4" /> {error ?? "Tracking details unavailable"}</PanelState>;
  const supporting = detail.relations.filter((relation) => relation.relationType === "supporting" || relation.relationType === "trigger");
  const contradicting = detail.relations.filter((relation) => relation.relationType === "contradicting");
  return (
    <div className="space-y-4 border-t pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Research State</div>
          <div className="mt-1 text-sm font-medium">{detail.chain.status} · {detail.metrics.filter((metric) => metric.status === "active").length} active metrics · next {formatTime(detail.chain.nextReviewAt)}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={reload}><RefreshCw className="size-4" /> Refresh</Button>
      </div>
      <p className="text-sm leading-6">{detail.chain.thesis}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <RelationList title={`Supporting Signals (${supporting.length})`} relations={supporting} />
        <RelationList title={`Contradicting Signals (${contradicting.length})`} relations={contradicting} />
      </div>
      <div>
        <PanelLabel>Metric State</PanelLabel>
        <div className="mt-2 divide-y rounded-md border">
          {detail.metrics.map((metric) => (
            <div key={metric.id} className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[1.2fr_0.6fr_0.8fr_0.8fr]">
              <span className="font-medium">{metric.metricKey}</span><span>{metric.status}</span><span>last {formatValue(metric.lastValue)}</span><span>next {formatTime(metric.nextRunAt)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Timeline title="Evidence Timeline" rows={detail.evidence.slice(-8).reverse().map((item) => ({ id: item.id, date: item.observedAt, title: `${item.direction} · ${item.title}`, detail: item.summary }))} />
        <Timeline title="Confidence Timeline" rows={detail.confidenceEvents.slice(-8).reverse().map((item) => ({ id: item.id, date: item.createdAt, title: `${item.previousScore} → ${item.newScore} (${item.delta > 0 ? "+" : ""}${item.delta})`, detail: item.reason }))} />
      </div>
    </div>
  );
}

export function CommitteeResearchPanel({ logicChainId }: { logicChainId?: string }) {
  const { detail, error, loading } = useChainDetail(logicChainId);
  if (!logicChainId) return null;
  if (loading) return <PanelState><Loader2 className="size-4 animate-spin" /> Loading active research object</PanelState>;
  if (error || !detail?.committee) return <PanelState><AlertTriangle className="size-4" /> {error ?? "No active research object"}</PanelState>;
  const object = detail.committee;
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3 text-xs">
      <div className="flex items-center justify-between gap-2"><PanelLabel>Active Research · v{object.currentVersion}</PanelLabel><Badge variant="outline">{object.confidenceScore}/100</Badge></div>
      <p className="leading-5">{object.thesis}</p>
      <TokenList label="Related Tickers" values={object.relatedTickers} empty="None" />
      <TokenList label="Active Metrics" values={object.activeMetrics} empty="None" />
      <TokenList label="Supporting Evidence" values={object.supportingEvidence} empty="Waiting" />
      <TokenList label="Contradicting Evidence" values={object.contradictingEvidence} empty="None" />
      <TokenList label="Validation Conditions" values={object.validationConditions} empty="None" />
      <TokenList label="Invalidation Conditions" values={object.invalidationConditions} empty="None" />
      <div className="text-muted-foreground">Data updated {formatTime(object.dataUpdatedAt)} · next review {formatTime(object.nextReviewAt)}</div>
    </div>
  );
}

function EditableMetric({ metric, onSaved }: { metric: TrackingMetric; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(metric.description);
  const [busy, setBusy] = useState(false);
  async function patch(patchValue: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(`/api/research/metrics/${encodeURIComponent(metric.id)}`, { method: "PATCH", headers: researchHeaders(), body: JSON.stringify(patchValue) });
      if (!response.ok) throw new Error("Metric update failed.");
      await onSaved();
      setEditing(false);
    } finally { setBusy(false); }
  }
  return (
    <div className="rounded-md border bg-background p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{metric.metricKey}</span><Badge variant={metric.status === "active" ? "secondary" : "outline"}>{metric.status}</Badge></div>
      {editing ? <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-16 w-full rounded-md border bg-background p-2" /> : <p className="mt-1 leading-5 text-muted-foreground">{metric.description}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {editing ? <Button size="sm" onClick={() => void patch({ description })} disabled={busy}><Check className="size-3.5" /> Save</Button> : <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="size-3.5" /> Edit</Button>}
        <Button size="sm" variant="ghost" onClick={() => void patch({ status: metric.status === "active" ? "paused" : "active" })} disabled={busy}>
          {metric.status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} {metric.status === "active" ? "Pause" : "Activate"}
        </Button>
      </div>
    </div>
  );
}

function useChainDetail(chainId?: string) {
  const [detail, setDetail] = useState<ChainDetail>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(Boolean(chainId));
  const reload = useCallback(async () => {
    if (!chainId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/research/logic-chains/${encodeURIComponent(chainId)}`, { cache: "no-store" });
      const payload = await response.json() as ChainDetail & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Tracking details are unavailable.");
      setDetail(payload);
      setError(undefined);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Tracking details are unavailable.");
    } finally { setLoading(false); }
  }, [chainId]);
  useEffect(() => { void reload(); }, [reload]);
  return useMemo(() => ({ detail, error, loading, reload: () => void reload() }), [detail, error, loading, reload]);
}

function RelationList({ title, relations }: { title: string; relations: LogicChainSignal[] }) {
  return <div><PanelLabel>{title}</PanelLabel><div className="mt-2 space-y-1">{relations.length ? relations.map((relation) => <div key={relation.id} className="flex justify-between gap-2 rounded border px-2 py-1.5 text-xs"><span className="truncate">{relation.signalId}</span><span className="font-medium">{Math.round(relation.matchScore * 100)}%</span></div>) : <div className="text-sm text-muted-foreground">None</div>}</div></div>;
}
function Timeline({ title, rows }: { title: string; rows: Array<{ id: string; date: string; title: string; detail: string }> }) {
  return <div><PanelLabel>{title}</PanelLabel><div className="mt-2 space-y-2">{rows.length ? rows.map((row) => <div key={row.id} className="border-l-2 pl-3 text-xs"><div className="font-medium">{row.title}</div><div className="mt-0.5 line-clamp-2 text-muted-foreground">{row.detail}</div><div className="mt-1 text-[10px] text-muted-foreground">{formatTime(row.date)}</div></div>) : <div className="text-sm text-muted-foreground">No events yet.</div>}</div></div>;
}
function TokenList({ label, values, empty }: { label: string; values: string[]; empty: string }) {
  return <div><PanelLabel>{label}</PanelLabel><div className="mt-2 flex flex-wrap gap-1.5">{values.length ? values.map((value) => <Badge key={value} variant="outline" className="max-w-full whitespace-normal text-left">{value}</Badge>) : <span className="text-muted-foreground">{empty}</span>}</div></div>;
}
function PanelLabel({ children }: { children: React.ReactNode }) { return <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>; }
function PanelState({ children }: { children: React.ReactNode }) { return <div className="flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">{children}</div>; }
function researchHeaders() { return { "content-type": "application/json", "x-worldmonitor-client": "research-tracking-v2" }; }
function formatTime(value: string | null) { if (!value) return "not scheduled"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function formatValue(value: unknown) { if (value === null || value === undefined) return "—"; return typeof value === "object" ? JSON.stringify(value) : String(value); }
