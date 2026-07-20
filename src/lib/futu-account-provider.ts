import "server-only";

import type { FutuAccountSnapshot, FutuAccountView, FutuRiskAlert } from "@/lib/futu-account";

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function disconnected(status: FutuAccountView["status"], error: string): FutuAccountView {
  return { status, snapshot: null, alerts: [], error };
}

async function bridgeFetch(baseUrl: URL, path: string, token: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(new URL(path, baseUrl), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getFutuAccountView(): Promise<FutuAccountView> {
  const token = process.env.FUTU_BRIDGE_TOKEN;
  if (!token) return disconnected("misconfigured", "FUTU_BRIDGE_TOKEN is not configured on the Next.js server");

  let baseUrl: URL;
  try {
    baseUrl = new URL(process.env.FUTU_BRIDGE_URL ?? "http://127.0.0.1:8787");
  } catch {
    return disconnected("misconfigured", "FUTU_BRIDGE_URL is invalid");
  }
  if (!loopbackHosts.has(baseUrl.hostname)) {
    return disconnected("misconfigured", "FUTU_BRIDGE_URL must use a loopback host");
  }

  const timeoutMs = Number(process.env.FUTU_BRIDGE_TIMEOUT_MS ?? 3000);
  try {
    const snapshotResponse = await bridgeFetch(baseUrl, "/v1/account/snapshot", token, timeoutMs);
    if (!snapshotResponse.ok) {
      const body = (await snapshotResponse.json().catch(() => null)) as { message?: string } | null;
      return disconnected("disconnected", body?.message ?? `Futu Bridge returned HTTP ${snapshotResponse.status}`);
    }
    const snapshot = (await snapshotResponse.json()) as FutuAccountSnapshot;
    const alertResponse = await bridgeFetch(baseUrl, "/v1/risk/alerts", token, timeoutMs);
    const alertBody = alertResponse.ok
      ? ((await alertResponse.json()) as { alerts?: FutuRiskAlert[] })
      : { alerts: [] };
    return {
      status: snapshot.freshness.openDConnected && !snapshot.freshness.stale ? "connected" : "disconnected",
      snapshot,
      alerts: alertBody.alerts ?? [],
      error: snapshot.freshness.errors.length ? snapshot.freshness.errors.join(", ") : null,
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Futu Bridge request timed out"
      : "Futu Bridge is unavailable on this Mac";
    return disconnected("disconnected", message);
  }
}
