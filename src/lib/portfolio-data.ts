export type PortfolioAccountType =
  | "mainland_bank"
  | "hong_kong_bank"
  | "macau_bank"
  | "brokerage"
  | "private_equity_register"
  | "crypto_exchange"
  | "prediction_market"
  | "manual_other";

export type PortfolioCustodian =
  | "mainland_bank"
  | "hsbc_hk"
  | "boc_macau"
  | "futu"
  | "binance"
  | "polymarket"
  | "manual";

export type PortfolioRegion = "CN" | "HK" | "MO" | "US" | "GLOBAL";

export type PortfolioAssetType =
  | "cash"
  | "deposit"
  | "public_equity"
  | "fund_or_etf"
  | "private_equity"
  | "pre_ipo"
  | "ipo_allocation"
  | "stablecoin"
  | "crypto_spot"
  | "prediction_market"
  | "receivable"
  | "liability"
  | "other";

export type PortfolioCurrency = "CNY" | "HKD" | "USD" | "MOP" | "USDT" | "USDC" | "BTC" | "ETH" | "OTHER";
export type PortfolioBaseCurrency = "CNY";
export type PortfolioLiquidityTier = "T0" | "D1_7" | "M1_6" | "M6_24" | "Y2_PLUS" | "UNKNOWN";
export type PortfolioRiskLevel = "low" | "medium" | "high" | "very_high";
export type PortfolioStatus = "active" | "watching" | "committed" | "invested" | "locked" | "exited" | "written_off";
export type PortfolioValuationMethod = "manual" | "bank_balance" | "market_price" | "last_round" | "cost" | "estimated" | "settlement_value";
export type PortfolioDataConfidence = "high" | "medium" | "low";

