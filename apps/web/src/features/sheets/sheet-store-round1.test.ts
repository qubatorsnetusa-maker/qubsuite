import { beforeEach, describe, expect, it } from 'vitest';
import { SheetStore } from './sheet-store';

const SHEET = '11111111-1111-4111-8111-111111111111';

describe('SheetStore round 1', () => {
  let store: SheetStore;
  let sent: { clientOpId: string; ops: unknown[] }[];

  beforeEach(() => {
    localStorage.clear();
    store = new SheetStore('ss-r1');
    sent = [];
    store.send = (clientOpId, ops) => {
      sent.push({ clientOpId, ops });
      return true;
    };
  });

  it('shows typed dates formatted immediately', () => {
    store.apply([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 0, col: 0, input: '2026-09-27' }] }]);
    expect(store.get(SHEET, 0, 0)).toMatchObject({ value: 46292, formattedValue: '2026-09-27', dataType: 'NUMBER', style: { numberFormat: 'date' } });
  });

  it('merges border edges and clears validation optimistically', () => {
    const thin = { style: 'thin', color: '#000000' } as const;
    const range = { startRow: 0, endRow: 0, startCol: 0, endCol: 0 };
    store.apply([{ type: 'setStyle', sheetId: SHEET, range, style: { borders: { top: thin }, validation: { kind: 'checkbox' } } }]);
    store.apply([{ type: 'setStyle', sheetId: SHEET, range, style: { borders: { left: thin }, validation: null } }]);
    expect(store.get(SHEET, 0, 0)!.style).toEqual({ borders: { top: thin, left: thin } });
  });

  it('sends findReplace without optimistic changes and reports replaced cells on ack', () => {
    const seen: unknown[] = [];
    store.onReplaced = (r) => seen.push(...r);
    const inverse = store.apply([{ type: 'findReplace', sheetId: null, find: 'a', replace: 'b', matchCase: false, wholeCell: false, includeFormulas: false }]);
    expect(inverse).toEqual([]);
    const { clientOpId } = sent[0]!;
    store.handle({ type: 'applied', revision: 2, clientOpId, authorClientId: null, ops: [], changes: [], structural: [], replaced: [{ sheetId: SHEET, row: 0, col: 0, previousInput: 'a' }] });
    expect(seen).toEqual([{ sheetId: SHEET, row: 0, col: 0, previousInput: 'a' }]);
  });

  it('knows which cells are loaded', () => {
    expect(store.isLoaded(SHEET, 0, 0)).toBe(false);
    store.markLoaded(SHEET, 0, 0);
    expect(store.isLoaded(SHEET, 5, 5)).toBe(true);
    expect(store.isLoaded(SHEET, 150, 0)).toBe(false);
  });
});

describe('SheetStore sending', () => {
  it('sends each op once, and resends unacknowledged ops only after a reconnect', () => {
    localStorage.clear();
    const store = new SheetStore('ss-send');
    const sent: string[] = [];
    store.send = (clientOpId) => (sent.push(clientOpId), true);
    store.apply([{ type: 'findReplace', sheetId: null, find: 'a', replace: 'aa', matchCase: false, wholeCell: false, includeFormulas: false }]);
    store.apply([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 0, col: 0, input: 'x' }] }]);
    expect(sent).toHaveLength(2);
    expect(new Set(sent).size).toBe(2);
    store.handle({ type: 'welcome', clientId: 'c1', revision: 0, presence: [], self: { id: 'u', name: 'U', color: '#000', avatarUrl: null } as never });
    expect(sent).toHaveLength(4);
    expect(sent.slice(2)).toEqual(sent.slice(0, 2));
  });

  it('retries ops the socket could not send', () => {
    localStorage.clear();
    const store = new SheetStore('ss-retry');
    let online = false;
    const sent: string[] = [];
    store.send = (clientOpId) => (online ? (sent.push(clientOpId), true) : false);
    store.apply([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 0, col: 0, input: 'x' }] }]);
    expect(sent).toHaveLength(0);
    online = true;
    store.apply([{ type: 'setCells', sheetId: SHEET, cells: [{ row: 0, col: 1, input: 'y' }] }]);
    expect(sent).toHaveLength(2);
  });
});
