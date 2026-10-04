import type { CellDto, CellStyle, SheetOp } from '@qub/shared';
import { formatDateSerial, formatGeneralNumber, partsFromSerial, serialFromParts, translateFormulaInput } from '@qub/shared/formula';

export interface FillSource {
  input: string;
  value: CellDto['value'];
  style: CellStyle | null;
}

export interface FillTarget {
  input: string;
  style: CellStyle | null;
}

type Step = { dRow: number; dCol: number };

const isFormula = (s: FillSource) => s.input.startsWith('=');
/** +1 when filling down/right, -1 when filling up/left. */
const direction = (step: Step) => (step.dRow || step.dCol) < 0 ? -1 : 1;
const isDate = (s: FillSource) => typeof s.value === 'number' && (s.style?.numberFormat === 'date' || s.style?.numberFormat === 'datetime');

/** The common difference of a sequence, or null when it isn't arithmetic. */
function constantStep(xs: number[]): number | null {
  const d = xs[1]! - xs[0]!;
  return xs.every((x, i) => i === 0 || Math.abs(x - xs[i - 1]! - d) < 1e-9) ? d : null;
}

/** Repeats the sources in order; formulas shift by their distance from the source cell. */
function repeat(sources: FillSource[], count: number, step: Step): FillTarget[] {
  const n = sources.length;
  return Array.from({ length: count }, (_, k) => {
    const src = sources[k % n]!;
    const distance = n + k - (k % n);
    return { input: isFormula(src) ? translateFormulaInput(src.input, step.dRow * distance, step.dCol * distance) : src.input, style: src.style };
  });
}

const lastDay = (y: number, m: number) => partsFromSerial(serialFromParts(y, m + 1, 0)).day;

function dateSeries(sources: FillSource[], count: number, step: Step): FillTarget[] {
  const n = sources.length;
  const serials = sources.map((s) => s.value as number);
  const kind = sources[0]!.style?.numberFormat === 'datetime' ? 'datetime' : 'date';
  const out = (serial: number, k: number): FillTarget => ({ input: formatDateSerial(serial, kind) ?? formatGeneralNumber(serial), style: sources[k % n]!.style });
  // A single date steps one day in the fill direction (backwards when dragging up/left).
  if (n === 1) return Array.from({ length: count }, (_, k) => out(serials[0]! + direction(step) * (k + 1), k));

  const parts = serials.map((s) => partsFromSerial(s));
  const months = parts.map((p) => p.year * 12 + p.month - 1);
  const monthStep = constantStep(months);
  const sameDay = parts.every((p) => p.day === parts[0]!.day);
  const monthEnds = parts.every((p) => p.day === lastDay(p.year, p.month));
  if (monthStep && (sameDay || monthEnds)) {
    return Array.from({ length: count }, (_, k) => {
      const idx = months[n - 1]! + monthStep * (k + 1);
      const y = Math.floor(idx / 12);
      const m = (idx % 12) + 1;
      const day = monthEnds && !sameDay ? lastDay(y, m) : Math.min(parts[0]!.day, lastDay(y, m));
      return out(serialFromParts(y, m, day), k);
    });
  }
  const d = constantStep(serials);
  if (d !== null) return Array.from({ length: count }, (_, k) => out(serials[n - 1]! + d * (k + 1), k));
  return repeat(sources, count, step);
}

/**
 * Autofill: continues numeric, date (daily or monthly) and "text ending in a number" series; otherwise repeats
 * the sources, shifting formula references. `sources` are ordered from the far end towards the fill direction.
 */
export function fillSeries(sources: FillSource[], count: number, step: Step): FillTarget[] {
  const n = sources.length;
  if (!n || count <= 0) return [];
  if (sources.some(isFormula)) return repeat(sources, count, step);
  if (sources.every(isDate)) return dateSeries(sources, count, step);

  if (sources.every((s) => typeof s.value === 'number')) {
    if (n === 1) return repeat(sources, count, step);
    const xs = sources.map((s) => s.value as number);
    const d = constantStep(xs);
    if (d === null) return repeat(sources, count, step);
    return Array.from({ length: count }, (_, k) => ({ input: formatGeneralNumber(xs[n - 1]! + d * (k + 1)), style: sources[k % n]!.style }));
  }

  const parsed = sources.map((s) => (typeof s.value === 'string' ? /^(.*?)(\d+)$/.exec(s.value) : null));
  if (parsed.every(Boolean) && parsed.every((p) => p![1] === parsed[0]![1])) {
    const prefix = parsed[0]![1]!;
    const width = parsed[0]![2]!.length;
    const xs = parsed.map((p) => Number(p![2]));
    const d = n === 1 ? direction(step) : constantStep(xs);
    if (d !== null) {
      return Array.from({ length: count }, (_, k) => {
        const v = xs[n - 1]! + d * (k + 1);
        return { input: `${prefix}${v < 0 ? String(v) : String(v).padStart(width, '0')}`, style: sources[k % n]!.style };
      });
    }
  }
  return repeat(sources, count, step);
}

/** Ctrl+D / Ctrl+R: copy one cell into every target (formulas shifted), without series. */
export function copyFill(source: FillSource, count: number, step: Step): FillTarget[] {
  return Array.from({ length: count }, (_, k) => ({
    input: isFormula(source) ? translateFormulaInput(source.input, step.dRow * (k + 1), step.dCol * (k + 1)) : source.input,
    style: source.style,
  }));
}

/** One setStyle (replace) per run of equal styles down each column, to keep op counts small. */
export function groupStyleOps(sheetId: string, targets: { row: number; col: number; style: CellStyle | null }[]): SheetOp[] {
  const ops: SheetOp[] = [];
  const byCol = new Map<number, { row: number; style: CellStyle | null }[]>();
  for (const t of targets) byCol.set(t.col, [...(byCol.get(t.col) ?? []), { row: t.row, style: t.style }]);
  for (const [col, list] of byCol) {
    list.sort((a, b) => a.row - b.row);
    let start = list[0]!;
    let prev = start;
    const flush = () => ops.push({ type: 'setStyle', sheetId, range: { startRow: start.row, endRow: prev.row, startCol: col, endCol: col }, style: start.style ?? {}, replace: true });
    for (const t of list.slice(1)) {
      if (t.row === prev.row + 1 && JSON.stringify(t.style) === JSON.stringify(start.style)) prev = t;
      else {
        flush();
        start = prev = t;
      }
    }
    flush();
  }
  return ops;
}

/** Splits ops into message-sized batches (the server accepts at most 100 ops per message). */
export function chunkOps(ops: SheetOp[], size = 100): SheetOp[][] {
  const out: SheetOp[][] = [];
  for (let i = 0; i < ops.length; i += size) out.push(ops.slice(i, i + size));
  return out;
}
