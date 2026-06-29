"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Database, ExternalLink, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/research-ui";
import { mockPortfolioAssets, readStoredPortfolioAssets, type PortfolioAsset } from "@/lib/portfolio-data";
import { cn } from "@/lib/utils";

export function PortfolioAssetDetail({ assetId }: { assetId: string }) {
  const [assets, setAssets] = useState<PortfolioAsset[]>(mockPortfolioAssets);

  useEffect(() => {
    setAssets(readStoredPortfolioAssets());
  }, []);

  const asset = useMemo(
    () => assets.find((item) => item.id === assetId) ?? mockPortfolioAssets.find((item) => item.id === assetId),
    [assetId, assets],
  );

  if (!asset) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-lg font-semibold">Asset not found</div>
            <p className="mt-2 text-sm text-muted-foreground">This manual register item may have been deleted from local state.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/portfolio">
              <ArrowLeft className="size-4" />
              Back to Portfolio
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const fields = [
    ["Asset Name", asset.assetName],
    ["Account Type", formatLabel(asset.account_type)],
    ["Custodian", formatLabel(asset.custodian)],
    ["Region", asset.region],
    ["Asset Type", formatLabel(asset.asset_type)],
    ["Currency", asset.currency],
    ["Cost Basis", localMoney(asset.cost_basis, asset.currency)],
    ["Current Value", localMoney(asset.current_value, asset.currency)],
    ["Original Currency Value", localMoney(asset.original_currency_value, asset.currency)],
    ["Base Currency", asset.base_currency],
    ["FX Rate To Base", asset.fx_rate_to_base.toLocaleString("en-US")],
    ["Base Currency Value", cny(asset.base_currency_value)],
    ["Liquidity Tier", asset.liquidity_tier],
    ["Risk Level", formatLabel(asset.risk_level)],
    ["Status", formatLabel(asset.status)],
    ["Valuation Method", formatLabel(asset.valuation_method)],
    ["Data Confidence", formatLabel(asset.data_confidence)],
    ["Last Verified At", formatDateTime(asset.last_verified_at)],
    ["Expected Exit Date", asset.expected_exit_date ?? "Not set"],
    ["Lockup End Date", asset.lockup_end_date ?? "Not set"],
    ["Related Signal", asset.related_signal_id ?? "Not linked"],
    ["Related Logic Chain", asset.related_logic_chain_id ?? "Not linked"],
    ["Related Committee Report", asset.related_committee_report_id ?? "Not linked"],
    ["Related Backtest", asset.related_backtest_id ?? "Not linked"],
    ["Next Action", asset.next_action || "None"],
    ["Notes", asset.notes || "None"],
    ["Created At", formatDateTime(asset.created_at)],
    ["Updated At", formatDateTime(asset.updated_at)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline">
          <Link href="/portfolio">
            <ArrowLeft className="size-4" />
            Back to Portfolio
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <ConfidenceBadge confidence={asset.data_confidence} />
          <Badge variant="outline">Last verified {formatDate(asset.last_verified_at)}</Badge>
          <Badge variant="outline">Base CNY</Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Base Currency Value" value={cny(asset.base_currency_value)} />
        <MetricCard label="Current Value" value={localMoney(asset.current_value, asset.currency)} />
        <MetricCard label="FX Rate" value={`${asset.currency} / CNY ${asset.fx_rate_to_base.toLocaleString("en-US")}`} />
      </div>

      <Card>
        <CardHeader>
          <SectionHeader
            icon={WalletCards}
            title="Asset Detail"
            description="Manual portfolio register record with classification, valuation, freshness, and research links."
            action={<Badge variant="outline">Local register</Badge>}
          />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {fields.map(([label, value]) => (
              <DetailField key={label} label={label} value={value} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4 text-primary" />
            Manual Maintenance Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <p>No external bank, brokerage, crypto exchange, or prediction-market API is connected in this V1.1 register.</p>
          <p>Use the Portfolio list page to edit values. Base currency value is recalculated from local mock FX rates when the asset is saved.</p>
        </CardContent>
      </Card>

      {asset.related_logic_chain_id || asset.related_committee_report_id || asset.related_backtest_id ? (
        <Card>
          <CardHeader>
            <CardTitle>Research Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {asset.related_logic_chain_id ? <LinkBadge href="/logic-chains" label="Open Logic Chains" /> : null}
            {asset.related_committee_report_id ? <LinkBadge href="/committee" label="Open Committee" /> : null}
            {asset.related_backtest_id ? <LinkBadge href="/backtest-lab" label="Open Backtest Lab" /> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 break-words text-sm font-medium">{value}</div>
    </div>
  );
}

function LinkBadge({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>
        <ExternalLink className="size-4" />
        {label}
      </Link>
    </Button>
  );
}

function ConfidenceBadge({ confidence }: { confidence: PortfolioAsset["data_confidence"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        confidence === "high" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        confidence === "medium" && "border-blue-200 bg-blue-50 text-blue-800",
        confidence === "low" && "border-amber-200 bg-amber-50 text-amber-800",
      )}
    >
      {formatLabel(confidence)} confidence
    </Badge>
  );
}

function formatLabel(value: string) {
  return value.split("_").map((part) => part.toUpperCase()).join(" ");
}

function cny(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}CNY ${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function localMoney(value: number, currency: string) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: currency === "BTC" || currency === "ETH" ? 6 : 0 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-HK", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-HK", { timeZone: "Asia/Hong_Kong" });
}
