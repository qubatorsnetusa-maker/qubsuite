import { lettersToCol } from './address';
import { ERROR_CODES, type ErrorCode } from './values';

export interface CellRef {
  /** Sheet name as written in the formula, or null for the formula's own sheet. */
  sheet: string | null;
  row: number;
  col: number;
  rowAbs: boolean;
  colAbs: boolean;
}

export type BinaryOp = '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '>' | '<=' | '>=';

export type AstNode =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'error'; code: ErrorCode }
  | { type: 'ref'; ref: CellRef }
  | { type: 'range'; start: CellRef; end: CellRef }
  | { type: 'func'; name: string; args: AstNode[] }
  | { type: 'unary'; op: '+' | '-'; arg: AstNode }
  | { type: 'percent'; arg: AstNode }
  | { type: 'binary'; op: BinaryOp; left: AstNode; right: AstNode }
  | { type: 'name'; name: string };

export class FormulaSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
  }
}

type Token =
  | { t: 'num'; v: number; p: number }
  | { t: 'str'; v: string; p: number }
  | { t: 'bool'; v: boolean; p: number }
  | { t: 'err'; v: ErrorCode; p: number }
  | { t: 'ref'; v: CellRef; p: number }
  | { t: 'func'; v: string; p: number }
  | { t: 'name'; v: string; p: number }
  | { t: 'op'; v: string; p: number }
  | { t: '('; p: number }
  | { t: ')'; p: number }
  | { t: ','; p: number }
  | { t: ':'; p: number }
  | { t: 'eof'; p: number };

const REF_BODY = /^(\$?)([A-Za-z]{1,3})(\$?)([1-9]\d{0,6})/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_.]*/;
const NUMBER = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/;

function readRefBody(src: string, sheet: string | null): { ref: CellRef; length: number } | null {
  const m = REF_BODY.exec(src);
  if (!m) return null;
  // Reject things like A1B (identifier continuing after the ref).
  const next = src[m[0].length];
  if (next !== undefined && /[A-Za-z0-9_.]/.test(next)) return null;
  return {
    ref: {
      sheet,
      colAbs: m[1] === '$',
      col: lettersToCol(m[2]!),
      rowAbs: m[3] === '$',
      row: Number(m[4]) - 1,
    },
    length: m[0].length,
  };
}

export function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = formula;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    const rest = src.slice(i);

    if (ch === '"') {
      let j = i + 1;
      let value = '';
      for (;;) {
        if (j >= src.length) throw new FormulaSyntaxError('Unterminated string', i);
        if (src[j] === '"') {
          if (src[j + 1] === '"') {
            value += '"';
            j += 2;
            continue;
          }
          break;
        }
        value += src[j];
        j++;
      }
      tokens.push({ t: 'str', v: value, p: i });
      i = j + 1;
      continue;
    }

    if (ch === '#') {
      const code = ERROR_CODES.find((c) => rest.toUpperCase().startsWith(c));
      if (!code) throw new FormulaSyntaxError('Unknown error literal', i);
      tokens.push({ t: 'err', v: code, p: i });
      i += code.length;
      continue;
    }

    if (ch === "'") {
      // Quoted sheet name: 'My Sheet'!A1
      let j = i + 1;
      let name = '';
      for (;;) {
        if (j >= src.length) throw new FormulaSyntaxError('Unterminated sheet name', i);
        if (src[j] === "'") {
          if (src[j + 1] === "'") {
            name += "'";
            j += 2;
            continue;
          }
          break;
        }
        name += src[j];
        j++;
      }
      if (src[j + 1] !== '!') throw new FormulaSyntaxError('Expected ! after sheet name', j);
      const body = readRefBody(src.slice(j + 2), name);
      if (!body) throw new FormulaSyntaxError('Expected cell reference', j + 2);
      tokens.push({ t: 'ref', v: body.ref, p: i });
      i = j + 2 + body.length;
      continue;
    }

    if (ch === '$') {
      const body = readRefBody(rest, null);
      if (!body) throw new FormulaSyntaxError('Invalid reference', i);
      tokens.push({ t: 'ref', v: body.ref, p: i });
      i += body.length;
      continue;
    }

    const num = NUMBER.exec(rest);
    if (num && (/\d/.test(ch) || ch === '.')) {
      tokens.push({ t: 'num', v: Number(num[0]), p: i });
      i += num[0].length;
      continue;
    }

    const ident = IDENT.exec(rest);
    if (ident) {
      const word = ident[0];
      const after = src.slice(i + word.length);
      if (after.startsWith('!')) {
        const body = readRefBody(after.slice(1), word);
        if (!body) throw new FormulaSyntaxError('Expected cell reference', i + word.length + 1);
        tokens.push({ t: 'ref', v: body.ref, p: i });
        i += word.length + 1 + body.length;
        continue;
      }
      if (/^\s*\(/.test(after)) {
        tokens.push({ t: 'func', v: word.toUpperCase(), p: i });
        i += word.length;
        continue;
      }
      const body = readRefBody(rest, null);
      if (body) {
        tokens.push({ t: 'ref', v: body.ref, p: i });
        i += body.length;
        continue;
      }
      const upper = word.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') tokens.push({ t: 'bool', v: upper === 'TRUE', p: i });
      else tokens.push({ t: 'name', v: word, p: i });
      i += word.length;
      continue;
    }

    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') {
      tokens.push({ t: 'op', v: two, p: i });
      i += 2;
      continue;
    }
    if ('+-*/^&=<>%'.includes(ch)) {
      tokens.push({ t: 'op', v: ch, p: i });
      i++;
      continue;
    }
    if (ch === '(' || ch === ')' || ch === ',' || ch === ':') {
      tokens.push({ t: ch, p: i });
      i++;
      continue;
    }
    if (ch === ';') {
      // Accept the European argument separator.
      tokens.push({ t: ',', p: i });
      i++;
      continue;
    }
    throw new FormulaSyntaxError(`Unexpected character "${ch}"`, i);
  }
  tokens.push({ t: 'eof', p: src.length });
  return tokens;
}

