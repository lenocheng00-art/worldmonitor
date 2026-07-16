import { PageHeader } from "@/components/page-header";
import { WatchlistDashboard } from "@/components/watchlist-dashboard";

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approved research conclusions"
        title="Watchlist"
        description="Track approved tickers with direct backlinks to their source Signal, Logic Chain, Committee decision, and validation evidence."
      />
      <WatchlistDashboard />
    </div>
  );
}
