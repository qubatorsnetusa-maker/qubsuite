import { Extension, type Editor } from '@tiptap/core';

export const FONT_FAMILIES = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif' },
] as const;

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72] as const;
export const DEFAULT_FONT_SIZE = 11;
/** Rendered sizes of heading levels (see `index.css`), shown when no explicit size is set. */
export const HEADING_FONT_SIZES: Record<number, number> = { 1: 20, 2: 16, 3: 14, 4: 12 };
const MIN = 1;
const MAX = 400;

export function parsePt(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d+(?:\.\d+)?)pt$/.exec(value.trim());
  return m ? Number(m[1]) : null;
}

export function stepFontSize(current: number, dir: 1 | -1): number {
  if (dir === 1) return FONT_SIZES.find((s) => s > current) ?? Math.min(MAX, Math.floor(current) + 1);
  return [...FONT_SIZES].reverse().find((s) => s < current) ?? Math.max(MIN, Math.ceil(current) - 1);
}

export function parseFontSizeInput(raw: string): number | null {
  const v = raw.trim();
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= MIN && n <= MAX ? n : null;
}

export function currentFontSize(editor: Editor): number {
  const explicit = parsePt(editor.getAttributes('textStyle').fontSize);
  if (explicit !== null) return explicit;
  if (editor.isActive('heading')) return HEADING_FONT_SIZES[editor.getAttributes('heading').level as number] ?? DEFAULT_FONT_SIZE;
  return DEFAULT_FONT_SIZE;
}

/** Google Docs shortcuts: Ctrl+Shift+. / Ctrl+Shift+, step the font size up / down. */
export const FontSizeShortcuts = Extension.create({
  name: 'fontSizeShortcuts',
  addKeyboardShortcuts() {
    const step = (dir: 1 | -1) => () => {
      if (!this.editor.isEditable) return false;
      return this.editor.chain().focus().setFontSize(`${stepFontSize(currentFontSize(this.editor), dir)}pt`).run();
    };
    return { 'Mod-Shift-.': step(1), 'Mod-Shift-,': step(-1) };
  },
});
