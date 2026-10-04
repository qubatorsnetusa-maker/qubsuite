import type { EndingBadge, FormFieldDto, ThemeButtonRadius } from '@qub/shared';
import { estimateMinutes } from '@qub/shared/forms';
import { CheckCircle2, Clock, Heart, Rocket, Sparkles, ThumbsUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import type { FormSession } from '../session/use-form-session';
import { BODY_STACK, fontPairById } from './fonts';
import type { RespondentForm } from './respondent-form';

export const FONTS = { sans: 'var(--font-sans)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' };
export const RADIUS_PX: Record<ThemeButtonRadius, string> = { sharp: '0px', rounded: '10px', pill: '9999px' };

export function themeStyle(form: RespondentForm): CSSProperties {
  const x = form.theme.extras ?? {};
  const pair = fontPairById(x.fontPair);
  const fallback = FONTS[form.theme.fontFamily];
  return {
    '--form-primary': form.theme.primaryColor,
    '--form-bg': form.theme.backgroundColor,
    '--form-question': x.questionColor ?? 'var(--color-foreground)',
    // Omitted when unset, so each renderer's own var() fallback keeps today's button shape.
    ...(x.buttonRadius ? { '--form-radius': RADIUS_PX[x.buttonRadius] } : {}),
    '--form-font-heading': pair ? `${pair.heading}, ${pair.headingTail}` : fallback,
    '--form-font-body': pair ? `${pair.body}, ${BODY_STACK}` : fallback,
    fontFamily: 'var(--form-font-body)',
    background: form.theme.backgroundColor,
  } as CSSProperties;
}

export function WelcomeScreen({ form, welcome, session, onStart }: { form: RespondentForm; welcome: FormFieldDto; session: FormSession; onStart(): void }) {
  const minutes = estimateMinutes(form.fields);
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-5 px-4 py-16">
      {welcome.settings.imageUrl && <img src={welcome.settings.imageUrl} alt={welcome.settings.imageAlt ?? ''} className="max-h-72 rounded-lg object-contain" />}
      <h1 className="text-3xl sm:text-4xl" style={{ fontFamily: 'var(--form-font-heading)', color: 'var(--form-question)' }}>{session.pipe(welcome.label) || form.title}</h1>
      {welcome.description && <p className="whitespace-pre-wrap text-lg text-muted">{session.pipe(welcome.description)}</p>}
      <div className="flex items-center gap-4">
        <Button autoFocus onClick={onStart} className="h-11 px-6 text-base" style={{ background: form.theme.primaryColor, borderRadius: 'var(--form-radius, 9999px)' }}>
          {welcome.settings.buttonLabel || 'Start'}
        </Button>
        {form.settings.showTimeEstimate && (
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <Clock className="size-4" aria-hidden /> Takes about {minutes} minute{minutes === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  );
}

const BADGES: Record<EndingBadge, LucideIcon> = { check: CheckCircle2, sparkles: Sparkles, heart: Heart, rocket: Rocket, thumbs_up: ThumbsUp };

/** The ending's badge icon (a tick unless the author chose another). */
export function EndingBadgeIcon({ badge, color, className }: { badge: EndingBadge | undefined; color: string; className?: string }) {
  const key = badge ?? 'check';
  const Icon = BADGES[key];
  return <Icon data-testid={`ending-badge-${key}`} className={className} style={{ color }} aria-hidden />;
}

/** Ending screen (from logic), or the plain confirmation. Redirects replace the page on the live form. */
export function SubmittedView({ form, session, mode, onAgain }: { form: RespondentForm; session: FormSession; mode: 'fill' | 'preview'; onAgain(): void }) {
  const result = session.result!;
  const ending = result.endingId ? form.fields.find((f) => f.id === result.endingId) : undefined;
  const color = form.theme.primaryColor;
  const ruleRedirect = result.redirectUrl;
  const endingRedirect = ruleRedirect ? null : (result.endingRedirectUrl ?? null);
  const delay = ending?.settings.redirectDelay ?? 0;
  const immediate = ruleRedirect ?? (endingRedirect && delay === 0 ? endingRedirect : null);
  const [left, setLeft] = useState<number | null>(mode === 'fill' && endingRedirect && delay > 0 ? delay : null);
  // Used to cancel the countdown from "Stay on this page" without tearing down the interval
  const cancelledRef = useRef(false);

  // Immediate redirect: rule-based or zero-delay ending redirect
  useEffect(() => {
    if (mode === 'fill' && immediate) window.location.assign(immediate);
  }, [mode, immediate]);

  // Countdown: use setInterval so that vi.advanceTimersByTime(N) fires N ticks inside a single act()
  useEffect(() => {
    if (mode !== 'fill' || !endingRedirect || delay <= 0) return;
    cancelledRef.current = false;
    let remaining = delay;
    const id = setInterval(() => {
      if (cancelledRef.current) {
        clearInterval(id);
        return;
      }
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(id);
        window.location.assign(endingRedirect);
      } else {
        setLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [mode, endingRedirect, delay]);

  const cancelCountdown = () => {
    cancelledRef.current = true;
    setLeft(null);
  };

  const liveTarget = ruleRedirect ?? endingRedirect;
  const showAgain = mode === 'fill' && !immediate && ending?.settings.showSubmitAnother !== false;
  return (
    <div className="mx-auto max-w-2xl px-4 py-16" role="status">
      {ending?.settings.imageUrl && <img src={ending.settings.imageUrl} alt={ending.settings.imageAlt ?? ''} className="mb-6 max-h-72 rounded-lg object-contain" />}
      <h1 className="text-3xl" style={{ fontFamily: 'var(--form-font-heading)', color: 'var(--form-question)' }}>{result.title ?? form.title}</h1>
      <p className="mt-4 flex items-start gap-2 whitespace-pre-wrap text-lg">
        <EndingBadgeIcon badge={ending?.settings.badgeIcon} color={color} className="mt-1 size-5 shrink-0" /> {result.message}
      </p>
      {result.score !== null && <p className="mt-3 text-lg">Your score: {result.score}</p>}
      {result.endingButtonUrl && (
        <Button asChild className="mt-6 h-11 px-6 text-base" style={{ background: color, borderRadius: 'var(--form-radius, 9999px)' }}>
          <a href={result.endingButtonUrl}>{ending?.settings.buttonLabel || 'Continue'}</a>
        </Button>
      )}
      {left !== null && endingRedirect && (
        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
          <span aria-hidden>Redirecting in {left}s…</span>
          <span className="sr-only">You will be redirected in {delay} seconds.</span>
          <Button type="button" size="sm" style={{ background: color, borderRadius: 'var(--form-radius, 9999px)' }} onClick={() => window.location.assign(endingRedirect)}>
            Go now
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={cancelCountdown}>
            Stay on this page
          </Button>
        </div>
      )}
      {liveTarget && mode === 'preview' && <p className="mt-3 text-sm text-muted">On the live form, respondents are sent to {liveTarget}</p>}
      {showAgain && (
        <button className="mt-6 block text-sm underline" style={{ color }} onClick={onAgain}>
          Submit another response
        </button>
      )}
    </div>
  );
}
