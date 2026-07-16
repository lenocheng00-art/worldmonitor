import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(resolve(".env.local"));
  } catch {
    // CI and Vercel provide environment variables directly.
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const headers = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
};

const schemaResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
  headers: { ...headers, accept: "application/openapi+json" },
});
if (!schemaResponse.ok) {
  throw new Error(`Could not read Supabase REST schema (${schemaResponse.status}).`);
}

const schema = await schemaResponse.json();
const tables = Object.keys(schema.definitions ?? {}).sort();
const exported = {};
const counts = {};

for (const table of tables) {
  const rows = [];
  const pageSize = 1_000;

  for (let offset = 0; ; offset += pageSize) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=*`,
      {
        headers: {
          ...headers,
          prefer: "count=exact",
          range: `${offset}-${offset + pageSize - 1}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Could not export ${table} (${response.status}).`);
    }

    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  exported[table] = rows;
  counts[table] = rows.length;
}

const createdAt = new Date().toISOString();
const compactTimestamp = createdAt.replaceAll(":", "-").replace(".", "-");
const outputPath = resolve(
  process.argv[2] ?? `backups/supabase-production-${compactTimestamp}.json.gz`,
);
const payload = {
  manifest: {
    format: "worldmonitor-supabase-logical-backup-v1",
    createdAt,
    projectHost: new URL(supabaseUrl).host,
    tableCount: tables.length,
    rowCounts: counts,
  },
  tables: exported,
};
const archive = gzipSync(JSON.stringify(payload));

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, archive, { mode: 0o600 });
chmodSync(outputPath, 0o600);

const sha256 = createHash("sha256").update(archive).digest("hex");
process.stdout.write(JSON.stringify({ outputPath, sha256, tableCount: tables.length, rowCounts: counts }));
