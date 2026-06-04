import { Building2 } from "lucide-react";
import { CompanyPage } from "@/components/company-page";
import { marketGroups } from "@/lib/data";

export default function AiLabsPage() {
  return (
    <CompanyPage
      eyebrow="Frontier model labs"
      title="AI Labs"
      description="Mock operating indicators for OpenAI, Anthropic, xAI, and DeepSeek."
      icon={Building2}
      items={marketGroups.aiLabs}
    />
  );
}
