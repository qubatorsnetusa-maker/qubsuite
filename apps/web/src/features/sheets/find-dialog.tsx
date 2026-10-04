import type { WorksheetDto } from '@qub/shared';
import { cellMatches, replaceInInput, type FindOptions } from '@qub/shared/formula';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/form-controls';
import { errorMessage } from '@/lib/api';
import { sheetsService } from '@/services/sheets';

export interface FindMatch {
  sheetId: string;
  row: number;
  col: number;
}

/**
 * Non-modal find & replace panel. Matching runs on the server over every cell (so unloaded cells are found too);
 * Replace re-checks the current cell before changing it, Replace all is one server-side operation.
 */
export function FindDialog(props: {
  spreadsheetId: string;
  sheets: WorksheetDto[];
  currentSheetId: string;
  canReplace: boolean;
  initialReplace: boolean;
  /** Current input of a loaded cell ('' when loaded and empty, undefined when not loaded). */
  getInput(sheetId: string, row: number, col: number): string | undefined;
  onGoto(m: FindMatch): void;
  onReplaceOne(m: FindMatch, input: string): void;
  onReplaceAll(o: FindOptions & { replace: string; sheetId: string | null }): void;
  onClose(): void;
}) {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeCell, setWholeCell] = useState(false);
  const [includeFormulas, setIncludeFormulas] = useState(false);
  const [scope, setScope] = useState<'sheet' | 'all'>('sheet');
  const [matches, setMatches] = useState<FindMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [index, setIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const findInput = useRef<HTMLInputElement>(null);
  const opts: FindOptions = { find, matchCase, wholeCell, includeFormulas };
  const sheetId = scope === 'sheet' ? props.currentSheetId : undefined;

  useEffect(() => {
    if (!props.initialReplace || !props.canReplace) findInput.current?.focus();
  }, [props.initialReplace, props.canReplace]);

  useEffect(() => {
    if (!find) {
      setMatches([]);
      setTotal(0);
      setIndex(-1);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await sheetsService.find(props.spreadsheetId, { q: find, matchCase, wholeCell, includeFormulas, sheetId });
        if (cancelled) return;
        setMatches(res.matches);
        setTotal(res.total);
        setIndex(res.matches.length ? 0 : -1);
        if (res.matches.length) props.onGoto(res.matches[0]!);
      } catch (err) {
        if (!cancelled) toast.error(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // props.onGoto is intentionally not a dependency: searching again on every parent render would be wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find, matchCase, wholeCell, includeFormulas, sheetId, props.spreadsheetId]);

  const step = (dir: 1 | -1) => {
    if (!matches.length) return;
    const next = (index + dir + matches.length) % matches.length;
    setIndex(next);
    props.onGoto(matches[next]!);
  };

  const replaceCurrent = () => {
    const m = matches[index];
    if (!m) return;
    const current = props.getInput(m.sheetId, m.row, m.col);
    // The cell may have changed since the search: only a still-matching cell is replaced, otherwise we move on.
    const next = current !== undefined && cellMatches(current, opts) ? replaceInInput(current, replace, opts) : null;
    if (next !== null) props.onReplaceOne(m, next);
    const rest = matches.filter((_, i) => i !== index);
    setMatches(rest);
    setTotal((t) => Math.max(0, t - 1));
    const n = rest.length ? index % rest.length : -1;
    setIndex(n);
    if (n >= 0) props.onGoto(rest[n]!);
  };

  return (
    <div
      role="dialog"
      aria-label="Find and replace"
      className="absolute right-4 top-2 z-40 w-[400px] max-w-[calc(100%-2rem)] rounded-lg border border-border bg-background p-3 shadow-pop"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          props.onClose();
        }
      }}
    >
      <div className="flex items-center gap-1">
        <Input
          ref={findInput}
          value={find}
          onChange={(e) => setFind(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            }
          }}
          placeholder="Find"
          aria-label="Find"
          className="h-8 flex-1"
        />
        <span className="w-24 shrink-0 text-center text-xs text-muted" aria-live="polite">
          {!find ? '' : loading ? 'Searching…' : total ? `${index + 1} of ${total}` : 'No results'}
        </span>
        <Button variant="subtle" size="icon-sm" aria-label="Previous match" disabled={!matches.length} onClick={() => step(-1)}>
          <ChevronUp />
        </Button>
        <Button variant="subtle" size="icon-sm" aria-label="Next match" disabled={!matches.length} onClick={() => step(1)}>
          <ChevronDown />
        </Button>
        <Button variant="subtle" size="icon-sm" aria-label="Close find" onClick={props.onClose}>
          <X />
        </Button>
      </div>
      {props.canReplace && (
        <div className="mt-2 flex items-center gap-1">
          <Input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Replace with" aria-label="Replace with" className="h-8 flex-1" autoFocus={props.initialReplace} />
          <Button size="sm" variant="subtle" disabled={index < 0} onClick={replaceCurrent}>
            Replace
          </Button>
          <Button size="sm" disabled={!total} onClick={() => props.onReplaceAll({ ...opts, replace, sheetId: sheetId ?? null })}>
            Replace all
          </Button>
        </div>
      )}
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Match case
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={wholeCell} onChange={(e) => setWholeCell(e.target.checked)} /> Match entire cell contents
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={includeFormulas} onChange={(e) => setIncludeFormulas(e.target.checked)} /> Also search within formulas
        </label>
        <NativeSelect aria-label="Search in" value={scope} onChange={(e) => setScope(e.target.value as 'sheet' | 'all')} className="h-7 text-xs">
          <option value="sheet">This sheet</option>
          <option value="all">All sheets</option>
        </NativeSelect>
      </div>
      {total > matches.length && matches.length > 0 && (
        <p className="mt-2 text-xs text-muted">
          Showing the first {matches.length.toLocaleString()} of {total.toLocaleString()} matches.
        </p>
      )}
    </div>
  );
}
