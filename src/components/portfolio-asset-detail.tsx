"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Database, ExternalLink, FilePenLine, Link2, Plus, ShieldCheck, Trash2, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/research-ui";
import {
  appendActivityLog,
  calculateDataQualityScore,
  mockPortfolioAssets,
  readActivityLog,
  readStoredAssetTodos,
  readStoredCashFlows,
  readStoredPortfolioAssets,
  writeStoredPortfolioAssets,
  type AssetTodo,
  type CashFlowRecord,
  type EvidenceItem,
  type EvidenceType,
  type PortfolioActivityLogEntry,
  type PortfolioAsset,
  type PortfolioDataConfidence,
  type ResearchLink,
  type ResearchLinkType,
} from "@/lib/portfolio-data";
import { cn } from "@/lib/utils";

const researchTypes: ResearchLinkType[] = ["signal", "logic_chain", "committee_report", "backtest", "document", "external_url", "memo"];
const evidenceTypes: EvidenceType[] = ["ownership", "valuation", "liquidity", "tax", "counterparty", "document", "other"];
const confidenceOptions: PortfolioDataConfidence[] = ["high", "medium", "low"];

type ResearchFormValues = Omit<ResearchLink, "id" | "created_at">;
type EvidenceFormValues = Omit<EvidenceItem, "id" | "created_at">;
type TimelineItem = { id: string; timestamp: string; title: string; summary: string };

