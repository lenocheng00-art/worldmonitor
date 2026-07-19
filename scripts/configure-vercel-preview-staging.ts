import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { assertSafeStagingEnvironment, requireStagingVariable } from "./lib/staging-guard";

async function main() {
  const staging = assertSafeStagingEnvironment();
  const previewBranch = "codex/signal-monitor-pipeline-e2e";
  const variables: Record<string, string> = {
    APP_ENV: "staging",
    STAGING_ENVIRONMENT: "staging",
    SUPABASE_PROJECT_REF: staging.projectRef,
    STAGING_PROJECT_REF: staging.projectRef,
    NEXT_PUBLIC_SUPABASE_URL: process.env.STAGING_SUPABASE_URL ?? requireStagingVariable("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.STAGING_SUPABASE_ANON_KEY ?? requireStagingVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ?? requireStagingVariable("SUPABASE_SERVICE_ROLE_KEY"),
    CRON_SECRET: process.env.STAGING_CRON_SECRET ?? requireStagingVariable("CRON_SECRET"),
  };

  for (const [name, value] of Object.entries(variables)) {
    assert(value, `${name} cannot be empty.`);
    await addPreviewVariable(name, value, previewBranch);
    console.log(`Vercel Preview variable configured: ${name}`);
  }
  console.log(`Vercel Preview isolation: PASS (${staging.projectRef}, ${previewBranch})`);
}

function addPreviewVariable(name: string, value: string, previewBranch: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("vercel", ["env", "add", name, "preview", previewBranch, "--force", "--yes"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    let errorOutput = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { errorOutput += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Vercel rejected ${name}: ${redact(`${output}\n${errorOutput}`)}`));
    });
    child.stdin.end(`${value}\n`);
  });
}

function redact(value: string) {
  return value.replace(/[A-Za-z0-9_.=-]{20,}/g, "[redacted]").trim();
}

void main();
