"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Coins,
  Eye,
  FilePenLine,
  Filter,
  LockKeyhole,
  PieChart,
  Plus,
  RotateCcw,
  Trash2,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/research-ui";
import {
  accountTypeOptions,
  assetTypeOptions,
  buildPortfolioAsset,
  currencyOptions,
  custodianOptions,
  dataConfidenceOptions,
  fxRatesToCny,
  liquidityOptions,
  readStoredPortfolioAssets,
  regionOptions,
  riskOptions,
  statusOptions,
  toPortfolioFormValues,
  valuationMethodOptions,
  writeStoredPortfolioAssets,
  type PortfolioAsset,
  type PortfolioAssetFormValues,
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
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [editingAsset, setEditingAsset] = useState<PortfolioAsset | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    setAssets(readStoredPortfolioAssets());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStoredPortfolioAssets(assets);
  }, [assets, hydrated]);

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

  const accountSummary = useMemo(() => buildAccountSummary(filteredAssets), [filteredAssets]);
  const freshness = useMemo(() => buildFreshness(filteredAssets), [filteredAssets]);

  function openAddForm() {
    setEditingAsset(null);
    setFormOpen(true);
  }

  function openEditForm(asset: PortfolioAsset) {
    setEditingAsset(asset);
    setFormOpen(true);
  }

  function saveAsset(values: PortfolioAssetFormValues) {
    const nextAsset = buildPortfolioAsset(values, editingAsset ?? undefined);
    setAssets((current) => {
      if (!editingAsset) return [nextAsset, ...current];
      return current.map((asset) => (asset.id === editingAsset.id ? nextAsset : asset));
    });
    setEditingAsset(null);
    setFormOpen(false);
  }

  function deleteAsset(assetId: string) {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) return;
    if (window.confirm(`Delete ${asset.assetName}?`)) {
      setAssets((current) => current.filter((item) => item.id !== assetId));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-muted-foreground">Base currency</div>
          <div className="mt-1 text-lg font-semibold">CNY manual FX register</div>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="size-4" />
          Add Asset
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard icon={PieChart} label="Total Net Portfolio Value" value={summary.total} />
        <SummaryCard icon={Banknote} label="Cash & Bank Balance" value={summary.cashBank} />
        <SummaryCard icon={BriefcaseBusiness} label="Brokerage Assets" value={summary.brokerage} />
        <SummaryCard icon={BarChart3} label="Private Market Assets" value={summary.privateMarket} />
        <SummaryCard icon={Coins} label="Crypto & Prediction Market Assets" value={summary.cryptoPrediction} />
        <SummaryCard icon={LockKeyhole} label="Illiquid Assets" value={summary.illiquid} />
      </div>

      {formOpen ? (
        <PortfolioAssetForm
          asset={editingAsset}
          onCancel={() => {
            setEditingAsset(null);
            setFormOpen(false);
          }}
          onSubmit={saveAsset}
        />
      ) : null}

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

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <AccountSummaryPanel rows={accountSummary} />
        <DataFreshnessPanel freshness={freshness} />
      </div>

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
            action={<Badge variant="outline">Local manual state</Badge>}
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-[1900px] w-full text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Asset Name", "Account Type", "Custodian", "Region", "Asset Type", "Currency", "Cost Basis", "Current Value", "Base Value", "Liquidity", "Risk", "Status", "Valuation Method", "Confidence", "Last Verified", "Next Action", "Updated At", "Actions"].map((title) => (
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
                    <td className="px-4 py-4 tabular-nums">{localMoney(asset.current_value, asset.currency)}</td>
                    <td className="px-4 py-4 tabular-nums">
                      <div className="font-semibold">{cny(asset.base_currency_value)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">FX {asset.fx_rate_to_base.toLocaleString("en-US")}</div>
                    </td>
                    <td className="px-4 py-4"><Badge variant="outline">{asset.liquidity_tier}</Badge></td>
                    <td className="px-4 py-4"><RiskBadge risk={asset.risk_level} /></td>
                    <td className="px-4 py-4">{formatLabel(asset.status)}</td>
                    <td className="px-4 py-4">{formatLabel(asset.valuation_method)}</td>
                    <td className="px-4 py-4"><ConfidenceBadge confidence={asset.data_confidence} /></td>
                    <td className="px-4 py-4 tabular-nums">{formatDate(asset.last_verified_at)}</td>
                    <td className="px-4 py-4 text-muted-foreground">{asset.next_action}</td>
                    <td className="px-4 py-4 tabular-nums">{formatDate(asset.updated_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/portfolio/${asset.id}`}>
                            <Eye className="size-4" />
                            Details
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditForm(asset)}>
                          <FilePenLine className="size-4" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteAsset(asset.id)}>
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </div>
                    </td>
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

function PortfolioAssetForm({
  asset,
  onCancel,
  onSubmit,
}: {
  asset: PortfolioAsset | null;
  onCancel: () => void;
  onSubmit: (values: PortfolioAssetFormValues) => void;
}) {
  const [values, setValues] = useState<PortfolioAssetFormValues>(() => toPortfolioFormValues(asset ?? undefined));
  const fxRate = fxRatesToCny[values.currency] ?? 1;
  const previewValue = (Number(values.current_value) || 0) * fxRate;

  function update<K extends keyof PortfolioAssetFormValues>(key: K, value: PortfolioAssetFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          icon={WalletCards}
          title={asset ? "Edit Asset" : "Add Asset"}
          description="Manual asset maintenance. FX conversion is calculated from mock CNY rates stored in the app."
          action={<Badge variant="outline">No external API</Badge>}
        />
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(values);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="Name" value={values.name} onChange={(value) => update("name", value)} />
            <SelectField label="Account Type" value={values.account_type} values={accountTypeOptions} onChange={(value) => update("account_type", value)} />
            <SelectField label="Custodian" value={values.custodian} values={custodianOptions} onChange={(value) => update("custodian", value)} />
            <SelectField label="Region" value={values.region} values={regionOptions} onChange={(value) => update("region", value)} />
            <SelectField label="Asset Type" value={values.asset_type} values={assetTypeOptions} onChange={(value) => update("asset_type", value)} />
            <SelectField label="Currency" value={values.currency} values={currencyOptions} onChange={(value) => update("currency", value)} />
            <NumberField label="Cost Basis" value={values.cost_basis} onChange={(value) => update("cost_basis", value)} />
            <NumberField label="Current Value" value={values.current_value} onChange={(value) => update("current_value", value)} />
            <SelectField label="Liquidity Tier" value={values.liquidity_tier} values={liquidityOptions} onChange={(value) => update("liquidity_tier", value)} />
            <SelectField label="Risk Level" value={values.risk_level} values={riskOptions} onChange={(value) => update("risk_level", value)} />
            <SelectField label="Status" value={values.status} values={statusOptions} onChange={(value) => update("status", value)} />
            <SelectField label="Valuation Method" value={values.valuation_method} values={valuationMethodOptions} onChange={(value) => update("valuation_method", value)} />
            <SelectField label="Data Confidence" value={values.data_confidence} values={dataConfidenceOptions} onChange={(value) => update("data_confidence", value)} />
            <DateTimeField label="Last Verified At" value={values.last_verified_at} onChange={(value) => update("last_verified_at", value)} />
            <DateField label="Expected Exit Date" value={values.expected_exit_date} onChange={(value) => update("expected_exit_date", value)} />
            <DateField label="Lockup End Date" value={values.lockup_end_date} onChange={(value) => update("lockup_end_date", value)} />
          </div>

          <div className="grid gap-3 xl:grid-cols-[1fr_1fr_280px]">
            <TextField label="Next Action" value={values.next_action} onChange={(value) => update("next_action", value)} />
            <TextField label="Notes" value={values.notes} onChange={(value) => update("notes", value)} />
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Manual FX Preview</div>
              <div className="mt-2 font-semibold tabular-nums">{values.currency} to CNY: {fxRate.toLocaleString("en-US")}</div>
              <div className="mt-1 text-muted-foreground tabular-nums">Base value: {cny(previewValue)}</div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit">{asset ? "Save Changes" : "Add Asset"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <input type="number" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" />
    </label>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" />
    </label>
  );
}

function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" />
    </label>
  );
}

function SelectField<T extends string>({ label, value, values, onChange }: { label: string; value: T; values: readonly T[]; onChange: (value: T) => void }) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className="h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground">
        {values.map((item) => (
          <option key={item} value={item}>{formatLabel(item)}</option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{cny(value)}</div>
        </div>
        <div className="flex size-10 items-center justify-center rounded-md border bg-muted">
          <Icon className="size-5 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function AccountSummaryPanel({ rows }: { rows: { key: string; label: string; value: number; count: number; share: number }[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Account Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="tabular-nums text-muted-foreground">{cny(row.value)} · {row.count} item{row.count === 1 ? "" : "s"}</span>
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

function DataFreshnessPanel({ freshness }: { freshness: { high: number; medium: number; low: number; stale: number; oldestVerified: string | null } }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Data Freshness / Data Confidence</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <FreshnessMetric label="High Confidence" value={freshness.high} />
        <FreshnessMetric label="Medium Confidence" value={freshness.medium} />
        <FreshnessMetric label="Low Confidence" value={freshness.low} />
        <FreshnessMetric label="Verify Soon" value={freshness.stale} />
        <div className="rounded-md border p-3 sm:col-span-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Oldest Verification</div>
          <div className="mt-2 font-semibold">{freshness.oldestVerified ? formatDate(freshness.oldestVerified) : "No verification records"}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function FreshnessMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
    </div>
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
              <span className="tabular-nums text-muted-foreground">{cny(row.value)} · {(row.share * 100).toFixed(1)}%</span>
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
      {formatLabel(confidence)}
    </Badge>
  );
}

function allocationRows(assets: PortfolioAsset[], key: FilterKey) {
  const totals = new Map<string, number>();
  for (const asset of assets) totals.set(asset[key], (totals.get(asset[key]) ?? 0) + positiveExposure(asset));
  const total = [...totals.values()].reduce((acc, value) => acc + value, 0);
  return [...totals.entries()]
    .map(([rowKey, value]) => ({ key: rowKey, label: formatLabel(rowKey), value, share: total ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

function buildAccountSummary(assets: PortfolioAsset[]) {
  const totals = new Map<string, { label: string; value: number; count: number }>();
  for (const asset of assets) {
    const key = accountSummaryKey(asset);
    const current = totals.get(key) ?? { label: accountSummaryLabel(asset), value: 0, count: 0 };
    totals.set(key, {
      ...current,
      value: current.value + asset.base_currency_value,
      count: current.count + 1,
    });
  }
  const positiveTotal = [...totals.values()].reduce((acc, row) => acc + Math.max(0, row.value), 0);
  return [...totals.entries()]
    .map(([key, row]) => ({ key, ...row, share: positiveTotal ? Math.max(0, row.value) / positiveTotal : 0 }))
    .sort((a, b) => b.value - a.value);
}

function buildFreshness(assets: PortfolioAsset[]) {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return {
    high: assets.filter((asset) => asset.data_confidence === "high").length,
    medium: assets.filter((asset) => asset.data_confidence === "medium").length,
    low: assets.filter((asset) => asset.data_confidence === "low").length,
    stale: assets.filter((asset) => now - new Date(asset.last_verified_at).getTime() > thirtyDays || asset.data_confidence === "low").length,
    oldestVerified: assets.map((asset) => asset.last_verified_at).sort()[0] ?? null,
  };
}

function accountSummaryKey(asset: PortfolioAsset) {
  if (asset.account_type === "private_equity_register") return "private_equity_register";
  return asset.custodian;
}

function accountSummaryLabel(asset: PortfolioAsset) {
  if (asset.account_type === "private_equity_register") return "Private Equity Register";
  const labels: Record<PortfolioAsset["custodian"], string> = {
    mainland_bank: "Mainland Bank",
    hsbc_hk: "HSBC Hong Kong",
    boc_macau: "BOC Macau",
    futu: "Futu",
    binance: "Binance",
    polymarket: "Polymarket",
    manual: "Manual Other",
  };
  return labels[asset.custodian];
}

function positiveExposure(asset: PortfolioAsset) {
  return Math.max(0, asset.base_currency_value);
}

function sum(assets: PortfolioAsset[]) {
  return assets.reduce((total, asset) => total + asset.base_currency_value, 0);
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