const COMPARISON = new Set(['=', '<>', '<', '>', '<=', '>=']);

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos]!;
  }
  private next(): Token {
    return this.tokens[this.pos++]!;
  }
  private isOp(...ops: string[]): boolean {
    const tk = this.peek();
    return tk.t === 'op' && ops.includes(tk.v);
  }

  parse(): AstNode {
    const node = this.comparison();
    const tk = this.peek();
    if (tk.t !== 'eof') throw new FormulaSyntaxError('Unexpected token', tk.p);
    return node;
  }

  private comparison(): AstNode {
    let left = this.concat();
    while (this.peek().t === 'op' && COMPARISON.has((this.peek() as { v: string }).v)) {
      const op = (this.next() as { v: string }).v as BinaryOp;
      left = { type: 'binary', op, left, right: this.concat() };
    }
    return left;
  }

  private concat(): AstNode {
    let left = this.additive();
    while (this.isOp('&')) {
      this.next();
      left = { type: 'binary', op: '&', left, right: this.additive() };
    }
    return left;
  }

  private additive(): AstNode {
    let left = this.multiplicative();
    while (this.isOp('+', '-')) {
      const op = (this.next() as { v: string }).v as BinaryOp;
      left = { type: 'binary', op, left, right: this.multiplicative() };
    }
    return left;
  }

  private multiplicative(): AstNode {
    let left = this.power();
    while (this.isOp('*', '/')) {
      const op = (this.next() as { v: string }).v as BinaryOp;
      left = { type: 'binary', op, left, right: this.power() };
    }
    return left;
  }

  private power(): AstNode {
    let left = this.unary();
    while (this.isOp('^')) {
      this.next();
      left = { type: 'binary', op: '^', left, right: this.unary() };
    }
    return left;
  }

  private unary(): AstNode {
    if (this.isOp('+', '-')) {
      const op = (this.next() as { v: string }).v as '+' | '-';
      return { type: 'unary', op, arg: this.unary() };
    }
    return this.postfix();
  }

  private postfix(): AstNode {
    let node = this.primary();
    while (this.isOp('%')) {
      this.next();
      node = { type: 'percent', arg: node };
    }
    return node;
  }

  private primary(): AstNode {
    const tk = this.next();
    switch (tk.t) {
      case 'num':
        return { type: 'number', value: tk.v };
      case 'str':
        return { type: 'string', value: tk.v };
      case 'bool':
        return { type: 'boolean', value: tk.v };
      case 'err':
        return { type: 'error', code: tk.v };
      case 'name':
        return { type: 'name', name: tk.v };
      case 'ref': {
        if (this.peek().t === ':') {
          this.next();
          const end = this.next();
          if (end.t !== 'ref') throw new FormulaSyntaxError('Expected range end', end.p);
          if (end.v.sheet !== null && end.v.sheet !== tk.v.sheet) {
            throw new FormulaSyntaxError('Ranges cannot span sheets', end.p);
          }
          return { type: 'range', start: tk.v, end: { ...end.v, sheet: tk.v.sheet } };
        }
        return { type: 'ref', ref: tk.v };
      }
      case 'func': {
        const open = this.next();
        if (open.t !== '(') throw new FormulaSyntaxError('Expected (', open.p);
        const args: AstNode[] = [];
        if (this.peek().t !== ')') {
          for (;;) {
            // Allow empty arguments such as IF(A1,,1).
            if (this.peek().t === ',' || this.peek().t === ')') args.push({ type: 'string', value: '' });
            else args.push(this.comparison());
            if (this.peek().t === ',') {
              this.next();
              continue;
            }
            break;
          }
        }
        const close = this.next();
        if (close.t !== ')') throw new FormulaSyntaxError('Expected )', close.p);
        return { type: 'func', name: tk.v, args };
      }
      case '(': {
        const inner = this.comparison();
        const close = this.next();
        if (close.t !== ')') throw new FormulaSyntaxError('Expected )', close.p);
        return inner;
      }
      default:
        throw new FormulaSyntaxError('Unexpected token', tk.p);
    }
  }
}

/** Parses a formula body (without the leading "="). */
export function parseFormula(body: string): AstNode {
  return new Parser(tokenize(body)).parse();
}

export function isFormulaInput(input: string): boolean {
  return input.length > 1 && input.startsWith('=');
}
