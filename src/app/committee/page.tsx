import { Suspense } from "react";
import { CommitteeDashboard } from "@/components/committee-dashboard";
import { PageHeader } from "@/components/page-header";

export default function CommitteePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Multi-agent investment decision engine"
        title="Investment Committee"
        description="Six specialist agents debate each opportunity, surface disagreement, audit risk, and produce a position-ready committee report."
      />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg border bg-muted/30" />}>
        <CommitteeDashboard />
      </Suspense>
    </div>
  );
}
