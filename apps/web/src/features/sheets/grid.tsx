import type { Border, CellDto, CellRange, SheetPresenceState, WorksheetDto } from '@qub/shared';
import { colToLetters } from '@qub/shared/formula';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type WheelEvent } from 'react';
import { cn } from '@/lib/utils';
import { borderWidth, effectiveEdge } from './borders';
import { validationIssue } from './validation';
import { buildGeometry, COL_HEADER_HEIGHT, indexAt, ROW_HEADER_WIDTH, type Geometry } from './geometry';
import { CELL_PADDING_X, measureText, spillSpan } from './spill';

export interface Selection {
  active: { row: number; col: number };
  anchor: { row: number; col: number };
  focus: { row: number; col: number };
}

export type FillDirection = 'down' | 'up' | 'left' | 'right';

export interface GridHandle {
  scrollIntoView(row: number, col: number): void;
  focus(): void;
  /** Opens the dropdown of the active cell when it has list validation (Alt+↓). */
  openList(): void;
}

interface GridProps {
  sheet: WorksheetDto;
  getCell(row: number, col: number): CellDto | undefined;
  version: number;
  selection: Selection;
  range: CellRange;
  onSelect(sel: Selection): void;
  editing: { value: string } | null;
  onEditChange(value: string): void;
  onEditCommit(move: 'down' | 'right' | 'up' | 'left' | 'none'): void;
  onEditCancel(): void;
  onKeyDown(e: KeyboardEvent): void;
  onStartEdit(initial?: string): void;
  onVisibleRange(r0: number, r1: number, c0: number, c1: number): void;
  onResizeCol(col: number, width: number): void;
  onResizeRow(row: number, height: number): void;
  onColumnMenu(col: number, e: MouseEvent): void;
  onRowMenu(row: number, e: MouseEvent): void;
  onCellMenu(e: MouseEvent): void;
  presence: SheetPresenceState[];
  selfClientId: string | null;
  hiddenRows: Set<number>;
  commentCells: Set<string>;
  /** Editors get the autofill handle on the selection's bottom-right corner. */
  canFill: boolean;
  /** Editors can toggle checkboxes and pick from validation lists. */
  canEdit: boolean;
  onToggleCheckbox(row: number, col: number): void;
  onPickListValue(row: number, col: number, value: string): void;
  onAutofill(target: CellRange, direction: FillDirection): void;
}

function styleFor(cell: CellDto | undefined): CSSProperties {
  const s = cell?.style;
  const numeric = cell?.dataType === 'NUMBER';
  return {
    fontWeight: s?.bold ? 600 : undefined,
    fontStyle: s?.italic ? 'italic' : undefined,
    textDecoration: [s?.underline && 'underline', s?.strike && 'line-through'].filter(Boolean).join(' ') || undefined,
    color: cell?.dataType === 'ERROR' ? '#d93025' : s?.color,
    background: s?.background,
    textAlign: s?.align ?? (numeric || cell?.dataType === 'BOOLEAN' ? 'right' : 'left'),
    fontSize: s?.fontSize ? `${s.fontSize}px` : undefined,
    justifyContent: (s?.align ?? (numeric ? 'right' : 'left')) === 'right' ? 'flex-end' : s?.align === 'center' ? 'center' : 'flex-start',
    whiteSpace: s?.wrap ? 'pre-wrap' : 'nowrap',
    wordBreak: s?.wrap ? 'break-word' : undefined,
    alignItems: s?.wrap ? 'flex-start' : undefined,
  };
}

/** A border line centred on a gridline (horizontal when `across`). */
function edgeStyle(b: Border, x: number, y: number, across: boolean, length: number): CSSProperties {
  const w = borderWidth(b);
  const offset = Math.floor(w / 2);
  return across ? { left: x, top: y - offset, width: length, height: w, background: b.color } : { left: x - offset, top: y, width: w, height: length, background: b.color };
}

/**
 * Virtualized spreadsheet grid. Only the visible window of rows/columns is rendered (plus a small overscan), in four
 * panes so frozen rows/columns stay in place while the main pane scrolls natively.
 */
