import type { FormFieldType, LogicAction, LogicScope, LogicTrigger, OptionKind, VariableType } from '../enums';
import type { AnswerValue, Condition, ConditionValue, FieldSettings, FieldValidation, RulePayload, ScoreConfig } from '../schemas/forms';

export interface EngineOption {
  id: string;
  label: string;
  kind: OptionKind;
  value: string | null;
  imageUrl: string | null;
}

export interface EngineRule {
  trigger: LogicTrigger;
  scope: LogicScope;
  condition: Condition;
  action: LogicAction;
  targetSectionId: string | null;
  targetFieldId: string | null;
  targetVariableId: string | null;
  payload: RulePayload | null;
  position: number;
}

export interface EngineField {
  id: string;
  ref: string;
  type: FormFieldType;
  label: string;
  description: string | null;
  required: boolean;
  position: number;
  validation: FieldValidation;
  settings: FieldSettings;
  options: EngineOption[];
  rules: EngineRule[];
  scoreConfig: ScoreConfig | null;
  placeholder: string | null;
  defaultValue: AnswerValue;
}

export interface EngineVariable {
  id: string;
  key: string;
  type: VariableType;
  initialValue: ConditionValue;
  formula: string | null;
  position: number;
}

export interface FormDefinition {
  fields: EngineField[];
  variables: EngineVariable[];
}

/** Answers keyed by field id. */
export type Answers = Record<string, AnswerValue>;
