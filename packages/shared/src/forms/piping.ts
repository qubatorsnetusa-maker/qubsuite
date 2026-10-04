import type { AnswerValue } from '../schemas/forms';
import { isAnswered } from './conditions';
import type { EvaluationResult } from './engine';
import { PIPE_TOKEN } from './formula';
import { QUESTION_TYPES } from './registry';
import type { Answers, FormDefinition } from './types';

export interface PipingContext {
  /** Text for `{{key}}`, or undefined when no field, variable or built-in has that key. */
  resolve(key: string): string | undefined;
}

export interface Outcome {
  endingId: string | null;
  title: string | null;
  message: string;
  redirectUrl: string | null;
  /** The ending's link button, piped and http(s)-only. */
  endingButtonUrl: string | null;
  /** The ending's own (possibly delayed) redirect; null when a REDIRECT rule already ended the form. */
  endingRedirectUrl: string | null;
}

/** Replaces `{{key}}` with plain text. The result must be rendered as text, never as HTML. */
export function interpolate(template: string, ctx: PipingContext): string {
  return template.replace(PIPE_TOKEN, (_m, key: string) => ctx.resolve(key) ?? '');
}

export function buildPipingContext(def: FormDefinition, answers: Answers, result: Pick<EvaluationResult, 'path' | 'variables' | 'score'>): PipingContext {
  const onPath = new Set(result.path);
  const byRef = new Map(def.fields.map((f) => [f.ref, f]));
  return {
    resolve(key) {
      if (key === 'score') return String(result.score);
      if (Object.hasOwn(result.variables, key)) {
        const v = result.variables[key];
        return v === null || v === undefined ? '' : String(v);
      }
      const f = byRef.get(key);
      if (!f) return undefined;
      if (f.type !== 'HIDDEN' && !onPath.has(f.id)) return '';
      const a = answers[f.id];
      return isAnswered(a) ? QUESTION_TYPES[f.type].display(f, a as AnswerValue) : '';
    },
  };
}

/** Pipes values into a redirect template (URL-encoded) and only returns http(s) URLs. */
export function safeRedirectUrl(template: string, ctx: PipingContext): string | null {
  const url = template.trim().replace(PIPE_TOKEN, (_m, key: string) => encodeURIComponent(ctx.resolve(key) ?? ''));
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Ending title/message and redirect for a finished walk — built on the server for real submissions. */
export function resolveOutcome(def: FormDefinition, answers: Answers, result: EvaluationResult, defaultMessage: string): Outcome {
  const ctx = buildPipingContext(def, answers, result);
  const ending = result.endingId ? def.fields.find((f) => f.id === result.endingId) : undefined;
  return {
    endingId: ending?.id ?? null,
    title: ending ? interpolate(ending.label, ctx) || null : null,
    // `||`: an empty override or ending description falls back to the next message, not to blank text.
    message: interpolate(result.message || ending?.description || defaultMessage, ctx),
    redirectUrl: result.redirect ? safeRedirectUrl(result.redirect, ctx) : null,
    endingButtonUrl: ending?.settings.buttonUrl ? safeRedirectUrl(ending.settings.buttonUrl, ctx) : null,
    endingRedirectUrl: !result.redirect && ending?.settings.redirectUrl ? safeRedirectUrl(ending.settings.redirectUrl, ctx) : null,
  };
}
