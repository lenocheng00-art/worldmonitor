import { createClient } from "@supabase/supabase-js";
import { assertSafeStagingEnvironment, requireStagingVariable } from "./lib/staging-guard";

async function main() {
  const safe = assertSafeStagingEnvironment();
  const url = requireStagingVariable("STAGING_SUPABASE_URL");
  const serviceKey = requireStagingVariable("STAGING_SUPABASE_SERVICE_ROLE_KEY");
  const email = requireStagingVariable("STAGING_TEST_EMAIL");
  const password = requireStagingVariable("STAGING_TEST_PASSWORD");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existing.error) throw existing.error;
  let user = existing.data.users.find((item) => item.email === email);
  if (!user) {
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { purpose: "worldmonitor-staging-rls" } });
    if (created.error) throw created.error;
    user = created.data.user;
  }
  process.stdout.write(`${JSON.stringify({ status: "PASS", projectRef: safe.projectRef, userId: user.id, emailConfigured: true, passwordPrinted: false })}\n`);
}

void main();
