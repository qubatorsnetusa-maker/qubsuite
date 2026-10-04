import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { activeHeadingIndex, extractHeadings, type OutlineHeading } from './outline';

const LABELS: Record<number, string> = { 1: 'Title', 2: 'Heading 1', 3: 'Heading 2', 4: 'Heading 3' };

/** Left-hand document outline (desktop only): live list of headings, click to jump, current section highlighted. */
export function OutlinePanel({ editor, scrollRoot, onClose }: { editor: Editor; scrollRoot: HTMLElement | null; onClose(): void }) {
  const headings = useEditorState({ editor, selector: ({ editor: e }) => extractHeadings(e.state.doc) });
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (!scrollRoot) return;
    const update = () => {
      const rootTop = scrollRoot.getBoundingClientRect().top;
      const tops = headings.map((h) => {
        const dom = editor.view.nodeDOM(h.pos);
        return dom instanceof HTMLElement ? dom.getBoundingClientRect().top - rootTop : Number.POSITIVE_INFINITY;
      });
      setActive(activeHeadingIndex(tops, 8));
    };
    update();
    scrollRoot.addEventListener('scroll', update, { passive: true });
    return () => scrollRoot.removeEventListener('scroll', update);
  }, [editor, scrollRoot, headings]);

  const go = (h: OutlineHeading) => {
    editor.chain().focus().setTextSelection(h.pos + 1).run();
    const dom = editor.view.nodeDOM(h.pos);
    if (dom instanceof HTMLElement) dom.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  return (
    <aside aria-label="Document outline" className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface-2 px-3 py-4 lg:flex print:hidden">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Outline</h2>
        <Button variant="subtle" size="icon-sm" aria-label="Close outline" onClick={onClose}>
          <X />
        </Button>
      </div>
      {headings.length === 0 ? (
        <p className="text-sm text-muted">Headings you add to the document will appear here.</p>
      ) : (
        <ul className="space-y-0.5">
          {headings.map((h, i) => (
            <li key={`${h.pos}-${i}`}>
              <button
                type="button"
                onClick={() => go(h)}
                title={LABELS[h.level]}
                aria-current={i === active ? 'location' : undefined}
                style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
                className={cn('w-full truncate rounded py-1 pr-2 text-left text-sm hover:bg-black/5', i === active ? 'font-medium text-primary' : 'text-[#444746]')}
              >
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
