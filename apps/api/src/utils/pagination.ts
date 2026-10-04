import { badRequest } from './errors';

/** Opaque offset cursor. */
export function encodeOffsetCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
}

export function decodeOffsetCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { o?: unknown };
    if (typeof parsed.o === 'number' && Number.isInteger(parsed.o) && parsed.o >= 0) return parsed.o;
  } catch {
    // fall through
  }
  throw badRequest('Invalid cursor');
}

/** Keyset cursor for (timestamp, id) ordered lists. */
export function encodeKeysetCursor(at: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: at.toISOString(), i: id })).toString('base64url');
}

export function decodeKeysetCursor(cursor: string | undefined): { at: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { t?: unknown; i?: unknown };
    if (typeof parsed.t === 'string' && typeof parsed.i === 'string') {
      const at = new Date(parsed.t);
      if (!Number.isNaN(at.getTime()) && /^[0-9a-f-]{36}$/.test(parsed.i)) return { at, id: parsed.i };
    }
  } catch {
    // fall through
  }
  throw badRequest('Invalid cursor');
}

/** Returns `limit` items plus the next cursor, given a result fetched with `limit + 1`. */
export function pageOf<T>(rows: T[], limit: number, offset: number): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, nextCursor: hasMore ? encodeOffsetCursor(offset + limit) : null };
}

/** Escapes LIKE/ILIKE wildcards in user input. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}
