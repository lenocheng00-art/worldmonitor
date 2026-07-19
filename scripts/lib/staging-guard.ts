import { readFileSync } from "node:fs";

const KNOWN_PRODUCTION_PROJECT_REFS = new Set(["ptkkjjgsqrahotoymurl"]);

export type SafeTarget = {
  environment: string;
  host: string;
  local: boolean;
};

export function assertStagingTarget(rawUrl: string | undefined, environment = process.env.STAGING_ENVIRONMENT ?? "staging"): SafeTarget {
  if (!rawUrl) throw new StagingConfigurationError("A staging/local target URL is required.");
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new StagingConfigurationError("The staging/local target URL is invalid.");
  }
  const host = url.hostname.toLowerCase();
  const local = ["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(host);
  const environmentName = environment.trim().toLowerCase();
  if (!local && !/(staging|stage|test|preview|development)/.test(environmentName)) {
    throw new StagingConfigurationError(`Environment ${environment} is not explicitly marked staging/test.`);
  }

  const targetIdentity = `${rawUrl} ${url.username} ${host}`.toLowerCase();
  for (const projectRef of productionProjectRefs()) {
    if (projectRef && targetIdentity.includes(projectRef)) {
      throw new StagingConfigurationError(`Refusing known Production project ${projectRef}.`);
    }
  }
  return { environment: environmentName, host, local };
}

export function requireStagingVariable(name: string) {
  const value = process.env[name];
  if (!value) throw new StagingConfigurationError(`${name} is required for real staging validation.`);
  return value;
}

export function assertStagingAppTarget(rawUrl: string | undefined) {
  if (!rawUrl) throw new StagingConfigurationError("STAGING_APP_URL is required for real end-to-end validation.");
  const url = new URL(rawUrl);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (!local && !/(staging|stage|preview)/i.test(url.hostname)) {
    throw new StagingConfigurationError(`Refusing app host ${url.hostname}: it is not explicitly staging/preview.`);
  }
  if (url.hostname === "worldmonitor-flax-omega.vercel.app") {
    throw new StagingConfigurationError("Refusing the known Production WorldMonitor deployment.");
  }
  return { origin: url.origin, host: url.hostname, local };
}

export class StagingConfigurationError extends Error {}

function productionProjectRefs() {
  const refs = new Set(KNOWN_PRODUCTION_PROJECT_REFS);
  for (const rawUrl of [process.env.PRODUCTION_SUPABASE_URL, readLocalSupabaseUrl()]) {
    if (!rawUrl) continue;
    try {
      const host = new URL(rawUrl).hostname;
      const projectRef = host.split(".")[0];
      if (projectRef && projectRef !== "localhost") refs.add(projectRef);
    } catch {
      // A malformed local env value is ignored here; the target URL itself is
      // still validated above and secrets are never printed.
    }
  }
  return refs;
}

function readLocalSupabaseUrl() {
  try {
    const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((item) => item.startsWith("NEXT_PUBLIC_SUPABASE_URL="));
    return line?.slice("NEXT_PUBLIC_SUPABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
  } catch {
    return undefined;
  }
}
