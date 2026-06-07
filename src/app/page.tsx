import { MarketKline } from "@/components/market-kline";
import { NewsFeed } from "@/components/news-feed";
import { OverviewDashboard } from "@/components/overview-dashboard";
import { PageHeader } from "@/components/page-header";
import { newsItems } from "@/lib/data";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Investment research operating system"
        title="Research Overview"
        description="One operating picture for macro regime, market risk, investable signals, causal logic, and watchlist movement."
      />

      <OverviewDashboard />

      <MarketKline />

      <section className="space-y-4">
        <div className="border-b pb-4">
          <h2 className="text-lg font-semibold tracking-normal">Research Newsflow</h2>
          <p className="mt-1 text-sm text-muted-foreground">Existing news intelligence remains available as a supporting research stream.</p>
        </div>
        <NewsFeed items={newsItems.slice(0, 6)} />
      </section>
    </div>
  );
}
