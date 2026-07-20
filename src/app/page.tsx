import { MarketKline } from "@/components/market-kline";
import { NewsFeed } from "@/components/news-feed";
import { OverviewDashboard } from "@/components/overview-dashboard";
import { PageHeader } from "@/components/page-header";
import { DatabaseStatus } from "@/components/database-status";
import { newsItems } from "@/lib/data";
import { getFutuAccountView } from "@/lib/futu-account-provider";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const futuAccount = await getFutuAccountView();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          eyebrow="Investment research operating system"
          title="Research Overview"
          description="One operating picture for macro regime, market risk, investable signals, causal logic, and watchlist movement."
        />
        <DatabaseStatus />
      </div>

      <OverviewDashboard futuAccount={futuAccount} />

      <div className="hidden md:block">
        <MarketKline />
      </div>

      <section className="hidden space-y-4 md:block">
        <div className="border-b pb-4">
          <h2 className="text-lg font-semibold tracking-normal">Research Newsflow</h2>
          <p className="mt-1 text-sm text-muted-foreground">Existing news intelligence remains available as a supporting research stream.</p>
        </div>
        <NewsFeed items={newsItems.slice(0, 6)} />
      </section>
    </div>
  );
}
