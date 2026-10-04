/** Frozen copy of the pre-engine branching logic. Test-only: pins legacy parity. */
import type { FormFieldType, LogicAction, LogicOperator } from '../../enums';
import type { AnswerValue, FieldSettings, FieldValidation } from '../../schemas/forms';
import { isAnswered } from '../conditions';

export interface LogicField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  validation: FieldValidation;
  settings: FieldSettings;
  options: { id: string; label: string }[];
  rules: { operator: LogicOperator; value: string | null; action: LogicAction; targetSectionId: string | null; position: number }[];
}

export interface FormSection {
  /** The SECTION field that starts this section, or null for the implicit first section. */
  sectionId: string | null;
  title: string | null;
  fields: LogicField[];
}

/** Splits an ordered field list into sections at every SECTION field. */
export function splitSections(fields: LogicField[]): FormSection[] {
  const sections: FormSection[] = [{ sectionId: null, title: null, fields: [] }];
  for (const f of fields) {
    if (f.type === 'SECTION') sections.push({ sectionId: f.id, title: f.label, fields: [] });
    else sections[sections.length - 1]!.fields.push(f);
  }
  // Drop an empty implicit first section when the form starts with a SECTION field.
  if (sections.length > 1 && sections[0]!.fields.length === 0) sections.shift();
  return sections;
}

export { isAnswered };

export function ruleMatches(rule: LogicField['rules'][number], value: AnswerValue | undefined): boolean {
  switch (rule.operator) {
    case 'ALWAYS':
      return true;
    case 'ANSWERED':
      return isAnswered(value);
    case 'NOT_ANSWERED':
      return !isAnswered(value);
    case 'EQUALS':
      if (Array.isArray(value)) return value.length === 1 && value[0] === rule.value;
      return value != null && String(value) === rule.value;
    case 'NOT_EQUALS':
      if (Array.isArray(value)) return !(value.length === 1 && value[0] === rule.value);
      return value == null || String(value) !== rule.value;
    case 'CONTAINS':
      if (Array.isArray(value)) return rule.value != null && value.includes(rule.value);
      return typeof value === 'string' && rule.value != null && value.toLowerCase().includes(rule.value.toLowerCase());
  }
}

export interface NavigationResult {
  /** Indexes of sections the respondent passes through, in order. */
  visited: number[];
  /** The next section after `fromIndex`, or 'submit'. */
  next: number | 'submit';
}

/**
 * Decides where to go after a section. Rules on the section's fields are checked in field order;
 * the first match wins. Only forward jumps are honoured so a form can never loop.
 */
export function nextSection(sections: FormSection[], fromIndex: number, answers: Record<string, AnswerValue>): number | 'submit' {
  const section = sections[fromIndex];
  if (!section) return 'submit';
  for (const field of section.fields) {
    const rules = [...field.rules].sort((a, b) => a.position - b.position);
    for (const rule of rules) {
      if (!ruleMatches(rule, answers[field.id])) continue;
      if (rule.action === 'SUBMIT_FORM') return 'submit';
      const target = sections.findIndex((s) => s.sectionId === rule.targetSectionId);
      if (target > fromIndex) return target;
    }
  }
  return fromIndex + 1 < sections.length ? fromIndex + 1 : 'submit';
}

/** Walks the whole form given a complete answer set; used by the server to validate a submission. */
export function computePath(sections: FormSection[], answers: Record<string, AnswerValue>): number[] {
  const visited: number[] = [];
  let current: number | 'submit' = sections.length ? 0 : 'submit';
  while (current !== 'submit') {
    visited.push(current);
    current = nextSection(sections, current, answers);
  }
  return visited;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates one answer against its field definition. Returns an error message or null. */
export function validateAnswer(field: LogicField, value: AnswerValue | undefined): string | null {
  if (!isAnswered(value)) return field.required ? 'This question is required' : null;
  const v = field.validation ?? {};
  const optionIds = new Set(field.options.map((o) => o.id));
  switch (field.type) {
    case 'SECTION':
      return null;
    case 'SHORT_ANSWER':
    case 'PARAGRAPH': {
      if (typeof value !== 'string') return 'Expected text';
      if (v.minLength != null && value.length < v.minLength) return `Must be at least ${v.minLength} characters`;
      if (v.maxLength != null && value.length > v.maxLength) return `Must be at most ${v.maxLength} characters`;
      if (v.pattern) {
        let re: RegExp | null = null;
        try {
          re = new RegExp(v.pattern);
        } catch {
          re = null;
        }
        if (re && !re.test(value)) return v.patternMessage || 'Answer does not match the required format';
      }
      return null;
    }
    case 'EMAIL':
      return typeof value === 'string' && EMAIL_RE.test(value) && value.length <= 254 ? null : 'Enter a valid email address';
    case 'NUMBER': {
      const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
      if (!Number.isFinite(n)) return 'Enter a number';
      if (v.integer && !Number.isInteger(n)) return 'Enter a whole number';
      if (v.min != null && n < v.min) return `Must be at least ${v.min}`;
      if (v.max != null && n > v.max) return `Must be at most ${v.max}`;
      return null;
    }
    case 'MULTIPLE_CHOICE':
    case 'DROPDOWN':
      return typeof value === 'string' && optionIds.has(value) ? null : 'Choose one of the options';
    case 'CHECKBOXES': {
      if (!Array.isArray(value) || value.some((x) => !optionIds.has(x))) return 'Choose from the options';
      if (new Set(value).size !== value.length) return 'Duplicate selection';
      if (v.minSelected != null && value.length < v.minSelected) return `Select at least ${v.minSelected}`;
      if (v.maxSelected != null && value.length > v.maxSelected) return `Select at most ${v.maxSelected}`;
      return null;
    }
    case 'DATE':
      return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(value)) ? null : 'Enter a valid date';
    case 'TIME':
      return typeof value === 'string' && TIME_RE.test(value) ? null : 'Enter a valid time';
    case 'RATING': {
      const max = field.settings.scaleMax ?? 5;
      return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= max ? null : `Choose a rating from 1 to ${max}`;
    }
    case 'LINEAR_SCALE': {
      const min = field.settings.scaleMin ?? 1;
      const max = field.settings.scaleMax ?? 5;
      return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? null : `Choose a value from ${min} to ${max}`;
    }
    case 'FILE_UPLOAD': {
      const maxFiles = field.settings.maxFiles ?? 1;
      if (!Array.isArray(value)) return 'Upload a file';
      if (value.length > maxFiles) return `Upload at most ${maxFiles} file(s)`;
      return null;
    }
    default:
      return null;
  }
}
