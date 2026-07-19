import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { assertStagingTarget } from "../../scripts/lib/staging-guard";

const required = ["STAGING_SUPABASE_URL", "STAGING_SUPABASE_ANON_KEY", "STAGING_SUPABASE_SERVICE_ROLE_KEY", "STAGING_TEST_EMAIL", "STAGING_TEST_PASSWORD"];
const skipReason = required.every((name) => process.env[name]) ? false : `real staging credentials absent: ${required.filter((name) => !process.env[name]).join(", ")}`;

test("real staging RLS enforces anon/authenticated read-only and service-role writes", { skip: skipReason }, async () => {
  const url = process.env.STAGING_SUPABASE_URL!;
  assertStagingTarget(url, process.env.STAGING_ENVIRONMENT);
  const anonKey = process.env.STAGING_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY!;
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const authenticated = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const runKey = `staging-rls-${randomUUID()}`;

  const anonRead = await anon.from("tracking_metrics").select("id").limit(1);
  assert.ok(anonRead.error || anonRead.data?.length === 0, "anon must be denied or see zero research rows");
  assert.ok((await anon.from("research_tracking_runs").insert(runRow(runKey))).error, "anon write must be rejected");
  assert.ok((await anon.from("signals").insert(signalRow(`anon-${runKey}`))).error, "anon Signal write must be rejected by the inherited Signal policy");

  const login = await authenticated.auth.signInWithPassword({ email: process.env.STAGING_TEST_EMAIL!, password: process.env.STAGING_TEST_PASSWORD! });
  assert.equal(login.error, null, login.error?.message);
  const authRead = await authenticated.from("tracking_metrics").select("id").limit(1);
  assert.equal(authRead.error, null, authRead.error?.message);
  assert.ok((await authenticated.from("research_tracking_runs").insert(runRow(`${runKey}-auth`))).error, "authenticated writes must be server-only");
  assert.ok((await authenticated.from("signals").insert(signalRow(`auth-${runKey}`))).error, "authenticated Signal writes must follow the staging policy");

  const serviceWrite = await service.from("research_tracking_runs").insert(runRow(runKey)).select("run_key").single();
  assert.equal(serviceWrite.error, null, serviceWrite.error?.message);
  assert.equal(serviceWrite.data?.run_key, runKey);
  const cleanup = await service.from("research_tracking_runs").delete().eq("run_key", runKey);
  assert.equal(cleanup.error, null, cleanup.error?.message);
  await authenticated.auth.signOut();
});

function runRow(runKey: string) {
  return { id: randomUUID(), run_key: runKey, mode: "manual", status: "succeeded", stats: {}, started_at: new Date().toISOString(), completed_at: new Date().toISOString() };
}

function signalRow(id: string) {
  return { id, title: "RLS probe", source: "staging test", original_text: "RLS probe", extracted_signal: "RLS probe", related_tickers: [], priority_score: 0, status: "New" };
}
