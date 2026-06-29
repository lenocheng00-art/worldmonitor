import { PageHeader } from "@/components/page-header";
import { PortfolioSettingsDashboard } from "@/components/portfolio-settings-dashboard";

export default function PortfolioSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Local data portability"
        title="Portfolio Settings"
        description="Export, import, restore, clear, and audit browser-local Portfolio Register data."
      />
      <PortfolioSettingsDashboard />
    </div>
  );
}
