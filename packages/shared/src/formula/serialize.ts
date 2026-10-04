import { colToLetters, formatSheetPrefix } from './address';
import type { AstNode, CellRef } from './parser';

const PRECEDENCE: Record<string, number> = {
  '=': 1,
  '<>': 1,
  '<': 1,
  '>': 1,
  '<=': 1,
  '>=': 1,
  '&': 2,
  '+': 3,
  '-': 3,
  '*': 4,
  '/': 4,
  '^': 5,
};

function refToString(ref: CellRef, withSheet: boolean): string {
  const sheet = withSheet && ref.sheet !== null ? formatSheetPrefix(ref.sheet) : '';
  return `${sheet}${ref.colAbs ? '$' : ''}${colToLetters(ref.col)}${ref.rowAbs ? '$' : ''}${ref.row + 1}`;
}

function precedenceOf(node: AstNode): number {
  if (node.type === 'binary') return PRECEDENCE[node.op]!;
  if (node.type === 'unary') return 6;
  if (node.type === 'percent') return 7;
  return 8;
}

/** Turns an AST back into formula text (without the leading "="). */
export function serializeFormula(node: AstNode): string {
  switch (node.type) {
    case 'number':
      return String(node.value);
    case 'string':
      return `"${node.value.replace(/"/g, '""')}"`;
    case 'boolean':
      return node.value ? 'TRUE' : 'FALSE';
    case 'error':
      return node.code;
    case 'name':
      return node.name;
    case 'ref':
      return refToString(node.ref, true);
    case 'range':
      return `${refToString(node.start, true)}:${refToString(node.end, false)}`;
    case 'func':
      return `${node.name}(${node.args.map(serializeFormula).join(',')})`;
    case 'unary': {
      const inner = serializeFormula(node.arg);
      return precedenceOf(node.arg) < 6 ? `${node.op}(${inner})` : `${node.op}${inner}`;
    }
    case 'percent': {
      const inner = serializeFormula(node.arg);
      return precedenceOf(node.arg) < 7 ? `(${inner})%` : `${inner}%`;
    }
    case 'binary': {
      const p = PRECEDENCE[node.op]!;
      const l = serializeFormula(node.left);
      const r = serializeFormula(node.right);
      // Left-associative operators: the right side needs parens at equal precedence.
      const left = precedenceOf(node.left) < p ? `(${l})` : l;
      const right = precedenceOf(node.right) <= p ? `(${r})` : r;
      return `${left}${node.op}${right}`;
    }
  }
}
