import { QUESTION_TYPES } from './registry';
import type { EngineField } from './types';

/** "Takes about N minutes" for the welcome screen; matrices count per row. */
export function estimateMinutes(fields: EngineField[]): number {
  const seconds = fields.reduce((total, f) => {
    const def = QUESTION_TYPES[f.type];
    if (!def.isStep) return total;
    const rows = f.type === 'MATRIX' ? Math.max(1, f.options.filter((o) => o.kind === 'row').length) : 1;
    return total + def.estimateSeconds * rows;
  }, 0);
  return Math.max(1, Math.round(seconds / 60));
}