export function PortfolioAssetDetail({ assetId }: { assetId: string }) {
  const [assets, setAssets] = useState<PortfolioAsset[]>(mockPortfolioAssets);
  const [cashFlows, setCashFlows] = useState<CashFlowRecord[]>([]);
  const [todos, setTodos] = useState<AssetTodo[]>([]);
  const [activity, setActivity] = useState<PortfolioActivityLogEntry[]>([]);
  const [researchEditing, setResearchEditing] = useState<ResearchLink | null>(null);
  const [evidenceEditing, setEvidenceEditing] = useState<EvidenceItem | null>(null);

  function refresh() {
    setAssets(readStoredPortfolioAssets());
    setCashFlows(readStoredCashFlows());
    setTodos(readStoredAssetTodos());
    setActivity(readActivityLog());
  }

  useEffect(() => refresh(), []);

  const asset = useMemo(
    () => assets.find((item) => item.id === assetId) ?? mockPortfolioAssets.find((item) => item.id === assetId),
    [assetId, assets],
  );

  function updateAsset(updater: (asset: PortfolioAsset) => PortfolioAsset, title: string, summary: string) {
    if (!asset) return;
    const next = assets.map((item) => (item.id === asset.id ? updater(item) : item));
    setAssets(next);
    writeStoredPortfolioAssets(next);
    appendActivityLog({ entity_type: "portfolio", entity_id: asset.id, action: "update", title, summary });
    refresh();
  }

  if (!asset) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-lg font-semibold">Asset not found</div>
            <p className="mt-2 text-sm text-muted-foreground">This manual register item may have been deleted from local state.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/portfolio"><ArrowLeft className="size-4" />Back to Portfolio</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activeAsset = asset;
  const quality = calculateDataQualityScore(activeAsset, todos);
  const relatedCashFlows = cashFlows.filter((item) => item.related_asset_id === activeAsset.id);
  const relatedTodos = todos.filter((item) => item.related_asset_id === activeAsset.id);
  const timeline = buildTimeline(activeAsset, relatedCashFlows, relatedTodos, activity);

  function saveResearch(values: ResearchFormValues) {
    updateAsset(
      (current) => {
        const item: ResearchLink = researchEditing
          ? { ...researchEditing, ...values }
          : { ...values, id: `research-${Date.now().toString(36)}`, created_at: new Date().toISOString() };
        const links = researchEditing ? current.research_links.map((link) => (link.id === item.id ? item : link)) : [item, ...current.research_links];
        return syncRelatedIds({ ...current, research_links: links, updated_at: new Date().toISOString() });
      },
      researchEditing ? "Updated research link" : "Added research link",
      `${activeAsset.name} · ${values.title}`,
    );
    setResearchEditing(null);
  }

  function deleteResearch(linkId: string) {
    updateAsset(
      (current) => syncRelatedIds({ ...current, research_links: current.research_links.filter((link) => link.id !== linkId), updated_at: new Date().toISOString() }),
      "Deleted research link",
      activeAsset.name,
    );
  }

  function saveEvidence(values: EvidenceFormValues) {
    updateAsset(
      (current) => {
        const item: EvidenceItem = evidenceEditing
          ? { ...evidenceEditing, ...values }
          : { ...values, id: `evidence-${Date.now().toString(36)}`, created_at: new Date().toISOString() };
        const evidence = evidenceEditing ? current.evidence_items.map((row) => (row.id === item.id ? item : row)) : [item, ...current.evidence_items];
        return { ...current, evidence_items: evidence, updated_at: new Date().toISOString() };
      },
      evidenceEditing ? "Updated evidence item" : "Added evidence item",
      `${activeAsset.name} · ${values.title}`,
    );
    setEvidenceEditing(null);
  }

  function deleteEvidence(evidenceId: string) {
    updateAsset(
      (current) => ({ ...current, evidence_items: current.evidence_items.filter((item) => item.id !== evidenceId), updated_at: new Date().toISOString() }),
      "Deleted evidence item",
      activeAsset.name,
    );
  }

  const fields = [
    ["Account Type", formatLabel(asset.account_type)],
    ["Custodian", formatLabel(asset.custodian)],
    ["Region", asset.region],
    ["Asset Type", formatLabel(asset.asset_type)],
    ["Currency", asset.currency],
    ["Cost Basis", localMoney(asset.cost_basis, asset.currency)],
    ["Current Value", localMoney(asset.current_value, asset.currency)],
    ["Base Currency Value", cny(asset.base_currency_value)],
    ["Liquidity Tier", asset.liquidity_tier],
    ["Risk Level", formatLabel(asset.risk_level)],
    ["Status", formatLabel(asset.status)],
    ["Valuation Method", formatLabel(asset.valuation_method)],
    ["Data Confidence", formatLabel(asset.data_confidence)],
    ["Last Verified At", formatDateTime(asset.last_verified_at)],
    ["Expected Exit Date", asset.expected_exit_date ?? "Not set"],
    ["Lockup End Date", asset.lockup_end_date ?? "Not set"],
    ["Next Action", asset.next_action || "None"],
    ["Notes", asset.notes || "None"],
    ["Created At", formatDateTime(asset.created_at)],
    ["Updated At", formatDateTime(asset.updated_at)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline"><Link href="/portfolio"><ArrowLeft className="size-4" />Back to Portfolio</Link></Button>
        <div className="flex flex-wrap gap-2">
          <ConfidenceBadge confidence={asset.data_confidence} />
          <Badge variant="outline">Quality {quality.score}</Badge>
          <Badge variant="outline">Last verified {formatDate(asset.last_verified_at)}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <SectionHeader
            icon={WalletCards}
            title={asset.name}
            description="Portfolio asset dossier with valuation, research coverage, evidence, linked workflow records, and activity timeline."
            action={<Badge variant="outline">Local register</Badge>}
          />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Base Currency Value" value={cny(asset.base_currency_value)} />
          <MetricCard label="Research Links" value={`${asset.research_links.length}`} />
          <MetricCard label="Evidence Items" value={`${asset.evidence_items.length}`} />
          <MetricCard label="Open Todos" value={`${relatedTodos.filter((todo) => todo.status !== "done").length}`} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Asset Summary</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {fields.map(([label, value]) => <DetailField key={label} label={label} value={value} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Data Quality Reasons</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <MetricCard label="Quality Bucket" value={formatLabel(quality.quality_bucket)} />
            {quality.reasons.map((reason) => <div key={reason} className="rounded-md border p-3 text-sm text-muted-foreground">{reason}</div>)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ResearchLinksCard links={asset.research_links} editing={researchEditing} onEdit={setResearchEditing} onDelete={deleteResearch} onSubmit={saveResearch} />
        <EvidenceItemsCard items={asset.evidence_items} editing={evidenceEditing} onEdit={setEvidenceEditing} onDelete={deleteEvidence} onSubmit={saveEvidence} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <RelatedIdsCard title="Related Signals" ids={asset.related_signal_ids} href="/signal-inbox" />
        <RelatedIdsCard title="Related Logic Chains" ids={asset.related_logic_chain_ids} href="/logic-chains" />
        <RelatedIdsCard title="Related Committee Reports" ids={asset.related_committee_report_ids} href="/committee" />
        <RelatedIdsCard title="Related Backtests" ids={asset.related_backtest_ids} href="/backtest-lab" />
        <LinkedRecordsCard title="Related Cash Flows" rows={relatedCashFlows.map((item) => ({ id: item.id, title: `${formatLabel(item.direction)} · ${item.category}`, summary: `${item.date} · ${localMoney(item.amount, item.currency)}` }))} />
        <LinkedRecordsCard title="Related Todos" rows={relatedTodos.map((item) => ({ id: item.id, title: item.title, summary: `${formatLabel(item.status)} · ${formatLabel(item.priority)} · ${item.due_date || "No due date"}` }))} />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Database className="size-4 text-primary" />Activity Timeline</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {timeline.map((item) => (
            <div key={item.id} className="rounded-md border p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">{formatDateTime(item.timestamp)}</div>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{item.summary}</div>
            </div>
          ))}
          {timeline.length === 0 ? <div className="text-sm text-muted-foreground">No linked activity yet.</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ResearchLinksCard({ links, editing, onEdit, onDelete, onSubmit }: { links: ResearchLink[]; editing: ResearchLink | null; onEdit: (link: ResearchLink | null) => void; onDelete: (id: string) => void; onSubmit: (values: ResearchFormValues) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="size-4 text-primary" />Research Links</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ResearchForm link={editing} onCancel={() => onEdit(null)} onSubmit={onSubmit} />
        {links.map((link) => (
          <div key={link.id} className="rounded-md border p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-medium">{link.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{formatLabel(link.type)}{link.related_id ? ` · ${link.related_id}` : ""}</div>
                {link.note ? <div className="mt-2 text-sm text-muted-foreground">{link.note}</div> : null}
              </div>
              <RowActions onEdit={() => onEdit(link)} onDelete={() => onDelete(link.id)} url={link.url} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EvidenceItemsCard({ items, editing, onEdit, onDelete, onSubmit }: { items: EvidenceItem[]; editing: EvidenceItem | null; onEdit: (item: EvidenceItem | null) => void; onDelete: (id: string) => void; onSubmit: (values: EvidenceFormValues) => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />Evidence Items</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <EvidenceForm item={editing} onCancel={() => onEdit(null)} onSubmit={onSubmit} />
        {items.map((item) => (
          <div key={item.id} className="rounded-md border p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{formatLabel(item.evidence_type)} · {formatLabel(item.confidence)} confidence{item.last_verified_at ? ` · verified ${formatDate(item.last_verified_at)}` : ""}</div>
                {item.note ? <div className="mt-2 text-sm text-muted-foreground">{item.note}</div> : null}
              </div>
              <RowActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item.id)} url={item.url} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ResearchForm({ link, onCancel, onSubmit }: { link: ResearchLink | null; onCancel: () => void; onSubmit: (values: ResearchFormValues) => void }) {
  const [values, setValues] = useState<ResearchFormValues>(() => ({
    title: link?.title ?? "",
    url: link?.url ?? "",
    type: link?.type ?? "memo",
    related_id: link?.related_id ?? "",
    note: link?.note ?? "",
  }));
  useEffect(() => setValues({ title: link?.title ?? "", url: link?.url ?? "", type: link?.type ?? "memo", related_id: link?.related_id ?? "", note: link?.note ?? "" }), [link]);
  return (
    <form className="grid gap-3 rounded-md border p-3" onSubmit={(event) => submitForm(event, values.title, () => onSubmit(values))}>
      <Input label="Title" value={values.title} onChange={(title) => setValues({ ...values, title })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Type" value={values.type} options={researchTypes} onChange={(type) => setValues({ ...values, type })} />
        <Input label="Related ID" value={values.related_id ?? ""} onChange={(related_id) => setValues({ ...values, related_id })} />
      </div>
      <Input label="URL" value={values.url ?? ""} onChange={(url) => setValues({ ...values, url })} />
      <Textarea label="Note" value={values.note ?? ""} onChange={(note) => setValues({ ...values, note })} />
      <FormActions submitLabel={link ? "Update Link" : "Add Link"} onCancel={onCancel} />
    </form>
  );
}

function EvidenceForm({ item, onCancel, onSubmit }: { item: EvidenceItem | null; onCancel: () => void; onSubmit: (values: EvidenceFormValues) => void }) {
  const [values, setValues] = useState<EvidenceFormValues>(() => ({
    title: item?.title ?? "",
    evidence_type: item?.evidence_type ?? "document",
    url: item?.url ?? "",
    note: item?.note ?? "",
    confidence: item?.confidence ?? "medium",
    last_verified_at: item?.last_verified_at ? item.last_verified_at.slice(0, 10) : "",
  }));
  useEffect(() => setValues({ title: item?.title ?? "", evidence_type: item?.evidence_type ?? "document", url: item?.url ?? "", note: item?.note ?? "", confidence: item?.confidence ?? "medium", last_verified_at: item?.last_verified_at ? item.last_verified_at.slice(0, 10) : "" }), [item]);
  return (
    <form className="grid gap-3 rounded-md border p-3" onSubmit={(event) => submitForm(event, values.title, () => onSubmit(values))}>
      <Input label="Title" value={values.title} onChange={(title) => setValues({ ...values, title })} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Select label="Evidence Type" value={values.evidence_type} options={evidenceTypes} onChange={(evidence_type) => setValues({ ...values, evidence_type })} />
        <Select label="Confidence" value={values.confidence} options={confidenceOptions} onChange={(confidence) => setValues({ ...values, confidence })} />
        <Input label="Last Verified" type="date" value={values.last_verified_at ?? ""} onChange={(last_verified_at) => setValues({ ...values, last_verified_at })} />
      </div>
      <Input label="URL" value={values.url ?? ""} onChange={(url) => setValues({ ...values, url })} />
      <Textarea label="Note" value={values.note ?? ""} onChange={(note) => setValues({ ...values, note })} />
      <FormActions submitLabel={item ? "Update Evidence" : "Add Evidence"} onCancel={onCancel} />
    </form>
  );
}

function RelatedIdsCard({ title, ids, href }: { title: string; ids: string[]; href: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {ids.map((id) => <Badge key={id} variant="outline">{id}</Badge>)}
        {ids.length ? <Button asChild size="sm" variant="outline"><Link href={href}><ExternalLink className="size-4" />Open Module</Link></Button> : <div className="text-sm text-muted-foreground">No linked records.</div>}
      </CardContent>
    </Card>
  );
}

function LinkedRecordsCard({ title, rows }: { title: string; rows: { id: string; title: string; summary: string }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => <div key={row.id} className="rounded-md border p-3"><div className="font-medium">{row.title}</div><div className="mt-1 text-sm text-muted-foreground">{row.summary}</div></div>)}
        {rows.length === 0 ? <div className="text-sm text-muted-foreground">No linked records.</div> : null}
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border p-3"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-lg font-semibold tabular-nums">{value}</div></div>;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border p-3"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 break-words text-sm font-medium">{value}</div></div>;
}

function RowActions({ onEdit, onDelete, url }: { onEdit: () => void; onDelete: () => void; url?: string }) {
  return <div className="flex flex-wrap gap-2">{url ? <Button asChild size="sm" variant="outline"><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />Open</a></Button> : null}<Button size="sm" variant="outline" onClick={onEdit}><FilePenLine className="size-4" />Edit</Button><Button size="sm" variant="outline" onClick={onDelete}><Trash2 className="size-4" />Delete</Button></div>;
}

function FormActions({ submitLabel, onCancel }: { submitLabel: string; onCancel: () => void }) {
  return <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit"><Plus className="size-4" />{submitLabel}</Button></div>;
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="space-y-1.5 text-xs font-medium text-muted-foreground">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="space-y-1.5 text-xs font-medium text-muted-foreground">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} rows={3} /></label>;
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return <label className="space-y-1.5 text-xs font-medium text-muted-foreground">{label}<select value={value} onChange={(event) => onChange(event.target.value as T)} className={inputClass}>{options.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}</select></label>;
}

function ConfidenceBadge({ confidence }: { confidence: PortfolioAsset["data_confidence"] }) {
  return <Badge variant="outline" className={cn(confidence === "high" && "border-emerald-200 bg-emerald-50 text-emerald-800", confidence === "medium" && "border-blue-200 bg-blue-50 text-blue-800", confidence === "low" && "border-amber-200 bg-amber-50 text-amber-800")}>{formatLabel(confidence)} confidence</Badge>;
}

function submitForm(event: FormEvent<HTMLFormElement>, title: string, callback: () => void) {
  event.preventDefault();
  if (!title.trim()) return;
  callback();
}

function syncRelatedIds(asset: PortfolioAsset): PortfolioAsset {
  const ids = (type: ResearchLinkType) => asset.research_links.filter((link) => link.type === type && link.related_id).map((link) => link.related_id as string);
  return {
    ...asset,
    related_signal_ids: unique(ids("signal")),
    related_logic_chain_ids: unique(ids("logic_chain")),
    related_committee_report_ids: unique(ids("committee_report")),
    related_backtest_ids: unique(ids("backtest")),
    related_signal_id: ids("signal")[0] ?? null,
    related_logic_chain_id: ids("logic_chain")[0] ?? null,
    related_committee_report_id: ids("committee_report")[0] ?? null,
    related_backtest_id: ids("backtest")[0] ?? null,
  };
}

function buildTimeline(asset: PortfolioAsset, cashFlows: CashFlowRecord[], todos: AssetTodo[], activity: PortfolioActivityLogEntry[]): TimelineItem[] {
  return [
    ...activity.filter((entry) => entry.entity_id === asset.id || entry.summary?.includes(asset.name)).map((entry) => ({ id: entry.id, timestamp: entry.timestamp, title: entry.title, summary: `${formatLabel(entry.entity_type)} · ${formatLabel(entry.action)}${entry.summary ? ` · ${entry.summary}` : ""}` })),
    ...cashFlows.map((item) => ({ id: `cash-${item.id}`, timestamp: item.date, title: `Cash flow · ${formatLabel(item.direction)}`, summary: `${item.category} · ${localMoney(item.amount, item.currency)}` })),
    ...todos.map((item) => ({ id: `todo-${item.id}`, timestamp: item.updated_at, title: `Todo · ${item.title}`, summary: `${formatLabel(item.status)} · ${formatLabel(item.priority)}` })),
    ...asset.research_links.map((item) => ({ id: `research-${item.id}`, timestamp: item.created_at, title: `Research link · ${item.title}`, summary: formatLabel(item.type) })),
    ...asset.evidence_items.map((item) => ({ id: `evidence-${item.id}`, timestamp: item.created_at, title: `Evidence · ${item.title}`, summary: `${formatLabel(item.evidence_type)} · ${formatLabel(item.confidence)}` })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function unique(values: string[]) {
  return [...new Set(values)];
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

const inputClass = "w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary";
