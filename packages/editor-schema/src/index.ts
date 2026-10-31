import { Mark, mergeAttributes, type AnyExtension, type JSONContent } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Mention, { type MentionOptions } from '@tiptap/extension-mention';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyleKit } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import { BlockLineHeight } from './block-line-height';
import { PageBreak, PageBreakShortcut } from './page-break';
import { SafeFontFamily } from './safe-font-family';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentAnchor: {
      setCommentAnchor: (anchorId: string) => ReturnType;
      unsetCommentAnchor: (anchorId: string) => ReturnType;
    };
  }
}

/**
 * Marks a text range that comments/suggestions attach to. The anchor travels with the text through
 * collaborative edits (it lives in the Yjs document), while thread content lives in the database.
 * `excludes: ''` lets several anchors overlap.
 */

export const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      layout: {
        default: 'wrap-left',
        parseHTML: (el) =>
          el.getAttribute('data-layout') ||
          (el.style.float === 'right'
            ? 'wrap-right'
            : el.style.float === 'left'
            ? 'wrap-left'
            : el.style.display === 'inline-block'
            ? 'inline'
            : 'break'),
        renderHTML: (attrs) => ({ 'data-layout': attrs.layout || 'wrap-left' }),
      },
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('width') || el.style.width || null,
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (el) => el.getAttribute('height') || el.style.height || null,
        renderHTML: (attrs) => (attrs.height ? { height: attrs.height } : {}),
      },
      offsetX: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-offset-x') || 0),
        renderHTML: (attrs) =>
          attrs.offsetX ? { 'data-offset-x': String(Math.round(Number(attrs.offsetX))) } : {},
      },
      offsetY: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-offset-y') || 0),
        renderHTML: (attrs) =>
          attrs.offsetY ? { 'data-offset-y': String(Math.round(Number(attrs.offsetY))) } : {},
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const layout = HTMLAttributes['data-layout'] || 'wrap-left';
    const ox = Number(HTMLAttributes['data-offset-x'] || 0);
    const oy = Number(HTMLAttributes['data-offset-y'] || 0);
    let style = '';
    if (layout === 'wrap-left') {
      style = 'float: left; margin: 0.5rem 1.25rem 0.5rem 0; max-width: 65%; clear: left;';
    } else if (layout === 'wrap-right') {
      style = 'float: right; margin: 0.5rem 0 0.5rem 1.25rem; max-width: 65%; clear: right;';
    } else if (layout === 'inline') {
      style = 'display: inline-block; vertical-align: middle; margin: 0 0.25rem;';
    } else {
      style = 'display: block; margin: 1rem auto; clear: both;';
    }
    if (HTMLAttributes.width) {
      const w = String(HTMLAttributes.width);
      style += ` width: ${w.endsWith('%') || w.endsWith('px') ? w : `${w}px`};`;
    }
    if (ox || oy) {
      style += ` position: relative; transform: translate3d(${ox}px, ${oy}px, 0);`;
    }
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { style })];
  },
});

export const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) => el.style.backgroundColor || null,
        renderHTML: (attrs) => {
          if (!attrs.backgroundColor) return {};
          return { style: `background-color: ${attrs.backgroundColor}` };
        },
      },
    };
  },
});

export const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (el) => el.style.backgroundColor || null,
        renderHTML: (attrs) => {
          if (!attrs.backgroundColor) return {};
          return { style: `background-color: ${attrs.backgroundColor}` };
        },
      },
    };
  },
});

export const CommentAnchor = Mark.create({
  name: 'commentAnchor',
  excludes: '',
  inclusive: false,
  addAttributes() {
    return {
      anchorId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-anchor-id'),
        renderHTML: (attrs) => ({ 'data-anchor-id': attrs.anchorId }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-anchor-id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'comment-anchor' }), 0];
  },
  addCommands() {
    return {
      setCommentAnchor:
        (anchorId) =>
        ({ commands }) =>
          commands.setMark(this.name, { anchorId }),
      unsetCommentAnchor:
        (anchorId) =>
        ({ tr, state, dispatch }) => {
          const type = state.schema.marks.commentAnchor!;
          state.doc.descendants((node, pos) => {
            for (const mark of node.marks) {
              if (mark.type === type && mark.attrs.anchorId === anchorId) {
                tr.removeMark(pos, pos + node.nodeSize, mark);
              }
            }
          });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});

export interface DocumentExtensionOptions {
  /** Collaboration supplies its own Yjs-aware history, so the built-in one must be disabled. */
  collaborative?: boolean;
  mention?: Partial<MentionOptions>;
}

/** The single source of truth for the Qub Docs schema, shared by the editor and the server. */
export function documentExtensions(options: DocumentExtensionOptions = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      undoRedo: options.collaborative ? false : undefined,
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'], HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } },
    }),
    TextStyleKit.configure({ fontFamily: false, lineHeight: false }),
    SafeFontFamily,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    CustomImage.configure({ inline: false, allowBase64: false }),
    TableKit.configure({
      table: { resizable: true, handleWidth: 6, cellMinWidth: 40, lastColumnResizable: true },
      tableCell: false,
      tableHeader: false,
    }),
    CustomTableCell,
    CustomTableHeader,
    Mention.configure({
      HTMLAttributes: { class: 'mention' },
      renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
      ...options.mention,
    }),
    CommentAnchor,
    TaskList,
    TaskItem.configure({ nested: true }),
    Subscript,
    Superscript,
    BlockLineHeight,
    PageBreak,
    PageBreakShortcut,
  ];
}

export const EMPTY_DOCUMENT: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

export type { JSONContent };

export { BlockLineHeight, LINE_HEIGHTS, type LineHeight } from './block-line-height';
export { PageBreak, PageBreakShortcut } from './page-break';
export { countWords, extractMentions, extractPlainText, textStats, toPlainText } from './text';
export { toMarkdown, markdownToHtml, inlineMarkdownToHtml } from './markdown';
