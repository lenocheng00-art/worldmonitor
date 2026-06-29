import { CashFlowDashboard } from "@/components/portfolio-v12-dashboards";
import { PageHeader } from "@/components/page-header";

export default function CashFlowPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manual cash movement register"
        title="Cash Flow"
        description="Track inflows, outflows, recurring items, and asset-linked cash movements in CNY base currency."
      />
      <CashFlowDashboard />
    </div>
  );
}
