import { Extension } from '@tiptap/core';

export const LINE_HEIGHTS = ['1', '1.15', '1.5', '2'] as const;
export type LineHeight = (typeof LINE_HEIGHTS)[number];

const TYPES = ['paragraph', 'heading'];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockLineHeight: {
      setBlockLineHeight: (value: LineHeight) => ReturnType;
      unsetBlockLineHeight: () => ReturnType;
    };
  }
}

/**
 * Paragraph-level line spacing (Google Docs semantics). Named `blockLineHeight` so its command typings don't clash
 * with TextStyleKit's per-character `lineHeight`, which stays disabled.
 */
export const BlockLineHeight = Extension.create({
  name: 'blockLineHeight',
  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => {
              const v = el.style.lineHeight;
              return (LINE_HEIGHTS as readonly string[]).includes(v) ? v : null;
            },
            // Validated here too: values from JSON/Yjs never pass through parseHTML.
            renderHTML: (attrs) => ((LINE_HEIGHTS as readonly string[]).includes(attrs.lineHeight) ? { style: `line-height: ${attrs.lineHeight}` } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setBlockLineHeight:
        (value) =>
        ({ commands }) =>
          TYPES.map((t) => commands.updateAttributes(t, { lineHeight: value })).some(Boolean),
      unsetBlockLineHeight:
        () =>
        ({ commands }) =>
          TYPES.map((t) => commands.resetAttributes(t, 'lineHeight')).some(Boolean),
    };
  },
});
