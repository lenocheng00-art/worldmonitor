import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const statsSource = await readFile(new URL("../src/lib/automation-burn-in.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(statsSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const statsModule = { exports: {} };
vm.runInNewContext(compiled, { module: statsModule, exports: statsModule.exports, Number, Math });
const { preserveValidationData, summarizeAutomationRuns } = statsModule.exports;

test("data-unavailable validation preserves the prior observations by reference", () => {
  const previous = [{ metricKey: "MSFT-close", value: 500 }];
  assert.equal(preserveValidationData(previous, []), previous);
  assert.equal(
    JSON.stringify(preserveValidationData(previous, [{ metricKey: "MSFT-close", value: 510 }])),
    JSON.stringify([...previous, { metricKey: "MSFT-close", value: 510 }]),
  );
});

test("seven-run burn-in summary uses stable operational denominators", () => {
  const runs = Array.from({ length: 8 }, (_, index) => ({
    id: `run-${index}`,
    mode: "scheduled",
    status: index === 1 ? "Failed" : index === 2 ? "Skipped" : "Succeeded",
    startedAt: "2026-07-17T03:00:00.000Z",
    nextRunAt: "2026-07-19T03:00:00.000Z",
    sourcesProcessed: 1,
    signalsCreated: 0,
    signalsUpdated: 10,
    duplicatesPrevented: index,
    logicChainsUpdated: 10,
    needsReviewCount: 2,
    notificationsCreated: 1,
    dataUnavailableCount: 1,
    dataFetchAttempts: 10,
    yahooFinanceFailures: 1,
    processingDurationMs: 1_000,
    errors: index === 1 ? ["write failed"] : [],
    notifications: [],
  }));
  const stats = summarizeAutomationRuns(runs);
  assert.equal(stats.runCount, 7);
  assert.equal(stats.cronSuccessRate, 85.71);
  assert.equal(stats.signalsUpdated, 70);
  assert.equal(stats.duplicatesPrevented, 21);
  assert.equal(stats.needsReviewRate, 20);
  assert.equal(stats.dataFetchFailureRate, 10);
  assert.equal(stats.averageRunDurationMs, 1_000);
});

test("automation route, lock, archive, and market fallback drills are enforced in code", async () => {
  const [route, runner, repository, store, vercel] = await Promise.all([
    readFile(new URL("../src/app/api/automation/signals/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/server/signal-automation.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/storage/worldmonitor-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/decision-loop-store.tsx", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);

  assert.match(route, /Invalid cron authorization[\s\S]*status: 401/);
  assert.match(runner, /automationLockSource/);
  assert.match(runner, /\.from\("source_posts"\)\.insert/);
  assert.match(runner, /error\.code !== "23505"/);
  assert.match(runner, /result: status === "Running" \? "Already Running" : "Already Completed"/);
  assert.match(runner, /const twoDaysMs = 48 \* 60 \* 60 \* 1_000/);
  assert.match(runner, /preserveValidationData\(validationData, validation\.data\)/);
  assert.match(runner, /validationOutcome !== "Data Unavailable"/);
  assert.match(runner, /AbortSignal\.timeout\(12_000\)/);
  assert.match(runner, /no synthetic fallback/i);
  assert.doesNotMatch(runner, /Math\.random|mockPrice/i);
  assert.match(runner, /\.from\("signal_archive"\)\.select\("id"\)/);
  assert.match(runner, /if \(data\?\.length\) return/);
  assert.match(repository, /backend: "localStorage"/);
  assert.match(repository, /if \(!response\.ok\) throw new Error/);
  assert.match(store, /worldmonitorRepository\.loadState\(state\)/);
  assert.doesNotMatch(store, /worldmonitorRepository\.migrateLocalState/);
  assert.match(vercel, /"schedule": "0 3 \* \* \*"/);
});

test("Supabase write/read failure is a failed run and a concurrent lock exits safely", async () => {
  const runnerSource = await readFile(new URL("../src/lib/server/signal-automation.ts", import.meta.url), "utf8");
  const runnerCompiled = ts.transpileModule(runnerSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const runnerModule = { exports: {} };
  const require = (specifier) => {
    if (specifier.endsWith("automation-burn-in")) return { preserveValidationData: (previous, incoming) => incoming.length ? [...previous, ...incoming] : previous };
    return {};
  };
  vm.runInNewContext(runnerCompiled, {
    module: runnerModule,
    exports: runnerModule.exports,
    require,
    Date,
    Math,
    Set,
    Map,
    String,
    Number,
  });

  const failed = await runnerModule.exports.runSignalAutomation(new FakeSupabase("read-failure"), "manual");
  assert.equal(failed.status, "Failed");
  assert.equal(failed.result, "Failed");
  assert.equal(failed.supabaseFailures, 1);
  assert.match(failed.errors[0], /temporary Supabase read failure/);

  const concurrent = await runnerModule.exports.runSignalAutomation(new FakeSupabase("already-running"), "scheduled");
  assert.equal(concurrent.status, "Skipped");
  assert.equal(concurrent.result, "Already Running");
  assert.equal(concurrent.executed, false);
});

class FakeSupabase {
  constructor(scenario) {
    this.scenario = scenario;
  }

  from(table) {
    return new FakeQuery(this, table);
  }
}

class FakeQuery {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.operation = "select";
    this.eqValue = undefined;
  }

  select() { this.operation = "select"; return this; }
  in() { return this; }
  order() { return this; }
  eq(_column, value) { this.eqValue = value; return this; }
  update() { this.operation = "update"; return this; }
  upsert() { return Promise.resolve({ data: null, error: null }); }
  insert() {
    if (this.client.scenario === "already-running") {
      return Promise.resolve({ data: null, error: { code: "23505", message: "duplicate lock" } });
    }
    return Promise.resolve({ data: null, error: null });
  }

  limit() { return Promise.resolve(this.result()); }
  maybeSingle() {
    if (this.client.scenario === "already-running" && String(this.eqValue).startsWith("automation-lock-")) {
      return Promise.resolve({ data: { metadata: { status: "Running" } }, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }

  result() {
    if (this.table === "signals" && this.client.scenario === "read-failure") {
      return { data: null, error: { code: "PGRST500", message: "temporary Supabase read failure" } };
    }
    return { data: [], error: null };
  }

  then(resolve, reject) {
    return Promise.resolve(this.operation === "update" ? { data: null, error: null } : this.result()).then(resolve, reject);
  }
}
