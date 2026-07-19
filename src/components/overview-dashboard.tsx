"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CircleDot,
  Clock3,
  Database,
  Eye,
  GitBranch,
  Inbox,
  Info,
  RadioTower,
  RefreshCw,
  SearchCheck,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CommitteeReport,
  DecisionLoopState,
  LogicChain,
  Signal,
  WatchlistItem,
} from "@/lib/decision-loop-data";
import { useDecisionLoop } from "@/lib/decision-loop-store";
import type { ShadowDashboardData } from "@/lib/shadow/types";
import type { DatabaseHealth } from "@/lib/supabase/health";
import { cn } from "@/lib/utils";

type StatusTone = "healthy" | "attention" | "critical";
type SystemStatus = { label: string; value: string; tone: StatusTone; description: string; icon: LucideIcon };
type PipelineStage = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  primary?: string;
  primaryLabel?: string;
  details: string[];
  empty: string;
};
type WorkflowEvent = { id: string; time: string; timestamp: number; title: string; detail: string; href: string; icon: LucideIcon };
type QueueItem = { id: string; title: string; meta: string; href: string; priority?: number };
type QueueLane = { id: string; title: string; description: string; href: string; items: QueueItem[]; tone: string };

const emptyState: DecisionLoopState = {
  signals: [], logicChains: [], committeeReports: [], backtestStrategies: [], backtestResults: [], watchlist: [],
};

export const OverviewDashboard = memo(function OverviewDashboard() {
  const { state, ready, error } = useDecisionLoop();
  const now = useMemo(() => new Date(), []);
  const liveState = ready && !error ? state : emptyState;
  const model = useMemo(() => buildMissionModel(liveState, now), [liveState, now]);
  const health = useResearchHealth(ready, error);

  return (
    <div className="space-y-7" data-testid="mission-control-overview">
      <MissionHero health={health} />
      <ResearchPipeline stages={model.pipeline} />

      <section className="grid gap-5 2xl:grid-cols-[0.95fr_1.05fr]">
        <ResearchHealth statuses={health} />
        <WorkflowTimeline events={model.workflow} ready={ready} live={Boolean(ready && !error)} />
      </section>

      <ResearchQueue lanes={model.queue} />
      <LogicChainSnapshot chains={model.topChains} signals={liveState.signals} />

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <CommitteeSnapshot reports={liveState.committeeReports} />
        <WatchlistSnapshot
          title="Recently Added"
          description="New research targets entering active monitoring."
          items={model.recentlyAdded}
          reports={liveState.committeeReports}
        />
        <WatchlistSnapshot
          title="Recently Updated"
          description="Watchlist targets with a recent state change."
          items={model.recentlyUpdated}
          reports={liveState.committeeReports}
          highestConfidence={model.highestConfidence}
        />
      </section>
    </div>
  );
});

const MissionHero = memo(function MissionHero({ health }: { health: SystemStatus[] }) {
  const heroStatuses = [
    { label: "Live", value: "Online", tone: "healthy" as const, description: "Mission Control is receiving live application state.", icon: RadioTower },
    ...health.filter((item) => ["Research Engine", "Shadow", "Database", "Provider"].includes(item.label)),
  ];
  return (
    <section className="overflow-hidden rounded-2xl bg-primary px-5 py-5 text-primary-foreground shadow-panel sm:px-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
            <Sparkles className="size-3.5" /> WorldMonitor
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mission Control</h1>
            <p className="text-sm text-blue-100">Research Operating System</p>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/90">
            Read the live research pipeline, system health, and decisions that need human attention in one view.
          </p>
        </div>
        <div className="flex max-w-3xl flex-wrap gap-2" aria-label="Mission Control status">
          {heroStatuses.map((status) => <StatusBadge key={status.label} status={status} compact />)}
        </div>
      </div>
    </section>
  );
});

const ResearchPipeline = memo(function ResearchPipeline({ stages }: { stages: PipelineStage[] }) {
  return (
    <section aria-labelledby="research-pipeline-title">
      <SectionHeading
        eyebrow="Live system map"
        title="Research Pipeline"
        description="Every live research object, from incoming source material to an actively tracked decision."
      />
      <div className="relative mt-4">
        <div className="absolute left-10 right-10 top-12 hidden h-px bg-primary/20 xl:block" aria-hidden="true" />
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-7">
          {stages.map((stage, index) => <PipelineCard key={stage.id} stage={stage} index={index} />)}
        </div>
      </div>
    </section>
  );
});

