"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createBacktestResult,
  createCommitteeReportFromInput,
  initialDecisionLoopState,
  type BacktestResult,
  type BacktestStrategy,
  type CommitteeReport,
  type DecisionLoopState,
  type LogicChain,
  type LogicChainValidationStatus,
  type Signal,
  type SignalStatus,
} from "@/lib/decision-loop-data";
import {
  decisionLoopStorageKey,
  normalizeDecisionState,
  normalizeSignal,
  storageErrorEvent,
  worldmonitorRepository,
} from "@/lib/storage/worldmonitor-repository";

const storageKey = decisionLoopStorageKey;
const alanStorageKey = "worldmonitor:alan-chan-signals";
const oldCommitteeKey = "worldmonitor:committee-reports";
const oldBacktestKey = "worldmonitor:backtest-results";

type CreateSignalInput = Omit<
  Signal,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "status"
  | "summary"
  | "original_source"
  | "original_text"
  | "source_url"
  | "source_type"
  | "created_at"
  | "confidence"
  | "tags"
  | "related_companies"
  | "relatedIndustryChains"
  | "tracking_frequency"
> & Partial<Pick<
  Signal,
  | "summary"
  | "original_source"
  | "original_text"
  | "source_url"
  | "source_type"
  | "created_at"
  | "confidence"
  | "tags"
  | "related_companies"
  | "relatedIndustryChains"
  | "tracking_frequency"
>> & { id?: string; status?: SignalStatus };

type DecisionLoopContextValue = {
  state: DecisionLoopState;
  ready: boolean;
  error?: string;
  createSignal: (input: CreateSignalInput) => Signal;
  updateSignalStatus: (signalId: string, status: SignalStatus) => void;
  createLogicChainFromSignal: (signalId: string) => LogicChain | undefined;
  createLogicChain: (input: Omit<LogicChain, "id" | "lastCheckedAt">) => LogicChain;
  updateLogicChainValidation: (logicChainId: string, status: LogicChainValidationStatus) => void;
  sendSignalToCommittee: (signalId: string) => CommitteeReport | undefined;
  sendLogicChainToCommittee: (logicChainId: string) => CommitteeReport | undefined;
  createCommitteeReport: (input: Parameters<typeof createCommitteeReportFromInput>[0]) => CommitteeReport;
  updateCommitteeReport: (reportId: string, patch: Partial<CommitteeReport>) => void;
  runBacktest: (
    strategy: BacktestStrategy,
    links?: { signalId?: string; logicChainId?: string; committeeReportId?: string },
  ) => BacktestResult;
  runBacktestFromSignal: (signalId: string) => BacktestResult | undefined;
  runBacktestFromLogicChain: (logicChainId: string) => BacktestResult | undefined;
  linkBacktestResult: (
    resultId: string,
    signalId?: string,
    logicChainId?: string,
    committeeReportId?: string,
  ) => void;
  addToWatchlist: (ticker: string, sourceObjectId: string, signalId?: string) => void;
};

const DecisionLoopContext = createContext<DecisionLoopContextValue | null>(null);

