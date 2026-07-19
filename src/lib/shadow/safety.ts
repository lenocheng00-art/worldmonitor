const PRODUCTION_PROJECT_REF = "ptkkjjgsqrahotoymurl";
const SHADOW_SCHEMA = "shadow";

export type SafeShadowEnvironment = {
  productionHost: string;
  productionProjectRef: string;
  shadowDatabaseHost: string;
  shadowProjectRef: string;
  shadowSchema: "shadow";
};

export function assertShadowEnvironment(): SafeShadowEnvironment {
  if (process.env.APP_ENV !== "shadow") throw new ShadowSafetyError("APP_ENV must be exactly shadow.");
  const productionUrl = required("PRODUCTION_READ_URL");
  const productionKey = required("PRODUCTION_READ_ANON_KEY");
  const shadowDatabaseUrl = required("SHADOW_DATABASE_URL");
  const shadowProjectRef = required("SHADOW_PROJECT_REF").toLowerCase();
  if (process.env.PRODUCTION_READ_SERVICE_ROLE_KEY) throw new ShadowSafetyError("Production service-role credentials are forbidden in Shadow Mode.");
  if ((process.env.SHADOW_SCHEMA ?? SHADOW_SCHEMA) !== SHADOW_SCHEMA) throw new ShadowSafetyError("SHADOW_SCHEMA must be exactly shadow.");

  const production = parseUrl(productionUrl, "Production read URL");
  const shadow = parseUrl(shadowDatabaseUrl, "Shadow database URL");
  const productionRef = production.hostname.split(".")[0]?.toLowerCase();
  if (productionRef !== PRODUCTION_PROJECT_REF) throw new ShadowSafetyError("Production reader must target the approved Production project ref.");
  if (shadow.hostname.includes(PRODUCTION_PROJECT_REF) || decodeURIComponent(shadow.username).includes(PRODUCTION_PROJECT_REF)) {
    throw new ShadowSafetyError("Shadow database must not target Production.");
  }
  const databaseRef = projectRefFromDatabaseUrl(shadow);
  if (!databaseRef || databaseRef !== shadowProjectRef) throw new ShadowSafetyError("Shadow database identity does not match SHADOW_PROJECT_REF.");
  if (shadowProjectRef === PRODUCTION_PROJECT_REF) throw new ShadowSafetyError("Shadow project ref must differ from Production.");
  assertReadOnlyKey(productionKey);

  return {
    productionHost: production.hostname,
    productionProjectRef: productionRef,
    shadowDatabaseHost: shadow.hostname,
    shadowProjectRef,
    shadowSchema: SHADOW_SCHEMA,
  };
}

export function productionReadCredentials() {
  assertShadowEnvironment();
  return { url: required("PRODUCTION_READ_URL"), anonKey: required("PRODUCTION_READ_ANON_KEY") };
}

export function shadowDatabaseUrl() {
  assertShadowEnvironment();
  return required("SHADOW_DATABASE_URL");
}

export class ShadowSafetyError extends Error {}

function assertReadOnlyKey(key: string) {
  if (key.startsWith("sb_publishable_")) return;
  const parts = key.split(".");
  if (parts.length !== 3) throw new ShadowSafetyError("Production reader key must be an anon JWT or publishable key.");
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: string };
    if (payload.role !== "anon") throw new ShadowSafetyError("Production reader key must have role=anon.");
  } catch (error) {
    if (error instanceof ShadowSafetyError) throw error;
    throw new ShadowSafetyError("Production reader key JWT could not be validated.");
  }
}

function projectRefFromDatabaseUrl(url: URL) {
  const direct = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  if (direct) return direct[1];
  return decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
}

function parseUrl(value: string, label: string) {
  try { return new URL(value); } catch { throw new ShadowSafetyError(`${label} is invalid.`); }
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new ShadowSafetyError(`${name} is required.`);
  return value;
}
