import assert from "node:assert/strict";
import { Client } from "pg";
import { assertSafeStagingEnvironment } from "./lib/staging-guard";

const acceptanceSourcePostId = "manual:abbc56e66ae67d362e8bacd4735213412489bba7dc0c3b531481c2ee20125900";

async function main() {
  const staging = assertSafeStagingEnvironment();
  const databaseUrl = process.env.STAGING_DATABASE_URL;
  assert(databaseUrl, "STAGING_DATABASE_URL is required.");

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const source = await client.query<{ id: string }>(
      "select id from public.source_posts where id=$1",
      [acceptanceSourcePostId],
    );
    assert.equal(source.rowCount, 1, "Stable Source Text record is missing.");

    const signals = await client.query<{ id: string; logic_chain_id: string; related_tickers: string[] }>(
      "select id,logic_chain_id,related_tickers from public.signals where source_post_id=$1 order by id",
      [acceptanceSourcePostId],
    );
    assert.equal(signals.rowCount, 3, "Acceptance source must resolve to exactly three Atomic Signals.");
    const signalIds = signals.rows.map((row) => row.id);
    const logicChainIds = [...new Set(signals.rows.map((row) => row.logic_chain_id).filter(Boolean))];
    assert.equal(logicChainIds.length, 3, "The three research themes must not be merged into one Logic Chain.");
    assert(!signals.rows.some((row) => row.related_tickers.includes("SPCX")), "Unverified SPCX must not be emitted as a market ticker.");

    const relations = await client.query<{ signal_id: string; logic_chain_id: string }>(
      "select signal_id,logic_chain_id from public.logic_chain_signals where signal_id = any($1::text[])",
      [signalIds],
    );
    const metrics = await client.query<{ id: string }>(
      "select id from public.tracking_metrics where signal_id = any($1::text[])",
      [signalIds],
    );
    const evidence = await client.query<{ id: string }>(
      "select id from public.evidence where signal_id = any($1::text[])",
      [signalIds],
    );
    const committee = await client.query<{ id: string }>(
      "select id from public.committee_research_objects where logic_chain_id = any($1::text[])",
      [logicChainIds],
    );
    const confidence = await client.query<{ id: string }>(
      "select id from public.confidence_events where logic_chain_id = any($1::text[])",
      [logicChainIds],
    );
    const duplicateSignals = await client.query(
      "select signal_fingerprint from public.signals where source_post_id=$1 group by signal_fingerprint having count(*) > 1",
      [acceptanceSourcePostId],
    );
    const duplicateChains = await client.query(
      "select canonical_key from public.logic_chains where id = any($1::text[]) group by canonical_key having count(*) > 1",
      [logicChainIds],
    );
    const duplicateMetrics = await client.query(
      "select logic_chain_id,metric_fingerprint from public.tracking_metrics where logic_chain_id = any($1::text[]) group by logic_chain_id,metric_fingerprint having count(*) > 1",
      [logicChainIds],
    );

    assert.equal(relations.rowCount, 3, "Each Atomic Signal must have a persisted Logic Chain relation.");
    assert.equal(metrics.rowCount, 3, "Each Logic Chain must have a compiled Tracking Metric.");
    assert.equal(evidence.rowCount, 3, "Each Logic Chain must have initialized source evidence.");
    assert.equal(committee.rowCount, 3, "Each Logic Chain must have an active Committee Research Object.");
    assert.equal(duplicateSignals.rowCount, 0, "Duplicate Signal rows were found.");
    assert.equal(duplicateChains.rowCount, 0, "Duplicate Logic Chain rows were found.");
    assert.equal(duplicateMetrics.rowCount, 0, "Duplicate Tracking Metric rows were found.");

    console.log(JSON.stringify({
      status: "PASS",
      projectRef: staging.projectRef,
      sourcePostId: acceptanceSourcePostId,
      signals: signals.rowCount,
      signalIds,
      logicChains: logicChainIds.length,
      logicChainIds,
      relations: relations.rowCount,
      metrics: metrics.rowCount,
      evidence: evidence.rowCount,
      confidenceEvents: confidence.rowCount,
      committeeObjects: committee.rowCount,
      duplicates: { signals: 0, logicChains: 0, metrics: 0 },
      productionWrites: 0,
    }, null, 2));
  } finally {
    await client.end();
  }
}

void main();