export function DecisionLoopProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DecisionLoopState>(initialDecisionLoopState);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const handleStorageError = (event: Event) => {
      setError((event as CustomEvent<string | undefined>).detail);
    };
    window.addEventListener(storageErrorEvent, handleStorageError);
    return () => window.removeEventListener(storageErrorEvent, handleStorageError);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        const stored = window.localStorage.getItem(storageKey);
        const localState = stored
          ? normalizeState(JSON.parse(stored) as Partial<DecisionLoopState>)
          : migrateLegacyState(initialDecisionLoopState);
        const result = await worldmonitorRepository.loadState(localState);
        if (!cancelled) {
          setState(result.data);
          setError(result.error);
        }
      } catch {
        if (!cancelled) {
          setError("Saved research state could not be loaded. Built-in data is active.");
          setState(normalizeDecisionState(initialDecisionLoopState));
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void loadState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    return worldmonitorRepository.subscribe(async () => {
      const result = await worldmonitorRepository.loadState(state);
      setState(result.data);
      setError(result.error);
    });
  }, [ready, state]);

  useEffect(() => {
    if (!ready) return;
    try {
      worldmonitorRepository.saveLocalState(state);
    } catch {
      setError("Research state could not be saved in this browser.");
    }
  }, [ready, state]);

  const createSignal = useCallback((input: CreateSignalInput) => {
    const timestamp = new Date().toISOString();
    const signal = normalizeSignal({
      ...input,
      id: input.id ?? `signal-${Date.now()}`,
      status: input.status ?? "NEW",
      createdAt: timestamp,
      updatedAt: timestamp,
    } as Signal);
    setState((current) => ({ ...current, signals: [signal, ...current.signals] }));
    void worldmonitorRepository.saveSignal(signal);
    return signal;
  }, []);

  const updateSignalStatus = useCallback((signalId: string, status: SignalStatus) => {
    setState((current) => {
      let updatedSignal: Signal | undefined;
      const next = {
        ...current,
        signals: current.signals.map((signal) => {
          if (signal.id !== signalId) return signal;
          updatedSignal = normalizeSignal({ ...signal, status, updatedAt: new Date().toISOString() });
          return updatedSignal;
        }),
      };
      if (updatedSignal) void worldmonitorRepository.saveSignal(updatedSignal);
      return next;
    });
  }, []);

  const createLogicChainFromSignal = useCallback((signalId: string) => {
    const signal = state.signals.find((item) => item.id === signalId);
    if (!signal) return undefined;
    const existing = state.logicChains.find((chain) => chain.id === signal.linkedLogicChainId);
    if (existing) return existing;

    const chain: LogicChain = {
      id: `chain-${Date.now()}`,
      signal_id: signal.id,
      title: `${signal.title}: transmission path`,
      triggerSignalId: signal.id,
      originatingSignalId: signal.id,
      originalSource: signal.original_source,
      originalText: signal.original_text,
      companies: signal.related_companies,
      tags: signal.tags,
      sourceConfidence: signal.confidence,
      triggerEvent: signal.extractedSignal,
      transmissionPath: [
        "Signal becomes observable",
        "Industry expectations reprice",
        "Earnings revisions respond",
        "Affected assets confirm or reject the thesis",
      ],
      affectedAssets: signal.relatedTickers,
      bullCase: "Follow-up data and price action confirm the expected transmission.",
      bearCase: "The catalyst is priced in or operating data contradicts the signal.",
      confidenceScore: Math.min(90, Math.max(50, signal.priorityScore - 5)),
      followUpIndicators: ["Company disclosure", "Earnings revisions", "Relative strength", "Volume"],
      validationStatus: "Active",
      evidenceFor: [],
      evidenceAgainst: [],
      timeline: [],
      historicalHitRate: 55,
      nextDataPoint: "Next company or macro update",
      lastCheckedAt: new Date().toISOString(),
      related_asset_ids: signal.related_asset_ids ?? [],
    };
    const updatedSignal = normalizeSignal({
      ...signal,
      status: "PROMOTED",
      logic_chain_id: chain.id,
      linkedLogicChainId: chain.id,
      updatedAt: new Date().toISOString(),
    });
    setState((current) => ({
      ...current,
      logicChains: [chain, ...current.logicChains],
      signals: current.signals.map((item) => item.id === signalId ? updatedSignal : item),
    }));
    void worldmonitorRepository.saveLogicChain(chain, updatedSignal);
    return chain;
  }, [state.logicChains, state.signals]);

  const createLogicChain = useCallback((input: Omit<LogicChain, "id" | "lastCheckedAt">) => {
    const chain: LogicChain = {
      ...input,
      id: `chain-${Date.now()}`,
      lastCheckedAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      logicChains: [chain, ...current.logicChains],
      signals: current.signals.map((signal) =>
        signal.id === chain.triggerSignalId
          ? normalizeSignal({ ...signal, status: "PROMOTED", logic_chain_id: chain.id, linkedLogicChainId: chain.id, updatedAt: new Date().toISOString() })
          : signal,
      ),
    }));
    void worldmonitorRepository.saveLogicChain(chain);
    return chain;
  }, []);

  const updateLogicChainValidation = useCallback(
    (logicChainId: string, validationStatus: LogicChainValidationStatus) => {
      setState((current) => ({
        ...current,
        logicChains: current.logicChains.map((chain) =>
          chain.id === logicChainId
            ? { ...chain, validationStatus, lastCheckedAt: new Date().toISOString() }
            : chain,
        ),
      }));
      const chain = state.logicChains.find((item) => item.id === logicChainId);
      if (chain) void worldmonitorRepository.saveLogicChain({ ...chain, validationStatus, lastCheckedAt: new Date().toISOString() });
    },
    [state.logicChains],
  );

  const createCommitteeReport = useCallback(
    (input: Parameters<typeof createCommitteeReportFromInput>[0]) => {
      const report = createCommitteeReportFromInput(input);
      setState((current) => ({ ...current, committeeReports: [report, ...current.committeeReports] }));
      void worldmonitorRepository.saveCommitteeReport(report);
      return report;
    },
    [],
  );

  const sendSignalToCommittee = useCallback((signalId: string) => {
    const signal = state.signals.find((item) => item.id === signalId);
    if (!signal) return undefined;
    const existing = state.committeeReports.find((report) => report.id === signal.linkedCommitteeReportId);
    if (existing) return existing;
    const report = createCommitteeReportFromInput({
      topic: signal.title,
      triggerSignalId: signal.id,
      linkedLogicChainId: signal.linkedLogicChainId,
      relatedTickers: signal.relatedTickers,
      relatedIndustryChains: signal.relatedIndustryChains,
      related_asset_ids: signal.related_asset_ids ?? [],
    });
    const updatedSignal = normalizeSignal({
      ...signal,
      status: "PROMOTED",
      linkedCommitteeReportId: report.id,
      updatedAt: new Date().toISOString(),
    });
    setState((current) => ({
      ...current,
      committeeReports: [report, ...current.committeeReports],
      signals: current.signals.map((item) => item.id === signalId ? updatedSignal : item),
      logicChains: current.logicChains.map((chain) =>
        chain.id === signal.linkedLogicChainId ? { ...chain, linkedCommitteeReportId: report.id } : chain,
      ),
    }));
    void worldmonitorRepository.saveCommitteeReport(report, updatedSignal);
    return report;
  }, [state.committeeReports, state.signals]);

  const sendLogicChainToCommittee = useCallback((logicChainId: string) => {
    const chain = state.logicChains.find((item) => item.id === logicChainId);
    if (!chain) return undefined;
    const signal = state.signals.find((item) => item.id === chain.triggerSignalId);
    const existing = state.committeeReports.find((report) => report.id === chain.linkedCommitteeReportId);
    if (existing) return existing;
    const report = createCommitteeReportFromInput({
      topic: chain.title,
      triggerSignalId: chain.triggerSignalId,
      linkedLogicChainId: chain.id,
      relatedTickers: chain.affectedAssets,
      relatedIndustryChains: signal?.relatedIndustryChains ?? [],
      related_asset_ids: chain.related_asset_ids ?? signal?.related_asset_ids ?? [],
    });
    const updatedSignal = signal ? normalizeSignal({
      ...signal,
      status: "PROMOTED",
      linkedCommitteeReportId: report.id,
      updatedAt: new Date().toISOString(),
    }) : undefined;
    const updatedChain = { ...chain, linkedCommitteeReportId: report.id };
    setState((current) => ({
      ...current,
      committeeReports: [report, ...current.committeeReports],
      logicChains: current.logicChains.map((item) =>
        item.id === logicChainId ? updatedChain : item,
      ),
      signals: current.signals.map((item) =>
        item.id === chain.triggerSignalId && updatedSignal ? updatedSignal : item,
      ),
    }));
    void worldmonitorRepository.saveCommitteeReport(report, updatedSignal, updatedChain);
    return report;
  }, [state.committeeReports, state.logicChains, state.signals]);

  const updateCommitteeReport = useCallback((reportId: string, patch: Partial<CommitteeReport>) => {
    setState((current) => {
      const existing = current.committeeReports.find((report) => report.id === reportId);
      if (!existing) return current;
      const timestamp = new Date().toISOString();
      const nextReport = { ...existing, ...patch, decision: patch.finalDecision ?? patch.decision ?? existing.finalDecision };
      const changedWatchlist = current.watchlist
        .filter((item) => item.sourceObjectId === reportId)
        .map((item) => ({
          ...item,
          committeeView: nextReport.finalDecision,
          updatedAt: timestamp,
          changeType: "Status changed" as const,
        }));
      const next = {
        ...current,
        committeeReports: current.committeeReports.map((report) => report.id === reportId ? nextReport : report),
        watchlist: current.watchlist.map((item) => changedWatchlist.find((changed) => changed.ticker === item.ticker) ?? item),
      };
      void worldmonitorRepository.saveCommitteeReport(nextReport);
      if (changedWatchlist.length) void worldmonitorRepository.saveWatchlist(changedWatchlist);
      return next;
    });
  }, []);

  const runBacktest = useCallback((
    strategy: BacktestStrategy,
    links: { signalId?: string; logicChainId?: string; committeeReportId?: string } = {},
  ) => {
    const result = createBacktestResult(strategy, links);
    setState((current) => {
      const next = linkResultIntoState(current, strategy, result);
      persistBacktestState(next, strategy, result);
      return next;
    });
    return result;
  }, []);

  const runBacktestFromSignal = useCallback((signalId: string) => {
    const signal = state.signals.find((item) => item.id === signalId);
    if (!signal) return undefined;
    const strategy: BacktestStrategy = {
      ...initialDecisionLoopState.backtestStrategies[2],
      id: `strategy-${Date.now()}`,
      name: `${signal.title} validation`,
      triggerSignalId: signal.id,
      linkedLogicChainId: signal.linkedLogicChainId,
      tickers: signal.relatedTickers,
      signalSource: signal.source,
      related_asset_ids: signal.related_asset_ids ?? [],
    };
    const result = createBacktestResult(strategy, {
      signalId,
      logicChainId: signal.linkedLogicChainId,
      committeeReportId: signal.linkedCommitteeReportId,
    });
    setState((current) => {
      const next = linkResultIntoState(current, strategy, result);
      persistBacktestState(next, strategy, result);
      return next;
    });
    return result;
  }, [state.signals]);

  const runBacktestFromLogicChain = useCallback((logicChainId: string) => {
    const chain = state.logicChains.find((item) => item.id === logicChainId);
    if (!chain) return undefined;
    const strategy: BacktestStrategy = {
      ...initialDecisionLoopState.backtestStrategies[1],
      id: `strategy-${Date.now()}`,
      name: `${chain.title} historical validation`,
      triggerSignalId: chain.triggerSignalId,
      linkedLogicChainId: chain.id,
      tickers: chain.affectedAssets.filter((asset) => !asset.includes("10Y")),
      related_asset_ids: chain.related_asset_ids ?? [],
    };
    const result = createBacktestResult(strategy, {
      signalId: chain.triggerSignalId,
      logicChainId,
      committeeReportId: chain.linkedCommitteeReportId,
    });
    setState((current) => {
      const next = linkResultIntoState(current, strategy, result);
      persistBacktestState(next, strategy, result);
      return next;
    });
    return result;
  }, [state.logicChains]);

  const linkBacktestResult = useCallback((
    resultId: string,
    signalId?: string,
    logicChainId?: string,
    committeeReportId?: string,
  ) => {
    setState((current) => {
      const result = current.backtestResults.find((item) => item.id === resultId);
      const strategy = result && current.backtestStrategies.find((item) => item.id === result.strategyId);
      if (!result || !strategy) return current;
      const linkedResult = { ...result, linkedSignalId: signalId, linkedLogicChainId: logicChainId, linkedCommitteeReportId: committeeReportId, related_asset_ids: strategy.related_asset_ids ?? result.related_asset_ids ?? [] };
      const next = linkResultIntoState(
        { ...current, backtestResults: current.backtestResults.filter((item) => item.id !== resultId) },
        strategy,
        linkedResult,
      );
      persistBacktestState(next, strategy, linkedResult);
      return next;
    });
  }, []);

  const addToWatchlist = useCallback((ticker: string, sourceObjectId: string, signalId?: string) => {
    setState((current) => {
      const timestamp = new Date().toISOString();
      const existing = current.watchlist.find((item) => item.ticker === ticker);
      const committeeReport = current.committeeReports.find((report) => report.id === sourceObjectId);
      const watchlistItem = existing
        ? {
            ...existing,
            sourceObjectId,
            linkedSignalIds: signalId
              ? Array.from(new Set([...existing.linkedSignalIds, signalId]))
              : existing.linkedSignalIds,
            committeeView: committeeReport?.finalDecision ?? existing.committeeView,
            updatedAt: timestamp,
            changeType: "Status changed" as const,
          }
        : {
            ticker,
            sourceObjectId,
            entryTrigger: "Wait for price and fundamental confirmation",
            invalidationLevel: "Trigger thesis reverses",
            linkedSignalIds: signalId ? [signalId] : [],
            committeeView: committeeReport?.finalDecision ?? "Pending" as const,
            backtestEdge: "Not tested",
            suggestedAction: "Research",
            addedAt: timestamp,
            updatedAt: timestamp,
            changeType: "Added" as const,
          };
      const updatedSignal = signalId
        ? current.signals.find((signal) => signal.id === signalId)
        : undefined;
      const nextSignal = updatedSignal
        ? normalizeSignal({ ...updatedSignal, status: "TRACKING", updatedAt: timestamp })
        : undefined;
      const next = {
        ...current,
        watchlist: existing
          ? current.watchlist.map((item) => item.ticker === ticker ? watchlistItem : item)
          : [watchlistItem, ...current.watchlist],
        signals: signalId
          ? current.signals.map((signal) =>
              signal.id === signalId && nextSignal ? nextSignal : signal,
            )
          : current.signals,
      };
      void worldmonitorRepository.saveWatchlistItem(watchlistItem, nextSignal);
      return next;
    });
  }, []);

  const value = useMemo<DecisionLoopContextValue>(() => ({
    state,
    ready,
    error,
    createSignal,
    updateSignalStatus,
    createLogicChainFromSignal,
    createLogicChain,
    updateLogicChainValidation,
    sendSignalToCommittee,
    sendLogicChainToCommittee,
    createCommitteeReport,
    updateCommitteeReport,
    runBacktest,
    runBacktestFromSignal,
    runBacktestFromLogicChain,
    linkBacktestResult,
    addToWatchlist,
  }), [
    addToWatchlist, createCommitteeReport, createLogicChain, createLogicChainFromSignal, createSignal,
    error, linkBacktestResult, ready, runBacktest, runBacktestFromLogicChain, runBacktestFromSignal, sendLogicChainToCommittee,
    sendSignalToCommittee, state, updateCommitteeReport, updateLogicChainValidation, updateSignalStatus,
  ]);

  return <DecisionLoopContext.Provider value={value}>{children}</DecisionLoopContext.Provider>;
}

