import { Suspense } from "react";
import { BacktestLab } from "@/components/backtest-lab";
import { PageHeader } from "@/components/page-header";

export default function BacktestLabPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hypothesis validation and simulation"
        title="Backtest Lab"
        description="Translate committee assumptions into explicit rules, benchmark them, inspect drawdowns, and preserve reproducible run cards."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border bg-muted/30" />}>
        <BacktestLab />
      </Suspense>
    </div>
  );
}
