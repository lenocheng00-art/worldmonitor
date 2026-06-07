import Link from "next/link";
import { Database, ExternalLink, KeyRound, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

const settings = [
  { icon: Database, title: "Data connections", text: "Macro, fundamentals, earnings, news, and market-data adapters.", status: "Mock mode" },
  { icon: KeyRound, title: "Credentials", text: "API keys will remain server-side when live data sources are connected.", status: "Not configured" },
  { icon: Settings2, title: "Research preferences", text: "Default confidence thresholds, cadence, and alert routing.", status: "Local defaults" },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace configuration"
        title="Settings"
        description="Manage future data connections, research defaults, and operational integrations."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {settings.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <item.icon className="size-4 text-primary" />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="min-h-16 text-sm leading-6 text-muted-foreground">{item.text}</p>
              <div className="mt-4 border-t pt-4 text-xs font-semibold text-primary">{item.status}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-6">
        <Button asChild variant="outline"><Link href="/news">Legacy News <ExternalLink className="size-4" /></Link></Button>
        <Button asChild variant="outline"><Link href="/signal-monitor">Signal Monitor <ExternalLink className="size-4" /></Link></Button>
        <Button asChild variant="outline"><Link href="/ai-infra">Legacy AI Infra <ExternalLink className="size-4" /></Link></Button>
      </div>
    </div>
  );
}

