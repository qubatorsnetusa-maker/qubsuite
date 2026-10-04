import type { FormFieldType, NativeFileType } from '../enums';
import type { FieldSettings, FieldValidation, FormSettings, FormThemeInput } from '../schemas/forms';
import type { CellStyle } from '../schemas/sheets';

/** What every template has, whatever the app. */
export interface TemplateMeta {
  /** Stable id sent to the create endpoints (e.g. "doc-resume"). */
  id: string;
  app: NativeFileType;
  /** Also the title of files created from it. */
  name: string;
  /** Short style/variant line shown under the name. */
  subtitle: string;
  category: string;
}

/** Tiptap/ProseMirror JSON (structurally identical to Tiptap's JSONContent). */
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export interface DocTemplate extends TemplateMeta {
  app: 'DOCUMENT';
  content: DocNode;
}

export type SheetTemplateValue = string | number | null;

export interface SheetTemplateSheet {
  name: string;
  frozenRows?: number;
  /** Column index → width in px. */
  colWidths?: Record<number, number>;
  /** Row-major cell inputs from A1; strings starting with "=" are formulas. */
  rows: SheetTemplateValue[][];
  /** Styles applied after the inputs, by A1-style range ("A1:D1" or "B4"). */
  styles?: { range: string; style: CellStyle }[];
}

export interface SheetTemplate extends TemplateMeta {
  app: 'SPREADSHEET';
  sheets: SheetTemplateSheet[];
}

export interface FormTemplateField {
  type: FormFieldType;
  label: string;
  description?: string;
  required?: boolean;
  options?: string[];
  settings?: FieldSettings;
  validation?: FieldValidation;
}

export interface FormTemplate extends TemplateMeta {
  app: 'FORM';
  description: string;
  theme: Pick<FormThemeInput, 'primaryColor' | 'backgroundColor' | 'fontFamily'>;
  settings?: FormSettings;
  fields: FormTemplateField[];
  /** One-question-at-a-time template (welcome screen, ending); Forms v2 lists these first. */
  conversational?: boolean;
}

export type Template = DocTemplate | SheetTemplate | FormTemplate;
