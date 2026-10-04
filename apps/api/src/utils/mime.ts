import path from 'node:path';
import type { FileType } from '@qub/shared';

export const NATIVE_MIME: Record<'DOCUMENT' | 'SPREADSHEET' | 'FORM', string> = {
  DOCUMENT: 'application/vnd.qub.document',
  SPREADSHEET: 'application/vnd.qub.spreadsheet',
  FORM: 'application/vnd.qub.form',
};

/** Text formats that magic-byte sniffing cannot detect; accepted only when the content is really text. */
const TEXT_EXTENSIONS: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.json': 'application/json',
  '.log': 'text/plain',
  '.xml': 'application/xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.svg': 'image/svg+xml',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.ts': 'text/plain',
};

/** Executables are refused outright. */
const BLOCKED_MIME = new Set([
  'application/x-msdownload',
  'application/x-dosexec',
  'application/x-executable',
  'application/x-elf',
  'application/x-mach-binary',
  'application/vnd.microsoft.portable-executable',
  'application/x-msi',
]);
const BLOCKED_EXTENSIONS = new Set(['.exe', '.dll', '.msi', '.bat', '.cmd', '.com', '.scr', '.ps1', '.vbs', '.jar']);

/** Types that are safe to render inline in the browser. Everything else is served as an attachment. */
const INLINE_SAFE = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/aac',
  'audio/mp4',
  'text/plain',
  'text/csv',
  'text/markdown',
]);

export function isInlineSafe(mime: string): boolean {
  return INLINE_SAFE.has(mime);
}

export function isBlocked(mime: string, filename: string): boolean {
  return BLOCKED_MIME.has(mime) || BLOCKED_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

export function looksLikeText(sample: Buffer): boolean {
  if (sample.length === 0) return true;
  if (sample.includes(0)) return false;
  // Reject when more than 5% of bytes are unusual control characters.
  let suspicious = 0;
  for (const b of sample) if (b < 7 || (b > 13 && b < 32 && b !== 27)) suspicious++;
  return suspicious / sample.length < 0.05;
}

/**
 * Decides the stored MIME type from sniffed magic bytes, falling back to the extension only for text formats
 * whose content was verified to be text. The browser-declared type is never used.
 */
export function resolveMime(sniffed: string | undefined, filename: string, sample: Buffer): string {
  if (sniffed) return sniffed;
  const byExt = TEXT_EXTENSIONS[path.extname(filename).toLowerCase()];
  if (looksLikeText(sample)) return byExt ?? 'text/plain';
  return 'application/octet-stream';
}

export function fileTypeFromMime(mime: string): FileType {
  if (mime === NATIVE_MIME.DOCUMENT) return 'DOCUMENT';
  if (mime === NATIVE_MIME.SPREADSHEET) return 'SPREADSHEET';
  if (mime === NATIVE_MIME.FORM) return 'FORM';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') return 'TEXT';
  if (
    [
      'application/zip',
      'application/x-7z-compressed',
      'application/x-rar-compressed',
      'application/vnd.rar',
      'application/gzip',
      'application/x-tar',
      'application/x-bzip2',
      'application/x-xz',
    ].includes(mime)
  )
    return 'ARCHIVE';
  return 'OTHER';
}

/** Categories used by form upload restrictions. */
export function mimeCategory(mime: string): 'image' | 'pdf' | 'document' | 'spreadsheet' | 'video' | 'audio' | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (
    mime.includes('spreadsheet') ||
    mime === 'text/csv' ||
    mime === 'application/vnd.ms-excel'
  )
    return 'spreadsheet';
  if (
    mime.includes('wordprocessing') ||
    mime === 'application/msword' ||
    mime.startsWith('text/') ||
    mime === 'application/rtf' ||
    mime.includes('opendocument.text')
  )
    return 'document';
  return 'other';
}
