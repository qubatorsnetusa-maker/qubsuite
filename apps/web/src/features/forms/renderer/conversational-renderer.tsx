import { QUESTION_TYPES } from '@qub/shared/forms';
import { ArrowLeft, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/form-controls';
import { FIELD_UI } from '../registry';
import type { RendererProps } from './classic-renderer';
import { useFontPair } from './fonts';
import { labelId, QuestionBody } from './question-card';
import { SubmittedView, themeStyle, WelcomeScreen } from './screens';
import { FormBackground, FormBrandHeader, FormFooter } from './theme-chrome';

const EMAIL_STEP = '__email__';
const TEXT_TARGET = 'input:not([type=radio]):not([type=checkbox]):not([type=range]), textarea, select, [role=listbox]';

/** Typeform-style: one question per screen, keyboard first, no network between questions. */
export function ConversationalRenderer({ form, session, mode, upload, banner }: RendererProps) {
  const byId = useMemo(() => new Map(form.fields.map((f) => [f.id, f])), [form.fields]);
  const welcome = form.fields.find((f) => f.type === 'WELCOME');
  const [started, setStarted] = useState(!welcome);
  const [history, setHistory] = useState<string[]>([]);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const stepRef = useRef<HTMLDivElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const path = session.needsEmail ? [...session.evaluation.path, EMAIL_STEP] : session.evaluation.path;
  const current = history.at(-1) ?? path[0];
  const index = current ? path.indexOf(current) : -1;
  const nextId = index >= 0 ? path[index + 1] : undefined;
  const field = current && current !== EMAIL_STEP ? byId.get(current) : undefined;
  const questionNumber = index + 1;
  const total = path.length;
  const progress = total ? Math.round((index / total) * 100) : 0;
  const error = current === EMAIL_STEP ? session.errors.email : current ? session.errors[current] : undefined;
  const busy = session.status === 'submitting' || session.status === 'retrying';

  // Focus the step's first control (or its heading) whenever the step changes.
  useEffect(() => {
    if (!started || session.status === 'submitted') return;
    const root = stepRef.current;
    const target = root?.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select, button[role=radio], [role=option]') ?? root?.querySelector<HTMLElement>('h1');
    target?.focus({ preventScroll: true });
  }, [current, started, session.status]);
  useEffect(() => () => void (advanceTimer.current && clearTimeout(advanceTimer.current)), []);

  const goNext = async () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (current === EMAIL_STEP) {
      if (session.validate([], { email: true })) await session.submit();
      return;
    }
    if (field && QUESTION_TYPES[field.type].isInput && !session.validate([field.id])) return;
    if (nextId) {
      setDirection('forward');
      setHistory((h) => [...(h.length ? h : [path[0]!]), nextId]);
      return;
    }
    await session.submit();
  };
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;
  const scheduleAdvance = () => {
    if (!field || !form.settings.autoAdvance || !FIELD_UI[field.type].autoAdvance?.(field)) return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => void goNextRef.current(), 350);
  };
  const goBack = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setDirection('back');
    setHistory((h) => h.slice(0, -1));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!started || session.status === 'submitted' || e.defaultPrevented) return;
    const target = e.target as HTMLElement;
    if (e.key === 'Enter') {
      if (target.tagName === 'BUTTON' || target.getAttribute('role') === 'option') return;
      if (target.tagName === 'TEXTAREA' && e.shiftKey) return;
      e.preventDefault();
      void goNext();
      return;
    }
    if (!field || e.metaKey || e.ctrlKey || e.altKey || target.matches(TEXT_TARGET)) return;
    const ui = FIELD_UI[field.type];
    const value = ui.keyToValue?.(field, e.key, session.answers[field.id]);
    if (value === undefined) return;
    e.preventDefault();
    session.setAnswer(field.id, value);
    scheduleAdvance();
  };
  // Listen on the window so shortcuts work even when focus is on the page background.
  const onKeyDownRef = useRef(onKeyDown);
  onKeyDownRef.current = onKeyDown;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKeyDownRef.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // When a 422 comes back, jump to the first failing question on the path.
  useEffect(() => {
    const first = session.evaluation.path.find((id) => session.errors[id]);
    if (session.submitError && first && first !== current) {
      setDirection('back');
      setHistory((h) => [...h, first]);
    }
  }, [session.submitError]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = themeStyle(form);
  useFontPair(form.theme.extras?.fontPair);
  if (session.status === 'submitted') {
    return (
      <div className="min-h-dvh" style={style}>
        <FormBackground theme={form.theme} />
        <div className="mx-auto w-full max-w-2xl px-4 pt-6"><FormBrandHeader theme={form.theme} /></div>
        <SubmittedView form={form} session={session} mode={mode} onAgain={() => { session.reset(); setHistory([]); setStarted(!welcome); }} />
        <FormFooter theme={form.theme} />
      </div>
    );
  }
  if (!started && welcome) {
    return (
      <div className="flex min-h-dvh flex-col justify-center" style={style}>
        <FormBackground theme={form.theme} />
        {banner && <div className="mx-auto w-full max-w-2xl px-4 pt-4">{banner}</div>}
        <div className="mx-auto w-full max-w-2xl px-4 pt-6"><FormBrandHeader theme={form.theme} /></div>
        <WelcomeScreen form={form} welcome={welcome} session={session} onStart={() => setStarted(true)} />
        <FormFooter theme={form.theme} />
      </div>
    );
  }

  const isContent = field && !QUESTION_TYPES[field.type].isInput;
  const nextLabel = isContent ? field.settings.buttonLabel || 'Continue' : nextId ? 'Next' : 'Submit';

  return (
    <div className="flex min-h-dvh flex-col" style={style}>
      <FormBackground theme={form.theme} />
      {form.settings.showProgressBar && (
        <div role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-1.5 w-full bg-black/10">
          <div className="h-full transition-[width] duration-300" style={{ width: `${progress}%`, background: form.theme.primaryColor }} />
        </div>
      )}
      <div className="mx-auto w-full max-w-2xl px-4 pt-6"><FormBrandHeader theme={form.theme} /></div>
      {banner && <div className="mx-auto w-full max-w-2xl px-4 pt-4">{banner}</div>}
      <p className="sr-only" aria-live="polite">
        {current && current !== EMAIL_STEP ? `Question ${questionNumber} of ${total}` : 'Your email'}
        {error ? `. ${error}` : ''}
      </p>
      <main className="flex flex-1 items-center">
        <div key={current ?? 'empty'} ref={stepRef} data-direction={direction} className="qub-step mx-auto w-full max-w-2xl px-4 py-10">
          {current === EMAIL_STEP ? (
            <section aria-labelledby="label-email" className="space-y-5">
              <h1 id="label-email" tabIndex={-1} className="text-2xl sm:text-3xl" style={{ fontFamily: 'var(--form-font-heading)', color: 'var(--form-question)' }}>
                What's your email?
              </h1>
              <Input type="email" autoComplete="email" aria-labelledby="label-email" value={session.email} onChange={(e) => session.setEmail(e.target.value)} className="h-14 max-w-md rounded-none border-0 border-b-2 bg-transparent px-0 text-2xl focus:ring-0" />
              <FieldError message={error} />
            </section>
          ) : field ? (
            <section aria-labelledby={labelId(field.id)} className="space-y-5">
              <h1 id={labelId(field.id)} tabIndex={-1} className="flex gap-3 text-2xl sm:text-3xl" style={{ fontFamily: 'var(--form-font-heading)', color: 'var(--form-question)' }}>
                {!isContent && (
                  <span aria-hidden className="flex shrink-0 items-center gap-1 text-base" style={{ color: form.theme.primaryColor }}>
                    {questionNumber} <ArrowRight className="size-4" />
                  </span>
                )}
                <span>
                  {session.pipe(field.label)}
                  {field.required && <span className="text-danger" aria-label="required"> *</span>}
                </span>
              </h1>
              {field.description && !isContent && <p className="whitespace-pre-wrap text-lg text-muted">{session.pipe(field.description)}</p>}
              <QuestionBody field={field} form={form} session={session} upload={upload} variant="conversational" onAnswered={scheduleAdvance} />
              <FieldError message={error} />
            </section>
          ) : (
            <p className="text-lg">Nothing to answer — you can submit now.</p>
          )}
          <div className="mt-8 flex items-center gap-3">
            <Button type="button" onClick={() => void goNext()} loading={busy} className="h-11 px-5 text-base" style={{ background: form.theme.primaryColor, borderRadius: 'var(--form-radius, 9999px)' }}>
              {nextLabel}
            </Button>
            <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
              press <strong>Enter</strong> <CornerDownLeft className="size-3" aria-hidden />
            </span>
          </div>
          {session.status === 'retrying' && (
            <p role="status" className="mt-4 text-sm">
              Connection lost — retrying…
            </p>
          )}
          {session.submitError && (
            <p role="alert" className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {session.submitError}
            </p>
          )}
        </div>
      </main>
      <nav className="sticky bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/5 px-4 py-3" aria-label="Question navigation">
        <Button type="button" variant="outline" size="sm" onClick={goBack} disabled={history.length <= 1} aria-label="Back" className="bg-white">
          <ArrowLeft />
        </Button>
      </nav>
      <FormFooter theme={form.theme} />
    </div>
  );
}
