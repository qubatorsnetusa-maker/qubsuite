export type AnnotationType = 'text' | 'signature' | 'image' | 'date' | 'checkmark' | 'cross';

export type EditorTool = 'select' | 'text' | 'signature' | 'image' | 'date' | 'checkmark' | 'cross';

export interface PdfAnnotation {
  id: string;
  type: AnnotationType;
  pageIndex: number; // 0-based page index
  xPercent: number; // 0 - 100 percentage from left of page
  yPercent: number; // 0 - 100 percentage from top of page
  text?: string;
  fontSize?: number; // pt size: 10, 12, 14, 16, 18, 20, 24, 28, 36
  color?: string; // hex color code
  signatureDataUrl?: string;
  imageDataUrl?: string;
  scale?: number; // sizing multiplier (e.g. 0.75, 1.0, 1.25, 1.5, 2.0)
  width?: number; // base width in px
  height?: number; // base height in px
}

export const FONT_SIZE_OPTIONS = [10, 12, 14, 16, 18, 20, 24, 28, 36, 44] as const;

export const TEXT_COLOR_OPTIONS = [
  { name: 'Black', value: '#0f172a' },
  { name: 'Legal Blue', value: '#1d4ed8' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Emerald', value: '#059669' },
] as const;

export const SIGNATURE_SCALE_PRESETS = [
  { label: 'S', scale: 0.75, title: 'Small' },
  { label: 'M', scale: 1.0, title: 'Medium' },
  { label: 'L', scale: 1.4, title: 'Large' },
  { label: 'XL', scale: 1.9, title: 'Extra Large' },
] as const;
