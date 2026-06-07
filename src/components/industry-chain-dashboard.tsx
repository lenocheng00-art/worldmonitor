"use client";

import { useMemo } from "react";
import { AlertTriangle, Boxes, Building2, Layers3, RadioTower } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/research-ui";
import { semiconductorLayers } from "@/lib/research-data";
import { useAlanSignals } from "@/lib/use-alan-signals";
import { cn } from "@/lib/utils";

const layerColors = [
  "border-l-blue-500",
  "border-l-violet-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-rose-500",
];

const cycleVariant = {
  Expanding: "secondary",
  Stable: "outline",
  Cooling: "destructive",
} as const;

const entityLayer: Record<string, string> = {
  Google: "cloud",
  Broadcom: "compute",
  Vertiv: "infrastructure",
  "Constellation Energy": "infrastructure",
  Anthropic: "application",
  OpenAI: "application",
};

export function IndustryChainDashboard() {
  const [signals] = useAlanSignals();
  const signalsByLayer = useMemo(() => {
    const grouped = new Map<string, typeof signals>();
    signals.forEach((signal) => {
      const layer = entityLayer[signal.entity];
      if (!layer) return;
      grouped.set(layer, [...(grouped.get(layer) ?? []), signal]);
    });
    return grouped;
  }, [signals]);

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <ChainStat label="Current cycle" value="Expansion" note="Demand is broadening from compute into power and cooling." />
        <ChainStat label="Primary bottleneck" value="Power delivery" note="Grid interconnection and equipment lead times constrain deployments." />
        <ChainStat label="Signal density" value={`${signals.length} tracked`} note="Alan Chan signals are mapped into the relevant chain layer." />
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={Layers3}
          title="Semiconductor / AI Infrastructure"
          description="Five-layer value chain from AI application demand to physical infrastructure."
          action={<Badge variant="outline">Jensen Huang five-layer framework</Badge>}
        />

        <div className="relative space-y-4">
          <div className="absolute bottom-8 left-5 top-8 hidden w-px bg-border lg:block" />
          {semiconductorLayers.map((layer, index) => {
            const mappedSignals = signalsByLayer.get(layer.id) ?? [];

            return (
              <Card key={layer.id} className={cn("relative overflow-hidden border-l-4", layerColors[index])}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="relative z-[1] flex size-10 shrink-0 items-center justify-center rounded-md border bg-card">
                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                      </div>
                      <div>
                        <CardTitle className="text-lg">{layer.name}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{layer.subtitle}</p>
                      </div>
                    </div>
                    <Badge variant={cycleVariant[layer.cycle]}>{layer.cycle}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-5 pt-1 lg:grid-cols-[1fr_1fr_1fr_1.2fr]">
                  <ChainColumn icon={Building2} label="Representative companies">
                    <div className="flex flex-wrap gap-1.5">
                      {layer.companies.map((company) => (
                        <Badge key={company} variant="outline">{company}</Badge>
                      ))}
                    </div>
                  </ChainColumn>
                  <ChainColumn icon={Boxes} label="Core variables">
                    <CompactList items={layer.coreVariables} />
                  </ChainColumn>
                  <ChainColumn icon={AlertTriangle} label="Key risks">
                    <CompactList items={layer.risks} />
                  </ChainColumn>
                  <ChainColumn icon={RadioTower} label="Latest signal">
                    <p className="text-sm leading-6">{mappedSignals[0]?.thesis ?? layer.latestSignal}</p>
                    {mappedSignals.length ? (
                      <div className="mt-2 text-xs font-medium text-amber-800">
                        {mappedSignals.length} Alan Chan signal{mappedSignals.length > 1 ? "s" : ""} mapped here
                      </div>
                    ) : null}
                  </ChainColumn>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ChainStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border-l-2 border-primary pl-4">
      <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{note}</p>
    </div>
  );
}

function ChainColumn({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Boxes;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      {children}
    </div>
  );
}

function CompactList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

