import { extractPlainText, textStats } from '@qub/editor-schema';
import type { Editor } from '@tiptap/react';
import { useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { isPagedLayout } from './pagination';

const fmt = (n: number) => n.toLocaleString();
type StatKey = 'words' | 'characters' | 'charactersNoSpaces';

/** Word count for the whole document, or "selection of total" when text is selected. Pages only in the paged layout. */
export function WordCountDialog({ editor, open, onOpenChange }: { editor: Editor; open: boolean; onOpenChange(open: boolean): void }) {
  const stats = useMemo(() => {
    if (!open) return null;
    const { doc, selection } = editor.state;
    const total = textStats(extractPlainText(doc.toJSON()));
    const selected = selection.empty ? null : textStats(extractPlainText(doc.cut(selection.from, selection.to).toJSON()));
    const pages = isPagedLayout() ? Number(editor.view.dom.dataset.pages ?? '1') : null;
    return { total, selected, pages };
  }, [open, editor]);

  const row = (label: string, key: StatKey) =>
    stats && (
      <tr key={key} className="border-b border-border last:border-0">
        <th scope="row" className="py-2 text-left font-normal">
          {label}
        </th>
        <td className="py-2 text-right tabular-nums">{stats.selected ? `${fmt(stats.selected[key])} of ${fmt(stats.total[key])}` : fmt(stats.total[key])}</td>
      </tr>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Word count" className="max-w-sm">
        {stats && (
          <table className="w-full text-sm">
            <tbody>
              {stats.pages !== null && (
                <tr className="border-b border-border">
                  <th scope="row" className="py-2 text-left font-normal">
                    Pages
                  </th>
                  <td className="py-2 text-right tabular-nums">{fmt(stats.pages)}</td>
                </tr>
              )}
              {row('Words', 'words')}
              {row('Characters', 'characters')}
              {row('Characters excluding spaces', 'charactersNoSpaces')}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  );
}
