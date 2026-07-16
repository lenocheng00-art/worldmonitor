"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Cloud, Inbox, RadioTower } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { extractAlanSignals } from "@/lib/alan-chan-parser";
import { useDecisionLoop } from "@/lib/decision-loop-store";

export function SignalMonitor() {
  const { state, createSignal, error } = useDecisionLoop();
  const [sourceText, setSourceText] = useState("");
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const alanSignals = state.signals.filter((signal) => signal.original_source === "Alan Chan").slice(0, 8);

  function extractAndSave() {
    const parsed = extractAlanSignals(sourceText);
    parsed.forEach((signal) => createSignal({
      id: `signal-alan-${signal.id}`,
      title: signal.entity,
      source: "Alan Chan",
      originalText: signal.sourceExcerpt,
      summary: signal.thesis,
      original_source: "Alan Chan",
      original_text: signal.sourceExcerpt,
      source_url: null,
      source_type: "MEMBERSHIP_POST",
      created_at: new Date().toISOString(),
      confidence: signal.priority === "High" ? 90 : signal.priority === "Medium" ? 70 : 50,
      tags: [signal.category, signal.priority],
      related_companies: [signal.entity],
      extractedSignal: signal.thesis,
      relatedTickers: inferTickers(signal.entity),
      relatedIndustryChains: [],
      priorityScore: signal.priority === "High" ? 90 : signal.priority === "Medium" ? 70 : 50,
      tracking_frequency: "weekly",
    }));
    setCreatedCount(parsed.length);
    if (parsed.length) setSourceText("");
  }

  return (
    <div className="space-y-5">
      {error ? <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}
      <Card className="overflow-hidden border-primary/20">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><RadioTower className="size-4 text-primary" /> Alan Chan Source Text</CardTitle>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Paste source text to extract structured Signals. Industry Chain is no longer required; category context is retained as tags.</p>
            </div>
            <Badge variant="outline" className="gap-1.5"><Cloud className="size-3.5" /> Supabase primary</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <textarea
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Paste Alan Chan members-only source text here…"
            className="min-h-52 w-full resize-y rounded-md border bg-background p-4 text-sm leading-6 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {createdCount === null ? "Signals will enter Signal Inbox immediately after extraction." : createdCount ? `${createdCount} Signal${createdCount === 1 ? "" : "s"} saved to the cloud Inbox.` : "No supported signal pattern was found."}
            </div>
            <Button onClick={extractAndSave} disabled={!sourceText.trim()}><Inbox className="size-4" /> Extract to Signal Inbox</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Recent Source Signals</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/signal-inbox">Open Inbox <ArrowRight className="size-4" /></Link></Button>
          </div>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {alanSignals.length ? alanSignals.map((signal) => (
            <div key={signal.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{signal.title}</div>
                <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{signal.summary}</div>
              </div>
              <span className="text-sm font-semibold text-primary">{signal.priorityScore}</span>
              <Badge variant="outline">{signal.status}</Badge>
              <Badge variant={signal.linkedLogicChainId ? "secondary" : "outline"}>{signal.linkedLogicChainId ? "Logic linked" : "Needs Logic"}</Badge>
            </div>
          )) : <div className="px-5 py-10 text-center text-sm text-muted-foreground">No Alan Chan Signals have been imported.</div>}
        </CardContent>
      </Card>
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
