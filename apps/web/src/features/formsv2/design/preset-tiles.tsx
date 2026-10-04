import type { ThemePreset } from '@qub/shared/forms';
import { THEME_PRESETS } from '@qub/shared/forms';
import { fontPairById } from '@/features/forms/renderer/fonts';
import { cn } from '@/lib/utils';
import { Section } from '../content/sidebar-section';

export function PresetTiles({ activeId, disabled, onPick }: { activeId: string | undefined; disabled: boolean; onPick(preset: ThemePreset): void }) {
  return (
    <Section title="Themes">
      <div data-testid="theme-preset-tiles" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {THEME_PRESETS.map((p) => {
          const pair = fontPairById(p.fontPair);
          const active = p.id === activeId;
          const swatch = p.background.kind === 'gradient'
            ? `linear-gradient(${p.background.angle ?? 160}deg, ${p.background.from}, ${p.background.to})`
            : p.backgroundColor;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onPick(p)}
              className={cn('flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors disabled:opacity-50', active ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:bg-hover')}
              style={{ background: swatch }}
            >
              <span className="text-sm font-medium" style={{ color: p.questionColor, fontFamily: pair ? `${pair.heading}, ${pair.headingTail}` : undefined }}>
                {p.name}
              </span>
              <span className="flex gap-1" aria-hidden>
                <span className="size-4 rounded-full border border-black/10" style={{ background: p.primaryColor }} />
                <span className="size-4 rounded-full border border-black/10" style={{ background: p.backgroundColor }} />
                <span className="size-4 rounded-full border border-black/10" style={{ background: p.questionColor }} />
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
