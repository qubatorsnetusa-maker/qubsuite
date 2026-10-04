import type { FormThemeDto, ThemeHeaderStyle, ThemeLogoAlign } from '@qub/shared';
import { THEME_HEADER_BANNER_HEIGHT, THEME_HEADER_STYLES, THEME_LOGO_ALIGNS, THEME_LOGO_HEIGHT } from '@qub/shared';
import { Input, Label, Switch } from '@/components/ui/form-controls';
import { Section } from '../content/sidebar-section';
import { Choices, type ThemePatch } from './theme-controls';

const ALIGN_LABELS: Record<ThemeLogoAlign, string> = { left: 'Left', center: 'Centre', right: 'Right' };

const HEADER_STYLE_LABELS: Record<ThemeHeaderStyle, string> = { minimal: 'Minimal', prominent: 'Prominent', banner: 'Banner' };
const HEADER_STYLE_HINTS: Record<ThemeHeaderStyle, string> = {
  minimal: 'A compact row above the form.',
  prominent: 'Larger brand text, with a rule under it.',
  banner: 'The brand sits over the banner image, always centred.',
};

/** A text box that commits on blur, so a save is not fired per keystroke. */
function TextField({
  id,
  label,
  value,
  placeholder,
  maxLength,
  disabled,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  disabled: boolean;
  onCommit(next: string): void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        key={value}
        className="h-9"
        placeholder={placeholder}
        maxLength={maxLength}
        defaultValue={value}
        disabled={disabled}
        onBlur={(e) => {
          const next = e.target.value;
          if (next !== value) onCommit(next);
        }}
      />
    </div>
  );
}

/** A URL box that commits a trimmed value, or null once emptied. */
function UrlField({
  id,
  label,
  value,
  disabled,
  onCommit,
}: {
  id: string;
  label: string;
  value: string | null;
  disabled: boolean;
  onCommit(next: string | null): void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        key={value ?? ''}
        className="h-9"
        placeholder="https://…"
        defaultValue={value ?? ''}
        disabled={disabled}
        onBlur={(e) => {
          const next = e.target.value.trim() || null;
          if (next !== value) onCommit(next);
        }}
      />
    </div>
  );
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange(next: number): void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} — {value}px
      </Label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        className="w-full"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange(next: boolean): void }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      <Switch aria-label={label} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

export function BrandControls({ theme, disabled, onChange }: { theme: FormThemeDto; disabled: boolean; onChange(patch: ThemePatch): void }) {
  const x = theme.extras ?? {};
  const logo = x.logoUrl ?? null;
  const showLogo = x.showLogo !== false;
  const brandName = x.brandName ?? '';
  const banner = x.headerBannerUrl ?? null;
  const headerStyle = x.headerStyle ?? 'minimal';

  return (
    <>
      <Section title="Branding & header">
        <div className="space-y-1.5">
          <Choices
            name="header-style"
            label="Header style"
            value={headerStyle}
            disabled={disabled}
            options={THEME_HEADER_STYLES.map((id) => ({ id, label: HEADER_STYLE_LABELS[id] }))}
            onPick={(headerStyle) => onChange({ extras: { headerStyle } })}
          />
          <p className="text-xs text-muted">{HEADER_STYLE_HINTS[headerStyle]}</p>
        </div>

        <TextField
          id="brand-name"
          label="Brand name"
          value={brandName}
          placeholder="Acme Inc."
          maxLength={80}
          disabled={disabled}
          onCommit={(brandName) => onChange({ extras: { brandName } })}
        />
        {brandName.trim() !== '' && (
          <>
            <Toggle label="Show brand name" checked={x.showBrandName !== false} disabled={disabled} onChange={(showBrandName) => onChange({ extras: { showBrandName } })} />
            <TextField
              id="brand-tagline"
              label="Tagline"
              value={x.brandTagline ?? ''}
              placeholder="Customer experience"
              maxLength={120}
              disabled={disabled}
              onCommit={(brandTagline) => onChange({ extras: { brandTagline } })}
            />
          </>
        )}
      </Section>

      <Section title="Logo">
        <UrlField id="brand-logo" label="Logo URL" value={logo} disabled={disabled} onCommit={(logoUrl) => onChange({ extras: { logoUrl } })} />

        {logo && (
          <>
            <Toggle label="Show logo" checked={showLogo} disabled={disabled} onChange={(next) => onChange({ extras: { showLogo: next } })} />
            {showLogo && (
              <>
                <Slider
                  id="brand-logo-height"
                  label="Logo height"
                  value={x.logoHeight ?? THEME_LOGO_HEIGHT.default}
                  min={THEME_LOGO_HEIGHT.min}
                  max={THEME_LOGO_HEIGHT.max}
                  step={2}
                  disabled={disabled}
                  onChange={(logoHeight) => onChange({ extras: { logoHeight } })}
                />
                {headerStyle !== 'banner' && (
                  <Choices
                    name="logo-align"
                    label="Logo position"
                    value={x.logoAlign ?? 'left'}
                    disabled={disabled}
                    options={THEME_LOGO_ALIGNS.map((id) => ({ id, label: ALIGN_LABELS[id] }))}
                    onPick={(logoAlign) => onChange({ extras: { logoAlign } })}
                  />
                )}
              </>
            )}
          </>
        )}
      </Section>

      <Section title="Website link">
        <UrlField id="brand-website" label="Website URL" value={x.websiteUrl ?? null} disabled={disabled} onCommit={(websiteUrl) => onChange({ extras: { websiteUrl } })} />
        {x.websiteUrl && (
          <TextField
            id="brand-website-label"
            label="Link text"
            value={x.websiteLabel ?? ''}
            placeholder="Visit website"
            maxLength={40}
            disabled={disabled}
            onCommit={(websiteLabel) => onChange({ extras: { websiteLabel } })}
          />
        )}
      </Section>

      <Section title="Header banner">
        <UrlField id="brand-banner" label="Banner image URL" value={banner} disabled={disabled} onCommit={(headerBannerUrl) => onChange({ extras: { headerBannerUrl } })} />
        {banner && (
          <Slider
            id="brand-banner-height"
            label="Banner height"
            value={x.headerBannerHeight ?? THEME_HEADER_BANNER_HEIGHT.default}
            min={THEME_HEADER_BANNER_HEIGHT.min}
            max={THEME_HEADER_BANNER_HEIGHT.max}
            step={10}
            disabled={disabled}
            onChange={(headerBannerHeight) => onChange({ extras: { headerBannerHeight } })}
          />
        )}
      </Section>

      <Section title="Footer">
        <TextField
          id="brand-footer"
          label="Footer text"
          value={x.footerText ?? ''}
          placeholder="Acme Inc."
          maxLength={200}
          disabled={disabled}
          onCommit={(footerText) => onChange({ extras: { footerText } })}
        />
        <Toggle label='Show "Powered by Qub"' checked={x.showPoweredBy !== false} disabled={disabled} onChange={(showPoweredBy) => onChange({ extras: { showPoweredBy } })} />
      </Section>
    </>
  );
}
