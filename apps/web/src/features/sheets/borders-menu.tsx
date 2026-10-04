import type { Border } from '@qub/shared';
import { Grid2x2 } from 'lucide-react';
import { useState } from 'react';
import { NativeSelect } from '@/components/ui/form-controls';
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import type { BorderKind } from './borders';

const KINDS: { kind: BorderKind; label: string }[] = [
  { kind: 'all', label: 'All' },
  { kind: 'inner', label: 'Inner' },
  { kind: 'outer', label: 'Outer' },
  { kind: 'clear', label: 'Clear' },
  { kind: 'top', label: 'Top' },
  { kind: 'bottom', label: 'Bottom' },
  { kind: 'left', label: 'Left' },
  { kind: 'right', label: 'Right' },
];

/** Toolbar control: pick a border kind for the selection, with colour and weight. */
export function BordersMenu({ colors, onApply }: { colors: string[]; onApply(kind: BorderKind, border: Border): void }) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState('#000000');
  const [style, setStyle] = useState<Border['style']>('thin');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Borders">
        <PopoverTrigger asChild>
          <button type="button" aria-label="Borders" className="flex size-8 shrink-0 items-center justify-center rounded text-[#444746] hover:bg-black/5 [&_svg]:size-[18px]">
            <Grid2x2 />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-64 p-3">
        <div className="grid grid-cols-4 gap-1">
          {KINDS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              aria-label={kind === 'clear' ? 'Clear borders' : `${label} borders`}
              onClick={() => {
                onApply(kind, { style, color });
                setOpen(false);
              }}
              className="rounded border border-border px-1 py-1.5 text-xs hover:bg-black/5"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Border colour">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`Border colour ${c}`}
              onClick={() => setColor(c)}
              className={cn('size-5 rounded-full border border-black/15', color === c && 'ring-2 ring-primary ring-offset-1')}
              style={{ background: c }}
            />
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs">
          Weight
          <NativeSelect aria-label="Border weight" value={style} onChange={(e) => setStyle(e.target.value as Border['style'])} className="h-7 flex-1 text-xs">
            <option value="thin">Thin</option>
            <option value="medium">Medium</option>
            <option value="thick">Thick</option>
          </NativeSelect>
        </label>
      </PopoverContent>
    </Popover>
  );
}
