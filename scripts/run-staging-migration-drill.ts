import { mkdir, writeFile } from "node:fs/promises";
import {
  applyResearchMigration,
  createStagingDatabaseClient,
  resetApplicationSchema,
  seedV18Fixture,
  verifyV18Fixture,
} from "./lib/staging-database";

const outputDirectory = "experiments/research-tracking-v2.0.2/logs";
const logLines: string[] = [];

async function main() {
  const { client, safe } = createStagingDatabaseClient();
  await client.connect();
  try {
  record(`target project=${safe.projectRef} host=${safe.database.host} environment=${safe.appEnvironment}`);

  await resetApplicationSchema(client);
  record("empty-db reset: PASS");
  await applyResearchMigration(client);
  record("empty-db migration: PASS");
  const emptyTables = await requiredTableCount(client);
  assert(emptyTables === 11, `empty-db required table count was ${emptyTables}`);
  record(`empty-db required tables: PASS (${emptyTables}/11)`);

  await resetApplicationSchema(client);
  await seedV18Fixture(client);
  record("V1.8 synthetic fixture seed: PASS (2 signals, 2 chains, 1 committee report)");
  await applyResearchMigration(client);
  const fixture = await verifyV18Fixture(client);
  assert(fixture.passed, "V1.8 fixture verification failed");
  record(`V1.8 fixture migration: PASS ${JSON.stringify(fixture)}`);

  await resetApplicationSchema(client);
  await applyResearchMigration(client);
  await resetApplicationSchema(client);
  await applyResearchMigration(client);
  assert(await requiredTableCount(client) === 11, "reset/replay required table count mismatch");
  record("reset/replay: PASS (two clean replays)");

  await resetApplicationSchema(client);
  let failureObserved = false;
  try {
    await client.query("begin; create table public.v202_recovery_probe(id integer); select 1 / 0; commit;");
  } catch {
    failureObserved = true;
    await client.query("rollback");
  }
  const recoveryProbe = await client.query<{ relation: string | null }>("select to_regclass('public.v202_recovery_probe')::text as relation");
  assert(failureObserved && recoveryProbe.rows[0].relation === null, "failed migration transaction did not roll back cleanly");
  await applyResearchMigration(client);
  record("failure recovery: PASS (transaction rollback followed by clean migration)");

  await resetApplicationSchema(client);
  await applyResearchMigration(client);
  record("final clean staging schema: PASS");

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(`${outputDirectory}/migration-empty-db.log`, `${logLines.join("\n")}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ status: "PASS", projectRef: safe.projectRef, host: safe.database.host, fixture, stages: logLines.length }, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

async function requiredTableCount(client: import("pg").Client) {
  const result = await client.query<{ count: string }>(`
    select count(*)::text as count from information_schema.tables
    where table_schema = 'public' and table_name = any($1::text[])
  `, [[
    "signals", "logic_chains", "logic_chain_signals", "logic_chain_match_candidates",
    "tracking_metrics", "metric_observations", "evidence", "confidence_events",
    "committee_research_objects", "committee_research_versions", "research_tracking_runs",
  ]]);
  return Number(result.rows[0].count);
}

function record(message: string) {
  logLines.push(`${new Date().toISOString()} ${message}`);
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main().catch((error: unknown) => {
  process.stderr.write(`FAILED: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
