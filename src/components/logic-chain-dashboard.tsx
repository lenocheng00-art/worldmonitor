"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FlaskConical, GitBranch, History, Plus, Sparkles, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfidenceBar, SectionHeader } from "@/components/research-ui";
import { logicChains as mockLogicChains, type LogicChain } from "@/lib/research-data";
import { useAlanSignals } from "@/lib/use-alan-signals";

const customChainsKey = "worldmonitor:custom-logic-chains";

export function LogicChainDashboard() {
  const [signals] = useAlanSignals();
  const [customChains, setCustomChains] = useState<LogicChain[]>([]);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [trigger, setTrigger] = useState("");
  const [affectedAssets, setAffectedAssets] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(customChainsKey);
    if (stored) {
      try {
        setCustomChains(JSON.parse(stored) as LogicChain[]);
      } catch {
        // Ignore malformed user drafts and preserve the built-in chains.
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      window.localStorage.setItem(customChainsKey, JSON.stringify(customChains));
    }
  }, [customChains, ready]);

  const generatedChains = useMemo(
    () =>
      signals.slice(0, 4).map<LogicChain>((signal) => ({
        id: `signal-${signal.id}`,
        title: `${signal.entity}: signal transmission`,
        trigger: signal.observableTrigger,
        path: [signal.thesis, signal.bullishCondition, `Reprice ${signal.category} assets`],
        affectedAssets: inferAssets(signal.entity),
        bullCase: signal.bullishCondition,
        bearCase: signal.bearishCondition,
        confidence: signal.confidence === "High" ? 82 : signal.confidence === "Medium" ? 68 : 52,
        followUpIndicators: signal.monitoringSources,
        source: "Alan Chan",
      })),
    [signals],
  );

  const allChains = [...mockLogicChains, ...generatedChains, ...customChains];

  function addChain() {
    if (!title.trim() || !trigger.trim()) return;

    setCustomChains((current) => [
      {
        id: `manual-${Date.now()}`,
        title: title.trim(),
        trigger: trigger.trim(),
        path: ["Observe trigger", "Validate transmission", "Monitor asset-price response"],
        affectedAssets: affectedAssets.split(",").map((item) => item.trim()).filter(Boolean),
        bullCase: "The transmission strengthens and earnings or liquidity confirm the move.",
        bearCase: "The expected relationship breaks or the market has already priced it.",
        confidence: 55,
        followUpIndicators: ["Price action", "Volume", "Next data release"],
        source: "Manual",
      },
      ...current,
    ]);
    setTitle("");
    setTrigger("");
    setAffectedAssets("");
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={GitBranch}
        title="Active Logic Chains"
        description="Trace how new information moves through rates, earnings, valuation, and asset prices."
        action={
          <Button size="sm" onClick={() => setShowForm((current) => !current)}>
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? "Close" : "New chain"}
          </Button>
        }
      />

      {showForm ? (
        <div className="grid gap-3 border-b pb-6 md:grid-cols-[1fr_1.4fr_1fr_auto]">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Chain title"
            className="h-10 rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            value={trigger}
            onChange={(event) => setTrigger(event.target.value)}
            placeholder="Trigger event"
            className="h-10 rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <input
            value={affectedAssets}
            onChange={(event) => setAffectedAssets(event.target.value)}
            placeholder="Assets, comma separated"
            className="h-10 rounded-md border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button onClick={addChain}>Add chain</Button>
        </div>
      ) : null}

      {generatedChains.length ? (
        <div className="flex items-center gap-2 border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <Sparkles className="size-4 shrink-0" />
          {generatedChains.length} logic chains were generated from the current Alan Chan signal store.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {allChains.map((chain) => (
          <LogicChainCard key={chain.id} chain={chain} />
        ))}
      </div>
    </div>
  );
}

function LogicChainCard({ chain }: { chain: LogicChain }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant={chain.source === "Alan Chan" ? "secondary" : "outline"}>{chain.source}</Badge>
            <CardTitle className="mt-3 text-lg">{chain.title}</CardTitle>
          </div>
          <ConfidenceBar value={chain.confidence} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <Detail label="Trigger Event" value={chain.trigger} />
        <div>
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Transmission Path</div>
          <div className="flex flex-wrap items-center gap-2">
            {chain.path.map((step, index) => (
              <div key={`${step}-${index}`} className="contents">
                <span className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs font-medium">{step}</span>
                {index < chain.path.length - 1 ? <ArrowRight className="size-3.5 text-muted-foreground" /> : null}
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Detail label="Bull Case" value={chain.bullCase} />
          <Detail label="Bear Case" value={chain.bearCase} />
        </div>
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <TagList label="Affected Assets" items={chain.affectedAssets} />
          <TagList label="Follow-up Indicators" items={chain.followUpIndicators} />
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button asChild size="sm">
            <Link href={`/backtest-lab?strategy=${strategyForChain(chain.id)}&logic=${chain.id}`}>
              <FlaskConical className="size-4" />
              Test This Logic
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/committee?topic=${encodeURIComponent(chain.title)}&signal=${chain.id}`}>
              <Users className="size-4" />
              Committee Review
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/backtest-lab?strategy=${strategyForChain(chain.id)}&logic=${chain.id}#trade-log`}>
              <History className="size-4" />
              Historical Validation
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
      </div>
    </div>
  );
}

function inferAssets(entity: string) {
  const mappings: Record<string, string[]> = {
    Google: ["GOOGL", "AVGO", "VRT"],
    Broadcom: ["AVGO", "NVDA", "TSM"],
    Vertiv: ["VRT", "GEV", "ETN"],
    "Constellation Energy": ["CEG", "VST", "TLN"],
    SpaceX: ["RKLB", "ASTS", "QQQ"],
    Anthropic: ["AMZN", "GOOGL", "MSFT"],
  };
  return mappings[entity] ?? [entity];
}

function strategyForChain(chainId: string) {
  if (chainId.includes("nfp") || chainId.includes("rate")) return "nfp-shock";
  if (chainId.startsWith("signal-")) return "alan-signal";
  return "ai-capex";
}
