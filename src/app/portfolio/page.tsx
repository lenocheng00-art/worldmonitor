import { PageHeader } from "@/components/page-header";
import { PortfolioRegister } from "@/components/portfolio-register";

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manual register and exposure map"
        title="Portfolio Register"
        description="Track accounts, custodians, asset types, liquidity, risk, and valuation method inside the WorldMonitor research terminal."
      />
      <PortfolioRegister />
    </div>
  );
}
