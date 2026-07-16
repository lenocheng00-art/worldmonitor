# WorldMonitor V1.8.2 Offline Signal Quality Experiment

This directory is isolated from the Production workflow. It reads the frozen local backup, never loads Supabase credentials, and has no deployment command.

## Run

```bash
node experiments/signal-quality-v1.8.2/build-gold-dataset.mjs
node experiments/signal-quality-v1.8.2/run-offline-replay.mjs
```

## Outputs

- `gold-dataset.json`: 36-unit human Gold Dataset.
- `annotation-guide.md`: annotation policy and adjudication rules.
- `baseline-vs-candidate.json` / `.md`: V1.8.1 versus V1.8.2 metrics and deployment gates.
- `failure-samples.json` / `.md`: Candidate errors requiring another offline iteration.
- `candidate-signal.schema.json`: proposed structured extraction schema.
- `recommended-extraction-prompt-schema.md`: proposed prompt and migration guidance.

The Baseline imports the frozen V1.8.1 parser. The Candidate is an offline rule-based prototype used to validate the schema and replay harness; it is not wired into the application.
