import type { FormFieldDto } from '@qub/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OptionsEditor } from './options-editor';

const o = (id: string, label: string, kind: 'option' | 'row' | 'column', position: number) => ({ id, label, kind, position, value: null, imageUrl: null });
const base = { id: 'f', ref: 'q1', label: 'Q', description: null, required: false, position: 0, validation: {}, settings: {}, rules: [], placeholder: null, defaultValue: null, scoreConfig: null };

describe('OptionsEditor', () => {
  it('edits matrix rows and columns separately and sends every option with its kind', async () => {
    const onUpdate = vi.fn();
    const field: FormFieldDto = { ...base, type: 'MATRIX', options: [o('r1', 'Row 1', 'row', 0), o('c1', 'Column 1', 'column', 1)] };
    render(<OptionsEditor field={field} canEdit onUpdate={onUpdate} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add row' }));
    expect(onUpdate).toHaveBeenLastCalledWith({
      options: [
        { id: 'r1', label: 'Row 1', kind: 'row', imageUrl: null, value: null },
        { id: undefined, label: 'Row 2', kind: 'row', imageUrl: null, value: null },
        { id: 'c1', label: 'Column 1', kind: 'column', imageUrl: null, value: null },
      ],
    });
    expect(screen.getByRole('textbox', { name: 'Column 1' })).toBeInTheDocument();
  });
  it('picture choice options have an image URL', async () => {
    const onUpdate = vi.fn();
    const field: FormFieldDto = { ...base, type: 'IMAGE_CHOICE', options: [o('a', 'Cat', 'option', 0)] };
    render(<OptionsEditor field={field} canEdit onUpdate={onUpdate} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Image URL for option 1' }), 'https://img.test/cat.png');
    await user.tab();
    expect(onUpdate).toHaveBeenLastCalledWith({ options: [{ id: 'a', label: 'Cat', kind: 'option', imageUrl: 'https://img.test/cat.png', value: null }] });
  });
  it('Enter on an option adds the next one (existing builder behaviour)', async () => {
    const onUpdate = vi.fn();
    const field: FormFieldDto = { ...base, type: 'MULTIPLE_CHOICE', options: [o('a', 'Option 1', 'option', 0)] };
    render(<OptionsEditor field={field} canEdit onUpdate={onUpdate} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Option 1' }), '{Enter}');
    expect(screen.getByRole('textbox', { name: 'Option 2' })).toBeInTheDocument();
  });
});
