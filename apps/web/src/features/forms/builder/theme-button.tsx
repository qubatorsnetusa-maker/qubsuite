import type { FormDto } from '@qub/shared';
import { themeSetTx } from '@qub/shared/forms';
import { Palette } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, NativeSelect } from '@/components/ui/form-controls';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { useBuilderOps } from './ops/builder-ops';

export function ThemeButton({ form }: { form: FormDto }) {
  const [theme, setTheme] = useState(form.theme);
  useEffect(() => setTheme(form.theme), [form.theme]);
  const ops = useBuilderOps();
  const save = (t: typeof theme) => ops.apply(themeSetTx(form, t));
  const palette = ['#673ab7', '#3f51b5', '#1a73e8', '#0b8043', '#d93025', '#e37400', '#795548', '#607d8b'];
  const backgrounds = ['#f0ebf8', '#e8eaf6', '#e8f0fe', '#e6f4ea', '#fce8e6', '#fef7e0', '#efebe9', '#f1f3f4'];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="bg-background">
          <Palette /> Theme
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4">
        <div>
          <Label>Color</Label>
          <div className="mt-2 flex gap-2">
            {palette.map((c) => (
              <button key={c} onClick={() => { const t = { ...theme, primaryColor: c }; setTheme(t); save(t); }} className={cn('size-7 rounded-full', theme.primaryColor === c && 'ring-2 ring-offset-2')} style={{ background: c }} aria-label={`Theme color ${c}`} />
            ))}
          </div>
        </div>
        <div>
          <Label>Background</Label>
          <div className="mt-2 flex gap-2">
            {backgrounds.map((c) => (
              <button key={c} onClick={() => { const t = { ...theme, backgroundColor: c }; setTheme(t); save(t); }} className={cn('size-7 rounded-full border border-border', theme.backgroundColor === c && 'ring-2 ring-offset-2')} style={{ background: c }} aria-label={`Background ${c}`} />
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="font">Font</Label>
          <NativeSelect id="font" className="mt-2 w-full" value={theme.fontFamily} onChange={(e) => { const t = { ...theme, fontFamily: e.target.value as typeof theme.fontFamily }; setTheme(t); save(t); }}>
            <option value="sans">Sans serif</option>
            <option value="serif">Serif</option>
            <option value="mono">Monospace</option>
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="header">Header image URL</Label>
          <Input
            id="header"
            key={form.theme.headerImageUrl ?? ''}
            className="mt-2 h-9"
            defaultValue={form.theme.headerImageUrl ?? ''}
            placeholder="https://…"
            onBlur={(e) => {
              const url = e.target.value.trim() || null;
              if (url === (form.theme.headerImageUrl ?? null)) return;
              const t = { ...theme, headerImageUrl: url };
              setTheme(t);
              save(t);
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
