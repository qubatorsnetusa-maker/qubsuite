import type { AnswerValue, SubmitResponseResult } from '@qub/shared';
import { buildPipingContext, evaluateForm, hiddenAnswers, interpolate, isValidEmail, QUESTION_TYPES, validateFieldAnswer, type Answers, type EvaluationResult, type FormDefinition } from '@qub/shared/forms';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, errorMessage } from '@/lib/api';
import type { SubmitPayload } from '@/services/forms';
import type { UploadedFile } from '../registry/types';
import type { RespondentForm } from '../renderer/respondent-form';

export type SubmitFn = (payload: SubmitPayload) => Promise<SubmitResponseResult>;
export type SessionStatus = 'filling' | 'submitting' | 'retrying' | 'submitted';

export interface FormSession {
  answers: Answers;
  evaluation: EvaluationResult;
  pipe(text: string): string;
  uploads: Record<string, UploadedFile[]>;
  errors: Record<string, string>;
  status: SessionStatus;
  submitError: string | null;
  result: SubmitResponseResult | null;
  hasSavedProgress: boolean;
  email: string;
  /** The form collects email and the respondent is not signed in. */
  needsEmail: boolean;
  setEmail(v: string): void;
  setAnswer(fieldId: string, value: AnswerValue): void;
  setUploads(fieldId: string, files: UploadedFile[]): void;
  validate(fieldIds: string[], opts?: { email?: boolean }): boolean;
  submit(): Promise<boolean>;
  resume(): void;
  discardSaved(): void;
  reset(): void;
}

interface Saved {
  v: 1;
  answers: Answers;
  uploads: Record<string, UploadedFile[]>;
  email: string;
}

