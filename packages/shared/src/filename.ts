const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/** The extension of a name that has no leading or trailing dots (as `sanitizeFilename` leaves it): `a.b.c` → `.c`. */
function extname(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i) : '';
}

/**
 * Makes a client-supplied filename safe to store and display.
 * Strips directories (path traversal), control and reserved characters, and bounds the length.
 * The name is only ever used as metadata — storage keys are generated server-side.
 * Pure and shared, so the builder can clean a form title exactly as the server will store it (undo then expects the stored name).
 */
export function sanitizeFilename(input: string | undefined | null, fallback = 'Untitled'): string {
  let name = (input ?? '').normalize('NFC');
  name = name.split(/[\\/]/).pop() ?? '';
  name = name
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');
  if (!name) return fallback;
  const ext = extname(name);
  const base = ext ? name.slice(0, -ext.length) : name;
  if (WINDOWS_RESERVED.test(base)) name = `_${name}`;
  if (name.length > 255) {
    const safeExt = ext.length <= 20 ? ext : '';
    name = name.slice(0, 255 - safeExt.length) + safeExt;
  }
  return name;
}
