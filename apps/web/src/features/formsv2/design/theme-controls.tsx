import type { FormThemeDto, FormThemeExtras, ThemeBackground, ThemeBackgroundBlur, ThemeButtonRadius } from '@qub/shared';
import { DEFAULT_FORM_THEME_EXTRAS, THEME_BACKGROUND_BLURS, THEME_BACKGROUND_KINDS, THEME_BUTTON_RADII } from '@qub/shared';
import type { ColorSwatch } from '@qub/shared/forms';
import { CURATED_BACKGROUND_COLORS, CURATED_PRIMARY_COLORS, CURATED_WALLPAPERS } from '@qub/shared/forms';
import { BODY_STACK, FONT_PAIRS } from '@/features/forms/renderer/fonts';
import { RADIUS_PX } from '@/features/forms/renderer/screens';
import { Input, Label } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import { Section } from '../content/sidebar-section';
import { ColorField } from './color-field';

export type ThemePatch = { primaryColor?: string; backgroundColor?: string; extras?: FormThemeExtras };

const KIND_LABELS: Record<(typeof THEME_BACKGROUND_KINDS)[number], string> = { color: 'Solid', gradient: 'Gradient', image: 'Image' };
const RADIUS_LABELS: Record<ThemeButtonRadius, string> = { sharp: 'Sharp', rounded: 'Rounded', pill: 'Pill' };
const RADIUS_HINTS: Record<ThemeButtonRadius, string> = { sharp: 'Square corners', rounded: 'Softly curved', pill: 'Fully rounded' };
const BLUR_LABELS: Record<ThemeBackgroundBlur, string> = { none: 'Crisp', sm: 'Soft', md: 'Medium', lg: 'Heavy' };

