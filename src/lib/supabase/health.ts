import { createClient } from "@supabase/supabase-js";

export type DatabaseHealth =
  | {
      connected: true;
      project: string;
    }
  | {
      connected: false;
      error: string;
    };

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      connected: false,
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

    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
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
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Supabase connection test failed.",
    };
  }
}
