import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  Trash2,
  PaintBucket,
  Plus,
  Minus,
  Table as TableIcon,
  Palette,
  Rows,
  Columns,
  Combine,
  Split,
  Heading,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { cn } from '@/lib/utils';

interface TableControlsBarProps {
  editor: Editor;
}

// MS Word / Google Docs style Table Themes
const TABLE_THEMES = [
  {
    name: 'Modern Blue (Grid & Header)',
    headerBg: '#e8f0fe',
    rowBg: '#ffffff',
    borderColor: '#c2d7fa',
  },
  {
    name: 'Executive Grey',
    headerBg: '#f1f3f4',
    rowBg: '#ffffff',
    borderColor: '#dadce0',
  },
  {
    name: 'Emerald Green',
    headerBg: '#e6f4ea',
    rowBg: '#ffffff',
    borderColor: '#b7e1cd',
  },
  {
    name: 'Warm Amber',
    headerBg: '#fef7e0',
    rowBg: '#ffffff',
    borderColor: '#fce8b2',
  },
  {
    name: 'Lavender Purple',
    headerBg: '#f3e8fd',
    rowBg: '#ffffff',
    borderColor: '#d7aefb',
  },
  {
    name: 'Coral Rose',
    headerBg: '#fce8e6',
    rowBg: '#ffffff',
    borderColor: '#f4c7c3',
  },
];

const INDIVIDUAL_COLORS = [
  { name: 'None', color: '' },
  { name: 'White', color: '#ffffff' },
  { name: 'Soft Gray', color: '#f8f9fa' },
  { name: 'Medium Gray', color: '#e9ecef' },
  { name: 'Light Blue', color: '#e8f0fe' },
  { name: 'Soft Red', color: '#fce8e6' },
  { name: 'Soft Yellow', color: '#fef7e0' },
  { name: 'Soft Green', color: '#e6f4ea' },
  { name: 'Soft Purple', color: '#f3e8fd' },
  { name: 'Accent Blue', color: '#d2e3fc' },
  { name: 'Accent Rose', color: '#fad2cf' },
  { name: 'Accent Emerald', color: '#ceead6' },
];

