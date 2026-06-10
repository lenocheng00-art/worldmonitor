"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Edit3, History, Save, Search, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  evaluateSignalUpdate,
  extractAlanSignals,
  type AlanSignal,
  type AlanSignalCategory,
  type AlanSignalPriority,
  type AlanSignalStatus,
} from "@/lib/alan-chan-parser";
import { useAlanSignals } from "@/lib/use-alan-signals";
import { useDecisionLoop } from "@/lib/decision-loop-store";
import { cn } from "@/lib/utils";

const categories: Array<AlanSignalCategory | "All"> = [
  "All",
  "AI Infra",
  "AI Labs",
  "Space",
  "Macro",
  "Polymarket",
  "Other",
];

const statuses: Array<AlanSignalStatus | "All"> = ["All", "Watching", "Confirmed", "Invalidated"];
const priorities: Array<AlanSignalPriority | "All"> = ["All", "High", "Medium", "Low"];

const badgeByPriority = {
  High: "destructive",
  Medium: "secondary",
  Low: "outline",
} as const;

const badgeByStatus = {
  Watching: "outline",
  Confirmed: "secondary",
  Invalidated: "destructive",
} as const;

const emptyPasteText =
  "Paste Alan Chan members-only post text here. The parser runs locally in your browser and stores extracted signals in localStorage.";