const MAX_ATTEMPTS = 6;
const retryable = (err: unknown) => err instanceof ApiError && (err.code === 'NETWORK_ERROR' || err.status === 502 || err.status === 503 || err.status === 504);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readSaved(key: string | null): Saved | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Saved) : null;
    return parsed?.v === 1 && Object.keys(parsed.answers ?? {}).length ? parsed : null;
  } catch {
    return null;
  }
}
function removeSaved(key: string | null) {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export function useFormSession(opts: { form: RespondentForm; submit: SubmitFn; storageKey: string | null; hidden?: Record<string, string>; retryDelayMs?: number }): FormSession {
  const { form, storageKey, hidden } = opts;
  const persist = storageKey && form.settings.saveProgress ? storageKey : null;
  const definition = useMemo<FormDefinition>(() => ({ fields: form.fields, variables: form.variables }), [form.fields, form.variables]);
  // HIDDEN fields take their value from the link only (the server ignores defaults for them).
  const defaults = useMemo(
    () => Object.fromEntries(form.fields.filter((f) => f.type !== 'HIDDEN' && f.defaultValue !== null && f.defaultValue !== undefined).map((f) => [f.id, f.defaultValue])) as Answers,
    [form.fields],
  );

  const [answers, setAnswers] = useState<Answers>(defaults);
  const [uploads, setUploadMap] = useState<Record<string, UploadedFile[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<SessionStatus>('filling');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResponseResult | null>(null);
  const [email, setEmailState] = useState('');
  const [saved, setSaved] = useState<Saved | null>(() => readSaved(persist));
  const attemptId = useRef<string | null>(null);
  const startedAt = useRef<string | null>(null);
  const touched = useRef(false);

  const withHidden = useMemo(() => ({ ...answers, ...hiddenAnswers(definition, hidden ?? {}) }), [answers, definition, hidden]);
  const evaluation = useMemo(() => evaluateForm(definition, withHidden), [definition, withHidden]);
  const pipingContext = useMemo(() => buildPipingContext(definition, withHidden, evaluation), [definition, withHidden, evaluation]);
  const pipe = useCallback((text: string) => interpolate(text, pipingContext), [pipingContext]);
  const needsEmail = form.settings.collectEmail && !form.signedInEmail;

  // Persist unfinished answers (debounced). Only after the respondent has touched something.
  useEffect(() => {
    if (!persist || !touched.current || status === 'submitted') return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(persist, JSON.stringify({ v: 1, answers, uploads, email } satisfies Saved));
      } catch {
        /* storage full or blocked: keep going without it */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [persist, answers, uploads, email, status]);

  const clearError = (id: string) =>
    setErrors((e) => {
      if (!(id in e)) return e;
      const { [id]: _drop, ...rest } = e;
      return rest;
    });

  const setAnswer = useCallback((fieldId: string, value: AnswerValue) => {
    touched.current = true;
    startedAt.current ??= new Date().toISOString();
    setAnswers((a) => ({ ...a, [fieldId]: value }));
    clearError(fieldId);
  }, []);

  const setUploads = useCallback((fieldId: string, files: UploadedFile[]) => {
    touched.current = true;
    setUploadMap((u) => ({ ...u, [fieldId]: files }));
  }, []);

  const setEmail = useCallback((v: string) => {
    touched.current = true;
    setEmailState(v);
  }, []);

  const byId = useMemo(() => new Map(form.fields.map((f) => [f.id, f])), [form.fields]);

  const validate = useCallback(
    (fieldIds: string[], o: { email?: boolean } = {}) => {
      const next: Record<string, string> = {};
      for (const id of fieldIds) {
        const field = byId.get(id);
        if (!field) continue;
        const problem = validateFieldAnswer(field, withHidden[id]);
        if (problem) next[id] = problem.message;
      }
      if (o.email && needsEmail && !isValidEmail(email.trim())) next.email = 'Enter a valid email address';
      setErrors(next);
      return Object.keys(next).length === 0;
    },
    [byId, withHidden, needsEmail, email],
  );

  const submit = useCallback(async () => {
    if (!validate(evaluation.path, { email: true })) return false;
    const onPath = evaluation.path.filter((id) => QUESTION_TYPES[byId.get(id)!.type].isInput);
    const payload: SubmitPayload = {
      answers: Object.fromEntries(onPath.filter((id) => answers[id] !== undefined).map((id) => [id, answers[id]!])),
      ...(needsEmail ? { email: email.trim() } : {}),
      ...(hidden && Object.keys(hidden).length ? { hidden } : {}),
      clientSubmissionId: (attemptId.current ??= crypto.randomUUID()),
      ...(startedAt.current ? { startedAt: startedAt.current } : {}),
    };
    setSubmitError(null);
    setStatus('submitting');
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await opts.submit(payload);
        setResult(r);
        setStatus('submitted');
        attemptId.current = null;
        removeSaved(persist);
        return true;
      } catch (err) {
        if (retryable(err) && attempt < MAX_ATTEMPTS - 1) {
          setStatus('retrying');
          await sleep((opts.retryDelayMs ?? 1000) * 2 ** attempt);
          continue;
        }
        if (err instanceof ApiError && err.status === 422 && Object.keys(err.fieldErrors).length) {
          setErrors(err.fieldErrors);
          setSubmitError('Some answers need attention.');
        } else setSubmitError(errorMessage(err));
        setStatus('filling');
        return false;
      }
    }
  }, [validate, evaluation.path, byId, answers, needsEmail, email, hidden, opts, persist]);

  const resume = useCallback(() => {
    if (!saved) return;
    touched.current = true;
    setAnswers({ ...defaults, ...saved.answers });
    setUploadMap(saved.uploads ?? {});
    setEmail(saved.email ?? '');
    setSaved(null);
  }, [saved, defaults, setEmail]);

  const discardSaved = useCallback(() => {
    removeSaved(persist);
    setSaved(null);
  }, [persist]);

  const reset = useCallback(() => {
    touched.current = false;
    attemptId.current = null;
    startedAt.current = null;
    setAnswers(defaults);
    setUploadMap({});
    setErrors({});
    setResult(null);
    setSubmitError(null);
    setStatus('filling');
    removeSaved(persist);
  }, [defaults, persist]);

  return {
    answers,
    evaluation,
    pipe,
    uploads,
    errors,
    status,
    submitError,
    result,
    hasSavedProgress: !!saved,
    email,
    needsEmail,
    setEmail,
    setAnswer,
    setUploads,
    validate,
    submit,
    resume,
    discardSaved,
    reset,
  };
}
