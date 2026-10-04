import type { Border, CellDto, SheetPrintData } from '@qub/shared';
import { DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT } from './geometry';
import { CELL_PADDING_X, spillSpan } from './spill';
import { validationIssue } from './validation';

/** Width (px) of text in the grid's cell font. */
export type MeasureText = (text: string, fontSize: number, bold: boolean) => number;

/** Printable width (px at 96 dpi) of an A4/Letter page with 10 mm margins, portrait and landscape. */
const PORTRAIT_WIDTH = 740;
const LANDSCAPE_WIDTH = 1010;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const WIDTH = { thin: 1, medium: 2, thick: 3 } as const;
const edge = (b: Border | null | undefined) => (b ? `${WIDTH[b.style]}px solid ${b.color}` : null);

/** Whether a cell prints anything (text, fill, borders or a checkbox). */
function hasInk(c: CellDto | undefined): boolean {
  if (!c) return false;
  const s = c.style;
  return !!c.formattedValue || !!s?.background || !!(s?.borders && Object.values(s.borders).some(Boolean)) || s?.validation?.kind === 'checkbox';
}
/** A cell text may be drawn over: no content, fill, borders or validation. */
const isBlank = (c: CellDto | undefined) => !c || (!c.formattedValue && !c.style?.background && !c.style?.validation && !(c.style?.borders && Object.values(c.style.borders).some(Boolean)));

function cellCss(c: CellDto | undefined, numeric: boolean): string {
  const s = c?.style;
  const css: string[] = [];
  if (s?.bold) css.push('font-weight:600');
  if (s?.italic) css.push('font-style:italic');
  const deco = [s?.underline && 'underline', s?.strike && 'line-through'].filter(Boolean).join(' ');
  if (deco) css.push(`text-decoration:${deco}`);
  const color = c?.dataType === 'ERROR' ? '#d93025' : s?.color;
  if (color) css.push(`color:${color}`);
  if (s?.background) css.push(`background:${s.background}`);
  if (s?.fontSize) css.push(`font-size:${s.fontSize}px`);
  const align = s?.align ?? (numeric || c?.dataType === 'BOOLEAN' ? 'right' : 'left');
  if (align !== 'left') css.push(`text-align:${align}`);
  if (s?.wrap) css.push('white-space:pre-wrap;word-break:break-word;vertical-align:top');
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const e = edge(s?.borders?.[side]);
    if (e) css.push(`border-${side}:${e}`);
  }
  return css.join(';');
}

/**
 * A standalone HTML page that prints one sheet and nothing else: the used area as a table with the sheet's column
 * widths, row heights, formatting and borders. Frozen rows repeat at the top of every page, rows hidden by a filter
 * are left out, text overflows into empty neighbours as on screen, numbers that cannot fit show ###, and a sheet wider
 * than the page is scaled to fit (landscape when that is wider than portrait).
 */
