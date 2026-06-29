"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  GitBranch,
  Link2,
  Plus,
  ShieldX,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfidenceBar, SectionHeader } from "@/components/research-ui";
import { type LogicChain } from "@/lib/decision-loop-data";
import { useDecisionLoop } from "@/lib/decision-loop-store";
import { cn } from "@/lib/utils";

const validationVariant = {
  Active: "outline",
  Validating: "secondary",
  Confirmed: "secondary",
  Broken: "destructive",
} as const;

export function LogicChainDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");
  const {
    state,
    createLogicChain,
    sendLogicChainToCommittee,
    runBacktestFromLogicChain,
    updateLogicChainValidation,
  } = useDecisionLoop();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [trigger, setTrigger] = useState("");
  const [assets, setAssets] = useState("");

  useEffect(() => {
    if (!focus) return;
    window.setTimeout(() => document.getElementById(focus)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }, [focus]);

  function addChain() {
    if (!title.trim() || !trigger.trim()) return;
    createLogicChain({
      title: title.trim(),
      triggerEvent: trigger.trim(),
      transmissionPath: ["Observe trigger", "Validate transmission", "Measure asset response"],
      affectedAssets: assets.split(",").map((item) => item.trim()).filter(Boolean),
      bullCase: "The expected transmission strengthens with confirming operating data.",
      bearCase: "The relationship breaks or was already priced in.",
      confidenceScore: 55,
      followUpIndicators: ["Price action", "Volume", "Next data release"],
      validationStatus: "Active",
      evidenceFor: [],
      evidenceAgainst: [],
      historicalHitRate: 50,
      nextDataPoint: "Next relevant disclosure",
    });
    setTitle("");
    setTrigger("");
    setAssets("");
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={GitBranch}
        title="Active Logic Chains"
        description="Causal paths with live validation status, evidence, object links, and historical tests."
        action={<Button size="sm" onClick={() => setShowForm((value) => !value)}>{showForm ? <X className="size-4" /> : <Plus className="size-4" />}{showForm ? "Close" : "New chain"}</Button>}
      />

      {showForm ? (
        <div className="grid gap-3 border-b pb-6 md:grid-cols-[1fr_1.4fr_1fr_auto]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Chain title" className="h-10 rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <input value={trigger} onChange={(event) => setTrigger(event.target.value)} placeholder="Trigger event" className="h-10 rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <input value={assets} onChange={(event) => setAssets(event.target.value)} placeholder="Assets, comma separated" className="h-10 rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <Button onClick={addChain}>Add chain</Button>
        </div>
      ) : null}

      {!state.logicChains.length ? (
        <Card><CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center"><GitBranch className="size-7 text-muted-foreground" /><div><div className="font-semibold">No logic chains yet</div><p className="text-sm text-muted-foreground">Create one manually or from a Signal.</p></div></CardContent></Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {state.logicChains.map((chain) => (
            <LogicChainCard
              key={chain.id}
              chain={chain}
              linkedSignalTitle={state.signals.find((signal) => signal.id === chain.triggerSignalId)?.title}
              onBacktest={() => {
                const result = runBacktestFromLogicChain(chain.id);
                if (result) router.push(`/backtest-lab?result=${result.id}`);
              }}
              onCommittee={() => {
                const report = sendLogicChainToCommittee(chain.id);
                if (report) router.push(`/committee?report=${report.id}`);
              }}
              onConfirm={() => updateLogicChainValidation(chain.id, "Confirmed")}
              onBreak={() => updateLogicChainValidation(chain.id, "Broken")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LogicChainCard({ chain, linkedSignalTitle, onBacktest, onCommittee, onConfirm, onBreak }: {
  chain: LogicChain;
  linkedSignalTitle?: string;
  onBacktest: () => void;
  onCommittee: () => void;
  onConfirm: () => void;
  onBreak: () => void;
}) {
  return (
    <Card id={chain.id} className={cn("scroll-mt-24 overflow-hidden", chain.validationStatus === "Broken" && "border-red-300")}>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={validationVariant[chain.validationStatus]}>{chain.validationStatus}</Badge>
              {linkedSignalTitle ? <Badge variant="outline"><Link2 className="mr-1 size-3" /> Signal linked</Badge> : null}
            </div>
            <CardTitle className="mt-3 text-lg">{chain.title}</CardTitle>
          </div>
          <ConfidenceBar value={chain.confidenceScore} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <Detail label="Trigger Event" value={chain.triggerEvent} />
        <div>
          <Label>Transmission Path</Label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {chain.transmissionPath.map((step, index) => (
              <div key={`${step}-${index}`} className="contents">
                <span className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs font-medium">{step}</span>
                {index < chain.transmissionPath.length - 1 ? <ArrowRight className="size-3.5 text-muted-foreground" /> : null}
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Detail label="Bull Case" value={chain.bullCase} />
          <Detail label="Bear Case" value={chain.bearCase} />
        </div>
        <div className="grid gap-4 border-y py-4 sm:grid-cols-2">
          <List label="Evidence For" values={chain.evidenceFor} empty="Waiting for confirmation" tone="positive" />
          <List label="Evidence Against" values={chain.evidenceAgainst} empty="No contradicting evidence" tone="negative" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Historical Hit Rate" value={`${chain.historicalHitRate}%`} />
          <Metric label="Next Data Point" value={chain.nextDataPoint} />
          <Metric label="Last Checked" value={new Date(chain.lastCheckedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
        </div>
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <Tags label="Affected Assets" values={chain.affectedAssets} />
          <Tags label="Follow-up Indicators" values={chain.followUpIndicators} />
          <Tags label="Linked Portfolio Assets" values={chain.related_asset_ids ?? []} />
        </div>
        <div className="grid gap-2 border-t pt-4 text-xs sm:grid-cols-3">
          <Linked label="Signal" value={linkedSignalTitle ?? chain.triggerSignalId} />
          <Linked label="Committee" value={chain.linkedCommitteeReportId} />
          <Linked label="Backtest" value={chain.linkedBacktestId} />
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button size="sm" onClick={onBacktest}><FlaskConical className="size-4" /> Test This Logic</Button>
          <Button size="sm" variant="outline" onClick={onCommittee}><Users className="size-4" /> Committee Review</Button>
          <Button size="sm" variant="outline" onClick={onConfirm} disabled={chain.validationStatus === "Confirmed"}><CheckCircle2 className="size-4" /> Mark Confirmed</Button>
          <Button size="sm" variant="outline" onClick={onBreak} disabled={chain.validationStatus === "Broken"}><ShieldX className="size-4" /> Mark Broken</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase text-muted-foreground">{children}</div>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div><Label>{label}</Label><p className="mt-1 text-sm leading-6">{value}</p></div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div><Label>{label}</Label><div className="mt-1 text-sm font-semibold leading-5">{value}</div></div>;
}
function Tags({ label, values }: { label: string; values: string[] }) {
  return <div><Label>{label}</Label><div className="mt-2 flex flex-wrap gap-1.5">{values.map((value) => <Badge key={value} variant="outline">{value}</Badge>)}</div></div>;
}
function List({ label, values, empty, tone }: { label: string; values: string[]; empty: string; tone: "positive" | "negative" }) {
  return <div><Label>{label}</Label>{values.length ? <ul className={cn("mt-2 space-y-1.5 text-sm", tone === "positive" ? "text-emerald-800" : "text-red-800")}>{values.map((value) => <li key={value}>• {value}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">{empty}</p>}</div>;
}
function Linked({ label, value }: { label: string; value?: string }) {
  return <div><span className="text-muted-foreground">{label}: </span><span className="font-medium">{value ?? "Not linked"}</span></div>;
}
