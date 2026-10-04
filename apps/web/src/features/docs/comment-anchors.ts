import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { absolutePositionToRelativePosition, relativePositionToAbsolutePosition, ySyncPluginKey } from '@tiptap/y-tiptap';
import * as Y from 'yjs';

/** Must match the server's COMMENT_ANCHORS_MAP: the only part of the Y.Doc commenters may write. */
export const ANCHORS_MAP = 'commentAnchors';

interface AnchorJSON {
  from: unknown;
  to: unknown;
}

interface AnchorMeta {
  visible: Set<string>;
  active: string | null;
}

const key = new PluginKey<{ set: DecorationSet; meta: AnchorMeta }>('qubCommentAnchors');

function binding(editor: Editor): { doc: Y.Doc; type: Y.XmlFragment; mapping: Map<unknown, unknown> } | null {
  const state = ySyncPluginKey.getState(editor.state) as { binding?: { doc: Y.Doc; type: Y.XmlFragment; mapping: Map<unknown, unknown> } } | undefined;
  return state?.binding ?? null;
}

/** Resolves an anchor's relative positions to current absolute positions in the editor document. */
export function resolveAnchor(editor: Editor, ydoc: Y.Doc, anchorId: string): { from: number; to: number } | null {
  const b = binding(editor);
  const raw = ydoc.getMap<AnchorJSON>(ANCHORS_MAP).get(anchorId);
  if (!b || !raw) return null;
  const from = relativePositionToAbsolutePosition(ydoc, b.type, Y.createRelativePositionFromJSON(raw.from), b.mapping as never);
  const to = relativePositionToAbsolutePosition(ydoc, b.type, Y.createRelativePositionFromJSON(raw.to), b.mapping as never);
  if (from === null || to === null || to <= from) return null;
  return { from, to };
}

/**
 * Stores the current selection as a comment anchor made of Yjs relative positions, so the highlight follows the text
 * through everyone's concurrent edits without modifying the document body.
 */
export function createAnchor(editor: Editor, ydoc: Y.Doc, anchorId: string): { quotedText: string } | null {
  const b = binding(editor);
  const { from, to } = editor.state.selection;
  if (!b || from === to) return null;
  const rel = (pos: number) => Y.relativePositionToJSON(absolutePositionToRelativePosition(pos, b.type, b.mapping as never));
  ydoc.getMap<AnchorJSON>(ANCHORS_MAP).set(anchorId, { from: rel(from), to: rel(to) });
  return { quotedText: editor.state.doc.textBetween(from, to, ' ').slice(0, 2000) };
}

export function removeAnchor(ydoc: Y.Doc, anchorId: string) {
  ydoc.getMap(ANCHORS_MAP).delete(anchorId);
}

export function setAnchorView(editor: Editor, meta: AnchorMeta) {
  editor.view.dispatch(editor.state.tr.setMeta(key, meta).setMeta('addToHistory', false));
}

export const CommentHighlights = Extension.create<{ ydoc: Y.Doc | null; onActivate(anchorId: string): void }>({
  name: 'qubCommentHighlights',
  addOptions() {
    return { ydoc: null, onActivate: () => {} };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    const { ydoc, onActivate } = this.options;
    const build = (meta: AnchorMeta, doc: import('@tiptap/pm/model').Node) => {
      if (!ydoc) return DecorationSet.empty;
      const decos: Decoration[] = [];
      for (const id of meta.visible) {
        const range = resolveAnchor(editor, ydoc, id);
        if (range && range.to <= doc.content.size) {
          decos.push(Decoration.inline(range.from, range.to, { class: `comment-highlight${meta.active === id ? ' is-active' : ''}`, 'data-anchor-id': id }));
        }
      }
      return DecorationSet.create(doc, decos);
    };
    return [
      new Plugin({
        key,
        state: {
          init: () => ({ set: DecorationSet.empty, meta: { visible: new Set<string>(), active: null } as AnchorMeta }),
          apply(tr, prev) {
            const meta = (tr.getMeta(key) as AnchorMeta | undefined) ?? prev.meta;
            // Recompute from relative positions on meta changes and remote/local edits.
            if (tr.getMeta(key) || tr.docChanged) return { set: build(meta, tr.doc), meta };
            return prev;
          },
        },
        props: {
          decorations: (state) => key.getState(state)?.set,
          handleClick(_view, _pos, event) {
            const el = (event.target as HTMLElement).closest('[data-anchor-id]');
            if (el) onActivate(el.getAttribute('data-anchor-id')!);
            return false;
          },
        },
        view() {
          if (!ydoc) return {};
          const map = ydoc.getMap(ANCHORS_MAP);
          const observer = () => {
            const meta = key.getState(editor.state)?.meta;
            if (meta && !editor.isDestroyed) setAnchorView(editor, meta);
          };
          map.observe(observer);
          return { destroy: () => map.unobserve(observer) };
        },
      }),
    ];
  },
});
