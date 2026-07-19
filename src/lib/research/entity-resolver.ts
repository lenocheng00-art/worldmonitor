import type { NormalizedEntity } from "@/lib/research/schemas";

type EntityRegistryEntry = {
  key: string;
  canonicalName: string;
  type: NormalizedEntity["type"];
  aliases: string[];
  listings: Array<{ ticker: string; exchange: string; currency: string; kind: "equity" | "adr" | "gdr" }>;
};

const seedRegistry: EntityRegistryEntry[] = [
  { key: "micron", canonicalName: "Micron Technology", type: "company", aliases: ["Micron", "MU", "美光", "美光科技", "Micron Technology"], listings: [{ ticker: "MU", exchange: "NASDAQ", currency: "USD", kind: "equity" }] },
  { key: "tsmc", canonicalName: "Taiwan Semiconductor Manufacturing", type: "company", aliases: ["TSMC", "TSM", "台积电", "Taiwan Semiconductor"], listings: [{ ticker: "TSM", exchange: "NYSE", currency: "USD", kind: "adr" }, { ticker: "2330.TW", exchange: "TWSE", currency: "TWD", kind: "equity" }] },
  { key: "sk-hynix", canonicalName: "SK hynix", type: "company", aliases: ["SK hynix", "SK Hynix", "海力士", "SKHY", "HYXS"], listings: [{ ticker: "SKHY", exchange: "NASDAQ", currency: "USD", kind: "adr" }, { ticker: "HYXS LX", exchange: "Luxembourg Euro MTF", currency: "USD", kind: "gdr" }, { ticker: "000660.KS", exchange: "KRX", currency: "KRW", kind: "equity" }] },
  { key: "western-digital", canonicalName: "Western Digital", type: "company", aliases: ["WDC", "西部数据", "Western Digital"], listings: [{ ticker: "WDC", exchange: "NASDAQ", currency: "USD", kind: "equity" }] },
  { key: "sandisk", canonicalName: "SanDisk", type: "company", aliases: ["SNDK", "闪迪", "SanDisk"], listings: [{ ticker: "SNDK", exchange: "NASDAQ", currency: "USD", kind: "equity" }] },
  { key: "cxmt", canonicalName: "ChangXin Memory Technologies", type: "company", aliases: ["长鑫存储", "长鑫", "CXMT"], listings: [] },
  { key: "nvidia", canonicalName: "NVIDIA", type: "company", aliases: ["NVIDIA", "NVDA", "英伟达"], listings: [{ ticker: "NVDA", exchange: "NASDAQ", currency: "USD", kind: "equity" }] },
  { key: "spacex", canonicalName: "SpaceX", type: "company", aliases: ["SpaceX", "Starlink"], listings: [] },
  { key: "wti", canonicalName: "WTI Crude Oil", type: "commodity", aliases: ["WTI", "原油", "油价"], listings: [{ ticker: "CL=F", exchange: "NYMEX", currency: "USD", kind: "equity" }] },
  { key: "semiconductor", canonicalName: "Semiconductors", type: "industry", aliases: ["半导体", "费半", "SOXX", "memory", "存储"], listings: [] },
];

export type ResolvedEntities = {
  entities: NormalizedEntity[];
  tickers: string[];
  entityKeys: string[];
  listingEvidence: Array<{ entityKey: string; ticker: string; exchange: string; currency: string; kind: "equity" | "adr" | "gdr" }>;
};

export class EntityRegistry {
  constructor(private readonly entries: EntityRegistryEntry[] = seedRegistry) {}

  resolve(text: string): ResolvedEntities {
    const matches = this.entries.filter((entry) => entry.aliases.some((alias) => containsAlias(text, alias)));
    const entities = matches.map((entry) => ({
      type: entry.type,
      canonicalName: entry.canonicalName,
      aliases: entry.aliases.filter((alias) => containsAlias(text, alias)),
    } satisfies NormalizedEntity));
    const explicitTickerTokens = new Set((text.match(/(?:^|[^A-Z0-9])([A-Z][A-Z0-9.=]{1,11})(?=$|[^A-Z0-9])/g) ?? []).map((value) => value.replace(/[^A-Z0-9.=]/g, "")));
    const listingEvidence = matches.flatMap((entry) => entry.listings
      .filter((listing) => explicitTickerTokens.has(listing.ticker) || shouldSelectPrimaryListing(text, entry, listing))
      .map((listing) => ({ entityKey: entry.key, ...listing })));
    return {
      entities,
      tickers: [...new Set(listingEvidence.map((item) => item.ticker))],
      entityKeys: matches.map((entry) => entry.key),
      listingEvidence,
    };
  }

  register(entry: EntityRegistryEntry) {
    if (this.entries.some((item) => item.key === entry.key)) throw new Error(`Entity key already exists: ${entry.key}`);
    this.entries.push(entry);
  }
}

export const entityRegistry = new EntityRegistry();

export function resolveEntities(text: string) {
  return entityRegistry.resolve(text);
}

function shouldSelectPrimaryListing(text: string, entry: EntityRegistryEntry, listing: EntityRegistryEntry["listings"][number]) {
  if (!entry.listings.length) return false;
  if (entry.listings.length === 1) return true;
  if (/ADR|美股|NYSE|NASDAQ/i.test(text) && listing.kind === "adr") return true;
  if (/GDR|卢森堡|Luxembourg/i.test(text) && listing.kind === "gdr") return true;
  if (/\bDR\b|美元/i.test(text) && (listing.kind === "adr" || listing.kind === "gdr")) return true;
  if (/首尔|韩国|韩元|KRX/i.test(text) && listing.exchange === "KRX") return true;
  if (/台湾|台股|台币|TWSE/i.test(text) && listing.exchange === "TWSE") return true;
  if (entry.key === "tsmc") return listing.kind === "adr";
  return false;
}

function containsAlias(text: string, alias: string) {
  if (/^[A-Za-z0-9.= -]+$/.test(alias)) {
    return new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegex(alias)}(?:$|[^A-Za-z0-9])`, "i").test(text);
  }
  return text.includes(alias);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
