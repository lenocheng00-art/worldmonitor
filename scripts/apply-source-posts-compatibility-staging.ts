import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { assertSafeStagingEnvironment } from "./lib/staging-guard";

const migrationPath = "supabase/migrations/202607200002_source_posts_compatibility.sql";

async function main() {
  const staging = assertSafeStagingEnvironment();
  const databaseUrl = process.env.STAGING_DATABASE_URL;
  assert(databaseUrl, "STAGING_DATABASE_URL is required.");

  const sql = await readFile(migrationPath, "utf8");
  assert(!/\b(drop\s+table|delete\s+from|truncate)\b/i.test(sql), "Compatibility migration must remain additive.");

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(sql);
    const result = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' and table_name='source_posts'",
    );
    assert.equal(result.rows[0]?.table_name, "source_posts", "source_posts compatibility table was not created.");
    await client.query("commit");
    console.log(`source_posts compatibility: PASS (${staging.projectRef})`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

void main();
