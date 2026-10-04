import type { FormFieldDto } from '@qub/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { YesNoInput } from './choice-inputs';
import { SliderInput } from './rating-inputs';
import { ParagraphInput, TextLikeInput } from './text-inputs';
import type { InputProps } from './types';

const field = (over: Partial<FormFieldDto>): FormFieldDto => ({
  id: 'f', ref: 'f', type: 'SHORT_ANSWER', label: 'Q', description: null, required: false, position: 0,
  validation: {}, settings: {}, options: [], rules: [], scoreConfig: null, placeholder: null, defaultValue: null, ...over,
});
const props = (f: FormFieldDto, value: InputProps['value']): InputProps => ({ field: f, value, onChange: vi.fn(), color: '#000000', labelledBy: 'q', variant: 'conversational', uploaded: [], onUploaded: vi.fn() });

describe('display options', () => {
  it('shows number prefix and suffix and describes the input with them', () => {
    render(<TextLikeInput {...props(field({ type: 'NUMBER', settings: { prefix: '$', suffix: 'USD' } }), 12)} />);
    expect(screen.getByTestId('affix-prefix')).toHaveTextContent('$');
    expect(screen.getByTestId('affix-suffix')).toHaveTextContent('USD');
    expect(screen.getByRole('spinbutton')).toHaveAccessibleDescription('$ USD');
  });

  it('renders a plain number input without affixes', () => {
    render(<TextLikeInput {...props(field({ type: 'NUMBER' }), 12)} />);
    expect(screen.queryByTestId('affix-prefix')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).not.toHaveAttribute('aria-describedby');
  });

  it('shows the slider value with its prefix and suffix', () => {
    render(<SliderInput {...props(field({ type: 'SLIDER', settings: { rangeMin: 0, rangeMax: 40, suffix: ' h' } }), 12)} />);
    expect(screen.getByRole('status')).toHaveTextContent('12 h');
  });

  it('uses custom Yes/No labels and keeps boolean answers', () => {
    const p = props(field({ type: 'YES_NO', settings: { yesLabel: 'Count me in', noLabel: "Can't make it" } }), undefined);
    render(<YesNoInput {...p} />);
    screen.getByRole('radio', { name: /Count me in/ }).click();
    expect(p.onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('radio', { name: /Can't make it/ })).toBeInTheDocument();
  });

  it('counts characters of the current (even prefilled) answer when a maximum is set', () => {
    render(<TextLikeInput {...props(field({ settings: { showCharCount: true }, validation: { maxLength: 20 } }), 'Hello')} />);
    expect(screen.getByTestId('char-count')).toHaveTextContent('5 / 20');
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('5 / 20');
  });

  it('shows no counter without a maximum length, or when the option is off', () => {
    const { unmount } = render(<ParagraphInput {...props(field({ type: 'PARAGRAPH', settings: { showCharCount: true } }), 'Hi')} />);
    expect(screen.queryByTestId('char-count')).not.toBeInTheDocument();
    unmount();
    render(<ParagraphInput {...props(field({ type: 'PARAGRAPH', validation: { maxLength: 10 } }), 'Hi')} />);
    expect(screen.queryByTestId('char-count')).not.toBeInTheDocument();
  });

  it('counts paragraph answers too', () => {
    render(<ParagraphInput {...props(field({ type: 'PARAGRAPH', settings: { showCharCount: true }, validation: { maxLength: 500 } }), 'abc')} />);
    expect(screen.getByTestId('char-count')).toHaveTextContent('3 / 500');
  });
});
