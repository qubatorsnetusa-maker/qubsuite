import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Table2,
  Plus,
  Minus,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface MobileInsertTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: Editor | null;
}

const PRESETS = [
  { label: '2 × 2', rows: 2, cols: 2 },
  { label: '3 × 3', rows: 3, cols: 3 },
  { label: '4 × 3', rows: 4, cols: 3 },
  { label: '4 × 4', rows: 4, cols: 4 },
  { label: '5 × 2', rows: 5, cols: 2 },
];

export function MobileInsertTableDialog({
  open,
  onOpenChange,
  editor,
}: MobileInsertTableDialogProps) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [withHeaderRow, setWithHeaderRow] = useState(true);

  const handleInsert = () => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow })
      .run();

    toast.success(`Inserted ${rows}×${cols} table`);
    onOpenChange(false);
  };

  const applyPreset = (r: number, c: number) => {
    setRows(r);
    setCols(c);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Insert Table"
        description="Choose dimensions for your table."
        className="max-w-xs sm:max-w-sm p-4 select-none"
      >
        {/* Quick Presets */}
        <div className="space-y-3 py-2">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Quick Sizes
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.rows, p.cols)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    rows === p.rows && cols === p.cols
                      ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-2xs'
                      : 'border-slate-200 bg-slate-50/80 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Steppers */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Rows */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Rows</span>
              <div className="mt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setRows((r) => Math.max(1, r - 1))}
                  className="size-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 active:scale-95 shadow-2xs"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="text-base font-bold text-slate-800">{rows}</span>
                <button
                  type="button"
                  onClick={() => setRows((r) => Math.min(20, r + 1))}
                  className="size-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 active:scale-95 shadow-2xs"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Columns */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Columns</span>
              <div className="mt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCols((c) => Math.max(1, c - 1))}
                  className="size-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 active:scale-95 shadow-2xs"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="text-base font-bold text-slate-800">{cols}</span>
                <button
                  type="button"
                  onClick={() => setCols((c) => Math.min(12, c + 1))}
                  className="size-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 active:scale-95 shadow-2xs"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={withHeaderRow}
              onChange={(e) => setWithHeaderRow(e.target.checked)}
              className="size-4 rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Include styled header row
            </span>
          </label>
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleInsert}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium gap-1.5"
          >
            <Check className="size-3.5" />
            <span>Insert Table</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