export function useDecisionLoop() {
  const context = useContext(DecisionLoopContext);
  if (!context) throw new Error("useDecisionLoop must be used inside DecisionLoopProvider.");
  return context;
}

function linkResultIntoState(
  current: DecisionLoopState,
  strategy: BacktestStrategy,
  result: BacktestResult,
): DecisionLoopState {
  const signalId = result.linkedSignalId;
  const logicChainId = result.linkedLogicChainId;
  const committeeReportId = result.linkedCommitteeReportId;
  return {
    ...current,
    backtestStrategies: [strategy, ...current.backtestStrategies.filter((item) => item.id !== strategy.id)],
    backtestResults: [result, ...current.backtestResults],
    signals: current.signals.map((signal) =>
      signal.id === signalId
        ? normalizeSignal({ ...signal, status: "TRACKING", linkedBacktestId: result.id, related_asset_ids: mergeIds(signal.related_asset_ids, result.related_asset_ids), updatedAt: new Date().toISOString() })
        : signal,
    ),
    logicChains: current.logicChains.map((chain) =>
      chain.id === logicChainId
        ? {
            ...chain,
            linkedBacktestId: result.id,
            related_asset_ids: mergeIds(chain.related_asset_ids, result.related_asset_ids),
            validationStatus: result.sharpeRatio >= 1 ? "Confirmed" : "Broken",
            lastCheckedAt: new Date().toISOString(),
          }
        : chain,
    ),
    committeeReports: current.committeeReports.map((report) =>
      report.id === committeeReportId ? { ...report, linkedBacktestId: result.id, related_asset_ids: mergeIds(report.related_asset_ids, result.related_asset_ids) } : report,
    ),
    watchlist: current.watchlist.map((item) =>
      signalId && item.linkedSignalIds.includes(signalId)
        ? {
            ...item,
            backtestEdge: `${(result.totalReturn - result.benchmarkReturn).toFixed(1)}% excess return`,
            updatedAt: new Date().toISOString(),
            changeType: "Status changed",
          }
        : item,
    ),
  };
}

