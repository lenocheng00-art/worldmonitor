import { IndustryChainDashboard } from "@/components/industry-chain-dashboard";
import { PageHeader } from "@/components/page-header";

export default function IndustryChainsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Value-chain intelligence"
        title="Industry Chain Dashboard"
        description="Map demand, bottlenecks, risks, and investable signals from AI applications down to memory, power, and physical infrastructure."
      />
      <IndustryChainDashboard />
    </div>
  );
}

