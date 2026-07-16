import { OverviewDashboard } from "@/components/overview-dashboard";
import { PageHeader } from "@/components/page-header";
import { DatabaseStatus } from "@/components/database-status";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          eyebrow="WorldMonitor V1.8.1 — Production Burn-in"
          title="Signals Overview"
          description="See what arrived today, what needs attention, and which ideas have advanced from signal to decision."
        />
        <DatabaseStatus />
      </div>

      <OverviewDashboard />
    </div>
  );
}
