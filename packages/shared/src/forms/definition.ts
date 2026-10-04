import { conditionLeaves, fieldRefSchema, isHttpUrl, type Condition } from '../schemas/forms';
import { compileFormula, FormulaDefinitionError, formulaRefs, PIPE_TOKEN } from './formula';
import { NAVIGATION_ACTIONS, OPTION_FIELD_TYPES } from '../enums';
import { QUESTION_TYPES } from './registry';
import { isSafePattern } from './validation';
import { orderComputedVariables } from './variables';
import type { FormDefinition } from './types';

export type DefinitionIssueCode =
  | 'invalid_ref'
  | 'duplicate_ref'
  | 'invalid_variable_key'
  | 'duplicate_key'
  | 'multiple_welcome'
  | 'formula_error'
  | 'unknown_reference'
  | 'circular_variable'
  | 'dangling_reference'
  | 'backward_jump'
  | 'invalid_target'
  | 'rules_not_allowed'
  | 'operator_not_supported'
  | 'unknown_option'
  | 'invalid_redirect'
  | 'computed_variable_target'
  | 'unsafe_pattern'
  | 'missing_label'
  | 'quiz_score_navigation';

export interface DefinitionIssue {
  severity: 'error' | 'warning';
  code: DefinitionIssueCode;
  message: string;
  fieldId: string | null;
  variableId: string | null;
  ruleIndex: number | null;
}

interface FormulaCheckResult {
  code: 'formula_error' | 'unknown_reference';
  message: string;
}

/**
 * Checks a formula and classifies the failure: a genuine compile/syntax failure vs. a reference to an unknown
 * `{{key}}`. Classifying by `code` (rather than sniffing the message text) avoids misclassifying syntax errors
 * that happen to start with "Unknown" — e.g. the parser's "Unknown error literal" for a stray `#FOO` token.
 */
function checkFormulaDetailed(src: string, knownKeys: Set<string>): FormulaCheckResult | null {
  try {
    compileFormula(src);
  } catch (e) {
    return { code: 'formula_error', message: e instanceof FormulaDefinitionError ? e.message : 'Invalid formula' };
  }
  const unknown = formulaRefs(src).filter((k) => !knownKeys.has(k));
  return unknown.length ? { code: 'unknown_reference', message: `Unknown name${unknown.length > 1 ? 's' : ''}: ${unknown.map((k) => `{{${k}}}`).join(', ')}` } : null;
}

/** Returns an error message for a formula, or null when it compiles and only references known keys. */
export function checkFormula(src: string, knownKeys: Set<string>): string | null {
  return checkFormulaDetailed(src, knownKeys)?.message ?? null;
}

/** True when a condition reads the score or a variable whose value depends on it. */
function conditionUsesScore(c: Condition, scoreDependentIds: Set<string>): boolean {
  return conditionLeaves(c).some((l) => l.subject.type === 'score' || (l.subject.type === 'variable' && scoreDependentIds.has(l.subject.id)));
}

/**
 * Ids of variables whose value can depend on the score, directly or transitively: computed formulas using
 * {{score}} or such a variable, and variables set by SET_VARIABLE/CALCULATE rules whose condition or formula does.
 */
function scoreDependentVariableIds(def: FormDefinition): Set<string> {
  const dependent = new Set<string>();
  const idByKey = new Map(def.variables.map((v) => [v.key, v.id]));
  const formulaUsesScore = (src: string) => formulaRefs(src).some((k) => k === 'score' || dependent.has(idByKey.get(k) ?? ''));
  let grew = true;
  const mark = (id: string | null) => {
    if (id && !dependent.has(id)) {
      dependent.add(id);
      grew = true;
    }
  };
  while (grew) {
    grew = false;
    for (const v of def.variables) if (v.formula && formulaUsesScore(v.formula)) mark(v.id);
    for (const r of def.fields.flatMap((f) => f.rules)) {
      if (r.action !== 'SET_VARIABLE' && r.action !== 'CALCULATE') continue;
      if (conditionUsesScore(r.condition, dependent) || (r.action === 'CALCULATE' && formulaUsesScore(r.payload?.formula ?? ''))) mark(r.targetVariableId);
    }
  }
  return dependent;
}

const RULELESS = new Set(['SECTION', 'WELCOME', 'ENDING', 'HIDDEN']);

/** Keys in `{{…}}` tokens of piped text. */
const pipedKeys = (text: string | null | undefined) => (text ? formulaRefs(text) : []);

