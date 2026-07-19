"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShadowDashboardData, ShadowDailyStatistics } from "@/lib/shadow/types";

export function ShadowDashboard() {
  const [data, setData] = useState<ShadowDashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/shadow/status", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail ?? payload.error ?? "Shadow status request failed.");
        return payload as ShadowDashboardData;
      })
      .then((payload) => { if (active) setData(payload); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, []);

  if (error) return (
    <Card className="border-amber-300 bg-amber-50">
      <CardContent className="flex items-start gap-3 pt-5 text-sm text-amber-950">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div><p className="font-semibold">Shadow status unavailable</p><p className="mt-1 text-amber-800">{error}</p></div>
      </CardContent>
    </Card>
  );
  if (!data) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading isolated replay state…</div>;

  const latest = data.latestRun?.statistics;
  const metrics = [
    ["Today’s Sources", latest?.sources ?? 0],
    ["Today’s Signals", latest?.signals ?? 0],
    ["Today’s Chains", latest?.chains ?? 0],
    ["Today’s Metrics", latest?.metrics ?? 0],
    ["Confidence Changes", latest?.confidenceChanges ?? 0],
    ["Committee Updates", latest?.committeeUpdates ?? 0],
  ];
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" />Isolation active</div>
        <p className="mt-1 text-emerald-800">Production is read-only. Every replay artifact shown here is stored in the isolated Shadow database.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {metrics.map(([label, value]) => <MetricCard key={String(label)} label={String(label)} value={Number(value)} />)}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Production vs Shadow</CardTitle>
          <CardDescription>Semantic differences for the Production sources included in the latest replay.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="py-2">Dimension</th><th>Production</th><th>Shadow</th><th>Added</th><th>Updated</th><th>Missing</th><th>Review</th></tr>
            </thead>
            <tbody>
              {data.latestDiffs.filter((diff) => diff.dimension !== "previous_shadow").map((diff) => (
                <tr key={diff.dimension} className="border-b last:border-0">
                  <td className="py-3 font-medium">{labelDimension(diff.dimension)}</td>
                  <td>{diff.productionAvailable ? diff.productionCount : "Unavailable"}</td>
                  <td>{diff.shadowCount}</td><td>{diff.added}</td><td>{diff.updated}</td><td>{diff.missing}</td>
                  <td><StatusPill status={diff.explanationStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>14-day trend</CardTitle>
          <CardDescription>Agreement, deduplication, provider, replay, Committee, and confidence quality.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="py-2">Date</th><th>Precision</th><th>Recall</th><th>Signal dup</th><th>Chain match</th><th>Metric success</th><th>Provider</th><th>Committee</th><th>Confidence drift</th><th>Replay</th></tr>
            </thead>
            <tbody>{data.last14Days.map((day) => <TrendRow key={day.replayDate} day={day} />)}</tbody>
          </table>
          {!data.last14Days.length && <p className="py-8 text-center text-sm text-muted-foreground">No Shadow replay has completed yet.</p>}
        </CardContent>
      </Card>

      <Card className={data.gate.passed ? "border-emerald-300" : "border-amber-300"}>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div><CardTitle>Production readiness gate</CardTitle><CardDescription>{data.gate.observedDays} / 14 successful observation days · {data.pendingManualReviews} pending diff reviews</CardDescription></div>
            <span className="rounded-full border px-3 py-1 text-xs font-semibold">{data.gate.recommendation.replaceAll("_", " ")}</span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(data.gate.gates).map(([name, passed]) => (
            <div key={name} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              {passed ? <CheckCircle2 className="size-4 text-emerald-600" /> : <AlertTriangle className="size-4 text-amber-600" />}
              <span>{splitName(name)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return <Card><CardContent className="pt-5"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></CardContent></Card>;
}

function TrendRow({ day }: { day: ShadowDailyStatistics }) {
  return <tr className="border-b last:border-0"><td className="py-3 font-medium">{day.replayDate}</td><td>{percent(day.signalPrecision)}</td><td>{percent(day.signalRecall)}</td><td>{percent(day.duplicateSignalRate)}</td><td>{percent(day.chainMatchRate)}</td><td>{percent(day.metricSuccessRate)}</td><td>{percent(day.providerSuccessRate)}</td><td>{day.committeeUpdateCount}</td><td>{percent(day.confidenceDriftRate)}</td><td>{day.replaySuccess ? "Success" : "Failed"}</td></tr>;
}

function StatusPill({ status }: { status: "explained" | "pending_review" | "unavailable" }) {
  return <span className={`rounded-full px-2 py-1 text-xs ${status === "explained" ? "bg-emerald-100 text-emerald-800" : status === "pending_review" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{status.replaceAll("_", " ")}</span>;
}

function percent(value: number | null) { return value === null ? "—" : `${(value * 100).toFixed(1)}%`; }
function labelDimension(value: string) { return value.split("_").map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`).join(" "); }
function splitName(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase()); }
