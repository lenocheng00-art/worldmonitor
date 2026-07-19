import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("legacy portfolio and industry routes redirect to Signal Inbox", async () => {
  const config = await source("next.config.ts");
  for (const route of [
    "/portfolio-overview",
    "/portfolio",
    "/balance-sheet",
    "/cash-flow",
    "/portfolio-settings",
    "/industry-chains",
  ]) {
    assert.match(config, new RegExp(`"${route.replaceAll("/", "\\/")}"`));
  }
  assert.match(config, /destination: "\/signal-inbox"/);
});

test("navigation exposes only the seven Signals Core destinations", async () => {
  const shell = await source("src/components/app-shell.tsx");
  const expected = [
    ["/", "Overview"],
    ["/signal-monitor", "Signal Monitor"],
    ["/signal-inbox", "Signal Inbox"],
    ["/logic-chains", "Logic Chains"],
    ["/committee", "Investment Committee"],
    ["/backtest-lab", "Backtest Lab"],
    ["/watchlist", "Watchlist"],
  ];
  let priorIndex = -1;
  for (const [route, label] of expected) {
    const index = shell.indexOf(`{ href: "${route}", label: "${label}"`);
    assert.ok(index > priorIndex, `${label} should appear in the required order`);
    priorIndex = index;
  }
  for (const forbidden of ["Portfolio Overview", "Balance Sheet", "Cash Flow", "Portfolio Settings", "Industry Chains"]) {
    assert.doesNotMatch(shell, new RegExp(forbidden));
  }
});

test("Overview presents the V2.2 Mission Control information architecture", async () => {
  const overview = await source("src/components/overview-dashboard.tsx");
  for (const moduleName of ["Mission Control", "Research Pipeline", "Research Health", "Today&apos;s Workflow", "Research Queue", "Top Logic Chains", "Committee Snapshot", "Recently Added", "Recently Updated", "Highest Confidence"]) {
    assert.match(overview, new RegExp(moduleName));
  }
  for (const forbidden of ["Today&apos;s Signals", "Signals Requiring Attention", "Active Logic Chains", "Committee Queue", "Watchlist Changes", "Total Assets", "Net Worth", "Cash Balance", "Cash Runway", "Portfolio Allocation", "Liquidity Risk"]) {
    assert.doesNotMatch(overview, new RegExp(forbidden));
  }
  assert.match(overview, /memo\(/);
  assert.match(overview, /useMemo\(/);
  assert.match(overview, /useDecisionLoop\(\)/);
  assert.doesNotMatch(overview, /Mock Research Data/);
});

test("Signal Monitor routes source extraction through the V2 structured cloud pipeline", async () => {
  const monitor = await source("src/components/signal-monitor.tsx");
  const attachRoute = await source("src/app/api/research/logic-chains/[id]/attach-signal/route.ts");
  const rejectRoute = await source("src/app/api/research/matches/[id]/route.ts");
  assert.match(monitor, /useDecisionLoop\(\)/);
  assert.match(monitor, /fetch\("\/api\/research\/process-source"/);
  assert.match(monitor, /x-worldmonitor-client": "research-tracking-v2"/);
  for (const field of ["sourcePostId", "sourceName", "originalText", "submittedAt", "processMode", "full_pipeline"]) assert.match(monitor, new RegExp(field));
  for (const stage of ["Extracting signals", "Resolving entities", "Matching logic chains", "Compiling metrics", "Updating committee"]) assert.match(monitor, new RegExp(stage));
  for (const action of ["View Signals", "View Logic Chains", "Review Matches", "View Committee", "Manual Attach", "Reject Match"]) assert.match(monitor, new RegExp(action));
  assert.match(monitor, /await refresh\(\)/);
  assert.match(monitor, /router\.refresh\(\)/);
  assert.match(monitor, /manual:\$\{hash\}/);
  assert.doesNotMatch(monitor, /createSignal\(/);
  assert.doesNotMatch(monitor, /useAlanSignals/);
  assert.match(attachRoute, /decision: "attach"/);
  assert.match(attachRoute, /reviewRequired: false/);
  assert.match(rejectRoute, /Candidate rejected manually/);
  assert.match(rejectRoute, /review_required: true/);
});

test("Research Orchestrator returns the structured full-pipeline result contract", async () => {
  const engine = await source("src/lib/research/research-engine.ts");
  for (const field of ["sourcePostId", "created", "attached", "reviewRequired", "duplicates", "warnings", "resultIds", "reviewMatches", "entityResolutions"]) assert.match(engine, new RegExp(field));
  for (const stage of ["saveSource", "saveSignal", "matchLogicChain", "saveMatchAudit", "saveLogicChain", "attachSignal", "compileTrackingMetrics", "appendSourceEvidence", "syncCommittee"]) assert.match(engine, new RegExp(stage));
  assert.match(engine, /missing_logic_chain/);
  assert.match(engine, /private\/security_unverified/);
});

test("Committee, Backtests, and Watchlist persist through the migration-free Supabase compatibility layer", async () => {
  const repository = await source("src/lib/storage/worldmonitor-repository.ts");
  assert.match(repository, /toCommitteeReportRow/);
  assert.match(repository, /toBacktestResultRow/);
  assert.match(repository, /toWatchlistRow/);
  assert.match(repository, /saveBacktestBundle/);
  assert.match(repository, /fetch\("\/api\/research-state"/);
  assert.match(repository, /source_post_id: signal\.source_post_id \?\? null/);
  assert.match(repository, /original_text: encodeTextMetadata\(signal\.originalText, metadata\)/);
  assert.match(repository, /data: normalizeDecisionState\(\{/);
  assert.match(repository, /signals: signalRows\.map\(fromSignalRow\)/);
  assert.doesNotMatch(repository, /mergeById\(localFallback/);
  assert.match(repository, /timeline: Array\.isArray\(chain\.timeline\) \? chain\.timeline : \[\]/);
  assert.doesNotMatch(repository, /from\("portfolio"\)/);
  assert.doesNotMatch(repository, /from\("committee_cases"\)/);
  assert.doesNotMatch(repository, /from\("research_links"\)/);
  const route = await source("src/app/api/research-state/route.ts");
  assert.match(route, /createAdminClient } from "@\/lib\/supabase\/admin"/);
  assert.match(route, /createAdminClient\(\)/);
  assert.doesNotMatch(route, /createClient } from "@\/lib\/supabase\/server"/);
  assert.match(route, /from\("signals"\)\.upsert/);
  assert.match(route, /from\("logic_chains"\)\.upsert/);
  assert.match(route, /from\("committee_reports"\)\.upsert/);
  assert.match(route, /from\("backtest_results"\)\.upsert/);
  assert.match(route, /from\("watchlist_items"\)\.upsert/);
});