function persistBacktestState(state: DecisionLoopState, strategy: BacktestStrategy, result: BacktestResult) {
  void worldmonitorRepository.saveBacktestBundle(strategy, result, {
    signal: state.signals.find((item) => item.id === result.linkedSignalId),
    chain: state.logicChains.find((item) => item.id === result.linkedLogicChainId),
    report: state.committeeReports.find((item) => item.id === result.linkedCommitteeReportId),
    watchlist: result.linkedSignalId
      ? state.watchlist.filter((item) => item.linkedSignalIds.includes(result.linkedSignalId as string))
      : [],
  });
}

function normalizeState(input: Partial<DecisionLoopState>): DecisionLoopState {
  return {
    signals: Array.isArray(input.signals) ? input.signals.map((signal) => normalizeSignal(signal as Signal)) : initialDecisionLoopState.signals.map(normalizeSignal),
    logicChains: Array.isArray(input.logicChains) ? input.logicChains : initialDecisionLoopState.logicChains,
    committeeReports: Array.isArray(input.committeeReports)
      ? input.committeeReports
      : initialDecisionLoopState.committeeReports,
    backtestStrategies: Array.isArray(input.backtestStrategies)
      ? input.backtestStrategies
      : initialDecisionLoopState.backtestStrategies,
    backtestResults: Array.isArray(input.backtestResults)
      ? input.backtestResults
      : initialDecisionLoopState.backtestResults,
    watchlist: Array.isArray(input.watchlist) ? input.watchlist : initialDecisionLoopState.watchlist,
  };
}

