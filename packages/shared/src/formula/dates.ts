const MS_PER_DAY = 86_400_000;
const EPOCH_MS = Date.UTC(1899, 11, 30);
/** 9999-12-31. */
export const MAX_DATE_SERIAL = 2_958_465;

export type DateKind = 'date' | 'time' | 'datetime';

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday. */
  weekday: number;
}

function utcMs(y: number, m: number, d: number, h = 0, mi = 0, s = 0): number {
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d); // unlike Date.UTC, keeps years 0–99 literal
  dt.setUTCHours(h, mi, s, 0);
  return dt.getTime();
}

/** Serial number (days since 1899-12-30, time as a fraction). Month/day overflow rolls over like Date. */
export function serialFromParts(y: number, m: number, d: number, h = 0, mi = 0, s = 0): number {
  return (utcMs(y, m, d, h, mi, s) - EPOCH_MS) / MS_PER_DAY;
}

export function partsFromSerial(serial: number): DateParts {
  const dt = new Date(EPOCH_MS + Math.round(serial * 86_400) * 1000);
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    hour: dt.getUTCHours(),
    minute: dt.getUTCMinutes(),
    second: dt.getUTCSeconds(),
    weekday: dt.getUTCDay(),
  };
}

/** Today's date serial (UTC). */
export const todaySerial = (now = new Date()) => serialFromParts(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
/** Current date-time serial (UTC). */
export const nowSerial = (now = new Date()) => (now.getTime() - EPOCH_MS) / MS_PER_DAY;

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1 || y > 9999) return false;
  const p = partsFromSerial(serialFromParts(y, m, d));
  return p.year === y && p.month === m && p.day === d;
}

function monthFromName(token: string): number | null {
  const t = token.toLowerCase().replace(/\.$/, '');
  if (t.length < 3) return null;
  const i = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(t));
  return i === -1 ? null : i + 1;
}

const fullYear = (y: string) => (y.length === 2 ? (Number(y) < 30 ? 2000 : 1900) + Number(y) : Number(y));

function parseDatePart(s: string): number | null {
  let m: RegExpExecArray | null;
  let y: number;
  let mo: number | null;
  let d: number;
  if ((m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s))) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s))) [mo, d, y] = [Number(m[1]), Number(m[2]), fullYear(m[3]!)];
  else if ((m = /^(\d{1,2}) ([A-Za-z]{3,9}\.?),? (\d{4})$/.exec(s))) [d, mo, y] = [Number(m[1]), monthFromName(m[2]!), Number(m[3])];
  else if ((m = /^([A-Za-z]{3,9}\.?) (\d{1,2}),? (\d{4})$/.exec(s))) [mo, d, y] = [monthFromName(m[1]!), Number(m[2]), Number(m[3])];
  else return null;
  if (mo === null || !validDate(y, mo, d)) return null;
  return serialFromParts(y, mo, d);
}

function parseTimePart(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))? ?([AaPp][Mm])?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2]);
  const sec = m[3] ? Number(m[3]) : 0;
  const ap = m[4]?.toLowerCase();
  if (mi > 59 || sec > 59) return null;
  if (ap) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ap === 'pm' ? 12 : 0);
  } else if (h > 23) return null;
  return (h * 3600 + mi * 60 + sec) / 86_400;
}

/**
 * Recognises typed dates, times and date-times: YYYY-MM-DD, YYYY/MM/DD, M/D/YYYY, M/D/YY (1930–2029), D Mon YYYY,
 * Mon D, YYYY, H:MM[:SS] [AM|PM], and a date followed by a time. Invalid calendar dates are not dates.
 */
export function parseDateTime(raw: string): { serial: number; kind: DateKind } | null {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s || s.length > 40) return null;
  const date = parseDatePart(s);
  if (date !== null) return { serial: date, kind: 'date' };
  const time = parseTimePart(s);
  if (time !== null) return { serial: time, kind: 'time' };
  const m = /^(.+?)[ T](\d{1,2}:\d{2}(?::\d{2})?(?: ?[AaPp][Mm])?)$/.exec(s);
  if (m) {
    const d = parseDatePart(m[1]!);
    const t = parseTimePart(m[2]!);
    if (d !== null && t !== null) return { serial: d + t, kind: 'datetime' };
  }
  return null;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Display text for a serial under a date/time format, or null when the number is not a representable date. */
export function formatDateSerial(serial: number, kind: DateKind): string | null {
  if (!Number.isFinite(serial) || serial < 0 || serial >= MAX_DATE_SERIAL + 1) return null;
  const p = partsFromSerial(serial);
  const date = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  const time = `${p.hour % 12 || 12}:${pad(p.minute)}:${pad(p.second)} ${p.hour < 12 ? 'AM' : 'PM'}`;
  return kind === 'date' ? date : kind === 'time' ? time : `${date} ${time}`;
}
