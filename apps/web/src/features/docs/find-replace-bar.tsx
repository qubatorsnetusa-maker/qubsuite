import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { CaseSensitive, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Tooltip } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { clearFind, getFindState, replaceAll, replaceCurrent, setFindQuery, stepMatch } from './find-replace';

/** Floating find/replace bar. Viewers and commenters get Find only (`canReplace` false). */
export function FindReplaceBar({
  editor,
  canReplace,
  showReplace,
  focusNonce,
  onClose,
}: {
  editor: Editor;
  canReplace: boolean;
  showReplace: boolean;
  /** Changes on every open (Ctrl+F / Ctrl+H / menu) so the query is re-focused. */
  focusNonce: number;
  onClose(): void;
}) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [replaceOpen, setReplaceOpen] = useState(showReplace && canReplace);
  const findInput = useRef<HTMLInputElement>(null);
  const { count, index } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const s = getFindState(e.state);
      return { count: s.matches.length, index: s.index };
    },
  });

  // Each open focuses the query, pre-filled from a short single-line selection.
  useEffect(() => {
    if (showReplace && canReplace) setReplaceOpen(true);
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      const selected = editor.state.doc.textBetween(from, to, '\n');
      if (selected && !selected.includes('\n') && selected.length <= 200) setQuery(selected);
    }
    const frame = requestAnimationFrame(() => {
      findInput.current?.focus();
      findInput.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusNonce, editor, showReplace, canReplace]);

  useEffect(() => {
    setFindQuery(editor.view, query, caseSensitive);
  }, [editor, query, caseSensitive]);

  useEffect(() => () => clearFind(editor.view), [editor]);

  const close = () => {
    onClose();
    editor.commands.focus();
  };

  const doReplaceAll = () => {
    const n = replaceAll(editor.view, replacement);
    if (n) toast.success(n === 1 ? 'Replaced 1 occurrence' : `Replaced ${n} occurrences`);
  };

  return (
    <div
      role="search"
      aria-label="Find and replace"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      }}
      className="absolute right-4 top-3 z-30 w-[min(400px,calc(100%-2rem))] rounded-lg border border-border bg-background p-3 shadow-pop print:hidden"
    >
      <div className="flex items-center gap-1">
        <Input
          ref={findInput}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              stepMatch(editor.view, e.shiftKey ? -1 : 1);
            }
          }}
          placeholder="Find in document"
          aria-label="Find in document"
          className="h-8 flex-1"
        />
        <span className="w-16 shrink-0 text-center text-xs text-muted" aria-live="polite">
          {query ? (count ? `${index + 1} of ${count}` : '0 of 0') : ''}
        </span>
        <Tooltip content="Match case">
          <button
            type="button"
            aria-label="Match case"
            aria-pressed={caseSensitive}
            onClick={() => setCaseSensitive((v) => !v)}
            className={cn('flex size-8 shrink-0 items-center justify-center rounded hover:bg-black/5 [&_svg]:size-[18px]', caseSensitive && 'bg-primary-soft')}
          >
            <CaseSensitive />
          </button>
        </Tooltip>
        <Button variant="subtle" size="icon-sm" aria-label="Previous match" disabled={!count} onClick={() => stepMatch(editor.view, -1)}>
          <ChevronUp />
        </Button>
        <Button variant="subtle" size="icon-sm" aria-label="Next match" disabled={!count} onClick={() => stepMatch(editor.view, 1)}>
          <ChevronDown />
        </Button>
        <Button variant="subtle" size="icon-sm" aria-label="Close find" onClick={close}>
          <X />
        </Button>
      </div>
      {canReplace && !replaceOpen && (
        <button type="button" onClick={() => setReplaceOpen(true)} className="mt-2 text-xs text-primary hover:underline">
          Replace…
        </button>
      )}
      {canReplace && replaceOpen && (
        <div className="mt-2 flex items-center gap-1">
          <Input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                replaceCurrent(editor.view, replacement);
              }
            }}
            placeholder="Replace with"
            aria-label="Replace with"
            className="h-8 flex-1"
          />
          <Button size="sm" variant="subtle" disabled={!count} onClick={() => replaceCurrent(editor.view, replacement)}>
            Replace
          </Button>
          <Button size="sm" disabled={!count} onClick={doReplaceAll}>
            Replace all
          </Button>
        </div>
      )}
    </div>
  );
}
