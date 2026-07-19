import { NextResponse } from "next/server";

export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, "Cross-origin research writes are not allowed.");
}

export function enforceResearchClient(request: Request) {
  if (request.headers.get("x-worldmonitor-client") !== "research-tracking-v2") throw new HttpError(403, "Invalid WorldMonitor research client.");
}

export function errorResponse(error: unknown) {
  const status = error instanceof HttpError ? error.status : isValidationError(error) ? 400 : 502;
  return NextResponse.json({ error: describeError(error) }, { status });
}

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function isValidationError(error: unknown) {
  return Boolean(error && typeof error === "object" && "name" in error && error.name === "ZodError");
}
function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return "Research Tracking request failed.";
}
