import { mapReferences } from './evaluator';
import { isFormulaInput, parseFormula, type AstNode, type CellRef } from './parser';
import { serializeFormula } from './serialize';

const MAX_INDEX = 10_000_000;

/**
 * Adjusts relative references by (dRow, dCol), as when a formula is copied/pasted, filled or moved by a sort.
 * Returns the input unchanged if it is not a formula.
 */
export function translateFormulaInput(input: string, dRow: number, dCol: number): string {
  if (!isFormulaInput(input) || (dRow === 0 && dCol === 0)) return input;
  let ast: AstNode;
  try {
    ast = parseFormula(input.slice(1));
  } catch {
    return input;
  }
  const moved = mapReferences(ast, (ref) => {
    const row = ref.rowAbs ? ref.row : ref.row + dRow;
    const col = ref.colAbs ? ref.col : ref.col + dCol;
    if (row < 0 || col < 0 || row >= MAX_INDEX) return null;
    return { ...ref, row, col };
  });
  return `=${serializeFormula(moved)}`;
}

export interface StructuralChange {
  /** Name of the sheet whose rows/columns change. */
  sheetName: string;
  axis: 'row' | 'col';
  kind: 'insert' | 'delete';
  index: number;
  count: number;
}

function refTargetsSheet(ref: CellRef, change: StructuralChange, formulaOnSheet: boolean): boolean {
  if (ref.sheet === null) return formulaOnSheet;
  return ref.sheet.toLowerCase() === change.sheetName.toLowerCase();
}

function shiftPos(pos: number, c: StructuralChange): number | null {
  if (c.kind === 'insert') return pos >= c.index ? pos + c.count : pos;
  if (pos >= c.index + c.count) return pos - c.count;
  if (pos >= c.index) return null;
  return pos;
}

/** Rewrites a formula AST for inserted/deleted rows or columns. Deleted single references become #REF!. */
export function shiftAst(ast: AstNode, change: StructuralChange, formulaOnSheet: boolean): AstNode {
  const key = change.axis === 'row' ? 'row' : 'col';
  return mapReferences(
    ast,
    (ref) => {
      if (!refTargetsSheet(ref, change, formulaOnSheet)) return ref;
      const p = shiftPos(ref[key], change);
      return p === null ? null : { ...ref, [key]: p };
    },
    (start, end) => {
      if (!refTargetsSheet(start, change, formulaOnSheet)) return { start, end };
      let a = Math.min(start[key], end[key]);
      let b = Math.max(start[key], end[key]);
      if (change.kind === 'insert') {
        if (a >= change.index) a += change.count;
        if (b >= change.index) b += change.count;
      } else {
        const delEnd = change.index + change.count - 1;
        if (a >= change.index && b <= delEnd) return null;
        if (a > delEnd) a -= change.count;
        else if (a >= change.index) a = change.index;
        if (b > delEnd) b -= change.count;
        else if (b >= change.index) b = change.index - 1;
        if (b < a) return null;
      }
      return { start: { ...start, [key]: a }, end: { ...end, [key]: b } };
    },
  );
}

export function renameSheetInAst(ast: AstNode, oldName: string, newName: string): AstNode {
  const lower = oldName.toLowerCase();
  const rename = (ref: CellRef): CellRef =>
    ref.sheet !== null && ref.sheet.toLowerCase() === lower ? { ...ref, sheet: newName } : ref;
  return mapReferences(ast, rename, (start, end) => ({ start: rename(start), end: rename(end) }));
}
