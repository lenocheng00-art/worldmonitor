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
export type PortfolioRecordType = "asset" | "liability";
export type PortfolioLiquidityLevel = "high" | "medium" | "low" | "locked";
export type PortfolioValuationMethod =
  | "manual"
  | "bank_balance"
  | "market_price"
  | "last_round"
  | "cost"
  | "estimated"
  | "settlement_value"
  | "cash"
  | "cost_basis"
  | "latest_nav";
export type PortfolioDataConfidence = "high" | "medium" | "low";
export type PortfolioQualityBucket = "high" | "medium" | "low";

export type PortfolioAsset = {
  id: string;
  name: string;
  type: PortfolioRecordType;
  category: string;
  account: string;
  assetName: string;
  account_type: PortfolioAccountType;
  custodian: PortfolioCustodian;
  region: PortfolioRegion;
  asset_type: PortfolioAssetType;
  currency: PortfolioCurrency;
  cost_basis: number;
  current_value: number;
  amount: number;
  original_currency_value: number;
  base_currency: PortfolioBaseCurrency;
  fx_rate_to_base: number;
  fx_rate_to_cny: number;
  base_currency_value: number;
  liquidity_tier: PortfolioLiquidityTier;
  liquidity_level: PortfolioLiquidityLevel;
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
  research_links: string[];
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
export const cashFlowStorageKey = "worldmonitor:cash-flows:v1";
export const assetTodoStorageKey = "worldmonitor:asset-todos:v1";

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
export const valuationMethodOptions: PortfolioValuationMethod[] = ["manual", "cash", "bank_balance", "market_price", "last_round", "cost", "cost_basis", "latest_nav", "estimated", "settlement_value"];
export const dataConfidenceOptions: PortfolioDataConfidence[] = ["high", "medium", "low"];

export type CashFlowDirection = "inflow" | "outflow";
export type CashFlowFrequency = "monthly" | "quarterly" | "annual" | "none";

export type CashFlowRecord = {
  id: string;
  date: string;
  direction: CashFlowDirection;
  category: string;
  account_id: string;
  related_asset_id: string;
  currency: PortfolioCurrency;
  amount: number;
  fx_rate_to_cny: number;
  base_currency_value: number;
  recurring: boolean;
  frequency: CashFlowFrequency;
  note: string;
};

export type CashFlowFormValues = Omit<CashFlowRecord, "id" | "fx_rate_to_cny" | "base_currency_value">;

export type AssetTodoStatus = "open" | "in_progress" | "done" | "blocked";
export type AssetTodoPriority = "low" | "medium" | "high";
export type AssetVerificationType = "valuation" | "ownership" | "liquidity" | "tax" | "document" | "counterparty" | "other";

export type AssetTodo = {
  id: string;
  title: string;
  status: AssetTodoStatus;
  priority: AssetTodoPriority;
  related_asset_id: string;
  related_cashflow_id: string;
  due_date: string;
  verification_type: AssetVerificationType;
  note: string;
  created_at: string;
  updated_at: string;
};

export type AssetTodoFormValues = Omit<AssetTodo, "id" | "created_at" | "updated_at">;

export type PortfolioDataQualityResult = {
  score: number;
  quality_bucket: PortfolioQualityBucket;
  reasons: string[];
};

export type VerificationSuggestion = {
  id: string;
  asset_id: string;
  asset_name: string;
  suggested_action: string;
  reason: string;
  priority: AssetTodoPriority;
  verification_type: AssetVerificationType;
};

export const cashFlowDirectionOptions: CashFlowDirection[] = ["inflow", "outflow"];
export const cashFlowFrequencyOptions: CashFlowFrequency[] = ["monthly", "quarterly", "annual", "none"];
export const todoStatusOptions: AssetTodoStatus[] = ["open", "in_progress", "done", "blocked"];
export const todoPriorityOptions: AssetTodoPriority[] = ["low", "medium", "high"];
export const verificationTypeOptions: AssetVerificationType[] = ["valuation", "ownership", "liquidity", "tax", "document", "counterparty", "other"];

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

export const mockCashFlows: CashFlowRecord[] = [
  cashFlowEntry("cf-dividend-usd", "2026-06-05", "inflow", "Dividend", "futu", "futu-us-etf", "USD", 1200, false, "none", "Quarterly ETF dividend received manually."),
  cashFlowEntry("cf-card-payment", "2026-06-15", "outflow", "Credit Card Payment", "manual", "credit-card-payable", "USD", 8600, false, "none", "Statement payment against liability."),
  cashFlowEntry("cf-private-call", "2026-07-10", "outflow", "Capital Call", "private_equity_register", "yunling-optoelectronics", "CNY", 50000, true, "quarterly", "Expected follow-on capital call."),
  cashFlowEntry("cf-bank-interest", "2026-07-25", "inflow", "Bank Interest", "hsbc_hk", "hsbc-hkd-cash", "HKD", 1800, true, "monthly", "Manual expected cash interest."),
];

export const mockAssetTodos: AssetTodo[] = [
  todoEntry("todo-yunling-valuation", "Verify 云岭光电 latest round mark", "open", "high", "yunling-optoelectronics", "", "2026-07-15", "valuation", "Request cap table and latest round documentation."),
  todoEntry("todo-smee-ownership", "Confirm 上海微电子 ownership docs", "in_progress", "high", "shanghai-microelectronics", "", "2026-07-20", "ownership", "Reconcile subscription documents against register."),
  todoEntry("todo-binance-custody", "Review Binance custody exposure", "open", "medium", "binance-btc", "", "2026-07-08", "counterparty", "Decide exchange balance limit and cold-storage policy."),
  todoEntry("todo-polymarket-settlement", "Verify Polymarket open position marks", "open", "medium", "polymarket-open-positions", "", "2026-07-05", "liquidity", "Check exit liquidity and event settlement assumptions."),
  todoEntry("todo-tax-card-payment", "Archive credit card payment receipt", "blocked", "low", "credit-card-payable", "cf-card-payment", "2026-07-18", "document", "Waiting for statement PDF."),
];

export function buildPortfolioAsset(values: PortfolioAssetFormValues, existing?: PortfolioAsset): PortfolioAsset {
  const now = new Date().toISOString();
  const fxRate = fxRatesToCny[values.currency] ?? 1;
  const currentValue = Number(values.current_value) || 0;
  const assetName = values.name.trim() || "Untitled Asset";
  const type = inferRecordType(values.asset_type, currentValue);

  return {
    id: existing?.id ?? `manual-${Date.now().toString(36)}`,
    name: assetName,
    type,
    category: values.asset_type,
    account: values.custodian,
    assetName,
    account_type: values.account_type,
    custodian: values.custodian,
    region: values.region,
    asset_type: values.asset_type,
    currency: values.currency,
    cost_basis: Number(values.cost_basis) || 0,
    current_value: currentValue,
    amount: currentValue,
    original_currency_value: currentValue,
    base_currency: "CNY",
    fx_rate_to_base: fxRate,
    fx_rate_to_cny: fxRate,
    base_currency_value: currentValue * fxRate,
    liquidity_tier: values.liquidity_tier,
    liquidity_level: liquidityTierToLevel(values.liquidity_tier),
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
    research_links: existing?.research_links ?? researchLinksFromAsset(existing),
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

export function readStoredCashFlows(): CashFlowRecord[] {
  if (typeof window === "undefined") return mockCashFlows;

  try {
    const stored = window.localStorage.getItem(cashFlowStorageKey);
    if (!stored) return mockCashFlows;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeCashFlow) : mockCashFlows;
  } catch {
    return mockCashFlows;
  }
}

export function writeStoredCashFlows(records: CashFlowRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(cashFlowStorageKey, JSON.stringify(records));
}

export function buildCashFlow(values: CashFlowFormValues, existing?: CashFlowRecord): CashFlowRecord {
  const fxRate = fxRatesToCny[values.currency] ?? 1;
  const amount = Number(values.amount) || 0;
  return {
    ...values,
    id: existing?.id ?? `cashflow-${Date.now().toString(36)}`,
    account_id: values.account_id ?? "",
    related_asset_id: values.related_asset_id ?? "",
    amount,
    fx_rate_to_cny: fxRate,
    base_currency_value: amount * fxRate,
  };
}

export function toCashFlowFormValues(record?: CashFlowRecord): CashFlowFormValues {
  return {
    date: record?.date ?? new Date().toISOString().slice(0, 10),
    direction: record?.direction ?? "outflow",
    category: record?.category ?? "",
    account_id: record?.account_id ?? "",
    related_asset_id: record?.related_asset_id ?? "",
    currency: record?.currency ?? "CNY",
    amount: record?.amount ?? 0,
    recurring: record?.recurring ?? false,
    frequency: record?.frequency ?? "none",
    note: record?.note ?? "",
  };
}

export function readStoredAssetTodos(): AssetTodo[] {
  if (typeof window === "undefined") return mockAssetTodos;

  try {
    const stored = window.localStorage.getItem(assetTodoStorageKey);
    if (!stored) return mockAssetTodos;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeAssetTodo) : mockAssetTodos;
  } catch {
    return mockAssetTodos;
  }
}

export function writeStoredAssetTodos(todos: AssetTodo[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(assetTodoStorageKey, JSON.stringify(todos));
}

export function buildAssetTodo(values: AssetTodoFormValues, existing?: AssetTodo): AssetTodo {
  const now = new Date().toISOString();
  return {
    ...values,
    id: existing?.id ?? `todo-${Date.now().toString(36)}`,
    related_asset_id: values.related_asset_id ?? "",
    related_cashflow_id: values.related_cashflow_id ?? "",
    due_date: values.due_date ?? "",
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}

export function toAssetTodoFormValues(todo?: AssetTodo): AssetTodoFormValues {
  return {
    title: todo?.title ?? "",
    status: todo?.status ?? "open",
    priority: todo?.priority ?? "medium",
    related_asset_id: todo?.related_asset_id ?? "",
    related_cashflow_id: todo?.related_cashflow_id ?? "",
    due_date: todo?.due_date ?? "",
    verification_type: todo?.verification_type ?? "valuation",
    note: todo?.note ?? "",
  };
}

export function calculateDataQualityScore(asset: PortfolioAsset, todos: AssetTodo[] = []): PortfolioDataQualityResult {
  const reasons: string[] = [];
  let score = 100;
  const ageDays = daysSince(asset.last_verified_at);
  const hasOpenTodos = todos.some((todo) => todo.related_asset_id === asset.id && todo.status !== "done");

  if (asset.data_confidence === "medium") {
    score -= 15;
    reasons.push("Data confidence is medium.");
  }
  if (asset.data_confidence === "low") {
    score -= 30;
    reasons.push("Data confidence is low.");
  }
  if (ageDays > 90) {
    score -= 25;
    reasons.push("Last verification is older than 90 days.");
  } else if (ageDays > 30) {
    score -= 10;
    reasons.push("Last verification is older than 30 days.");
  }
  if (["estimated", "manual"].includes(asset.valuation_method)) {
    score -= 15;
    reasons.push("Valuation basis is manual or estimated.");
  }
  if (["last_round", "cost", "cost_basis"].includes(asset.valuation_method)) {
    score -= 8;
    reasons.push("Valuation is not a current market or cash mark.");
  }
  if (asset.liquidity_level === "locked") {
    score -= 12;
    reasons.push("Liquidity is locked.");
  } else if (asset.liquidity_level === "low") {
    score -= 8;
    reasons.push("Liquidity is low.");
  }
  if (asset.research_links.length === 0) {
    score -= 10;
    reasons.push("No supporting research links are attached.");
  }
  if (hasOpenTodos) {
    score -= 10;
    reasons.push("Open verification todo exists.");
  }

  const bounded = Math.max(0, Math.min(100, score));
  return {
    score: bounded,
    quality_bucket: bounded >= 75 ? "high" : bounded >= 50 ? "medium" : "low",
    reasons: reasons.length > 0 ? reasons : ["Record is recently verified with strong supporting data."],
  };
}

export function buildVerificationSuggestions(assets: PortfolioAsset[], todos: AssetTodo[] = []): VerificationSuggestion[] {
  const openKeys = new Set(todos.filter((todo) => todo.status !== "done").map((todo) => `${todo.related_asset_id}:${todo.verification_type}:${todo.title}`));
  const suggestions: VerificationSuggestion[] = [];

  for (const asset of assets) {
    const push = (suffix: string, suggested_action: string, reason: string, priority: AssetTodoPriority, verification_type: AssetVerificationType) => {
      const key = `${asset.id}:${verification_type}:${suggested_action}`;
      if (openKeys.has(key)) return;
      suggestions.push({
        id: `${asset.id}-${suffix}`,
        asset_id: asset.id,
        asset_name: asset.name,
        suggested_action,
        reason,
        priority,
        verification_type,
      });
    };

    if (daysSince(asset.last_verified_at) > 90) {
      push("stale-valuation", "Update valuation", "Last verification is older than 90 days.", "high", "valuation");
    }
    if (asset.data_confidence === "low") {
      push("low-confidence", "Verify data source", "Record is marked low confidence.", "high", "document");
    }
    if (["estimated", "manual"].includes(asset.valuation_method)) {
      push("valuation-basis", "Confirm valuation basis", "Valuation method is estimated or manual.", "medium", "valuation");
    }
    if (asset.liquidity_level === "locked") {
      push("lockup", "Confirm lock-up and exit terms", "Liquidity level is locked.", "medium", "liquidity");
    }
    if (asset.research_links.length === 0) {
      push("research-links", "Add supporting documents or research links", "No research links are attached.", "medium", "document");
    }
  }

  return suggestions.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
}

export function normalizePortfolioAsset(asset: PortfolioAsset): PortfolioAsset {
  const fxRate = asset.fx_rate_to_base ?? fxRatesToCny[asset.currency] ?? 1;
  const currentValue = Number(asset.current_value) || 0;
  const assetName = asset.assetName ?? asset.name ?? "Untitled Asset";
  const type = asset.type ?? inferRecordType(asset.asset_type, currentValue);
  const liquidityTier = asset.liquidity_tier ?? "UNKNOWN";

  return {
    ...asset,
    id: asset.id,
    name: asset.name ?? assetName,
    type,
    category: asset.category ?? asset.asset_type ?? "other",
    account: asset.account ?? asset.custodian ?? "manual",
    assetName,
    amount: Number.isFinite(asset.amount) ? asset.amount : currentValue,
    original_currency_value: asset.original_currency_value ?? currentValue,
    base_currency: "CNY",
    fx_rate_to_base: fxRate,
    fx_rate_to_cny: asset.fx_rate_to_cny ?? fxRate,
    base_currency_value: Number.isFinite(asset.base_currency_value) ? asset.base_currency_value : currentValue * fxRate,
    liquidity_tier: liquidityTier,
    liquidity_level: asset.liquidity_level ?? liquidityTierToLevel(liquidityTier),
    data_confidence: asset.data_confidence ?? "medium",
    last_verified_at: asset.last_verified_at ?? asset.updated_at,
    research_links: Array.isArray(asset.research_links) ? asset.research_links : researchLinksFromAsset(asset),
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
  const type = inferRecordType(asset_type, current_value);
  return {
    id,
    name: assetName,
    type,
    category: asset_type,
    account: custodian,
    assetName,
    account_type,
    custodian,
    region,
    asset_type,
    currency,
    cost_basis,
    current_value,
    amount: current_value,
    original_currency_value: current_value,
    base_currency: "CNY",
    fx_rate_to_base: fxRate,
    fx_rate_to_cny: fxRate,
    base_currency_value: current_value * fxRate,
    liquidity_tier,
    liquidity_level: liquidityTierToLevel(liquidity_tier),
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
    research_links: [related_logic_chain_id, related_committee_report_id, related_backtest_id].filter(Boolean) as string[],
    next_action,
    notes: "Manual mock register entry. No bank, brokerage, crypto exchange, or prediction-market API is connected.",
    created_at: "2026-06-01T09:00:00+08:00",
    updated_at: "2026-06-28T21:00:00+08:00",
  };
}

export function inferRecordType(assetType: PortfolioAssetType, amount: number): PortfolioRecordType {
  return assetType === "liability" || amount < 0 ? "liability" : "asset";
}

export function liquidityTierToLevel(tier: PortfolioLiquidityTier): PortfolioLiquidityLevel {
  if (tier === "T0" || tier === "D1_7") return "high";
  if (tier === "M1_6") return "medium";
  if (tier === "M6_24") return "low";
  return "locked";
}

export function signedBaseValue(record: Pick<PortfolioAsset, "type" | "base_currency_value">) {
  const absolute = Math.abs(record.base_currency_value);
  return record.type === "liability" ? -absolute : absolute;
}

export function assetValue(record: Pick<PortfolioAsset, "type" | "base_currency_value">) {
  return record.type === "asset" ? Math.max(0, record.base_currency_value) : 0;
}

export function liabilityValue(record: Pick<PortfolioAsset, "type" | "base_currency_value">) {
  return record.type === "liability" ? Math.abs(record.base_currency_value) : 0;
}

function daysSince(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 999;
  return Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000));
}

function priorityRank(priority: AssetTodoPriority) {
  return priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

function researchLinksFromAsset(asset?: Partial<PortfolioAsset>) {
  if (!asset) return [];
  return [asset.related_signal_id, asset.related_logic_chain_id, asset.related_committee_report_id, asset.related_backtest_id].filter(Boolean) as string[];
}

function cashFlowEntry(
  id: string,
  date: string,
  direction: CashFlowDirection,
  category: string,
  account_id: string,
  related_asset_id: string,
  currency: PortfolioCurrency,
  amount: number,
  recurring: boolean,
  frequency: CashFlowFrequency,
  note: string,
): CashFlowRecord {
  const fxRate = fxRatesToCny[currency] ?? 1;
  return {
    id,
    date,
    direction,
    category,
    account_id,
    related_asset_id,
    currency,
    amount,
    fx_rate_to_cny: fxRate,
    base_currency_value: amount * fxRate,
    recurring,
    frequency,
    note,
  };
}

function normalizeCashFlow(record: CashFlowRecord): CashFlowRecord {
  const fxRate = record.fx_rate_to_cny ?? fxRatesToCny[record.currency] ?? 1;
  const amount = Number(record.amount) || 0;
  return {
    ...record,
    account_id: record.account_id ?? "",
    related_asset_id: record.related_asset_id ?? "",
    fx_rate_to_cny: fxRate,
    base_currency_value: Number.isFinite(record.base_currency_value) ? record.base_currency_value : amount * fxRate,
    recurring: Boolean(record.recurring),
    frequency: record.frequency ?? "none",
    note: record.note ?? "",
  };
}

function todoEntry(
  id: string,
  title: string,
  status: AssetTodoStatus,
  priority: AssetTodoPriority,
  related_asset_id: string,
  related_cashflow_id: string,
  due_date: string,
  verification_type: AssetVerificationType,
  note: string,
): AssetTodo {
  return {
    id,
    title,
    status,
    priority,
    related_asset_id,
    related_cashflow_id,
    due_date,
    verification_type,
    note,
    created_at: "2026-06-28T09:00:00+08:00",
    updated_at: "2026-06-28T09:00:00+08:00",
  };
}

function normalizeAssetTodo(todo: AssetTodo): AssetTodo {
  const now = new Date().toISOString();
  return {
    ...todo,
    related_asset_id: todo.related_asset_id ?? "",
    related_cashflow_id: todo.related_cashflow_id ?? "",
    due_date: todo.due_date ?? "",
    verification_type: todo.verification_type ?? "other",
    note: todo.note ?? "",
    created_at: todo.created_at ?? now,
    updated_at: todo.updated_at ?? now,
  };
}
