import type { ThemeBackground, ThemeButtonRadius, ThemeFontPair } from '../schemas/forms';

/** One curated look: one click writes all of it, so it is one undo step. */
export interface ThemePreset {
  id: string;
  name: string;
  primaryColor: string;
  backgroundColor: string;
  questionColor: string;
  fontPair: ThemeFontPair;
  background: ThemeBackground;
  buttonRadius: ThemeButtonRadius;
}

const solid: ThemeBackground = { kind: 'color' };

export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: 'qub', name: 'Qub', primaryColor: '#673ab7', backgroundColor: '#f0ebf8', questionColor: '#1f1f1f', fontPair: 'inter', background: solid, buttonRadius: 'rounded' },
  { id: 'midnight', name: 'Midnight', primaryColor: '#818cf8', backgroundColor: '#0f172a', questionColor: '#f8fafc', fontPair: 'grotesk', background: { kind: 'gradient', from: '#0f172a', to: '#1e1b4b', angle: 160 }, buttonRadius: 'pill' },
  { id: 'paper', name: 'Paper', primaryColor: '#1f2937', backgroundColor: '#faf7f2', questionColor: '#1f2937', fontPair: 'lora', background: solid, buttonRadius: 'sharp' },
  { id: 'sunrise', name: 'Sunrise', primaryColor: '#db2777', backgroundColor: '#fff7ed', questionColor: '#431407', fontPair: 'playfairDm', background: { kind: 'gradient', from: '#ffedd5', to: '#fecdd3', angle: 135 }, buttonRadius: 'pill' },
  { id: 'forest', name: 'Forest', primaryColor: '#047857', backgroundColor: '#f0fdf4', questionColor: '#064e3b', fontPair: 'loraDm', background: solid, buttonRadius: 'rounded' },
  { id: 'ocean', name: 'Ocean', primaryColor: '#0369a1', backgroundColor: '#f0f9ff', questionColor: '#0c4a6e', fontPair: 'inter', background: { kind: 'gradient', from: '#e0f2fe', to: '#f0f9ff', angle: 180 }, buttonRadius: 'rounded' },
  { id: 'mono', name: 'Mono', primaryColor: '#111827', backgroundColor: '#ffffff', questionColor: '#111827', fontPair: 'mono', background: solid, buttonRadius: 'sharp' },
  { id: 'bold', name: 'Bold', primaryColor: '#f97316', backgroundColor: '#18181b', questionColor: '#fafafa', fontPair: 'grotesk', background: solid, buttonRadius: 'pill' },
  { id: 'blossom', name: 'Blossom', primaryColor: '#be185d', backgroundColor: '#fdf2f8', questionColor: '#500724', fontPair: 'playfair', background: solid, buttonRadius: 'rounded' },
  { id: 'slate', name: 'Slate', primaryColor: '#2563eb', backgroundColor: '#f8fafc', questionColor: '#0f172a', fontPair: 'dm', background: solid, buttonRadius: 'rounded' },
];

export const presetById = (id: string | undefined): ThemePreset | undefined =>
  id ? THEME_PRESETS.find((p) => p.id === id) : undefined;
