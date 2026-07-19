# Candidate B annotation notes

The expanded Gold Dataset contains exact, continuous excerpts from the frozen read-only Production backup. No excerpt is rewritten or synthesized, and every record retains its original `sourcePostId`.

## Atomic decision rule

`shouldCreateSignal=true` requires a self-contained investment judgment with a trigger, direction, explicit or dated horizon, monitoring metric, and an investable or reviewable asset. A factual data dump is not a Signal. An excerpt that lacks an explicit asset or horizon is rejected even when surrounding article context might make the intended trade obvious; this prevents context leakage during source-post holdout evaluation.

The four original missed-signal cases are classified as:

- MU contract-cycle thesis: **Critical**; retained and recovered by the structured contract/RPO check.
- MU RPO monitoring thesis: **Critical**; retained and recovered by the second-pass check.
- Q3 export-control disclosure basket: **Material**; retained as a missed Needs Review sample because the atomic excerpt has no uniquely resolvable asset.
- GOOG talent-departure trend: **Material**; retained as a missed sample because “后续” does not supply an enforceable horizon without annotation inference.

## Expanded samples

The set contains 60 unique atomic excerpts and 25 rejection samples across every Alan source post present in the frozen backup. Some tempting excerpts were deliberately rejected:

- an oil threshold without a stated observation window: `MISSING_HORIZON`;
- Korean policy and MU option snippets whose atomic text omits the investable asset: `MISSING_INVESTABLE_ASSET`;
- raw FOMC figures without an independent judgment: `NARRATIVE_NOT_SIGNAL`;
- macro monitoring sets without a unique asset: `MISSING_INVESTABLE_ASSET`.

These corrections keep the Gold labels aligned with Candidate B’s published five-part second-pass rule rather than inflating recall with inferred context.

## Validation limitation

The backup and read-only Production inventory contain only 6 distinct Alan `sourcePostId` values. The 60-unit and 15-rejection targets pass, but the 12-source target fails. The dataset does not duplicate, split, rename, or fabricate source IDs to satisfy that gate. Candidate B therefore remains non-deployable even when its pooled LOSPO quality metrics pass.
