import { documentExtensions } from '@qub/editor-schema';
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { activeHeadingIndex, extractHeadings } from './outline';

let editor: Editor | null = null;
afterEach(() => editor?.destroy());

describe('extractHeadings', () => {
  it('lists non-empty headings in order with level and position, including nested ones', () => {
    editor = new Editor({ extensions: documentExtensions(), content: '<h1>Title</h1><p>x</p><h2>  </h2><blockquote><h3>Inner</h3></blockquote>' });
    const hs = extractHeadings(editor.state.doc);
    expect(hs.map((h) => [h.level, h.text])).toEqual([
      [1, 'Title'],
      [3, 'Inner'],
    ]);
    expect(editor.state.doc.nodeAt(hs[0]!.pos)?.type.name).toBe('heading');
    expect(editor.state.doc.nodeAt(hs[1]!.pos)?.textContent).toBe('Inner');
  });
});

describe('activeHeadingIndex', () => {
  it('picks the last heading at or above the threshold, or none', () => {
    expect(activeHeadingIndex([-300, -10, 400], 8)).toBe(1);
    expect(activeHeadingIndex([50, 400], 8)).toBe(-1);
    expect(activeHeadingIndex([], 8)).toBe(-1);
  });
});
