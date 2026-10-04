import type { CellDto } from '@qub/shared';
import { parseCellInput } from '@qub/shared/formula';

/** Tooltip text when a cell's value breaks its data validation, or null when it is valid (empty is valid). */
export function validationIssue(cell?: CellDto): string | null {
  const v = cell?.style?.validation;
  if (!v || !cell) return null;
  if (v.kind === 'list') {
    if (cell.value === null || cell.formattedValue === '') return null;
    return v.values.includes(cell.formattedValue) ? null : 'Invalid: value must be one of the listed items';
  }
  return cell.value === null || typeof cell.value === 'boolean' ? null : 'Invalid: value must be TRUE or FALSE';
}

/**
 * Cell input for an item picked from a validation dropdown: literal text, so "01", "10%", dates, TRUE or "=…"
 * are stored exactly as listed instead of being typed as numbers, dates, booleans or formulas.
 */
export function listPickInput(item: string): string {
  const { ast, value } = parseCellInput(item);
  return !ast && value === item ? item : `'${item}`;
}

/** Items typed one per line in the validation dialog. */
export function parseListItems(text: string): { values: string[] } | { error: string } {
  const values = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!values.length) return { error: 'Add at least one item.' };
  if (values.length > 500) return { error: 'A list can have at most 500 items.' };
  const tooLong = values.find((v) => v.length > 255);
  if (tooLong) return { error: `Items can be at most 255 characters ("${tooLong.slice(0, 20)}…").` };
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) return { error: `Each item must be unique ("${v}" appears twice).` };
    seen.add(v);
  }
  return { values };
}
