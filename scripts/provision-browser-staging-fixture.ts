import { createClient } from "@supabase/supabase-js";
import { assertSafeStagingEnvironment, requireStagingVariable } from "./lib/staging-guard";

async function main() {
  const safe = assertSafeStagingEnvironment();
  const supabase = createClient(
    requireStagingVariable("STAGING_SUPABASE_URL"),
    requireStagingVariable("STAGING_SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const now = new Date().toISOString();
  const result = await supabase.from("logic_chains").upsert({
    id: "staging-browser-manual-target",
    title: "Staging Manual Attach Target",
    canonical_key: "staging-browser-manual-target",
    thesis: "Controlled browser-only fixture for validating manual Signal attachment.",
    trigger_event: "Manual attach validation",
    transmission_path: ["Staging UI", "Manual Attach", "Persistence"],
    affected_assets: ["MU"],
    bull_case: "The UI persists an explicit link.",
    bear_case: "The UI rejects or loses the explicit link.",
    assumptions: ["Isolated Staging only"],
    research_status: "emerging",
    validation_status: "Validating",
    confidence_score: 40,
    entity_keys: ["staging-browser-fixture"],
    created_at: now,
    updated_at: now,
  }, { onConflict: "id" });
  if (result.error) throw result.error;
  process.stdout.write(`${JSON.stringify({ status: "PASS", projectRef: safe.projectRef, fixtureId: "staging-browser-manual-target", productionRowsCopied: 0 })}\n`);
}

void main();
