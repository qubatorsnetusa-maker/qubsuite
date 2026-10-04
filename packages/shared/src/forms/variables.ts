import type { VariableType } from '../enums';
import type { Scalar } from '../formula';
import type { AnswerValue, ConditionValue } from '../schemas/forms';
import { isAnswered } from './conditions';
import { compileFormula, evaluateFormula, formulaRefs, type CompiledFormula } from './formula';
import { QUESTION_TYPES } from './registry';
import type { EngineField, EngineVariable, FormDefinition } from './types';

export function coerceVariable(type: VariableType, v: ConditionValue): ConditionValue {
  if (v === null) return null;
  switch (type) {
    case 'NUMBER': {
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case 'TEXT':
      return String(v);
    case 'BOOLEAN':
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v !== 0;
      return ['true', 'yes', '1'].includes(v.trim().toLowerCase());
    case 'DATE':
      return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 16) : null;
  }
}

/** Topological order of computed variables; variables in (or depending on) a cycle are returned as `cyclic`. */
export function orderComputedVariables(variables: EngineVariable[]): { ordered: EngineVariable[]; cyclic: EngineVariable[] } {
  const computed = variables.filter((v) => v.formula);
  const keys = new Set(computed.map((v) => v.key));
  const deps = new Map(computed.map((v) => [v.key, new Set(formulaRefs(v.formula!).filter((k) => keys.has(k)))]));
  const ordered: EngineVariable[] = [];
  const done = new Set<string>();
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const v of computed) {
      if (done.has(v.key)) continue;
      if ([...deps.get(v.key)!].every((d) => done.has(d))) {
        ordered.push(v);
        done.add(v.key);
        progressed = true;
      }
    }
  }
  return { ordered, cyclic: computed.filter((v) => !done.has(v.key)) };
}

/** Variable values while walking a form. Plain variables change through rules; computed ones follow their formula. */
export class VariableState {
  private readonly values = new Map<string, ConditionValue>();
  private readonly byKey: Map<string, EngineVariable>;
  private readonly byId: Map<string, EngineVariable>;
  private readonly fieldByRef: Map<string, EngineField>;
  private readonly cache = new Map<string, CompiledFormula | null>();
  private readonly computed: EngineVariable[];

  constructor(
    def: FormDefinition,
    private readonly fieldValue: (fieldId: string) => AnswerValue | undefined,
    private readonly score: () => number,
  ) {
    this.byKey = new Map(def.variables.map((v) => [v.key, v]));
    this.byId = new Map(def.variables.map((v) => [v.id, v]));
    this.fieldByRef = new Map(def.fields.map((f) => [f.ref, f]));
    for (const v of def.variables) this.values.set(v.id, v.formula ? null : coerceVariable(v.type, v.initialValue));
    this.computed = orderComputedVariables(def.variables).ordered;
    this.recompute();
  }

  private compile(src: string): CompiledFormula | null {
    if (!this.cache.has(src)) {
      try {
        this.cache.set(src, compileFormula(src));
      } catch {
        this.cache.set(src, null);
      }
    }
    return this.cache.get(src)!;
  }

  private readonly resolve = (key: string): Scalar | undefined => {
    if (key === 'score') return this.score();
    const v = this.byKey.get(key);
    if (v) return this.values.get(v.id) ?? null;
    const f = this.fieldByRef.get(key);
    if (!f) return undefined;
    const answer = this.fieldValue(f.id);
    return isAnswered(answer) ? QUESTION_TYPES[f.type].toScalar(f, answer as AnswerValue) : null;
  };

  evaluate(src: string): ConditionValue {
    const compiled = this.compile(src);
    return compiled ? evaluateFormula(compiled, this.resolve) : null;
  }

  set(variableId: string, value: ConditionValue): void {
    const v = this.byId.get(variableId);
    if (!v || v.formula) return;
    this.values.set(v.id, coerceVariable(v.type, value));
    this.recompute();
  }

  recompute(): void {
    for (const v of this.computed) this.values.set(v.id, coerceVariable(v.type, this.evaluate(v.formula!)));
  }

  valueById(id: string): ConditionValue | undefined {
    return this.values.get(id);
  }

  snapshot(): Record<string, ConditionValue> {
    return Object.fromEntries([...this.byKey.values()].map((v) => [v.key, this.values.get(v.id) ?? null]));
  }
}
