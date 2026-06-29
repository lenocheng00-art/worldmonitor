"use client";

import { useEffect, useState } from "react";
import { Download, FileJson, RotateCcw, ShieldAlert, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/research-ui";
import {
  appendActivityLog,
  applyImportedPortfolioData,
  buildPortfolioBackupPayload,
  clearPortfolioModuleData,
  portfolioSchemaVersion,
  readActivityLog,
  readLocalBackup,
  readPortfolioMetadata,
  readStoredAssetTodos,
  readStoredCashFlows,
  readStoredPortfolioAssets,
  restorePortfolioBackup,
  validateBackupPayload,
  writePortfolioMetadata,
  type AssetTodo,
  type CashFlowRecord,
  type PortfolioActivityLogEntry,
  type PortfolioAsset,
  type PortfolioBackupPayload,
  type PortfolioMetadata,
} from "@/lib/portfolio-data";

type ImportPreview = {
  payload: PortfolioBackupPayload;
  mode: "replace" | "merge";
};

export function PortfolioSettingsDashboard() {
  const [metadata, setMetadata] = useState<PortfolioMetadata>({});
  const [activity, setActivity] = useState<PortfolioActivityLogEntry[]>([]);
  const [latestBackup, setLatestBackup] = useState<PortfolioBackupPayload | null>(null);
  const [previousBackup, setPreviousBackup] = useState<PortfolioBackupPayload | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  function refresh() {
    setMetadata(readPortfolioMetadata());
    setActivity(readActivityLog());
    setLatestBackup(readLocalBackup("latest"));
    setPreviousBackup(readLocalBackup("previous"));
  }

  useEffect(() => refresh(), []);

  function exportJson() {
    const payload = buildPortfolioBackupPayload();
    downloadFile(JSON.stringify(payload, null, 2), `worldmonitor-portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    const next = { ...readPortfolioMetadata(), last_export_at: new Date().toISOString() };
    writePortfolioMetadata(next);
    appendActivityLog({ entity_type: "system", action: "export", title: "Exported portfolio JSON backup", summary: `${payload.portfolio_records.length} portfolio records.` });
    refresh();
  }

  function exportCsv(kind: "portfolio" | "cash_flow" | "todo") {
    const filename = `worldmonitor-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    if (kind === "portfolio") downloadFile(toCsv(readStoredPortfolioAssets(), portfolioColumns), filename, "text/csv");
    if (kind === "cash_flow") downloadFile(toCsv(readStoredCashFlows(), cashFlowColumns), filename, "text/csv");
    if (kind === "todo") downloadFile(toCsv(readStoredAssetTodos(), todoColumns), filename, "text/csv");
    appendActivityLog({ entity_type: "system", action: "export", title: `Exported ${kind} CSV`, summary: filename });
    refresh();
  }

  async function handleImport(file: File) {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const result = validateBackupPayload(parsed);
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      setImportPreview({ payload: result.payload, mode: "merge" });
    } catch {
      window.alert("Could not parse JSON file.");
    }
  }

  function confirmImport() {
    if (!importPreview) return;
    applyImportedPortfolioData(importPreview.payload, importPreview.mode);
    setImportPreview(null);
    refresh();
  }

  function restore(slot: "latest" | "previous") {
    const backup = slot === "latest" ? latestBackup : previousBackup;
    if (!backup) return;
    if (window.confirm(`Restore ${slot} backup from ${formatDateTime(backup.exported_at)}? Current data will be backed up first.`)) {
      restorePortfolioBackup(backup);
      refresh();
    }
  }

  function clearData(scope: "portfolio" | "cash_flow" | "todo" | "all") {
    if (scope === "all") {
      const typed = window.prompt("Type CLEAR ALL to clear all portfolio module data.");
      if (typed !== "CLEAR ALL") return;
    } else if (!window.confirm(`Clear ${scope} data? A local backup will be created first.`)) {
      return;
    }
    clearPortfolioModuleData(scope);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard label="Schema Version" value={portfolioSchemaVersion} />
        <InfoCard label="Last Export" value={metadata.last_export_at ? formatDateTime(metadata.last_export_at) : "Never"} />
        <InfoCard label="Last Import" value={metadata.last_import_at ? formatDateTime(metadata.last_import_at) : "Never"} />
      </div>

      <Card>
        <CardHeader>
          <SectionHeader icon={Download} title="Export Data" description="Download a portable local backup or flat CSV extracts." />
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={exportJson}><FileJson className="size-4" /> Export JSON Backup</Button>
          <Button variant="outline" onClick={() => exportCsv("portfolio")}>Export Portfolio CSV</Button>
          <Button variant="outline" onClick={() => exportCsv("cash_flow")}>Export Cash Flow CSV</Button>
          <Button variant="outline" onClick={() => exportCsv("todo")}>Export Asset Todos CSV</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeader icon={Upload} title="Import JSON Backup" description="Preview a local backup before merging or replacing current local data." />
        </CardHeader>
        <CardContent className="space-y-4">
          <input type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImport(file); }} />
          {importPreview ? (
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline">Schema {importPreview.payload.schema_version}</Badge>
                <Badge variant="outline">{importPreview.payload.portfolio_records.length} portfolio records</Badge>
                <Badge variant="outline">{importPreview.payload.cash_flow_records.length} cash flows</Badge>
                <Badge variant="outline">{importPreview.payload.asset_todos.length} todos</Badge>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <Button variant={importPreview.mode === "merge" ? "default" : "outline"} size="sm" onClick={() => setImportPreview({ ...importPreview, mode: "merge" })}>Merge</Button>
                <Button variant={importPreview.mode === "replace" ? "default" : "outline"} size="sm" onClick={() => setImportPreview({ ...importPreview, mode: "replace" })}>Replace</Button>
              </div>
              <Button onClick={confirmImport}>Confirm Import</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <BackupCard title="Latest Backup" backup={latestBackup} onRestore={() => restore("latest")} />
        <BackupCard title="Previous Backup" backup={previousBackup} onRestore={() => restore("previous")} />
      </div>

      <Card>
        <CardHeader>
          <SectionHeader icon={ShieldAlert} title="Danger Zone" description="Clearing data creates a local backup first. All operations are browser-local." />
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => clearData("portfolio")}>Clear Portfolio Records</Button>
          <Button variant="outline" onClick={() => clearData("cash_flow")}>Clear Cash Flow Records</Button>
          <Button variant="outline" onClick={() => clearData("todo")}>Clear Asset Todos</Button>
          <Button variant="outline" onClick={() => clearData("all")}>Clear All Portfolio Module Data</Button>
        </CardContent>
      </Card>

      <ActivityLogCard entries={activity} />
    </div>
  );
}

