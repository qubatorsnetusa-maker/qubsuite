import type { Border, CellRange, SheetOp } from '@qub/shared';

export type BorderKind = 'all' | 'outer' | 'inner' | 'top' | 'bottom' | 'left' | 'right' | 'clear';

const WEIGHT = { thin: 1, medium: 2, thick: 3 } as const;

const op = (sheetId: string, range: CellRange, borders: Partial<Record<'top' | 'right' | 'bottom' | 'left', Border>> | null): SheetOp => ({
  type: 'setStyle',
  sheetId,
  range,
  style: { borders },
});

/** Turns a border-menu choice over a selection into per-cell edge updates (merged into existing borders). */
export function resolveBorders(sheetId: string, range: CellRange, kind: BorderKind, border: Border): SheetOp[] {
  const { startRow, endRow, startCol, endCol } = range;
  switch (kind) {
    case 'all':
      return [op(sheetId, range, { top: border, right: border, bottom: border, left: border })];
    case 'clear':
      return [op(sheetId, range, null)];
    case 'top':
      return [op(sheetId, { ...range, endRow: startRow }, { top: border })];
    case 'bottom':
      return [op(sheetId, { ...range, startRow: endRow }, { bottom: border })];
    case 'left':
      return [op(sheetId, { ...range, endCol: startCol }, { left: border })];
    case 'right':
      return [op(sheetId, { ...range, startCol: endCol }, { right: border })];
    case 'outer':
      return [
        op(sheetId, { ...range, endRow: startRow }, { top: border }),
        op(sheetId, { ...range, startRow: endRow }, { bottom: border }),
        op(sheetId, { ...range, endCol: startCol }, { left: border }),
        op(sheetId, { ...range, startCol: endCol }, { right: border }),
      ];
    case 'inner': {
      const out: SheetOp[] = [];
      if (endRow > startRow) out.push(op(sheetId, { ...range, endRow: endRow - 1 }, { bottom: border }));
      if (endCol > startCol) out.push(op(sheetId, { ...range, endCol: endCol - 1 }, { right: border }));
      return out;
    }
  }
}

/** The border drawn on an edge shared with the neighbour below/right: heavier wins, ties go to the neighbour. */
export function effectiveEdge(own?: Border | null, neighbour?: Border | null): Border | null {
  if (!own) return neighbour ?? null;
  if (!neighbour) return own;
  return WEIGHT[own.style] > WEIGHT[neighbour.style] ? own : neighbour;
}

/** Line thickness in px. */
export const borderWidth = (b: Border) => WEIGHT[b.style];
