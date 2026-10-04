import type { Condition, ConditionLeaf, ConditionSubject, ConditionValue, FormDto, FormFieldDto, FormLogicRuleDto } from '@qub/shared';
import { OP_LABEL, subjectOptions, type SubjectOption } from '@/features/forms/builder/condition-editor';

const subjectKey = (s: ConditionSubject) => (s.type === 'score' ? 'score' : `${s.type}:${s.id}`);

/** Renders a condition value using the same vocabulary as the condition editor's value inputs. `null` = can't render (dangling reference, missing value, …). */
function formatValue(option: SubjectOption, value: ConditionValue | undefined): string | null {
  if (value === undefined || value === null) return null;
  switch (option.valueKind) {
    case 'option': {
      const opt = option.field?.options.find((o) => o.id === value);
      return opt ? opt.label : null;
    }
    case 'boolean':
      return value === true ? 'Yes' : value === false ? 'No' : null;
    case 'number':
      return typeof value === 'number' ? String(value) : null;
    case 'date':
      return typeof value === 'string' ? value : null;
    case 'text':
      return typeof value === 'string' ? `"${value}"` : null;
    default:
      return null;
  }
}

function renderLeaf(options: SubjectOption[], leaf: ConditionLeaf): string | null {
  const option = options.find((o) => o.key === subjectKey(leaf.subject));
  if (!option) return null;
  const opLabel = OP_LABEL[leaf.op];
  if (!opLabel) return null;
  if (leaf.op === 'answered' || leaf.op === 'unanswered') return `${option.label} ${opLabel}`;
  const value = formatValue(option, leaf.value);
  return value === null ? null : `${option.label} ${opLabel} ${value}`;
}

/** Plain-language text for a (non-empty) condition, with nested groups parenthesised. `null` = can't render. */
function renderCondition(options: SubjectOption[], c: Condition, depth = 0): string | null {
  if ('all' in c) {
    if (c.all.length === 0) return depth === 0 ? null : 'true';
    const parts = c.all.map((x) => renderCondition(options, x, depth + 1));
    if (parts.some((p) => p === null)) return null;
    const joined = (parts as string[]).join(' AND ');
    return depth > 0 && parts.length > 1 ? `(${joined})` : joined;
  }
  if ('any' in c) {
    if (c.any.length === 0) return null;
    const parts = c.any.map((x) => renderCondition(options, x, depth + 1));
    if (parts.some((p) => p === null)) return null;
    const joined = (parts as string[]).join(' OR ');
    return depth > 0 && parts.length > 1 ? `(${joined})` : joined;
  }
  if ('not' in c) {
    const inner = renderCondition(options, c.not, depth + 1);
    return inner === null ? null : `not ${inner}`;
  }
  return renderLeaf(options, c);
}

/** A plain, unquoted rendering of a fixed value (SET_VARIABLE's payload.value). */
function formatPlainValue(value: ConditionValue | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

type RuleLike = Pick<FormLogicRuleDto, 'condition' | 'action' | 'targetFieldId' | 'targetSectionId' | 'targetVariableId' | 'payload'>;

/** What happens ("then" part) for one rule's action. `null` = can't render (dangling target, missing payload, …). */
function summarizeAction(form: Pick<FormDto, 'fields' | 'variables'>, rule: RuleLike): string | null {
  switch (rule.action) {
    case 'JUMP_TO_FIELD': {
      const target = rule.targetFieldId ? form.fields.find((f) => f.id === rule.targetFieldId) : null;
      return target ? target.label || target.ref : null;
    }
    case 'GO_TO_SECTION': {
      const target = rule.targetSectionId ? form.fields.find((f) => f.id === rule.targetSectionId) : null;
      return target ? target.label || 'Untitled section' : null;
    }
    case 'END_FORM':
    case 'SUBMIT_FORM': {
      if (!rule.targetFieldId) return 'End the form';
      const target = form.fields.find((f) => f.id === rule.targetFieldId);
      return target ? target.label || 'Ending' : null;
    }
    case 'REDIRECT': {
      const url = rule.payload?.url;
      return url ? `Redirect to ${url}` : null;
    }
    case 'SHOW_MESSAGE': {
      const message = rule.payload?.message;
      return message ? `Change the message to "${message}"` : null;
    }
    case 'SET_VARIABLE': {
      const target = rule.targetVariableId ? form.variables.find((v) => v.id === rule.targetVariableId) : null;
      if (!target) return null;
      const value = formatPlainValue(rule.payload?.value);
      return value === null ? null : `Set ${target.key} to ${value}`;
    }
    case 'CALCULATE': {
      const target = rule.targetVariableId ? form.variables.find((v) => v.id === rule.targetVariableId) : null;
      if (!target) return null;
      const formula = rule.payload?.formula;
      return formula ? `Set ${target.key} to ${formula}` : null;
    }
    case 'SHOW':
      return 'Show this question';
    case 'HIDE':
      return 'Hide this question';
    default:
      return null;
  }
}

/**
 * Plain-language summary of one logic rule, using the condition editor's vocabulary (`OP_LABEL`, `subjectOptions`):
 * e.g. `If Rating is less than 3 → Why so low?`, `Always → Thank you`, `If score is at least 7 → Set score to score + 1`.
 * A root condition of `{ all: [] }` (the editor's "no conditions" shape — an AND of nothing is vacuously true, same
 * as `evaluateCondition`'s `.every()` on an empty array) renders as `Always`. A root `{ any: [] }` (reachable by
 * switching a rule to "Any condition (OR)" and then removing every leaf — logic-tab.tsx's rule loop has no min-1
 * guard) is the opposite: an OR of nothing is vacuously false, so it renders as `Never`, distinct from both `Always`
 * and `Invalid rule` — the rule is well-formed, it just can never fire. Anything the renderer genuinely can't
 * resolve — a dangling field/variable/option reference, an unset value, an unrecognised action — is `Invalid rule`.
 */
export function summarizeRule(form: Pick<FormDto, 'fields' | 'variables'>, rule: RuleLike): string {
  const then = summarizeAction(form, rule);
  if (then === null) return 'Invalid rule';
  const isAlways = 'all' in rule.condition && rule.condition.all.length === 0;
  if (isAlways) return `Always → ${then}`;
  const isNever = 'any' in rule.condition && rule.condition.any.length === 0;
  if (isNever) return `Never → ${then}`;
  const options = subjectOptions(form);
  const cond = renderCondition(options, rule.condition);
  return cond === null ? 'Invalid rule' : `If ${cond} → ${then}`;
}
