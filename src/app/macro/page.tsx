import { TrendingUp } from "lucide-react";
import { CompanyPage } from "@/components/company-page";
import { getLiveMarketData } from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";

export default async function MacroPage() {
  const { marketGroups } = await getLiveMarketData();

  return (
    <CompanyPage
      eyebrow="Market backdrop"
      title="Macro"
      description="DXY, US10Y, Gold, and WTI Oil context for global risk, liquidity, and inflation pressure."
      icon={TrendingUp}
      items={marketGroups.macro}
    />
  );
}
