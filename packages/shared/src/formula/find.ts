export interface FindOptions {
  find: string;
  matchCase: boolean;
  wholeCell: boolean;
  /** Search formula text too; otherwise formula cells never match. */
  includeFormulas: boolean;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether a cell's input matches (used by the find endpoint and replace-all, so both agree). */
export function cellMatches(input: string, o: FindOptions): boolean {
  if (!o.find || input === '' || (!o.includeFormulas && input.startsWith('='))) return false;
  if (o.wholeCell) return o.matchCase ? input === o.find : input.toLowerCase() === o.find.toLowerCase();
  return o.matchCase ? input.includes(o.find) : input.toLowerCase().includes(o.find.toLowerCase());
}

/** The input with every occurrence replaced literally (no $-patterns), or null when it does not match. */
export function replaceInInput(input: string, replacement: string, o: FindOptions): string | null {
  if (!cellMatches(input, o)) return null;
  if (o.wholeCell) return replacement;
  return input.replace(new RegExp(escapeRegex(o.find), o.matchCase ? 'g' : 'gi'), () => replacement);
}
