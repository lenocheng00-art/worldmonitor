# SK hynix Cross-market Validation

## Security identity

The live and documentary evidence changed during this staging-validation task and the resolver was corrected accordingly.

- Nasdaq `SKHY` is now a real SK hynix American Depositary Share, not a guessed symbol. The SEC prospectus says the ADSs trade on Nasdaq under `SKHY`: [SEC prospectus](https://www.sec.gov/Archives/edgar/data/2120882/000119312526299963/d32785d424b4.htm).
- Each ADS represents one-tenth of one SK hynix common share: [SEC F-6](https://www.sec.gov/Archives/edgar/data/1472033/000119380526000898/e665622_f6-skhynix.htm).
- Citi's depositary-receipt record reports ORD:DR = 1:10 and CUSIP `78392B206`: [Citi Depositary Receipt Services](https://depositaryreceipts.citi.com/adr/guides/pgm_dispabook.aspx?cusip=78392B206&pageId=15&subpageID=111).
- Nasdaq reported the U.S. listing start: [Nasdaq listing announcement](https://www.nasdaq.com/newsroom/global-innovation-meets-global-capital-sk-hynix-lists-on-nasdaq).
- KRX common stock remains `000660`, while the separate Luxembourg GDS is `HYXS LX`, ISIN `US78392B1070`: [SK hynix listing information](https://www.skhynix.com/ir/UI-FR-IR03/) and [Luxembourg Stock Exchange](https://www.luxse.com/security/US78392B1070/92952).

`HYXS LX` and `SKHY` must not be treated as interchangeable symbols. The V2.0.1 automatic metric uses the new Nasdaq ADS because the public provider returned valid USD/Nasdaq history for it.

## Ratio and formula

The provider configuration now uses:

```text
ADS ticker = SKHY
local ticker = 000660.KS
FX = KRW=X (KRW per USD)
common shares per ADS = 0.1
alignment = latest common completed trading session
```

Formula:

```text
local equivalent USD per ADS = 000660.KS close / KRW-per-USD × 0.1
premium % = (SKHY close / local equivalent USD per ADS - 1) × 100
```

The old assumed ratio `1` is not used.

## Live result

On the latest common completed session found in the one-month histories:

```text
trading date: 2026-07-16
SKHY: USD 152.3099976
000660.KS: KRW 1,842,000
KRW=X: 1,486.1999512 KRW/USD (latest observation at/before aligned date)
ADS ratio: 0.1 common share per ADS
premium: +22.8898539%
```

The chart endpoint returned six SKHY historical points because the Nasdaq ADS was newly listed. Public quotations and the ratio are verified, but the short history must remain visible in monitoring. The metric is suitable for automated observation; it is not evidence that the premium has converged or that long-term liquidity is guaranteed.

## Session alignment

`alignLatestCommonSession` converts each observation through its exchange IANA timezone, intersects actual trading dates, excludes observations after `asOf`, and selects the latest FX observation at or before the common date. Unit coverage includes weekends, exchange-specific missing/holiday sessions, DST transitions, future/incomplete observations, and missing FX.