export const Grid = forwardRef<GridHandle, GridProps>(function Grid(props, ref) {
  const { sheet, selection, range, editing, presence, selfClientId, hiddenRows } = props;
  const mainRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLInputElement>(null);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [resizing, setResizing] = useState<{ col?: [number, number]; row?: [number, number] }>({});
  const dragging = useRef(false);

  const geo: Geometry = useMemo(() => buildGeometry(sheet, hiddenRows, resizing), [sheet, hiddenRows, resizing]);
  const frozenRows = Math.min(sheet.frozenRows, sheet.rowCount);
  const frozenCols = Math.min(sheet.frozenCols, sheet.colCount);
  const frozenW = geo.colX[frozenCols]!;
  const frozenH = geo.rowY[frozenRows]!;

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Visible window of the main pane (in sheet coordinates).
  const viewW = Math.max(0, size.width - ROW_HEADER_WIDTH - frozenW);
  const viewH = Math.max(0, size.height - COL_HEADER_HEIGHT - frozenH);
  const r0 = Math.max(frozenRows, indexAt(geo.rowY, frozenH + scroll.top) - 3);
  const r1 = Math.min(geo.rowCount - 1, indexAt(geo.rowY, frozenH + scroll.top + viewH) + 3);
  const c0 = Math.max(frozenCols, indexAt(geo.colX, frozenW + scroll.left) - 1);
  const c1 = Math.min(geo.colCount - 1, indexAt(geo.colX, frozenW + scroll.left + viewW) + 1);

  const { onVisibleRange } = props;
  useEffect(() => {
    onVisibleRange(0, Math.max(r1, frozenRows), 0, Math.max(c1, frozenCols));
    onVisibleRange(r0, r1, c0, c1);
  }, [r0, r1, c0, c1, frozenRows, frozenCols, onVisibleRange]);

  const scrollIntoView = useCallback(
    (row: number, col: number) => {
      const el = mainRef.current;
      if (!el) return;
      if (row >= frozenRows) {
        const top = geo.rowY[row]! - frozenH;
        const bottom = geo.rowY[row + 1]! - frozenH;
        if (top < el.scrollTop) el.scrollTop = top;
        else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
      }
      if (col >= frozenCols) {
        const left = geo.colX[col]! - frozenW;
        const right = geo.colX[col + 1]! - frozenW;
        if (left < el.scrollLeft) el.scrollLeft = left;
        else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
      }
    },
    [geo, frozenRows, frozenCols, frozenH, frozenW],
  );

  const [openList, setOpenList] = useState<{ row: number; col: number } | null>(null);
  const openListFor = (row: number, col: number) => {
    if (props.getCell(row, col)?.style?.validation?.kind === 'list' && props.canEdit) setOpenList({ row, col });
  };
  useEffect(() => {
    if (!openList) return;
    const close = () => setOpenList(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [openList]);
  useImperativeHandle(
    ref,
    () => ({
      scrollIntoView,
      // The open cell editor takes focus (caret at the end), otherwise the grid does.
      focus: () => {
        const ed = editorRef.current;
        if (!ed) return rootRef.current?.focus();
        ed.focus();
        ed.setSelectionRange(ed.value.length, ed.value.length);
      },
      openList: () => openListFor(selection.active.row, selection.active.col),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrollIntoView, selection.active.row, selection.active.col, props.canEdit, props.getCell],
  );

  const rowsIn = (a: number, b: number) => {
    const out: number[] = [];
    for (let r = a; r <= b; r++) if (!hiddenRows.has(r)) out.push(r);
    return out;
  };
  const colsIn = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

  const cellFromEvent = (e: MouseEvent): { row: number; col: number } | null => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cell]');
    if (!el) return null;
    const [row, col] = el.dataset.cell!.split(':').map(Number);
    return { row: row!, col: col! };
  };

  const onMouseDown = (e: MouseEvent) => {
    const cell = cellFromEvent(e);
    if (!cell) return;
    if (e.button === 2 && inRange(cell, range)) return; // keep range for context menu
    if (editing) props.onEditCommit('none');
    rootRef.current?.focus();
    const anchor = e.shiftKey ? selection.anchor : cell;
    props.onSelect({ active: e.shiftKey ? selection.active : cell, anchor, focus: cell });
    dragging.current = e.button === 0;
  };
  // Autofill drag: the preview holds only the new cells, extended along the axis the pointer moved furthest on.
  const filling = useRef(false);
  const [fillPreview, setFillPreview] = useState<{ target: CellRange; direction: FillDirection } | null>(null);
  const fillPreviewRef = useRef(fillPreview);
  fillPreviewRef.current = fillPreview;
  const onAutofillRef = useRef(props.onAutofill);
  onAutofillRef.current = props.onAutofill;

  const onMouseMove = (e: MouseEvent) => {
    const cell = cellFromEvent(e);
    if (filling.current) {
      if (!cell) return;
      const reach = { down: cell.row - range.endRow, up: range.startRow - cell.row, right: cell.col - range.endCol, left: range.startCol - cell.col };
      const [direction, distance] = (Object.entries(reach) as [FillDirection, number][]).sort((a, b) => b[1] - a[1])[0]!;
      if (distance <= 0) return setFillPreview(null);
      const target: CellRange =
        direction === 'down'
          ? { ...range, startRow: range.endRow + 1, endRow: cell.row }
          : direction === 'up'
            ? { ...range, startRow: cell.row, endRow: range.startRow - 1 }
            : direction === 'right'
              ? { ...range, startCol: range.endCol + 1, endCol: cell.col }
              : { ...range, startCol: cell.col, endCol: range.startCol - 1 };
      setFillPreview({ target, direction });
      return;
    }
    if (!dragging.current) return;
    if (cell && (cell.row !== selection.focus.row || cell.col !== selection.focus.col)) props.onSelect({ ...selection, focus: cell });
  };
  useEffect(() => {
    const up = () => {
      dragging.current = false;
      if (!filling.current) return;
      filling.current = false;
      const preview = fillPreviewRef.current;
      setFillPreview(null);
      if (preview) onAutofillRef.current(preview.target, preview.direction);
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  /**
   * Borders are drawn as separate lines over the cells (cells clip their content). Each cell draws its right and
   * bottom edges, taking the heavier of its own and its neighbour's definition; the first row/column of a pane also
   * draws its top/left edges, since the neighbour that would draw them may be outside the pane.
   */
  const renderBorders = (rows: number[], cols: number[], originX: number, originY: number): ReactNode[] => {
    const out: ReactNode[] = [];
    const edges = (r: number, c: number) => props.getCell(r, c)?.style?.borders;
    for (const r of rows)
      for (const c of cols) {
        const w = geo.colW(c);
        const h = geo.rowH(r);
        if (!w || !h) continue;
        const x = geo.colX[c]! - originX;
        const y = geo.rowY[r]! - originY;
        const own = edges(r, c);
        const right = effectiveEdge(own?.right, edges(r, c + 1)?.left);
        const bottom = effectiveEdge(own?.bottom, edges(r + 1, c)?.top);
        if (right) out.push(<div key={`br-${r}:${c}`} className="pointer-events-none absolute z-[5]" style={edgeStyle(right, x + w, y, false, h)} />);
        if (bottom) out.push(<div key={`bb-${r}:${c}`} className="pointer-events-none absolute z-[5]" style={edgeStyle(bottom, x, y + h, true, w)} />);
        if (r === rows[0]) {
          const top = effectiveEdge(edges(r - 1, c)?.bottom, own?.top);
          if (top) out.push(<div key={`bt-${r}:${c}`} className="pointer-events-none absolute z-[5]" style={edgeStyle(top, x, y, true, w)} />);
        }
        if (c === cols[0]) {
          const left = effectiveEdge(edges(r, c - 1)?.right, own?.left);
          if (left) out.push(<div key={`bl-${r}:${c}`} className="pointer-events-none absolute z-[5]" style={edgeStyle(left, x, y, false, h)} />);
        }
      }
    return out;
  };

  /** Cell body: text, or a checkbox / dropdown affordance for validated cells, plus the invalid-value marker. */
  const renderContent = (cell: CellDto | undefined, r: number, c: number): ReactNode => {
    const v = cell?.style?.validation;
    const issue = validationIssue(cell);
    const marker = issue && (
      <span className="absolute right-0 top-0 border-l-[6px] border-t-[6px] border-l-transparent border-t-[#d93025]" title={issue} aria-label={issue} role="img" />
    );
    if (v?.kind === 'checkbox' && !issue) {
      return (
        <span className="flex h-full w-full items-center justify-center">
          <input
            type="checkbox"
            className="size-3.5 cursor-pointer accent-[#1a73e8]"
            checked={cell?.value === true}
            readOnly
            aria-label={`Checkbox ${colToLetters(c)}${r + 1}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              if (props.canEdit) props.onToggleCheckbox(r, c);
            }}
          />
        </span>
      );
    }
    return (
      <>
        {cell?.formattedValue}
        {v?.kind === 'list' && props.canEdit && (
          <button
            type="button"
            aria-label={`Open list ${colToLetters(c)}${r + 1}`}
            className="absolute bottom-0 right-0 top-0 flex w-4 items-center justify-center text-[10px] text-muted hover:bg-black/5"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const at = { row: r, col: c };
              props.onSelect({ active: at, anchor: at, focus: at });
              setOpenList(openList && openList.row === r && openList.col === c ? null : at);
            }}
          >
            ▾
          </button>
        )}
        {marker}
      </>
    );
  };

  /**
   * Content wider than its (unwrapped) cell: text is drawn across empty neighbours, a number that can't fit shows
   * ### (as in Google Sheets). Returns the span and what to draw there, or null when the content fits.
   */
  const overflowOf = (cell: CellDto | undefined, r: number, c: number, minCol: number, maxCol: number) => {
    const s = cell?.style;
    const text = cell?.formattedValue;
    if (!cell || !text || s?.wrap || s?.validation) return null;
    const need = measureText(text, s?.fontSize ?? 13, !!s?.bold) + CELL_PADDING_X + 1;
    if (need <= geo.colW(c)) return null;
    const numeric = cell.dataType === 'NUMBER';
    const align = s?.align ?? (numeric || cell.dataType === 'BOOLEAN' ? 'right' : 'left');
    const span = spillSpan({ col: c, need, align, colW: geo.colW, isEmpty: (k) => isBlank(r, k), minCol, maxCol });
    if (numeric && !span.fits) {
      // A partly shown number reads as a different number: hashes in its own cell instead.
      const hash = measureText('#', s?.fontSize ?? 13, !!s?.bold) || 8;
      return { from: c, to: c, text: '#'.repeat(Math.max(1, Math.floor((geo.colW(c) - CELL_PADDING_X) / hash))) };
    }
    return span.from === span.to ? null : { ...span, text };
  };
  const isBlank = (r: number, c: number) => {
    const n = props.getCell(r, c);
    return !n || (!n.formattedValue && !n.style?.background && !n.style?.validation);
  };

  const renderCells = (rows: number[], cols: number[], originX: number, originY: number): ReactNode => {
    const [minCol, maxCol] = cols.length && cols[0]! < frozenCols ? [0, frozenCols - 1] : [frozenCols, geo.colCount - 1];
    const spills: ReactNode[] = [];
    const cells = rows.map((r) => {
      const h = geo.rowH(r);
      // Gridlines under spilled text are hidden: the right edge of every cell in a span but the last.
      const hideRight = new Set<number>();
      const overflowing = new Set<number>();
      for (const c of cols) {
        const cell = props.getCell(r, c);
        const o = h ? overflowOf(cell, r, c, minCol, maxCol) : null;
        if (!o) continue;
        overflowing.add(c);
        for (let k = o.from; k < o.to; k++) hideRight.add(k);
        spills.push(
          <div
            key={`spill-${r}:${c}`}
            aria-hidden
            className="pointer-events-none absolute z-[4] flex items-end overflow-hidden whitespace-nowrap px-[3px] pb-[2px] text-[13px] leading-[16px]"
            style={{ ...styleFor(cell), background: undefined, left: geo.colX[o.from]! - originX, top: geo.rowY[r]! - originY, width: geo.colX[o.to + 1]! - geo.colX[o.from]!, height: h }}
          >
            {o.text}
          </div>,
        );
      }
      return cols.map((c) => {
        const cell = props.getCell(r, c);
        return (
          <div
            key={`${r}:${c}`}
            data-cell={`${r}:${c}`}
            role="gridcell"
            aria-rowindex={r + 1}
            aria-colindex={c + 1}
            aria-selected={inRange({ row: r, col: c }, range)}
            className="absolute flex items-end overflow-hidden border-b border-r border-[#e2e3e3] px-[3px] pb-[2px] text-[13px] leading-[16px]"
            style={{
              left: geo.colX[c]! - originX,
              top: geo.rowY[r]! - originY,
              width: geo.colW(c),
              height: h,
              ...styleFor(cell),
              // The overlay draws overflowing content; the cell keeps its text (for assistive tech) but invisibly.
              ...(overflowing.has(c) ? { color: 'transparent' } : null),
              ...(hideRight.has(c) ? { borderRightColor: 'transparent' } : null),
            }}
          >
            {renderContent(cell, r, c)}
            {props.commentCells.has(`${r}:${c}`) && <span className="absolute right-0 top-0 border-l-[6px] border-t-[6px] border-l-transparent border-t-[#f9ab00]" aria-label="Has comments" />}
          </div>
        );
      });
    });
    return [cells, spills, renderBorders(rows, cols, originX, originY)];
  };

  const rect = (rg: CellRange, originX: number, originY: number) => ({
    left: geo.colX[rg.startCol]! - originX,
    top: geo.rowY[rg.startRow]! - originY,
    width: geo.colX[rg.endCol + 1]! - geo.colX[rg.startCol]!,
    height: geo.rowY[rg.endRow + 1]! - geo.rowY[rg.startRow]!,
  });

  const overlays = (originX: number, originY: number, pane: string) => {
    const out: ReactNode[] = [];
    for (const p of presence) {
      if (!p.selection || p.user.clientId === selfClientId || p.selection.sheetId !== sheet.id) continue;
      const a = { startRow: p.selection.activeRow, endRow: p.selection.activeRow, startCol: p.selection.activeCol, endCol: p.selection.activeCol };
      if (a.endRow >= geo.rowCount || a.endCol >= geo.colCount) continue;
      out.push(
        <div key={`p-${p.user.clientId}`} className="pointer-events-none absolute z-10 border-2" style={{ ...rect(a, originX, originY), borderColor: p.user.color }}>
          <span className="absolute -top-4 left-[-2px] whitespace-nowrap rounded-t px-1 text-[10px] font-semibold text-white" style={{ background: p.user.color }}>
            {p.user.name}
          </span>
        </div>,
      );
    }
    const multi = range.startRow !== range.endRow || range.startCol !== range.endCol;
    if (multi) out.push(<div key="range" className="pointer-events-none absolute z-10 border border-primary bg-primary/10" style={rect(range, originX, originY)} />);
    const act = { startRow: selection.active.row, endRow: selection.active.row, startCol: selection.active.col, endCol: selection.active.col };
    out.push(<div key="active" className="pointer-events-none absolute z-20 border-2 border-primary" style={rect(act, originX, originY)} />);
    if (openList) {
      const listPane = (openList.row < frozenRows ? 'top' : 'bottom') + (openList.col < frozenCols ? '-left' : '-right');
      const values = props.getCell(openList.row, openList.col)?.style?.validation;
      if (pane === listPane && values?.kind === 'list') {
        const r = rect({ startRow: openList.row, endRow: openList.row, startCol: openList.col, endCol: openList.col }, originX, originY);
        const current = props.getCell(openList.row, openList.col)?.formattedValue;
        out.push(
          <div
            key="list"
            role="listbox"
            aria-label="List options"
            className="absolute z-40 max-h-60 min-w-[140px] overflow-auto rounded-md border border-border bg-background py-1 text-[13px] shadow-pop"
            style={{ left: r.left, top: r.top + r.height, width: Math.max(r.width, 140) }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && setOpenList(null)}
          >
            {values.values.map((item) => (
              <button
                key={item}
                type="button"
                role="option"
                aria-selected={item === current}
                className={cn('block w-full truncate px-3 py-1 text-left hover:bg-black/5', item === current && 'font-medium')}
                onClick={() => {
                  props.onPickListValue(openList.row, openList.col, item);
                  setOpenList(null);
                  rootRef.current?.focus();
                }}
              >
                {item}
              </button>
            ))}
          </div>,
        );
      }
    }
    if (fillPreview) out.push(<div key="fill-preview" className="pointer-events-none absolute z-20 border-2 border-dashed border-primary" style={rect(fillPreview.target, originX, originY)} />);
    const cornerPane = (range.endRow < frozenRows ? 'top' : 'bottom') + (range.endCol < frozenCols ? '-left' : '-right');
    if (props.canFill && !editing && pane === cornerPane) {
      const r = rect(range, originX, originY);
      out.push(
        <div
          key="fill-handle"
          data-testid="autofill-handle"
          aria-label="Autofill handle"
          className="absolute z-30 size-[7px] cursor-crosshair border border-white bg-primary"
          style={{ left: r.left + r.width - 4, top: r.top + r.height - 4 }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            filling.current = true;
          }}
        />,
      );
    }
    const activePane = (selection.active.row < frozenRows ? 'top' : 'bottom') + (selection.active.col < frozenCols ? '-left' : '-right');
    if (editing && pane === activePane) {
      const r = rect(act, originX, originY);
      out.push(
        <input
          key="editor"
          ref={editorRef}
          autoFocus
          value={editing.value}
          onChange={(e) => props.onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              props.onEditCommit(e.shiftKey ? 'up' : 'down');
            } else if (e.key === 'Tab') {
              e.preventDefault();
              props.onEditCommit(e.shiftKey ? 'left' : 'right');
            } else if (e.key === 'Escape') {
              e.preventDefault();
              props.onEditCancel();
            }
            e.stopPropagation();
          }}
          aria-label={`Edit cell ${colToLetters(selection.active.col)}${selection.active.row + 1}`}
          className="absolute z-30 border-2 border-primary bg-white px-[3px] text-[13px] shadow-pop outline-none"
          style={{ left: r.left, top: r.top, minWidth: r.width, height: Math.max(r.height, 23) }}
        />,
      );
    }
    return out;
  };

  const forwardWheel = (e: WheelEvent) => mainRef.current?.scrollBy(e.deltaX, e.deltaY);

  // ---------- headers ----------
  const startColResize = (c: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = geo.colW(c);
    const move = (ev: globalThis.MouseEvent) => setResizing({ col: [c, Math.max(24, startW + ev.clientX - startX)] });
    const up = (ev: globalThis.MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setResizing({});
      props.onResizeCol(c, Math.round(Math.max(24, startW + ev.clientX - startX)));
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const startRowResize = (r: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = geo.rowH(r);
    const move = (ev: globalThis.MouseEvent) => setResizing({ row: [r, Math.max(12, startH + ev.clientY - startY)] });
    const up = (ev: globalThis.MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      setResizing({});
      props.onResizeRow(r, Math.round(Math.max(12, startH + ev.clientY - startY)));
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const selectColumn = (c: number, e: MouseEvent) => {
    const anchor = e.shiftKey ? { row: 0, col: selection.anchor.col } : { row: 0, col: c };
    props.onSelect({ active: { row: 0, col: e.shiftKey ? selection.active.col : c }, anchor, focus: { row: geo.rowCount - 1, col: c } });
  };
  const selectRow = (r: number, e: MouseEvent) => {
    const anchor = e.shiftKey ? { row: selection.anchor.row, col: 0 } : { row: r, col: 0 };
    props.onSelect({ active: { row: e.shiftKey ? selection.active.row : r, col: 0 }, anchor, focus: { row: r, col: geo.colCount - 1 } });
  };

  const colHeader = (c: number, originX: number) => {
    const active = c >= range.startCol && c <= range.endCol;
    return (
      <div
        key={c}
        role="columnheader"
        className={cn('absolute top-0 flex h-full select-none items-center justify-center border-b border-r border-[#c4c7c5] text-[11px] text-[#444746]', active ? 'bg-[#d3e3fd] font-semibold' : 'bg-[#f8f9fa]')}
        style={{ left: geo.colX[c]! - originX, width: geo.colW(c) }}
        onMouseDown={(e) => e.button === 0 && selectColumn(c, e)}
        onContextMenu={(e) => props.onColumnMenu(c, e)}
      >
        {colToLetters(c)}
        <span className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize" onMouseDown={(e) => startColResize(c, e)} aria-hidden />
      </div>
    );
  };
  const rowHeader = (r: number, originY: number) => {
    const active = r >= range.startRow && r <= range.endRow;
    return (
      <div
        key={r}
        role="rowheader"
        className={cn('absolute left-0 flex w-full select-none items-center justify-center border-b border-r border-[#c4c7c5] text-[11px] text-[#444746]', active ? 'bg-[#d3e3fd] font-semibold' : 'bg-[#f8f9fa]')}
        style={{ top: geo.rowY[r]! - originY, height: geo.rowH(r) }}
        onMouseDown={(e) => e.button === 0 && selectRow(r, e)}
        onContextMenu={(e) => props.onRowMenu(r, e)}
      >
        {r + 1}
        <span className="absolute -bottom-1 left-0 z-10 h-2 w-full cursor-row-resize" onMouseDown={(e) => startRowResize(r, e)} aria-hidden />
      </div>
    );
  };

  const frozenRowList = rowsIn(0, frozenRows - 1);
  const frozenColList = colsIn(0, frozenCols - 1);
  const mainRows = rowsIn(r0, r1);
  const mainCols = colsIn(c0, c1);

  return (
    <div
      ref={rootRef}
      role="grid"
      aria-label={`Sheet ${sheet.name}`}
      aria-rowcount={sheet.rowCount}
      aria-colcount={sheet.colCount}
      tabIndex={0}
      onKeyDown={props.onKeyDown}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onDoubleClick={(e) => cellFromEvent(e) && props.onStartEdit()}
      onContextMenu={(e) => cellFromEvent(e) && props.onCellMenu(e)}
      className="relative min-h-0 flex-1 overflow-hidden bg-white outline-none"
    >
      {/* corner */}
      <div className="absolute left-0 top-0 z-30 border-b border-r border-[#c4c7c5] bg-[#f8f9fa]" style={{ width: ROW_HEADER_WIDTH, height: COL_HEADER_HEIGHT }} />
      {/* column headers */}
      <div className="absolute top-0 z-20 overflow-hidden" style={{ left: ROW_HEADER_WIDTH, right: 0, height: COL_HEADER_HEIGHT }} onWheel={forwardWheel}>
        {frozenColList.map((c) => colHeader(c, 0))}
        <div className="absolute inset-y-0 overflow-hidden" style={{ left: frozenW, right: 0 }}>
          {mainCols.map((c) => colHeader(c, frozenW + scroll.left))}
        </div>
      </div>
      {/* row headers */}
      <div className="absolute left-0 z-20 overflow-hidden" style={{ top: COL_HEADER_HEIGHT, bottom: 0, width: ROW_HEADER_WIDTH }} onWheel={forwardWheel}>
        {frozenRowList.map((r) => rowHeader(r, 0))}
        <div className="absolute inset-x-0 overflow-hidden" style={{ top: frozenH, bottom: 0 }}>
          {mainRows.map((r) => rowHeader(r, frozenH + scroll.top))}
        </div>
      </div>
      {/* frozen corner */}
      {frozenRows > 0 && frozenCols > 0 && (
        <div className="absolute z-10 overflow-hidden border-b-2 border-r-2 border-[#bdc1c6]" style={{ left: ROW_HEADER_WIDTH, top: COL_HEADER_HEIGHT, width: frozenW, height: frozenH }}>
          {renderCells(frozenRowList, frozenColList, 0, 0)}
          {overlays(0, 0, 'top-left')}
        </div>
      )}
      {/* frozen top rows */}
      {frozenRows > 0 && (
        <div className="absolute z-10 overflow-hidden border-b-2 border-[#bdc1c6] bg-white" style={{ left: ROW_HEADER_WIDTH + frozenW, top: COL_HEADER_HEIGHT, right: 0, height: frozenH }} onWheel={forwardWheel}>
          {renderCells(frozenRowList, mainCols, frozenW + scroll.left, 0)}
          {overlays(frozenW + scroll.left, 0, 'top-right')}
        </div>
      )}
      {/* frozen left columns */}
      {frozenCols > 0 && (
        <div className="absolute z-10 overflow-hidden border-r-2 border-[#bdc1c6] bg-white" style={{ left: ROW_HEADER_WIDTH, top: COL_HEADER_HEIGHT + frozenH, width: frozenW, bottom: 0 }} onWheel={forwardWheel}>
          {renderCells(mainRows, frozenColList, 0, frozenH + scroll.top)}
          {overlays(0, frozenH + scroll.top, 'bottom-left')}
        </div>
      )}
      {/* main scrolling pane */}
      <div
        ref={mainRef}
        className="absolute overflow-auto"
        style={{ left: ROW_HEADER_WIDTH + frozenW, top: COL_HEADER_HEIGHT + frozenH, right: 0, bottom: 0 }}
        onScroll={(e) => setScroll({ left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop })}
      >
        <div className="relative" style={{ width: geo.colX[geo.colCount]! - frozenW, height: geo.rowY[geo.rowCount]! - frozenH }}>
          {renderCells(mainRows, mainCols, frozenW, frozenH)}
          {overlays(frozenW, frozenH, 'bottom-right')}
        </div>
      </div>
    </div>
  );
});

export function inRange(cell: { row: number; col: number }, r: CellRange) {
  return cell.row >= r.startRow && cell.row <= r.endRow && cell.col >= r.startCol && cell.col <= r.endCol;
}
