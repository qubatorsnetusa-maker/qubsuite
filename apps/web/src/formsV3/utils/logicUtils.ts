import type { FormStep, LogicConditionOperator, LogicRule } from '../types';

/**
 * Checks if a given answer satisfies a branching logic condition rule.
 */
export function checkRuleMatch(rule: LogicRule, answer: any): boolean {
  const { operator, value } = rule;

  const isEmpty =
    answer === undefined ||
    answer === null ||
    answer === '' ||
    (Array.isArray(answer) && answer.length === 0);

  if (operator === 'is_empty') {
    return isEmpty;
  }

  if (operator === 'is_answered') {
    return !isEmpty;
  }

  // If answer is empty and operator requires a value, it does not match
  if (isEmpty) {
    return false;
  }

  if (operator === 'equals') {
    if (Array.isArray(answer)) {
      return answer.some(
        (item) => String(item).trim().toLowerCase() === String(value).trim().toLowerCase()
      );
    }
    return String(answer).trim().toLowerCase() === String(value).trim().toLowerCase();
  }

  if (operator === 'not_equals') {
    if (Array.isArray(answer)) {
      return !answer.some(
        (item) => String(item).trim().toLowerCase() === String(value).trim().toLowerCase()
      );
    }
    return String(answer).trim().toLowerCase() !== String(value).trim().toLowerCase();
  }

  if (operator === 'contains') {
    const searchStr = String(value || '').toLowerCase();
    if (Array.isArray(answer)) {
      return answer.some((item) => String(item).toLowerCase().includes(searchStr));
    }
    return String(answer).toLowerCase().includes(searchStr);
  }

  if (operator === 'greater_than') {
    const numAnswer = Number(answer);
    const numTarget = Number(value);
    if (isNaN(numAnswer) || isNaN(numTarget)) return false;
    return numAnswer > numTarget;
  }

  if (operator === 'less_than') {
    const numAnswer = Number(answer);
    const numTarget = Number(value);
    if (isNaN(numAnswer) || isNaN(numTarget)) return false;
    return numAnswer < numTarget;
  }

  return false;
}

/**
 * Evaluates the branching logic for a step and returns the target step ID if a branch is triggered.
 */
export function evaluateStepBranching(
  step: FormStep,
  answer: any
): { targetStepId: string | null; matchedRule: LogicRule | null } {
  if (!step.logic || !step.logic.enabled) {
    return { targetStepId: null, matchedRule: null };
  }

  const rules = step.logic.rules || [];
  for (const rule of rules) {
    if (rule.jumpToStepId && checkRuleMatch(rule, answer)) {
      return { targetStepId: rule.jumpToStepId, matchedRule: rule };
    }
  }

  // Default jump fallback if configured and not 'next'
  if (step.logic.defaultJumpToStepId && step.logic.defaultJumpToStepId !== 'next') {
    return { targetStepId: step.logic.defaultJumpToStepId, matchedRule: null };
  }

  return { targetStepId: null, matchedRule: null };
}

/**
 * Human-readable description for an operator
 */
export const OPERATOR_LABELS: Record<LogicConditionOperator, string> = {
  equals: 'is equal to',
  not_equals: 'is not equal to',
  contains: 'contains',
  greater_than: 'is greater than',
  less_than: 'is less than',
  is_answered: 'is answered',
  is_empty: 'is left empty',
};

/**
 * Relevant operators per question type
 */
export function getOperatorsForType(type: string): LogicConditionOperator[] {
  switch (type) {
    case 'multiple_choice':
      return ['equals', 'not_equals', 'is_answered', 'is_empty'];
    case 'rating':
    case 'opinion_scale':
      return ['equals', 'not_equals', 'greater_than', 'less_than', 'is_answered'];
    case 'short_text':
    case 'long_text':
    case 'email':
    case 'phone':
      return ['equals', 'contains', 'is_answered', 'is_empty'];
    default:
      return ['equals', 'not_equals', 'is_answered'];
  }
}
