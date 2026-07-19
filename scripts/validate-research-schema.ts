import { Client } from "pg";
import { assertStagingTarget, StagingConfigurationError } from "./lib/staging-guard";

const REQUIRED_TABLES = [
  "signals", "logic_chains", "logic_chain_signals", "logic_chain_match_candidates",
  "tracking_metrics", "metric_observations", "evidence", "confidence_events",
  "committee_research_objects", "committee_research_versions", "research_tracking_runs",
] as const;

const RESEARCH_TABLES = [
  "logic_chain_signals", "logic_chain_match_candidates", "tracking_metrics", "metric_observations",
  "evidence", "confidence_events", "committee_research_objects", "committee_research_versions",
  "research_tracking_runs",
] as const;

const REQUIRED_COLUMNS: Record<string, string[]> = {
  signals: ["id", "source_post_id", "logic_chain_id", "signal_fingerprint", "original_quote", "quality_score", "review_required"],
  logic_chains: ["id", "canonical_key", "thesis", "research_status", "confidence_score", "entity_keys"],
  logic_chain_signals: ["id", "logic_chain_id", "signal_id", "relation_type", "match_score"],
  logic_chain_match_candidates: ["id", "signal_id", "decision", "evaluation_run_key"],
  tracking_metrics: ["id", "logic_chain_id", "metric_key", "provider_config", "evaluation_rule", "metric_fingerprint", "next_run_at"],
  metric_observations: ["id", "metric_id", "observed_at", "evaluation_run_key"],
  evidence: ["id", "logic_chain_id", "evidence_fingerprint", "observed_at"],
  confidence_events: ["id", "logic_chain_id", "previous_score", "new_score", "evaluation_run_key"],
  committee_research_objects: ["id", "logic_chain_id", "summary_fingerprint", "current_version"],
  committee_research_versions: ["id", "committee_object_id", "version", "summary_fingerprint"],
  research_tracking_runs: ["id", "run_key", "mode", "status", "stats"],
};

const REQUIRED_INDEXES = [
  "signals_signal_fingerprint_uidx", "logic_chains_canonical_key_uidx", "logic_chain_signals_signal_idx",
  "tracking_metrics_due_idx", "tracking_metrics_signal_idx", "metric_observations_metric_time_idx",
  "evidence_chain_time_idx", "confidence_events_chain_time_idx",
];

type Check = { name: string; passed: boolean; detail: string };

