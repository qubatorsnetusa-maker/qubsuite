import { evaluate, FormulaSyntaxError, isError, isRange, parseFormula, type AstNode, type EvalContext, type Scalar } from '../formula';

/** `{{key}}` placeholder used in formulas and piped text. */
export const PIPE_TOKEN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]{0,63})\s*\}\}/g;

export class FormulaDefinitionError extends Error {
  constructor(
    message: string,
    readonly position: number | null = null,
  ) {
    super(message);
    this.name = 'FormulaDefinitionError';
  }
}

export interface CompiledFormula {
  ast: AstNode;
  /** Keys referenced by the formula; `_v{i}` in the AST resolves to `refs[i]`. */
  refs: string[];
}

export function formulaRefs(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(PIPE_TOKEN)) if (!out.includes(m[1]!)) out.push(m[1]!);
  return out;
}

function assertNoCellRefs(node: AstNode): void {
  switch (node.type) {
    case 'ref':
    case 'range':
      throw new FormulaDefinitionError('Forms formulas cannot use cell references — use {{name}} instead');
    case 'func':
      node.args.forEach(assertNoCellRefs);
      return;
    case 'unary':
    case 'percent':
      assertNoCellRefs(node.arg);
      return;
    case 'binary':
      assertNoCellRefs(node.left);
      assertNoCellRefs(node.right);
      return;
    default:
      return;
  }
}

/**
 * Compiles a Forms formula. `{{key}}` placeholders are swapped for internal `_v{i}` names before parsing so keys
 * that look like cell addresses (e.g. `tax1`) are never read as references.
 */
export function compileFormula(src: string): CompiledFormula {
  const refs: string[] = [];
  const body = src
    .trim()
    .replace(/^=/, '')
    .replace(PIPE_TOKEN, (_m, key: string) => {
      let i = refs.indexOf(key);
      if (i < 0) i = refs.push(key) - 1;
      return `_v${i}`;
    });
  if (body.includes('{{') || body.includes('}}')) throw new FormulaDefinitionError('Write placeholders as {{name}} using letters, digits and _');
  let ast: AstNode;
  try {
    ast = parseFormula(body);
  } catch (e) {
    if (e instanceof FormulaSyntaxError) throw new FormulaDefinitionError(e.message, e.position);
    throw new FormulaDefinitionError(e instanceof Error ? e.message : 'Invalid formula');
  }
  assertNoCellRefs(ast);
  return { ast, refs };
}

/** Evaluates a compiled formula. Unknown keys are blank; any error, range or non-finite number yields null. */
export function evaluateFormula(compiled: CompiledFormula, resolve: (key: string) => Scalar | undefined): Scalar {
  const ctx: EvalContext = {
    resolveSheet: () => null,
    getValue: () => null,
    resolveName: (name) => {
      const m = /^_v(\d+)$/.exec(name);
      if (!m) return undefined;
      const key = compiled.refs[Number(m[1])];
      if (key === undefined) return undefined;
      const v = resolve(key);
      return v === undefined ? null : v;
    },
  };
  const out = evaluate(compiled.ast, ctx);
  if (isRange(out) || isError(out)) return null;
  if (typeof out === 'number' && !Number.isFinite(out)) return null;
  return out;
}