export function AlanChanSignals() {
  const [pasteText, setPasteText] = useState("");
  const [signals, setSignals] = useAlanSignals();
  const { createSignal } = useDecisionLoop();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<AlanSignalCategory | "All">("All");
  const [entityFilter, setEntityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<AlanSignalStatus | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<AlanSignalPriority | "All">("All");

  const entities = useMemo(() => {
    const uniqueEntities = Array.from(new Set(signals.map((signal) => signal.entity))).sort((a, b) =>
      a.localeCompare(b),
    );

    return ["All", ...uniqueEntities];
  }, [signals]);

  const filteredSignals = useMemo(() => {
    return signals.filter((signal) => {
      return (
        (categoryFilter === "All" || signal.category === categoryFilter) &&
        (entityFilter === "All" || signal.entity === entityFilter) &&
        (statusFilter === "All" || signal.status === statusFilter) &&
        (priorityFilter === "All" || signal.priority === priorityFilter)
      );
    });
  }, [categoryFilter, entityFilter, priorityFilter, signals, statusFilter]);

  function handleExtract() {
    const extracted = extractAlanSignals(pasteText);

    if (!extracted.length) {
      return;
    }

    setSignals((current) => [...extracted, ...current]);
    const sourcePostId = `source-post-alan-${Date.now()}`;
    extracted.forEach((signal) => createSignal({
      id: `signal-alan-${signal.id}`,
      sourcePostId,
      title: signal.entity,
      source: "Alan Chan",
      originalText: signal.sourceExcerpt,
      extractedSignal: signal.thesis,
      relatedTickers: inferTickers(signal.entity),
      relatedIndustryChains: [signal.category],
      priorityScore: signal.priority === "High" ? 90 : signal.priority === "Medium" ? 70 : 50,
      sourcePost: {
        id: sourcePostId,
        source: "Alan Chan",
        title: extracted[0]?.entity ?? "Alan Chan member post",
        originalText: pasteText.trim(),
        metadata: { extractedSignalCount: extracted.length },
      },
    }));
    setPasteText("");
  }

  function updateSignal(id: string, patch: Partial<AlanSignal>) {
    setSignals((current) => current.map((signal) => (signal.id === id ? { ...signal, ...patch } : signal)));
  }

  function addMonitorUpdate(id: string, update: string) {
    setSignals((current) =>
      current.map((signal) => (signal.id === id ? evaluateSignalUpdate(signal, update) : signal)),
    );
  }

  function deleteSignal(id: string) {
    setSignals((current) => current.filter((signal) => signal.id !== id));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Paste Source Text</CardTitle>
              <CardDescription>Manual paste only. Nothing is scraped, requested, or sent to a server.</CardDescription>
            </div>
            <Badge variant="outline">localStorage</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={emptyPasteText}
            className="min-h-56 w-full resize-y rounded-md border bg-background p-4 text-sm leading-6 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Rules include Google TPU capex, Broadcom custom ASICs, Vertiv data center cooling, Constellation nuclear
              power, SpaceX IPO filings, Anthropic S-1, and OpenAI IPO timing.
            </div>
            <Button onClick={handleExtract} disabled={!pasteText.trim()}>
              <ClipboardList className="size-4" />
              Extract Signals
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-normal">Tracked Signals</h2>
            <p className="text-sm text-muted-foreground">{signals.length} saved signals on this device.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <FilterSelect
              label="Category"
              value={categoryFilter}
              options={categories}
              onChange={(value) => setCategoryFilter(value as AlanSignalCategory | "All")}
            />
            <FilterSelect label="Entity" value={entityFilter} options={entities} onChange={setEntityFilter} />
            <FilterSelect
              label="Status"
              value={statusFilter}
              options={statuses}
              onChange={(value) => setStatusFilter(value as AlanSignalStatus | "All")}
            />
            <FilterSelect
              label="Priority"
              value={priorityFilter}
              options={priorities}
              onChange={(value) => setPriorityFilter(value as AlanSignalPriority | "All")}
            />
          </div>
        </div>

        {filteredSignals.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredSignals.map((signal) => (
              <SignalEditorCard
                key={signal.id}
                signal={signal}
                editing={editingId === signal.id}
                onEdit={() => setEditingId(signal.id)}
                onSave={() => setEditingId(null)}
                onDelete={() => deleteSignal(signal.id)}
                onChange={(patch) => updateSignal(signal.id, patch)}
                onMonitorUpdate={(update) => addMonitorUpdate(signal.id, update)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
              <Search className="size-7 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold">No signals match the current filters.</div>
                <div className="text-sm text-muted-foreground">Paste a post or broaden the filters.</div>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function inferTickers(entity: string) {
  const mapping: Record<string, string[]> = {
    Google: ["GOOGL", "AVGO"],
    Broadcom: ["AVGO"],
    Vertiv: ["VRT"],
    "Constellation Energy": ["CEG"],
    SpaceX: ["RKLB", "ASTS"],
    Anthropic: ["AMZN", "GOOGL"],
    OpenAI: ["MSFT", "ORCL"],
  };
  return mapping[entity] ?? [];
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SignalEditorCard({
  signal,
  editing,
  onEdit,
  onSave,
  onDelete,
  onChange,
  onMonitorUpdate,
}: {
  signal: AlanSignal;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<AlanSignal>) => void;
  onMonitorUpdate: (update: string) => void;
}) {
  const [monitorUpdate, setMonitorUpdate] = useState("");

  function handleMonitorUpdate() {
    onMonitorUpdate(monitorUpdate);
    setMonitorUpdate("");
  }

  return (
    <Card className={cn("overflow-hidden", signal.status === "Invalidated" && "opacity-75")}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {editing ? (
              <input
                value={signal.entity}
                onChange={(event) => onChange({ entity: event.target.value })}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            ) : (
              <CardTitle className="truncate">{signal.entity}</CardTitle>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{signal.category}</Badge>
              <Badge variant={badgeByStatus[signal.status]}>{signal.status}</Badge>
              <Badge variant={badgeByPriority[signal.priority]}>{signal.priority}</Badge>
              <Badge variant="outline">{signal.confidence} confidence</Badge>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange({ status: "Confirmed" })}
              disabled={signal.status === "Confirmed"}
            >
              <CheckCircle2 className="size-4" />
              Confirmed
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange({ status: "Invalidated" })}
              disabled={signal.status === "Invalidated"}
            >
              <XCircle className="size-4" />
              Invalidated
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <EditableSignalForm signal={signal} onChange={onChange} />
        ) : (
          <ReadOnlySignal signal={signal} />
        )}

        <div className="rounded-md border bg-background p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <History className="size-4" />
            Monitoring Update
          </div>
          <textarea
            value={monitorUpdate}
            onChange={(event) => setMonitorUpdate(event.target.value)}
            placeholder="Paste a new update or evidence note. Matching rules will move this signal to Confirmed or Invalidated when triggered."
            className="min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-2 flex justify-end">
            <Button type="button" size="sm" onClick={handleMonitorUpdate} disabled={!monitorUpdate.trim()}>
              Apply Update
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Created {formatDate(signal.createdDate)} · Last checked {formatDate(signal.lastChecked)}
          </div>
          <div className="flex gap-2">
            {editing ? (
              <Button type="button" size="sm" onClick={onSave}>
                <Save className="size-4" />
                Save
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={onEdit}>
                <Edit3 className="size-4" />
                Edit
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={onDelete}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditableSignalForm({
  signal,
  onChange,
}: {
  signal: AlanSignal;
  onChange: (patch: Partial<AlanSignal>) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <FilterSelect
          label="Category"
          value={signal.category}
          options={categories.filter((category) => category !== "All")}
          onChange={(value) => onChange({ category: value as AlanSignalCategory })}
        />
        <FilterSelect
          label="Status"
          value={signal.status}
          options={statuses.filter((status) => status !== "All")}
          onChange={(value) => onChange({ status: value as AlanSignalStatus })}
        />
        <FilterSelect
          label="Priority"
          value={signal.priority}
          options={priorities.filter((priority) => priority !== "All")}
          onChange={(value) => onChange({ priority: value as AlanSignalPriority })}
        />
      </div>
      <EditableText
        label="Risk level"
        value={signal.riskLevel}
        rows={1}
        onChange={(value) => onChange({ riskLevel: coerceRiskLevel(value) })}
      />
      <EditableText
        label="Monitoring sources"
        value={signal.monitoringSources.join("\n")}
        onChange={(value) =>
          onChange({
            monitoringSources: value
              .split("\n")
              .map((source) => source.trim())
              .filter(Boolean),
          })
        }
      />
      <EditableText
        label="Source mappings"
        value={signal.sourceMappings.join("\n")}
        onChange={(value) =>
          onChange({
            sourceMappings: value
              .split("\n")
              .map((source) => source.trim())
              .filter(Boolean),
          })
        }
      />
      <EditableText
        label="Confirmed rule"
        value={signal.monitoringRule.confirmedIf}
        onChange={(value) => onChange({ monitoringRule: { ...signal.monitoringRule, confirmedIf: value } })}
      />
      <EditableText
        label="Invalidated rule"
        value={signal.monitoringRule.invalidatedIf}
        onChange={(value) => onChange({ monitoringRule: { ...signal.monitoringRule, invalidatedIf: value } })}
      />
      <EditableText label="Thesis" value={signal.thesis} onChange={(value) => onChange({ thesis: value })} />
      <EditableText
        label="Observable trigger"
        value={signal.observableTrigger}
        onChange={(value) => onChange({ observableTrigger: value })}
      />
      <EditableText
        label="Bullish condition"
        value={signal.bullishCondition}
        onChange={(value) => onChange({ bullishCondition: value })}
      />
      <EditableText
        label="Bearish condition"
        value={signal.bearishCondition}
        onChange={(value) => onChange({ bearishCondition: value })}
      />
      <EditableText
        label="Time horizon"
        value={signal.timeHorizon}
        rows={1}
        onChange={(value) => onChange({ timeHorizon: value })}
      />
      <EditableText
        label="Source text excerpt"
        value={signal.sourceExcerpt}
        onChange={(value) => onChange({ sourceExcerpt: value })}
      />
    </div>
  );
}

function EditableText({
  label,
  value,
  rows = 3,
  onChange,
}: {
  label: string;
  value: string;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

function ReadOnlySignal({ signal }: { signal: AlanSignal }) {
  return (
    <div className="space-y-4">
      <SignalField label="Thesis" value={signal.thesis} />
      <div className="grid gap-3 md:grid-cols-2">
        <SignalField label="Observable trigger" value={signal.observableTrigger} />
        <SignalField label="Time horizon" value={signal.timeHorizon} />
        <SignalField label="Bullish condition" value={signal.bullishCondition} />
        <SignalField label="Bearish condition" value={signal.bearishCondition} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SignalField label="Signal status" value={signal.status} />
        <SignalField label="Risk level" value={signal.riskLevel} />
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
      <div className="rounded-md border bg-muted/45 p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Source mappings</div>
        <div className="flex flex-wrap gap-2">
          {signal.sourceMappings.map((source) => (
            <Badge key={source} variant="outline">
              {source}
            </Badge>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SignalField label="Confirmed rule" value={signal.monitoringRule.confirmedIf} />
        <SignalField label="Invalidated rule" value={signal.monitoringRule.invalidatedIf} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SignalList label="Latest news" values={signal.latestNews} emptyText="No news evidence yet." />
        <SignalList label="Latest market data" values={signal.latestMarketData} emptyText="No market data evidence yet." />
      </div>
      <div className="rounded-md border bg-muted/45 p-3">
        <div className="mb-1 text-xs font-medium text-muted-foreground">Latest updates</div>
        {signal.latestUpdates.length ? (
          <ul className="space-y-2">
            {signal.latestUpdates.map((update) => (
              <li key={update} className="text-sm leading-6">
                {update}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No monitoring updates logged yet.</p>
        )}
      </div>
      <div className="rounded-md border bg-muted/45 p-3">
        <div className="mb-1 text-xs font-medium text-muted-foreground">Evidence queue</div>
        {signal.evidenceQueue.length ? (
          <div className="space-y-3">
            {signal.evidenceQueue.slice(0, 3).map((entry) => (
              <div key={entry.id} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{entry.sourceType}</Badge>
                  <Badge variant={badgeByStatus[entry.statusAfter]}>{entry.statusAfter}</Badge>
                  <Badge variant="outline">{entry.confidenceAfter} confidence</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                </div>
                <p className="text-sm leading-6">{entry.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No queued evidence.</p>
        )}
      </div>
      <div className="rounded-md border bg-muted/45 p-3">
        <div className="mb-1 text-xs font-medium text-muted-foreground">Evidence log</div>
        {signal.evidenceLog.length ? (
          <div className="space-y-3">
            {signal.evidenceLog.slice(0, 3).map((entry) => (
              <div key={entry.id} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{entry.sourceType}</Badge>
                  <Badge variant={badgeByStatus[entry.statusAfter]}>{entry.statusAfter}</Badge>
                  <Badge variant="outline">{entry.confidenceAfter} confidence</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
                </div>
                <p className="text-sm leading-6">{entry.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No evidence logged yet.</p>
        )}
      </div>
      <div className="rounded-md border bg-muted/45 p-3">
        <div className="mb-1 text-xs font-medium text-muted-foreground">Source text excerpt</div>
        <p className="text-sm leading-6">{signal.sourceExcerpt}</p>
      </div>
    </div>
  );
}

function coerceRiskLevel(value: string) {
  if (value === "High" || value === "Medium" || value === "Low") {
    return value;
  }

  return "Medium";
}

function SignalField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      <p className="text-sm leading-6">{value}</p>
    </div>
  );
}

function SignalList({ label, values, emptyText }: { label: string; values: string[]; emptyText: string }) {
  return (
    <div className="rounded-md border bg-muted/45 p-3">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}</div>
      {values.length ? (
        <ul className="space-y-2">
          {values.slice(0, 3).map((value) => (
            <li key={value} className="text-sm leading-6">
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
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
