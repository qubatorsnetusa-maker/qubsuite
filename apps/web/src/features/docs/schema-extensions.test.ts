import { documentExtensions } from '@qub/editor-schema';
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

const editors: Editor[] = [];
const make = (content: string) => {
  const e = new Editor({ extensions: documentExtensions(), content });
  editors.push(e);
  return e;
};
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));

describe('line spacing', () => {
  it('parses allowed values only and renders them back', () => {
    const e = make('<p style="line-height: 1.15">x</p><p style="line-height: 3">y</p>');
    expect(e.getJSON().content?.[0]?.attrs?.lineHeight).toBe('1.15');
    expect(e.getJSON().content?.[1]?.attrs?.lineHeight).toBeNull();
  });

  it('sets and unsets spacing on every block in the selection', () => {
    const e = make('<p>x</p><h2>y</h2>');
    e.commands.selectAll();
    e.commands.setBlockLineHeight('2');
    // StarterKit's trailing node adds an empty paragraph after the heading; it is selected too.
    expect(e.getJSON().content?.map((n) => n.attrs?.lineHeight)).toEqual(['2', '2', '2']);
    expect(e.getHTML()).toContain('<h2 style="line-height: 2;">y</h2>');
    e.commands.unsetBlockLineHeight();
    expect(e.getHTML()).not.toContain('line-height');
  });
});

describe('page break', () => {
  it('splits the paragraph at the cursor and moves the cursor after the break', () => {
    const e = make('<p>abcd</p>');
    e.commands.setTextSelection(3);
    expect(e.commands.setPageBreak()).toBe(true);
    expect(e.getJSON().content?.map((n) => n.type)).toEqual(['paragraph', 'pageBreak', 'paragraph']);
    expect(e.state.doc.child(2).textContent).toBe('cd');
    expect(e.state.selection.$from.parent.textContent).toBe('cd');
    expect(e.state.selection.$from.parentOffset).toBe(0);
  });

  it('adds an empty paragraph after a break at the end of the document', () => {
    const e = make('<p>ab</p>');
    e.commands.setTextSelection(3);
    e.commands.setPageBreak();
    expect(e.getJSON().content?.map((n) => n.type)).toEqual(['paragraph', 'pageBreak', 'paragraph']);
    expect(e.state.selection.$from.parent.type.name).toBe('paragraph');
    expect(e.state.selection.$from.parent.textContent).toBe('');
  });

  it('is inserted by Ctrl+Enter, but not inside a code block', () => {
    const e = make('<p>ab</p>');
    e.commands.setTextSelection(3);
    e.view.someProp('handleKeyDown', (f) => f(e.view, new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })));
    expect(e.getJSON().content?.map((n) => n.type)).toContain('pageBreak');

    const c = make('<pre><code>x</code></pre>');
    c.commands.setTextSelection(2);
    expect(c.commands.setPageBreak()).toBe(false);
    expect(c.getJSON().content?.map((n) => n.type)).not.toContain('pageBreak');
  });

  it('moves the cursor into the next paragraph when breaking at the end of one', () => {
    const e = make('<p>ab</p><p>cd</p>');
    e.commands.setTextSelection(3);
    e.commands.setPageBreak();
    expect(e.getJSON().content?.map((n) => n.type)).toEqual(['paragraph', 'pageBreak', 'paragraph']);
    expect(e.state.selection.$from.parent.textContent).toBe('cd');
  });

  it('round-trips through HTML', () => {
    const e = make('<p>a</p><div data-type="page-break"></div><p>b</p>');
    expect(e.getHTML()).toContain('<div data-type="page-break" class="qub-manual-break"></div>');
  });
});

describe('style attributes from collaborators are sanitised', () => {
  // Attributes arriving through Yjs/JSON skip parseHTML validation; rendering must not let them inject CSS.
  const crafted = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        attrs: { lineHeight: '1;background:url(//evil.example/x)' },
        content: [{ type: 'text', text: 'x', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial;background:url(//evil.example/y)' } }] }],
      },
    ],
  };

  it('drops line heights and font families that are not plain values', () => {
    const e = new Editor({ extensions: documentExtensions(), content: crafted });
    editors.push(e);
    expect(e.getHTML()).not.toContain('evil.example');
    expect(e.getHTML()).not.toContain('background');
  });

  it('still renders legitimate values, including quoted family names', () => {
    const e = make('<p style="line-height: 1.5"><span style="font-family: &quot;Times New Roman&quot;, Times, serif">x</span></p>');
    expect(e.getHTML()).toContain('line-height: 1.5');
    expect(e.getHTML()).toContain('font-family: &quot;Times New Roman&quot;, Times, serif');
  });
});

describe('page breaks stay top-level so pagination and print honour them', () => {
  const topTypes = (e: Editor) => e.getJSON().content?.map((n) => n.type);

  it('inside a list, the break goes after the whole list', () => {
    const e = make('<ul><li><p>abcd</p></li></ul><p>next</p>');
    e.commands.setTextSelection(4);
    expect(e.commands.setPageBreak()).toBe(true);
    expect(topTypes(e)).toEqual(['bulletList', 'pageBreak', 'paragraph']);
    expect(JSON.stringify(e.getJSON().content?.[0])).not.toContain('pageBreak');
    expect(e.state.selection.$from.parent.textContent).toBe('next');
  });

  it('inside a table cell, the break goes after the table (adding a paragraph when needed)', () => {
    const e = make('<table><tbody><tr><td><p>cell</p></td></tr></tbody></table>');
    e.commands.setTextSelection(5);
    e.commands.setPageBreak();
    expect(topTypes(e)?.slice(0, 3)).toEqual(['table', 'pageBreak', 'paragraph']);
    expect(e.state.selection.$from.parent.type.name).toBe('paragraph');
  });

  it('with an image selected, the break goes after it instead of replacing it', () => {
    const e = make('<p>a</p><img src="https://example.com/x.png"><p>b</p>');
    e.commands.setNodeSelection(3);
    expect(e.state.selection.$from.nodeAfter?.type.name).toBe('image');
    e.commands.setPageBreak();
    expect(topTypes(e)).toEqual(['paragraph', 'image', 'pageBreak', 'paragraph']);
  });
});
