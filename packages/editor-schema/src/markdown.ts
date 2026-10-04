import type { JSONContent } from '@tiptap/core';

type MdMark = { type: 'link' | 'bold' | 'italic' | 'strike'; href?: string };
const ORDER = ['link', 'bold', 'italic', 'strike'] as const;
const DELIM = { bold: '**', italic: '*', strike: '~~' } as const;

const escapeText = (s: string) => s.replace(/([\\`*_[\]<>~|])/g, '\\$1');
const escapeUrl = (s: string) => s.replace(/[()\s]/g, (c) => encodeURIComponent(c));
const longestRun = (s: string, ch: string) => Math.max(0, ...(s.match(new RegExp(`\\${ch}+`, 'g')) ?? []).map((r) => r.length));

function codeSpan(text: string, inTable: boolean): string {
  const fence = '`'.repeat(longestRun(text, '`') + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  const out = `${fence}${pad}${text}${pad}${fence}`;
  return inTable ? out.replace(/\|/g, '\\|') : out;
}

function marksOf(node: JSONContent): MdMark[] {
  const out: MdMark[] = [];
  for (const type of ORDER) {
    const m = node.marks?.find((x) => x.type === type);
    if (m) out.push(type === 'link' ? { type, href: String(m.attrs?.href ?? '') } : { type });
  }
  return out;
}

const open = (m: MdMark) => (m.type === 'link' ? '[' : DELIM[m.type]);
const close = (m: MdMark) => (m.type === 'link' ? `](${escapeUrl(m.href ?? '')})` : DELIM[m.type]);
const same = (a: MdMark, b: MdMark) => a.type === b.type && a.href === b.href;

/** Inline content with marks opened/closed across adjacent text nodes; whitespace is kept outside delimiters. */
function inline(content: JSONContent[] | undefined, inTable: boolean): string {
  let out = '';
  let trail = '';
  const stack: MdMark[] = [];
  const closeTo = (n: number) => {
    while (stack.length > n) out += close(stack.pop()!);
  };
  for (const node of content ?? []) {
    if (node.type === 'hardBreak') {
      closeTo(0);
      out += trail + (inTable ? ' ' : '\\\n');
      trail = '';
      continue;
    }
    const text = node.type === 'text' ? (node.text ?? '') : node.type === 'mention' ? `@${node.attrs?.label ?? node.attrs?.id ?? ''}` : '';
    if (!text) continue;
    const isCode = !!node.marks?.some((m) => m.type === 'code');
    const marks = marksOf(node);
    let common = 0;
    while (common < stack.length && common < marks.length && same(stack[common]!, marks[common]!)) common++;
    const lead = isCode ? '' : /^\s*/.exec(text)![0];
    const tail = isCode ? '' : /\s*$/.exec(text)![0];
    const core = isCode ? text : text.slice(lead.length, text.length - tail.length);
    closeTo(common);
    if (!core) {
      out += trail + text;
      trail = '';
      continue;
    }
    out += trail + lead;
    trail = tail;
    for (const m of marks.slice(common)) {
      out += open(m);
      stack.push(m);
    }
    out += isCode ? codeSpan(core, inTable) : escapeText(core);
  }
  closeTo(0);
  out += trail;
  return out;
}

const escapeLineStarts = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/^(\s*)([#+-])/, '$1\\$2').replace(/^(\s*\d+)([.)])/, '$1\\$2'))
    .join('\n');

function indent(s: string, first: string, pad = ' '.repeat(first.length)): string {
  return s
    .split('\n')
    .map((l, i) => (i === 0 ? first + l : l ? pad + l : l))
    .join('\n');
}

function blocks(nodes: JSONContent[] | undefined, sep = '\n\n'): string {
  return (nodes ?? [])
    .map(block)
    .filter((s) => s !== '')
    .join(sep);
}

function flattenCell(node: JSONContent): string {
  if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock') return inline(node.content, true);
  return (node.content ?? []).map(flattenCell).filter(Boolean).join(' ');
}

function table(node: JSONContent): string {
  const rows = (node.content ?? []).map((r) => (r.content ?? []).map(flattenCell));
  if (!rows.length) return '';
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const line = (cells: string[]) => `| ${Array.from({ length: cols }, (_, i) => cells[i] ?? '').join(' | ')} |`;
  return [line(rows[0]!), `| ${Array<string>(cols).fill('---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n');
}

function block(node: JSONContent): string {
  switch (node.type) {
    case 'paragraph':
      return escapeLineStarts(inline(node.content, false));
    case 'heading':
      return `${'#'.repeat(Number(node.attrs?.level ?? 1))} ${inline(node.content, false).replace(/\\\n/g, ' ')}`;
    case 'blockquote':
      return blocks(node.content)
        .split('\n')
        .map((l) => (l ? `> ${l}` : '>'))
        .join('\n');
    case 'codeBlock': {
      const text = (node.content ?? []).map((c) => c.text ?? '').join('');
      const fence = '`'.repeat(Math.max(3, longestRun(text, '`') + 1));
      return `${fence}${node.attrs?.language ?? ''}\n${text}\n${fence}`;
    }
    case 'horizontalRule':
    case 'pageBreak':
      return '---';
    case 'image': {
      const title = node.attrs?.title ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"` : '';
      return `![${escapeText(String(node.attrs?.alt ?? ''))}](${escapeUrl(String(node.attrs?.src ?? ''))}${title})`;
    }
    case 'bulletList':
      return (node.content ?? []).map((li) => indent(blocks(li.content, '\n'), '- ', '  ')).join('\n');
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? []).map((li, i) => indent(blocks(li.content, '\n'), `${start + i}. `)).join('\n');
    }
    case 'taskList':
      return (node.content ?? []).map((li) => indent(blocks(li.content, '\n'), li.attrs?.checked ? '- [x] ' : '- [ ] ', '  ')).join('\n');
    case 'table':
      return table(node);
    default:
      return node.content ? blocks(node.content) : '';
  }
}

/** CommonMark + GFM rendering of a Qub document. Marks without a Markdown equivalent are dropped to plain text. */
export function toMarkdown(doc: JSONContent): string {
  const out = blocks(doc.content);
  return out ? `${out}\n` : '';
}
