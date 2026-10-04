import type { FormThemeExtras } from '@qub/shared';
import type { ThemePreset } from '@qub/shared/forms';
import { presetById, THEME_PRESETS, themeSetTx } from '@qub/shared/forms';
import { V2Preview } from '../preview/v2-preview';
import { useFormV2 } from '../layout/use-form-v2';
import { BrandControls } from './brand-controls';
import { PresetTiles } from './preset-tiles';
import { ThemeControls, type ThemePatch } from './theme-controls';
import { ThemeSummary } from './theme-summary';

/** Reset goes back to the first preset — the look a new form starts with. */
const DEFAULT_PRESET = THEME_PRESETS[0]!;

/** Keys a preset owns. Changing one means the theme no longer matches its tile. */
const PRESET_OWNED = ['questionColor', 'fontPair', 'background', 'buttonRadius'] as const satisfies readonly (keyof FormThemeExtras)[];

const clearsPreset = (patch: ThemePatch) =>
  patch.primaryColor !== undefined || patch.backgroundColor !== undefined || PRESET_OWNED.some((k) => patch.extras && k in patch.extras);

export function DesignTab() {
  const { form, ops, canEdit } = useFormV2();
  const disabled = !canEdit;

  const save = (patch: ThemePatch, opts?: { mergeKey?: string }) => {
    if (disabled) return;
    const extras: FormThemeExtras = { ...form.theme.extras, ...patch.extras };
    const hasExplicitPreset = patch.extras !== undefined && 'preset' in patch.extras;
    if (clearsPreset(patch) && !hasExplicitPreset && extras.preset !== undefined) extras.preset = undefined;
    ops.apply(themeSetTx(form, { ...form.theme, ...patch, extras }), opts);
  };

  const applyPreset = (p: ThemePreset) =>
    save({
      primaryColor: p.primaryColor,
      backgroundColor: p.backgroundColor,
      extras: { preset: p.id, questionColor: p.questionColor, fontPair: p.fontPair, background: p.background, buttonRadius: p.buttonRadius },
    });

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
      <div className="divide-y divide-border rounded-lg border border-border">
        <ThemeSummary theme={form.theme} disabled={disabled} onReset={() => applyPreset(DEFAULT_PRESET)} />
        <PresetTiles activeId={presetById(form.theme.extras?.preset)?.id} disabled={disabled} onPick={applyPreset} />
        <ThemeControls theme={form.theme} disabled={disabled} onChange={(patch) => save(patch, { mergeKey: `theme-${Object.keys(patch.extras ?? patch).join()}` })} />
        <BrandControls theme={form.theme} disabled={disabled} onChange={(patch) => save(patch, { mergeKey: `theme-${Object.keys(patch.extras ?? patch).join()}` })} />
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start">
        <V2Preview formUrl={`/formsv2/${form.id}/preview`} desktopFrame reloadKey={JSON.stringify(form.theme)} />
      </div>
    </div>
  );
}
