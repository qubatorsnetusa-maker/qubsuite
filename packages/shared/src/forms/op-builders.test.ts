import { describe, expect, it } from 'vitest';
import type { FormDto } from '../types';
import { makeField, makeForm, makeVariable, uid } from './__fixtures__/form-dto';
import {
  addFieldTx,
  createVariableTx,
  deleteFieldTx,
  deleteVariableTx,
  duplicateFieldTx,
  fieldSetTx,
  formSetTx,
  logicTx,
  moveFieldTx,
  themeSetTx,
  updateVariableTx,
} from './op-builders';
import { applyTx, invertTx, type OpTx, type SetOp } from './ops';
import { txProblem } from './ops-validate';

const W = uid(1), A = uid(2), B = uid(3), E = uid(4), V = uid(10);
const opt = (n: number, label: string) => ({ id: uid(100 + n), label, kind: 'option' as const, imageUrl: null, value: null, position: n - 1 });
const rule = (id: number, fieldId: string, extra: object) => ({
  id: uid(id), fieldId, operator: null, value: null, trigger: 'ON_LEAVE' as const, scope: 'FIELD' as const, condition: { all: [] }, action: 'END_FORM' as const,
  targetSectionId: null, targetFieldId: null, targetVariableId: null, payload: null, position: 0, ...extra,
});
const form = (): FormDto =>
  makeForm(
    [
      makeField(W, 'WELCOME', 0, { ref: 'w' }),
      makeField(A, 'MULTIPLE_CHOICE', 1, { ref: 'color', label: 'Color', options: [opt(1, 'Red'), opt(2, 'Blue')] }),
      makeField(B, 'SHORT_ANSWER', 2, { ref: 'why', rules: [rule(60, B, { action: 'JUMP_TO_FIELD', targetFieldId: E })] }),
      makeField(E, 'ENDING', 3, { ref: 'end' }),
    ],
    { variables: [makeVariable(V, 'total', 0)] },
  );

/** Every builder's transaction must apply cleanly and undo back to the starting form. */
function roundTrip(f: FormDto, tx: OpTx | null) {
  expect(tx).not.toBeNull();
  const done = applyTx(f, tx!);
  expect(applyTx(done, invertTx(tx!))).toEqual(f);
  return done;
}

