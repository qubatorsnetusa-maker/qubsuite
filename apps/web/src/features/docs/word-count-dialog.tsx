import { extractPlainText, textStats } from '@qub/editor-schema';
import type { Editor } from '@tiptap/react';
import { useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { isPagedLayout } from './pagination';

const fmt = (n: number) => n.toLocaleString();
type StatKey = 'words' | 'characters' | 'charactersNoSpaces';

/** Word count and reading metrics for the document or current selection. */
export function WordCountDialog({
  editor,
  open,
  onOpenChange,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const stats = useMemo(() => {
    if (!open) return null;
    const { doc, selection } = editor.state;
    const total = textStats(extractPlainText(doc.toJSON()));
    const selected = selection.empty
      ? null
      : textStats(extractPlainText(doc.cut(selection.from, selection.to).toJSON()));
    const pages = isPagedLayout() ? Number(editor.view.dom.dataset.pages ?? '1') : null;
    return { total, selected, pages };
  }, [open, editor]);

  const row = (label: string, key: StatKey) =>
    stats && (
      <tr key={key} className="border-b border-border last:border-0">
        <th scope="row" className="py-2 text-left font-normal">
          {label}
        </th>
        <td className="py-2 text-right tabular-nums">
          {stats.selected ? `${fmt(stats.selected[key])} of ${fmt(stats.total[key])}` : fmt(stats.total[key])}
        </td>
      </tr>
    );

  const words = stats?.selected ? stats.selected.words : (stats?.total.words ?? 0);
  const readingTime = Math.max(1, Math.ceil(words / 225));
  const speakingTime = Math.max(1, Math.ceil(words / 130));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Word count & reading stats" className="max-w-sm">
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
              <tr className="border-b border-border">
                <th scope="row" className="py-2 text-left font-normal text-muted">
                  Reading time (225 wpm)
                </th>
                <td className="py-2 text-right tabular-nums text-muted">~{readingTime} min</td>
              </tr>
              <tr>
                <th scope="row" className="py-2 text-left font-normal text-muted">
                  Speaking time (130 wpm)
                </th>
                <td className="py-2 text-right tabular-nums text-muted">~{speakingTime} min</td>
              </tr>
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  );
}
