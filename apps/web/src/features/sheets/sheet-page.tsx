import type { CellRange, CellStyle, FilterQuery, SheetClientMessage, SheetOp, SheetServerMessage, SpreadsheetDto, WorksheetDto } from '@qub/shared';
import { cellA1, colToLetters, parseA1, rangeA1, translateFormulaInput, FUNCTION_NAMES } from '@qub/shared/formula';
import { roleAtLeast } from '@qub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Filter,
  FilterX,
  History,
  Italic,
  MessageSquare,
  PaintBucket,
  Plus,
  Redo2,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  Baseline,
  FolderInput,
  WrapText,
  Printer,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { EditorHeader, SaveIndicator, type SaveStatus } from '@/components/editor-header';
import { ErrorState, FullPageSpinner } from '@/components/states';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/form-controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/menu';
import { Avatar, Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { ReconnectingSocket, type ConnectionState } from '@/lib/reconnecting-socket';
import { cn, formatDate, formatRelative } from '@/lib/utils';
import { qk } from '@/services/query-keys';
import { sheetsService } from '@/services/sheets';
import { MoveDialog } from '../drive/dialogs';
import { ShareDialog } from '../sharing/share-dialog';
import { normalizeRange } from './geometry';
import { Grid, type FillDirection, type GridHandle, type Selection } from './grid';
import { SheetStore } from './sheet-store';
import { FindDialog, type FindMatch } from './find-dialog';
import { resolveBorders } from './borders';
import { chunkOps, copyFill, fillSeries, groupStyleOps, type FillSource } from './fill';
import { BordersMenu } from './borders-menu';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT } from './geometry';
import { measureWrappedHeight } from './row-fit';
import { ValidationDialog } from './validation-dialog';
import { listPickInput } from './validation';
import { ImportDialog } from './import-dialog';
import { planAutoSum } from './autosum';
import { FunctionItems, FunctionsMenu } from './functions-menu';
import { SheetAiAssistant } from './sheet-ai-assistant';
import { printHtml } from '@/lib/print-frame';
import { buildPrintHtml } from './print-sheet';
import { measureText } from './spill';

const COLORS = ['#000000', '#5f6368', '#d93025', '#e37400', '#f9ab00', '#188038', '#1a73e8', '#9334e6', '#ffffff', '#fce8e6', '#fef7e0', '#e6f4ea', '#e8f0fe', '#f3e8fd'];
const CLIPBOARD_MIME = 'application/x-qub-cells';

export function SheetPage() {
  const { spreadsheetId } = useParams({ from: '/_authenticated/sheets/$spreadsheetId' });
  const meta = useQuery({ queryKey: qk.sheets.one(spreadsheetId), queryFn: () => sheetsService.get(spreadsheetId) });
  if (meta.isLoading) return <FullPageSpinner label="Opening spreadsheet…" />;
  if (meta.error) return <ErrorState error={meta.error} onRetry={() => void meta.refetch()} title="Can’t open this spreadsheet" />;
  return <SheetEditor key={spreadsheetId} initial={meta.data!} />;
}

function ToolButton({ label, active, onClick, children, disabled }: { label: string; active?: boolean; onClick(): void; children: ReactNode; disabled?: boolean }) {
  return (
    <Tooltip content={label}>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={active} className={cn('flex size-8 shrink-0 items-center justify-center rounded text-[#444746] hover:bg-black/5 disabled:opacity-40 [&_svg]:size-[18px]', active && 'bg-primary-soft')}>
        {children}
      </button>
    </Tooltip>
  );
}

function ColorButton({ label, icon, onPick }: { label: string; icon: ReactNode; onPick(c: string | undefined): void }) {
  return (
    <Popover>
      <Tooltip content={label}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={label} className="flex size-8 items-center justify-center rounded text-[#444746] hover:bg-black/5 [&_svg]:size-[18px]">
            {icon}
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-auto p-3">
        <div className="grid grid-cols-7 gap-1.5">
          {COLORS.map((c) => (
            <button key={c} onClick={() => onPick(c)} className="size-6 rounded-full border border-black/15" style={{ background: c }} aria-label={`${label} ${c}`} />
          ))}
        </div>
        <button onClick={() => onPick(undefined)} className="mt-2 text-xs text-primary hover:underline">
          Reset
        </button>
      </PopoverContent>
    </Popover>
  );
}

