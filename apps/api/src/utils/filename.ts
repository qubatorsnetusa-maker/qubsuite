import path from 'node:path';

/** Shared with the web app, which cleans form titles the same way before sending them. */
export { sanitizeFilename } from '@qub/shared';

/** "report.pdf" → "report (1).pdf", "report (1).pdf" → "report (2).pdf". */
export function nextDuplicateName(name: string, taken: Set<string>): string {
  if (!taken.has(name.toLowerCase())) return name;
  const ext = path.extname(name);
  let base = ext ? name.slice(0, -ext.length) : name;
  const m = /^(.*) \((\d+)\)$/.exec(base);
  let n = 1;
  if (m) {
    base = m[1]!;
    n = Number(m[2]) + 1;
  }
  for (;; n++) {
    const candidate = `${base} (${n})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** RFC 6266 Content-Disposition with a UTF-8 filename. */
export function contentDisposition(type: 'inline' | 'attachment', filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
