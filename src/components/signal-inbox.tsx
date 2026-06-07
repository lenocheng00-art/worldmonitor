"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Inbox, RadioTower, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/research-ui";
import { extractAlanSignals, type AlanSignal } from "@/lib/alan-chan-parser";
import { useAlanSignals } from "@/lib/use-alan-signals";

const tickerMappings: Record<string, string[]> = {
  Google: ["GOOGL", "GOOG", "AVGO"],
  Broadcom: ["AVGO"],
  Vertiv: ["VRT"],
  "Constellation Energy": ["CEG"],
  SpaceX: ["RKLB", "ASTS"],
  Anthropic: ["AMZN", "GOOGL"],
  OpenAI: ["MSFT", "ORCL"],
  Polymarket: ["COIN"],
};

export function SignalInbox() {
  const [signals, setSignals] = useAlanSignals();
  const [sourceText, setSourceText] = useState("");

  const counts = useMemo(
    () => ({
      new: signals.filter((signal) => signal.status === "Watching" && !signal.latestUpdates.length).length,
      tracking: signals.filter((signal) => signal.status === "Watching" && signal.latestUpdates.length).length,
      confirmed: signals.filter((signal) => signal.status === "Confirmed").length,
      invalidated: signals.filter((signal) => signal.status === "Invalidated").length,
    }),
    [signals],
  );

  function importSignals() {
    const extracted = extractAlanSignals(sourceText);
    if (!extracted.length) return;

    setSignals((current) => {
      const existing = new Set(current.map((signal) => `${signal.entity}:${signal.sourceExcerpt}`));
      const fresh = extracted.filter((signal) => !existing.has(`${signal.entity}:${signal.sourceExcerpt}`));
      return [...fresh, ...current];
    });
    setSourceText("");
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InboxStat label="New" value={counts.new} tone="blue" />
        <InboxStat label="Tracking" value={counts.tracking} tone="amber" />
        <InboxStat label="Confirmed" value={counts.confirmed} tone="green" />
        <InboxStat label="Invalidated" value={counts.invalidated} tone="red" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="h-fit">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <RadioTower className="size-4 text-primary" />
              Alan Chan Signal Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Paste an Alan Chan members-only post. Extraction runs locally in this browser."
              className="min-h-72 w-full resize-y rounded-md border bg-background p-3 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button className="w-full" disabled={!sourceText.trim()} onClick={importSignals}>
              <Sparkles className="size-4" />
              Extract and route signals
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              Extracted signals are routed to this inbox, industry chains, logic chains, and watchlist catalysts.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/alan-chan">
                Open full Alan Chan workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <SectionHeader
            icon={Inbox}
            title="Signal Queue"
            description="Normalized research signals with ownership, cadence, and next-check metadata."
            action={<Badge variant="outline">{signals.length} total</Badge>}
          />
          {signals.length ? (
            <div className="space-y-3">
              {signals.map((signal) => <InboxSignal key={signal.id} signal={signal} />)}
            </div>
          ) : (
            <div className="border-l-2 border-primary py-8 pl-4">
              <div className="font-semibold">No signals in the inbox</div>
              <p className="mt-1 text-sm text-muted-foreground">Paste a post to create the first tracked research signal.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function InboxSignal({ signal }: { signal: AlanSignal }) {
  const status = signal.status === "Watching" ? (signal.latestUpdates.length ? "Tracking" : "New") : signal.status;
  const nextCheck = new Date(new Date(signal.lastChecked).getTime() + frequencyDays(signal.priority) * 86400000);

  return (
    <Card>
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[1.3fr_0.8fr_0.9fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Alan Chan</Badge>
            <Badge variant={status === "Confirmed" ? "secondary" : status === "Invalidated" ? "destructive" : "outline"}>
              {status}
            </Badge>
            <span className="text-xs text-muted-foreground">{signal.category}</span>
          </div>
          <h3 className="mt-3 font-semibold">{signal.entity}</h3>
          <p className="mt-1 text-sm leading-6">{signal.thesis}</p>
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Original text</summary>
            <p className="mt-2 leading-5">{signal.sourceExcerpt}</p>
          </details>
        </div>
        <div className="space-y-3">
          <InboxField label="Related tickers" value={(tickerMappings[signal.entity] ?? [signal.entity]).join(", ")} />
          <InboxField label="Industry chain" value={signal.category} />
          <InboxField label="Priority score" value={`${priorityScore(signal.priority)}/100`} />
        </div>
        <div className="space-y-3">
          <InboxField label="Tracking frequency" value={`${frequencyDays(signal.priority)} day cadence`} />
          <InboxField label="Next check date" value={nextCheck.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
          <InboxField label="Validation data" value={signal.monitoringSources.join(", ")} />
        </div>
      </CardContent>
    </Card>
  );
}

function InboxField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-5">{value}</div>
    </div>
  );
}

function InboxStat({ label, value, tone }: { label: string; value: number; tone: "blue" | "amber" | "green" | "red" }) {
  const tones = {
    blue: "border-blue-500 text-blue-700",
    amber: "border-amber-500 text-amber-800",
    green: "border-emerald-500 text-emerald-700",
    red: "border-red-500 text-red-700",
  };
  return (
    <div className={`border-l-2 pl-4 ${tones[tone]}`}>
      <div className="text-xs font-semibold uppercase">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function frequencyDays(priority: AlanSignal["priority"]) {
  return priority === "High" ? 1 : priority === "Medium" ? 3 : 7;
}

function priorityScore(priority: AlanSignal["priority"]) {
  return priority === "High" ? 90 : priority === "Medium" ? 70 : 50;
}

