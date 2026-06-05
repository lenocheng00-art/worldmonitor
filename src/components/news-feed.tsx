import { ExternalLink, RadioTower, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { NewsItem } from "@/lib/data";

export function NewsFeed({ items }: { items: NewsItem[] }) {
  const highSignalCount = items.filter((item) => item.category === "AI").length;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col gap-3 border-b bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <RadioTower className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Live News Desk</div>
              <p className="text-sm text-muted-foreground">AI, space, and macro catalysts scanned for investable context.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-56">
            <div className="rounded-md border bg-white px-3 py-2">
              <div className="text-xs text-muted-foreground">Items</div>
              <div className="font-mono text-lg font-semibold">{items.length}</div>
            </div>
            <div className="rounded-md border bg-white px-3 py-2">
              <div className="text-xs text-muted-foreground">AI Signals</div>
              <div className="font-mono text-lg font-semibold text-secondary">{highSignalCount}</div>
            </div>
          </div>
        </div>

        <div className="grid divide-y lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {items.map((item, index) => (
            <a
              className="group block p-5 transition hover:bg-slate-50"
              href={item.url ?? "#"}
              key={item.id}
              rel="noreferrer"
              target={item.url ? "_blank" : undefined}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.category === "AI" ? "secondary" : "outline"}>{item.category}</Badge>
                    <span className="text-xs text-muted-foreground">{item.source}</span>
                    <span className="text-xs text-muted-foreground">{item.publishedAt}</span>
                  </div>
                  <h3 className="text-base font-semibold leading-6 tracking-normal transition group-hover:text-primary">
                    {item.title}
                  </h3>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {index < 2 ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-accent/25 bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">
                      <Zap className="size-3" />
                      Hot
                    </span>
                  ) : null}
                  <ExternalLink className="size-4 text-muted-foreground transition group-hover:text-primary" />
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border px-2 py-1 text-muted-foreground">Catalyst</span>
                <span className="rounded-md border px-2 py-1 text-muted-foreground">
                  {item.category === "AI" ? "Compute demand" : "Launch cadence"}
                </span>
                <span className="rounded-md border px-2 py-1 text-muted-foreground">Monitor</span>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
