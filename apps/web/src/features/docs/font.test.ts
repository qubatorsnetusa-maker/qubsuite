import { documentExtensions } from '@qub/editor-schema';
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { currentFontSize, FontSizeShortcuts, parseFontSizeInput, parsePt, stepFontSize } from './font';

const editors: Editor[] = [];
const make = (content: string, withShortcuts = false) => {
  const e = new Editor({ extensions: withShortcuts ? [...documentExtensions(), FontSizeShortcuts] : documentExtensions(), content });
  editors.push(e);
  return e;
};
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));

describe('font size helpers', () => {
  it('parses pt values only', () => {
    expect(parsePt('14pt')).toBe(14);
    expect(parsePt('10.5pt')).toBe(10.5);
    expect(parsePt('16px')).toBeNull();
    expect(parsePt(undefined)).toBeNull();
  });

  it('steps through the Google Docs size list and beyond it by one', () => {
    expect(stepFontSize(11, 1)).toBe(12);
    expect(stepFontSize(12, 1)).toBe(14);
    expect(stepFontSize(13, -1)).toBe(12);
    expect(stepFontSize(72, 1)).toBe(73);
    expect(stepFontSize(8, -1)).toBe(7);
    expect(stepFontSize(1, -1)).toBe(1);
    expect(stepFontSize(400, 1)).toBe(400);
  });

  it('accepts typed integers 1–400 only', () => {
    expect(parseFontSizeInput('18')).toBe(18);
    expect(parseFontSizeInput(' 7 ')).toBe(7);
    expect(parseFontSizeInput('0')).toBeNull();
    expect(parseFontSizeInput('401')).toBeNull();
    expect(parseFontSizeInput('1.5')).toBeNull();
    expect(parseFontSizeInput('abc')).toBeNull();
  });
});

describe('currentFontSize and shortcuts', () => {
  it('reports explicit size, heading default, or body default', () => {
    const e = make('<p><span style="font-size: 18pt">big</span> body</p><h2>head</h2>');
    e.commands.setTextSelection(2);
    expect(currentFontSize(e)).toBe(18);
    e.commands.setTextSelection(7);
    expect(currentFontSize(e)).toBe(11);
    e.commands.setTextSelection(e.state.doc.child(0).nodeSize + 2);
    expect(currentFontSize(e)).toBe(16);
  });

  it('Ctrl+Shift+. grows and Ctrl+Shift+, shrinks the selection', () => {
    const e = make('<p>text</p>', true);
    e.commands.selectAll();
    const press = (key: string, keyCode: number) =>
      e.view.someProp('handleKeyDown', (f) => f(e.view, new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey: true, keyCode })));
    press('>', 190);
    expect(e.getHTML()).toContain('font-size: 12pt');
    press('<', 188);
    press('<', 188);
    expect(e.getHTML()).toContain('font-size: 10pt');
  });
});
