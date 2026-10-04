import type { CellStyle } from '../schemas/sheets';

type Edges = NonNullable<CellStyle['borders']>;

/**
 * Applies a style patch. `null` values remove a property (`undefined` means "not specified" and is ignored); `borders` merges edge by edge and
 * `borders: null` removes every edge. Returns null when nothing is left, so empty styles are never stored.
 */
export function mergeStyle(base: CellStyle | null, patch: CellStyle): CellStyle | null {
  const out: Record<string, unknown> = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'borders' && value) {
      const edges: Record<string, unknown> = { ...((out.borders as Edges | undefined) ?? {}) };
      for (const [edge, border] of Object.entries(value as Edges)) {
        if (border === null) delete edges[edge];
        else if (border !== undefined) edges[edge] = border;
      }
      if (Object.keys(edges).length) out.borders = edges;
      else delete out.borders;
    } else if (value === null) delete out[key];
    else if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length ? (out as CellStyle) : null;
}
