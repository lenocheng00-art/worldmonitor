export const researchMetadataPrefix = "wm:v18:";
const legacyMetadataPrefix = "wm:v17:";

export function encodeMetadata(value: object) {
  return `${researchMetadataPrefix}${JSON.stringify(value)}`;
}

export function encodeTextMetadata(text: string, metadata: object) {
  return `${text}\n\n${encodeMetadata(metadata)}`;
}

export function decodeTextMetadata(value: unknown) {
  const text = String(value ?? "");
  const marker = findLastMarker(text);
  if (!marker) return { text, metadata: {} as Record<string, unknown> };
  const metadata = decodeMetadata(text.slice(marker.index + 2));
  if (!metadata) return { text, metadata: {} as Record<string, unknown> };
  return { text: text.slice(0, marker.index), metadata };
}

export function decodeMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!isEncoded(value)) return undefined;
  try {
    const prefix = value.startsWith(researchMetadataPrefix) ? researchMetadataPrefix : legacyMetadataPrefix;
    const parsed = JSON.parse(value.slice(prefix.length));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function isEncoded(value: unknown): value is string {
  return typeof value === "string"
    && (value.startsWith(researchMetadataPrefix) || value.startsWith(legacyMetadataPrefix));
}

function findLastMarker(text: string) {
  const currentIndex = text.lastIndexOf(`\n\n${researchMetadataPrefix}`);
  const legacyIndex = text.lastIndexOf(`\n\n${legacyMetadataPrefix}`);
  const index = Math.max(currentIndex, legacyIndex);
  return index < 0 ? undefined : { index };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
