# V2.0.2 Schema Validation

- Result: **PASS**
- Validator checks: 167
- Passed: 167
- Failed: 0
- Required tables: 11/11
- Required columns: PASS
- Primary keys: 11/11
- Required foreign keys: 8/8
- Required fingerprint/due-time indexes: 8/8
- Confidence/status checks: 2/2
- RLS-enabled required tables: 11/11
- Policies on required tables: 13
- Role/grant checks: PASS
- `attach_research_signal`: present, security invoker, `search_path=public`, anon/authenticated execute revoked, service-role execute granted

Validated tables: `signals`, `logic_chains`, `logic_chain_signals`, `logic_chain_match_candidates`, `tracking_metrics`, `metric_observations`, `evidence`, `confidence_events`, `committee_research_objects`, `committee_research_versions`, and `research_tracking_runs`.
