import { useEffect, useState } from 'react';
import { Input, Label } from '@/components/ui/form-controls';

const HEX = /^#[0-9a-f]{6}$/;

const normalise = (raw: string): string | null => {
  const s = raw.trim().toLowerCase();
  const withHash = s.startsWith('#') ? s : `#${s}`;
  return HEX.test(withHash) ? withHash : null;
};

export function ColorField({ id, label, value, disabled, onCommit }: { id: string; label: string; value: string; disabled?: boolean; onCommit(hex: string): void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const commit = () => {
    const hex = normalise(text);
    if (!hex) { setText(value); return; }
    if (hex !== value.toLowerCase()) onCommit(hex);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          disabled={disabled}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-background disabled:cursor-not-allowed disabled:opacity-50"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
        />
        <Input
          aria-label={`${label} hex`}
          className="h-9 font-mono"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        />
      </div>
    </div>
  );
}