function SheetEditor({ initial }: { initial: SpreadsheetDto }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const id = initial.id;
  const meta = useQuery({ queryKey: qk.sheets.one(id), queryFn: () => sheetsService.get(id), initialData: initial });
  const store = useMemo(() => {
    const s = new SheetStore(id);
    s.sheets = initial.sheets;
    s.revision = initial.revision;
    return s;
  }, [id, initial]);
  const version = useSyncExternalStore(store.subscribe, store.getVersion);
  const sheets = store.sheets.length ? store.sheets : initial.sheets;
  const [sheetId, setSheetId] = useState(initial.sheets[0]!.id);
  const sheet = sheets.find((s) => s.id === sheetId) ?? sheets[0]!;
  const canEdit = roleAtLeast(meta.data.capabilities.role, 'EDITOR') && !meta.data.isTrashed;
  const canComment = roleAtLeast(meta.data.capabilities.role, 'COMMENTER');

  const [sel, setSel] = useState<Selection>({ active: { row: 0, col: 0 }, anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } });
  const range = normalizeRange(sel.anchor, sel.focus);
  const [editing, setEditing] = useState<{ value: string; fromFormulaBar?: boolean } | null>(null);
  const [conn, setConn] = useState<ConnectionState>('connecting');
  const [hiddenRows, setHiddenRows] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<(FilterQuery & { sheetId: string }) | null>(null);
  const [filterDialog, setFilterDialog] = useState<number | null>(null);
  const [panel, setPanel] = useState<'versions' | 'comments' | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmDeleteSheet, setConfirmDeleteSheet] = useState<WorksheetDto | null>(null);
  const [menu, setMenu] = useState<{ kind: 'col' | 'row' | 'cell'; index: number; x: number; y: number } | null>(null);
  const undoStack = useRef<SheetOp[][]>([]);
  const redoStack = useRef<SheetOp[][]>([]);
  const gridRef = useRef<GridHandle>(null);
  const [find, setFind] = useState<{ replace: boolean; nonce: number } | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const socketRef = useRef<ReconnectingSocket<SheetServerMessage, SheetClientMessage> | null>(null);

  // ---------- realtime ----------
  useEffect(() => {
    const socket = new ReconnectingSocket<SheetServerMessage, SheetClientMessage>({
      path: `/sheets/${id}`,
      onState: setConn,
      onMessage: (msg) => {
        const result = store.handle(msg);
        if (result?.rejected) toast.error(result.rejected);
      },
      onFatal: () => toast.error('You no longer have access to this spreadsheet.'),
    });
    socketRef.current = socket;
    store.send = (clientOpId, ops) => socket.send({ type: 'ops', clientOpId, baseRevision: store.revision, ops });
    // Replace all is applied by the server; its acknowledgement carries the previous inputs for a single undo step.
    store.onReplaced = (replaced) => {
      const bySheet = new Map<string, { row: number; col: number; input: string }[]>();
      for (const r of replaced) bySheet.set(r.sheetId, [...(bySheet.get(r.sheetId) ?? []), { row: r.row, col: r.col, input: r.previousInput }]);
      undoStack.current.push([...bySheet].map(([sheetId, cells]) => ({ type: 'setCells', sheetId, cells })));
      redoStack.current = [];
      toast.success(replaced.length === 1 ? 'Replaced 1 cell' : `Replaced ${replaced.length.toLocaleString()} cells`);
      setFind((f) => (f ? { ...f, nonce: Date.now() } : f));
    };
    return () => {
      store.send = null;
      store.onReplaced = null;
      socket.close();
    };
  }, [id, store]);

  // Share our active cell/range with collaborators (throttled by React batching).
  useEffect(() => {
    const t = setTimeout(() => socketRef.current?.send({ type: 'presence', selection: { sheetId: sheet.id, activeRow: sel.active.row, activeCol: sel.active.col, range } }), 80);
    return () => clearTimeout(t);
  }, [sel, sheet.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveStatus: SaveStatus = !navigator.onLine ? 'offline' : conn !== 'open' ? (store.hasPending() ? 'connection-lost' : conn === 'connecting' ? 'saving' : 'connection-lost') : store.hasPending() ? 'saving' : 'saved';

  const onVisibleRange = useCallback((r0: number, r1: number, c0: number, c1: number) => store.ensureWindow(sheet.id, r0, r1, c0, c1), [store, sheet.id]);

  // ---------- operations ----------
  const run = useCallback(
    (ops: SheetOp[], record = true) => {
      if (!canEdit) return toast.error('You have view-only access.');
      const inverse = store.apply(ops);
      if (record && inverse.length) {
        undoStack.current.push(inverse);
        redoStack.current = [];
      }
      if (ops.some((o) => o.type === 'insertRows' || o.type === 'deleteRows' || o.type === 'insertCols' || o.type === 'deleteCols' || o.type === 'sortRange')) {
        // Structural changes can't be undone locally; the server result replaces our view.
        undoStack.current = [];
      }
    },
    [canEdit, store],
  );

  // Undo/redo steps can hold more ops than one message allows (the server takes at most 100), so they are chunked.
  const applyChunked = (ops: SheetOp[]) => {
    const inverse: SheetOp[] = [];
    for (const chunk of chunkOps(ops)) inverse.unshift(...store.apply(chunk));
    return inverse;
  };
  const undo = () => {
    const ops = undoStack.current.pop();
    if (!ops) return;
    redoStack.current.push(applyChunked(ops));
  };
  const redo = () => {
    const ops = redoStack.current.pop();
    if (!ops) return;
    undoStack.current.push(applyChunked(ops));
  };

  /** Applies ops in message-sized batches as a single undo step. */
  const runBatch = (ops: SheetOp[]) => {
    if (!canEdit) return toast.error('You have view-only access.');
    const inverse = applyChunked(ops);
    if (inverse.length) {
      undoStack.current.push(inverse);
      redoStack.current = [];
    }
  };

  const toggleCheckbox = (r: number, c: number) =>
    run([{ type: 'setCells', sheetId: sheet.id, cells: [{ row: r, col: c, input: store.get(sheet.id, r, c)?.value === true ? 'FALSE' : 'TRUE' }] }]);

  const sourceAt = (r: number, c: number): FillSource => {
    const cell = store.get(sheet.id, r, c);
    return { input: cell?.input ?? '', value: cell?.value ?? null, style: cell?.style ?? null };
  };

  /**
   * Autofill (series) or Ctrl+D / Ctrl+R (copy) into `target`, which lies next to the selection in `direction`.
   * Each column (vertical fill) or row (horizontal fill) of the selection is filled independently.
   */
  const fill = (target: CellRange, direction: FillDirection, series: boolean, source: CellRange = range) => {
    if (!canEdit) return;
    const vertical = direction === 'down' || direction === 'up';
    const count = vertical ? target.endRow - target.startRow + 1 : target.endCol - target.startCol + 1;
    const lines = vertical ? source.endCol - source.startCol + 1 : source.endRow - source.startRow + 1;
    if (count * lines > 10_000) return toast.error('Fill up to 10,000 cells at a time.');
    const step = { dRow: direction === 'down' ? 1 : direction === 'up' ? -1 : 0, dCol: direction === 'right' ? 1 : direction === 'left' ? -1 : 0 };
    const cells: { row: number; col: number; input: string }[] = [];
    const styles: { row: number; col: number; style: CellStyle | null }[] = [];
    for (let i = 0; i < lines; i++) {
      // Sources run from the far edge towards the fill direction; target k is k+1 cells beyond the near edge.
      const along = vertical ? Array.from({ length: source.endRow - source.startRow + 1 }, (_, j) => source.startRow + j) : Array.from({ length: source.endCol - source.startCol + 1 }, (_, j) => source.startCol + j);
      if (direction === 'up' || direction === 'left') along.reverse();
      const at = (p: number) => (vertical ? { row: p, col: source.startCol + i } : { row: source.startRow + i, col: p });
      const srcs = along.map((p) => sourceAt(at(p).row, at(p).col));
      const out = series ? fillSeries(srcs, count, step) : copyFill(srcs[0]!, count, step);
      const near = along[along.length - 1]!;
      out.forEach((t, k) => {
        const pos = at(near + (k + 1) * (direction === 'up' || direction === 'left' ? -1 : 1));
        cells.push({ ...pos, input: t.input });
        styles.push({ ...pos, style: t.style });
      });
    }
    if (!cells.length) return;
    runBatch([{ type: 'setCells', sheetId: sheet.id, cells }, ...groupStyleOps(sheet.id, styles)]);
    fitRows(cells.map((c) => c.row));
  };

  const activeCell = store.get(sheet.id, sel.active.row, sel.active.col);

  const gotoMatch = (m: FindMatch) => {
    if (m.sheetId !== sheet.id) setSheetId(m.sheetId);
    store.ensureWindow(m.sheetId, m.row, m.row, m.col, m.col);
    const at = { row: m.row, col: m.col };
    setSel({ active: at, anchor: at, focus: at });
    requestAnimationFrame(() => gridRef.current?.scrollIntoView(m.row, m.col));
  };

  // Ctrl+F / Ctrl+H / Ctrl+P also work while focus is outside the grid (formula bar, name box).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const key = e.key.toLowerCase();
      // Ctrl+P prints the sheet itself, never the page around it.
      if (key === 'p') return e.preventDefault(), void printRef.current();
      if (key !== 'f' && key !== 'h') return;
      e.preventDefault();
      setFind({ replace: key === 'h' && canEdit, nonce: Date.now() });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit]);
  const move = (dr: number, dc: number, extend = false) => {
    const row = Math.max(0, Math.min(sheet.rowCount - 1, (extend ? sel.focus.row : sel.active.row) + dr));
    const col = Math.max(0, Math.min(sheet.colCount - 1, (extend ? sel.focus.col : sel.active.col) + dc));
    if (extend) setSel({ ...sel, focus: { row, col } });
    else setSel({ active: { row, col }, anchor: { row, col }, focus: { row, col } });
    gridRef.current?.scrollIntoView(row, col);
  };

  /** Prints the current sheet — only the sheet, from a separate document — once pending edits have been saved. */
  const printing = useRef(false);
  const printSheet = async () => {
    if (printing.current) return;
    if (!meta.data?.capabilities.canDownload) return toast.error('Printing is turned off for this spreadsheet.');
    if (editing) commit('none');
    printing.current = true;
    const loading = toast.loading('Preparing to print…');
    try {
      // What prints comes from the server, so wait (briefly) for this tab's edits to be saved.
      for (let waited = 0; store.hasPending() && waited < 10_000; waited += 100) await new Promise((r) => setTimeout(r, 100));
      const data = await sheetsService.printData(id, sheet.id);
      toast.dismiss(loading);
      await printHtml(buildPrintHtml(data, hiddenRows, measureText));
    } catch (e) {
      toast.dismiss(loading);
      toast.error(errorMessage(e));
    } finally {
      printing.current = false;
    }
  };
  const printRef = useRef(printSheet);
  printRef.current = printSheet;

  const commit = (dir: 'down' | 'right' | 'up' | 'left' | 'none') => {
    if (editing) {
      const current = store.get(sheet.id, sel.active.row, sel.active.col)?.input ?? '';
      if (editing.value !== current) {
        run([{ type: 'setCells', sheetId: sheet.id, cells: [{ row: sel.active.row, col: sel.active.col, input: editing.value }] }]);
        fitRows([sel.active.row]);
      }
    }
    setEditing(null);
    // setEditing(null) only schedules the re-render that unmounts the inline edit input; a synchronous
    // focus() here can lose the race and no-op, dropping focus to <body> once the input unmounts.
    requestAnimationFrame(() => gridRef.current?.focus());
    if (dir === 'down') move(1, 0);
    if (dir === 'up') move(-1, 0);
    if (dir === 'right') move(0, 1);
    if (dir === 'left') move(0, -1);
  };

  /** Σ → SUM/AVERAGE/COUNT/MAX/MIN: totals below (or beside) the selection, or a suggested formula in the active cell. */
  const autoSum = (fn: string) => {
    if (!canEdit) return toast.error('You have view-only access.');
    const cellAt = (r: number, c: number) => store.get(sheet.id, r, c);
    const plan = planAutoSum(fn, range, sel.active, {
      isNumber: (r, c) => cellAt(r, c)?.dataType === 'NUMBER',
      // A cell that hasn't loaded yet is treated as taken, so AutoSum never overwrites data it hasn't seen.
      isEmpty: (r, c) => store.isLoaded(sheet.id, r, c) && !cellAt(r, c)?.input,
      rowCount: sheet.rowCount,
      colCount: sheet.colCount,
    });
    if (plan.kind === 'blocked') return toast.error(plan.reason);
    if (plan.kind === 'edit') return setEditing({ value: plan.input });
    run([{ type: 'setCells', sheetId: sheet.id, cells: plan.cells }]);
    const first = plan.cells[0]!;
    const last = plan.cells[plan.cells.length - 1]!;
    setSel({ active: first, anchor: first, focus: { row: last.row, col: last.col } });
  };
  /** Any function from the menu: the active cell opens with `=NAME(` to fill in the arguments. */
  const insertFunction = (name: string) => {
    if (!canEdit) return toast.error('You have view-only access.');
    setEditing({ value: `=${name}(` });
  };

  const style = (patch: CellStyle) => run([{ type: 'setStyle', sheetId: sheet.id, range, style: patch }]);
  const toggle = (key: 'bold' | 'italic' | 'underline' | 'strike') => style({ [key]: !activeCell?.style?.[key] });

  // ---------- clipboard ----------
  const copy = async (cut = false) => {
    const rows: string[][] = [];
    const inputs: string[][] = [];
    for (let r = range.startRow; r <= range.endRow; r++) {
      const row: string[] = [];
      const inRow: string[] = [];
      for (let c = range.startCol; c <= range.endCol; c++) {
        const cell = store.get(sheet.id, r, c);
        row.push(cell?.formattedValue ?? '');
        inRow.push(cell?.input ?? '');
      }
      rows.push(row);
      inputs.push(inRow);
    }
    const tsv = rows.map((r) => r.join('\t')).join('\n');
    const payload = JSON.stringify({ origin: { row: range.startRow, col: range.startCol }, inputs });
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/plain': new Blob([tsv], { type: 'text/plain' }), [`web ${CLIPBOARD_MIME}`]: new Blob([payload], { type: CLIPBOARD_MIME }) }),
      ]);
    } catch {
      await navigator.clipboard.writeText(tsv);
      sessionStorage.setItem(CLIPBOARD_MIME, JSON.stringify({ tsv, payload }));
    }
    if (cut) run([{ type: 'clearRange', sheetId: sheet.id, range, formats: false }]);
  };

  const paste = async () => {
    let inputs: string[][] | null = null;
    let origin = null as { row: number; col: number } | null;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes(`web ${CLIPBOARD_MIME}`)) {
          const data = JSON.parse(await (await item.getType(`web ${CLIPBOARD_MIME}`)).text()) as { origin: typeof origin; inputs: string[][] };
          inputs = data.inputs;
          origin = data.origin;
        }
      }
      if (!inputs) {
        const text = await navigator.clipboard.readText();
        const fallback = sessionStorage.getItem(CLIPBOARD_MIME);
        if (fallback && JSON.parse(fallback).tsv === text) {
          const data = JSON.parse(JSON.parse(fallback).payload) as { origin: typeof origin; inputs: string[][] };
          inputs = data.inputs;
          origin = data.origin;
        } else inputs = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
      }
    } catch {
      return toast.error('Allow clipboard access to paste, or use Ctrl+V.');
    }
    if (!inputs?.length) return;
    const cells: { row: number; col: number; input: string }[] = [];
    inputs.forEach((row, i) =>
      row.forEach((input, j) => {
        const r = sel.active.row + i;
        const c = sel.active.col + j;
        if (r >= sheet.rowCount + 1000 || c >= 702) return;
        // Formulas copied inside Qub shift their relative references, like any spreadsheet.
        const value = origin ? translateFormulaInput(input, r - (origin.row + i), c - (origin.col + j)) : input;
        cells.push({ row: r, col: c, input: value });
      }),
    );
    if (cells.length > 10_000) return toast.error('Paste is limited to 10,000 cells at a time.');
    if (cells.length) {
      run([{ type: 'setCells', sheetId: sheet.id, cells }]);
      fitRows(cells.map((c) => c.row));
    }
    setSel({ active: sel.active, anchor: sel.active, focus: { row: sel.active.row + inputs.length - 1, col: sel.active.col + Math.max(...inputs.map((r) => r.length)) - 1 } });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (editing) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (k === 'ArrowDown' && e.altKey) return e.preventDefault(), gridRef.current?.openList();
    if (k === ' ' && !mod && canEdit && activeCell?.style?.validation?.kind === 'checkbox') return e.preventDefault(), toggleCheckbox(sel.active.row, sel.active.col);
    if (k === 'ArrowDown') return e.preventDefault(), move(1, 0, e.shiftKey);
    if (k === 'ArrowUp') return e.preventDefault(), move(-1, 0, e.shiftKey);
    if (k === 'ArrowRight') return e.preventDefault(), move(0, 1, e.shiftKey);
    if (k === 'ArrowLeft') return e.preventDefault(), move(0, -1, e.shiftKey);
    if (k === 'Tab') return e.preventDefault(), move(0, e.shiftKey ? -1 : 1);
    if (k === 'Enter') {
      e.preventDefault();
      if (canEdit) setEditing({ value: activeCell?.input ?? '' });
      return;
    }
    if (k === 'F2' && canEdit) return e.preventDefault(), setEditing({ value: activeCell?.input ?? '' });
    if ((k === 'Delete' || k === 'Backspace') && canEdit) return e.preventDefault(), run([{ type: 'clearRange', sheetId: sheet.id, range, formats: false }]);
    if (mod && !e.shiftKey && k.toLowerCase() === 'd' && canEdit) {
      e.preventDefault();
      if (range.endRow > range.startRow) fill({ ...range, startRow: range.startRow + 1 }, 'down', false, { ...range, endRow: range.startRow });
      return;
    }
    if (mod && !e.shiftKey && k.toLowerCase() === 'r' && canEdit) {
      e.preventDefault();
      if (range.endCol > range.startCol) fill({ ...range, startCol: range.startCol + 1 }, 'right', false, { ...range, endCol: range.startCol });
      return;
    }
    if (mod && k.toLowerCase() === 'z') return e.preventDefault(), e.shiftKey ? redo() : undo();
    if (mod && k.toLowerCase() === 'y') return e.preventDefault(), redo();
    if (mod && k.toLowerCase() === 'b') return e.preventDefault(), toggle('bold');
    if (mod && k.toLowerCase() === 'i') return e.preventDefault(), toggle('italic');
    if (mod && k.toLowerCase() === 'u') return e.preventDefault(), toggle('underline');
    if (mod && k.toLowerCase() === 'c') return e.preventDefault(), void copy();
    if (mod && k.toLowerCase() === 'x' && canEdit) return e.preventDefault(), void copy(true);
    if (mod && k.toLowerCase() === 'v' && canEdit) return e.preventDefault(), void paste();
    if (mod && k.toLowerCase() === 'a') {
      e.preventDefault();
      return setSel({ active: sel.active, anchor: { row: 0, col: 0 }, focus: { row: sheet.rowCount - 1, col: sheet.colCount - 1 } });
    }
    if (!mod && !e.altKey && k.length === 1 && canEdit) {
      e.preventDefault();
      setEditing({ value: k });
    }
  };

  // ---------- sheet management ----------
  const refreshMeta = () => qc.invalidateQueries({ queryKey: qk.sheets.one(id) });
  const sheetMutation = useMutation({
    mutationFn: (fn: () => Promise<WorksheetDto[]>) => fn(),
    onSuccess: (list) => {
      store.setSheets(list);
      void refreshMeta();
    },
  });
  const updateSheet = (patch: Parameters<typeof sheetsService.updateSheet>[2]) => sheetMutation.mutate(() => sheetsService.updateSheet(id, sheet.id, patch));

  /** Grows rows so wrapped text fits. Only the acting client measures, and rows never shrink automatically. */
  const fitRows = (rows: Iterable<number>) => {
    const targets = new Set(rows);
    requestAnimationFrame(() => {
      const grown: Record<string, number> = {};
      for (const cell of store.sheetCells(sheet.id).values()) {
        if (!targets.has(cell.row) || !cell.style?.wrap || !cell.formattedValue) continue;
        const needed = measureWrappedHeight(cell.formattedValue, sheet.colWidths[cell.col] ?? DEFAULT_COL_WIDTH, cell.style.fontSize ?? 13, !!cell.style.bold);
        const current = grown[cell.row] ?? sheet.rowHeights[cell.row] ?? DEFAULT_ROW_HEIGHT;
        if (needed > current) grown[cell.row] = Math.min(500, needed);
      }
      if (Object.keys(grown).length) updateSheet({ rowHeights: { ...sheet.rowHeights, ...grown } });
    });
  };

  const applyFilter = async (q: FilterQuery) => {
    try {
      const res = await sheetsService.filter(id, sheet.id, q);
      const keep = new Set(res.rows);
      const hidden = new Set<number>();
      for (let r = q.headerRow + 1; r <= res.lastRow; r++) if (!keep.has(r)) hidden.add(r);
      setHiddenRows(hidden);
      setFilter({ ...q, sheetId: sheet.id });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  // Re-evaluate an active filter when data changes (server-side, against computed values).
  useEffect(() => {
    if (!filter || filter.sheetId !== sheet.id) return;
    const t = setTimeout(() => void applyFilter(filter), 600);
    return () => clearTimeout(t);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setHiddenRows(new Set());
    setFilter(null);
  }, [sheet.id]);

  const dataRange = () => {
    let maxRow = 0;
    let maxCol = 0;
    for (const cell of store.sheetCells(sheet.id).values()) {
      if (!cell.input) continue;
      maxRow = Math.max(maxRow, cell.row);
      maxCol = Math.max(maxCol, cell.col);
    }
    return { startRow: 0, endRow: maxRow, startCol: 0, endCol: maxCol };
  };

  // ---------- status bar ----------
  const stats = useMemo(() => {
    let sum = 0;
    let count = 0;
    let nonEmpty = 0;
    const cells = store.sheetCells(sheet.id);
    if ((range.endRow - range.startRow + 1) * (range.endCol - range.startCol + 1) > 200_000) {
      for (const c of cells.values()) {
        if (c.row < range.startRow || c.row > range.endRow || c.col < range.startCol || c.col > range.endCol) continue;
        if (c.input) nonEmpty++;
        if (typeof c.value === 'number') (sum += c.value), count++;
      }
    } else {
      for (let r = range.startRow; r <= range.endRow; r++)
        for (let c = range.startCol; c <= range.endCol; c++) {
          const cell = cells.get(`${r}:${c}`);
          if (!cell) continue;
          if (cell.input) nonEmpty++;
          if (typeof cell.value === 'number') (sum += cell.value), count++;
        }
    }
    return { sum, count, nonEmpty, avg: count ? sum / count : 0 };
  }, [version, sheet.id, range.startRow, range.endRow, range.startCol, range.endCol]); // eslint-disable-line react-hooks/exhaustive-deps

  const comments = useQuery({ queryKey: qk.sheets.comments(id, sheet.id), queryFn: () => sheetsService.comments(id, sheet.id) });
  const commentCells = useMemo(() => new Set((comments.data ?? []).filter((c) => !c.resolved).map((c) => `${c.row}:${c.col}`)), [comments.data]);

  const rename = useMutation({ mutationFn: (t: string) => sheetsService.rename(id, t), onSuccess: () => void refreshMeta() });
  const trash = useMutation({ mutationFn: () => sheetsService.trash(id), onSuccess: () => void navigate({ to: '/drive' }) });

  const openMenu = (kind: 'col' | 'row' | 'cell', index: number, e: MouseEvent) => {
    e.preventDefault();
    setMenu({ kind, index, x: e.clientX, y: e.clientY });
  };

  const formulaValue = editing ? editing.value : (activeCell?.input ?? '');
  const suggestions = editing?.value.startsWith('=') ? FUNCTION_NAMES().filter((f) => f.startsWith(/([A-Z]+)$/i.exec(editing.value)?.[1]?.toUpperCase() ?? '\u0000')).slice(0, 6) : [];

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border">
        <EditorHeader
          fileType="SPREADSHEET"
          title={meta.data.title}
          onRename={(t) => rename.mutateAsync(t)}
          canEdit={canEdit}
          status={<SaveIndicator status={saveStatus} />}
          readOnlyLabel={canEdit ? undefined : 'View only'}
          presence={store.presence.filter((p) => p.user.clientId !== store.selfClientId).map((p) => ({ key: p.user.clientId, name: p.user.name, avatarUrl: p.user.avatarUrl, color: p.user.color }))}
          onShare={() => setShareOpen(true)}
          menus={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded px-2 py-0.5 hover:bg-hover">File</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem icon={<History />} onSelect={() => setPanel('versions')}>
                    Version history
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem icon={<FolderInput />} onSelect={() => setMoveOpen(true)}>
                      Move
                    </DropdownMenuItem>
                  )}
                  {(meta.data.capabilities.canDownload || canEdit) && <DropdownMenuSeparator />}
                  {meta.data.capabilities.canDownload && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Download</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem
                          onSelect={() => {
                            const a = document.createElement('a');
                            a.href = sheetsService.csvUrl(id, sheet.id);
                            a.download = '';
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                          }}
                        >
                          Comma-separated values (.csv, current sheet)
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {meta.data.capabilities.canDownload && (
                    <DropdownMenuItem icon={<Printer />} shortcut="Ctrl+P" onSelect={() => void printSheet()}>
                      Print
                    </DropdownMenuItem>
                  )}
                  {canEdit && <DropdownMenuItem onSelect={() => setImportOpen(true)}>Import…</DropdownMenuItem>}
                  {meta.data.capabilities.canTrash && (
                    <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => trash.mutate()}>
                      Move to trash
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded px-2 py-0.5 hover:bg-hover">Edit</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {canEdit && (
                    <>
                      <DropdownMenuItem shortcut="Ctrl+Z" onSelect={undo}>Undo</DropdownMenuItem>
                      <DropdownMenuItem shortcut="Ctrl+Y" onSelect={redo}>Redo</DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem shortcut={canEdit ? 'Ctrl+H' : 'Ctrl+F'} onSelect={() => setFind({ replace: canEdit, nonce: Date.now() })}>
                    {canEdit ? 'Find and replace' : 'Find'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded px-2 py-0.5 hover:bg-hover">View</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {[0, 1, 2].map((n) => (
                    <DropdownMenuItem key={`r${n}`} disabled={!canEdit} onSelect={() => updateSheet({ frozenRows: n })}>
                      Freeze {n === 0 ? 'no rows' : `${n} row${n > 1 ? 's' : ''}`} {sheet.frozenRows === n ? '✓' : ''}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem disabled={!canEdit} onSelect={() => updateSheet({ frozenRows: sel.active.row + 1 })}>
                    Freeze up to row {sel.active.row + 1}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {[0, 1, 2].map((n) => (
                    <DropdownMenuItem key={`c${n}`} disabled={!canEdit} onSelect={() => updateSheet({ frozenCols: n })}>
                      Freeze {n === 0 ? 'no columns' : `${n} column${n > 1 ? 's' : ''}`} {sheet.frozenCols === n ? '✓' : ''}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem disabled={!canEdit} onSelect={() => updateSheet({ frozenCols: sel.active.col + 1 })}>
                    Freeze up to column {colToLetters(sel.active.col)}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded px-2 py-0.5 hover:bg-hover">Insert</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  onCloseAutoFocus={(e) => {
                    // Keep focus in the sheet — and in the cell editor when a function was inserted.
                    e.preventDefault();
                    gridRef.current?.focus();
                  }}
                >
                  <DropdownMenuItem disabled={!canEdit} onSelect={() => run([{ type: 'insertRows', sheetId: sheet.id, index: range.startRow, count: 1 }])}>Row above</DropdownMenuItem>
                  <DropdownMenuItem disabled={!canEdit} onSelect={() => run([{ type: 'insertRows', sheetId: sheet.id, index: range.endRow + 1, count: 1 }])}>Row below</DropdownMenuItem>
                  <DropdownMenuItem disabled={!canEdit} onSelect={() => run([{ type: 'insertCols', sheetId: sheet.id, index: range.startCol, count: 1 }])}>Column left</DropdownMenuItem>
                  <DropdownMenuItem disabled={!canEdit} onSelect={() => run([{ type: 'insertCols', sheetId: sheet.id, index: range.endCol + 1, count: 1 }])}>Column right</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={!canEdit} onSelect={() => sheetMutation.mutate(() => sheetsService.addSheet(id))}>Sheet</DropdownMenuItem>
                  <DropdownMenuItem disabled={!canComment} onSelect={() => setPanel('comments')}>Comment</DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Function</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-56">
                        <FunctionItems onAutoSum={autoSum} onInsert={insertFunction} />
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded px-2 py-0.5 hover:bg-hover">Data</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem disabled={!canEdit} onSelect={() => run([{ type: 'sortRange', sheetId: sheet.id, range: dataRange(), col: sel.active.col, direction: 'asc', hasHeader: sheet.frozenRows > 0 }])}>
                    Sort sheet by column {colToLetters(sel.active.col)} (A → Z)
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!canEdit} onSelect={() => run([{ type: 'sortRange', sheetId: sheet.id, range: dataRange(), col: sel.active.col, direction: 'desc', hasHeader: sheet.frozenRows > 0 }])}>
                    Sort sheet by column {colToLetters(sel.active.col)} (Z → A)
                  </DropdownMenuItem>
                  {range.endRow > range.startRow && (
                    <DropdownMenuItem disabled={!canEdit} onSelect={() => run([{ type: 'sortRange', sheetId: sheet.id, range, col: sel.active.col, direction: 'asc', hasHeader: false }])}>
                      Sort range {rangeA1(range)} (A → Z)
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {canEdit && (
                    <>
                      <DropdownMenuItem onSelect={() => setValidationOpen(true)}>Data validation…</DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem icon={<Filter />} onSelect={() => setFilterDialog(sel.active.col)}>
                    Filter by column {colToLetters(sel.active.col)}…
                  </DropdownMenuItem>
                  {filter && (
                    <DropdownMenuItem icon={<FilterX />} onSelect={() => { setFilter(null); setHiddenRows(new Set()); }}>
                      Remove filter
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
          actions={
            <>
              <Tooltip content="Comments">
                <Button variant="subtle" size="icon" onClick={() => setPanel((p) => (p === 'comments' ? null : 'comments'))} aria-label="Comments">
                  <MessageSquare />
                </Button>
              </Tooltip>
              <Tooltip content="Version history">
                <Button variant="subtle" size="icon" onClick={() => setPanel((p) => (p === 'versions' ? null : 'versions'))} aria-label="Version history">
                  <History />
                </Button>
              </Tooltip>
            </>
          }
        />
        {/* toolbar */}
        <div role="toolbar" aria-label="Formatting" className="mx-3 mb-2 flex h-10 items-center gap-0.5 overflow-x-auto rounded-full bg-[#edf2fa] px-3">
          <ToolButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canEdit}>
            <Undo2 />
          </ToolButton>
          <ToolButton label="Redo (Ctrl+Y)" onClick={redo} disabled={!canEdit}>
            <Redo2 />
          </ToolButton>
          {meta.data.capabilities.canDownload && (
            <ToolButton label="Print (Ctrl+P)" onClick={() => void printSheet()}>
              <Printer />
            </ToolButton>
          )}
          <span className="mx-1 h-5 w-px bg-border" />
          <NativeSelect aria-label="Number format" disabled={!canEdit} value={activeCell?.style?.numberFormat ?? 'general'} onChange={(e) => style({ numberFormat: e.target.value as CellStyle['numberFormat'] })} className="h-8 border-none bg-transparent">
            <option value="general">Automatic</option>
            <option value="number">Number 1,000.12</option>
            <option value="integer">Integer 1,000</option>
            <option value="currency">Currency $1,000.12</option>
            <option value="percent">Percent 10.12%</option>
            <option value="date">Date 2026-09-27</option>
            <option value="time">Time 2:30:00 PM</option>
            <option value="datetime">Date time 2026-09-27 2:30:00 PM</option>
          </NativeSelect>
          <NativeSelect aria-label="Font size" disabled={!canEdit} value={activeCell?.style?.fontSize ?? 13} onChange={(e) => style({ fontSize: Number(e.target.value) })} className="h-8 w-16 border-none bg-transparent">
            {[8, 10, 11, 12, 13, 14, 16, 18, 24, 36].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
          <span className="mx-1 h-5 w-px bg-border" />
          {canEdit && (
            <>
              <ToolButton label="Bold (Ctrl+B)" active={activeCell?.style?.bold} onClick={() => toggle('bold')}>
                <Bold />
              </ToolButton>
              <ToolButton label="Italic (Ctrl+I)" active={activeCell?.style?.italic} onClick={() => toggle('italic')}>
                <Italic />
              </ToolButton>
              <ToolButton label="Underline (Ctrl+U)" active={activeCell?.style?.underline} onClick={() => toggle('underline')}>
                <Underline />
              </ToolButton>
              <ToolButton label="Strikethrough" active={activeCell?.style?.strike} onClick={() => toggle('strike')}>
                <Strikethrough />
              </ToolButton>
              <ColorButton label="Text color" icon={<Baseline />} onPick={(c) => style({ color: c })} />
              <ColorButton label="Fill color" icon={<PaintBucket />} onPick={(c) => style({ background: c })} />
              <BordersMenu colors={COLORS} onApply={(kind, border) => run(resolveBorders(sheet.id, range, kind, border))} />
              <ToolButton
                label="Wrap text"
                active={!!activeCell?.style?.wrap}
                onClick={() => {
                  style({ wrap: activeCell?.style?.wrap ? null : true });
                  fitRows(Array.from({ length: range.endRow - range.startRow + 1 }, (_, i) => range.startRow + i));
                }}
              >
                <WrapText />
              </ToolButton>
              <span className="mx-1 h-5 w-px bg-border" />
              <ToolButton label="Align left" active={activeCell?.style?.align === 'left'} onClick={() => style({ align: 'left' })}>
                <AlignLeft />
              </ToolButton>
              <ToolButton label="Align center" active={activeCell?.style?.align === 'center'} onClick={() => style({ align: 'center' })}>
                <AlignCenter />
              </ToolButton>
              <ToolButton label="Align right" active={activeCell?.style?.align === 'right'} onClick={() => style({ align: 'right' })}>
                <AlignRight />
              </ToolButton>
              <span className="mx-1 h-5 w-px bg-border" />
              <ToolButton label={filter ? 'Remove filter' : 'Create a filter'} active={!!filter} onClick={() => (filter ? (setFilter(null), setHiddenRows(new Set())) : setFilterDialog(sel.active.col))}>
                <Filter />
              </ToolButton>
              <FunctionsMenu onAutoSum={autoSum} onInsert={insertFunction} onClosed={() => gridRef.current?.focus()} />
            </>
          )}
        </div>
        {/* formula bar */}
        <div className="flex h-8 items-center border-t border-border">
          <NameBox
            value={range.startRow === range.endRow && range.startCol === range.endCol ? cellA1(sel.active.row, sel.active.col) : rangeA1(range)}
            onJump={(row, col) => {
              setSel({ active: { row, col }, anchor: { row, col }, focus: { row, col } });
              gridRef.current?.scrollIntoView(row, col);
              // As in Google Sheets, typing after a jump goes into the cell, not the name box.
              gridRef.current?.focus();
            }}
            onCancel={() => gridRef.current?.focus()}
          />
          <span className="px-2 font-serif italic text-muted" aria-hidden>
            fx
          </span>
          <div className="mr-2">
            <SheetAiAssistant
              canEdit={canEdit}
              onApplyFormula={(formula) => {
                setEditing({ value: formula, fromFormulaBar: true });
                // Automatically commit into cell
                applyOp({ type: 'set_cell', row: sel.active.row, col: sel.active.col, value: formula });
              }}
            />
          </div>
          <div className="relative flex-1">
            <input
              aria-label="Formula bar"
              value={formulaValue}
              readOnly={!canEdit}
              onFocus={() => canEdit && !editing && setEditing({ value: activeCell?.input ?? '', fromFormulaBar: true })}
              onChange={(e) => setEditing({ value: e.target.value, fromFormulaBar: true })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit('down');
                } else if (e.key === 'Escape') {
                  setEditing(null);
                  gridRef.current?.focus();
                }
              }}
              className="h-8 w-full px-2 font-mono text-[13px] outline-none"
            />
            {suggestions.length > 0 && (
              <ul className="absolute left-0 top-full z-40 w-56 rounded-md border border-border bg-background py-1 text-sm shadow-pop" role="listbox" aria-label="Functions">
                {suggestions.map((f) => (
                  <li key={f}>
                    <button
                      type="button"
                      className="w-full px-3 py-1 text-left font-mono text-xs hover:bg-hover"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setEditing({ value: editing!.value.replace(/[A-Z]+$/i, `${f}(`), fromFormulaBar: true });
                      }}
                    >
                      {f}()
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {find && (
          <FindDialog
            key={find.nonce}
            spreadsheetId={id}
            sheets={sheets}
            currentSheetId={sheet.id}
            canReplace={canEdit}
            initialReplace={find.replace}
            getInput={(sid, r, c) => store.get(sid, r, c)?.input ?? (store.isLoaded(sid, r, c) ? '' : undefined)}
            onGoto={gotoMatch}
            onReplaceOne={(m, input) => run([{ type: 'setCells', sheetId: m.sheetId, cells: [{ row: m.row, col: m.col, input }] }])}
            onReplaceAll={(o) => canEdit && store.apply([{ type: 'findReplace', sheetId: o.sheetId, find: o.find, replace: o.replace, matchCase: o.matchCase, wholeCell: o.wholeCell, includeFormulas: o.includeFormulas }])}
            onClose={() => {
              setFind(null);
              gridRef.current?.focus();
            }}
          />
        )}
        <Grid
          ref={gridRef}
          sheet={sheet}
          getCell={(r, c) => store.get(sheet.id, r, c)}
          version={version}
          selection={sel}
          range={range}
          onSelect={(s) => {
            if (editing) commit('none');
            setSel(s);
          }}
          editing={editing && !editing.fromFormulaBar ? editing : null}
          onEditChange={(value) => setEditing({ value })}
          onEditCommit={commit}
          onEditCancel={() => {
            setEditing(null);
            gridRef.current?.focus();
          }}
          onKeyDown={onKeyDown}
          onStartEdit={() => canEdit && setEditing({ value: activeCell?.input ?? '' })}
          onVisibleRange={onVisibleRange}
          onResizeCol={(c, w) => canEdit && updateSheet({ colWidths: { [c]: w } })}
          onResizeRow={(r, h) => canEdit && updateSheet({ rowHeights: { [r]: h } })}
          onColumnMenu={(c, e) => openMenu('col', c, e)}
          onRowMenu={(r, e) => openMenu('row', r, e)}
          onCellMenu={(e) => openMenu('cell', 0, e)}
          presence={store.presence}
          selfClientId={store.selfClientId}
          hiddenRows={hiddenRows}
          commentCells={commentCells}
          canFill={canEdit}
          canEdit={canEdit}
          onToggleCheckbox={toggleCheckbox}
          onPickListValue={(r, c, value) => run([{ type: 'setCells', sheetId: sheet.id, cells: [{ row: r, col: c, input: listPickInput(value) }] }])}
          onAutofill={(target, direction) => fill(target, direction, true)}
        />
        {panel === 'versions' && <VersionsPanel id={id} canEdit={canEdit} onClose={() => setPanel(null)} onRestored={() => { store.invalidateAll(); void refreshMeta(); }} />}
        {panel === 'comments' && <SheetComments id={id} sheetId={sheet.id} cell={sel.active} canComment={canComment} onClose={() => setPanel(null)} />}
      </div>

      {/* sheet tabs + status bar */}
      <footer className="flex h-10 items-center gap-1 border-t border-border bg-[#f9fbfd] px-2">
        {canEdit && (
          <Tooltip content="Add sheet">
            <Button variant="subtle" size="icon-sm" onClick={() => sheetMutation.mutate(() => sheetsService.addSheet(id))} aria-label="Add sheet">
              <Plus />
            </Button>
          </Tooltip>
        )}
        <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto" role="tablist" aria-label="Sheets">
          {sheets.map((s, i) => (
            <SheetTab
              key={s.id}
              sheet={s}
              active={s.id === sheet.id}
              canEdit={canEdit}
              onSelect={() => setSheetId(s.id)}
              onRename={(name) => sheetMutation.mutate(() => sheetsService.updateSheet(id, s.id, { name }))}
              onDelete={() => setConfirmDeleteSheet(s)}
              onMove={(dir) => sheetMutation.mutate(() => sheetsService.updateSheet(id, s.id, { position: Math.max(0, i + dir) }))}
            />
          ))}
        </div>
        <div className="hidden items-center gap-4 pr-2 text-xs text-muted sm:flex" aria-live="polite">
          {stats.count > 0 && (range.startRow !== range.endRow || range.startCol !== range.endCol) ? (
            <>
              <span>Sum: {Number(stats.sum.toPrecision(12)).toLocaleString()}</span>
              <span>Average: {Number(stats.avg.toPrecision(10)).toLocaleString()}</span>
              <span>Count: {stats.nonEmpty}</span>
            </>
          ) : (
            <span>{filter ? `Filtered: showing rows matching column ${colToLetters(filter.col)}` : 'Ready'}</span>
          )}
        </div>
      </footer>

      {menu && (
        <DropdownMenu open onOpenChange={(o) => !o && setMenu(null)}>
          <DropdownMenuTrigger asChild>
            <span className="fixed size-0" style={{ left: menu.x, top: menu.y }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {menu.kind !== 'row' && canEdit && (
              <>
                <DropdownMenuItem onSelect={() => run([{ type: 'insertCols', sheetId: sheet.id, index: menu.kind === 'col' ? menu.index : range.startCol, count: 1 }])}>Insert column left</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run([{ type: 'insertCols', sheetId: sheet.id, index: (menu.kind === 'col' ? menu.index : range.endCol) + 1, count: 1 }])}>Insert column right</DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => run([{ type: 'deleteCols', sheetId: sheet.id, index: menu.kind === 'col' ? Math.min(menu.index, range.startCol) : range.startCol, count: menu.kind === 'col' && !(menu.index >= range.startCol && menu.index <= range.endCol) ? 1 : range.endCol - range.startCol + 1 }])}>
                  Delete column{range.endCol > range.startCol ? 's' : ''}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {menu.kind !== 'col' && canEdit && (
              <>
                <DropdownMenuItem onSelect={() => run([{ type: 'insertRows', sheetId: sheet.id, index: menu.kind === 'row' ? menu.index : range.startRow, count: 1 }])}>Insert row above</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run([{ type: 'insertRows', sheetId: sheet.id, index: (menu.kind === 'row' ? menu.index : range.endRow) + 1, count: 1 }])}>Insert row below</DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => run([{ type: 'deleteRows', sheetId: sheet.id, index: menu.kind === 'row' ? Math.min(menu.index, range.startRow) : range.startRow, count: menu.kind === 'row' && !(menu.index >= range.startRow && menu.index <= range.endRow) ? 1 : range.endRow - range.startRow + 1 }])}>
                  Delete row{range.endRow > range.startRow ? 's' : ''}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {menu.kind === 'col' && (
              <>
                {canEdit && <DropdownMenuItem onSelect={() => run([{ type: 'sortRange', sheetId: sheet.id, range: dataRange(), col: menu.index, direction: 'asc', hasHeader: sheet.frozenRows > 0 }])}>Sort sheet A → Z</DropdownMenuItem>}
                {canEdit && <DropdownMenuItem onSelect={() => run([{ type: 'sortRange', sheetId: sheet.id, range: dataRange(), col: menu.index, direction: 'desc', hasHeader: sheet.frozenRows > 0 }])}>Sort sheet Z → A</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => setFilterDialog(menu.index)}>Filter by this column…</DropdownMenuItem>
                {canEdit && <DropdownMenuItem onSelect={() => updateSheet({ frozenCols: menu.index + 1 })}>Freeze up to column {colToLetters(menu.index)}</DropdownMenuItem>}
              </>
            )}
            {menu.kind === 'row' && canEdit && <DropdownMenuItem onSelect={() => updateSheet({ frozenRows: menu.index + 1 })}>Freeze up to row {menu.index + 1}</DropdownMenuItem>}
            {menu.kind === 'cell' && (
              <>
                <DropdownMenuItem onSelect={() => void copy()} shortcut="Ctrl+C">Copy</DropdownMenuItem>
                {canEdit && <DropdownMenuItem onSelect={() => void copy(true)} shortcut="Ctrl+X">Cut</DropdownMenuItem>}
                {canEdit && <DropdownMenuItem onSelect={() => void paste()} shortcut="Ctrl+V">Paste</DropdownMenuItem>}
                {canEdit && <DropdownMenuItem onSelect={() => run([{ type: 'clearRange', sheetId: sheet.id, range, formats: true }])}>Clear values and formatting</DropdownMenuItem>}
                {canComment && <DropdownMenuItem onSelect={() => setPanel('comments')}>Comment</DropdownMenuItem>}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <FilterDialog
        col={filterDialog}
        headerRow={sheet.frozenRows > 0 ? sheet.frozenRows - 1 : 0}
        onClose={() => setFilterDialog(null)}
        onApply={(q) => {
          void applyFilter(q);
          setFilterDialog(null);
        }}
      />
      <ConfirmDialog
        open={!!confirmDeleteSheet}
        onOpenChange={(o) => !o && setConfirmDeleteSheet(null)}
        title={`Delete "${confirmDeleteSheet?.name}"?`}
        description="The sheet and its data will be deleted. Formulas that reference it will show #REF!. You can restore it from version history."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          const s = confirmDeleteSheet!;
          setConfirmDeleteSheet(null);
          if (s.id === sheet.id) setSheetId(sheets.find((x) => x.id !== s.id)!.id);
          sheetMutation.mutate(() => sheetsService.deleteSheet(id, s.id));
        }}
      />
      <ImportDialog
        open={importOpen}
        spreadsheetId={id}
        currentSheet={{ id: sheet.id, name: sheet.name }}
        onOpenChange={setImportOpen}
        onImported={(sheetId) => {
          // An import is structural (like inserting rows): local undo history no longer applies.
          undoStack.current = [];
          redoStack.current = [];
          store.invalidate(sheetId);
          setSheetId(sheetId);
          void refreshMeta();
        }}
      />
      <ValidationDialog
        open={validationOpen}
        rangeLabel={rangeA1(range)}
        current={activeCell?.style?.validation ?? null}
        onOpenChange={setValidationOpen}
        onSave={(validation) => {
          run([{ type: 'setStyle', sheetId: sheet.id, range, style: { validation } }]);
          setValidationOpen(false);
        }}
      />
      <ShareDialog target={shareOpen ? { kind: 'file', id: meta.data.fileId, name: meta.data.title } : null} onOpenChange={setShareOpen} />
      <MoveDialog items={moveOpen ? [{ kind: 'file', id: meta.data.fileId, name: meta.data.title }] : null} onOpenChange={setMoveOpen} />
    </div>
  );
}

function NameBox({ value, onJump, onCancel }: { value: string; onJump(row: number, col: number): void; onCancel(): void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      aria-label="Name box (go to cell)"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const ref = parseA1(draft.split(':')[0]!);
          if (ref) onJump(ref.row, ref.col);
          else setDraft(value);
        } else if (e.key === 'Escape') {
          setDraft(value);
          onCancel();
        }
      }}
      className="h-full w-24 border-r border-border px-2 text-center text-[13px] outline-none focus:bg-primary-soft/30"
    />
  );
}

function SheetTab({ sheet, active, canEdit, onSelect, onRename, onDelete, onMove }: { sheet: WorksheetDto; active: boolean; canEdit: boolean; onSelect(): void; onRename(n: string): void; onDelete(): void; onMove(dir: -1 | 1): void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sheet.name);
  useEffect(() => setName(sheet.name), [sheet.name]);
  if (editing)
    return (
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (name.trim() && name.trim() !== sheet.name) onRename(name.trim());
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-8 w-32 rounded border border-primary px-2 text-sm"
        aria-label="Sheet name"
      />
    );
  return (
    <DropdownMenu>
      <div className={cn('flex h-8 items-center rounded-t-md', active ? 'bg-[#e1e9f7] font-medium text-primary' : 'hover:bg-hover')}>
        <button role="tab" aria-selected={active} onClick={onSelect} onDoubleClick={() => canEdit && setEditing(true)} className="h-full whitespace-nowrap px-3 text-sm">
          {sheet.name}
        </button>
        {canEdit && active && (
          <DropdownMenuTrigger asChild>
            <button className="h-full px-1 text-muted" aria-label={`Sheet ${sheet.name} options`}>
              ▾
            </button>
          </DropdownMenuTrigger>
        )}
      </div>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem onSelect={() => setEditing(true)}>Rename</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onMove(-1)}>Move left</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onMove(1)}>Move right</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterDialog({ col, headerRow, onClose, onApply }: { col: number | null; headerRow: number; onClose(): void; onApply(q: FilterQuery): void }) {
  const [op, setOp] = useState<FilterQuery['op']>('contains');
  const [value, setValue] = useState('');
  return (
    <Dialog open={col !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Filter column ${col !== null ? colToLetters(col) : ''}`} description={`Rows below row ${headerRow + 1} are filtered on the server using computed values.`} className="max-w-md">
        <div className="flex gap-2">
          <NativeSelect value={op} onChange={(e) => setOp(e.target.value as FilterQuery['op'])} aria-label="Condition">
            <option value="contains">Text contains</option>
            <option value="equals">Is equal to</option>
            <option value="not_equals">Is not equal to</option>
            <option value="gt">Greater than</option>
            <option value="gte">Greater than or equal</option>
            <option value="lt">Less than</option>
            <option value="lte">Less than or equal</option>
            <option value="empty">Is empty</option>
            <option value="not_empty">Is not empty</option>
          </NativeSelect>
          {op !== 'empty' && op !== 'not_empty' && <Input value={value} onChange={(e) => setValue(e.target.value)} aria-label="Value" className="h-9" autoFocus />}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => col !== null && onApply({ col, op, value, headerRow })}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionsPanel({ id, canEdit, onClose, onRestored }: { id: string; canEdit: boolean; onClose(): void; onRestored(): void }) {
  const qc = useQueryClient();
  const versions = useQuery({ queryKey: qk.sheets.versions(id), queryFn: () => sheetsService.versions(id) });
  const [name, setName] = useState('');
  const save = useMutation({ mutationFn: () => sheetsService.createVersion(id, name || undefined), onSuccess: (list) => { qc.setQueryData(qk.sheets.versions(id), list); setName(''); } });
  const restore = useMutation({
    mutationFn: (versionId: string) => sheetsService.restoreVersion(id, versionId),
    onSuccess: () => {
      toast.success('Version restored for everyone');
      onRestored();
      void qc.invalidateQueries({ queryKey: qk.sheets.versions(id) });
    },
  });
  return (
    <aside className="flex w-80 flex-col border-l border-border bg-background" aria-label="Version history">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="font-medium">Version history</h2>
        <Button variant="subtle" size="icon-sm" onClick={onClose} aria-label="Close">
          ✕
        </Button>
      </header>
      {canEdit && (
        <form className="flex gap-2 px-3 pb-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name current version" className="h-9" />
          <Button size="sm" type="submit" loading={save.isPending}>
            Save
          </Button>
        </form>
      )}
      <ul className="min-h-0 flex-1 overflow-y-auto border-t border-border">
        {versions.data?.map((v) => (
          <li key={v.id} className="border-b border-border px-4 py-3 text-sm">
            <p className="font-medium">{formatDate(v.createdAt, true)}</p>
            {v.name && <p>{v.name}</p>}
            <p className="text-xs text-muted">
              {v.createdBy?.name ?? 'Unknown'} · {v.cellCount} cells
            </p>
            {canEdit && (
              <Button variant="subtle" size="sm" className="mt-1" onClick={() => restore.mutate(v.id)} loading={restore.isPending && restore.variables === v.id}>
                Restore
              </Button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function SheetComments({ id, sheetId, cell, canComment, onClose }: { id: string; sheetId: string; cell: { row: number; col: number }; canComment: boolean; onClose(): void }) {
  const qc = useQueryClient();
  const key = qk.sheets.comments(id, sheetId);
  const comments = useQuery({ queryKey: key, queryFn: () => sheetsService.comments(id, sheetId) });
  const [body, setBody] = useState('');
  const add = useMutation({ mutationFn: (parentId?: string) => sheetsService.addComment(id, sheetId, { row: cell.row, col: cell.col, body, parentId }), onSuccess: (list) => { qc.setQueryData(key, list); setBody(''); } });
  const resolve = useMutation({ mutationFn: ({ cid, r }: { cid: string; r: boolean }) => sheetsService.resolveComment(id, cid, r), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const remove = useMutation({ mutationFn: (cid: string) => sheetsService.deleteComment(id, cid), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const threads = (comments.data ?? []).filter((c) => !c.parentId);
  const here = threads.filter((c) => c.row === cell.row && c.col === cell.col);
  const others = threads.filter((c) => !(c.row === cell.row && c.col === cell.col));
  const replies = (pid: string) => (comments.data ?? []).filter((c) => c.parentId === pid);
  const Item = ({ c }: { c: (typeof threads)[number] }) => (
    <li className={cn('rounded-lg border border-border p-3 text-sm', c.resolved && 'opacity-60')}>
      <div className="flex items-center gap-2">
        <Avatar user={c.author} size={24} />
        <span className="font-medium">{c.author.name}</span>
        <span className="ml-auto text-xs text-muted">{cellA1(c.row, c.col)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
      {replies(c.id).map((r) => (
        <p key={r.id} className="mt-2 border-l-2 border-border pl-2 text-xs">
          <b>{r.author.name}:</b> {r.body}
        </p>
      ))}
      <p className="mt-1 flex gap-3 text-xs text-muted">
        {formatRelative(c.createdAt)}
        {canComment && <button className="text-primary" onClick={() => resolve.mutate({ cid: c.id, r: !c.resolved })}>{c.resolved ? 'Reopen' : 'Resolve'}</button>}
        {canComment && <button className="text-danger" onClick={() => remove.mutate(c.id)}>Delete</button>}
      </p>
    </li>
  );
  return (
    <aside className="flex w-80 flex-col border-l border-border bg-background" aria-label="Comments">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="font-medium">Comments · {cellA1(cell.row, cell.col)}</h2>
        <Button variant="subtle" size="icon-sm" onClick={onClose} aria-label="Close">
          ✕
        </Button>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {canComment && (
          <div className="space-y-2">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Comment on ${cellA1(cell.row, cell.col)}`} aria-label="New comment" />
            <Button size="sm" disabled={!body.trim()} loading={add.isPending} onClick={() => add.mutate(here[0]?.id)}>
              {here.length ? 'Reply' : 'Comment'}
            </Button>
          </div>
        )}
        <ul className="space-y-2">{here.map((c) => <Item key={c.id} c={c} />)}</ul>
        {others.length > 0 && <h3 className="pt-2 text-xs font-medium uppercase text-muted">Other cells</h3>}
        <ul className="space-y-2">{others.map((c) => <Item key={c.id} c={c} />)}</ul>
      </div>
    </aside>
  );
}