export function buildPrintHtml(data: SheetPrintData, hiddenRows: ReadonlySet<number>, measure: MeasureText): string {
  const { sheet } = data;
  const title = `${data.spreadsheetTitle} - ${sheet.name}`;
  const byKey = new Map<string, CellDto>();
  let lastRow = -1;
  let lastCol = -1;
  for (const c of data.cells) {
    byKey.set(`${c.row}:${c.col}`, c);
    if (hasInk(c) && !hiddenRows.has(c.row)) {
      lastRow = Math.max(lastRow, c.row);
      lastCol = Math.max(lastCol, c.col);
    }
  }
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>`;
  if (lastRow < 0) return `${head}<style>body{font:13px Arial,sans-serif;color:#5f6368}</style></head><body><p>This sheet is empty.</p></body></html>`;

  const colW = (c: number) => sheet.colWidths[String(c)] ?? DEFAULT_COL_WIDTH;
  const rowH = (r: number) => sheet.rowHeights[String(r)] ?? DEFAULT_ROW_HEIGHT;
  const get = (r: number, c: number) => byKey.get(`${r}:${c}`);
  let tableWidth = 0;
  for (let c = 0; c <= lastCol; c++) tableWidth += colW(c);
  const landscape = tableWidth > PORTRAIT_WIDTH;
  const scale = Math.min(1, (landscape ? LANDSCAPE_WIDTH : PORTRAIT_WIDTH) / tableWidth);

  const renderRow = (r: number): string => {
    const claimed = new Set<number>();
    const spans = new Map<number, { from: number; to: number; text: string }>();
    for (let c = 0; c <= lastCol; c++) {
      const cell = get(r, c);
      const text = cell?.formattedValue ?? '';
      if (!cell || !text || cell.style?.wrap || cell.style?.validation) continue;
      const fontSize = cell.style?.fontSize ?? 13;
      const need = measure(text, fontSize, !!cell.style?.bold) + CELL_PADDING_X + 1;
      if (need <= colW(c)) continue;
      const numeric = cell.dataType === 'NUMBER';
      const align = cell.style?.align ?? (numeric || cell.dataType === 'BOOLEAN' ? 'right' : 'left');
      const span = spillSpan({ col: c, need, align, colW, isEmpty: (k) => !claimed.has(k) && isBlank(get(r, k)), minCol: 0, maxCol: lastCol });
      if (numeric && !span.fits) {
        const hash = measure('#', fontSize, !!cell.style?.bold) || 8;
        spans.set(c, { from: c, to: c, text: '#'.repeat(Math.max(1, Math.floor((colW(c) - CELL_PADDING_X) / hash))) });
        continue;
      }
      for (let k = span.from; k <= span.to; k++) claimed.add(k);
      spans.set(c, { ...span, text });
    }
    // Cells covered by a neighbour's overflow are merged into that neighbour's cell.
    const startAt = new Map<number, number>();
    for (const [src, sp] of spans) startAt.set(sp.from, src);
    let html = `<tr style="height:${rowH(r)}px">`;
    for (let c = 0; c <= lastCol; ) {
      const src = startAt.get(c);
      if (src !== undefined) {
        const sp = spans.get(src)!;
        const cell = get(r, src);
        const colspan = sp.to - sp.from + 1;
        html += `<td${colspan > 1 ? ` colspan="${colspan}"` : ''} style="${cellCss(cell, cell?.dataType === 'NUMBER')}">${esc(sp.text)}</td>`;
        c = sp.to + 1;
        continue;
      }
      const cell = get(r, c);
      const checkbox = cell?.style?.validation?.kind === 'checkbox' && !validationIssue(cell);
      const content = checkbox ? (cell?.value === true ? '☑' : '☐') : esc(cell?.formattedValue ?? '');
      html += `<td style="${cellCss(cell, cell?.dataType === 'NUMBER')}${checkbox ? ';text-align:center' : ''}">${content}</td>`;
      c++;
    }
    return `${html}</tr>`;
  };

  const frozen = Math.min(sheet.frozenRows, lastRow + 1);
  const rows = (from: number, to: number) => {
    let out = '';
    for (let r = from; r <= to; r++) if (!hiddenRows.has(r)) out += renderRow(r);
    return out;
  };
  const cols = Array.from({ length: lastCol + 1 }, (_, c) => `<col style="width:${colW(c)}px">`).join('');

  return `${head}<style>
@page{size:${landscape ? 'landscape' : 'portrait'};margin:10mm}
html,body{margin:0;padding:0;background:#fff}
body{font:13px/16px Arial,Helvetica,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{zoom:${scale.toFixed(4)}}
table{border-collapse:collapse;table-layout:fixed;width:${tableWidth}px}
td{border:0.5px solid #d0d0d0;padding:0 3px 2px;vertical-align:bottom;white-space:nowrap;overflow:hidden}
tr{break-inside:avoid;page-break-inside:avoid}
thead{display:table-header-group}
</style></head><body><div class="sheet"><table><colgroup>${cols}</colgroup>${frozen > 0 ? `<thead>${rows(0, frozen - 1)}</thead>` : ''}<tbody>${rows(frozen, lastRow)}</tbody></table></div></body></html>`;
}
