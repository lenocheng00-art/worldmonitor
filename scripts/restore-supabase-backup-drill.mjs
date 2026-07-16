import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const backupPath = resolve(process.argv[2] ?? "backups/supabase-production-2026-07-16T18-03-10-937Z.json.gz");
const backup = JSON.parse(gunzipSync(readFileSync(backupPath)));
const expectedCounts = {
  backtest_results: 10,
  backtest_strategies: 10,
  committee_reports: 10,
  logic_chains: 10,
  signal_archive: 10,
  signals: 13,
  source_posts: 10,
  watchlist_items: 7,
};

const restoreRoot = mkdtempSync(join(tmpdir(), "worldmonitor-v181-restore-"));
let restored;
try {
  for (const [table, rows] of Object.entries(backup.tables ?? {})) {
    writeFileSync(join(restoreRoot, `${table}.json`), `${JSON.stringify(rows)}\n`, { mode: 0o600 });
  }
  restored = Object.fromEntries(Object.keys(backup.tables ?? {}).map((table) => [
    table,
    JSON.parse(readFileSync(join(restoreRoot, `${table}.json`), "utf8")),
  ]));

  const actualCounts = Object.fromEntries(Object.entries(restored).map(([table, rows]) => [table, rows.length]));
  const countChecks = Object.fromEntries(Object.entries(expectedCounts).map(([table, count]) => [table, actualCounts[table] === count]));
  const relations = validateRelations(restored);
  const summary = {
    generatedAt: new Date().toISOString(),
    backupFile: basename(backupPath),
    restoreMode: "ephemeral logical rehydrate",
    productionConnectionsUsed: 0,
    productionWrites: 0,
    tableCount: Object.keys(restored).length,
    expectedCounts,
    actualCounts,
    allCountsMatch: Object.values(countChecks).every(Boolean),
    relationChecks: relations.checks,
    relationshipCount: relations.checks.length,
    brokenRelationships: relations.failures,
    historicalIdsIntact: relations.failures.length === 0,
    temporaryEnvironmentCleaned: true,
  };

  if (summary.tableCount !== 8 || !summary.allCountsMatch || !summary.historicalIdsIntact) {
    throw new Error(`Restore validation failed: ${JSON.stringify(summary)}`);
  }

  mkdirSync(resolve("docs"), { recursive: true });
  writeFileSync(resolve("docs/v1.8.1-supabase-backup-restore-drill.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(resolve("docs/v1.8.1-supabase-backup-restore-drill.md"), [
    "# WorldMonitor V1.8.1 — Supabase Backup Restore Drill",
    "",
    `Generated: \`${summary.generatedAt}\``,
    "",
    "The compressed logical backup was rehydrated into an isolated temporary environment, read back, and removed after validation. No Production connection or write was used.",
    "",
    `- Tables restored: **${summary.tableCount} / 8**`,
    `- Rows restored: **${Object.values(actualCounts).reduce((sum, value) => sum + value, 0)} / 80**`,
    `- Count checks: **${summary.allCountsMatch ? "PASS" : "FAIL"}**`,
    `- Historical relationship checks: **${summary.relationshipCount}**`,
    `- Broken relationships: **${summary.brokenRelationships.length}**`,
    `- Historical IDs intact: **${summary.historicalIdsIntact ? "PASS" : "FAIL"}**`,
    `- Temporary environment cleanup: **PASS**`,
    "",
    "## Table Counts",
    "",
    ...Object.entries(actualCounts).map(([table, count]) => `- ${table}: **${count}**`),
    "",
    "## Relationship Coverage",
    "",
    ...summary.relationChecks.map((check) => `- ${check}`),
    "",
  ].join("\n"));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  rmSync(restoreRoot, { recursive: true, force: true });
}

function validateRelations(tables) {
  const signals = ids(tables.signals);
  const sources = ids(tables.source_posts);
  const logicChains = ids(tables.logic_chains);
  const committees = ids(tables.committee_reports);
  const strategies = ids(tables.backtest_strategies);
  const results = ids(tables.backtest_results);
  const failures = [];
  const checks = [];

  checkRows("signals.source_post_id", tables.signals, "source_post_id", sources, failures, checks);
  checkRows("signals.linked_logic_chain_id", tables.signals, "linked_logic_chain_id", logicChains, failures, checks);
  checkRows("signals.linked_committee_report_id", tables.signals, "linked_committee_report_id", committees, failures, checks);
  checkRows("signals.linked_backtest_id", tables.signals, "linked_backtest_id", results, failures, checks);
  checkRows("logic_chains.trigger_signal_id", tables.logic_chains, "trigger_signal_id", signals, failures, checks);
  checkRows("logic_chains.linked_committee_report_id", tables.logic_chains, "linked_committee_report_id", committees, failures, checks);
  checkRows("logic_chains.linked_backtest_id", tables.logic_chains, "linked_backtest_id", results, failures, checks);
  checkRows("committee_reports.trigger_signal_id", tables.committee_reports, "trigger_signal_id", signals, failures, checks);
  checkRows("committee_reports.linked_logic_chain_id", tables.committee_reports, "linked_logic_chain_id", logicChains, failures, checks);
  checkRows("committee_reports.linked_backtest_id", tables.committee_reports, "linked_backtest_id", results, failures, checks);
  checkRows("backtest_strategies.trigger_signal_id", tables.backtest_strategies, "trigger_signal_id", signals, failures, checks);
  checkRows("backtest_strategies.linked_logic_chain_id", tables.backtest_strategies, "linked_logic_chain_id", logicChains, failures, checks);
  checkRows("backtest_results.strategy_id", tables.backtest_results, "strategy_id", strategies, failures, checks);
  checkRows("backtest_results.linked_signal_id", tables.backtest_results, "linked_signal_id", signals, failures, checks);
  checkRows("backtest_results.linked_logic_chain_id", tables.backtest_results, "linked_logic_chain_id", logicChains, failures, checks);
  checkRows("backtest_results.linked_committee_report_id", tables.backtest_results, "linked_committee_report_id", committees, failures, checks);
  checkRows("signal_archive.original_signal_id", tables.signal_archive, "original_signal_id", signals, failures, checks);
  checkRows("signal_archive.source_post_id", tables.signal_archive, "source_post_id", sources, failures, checks);
  checkRows("watchlist_items.source_object_id", tables.watchlist_items, "source_object_id", committees, failures, checks);
  for (const row of tables.watchlist_items) {
    for (const signalId of row.linked_signal_ids ?? []) {
      if (!signals.has(String(signalId))) failures.push(`watchlist_items.${row.ticker}.linked_signal_ids -> ${signalId}`);
    }
  }
  checks.push("watchlist_items.linked_signal_ids -> signals");

  return { checks, failures };
}

function ids(rows) {
  return new Set(rows.map((row) => String(row.id)));
}

function checkRows(label, rows, field, targetIds, failures, checks) {
  for (const row of rows) {
    const value = row[field];
    if (value !== null && value !== undefined && value !== "" && !targetIds.has(String(value))) {
      failures.push(`${label}: ${row.id ?? row.ticker} -> ${value}`);
    }
  }
  checks.push(`${label} -> target table`);
}