const PipelineCard = memo(function PipelineCard({ stage, index }: { stage: PipelineStage; index: number }) {
  const Icon = stage.icon;
  return (
    <Link
      href={stage.href}
      title={stage.description}
      className="group relative z-[1] min-h-44 rounded-xl bg-card p-4 shadow-panel ring-1 ring-border/70 transition hover:-translate-y-0.5 hover:ring-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold">{stage.label}</h3>
        <Info className="size-3 text-muted-foreground/70" />
      </div>
      {stage.primary ? (
        <div className="mt-3">
          <div className="text-2xl font-semibold tracking-tight text-primary">{stage.primary}</div>
          <div className="text-xs text-muted-foreground">{stage.primaryLabel}</div>
          <div className="mt-3 space-y-1 text-xs text-foreground/75">
            {stage.details.map((detail) => <div key={detail}>{detail}</div>)}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{stage.empty}</p>
      )}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md bg-slate-950 px-3 py-2 text-[11px] leading-4 text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-visible:opacity-100">
        {stage.description}
      </div>
    </Link>
  );
});

const ResearchHealth = memo(function ResearchHealth({ statuses }: { statuses: SystemStatus[] }) {
  return (
    <Card className="border-0 shadow-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-primary" />Research Health</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-2">
        {statuses.map((status) => {
          const Icon = status.icon;
          return (
            <div key={status.label} className="rounded-lg bg-muted/45 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <Icon className="size-4 text-muted-foreground" />
                <StatusDot tone={status.tone} />
              </div>
              <div className="mt-3 text-xs font-medium text-muted-foreground">{status.label}</div>
              <div className="mt-0.5 text-sm font-semibold">{status.value}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
});

const WorkflowTimeline = memo(function WorkflowTimeline({ events, ready, live }: { events: WorkflowEvent[]; ready: boolean; live: boolean }) {
  return (
    <Card className="border-0 shadow-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><Clock3 className="size-4 text-primary" />Today&apos;s Workflow</CardTitle>
          <Badge variant="outline" className="border-primary/15 bg-primary/5 text-primary">Live timeline</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {events.length ? (
          <div className="relative space-y-1 before:absolute before:bottom-4 before:left-[4.4rem] before:top-4 before:w-px before:bg-border">
            {events.map((event) => {
              const Icon = event.icon;
              return (
                <Link key={event.id} href={event.href} className="group relative grid grid-cols-[3.25rem_1rem_1fr] items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/45">
                  <time className="pt-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{event.time}</time>
                  <span className="relative z-[1] mt-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon className="size-2.5" /></span>
                  <div>
                    <div className="text-sm font-semibold group-hover:text-primary">{event.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{event.detail}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <MissionEmpty
            title={ready && live ? "Waiting for today's research replay." : "Connecting to the live research pipeline."}
            description="The next replay will automatically populate this timeline."
          />
        )}
      </CardContent>
    </Card>
  );
});

const ResearchQueue = memo(function ResearchQueue({ lanes }: { lanes: QueueLane[] }) {
  return (
    <section aria-labelledby="research-queue-title">
      <SectionHeading
        eyebrow="Human decision layer"
        title="Research Queue"
        description="Work moves left to right as evidence, metrics, and decision readiness improve."
        action={{ href: "/signal-inbox", label: "Open Signal Inbox" }}
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
        {lanes.map((lane) => <QueueColumn key={lane.id} lane={lane} />)}
      </div>
    </section>
  );
});

const QueueColumn = memo(function QueueColumn({ lane }: { lane: QueueLane }) {
  return (
    <div className="min-h-64 rounded-xl bg-muted/45 p-3">
      <div className="flex items-start justify-between gap-3 px-1 pb-3">
        <div>
          <h3 className="text-sm font-semibold">{lane.title}</h3>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{lane.description}</p>
        </div>
        <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", lane.tone)}>{lane.items.length ? `${lane.items.length} queued` : "Clear"}</span>
      </div>
      <div className="space-y-2">
        {lane.items.length ? lane.items.slice(0, 4).map((item) => (
          <Link key={item.id} href={item.href} className="block rounded-lg bg-card p-3 shadow-sm ring-1 ring-border/60 transition hover:ring-primary/25">
            <div className="flex items-start justify-between gap-2">
              <div className="line-clamp-2 text-xs font-semibold leading-5">{item.title}</div>
              {item.priority ? <span className="text-xs font-semibold text-primary">{item.priority}</span> : null}
            </div>
            <div className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{item.meta}</div>
          </Link>
        )) : (
          <div className="rounded-lg border border-dashed bg-card/50 px-3 py-5 text-center text-xs leading-5 text-muted-foreground">No active signals.</div>
        )}
      </div>
      {lane.items.length > 4 ? <Link href={lane.href} className="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-primary">View {lane.items.length - 4} more <ArrowRight className="size-3" /></Link> : null}
    </div>
  );
});

const LogicChainSnapshot = memo(function LogicChainSnapshot({ chains, signals }: { chains: LogicChain[]; signals: Signal[] }) {
  return (
    <section aria-labelledby="top-logic-chains-title">
      <SectionHeading
        eyebrow="Thesis monitoring"
        title="Top Logic Chains"
        description="Highest-confidence active theses and the evidence systems currently validating them."
        action={{ href: "/logic-chains", label: "View all Logic Chains" }}
      />
      {chains.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {chains.map((chain) => <LogicChainCard key={chain.id} chain={chain} signal={signals.find((item) => item.id === chain.triggerSignalId)} />)}
        </div>
      ) : <div className="mt-4"><MissionEmpty title="No active signals." description="The next replay will create Logic Chains when a Source produces a qualified Signal." /></div>}
    </section>
  );
});

const LogicChainCard = memo(function LogicChainCard({ chain, signal }: { chain: LogicChain; signal?: Signal }) {
  const evidenceCount = chain.evidenceFor.length + chain.evidenceAgainst.length;
  const metricCount = chainMetricCount(chain);
  const direction = signalDirection(signal, chain);
  const lastUpdated = chain.lastEvidenceAt ?? chain.lastCheckedAt ?? chain.created_at;
  return (
    <Link href={`/logic-chains?focus=${chain.id}`} className="group rounded-xl bg-card p-5 shadow-panel ring-1 ring-border/70 transition hover:ring-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Logic Chain</div>
          <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-6 group-hover:text-primary">{chain.title}</h3>
        </div>
        <Badge variant={direction === "Bull" ? "secondary" : direction === "Bear" ? "destructive" : "outline"}>{direction}</Badge>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <SnapshotMetric label="Confidence" value={chain.confidenceScore > 0 ? `${chain.confidenceScore}%` : "Unrated"} />
        <SnapshotMetric label="Evidence" value={evidenceCount ? String(evidenceCount) : "Awaiting"} />
        <SnapshotMetric label="Metrics" value={metricCount ? String(metricCount) : "Awaiting"} />
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>{chain.validationStatus}</span>
        <span>{lastUpdated ? `Updated ${formatShortDate(lastUpdated)}` : "Waiting for replay"}</span>
      </div>
    </Link>
  );
});

const CommitteeSnapshot = memo(function CommitteeSnapshot({ reports }: { reports: CommitteeReport[] }) {
  const columns = useMemo(() => committeeColumns(reports), [reports]);
  return (
    <Card className="border-0 shadow-panel lg:col-span-2 xl:col-span-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-base"><Users className="size-4 text-primary" />Committee Snapshot</CardTitle><p className="mt-1 text-xs text-muted-foreground">Latest research decisions grouped by outcome.</p></div>
          <Link href="/committee" className="text-xs font-medium text-primary">Open <ArrowRight className="ml-1 inline size-3" /></Link>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {columns.map((column) => (
          <div key={column.label} className={cn("rounded-lg p-3", column.className)}>
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{column.label}</span><span className="text-[10px] font-semibold">{column.items.length ? column.items.length : "Clear"}</span></div>
            <div className="mt-3 space-y-2">
              {column.items.length ? column.items.slice(0, 5).map((report) => (
                <Link key={report.id} href="/committee" className="block rounded-md bg-white/75 px-2.5 py-2 ring-1 ring-black/5 hover:bg-white">
                  <div className="line-clamp-1 text-xs font-semibold">{report.relatedTickers[0] ?? report.company ?? "Research"}</div>
                  <div className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{report.topic}</div>
                </Link>
              )) : <p className="py-4 text-center text-[11px] leading-4 text-muted-foreground">Waiting for live research pipeline.</p>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
});

const WatchlistSnapshot = memo(function WatchlistSnapshot({
  title, description, items, reports, highestConfidence,
}: {
  title: string;
  description: string;
  items: WatchlistItem[];
  reports: CommitteeReport[];
  highestConfidence?: WatchlistItem[];
}) {
  return (
    <Card className="border-0 shadow-panel">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-base"><Eye className="size-4 text-primary" />{title}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>
          <Link href="/watchlist" className="text-xs font-medium text-primary">Open <ArrowRight className="ml-1 inline size-3" /></Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length ? items.slice(0, 3).map((item) => <WatchlistRow key={`${title}-${item.ticker}`} item={item} report={reports.find((report) => report.id === item.sourceObjectId)} />)
          : <MissionEmpty title="Waiting for live research pipeline." description="The next approved decision will populate this view." compact />}
        {highestConfidence?.length ? (
          <div className="mt-4 border-t pt-3">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Highest Confidence</div>
            {highestConfidence.slice(0, 2).map((item) => <WatchlistRow key={`confidence-${item.ticker}`} item={item} report={reports.find((report) => report.id === item.sourceObjectId)} />)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});

function WatchlistRow({ item, report }: { item: WatchlistItem; report?: CommitteeReport }) {
  return (
    <Link href="/watchlist" className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 hover:bg-muted/70">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{item.ticker.slice(0, 2)}</div>
      <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{item.ticker}</div><div className="truncate text-[11px] text-muted-foreground">{item.changeType ?? item.suggestedAction}</div></div>
      <div className="text-right"><div className="text-xs font-semibold">{report?.finalConfidenceScore ? `${report.finalConfidenceScore}%` : item.committeeView}</div><div className="text-[10px] text-muted-foreground">{formatShortDate(item.updatedAt ?? item.addedAt)}</div></div>
    </Link>
  );
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary">{eyebrow}</div><h2 id={`${title.toLowerCase().replaceAll(" ", "-")}-title`} className="mt-1 text-xl font-semibold tracking-tight">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>
      {action ? <Link href={action.href} className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary">{action.label}<ArrowRight className="size-4" /></Link> : null}
    </div>
  );
}

function MissionEmpty({ title, description, compact = false }: { title: string; description: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 text-center", compact ? "py-5" : "py-9")}>
      <CircleDot className="size-4 text-muted-foreground" />
      <div className="mt-2 text-sm font-medium">{title}</div>
      <div className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</div>
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/45 px-3 py-2"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mt-0.5 text-sm font-semibold">{value}</div></div>;
}

function StatusBadge({ status, compact = false }: { status: SystemStatus; compact?: boolean }) {
  return (
    <div title={status.description} className={cn("inline-flex items-center gap-2 rounded-full border", compact ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs", statusBadgeClass(status.tone))}>
      <StatusDot tone={status.tone} />
      <span className="font-medium opacity-80">{status.label}</span>
      <span className="font-semibold">{status.value}</span>
    </div>
  );
}

function StatusDot({ tone }: { tone: StatusTone }) {
  return <span className={cn("size-1.5 shrink-0 rounded-full", tone === "healthy" ? "bg-emerald-500" : tone === "attention" ? "bg-amber-500" : "bg-red-500")} />;
}

function statusBadgeClass(tone: StatusTone) {
  if (tone === "healthy") return "border-emerald-300/40 bg-emerald-400/10 text-emerald-50";
  if (tone === "attention") return "border-amber-300/40 bg-amber-400/10 text-amber-50";
  return "border-red-300/40 bg-red-400/10 text-red-50";
}

function useResearchHealth(ready: boolean, stateError?: string) {
  const [databaseHealth, setDatabaseHealth] = useState<DatabaseHealth | null>(null);
  const [shadowHealth, setShadowHealth] = useState<ShadowDashboardData | null>(null);
  const [shadowUnavailable, setShadowUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadHealth() {
      const [databaseResult, shadowResult] = await Promise.allSettled([
        fetch("/api/health/database", { cache: "no-store", signal: controller.signal }),
        fetch("/api/shadow/status", { cache: "no-store", signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      if (databaseResult.status === "fulfilled" && databaseResult.value.ok) setDatabaseHealth(await databaseResult.value.json() as DatabaseHealth);
      else setDatabaseHealth({ connected: false, project: null, error: "Database health unavailable." });
      if (shadowResult.status === "fulfilled" && shadowResult.value.ok) setShadowHealth(await shadowResult.value.json() as ShadowDashboardData);
      else setShadowUnavailable(true);
    }
    void loadHealth();
    return () => controller.abort();
  }, []);

  return useMemo<SystemStatus[]>(() => {
    const latestRun = shadowHealth?.latestRun;
    const latestProviderRate = shadowHealth?.last14Days[0]?.providerSuccessRate ?? null;
    return [
      {
        label: "Research Engine", value: !ready ? "Starting" : stateError ? "Attention" : "Healthy",
        tone: !ready ? "attention" : stateError ? "critical" : "healthy",
        description: stateError ?? "Live Research state loaded successfully.", icon: ServerCog,
      },
      {
        label: "Shadow", value: shadowHealth ? "Running" : shadowUnavailable ? "Isolated" : "Checking",
        tone: shadowHealth ? "healthy" : "attention",
        description: shadowHealth ? "Shadow state is available from the isolated runtime." : "Shadow remains isolated from this Production UI runtime.", icon: ShieldCheck,
      },
      {
        label: "Replay", value: latestRun ? statusLabel(latestRun.status) : shadowUnavailable ? "Standby" : "Checking",
        tone: latestRun?.status === "failed" ? "critical" : latestRun?.status === "partial" ? "attention" : latestRun ? "healthy" : "attention",
        description: latestRun ? `Last replay: ${latestRun.replayDate}.` : "Waiting for a readable Shadow replay status.", icon: RefreshCw,
      },
      {
        label: "Provider", value: providerLabel(latestProviderRate, shadowUnavailable),
        tone: latestProviderRate === null ? "attention" : latestProviderRate >= 0.99 ? "healthy" : latestProviderRate >= 0.9 ? "attention" : "critical",
        description: latestProviderRate === null ? "Provider telemetry is not available in this runtime." : `${(latestProviderRate * 100).toFixed(1)}% success in the latest Shadow run.`, icon: RadioTower,
      },
      {
        label: "Database", value: databaseHealth?.connected ? "Connected" : databaseHealth ? "Unavailable" : "Checking",
        tone: databaseHealth?.connected ? "healthy" : databaseHealth ? "critical" : "attention",
        description: databaseHealth?.connected ? "The configured Supabase project is reachable." : databaseHealth?.error ?? "Checking Supabase connection.", icon: Database,
      },
    ];
  }, [databaseHealth, ready, shadowHealth, shadowUnavailable, stateError]);
}

function buildMissionModel(state: DecisionLoopState, now: Date) {
  const todaySignals = state.signals.filter((signal) => isSameDay(signal.createdAt, now));
  const todaySources = new Set(todaySignals.map(sourceIdentity).filter(Boolean));
  const activeChains = state.logicChains.filter((chain) => !["Broken"].includes(chain.validationStatus) && chain.researchStatus !== "archived");
  const reviewingChains = activeChains.filter((chain) => chain.validationStatus === "Validating" || chain.researchStatus === "emerging");
  const strengtheningChains = activeChains.filter((chain) => chain.timeline.at(-1)?.confidence_change && chain.timeline.at(-1)!.confidence_change > 0);
  const evidenceCount = activeChains.reduce((total, chain) => total + chain.evidenceFor.length + chain.evidenceAgainst.length, 0);
  const metricCount = activeChains.reduce((total, chain) => total + chainMetricCount(chain), 0);
  const pendingSignals = state.signals.filter((signal) => ["NEW", "NEEDS_REVIEW", "TRACKING"].includes(signal.status));
  const needsReviewSignals = state.signals.filter(needsReview);
  const committee = committeeCounts(state.committeeReports);
  const todayWatchlist = state.watchlist.filter((item) => isSameDay(item.updatedAt ?? item.addedAt, now));

  const pipeline: PipelineStage[] = [
    stage("source", "Source", "/signal-monitor", RadioTower, "Source Text entering today's research cycle.", todaySources.size, "Today", compactDetails([
      todaySignals.length ? `${todaySignals.length} downstream Signals` : "",
    ]), "Waiting for a new Source."),
    stage("signal", "Signal", "/signal-inbox", Inbox, "Atomic, investable claims extracted from Source Text.", todaySignals.length, "Created today", compactDetails([
      pendingSignals.length ? `${pendingSignals.length} pending` : "",
      needsReviewSignals.length ? `${needsReviewSignals.length} need review` : "",
    ]), "No active signals. The next replay will automatically populate this view."),
    stage("logic", "Logic Chain", "/logic-chains", GitBranch, "Linked causal theses that connect Signals to affected assets.", activeChains.length, "Active", compactDetails([
      reviewingChains.length ? `${reviewingChains.length} reviewing` : "",
      strengtheningChains.length ? `${strengtheningChains.length} strengthening` : "",
    ]), "Waiting for qualified Signals."),
    stage("evidence", "Evidence", "/logic-chains", SearchCheck, "Supporting and contradicting observations attached to active Logic Chains.", evidenceCount, "Observations", compactDetails([
      activeChains.length ? `${activeChains.length} Chains monitored` : "",
    ]), "Waiting for live research evidence."),
    stage("metric", "Metric", "/signal-monitor", BarChart3, "Executable monitoring metrics scheduled against active Logic Chains.", metricCount, "Tracking", compactDetails([
      activeChains.filter((chain) => !chainMetricCount(chain)).length ? `${activeChains.filter((chain) => !chainMetricCount(chain)).length} awaiting metrics` : "",
    ]), "Waiting for metrics to be scheduled."),
    stage("committee", "Committee", "/committee", Users, "Decision outcomes produced from evidence-backed research objects.", state.committeeReports.length, "Decisions", compactDetails([
      committee.buy ? `${committee.buy} BUY` : "", committee.watch ? `${committee.watch} WATCH` : "", committee.reject ? `${committee.reject} REJECT` : "",
    ]), "Waiting for Committee-ready research."),
    stage("watchlist", "Watchlist", "/watchlist", Eye, "Approved or monitored assets retained for ongoing decision tracking.", state.watchlist.length, "Tracking", compactDetails([
      todayWatchlist.length ? `${todayWatchlist.length} updated today` : "",
    ]), "Waiting for an approved Committee decision."),
  ];

  return {
    pipeline,
    workflow: workflowEvents(state, now),
    queue: researchQueue(state),
    topChains: [...activeChains].sort((a, b) => b.confidenceScore - a.confidenceScore).slice(0, 6),
    recentlyAdded: [...state.watchlist].sort((a, b) => timestamp(b.addedAt) - timestamp(a.addedAt)).slice(0, 3),
    recentlyUpdated: [...state.watchlist].filter((item) => item.updatedAt || item.changeType === "Status changed").sort((a, b) => timestamp(b.updatedAt ?? b.addedAt) - timestamp(a.updatedAt ?? a.addedAt)).slice(0, 3),
    highestConfidence: [...state.watchlist].filter((item) => state.committeeReports.some((report) => report.id === item.sourceObjectId && report.finalConfidenceScore > 0)).sort((a, b) => reportConfidence(state.committeeReports, b) - reportConfidence(state.committeeReports, a)).slice(0, 3),
  };
}

function workflowEvents(state: DecisionLoopState, now: Date): WorkflowEvent[] {
  const events: WorkflowEvent[] = [];
  const todaySignals = state.signals.filter((signal) => isSameDay(signal.createdAt, now));
  const sourceIds = new Set(todaySignals.map(sourceIdentity).filter(Boolean));
  if (sourceIds.size) pushEvent(events, "sources", earliest(todaySignals.map((signal) => signal.createdAt)), `${sourceIds.size} Source${sourceIds.size === 1 ? "" : "s"} Imported`, `${todaySignals.length} Signals linked to today's Source material.`, "/signal-monitor", RadioTower);
  if (todaySignals.length) pushEvent(events, "signals", earliest(todaySignals.map((signal) => signal.createdAt)), `${todaySignals.length} Signal${todaySignals.length === 1 ? "" : "s"} Created`, "Atomic research claims entered the Signal Inbox.", "/signal-inbox", Inbox);
  const todayChains = state.logicChains.filter((chain) => Boolean(chain.created_at && isSameDay(chain.created_at, now)));
  if (todayChains.length) pushEvent(events, "chains", earliest(todayChains.map((chain) => chain.created_at!)), `${todayChains.length} Logic Chain${todayChains.length === 1 ? "" : "s"} Generated`, "Qualified Signals were linked into causal research theses.", "/logic-chains", GitBranch);
  const scheduledMetrics = todayChains.reduce((total, chain) => total + chainMetricCount(chain), 0);
  if (scheduledMetrics) pushEvent(events, "metrics", latest(todayChains.map((chain) => chain.lastCheckedAt ?? chain.created_at!)), `${scheduledMetrics} Metrics Scheduled`, "Monitoring conditions are ready for the next validation run.", "/signal-monitor", BarChart3);
  const todayCommittee = state.committeeReports.filter((report) => isSameDay(report.createdAt, now));
  if (todayCommittee.length) pushEvent(events, "committee", latest(todayCommittee.map((report) => report.createdAt)), `${todayCommittee.length} Committee Update${todayCommittee.length === 1 ? "" : "s"}`, "New research decisions are ready for review.", "/committee", Users);
  const todayWatchlist = state.watchlist.filter((item) => isSameDay(item.updatedAt ?? item.addedAt, now));
  if (todayWatchlist.length) pushEvent(events, "watchlist", latest(todayWatchlist.map((item) => item.updatedAt ?? item.addedAt)), `${todayWatchlist.length} Watchlist Change${todayWatchlist.length === 1 ? "" : "s"}`, "Decision outcomes changed active monitoring state.", "/watchlist", Eye);
  return events.sort((a, b) => a.timestamp - b.timestamp);
}

function researchQueue(state: DecisionLoopState): QueueLane[] {
  const reportsByChain = new Map(state.committeeReports.map((report) => [report.linkedLogicChainId, report]));
  const chainsById = new Map(state.logicChains.map((chain) => [chain.id, chain]));
  const lanes: Record<string, QueueItem[]> = { review: [], evidence: [], metrics: [], committee: [], archived: [] };
  for (const signal of state.signals) {
    const base = { id: signal.id, title: signal.title, priority: signal.priorityScore };
    if (signal.status === "ARCHIVED") {
      lanes.archived.push({ ...base, meta: signal.archiveReason ?? signal.validationOutcome ?? "Historical research retained", href: "/signal-inbox" });
      continue;
    }
    if (needsReview(signal) || !signal.linkedLogicChainId) {
      lanes.review.push({ ...base, meta: signal.qualityIssues?.[0] ?? "Human validation required", href: `/signal-inbox?ticker=${signal.relatedTickers[0] ?? ""}` });
      continue;
    }
    const chain = chainsById.get(signal.linkedLogicChainId);
    if (!chain) continue;
    if (!chain.evidenceFor.length && !chain.evidenceAgainst.length) {
      lanes.evidence.push({ ...base, meta: chain.title, href: `/logic-chains?focus=${chain.id}` });
    } else if (!chainMetricCount(chain)) {
      lanes.metrics.push({ ...base, meta: chain.title, href: `/logic-chains?focus=${chain.id}` });
    } else if (!reportsByChain.has(chain.id) && !chain.linkedCommitteeReportId) {
      lanes.committee.push({ ...base, meta: chain.title, href: "/committee" });
    }
  }
  for (const items of Object.values(lanes)) items.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return [
    { id: "review", title: "Needs Review", description: "Quality or linkage requires a human decision.", href: "/signal-inbox", items: lanes.review, tone: "bg-amber-100 text-amber-800" },
    { id: "evidence", title: "Needs Evidence", description: "A thesis exists but lacks validation evidence.", href: "/logic-chains", items: lanes.evidence, tone: "bg-blue-100 text-blue-800" },
    { id: "metrics", title: "Waiting Metrics", description: "Evidence exists; monitoring is not executable yet.", href: "/signal-monitor", items: lanes.metrics, tone: "bg-violet-100 text-violet-800" },
    { id: "committee", title: "Ready Committee", description: "Research is prepared for a decision review.", href: "/committee", items: lanes.committee, tone: "bg-emerald-100 text-emerald-800" },
    { id: "archived", title: "Archived", description: "Completed research retained with full history.", href: "/signal-inbox", items: lanes.archived, tone: "bg-slate-200 text-slate-700" },
  ];
}

function committeeColumns(reports: CommitteeReport[]) {
  return [
    { label: "BUY", items: reports.filter((report) => report.finalDecision === "APPROVE"), className: "bg-emerald-50 text-emerald-950" },
    { label: "WATCH", items: reports.filter((report) => ["WATCH", "RESEARCH_MORE"].includes(report.finalDecision)), className: "bg-amber-50 text-amber-950" },
    { label: "REJECT", items: reports.filter((report) => report.finalDecision === "REJECT"), className: "bg-red-50 text-red-950" },
  ];
}

function stage(id: string, label: string, href: string, icon: LucideIcon, description: string, value: number, primaryLabel: string, details: string[], empty: string): PipelineStage {
  return { id, label, href, icon, description, primary: value ? String(value) : undefined, primaryLabel: value ? primaryLabel : undefined, details, empty };
}

function committeeCounts(reports: CommitteeReport[]) {
  return reports.reduce((counts, report) => {
    if (report.finalDecision === "APPROVE") counts.buy += 1;
    else if (report.finalDecision === "REJECT") counts.reject += 1;
    else counts.watch += 1;
    return counts;
  }, { buy: 0, watch: 0, reject: 0 });
}

function needsReview(signal: Signal) {
  return signal.status === "NEEDS_REVIEW" || signal.qualityStatus === "NEEDS_REVIEW" || signal.reviewRequired === true;
}

function chainMetricCount(chain: LogicChain) {
  return new Set([...(chain.followUpIndicators ?? []), ...(chain.monitoringSignals ?? []).map((metric) => metric.key)]).size;
}

function signalDirection(signal: Signal | undefined, chain: LogicChain) {
  const direction = signal?.expectedDirection ?? signal?.researchDirection?.toUpperCase();
  if (direction === "BEARISH") return "Bear";
  if (direction === "BULLISH") return "Bull";
  if (direction === "MIXED") return "Mixed";
  if (direction === "NEUTRAL") return "Neutral";
  return chain.bullCase && chain.bearCase ? "Conditional" : "Unspecified";
}

function sourceIdentity(signal: Signal) {
  return signal.sourceTextId ?? signal.source_post_id ?? signal.sourceEvidence?.[0]?.sourceTextId ?? "";
}

function pushEvent(events: WorkflowEvent[], id: string, value: string, title: string, detail: string, href: string, icon: LucideIcon) {
  const eventTime = timestamp(value);
  if (!eventTime) return;
  events.push({ id, time: new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(eventTime)), timestamp: eventTime, title, detail, href, icon });
}

function reportConfidence(reports: CommitteeReport[], item: WatchlistItem) {
  return reports.find((report) => report.id === item.sourceObjectId)?.finalConfidenceScore ?? 0;
}

function compactDetails(values: string[]) { return values.filter(Boolean).slice(0, 3); }
function earliest(values: string[]) { return [...values].sort((a, b) => timestamp(a) - timestamp(b))[0] ?? ""; }
function latest(values: string[]) { return [...values].sort((a, b) => timestamp(b) - timestamp(a))[0] ?? ""; }
function timestamp(value: string) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : 0; }
function isSameDay(value: string, day: Date) { const date = new Date(value); return Number.isFinite(date.getTime()) && date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate(); }
function formatShortDate(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date) : "Pending"; }
function statusLabel(status: string) { return status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function providerLabel(rate: number | null, unavailable: boolean) { return rate === null ? unavailable ? "Standby" : "Checking" : rate >= 0.99 ? "Online" : rate >= 0.9 ? "Degraded" : "Offline"; }
