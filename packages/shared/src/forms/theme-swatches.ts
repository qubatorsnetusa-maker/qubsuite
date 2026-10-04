/**
 * One-click starting points for the Design tab. These are quick picks, not presets: each writes a
 * single value, so the theme keeps whatever else the author already chose.
 */

export interface ColorSwatch {
  name: string;
  hex: string;
}

/** Accent colours for buttons, progress and selected choices. */
export const CURATED_PRIMARY_COLORS: readonly ColorSwatch[] = [
  { name: 'Violet', hex: '#673ab7' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Emerald', hex: '#047857' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Slate', hex: '#334155' },
  { name: 'Ink', hex: '#111827' },
];

/** Page colours behind the form, light through dark. */
export const CURATED_BACKGROUND_COLORS: readonly ColorSwatch[] = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Paper', hex: '#faf7f2' },
  { name: 'Mist', hex: '#f8fafc' },
  { name: 'Lilac', hex: '#f0ebf8' },
  { name: 'Sky', hex: '#f0f9ff' },
  { name: 'Mint', hex: '#f0fdf4' },
  { name: 'Slate', hex: '#0f172a' },
  { name: 'Obsidian', hex: '#111215' },
];

export interface Wallpaper {
  id: string;
  name: string;
  url: string;
}

/** Background photographs that read well behind a form once dimmed or blurred. */
export const CURATED_WALLPAPERS: readonly Wallpaper[] = [
  { id: 'fog', name: 'Atmospheric fog', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80' },
  { id: 'architecture', name: 'Minimal architecture', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80' },
  { id: 'fluid', name: 'Abstract fluid', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=80' },
  { id: 'neon', name: 'Neon dusk', url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1600&q=80' },
  { id: 'geometry', name: 'Warm geometry', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80' },
  { id: 'waves', name: 'Soft waves', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1600&q=80' },
];

export const wallpaperByUrl = (url: string | null | undefined): Wallpaper | undefined =>
  url ? CURATED_WALLPAPERS.find((w) => w.url === url) : undefined;
