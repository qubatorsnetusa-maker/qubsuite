/** Horizontal padding of a grid cell (px, both sides together). */
export const CELL_PADDING_X = 6;
/** Text never spills across more than this many neighbouring cells. */
const MAX_SPILL_CELLS = 50;

export interface SpillInput {
  col: number;
  /** Width the content needs, padding included. */
  need: number;
  align: 'left' | 'center' | 'right';
  colW: (c: number) => number;
  /** Whether a neighbouring cell is empty (text may be drawn over it). */
  isEmpty: (c: number) => boolean;
  /** Columns the spill may reach (the pane's bounds). */
  minCol: number;
  maxCol: number;
}

export interface Spill {
  /** First and last column the content is drawn across. */
  from: number;
  to: number;
  /** Whether the content fits in that span. */
  fits: boolean;
}

/**
 * Google Sheets overflow: unwrapped content wider than its cell is drawn across empty neighbours — to the right when
 * left-aligned, to the left when right-aligned, both ways when centred — stopping at the first non-empty cell.
 */
export function spillSpan({ col, need, align, colW, isEmpty, minCol, maxCol }: SpillInput): Spill {
  let from = col;
  let to = col;
  let width = colW(col);
  if (width >= need) return { from, to, fits: true };
  const canRight = () => to < maxCol && to - col < MAX_SPILL_CELLS && isEmpty(to + 1);
  const canLeft = () => from > minCol && col - from < MAX_SPILL_CELLS && isEmpty(from - 1);
  if (align === 'center') {
    // Each side needs half the overflow; hidden (zero-width) columns cost nothing.
    const half = (need - width) / 2;
    let right = 0;
    let left = 0;
    while (right < half && canRight()) right += colW(++to);
    while (left < half && canLeft()) left += colW(--from);
    return { from, to, fits: right >= half && left >= half };
  }
  const grow = align === 'left' ? () => canRight() && ((width += colW(++to)), true) : () => canLeft() && ((width += colW(--from)), true);
  while (width < need && grow());
  return { from, to, fits: width >= need };
}

let ctx: CanvasRenderingContext2D | null | undefined;
let fontFamily = '';
const widths = new Map<string, number>();

/** Rendered width (px) of `text` in the grid's cell typography; 0 when measuring isn't possible. */
export function measureText(text: string, fontSize = 13, bold = false): number {
  if (ctx === undefined) {
    ctx = typeof document === 'undefined' ? null : (document.createElement('canvas').getContext('2d') ?? null);
    fontFamily = typeof document === 'undefined' ? 'sans-serif' : getComputedStyle(document.body).fontFamily || 'sans-serif';
  }
  if (!ctx) return 0;
  const key = `${fontSize}|${bold ? 1 : 0}|${text}`;
  let w = widths.get(key);
  if (w === undefined) {
    ctx.font = `${bold ? 600 : 400} ${fontSize}px ${fontFamily}`;
    w = ctx.measureText(text).width;
    if (widths.size > 5000) widths.clear();
    widths.set(key, w);
  }
  return w;
}
