import type { SheetServerMessage } from '@qub/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { SheetStore } from './sheet-store';

const SHEET = '11111111-1111-4111-8111-111111111111';

describe('SheetStore', () => {
  let store: SheetStore;
  let sent: { clientOpId: string; ops: unknown[] }[];

  beforeEach(() => {
    localStorage.clear();
    store = new SheetStore('ss-1');
    sent = [];
    store.send = (clientOpId, ops) => {
      sent.push({ clientOpId, ops });
      return true;
    };
  });

  it('applies edits optimistically and sends them', () => {
    store.apply([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 0, col: 0, input: '42' }] }]);
    expect(store.get(SHEET, 0, 0)).toMatchObject({ input: '42', value: 42, formattedValue: '42' });
    expect(sent).toHaveLength(1);
    expect(store.hasPending()).toBe(true);
  });

  it('replaces optimistic state with the server result, including recalculated dependents', () => {
    store.apply([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 0, col: 1, input: '=A1*2' }] }]);
    expect(store.get(SHEET, 0, 1)?.formattedValue).toBe('…');
    const applied: SheetServerMessage = {
      type: 'applied',
      revision: 5,
      clientOpId: sent[0]!.clientOpId,
      authorClientId: 'me',
      ops: [],
      changes: [
        {
          sheetId: SHEET,
          cells: [
            { row: 0, col: 1, input: '=A1*2', value: 84, formattedValue: '84', dataType: 'NUMBER', style: null },
            { row: 3, col: 3, input: '=B1+1', value: 85, formattedValue: '85', dataType: 'NUMBER', style: null },
          ],
          removed: [],
        },
      ],
      structural: [],
    };
    store.handle(applied);
    expect(store.hasPending()).toBe(false);
    expect(store.revision).toBe(5);
    expect(store.get(SHEET, 0, 1)?.value).toBe(84);
    expect(store.get(SHEET, 3, 3)?.value).toBe(85);
  });

  it('does not let remote updates overwrite a cell with a pending local edit', () => {
    store.apply([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 2, col: 2, input: 'mine' }] }]);
    store.handle({
      type: 'applied',
      revision: 2,
      clientOpId: null,
      authorClientId: 'other',
      ops: [],
      changes: [{ sheetId: SHEET, cells: [{ row: 2, col: 2, input: 'theirs', value: 'theirs', formattedValue: 'theirs', dataType: 'STRING', style: null }], removed: [] }],
      structural: [],
    });
    expect(store.get(SHEET, 2, 2)?.input).toBe('mine');
  });

  it('keeps unsent edits across a disconnect and resends them', () => {
    store.send = () => false; // offline
    store.apply([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 0, col: 0, input: 'offline edit' }] }]);
    expect(JSON.parse(localStorage.getItem('qub.sheet.queue.ss-1')!)).toHaveLength(1);
    store.send = (clientOpId, ops) => (sent.push({ clientOpId, ops }), true);
    store.handle({ type: 'welcome', clientId: 'c1', revision: 0, presence: [], self: { id: 'u', email: '', name: 'U', avatarUrl: null, color: '#000', clientId: 'c1' } });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.ops).toEqual([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 0, col: 0, input: 'offline edit' }] }]);
  });

  it('returns inverse operations for undo', () => {
    store.apply([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 0, col: 0, input: 'first' }] }]);
    const inverse = store.apply([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 0, col: 0, input: 'second' }] }]);
    expect(inverse).toEqual([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 0, col: 0, input: 'first' }] }]);
  });
});
