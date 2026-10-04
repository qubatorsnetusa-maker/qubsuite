import { documentExtensions } from '@qub/editor-schema';
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { clearFind, findMatches, FindReplace, getFindState, replaceAll, replaceCurrent, setFindQuery, stepMatch } from './find-replace';

const editors: Editor[] = [];
const make = (content: string) => {
  const e = new Editor({ extensions: [...documentExtensions(), FindReplace], content });
  editors.push(e);
  return e;
};
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));

describe('findMatches', () => {
  it('matches case-insensitively by default and case-sensitively on request', () => {
    const e = make('<p>Alpha alpha ALPHA</p>');
    expect(findMatches(e.state.doc, 'alpha', false)).toHaveLength(3);
    expect(findMatches(e.state.doc, 'alpha', true)).toEqual([{ from: 7, to: 12 }]);
  });

  it('matches across mark boundaries but not across blocks or inline atoms', () => {
    expect(findMatches(make('<p>foo<strong>bar</strong>baz</p>').state.doc, 'obarb', false)).toEqual([{ from: 3, to: 8 }]);
    expect(findMatches(make('<p>ab</p><p>cd</p>').state.doc, 'bc', false)).toEqual([]);
    const br = make('<p>ab<br>cd</p>');
    expect(findMatches(br.state.doc, 'bc', false)).toEqual([]);
    expect(findMatches(br.state.doc, 'cd', false)).toEqual([{ from: 4, to: 6 }]);
  });

  it('finds non-overlapping matches and keeps positions right for length-changing lowercase', () => {
    expect(findMatches(make('<p>aaaa</p>').state.doc, 'aa', false)).toHaveLength(2);
    expect(findMatches(make('<p>İstanbul</p>').state.doc, 'stan', false)).toEqual([{ from: 2, to: 6 }]);
  });

  it('returns nothing for an empty query', () => {
    expect(findMatches(make('<p>abc</p>').state.doc, '', false)).toEqual([]);
  });
});

describe('find plugin', () => {
  it('highlights all matches and marks the current one; steps and wraps', () => {
    const e = make('<p>Alpha alpha ALPHA</p>');
    e.commands.setTextSelection(1);
    setFindQuery(e.view, 'alpha', false);
    expect(e.view.dom.querySelectorAll('.qub-find-match')).toHaveLength(3);
    expect(e.view.dom.querySelectorAll('.qub-find-current')).toHaveLength(1);
    expect(getFindState(e.state).index).toBe(0);
    stepMatch(e.view, -1);
    expect(getFindState(e.state).index).toBe(2);
    stepMatch(e.view, 1);
    expect(getFindState(e.state).index).toBe(0);
    clearFind(e.view);
    expect(e.view.dom.querySelectorAll('.qub-find-match')).toHaveLength(0);
  });

  it('replace all is one transaction and one undo step', () => {
    const e = make('<p>Alpha alpha ALPHA</p>');
    setFindQuery(e.view, 'alpha', false);
    expect(replaceAll(e.view, 'beta')).toBe(3);
    expect(e.getText()).toBe('beta beta beta');
    expect(getFindState(e.state).matches).toHaveLength(0);
    e.commands.undo();
    expect(e.getText()).toBe('Alpha alpha ALPHA');
  });

  it('keeps the formatting at the start of each replaced match', () => {
    const e = make('<p><strong>alpha</strong> x</p>');
    setFindQuery(e.view, 'alpha', false);
    replaceAll(e.view, 'beta');
    expect(e.getHTML()).toBe('<p><strong>beta</strong> x</p>');
  });

  it('replace advances past replacement text that contains the query', () => {
    const e = make('<p>a a</p>');
    e.commands.setTextSelection(1);
    setFindQuery(e.view, 'a', false);
    expect(replaceCurrent(e.view, 'aa')).toBe(true);
    expect(e.getText()).toBe('aa a');
    const s = getFindState(e.state);
    expect(s.matches).toHaveLength(3);
    expect(s.matches[s.index]).toEqual({ from: 4, to: 5 });
  });

  it('empty replacement deletes the match', () => {
    const e = make('<p>xay</p>');
    setFindQuery(e.view, 'a', false);
    replaceCurrent(e.view, '');
    expect(e.getText()).toBe('xy');
  });

  it('recomputes when the document changes underneath (e.g. a collaborator deletes the current match)', () => {
    const e = make('<p>x y x</p>');
    e.commands.setTextSelection(1);
    setFindQuery(e.view, 'x', false);
    expect(getFindState(e.state).index).toBe(0);
    e.commands.deleteRange({ from: 1, to: 2 });
    const s = getFindState(e.state);
    expect(s.matches).toHaveLength(1);
    expect(e.state.doc.textBetween(s.matches[s.index]!.from, s.matches[s.index]!.to)).toBe('x');
  });

  it('keeps the current match when a collaborator edit arrives as a whole-document replace (y-tiptap)', () => {
    const e = make('<p>x1 x2 x3 x4 x5</p><p>tail</p>');
    e.commands.setTextSelection(1);
    setFindQuery(e.view, 'x', false);
    stepMatch(e.view, 1);
    stepMatch(e.view, 1);
    expect(getFindState(e.state).index).toBe(2); // "x3"
    // A remote collaborator types in the second paragraph; y-tiptap replaces the whole document content.
    const remote = e.schema.nodeFromJSON({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'x1 x2 x3 x4 x5' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'tail!' }] },
      ],
    });
    e.view.dispatch(e.state.tr.replaceWith(0, e.state.doc.content.size, remote.content));
    const s = getFindState(e.state);
    expect(s.matches).toHaveLength(5);
    expect(s.index).toBe(2);

    // A remote edit before the current match shifts it but keeps it current.
    const before = e.schema.nodeFromJSON({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hi x1 x2 x3 x4 x5' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'tail!' }] },
      ],
    });
    e.view.dispatch(e.state.tr.replaceWith(0, e.state.doc.content.size, before.content));
    const t = getFindState(e.state);
    expect(e.state.doc.textBetween(t.matches[t.index]!.from, t.matches[t.index]!.to + 1)).toBe('x3');
  });

  it('refuses to replace in a read-only editor', () => {
    const e = make('<p>abc</p>');
    setFindQuery(e.view, 'b', false);
    e.setEditable(false);
    expect(replaceAll(e.view, 'z')).toBe(0);
    expect(replaceCurrent(e.view, 'z')).toBe(false);
    expect(e.getText()).toBe('abc');
  });
});
