import { Building2, Cpu, Newspaper, Orbit, TrendingUp } from "lucide-react";
import { DashboardSection } from "@/components/dashboard-section";
import { MarketKline } from "@/components/market-kline";
import { NewsFeed } from "@/components/news-feed";
import { PageHeader } from "@/components/page-header";
import { SignalCard } from "@/components/signal-card";
import { newsItems } from "@/lib/data";
import { getLiveMarketData } from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { marketGroups, overviewStats } = await getLiveMarketData();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Global operating picture"
        title="WorldMonitor"
        description="A compact command center for AI infrastructure, frontier labs, space companies, macro assets, and breaking news."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map((stat) => (
          <SignalCard key={stat.name} item={stat} />
        ))}
      </section>

      <MarketKline />

      <DashboardSection
        title="AI Infra"
        description="Semiconductor and foundry signals driving the AI buildout."
        icon={Cpu}
        href="/ai-infra"
        items={marketGroups.aiInfra}
      />

      <DashboardSection
        title="AI Labs"
        description="Frontier model labs and private company momentum."
        icon={Building2}
        href="/ai-labs"
        items={marketGroups.aiLabs}
      />

      <DashboardSection
        title="Space"
        description="Launch, satellite, and connectivity operators."
        icon={Orbit}
        href="/space"
        items={marketGroups.space}
      />

      <DashboardSection
        title="Macro"
        description="Cross-asset context that influences risk appetite."
        icon={TrendingUp}
        href="/macro"
        items={marketGroups.macro}
      />

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Newspaper className="size-4" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-normal">News Intelligence</h2>
            <p className="text-sm text-muted-foreground">Breaking context, catalysts, and signal-ranked market notes.</p>
          </div>
        </div>
        <NewsFeed items={newsItems.slice(0, 6)} />
      </section>
    </div>
  );
}
