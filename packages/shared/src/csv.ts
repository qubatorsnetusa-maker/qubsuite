import { parseNumberLiteral } from './formula/values';

export class CsvError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
  }
}

/** The most frequent of , ; and tab outside quotes on the first line (comma when there are none). */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const counts: Record<',' | ';' | '\t', number> = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const ch of text.replace(/^﻿/, '')) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && ch in counts) counts[ch as keyof typeof counts]++;
  }
  const [best, n] = (Object.entries(counts) as [',' | ';' | '\t', number][]).sort((a, b) => b[1] - a[1])[0]!;
  return n > 0 ? best : ',';
}

/** RFC 4180 parser: quoted fields, "" escapes, embedded newlines, CRLF/LF line ends, a leading BOM. */
export function parseCsv(input: string, delimiter: string = detectDelimiter(input)): string[][] {
  const text = input.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let quoteStartLine = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
      quoteStartLine = line;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      line++;
    } else field += ch;
  }
  if (quoted) throw new CsvError('A quoted field is never closed', quoteStartLine);
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const FORMULA_START = /^[=+\-@]/;

/** Cell input for an imported field: anything that would otherwise become a formula is kept as literal text. */
export function csvImportInput(field: string): string {
  return FORMULA_START.test(field) && parseNumberLiteral(field) === null ? `'${field}` : field;
}

export interface CsvField {
  text: string;
  /** Text values that spreadsheet apps would treat as formulas are written with a leading '. */
  isText: boolean;
}

function csvField({ text, isText }: CsvField): string {
  const safe = isText && FORMULA_START.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One CSV line (CRLF-terminated). */
export function csvLine(fields: CsvField[]): string {
  return `${fields.map(csvField).join(',')}\r\n`;
}

/** CSV text (UTF-8 BOM, CRLF). */
export function toCsv(rows: CsvField[][]): string {
  return '﻿' + rows.map(csvLine).join('');
}
