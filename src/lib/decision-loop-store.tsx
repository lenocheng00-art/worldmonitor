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
  type SourcePost,
} from "@/lib/decision-loop-data";
import { worldmonitorRepository } from "@/lib/storage/worldmonitor-repository";

const storageKey = "worldmonitor:decision-loop-v1";
const alanStorageKey = "worldmonitor:alan-chan-signals";
const oldCommitteeKey = "worldmonitor:committee-reports";
const oldBacktestKey = "worldmonitor:backtest-results";

type CreateSignalInput = Omit<
  Signal,
  "id" | "createdAt" | "updatedAt" | "status"
> & {
  id?: string;
  status?: SignalStatus;
  sourcePost?: Omit<SourcePost, "createdAt" | "updatedAt">;
};

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
        }
      } catch {
        if (!cancelled) {
          setError("Saved research state could not be loaded. Built-in data is active.");
          setState(initialDecisionLoopState);
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
    try {
      worldmonitorRepository.saveLocalState(state);
    } catch {
      setError("Research state could not be saved in this browser.");
    }
  }, [ready, state]);

  const createSignal = useCallback((input: CreateSignalInput) => {
    const timestamp = new Date().toISOString();
    const { sourcePost: sourcePostInput, ...signalInput } = input;
    const sourcePost = sourcePostInput
      ? { ...sourcePostInput, createdAt: timestamp, updatedAt: timestamp }
      : undefined;
    const signal: Signal = {
      ...signalInput,
      id: input.id ?? `signal-${Date.now()}`,
      sourcePostId: sourcePost?.id ?? input.sourcePostId,
      status: input.status ?? "New",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setState((current) => ({ ...current, signals: [signal, ...current.signals] }));
    void (sourcePost
      ? worldmonitorRepository.saveSourcePostAndSignal(sourcePost, signal)
      : worldmonitorRepository.saveSignal(signal));
    return signal;
  }, []);

  const updateSignalStatus = useCallback((signalId: string, status: SignalStatus) => {
    setState((current) => {
      let updatedSignal: Signal | undefined;
      const next = {
        ...current,
        signals: current.signals.map((signal) => {
          if (signal.id !== signalId) return signal;
          updatedSignal = { ...signal, status, updatedAt: new Date().toISOString() };
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
      title: `${signal.title}: transmission path`,
      triggerSignalId: signal.id,
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
      historicalHitRate: 55,
      nextDataPoint: "Next company or macro update",
      lastCheckedAt: new Date().toISOString(),
    };
    const updatedSignal: Signal = {
      ...signal,
      status: "Linked",
      linkedLogicChainId: chain.id,
      updatedAt: new Date().toISOString(),
    };
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
    setState((current) => {
      let linkedSignal: Signal | undefined;
      const next = {
        ...current,
        logicChains: [chain, ...current.logicChains],
        signals: current.signals.map((signal) => {
          if (signal.id !== chain.triggerSignalId) return signal;
          linkedSignal = {
            ...signal,
            status: "Linked" as const,
            linkedLogicChainId: chain.id,
            updatedAt: new Date().toISOString(),
          };
          return linkedSignal;
        }),
      };
      void worldmonitorRepository.saveLogicChain(chain, linkedSignal);
      return next;
    });
    return chain;
  }, []);

  const updateLogicChainValidation = useCallback(
    (logicChainId: string, validationStatus: LogicChainValidationStatus) => {
      setState((current) => {
        let updatedChain: LogicChain | undefined;
        const next = {
          ...current,
          logicChains: current.logicChains.map((chain) => {
            if (chain.id !== logicChainId) return chain;
            updatedChain = { ...chain, validationStatus, lastCheckedAt: new Date().toISOString() };
            return updatedChain;
          }),
        };
        if (updatedChain) void worldmonitorRepository.saveLogicChain(updatedChain);
        return next;
      });
    },
    [],
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
    });
    const updatedSignal: Signal = {
      ...signal,
      status: "Reviewed",
      linkedCommitteeReportId: report.id,
      updatedAt: new Date().toISOString(),
    };
    const linkedChain = state.logicChains.find((chain) => chain.id === signal.linkedLogicChainId);
    const updatedChain = linkedChain ? { ...linkedChain, linkedCommitteeReportId: report.id } : undefined;
    setState((current) => ({
      ...current,
      committeeReports: [report, ...current.committeeReports],
      signals: current.signals.map((item) => item.id === signalId ? updatedSignal : item),
      logicChains: current.logicChains.map((chain) => chain.id === updatedChain?.id ? updatedChain : chain),
    }));
    void worldmonitorRepository.saveCommitteeReport(report, updatedSignal, updatedChain);
    return report;
  }, [state.committeeReports, state.logicChains, state.signals]);

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
    });
    const updatedChain: LogicChain = { ...chain, linkedCommitteeReportId: report.id };
    const updatedSignal = signal
      ? {
          ...signal,
          status: "Reviewed" as const,
          linkedCommitteeReportId: report.id,
          updatedAt: new Date().toISOString(),
        }
      : undefined;
    setState((current) => ({
      ...current,
      committeeReports: [report, ...current.committeeReports],
      logicChains: current.logicChains.map((item) => item.id === logicChainId ? updatedChain : item),
      signals: current.signals.map((item) => item.id === updatedSignal?.id ? updatedSignal : item),
    }));
    void worldmonitorRepository.saveCommitteeReport(report, updatedSignal, updatedChain);
    return report;
  }, [state.committeeReports, state.logicChains, state.signals]);

  const updateCommitteeReport = useCallback((reportId: string, patch: Partial<CommitteeReport>) => {
    setState((current) => {
      let updatedReport: CommitteeReport | undefined;
      const next = {
        ...current,
        committeeReports: current.committeeReports.map((report) => {
          if (report.id !== reportId) return report;
          updatedReport = { ...report, ...patch };
          return updatedReport;
        }),
      };
      if (updatedReport) void worldmonitorRepository.saveCommitteeReport(updatedReport);
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
      persistBacktest(next, strategy, result);
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
    };
    const result = createBacktestResult(strategy, {
      signalId,
      logicChainId: signal.linkedLogicChainId,
      committeeReportId: signal.linkedCommitteeReportId,
    });
    setState((current) => {
      const next = linkResultIntoState(current, strategy, result);
      persistBacktest(next, strategy, result);
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
    };
    const result = createBacktestResult(strategy, {
      signalId: chain.triggerSignalId,
      logicChainId,
      committeeReportId: chain.linkedCommitteeReportId,
    });
    setState((current) => {
      const next = linkResultIntoState(current, strategy, result);
      persistBacktest(next, strategy, result);
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
      const next = linkResultIntoState(
        { ...current, backtestResults: current.backtestResults.filter((item) => item.id !== resultId) },
        strategy,
        { ...result, linkedSignalId: signalId, linkedLogicChainId: logicChainId, linkedCommitteeReportId: committeeReportId },
      );
      const linkedResult = next.backtestResults.find((item) => item.id === resultId);
      if (linkedResult) persistBacktest(next, strategy, linkedResult);
      return next;
    });
  }, []);

  const addToWatchlist = useCallback((ticker: string, sourceObjectId: string, signalId?: string) => {
    setState((current) => {
      const existing = current.watchlist.find((item) => item.ticker === ticker);
      const sourceSignal = signalId
        ? current.signals.find((signal) => signal.id === signalId)
        : undefined;
      const actionedSignal = sourceSignal
        ? { ...sourceSignal, status: "Actioned" as const, updatedAt: new Date().toISOString() }
        : undefined;

      if (existing) {
        const updatedItem = {
          ...existing,
          sourceObjectId,
          linkedSignalIds: signalId
            ? Array.from(new Set([...existing.linkedSignalIds, signalId]))
            : existing.linkedSignalIds,
        };
        const next = {
          ...current,
          watchlist: current.watchlist.map((item) =>
            item.ticker === ticker ? updatedItem : item,
          ),
          signals: signalId
            ? current.signals.map((signal) =>
                signal.id === signalId && actionedSignal ? actionedSignal : signal,
              )
            : current.signals,
        };
        void worldmonitorRepository.saveWatchlistItem(updatedItem, actionedSignal);
        return next;
      }

      const newItem = {
        ticker,
        sourceObjectId,
        entryTrigger: "Wait for price and fundamental confirmation",
        invalidationLevel: "Trigger thesis reverses",
        linkedSignalIds: signalId ? [signalId] : [],
        committeeView: "Pending" as const,
        backtestEdge: "Not tested",
        suggestedAction: "Research",
        addedAt: new Date().toISOString(),
      };
      const next = {
        ...current,
        watchlist: [newItem, ...current.watchlist],
        signals: signalId
          ? current.signals.map((signal) =>
              signal.id === signalId && actionedSignal ? actionedSignal : signal,
            )
          : current.signals,
      };
      void worldmonitorRepository.saveWatchlistItem(newItem, actionedSignal);
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
        ? { ...signal, status: "Backtested", linkedBacktestId: result.id, updatedAt: new Date().toISOString() }
        : signal,
    ),
    logicChains: current.logicChains.map((chain) =>
      chain.id === logicChainId
        ? {
            ...chain,
            linkedBacktestId: result.id,
            validationStatus: result.sharpeRatio >= 1 ? "Confirmed" : "Broken",
            lastCheckedAt: new Date().toISOString(),
          }
        : chain,
    ),
    committeeReports: current.committeeReports.map((report) =>
      report.id === committeeReportId ? { ...report, linkedBacktestId: result.id } : report,
    ),
    watchlist: current.watchlist.map((item) =>
      signalId && item.linkedSignalIds.includes(signalId)
        ? {
            ...item,
            backtestEdge: `${(result.totalReturn - result.benchmarkReturn).toFixed(1)}% excess return`,
          }
        : item,
    ),
  };
}

function persistBacktest(
  state: DecisionLoopState,
  strategy: BacktestStrategy,
  result: BacktestResult,
) {
  void worldmonitorRepository.saveBacktest(strategy, result, {
    signal: state.signals.find((signal) => signal.id === result.linkedSignalId),
    logicChain: state.logicChains.find((chain) => chain.id === result.linkedLogicChainId),
    committeeReport: state.committeeReports.find(
      (report) => report.id === result.linkedCommitteeReportId,
    ),
  });
}

function normalizeState(input: Partial<DecisionLoopState>): DecisionLoopState {
  return {
    signals: Array.isArray(input.signals) ? input.signals : initialDecisionLoopState.signals,
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
        status: legacyStatus === "Invalidated" ? "Invalidated" : legacyStatus === "Confirmed" ? "Tracking" : "New",
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
