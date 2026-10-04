import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { documentExtensions } from './index';

const schema = getSchema(documentExtensions({ collaborative: true }));
const normalize = (json: unknown) => schema.nodeFromJSON(json).toJSON();

const RICH = {
  type: 'doc',
  content: [
    {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'todo' }] }] },
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'done' }] },
            { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested' }] }] }] },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      attrs: { lineHeight: '1.15' },
      content: [
        { type: 'text', text: 'H' },
        { type: 'text', text: '2', marks: [{ type: 'subscript' }] },
        { type: 'text', text: 'O x' },
        { type: 'text', text: '2', marks: [{ type: 'superscript' }] },
        { type: 'text', text: ' styled', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Georgia, serif', fontSize: '14pt' } }] },
      ],
    },
    { type: 'pageBreak' },
    { type: 'paragraph', content: [{ type: 'text', text: 'after' }] },
  ],
};

describe('document schema', () => {
  it('keeps checklists, sub/superscript, fonts, line height and page breaks', () => {
    const c = normalize(RICH) as any;
    expect(c.content[0].type).toBe('taskList');
    expect(c.content[0].content[0].attrs.checked).toBe(false);
    expect(c.content[0].content[1].attrs.checked).toBe(true);
    expect(c.content[0].content[1].content[1].type).toBe('taskList');
    const p = c.content[1];
    expect(p.attrs.lineHeight).toBe('1.15');
    expect(p.content[1].marks).toEqual([{ type: 'subscript' }]);
    expect(p.content[3].marks).toEqual([{ type: 'superscript' }]);
    expect(p.content[4].marks[0].attrs).toMatchObject({ fontFamily: 'Georgia, serif', fontSize: '14pt' });
    expect(c.content[2].type).toBe('pageBreak');
  });

  it('is idempotent', () => {
    const once = normalize(RICH);
    expect(normalize(once)).toEqual(once);
  });

  it('still defaults new documents and blocks to paragraphs (page break must not become the default block)', () => {
    expect(schema.topNodeType.contentMatch.defaultType?.name).toBe('paragraph');
    expect(schema.topNodeType.createAndFill()!.firstChild!.type.name).toBe('paragraph');
  });
});
