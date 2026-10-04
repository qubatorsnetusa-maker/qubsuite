import type { ConditionOp, LogicOperator } from '../enums';
import type { EngineRule } from './types';

const OP: Record<Exclude<LogicOperator, 'ALWAYS'>, ConditionOp> = {
  EQUALS: 'eq',
  NOT_EQUALS: 'neq',
  CONTAINS: 'contains',
  ANSWERED: 'answered',
  NOT_ANSWERED: 'unanswered',
};

export interface LegacyRule {
  operator: LogicOperator;
  value: string | null;
  action: 'GO_TO_SECTION' | 'SUBMIT_FORM';
  targetSectionId: string | null;
}

/** Converts a pre-engine section-branching rule. Mirrors the SQL backfill in migration 0006. */
export function legacyRuleToV2(fieldId: string, r: LegacyRule, position: number): EngineRule {
  return {
    trigger: 'ON_LEAVE',
    scope: 'SECTION',
    condition: r.operator === 'ALWAYS' ? { all: [] } : { subject: { type: 'field', id: fieldId }, op: OP[r.operator], value: r.value },
    action: r.action,
    targetSectionId: r.action === 'GO_TO_SECTION' ? r.targetSectionId : null,
    targetFieldId: null,
    targetVariableId: null,
    payload: null,
    position,
  };
}
