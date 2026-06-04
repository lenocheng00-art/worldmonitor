import { Orbit } from "lucide-react";
import { CompanyPage } from "@/components/company-page";
import { getLiveMarketData } from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";

export default async function SpacePage() {
  const { marketGroups } = await getLiveMarketData();

  return (
    <CompanyPage
      eyebrow="Launch and orbital networks"
      title="Space"
      description="Track SpaceX, Starlink, and Rocket Lab across launch cadence, revenue momentum, and operational notes."
      icon={Orbit}
      items={marketGroups.space}
    />
  );
}