function migrateLegacyState(base: DecisionLoopState): DecisionLoopState {
  let next = base;
  try {
    const legacyAlan = JSON.parse(window.localStorage.getItem(alanStorageKey) ?? "[]") as Array<Record<string, unknown>>;
    const migrated = legacyAlan.map((item, index): Signal => {
      const entity = String(item.entity ?? `Imported signal ${index + 1}`);
      const category = String(item.category ?? "Other");
      const priority = String(item.priority ?? "Medium");
      const legacyStatus = String(item.status ?? "Watching");
      return {
        id: `legacy-${String(item.id ?? index)}`,
        title: entity,
        source: "Alan Chan",
        originalText: String(item.sourceExcerpt ?? item.thesis ?? ""),
        extractedSignal: String(item.thesis ?? ""),
        relatedTickers: inferTickers(entity),
        relatedIndustryChains: [category],
        priorityScore: priority === "High" ? 90 : priority === "Low" ? 50 : 70,
        status: legacyStatus === "Invalidated" ? "DISMISSED" : legacyStatus === "Confirmed" ? "TRACKING" : "NEW",
        summary: String(item.thesis ?? ""),
        original_source: "Alan Chan",
        original_text: String(item.sourceExcerpt ?? item.thesis ?? ""),
        source_url: null,
        source_type: "MEMBERSHIP_POST",
        created_at: String(item.createdDate ?? new Date().toISOString()),
        confidence: priority === "High" ? 90 : priority === "Low" ? 50 : 70,
        tags: [category],
        related_companies: [entity],
        tracking_frequency: "weekly",
        createdAt: String(item.createdDate ?? new Date().toISOString()),
        updatedAt: String(item.lastChecked ?? new Date().toISOString()),
      };
    });
    if (migrated.length) {
      const known = new Set(base.signals.map((signal) => signal.originalText));
      next = { ...next, signals: [...migrated.filter((signal) => !known.has(signal.originalText)), ...next.signals] };
    }
  } catch {
    // Keep seeded data if the legacy payload is malformed.
  }

  // Keep the legacy keys intact. They are read-only migration sources and can be inspected or rolled back.
  void window.localStorage.getItem(oldCommitteeKey);
  void window.localStorage.getItem(oldBacktestKey);
  return next;
}

function inferTickers(entity: string) {
  const mapping: Record<string, string[]> = {
    Google: ["GOOGL", "AVGO"],
    Broadcom: ["AVGO"],
    Vertiv: ["VRT"],
    "Constellation Energy": ["CEG"],
    SpaceX: ["RKLB", "ASTS"],
    Anthropic: ["AMZN", "GOOGL"],
    OpenAI: ["MSFT", "ORCL"],
  };
  return mapping[entity] ?? [entity.toUpperCase().replaceAll(" ", "-")];
}

function mergeIds(left?: string[], right?: string[]) {
  return [...new Set([...(left ?? []), ...(right ?? [])])];
}
