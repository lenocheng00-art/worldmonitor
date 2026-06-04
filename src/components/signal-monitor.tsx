"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  alanSignalsStorageKey,
  evaluateSignalUpdate,
  normalizeAlanSignal,
  type AlanSignal,
  type AlanSignalStatus,
} from "@/lib/alan-chan-parser";

const badgeByStatus = {
  Watching: "outline",
  Confirmed: "secondary",
  Invalidated: "destructive",
} as const;

const badgeByRisk = {
  High: "destructive",
  Medium: "secondary",
  Low: "outline",
} as const;

export function SignalMonitor() {
  const [signals, setSignals] = useState<AlanSignal[]>([]);
  const [updates, setUpdates] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<AlanSignalStatus | "All">("All");

  useEffect(() => {
    const stored = window.localStorage.getItem(alanSignalsStorageKey);

    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<AlanSignal>[];
      setSignals(parsed.map((signal) => normalizeAlanSignal(signal)));
    } catch {
      window.localStorage.removeItem(alanSignalsStorageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(alanSignalsStorageKey, JSON.stringify(signals));
  }, [signals]);

  const filteredSignals = useMemo(() => {
    return signals.filter((signal) => statusFilter === "All" || signal.status === statusFilter);
  }, [signals, statusFilter]);

  const counts = useMemo(() => {
    return {
      Watching: signals.filter((signal) => signal.status === "Watching").length,
      Confirmed: signals.filter((signal) => signal.status === "Confirmed").length,
      Invalidated: signals.filter((signal) => signal.status === "Invalidated").length,
    };
  }, [signals]);

  function applyUpdate(id: string) {
    const update = updates[id]?.trim();

    if (!update) {
      return;
    }

    setSignals((current) =>
      current.map((signal) => (signal.id === id ? evaluateSignalUpdate(signal, update) : signal)),
    );
    setUpdates((current) => ({ ...current, [id]: "" }));
  }

  function markChecked(id: string) {
    setSignals((current) =>
      current.map((signal) => (signal.id === id ? { ...signal, lastChecked: new Date().toISOString() } : signal)),
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <MonitorStat label="Watching" value={counts.Watching} icon={Clock3} />
        <MonitorStat label="Confirmed" value={counts.Confirmed} icon={CheckCircle2} />
        <MonitorStat label="Invalidated" value={counts.Invalidated} icon={ShieldAlert} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">Signal Monitor</h2>
            <p className="text-sm text-muted-foreground">Review latest updates, evidence, risk, and confidence.</p>
          </div>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AlanSignalStatus | "All")}
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="All">All</option>
              <option value="Watching">Watching</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Invalidated">Invalidated</option>
            </select>
          </label>
        </div>

        {filteredSignals.length ? (
          <div className="space-y-4">
            {filteredSignals.map((signal) => (
              <Card key={signal.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{signal.entity}</CardTitle>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{signal.category}</Badge>
                        <Badge variant={badgeByStatus[signal.status]}>{signal.status}</Badge>
                        <Badge variant={badgeByRisk[signal.riskLevel]}>{signal.riskLevel} risk</Badge>
                        <Badge variant="outline">{signal.confidence} confidence</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">Last checked {formatDate(signal.lastChecked)}</div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
                    <MonitorField label="Signal" value={signal.thesis} />
                    <MonitorField label="Last Update" value={signal.latestUpdates[0] ?? "No updates logged."} />
                    <MonitorField label="Evidence" value={signal.evidenceLog[0]?.text ?? "No evidence logged."} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <MonitorField label="Current Status" value={signal.status} />
                    <MonitorField label="Risk Level" value={signal.riskLevel} />
                    <MonitorField label="Confidence" value={signal.confidence} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <MonitorField label="Confirmed rule" value={signal.monitoringRule.confirmedIf} />
                    <MonitorField label="Invalidated rule" value={signal.monitoringRule.invalidatedIf} />
                  </div>

                  <div className="rounded-md border bg-muted/45 p-3">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">Monitoring sources</div>
                    <div className="flex flex-wrap gap-2">
                      {signal.monitoringSources.map((source) => (
                        <Badge key={source} variant="outline">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border bg-background p-3">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">Add latest update / evidence</span>
                      <textarea
                        value={updates[signal.id] ?? ""}
                        onChange={(event) => setUpdates((current) => ({ ...current, [signal.id]: event.target.value }))}
                        placeholder="Paste a monitoring update. Rules will update status when matched."
                        className="min-h-20 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => markChecked(signal.id)}>
                        Mark Checked
                      </Button>
                      <Button type="button" size="sm" onClick={() => applyUpdate(signal.id)}>
                        Apply Update
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
              <Activity className="size-7 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold">No signals to monitor.</div>
                <div className="text-sm text-muted-foreground">Extract signals from the Alan Chan page first.</div>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function MonitorStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tracking-normal">{value}</div>
        </div>
        <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function MonitorField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <p className="text-sm leading-6">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
