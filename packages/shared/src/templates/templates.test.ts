import { describe, expect, it } from 'vitest';
import { CHOICE_FIELD_TYPES, NATIVE_FILE_TYPES } from '../enums';
import { formatValue, isError } from '../formula';
import { makeField, uid } from '../forms/__fixtures__/form-dto';
import { fieldStateProblem, QUESTION_TYPES, validateDefinition } from '../forms';
import { fieldSettingsSchema, fieldValidationSchema, formThemeSchema } from '../schemas/forms';
import { cellStyleSchema } from '../schemas/sheets';
import { buildSheetTemplate, FEATURED_TEMPLATES, findTemplate, SHEET_TEMPLATES, TEMPLATE_CATEGORIES, templatesFor } from './index';

const valueAt = (built: ReturnType<typeof buildSheetTemplate>[number], a1: string) => {
  const col = a1.charCodeAt(0) - 65;
  const row = Number(a1.slice(1)) - 1;
  return built.cells.find((c) => c.row === row && c.col === col)?.cell.value ?? null;
};

describe('templates', () => {
  it('have unique ids, known categories and valid featured lists', () => {
    const ids = new Set<string>();
    for (const app of NATIVE_FILE_TYPES) {
      for (const t of templatesFor(app)) {
        expect(ids.has(t.id)).toBe(false);
        ids.add(t.id);
        expect(t.app).toBe(app);
        expect(TEMPLATE_CATEGORIES[app]).toContain(t.category);
      }
      expect(FEATURED_TEMPLATES[app]).toHaveLength(5);
      for (const id of FEATURED_TEMPLATES[app]) expect(findTemplate(app, id)).toBeDefined();
    }
  });

  it('never resolves an id for a different app', () => {
    expect(findTemplate('DOCUMENT', 'doc-resume')).toBeDefined();
    expect(findTemplate('SPREADSHEET', 'doc-resume')).toBeUndefined();
    expect(findTemplate('FORM', 'nope')).toBeUndefined();
  });

  it('spreadsheet templates evaluate without formula errors and with valid styles', () => {
    for (const t of SHEET_TEMPLATES) {
      const built = buildSheetTemplate(t, t.sheets.map((_, i) => `s${i}`));
      for (const sheet of built) {
        for (const { cell } of sheet.cells) {
          expect(isError(cell.value), `${t.id} ${cell.input}`).toBe(false);
          if (cell.style) expect(() => cellStyleSchema.parse(cell.style)).not.toThrow();
        }
      }
    }
  });

  it('computes template formulas with the real engine', () => {
    const [budget] = buildSheetTemplate(findTemplate('SPREADSHEET', 'sheet-monthly-budget')!, ['b']);
    expect(valueAt(budget!, 'C8')).toBe(4770); // actual income
    expect(valueAt(budget!, 'C19')).toBe(3574); // actual expenses
    expect(valueAt(budget!, 'C21')).toBe(1196);

    const [invoice] = buildSheetTemplate(findTemplate('SPREADSHEET', 'sheet-invoice')!, ['i']);
    expect(valueAt(invoice!, 'D15')).toBe(750);
    expect(valueAt(invoice!, 'D17')).toBe(60);
    expect(valueAt(invoice!, 'D18')).toBe(810);
    expect(formatValue(valueAt(invoice!, 'D18'), 'currency')).toBe('$810.00');

    const [todo] = buildSheetTemplate(findTemplate('SPREADSHEET', 'sheet-todo-list')!, ['t']);
    expect(valueAt(todo!, 'B2')).toBe(1);
    expect(valueAt(todo!, 'D2')).toBe(2);

    const [grades] = buildSheetTemplate(findTemplate('SPREADSHEET', 'sheet-gradebook')!, ['g']);
    expect(valueAt(grades!, 'F4')).toBe(91.3);
    expect(valueAt(grades!, 'G4')).toBe('A');
    expect(valueAt(grades!, 'F8')).toBe(61.3); // (55 + 62 + 70 + 58) / 4 = 61.25
    expect(valueAt(grades!, 'G8')).toBe('D');
    expect(valueAt(grades!, 'G6')).toBe('C'); // 72
  });

  it('form templates only use valid field settings, themes and options', () => {
    for (const t of templatesFor('FORM')) {
      expect(() => formThemeSchema.parse(t.theme)).not.toThrow();
      for (const f of t.fields) {
        if (f.settings) expect(() => fieldSettingsSchema.parse(f.settings)).not.toThrow();
        if (f.validation) expect(() => fieldValidationSchema.parse(f.validation)).not.toThrow();
        const choice = (CHOICE_FIELD_TYPES as readonly string[]).includes(f.type);
        expect(choice ? (f.options?.length ?? 0) > 0 : !f.options).toBe(true);
        if (f.type === 'SECTION') expect(f.required).toBeFalsy();
      }
    }
  });

  it('conversational form templates are complete, valid forms', () => {
    const conversational = templatesFor('FORM').filter((t) => t.conversational);
    expect(conversational.map((t) => t.id)).toEqual(['form-nps-survey', 'form-lead-capture', 'form-bug-report', 'form-party-rsvp', 'form-product-feedback']);
    for (const t of conversational) {
      expect(t.settings?.layout, t.id).toBe('conversational');
      expect(t.fields[0]?.type, t.id).toBe('WELCOME');
      expect(t.fields.at(-1)?.type, t.id).toBe('ENDING');
      expect(t.fields.filter((f) => QUESTION_TYPES[f.type].isInput).length, t.id).toBeGreaterThanOrEqual(4);
      const fields = t.fields.map((f, i) =>
        makeField(uid(i + 1), f.type, i, {
          label: f.label,
          description: f.description ?? null,
          required: !!f.required,
          validation: f.validation ?? {},
          settings: f.settings ?? {},
          options: (f.options ?? []).map((label, j) => ({ id: uid(1000 + i * 50 + j), label, kind: 'option' as const, imageUrl: null, value: null, position: j })),
        }),
      );
      for (const f of fields) expect(fieldStateProblem(f), `${t.id} ${f.label}`).toBeNull();
      expect(validateDefinition({ fields, variables: [] }), t.id).toEqual([]);
    }
  });
});
