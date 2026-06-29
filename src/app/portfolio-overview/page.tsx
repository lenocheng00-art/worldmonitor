import { PortfolioOverviewDashboard } from "@/components/portfolio-v12-dashboards";
import { PageHeader } from "@/components/page-header";

export default function PortfolioOverviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Executive portfolio dashboard"
        title="Portfolio Overview"
        description="Net worth, liquidity, confidence, stale data, near-term cash flow, and high-priority asset work."
      />
      <PortfolioOverviewDashboard />
    </div>
  );
}
