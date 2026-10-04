export function colToLetters(col: number): string {
  let n = col + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function cellA1(row: number, col: number): string {
  return `${colToLetters(col)}${row + 1}`;
}

const A1_RE = /^\$?([A-Za-z]{1,3})\$?([1-9]\d{0,6})$/;

export function parseA1(ref: string): { row: number; col: number } | null {
  const m = A1_RE.exec(ref.trim());
  if (!m) return null;
  return { row: Number(m[2]) - 1, col: lettersToCol(m[1]!) };
}

export function rangeA1(r: { startRow: number; startCol: number; endRow: number; endCol: number }): string {
  const a = cellA1(r.startRow, r.startCol);
  const b = cellA1(r.endRow, r.endCol);
  return a === b ? a : `${a}:${b}`;
}

export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function parseCellKey(key: string): { row: number; col: number } {
  const i = key.indexOf(':');
  return { row: Number(key.slice(0, i)), col: Number(key.slice(i + 1)) };
}

/** Quotes a sheet name for use in a formula when needed: 'My Sheet'!A1. */
export function formatSheetPrefix(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(name) && !/^[A-Za-z]{1,3}\d+$/.test(name)
    ? `${name}!`
    : `'${name.replace(/'/g, "''")}'!`;
}
