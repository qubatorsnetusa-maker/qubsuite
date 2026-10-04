import type { FormFieldDto } from '@qub/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import type { UploadFn } from '../registry';
import type { FormSession } from '../session/use-form-session';
import { useFontPair } from './fonts';
import { QuestionBody, QuestionCard } from './question-card';
import type { RespondentForm } from './respondent-form';
import { SubmittedView, themeStyle, WelcomeScreen } from './screens';
import { FormBackground, FormBrandHeader, FormFooter } from './theme-chrome';

export interface RendererProps {
  form: RespondentForm;
  session: FormSession;
  mode: 'fill' | 'preview';
  upload?: UploadFn;
  banner?: ReactNode;
}

/** Section id of every field (null = before the first section). */
function sectionMap(fields: FormFieldDto[]) {
  const ordered = [...fields].sort((a, b) => a.position - b.position);
  const out = new Map<string, string | null>();
  let current: string | null = null;
  for (const f of ordered) {
    if (f.type === 'SECTION') current = f.id;
    out.set(f.id, current);
  }
  return { ordered, sectionOf: out };
}

/** Google-Forms layout: one page per section, questions shown or hidden live by the engine. */
export function ClassicRenderer({ form, session, mode, upload, banner }: RendererProps) {
  const { ordered, sectionOf } = useMemo(() => sectionMap(form.fields), [form.fields]);
  const byId = useMemo(() => new Map(form.fields.map((f) => [f.id, f])), [form.fields]);
  const welcome = form.fields.find((f) => f.type === 'WELCOME');
  const [started, setStarted] = useState(!welcome);
  const path = session.evaluation.path;
  const firstPage = path.length ? sectionOf.get(path[0]!)! : null;
  const [history, setHistory] = useState<(string | null)[]>([]);
  const page = history.length ? history.at(-1)! : firstPage;
  const pageFields = path.filter((id) => sectionOf.get(id) === page).map((id) => byId.get(id)!);

  const nextPage = (): string | null | 'submit' => {
    const lastHere = [...path].reverse().find((id) => sectionOf.get(id) === page);
    const after = lastHere ? path[path.indexOf(lastHere) + 1] : path.find((id) => byId.get(id)!.position > (page ? byId.get(page)!.position : -1));
    return after ? sectionOf.get(after)! : 'submit';
  };
  const next = nextPage();
  const style = themeStyle(form);
  useFontPair(form.theme.extras?.fontPair);

  if (session.status === 'submitted') {
    return (
      <div className="min-h-full" style={style}>
        <FormBackground theme={form.theme} />
        <div className="mx-auto w-full max-w-2xl px-4 pt-6"><FormBrandHeader theme={form.theme} /></div>
        <SubmittedView
          form={form}
          session={session}
          mode={mode}
          onAgain={() => {
            session.reset();
            setHistory([]);
            setStarted(!welcome);
          }}
        />
        <FormFooter theme={form.theme} />
      </div>
    );
  }
  if (!started && welcome) {
    return (
      <div className="min-h-full" style={style}>
        <FormBackground theme={form.theme} />
        {banner && <div className="mx-auto max-w-[640px] px-4 pt-4">{banner}</div>}
        <div className="mx-auto w-full max-w-2xl px-4 pt-6"><FormBrandHeader theme={form.theme} /></div>
        <WelcomeScreen form={form} welcome={welcome} session={session} onStart={() => setStarted(true)} />
        <FormFooter theme={form.theme} />
      </div>
    );
  }

  const isFirstPage = history.length === 0;
  const goNext = async () => {
    const ok = session.validate(
      pageFields.map((f) => f.id),
      { email: isFirstPage },
    );
    if (!ok) {
      document.getElementById(`field-${pageFields.find((f) => session.errors[f.id])?.id ?? 'email'}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (next !== 'submit') {
      setHistory((h) => [...(h.length ? h : [firstPage]), next]);
      window.scrollTo({ top: 0 });
      return;
    }
    await session.submit();
  };

  const sectionField = page ? byId.get(page) : undefined;
  const sectionCount = ordered.filter((f) => f.type === 'SECTION').length + (ordered[0]?.type === 'SECTION' ? 0 : 1);
  const pageNumber = (history.length || 1);
  const progress = next === 'submit' ? 100 : Math.round((pageNumber / (pageNumber + 1)) * 100);
  const busy = session.status === 'submitting' || session.status === 'retrying';

  return (
    <div className="min-h-full px-4 py-8" style={style}>
      <FormBackground theme={form.theme} />
      <form className="mx-auto max-w-[640px] space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); void goNext(); }}>
        {banner}
        <FormBrandHeader theme={form.theme} />
        {form.theme.headerImageUrl && <img src={form.theme.headerImageUrl} alt="" className="h-40 w-full rounded-lg object-cover" />}
        <header className="overflow-hidden rounded-lg bg-white shadow-card">
          <div className="h-2.5" style={{ background: form.theme.primaryColor }} />
          <div className="p-6">
            <h1 className="text-3xl" style={{ fontFamily: 'var(--form-font-heading)', color: 'var(--form-question)' }}>{form.title}</h1>
            {form.description && <p className="mt-3 whitespace-pre-wrap text-sm">{form.description}</p>}
            {form.signedInEmail && <p className="mt-3 border-t border-border pt-3 text-sm text-muted">Signed in as {form.signedInEmail}</p>}
            <p className="mt-2 text-xs text-danger">* Indicates required question</p>
          </div>
        </header>
        {sectionField?.label && (
          <div className="overflow-hidden rounded-lg bg-white shadow-card">
            <div className="px-6 py-3 text-white" style={{ background: form.theme.primaryColor }}>
              Section {pageNumber} of {sectionCount}
            </div>
            <h2 className="px-6 py-4 text-xl">{session.pipe(sectionField.label)}</h2>
            {sectionField.description && <p className="px-6 pb-4 text-sm text-muted">{session.pipe(sectionField.description)}</p>}
          </div>
        )}
        {isFirstPage && session.needsEmail && (
          <QuestionCard id="email" label="Email" required error={session.errors.email}>
            <Input type="email" aria-labelledby="label-email" value={session.email} onChange={(e) => session.setEmail(e.target.value)} placeholder="Your email" invalid={!!session.errors.email} autoComplete="email" />
          </QuestionCard>
        )}
        {pageFields.map((f) => (
          <QuestionCard key={f.id} id={f.id} label={session.pipe(f.label)} description={f.description ? session.pipe(f.description) : null} required={f.required} error={session.errors[f.id]}>
            <QuestionBody field={f} form={form} session={session} upload={upload} variant="classic" />
          </QuestionCard>
        ))}
        {session.status === 'retrying' && (
          <p role="status" className="rounded-lg bg-white px-4 py-2 text-sm">
            Connection lost — retrying…
          </p>
        )}
        {session.submitError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-4 py-2 text-sm text-danger">
            {session.submitError}
          </p>
        )}
        <div className="flex items-center gap-3 pt-2">
          {history.length > 1 && (
            <Button type="button" variant="outline" className="rounded-md bg-white" onClick={() => setHistory((h) => h.slice(0, -1))}>
              Back
            </Button>
          )}
          <Button type="submit" loading={busy} style={{ background: form.theme.primaryColor, borderRadius: 'var(--form-radius, 10px)' }}>
            {next === 'submit' ? 'Submit' : 'Next'}
          </Button>
          {form.settings.showProgressBar && sectionCount > 1 && (
            <div className="ml-auto flex items-center gap-2 text-xs text-muted" aria-label={`Progress ${progress}%`}>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-white/80">
                <div className="h-full" style={{ width: `${progress}%`, background: form.theme.primaryColor }} />
              </div>
              Page {pageNumber}
            </div>
          )}
        </div>
      </form>
      <FormFooter theme={form.theme} />
    </div>
  );
}