/** One-click colour picks beside the hex field, so a usable colour is never more than a click away. */
function Swatches({ label, swatches, value, disabled, onPick }: { label: string; swatches: readonly ColorSwatch[]; value: string; disabled: boolean; onPick(hex: string): void }) {
  const active = value.toLowerCase();
  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {swatches.map((s) => {
          const selected = s.hex.toLowerCase() === active;
          return (
            <button
              key={s.hex}
              type="button"
              title={`${s.name} — ${s.hex}`}
              aria-label={`${s.name} — ${s.hex}`}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onPick(s.hex)}
              style={{ background: s.hex }}
              className={cn('size-7 rounded-full border border-black/10 transition-shadow disabled:opacity-50', selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

export function Choices<T extends string>({ name, label, options, value, disabled, onPick }: { name: string; label: string; options: { id: T; label: string; style?: React.CSSProperties }[]; value: T | undefined; disabled: boolean; onPick(id: T): void }) {
  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.id} className="cursor-pointer">
            <input type="radio" name={name} className="peer sr-only" checked={value === o.id} disabled={disabled} onChange={() => onPick(o.id)} />
            <span style={o.style} className="block rounded-md border border-border px-3 py-1.5 text-sm peer-checked:border-primary peer-checked:bg-primary-soft peer-disabled:opacity-50">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ThemeControls({ theme, disabled, onChange }: { theme: FormThemeDto; disabled: boolean; onChange(patch: ThemePatch): void }) {
  const x = theme.extras ?? {};
  const bg: ThemeBackground = x.background ?? DEFAULT_FORM_THEME_EXTRAS.background;
  const setBg = (next: ThemeBackground) => onChange({ extras: { background: next } });

  return (
    <>
      <Section title="Colours">
        <ColorField id="theme-primary" label="Primary colour" value={theme.primaryColor} disabled={disabled} onCommit={(hex) => onChange({ primaryColor: hex })} />
        <Swatches label="Accent picks" swatches={CURATED_PRIMARY_COLORS} value={theme.primaryColor} disabled={disabled} onPick={(primaryColor) => onChange({ primaryColor })} />
        <ColorField id="theme-bg" label="Background colour" value={theme.backgroundColor} disabled={disabled} onCommit={(hex) => onChange({ backgroundColor: hex })} />
        <Swatches label="Page picks" swatches={CURATED_BACKGROUND_COLORS} value={theme.backgroundColor} disabled={disabled} onPick={(backgroundColor) => onChange({ backgroundColor })} />
        <ColorField id="theme-question" label="Question text" value={x.questionColor ?? '#1f1f1f'} disabled={disabled} onCommit={(hex) => onChange({ extras: { questionColor: hex } })} />
      </Section>

      <Section title="Typography">
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="text-sm font-medium">Font pairing</legend>
          {FONT_PAIRS.map((p) => {
            const heading = `${p.heading}, ${p.headingTail}`;
            return (
              <label key={p.id} className="block cursor-pointer">
                {/* Named for the pairing alone — the sample sentences below are decorative. */}
                <input type="radio" name="font-pair" aria-label={p.name} className="peer sr-only" checked={x.fontPair === p.id} disabled={disabled} onChange={() => onChange({ extras: { fontPair: p.id } })} />
                <span className="block rounded-md border border-border p-3 peer-checked:border-primary peer-checked:bg-primary-soft peer-disabled:opacity-50">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted">{p.heading.replace(/'/g, '')}</span>
                  </span>
                  <span className="mt-1.5 block text-base" style={{ fontFamily: heading, color: 'var(--color-foreground)' }}>
                    What is your name?
                  </span>
                  <span className="block text-xs text-muted" style={{ fontFamily: `${p.body}, ${BODY_STACK}` }}>
                    This is how helper text reads.
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      </Section>

      <Section title="Background">
        <Choices
          name="bg-kind"
          label="Style"
          value={bg.kind}
          disabled={disabled}
          options={THEME_BACKGROUND_KINDS.map((k) => ({ id: k, label: KIND_LABELS[k] }))}
          onPick={(kind) => {
            if (kind === bg.kind) return;
            if (kind === 'gradient') setBg({ ...bg, kind, from: bg.from ?? theme.backgroundColor, to: bg.to ?? '#ffffff', angle: bg.angle ?? 160 });
            else if (kind === 'image') setBg({ ...bg, kind, imageUrl: bg.imageUrl ?? null, dim: bg.dim ?? 0 });
            else setBg({ ...bg, kind: 'color' });
          }}
        />
        {bg.kind === 'gradient' && (
          <>
            <ColorField id="theme-grad-from" label="Gradient start" value={bg.from ?? theme.backgroundColor} disabled={disabled} onCommit={(from) => setBg({ ...bg, from })} />
            <ColorField id="theme-grad-to" label="Gradient end" value={bg.to ?? '#ffffff'} disabled={disabled} onCommit={(to) => setBg({ ...bg, to })} />
            <div className="space-y-1.5">
              <Label htmlFor="theme-grad-angle">Angle — {bg.angle ?? 160}°</Label>
              <input id="theme-grad-angle" type="range" min={0} max={360} step={5} className="w-full" value={bg.angle ?? 160} disabled={disabled} onChange={(e) => setBg({ ...bg, angle: Number(e.target.value) })} />
            </div>
          </>
        )}
        {bg.kind === 'image' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="theme-bg-image">Background image URL</Label>
              <Input id="theme-bg-image" key={bg.imageUrl ?? ''} className="h-9" placeholder="https://…" defaultValue={bg.imageUrl ?? ''} disabled={disabled}
                onBlur={(e) => { const url = e.target.value.trim() || null; if (url !== (bg.imageUrl ?? null)) setBg({ ...bg, imageUrl: url }); }} />
            </div>
            <fieldset className="space-y-1.5" disabled={disabled}>
              <legend className="text-sm font-medium">Wallpapers</legend>
              <div className="grid grid-cols-3 gap-2">
                {CURATED_WALLPAPERS.map((w) => {
                  const selected = bg.imageUrl === w.url;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      aria-label={w.name}
                      aria-pressed={selected}
                      disabled={disabled}
                      onClick={() => setBg({ ...bg, imageUrl: w.url })}
                      className={cn('overflow-hidden rounded-md border transition-colors disabled:opacity-50', selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:bg-hover')}
                    >
                      <img src={w.url} alt="" className="h-12 w-full object-cover" loading="lazy" />
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="theme-bg-dim">Dim — {bg.dim ?? 0}%</Label>
              <input id="theme-bg-dim" type="range" aria-label="Dim" min={0} max={80} step={5} className="w-full" value={bg.dim ?? 0} disabled={disabled} onChange={(e) => setBg({ ...bg, dim: Number(e.target.value) })} />
            </div>
            <Choices
              name="bg-blur"
              label="Blur"
              value={bg.blur ?? 'none'}
              disabled={disabled}
              options={THEME_BACKGROUND_BLURS.map((b) => ({ id: b, label: BLUR_LABELS[b] }))}
              onPick={(blur) => setBg({ ...bg, blur })}
            />
          </>
        )}
      </Section>

      <Section title="Buttons">
        <fieldset className="space-y-2" disabled={disabled}>
          <legend className="text-sm font-medium">Shape</legend>
          {THEME_BUTTON_RADII.map((r) => (
            <label key={r} className="block cursor-pointer">
              <input type="radio" name="button-radius" aria-label={RADIUS_LABELS[r]} className="peer sr-only" checked={x.buttonRadius === r} disabled={disabled} onChange={() => onChange({ extras: { buttonRadius: r } })} />
              <span className="flex items-center gap-3 rounded-md border border-border p-2.5 peer-checked:border-primary peer-checked:bg-primary-soft peer-disabled:opacity-50">
                <span aria-hidden className="size-8 shrink-0 border-2 border-border-strong" style={{ borderRadius: RADIUS_PX[r], background: theme.primaryColor }} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{RADIUS_LABELS[r]}</span>
                  <span className="block text-xs text-muted">
                    {RADIUS_HINTS[r]} — {RADIUS_PX[r]}
                  </span>
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </Section>
    </>
  );
}
