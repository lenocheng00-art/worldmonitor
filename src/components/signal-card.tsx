import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SignalItem } from "@/lib/data";
import { cn } from "@/lib/utils";

const trendIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
};

const trendClass = {
  up: "text-emerald-700 bg-emerald-50",
  down: "text-red-700 bg-red-50",
  flat: "text-slate-700 bg-slate-100",
};

const statusVariant = {
  Watch: "outline",
  Constructive: "secondary",
  Elevated: "destructive",
  Neutral: "outline",
} as const;

export function SignalCard({ item }: { item: SignalItem }) {
  const Icon = trendIcon[item.trend];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate">{item.name}</CardTitle>
            {item.ticker ? <p className="mt-1 text-xs text-muted-foreground">{item.ticker}</p> : null}
          </div>
          <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="text-2xl font-semibold tracking-normal">{item.value}</div>
          <div className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold", trendClass[item.trend])}>
            <Icon className="size-3.5" />
            {item.change}
          </div>
        </div>
        <p className="min-h-12 text-sm leading-6 text-muted-foreground">{item.description}</p>
        <div className="grid grid-cols-3 gap-2 border-t pt-4">
          {item.metrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <div className="truncate text-xs text-muted-foreground">{metric.label}</div>
              <div className="truncate text-sm font-semibold">{metric.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