export type PortfolioAsset = {
  id: string;
  assetName: string;
  account_type: PortfolioAccountType;
  custodian: PortfolioCustodian;
  region: PortfolioRegion;
  asset_type: PortfolioAssetType;
  currency: PortfolioCurrency;
  cost_basis: number;
  current_value: number;
  original_currency_value: number;
  base_currency: PortfolioBaseCurrency;
  fx_rate_to_base: number;
  base_currency_value: number;
  liquidity_tier: PortfolioLiquidityTier;
  risk_level: PortfolioRiskLevel;
  status: PortfolioStatus;
  valuation_method: PortfolioValuationMethod;
  data_confidence: PortfolioDataConfidence;
  last_verified_at: string;
  expected_exit_date: string | null;
  lockup_end_date: string | null;
  related_signal_id: string | null;
  related_logic_chain_id: string | null;
  related_committee_report_id: string | null;
  related_backtest_id: string | null;
  next_action: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type PortfolioAssetFormValues = {
  name: string;
  account_type: PortfolioAccountType;
  custodian: PortfolioCustodian;
  region: PortfolioRegion;
  asset_type: PortfolioAssetType;
  currency: PortfolioCurrency;
  cost_basis: number;
  current_value: number;
  liquidity_tier: PortfolioLiquidityTier;
  risk_level: PortfolioRiskLevel;
  status: PortfolioStatus;
  valuation_method: PortfolioValuationMethod;
  data_confidence: PortfolioDataConfidence;
  last_verified_at: string;
  expected_exit_date: string;
  lockup_end_date: string;
  next_action: string;
  notes: string;
};

export const portfolioStorageKey = "worldmonitor:portfolio-assets:v1";

export const accountTypeOptions: PortfolioAccountType[] = [
  "mainland_bank",
  "hong_kong_bank",
  "macau_bank",
  "brokerage",
  "private_equity_register",
  "crypto_exchange",
  "prediction_market",
  "manual_other",
];

export const custodianOptions: PortfolioCustodian[] = [
  "mainland_bank",
  "hsbc_hk",
  "boc_macau",
  "futu",
  "binance",
  "polymarket",
  "manual",
];

export const regionOptions: PortfolioRegion[] = ["CN", "HK", "MO", "US", "GLOBAL"];

export const assetTypeOptions: PortfolioAssetType[] = [
  "cash",
  "deposit",
  "public_equity",
  "fund_or_etf",
  "private_equity",
  "pre_ipo",
  "ipo_allocation",
  "stablecoin",
  "crypto_spot",
  "prediction_market",
  "receivable",
  "liability",
  "other",
];

export const currencyOptions: PortfolioCurrency[] = ["CNY", "HKD", "USD", "MOP", "USDT", "USDC", "BTC", "ETH", "OTHER"];
export const liquidityOptions: PortfolioLiquidityTier[] = ["T0", "D1_7", "M1_6", "M6_24", "Y2_PLUS", "UNKNOWN"];
export const riskOptions: PortfolioRiskLevel[] = ["low", "medium", "high", "very_high"];
export const statusOptions: PortfolioStatus[] = ["active", "watching", "committed", "invested", "locked", "exited", "written_off"];
export const valuationMethodOptions: PortfolioValuationMethod[] = ["manual", "bank_balance", "market_price", "last_round", "cost", "estimated", "settlement_value"];
export const dataConfidenceOptions: PortfolioDataConfidence[] = ["high", "medium", "low"];

export const fxRatesToCny: Record<PortfolioCurrency, number> = {
  CNY: 1,
  HKD: 0.93,
  USD: 7.25,
  MOP: 0.9,
  USDT: 7.24,
  USDC: 7.24,
  BTC: 468000,
  ETH: 25000,
  OTHER: 1,
};

export const mockPortfolioAssets: PortfolioAsset[] = [
  entry("mainland-cny-cash", "中国大陆银行卡 CNY 现金", "mainland_bank", "mainland_bank", "CN", "cash", "CNY", 420000, 420000, "T0", "low", "active", "bank_balance", "high", "2026-06-28T21:00:00+08:00", "Monthly balance refresh"),
  entry("hsbc-hkd-cash", "香港汇丰 HKD 现金", "hong_kong_bank", "hsbc_hk", "HK", "cash", "HKD", 560000, 560000, "T0", "low", "active", "bank_balance", "high", "2026-06-28T21:00:00+08:00", "Keep dry powder for HK allocation"),
  entry("hsbc-usd-cash", "香港汇丰 USD 现金", "hong_kong_bank", "hsbc_hk", "HK", "cash", "USD", 88000, 88000, "T0", "low", "active", "bank_balance", "high", "2026-06-28T21:00:00+08:00", "Review USD deployment list"),
  entry("boc-macau-mop-cash", "中国银行澳门分行 MOP 现金", "macau_bank", "boc_macau", "MO", "cash", "MOP", 210000, 210000, "T0", "low", "active", "bank_balance", "high", "2026-06-28T20:30:00+08:00", "Confirm cross-border transfer quota"),
  entry("futu-hkd-cash", "富途 HKD 现金", "brokerage", "futu", "HK", "cash", "HKD", 180000, 180000, "T0", "low", "active", "manual", "medium", "2026-06-27T18:20:00+08:00", "Keep available for HK orders"),
  entry("futu-usd-cash", "富途 USD 现金", "brokerage", "futu", "US", "cash", "USD", 36000, 36000, "T0", "low", "active", "manual", "medium", "2026-06-27T18:20:00+08:00", "Match against US equity watchlist"),
  entry("futu-us-etf", "富途美股 / ETF", "brokerage", "futu", "US", "fund_or_etf", "USD", 165000, 178500, "D1_7", "medium", "invested", "market_price", "medium", "2026-06-28T16:00:00+08:00", "Rebalance after monthly risk review", "logic-us-risk-assets"),
  entry("yunling-optoelectronics", "云岭光电", "private_equity_register", "manual", "CN", "private_equity", "CNY", 500000, 640000, "Y2_PLUS", "very_high", "locked", "last_round", "medium", "2026-06-22T10:30:00+08:00", "Request quarterly operating update", "logic-hard-tech-cn", "committee-yunling", null, "2029-12-31", "2028-06-30"),
  entry("shanghai-microelectronics", "上海微电子", "private_equity_register", "manual", "CN", "private_equity", "CNY", 800000, 950000, "Y2_PLUS", "very_high", "invested", "estimated", "low", "2026-06-20T14:10:00+08:00", "Validate latest financing marker", "logic-semiconductor-localization", "committee-smee", null, "2030-12-31", "2029-12-31"),
  entry("eswin-computing-preipo", "奕斯伟计算 IPO / Pre-IPO", "private_equity_register", "manual", "CN", "pre_ipo", "CNY", 300000, 315000, "M6_24", "high", "committed", "cost", "medium", "2026-06-25T12:00:00+08:00", "Track IPO filing progress", "logic-ai-chip-supply-chain", "committee-eswin", null, "2027-12-31", "2027-06-30"),
  entry("binance-usdt", "Binance USDT", "crypto_exchange", "binance", "GLOBAL", "stablecoin", "USDT", 52000, 52000, "T0", "medium", "active", "manual", "medium", "2026-06-28T19:00:00+08:00", "Keep below exchange concentration limit"),
  entry("binance-btc", "Binance BTC", "crypto_exchange", "binance", "GLOBAL", "crypto_spot", "BTC", 0.14, 0.154, "T0", "very_high", "invested", "market_price", "low", "2026-06-28T19:05:00+08:00", "Review stop and custody policy", "logic-crypto-beta"),
  entry("polymarket-usdc-cash", "Polymarket USDC Cash", "prediction_market", "polymarket", "GLOBAL", "stablecoin", "USDC", 18000, 18000, "T0", "medium", "active", "manual", "medium", "2026-06-28T15:20:00+08:00", "Reserve for signal-driven positions"),
  entry("polymarket-open-positions", "Polymarket Open Positions", "prediction_market", "polymarket", "GLOBAL", "prediction_market", "USDC", 11500, 12600, "D1_7", "high", "invested", "settlement_value", "low", "2026-06-28T15:30:00+08:00", "Review event-level exit prices", "logic-hk-temperature", null, "backtest-hk-temperature-v1", "2026-09-30"),
  entry("credit-card-payable", "信用卡或应付款 liability", "manual_other", "manual", "GLOBAL", "liability", "USD", -8600, -8600, "D1_7", "medium", "active", "manual", "medium", "2026-06-28T21:00:00+08:00", "Pay before statement due date", null, null, null, "2026-07-15"),
];

export function buildPortfolioAsset(values: PortfolioAssetFormValues, existing?: PortfolioAsset): PortfolioAsset {
  const now = new Date().toISOString();
  const fxRate = fxRatesToCny[values.currency] ?? 1;

  return {
    id: existing?.id ?? `manual-${Date.now().toString(36)}`,
    assetName: values.name.trim() || "Untitled Asset",
    account_type: values.account_type,
    custodian: values.custodian,
    region: values.region,
    asset_type: values.asset_type,
    currency: values.currency,
    cost_basis: Number(values.cost_basis) || 0,
    current_value: Number(values.current_value) || 0,
    original_currency_value: Number(values.current_value) || 0,
    base_currency: "CNY",
    fx_rate_to_base: fxRate,
    base_currency_value: (Number(values.current_value) || 0) * fxRate,
    liquidity_tier: values.liquidity_tier,
    risk_level: values.risk_level,
    status: values.status,
    valuation_method: values.valuation_method,
    data_confidence: values.data_confidence,
    last_verified_at: values.last_verified_at || now,
    expected_exit_date: values.expected_exit_date || null,
    lockup_end_date: values.lockup_end_date || null,
    related_signal_id: existing?.related_signal_id ?? null,
    related_logic_chain_id: existing?.related_logic_chain_id ?? null,
    related_committee_report_id: existing?.related_committee_report_id ?? null,
    related_backtest_id: existing?.related_backtest_id ?? null,
    next_action: values.next_action,
    notes: values.notes,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}

export function toPortfolioFormValues(asset?: PortfolioAsset): PortfolioAssetFormValues {
  return {
    name: asset?.assetName ?? "",
    account_type: asset?.account_type ?? "mainland_bank",
    custodian: asset?.custodian ?? "mainland_bank",
    region: asset?.region ?? "CN",
    asset_type: asset?.asset_type ?? "cash",
    currency: asset?.currency ?? "CNY",
    cost_basis: asset?.cost_basis ?? 0,
    current_value: asset?.current_value ?? 0,
    liquidity_tier: asset?.liquidity_tier ?? "T0",
    risk_level: asset?.risk_level ?? "low",
    status: asset?.status ?? "active",
    valuation_method: asset?.valuation_method ?? "manual",
    data_confidence: asset?.data_confidence ?? "medium",
    last_verified_at: asset?.last_verified_at ? asset.last_verified_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
    expected_exit_date: asset?.expected_exit_date ?? "",
    lockup_end_date: asset?.lockup_end_date ?? "",
    next_action: asset?.next_action ?? "",
    notes: asset?.notes ?? "",
  };
}

export function readStoredPortfolioAssets(): PortfolioAsset[] {
  if (typeof window === "undefined") return mockPortfolioAssets;

  try {
    const stored = window.localStorage.getItem(portfolioStorageKey);
    if (!stored) return mockPortfolioAssets;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizePortfolioAsset) : mockPortfolioAssets;
  } catch {
    return mockPortfolioAssets;
  }
}

export function writeStoredPortfolioAssets(assets: PortfolioAsset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(portfolioStorageKey, JSON.stringify(assets));
}

export function normalizePortfolioAsset(asset: PortfolioAsset): PortfolioAsset {
  const fxRate = asset.fx_rate_to_base ?? fxRatesToCny[asset.currency] ?? 1;
  const currentValue = Number(asset.current_value) || 0;

  return {
    ...asset,
    original_currency_value: asset.original_currency_value ?? currentValue,
    base_currency: "CNY",
    fx_rate_to_base: fxRate,
    base_currency_value: Number.isFinite(asset.base_currency_value) ? asset.base_currency_value : currentValue * fxRate,
    data_confidence: asset.data_confidence ?? "medium",
    last_verified_at: asset.last_verified_at ?? asset.updated_at,
  };
}

function entry(
  id: string,
  assetName: string,
  account_type: PortfolioAccountType,
  custodian: PortfolioCustodian,
  region: PortfolioRegion,
  asset_type: PortfolioAssetType,
  currency: PortfolioCurrency,
  cost_basis: number,
  current_value: number,
  liquidity_tier: PortfolioLiquidityTier,
  risk_level: PortfolioRiskLevel,
  status: PortfolioStatus,
  valuation_method: PortfolioValuationMethod,
  data_confidence: PortfolioDataConfidence,
  last_verified_at: string,
  next_action: string,
  related_logic_chain_id: string | null = null,
  related_committee_report_id: string | null = null,
  related_backtest_id: string | null = null,
  expected_exit_date: string | null = null,
  lockup_end_date: string | null = null,
): PortfolioAsset {
  const fxRate = fxRatesToCny[currency];
  return {
    id,
    assetName,
    account_type,
    custodian,
    region,
    asset_type,
    currency,
    cost_basis,
    current_value,
    original_currency_value: current_value,
    base_currency: "CNY",
    fx_rate_to_base: fxRate,
    base_currency_value: current_value * fxRate,
    liquidity_tier,
    risk_level,
    status,
    valuation_method,
    data_confidence,
    last_verified_at,
    expected_exit_date,
    lockup_end_date,
    related_signal_id: null,
    related_logic_chain_id,
    related_committee_report_id,
    related_backtest_id,
    next_action,
    notes: "Manual mock register entry. No bank, brokerage, crypto exchange, or prediction-market API is connected.",
    created_at: "2026-06-01T09:00:00+08:00",
    updated_at: "2026-06-28T21:00:00+08:00",
  };
}
