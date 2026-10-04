import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { toMarkdown } from './index';

type Mark = { type: string; attrs?: Record<string, unknown> };
const t = (text: string, ...marks: Mark[]): JSONContent => ({ type: 'text', text, ...(marks.length ? { marks } : {}) });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const md = (...content: JSONContent[]) => toMarkdown({ type: 'doc', content });
const bold = { type: 'bold' };
const italic = { type: 'italic' };

describe('toMarkdown', () => {
  it('renders headings and nested emphasis, keeping whitespace outside markers', () => {
    expect(md({ type: 'heading', attrs: { level: 2 }, content: [t('Title')] }, p(t('Hello '), t('bold', bold), t(' and '), t('both', bold, italic), t('.')))).toBe(
      '## Title\n\nHello **bold** and ***both***.\n',
    );
    expect(md(p(t('bold ', bold), t('x')))).toBe('**bold** x\n');
    expect(md(p(t('a', bold), t('b', bold, italic)))).toBe('**a*b***\n');
  });

  it('escapes Markdown syntax in ordinary text', () => {
    expect(md(p(t('# not a heading *really* 1. ok')))).toBe('\\# not a heading \\*really\\* 1. ok\n');
    expect(md(p(t('2. item')))).toBe('2\\. item\n');
    expect(md(p(t('- dash')))).toBe('\\- dash\n');
  });

  it('renders links, code spans, strike and drops unsupported marks', () => {
    expect(md(p(t('site', { type: 'link', attrs: { href: 'https://x.com/a b' } })))).toBe('[site](https://x.com/a%20b)\n');
    expect(md(p(t('a`b', { type: 'code' })))).toBe('``a`b``\n');
    expect(md(p(t('gone', { type: 'strike' })))).toBe('~~gone~~\n');
    expect(md(p(t('u', { type: 'underline' }), t('2', { type: 'subscript' })))).toBe('u2\n');
  });

  it('renders lists, nested lists, ordered start and task lists', () => {
    const li = (...content: JSONContent[]): JSONContent => ({ type: 'listItem', content });
    expect(md({ type: 'bulletList', content: [li(p(t('one'))), li(p(t('two')), { type: 'bulletList', content: [li(p(t('nested')))] })] })).toBe('- one\n- two\n  - nested\n');
    expect(md({ type: 'orderedList', attrs: { start: 3 }, content: [li(p(t('a'))), li(p(t('b')))] })).toBe('3. a\n4. b\n');
    const ti = (checked: boolean, ...content: JSONContent[]): JSONContent => ({ type: 'taskItem', attrs: { checked }, content });
    expect(md({ type: 'taskList', content: [ti(false, p(t('todo'))), ti(true, p(t('done')), { type: 'taskList', content: [ti(false, p(t('sub')))] })] })).toBe(
      '- [ ] todo\n- [x] done\n  - [ ] sub\n',
    );
  });

  it('renders blockquotes, code blocks, rules, page breaks, images, hard breaks and mentions', () => {
    expect(md({ type: 'blockquote', content: [p(t('quote')), p(t('more'))] })).toBe('> quote\n>\n> more\n');
    expect(md({ type: 'codeBlock', attrs: { language: 'ts' }, content: [t('const a = 1;')] })).toBe('```ts\nconst a = 1;\n```\n');
    expect(md({ type: 'codeBlock', attrs: { language: null }, content: [t('```')] })).toBe('````\n```\n````\n');
    expect(md(p(t('a')), { type: 'horizontalRule' }, { type: 'pageBreak' }, p(t('b')))).toBe('a\n\n---\n\n---\n\nb\n');
    expect(md({ type: 'image', attrs: { src: '/api/files/1', alt: 'A [pic]' } })).toBe('![A \\[pic\\]](/api/files/1)\n');
    expect(md(p(t('line1'), { type: 'hardBreak' }, t('line2')))).toBe('line1\\\nline2\n');
    expect(md(p({ type: 'mention', attrs: { id: 'u1', label: 'Bob' } }))).toBe('@Bob\n');
  });

  it('renders GFM tables with the first row as header and escaped pipes', () => {
    const cell = (type: string, text: string): JSONContent => ({ type, content: [p(t(text))] });
    const table: JSONContent = {
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('tableHeader', 'Name'), cell('tableHeader', 'Qty')] },
        { type: 'tableRow', content: [cell('tableCell', 'a|b'), cell('tableCell', '2')] },
      ],
    };
    expect(md(table)).toBe('| Name | Qty |\n| --- | --- |\n| a\\|b | 2 |\n');
  });

  it('returns an empty string for an empty document', () => {
    expect(toMarkdown({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
  });
});
