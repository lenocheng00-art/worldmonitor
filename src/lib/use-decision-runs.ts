"use client";

import { useEffect, useLayoutEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  mockBacktestResults,
  mockCommitteeReports,
  type BacktestResult,
  type CommitteeReport,
} from "@/lib/decision-data";

const committeeStorageKey = "worldmonitor:committee-reports";
const backtestStorageKey = "worldmonitor:backtest-results";

function useStoredRuns<T>(
  key: string,
  initialValue: T[],
): [T[], Dispatch<SetStateAction<T[]>>, boolean] {
  const [runs, setRuns] = useState<T[]>(initialValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as T[];
        if (Array.isArray(parsed) && parsed.length) {
          setRuns(parsed);
        }
      } catch {
        // Keep the built-in run cards when local storage is malformed.
      }
    }
    setLoaded(true);
  }, [key]);

  useLayoutEffect(() => {
    if (loaded) {
      window.localStorage.setItem(key, JSON.stringify(runs));
    }
  }, [key, loaded, runs]);

  return [runs, setRuns, loaded];
}

export function useCommitteeReports() {
  return useStoredRuns<CommitteeReport>(committeeStorageKey, mockCommitteeReports);
}

export function useBacktestResults() {
  return useStoredRuns<BacktestResult>(backtestStorageKey, mockBacktestResults);
}

