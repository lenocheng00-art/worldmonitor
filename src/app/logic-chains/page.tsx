import { Suspense } from "react";
import { LogicChainDashboard } from "@/components/logic-chain-dashboard";
import { PageHeader } from "@/components/page-header";

export default function LogicChainsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Causal research engine"
        title="Logic Chain Dashboard"
        description="Turn events into explicit transmission paths, affected assets, scenarios, confidence, and follow-up indicators."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border bg-muted/30" />}>
        <LogicChainDashboard />
      </Suspense>
    </div>
  );
}
