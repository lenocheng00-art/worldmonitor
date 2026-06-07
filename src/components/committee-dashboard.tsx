"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Scale,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfidenceBar, SectionHeader } from "@/components/research-ui";
import {
  buildMockCommitteeReport,
  type AgentVote,
  type CommitteeReport,
  type CommitteeView,
} from "@/lib/decision-data";
import { logicChains } from "@/lib/research-data";
import { useCommitteeReports } from "@/lib/use-decision-runs";
import { cn } from "@/lib/utils";

const decisionVariant = {
  Long: "secondary",
  Watch: "outline",
  Avoid: "destructive",
  Short: "destructive",
  "Backtest First": "outline",
} as const;

export function CommitteeDashboard() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get("topic") ?? "AI infrastructure capex acceleration";
  const initialSignal = searchParams.get("signal") ?? "google-capex";
  const [reports, setReports] = useCommitteeReports();
  const [selectedId, setSelectedId] = useState(reports[0]?.id ?? "");
  const [topic, setTopic] = useState(initialTopic);
  const [triggerSignalId, setTriggerSignalId] = useState(initialSignal);
  const [isRunning, setIsRunning] = useState(false);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedId) ?? reports[0],
    [reports, selectedId],
  );

  async function runCommittee() {
    if (!topic.trim()) return;
    setIsRunning(true);
    try {
      const response = await fetch("/api/committee/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), triggerSignalId }),
      });
      const report = response.ok
        ? ((await response.json()) as CommitteeReport)
        : buildMockCommitteeReport(topic.trim(), triggerSignalId);
      setReports((current) => [report, ...current]);
      setSelectedId(report.id);
    } finally {
      setIsRunning(false);
    }
  }

  if (!selectedReport) return null;

  const voteCounts = countVotes(selectedReport.agentVotes);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="h-fit">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <BrainCircuit className="size-4 text-primary" />
              Convene Committee
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Topic</span>
              <textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="min-h-24 w-full resize-y rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Trigger / logic chain</span>
              <select
                value={triggerSignalId}
                onChange={(event) => setTriggerSignalId(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {logicChains.map((chain) => (
                  <option key={chain.id} value={chain.id}>{chain.title}</option>
                ))}
                <option value="manual-signal">Manual signal</option>
              </select>
            </label>
            <Button className="w-full" onClick={runCommittee} disabled={isRunning || !topic.trim()}>
              <Users className="size-4" />
              {isRunning ? "Agents deliberating..." : "Run six-agent review"}
            </Button>
            <div className="grid grid-cols-3 gap-2 border-t pt-4 text-center">
              <VoteCount label="Bull" value={voteCounts.Bullish} tone="positive" />
              <VoteCount label="Neutral" value={voteCounts.Neutral} tone="neutral" />
              <VoteCount label="Bear" value={voteCounts.Bearish} tone="negative" />
            </div>
          </CardContent>
        </Card>

        <CommitteeSummary report={selectedReport} />
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={Users}
          title="Agent Deliberation"
          description="Independent mandates, explicit disagreement, and auditable follow-up data."
          action={<Badge variant="outline">{selectedReport.agentVotes.length} agents</Badge>}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {selectedReport.agentVotes.map((vote) => (
            <AgentVoteCard key={vote.agentName} vote={vote} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={Clock3}
          title="Committee Run History"
          description="Persistent run cards preserve prior decisions and their linked evidence."
        />
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Topic</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Tickers</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {reports.map((report) => (
                  <tr key={report.id} className={cn("hover:bg-muted/30", selectedReport.id === report.id && "bg-muted/40")}>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3 font-medium">{report.topic}</td>
                    <td className="px-4 py-3"><Badge variant={decisionVariant[report.finalDecision]}>{report.finalDecision}</Badge></td>
                    <td className="px-4 py-3">{report.confidenceScore}</td>
                    <td className="px-4 py-3">{report.relatedTickers.join(", ")}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedId(report.id)}>
                        Review <ArrowRight className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function CommitteeSummary({ report }: { report: CommitteeReport }) {
  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="border-b bg-primary text-primary-foreground">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase text-primary-foreground/70">Committee Report</div>
            <CardTitle className="mt-2 max-w-2xl text-2xl text-primary-foreground">{report.topic}</CardTitle>
          </div>
          <Badge className="bg-white text-primary hover:bg-white">{report.finalDecision}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryMetric label="Final confidence" value={`${report.confidenceScore}/100`} />
          <SummaryMetric label="Time horizon" value={report.timeHorizon} />
          <SummaryMetric label="Position sizing" value={report.positionSizing} />
        </div>
        <div className="grid gap-5 border-y py-5 lg:grid-cols-2">
          <ReportField label="Trigger Signal" value={report.triggerSignal} />
          <ReportField label="Stop Loss Logic" value={report.stopLossLogic} />
          <TagField label="Related Tickers" values={report.relatedTickers} />
          <TagField label="Industry Chains" values={report.relatedIndustryChains} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ListField label="Risk Notes" values={report.riskNotes} icon={ShieldAlert} />
          <ListField label="Follow-up Indicators" values={report.followUpIndicators} icon={CheckCircle2} />
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-5">
          <Button asChild>
            <Link href={`/backtest-lab?strategy=ai-capex&logic=${report.linkedLogicChainId}&committee=${report.id}`}>
              Run linked backtest <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/logic-chains?focus=${report.linkedLogicChainId}`}>Open logic chain</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentVoteCard({ vote }: { vote: AgentVote }) {
  const icon = vote.view === "Bullish" ? ArrowUpRight : vote.view === "Bearish" ? ArrowDownRight : Scale;
  const Icon = icon;
  const tone = vote.view === "Bullish"
    ? "border-t-emerald-500"
    : vote.view === "Bearish"
      ? "border-t-red-500"
      : "border-t-amber-500";

  return (
    <Card className={cn("overflow-hidden border-t-4", tone)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{vote.agentName}</CardTitle>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{vote.mandate}</p>
          </div>
          <Badge variant={vote.view === "Bullish" ? "secondary" : vote.view === "Bearish" ? "destructive" : "outline"}>
            <Icon className="mr-1 size-3.5" />
            {vote.view}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ConfidenceBar value={vote.confidence} />
        <ReportField label="Key Reason" value={vote.keyReason} />
        <ReportField label="Key Risk" value={vote.keyRisk} />
        <ReportField label="Suggested Action" value={vote.suggestedAction} />
        <TagField label="Follow-up Data" values={vote.followUpData} />
      </CardContent>
    </Card>
  );
}

function VoteCount({ label, value, tone }: { label: string; value: number; tone: "positive" | "neutral" | "negative" }) {
  const tones = { positive: "text-emerald-700", neutral: "text-amber-700", negative: "text-red-700" };
  return (
    <div>
      <div className={cn("text-2xl font-semibold", tones[tone])}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold leading-5">{value}</div>
    </div>
  );
}

function ReportField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  );
}

function TagField({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">{values.map((value) => <Badge key={value} variant="outline">{value}</Badge>)}</div>
    </div>
  );
}

function ListField({
  label,
  values,
  icon: Icon,
}: {
  label: string;
  values: string[];
  icon: typeof ShieldAlert;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <ul className="space-y-2 text-sm">
        {values.map((value) => (
          <li key={value} className="flex gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function countVotes(votes: AgentVote[]): Record<CommitteeView, number> {
  return votes.reduce(
    (counts, vote) => ({ ...counts, [vote.view]: counts[vote.view] + 1 }),
    { Bullish: 0, Neutral: 0, Bearish: 0 },
  );
}
