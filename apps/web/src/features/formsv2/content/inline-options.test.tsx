import type { FormFieldDto } from '@qub/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InlineOptions, reorderDrafts } from './inline-options';

const o = (id: string, label: string, kind: 'option' | 'row' | 'column', position: number) => ({ id, label, kind, position, value: null, imageUrl: null });
const base = { id: 'f', ref: 'q1', label: 'Q', description: null, required: false, position: 0, validation: {}, settings: {}, rules: [], placeholder: null, defaultValue: null, scoreConfig: null };
const d = (id: string, label: string, kind: 'option' | 'row' | 'column' = 'option') => ({ id, label, kind, imageUrl: null, value: null });

describe('reorderDrafts', () => {
  it('moves a choice to where it was dropped', () => {
    expect(reorderDrafts([d('a', 'A'), d('b', 'B'), d('c', 'C')], 'c', 'a')!.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
  it('never moves a matrix row among the columns, and ignores no-op drops', () => {
    const drafts = [d('r1', 'R1', 'row'), d('c1', 'C1', 'column')];
    expect(reorderDrafts(drafts, 'r1', 'c1')).toBeNull();
    expect(reorderDrafts(drafts, 'r1', 'r1')).toBeNull();
  });
});

describe('InlineOptions', () => {
  it('Backspace in an emptied choice removes it and focuses the one before', async () => {
    const onUpdate = vi.fn();
    const field: FormFieldDto = { ...base, type: 'CHECKBOXES', options: [o('a', 'Cat', 'option', 0), o('b', 'Dog', 'option', 1)] };
    render(<InlineOptions field={field} canEdit color="#673ab7" onUpdate={onUpdate} />);
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox', { name: 'Choice 2' }));
    await user.keyboard('{Backspace}');
    expect(onUpdate).toHaveBeenLastCalledWith({ options: [{ id: 'a', label: 'Cat', kind: 'option', imageUrl: null, value: null }] });
    expect(screen.getByRole('textbox', { name: 'Choice 1' })).toHaveFocus();
    expect(screen.queryByRole('textbox', { name: 'Choice 2' })).not.toBeInTheDocument();
  });

  it('edits matrix rows and columns side by side, numbered rather than lettered', async () => {
    const onUpdate = vi.fn();
    const field: FormFieldDto = { ...base, type: 'MATRIX', options: [o('r1', 'Speed', 'row', 0), o('c1', 'Good', 'column', 1)] };
    render(<InlineOptions field={field} canEdit color="#673ab7" onUpdate={onUpdate} />);
    expect(screen.queryByTestId('choice-letter-0')).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add column' }));
    const sent = onUpdate.mock.calls.at(-1)![0].options;
    expect(sent.map((x: { label: string; kind: string }) => `${x.kind}:${x.label}`)).toEqual(['row:Speed', 'column:Good', 'column:Column 2']);
  });

  it('picture choices have an image URL next to each label', async () => {
    const onUpdate = vi.fn();
    const field: FormFieldDto = { ...base, type: 'IMAGE_CHOICE', options: [o('a', 'Cat', 'option', 0)] };
    render(<InlineOptions field={field} canEdit color="#673ab7" onUpdate={onUpdate} />);
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Image URL for choice 1' }), 'https://x.test/cat.png');
    await user.tab();
    expect(onUpdate).toHaveBeenLastCalledWith({ options: [{ id: 'a', label: 'Cat', kind: 'option', imageUrl: 'https://x.test/cat.png', value: null }] });
  });
});
