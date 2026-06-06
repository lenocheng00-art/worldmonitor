"use client";

import { useEffect, useLayoutEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  alanSignalsStorageKey,
  normalizeAlanSignal,
  type AlanSignal,
} from "@/lib/alan-chan-parser";

const alanSignalsBackupStorageKey = `${alanSignalsStorageKey}:backup`;

function parseSignals(raw: string) {
  const parsed = JSON.parse(raw) as Partial<AlanSignal>[];

  if (!Array.isArray(parsed)) {
    throw new Error("Stored Alan Chan signals must be an array.");
  }

  return parsed.map((signal) => normalizeAlanSignal(signal));
}

export function useAlanSignals(): [
  AlanSignal[],
  Dispatch<SetStateAction<AlanSignal[]>>,
  boolean,
] {
  const [signals, setSignals] = useState<AlanSignal[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(alanSignalsStorageKey);
    const backup = window.localStorage.getItem(alanSignalsBackupStorageKey);

    try {
      if (stored) {
        const restoredSignals = parseSignals(stored);
        setSignals(restoredSignals);

        if (restoredSignals.length) {
          window.localStorage.setItem(alanSignalsBackupStorageKey, stored);
        }
      } else if (backup) {
        const restoredSignals = parseSignals(backup);
        setSignals(restoredSignals);
        window.localStorage.setItem(alanSignalsStorageKey, backup);
      }
    } catch {
      if (stored) {
        window.localStorage.setItem(alanSignalsBackupStorageKey, stored);
      }
    } finally {
      setIsLoaded(true);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== alanSignalsStorageKey || !event.newValue) {
        return;
      }

      try {
        setSignals(parseSignals(event.newValue));
      } catch {
        // Keep the current in-memory signals if another tab writes malformed data.
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useLayoutEffect(() => {
    if (!isLoaded) {
      return;
    }

    const nextValue = JSON.stringify(signals);
    const currentValue = window.localStorage.getItem(alanSignalsStorageKey);

    if (currentValue === nextValue) {
      return;
    }

    if (currentValue) {
      try {
        if (parseSignals(currentValue).length) {
          window.localStorage.setItem(alanSignalsBackupStorageKey, currentValue);
        }
      } catch {
        window.localStorage.setItem(alanSignalsBackupStorageKey, currentValue);
      }
    }

    window.localStorage.setItem(alanSignalsStorageKey, nextValue);
  }, [isLoaded, signals]);

  return [signals, setSignals, isLoaded];
}
