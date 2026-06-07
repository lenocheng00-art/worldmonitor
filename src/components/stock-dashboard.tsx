"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, FlaskConical, Inbox, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfidenceBar, RatingBadge, SectionHeader } from "@/components/research-ui";
import { calendarEvents, researchStocks, type StockGroup } from "@/lib/research-data";
import { useAlanSignals } from "@/lib/use-alan-signals";
import { cn } from "@/lib/utils";

const groups: Array<StockGroup | "All"> = [
  "All",
  "AI Infra",
  "Semiconductor",
  "Space / Defense",
  "Agriculture",
  "China Tech",
  "Crypto Related",
];

const entityTickers: Record<string, string[]> = {
  Google: ["GOOGL"],
  Broadcom: ["AVGO"],
  Vertiv: ["VRT"],
  "Constellation Energy": ["CEG"],
  SpaceX: ["RKLB"],
  Anthropic: ["AMZN", "GOOGL"],
};

export function StockDashboard() {
  const [activeGroup, setActiveGroup] = useState<StockGroup | "All">("All");
  const [signals] = useAlanSignals();

  const filteredStocks = useMemo(
    () => researchStocks.filter((stock) => activeGroup === "All" || stock.group === activeGroup),
    [activeGroup],
  );

  const signalCatalysts = useMemo(() => {
    const mapping = new Map<string, string>();
    signals.forEach((signal) => {
      entityTickers[signal.entity]?.forEach((ticker) => mapping.set(ticker, signal.thesis));
    });
    return mapping;
  }, [signals]);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <SectionHeader
          icon={Star}
          title="Research Watchlist"
          description="Cross-sector valuation, catalyst, and conviction monitor."
          action={
            <Badge variant="outline" className="shrink-0">
              {filteredStocks.length} securities
            </Badge>
          }
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {groups.map((group) => (
            <Button
              key={group}
              variant={activeGroup === group ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setActiveGroup(group)}
            >
              {group}
            </Button>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1380px] text-left text-sm">
              <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Company</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Market cap</th>
                  <th className="px-4 py-3 font-semibold">PE / PS</th>
                  <th className="px-4 py-3 font-semibold">Latest catalyst</th>
                  <th className="px-4 py-3 font-semibold">AI rating</th>
                  <th className="px-4 py-3 font-semibold">Confidence</th>
                  <th className="px-4 py-3 font-semibold">Research actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStocks.map((stock) => {
                  const alanCatalyst = signalCatalysts.get(stock.ticker);

                  return (
                    <tr key={stock.ticker} className="align-top hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <div className="font-semibold">{stock.company}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-primary">{stock.ticker}</span>
                          <span className="text-xs text-muted-foreground">{stock.group}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold">{stock.price}</div>
                        <div className={cn("mt-1 text-xs font-semibold", stock.change.startsWith("+") ? "text-emerald-700" : "text-red-700")}>
                          {stock.change}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium">{stock.marketCap}</td>
                      <td className="px-4 py-4">
                        <div>{stock.pe}</div>
                        <div className="mt-1 text-xs text-muted-foreground">PS {stock.ps}</div>
                      </td>
                      <td className="max-w-sm px-4 py-4">
                        <p className="leading-5">{alanCatalyst ?? stock.catalyst}</p>
                        {alanCatalyst ? (
                          <Badge variant="outline" className="mt-2 border-amber-200 bg-amber-50 text-amber-900">
                            Alan Chan signal
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <RatingBadge rating={stock.rating} />
                      </td>
                      <td className="px-4 py-4">
                        <ConfidenceBar value={stock.confidence} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-44 flex-col items-start gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/committee?topic=${encodeURIComponent(`${stock.ticker} investment review`)}&signal=${stock.ticker}`}>
                              <Users className="size-4" />
                              Committee View
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/backtest-lab?strategy=ai-capex&logic=${stock.ticker}`}>
                              <FlaskConical className="size-4" />
                              Backtest History
                            </Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/signal-inbox?ticker=${stock.ticker}`}>
                              <Inbox className="size-4" />
                              Related Signals
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <CalendarPanel title="Earnings Calendar" filter="Earnings" />
        <CalendarPanel title="Key Catalyst Calendar" filter="All" />
      </section>
    </div>
  );
}

function CalendarPanel({ title, filter }: { title: string; filter: "Earnings" | "All" }) {
  const events = calendarEvents.filter((event) => filter === "All" || event.type === filter);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {events.map((event) => (
          <div key={event.id} className="flex items-center gap-4 px-5 py-4">
            <div className="w-14 shrink-0 text-sm font-semibold text-primary">{event.date}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{event.title}</span>
                <Badge variant={event.importance === "High" ? "destructive" : "outline"}>{event.importance}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {event.type} · {event.tickers.join(", ")}
              </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
