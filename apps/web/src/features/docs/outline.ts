import type { Node as PMNode } from '@tiptap/pm/model';

export interface OutlineHeading {
  level: number;
  text: string;
  pos: number;
}

/** Non-empty headings anywhere in the document, in order. */
export function extractHeadings(doc: PMNode): OutlineHeading[] {
  const out: OutlineHeading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return true;
    const text = node.textContent.trim();
    if (text) out.push({ level: node.attrs.level as number, text, pos });
    return false;
  });
  return out;
}

/** Index of the heading whose section is at the top of the viewport: the last one whose top is at or above `threshold`. */
export function activeHeadingIndex(tops: number[], threshold: number): number {
  let active = -1;
  tops.forEach((top, i) => {
    if (top <= threshold) active = i;
  });
  return active;
}