export function TableControlsBar({ editor }: TableControlsBarProps) {
  const isInsideTable = useEditorState({
    editor,
    selector: ({ editor: e }) => e.isActive('table'),
  });

  if (!isInsideTable) return null;

  const c = () => editor.chain().focus();

  const setCellColor = (color: string) => {
    if (!color) {
      c().setCellAttribute('backgroundColor', null).run();
      toast.success('Cell shading cleared');
    } else {
      c().setCellAttribute('backgroundColor', color).run();
      toast.success('Cell shading applied');
    }
  };

  const applyTableTheme = (theme: typeof TABLE_THEMES[0]) => {
    c().setCellAttribute('backgroundColor', theme.headerBg).run();
    toast.success(`Applied ${theme.name}`);
  };

  return (
    <div
      role="toolbar"
      aria-label="MS Word Level Table Controls"
      className="flex max-w-full items-center gap-1 overflow-x-auto no-scrollbar rounded-full border border-blue-200 bg-white/98 px-3 py-1 text-xs shadow-lg backdrop-blur-md my-1 select-none animate-in fade-in"
    >
      {/* Badge */}
      <div className="flex items-center gap-1 pr-1.5 border-r border-slate-200 text-slate-500 font-bold shrink-0">
        <TableIcon className="size-3.5 text-blue-600" />
        <span className="text-[11px] hidden sm:inline">Table:</span>
      </div>

      {/* Row Controls Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 shrink-0"
          >
            <Rows className="size-3 text-blue-600" />
            <span>Rows ▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onSelect={() => c().addRowBefore().run()}>
            <Plus className="mr-2 size-3.5 text-emerald-600" />
            <span>Insert row above</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => c().addRowAfter().run()}>
            <Plus className="mr-2 size-3.5 text-emerald-600" />
            <span>Insert row below</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => c().deleteRow().run()} className="text-amber-700 focus:text-amber-800">
            <Minus className="mr-2 size-3.5" />
            <span>Delete current row</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Column Controls Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 shrink-0"
          >
            <Columns className="size-3 text-blue-600" />
            <span>Cols ▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onSelect={() => c().addColumnBefore().run()}>
            <Plus className="mr-2 size-3.5 text-emerald-600" />
            <span>Insert column left</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => c().addColumnAfter().run()}>
            <Plus className="mr-2 size-3.5 text-emerald-600" />
            <span>Insert column right</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => c().deleteColumn().run()} className="text-amber-700 focus:text-amber-800">
            <Minus className="mr-2 size-3.5" />
            <span>Delete current column</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Merge & Split Cells (MS Word standard) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 shrink-0"
          >
            <Combine className="size-3 text-indigo-600" />
            <span>Merge/Split ▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onSelect={() => { c().mergeCells().run(); toast.success('Merged selected cells'); }}>
            <Combine className="mr-2 size-3.5 text-indigo-600" />
            <span>Merge selected cells</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { c().splitCell().run(); toast.success('Cell split'); }}>
            <Split className="mr-2 size-3.5 text-indigo-600" />
            <span>Split merged cell</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => { c().toggleHeaderRow().run(); toast.success('Header row toggled'); }}>
            <Heading className="mr-2 size-3.5 text-slate-600" />
            <span>Toggle header row</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { c().toggleHeaderColumn().run(); toast.success('Header column toggled'); }}>
            <Heading className="mr-2 size-3.5 text-slate-600" />
            <span>Toggle header column</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="h-4 w-px bg-slate-200 mx-0.5 shrink-0" />

      {/* Cell Shading / Background Color */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-700 hover:bg-slate-100 active:scale-95 shrink-0"
            title="Cell shading"
          >
            <PaintBucket className="size-3 text-blue-600" />
            <span>Shading</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-56 p-2.5 shadow-xl">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">Cell Shading</div>
          <div className="grid grid-cols-4 gap-1.5">
            {INDIVIDUAL_COLORS.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setCellColor(item.color)}
                style={{ backgroundColor: item.color || '#ffffff' }}
                className={cn(
                  'h-6 w-full rounded border border-slate-300 hover:scale-105 transition-transform flex items-center justify-center text-[9px] font-semibold',
                  !item.color && 'border-dashed border-red-300 text-red-500'
                )}
                title={item.name}
              >
                {!item.color && 'None'}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* MS Word Table Themes */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-purple-700 hover:bg-purple-50 active:scale-95 shrink-0"
            title="MS Word Table Themes"
          >
            <Palette className="size-3 text-purple-600" />
            <span>Themes</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-60 p-2 shadow-xl">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 px-1">Word Table Styles</div>
          <div className="space-y-1">
            {TABLE_THEMES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => applyTableTheme(t)}
                className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 text-left text-xs transition-colors"
              >
                <span className="font-medium text-slate-800 truncate pr-2">{t.name}</span>
                <div className="flex h-4 w-9 rounded border overflow-hidden shrink-0" style={{ borderColor: t.borderColor }}>
                  <div className="w-1/2 h-full" style={{ backgroundColor: t.headerBg }} />
                  <div className="w-1/2 h-full" style={{ backgroundColor: t.rowBg }} />
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <div className="h-4 w-px bg-slate-200 mx-0.5 shrink-0" />

      {/* Delete Entire Table */}
      <button
        type="button"
        onClick={() => {
          c().deleteTable().run();
          toast.success('Table deleted');
        }}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-red-600 hover:bg-red-50 active:scale-95 shrink-0"
        title="Delete entire table"
      >
        <Trash2 className="size-3 text-red-600" />
        <span>Delete Table</span>
      </button>
    </div>
  );
}
