import { Activity, ArrowRight, Banknote, Gauge, Grid3X3, Landmark, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DirectionLabel, SectionHeader } from "@/components/research-ui";
import { macroIndicators, macroRegime } from "@/lib/research-data";
import { cn } from "@/lib/utils";

const surpriseClass = {
  Above: "text-blue-700 bg-blue-50 border-blue-200",
  Below: "text-amber-800 bg-amber-50 border-amber-200",
  "In line": "text-slate-700 bg-slate-50 border-slate-200",
};

export function MacroDashboard() {
  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase">
              <Sparkles className="size-4" />
              AI Macro Summary
            </div>
            <CardTitle className="mt-3 text-2xl text-primary-foreground">{macroRegime.stance}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <p className="max-w-4xl text-sm leading-6 text-muted-foreground">{macroRegime.summary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryLine icon={Landmark} label="Rates" value={macroRegime.rates} />
              <SummaryLine icon={Banknote} label="Liquidity" value={macroRegime.liquidity} />
            </div>
            <div className="grid gap-3 border-t pt-4 sm:grid-cols-2 xl:grid-cols-4">
              {macroRegime.assetImpacts.map((impact) => (
                <div key={impact.asset} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{impact.asset}</span>
                    <DirectionLabel direction={impact.direction} />
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">{impact.note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="size-4 text-primary" />
              Regime Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RegimeGauge label="Growth" value={56} left="Weak" right="Strong" color="bg-blue-500" />
            <RegimeGauge label="Inflation" value={61} left="Cooling" right="Hot" color="bg-amber-500" />
            <RegimeGauge label="Liquidity" value={43} left="Tight" right="Loose" color="bg-emerald-500" />
            <RegimeGauge label="Risk appetite" value={52} left="Defensive" right="Aggressive" color="bg-violet-500" />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeader
          icon={Activity}
          title="Macro Indicator Board"
          description="Release surprise, direction, and market transmission in one scan."
          action={<span className="text-xs text-muted-foreground">Mock data · API-ready schema</span>}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {macroIndicators.map((indicator) => (
            <Card key={indicator.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-primary">{indicator.shortName}</div>
                    <CardTitle className="mt-1 text-base">{indicator.name}</CardTitle>
                  </div>
                  <DirectionLabel direction={indicator.direction} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Latest</div>
                    <div className="mt-1 text-2xl font-semibold">{indicator.value}</div>
                  </div>
                  <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", surpriseClass[indicator.surprise])}>
                    {indicator.surprise} expectations
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 border-y py-3">
                  <Metric label="Previous" value={indicator.previous} />
                  <Metric label="Consensus" value={indicator.consensus} />
                </div>
                <p className="min-h-20 text-sm leading-6 text-muted-foreground">{indicator.marketImpact}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Next release</span>
                  <span className="font-semibold">{indicator.nextRelease}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <AssetImpactMatrix />
    </div>
  );
}

const impactAssets = ["SPY", "QQQ", "SMH", "TLT", "GLD", "DXY", "NVDA", "AVGO", "VRT"];
const impactRows = macroIndicators.filter((item) => ["nfp", "cpi", "pce", "unemployment", "pmi", "us10y", "fedwatch"].includes(item.id));

function AssetImpactMatrix() {
  return (
    <section className="space-y-4">
      <SectionHeader
        icon={Grid3X3}
        title="Asset Impact Matrix"
        description="Current macro surprise direction translated into cross-asset implications."
      />
      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full min-w-[1120px] text-left text-xs">
          <thead className="border-b bg-muted/60 uppercase text-muted-foreground">
            <tr><th className="px-3 py-3">Driver</th>{impactAssets.map((asset) => <th key={asset} className="px-3 py-3">{asset}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {impactRows.map((row, rowIndex) => (
              <tr key={row.id}>
                <td className="px-3 py-3 font-semibold">{row.shortName}</td>
                {impactAssets.map((asset, assetIndex) => {
                  const impact = matrixImpact(rowIndex, assetIndex, row.direction);
                  return <td key={asset} className="px-3 py-3"><ImpactCell {...impact} /></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {impactRows.map((row, rowIndex) => (
          <Card key={row.id}>
            <CardHeader className="pb-3"><CardTitle className="text-base">{row.shortName} asset impact</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {impactAssets.map((asset, assetIndex) => <div key={asset} className="border-t pt-2"><div className="mb-1 text-xs font-semibold">{asset}</div><ImpactCell {...matrixImpact(rowIndex, assetIndex, row.direction)} /></div>)}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function matrixImpact(row: number, column: number, base: "Positive" | "Negative" | "Mixed") {
  const options = ["Positive", "Negative", "Mixed", "Neutral"] as const;
  const direction = options[(row + column + (base === "Positive" ? 0 : base === "Negative" ? 1 : 2)) % options.length];
  return {
    direction,
    confidence: 58 + ((row * 7 + column * 5) % 34),
    reason: direction === "Positive" ? "Supports growth or duration" : direction === "Negative" ? "Raises discount or earnings risk" : direction === "Mixed" ? "Competing rate and growth effects" : "Limited direct transmission",
  };
}

function ImpactCell({ direction, confidence, reason }: ReturnType<typeof matrixImpact>) {
  const color = direction === "Positive" ? "bg-emerald-500" : direction === "Negative" ? "bg-red-500" : direction === "Mixed" ? "bg-amber-500" : "bg-slate-400";
  return (
    <div title={reason}>
      <div className="flex items-center gap-1.5 font-semibold"><span className={`size-2 rounded-full ${color}`} />{direction}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{confidence}% · {reason}</div>
    </div>
  );
}

function SummaryLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Landmark;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4 text-primary" />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">{label}</div>
        <p className="mt-1 text-sm leading-5">{value}</p>
      </div>
    </div>
  );
}

function RegimeGauge({
  label,
  value,
  left,
  right,
  color,
}: {
  label: string;
  value: number;
  left: string;
  right: string;
  color: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{left}</span>
        <ArrowRight className="size-3" />
        <span>{right}</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
