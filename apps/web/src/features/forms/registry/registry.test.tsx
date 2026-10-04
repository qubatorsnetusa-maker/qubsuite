import type { AnswerValue, FormFieldDto } from '@qub/shared';
import { FORM_FIELD_TYPES } from '@qub/shared';
import { QUESTION_TYPES } from '@qub/shared/forms';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { videoEmbedUrl } from './content-blocks';
import { FIELD_UI } from './index';
import type { InputProps } from './types';

// jsdom doesn't implement the browser's built-in arrow-key stepping for <input type="range">
// (that's UA rendering behaviour, not part of the DOM spec jsdom covers), so the slider test
// below would see no value change. Approximate just enough of it here. Setting `.value` directly
// would go through React's overridden setter (which it uses to detect programmatic vs. native
// changes) and the "input" event would be treated as a no-op, so call the prototype's setter
// instead, the same way React Testing Library's own recipes do.
function setNativeRangeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, value);
}
beforeAll(() => {
  document.addEventListener('keydown', (e) => {
    const el = document.activeElement;
    if (!(el instanceof HTMLInputElement) || el.type !== 'range') return;
    const step = Number(el.step) || 1;
    const min = Number(el.min) || 0;
    const max = Number(el.max) || 100;
    const current = Number(el.value);
    let next = current;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(max, current + step);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(min, current - step);
    if (next !== current) {
      setNativeRangeValue(el, String(next));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
});

const opt = (id: string, label: string, kind: 'option' | 'row' | 'column' = 'option', position = 0) => ({ id, label, kind, position, value: null, imageUrl: kind === 'option' ? `https://img.test/${id}.png` : null });
const field = (type: FormFieldDto['type'], extra: Partial<FormFieldDto> = {}): FormFieldDto => ({
  id: `f-${type}`,
  ref: 'q',
  type,
  label: `Label ${type}`,
  description: null,
  required: false,
  position: 0,
  validation: {},
  settings: { ...QUESTION_TYPES[type].defaultSettings },
  options: [],
  rules: [],
  placeholder: null,
  defaultValue: null,
  scoreConfig: null,
  ...extra,
});

/** Renders a registry input with real state so interactions accumulate. */
function Harness({ f, onValue, initial }: { f: FormFieldDto; onValue(v: AnswerValue): void; initial?: AnswerValue }) {
  const [value, setValue] = useState<AnswerValue | undefined>(initial);
  const Input = FIELD_UI[f.type].Input!;
  const props: InputProps = { field: f, value, onChange: (v) => { setValue(v); onValue(v); }, color: '#673ab7', labelledBy: 'lbl', variant: 'classic', uploaded: [], onUploaded: () => {} };
  return (
    <>
      <h2 id="lbl">{f.label}</h2>
      <Input {...props} />
    </>
  );
}
const setup = (f: FormFieldDto, initial?: AnswerValue) => {
  const onValue = vi.fn();
  render(<Harness f={f} onValue={onValue} initial={initial} />);
  return { onValue, user: userEvent.setup() };
};

describe('FIELD_UI registry', () => {
  it('covers every field type; every visible input type has a component', () => {
    for (const t of FORM_FIELD_TYPES) {
      expect(FIELD_UI[t]?.icon, t).toBeDefined();
      if (QUESTION_TYPES[t].isInput && t !== 'HIDDEN') expect(FIELD_UI[t].Input, t).toBeDefined();
      if (!QUESTION_TYPES[t].isInput) expect(FIELD_UI[t].Input, t).toBeUndefined();
    }
  });

  it('maps keyboard shortcuts', () => {
    const mc = field('MULTIPLE_CHOICE', { options: [opt('a', 'A'), opt('b', 'B')] });
    expect(FIELD_UI.MULTIPLE_CHOICE.keyToValue!(mc, 'b', undefined)).toBe('b');
    expect(FIELD_UI.MULTIPLE_CHOICE.keyToValue!(mc, 'z', undefined)).toBeUndefined();
    const cb = field('CHECKBOXES', { options: [opt('a', 'A'), opt('b', 'B')] });
    expect(FIELD_UI.CHECKBOXES.keyToValue!(cb, 'a', ['b'])).toEqual(['a', 'b']);
    expect(FIELD_UI.CHECKBOXES.keyToValue!(cb, 'b', ['a', 'b'])).toEqual(['a']);
    expect(FIELD_UI.YES_NO.keyToValue!(field('YES_NO'), 'y', undefined)).toBe(true);
    expect(FIELD_UI.YES_NO.keyToValue!(field('YES_NO'), 'n', undefined)).toBe(false);
    expect(FIELD_UI.NPS.keyToValue!(field('NPS'), '7', undefined)).toBe(7);
    expect(FIELD_UI.RATING.keyToValue!(field('RATING'), '9', undefined)).toBeUndefined();
    expect(FIELD_UI.MULTIPLE_CHOICE.autoAdvance!(mc)).toBe(true);
    expect(FIELD_UI.IMAGE_CHOICE.autoAdvance!(field('IMAGE_CHOICE', { settings: { allowMultiple: true } }))).toBe(false);
  });
});

describe('inputs', () => {
  it('multiple choice selects an option id', async () => {
    const { user, onValue } = setup(field('MULTIPLE_CHOICE', { options: [opt('a', 'Apple'), opt('b', 'Banana')] }));
    await user.click(screen.getByRole('radio', { name: 'Banana' }));
    expect(onValue).toHaveBeenLastCalledWith('b');
  });
  it('checkboxes keep option order', async () => {
    const { user, onValue } = setup(field('CHECKBOXES', { options: [opt('a', 'Apple'), opt('b', 'Banana')] }));
    await user.click(screen.getByRole('checkbox', { name: 'Banana' }));
    await user.click(screen.getByRole('checkbox', { name: 'Apple' }));
    expect(onValue).toHaveBeenLastCalledWith(['a', 'b']);
  });
  it('searchable dropdown filters and selects', async () => {
    const { user, onValue } = setup(field('DROPDOWN', { settings: { searchable: true }, options: [opt('ug', 'Uganda'), opt('ke', 'Kenya')] }));
    await user.type(screen.getByRole('searchbox', { name: 'Search options' }), 'ken');
    expect(screen.queryByRole('option', { name: 'Uganda' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Kenya' }));
    expect(onValue).toHaveBeenLastCalledWith('ke');
  });
  it('yes/no stores booleans', async () => {
    const { user, onValue } = setup(field('YES_NO'));
    await user.click(screen.getByRole('radio', { name: 'No' }));
    expect(onValue).toHaveBeenLastCalledWith(false);
  });
  it('picture choice selects images', async () => {
    const { user, onValue } = setup(field('IMAGE_CHOICE', { options: [opt('a', 'Cat'), opt('b', 'Dog')] }));
    await user.click(screen.getByRole('radio', { name: 'Dog' }));
    expect(onValue).toHaveBeenLastCalledWith(['b']);
    expect(screen.getByRole('img', { name: 'Dog' })).toHaveAttribute('src', 'https://img.test/b.png');
  });
  it('NPS offers 0–10', async () => {
    const { user, onValue } = setup(field('NPS'));
    expect(screen.getAllByRole('radio')).toHaveLength(11);
    await user.click(screen.getByRole('radio', { name: '10' }));
    expect(onValue).toHaveBeenLastCalledWith(10);
  });
  it('emoji rating uses labelled buttons', async () => {
    const { user, onValue } = setup(field('EMOJI_RATING', { settings: { scaleMax: 3 } }));
    await user.click(screen.getByRole('radio', { name: '3 of 3' }));
    expect(onValue).toHaveBeenLastCalledWith(3);
  });
  it('slider reports numbers', async () => {
    const { onValue } = setup(field('SLIDER', { settings: { rangeMin: 0, rangeMax: 10, step: 1 } }));
    const slider = screen.getByRole('slider');
    slider.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onValue).toHaveBeenLastCalledWith(1);
  });
  it('ranking can be reordered with buttons and confirmed as-is', async () => {
    const f = field('RANKING', { options: [opt('a', 'Apple'), opt('b', 'Banana'), opt('c', 'Cherry')] });
    const { user, onValue } = setup(f);
    await user.click(screen.getByRole('button', { name: 'Keep this order' }));
    expect(onValue).toHaveBeenLastCalledWith(['a', 'b', 'c']);
    await user.click(screen.getByRole('button', { name: 'Move Cherry up' }));
    expect(onValue).toHaveBeenLastCalledWith(['a', 'c', 'b']);
  });
  it('matrix records one column per row', async () => {
    const f = field('MATRIX', { options: [opt('r1', 'Speed', 'row'), opt('r2', 'Price', 'row'), opt('c1', 'Bad', 'column'), opt('c2', 'Good', 'column')] });
    const { user, onValue } = setup(f);
    await user.click(screen.getByRole('radio', { name: 'Speed: Good' }));
    await user.click(screen.getByRole('radio', { name: 'Price: Bad' }));
    expect(onValue).toHaveBeenLastCalledWith({ r1: 'c2', r2: 'c1' });
  });
  it('address collects parts', async () => {
    const { user, onValue } = setup(field('ADDRESS'));
    await user.type(screen.getByLabelText('City'), 'Kampala');
    expect(onValue).toHaveBeenLastCalledWith({ city: 'Kampala' });
  });
  it('consent is a checkbox storing true/false', async () => {
    const { user, onValue } = setup(field('CONSENT', { settings: { consentText: 'I agree to the terms' } }));
    await user.click(screen.getByRole('checkbox', { name: 'I agree to the terms' }));
    expect(onValue).toHaveBeenLastCalledWith(true);
  });
  it('location accepts typed text', async () => {
    const { user, onValue } = setup(field('LOCATION'));
    await user.type(screen.getByRole('textbox'), 'K');
    expect(onValue).toHaveBeenLastCalledWith({ label: 'K' });
  });
  it('text inputs use the right keyboard and placeholder', () => {
    setup(field('PHONE', { placeholder: '+256…' }));
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('type', 'tel');
    expect(input).toHaveAttribute('placeholder', '+256…');
  });
});

describe('roving radiogroup keyboard nav (button-based radios)', () => {
  it('only one radio is a tab stop, and arrow keys move and select it, wrapping at the ends (YES_NO)', async () => {
    const { user, onValue } = setup(field('YES_NO'));
    expect(screen.getByRole('radio', { name: 'Yes' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'No' })).toHaveAttribute('tabindex', '-1');
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Yes' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}'); // wraps to the last option
    expect(onValue).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('radio', { name: 'No' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'No' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Yes' })).toHaveAttribute('tabindex', '-1');
    await user.keyboard('{ArrowRight}'); // wraps back to the first
    expect(onValue).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('radio', { name: 'Yes' })).toHaveFocus();
  });
  it('arrow keys change the value and move focus (NPS)', async () => {
    const { user, onValue } = setup(field('NPS'));
    await user.tab();
    expect(screen.getByRole('radio', { name: '0' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(onValue).toHaveBeenLastCalledWith(1);
    expect(screen.getByRole('radio', { name: '1' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(onValue).toHaveBeenLastCalledWith(0);
    expect(screen.getByRole('radio', { name: '0' })).toHaveFocus();
  });
  it('Home and End jump to the first and last option (NPS)', async () => {
    const { user, onValue } = setup(field('NPS'));
    screen.getByRole('radio', { name: '0' }).focus();
    await user.keyboard('{End}');
    expect(onValue).toHaveBeenLastCalledWith(10);
    expect(screen.getByRole('radio', { name: '10' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(onValue).toHaveBeenLastCalledWith(0);
    expect(screen.getByRole('radio', { name: '0' })).toHaveFocus();
  });
});

describe('videoEmbedUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
    ['https://cdn.test/movie.mp4', null],
  ])('%s', (url, expected) => expect(videoEmbedUrl(url)).toBe(expected));
});
