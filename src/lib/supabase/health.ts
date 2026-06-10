import { createClient } from "@supabase/supabase-js";

type HealthKeyType = "anon key";

export type DatabaseHealth = {
  connected: boolean;
  project: string | null;
  endpoint: string | null;
  keyType: HealthKeyType;
  error: string | null;
};

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const keyType: HealthKeyType = "anon key";
  const endpoint = getHealthEndpoint(supabaseUrl);

  if (!supabaseUrl || !supabaseAnonKey) {
    const missingVariables = [
      !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    ].filter(Boolean);
    const error = `Supabase environment variables are not configured. Missing: ${missingVariables.join(", ")}.`;

    console.error("[database-health] Configuration error", {
      endpoint,
      keyType,
      error,
    });

    return {
      connected: false,
      project: getProjectId(supabaseUrl),
      endpoint,
      keyType,
      error,
    };
  }

  try {
    const url = new URL(supabaseUrl);
    const project = url.hostname.split(".")[0];

    if (!project) {
      throw new Error("Supabase project ID could not be determined.");
    }

    if (!endpoint) {
      throw new Error("Supabase health endpoint could not be determined.");
    }

    createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.info("[database-health] Testing Supabase connection", {
      endpoint,
      keyType,
    });

    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseAnonKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(
        `Supabase returned HTTP ${response.status} ${response.statusText}${
          responseBody ? `: ${responseBody.slice(0, 500)}` : ""
        }`,
      );
    }

    return {
      connected: true,
      project,
      endpoint,
      keyType,
      error: null,
    };
  } catch (error) {
    const detailedError = formatConnectionError(error, endpoint, keyType);

    console.error("[database-health] Supabase connection failed", {
      endpoint,
      keyType,
      error: detailedError,
      cause: getErrorCause(error),
    });

    return {
      connected: false,
      project: getProjectId(supabaseUrl),
      endpoint,
      keyType,
      error: detailedError,
    };
  }
}

function getHealthEndpoint(supabaseUrl?: string): string | null {
  if (!supabaseUrl) return null;

  try {
    return `${new URL(supabaseUrl).origin}/auth/v1/settings`;
  } catch {
    return null;
  }
}

function getProjectId(supabaseUrl?: string): string | null {
  if (!supabaseUrl) return null;

  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function formatConnectionError(
  error: unknown,
  endpoint: string | null,
  keyType: HealthKeyType,
) {
  const details = describeError(error);
  return `Supabase health request failed. URL: ${endpoint ?? "invalid URL"}. Key: ${keyType}. ${details}`;
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const details = [`${error.name}: ${error.message}`];
  const cause = getErrorCause(error);

  if (cause) {
    details.push(`Cause: ${cause}`);
  }

  return details.join(". ");
}

function getErrorCause(error: unknown): string | null {
  if (!(error instanceof Error) || !error.cause) {
    return null;
  }

  if (!(error.cause instanceof Error)) {
    return String(error.cause);
  }

  const cause = error.cause as Error & {
    code?: string;
    errno?: number | string;
    syscall?: string;
    hostname?: string;
  };
  const metadata = [
    cause.code ? `code=${cause.code}` : null,
    cause.errno !== undefined ? `errno=${cause.errno}` : null,
    cause.syscall ? `syscall=${cause.syscall}` : null,
    cause.hostname ? `hostname=${cause.hostname}` : null,
  ].filter(Boolean);

  return `${cause.name}: ${cause.message}${metadata.length ? ` (${metadata.join(", ")})` : ""}`;
}
