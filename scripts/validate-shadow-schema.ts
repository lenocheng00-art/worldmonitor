import { Client } from "pg";
import { assertShadowEnvironment, shadowDatabaseUrl } from "@/lib/shadow/safety";

const expectedTables = [
  "committee", "committee_versions", "confidence_events", "daily_statistics", "diff_reports", "evidence",
  "logic_chain_signals", "logic_chains", "manual_reviews", "match_audits", "metric_observations", "metrics",
  "replay_runs", "signals", "source_snapshots",
];
async function main() {
  assertShadowEnvironment();
  const client = new Client({ connectionString: shadowDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const tables = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='shadow' order by table_name",
    );
    const actual = tables.rows.map((row) => row.table_name);
    const missing = expectedTables.filter((table) => !actual.includes(table));
    const grants = await client.query<{ grantee: string; table_name: string; privilege_type: string }>(
      `select grantee,table_name,privilege_type from information_schema.role_table_grants
       where table_schema='shadow' and grantee in ('PUBLIC','anon','authenticated','service_role')`,
    );
    const publicAccess = await client.query<{ has_access: boolean }>(
      `select has_schema_privilege('anon','shadow','usage')
        or has_schema_privilege('authenticated','shadow','usage')
        or has_schema_privilege('service_role','shadow','usage') as has_access`,
    );
    if (missing.length) throw new Error(`Missing Shadow tables: ${missing.join(", ")}`);
    if (grants.rowCount || publicAccess.rows[0]?.has_access) throw new Error("A client-facing role has access to the Shadow schema.");
    console.log(JSON.stringify({ valid: true, schema: "shadow", tables: actual.length, clientRoleGrants: 0 }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
