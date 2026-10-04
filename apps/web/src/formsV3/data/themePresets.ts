import type { FormBorderRadius, FormConfig, FormFontFamily } from '@/formsV3/types'
import { FORM_THEMES } from './defaultForms'

export const FONT_OPTIONS: {
  id: FormFontFamily
  name: string
  category: string
  badge: string
  cssFont: string
  headingSample: string
  bodySample: string
}[] = [
  { id: 'inter', name: 'Inter', category: 'Sans', badge: 'Default', cssFont: "'Inter', sans-serif", headingSample: 'Question title', bodySample: 'Helper text sample.' },
  { id: 'plus-jakarta', name: 'Plus Jakarta Sans', category: 'Sans', badge: 'Modern', cssFont: "'Plus Jakarta Sans', sans-serif", headingSample: 'Question title', bodySample: 'Helper text sample.' },
  { id: 'space-grotesk', name: 'Space Grotesk', category: 'Sans', badge: 'Tech', cssFont: "'Space Grotesk', sans-serif", headingSample: 'Question title', bodySample: 'Helper text sample.' },
  { id: 'outfit', name: 'Outfit', category: 'Sans', badge: 'Geometric', cssFont: "'Outfit', sans-serif", headingSample: 'Question title', bodySample: 'Helper text sample.' },
  { id: 'playfair', name: 'Playfair Display', category: 'Serif', badge: 'Elegant', cssFont: "'Playfair Display', serif", headingSample: 'Question title', bodySample: 'Helper text sample.' },
  { id: 'lora', name: 'Lora', category: 'Serif', badge: 'Classic', cssFont: "'Lora', serif", headingSample: 'Question title', bodySample: 'Helper text sample.' },
  { id: 'fraunces', name: 'Fraunces', category: 'Serif', badge: 'Warm', cssFont: "'Fraunces', serif", headingSample: 'Question title', bodySample: 'Helper text sample.' },
  { id: 'jetbrains-mono', name: 'JetBrains Mono', category: 'Mono', badge: 'Code', cssFont: "'JetBrains Mono', monospace", headingSample: 'Question title', bodySample: 'Helper text sample.' },
]

export const BORDER_RADIUS_OPTIONS: {
  id: FormBorderRadius
  name: string
  cssValue: string
  tailwindClass: FormBorderRadius
  description: string
}[] = [
  { id: 'rounded-none', name: 'Square', cssValue: '0px', tailwindClass: 'rounded-none', description: 'Sharp, no curvature' },
  { id: 'rounded-md', name: 'Subtle', cssValue: '6px', tailwindClass: 'rounded-md', description: 'Barely-there curve' },
  { id: 'rounded-lg', name: 'Soft', cssValue: '8px', tailwindClass: 'rounded-lg', description: 'Gently softened corners' },
  { id: 'rounded-xl', name: 'Rounded', cssValue: '12px', tailwindClass: 'rounded-xl', description: 'Balanced, modern rounding' },
  { id: 'rounded-2xl', name: 'Extra Rounded', cssValue: '16px', tailwindClass: 'rounded-2xl', description: 'Noticeably curved' },
  { id: 'rounded-3xl', name: 'Very Rounded', cssValue: '24px', tailwindClass: 'rounded-3xl', description: 'Bold, friendly curvature' },
  { id: 'rounded-full', name: 'Pill', cssValue: '9999px', tailwindClass: 'rounded-full', description: 'Fully pill-shaped' },
]

export const CURATED_PRIMARY_COLORS: { name: string; hex: string }[] = [
  { name: 'Indigo', hex: '#4F46E5' },
  { name: 'Violet', hex: '#8B5CF6' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#EA580C' },
  { name: 'Rose', hex: '#E11D48' },
  { name: 'Sky', hex: '#0284C7' },
]

export function resolveFormThemeValues(form: FormConfig): {
  primaryColor: string
  fontFamily: FormFontFamily
  borderRadius: FormBorderRadius
  borderRadiusClass: string
  fontCss: string
} {
  const paletteEnabled = form.customPalette?.enabled ?? false
  const fontFamily: FormFontFamily = (paletteEnabled ? form.customPalette?.fontFamily : undefined) ?? form.fontFamily ?? 'inter'
  const borderRadius: FormBorderRadius =
    (paletteEnabled ? form.customPalette?.borderRadius : undefined) ?? form.borderRadius ?? 'rounded-xl'
  const theme = FORM_THEMES.find((t) => t.id === form.themeId) ?? FORM_THEMES[0]!
  const primaryColor =
    form.primaryColor || (paletteEnabled ? form.customPalette?.primaryColorHex : undefined) || theme.primaryColorHex

  const fontOption = FONT_OPTIONS.find((f) => f.id === fontFamily) ?? FONT_OPTIONS[0]!

  return { primaryColor, fontFamily, borderRadius, borderRadiusClass: borderRadius, fontCss: fontOption.cssFont }
}
