import { Editor } from '@tiptap/core';
import { documentExtensions, EMPTY_DOCUMENT, toMarkdown, extractPlainText } from '@qub/editor-schema';
import { Placeholder } from '@tiptap/extensions';

declare global {
  interface Window {
    AndroidBridge?: {
      onEditorReady?: () => void;
      onContentChanged?: (jsonString: string) => void;
      onSelectionChanged?: (stateJson: string) => void;
      onTitleDetected?: (title: string) => void;
    };
    QubMobileBridge?: any;
  }
}

const rootEl = document.getElementById('mobile-root');
if (!rootEl) {
  throw new Error('mobile-root element not found');
}

const editor = new Editor({
  element: rootEl,
  extensions: [
    ...documentExtensions(),
    Placeholder.configure({
      placeholder: 'Type your story, notes, or ideas here…',
    }),
  ],
  content: EMPTY_DOCUMENT,
  autofocus: false,
  editable: true,
  onUpdate: ({ editor: ed }) => {
    const json = JSON.stringify(ed.getJSON());
    window.AndroidBridge?.onContentChanged?.(json);

    // Auto-detect title from the first heading or paragraph line
    const text = extractPlainText(ed.getJSON());
    const firstLine = text.split('\n').map((s) => s.trim()).filter(Boolean)[0];
    if (firstLine) {
      window.AndroidBridge?.onTitleDetected?.(firstLine.slice(0, 80));
    }
  },
  onSelectionUpdate: ({ editor: ed }) => {
    const state = {
      isBold: ed.isActive('bold'),
      isItalic: ed.isActive('italic'),
      isStrike: ed.isActive('strike'),
      isHeading1: ed.isActive('heading', { level: 1 }),
      isHeading2: ed.isActive('heading', { level: 2 }),
      isHeading3: ed.isActive('heading', { level: 3 }),
      isBulletList: ed.isActive('bulletList'),
      isOrderedList: ed.isActive('orderedList'),
      isTaskList: ed.isActive('taskList'),
      isBlockquote: ed.isActive('blockquote'),
      isCodeBlock: ed.isActive('codeBlock'),
      canUndo: ed.can().undo(),
      canRedo: ed.can().redo(),
    };
    window.AndroidBridge?.onSelectionChanged?.(JSON.stringify(state));
  },
});

// Expose public bridge for Android WebView to call via evaluateJavascript
window.QubMobileBridge = {
  setContent: (content: string) => {
    try {
      if (!content || content.trim() === '') {
        editor.commands.setContent(EMPTY_DOCUMENT);
        return;
      }
      if (content.startsWith('{') || content.startsWith('[')) {
        editor.commands.setContent(JSON.parse(content));
      } else {
        editor.commands.setContent(content);
      }
    } catch {
      editor.commands.setContent(content);
    }
  },

  getContentJson: () => JSON.stringify(editor.getJSON()),
  getMarkdown: () => toMarkdown(editor.getJSON()),
  getPlainText: () => extractPlainText(editor.getJSON()),

  setReadOnly: (readOnly: boolean) => {
    editor.setEditable(!readOnly);
  },

  toggleBold: () => editor.chain().focus().toggleBold().run(),
  toggleItalic: () => editor.chain().focus().toggleItalic().run(),
  toggleStrike: () => editor.chain().focus().toggleStrike().run(),
  toggleHeading: (level: 1 | 2 | 3) => editor.chain().focus().toggleHeading({ level }).run(),
  toggleBulletList: () => editor.chain().focus().toggleBulletList().run(),
  toggleOrderedList: () => editor.chain().focus().toggleOrderedList().run(),
  toggleTaskList: () => editor.chain().focus().toggleTaskList().run(),
  toggleBlockquote: () => editor.chain().focus().toggleBlockquote().run(),
  toggleCodeBlock: () => editor.chain().focus().toggleCodeBlock().run(),
  insertTable: (rows = 3, cols = 3) =>
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run(),
  undo: () => editor.chain().focus().undo().run(),
  redo: () => editor.chain().focus().redo().run(),
  clearContent: () => editor.commands.setContent(EMPTY_DOCUMENT),
};

// Notify native Android that editor is initialized and ready to receive content
if (window.AndroidBridge?.onEditorReady) {
  window.AndroidBridge.onEditorReady();
} else {
  // Wait in case Android injected the bridge after DOM start
  window.addEventListener('DOMContentLoaded', () => {
    window.AndroidBridge?.onEditorReady?.();
  });
}
