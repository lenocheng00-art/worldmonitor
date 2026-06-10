import { createClient } from "@supabase/supabase-js";

export type DatabaseHealth = {
  connected: boolean;
  project: string;
  error: string;
};

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      connected: false,
      project: "",
      error: "Supabase environment variables are not configured.",
    };
  }

  try {
    const url = new URL(supabaseUrl);
    const project = url.hostname.split(".")[0];

    if (!project) {
      throw new Error("Supabase project ID could not be determined.");
    }

    createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: {
        apikey: supabaseAnonKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Supabase connection test returned HTTP ${response.status}.`);
    }

    return {
      connected: true,
      project,
      error: "",
    };
  } catch (error) {
    return {
      connected: false,
      project: getProjectId(supabaseUrl),
      error: error instanceof Error ? error.message : "Supabase connection test failed.",
    };
  }
}

function getProjectId(supabaseUrl: string) {
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}
