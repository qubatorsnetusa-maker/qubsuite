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


/** Converts inline Markdown syntax into semantic HTML */
export function inlineMarkdownToHtml(text: string): string {
  let s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => `<img src="${url.trim()}" alt="${alt}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, linkText, url) => `<a href="${url.trim()}">${linkText}</a>`);
  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  s = s.replace(/(\*{3}|_{3})(.*?)\1/g, '<strong><em>$2</em></strong>');
  s = s.replace(/(\*{2}|_{2})(.*?)\1/g, '<strong>$2</strong>');
  s = s.replace(/(\*{1}|_{1})(.*?)\1/g, '<em>$2</em>');
  s = s.replace(/~~(.*?)~~/g, '<s>$1</s>');
  s = s.replace(/\\\n/g, '<br>');
  return s;
}

/** Converts CommonMark + GFM Markdown into clean semantic HTML suitable for TipTap / ProseMirror */
export function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Fenced Code Block
    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      const lang = fenceMatch[1] ?? '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      i++; // skip closing fence
      const escaped = codeLines.join('\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escaped}</code></pre>`);
      continue;
    }

    // Horizontal Rule
    if (/^(\s*[-*_]\s*){3,}$/.test(line)) {
      html.push('<hr>');
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2] !== undefined) {
      const level = Math.min(4, headingMatch[1].length);
      const text = inlineMarkdownToHtml(headingMatch[2].trim());
      html.push(`<h${level}>${text}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? '')) {
        quoteLines.push((lines[i] ?? '').replace(/^>\s?/, ''));
        i++;
      }
      const quoteHtml = markdownToHtml(quoteLines.join('\n'));
      html.push(`<blockquote>${quoteHtml}</blockquote>`);
      continue;
    }

    // GFM Table
    const nextLine = lines[i + 1] ?? '';
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(nextLine)) {
      const headerLine = line;
      i += 2;
      const parseCells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => inlineMarkdownToHtml(c.trim()));

      const headers = parseCells(headerLine);
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? '').includes('|') && (lines[i] ?? '').trim().length > 0) {
        rows.push(parseCells(lines[i] ?? ''));
        i++;
      }

      let tbl = '<table><thead><tr>';
      for (const h of headers) tbl += `<th><p>${h}</p></th>`;
      tbl += '</tr></thead><tbody>';
      for (const row of rows) {
        tbl += '<tr>';
        for (let c = 0; c < headers.length; c++) {
          tbl += `<td><p>${row[c] || ''}</p></td>`;
        }
        tbl += '</tr>';
      }
      tbl += '</tbody></table>';
      html.push(tbl);
      continue;
    }

    // Task List
    if (/^\s*-\s*\[([ xX])\]\s+(.*)$/.test(line)) {
      let taskListHtml = '<ul data-type="taskList">';
      while (i < lines.length) {
        const curLine = lines[i] ?? '';
        const m = curLine.match(/^\s*-\s*\[([ xX])\]\s+(.*)$/);
        if (!m || !m[1] || m[2] === undefined) break;
        const checked = m[1].toLowerCase() === 'x';
        taskListHtml += `<li data-type="taskItem" data-checked="${checked}"><p>${inlineMarkdownToHtml(m[2])}</p></li>`;
        i++;
      }
      taskListHtml += '</ul>';
      html.push(taskListHtml);
      continue;
    }

    // Bullet List
    if (/^\s*[-*+]\s+(.*)$/.test(line)) {
      let listHtml = '<ul>';
      while (i < lines.length) {
        const curLine = lines[i] ?? '';
        const m = curLine.match(/^\s*[-*+]\s+(.*)$/);
        if (!m || m[1] === undefined) break;
        listHtml += `<li><p>${inlineMarkdownToHtml(m[1])}</p></li>`;
        i++;
      }
      listHtml += '</ul>';
      html.push(listHtml);
      continue;
    }

    // Ordered List
    if (/^\s*\d+\.\s+(.*)$/.test(line)) {
      let listHtml = '<ol>';
      while (i < lines.length) {
        const curLine = lines[i] ?? '';
        const m = curLine.match(/^\s*\d+\.\s+(.*)$/);
        if (!m || m[1] === undefined) break;
        listHtml += `<li><p>${inlineMarkdownToHtml(m[1])}</p></li>`;
        i++;
      }
      listHtml += '</ol>';
      html.push(listHtml);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i] ?? '';
      if (
        !cur.trim() ||
        cur.startsWith('#') ||
        cur.startsWith('```') ||
        /^(\s*[-*_]\s*){3,}$/.test(cur) ||
        /^>\s?/.test(cur) ||
        /^\s*[-*+]\s+/.test(cur) ||
        /^\s*\d+\.\s+/.test(cur)
      ) {
        break;
      }
      paraLines.push(cur);
      i++;
    }
    html.push(`<p>${inlineMarkdownToHtml(paraLines.join(' '))}</p>`);
  }

  return html.join('\n');
}

