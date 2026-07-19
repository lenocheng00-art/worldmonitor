import { GitCompareArrows } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ShadowDashboard } from "@/components/shadow-dashboard";

export default function ShadowDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
          <GitCompareArrows className="size-5" />
        </div>
        <PageHeader
          eyebrow="V2.1 · isolated validation"
          title="Production Shadow Mode"
          description="Read-only Production comparison, isolated replay results, and the 14-day readiness gate. This route is not part of Production navigation."
        />
      </div>
      <ShadowDashboard />
    </div>
  );
}
