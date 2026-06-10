export type DatabaseHealth = {
  connected: boolean;
  project: string | null;
  supabaseUrl: string | null;
  fetchTarget: string | null;
  status: number | null;
  statusText: string | null;
  errorName: string | null;
  errorMessage: string | null;
  errorCause: string | null;
};

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseUrl = normalizeSupabaseUrl(configuredUrl);
  const fetchTarget = supabaseUrl ? `${supabaseUrl}/rest/v1/` : null;
  const project = getProjectId(supabaseUrl);

  if (!supabaseUrl || !anonKey || !fetchTarget) {
    const missingVariables = [
      !configuredUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !anonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    ].filter(Boolean);
    const errorMessage = missingVariables.length
      ? `Missing environment variables: ${missingVariables.join(", ")}.`
      : "NEXT_PUBLIC_SUPABASE_URL is invalid.";

    console.error("[database-health] Supabase configuration error", {
      project,
      supabaseUrl,
      fetchTarget,
      keyType: "anon key",
      errorMessage,
    });

    return {
      connected: false,
      project,
      supabaseUrl,
      fetchTarget,
      status: null,
      statusText: null,
      errorName: "ConfigurationError",
      errorMessage,
      errorCause: null,
    };
  }

  console.info("[database-health] Fetching Supabase REST endpoint", {
    project,
    supabaseUrl,
    fetchTarget,
    keyType: "anon key",
  });

  try {
    const response = await fetch(fetchTarget, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    console.info("[database-health] Supabase REST endpoint responded", {
      project,
      fetchTarget,
      keyType: "anon key",
      status: response.status,
      statusText: response.statusText,
    });

    return {
      connected: true,
      project,
      supabaseUrl,
      fetchTarget,
      status: response.status,
      statusText: response.statusText || null,
      errorName: null,
      errorMessage: null,
      errorCause: null,
    };
  } catch (error) {
    const diagnostics = getErrorDiagnostics(error);

    console.error("[database-health] Supabase REST fetch threw", {
      project,
      supabaseUrl,
      fetchTarget,
      keyType: "anon key",
      ...diagnostics,
    });

    return {
      connected: false,
      project,
      supabaseUrl,
      fetchTarget,
      status: null,
      statusText: null,
      ...diagnostics,
    };
  }
}

function normalizeSupabaseUrl(value?: string): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getProjectId(supabaseUrl: string | null): string | null {
  if (!supabaseUrl) return null;

  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function getErrorDiagnostics(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      errorName: "UnknownError",
      errorMessage: String(error),
      errorCause: null,
    };
  }

  return {
    errorName: error.name,
    errorMessage: error.message,
    errorCause: formatErrorCause(error.cause),
  };
}

function formatErrorCause(cause: unknown): string | null {
  if (!cause) return null;
  if (!(cause instanceof Error)) return String(cause);

  const networkCause = cause as Error & {
    code?: string;
    errno?: number | string;
    syscall?: string;
    hostname?: string;
    address?: string;
    port?: number;
  };
  const metadata = [
    networkCause.code ? `code=${networkCause.code}` : null,
    networkCause.errno !== undefined ? `errno=${networkCause.errno}` : null,
    networkCause.syscall ? `syscall=${networkCause.syscall}` : null,
    networkCause.hostname ? `hostname=${networkCause.hostname}` : null,
    networkCause.address ? `address=${networkCause.address}` : null,
    networkCause.port !== undefined ? `port=${networkCause.port}` : null,
  ].filter(Boolean);

  return `${networkCause.name}: ${networkCause.message}${
    metadata.length ? ` (${metadata.join(", ")})` : ""
  }`;
}
