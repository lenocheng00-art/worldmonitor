import { PageHeader } from "@/components/page-header";
import { QuantTradingDashboard } from "@/components/quant-trading-dashboard";
import { getQuantDashboardStatus } from "@/lib/quant-status";

export const dynamic = "force-dynamic";

export default async function QuantTradingPage() {
  const status = await getQuantDashboardStatus();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Simulation-first execution system"
        title="Quant Trading"
        description="A standalone HKD 300,000 satellite strategy account with deterministic backtesting, Futu OpenD paper-data wiring, and hard risk locks before any order path."
      />
      <QuantTradingDashboard status={status} />
    </div>
  );
}
