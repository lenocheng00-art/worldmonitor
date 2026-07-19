import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { assertShadowEnvironment, shadowDatabaseUrl } from "@/lib/shadow/safety";

async function main() {
  assertShadowEnvironment();
  const migrationPath = path.join(process.cwd(), "supabase/shadow_migrations/202607200001_production_shadow_v21.sql");
  const migration = await readFile(migrationPath, "utf8");
  assertMigrationIsolation(migration);
  const client = new Client({ connectionString: shadowDatabaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const before = await publicSchemaSignature(client);
    await client.query("begin");
    try {
      await client.query(migration);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    const after = await publicSchemaSignature(client);
    if (before !== after) throw new Error("Public schema signature changed during the Shadow-only migration.");
    const tableCount = await client.query<{ count: string }>(
      "select count(*)::text as count from information_schema.tables where table_schema='shadow'",
    );
    console.log(JSON.stringify({ applied: true, schema: "shadow", shadowTables: Number(tableCount.rows[0]?.count ?? 0), publicSchemaUnchanged: true }));
  } finally {
    await client.end();
  }
}

function assertMigrationIsolation(sql: string) {
  const forbidden = /\b(?:insert\s+into|update|delete\s+from|alter\s+table|create\s+table|drop\s+table|truncate)\s+public\./i;
  if (forbidden.test(sql)) throw new Error("Shadow migration contains a public schema mutation.");
  if (!/create\s+schema\s+if\s+not\s+exists\s+shadow/i.test(sql)) throw new Error("Shadow migration does not create the shadow schema.");
}

async function publicSchemaSignature(client: Client) {
  const result = await client.query(
    `select table_name,column_name,data_type,is_nullable,coalesce(column_default,'') as column_default
     from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
  );
  return JSON.stringify(result.rows);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
