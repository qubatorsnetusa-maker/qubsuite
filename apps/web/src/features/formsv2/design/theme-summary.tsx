import type { FormThemeDto } from '@qub/shared';
import { RotateCcw } from 'lucide-react';
import { fontPairById } from '@/features/forms/renderer/fonts';
import { RADIUS_PX } from '@/features/forms/renderer/screens';
import { Button } from '@/components/ui/button';
import { Section } from '../content/sidebar-section';

/**
 * What the theme currently resolves to, at a glance: the accent hex, the font pairing and the
 * button shape, over a sample button carrying all three. The full preview beside it shows the real
 * form; this answers "what values am I actually on?" without reading every control.
 */
export function ThemeSummary({ theme, disabled, onReset }: { theme: FormThemeDto; disabled: boolean; onReset(): void }) {
  const pair = fontPairById(theme.extras?.fontPair);
  const radius = theme.extras?.buttonRadius;
  const headingFont = pair ? `${pair.heading}, ${pair.headingTail}` : undefined;

  return (
    <Section>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Theme</h3>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={onReset} className="h-7 gap-1.5 px-2 text-xs text-muted">
          <RotateCcw className="size-3.5" aria-hidden />
          Reset to defaults
        </Button>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col items-center gap-1 rounded-md border border-border p-2">
          <span aria-hidden className="size-4 rounded-full border border-black/10" style={{ background: theme.primaryColor }} />
          <dd className="font-mono text-[11px] uppercase">{theme.primaryColor}</dd>
          <dt className="text-[10px] text-muted">Accent</dt>
        </div>
        <div className="flex flex-col items-center gap-0.5 rounded-md border border-border p-2">
          <span aria-hidden className="text-sm font-semibold" style={{ fontFamily: headingFont }}>
            Aa
          </span>
          <dd className="truncate text-[11px]">{pair?.name ?? 'Default'}</dd>
          <dt className="text-[10px] text-muted">Font</dt>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-md border border-border p-2">
          <span aria-hidden className="size-4 border-2 border-border-strong" style={{ borderRadius: radius ? RADIUS_PX[radius] : '9999px' }} />
          <dd className="text-[11px] capitalize">{radius ?? 'Pill'}</dd>
          <dt className="text-[10px] text-muted">Buttons</dt>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3" style={{ background: theme.backgroundColor }}>
        <span className="text-xs" style={{ fontFamily: headingFont, color: theme.extras?.questionColor ?? '#1f1f1f' }}>
          Sample question
        </span>
        <span
          aria-hidden
          data-testid="theme-summary-button"
          className="px-3 py-1.5 text-xs font-medium text-white"
          style={{ background: theme.primaryColor, borderRadius: radius ? RADIUS_PX[radius] : '9999px', fontFamily: headingFont }}
        >
          Next
        </span>
      </div>
    </Section>
  );
}
