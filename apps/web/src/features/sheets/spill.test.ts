import { describe, expect, it } from 'vitest';
import { spillSpan, type SpillInput } from './spill';

const base = (over: Partial<SpillInput>): SpillInput => ({ col: 5, need: 50, align: 'left', colW: () => 100, isEmpty: () => true, minCol: 0, maxCol: 25, ...over });

describe('spillSpan', () => {
  it('stays in its cell when the content fits', () => {
    expect(spillSpan(base({ need: 100 }))).toEqual({ from: 5, to: 5, fits: true });
  });

  it('left-aligned text spills right over empty cells, stopping at the first filled one', () => {
    expect(spillSpan(base({ need: 250 }))).toEqual({ from: 5, to: 7, fits: true });
    expect(spillSpan(base({ need: 450, isEmpty: (c) => c !== 7 }))).toEqual({ from: 5, to: 6, fits: false });
  });

  it('right-aligned content spills left, and not past the pane edge', () => {
    expect(spillSpan(base({ need: 150, align: 'right' }))).toEqual({ from: 4, to: 5, fits: true });
    expect(spillSpan(base({ need: 450, align: 'right', minCol: 3 }))).toEqual({ from: 3, to: 5, fits: false });
  });

  it('centred text spills both ways', () => {
    expect(spillSpan(base({ need: 300, align: 'center' }))).toEqual({ from: 4, to: 6, fits: true });
    expect(spillSpan(base({ need: 300, align: 'center', isEmpty: (c) => c > 5 }))).toEqual({ from: 5, to: 6, fits: false });
  });

  it('skips hidden columns without stopping', () => {
    expect(spillSpan(base({ need: 150, colW: (c) => (c === 6 ? 0 : 100) }))).toEqual({ from: 5, to: 7, fits: true });
  });

  it('does not spill past the last column', () => {
    expect(spillSpan(base({ col: 25, need: 150 }))).toEqual({ from: 25, to: 25, fits: false });
  });
});