describe('field edits', () => {
  it('sets top-level and nested paths and unsets settings keys', () => {
    const f = form();
    const done = roundTrip(f, fieldSetTx(f, A, { label: 'Colour', required: true, settings: { shuffleOptions: true } }));
    expect(done.fields[1]).toMatchObject({ label: 'Colour', required: true, settings: { shuffleOptions: true } });
    const unset = fieldSetTx(done, A, { settings: { shuffleOptions: undefined } });
    expect(unset!.ops[0]).toMatchObject({ kind: 'set', changes: { 'settings.shuffleOptions': { from: true, to: null } } });
    expect(fieldSetTx(f, A, { label: 'Color' })).toBeNull();
  });

  it('changes type through changeFieldType', () => {
    const f = form();
    const done = roundTrip(f, fieldSetTx(f, A, { type: 'SHORT_ANSWER' }));
    expect(done.fields[1]).toMatchObject({ type: 'SHORT_ANSWER', options: [] });
  });

  it('assigns ids to new options and drops legacy rules that pointed at removed options', () => {
    const legacy = rule(61, A, { operator: 'EQUALS', value: uid(102), scope: 'SECTION', action: 'SUBMIT_FORM' });
    const f0 = form();
    const f = { ...f0, fields: f0.fields.map((x) => (x.id === A ? { ...x, rules: [legacy] } : x)) };
    const done = roundTrip(f, fieldSetTx(f, A, { options: [{ id: uid(101), label: 'Red' }, { label: 'Green' }] }));
    expect(done.fields[1]!.options.map((o) => o.label)).toEqual(['Red', 'Green']);
    expect(done.fields[1]!.options[1]!.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(done.fields[1]!.rules).toEqual([]);
  });

  describe('a stored default that an edit would invalidate', () => {
    it('is cleared, in the same tx, when the option it points to is removed; undo restores both', () => {
      const f0 = form();
      const withDefault = { ...f0, fields: f0.fields.map((x) => (x.id === A ? { ...x, defaultValue: uid(101) } : x)) };
      const changeTx = fieldSetTx(withDefault, A, { options: [{ id: uid(102), label: 'Blue' }] });
      expect(changeTx!.ops[0]).toMatchObject({ changes: { defaultValue: { from: uid(101), to: null } } });
      const done = roundTrip(withDefault, changeTx);
      expect(done.fields[1]).toMatchObject({ defaultValue: null });
    });

    it('is cleared when a tightened bound no longer fits it', () => {
      const f0 = form();
      const withDefault = { ...f0, fields: f0.fields.map((x) => (x.id === B ? { ...x, defaultValue: 'a long answer here' } : x)) };
      const done = roundTrip(withDefault, fieldSetTx(withDefault, B, { validation: { maxLength: 5 } }));
      expect(done.fields[2]).toMatchObject({ defaultValue: null, validation: { maxLength: 5 } });
    });

    it('is cleared when the type change leaves it invalid, via the same path changeFieldType uses', () => {
      const f0 = form();
      const withDefault = { ...f0, fields: f0.fields.map((x) => (x.id === A ? { ...x, defaultValue: uid(101) } : x)) };
      const done = roundTrip(withDefault, fieldSetTx(withDefault, A, { type: 'NUMBER' }));
      expect(done.fields[1]).toMatchObject({ type: 'NUMBER', defaultValue: null });
    });

    it('is left untouched when the input is unrelated and the default still validates', () => {
      const f0 = form();
      const withDefault = { ...f0, fields: f0.fields.map((x) => (x.id === A ? { ...x, defaultValue: uid(101) } : x)) };
      const done = roundTrip(withDefault, fieldSetTx(withDefault, A, { label: 'Colour' }));
      expect(done.fields[1]).toMatchObject({ label: 'Colour', defaultValue: uid(101) });
    });

    it('is not overridden when the input itself sets defaultValue, even to something invalid', () => {
      const f = form();
      const done = roundTrip(f, fieldSetTx(f, A, { defaultValue: 'not-an-option-id' }));
      expect(done.fields[1]!.defaultValue).toBe('not-an-option-id');
    });
  });
});

describe('form and theme', () => {
  it('turns on sign-in when limiting to one response', () => {
    const f = form();
    const done = roundTrip(f, formSetTx(f, { settings: { limitOneResponse: true } }));
    expect(done.settings).toMatchObject({ limitOneResponse: true, requireSignIn: true });
  });
  it('updates title, description and theme', () => {
    const f = form();
    expect(roundTrip(f, formSetTx(f, { title: 'Survey', description: 'Hi' }))).toMatchObject({ title: 'Survey', description: 'Hi' });
    expect(roundTrip(f, themeSetTx(f, { ...f.theme, primaryColor: '#1a73e8', headerImageUrl: '' })).theme.primaryColor).toBe('#1a73e8');
    expect(themeSetTx(f, { ...f.theme })).toBeNull();
  });
  it('cleans a new title exactly as the server stores it, so undo expects the stored name', () => {
    const f = form();
    const tx = formSetTx(f, { title: 'Survey: Q3?' }, 'Rename form')!;
    expect(tx.ops[0]).toMatchObject({ kind: 'set', entity: 'form', changes: { title: { to: 'Survey Q3' } } });
    expect(roundTrip(f, tx).title).toBe('Survey Q3');
    expect(formSetTx(f, { title: `${f.title}?` })).toBeNull();
  });

  it('themeSetTx emits one change per changed extras key', () => {
    const baseForm = { ...form(), theme: { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans' as const, headerImageUrl: null, extras: {} } };
    const t = themeSetTx(baseForm, { ...baseForm.theme, extras: { fontPair: 'lora' } })!;
    expect(Object.keys((t.ops[0] as SetOp).changes)).toEqual(['extras.fontPair']);
  });

  it('themeSetTx treats a nested background object as a single change', () => {
    const baseForm = { ...form(), theme: { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans' as const, headerImageUrl: null, extras: { background: { kind: 'color' as const } } } };
    const next = { ...baseForm.theme, extras: { background: { kind: 'gradient' as const, from: '#000000', to: '#ffffff', angle: 160 } } };
    const change = (themeSetTx(baseForm, next)!.ops[0] as SetOp).changes['extras.background']!;
    expect(change.from).toEqual({ kind: 'color' });
    expect(change.to).toEqual({ kind: 'gradient', from: '#000000', to: '#ffffff', angle: 160 });
  });

  it('themeSetTx returns null when nothing changed', () => {
    const baseForm = { ...form(), theme: { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans' as const, headerImageUrl: null, extras: { fontPair: 'lora' as const } } };
    expect(themeSetTx(baseForm, baseForm.theme)).toBeNull();
  });
});

describe('logic', () => {
  it('builds v2 rules and reuses ids of unchanged rules', () => {
    const f = form();
    const out = [{ condition: { all: [] }, action: 'JUMP_TO_FIELD' as const, targetFieldId: E }];
    expect(logicTx(f, B, out)).toBeNull();
    const done = roundTrip(f, logicTx(f, B, [...out, { condition: { all: [] }, action: 'END_FORM' as const }]));
    expect(done.fields[2]!.rules.map((r) => r.id)[0]).toBe(uid(60));
    expect(done.fields[2]!.rules[1]).toMatchObject({ fieldId: B, action: 'END_FORM', position: 1, operator: null });
  });
});

describe('structure', () => {
  it('adds questions between the welcome screen and the endings', () => {
    const f = form();
    const { tx, fieldId } = addFieldTx(f, 'NUMBER', null);
    const done = roundTrip(f, tx);
    expect(done.fields.map((x) => x.id)).toEqual([W, A, B, fieldId, E]);
    expect(done.fields[3]).toMatchObject({ ref: 'q1', label: 'Untitled question', type: 'NUMBER' });
    expect(roundTrip(f, addFieldTx(f, 'SECTION', W).tx).fields[1]!.type).toBe('SECTION');
    expect(roundTrip(f, addFieldTx(f, 'ENDING', A).tx).fields.at(-1)!.type).toBe('ENDING');
  });

  it('duplicates with fresh ids and remapped conditions', () => {
    const f0 = form();
    const self = rule(62, A, { action: 'END_FORM', condition: { subject: { type: 'field', id: A }, op: 'eq', value: uid(101) } });
    const f = { ...f0, fields: f0.fields.map((x) => (x.id === A ? { ...x, rules: [self] } : x)) };
    const { tx, fieldId } = duplicateFieldTx(f, A)!;
    const done = roundTrip(f, tx);
    const copy = done.fields.find((x) => x.id === fieldId)!;
    expect(copy.label).toBe('Color (copy)');
    expect(copy.options.map((o) => o.id)).not.toContain(uid(101));
    expect(copy.rules[0]!.condition).toEqual({ subject: { type: 'field', id: fieldId }, op: 'eq', value: copy.options[0]!.id });
    expect(duplicateFieldTx(f, W)).toBeNull();
  });

  it('deletes a question together with rules that target it, and undo restores both', () => {
    const f = form();
    const done = roundTrip(f, deleteFieldTx(f, E));
    expect(done.fields.map((x) => x.id)).toEqual([W, A, B]);
    expect(done.fields[2]!.rules).toEqual([]);
  });

  it('moves a question', () => {
    const f = form();
    expect(roundTrip(f, moveFieldTx(f, B, 1)).fields.map((x) => x.id)).toEqual([W, B, A, E]);
    expect(moveFieldTx(f, B, 2)).toBeNull();
  });
});

describe('variables', () => {
  it('creates, updates and deletes (with the rules that set it)', () => {
    const f0 = form();
    const setter = rule(63, A, { action: 'SET_VARIABLE', targetVariableId: V, payload: { value: 1 } });
    const f = { ...f0, fields: f0.fields.map((x) => (x.id === A ? { ...x, rules: [setter] } : x)) };
    const { tx, variableId } = createVariableTx(f, { key: 'bonus', type: 'NUMBER', initialValue: 0, formula: '' });
    expect(roundTrip(f, tx).variables.find((v) => v.id === variableId)).toMatchObject({ key: 'bonus', formula: null, position: 1 });
    expect(roundTrip(f, updateVariableTx(f, V, { formula: '{{color}}' })).variables[0]!.formula).toBe('{{color}}');
    const gone = roundTrip(f, deleteVariableTx(f, V));
    expect(gone.variables).toEqual([]);
    expect(gone.fields[1]!.rules).toEqual([]);
  });
});

describe('server-side validity of builder-produced snapshots', () => {
  it('addFieldTx snapshots pass txProblem for a choice type and a text type', () => {
    const f = form();
    for (const type of ['MULTIPLE_CHOICE', 'SHORT_ANSWER'] as const) {
      const { tx } = addFieldTx(f, type, null);
      const after = applyTx(f, tx);
      expect(txProblem(f, after, tx)).toBeNull();
    }
  });

  it('duplicateFieldTx snapshot passes txProblem', () => {
    const f = form();
    const { tx } = duplicateFieldTx(f, A)!;
    const after = applyTx(f, tx);
    expect(txProblem(f, after, tx)).toBeNull();
  });

  it('logicTx with a minimally specified rule fills defaults that pass txProblem', () => {
    const f = form();
    const tx = logicTx(f, B, [{ condition: { all: [] }, action: 'END_FORM' }])!;
    const after = applyTx(f, tx);
    expect(txProblem(f, after, tx)).toBeNull();
  });

  it('createVariableTx snapshot passes txProblem', () => {
    const f = form();
    const { tx } = createVariableTx(f, { key: 'bonus', type: 'NUMBER', initialValue: 0, formula: '' });
    const after = applyTx(f, tx);
    expect(txProblem(f, after, tx)).toBeNull();
  });
});
