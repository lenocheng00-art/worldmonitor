import { Cpu } from "lucide-react";
import { CompanyPage } from "@/components/company-page";
import { getLiveMarketData } from "@/lib/yahoo-finance";

export const dynamic = "force-dynamic";

export default async function AiInfraPage() {
  const { marketGroups } = await getLiveMarketData();

  return (
    <CompanyPage
      eyebrow="AI compute supply chain"
      title="AI Infra"
      description="Nvidia, AMD, Broadcom, and TSMC performance, capacity, and risk signals."
      icon={Cpu}
      items={marketGroups.aiInfra}
    />
  );
}
