import type { AnswerValue, ConditionValue } from '../schemas/forms';
import { evaluateCondition, type ConditionContext } from './conditions';
import { QUESTION_TYPES } from './registry';
import { scoreField } from './scoring';
import type { Answers, EngineField, EngineRule, FormDefinition } from './types';
import { VariableState } from './variables';

export interface EvaluationResult {
  /** Step fields (questions and content blocks) the respondent passes through, in order. */
  path: string[];
  /** Final variable values keyed by variable key. */
  variables: Record<string, ConditionValue>;
  score: number;
  /** ENDING field shown at the end, if any. */
  endingId: string | null;
  /** Un-piped SHOW_MESSAGE override. */
  message: string | null;
  /** Un-piped redirect template when a REDIRECT rule ended the form. */
  redirect: string | null;
}

type Nav = { kind: 'jump'; index: number } | { kind: 'end'; endingId: string | null } | { kind: 'redirect'; url: string };

/** Maps `?ref=value` hidden values onto HIDDEN field ids. Unknown refs are ignored. */
export function hiddenAnswers(def: FormDefinition, hidden: Record<string, string>): Answers {
  const out: Answers = {};
  for (const f of def.fields) {
    if (f.type === 'HIDDEN' && Object.hasOwn(hidden, f.ref) && typeof hidden[f.ref] === 'string') out[f.id] = hidden[f.ref]!.slice(0, 2000);
  }
  return out;
}

/**
 * Walks the form with the given answers. Pure and deterministic: the browser uses it to navigate and the server
 * uses it to validate submissions, so both always agree.
 */
export function evaluateForm(def: FormDefinition, answers: Answers): EvaluationResult {
  const ordered = [...def.fields].sort((a, b) => a.position - b.position);
  const byId = new Map(ordered.map((f) => [f.id, f]));
  const steps = ordered.filter((f) => QUESTION_TYPES[f.type].isStep);
  const stepIndex = new Map(steps.map((f, i) => [f.id, i]));
  const sectionOf = new Map<string, string | null>();
  let currentSection: string | null = null;
  for (const f of ordered) {
    if (f.type === 'SECTION') currentSection = f.id;
    sectionOf.set(f.id, currentSection);
  }

  const onPath = new Set<string>();
  const path: string[] = [];
  let score = 0;
  let message: string | null = null;

  const valueOf = (id: string): AnswerValue | undefined => {
    const f = byId.get(id);
    if (!f) return undefined;
    return f.type === 'HIDDEN' || onPath.has(id) ? answers[id] : undefined;
  };
  const vars = new VariableState(def, valueOf, () => score);
  const ctx: ConditionContext = { fieldValue: valueOf, variableValue: (id) => vars.valueById(id), score: () => score };

  const firstStepAfter = (position: number) => {
    const i = steps.findIndex((s) => s.position > position);
    return i < 0 ? steps.length : i;
  };

  const runLeaveRules = (rules: EngineRule[], fromPosition: number): Nav | null => {
    for (const r of [...rules].sort((a, b) => a.position - b.position)) {
      if (!evaluateCondition(r.condition, ctx)) continue;
      switch (r.action) {
        case 'SET_VARIABLE':
          if (r.targetVariableId) vars.set(r.targetVariableId, r.payload?.value ?? null);
          break;
        case 'CALCULATE':
          if (r.targetVariableId && r.payload?.formula) vars.set(r.targetVariableId, vars.evaluate(r.payload.formula));
          break;
        case 'SHOW_MESSAGE':
          message = r.payload?.message ?? null;
          break;
        case 'GO_TO_SECTION': {
          const s = r.targetSectionId ? byId.get(r.targetSectionId) : undefined;
          if (s?.type === 'SECTION' && s.position > fromPosition) return { kind: 'jump', index: firstStepAfter(s.position) };
          break;
        }
        case 'JUMP_TO_FIELD': {
          const t = r.targetFieldId ? byId.get(r.targetFieldId) : undefined;
          const idx = t ? stepIndex.get(t.id) : undefined;
          if (t && idx !== undefined && t.position > fromPosition) return { kind: 'jump', index: idx };
          break;
        }
        case 'SUBMIT_FORM':
          return { kind: 'end', endingId: null };
        case 'END_FORM': {
          const t = r.targetFieldId ? byId.get(r.targetFieldId) : undefined;
          return { kind: 'end', endingId: t?.type === 'ENDING' ? t.id : null };
        }
        case 'REDIRECT':
          if (r.payload?.url) return { kind: 'redirect', url: r.payload.url };
          break;
        default:
          break; // SHOW / HIDE are visibility rules
      }
    }
    return null;
  };

  const isVisible = (f: EngineField): boolean => {
    const vis = f.rules.filter((r) => r.trigger === 'VISIBILITY');
    if (vis.some((r) => r.action === 'HIDE' && evaluateCondition(r.condition, ctx))) return false;
    const shows = vis.filter((r) => r.action === 'SHOW');
    return shows.length === 0 || shows.some((r) => evaluateCondition(r.condition, ctx));
  };
  const leaveRules = (f: EngineField, scope: 'FIELD' | 'SECTION') => f.rules.filter((r) => r.trigger === 'ON_LEAVE' && r.scope === scope);

  let endingId: string | null = null;
  let redirect: string | null = null;
  let i = 0;
  while (i < steps.length) {
    const f = steps[i]!;
    let nav: Nav | null = null;
    if (isVisible(f)) {
      path.push(f.id);
      onPath.add(f.id);
      score += scoreField(f, answers[f.id]);
      vars.recompute();
      nav = runLeaveRules(leaveRules(f, 'FIELD'), f.position);
    }
    const next = steps[i + 1];
    if (!nav && (!next || sectionOf.get(next.id) !== sectionOf.get(f.id))) {
      const section = sectionOf.get(f.id);
      for (const sf of ordered) {
        if (sectionOf.get(sf.id) !== section || !onPath.has(sf.id)) continue;
        nav = runLeaveRules(leaveRules(sf, 'SECTION'), f.position);
        if (nav) break;
      }
    }
    if (nav?.kind === 'jump') {
      i = nav.index;
      continue;
    }
    if (nav?.kind === 'end') {
      endingId = nav.endingId ?? ordered.find((x) => x.type === 'ENDING')?.id ?? null;
      break;
    }
    if (nav?.kind === 'redirect') {
      redirect = nav.url;
      break;
    }
    i += 1;
  }
  if (i >= steps.length && !redirect && !endingId) endingId = ordered.find((x) => x.type === 'ENDING')?.id ?? null;
  return { path, variables: vars.snapshot(), score, endingId, message, redirect };
}
