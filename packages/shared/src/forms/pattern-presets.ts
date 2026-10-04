/**
 * Ready-made answer formats for short-answer questions. Picking one in the builder fills in the question's
 * `validation.pattern` and `validation.patternMessage`; nothing else is stored, so a preset is recognised later
 * by its exact pattern text. Patterns carry no flags (Qub patterns have none) and all pass `isSafePattern`.
 */
export type PresetCategory = 'Popular' | 'Text & formats' | 'Identifiers' | 'Regional';
export const PRESET_CATEGORIES: readonly PresetCategory[] = ['Popular', 'Text & formats', 'Identifiers', 'Regional'];

export interface PatternPreset {
  id: string;
  name: string;
  category: PresetCategory;
  pattern: string;
  example: string;
  message: string;
}

export const PATTERN_PRESETS: readonly PatternPreset[] = [
  { id: 'email', name: 'Email address', category: 'Popular', pattern: String.raw`^[^\s@]+@[^\s@]+\.[^\s@]+$`, example: 'alex@example.com', message: 'Enter a valid email address, like name@example.com.' },
  { id: 'work_email', name: 'Work or school email', category: 'Popular', pattern: String.raw`^[^\s@]+@(?!gmail\.com$|yahoo\.com$|hotmail\.com$|outlook\.com$|aol\.com$|icloud\.com$)[^\s@]+\.[^\s@]+$`, example: 'sam@stripe.com', message: "Use your work or school email — personal webmail addresses aren't accepted." },
  { id: 'phone_us', name: 'US / Canada phone', category: 'Popular', pattern: String.raw`^(\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}$`, example: '(415) 555-0199', message: 'Enter a 10-digit phone number, like (415) 555-0199.' },
  { id: 'phone_intl', name: 'International phone (E.164)', category: 'Popular', pattern: String.raw`^\+[1-9]\d{6,14}$`, example: '+447911123456', message: 'Start with + and the country code, digits only, like +447911123456.' },
  { id: 'website', name: 'Website address', category: 'Popular', pattern: String.raw`^https?://[^\s/]+\.[^\s/]+(/\S*)?$`, example: 'https://example.org/about', message: 'Enter a link starting with http:// or https://.' },
  { id: 'letters', name: 'Letters only', category: 'Text & formats', pattern: String.raw`^[A-Za-z\s'-]+$`, example: "Anne-Marie O'Neil", message: 'Use letters, spaces, apostrophes and hyphens only.' },
  { id: 'alphanumeric', name: 'Letters and numbers', category: 'Text & formats', pattern: String.raw`^[A-Za-z0-9]+$`, example: 'ABC123', message: 'Use letters and numbers only, with no spaces.' },
  { id: 'digits', name: 'Digits only', category: 'Text & formats', pattern: String.raw`^\d+$`, example: '42', message: 'Use digits only.' },
  { id: 'usd', name: 'Amount (USD)', category: 'Text & formats', pattern: String.raw`^\$?\d+(\.\d{2})?$`, example: '$1250.00', message: 'Enter an amount like 1250 or $1250.00.' },
  { id: 'slug', name: 'URL slug', category: 'Text & formats', pattern: String.raw`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`, example: 'my-first-post', message: 'Use lowercase letters, numbers and hyphens, like my-first-post.' },
  { id: 'hex_color', name: 'Hex colour', category: 'Text & formats', pattern: String.raw`^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$`, example: '#1a73e8', message: 'Enter a colour like #1a73e8 or #fff.' },
  { id: 'x_handle', name: 'X (Twitter) handle', category: 'Identifiers', pattern: String.raw`^@?[A-Za-z0-9_]{1,15}$`, example: '@qubapp', message: 'Up to 15 letters, numbers or underscores, like @qubapp.' },
  { id: 'github', name: 'GitHub username', category: 'Identifiers', pattern: String.raw`^[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?$`, example: 'octocat', message: 'Letters, numbers and single hyphens, not at the start or end.' },
  { id: 'uuid', name: 'UUID', category: 'Identifiers', pattern: String.raw`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`, example: '123e4567-e89b-42d3-a456-426614174000', message: 'Enter an ID like 123e4567-e89b-42d3-a456-426614174000.' },
  { id: 'us_zip', name: 'US ZIP code', category: 'Regional', pattern: String.raw`^\d{5}(-\d{4})?$`, example: '94103-1234', message: 'Enter a ZIP code like 94103 or 94103-1234.' },
  { id: 'uk_postcode', name: 'UK postcode', category: 'Regional', pattern: String.raw`^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$`, example: 'SW1A 1AA', message: 'Enter a UK postcode like SW1A 1AA.' },
  { id: 'ca_postal', name: 'Canadian postal code', category: 'Regional', pattern: String.raw`^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$`, example: 'K1A 0B1', message: 'Enter a postal code like K1A 0B1.' },
];

/** The preset whose pattern is exactly `pattern`, or null (hand-written or no pattern). */
export function presetForPattern(pattern: string | undefined): PatternPreset | null {
  if (!pattern) return null;
  return PATTERN_PRESETS.find((p) => p.pattern === pattern) ?? null;
}
