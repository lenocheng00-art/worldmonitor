"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Ban,
  BookmarkPlus,
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
import { extractAlanSignals } from "@/lib/alan-chan-parser";
import { type Signal, type SignalStatus } from "@/lib/decision-loop-data";
import { useDecisionLoop } from "@/lib/decision-loop-store";
import { cn } from "@/lib/utils";

const statuses: SignalStatus[] = ["New", "Tracking", "Linked", "Reviewed", "Backtested", "Invalidated"];

export function SignalInbox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    state,
    ready,
    error,
    createSignal,
    createLogicChainFromSignal,
    sendSignalToCommittee,
    runBacktestFromSignal,
    addToWatchlist,
    updateSignalStatus,
  } = useDecisionLoop();
  const requestedTicker = searchParams.get("ticker");
  const visibleSignals = useMemo(
    () => requestedTicker
      ? state.signals.filter((signal) => signal.relatedTickers.includes(requestedTicker))
      : state.signals,
    [requestedTicker, state.signals],
  );
  const [activeStatus, setActiveStatus] = useState<SignalStatus | "All">("All");
  const filtered = visibleSignals.filter((signal) => activeStatus === "All" || signal.status === activeStatus);
  const [selectedId, setSelectedId] = useState(filtered[0]?.id ?? "");
  const [pasteText, setPasteText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const selected = filtered.find((signal) => signal.id === selectedId) ?? filtered[0];

  useEffect(() => {
    if (filtered.length && !filtered.some((signal) => signal.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  function importText() {
    const parsed = extractAlanSignals(pasteText);
    if (parsed.length) {
      parsed.forEach((item) => createSignal({
        title: item.entity,
        source: "Alan Chan",
        originalText: item.sourceExcerpt,
        extractedSignal: item.thesis,
        relatedTickers: inferTickers(item.entity),
        relatedIndustryChains: [item.category],
        priorityScore: item.priority === "High" ? 90 : item.priority === "Medium" ? 70 : 50,
      }));
    } else if (pasteText.trim()) {
      createSignal({
        title: pasteText.trim().slice(0, 64),
        source: "Manual",
        originalText: pasteText.trim(),
        extractedSignal: pasteText.trim(),
        relatedTickers: [],
        relatedIndustryChains: ["Other"],
        priorityScore: 60,
      });
    }
    setPasteText("");
    setShowImport(false);
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
              <Button onClick={importText} disabled={!pasteText.trim()}>
                <RadioTower className="size-4" /> Extract and create
              </Button>
              <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
            </div>
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
                  icon={Users}
                  label={selected.linkedCommitteeReportId ? "Open Committee Review" : "Send to Committee"}
                  busy={busyAction === "committee"}
                  onClick={() => perform("committee", () => {
                    const report = sendSignalToCommittee(selected.id);
                    if (report) router.push(`/committee?report=${report.id}`);
                  })}
                />
                <ActionButton
                  icon={FlaskConical}
                  label={selected.linkedBacktestId ? "Open Backtest" : "Run Backtest"}
                  busy={busyAction === "backtest"}
                  onClick={() => perform("backtest", () => {
                    const result = runBacktestFromSignal(selected.id);
                    if (result) router.push(`/backtest-lab?result=${result.id}`);
                  })}
                />
                <ActionButton
                  icon={BookmarkPlus}
                  label="Add to Watchlist"
                  busy={busyAction === "watchlist"}
                  onClick={() => perform("watchlist", () => {
                    selected.relatedTickers.forEach((ticker) => addToWatchlist(ticker, selected.id, selected.id));
                  })}
                />
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-700"
                  onClick={() => updateSignalStatus(selected.id, "Invalidated")}
                  disabled={selected.status === "Invalidated"}
                >
                  <Ban className="size-4" /> Mark Invalidated
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
    { label: "Logic linked", active: Boolean(signal.linkedLogicChainId) },
    { label: "Committee reviewed", active: Boolean(signal.linkedCommitteeReportId) },
    { label: "Backtested", active: Boolean(signal.linkedBacktestId) },
    { label: "Actioned", active: signal.status === "Actioned" },
  ];
  return (
    <Card className="h-fit">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge variant="outline">{signal.source}</Badge>
            <CardTitle className="mt-3 text-xl">{signal.title}</CardTitle>
          </div>
          <Badge variant={signal.status === "Invalidated" ? "destructive" : "secondary"}>{signal.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <Detail label="Original Text" value={signal.originalText} />
        <Detail label="Extracted Signal" value={signal.extractedSignal} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Tags label="Related Tickers" values={signal.relatedTickers} empty="No ticker mapped" />
          <Tags label="Industry Chain" values={signal.relatedIndustryChains} empty="No chain mapped" />
          <Detail label="Priority Score" value={`${signal.priorityScore}/100`} />
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
        <Tags label="Linked Portfolio Assets" values={signal.related_asset_ids ?? []} empty="No asset linked" />
      </CardContent>
    </Card>
  );
}

function ActionButton({ icon: Icon, label, busy, onClick }: {
  icon: typeof GitBranch; label: string; busy: boolean; onClick: () => void;
}) {
  return (
    <Button className="w-full justify-start" variant="outline" onClick={onClick} disabled={busy}>
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

function inferTickers(entity: string) {
  const mapping: Record<string, string[]> = {
    Google: ["GOOGL", "AVGO"], Broadcom: ["AVGO"], Vertiv: ["VRT"],
    "Constellation Energy": ["CEG"], SpaceX: ["RKLB", "ASTS"],
    Anthropic: ["AMZN", "GOOGL"], OpenAI: ["MSFT", "ORCL"],
  };
  return mapping[entity] ?? [];
}
