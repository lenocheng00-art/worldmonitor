"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, FlaskConical, Inbox, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingBadge, SectionHeader } from "@/components/research-ui";
import { calendarEvents, researchStocks, type ResearchStock, type StockGroup } from "@/lib/research-data";
import { useDecisionLoop } from "@/lib/decision-loop-store";
import { cn } from "@/lib/utils";

const groups: Array<StockGroup | "All"> = ["All", "AI Infra", "Semiconductor", "Space / Defense", "Agriculture", "China Tech", "Crypto Related"];

export function StockDashboard() {
  const { state } = useDecisionLoop();
  const [activeGroup, setActiveGroup] = useState<StockGroup | "All">("All");
  const [selectedTicker, setSelectedTicker] = useState("AVGO");
  const filteredStocks = useMemo(() => researchStocks.filter((stock) => activeGroup === "All" || stock.group === activeGroup), [activeGroup]);
  const selected = researchStocks.find((stock) => stock.ticker === selectedTicker) ?? filteredStocks[0];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <SectionHeader
          icon={Star}
          title="Position Candidate Table"
          description="Research objects, entry conditions, invalidation, committee view, and backtest edge in one decision surface."
          action={<Badge variant="outline">{filteredStocks.length} securities</Badge>}
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {groups.map((group) => <Button key={group} variant={activeGroup === group ? "default" : "outline"} size="sm" className="shrink-0" onClick={() => setActiveGroup(group)}>{group}</Button>)}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <div>
            <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
              <table className="w-full min-w-[1680px] text-left text-sm">
                <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    {["Company", "Price", "Market cap", "PE / PS", "Entry Trigger", "Invalidation Level", "Linked Signals", "Committee View", "Backtest Edge", "Suggested Action"].map((title) => <th key={title} className="px-4 py-3">{title}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStocks.map((stock) => {
                    const context = stockContext(stock, state);
                    return (
                      <tr key={stock.ticker} onClick={() => setSelectedTicker(stock.ticker)} className={cn("cursor-pointer align-top hover:bg-muted/30", selectedTicker === stock.ticker && "bg-muted/40")}>
                        <td className="px-4 py-4"><div className="font-semibold">{stock.company}</div><div className="mt-1 text-xs text-primary">{stock.ticker} · {stock.group}</div></td>
                        <td className="px-4 py-4"><div className="font-semibold">{stock.price}</div><div className={cn("mt-1 text-xs font-semibold", stock.change.startsWith("+") ? "text-emerald-700" : "text-red-700")}>{stock.change}</div></td>
                        <td className="px-4 py-4">{stock.marketCap}</td>
                        <td className="px-4 py-4">{stock.pe}<div className="text-xs text-muted-foreground">PS {stock.ps}</div></td>
                        <td className="max-w-60 px-4 py-4">{context.entryTrigger}</td>
                        <td className="max-w-56 px-4 py-4">{context.invalidation}</td>
                        <td className="px-4 py-4"><Badge variant="outline">{context.signals.length}</Badge></td>
                        <td className="px-4 py-4"><Badge variant="outline">{context.committeeView}</Badge></td>
                        <td className="px-4 py-4 font-semibold text-emerald-700">{context.backtestEdge}</td>
                        <td className="max-w-52 px-4 py-4">{context.action}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {filteredStocks.map((stock) => <StockMobileCard key={stock.ticker} stock={stock} context={stockContext(stock, state)} onClick={() => setSelectedTicker(stock.ticker)} />)}
            </div>
          </div>
          {selected ? <StockDecisionCard stock={selected} context={stockContext(selected, state)} /> : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <CalendarPanel title="Earnings Calendar" filter="Earnings" />
        <CalendarPanel title="Key Catalyst Calendar" filter="All" />
      </section>
    </div>
  );
}

function stockContext(stock: ResearchStock, state: ReturnType<typeof useDecisionLoop>["state"]) {
  const signals = state.signals.filter((signal) => signal.relatedTickers.includes(stock.ticker));
  const report = state.committeeReports.find((item) => item.relatedTickers.includes(stock.ticker));
  const result = state.backtestResults.find((item) => item.linkedSignalId && signals.some((signal) => signal.id === item.linkedSignalId));
  const watch = state.watchlist.find((item) => item.ticker === stock.ticker);
  return {
    signals,
    chains: state.logicChains.filter((chain) => chain.affectedAssets.includes(stock.ticker)),
    report,
    result,
    entryTrigger: watch?.entryTrigger ?? stock.catalyst,
    invalidation: watch?.invalidationLevel ?? "Earnings revisions turn negative",
    committeeView: report?.finalDecision ?? watch?.committeeView ?? "Pending",
    backtestEdge: result ? `${(result.totalReturn - result.benchmarkReturn).toFixed(1)}%` : watch?.backtestEdge ?? "Not tested",
    action: watch?.suggestedAction ?? (stock.rating === "Bullish" ? "Research entry" : "Watch"),
  };
}

function StockDecisionCard({ stock, context }: { stock: ResearchStock; context: ReturnType<typeof stockContext> }) {
  return (
    <Card className="h-fit xl:sticky xl:top-24">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-semibold text-primary">{stock.ticker}</div><CardTitle className="mt-1 text-lg">{stock.company}</CardTitle></div><RatingBadge rating={stock.rating} /></div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <DecisionField label="Current Thesis" value={context.signals[0]?.extractedSignal ?? stock.catalyst} />
        <div className="grid grid-cols-2 gap-3"><DecisionMetric label="Committee" value={context.committeeView} /><DecisionMetric label="Backtest Edge" value={context.backtestEdge} /></div>
        <DecisionField label="Entry / Exit Logic" value={`${context.entryTrigger}. Invalidate when: ${context.invalidation}.`} />
        <DecisionField label="Main Risk" value={context.result?.mainRisk ?? "Catalyst timing, valuation compression, and weak price confirmation."} />
        <DecisionField label="Next Catalyst" value={stock.catalyst} />
        <div><div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Related Research</div><div className="flex flex-wrap gap-1.5"><Badge variant="outline">{context.signals.length} signals</Badge><Badge variant="outline">{context.chains.length} logic chains</Badge><Badge variant="outline">{context.result ? "Backtested" : "No backtest"}</Badge></div></div>
        <div className="grid gap-2 border-t pt-4">
          <Button asChild variant="outline"><a href={`/committee?report=${context.report?.id ?? ""}`}><Users className="size-4" /> Committee View</a></Button>
          <Button asChild variant="outline"><a href={`/backtest-lab?result=${context.result?.id ?? ""}`}><FlaskConical className="size-4" /> Backtest History</a></Button>
          <Button asChild variant="outline"><a href={`/signal-inbox?ticker=${stock.ticker}`}><Inbox className="size-4" /> Related Signals</a></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StockMobileCard({ stock, context, onClick }: { stock: ResearchStock; context: ReturnType<typeof stockContext>; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-md border bg-card p-4 text-left">
      <div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{stock.company}</div><div className="text-xs text-primary">{stock.ticker}</div></div><div className="text-right"><div className="font-semibold">{stock.price}</div><div className="text-xs">{stock.change}</div></div></div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs"><DecisionMetric label="Committee" value={context.committeeView} /><DecisionMetric label="Backtest" value={context.backtestEdge} /></div>
      <p className="mt-3 text-sm leading-5 text-muted-foreground">{context.action}</p>
    </button>
  );
}

function DecisionField({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div><p className="mt-1 text-sm leading-6">{value}</p></div>;
}
function DecisionMetric({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></div>;
}

function CalendarPanel({ title, filter }: { title: string; filter: "Earnings" | "All" }) {
  const events = calendarEvents.filter((event) => filter === "All" || event.type === filter);
  return (
    <Card>
      <CardHeader className="border-b"><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4 text-primary" />{title}</CardTitle></CardHeader>
      <CardContent className="divide-y p-0">
        {events.map((event) => <div key={event.id} className="flex items-center gap-4 px-5 py-4"><div className="w-14 shrink-0 text-sm font-semibold text-primary">{event.date}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{event.title}</span><Badge variant={event.importance === "High" ? "destructive" : "outline"}>{event.importance}</Badge></div><div className="mt-1 text-xs text-muted-foreground">{event.type} · {event.tickers.join(", ")}</div></div><ChevronRight className="size-4 text-muted-foreground" /></div>)}
      </CardContent>
    </Card>
  );
}
