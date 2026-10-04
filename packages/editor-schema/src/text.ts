import type { JSONContent } from '@tiptap/core';

const BLOCKS = ['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem', 'taskItem', 'tableRow', 'tableCell', 'tableHeader'];
const TASK_MARKER = /(^|\n)[☐☑] /g;

/** Plain text of a Tiptap JSON document, used for search indexing, word counts and plain-text download. */
export function extractPlainText(node: JSONContent | null | undefined): string {
  return plainText(node, false);
}

/** "1. " / "• " before each list item, continuation lines (and nested lists) indented to match. */
function markedList(node: JSONContent): string {
  const start = node.type === 'orderedList' && typeof node.attrs?.start === 'number' ? node.attrs.start : 1;
  return (node.content ?? [])
    .map((item, i) => {
      const marker = node.type === 'orderedList' ? `${start + i}. ` : '• ';
      const lines = plainText(item, true).replace(/\n+$/, '').split('\n');
      return `${lines.map((l, j) => (j === 0 ? marker : l ? ' '.repeat(marker.length) : '') + l).join('\n')}\n`;
    })
    .join('');
}

function plainText(node: JSONContent | null | undefined, listMarkers: boolean): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'mention') return `@${node.attrs?.label ?? ''}`;
  if (node.type === 'hardBreak' || node.type === 'pageBreak') return '\n';
  if (listMarkers && (node.type === 'orderedList' || node.type === 'bulletList')) return markedList(node);
  const inner = (node.content ?? []).map((c) => plainText(c, listMarkers)).join(node.type === 'doc' || node.type?.endsWith('List') ? '\n' : '');
  const text = node.type === 'taskItem' ? `${node.attrs?.checked ? '☑' : '☐'} ${inner}` : inner;
  return BLOCKS.includes(node.type ?? '') ? `${text}\n` : text;
}

const stripTaskMarkers = (text: string) => text.replace(TASK_MARKER, '$1');

/** Words in plain text; checklist markers (☐ / ☑) are not words. */
export function countWords(text: string): number {
  const words = stripTaskMarkers(text).trim().match(/\S+/g);
  return words ? words.length : 0;
}

/** Word-count dialog figures. Characters exclude newlines and checklist markers; astral characters count once. */
export function textStats(text: string): { words: number; characters: number; charactersNoSpaces: number } {
  const clean = stripTaskMarkers(text);
  return {
    words: countWords(clean),
    characters: [...clean.replace(/\n/g, '')].length,
    charactersNoSpaces: [...clean.replace(/\s/g, '')].length,
  };
}

/** Plain text for download: list markers, runs of blank lines collapsed, trimmed. */
export function toPlainText(doc: JSONContent): string {
  return plainText(doc, true).replace(/\n{3,}/g, '\n\n').trim();
}

/** Mentioned user ids in a document. */
export function extractMentions(node: JSONContent | null | undefined, out = new Set<string>()): Set<string> {
  if (!node) return out;
  if (node.type === 'mention' && typeof node.attrs?.id === 'string') out.add(node.attrs.id);
  node.content?.forEach((c) => extractMentions(c, out));
  return out;
}
