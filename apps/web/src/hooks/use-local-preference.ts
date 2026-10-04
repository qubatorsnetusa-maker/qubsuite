import { useCallback, useState } from 'react';

function read<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * A per-viewer UI preference (view mode, sort, collapsed panels) remembered in this browser.
 * Storage may be unavailable (private mode, blocked site data); the preference then lasts for the page only.
 */
export function useLocalPreference<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback, allowed));
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Not persisted; the in-memory value still applies.
      }
    },
    [key],
  );
  return [value, update];
}
