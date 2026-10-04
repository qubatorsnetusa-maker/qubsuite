import { getStyleProperty } from '@tiptap/core';
import { FontFamily } from '@tiptap/extension-text-style';

/** A CSS font-family list: names, quotes, commas and spaces only — no `;`, `:`, `(` that could smuggle in other CSS. */
const SAFE_FAMILY = /^[\w\s"',.-]+$/;

export const isSafeFontFamily = (value: unknown): value is string => typeof value === 'string' && SAFE_FAMILY.test(value);

/**
 * Tiptap's FontFamily with the rendered value validated. Attributes that arrive through Yjs/JSON never pass through
 * parseHTML, so a crafted collaborator update could otherwise inject arbitrary CSS into every client's editor.
 */
export const SafeFontFamily = FontFamily.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) => {
              const value = getStyleProperty(element, 'font-family') ?? element.style.fontFamily;
              return isSafeFontFamily(value) ? value : null;
            },
            renderHTML: (attributes) => (isSafeFontFamily(attributes.fontFamily) ? { style: `font-family: ${attributes.fontFamily}` } : {}),
          },
        },
      },
    ];
  },
});
