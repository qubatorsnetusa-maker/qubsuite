import { describe, expect, it } from 'vitest';
import { countWords, extractPlainText, textStats, toPlainText } from './index';

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const task = (checked: boolean, text: string) => ({ type: 'taskItem', attrs: { checked }, content: [p(text)] });

describe('plain text', () => {
  it('prefixes checklist items with ☐ / ☑', () => {
    const text = extractPlainText({ type: 'doc', content: [{ type: 'taskList', content: [task(false, 'todo'), task(true, 'done')] }] });
    expect(text).toContain('☐ todo');
    expect(text).toContain('☑ done');
  });

  it('renders a page break as a paragraph gap and trims for download', () => {
    expect(toPlainText({ type: 'doc', content: [p('a'), { type: 'pageBreak' }, p('b')] })).toBe('a\n\nb');
  });

  it('numbers ordered lists and bullets unordered ones in the download, nested lists indented', () => {
    const li = (...content: object[]) => ({ type: 'listItem', content });
    const doc = {
      type: 'doc',
      content: [
        { type: 'orderedList', attrs: { start: 3 }, content: [li(p('three')), li(p('four'), { type: 'bulletList', content: [li(p('sub'))] })] },
        { type: 'bulletList', content: [li(p('dot'))] },
      ],
    };
    expect(toPlainText(doc)).toBe('3. three\n4. four\n   • sub\n\n• dot');
    // Word counts and search text stay marker-free.
    expect(countWords(extractPlainText(doc))).toBe(4);
  });

  it('does not count checklist markers as words', () => {
    expect(countWords('☐ todo\n☑ done')).toBe(2);
    expect(countWords('  ')).toBe(0);
  });

  it('computes stats without newlines or task markers', () => {
    expect(textStats('☐ a b\nc')).toEqual({ words: 3, characters: 4, charactersNoSpaces: 3 });
  });

  it('counts astral characters once', () => {
    expect(textStats('😀 x').characters).toBe(3);
  });
});
