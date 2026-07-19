import { readFile } from "node:fs/promises";
import path from "node:path";

const commands: Record<string, string> = {
  assert: "./assert-safe-shadow.ts",
  migrate: "./apply-shadow-migration.ts",
  validate: "./validate-shadow-schema.ts",
  replay: "./run-production-shadow-replay.ts",
  report: "./generate-shadow-stability-report.ts",
};

async function main() {
  const command = process.argv[2];
  if (!command || !commands[command]) throw new Error(`Unknown Shadow command: ${command ?? "missing"}`);
  await loadLocalShadowEnvironment();
  await import(commands[command]);
}

async function loadLocalShadowEnvironment() {
  if (process.env.PRODUCTION_READ_URL && process.env.PRODUCTION_READ_ANON_KEY && process.env.SHADOW_DATABASE_URL) return;
  const production = parseEnv(await readOptional(path.join(process.cwd(), ".env.local")), new Set([
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]));
  const staging = parseEnv(await readOptional(path.join(process.cwd(), ".env.staging.local")), new Set([
    "STAGING_DATABASE_URL", "STAGING_PROJECT_REF",
  ]));
  process.env.APP_ENV = "shadow";
  process.env.PRODUCTION_READ_URL = process.env.PRODUCTION_READ_URL ?? production.NEXT_PUBLIC_SUPABASE_URL;
  process.env.PRODUCTION_READ_ANON_KEY = process.env.PRODUCTION_READ_ANON_KEY ?? production.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.SHADOW_DATABASE_URL = process.env.SHADOW_DATABASE_URL ?? staging.STAGING_DATABASE_URL;
  process.env.SHADOW_PROJECT_REF = process.env.SHADOW_PROJECT_REF ?? staging.STAGING_PROJECT_REF;
  process.env.SHADOW_SCHEMA = "shadow";
}

async function readOptional(file: string) {
  try { return await readFile(file, "utf8"); } catch { return ""; }
}

function parseEnv(contents: string, allowedKeys: Set<string>) {
  const result: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || !allowedKeys.has(match[1])) continue;
    result[match[1]] = unquote(match[2].trim());
  }
  return result;
}

function unquote(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
