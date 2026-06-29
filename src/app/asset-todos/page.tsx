import { AssetTodosDashboard } from "@/components/portfolio-v12-dashboards";
import { PageHeader } from "@/components/page-header";

export default function AssetTodosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Verification and maintenance queue"
        title="Asset Todos"
        description="Prioritize valuation, ownership, liquidity, tax, document, and counterparty verification tasks."
      />
      <AssetTodosDashboard />
    </div>
  );
}
