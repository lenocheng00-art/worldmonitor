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
export type PortfolioLiquidityTier = "T0" | "D1_7" | "M1_6" | "M6_24" | "Y2_PLUS" | "UNKNOWN";
export type PortfolioRiskLevel = "low" | "medium" | "high" | "very_high";
export type PortfolioStatus = "active" | "watching" | "committed" | "invested" | "locked" | "exited" | "written_off";
export type PortfolioValuationMethod = "manual" | "bank_balance" | "market_price" | "last_round" | "cost" | "estimated" | "settlement_value";

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
  base_currency_value: number;
  liquidity_tier: PortfolioLiquidityTier;
  risk_level: PortfolioRiskLevel;
  status: PortfolioStatus;
  valuation_method: PortfolioValuationMethod;
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

export const mockPortfolioAssets: PortfolioAsset[] = [
  entry("mainland-cny-cash", "中国大陆银行卡 CNY 现金", "mainland_bank", "mainland_bank", "CN", "cash", "CNY", 420000, 420000, 58000, "T0", "low", "active", "bank_balance", "Monthly balance refresh"),
  entry("hsbc-hkd-cash", "香港汇丰 HKD 现金", "hong_kong_bank", "hsbc_hk", "HK", "cash", "HKD", 560000, 560000, 72000, "T0", "low", "active", "bank_balance", "Keep dry powder for HK allocation"),
  entry("hsbc-usd-cash", "香港汇丰 USD 现金", "hong_kong_bank", "hsbc_hk", "HK", "cash", "USD", 88000, 88000, 88000, "T0", "low", "active", "bank_balance", "Review USD deployment list"),
  entry("boc-macau-mop-cash", "中国银行澳门分行 MOP 现金", "macau_bank", "boc_macau", "MO", "cash", "MOP", 210000, 210000, 26100, "T0", "low", "active", "bank_balance", "Confirm cross-border transfer quota"),
  entry("futu-hkd-cash", "富途 HKD 现金", "brokerage", "futu", "HK", "cash", "HKD", 180000, 180000, 23100, "T0", "low", "active", "manual", "Keep available for HK orders"),
  entry("futu-usd-cash", "富途 USD 现金", "brokerage", "futu", "US", "cash", "USD", 36000, 36000, 36000, "T0", "low", "active", "manual", "Match against US equity watchlist"),
  entry("futu-us-etf", "富途美股 / ETF", "brokerage", "futu", "US", "fund_or_etf", "USD", 165000, 178500, 178500, "D1_7", "medium", "invested", "market_price", "Rebalance after monthly risk review", "logic-us-risk-assets"),
  entry("yunling-optoelectronics", "云岭光电", "private_equity_register", "manual", "CN", "private_equity", "CNY", 500000, 640000, 88400, "Y2_PLUS", "very_high", "locked", "last_round", "Request quarterly operating update", "logic-hard-tech-cn", "committee-yunling", null, "2029-12-31", "2028-06-30"),
  entry("shanghai-microelectronics", "上海微电子", "private_equity_register", "manual", "CN", "private_equity", "CNY", 800000, 950000, 131000, "Y2_PLUS", "very_high", "invested", "estimated", "Validate latest financing marker", "logic-semiconductor-localization", "committee-smee", null, "2030-12-31", "2029-12-31"),
  entry("eswin-computing-preipo", "奕斯伟计算 IPO / Pre-IPO", "private_equity_register", "manual", "CN", "pre_ipo", "CNY", 300000, 315000, 43500, "M6_24", "high", "committed", "cost", "Track IPO filing progress", "logic-ai-chip-supply-chain", "committee-eswin", null, "2027-12-31", "2027-06-30"),
  entry("binance-usdt", "Binance USDT", "crypto_exchange", "binance", "GLOBAL", "stablecoin", "USDT", 52000, 52000, 52000, "T0", "medium", "active", "manual", "Keep below exchange concentration limit"),
  entry("binance-btc", "Binance BTC", "crypto_exchange", "binance", "GLOBAL", "crypto_spot", "BTC", 65000, 72000, 72000, "T0", "very_high", "invested", "market_price", "Review stop and custody policy", "logic-crypto-beta"),
  entry("polymarket-usdc-cash", "Polymarket USDC Cash", "prediction_market", "polymarket", "GLOBAL", "stablecoin", "USDC", 18000, 18000, 18000, "T0", "medium", "active", "manual", "Reserve for signal-driven positions"),
  entry("polymarket-open-positions", "Polymarket Open Positions", "prediction_market", "polymarket", "GLOBAL", "prediction_market", "USDC", 11500, 12600, 12600, "D1_7", "high", "invested", "settlement_value", "Review event-level exit prices", "logic-hk-temperature", null, "backtest-hk-temperature-v1", "2026-09-30"),
  entry("credit-card-payable", "信用卡或应付款 liability", "manual_other", "manual", "GLOBAL", "liability", "USD", -8600, -8600, -8600, "D1_7", "medium", "active", "manual", "Pay before statement due date", null, null, null, "2026-07-15"),
];

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
  base_currency_value: number,
  liquidity_tier: PortfolioLiquidityTier,
  risk_level: PortfolioRiskLevel,
  status: PortfolioStatus,
  valuation_method: PortfolioValuationMethod,
  next_action: string,
  related_logic_chain_id: string | null = null,
  related_committee_report_id: string | null = null,
  related_backtest_id: string | null = null,
  expected_exit_date: string | null = null,
  lockup_end_date: string | null = null,
): PortfolioAsset {
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
    base_currency_value,
    liquidity_tier,
    risk_level,
    status,
    valuation_method,
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
