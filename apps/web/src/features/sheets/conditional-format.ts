import type { CellDto, CellRange } from '@qub/shared';
import type { CSSProperties } from 'react';

export type ConditionalRuleType =
  | 'greaterThan'
  | 'lessThan'
  | 'equalTo'
  | 'notEqualTo'
  | 'between'
  | 'notBetween'
  | 'textContains'
  | 'textStartsWith'
  | 'textEndsWith'
  | 'empty'
  | 'notEmpty';

export interface ConditionalFormatStyle {
  background?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export interface ConditionalFormatRule {
  id: string;
  sheetId: string;
  range: CellRange;
  type: ConditionalRuleType;
  values: (string | number)[];
  style: ConditionalFormatStyle;
}

export const PRESET_STYLES: { label: string; style: ConditionalFormatStyle }[] = [
  { label: 'Soft Green', style: { background: '#dcfce7', color: '#166534' } },
  { label: 'Soft Red', style: { background: '#fee2e2', color: '#991b1b' } },
  { label: 'Soft Yellow', style: { background: '#fef3c7', color: '#92400e' } },
  { label: 'Soft Blue', style: { background: '#dbeafe', color: '#1e40af' } },
  { label: 'Bold Green Text', style: { color: '#15803d', bold: true } },
  { label: 'Bold Red Text', style: { color: '#b91c1c', bold: true } },
];

export const RULE_TYPE_LABELS: Record<ConditionalRuleType, string> = {
  greaterThan: 'Greater than',
  lessThan: 'Less than',
  equalTo: 'Is equal to',
  notEqualTo: 'Is not equal to',
  between: 'Is between',
  notBetween: 'Is not between',
  textContains: 'Text contains',
  textStartsWith: 'Text starts with',
  textEndsWith: 'Text ends with',
  empty: 'Is empty',
  notEmpty: 'Is not empty',
};

/** Evaluates whether a cell matches a specific conditional formatting rule. */
export function evaluateConditionalRule(
  cell: CellDto | undefined,
  r: number,
  c: number,
  rule: ConditionalFormatRule,
): boolean {
  const { startRow, endRow, startCol, endCol } = rule.range;
  if (r < startRow || r > endRow || c < startCol || c > endCol) {
    return false;
  }

  const rawVal = cell?.value;
  const formattedVal = cell?.formattedValue ?? '';
  const isBlank = !cell || (rawVal === null || rawVal === undefined || rawVal === '') && !formattedVal;

  if (rule.type === 'empty') return isBlank;
  if (rule.type === 'notEmpty') return !isBlank;

  if (isBlank) return false;

  const num = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal ?? formattedVal).replace(/[^0-9.-]+/g, ''));
  const isNum = !isNaN(num);
  const str = String(formattedVal || rawVal || '').toLowerCase();

  switch (rule.type) {
    case 'greaterThan': {
      const target = Number(rule.values[0]);
      return isNum && !isNaN(target) && num > target;
    }
    case 'lessThan': {
      const target = Number(rule.values[0]);
      return isNum && !isNaN(target) && num < target;
    }
    case 'equalTo': {
      const targetNum = Number(rule.values[0]);
      if (isNum && !isNaN(targetNum)) {
        return num === targetNum;
      }
      return str === String(rule.values[0] ?? '').toLowerCase();
    }
    case 'notEqualTo': {
      const targetNum = Number(rule.values[0]);
      if (isNum && !isNaN(targetNum)) {
        return num !== targetNum;
      }
      return str !== String(rule.values[0] ?? '').toLowerCase();
    }
    case 'between': {
      const min = Number(rule.values[0]);
      const max = Number(rule.values[1]);
      return isNum && !isNaN(min) && !isNaN(max) && num >= min && num <= max;
    }
    case 'notBetween': {
      const min = Number(rule.values[0]);
      const max = Number(rule.values[1]);
      return isNum && !isNaN(min) && !isNaN(max) && (num < min || num > max);
    }
    case 'textContains': {
      const target = String(rule.values[0] ?? '').toLowerCase();
      return target.length > 0 && str.includes(target);
    }
    case 'textStartsWith': {
      const target = String(rule.values[0] ?? '').toLowerCase();
      return target.length > 0 && str.startsWith(target);
    }
    case 'textEndsWith': {
      const target = String(rule.values[0] ?? '').toLowerCase();
      return target.length > 0 && str.endsWith(target);
    }
    default:
      return false;
  }
}

/** Resolves active conditional formatting styles for a cell from the rule list. */
export function getConditionalStyle(
  cell: CellDto | undefined,
  r: number,
  c: number,
  sheetId: string,
  rules: ConditionalFormatRule[],
): CSSProperties | null {
  if (!rules || rules.length === 0) return null;

  let merged: ConditionalFormatStyle | null = null;

  for (const rule of rules) {
    if (rule.sheetId !== sheetId) continue;
    if (evaluateConditionalRule(cell, r, c, rule)) {
      merged = { ...(merged || {}), ...rule.style };
    }
  }

  if (!merged) return null;

  return {
    background: merged.background,
    color: merged.color,
    fontWeight: merged.bold ? 600 : undefined,
    fontStyle: merged.italic ? 'italic' : undefined,
    textDecoration: [merged.underline && 'underline', merged.strike && 'line-through'].filter(Boolean).join(' ') || undefined,
  };
}
