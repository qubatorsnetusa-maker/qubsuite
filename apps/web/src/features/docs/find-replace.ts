import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

export interface Match {
  from: number;
  to: number;
}

export interface FindState {
  query: string;
  caseSensitive: boolean;
  matches: Match[];
  index: number;
  /** Bumped by user actions (search, next/previous, replace) so only those scroll the current match into view. */
  scrollToken: number;
}

interface FindMeta {
  query?: string;
  caseSensitive?: boolean;
  index?: number;
  /** After a replace: make the first match at or after this position current. */
  afterPos?: number;
  scroll?: boolean;
}

const EMPTY: FindState = { query: '', caseSensitive: false, matches: [], index: 0, scrollToken: 0 };
/** Stands in for inline atoms (mentions, images, hard breaks) so matches never span them. */
const BARRIER = '￼';

export const findKey = new PluginKey<FindState>('qubFind');

/** Lower-cases per character, keeping characters whose lower-case form has a different length, so offsets stay aligned. */
function fold(s: string, caseSensitive: boolean): string {
  if (caseSensitive) return s;
  let out = '';
  for (const ch of s) {
    const lower = ch.toLowerCase();
    out += lower.length === ch.length ? lower : ch;
  }
  return out;
}

/** Non-overlapping matches within each textblock; a match may span marks but not blocks or inline atoms. */
export function findMatches(doc: PMNode, query: string, caseSensitive: boolean): Match[] {
  if (!query) return [];
  const needle = fold(query, caseSensitive);
  const matches: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const positions: number[] = [];
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      if (child.isText) {
        const t = child.text ?? '';
        for (let i = 0; i < t.length; i++) positions.push(start + i);
        text += t;
      } else {
        positions.push(-1);
        text += BARRIER;
      }
    });
    const hay = fold(text, caseSensitive);
    let i = hay.indexOf(needle);
    while (i !== -1) {
      const span = positions.slice(i, i + needle.length);
      if (span.includes(-1)) {
        i = hay.indexOf(needle, i + 1);
        continue;
      }
      matches.push({ from: span[0]!, to: span[span.length - 1]! + 1 });
      i = hay.indexOf(needle, i + needle.length);
    }
    return false;
  });
  return matches;
}

/**
 * Maps a position across a document change by diffing the two documents. Unlike the transaction's step mapping this
 * also works for y-tiptap, which applies every remote update (and Yjs undo) as one whole-document replace.
 */
function mapAcrossChange(oldDoc: PMNode, newDoc: PMNode, pos: number): number {
  const start = oldDoc.content.findDiffStart(newDoc.content);
  if (start === null || pos < start) return pos;
  const end = oldDoc.content.findDiffEnd(newDoc.content);
  if (!end) return pos;
  let { a, b } = end;
  // With repeated content the two scans can overlap; push the end past the start.
  const overlap = start - Math.min(a, b);
  if (overlap > 0) {
    a += overlap;
    b += overlap;
  }
  return pos >= a ? pos + (b - a) : start;
}

function nearest(matches: Match[], pos: number): number {
  const i = matches.findIndex((m) => m.from >= pos);
  return i === -1 ? 0 : i;
}

function scrollMatchIntoView(view: EditorView, match: Match) {
  const { node } = view.domAtPos(match.from);
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export const FindReplace = Extension.create({
  name: 'findReplace',
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: () => EMPTY,
          apply(tr, prev, old, next) {
            const meta = tr.getMeta(findKey) as FindMeta | undefined;
            if (!meta && !tr.docChanged) return prev;
            const query = meta?.query ?? prev.query;
            const caseSensitive = meta?.caseSensitive ?? prev.caseSensitive;
            const searchChanged = query !== prev.query || caseSensitive !== prev.caseSensitive;
            const matches = tr.docChanged || searchChanged ? findMatches(tr.doc, query, caseSensitive) : prev.matches;
            let index: number;
            if (meta?.afterPos !== undefined) index = nearest(matches, meta.afterPos);
            else if (meta?.index !== undefined) index = meta.index;
            else if (searchChanged) index = nearest(matches, next.selection.from);
            else if (tr.docChanged && prev.matches[prev.index]) index = nearest(matches, mapAcrossChange(old.doc, tr.doc, prev.matches[prev.index]!.from));
            else index = prev.index;
            index = matches.length ? ((index % matches.length) + matches.length) % matches.length : 0;
            return { query, caseSensitive, matches, index, scrollToken: prev.scrollToken + (meta?.scroll ? 1 : 0) };
          },
        },
        props: {
          decorations(state) {
            const s = findKey.getState(state);
            if (!s?.matches.length) return null;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.index ? 'qub-find-match qub-find-current' : 'qub-find-match' })),
            );
          },
        },
        view: () => ({
          update(view, prevState) {
            const s = findKey.getState(view.state);
            const p = findKey.getState(prevState);
            if (s && p && s.scrollToken !== p.scrollToken && s.matches[s.index]) scrollMatchIntoView(view, s.matches[s.index]!);
          },
        }),
      }),
    ];
  },
});

export const getFindState = (state: EditorState): FindState => findKey.getState(state) ?? EMPTY;

function dispatchMeta(view: EditorView, meta: FindMeta) {
  if (view.isDestroyed) return;
  view.dispatch(view.state.tr.setMeta(findKey, meta).setMeta('addToHistory', false));
}

export function setFindQuery(view: EditorView, query: string, caseSensitive: boolean) {
  dispatchMeta(view, { query, caseSensitive, scroll: true });
}

export function stepMatch(view: EditorView, dir: 1 | -1) {
  const s = getFindState(view.state);
  if (s.matches.length) dispatchMeta(view, { index: s.index + dir, scroll: true });
}

export function clearFind(view: EditorView) {
  if (!view.isDestroyed && getFindState(view.state).query) dispatchMeta(view, { query: '' });
}

/** Replaces the current match (keeping the formatting at its start) and moves to the next match after the inserted text. */
export function replaceCurrent(view: EditorView, replacement: string): boolean {
  const s = getFindState(view.state);
  const m = s.matches[s.index];
  if (!m || !view.editable) return false;
  const tr = view.state.tr.setStoredMarks(null);
  if (replacement) tr.insertText(replacement, m.from, m.to);
  else tr.delete(m.from, m.to);
  view.dispatch(tr.setMeta(findKey, { afterPos: m.from + replacement.length, scroll: true } satisfies FindMeta));
  return true;
}

/** Replaces every match in one transaction (last to first so positions stay valid): one sync update, one undo step. */
export function replaceAll(view: EditorView, replacement: string): number {
  const { matches } = getFindState(view.state);
  if (!matches.length || !view.editable) return 0;
  const tr = view.state.tr.setStoredMarks(null);
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]!;
    if (replacement) tr.insertText(replacement, m.from, m.to);
    else tr.delete(m.from, m.to);
  }
  view.dispatch(tr);
  return matches.length;
}