function BackupCard({ title, backup, onRestore }: { title: string; backup: PortfolioBackupPayload | null; onRestore: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {backup ? (
          <>
            <div className="grid gap-2 text-sm">
              <div>Timestamp: <span className="font-medium">{formatDateTime(backup.exported_at)}</span></div>
              <div>Portfolio records: <span className="font-medium">{backup.portfolio_records.length}</span></div>
              <div>Cash flows: <span className="font-medium">{backup.cash_flow_records.length}</span></div>
              <div>Todos: <span className="font-medium">{backup.asset_todos.length}</span></div>
            </div>
            <Button variant="outline" onClick={onRestore}><RotateCcw className="size-4" /> Restore Backup</Button>
          </>
        ) : <div className="text-sm text-muted-foreground">No backup snapshot available.</div>}
      </CardContent>
    </Card>
  );
}

function ActivityLogCard({ entries }: { entries: PortfolioActivityLogEntry[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {entries.slice(0, 25).map((entry) => (
          <div key={entry.id} className="rounded-md border p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-medium">{entry.title}</div>
              <div className="text-xs text-muted-foreground">{formatDateTime(entry.timestamp)}</div>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{entry.entity_type} · {entry.action}{entry.summary ? ` · ${entry.summary}` : ""}</div>
          </div>
        ))}
        {entries.length === 0 ? <div className="text-sm text-muted-foreground">No activity recorded yet.</div> : null}
      </CardContent>
    </Card>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

const portfolioColumns: { header: string; value: (row: PortfolioAsset) => string | number | null | undefined }[] = [
  { header: "id", value: (row) => row.id },
  { header: "name", value: (row) => row.name },
  { header: "type", value: (row) => row.type },
  { header: "category", value: (row) => row.category },
  { header: "account", value: (row) => row.account },
  { header: "currency", value: (row) => row.currency },
  { header: "amount", value: (row) => row.amount },
  { header: "fx_rate_to_cny", value: (row) => row.fx_rate_to_cny },
  { header: "base_currency_value", value: (row) => row.base_currency_value },
  { header: "data_confidence", value: (row) => row.data_confidence },
  { header: "last_verified_at", value: (row) => row.last_verified_at },
  { header: "liquidity_level", value: (row) => row.liquidity_level },
  { header: "valuation_method", value: (row) => row.valuation_method },
  { header: "research_links", value: (row) => row.research_links.join(";") },
  { header: "notes", value: (row) => row.notes },
];

const cashFlowColumns: { header: string; value: (row: CashFlowRecord) => string | number | boolean | null | undefined }[] = [
  { header: "id", value: (row) => row.id },
  { header: "date", value: (row) => row.date },
  { header: "direction", value: (row) => row.direction },
  { header: "category", value: (row) => row.category },
  { header: "account_id", value: (row) => row.account_id },
  { header: "related_asset_id", value: (row) => row.related_asset_id },
  { header: "currency", value: (row) => row.currency },
  { header: "amount", value: (row) => row.amount },
  { header: "fx_rate_to_cny", value: (row) => row.fx_rate_to_cny },
  { header: "base_currency_value", value: (row) => row.base_currency_value },
  { header: "recurring", value: (row) => row.recurring },
  { header: "frequency", value: (row) => row.frequency },
  { header: "note", value: (row) => row.note },
];

const todoColumns: { header: string; value: (row: AssetTodo) => string | null | undefined }[] = [
  { header: "id", value: (row) => row.id },
  { header: "title", value: (row) => row.title },
  { header: "status", value: (row) => row.status },
  { header: "priority", value: (row) => row.priority },
  { header: "related_asset_id", value: (row) => row.related_asset_id },
  { header: "related_cashflow_id", value: (row) => row.related_cashflow_id },
  { header: "due_date", value: (row) => row.due_date },
  { header: "verification_type", value: (row) => row.verification_type },
  { header: "note", value: (row) => row.note },
  { header: "created_at", value: (row) => row.created_at },
  { header: "updated_at", value: (row) => row.updated_at },
];

function toCsv<T>(rows: T[], columns: { header: string; value: (row: T) => unknown }[]) {
  return [
    columns.map((column) => csvCell(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(",")),
  ].join("\n");
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-HK", { timeZone: "Asia/Hong_Kong" });
}
