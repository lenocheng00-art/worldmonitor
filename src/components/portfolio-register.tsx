"use client";

import { useMemo, useState } from "react";
import { Banknote, BarChart3, BriefcaseBusiness, Coins, Filter, LockKeyhole, PieChart, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/research-ui";
import {
  accountTypeOptions,
  assetTypeOptions,
  currencyOptions,
  custodianOptions,
  liquidityOptions,
  mockPortfolioAssets,
  regionOptions,
  riskOptions,
  statusOptions,
  type PortfolioAsset,
} from "@/lib/portfolio-data";
import { cn } from "@/lib/utils";

type FilterKey = "account_type" | "custodian" | "region" | "asset_type" | "currency" | "liquidity_tier" | "risk_level" | "status";
type FilterState = Record<FilterKey, string>;

const filterOptions = [
  { key: "account_type", label: "Account Type", values: accountTypeOptions },
  { key: "custodian", label: "Custodian", values: custodianOptions },
  { key: "region", label: "Region", values: regionOptions },
  { key: "asset_type", label: "Asset Type", values: assetTypeOptions },
  { key: "currency", label: "Currency", values: currencyOptions },
  { key: "liquidity_tier", label: "Liquidity", values: liquidityOptions },
  { key: "risk_level", label: "Risk", values: riskOptions },
  { key: "status", label: "Status", values: statusOptions },
] satisfies { key: FilterKey; label: string; values: readonly string[] }[];

const emptyFilters: FilterState = Object.fromEntries(filterOptions.map((item) => [item.key, "all"])) as FilterState;

export function PortfolioRegister() {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const assets = mockPortfolioAssets;

  const filteredAssets = useMemo(
    () => assets.filter((asset) => filterOptions.every(({ key }) => filters[key] === "all" || asset[key] === filters[key])),
    [assets, filters],
  );

  const summary = useMemo(() => {
    const total = sum(filteredAssets);
    const cashBank = sum(filteredAssets.filter((asset) => ["mainland_bank", "hong_kong_bank", "macau_bank"].includes(asset.account_type) && ["cash", "deposit"].includes(asset.asset_type)));
    const brokerage = sum(filteredAssets.filter((asset) => asset.account_type === "brokerage"));
    const privateMarket = sum(filteredAssets.filter((asset) => asset.account_type === "private_equity_register"));
    const cryptoPrediction = sum(filteredAssets.filter((asset) => ["crypto_exchange", "prediction_market"].includes(asset.account_type)));
    const illiquid = sum(filteredAssets.filter((asset) => ["M6_24", "Y2_PLUS", "UNKNOWN"].includes(asset.liquidity_tier)));
    return { total, cashBank, brokerage, privateMarket, cryptoPrediction, illiquid };
  }, [filteredAssets]);

  const charts = useMemo(
    () => [
      { title: "Asset Allocation by Account Type", rows: allocationRows(filteredAssets, "account_type") },
      { title: "Asset Allocation by Asset Type", rows: allocationRows(filteredAssets, "asset_type") },
      { title: "Currency Exposure", rows: allocationRows(filteredAssets, "currency") },
      { title: "Liquidity Breakdown", rows: allocationRows(filteredAssets, "liquidity_tier") },
      { title: "Risk Breakdown", rows: allocationRows(filteredAssets, "risk_level") },
    ],
    [filteredAssets],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard icon={PieChart} label="Total Net Portfolio Value" value={summary.total} />
        <SummaryCard icon={Banknote} label="Cash & Bank Balance" value={summary.cashBank} />
        <SummaryCard icon={BriefcaseBusiness} label="Brokerage Assets" value={summary.brokerage} />
        <SummaryCard icon={BarChart3} label="Private Market Assets" value={summary.privateMarket} />
        <SummaryCard icon={Coins} label="Crypto & Prediction Market Assets" value={summary.cryptoPrediction} />
        <SummaryCard icon={LockKeyhole} label="Illiquid Assets" value={summary.illiquid} />
      </div>

      <Card>
        <CardHeader>
          <SectionHeader
            icon={Filter}
            title="Portfolio Classification"
            description="Filter the register by account type, custodian, region, asset type, currency, liquidity, risk, and status."
            action={
              <Button variant="outline" size="sm" onClick={() => setFilters(emptyFilters)}>
                <RotateCcw className="size-4" />
                Reset
              </Button>
            }
          />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {filterOptions.map((option) => (
              <label key={option.key} className="space-y-1.5 text-xs font-medium text-muted-foreground">
                {option.label}
                <select
                  value={filters[option.key]}
                  onChange={(event) => setFilters((current) => ({ ...current, [option.key]: event.target.value }))}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground"
                >
                  <option value="all">All</option>
                  {option.values.map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {charts.map((chart) => (
          <AllocationPanel key={chart.title} title={chart.title} rows={chart.rows} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <SectionHeader
            icon={BriefcaseBusiness}
            title="Asset Register"
            description={`${filteredAssets.length} balances, positions, private-market entries, and liabilities tracked manually.`}
            action={<Badge variant="outline">Mock data only</Badge>}
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-[1680px] w-full text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Asset Name", "Account Type", "Custodian", "Region", "Asset Type", "Currency", "Cost Basis", "Current Value", "Liquidity", "Risk", "Status", "Valuation Method", "Next Action", "Updated At"].map((title) => (
                    <th key={title} className="px-4 py-3 font-semibold">{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="align-top">
                    <td className="px-4 py-4 font-semibold">{asset.assetName}</td>
                    <td className="px-4 py-4">{formatLabel(asset.account_type)}</td>
                    <td className="px-4 py-4">{formatLabel(asset.custodian)}</td>
                    <td className="px-4 py-4">{asset.region}</td>
                    <td className="px-4 py-4">{formatLabel(asset.asset_type)}</td>
                    <td className="px-4 py-4">{asset.currency}</td>
                    <td className="px-4 py-4 tabular-nums">{localMoney(asset.cost_basis, asset.currency)}</td>
                    <td className="px-4 py-4 tabular-nums">
                      <div className="font-semibold">{localMoney(asset.current_value, asset.currency)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{usd(asset.base_currency_value)}</div>
                    </td>
                    <td className="px-4 py-4"><Badge variant="outline">{asset.liquidity_tier}</Badge></td>
                    <td className="px-4 py-4"><RiskBadge risk={asset.risk_level} /></td>
                    <td className="px-4 py-4">{formatLabel(asset.status)}</td>
                    <td className="px-4 py-4">{formatLabel(asset.valuation_method)}</td>
                    <td className="px-4 py-4 text-muted-foreground">{asset.next_action}</td>
                    <td className="px-4 py-4 tabular-nums">{formatDate(asset.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof PieChart; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{usd(value)}</div>
        </div>
        <div className="flex size-10 items-center justify-center rounded-md border bg-muted">
          <Icon className="size-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function AllocationPanel({ title, rows }: { title: string; rows: { key: string; label: string; value: number; share: number }[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="tabular-nums text-muted-foreground">{usd(row.value)} · {(row.share * 100).toFixed(1)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, row.share * 100)}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RiskBadge({ risk }: { risk: PortfolioAsset["risk_level"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        risk === "low" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        risk === "medium" && "border-blue-200 bg-blue-50 text-blue-800",
        risk === "high" && "border-amber-200 bg-amber-50 text-amber-800",
        risk === "very_high" && "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {formatLabel(risk)}
    </Badge>
  );
}

function allocationRows(assets: PortfolioAsset[], key: FilterKey) {
  const totals = new Map<string, number>();
  for (const asset of assets) totals.set(asset[key], (totals.get(asset[key]) ?? 0) + Math.max(0, asset.base_currency_value));
  const total = [...totals.values()].reduce((acc, value) => acc + value, 0);
  return [...totals.entries()]
    .map(([rowKey, value]) => ({ key: rowKey, label: formatLabel(rowKey), value, share: total ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

function sum(assets: PortfolioAsset[]) {
  return assets.reduce((total, asset) => total + asset.base_currency_value, 0);
}

function formatLabel(value: string) {
  return value.split("_").map((part) => part.toUpperCase()).join(" ");
}

function usd(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function localMoney(value: number, currency: string) {
  const sign = value < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-HK", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" });
}
