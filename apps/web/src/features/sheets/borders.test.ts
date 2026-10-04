import { describe, expect, it } from 'vitest';
import { effectiveEdge, resolveBorders } from './borders';

const thin = { style: 'thin', color: '#000000' } as const;
const thick = { style: 'thick', color: '#ff0000' } as const;
const range = { startRow: 1, endRow: 3, startCol: 1, endCol: 2 };

describe('resolveBorders', () => {
  it('all / clear cover the whole range in one op', () => {
    expect(resolveBorders('s', range, 'all', thin)).toEqual([{ type: 'setStyle', sheetId: 's', range, style: { borders: { top: thin, right: thin, bottom: thin, left: thin } } }]);
    expect(resolveBorders('s', range, 'clear', thin)).toEqual([{ type: 'setStyle', sheetId: 's', range, style: { borders: null } }]);
  });
  it('outer sets only the perimeter edges', () => {
    const ops = resolveBorders('s', range, 'outer', thin);
    expect(ops).toContainEqual({ type: 'setStyle', sheetId: 's', range: { ...range, endRow: 1 }, style: { borders: { top: thin } } });
    expect(ops).toContainEqual({ type: 'setStyle', sheetId: 's', range: { ...range, startRow: 3 }, style: { borders: { bottom: thin } } });
    expect(ops).toContainEqual({ type: 'setStyle', sheetId: 's', range: { ...range, endCol: 1 }, style: { borders: { left: thin } } });
    expect(ops).toContainEqual({ type: 'setStyle', sheetId: 's', range: { ...range, startCol: 2 }, style: { borders: { right: thin } } });
    expect(ops).toHaveLength(4);
  });
  it('inner sets bottoms of all but the last row and rights of all but the last column', () => {
    expect(resolveBorders('s', range, 'inner', thin)).toEqual([
      { type: 'setStyle', sheetId: 's', range: { ...range, endRow: 2 }, style: { borders: { bottom: thin } } },
      { type: 'setStyle', sheetId: 's', range: { ...range, endCol: 1 }, style: { borders: { right: thin } } },
    ]);
    expect(resolveBorders('s', { startRow: 0, endRow: 0, startCol: 0, endCol: 0 }, 'inner', thin)).toEqual([]);
  });
});

describe('effectiveEdge', () => {
  it('heavier wins; ties go to the neighbour below/right', () => {
    expect(effectiveEdge(thin, thick)).toBe(thick);
    expect(effectiveEdge(thick, thin)).toBe(thick);
    const other = { style: 'thin', color: '#00ff00' } as const;
    expect(effectiveEdge(thin, other)).toBe(other);
    expect(effectiveEdge(null, undefined)).toBeNull();
  });
});
