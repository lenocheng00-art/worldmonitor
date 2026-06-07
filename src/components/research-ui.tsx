import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Direction, Rating } from "@/lib/research-data";

export function SectionHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-card">
          <Icon className="size-4 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action ? <div className="self-start sm:self-auto">{action}</div> : null}
    </div>
  );
}

export function DirectionLabel({ direction }: { direction: Direction }) {
  const config = {
    Positive: { icon: ArrowUpRight, className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    Negative: { icon: ArrowDownRight, className: "text-red-700 bg-red-50 border-red-200" },
    Mixed: { icon: ArrowRight, className: "text-amber-800 bg-amber-50 border-amber-200" },
  };
  const { icon: Icon, className } = config[direction];

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold", className)}>
      <Icon className="size-3.5" />
      {direction}
    </span>
  );
}

export function RatingBadge({ rating }: { rating: Rating }) {
  const variant = rating === "Bullish" ? "secondary" : rating === "Bearish" ? "destructive" : "outline";
  return <Badge variant={variant}>{rating}</Badge>;
}

export function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 65 ? "bg-blue-500" : "bg-amber-500";

  return (
    <div className="min-w-24">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Confidence</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
