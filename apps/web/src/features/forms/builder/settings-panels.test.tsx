import type { FormFieldDto } from '@qub/shared';
import { FORM_FIELD_TYPES } from '@qub/shared';
import { QUESTION_TYPES } from '@qub/shared/forms';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DefaultAnswerSetting, ScorePanel, SETTINGS_PANELS } from './settings-panels';

const field = (type: FormFieldDto['type'], extra: Partial<FormFieldDto> = {}): FormFieldDto => ({
  id: 'f', ref: 'q1', type, label: 'Q', description: null, required: false, position: 0, validation: {}, settings: { ...QUESTION_TYPES[type].defaultSettings }, options: [], rules: [], placeholder: null, defaultValue: null, scoreConfig: null, ...extra,
});
const renderPanel = (f: FormFieldDto) => {
  const onUpdate = vi.fn();
  const Panel = SETTINGS_PANELS[f.type]!;
  render(<Panel field={f} canEdit onUpdate={onUpdate} />);
  return { onUpdate, user: userEvent.setup() };
};

describe('SETTINGS_PANELS', () => {
  it('has an entry for every type', () => {
    for (const t of FORM_FIELD_TYPES) expect(t in SETTINGS_PANELS, t).toBe(true);
  });
  it('NPS edits its end labels', async () => {
    const { onUpdate, user } = renderPanel(field('NPS'));
    const low = screen.getByLabelText('Low label');
    await user.clear(low);
    await user.type(low, 'Never');
    await user.tab();
    expect(onUpdate).toHaveBeenCalledWith({ settings: { minLabel: 'Never' } });
  });
  it('slider edits min, max and step', async () => {
    const { onUpdate, user } = renderPanel(field('SLIDER'));
    const step = screen.getByLabelText('Step');
    await user.clear(step);
    await user.type(step, '5');
    await user.tab();
    expect(onUpdate).toHaveBeenCalledWith({ settings: { step: 5 } });
  });
  it('dropdown can become searchable', async () => {
    const { onUpdate, user } = renderPanel(field('DROPDOWN'));
    await user.click(screen.getByRole('switch', { name: 'Searchable' }));
    expect(onUpdate).toHaveBeenCalledWith({ settings: { searchable: true } });
  });
  it('video block takes a URL', async () => {
    const { onUpdate, user } = renderPanel(field('VIDEO_BLOCK'));
    await user.type(screen.getByLabelText('Video URL'), 'https://youtu.be/x');
    await user.tab();
    expect(onUpdate).toHaveBeenCalledWith({ settings: { videoUrl: 'https://youtu.be/x' } });
  });
  it('emoji rating falls back to 5 faces for a stale scaleMax left over from another type', () => {
    renderPanel(field('EMOJI_RATING', { settings: { scaleMax: 7 } }));
    expect(screen.getByRole('combobox')).toHaveValue('5');
  });
  it('hidden fields explain how to fill them', () => {
    renderPanel(field('HIDDEN', { ref: 'utm_source' }));
    expect(screen.getByText(/\?utm_source=/)).toBeInTheDocument();
  });
  it('quiz scoring sets the correct option and points', async () => {
    const onUpdate = vi.fn();
    const f = field('MULTIPLE_CHOICE', { options: [{ id: 'a', label: 'Paris', position: 0, kind: 'option', value: null, imageUrl: null }, { id: 'b', label: 'Rome', position: 1, kind: 'option', value: null, imageUrl: null }] });
    render(<ScorePanel field={f} canEdit onUpdate={onUpdate} quiz />);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Correct answer'), 'a');
    expect(onUpdate).toHaveBeenLastCalledWith({ scoreConfig: { correct: 'a', points: 1 } });
  });
  it('text and number settings show the current value after undo, and an unchanged blur saves nothing', async () => {
    const onUpdate = vi.fn();
    const Panel = SETTINGS_PANELS.SHORT_ANSWER!;
    const original = field('SHORT_ANSWER', { validation: { maxLength: 10 } });
    const { rerender } = render(<Panel field={original} canEdit onUpdate={onUpdate} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Max length'));
    await user.type(screen.getByLabelText('Max length'), '20');
    await user.tab();
    expect(onUpdate).toHaveBeenLastCalledWith({ validation: { maxLength: 20 } });
    // The change is applied, then undone.
    rerender(<Panel field={{ ...original, validation: { maxLength: 20 } }} canEdit onUpdate={onUpdate} />);
    rerender(<Panel field={original} canEdit onUpdate={onUpdate} />);
    expect(screen.getByLabelText('Max length')).toHaveValue(10);
    onUpdate.mockClear();
    await user.click(screen.getByLabelText('Max length'));
    await user.tab();
    expect(onUpdate).not.toHaveBeenCalled();
  });
  it('NPS label shows the current value after undo, and an unchanged blur saves nothing', async () => {
    const onUpdate = vi.fn();
    const Panel = SETTINGS_PANELS.NPS!;
    const original = field('NPS', { settings: { ...QUESTION_TYPES.NPS.defaultSettings, minLabel: 'Unlikely' } });
    const { rerender } = render(<Panel field={original} canEdit onUpdate={onUpdate} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('Low label'));
    await user.type(screen.getByLabelText('Low label'), 'Never');
    await user.tab();
    expect(onUpdate).toHaveBeenLastCalledWith({ settings: { minLabel: 'Never' } });
    rerender(<Panel field={{ ...original, settings: { ...original.settings, minLabel: 'Never' } }} canEdit onUpdate={onUpdate} />);
    rerender(<Panel field={original} canEdit onUpdate={onUpdate} />);
    expect(screen.getByLabelText('Low label')).toHaveValue('Unlikely');
    onUpdate.mockClear();
    await user.click(screen.getByLabelText('Low label'));
    await user.tab();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

const q = (type: FormFieldDto['type'], extra: Partial<FormFieldDto> = {}): FormFieldDto => ({
  id: '00000000-0000-4000-8000-000000000001', ref: 'q1', type, label: 'Q', description: null, required: true, position: 0, validation: {}, settings: {}, options: [], rules: [], scoreConfig: null, placeholder: null, defaultValue: null, ...extra,
});

describe('DefaultAnswerSetting', () => {
  it('commits a valid default when focus leaves it, and clears it', async () => {
    const onUpdate = vi.fn();
    render(<DefaultAnswerSetting field={q('SHORT_ANSWER')} canEdit onUpdate={onUpdate} color="#673ab7" />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Default answer'));
    await user.type(screen.getByRole('textbox'), 'Ada');
    await user.tab();
    expect(onUpdate).toHaveBeenLastCalledWith({ defaultValue: 'Ada' });
    await user.click(screen.getByRole('button', { name: 'Clear default' }));
    expect(onUpdate).toHaveBeenLastCalledWith({ defaultValue: null });
  });

  it('shows why an invalid default is not saved', async () => {
    const onUpdate = vi.fn();
    render(<DefaultAnswerSetting field={q('EMAIL')} canEdit onUpdate={onUpdate} color="#673ab7" />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Default answer'));
    await user.type(screen.getByRole('textbox'), 'nope');
    await user.tab();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
  });

  it('is not offered for consent, file, signature or hidden questions', () => {
    for (const type of ['CONSENT', 'FILE_UPLOAD', 'SIGNATURE', 'HIDDEN', 'STATEMENT'] as const) {
      const { container } = render(<DefaultAnswerSetting field={q(type)} canEdit onUpdate={vi.fn()} color="#673ab7" />);
      expect(container).toBeEmptyDOMElement();
    }
  });
});
