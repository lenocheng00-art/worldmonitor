"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, FilePenLine, ListTodo, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/research-ui";
import {
  assetValue,
  buildAssetTodo,
  buildCashFlow,
  cashFlowDirectionOptions,
  cashFlowFrequencyOptions,
  currencyOptions,
  liabilityValue,
  mockAssetTodos,
  mockCashFlows,
  mockPortfolioAssets,
  readStoredAssetTodos,
  readStoredCashFlows,
  readStoredPortfolioAssets,
  signedBaseValue,
  todoPriorityOptions,
  todoStatusOptions,
  toAssetTodoFormValues,
  toCashFlowFormValues,
  verificationTypeOptions,
  writeStoredAssetTodos,
  writeStoredCashFlows,
  type AssetTodo,
  type AssetTodoFormValues,
  type AssetVerificationType,
  type CashFlowRecord,
  type CashFlowFormValues,
  type PortfolioAsset,
} from "@/lib/portfolio-data";
import { cn } from "@/lib/utils";

type GroupRow = { key: string; label: string; value: number; share: number; count: number };

export function BalanceSheetDashboard() {
  const assets = usePortfolioRecords();
  const totalAssets = assets.reduce((sum, asset) => sum + assetValue(asset), 0);
  const totalLiabilities = assets.reduce((sum, asset) => sum + liabilityValue(asset), 0);
  const netWorth = totalAssets - totalLiabilities;
  const staleAssets = staleRecords(assets);

  return (
    <div className="space-y-6">
      <MetricGrid>
        <MetricCard label="Total Assets" value={cny(totalAssets)} />
        <MetricCard label="Total Liabilities" value={cny(totalLiabilities)} />
        <MetricCard label="Net Worth" value={cny(netWorth)} />
        <MetricCard label="Stale Records" value={`${staleAssets.length}`} />
      </MetricGrid>
      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard title="Asset Breakdown by Category" rows={groupRecords(assets.filter((asset) => asset.type === "asset"), "category", true)} />
        <BreakdownCard title="Liability Breakdown by Category" rows={groupRecords(assets.filter((asset) => asset.type === "liability"), "category", false)} />
        <BreakdownCard title="Net Worth by Account" rows={groupNetWorthByAccount(assets)} />
        <ConfidenceCard records={assets} />
      </div>
      <StaleDataCard records={staleAssets} />
    </div>
  );
}

