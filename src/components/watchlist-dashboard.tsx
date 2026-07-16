"use client";

import Link from "next/link";
import { ArrowRight, Eye, GitBranch, Loader2, RadioTower, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDecisionLoop } from "@/lib/decision-loop-store";

export function WatchlistDashboard() {
  const { state, ready, error } = useDecisionLoop();
  const items = [...state.watchlist].sort(
    (a, b) => new Date(b.updatedAt ?? b.addedAt).getTime() - new Date(a.updatedAt ?? a.addedAt).getTime(),
  );

  if (!ready) {
    return <Card><CardContent className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" /> Loading cloud Watchlist</CardContent></Card>;
  }

  return (
    <div className="space-y-5">
      {error ? <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div> : null}
      {!items.length ? (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <Eye className="size-8 text-muted-foreground" />
            <div><div className="font-semibold">No approved ideas yet</div><p className="mt-1 text-sm text-muted-foreground">Committee-approved tickers will appear here with their source IDs and decision context.</p></div>
            <Button asChild><Link href="/committee">Open Committee <ArrowRight className="size-4" /></Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => {
            const signals = state.signals.filter((signal) => item.linkedSignalIds.includes(signal.id));
            const report = state.committeeReports.find((candidate) => candidate.id === item.sourceObjectId);
            const chain = report
              ? state.logicChains.find((candidate) => candidate.id === report.linkedLogicChainId)
              : state.logicChains.find((candidate) => candidate.id === item.sourceObjectId);
            return (
              <Card key={item.ticker} className="overflow-hidden">
                <CardHeader className="border-b">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.changeType ?? "Added"} · {formatDate(item.updatedAt ?? item.addedAt)}</div>
                      <CardTitle className="mt-2 text-2xl">{item.ticker}</CardTitle>
                    </div>
                    <Badge variant={item.committeeView === "APPROVE" ? "secondary" : "outline"}>{item.committeeView}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Entry trigger" value={item.entryTrigger} />
                    <Field label="Invalidation" value={item.invalidationLevel} />
                    <Field label="Backtest edge" value={item.backtestEdge} />
                    <Field label="Suggested action" value={item.suggestedAction} />
                  </div>
                  <div className="grid gap-3 border-t pt-4 sm:grid-cols-3">
                    <ObjectLink icon={RadioTower} label="Signal" value={signals[0]?.title ?? item.linkedSignalIds[0] ?? "Not linked"} href={signals[0] ? `/signal-inbox?ticker=${item.ticker}` : undefined} />
                    <ObjectLink icon={GitBranch} label="Logic Chain" value={chain?.title ?? "Not linked"} href={chain ? `/logic-chains?focus=${chain.id}` : undefined} />
                    <ObjectLink icon={Users} label="Committee" value={report?.topic ?? (item.sourceObjectId.startsWith("committee-") ? item.sourceObjectId : "Not linked")} href={report ? `/committee?report=${report.id}` : undefined} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div><p className="mt-1 text-sm leading-6">{value}</p></div>;
}

function ObjectLink({ icon: Icon, label, value, href }: { icon: typeof Eye; label: string; value: string; href?: string }) {
  const content = <><Icon className="size-4 shrink-0 text-primary" /><div className="min-w-0"><div className="text-xs text-muted-foreground">{label}</div><div className="truncate text-xs font-medium">{value}</div></div></>;
  return href
    ? <Link href={href} className="flex items-center gap-2 rounded-md border p-2 transition hover:bg-muted/50">{content}</Link>
    : <div className="flex items-center gap-2 rounded-md border p-2">{content}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
