import type { NativeFileType } from '../enums';
import { DOC_TEMPLATES } from './docs';
import { FORM_TEMPLATES } from './forms';
import { SHEET_TEMPLATES } from './sheets';
import type { DocTemplate, FormTemplate, SheetTemplate, Template } from './types';

export * from './types';
export { DOC_TEMPLATES, FORM_TEMPLATES, SHEET_TEMPLATES };
export { buildSheetTemplate, parseTemplateRange, type BuiltTemplateCell } from './sheets';

interface TemplatesByApp {
  DOCUMENT: DocTemplate;
  SPREADSHEET: SheetTemplate;
  FORM: FormTemplate;
}

const BY_APP: { [A in NativeFileType]: TemplatesByApp[A][] } = {
  DOCUMENT: DOC_TEMPLATES,
  SPREADSHEET: SHEET_TEMPLATES,
  FORM: FORM_TEMPLATES,
};

/** Gallery categories in display order. */
export const TEMPLATE_CATEGORIES: Record<NativeFileType, string[]> = {
  DOCUMENT: ['Resumes & letters', 'Work', 'Education'],
  SPREADSHEET: ['Personal', 'Work', 'Education'],
  FORM: ['Personal', 'Work', 'Education'],
};

export function templatesFor<A extends NativeFileType>(app: A): TemplatesByApp[A][] {
  return BY_APP[app];
}

/** The template with this id for this app, or undefined (ids are never trusted across apps). */
export function findTemplate<A extends NativeFileType>(app: A, id: string): TemplatesByApp[A] | undefined {
  return (BY_APP[app] as Template[]).find((t) => t.id === id) as TemplatesByApp[A] | undefined;
}

/** The home page's "Start a new …" row: the first templates of the gallery, in a fixed order. */
export const FEATURED_TEMPLATES: Record<NativeFileType, string[]> = {
  DOCUMENT: ['doc-resume', 'doc-project-proposal', 'doc-meeting-notes', 'doc-letter', 'doc-brochure'],
  SPREADSHEET: ['sheet-todo-list', 'sheet-monthly-budget', 'sheet-invoice', 'sheet-project-tracker', 'sheet-weekly-schedule'],
  FORM: ['form-contact-information', 'form-rsvp', 'form-event-registration', 'form-customer-feedback', 'form-job-application'],
};
