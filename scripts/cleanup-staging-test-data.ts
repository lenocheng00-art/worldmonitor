import { createClient } from "@supabase/supabase-js";
import { assertSafeStagingEnvironment, requireStagingVariable } from "./lib/staging-guard";

async function main() {
  const safe = assertSafeStagingEnvironment();
  const supabase = createClient(
    requireStagingVariable("STAGING_SUPABASE_URL"),
    requireStagingVariable("STAGING_SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const signals = await supabase.from("signals").select("id,logic_chain_id").like("source_post_id", "staging-%");
  if (signals.error) throw signals.error;
  const chainIds = [...new Set((signals.data ?? []).map((row) => row.logic_chain_id).filter((id): id is string => Boolean(id)))];
  if (chainIds.length) {
    const chains = await supabase.from("logic_chains").delete().in("id", chainIds);
    if (chains.error) throw chains.error;
  }
  const remaining = await supabase.from("signals").delete().like("source_post_id", "staging-%");
  if (remaining.error) throw remaining.error;
  const browserFixture = await supabase.from("logic_chains").delete().eq("id", "staging-browser-manual-target");
  if (browserFixture.error) throw browserFixture.error;
  process.stdout.write(`${JSON.stringify({ status: "PASS", projectRef: safe.projectRef, deletedSignals: signals.data?.length ?? 0, deletedChains: chainIds.length })}\n`);
}

void main();
