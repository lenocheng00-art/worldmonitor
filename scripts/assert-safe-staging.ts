import { assertSafeStagingEnvironment, StagingConfigurationError } from "./lib/staging-guard";

try {
  const result = assertSafeStagingEnvironment();
  process.stdout.write(`${JSON.stringify({
    status: "PASS",
    environment: result.appEnvironment,
    projectRef: result.projectRef,
    supabaseHost: result.supabase.host,
    databaseHost: result.database.host,
    productionProjectRef: "ptkkjjgsqrahotoymurl",
    isolatedFromProduction: true,
    requiredSecretsPresent: true,
  }, null, 2)}\n`);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`BLOCKED: ${message}\n`);
  process.exitCode = error instanceof StagingConfigurationError ? 1 : 2;
}
