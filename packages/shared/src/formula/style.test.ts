import { describe, expect, it } from 'vitest';
import { cellStyleSchema } from '../schemas/sheets';
import { mergeStyle } from './style';

const thin = { style: 'thin', color: '#000000' } as const;

describe('mergeStyle', () => {
  it('merges, deletes null keys and returns null when empty', () => {
    expect(mergeStyle({ bold: true }, { italic: true })).toEqual({ bold: true, italic: true });
    expect(mergeStyle({ bold: true, validation: { kind: 'checkbox' } }, { validation: null })).toEqual({ bold: true });
    expect(mergeStyle({ bold: true }, { bold: undefined })).toEqual({ bold: true });
    expect(mergeStyle({ wrap: true }, { wrap: null as never })).toBeNull();
  });

  it('merges borders per edge and clears them', () => {
    const a = mergeStyle(null, { borders: { top: thin } });
    expect(mergeStyle(a, { borders: { left: thin } })).toEqual({ borders: { top: thin, left: thin } });
    expect(mergeStyle(a, { borders: { top: null } })).toBeNull();
    expect(mergeStyle({ bold: true, borders: { top: thin } }, { borders: null })).toEqual({ bold: true });
  });
});

describe('cellStyleSchema', () => {
  it('accepts the new fields and rejects bad values', () => {
    expect(cellStyleSchema.safeParse({ wrap: true, numberFormat: 'date', borders: { top: thin, left: null }, validation: { kind: 'list', values: ['a', 'b'] } }).success).toBe(true);
    expect(cellStyleSchema.safeParse({ borders: { top: { style: 'dotted', color: '#000000' } } }).success).toBe(false);
    expect(cellStyleSchema.safeParse({ validation: { kind: 'list', values: ['a', 'a'] } }).success).toBe(false);
    expect(cellStyleSchema.safeParse({ validation: { kind: 'list', values: [] } }).success).toBe(false);
  });
});
