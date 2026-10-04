import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Table2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

interface TableGridPickerProps {
  editor: Editor;
  children: React.ReactNode;
}

const MAX_ROWS = 8;
const MAX_COLS = 8;

export function TableGridPicker({ editor, children }: TableGridPickerProps) {
  const [open, setOpen] = useState(false);
  const [hoverRow, setHoverRow] = useState(3);
  const [hoverCol, setHoverCol] = useState(3);

  const handleInsert = (rows: number, cols: number) => {
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3 shadow-pop z-50 bg-background border rounded-lg">
        <div className="mb-2 text-center text-xs font-semibold text-foreground">
          {hoverRow} × {hoverCol} Table
        </div>
        <div
          className="grid gap-1.5 p-1 bg-muted/40 rounded-md"
          style={{ gridTemplateColumns: `repeat(${MAX_COLS}, minmax(0, 1fr))` }}
          onMouseLeave={() => {
            setHoverRow(3);
            setHoverCol(3);
          }}
        >
          {Array.from({ length: MAX_ROWS }).map((_, r) =>
            Array.from({ length: MAX_COLS }).map((_, c) => {
              const rowNum = r + 1;
              const colNum = c + 1;
              const isSelected = rowNum <= hoverRow && colNum <= hoverCol;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onMouseEnter={() => {
                    setHoverRow(rowNum);
                    setHoverCol(colNum);
                  }}
                  onClick={() => handleInsert(rowNum, colNum)}
                  className={cn(
                    'h-4 w-4 rounded-xs border transition-colors cursor-pointer',
                    isSelected
                      ? 'border-blue-600 bg-blue-500'
                      : 'border-slate-300 bg-white hover:border-slate-400 dark:border-neutral-600 dark:bg-neutral-800'
                  )}
                  aria-label={`Insert ${rowNum} by ${colNum} table`}
                />
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
