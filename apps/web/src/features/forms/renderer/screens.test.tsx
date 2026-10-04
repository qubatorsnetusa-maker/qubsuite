import type { FormFieldDto, SubmitResponseResult } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormSession } from '../session/use-form-session';
import type { RespondentForm } from './respondent-form';
import { SubmittedView, themeStyle } from './screens';

const themed = (extras: object | undefined) => themeStyle({
  title: 'T', description: null, fields: [], variables: [],
  theme: { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'serif', headerImageUrl: null, extras },
  settings: { ...DEFAULT_FORM_SETTINGS },
} as never) as Record<string, string>;

describe('themeStyle', () => {
  it('omits --form-radius when no buttonRadius is set, so each layout keeps its own shape', () => {
    expect('--form-radius' in themed({})).toBe(false);
    expect('--form-radius' in themed(undefined)).toBe(false);
  });

  it('falls back to the fontFamily column and the page foreground for a bare theme', () => {
    const s = themed({});
    expect(s['--form-font-body']).toBe('var(--font-serif)');
    expect(s['--form-font-heading']).toBe('var(--font-serif)');
    expect(s['--form-question']).toBe('var(--color-foreground)');
  });

  it('emits every variable for a full extras object', () => {
    const s = themed({ questionColor: '#0c4a6e', fontPair: 'playfair', buttonRadius: 'pill' });
    expect(s['--form-primary']).toBe('#673ab7');
    expect(s['--form-question']).toBe('#0c4a6e');
    expect(s['--form-radius']).toBe('9999px');
    expect(s['--form-font-heading']).toContain("'Playfair Display'");
    expect(s['--form-font-heading']).toContain('serif');
    expect(s['--form-font-body']).toContain("'Inter'");
  });

  it('gives a sans heading a sans tail', () => {
    expect(themed({ fontPair: 'grotesk' })['--form-font-heading']).not.toContain('Georgia');
  });
});

const ending = (settings: FormFieldDto['settings']): FormFieldDto => ({
  id: 'end', ref: 'end', type: 'ENDING', label: 'Thanks', description: null, required: false, position: 1,
  validation: {}, settings, options: [], rules: [], scoreConfig: null, placeholder: null, defaultValue: null,
});
const form = (end: FormFieldDto): RespondentForm => ({ title: 'Survey', description: null, fields: [end], variables: [], theme: { primaryColor: '#123456', backgroundColor: '#ffffff', fontFamily: 'sans', headerImageUrl: null }, settings: { ...DEFAULT_FORM_SETTINGS } as RespondentForm['settings'] });
const session = (over: Partial<SubmitResponseResult> = {}) => ({ result: { id: 'r', confirmationMessage: 'Done', message: 'Done', endingId: 'end', title: 'Thanks', redirectUrl: null, score: null, ...over } }) as unknown as FormSession;

let assign: ReturnType<typeof vi.fn>;
const realLocation = window.location;
beforeEach(() => {
  assign = vi.fn();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, assign } });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  vi.useRealTimers();
});

describe('SubmittedView endings', () => {
  it('looks exactly as before when no new settings are set', () => {
    render(<SubmittedView form={form(ending({}))} session={session()} mode="fill" onAgain={() => {}} />);
    expect(screen.getByTestId('ending-badge-check')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit another response' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('shows the chosen badge and the link button', () => {
    render(<SubmittedView form={form(ending({ badgeIcon: 'rocket', buttonLabel: 'Visit our site' }))} session={session({ endingButtonUrl: 'https://x.test/' })} mode="fill" onAgain={() => {}} />);
    expect(screen.getByTestId('ending-badge-rocket')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Visit our site' })).toHaveAttribute('href', 'https://x.test/');
  });

  it('hides Submit another response when turned off', () => {
    render(<SubmittedView form={form(ending({ showSubmitAnother: false }))} session={session()} mode="fill" onAgain={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Submit another response' })).not.toBeInTheDocument();
  });

  it('redirects immediately when the delay is 0', () => {
    render(<SubmittedView form={form(ending({}))} session={session({ endingRedirectUrl: 'https://x.test/r' })} mode="fill" onAgain={() => {}} />);
    expect(assign).toHaveBeenCalledWith('https://x.test/r');
  });

  it('counts down, then redirects', () => {
    vi.useFakeTimers();
    render(<SubmittedView form={form(ending({ redirectDelay: 3 }))} session={session({ endingRedirectUrl: 'https://x.test/r' })} mode="fill" onAgain={() => {}} />);
    expect(screen.getByText('Redirecting in 3s…')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText('Redirecting in 1s…')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(assign).toHaveBeenCalledWith('https://x.test/r');
  });

  it('Stay on this page cancels the countdown; Go now redirects at once', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SubmittedView form={form(ending({ redirectDelay: 30 }))} session={session({ endingRedirectUrl: 'https://x.test/r' })} mode="fill" onAgain={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Stay on this page' }));
    expect(screen.queryByText(/Redirecting in/)).not.toBeInTheDocument();
    unmount();
    render(<SubmittedView form={form(ending({ redirectDelay: 30 }))} session={session({ endingRedirectUrl: 'https://x.test/r' })} mode="fill" onAgain={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Go now' }));
    expect(assign).toHaveBeenCalledWith('https://x.test/r');
  });

  it('clears the countdown on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = render(<SubmittedView form={form(ending({ redirectDelay: 2 }))} session={session({ endingRedirectUrl: 'https://x.test/r' })} mode="fill" onAgain={() => {}} />);
    unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(assign).not.toHaveBeenCalled();
  });

  it('rule redirect wins and fires immediately', () => {
    render(<SubmittedView form={form(ending({ redirectDelay: 10 }))} session={session({ redirectUrl: 'https://rule.test/', endingRedirectUrl: null })} mode="fill" onAgain={() => {}} />);
    expect(assign).toHaveBeenCalledWith('https://rule.test/');
    expect(screen.queryByText(/Redirecting in/)).not.toBeInTheDocument();
  });

  it('never redirects in preview; says where the live form would go', () => {
    render(<SubmittedView form={form(ending({ redirectDelay: 3 }))} session={session({ endingRedirectUrl: 'https://x.test/r' })} mode="preview" onAgain={() => {}} />);
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByText(/On the live form, respondents are sent to https:\/\/x.test\/r/)).toBeInTheDocument();
  });
});
