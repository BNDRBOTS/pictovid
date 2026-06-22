/**
 * hooks/useLocalStorage.ts
 * ---------------------------------------------------------------------------
 * Generic hook for persisting state to localStorage with JSON serialization.
 * Includes error handling for quota exceeded and corrupted data scenarios.
 * ---------------------------------------------------------------------------
 */

import { useState, useCallback } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      /* Corrupted or missing data -- fall back silently */
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue =
          typeof value === "function"
            ? (value as (prev: T) => T)(prev)
            : value;

        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        } catch {
          /* Quota exceeded or private browsing -- swallow */
          console.warn(`Failed to persist ${key} to localStorage.`);
        }

        return nextValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}
