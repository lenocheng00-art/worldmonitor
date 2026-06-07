import { PageHeader } from "@/components/page-header";
import { StockDashboard } from "@/components/stock-dashboard";

export default function StocksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Secondary market research"
        title="Stock Market Dashboard"
        description="Watchlists, valuations, catalysts, earnings, and AI conviction across the investable universe."
      />
      <StockDashboard />
    </div>
  );
}