export function CashFlowDashboard() {
  const assets = usePortfolioRecords();
  const [records, setRecords] = useState<CashFlowRecord[]>(mockCashFlows);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState<CashFlowRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    setRecords(readStoredCashFlows());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStoredCashFlows(records);
  }, [records, hydrated]);

  const monthKey = new Date().toISOString().slice(0, 7);
  const monthly = records.filter((record) => record.date.startsWith(monthKey));
  const monthlyInflow = flowTotal(monthly, "inflow");
  const monthlyOutflow = flowTotal(monthly, "outflow");
  const recurring = records.filter((record) => record.recurring && record.frequency !== "none").sort((a, b) => a.date.localeCompare(b.date));

  function save(values: CashFlowFormValues) {
    const next = buildCashFlow(values, editing ?? undefined);
    setRecords((current) => (editing ? current.map((record) => (record.id === editing.id ? next : record)) : [next, ...current]));
    setEditing(null);
    setFormOpen(false);
  }

  function remove(id: string) {
    if (window.confirm("Delete this cash flow record?")) setRecords((current) => current.filter((record) => record.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-4" /> Add Cash Flow</Button>
      </div>
      <MetricGrid>
        <MetricCard label="Monthly Inflow" value={cny(monthlyInflow)} />
        <MetricCard label="Monthly Outflow" value={cny(monthlyOutflow)} />
        <MetricCard label="Net Cash Flow" value={cny(monthlyInflow - monthlyOutflow)} />
        <MetricCard label="Recurring Items" value={`${recurring.length}`} />
      </MetricGrid>
      {formOpen ? <CashFlowForm record={editing} assets={assets} onCancel={() => { setEditing(null); setFormOpen(false); }} onSubmit={save} /> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard title="Cash Flow by Category" rows={groupCashFlows(records)} />
        <CashFlowRecurringCard records={recurring} assets={assets} />
      </div>
      <CashFlowTable records={records} assets={assets} onEdit={(record) => { setEditing(record); setFormOpen(true); }} onDelete={remove} />
    </div>
  );
}

export function AssetTodosDashboard() {
  const assets = usePortfolioRecords();
  const cashFlows = useCashFlows();
  const [todos, setTodos] = useState<AssetTodo[]>(mockAssetTodos);
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState<AssetVerificationType | "all">("all");
  const [editing, setEditing] = useState<AssetTodo | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    setTodos(readStoredAssetTodos());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStoredAssetTodos(todos);
  }, [todos, hydrated]);

  const visible = filter === "all" ? todos : todos.filter((todo) => todo.verification_type === filter);
  const open = todos.filter((todo) => todo.status !== "done");
  const overdue = open.filter((todo) => todo.due_date && new Date(todo.due_date).getTime() < startOfToday());
  const highPriority = open.filter((todo) => todo.priority === "high");

  function save(values: AssetTodoFormValues) {
    const next = buildAssetTodo(values, editing ?? undefined);
    setTodos((current) => (editing ? current.map((todo) => (todo.id === editing.id ? next : todo)) : [next, ...current]));
    setEditing(null);
    setFormOpen(false);
  }

  function remove(id: string) {
    if (window.confirm("Delete this asset todo?")) setTodos((current) => current.filter((todo) => todo.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>All</Button>
          {verificationTypeOptions.map((type) => (
            <Button key={type} variant={filter === type ? "default" : "outline"} size="sm" onClick={() => setFilter(type)}>{formatLabel(type)}</Button>
          ))}
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="size-4" /> Add Todo</Button>
      </div>
      <MetricGrid>
        <MetricCard label="Open Todos" value={`${open.length}`} />
        <MetricCard label="Overdue Todos" value={`${overdue.length}`} />
        <MetricCard label="High Priority" value={`${highPriority.length}`} />
        <MetricCard label="Blocked" value={`${todos.filter((todo) => todo.status === "blocked").length}`} />
      </MetricGrid>
      {formOpen ? <AssetTodoForm todo={editing} assets={assets} cashFlows={cashFlows} onCancel={() => { setEditing(null); setFormOpen(false); }} onSubmit={save} /> : null}
      <TodosByAsset todos={visible} assets={assets} onEdit={(todo) => { setEditing(todo); setFormOpen(true); }} onDelete={remove} />
    </div>
  );
}

export function PortfolioOverviewDashboard() {
  const assets = usePortfolioRecords();
  const cashFlows = useCashFlows();
  const todos = useAssetTodos();
  const totalAssets = assets.reduce((sum, asset) => sum + assetValue(asset), 0);
  const totalLiabilities = assets.reduce((sum, asset) => sum + liabilityValue(asset), 0);
  const netWorth = totalAssets - totalLiabilities;
  const cashBalance = assets.filter((asset) => ["cash", "deposit", "stablecoin"].includes(asset.category)).reduce((sum, asset) => sum + assetValue(asset), 0);
  const illiquid = assets.filter((asset) => asset.liquidity_level === "locked" || asset.liquidity_level === "low").reduce((sum, asset) => sum + assetValue(asset), 0);
  const lowConfidence = assets.filter((asset) => asset.data_confidence === "low").reduce((sum, asset) => sum + assetValue(asset), 0);
  const staleValue = staleRecords(assets).reduce((sum, asset) => sum + assetValue(asset), 0);
  const upcoming = upcomingCashFlows(cashFlows, 30);
  const highTodos = todos.filter((todo) => todo.status !== "done" && todo.priority === "high");

  return (
    <div className="space-y-6">
      <MetricGrid>
        <MetricCard label="Total Assets" value={cny(totalAssets)} />
        <MetricCard label="Total Liabilities" value={cny(totalLiabilities)} />
        <MetricCard label="Net Worth" value={cny(netWorth)} />
        <MetricCard label="Cash Balance" value={cny(cashBalance)} />
        <MetricCard label="Illiquid Asset Exposure" value={cny(illiquid)} />
        <MetricCard label="Low-confidence Asset Value" value={cny(lowConfidence)} />
        <MetricCard label="Stale Asset Value" value={cny(staleValue)} />
        <MetricCard label="30-day Net Cash Flow" value={cny(flowTotal(upcoming, "inflow") - flowTotal(upcoming, "outflow"))} />
        <MetricCard label="Open High-priority Todos" value={`${highTodos.length}`} />
      </MetricGrid>
      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard title="Asset Allocation by Category" rows={groupRecords(assets.filter((asset) => asset.type === "asset"), "category", true)} />
        <BreakdownCard title="Net Worth by Account" rows={groupNetWorthByAccount(assets)} />
        <CashFlowRecurringCard title="Upcoming 30-day Cash Flows" records={upcoming} assets={assets} />
        <TodoCompactCard todos={highTodos} assets={assets} />
      </div>
    </div>
  );
}

function usePortfolioRecords() {
  const [records, setRecords] = useState<PortfolioAsset[]>(mockPortfolioAssets);
  useEffect(() => setRecords(readStoredPortfolioAssets()), []);
  return records;
}

function useCashFlows() {
  const [records, setRecords] = useState<CashFlowRecord[]>(mockCashFlows);
  useEffect(() => setRecords(readStoredCashFlows()), []);
  return records;
}

function useAssetTodos() {
  const [todos, setTodos] = useState<AssetTodo[]>(mockAssetTodos);
  useEffect(() => setTodos(readStoredAssetTodos()), []);
  return todos;
}

function MetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: GroupRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{row.label}</span>
              <span className="tabular-nums text-muted-foreground">{cny(row.value)} · {row.count}</span>
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

function ConfidenceCard({ records }: { records: PortfolioAsset[] }) {
  const rows = ["high", "medium", "low"].map((confidence) => ({
    key: confidence,
    label: `${formatLabel(confidence)} Confidence`,
    value: records.filter((record) => record.data_confidence === confidence).reduce((sum, record) => sum + assetValue(record), 0),
    count: records.filter((record) => record.data_confidence === confidence).length,
    share: 0,
  }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return <BreakdownCard title="Data Confidence Summary" rows={rows.map((row) => ({ ...row, share: total ? row.value / total : 0 }))} />;
}

function StaleDataCard({ records }: { records: PortfolioAsset[] }) {
  return (
    <Card>
      <CardHeader>
        <SectionHeader icon={BadgeCheck} title="Stale Data Summary" description="Records older than 30 days or marked low confidence." />
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {records.map((record) => (
          <div key={record.id} className="rounded-md border p-3">
            <div className="font-medium">{record.name}</div>
            <div className="mt-1 text-sm text-muted-foreground">{formatLabel(record.data_confidence)} · verified {formatDate(record.last_verified_at)}</div>
            <div className="mt-2 font-semibold tabular-nums">{cny(assetValue(record))}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CashFlowForm({ record, assets, onCancel, onSubmit }: { record: CashFlowRecord | null; assets: PortfolioAsset[]; onCancel: () => void; onSubmit: (values: CashFlowFormValues) => void }) {
  const [values, setValues] = useState<CashFlowFormValues>(() => toCashFlowFormValues(record ?? undefined));
  return (
    <Card>
      <CardHeader><CardTitle>{record ? "Edit Cash Flow" : "Add Cash Flow"}</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Date"><input type="date" value={values.date} onChange={(event) => setValues({ ...values, date: event.target.value })} className={inputClass} /></Field>
            <Select label="Direction" value={values.direction} options={cashFlowDirectionOptions} onChange={(value) => setValues({ ...values, direction: value })} />
            <Field label="Category"><input value={values.category} onChange={(event) => setValues({ ...values, category: event.target.value })} className={inputClass} /></Field>
            <Select label="Currency" value={values.currency} options={currencyOptions} onChange={(value) => setValues({ ...values, currency: value })} />
            <Field label="Amount"><input type="number" step="any" value={values.amount} onChange={(event) => setValues({ ...values, amount: Number(event.target.value) })} className={inputClass} /></Field>
            <Field label="Account ID"><input value={values.account_id} onChange={(event) => setValues({ ...values, account_id: event.target.value })} className={inputClass} /></Field>
            <Field label="Related Asset"><select value={values.related_asset_id} onChange={(event) => setValues({ ...values, related_asset_id: event.target.value })} className={inputClass}><option value="">None</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></Field>
            <Select label="Frequency" value={values.frequency} options={cashFlowFrequencyOptions} onChange={(value) => setValues({ ...values, frequency: value, recurring: value !== "none" })} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.recurring} onChange={(event) => setValues({ ...values, recurring: event.target.checked, frequency: event.target.checked ? values.frequency === "none" ? "monthly" : values.frequency : "none" })} /> Recurring</label>
          <Field label="Note"><input value={values.note} onChange={(event) => setValues({ ...values, note: event.target.value })} className={inputClass} /></Field>
          <FormActions onCancel={onCancel} submitLabel={record ? "Save Cash Flow" : "Add Cash Flow"} />
        </form>
      </CardContent>
    </Card>
  );
}

function AssetTodoForm({ todo, assets, cashFlows, onCancel, onSubmit }: { todo: AssetTodo | null; assets: PortfolioAsset[]; cashFlows: CashFlowRecord[]; onCancel: () => void; onSubmit: (values: AssetTodoFormValues) => void }) {
  const [values, setValues] = useState<AssetTodoFormValues>(() => toAssetTodoFormValues(todo ?? undefined));
  return (
    <Card>
      <CardHeader><CardTitle>{todo ? "Edit Verification Todo" : "Add Verification Todo"}</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSubmit(values); }}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Title"><input value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} className={inputClass} /></Field>
            <Select label="Status" value={values.status} options={todoStatusOptions} onChange={(value) => setValues({ ...values, status: value })} />
            <Select label="Priority" value={values.priority} options={todoPriorityOptions} onChange={(value) => setValues({ ...values, priority: value })} />
            <Select label="Verification Type" value={values.verification_type} options={verificationTypeOptions} onChange={(value) => setValues({ ...values, verification_type: value })} />
            <Field label="Related Asset"><select value={values.related_asset_id} onChange={(event) => setValues({ ...values, related_asset_id: event.target.value })} className={inputClass}><option value="">None</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></Field>
            <Field label="Related Cash Flow"><select value={values.related_cashflow_id} onChange={(event) => setValues({ ...values, related_cashflow_id: event.target.value })} className={inputClass}><option value="">None</option>{cashFlows.map((flow) => <option key={flow.id} value={flow.id}>{flow.date} · {flow.category}</option>)}</select></Field>
            <Field label="Due Date"><input type="date" value={values.due_date} onChange={(event) => setValues({ ...values, due_date: event.target.value })} className={inputClass} /></Field>
            <Field label="Note"><input value={values.note} onChange={(event) => setValues({ ...values, note: event.target.value })} className={inputClass} /></Field>
          </div>
          <FormActions onCancel={onCancel} submitLabel={todo ? "Save Todo" : "Add Todo"} />
        </form>
      </CardContent>
    </Card>
  );
}

function CashFlowTable({ records, assets, onEdit, onDelete }: { records: CashFlowRecord[]; assets: PortfolioAsset[]; onEdit: (record: CashFlowRecord) => void; onDelete: (id: string) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>Cash Flow Register</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Date", "Direction", "Category", "Account", "Asset", "Amount", "Base Value", "Recurring", "Note", "Actions"].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead>
          <tbody className="divide-y">{records.map((record) => <tr key={record.id}><td className="px-4 py-3">{record.date}</td><td className="px-4 py-3">{formatLabel(record.direction)}</td><td className="px-4 py-3">{record.category}</td><td className="px-4 py-3">{record.account_id || "None"}</td><td className="px-4 py-3">{assetName(assets, record.related_asset_id)}</td><td className="px-4 py-3 tabular-nums">{record.currency} {record.amount.toLocaleString("en-US")}</td><td className="px-4 py-3 tabular-nums">{cny(record.base_currency_value)}</td><td className="px-4 py-3">{record.recurring ? formatLabel(record.frequency) : "No"}</td><td className="px-4 py-3 text-muted-foreground">{record.note}</td><td className="px-4 py-3"><RowActions onEdit={() => onEdit(record)} onDelete={() => onDelete(record.id)} /></td></tr>)}</tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CashFlowRecurringCard({ title = "Upcoming Recurring Cash Flows", records, assets }: { title?: string; records: CashFlowRecord[]; assets: PortfolioAsset[] }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {records.map((record) => (
          <div key={record.id} className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-3"><span className="font-medium">{record.category}</span><span className={cn("font-semibold tabular-nums", record.direction === "inflow" ? "text-emerald-700" : "text-red-700")}>{record.direction === "inflow" ? "+" : "-"}{cny(record.base_currency_value)}</span></div>
            <div className="mt-1 text-muted-foreground">{record.date} · {formatLabel(record.frequency)} · {assetName(assets, record.related_asset_id)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TodosByAsset({ todos, assets, onEdit, onDelete }: { todos: AssetTodo[]; assets: PortfolioAsset[]; onEdit: (todo: AssetTodo) => void; onDelete: (id: string) => void }) {
  const groups = new Map<string, AssetTodo[]>();
  for (const todo of todos) {
    const key = todo.related_asset_id || "unlinked";
    groups.set(key, [...(groups.get(key) ?? []), todo]);
  }
  return (
    <Card>
      <CardHeader><SectionHeader icon={ListTodo} title="Todos Grouped by Related Asset" description="Verification queue for valuation, ownership, liquidity, tax, document, and counterparty work." /></CardHeader>
      <CardContent className="space-y-4">
        {[...groups.entries()].map(([assetId, group]) => (
          <div key={assetId} className="rounded-lg border p-4">
            <div className="mb-3 font-semibold">{assetName(assets, assetId)}</div>
            <div className="grid gap-3">
              {group.map((todo) => (
                <div key={todo.id} className="grid gap-2 rounded-md bg-muted/40 p-3 md:grid-cols-[1fr_auto] md:items-center">
                  <div><div className="font-medium">{todo.title}</div><div className="mt-1 text-sm text-muted-foreground">{formatLabel(todo.verification_type)} · {formatLabel(todo.status)} · due {todo.due_date || "not set"}</div></div>
                  <div className="flex items-center gap-2"><PriorityBadge priority={todo.priority} /><RowActions onEdit={() => onEdit(todo)} onDelete={() => onDelete(todo.id)} /></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TodoCompactCard({ todos, assets }: { todos: AssetTodo[]; assets: PortfolioAsset[] }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>Open High-priority Todos</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {todos.map((todo) => <div key={todo.id} className="rounded-md border p-3"><div className="font-medium">{todo.title}</div><div className="mt-1 text-sm text-muted-foreground">{assetName(assets, todo.related_asset_id)} · due {todo.due_date || "not set"}</div></div>)}
      </CardContent>
    </Card>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="flex gap-2"><Button size="sm" variant="outline" onClick={onEdit}><FilePenLine className="size-4" /> Edit</Button><Button size="sm" variant="outline" onClick={onDelete}><Trash2 className="size-4" /> Delete</Button></div>;
}

function FormActions({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit">{submitLabel}</Button></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-xs font-medium text-muted-foreground">{label}{children}</label>;
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value as T)} className={inputClass}>{options.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}</select></Field>;
}

function PriorityBadge({ priority }: { priority: AssetTodo["priority"] }) {
  return <Badge variant="outline" className={cn(priority === "high" && "border-red-200 bg-red-50 text-red-800", priority === "medium" && "border-blue-200 bg-blue-50 text-blue-800", priority === "low" && "border-muted bg-muted")}>{formatLabel(priority)}</Badge>;
}

function groupRecords(records: PortfolioAsset[], key: "category" | "account", assetsOnly: boolean): GroupRow[] {
  const totals = new Map<string, { value: number; count: number }>();
  for (const record of records) {
    const value = assetsOnly ? assetValue(record) : liabilityValue(record);
    const current = totals.get(record[key]) ?? { value: 0, count: 0 };
    totals.set(record[key], { value: current.value + value, count: current.count + 1 });
  }
  return toRows(totals);
}

function groupNetWorthByAccount(records: PortfolioAsset[]): GroupRow[] {
  const totals = new Map<string, { value: number; count: number }>();
  for (const record of records) {
    const current = totals.get(record.account) ?? { value: 0, count: 0 };
    totals.set(record.account, { value: current.value + signedBaseValue(record), count: current.count + 1 });
  }
  return toRows(totals);
}

function groupCashFlows(records: CashFlowRecord[]): GroupRow[] {
  const totals = new Map<string, { value: number; count: number }>();
  for (const record of records) {
    const sign = record.direction === "inflow" ? 1 : -1;
    const current = totals.get(record.category) ?? { value: 0, count: 0 };
    totals.set(record.category, { value: current.value + sign * record.base_currency_value, count: current.count + 1 });
  }
  return toRows(totals);
}

function toRows(totals: Map<string, { value: number; count: number }>): GroupRow[] {
  const total = [...totals.values()].reduce((sum, row) => sum + Math.abs(row.value), 0);
  return [...totals.entries()].map(([key, row]) => ({ key, label: formatLabel(key), value: row.value, count: row.count, share: total ? Math.abs(row.value) / total : 0 })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function flowTotal(records: CashFlowRecord[], direction: CashFlowRecord["direction"]) {
  return records.filter((record) => record.direction === direction).reduce((sum, record) => sum + record.base_currency_value, 0);
}

function upcomingCashFlows(records: CashFlowRecord[], days: number) {
  const now = startOfToday();
  const end = now + days * 24 * 60 * 60 * 1000;
  return records.filter((record) => {
    const date = new Date(record.date).getTime();
    return date >= now && date <= end;
  });
}

function staleRecords(records: PortfolioAsset[]) {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return records.filter((record) => record.data_confidence === "low" || now - new Date(record.last_verified_at).getTime() > thirtyDays);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function assetName(assets: PortfolioAsset[], assetId: string) {
  if (!assetId) return "Unlinked";
  return assets.find((asset) => asset.id === assetId)?.name ?? assetId;
}

function cny(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}CNY ${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatLabel(value: string) {
  return value.split("_").map((part) => part.toUpperCase()).join(" ");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-HK", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" });
}

const inputClass = "h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground";
