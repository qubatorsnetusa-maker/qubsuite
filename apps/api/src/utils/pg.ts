/** Postgres SQLSTATE of an error, looking through driver/ORM wrappers (`cause`). */
export function pgErrorCode(e: unknown): string | undefined {
  let current: unknown = e;
  for (let depth = 0; depth < 4 && current; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export const isUniqueViolation = (e: unknown) => pgErrorCode(e) === '23505';
