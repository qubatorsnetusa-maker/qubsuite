import type { JSONContent } from '@tiptap/core';
import { toPlainText } from '@qub/editor-schema';

export interface DocSlide {
  id: string;
  title: string;
  subtitle?: string;
  contentNodes: JSONContent[];
  speakerNotes: string[];
}

export interface ExtractSlidesOptions {
  docTitle?: string;
  splitOnHeadings?: boolean; // H1 and H2 trigger a new slide
}

/** Extracts text from a TipTap node */
export function extractNodeText(node: JSONContent): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(extractNodeText).join('');
}

/**
 * Parses a TipTap document into a presentation slide deck.
 * Slides are separated by:
 * - `pageBreak` nodes
 * - `horizontalRule` nodes
 * - `H1` or `H2` headings (when splitOnHeadings is true)
 * Blockquotes prefixed with 'Note:' or 'Notes:' are parsed as speaker notes.
 */
export function extractSlidesFromDoc(doc: JSONContent | null | undefined, options: ExtractSlidesOptions = {}): DocSlide[] {
  const { docTitle = 'Untitled Presentation', splitOnHeadings = true } = options;
  const nodes = doc?.content ?? [];

  if (nodes.length === 0) {
    return [
      {
        id: 'slide-0',
        title: docTitle,
        contentNodes: [],
        speakerNotes: [],
      },
    ];
  }

  const rawSlides: JSONContent[][] = [];
  let currentSlideNodes: JSONContent[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) continue;

    // Boundary 1: Explicit page break or horizontal rule
    if (node.type === 'pageBreak' || node.type === 'horizontalRule') {
      if (currentSlideNodes.length > 0) {
        rawSlides.push(currentSlideNodes);
        currentSlideNodes = [];
      }
      continue;
    }

    // Boundary 2: Headings (H1 and H2)
    const isHeading = node.type === 'heading' && (node.attrs?.level === 1 || node.attrs?.level === 2);
    if (splitOnHeadings && isHeading && currentSlideNodes.length > 0) {
      rawSlides.push(currentSlideNodes);
      currentSlideNodes = [node];
      continue;
    }

    currentSlideNodes.push(node);
  }

  if (currentSlideNodes.length > 0) {
    rawSlides.push(currentSlideNodes);
  }

  // If no slides were formed (e.g. only empty pagebreaks)
  if (rawSlides.length === 0) {
    return [
      {
        id: 'slide-0',
        title: docTitle,
        contentNodes: [],
        speakerNotes: [],
      },
    ];
  }

  return rawSlides.map((slideNodes, idx) => {
    let title = '';
    let subtitle: string | undefined;
    const contentNodes: JSONContent[] = [];
    const speakerNotes: string[] = [];

    for (let j = 0; j < slideNodes.length; j++) {
      const node = slideNodes[j]!;

      // Check for speaker notes (blockquote starting with Note: / Notes:)
      if (node.type === 'blockquote') {
        const text = toPlainText({ type: 'doc', content: [node] }).trim();
        if (/^notes?:/i.test(text)) {
          speakerNotes.push(text.replace(/^notes?:\s*/i, ''));
          continue;
        }
      }

      // Check for slide Title
      if (!title && node.type === 'heading') {
        title = extractNodeText(node).trim();
        continue;
      }

      // If slide 0 and first node is title, second node is H2 or paragraph, consider as subtitle
      if (idx === 0 && title && !subtitle && (node.type === 'heading' || (node.type === 'paragraph' && slideNodes.length <= 3))) {
        subtitle = extractNodeText(node).trim();
        continue;
      }

      contentNodes.push(node);
    }

    return {
      id: `slide-${idx + 1}`,
      title: title || (idx === 0 ? docTitle : `Slide ${idx + 1}`),
      subtitle,
      contentNodes,
      speakerNotes,
    };
  });
}
