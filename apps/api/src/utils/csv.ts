/** One CSV cell: quoted when needed, and neutralised against spreadsheet formula injection. */
export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvRow(cells: unknown[]): string {
  return `${cells.map(csvCell).join(',')}\n`;
}
