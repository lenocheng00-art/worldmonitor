import { BalanceSheetDashboard } from "@/components/portfolio-v12-dashboards";
import { PageHeader } from "@/components/page-header";

export default function BalanceSheetPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio accounting view"
        title="Balance Sheet"
        description="Assets, liabilities, net worth, account exposure, and data quality from the local Portfolio Register."
      />
      <BalanceSheetDashboard />
    </div>
  );
}
