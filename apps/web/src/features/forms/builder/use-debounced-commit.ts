import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Local draft for a text box that commits after a pause (and on flush), never overwriting what the user is typing
 * with the form's echo. Always calls the latest `commit`, so the change is built against the current form.
 * A pending change is committed when the box unmounts, so leaving mid-burst never loses it.
 */
export function useDebouncedCommit(value: string, commit: (v: string) => void, delay = 400) {
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The value waiting to be committed (the draft state is stale inside the unmount cleanup). */
  const pending = useRef(value);
  const latest = useRef(commit);
  latest.current = commit;
  const stored = useRef(value);
  stored.current = value;
  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);
  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    latest.current(pending.current);
  };
  // A layout cleanup, not a passive one: on unmount React runs every layout cleanup before any passive one, so this
  // commits while the BuilderOpsProvider (whose queue is torn down in a passive cleanup) can still take the change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => () => flush(), []);
  const change = (v: string) => {
    setDraft(v);
    pending.current = v;
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  };
  /** Drops any pending change and shows the stored value again (e.g. a text box that mustn't be left empty). */
  const reset = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    dirty.current = false;
    pending.current = stored.current;
    setDraft(stored.current);
  };
  return [draft, change, flush, reset] as const;
}
