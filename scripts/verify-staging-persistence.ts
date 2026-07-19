import { mkdir, writeFile } from "node:fs/promises";
import { createStagingDatabaseClient } from "./lib/staging-database";

async function main() {
  const { client, safe } = createStagingDatabaseClient();
  await client.connect();
  try {
    const chain = await client.query<{ id: string; confidence_score: string; research_status: string }>(`
      select id, confidence_score::text, research_status
      from public.logic_chains where canonical_key = 'ai-semiconductor-liquidation'
    `);
    if (chain.rows.length !== 1) throw new Error(`Expected one staging Logic Chain, found ${chain.rows.length}.`);
    const chainId = chain.rows[0].id;
    const counts = await client.query<Record<string, string>>(`
      select
        (select count(*) from public.signals where source_post_id in ('staging-semiconductor-test-001', 'staging-semiconductor-test-002'))::text as signals,
        (select count(*) from public.logic_chains where id = $1)::text as logic_chains,
        (select count(*) from public.logic_chain_signals where logic_chain_id = $1)::text as relations,
        (select count(*) from public.logic_chain_match_candidates where signal_id in (select id from public.signals where logic_chain_id = $1))::text as match_candidates,
        (select count(*) from public.tracking_metrics where logic_chain_id = $1)::text as metrics,
        (select count(*) from public.metric_observations where metric_id in (select id from public.tracking_metrics where logic_chain_id = $1))::text as observations,
        (select count(*) from public.evidence where logic_chain_id = $1)::text as evidence,
        (select count(*) from public.confidence_events where logic_chain_id = $1)::text as confidence_events,
        (select count(*) from public.committee_research_objects where logic_chain_id = $1)::text as committee_objects,
        (select count(*) from public.committee_research_versions where committee_object_id in (select id from public.committee_research_objects where logic_chain_id = $1))::text as committee_versions,
        (select count(*) from public.research_tracking_runs where run_key like 'research-metrics:manual:%')::text as tracking_runs
    `, [chainId]);
    const integrity = await client.query<Record<string, string>>(`
      select
        (select count(*) from public.logic_chain_signals r left join public.logic_chains c on c.id=r.logic_chain_id left join public.signals s on s.id=r.signal_id where c.id is null or s.id is null)::text as relation_orphans,
        (select count(*) from public.tracking_metrics m left join public.logic_chains c on c.id=m.logic_chain_id where c.id is null)::text as metric_orphans,
        (select count(*) from public.metric_observations o left join public.tracking_metrics m on m.id=o.metric_id where m.id is null)::text as observation_orphans,
        (select count(*) from public.evidence e left join public.logic_chains c on c.id=e.logic_chain_id where c.id is null)::text as evidence_orphans,
        (select count(*) from public.confidence_events e left join public.logic_chains c on c.id=e.logic_chain_id where c.id is null)::text as confidence_orphans,
        (select count(*) from public.committee_research_versions v left join public.committee_research_objects o on o.id=v.committee_object_id where o.id is null)::text as version_orphans
    `);
    const diagnostics = await client.query<{
      relation_types: string[]; min_match_score: string; max_match_score: string;
      metric_statuses: Record<string, number>; unique_metric_fingerprints: string;
      unique_evidence_fingerprints: string; confidence_delta: string; due_metrics: string;
      version_count: string; run_status: string; run_stats: Record<string, number>;
    }>(`
      select
        (select array_agg(distinct relation_type order by relation_type) from public.logic_chain_signals where logic_chain_id=$1) as relation_types,
        (select min(match_score)::text from public.logic_chain_signals where logic_chain_id=$1) as min_match_score,
        (select max(match_score)::text from public.logic_chain_signals where logic_chain_id=$1) as max_match_score,
        (select jsonb_object_agg(status, amount) from (select status, count(*) as amount from public.tracking_metrics where logic_chain_id=$1 group by status) s) as metric_statuses,
        (select count(distinct metric_fingerprint)::text from public.tracking_metrics where logic_chain_id=$1) as unique_metric_fingerprints,
        (select count(distinct evidence_fingerprint)::text from public.evidence where logic_chain_id=$1) as unique_evidence_fingerprints,
        (select coalesce(sum(delta),0)::text from public.confidence_events where logic_chain_id=$1) as confidence_delta,
        (select count(*)::text from public.tracking_metrics where logic_chain_id=$1 and next_run_at is not null) as due_metrics,
        (select count(*)::text from public.committee_research_versions where committee_object_id in (select id from public.committee_research_objects where logic_chain_id=$1)) as version_count,
        (select status from public.research_tracking_runs where run_key like 'research-metrics:manual:%' order by started_at desc limit 1) as run_status,
        (select stats from public.research_tracking_runs where run_key like 'research-metrics:manual:%' order by started_at desc limit 1) as run_stats
    `, [chainId]);

    const countRecord = numericRecord(counts.rows[0]);
    const integrityRecord = numericRecord(integrity.rows[0]);
    const diag = diagnostics.rows[0];
    const passed = countRecord.signals === 5 && countRecord.logic_chains === 1
      && countRecord.relations === 5 && countRecord.metrics === 5
      && countRecord.committee_objects === 1 && countRecord.tracking_runs === 1
      && Object.values(integrityRecord).every((value) => value === 0)
      && Number(diag.unique_metric_fingerprints) === countRecord.metrics
      && Number(diag.unique_evidence_fingerprints) === countRecord.evidence
      && diag.relation_types.includes("contradicting") && diag.run_status === "partial";
    if (!passed) throw new Error("Staging persistence validation failed.");

    const markdown = `# V2.0.2 Staging Data Verification\n\n`
      + `- Result: **PASS**\n- Environment: staging\n- Project ref: \`${safe.projectRef}\`\n- Database host: \`${safe.database.host}\`\n- Production rows copied: 0\n\n`
      + `## Scoped record counts\n\n| Record | Count |\n| --- | ---: |\n`
      + Object.entries(countRecord).map(([name, value]) => `| ${name} | ${value} |`).join("\n")
      + `\n\n## Integrity\n\n| Check | Orphans |\n| --- | ---: |\n`
      + Object.entries(integrityRecord).map(([name, value]) => `| ${name} | ${value} |`).join("\n")
      + `\n\n## State diagnostics\n\n`
      + `- Logic Chain status: \`${chain.rows[0].research_status}\`\n`
      + `- Confidence score: ${chain.rows[0].confidence_score}\n`
      + `- Confidence delta sum: ${diag.confidence_delta}\n`
      + `- Relation types: ${diag.relation_types.join(", ")}\n`
      + `- Match score range: ${diag.min_match_score}–${diag.max_match_score}\n`
      + `- Metric statuses: \`${JSON.stringify(diag.metric_statuses)}\`\n`
      + `- Metrics with nextRunAt: ${diag.due_metrics}\n`
      + `- Unique metric fingerprints: ${diag.unique_metric_fingerprints}/${countRecord.metrics}\n`
      + `- Unique evidence fingerprints: ${diag.unique_evidence_fingerprints}/${countRecord.evidence}\n`
      + `- Committee version count: ${diag.version_count}\n`
      + `- Latest Cron run status: \`${diag.run_status}\`\n`
      + `- Latest Cron stats: \`${JSON.stringify(diag.run_stats)}\`\n`;
    await mkdir("experiments/research-tracking-v2.0.2", { recursive: true });
    await writeFile("experiments/research-tracking-v2.0.2/staging-data-verification.md", markdown, "utf8");
    process.stdout.write(`${JSON.stringify({ status: "PASS", projectRef: safe.projectRef, counts: countRecord, integrity: integrityRecord, diagnostics: diag }, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

function numericRecord(input: Record<string, string>) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Number(value)])) as Record<string, number>;
}

void main().catch((error: unknown) => {
  process.stderr.write(`FAILED: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
