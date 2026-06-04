import { TrendingUp } from "lucide-react";
import { CompanyPage } from "@/components/company-page";
import { marketGroups } from "@/lib/data";

export default function MacroPage() {
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