export interface ValidateDefinitionOptions {
  /** The form is a quiz: its scoring is stripped from the public form, so respondents' devices see a score of 0. */
  quiz?: boolean;
  /** The form's default confirmation message, which is piped like ending text. */
  confirmationMessage?: string;
}

export function validateDefinition(def: FormDefinition, opts: ValidateDefinitionOptions = {}): DefinitionIssue[] {
  const issues: DefinitionIssue[] = [];
  const add = (code: DefinitionIssueCode, message: string, at: Partial<Pick<DefinitionIssue, 'fieldId' | 'variableId' | 'ruleIndex'>> = {}, severity: 'error' | 'warning' = 'error') =>
    issues.push({ severity, code, message, fieldId: at.fieldId ?? null, variableId: at.variableId ?? null, ruleIndex: at.ruleIndex ?? null });

  const byId = new Map(def.fields.map((f) => [f.id, f]));
  const variablesById = new Map(def.variables.map((v) => [v.id, v]));

  // Keys: field refs and variable keys share one namespace (case-insensitive), `score` is reserved.
  const seen = new Map<string, string>();
  for (const f of def.fields) {
    if (!fieldRefSchema.safeParse(f.ref).success) add('invalid_ref', `"${f.ref}" is not a valid key`, { fieldId: f.id });
    const k = f.ref.toLowerCase();
    if (seen.has(k)) add('duplicate_ref', `The key "${f.ref}" is used more than once`, { fieldId: f.id });
    seen.set(k, f.id);
  }
  for (const v of def.variables) {
    if (!fieldRefSchema.safeParse(v.key).success) add('invalid_variable_key', `"${v.key}" is not a valid variable name`, { variableId: v.id });
    const k = v.key.toLowerCase();
    if (seen.has(k)) add('duplicate_key', `The name "${v.key}" is already used`, { variableId: v.id });
    seen.set(k, v.id);
  }
  const knownKeys = new Set([...def.fields.map((f) => f.ref), ...def.variables.map((v) => v.key), 'score']);

  if (def.fields.filter((f) => f.type === 'WELCOME').length > 1) add('multiple_welcome', 'A form can have only one welcome screen');

  for (const v of def.variables) {
    if (!v.formula) continue;
    const err = checkFormulaDetailed(v.formula, knownKeys);
    if (err) add(err.code, err.message, { variableId: v.id });
  }
  for (const v of orderComputedVariables(def.variables).cyclic) add('circular_variable', `"${v.key}" depends on itself`, { variableId: v.id });

  // Piped text: every `{{key}}` must name a field, a variable or the score, or it silently renders as nothing.
  const checkPiped = (text: string | null | undefined, at: Partial<Pick<DefinitionIssue, 'fieldId' | 'ruleIndex'>>) => {
    const unknown = pipedKeys(text).filter((k) => !knownKeys.has(k));
    if (unknown.length) add('unknown_reference', `Unknown name${unknown.length > 1 ? 's' : ''}: ${unknown.map((k) => `{{${k}}}`).join(', ')}`, at);
  };
  checkPiped(opts.confirmationMessage, {});
  for (const f of def.fields) {
    checkPiped(f.label, { fieldId: f.id });
    checkPiped(f.description, { fieldId: f.id });
    f.rules.forEach((r, ruleIndex) => {
      if (r.action === 'SHOW_MESSAGE') checkPiped(r.payload?.message, { fieldId: f.id, ruleIndex });
      if (r.action === 'REDIRECT') checkPiped(r.payload?.url, { fieldId: f.id, ruleIndex });
    });
    if (f.type === 'ENDING') {
      if (f.settings.buttonUrl) checkPiped(f.settings.buttonUrl, { fieldId: f.id });
      if (f.settings.redirectUrl) checkPiped(f.settings.redirectUrl, { fieldId: f.id });
    }
  }

  const scoreDependent = opts.quiz ? scoreDependentVariableIds(def) : new Set<string>();

  for (const f of def.fields) {
    const typeDef = QUESTION_TYPES[f.type];
    if (typeDef.isInput && f.type !== 'HIDDEN' && !f.label.trim()) add('missing_label', 'Every question needs a title', { fieldId: f.id });
    if (f.validation.pattern && !isSafePattern(f.validation.pattern)) add('unsafe_pattern', 'This pattern is invalid or too slow to check safely', { fieldId: f.id });
    if (f.rules.length && RULELESS.has(f.type)) {
      add('rules_not_allowed', `${typeDef.label} cannot have logic rules`, { fieldId: f.id });
      continue;
    }
    f.rules.forEach((r, ruleIndex) => {
      const at = { fieldId: f.id, ruleIndex };
      checkCondition(r.condition, at);
      const target = (id: string | null) => (id ? byId.get(id) : undefined);
      switch (r.action) {
        case 'GO_TO_SECTION': {
          const t = target(r.targetSectionId);
          if (!t) add('dangling_reference', 'The target section no longer exists', at);
          else if (t.type !== 'SECTION') add('invalid_target', 'Choose a section as the target', at);
          else if (t.position <= f.position) add('backward_jump', 'Rules can only jump forward', at);
          break;
        }
        case 'JUMP_TO_FIELD': {
          const t = target(r.targetFieldId);
          if (!t) add('dangling_reference', 'The target question no longer exists', at);
          else if (!QUESTION_TYPES[t.type].isStep) add('invalid_target', 'Choose a question or content block as the target', at);
          else if (t.position <= f.position) add('backward_jump', 'Rules can only jump forward', at);
          break;
        }
        case 'END_FORM': {
          if (r.targetFieldId) {
            const t = target(r.targetFieldId);
            if (!t) add('dangling_reference', 'The target ending no longer exists', at);
            else if (t.type !== 'ENDING') add('invalid_target', 'Choose an ending screen', at);
          }
          break;
        }
        case 'REDIRECT': {
          const probe = (r.payload?.url ?? '').replace(PIPE_TOKEN, 'x');
          if (!isHttpUrl(probe)) add('invalid_redirect', 'Redirects must start with http:// or https://', at);
          break;
        }
        case 'SET_VARIABLE':
        case 'CALCULATE': {
          const v = r.targetVariableId ? variablesById.get(r.targetVariableId) : undefined;
          if (!v) add('dangling_reference', 'The target variable no longer exists', at);
          else if (v.formula) add('computed_variable_target', `"${v.key}" is calculated by its own formula`, at);
          if (r.action === 'CALCULATE') {
            const err = checkFormulaDetailed(r.payload?.formula ?? '', knownKeys);
            if (err) add(err.code, err.message, at);
          }
          break;
        }
        default:
          break;
      }
      // Path-changing logic must not depend on the score: the respondent's device would take a different path
      // than the server does on submit, and the submission would be rejected.
      const changesPath = (NAVIGATION_ACTIONS as readonly string[]).includes(r.action) || r.trigger === 'VISIBILITY';
      if (opts.quiz && changesPath && conditionUsesScore(r.condition, scoreDependent)) {
        add('quiz_score_navigation', 'In a quiz the score is only known after submitting, so logic that moves between or shows questions cannot depend on it', at);
      }
    });
    if (f.type === 'ENDING') {
      for (const url of [f.settings.buttonUrl, f.settings.redirectUrl]) {
        if (url) {
          const probed = url.replace(PIPE_TOKEN, 'x');
          if (!isHttpUrl(probed)) add('invalid_redirect', 'Links must start with http:// or https://', { fieldId: f.id });
        }
      }
    }
  }
  return issues;

  function checkCondition(c: Condition, at: { fieldId: string; ruleIndex: number }) {
    for (const leaf of conditionLeaves(c)) {
      if (leaf.subject.type === 'variable') {
        if (!variablesById.has(leaf.subject.id)) add('dangling_reference', 'A condition uses a variable that no longer exists', at);
        continue;
      }
      if (leaf.subject.type === 'score') continue;
      const subject = byId.get(leaf.subject.id);
      if (!subject) {
        add('dangling_reference', 'A condition uses a question that no longer exists', at);
        continue;
      }
      if (!QUESTION_TYPES[subject.type].operators.includes(leaf.op)) add('operator_not_supported', `"${leaf.op}" can't be used with ${QUESTION_TYPES[subject.type].label}`, at);
      const optionBased = (OPTION_FIELD_TYPES as readonly string[]).includes(subject.type) && subject.type !== 'MATRIX';
      // Only eq/neq: the old builder allowed free-text CONTAINS on choice questions, which must keep publishing.
      if (optionBased && (leaf.op === 'eq' || leaf.op === 'neq') && !subject.options.some((o) => o.id === leaf.value)) {
        add('unknown_option', 'A condition refers to an option that no longer exists', at);
      }
    }
  }
}
