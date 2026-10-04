export interface ResolvedArea {
  sheet: string;
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

/** Areas up to this many cells are indexed per cell; bigger ones are scanned per sheet. */
const CELL_INDEX_LIMIT = 256;

export const nodeId = (sheet: string, row: number, col: number) => `${sheet}|${row}:${col}`;

export function parseNodeId(id: string): { sheet: string; row: number; col: number } {
  const bar = id.lastIndexOf('|');
  const colon = id.indexOf(':', bar);
  return { sheet: id.slice(0, bar), row: Number(id.slice(bar + 1, colon)), col: Number(id.slice(colon + 1)) };
}

/**
 * Tracks which formula cells read which areas so a change can find every dependent.
 * Precedents are stored per formula; the reverse index is split between a per-cell map for
 * small areas and a per-sheet list for large ranges (e.g. SUM(A1:A10000)).
 */
export class DependencyGraph {
  private readonly precedents = new Map<string, ResolvedArea[]>();
  private readonly cellIndex = new Map<string, Set<string>>();
  private readonly largeAreas = new Map<string, Map<string, ResolvedArea[]>>();

  set(formulaId: string, areas: ResolvedArea[]): void {
    this.remove(formulaId);
    if (areas.length === 0) return;
    this.precedents.set(formulaId, areas);
    for (const a of areas) {
      const size = (a.r1 - a.r0 + 1) * (a.c1 - a.c0 + 1);
      if (size <= CELL_INDEX_LIMIT) {
        for (let r = a.r0; r <= a.r1; r++)
          for (let c = a.c0; c <= a.c1; c++) {
            const key = nodeId(a.sheet, r, c);
            let set = this.cellIndex.get(key);
            if (!set) this.cellIndex.set(key, (set = new Set()));
            set.add(formulaId);
          }
      } else {
        let bySheet = this.largeAreas.get(a.sheet);
        if (!bySheet) this.largeAreas.set(a.sheet, (bySheet = new Map()));
        const list = bySheet.get(formulaId) ?? [];
        list.push(a);
        bySheet.set(formulaId, list);
      }
    }
  }

  remove(formulaId: string): void {
    const areas = this.precedents.get(formulaId);
    if (!areas) return;
    this.precedents.delete(formulaId);
    for (const a of areas) {
      const size = (a.r1 - a.r0 + 1) * (a.c1 - a.c0 + 1);
      if (size <= CELL_INDEX_LIMIT) {
        for (let r = a.r0; r <= a.r1; r++)
          for (let c = a.c0; c <= a.c1; c++) {
            const key = nodeId(a.sheet, r, c);
            const set = this.cellIndex.get(key);
            set?.delete(formulaId);
            if (set?.size === 0) this.cellIndex.delete(key);
          }
      } else {
        this.largeAreas.get(a.sheet)?.delete(formulaId);
      }
    }
  }

  getPrecedents(formulaId: string): readonly ResolvedArea[] {
    return this.precedents.get(formulaId) ?? [];
  }

  /** Formula cells that directly read (sheet,row,col). */
  dependentsOf(sheet: string, row: number, col: number): string[] {
    const out = new Set(this.cellIndex.get(nodeId(sheet, row, col)) ?? []);
    const large = this.largeAreas.get(sheet);
    if (large) {
      for (const [formulaId, areas] of large) {
        if (areas.some((a) => row >= a.r0 && row <= a.r1 && col >= a.c0 && col <= a.c1)) out.add(formulaId);
      }
    }
    return [...out];
  }

  clear(): void {
    this.precedents.clear();
    this.cellIndex.clear();
    this.largeAreas.clear();
  }
}
