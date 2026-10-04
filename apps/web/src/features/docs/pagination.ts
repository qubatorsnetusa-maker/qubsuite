import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

export const PAGE = { width: 816, height: 1056, margin: 96, gap: 24 } as const;
const CONTENT_HEIGHT = PAGE.height - 2 * PAGE.margin;
/** Below this width the editor switches to a continuous (unpaged) mobile layout. */
const MIN_PAGED_WIDTH = 900;

/** True when the editor shows discrete Letter pages (desktop); false in the continuous mobile layout. */
export const isPagedLayout = () => window.innerWidth >= MIN_PAGED_WIDTH;

interface Break {
  pos: number;
  height: number;
}

const key = new PluginKey<DecorationSet>('qubPagination');

function sameBreaks(a: Break[], b: Break[]) {
  return a.length === b.length && a.every((x, i) => x.pos === b[i]!.pos && Math.abs(x.height - b[i]!.height) < 1);
}

/**
 * Letter-size pagination: measures rendered top-level blocks and inserts spacer widgets so a block that would
 * cross the bottom margin starts on the next page. Measurements ignore existing spacers ("natural" layout), so the
 * result is stable and doesn't oscillate. Blocks taller than a page (large tables/images) start a page and overflow;
 * splitting a single paragraph across pages is not performed. A manual page break (`.qub-manual-break`) ends its page:
 * the next block always starts a new page.
 */
function computeBreaks(view: EditorView): Break[] {
  if (!isPagedLayout()) return [];
  const breaks: Break[] = [];
  let spacerTotal = 0;
  let pageTop = 0;
  const children = Array.from(view.dom.children) as HTMLElement[];
  let forceBreak = false;
  for (const el of children) {
    if (el.classList.contains('qub-page-break')) {
      spacerTotal += el.offsetHeight;
      continue;
    }
    const afterManualBreak = forceBreak;
    forceBreak = el.classList.contains('qub-manual-break');
    const top = el.offsetTop - spacerTotal;
    const bottom = top + el.offsetHeight;
    if ((afterManualBreak || bottom - pageTop > CONTENT_HEIGHT) && top > pageTop) {
      let pos: number;
      try {
        pos = view.posAtDOM(el, 0) - 1;
      } catch {
        continue;
      }
      if (pos < 0) continue;
      const remaining = pageTop + CONTENT_HEIGHT - top;
      breaks.push({ pos, height: Math.max(0, remaining) + 2 * PAGE.margin + PAGE.gap });
      pageTop = top;
    }
  }
  return breaks;
}

export const Pagination = Extension.create({
  name: 'qubPagination',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const next = tr.getMeta(key) as Break[] | undefined;
            if (next) {
              return DecorationSet.create(
                tr.doc,
                next.map((b, i) =>
                  Decoration.widget(
                    b.pos,
                    () => {
                      const el = document.createElement('div');
                      el.className = 'qub-page-break';
                      el.style.height = `${b.height}px`;
                      el.style.margin = '0';
                      el.contentEditable = 'false';
                      el.setAttribute('aria-hidden', 'true');
                      return el;
                    },
                    { side: -1, key: `pb-${i}-${Math.round(b.height)}`, ignoreSelection: true },
                  ),
                ),
              );
            }
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => key.getState(state),
        },
        view(view) {
          let current: Break[] = [];
          let frame = 0;
          const measure = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
              if (!view.dom.isConnected) return;
              const next = computeBreaks(view);
              const pages = next.length + 1;
              view.dom.style.minHeight = !isPagedLayout() ? '' : `${pages * CONTENT_HEIGHT + (pages - 1) * (2 * PAGE.margin + PAGE.gap)}px`;
              view.dom.dataset.pages = String(pages);
              if (!sameBreaks(next, current)) {
                current = next;
                view.dispatch(view.state.tr.setMeta(key, next).setMeta('addToHistory', false));
              }
            });
          };
          const ro = new ResizeObserver(measure);
          ro.observe(view.dom);
          window.addEventListener('resize', measure);
          measure();
          return {
            update: measure,
            destroy() {
              cancelAnimationFrame(frame);
              ro.disconnect();
              window.removeEventListener('resize', measure);
            },
          };
        },
      }),
    ];
  },
});
