import type { FormDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { THEME_PRESETS } from '@qub/shared/forms';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithOps } from '@/features/forms/builder/ops/test-utils';
import { DesignTab } from './design-tab';

beforeEach(() => vi.clearAllMocks());

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function makeForm(extras: FormDto['theme']['extras'] = {}, capabilities: Partial<FormDto['capabilities']> = { canEdit: true }): FormDto {
  return {
    id: uid(910),
    fileId: 'file1',
    publicId: 'pub-design',
    title: 'Customer survey',
    revision: 0,
    isPublished: false,
    isTrashed: false,
    acceptingResponses: true,
    settings: { ...DEFAULT_FORM_SETTINGS },
    variables: [],
    fields: [],
    theme: { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans', headerImageUrl: null, extras },
    capabilities,
  } as unknown as FormDto;
}

/** The last transaction the tab applied, as a flat `path -> to` map. */
const applied = (apply: ReturnType<typeof vi.fn>) => {
  const tx = apply.mock.calls.at(-1)![0];
  return Object.fromEntries(Object.entries(tx.ops[0].changes).map(([k, v]) => [k, (v as { to: unknown }).to]));
};

describe('DesignTab', () => {
  it('applies every key of a preset in one transaction, and records its id', async () => {
    const user = userEvent.setup();
    const { apply } = renderWithOps(<DesignTab />, { form: makeForm() });
    await user.click(screen.getByRole('button', { name: /Midnight/ }));
    const p = THEME_PRESETS.find((x) => x.id === 'midnight')!;
    expect(apply).toHaveBeenCalledTimes(1);
    expect(applied(apply)).toEqual({
      primaryColor: p.primaryColor,
      backgroundColor: p.backgroundColor,
      'extras.preset': 'midnight',
      'extras.questionColor': p.questionColor,
      'extras.fontPair': p.fontPair,
      'extras.background': p.background,
      'extras.buttonRadius': p.buttonRadius,
    });
  });

  it('clears the active preset when a themed value is edited afterwards', async () => {
    const user = userEvent.setup();
    const { apply } = renderWithOps(<DesignTab />, { form: makeForm({ preset: 'midnight', fontPair: 'grotesk' }) });
    await user.click(screen.getByRole('radio', { name: /Classic/ }));
    expect(applied(apply)).toEqual({ 'extras.fontPair': 'lora', 'extras.preset': null });
  });

  it('keeps the active preset when only branding changes', async () => {
    const user = userEvent.setup();
    const { apply } = renderWithOps(<DesignTab />, { form: makeForm({ preset: 'midnight' }) });
    await user.type(screen.getByLabelText('Footer text'), 'Acme Inc.');
    await user.tab();
    expect(applied(apply)).toEqual({ 'extras.footerText': 'Acme Inc.' });
  });

  it('marks the stored preset tile as selected', () => {
    renderWithOps(<DesignTab />, { form: makeForm({ preset: 'paper' }) });
    expect(within(screen.getByTestId('theme-preset-tiles')).getByRole('button', { name: /Paper/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ignores a preset id that no longer exists', () => {
    renderWithOps(<DesignTab />, { form: makeForm({ preset: 'retired-in-a-later-release' }) });
    for (const b of within(screen.getByTestId('theme-preset-tiles')).getAllByRole('button')) expect(b).toHaveAttribute('aria-pressed', 'false');
  });

  it("shows a live preview pointed at the form's preview URL", () => {
    const { container } = renderWithOps(<DesignTab />, { form: makeForm() });
    expect(screen.getByRole('group', { name: 'Preview device' })).toBeInTheDocument();
    expect(container.querySelector('iframe')).toHaveAttribute('src', `/formsv2/${uid(910)}/preview`);
  });

  it('disables every control and applies nothing for a viewer', async () => {
    const user = userEvent.setup();
    const { apply } = renderWithOps(<DesignTab />, { form: makeForm({}, { canEdit: false }) });
    expect(screen.getByRole('button', { name: /Qub/ })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Primary colour hex' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Midnight/ }));
    expect(apply).not.toHaveBeenCalled();
  });
});
