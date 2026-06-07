import { MacroDashboard } from "@/components/macro-dashboard";
import { PageHeader } from "@/components/page-header";

export default function MacroPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Macro regime and market transmission"
        title="Macro Dashboard"
        description="Economic releases, rate expectations, liquidity, and AI-assisted cross-asset impact analysis."
      />
      <MacroDashboard />
    </div>
  );
}
