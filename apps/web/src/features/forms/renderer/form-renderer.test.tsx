import type { FormFieldDto, FormThemeExtras } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RespondentForm } from './respondent-form';
import { RespondentView } from './respondent-view';

const f = (id: string, type: FormFieldDto['type'], label: string, position: number, extra: Partial<FormFieldDto> = {}): FormFieldDto => ({
  id, ref: id, type, label, description: null, required: false, position, validation: {}, settings: {}, options: [], rules: [], placeholder: null, defaultValue: null, scoreConfig: null, ...extra,
});

const fields = [f('q1', 'SHORT_ANSWER', 'Your name', 0)];

const form: RespondentForm = {
  title: 'Test Form',
  description: null,
  fields,
  variables: [],
  theme: { primaryColor: '#673ab7', backgroundColor: '#fff', fontFamily: 'sans', headerImageUrl: null },
  settings: { ...DEFAULT_FORM_SETTINGS, layout: 'classic' },
};

/** That file's classic fixture, with theme extras swapped in. */
const classicForm = (extras: FormThemeExtras): RespondentForm => ({ ...form, settings: { ...form.settings, layout: 'classic' }, theme: { ...form.theme, extras } });

describe('classic theme', () => {
  // Review Focus 5
  it('keeps its 10px buttons and renders no chrome for a pre-B1 form', () => {
    const { container } = render(<RespondentView form={classicForm({})} submit={vi.fn()} storageKey={null} mode="fill" />);
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--form-radius')).toBe('');
    expect(container.querySelector('footer')).toBeNull();
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveStyle({ borderRadius: 'var(--form-radius, 10px)' });
  });

  it('applies the gradient, logo, footer and radius in the classic layout too', () => {
    const { container } = render(<RespondentView form={classicForm({ background: { kind: 'gradient', from: '#000000', to: '#ffffff' }, logoUrl: 'https://cdn.test/logo.png', footerText: 'Acme Inc.', buttonRadius: 'pill' })} submit={vi.fn()} storageKey={null} mode="fill" />);
    expect(container.querySelector('[style*="linear-gradient"]')).toBeInTheDocument();
    expect(screen.getByRole('presentation', { hidden: true })).toBeInTheDocument();
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--form-radius')).toBe('9999px');
  });

  it('shows the logo band above the existing header image when both are set', () => {
    const f = classicForm({ logoUrl: 'https://cdn.test/logo.png' });
    const { container } = render(<RespondentView form={{ ...f, theme: { ...f.theme, headerImageUrl: 'https://cdn.test/header.jpg' } }} submit={vi.fn()} storageKey={null} mode="fill" />);
    const imgs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(imgs).toEqual(['https://cdn.test/logo.png', 'https://cdn.test/header.jpg']);
  });
});
