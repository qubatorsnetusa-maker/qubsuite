import type { AnswerValue, ScoreConfig } from '../schemas/forms';
import { isAnswered } from './conditions';
import type { EngineField } from './types';

function matchesCorrect(field: EngineField, correct: NonNullable<ScoreConfig['correct']>, value: AnswerValue): boolean {
  if (Array.isArray(correct)) {
    if (!Array.isArray(value) || value.length !== correct.length) return false;
    return field.type === 'RANKING' ? correct.every((c, i) => c === value[i]) : correct.every((c) => value.includes(c));
  }
  if (typeof correct === 'number') return (typeof value === 'number' ? value : Number(value)) === correct;
  if (typeof correct === 'boolean') return value === correct;
  if (typeof value === 'string') return value.trim().toLowerCase() === correct.trim().toLowerCase();
  if (Array.isArray(value)) return value.length === 1 && value[0] === correct;
  return false;
}

/** Points earned by one answer: option points plus `points` when the answer equals `correct`. */
export function scoreField(field: EngineField, value: AnswerValue | undefined): number {
  const sc = field.scoreConfig;
  if (!sc || !isAnswered(value)) return 0;
  let points = 0;
  if (sc.optionPoints) {
    const ids = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    for (const id of ids) points += sc.optionPoints[id] ?? 0;
  }
  if (sc.correct !== undefined && sc.points && matchesCorrect(field, sc.correct, value as AnswerValue)) points += sc.points;
  return points;
}
