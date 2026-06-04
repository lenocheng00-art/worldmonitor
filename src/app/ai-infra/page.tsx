import { Cpu } from "lucide-react";
import { CompanyPage } from "@/components/company-page";
import { marketGroups } from "@/lib/data";

export default function AiInfraPage() {
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
