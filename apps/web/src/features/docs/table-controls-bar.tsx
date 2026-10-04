import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  Trash2,
  PaintBucket,
  Plus,
  Minus,
  Table as TableIcon,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc';

interface TableControlsBarProps {
  editor: Editor;
}

// MS Word / Google Docs style Table Themes
const TABLE_THEMES = [
  {
    name: 'Modern Blue',
    headerBg: '#e8f0fe',
    rowBg: '#ffffff',
    altRowBg: '#f8fafd',
    borderColor: '#c2d7fa',
  },
  {
    name: 'Executive Grey',
    headerBg: '#f1f3f4',
    rowBg: '#ffffff',
    altRowBg: '#f8f9fa',
    borderColor: '#dadce0',
  },
  {
    name: 'Emerald Green',
    headerBg: '#e6f4ea',
    rowBg: '#ffffff',
    altRowBg: '#f6fbf7',
    borderColor: '#b7e1cd',
  },
  {
    name: 'Warm Amber',
    headerBg: '#fef7e0',
    rowBg: '#ffffff',
    altRowBg: '#fffdf6',
    borderColor: '#fce8b2',
  },
  {
    name: 'Lavender Purple',
    headerBg: '#f3e8fd',
    rowBg: '#ffffff',
    altRowBg: '#faf5fe',
    borderColor: '#d7aefb',
  },
  {
    name: 'Coral Rose',
    headerBg: '#fce8e6',
    rowBg: '#ffffff',
    altRowBg: '#fdf3f2',
    borderColor: '#f4c7c3',
  },
];

const INDIVIDUAL_COLORS = [
  '#ffffff',
  '#f8f9fa',
  '#f1f3f4',
  '#e8f0fe',
  '#fce8e6',
  '#fef7e0',
  '#e6f4ea',
  '#f3e8fd',
  '#d2e3fc',
  '#fad2cf',
  '#feefc3',
  '#ceead6',
];

export function TableControlsBar({ editor }: TableControlsBarProps) {
  const isInsideTable = useEditorState({
    editor,
    selector: ({ editor: e }) => e.isActive('table'),
  });

  if (!isInsideTable) return null;

  const c = () => editor.chain().focus();

  const setCellColor = (color: string) => {
    c().setCellAttribute('backgroundColor', color).run();
  };

  const applyTableTheme = (theme: typeof TABLE_THEMES[0]) => {
    // Select table and apply header color
    c().setCellAttribute('backgroundColor', theme.headerBg).run();
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-background px-3 py-1.5 shadow-md backdrop-blur-xs animate-in fade-in slide-in-from-top-1">
      <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mr-1">
        <TableIcon className="h-3.5 w-3.5 text-blue-600" />
        Table:
      </span>

      {/* Row Operations */}
      <Tooltip content="Insert row above">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => c().addRowBefore().run()}>
          <Plus className="h-3 w-3 text-emerald-600" /> Row Above
        </Button>
      </Tooltip>
      <Tooltip content="Insert row below">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => c().addRowAfter().run()}>
          <Plus className="h-3 w-3 text-emerald-600" /> Row Below
        </Button>
      </Tooltip>
      <Tooltip content="Delete current row">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-amber-700 hover:text-amber-800" onClick={() => c().deleteRow().run()}>
          <Minus className="h-3 w-3" /> Del Row
        </Button>
      </Tooltip>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Column Operations */}
      <Tooltip content="Insert column left">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => c().addColumnBefore().run()}>
          <Plus className="h-3 w-3 text-emerald-600" /> Col Left
        </Button>
      </Tooltip>
      <Tooltip content="Insert column right">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => c().addColumnAfter().run()}>
          <Plus className="h-3 w-3 text-emerald-600" /> Col Right
        </Button>
      </Tooltip>
      <Tooltip content="Delete current column">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-amber-700 hover:text-amber-800" onClick={() => c().deleteColumn().run()}>
          <Minus className="h-3 w-3" /> Del Col
        </Button>
      </Tooltip>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Cell Background Color */}
      <Popover>
        <Tooltip content="Cell background color">
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
              <PaintBucket className="h-3.5 w-3.5 text-blue-600" />
              <span>Cell Color</span>
            </Button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent align="center" className="w-auto p-2.5 shadow-pop">
          <div className="text-[11px] font-semibold text-muted-foreground mb-1.5 px-0.5">Shading</div>
          <div className="grid grid-cols-4 gap-1.5">
            {INDIVIDUAL_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setCellColor(color)}
                style={{ backgroundColor: color }}
                className="h-6 w-6 rounded border border-slate-300 hover:scale-110 transition-transform shadow-2xs"
                title={color}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Word-style Table Themes */}
      <Popover>
        <Tooltip content="MS Word Table Themes">
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-purple-700 dark:text-purple-400">
              <Palette className="h-3.5 w-3.5 text-purple-600" />
              <span>Theme</span>
            </Button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent align="center" className="w-56 p-2 shadow-pop">
          <div className="text-[11px] font-semibold text-muted-foreground mb-2 px-1">Word-style Table Themes</div>
          <div className="space-y-1.5">
            {TABLE_THEMES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => applyTableTheme(t)}
                className="w-full flex items-center justify-between p-1.5 rounded hover:bg-muted text-left text-xs transition-colors"
              >
                <span>{t.name}</span>
                <div className="flex h-4 w-8 rounded border overflow-hidden" style={{ borderColor: t.borderColor }}>
                  <div className="w-1/2 h-full" style={{ backgroundColor: t.headerBg }} />
                  <div className="w-1/2 h-full" style={{ backgroundColor: t.rowBg }} />
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="h-4 w-px bg-border mx-0.5" />

      {/* Delete Table */}
      <Tooltip content="Delete entire table">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => c().deleteTable().run()}>
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete Table</span>
        </Button>
      </Tooltip>
    </div>
  );
}