async function main() {
  const connectionString = process.env.STAGING_DATABASE_URL;
  const target = assertStagingTarget(connectionString, process.env.STAGING_ENVIRONMENT);
  const client = new Client({ connectionString, ssl: target.local ? undefined : { rejectUnauthorized: false } });
  const checks: Check[] = [];
  await client.connect();
  try {
    const tables = await client.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public'");
    const tableNames = new Set(tables.rows.map((row) => row.table_name));
    for (const table of REQUIRED_TABLES) check(checks, `table:${table}`, tableNames.has(table), tableNames.has(table) ? "present" : "missing");

    const columns = await client.query<{ table_name: string; column_name: string }>("select table_name, column_name from information_schema.columns where table_schema = 'public'");
    const columnSet = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
    for (const [table, names] of Object.entries(REQUIRED_COLUMNS)) {
      for (const column of names) check(checks, `column:${table}.${column}`, columnSet.has(`${table}.${column}`), columnSet.has(`${table}.${column}`) ? "present" : "missing");
    }

    const primaryKeys = await client.query<{ table_name: string }>(`
      select tc.table_name from information_schema.table_constraints tc
      where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY'
    `);
    const primaryKeyTables = new Set(primaryKeys.rows.map((row) => row.table_name));
    for (const table of REQUIRED_TABLES) check(checks, `primary-key:${table}`, primaryKeyTables.has(table), primaryKeyTables.has(table) ? "present" : "missing");

    const foreignKeys = await client.query<{ table_name: string; foreign_table_name: string }>(`
      select tc.table_name, ccu.table_name as foreign_table_name
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.constraint_schema = tc.constraint_schema
      where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'
    `);
    const requiredForeignKeys = [
      ["logic_chain_signals", "logic_chains"], ["logic_chain_signals", "signals"],
      ["tracking_metrics", "logic_chains"], ["metric_observations", "tracking_metrics"],
      ["evidence", "logic_chains"], ["confidence_events", "logic_chains"],
      ["committee_research_objects", "logic_chains"], ["committee_research_versions", "committee_research_objects"],
    ];
    for (const [table, foreign] of requiredForeignKeys) {
      const present = foreignKeys.rows.some((row) => row.table_name === table && row.foreign_table_name === foreign);
      check(checks, `foreign-key:${table}->${foreign}`, present, present ? "present" : "missing");
    }

    const indexes = await client.query<{ indexname: string }>("select indexname from pg_indexes where schemaname = 'public'");
    const indexNames = new Set(indexes.rows.map((row) => row.indexname));
    for (const index of REQUIRED_INDEXES) check(checks, `index:${index}`, indexNames.has(index), indexNames.has(index) ? "present" : "missing");

    const constraints = await client.query<{ conname: string }>("select conname from pg_constraint where connamespace = 'public'::regnamespace");
    const constraintNames = new Set(constraints.rows.map((row) => row.conname));
    for (const constraint of ["logic_chains_confidence_score_range", "logic_chains_research_status_values"]) {
      check(checks, `constraint:${constraint}`, constraintNames.has(constraint), constraintNames.has(constraint) ? "present" : "missing");
    }

    const relations = await client.query<{ relname: string; relrowsecurity: boolean }>(`
      select relname, relrowsecurity from pg_class
      where relnamespace = 'public'::regnamespace and relname = any($1::text[])
    `, [RESEARCH_TABLES]);
    const rls = new Map(relations.rows.map((row) => [row.relname, row.relrowsecurity]));
    for (const table of RESEARCH_TABLES) check(checks, `rls:${table}`, rls.get(table) === true, rls.get(table) === true ? "enabled" : "disabled or missing");

    const policies = await client.query<{ tablename: string; policy_count: string }>(`
      select tablename, count(*)::text as policy_count from pg_policies
      where schemaname = 'public' and tablename = any($1::text[]) group by tablename
    `, [RESEARCH_TABLES]);
    const policyCounts = new Map(policies.rows.map((row) => [row.tablename, Number(row.policy_count)]));
    for (const table of RESEARCH_TABLES) check(checks, `policy:${table}`, policyCounts.get(table) === 1, `count=${policyCounts.get(table) ?? 0}`);

    const functions = await client.query<{ exists: boolean; security_definer: boolean; safe_search_path: boolean; anon_execute: boolean; auth_execute: boolean; service_execute: boolean }>(`
      select
        true as exists,
        p.prosecdef as security_definer,
        coalesce('search_path=public' = any(p.proconfig), false) as safe_search_path,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute,
        has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
      from pg_proc p
      where p.oid = to_regprocedure('public.attach_research_signal(text,text,text,numeric,text,text)')
    `);
    const fn = functions.rows[0];
    check(checks, "function:attach_research_signal", Boolean(fn), fn ? "present" : "missing");
    if (fn) {
      check(checks, "function:security-invoker", !fn.security_definer, fn.security_definer ? "SECURITY DEFINER" : "SECURITY INVOKER");
      check(checks, "function:search-path", fn.safe_search_path, fn.safe_search_path ? "search_path=public" : "unsafe or missing");
      check(checks, "function:anon-execute", !fn.anon_execute, fn.anon_execute ? "unexpected grant" : "revoked");
      check(checks, "function:authenticated-execute", !fn.auth_execute, fn.auth_execute ? "unexpected grant" : "revoked");
      check(checks, "function:service-role-execute", fn.service_execute, fn.service_execute ? "granted" : "missing grant");
    }

    const failed = checks.filter((item) => !item.passed);
    process.stdout.write(`${JSON.stringify({ target, checks: checks.length, passed: checks.length - failed.length, failed: failed.length, failures: failed }, null, 2)}\n`);
    process.exitCode = failed.length ? 1 : 0;
  } finally {
    await client.end();
  }
}

function check(checks: Check[], name: string, passed: boolean, detail: string) {
  checks.push({ name, passed, detail });
}

void main().catch((error: unknown) => {
  const blocked = error instanceof StagingConfigurationError;
  process.stderr.write(`${blocked ? "BLOCKED" : "FAILED"}: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = blocked ? 2 : 1;
});
