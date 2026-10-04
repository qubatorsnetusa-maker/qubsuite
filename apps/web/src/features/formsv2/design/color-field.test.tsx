import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ColorField } from './color-field';

describe('ColorField', () => {
  it('commits a valid hex typed into the text box on blur', async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<ColorField id="primary" label="Primary" value="#673ab7" onCommit={onCommit} />);
    const text = screen.getByRole('textbox', { name: 'Primary hex' });
    await user.clear(text);
    await user.type(text, '#0f172a');
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith('#0f172a');
  });

  it('commits on Enter too', async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<ColorField id="primary" label="Primary" value="#673ab7" onCommit={onCommit} />);
    await user.clear(screen.getByRole('textbox', { name: 'Primary hex' }));
    await user.type(screen.getByRole('textbox', { name: 'Primary hex' }), '#ffffff{Enter}');
    expect(onCommit).toHaveBeenCalledWith('#ffffff');
  });

  it('reverts an invalid hex and commits nothing', async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<ColorField id="primary" label="Primary" value="#673ab7" onCommit={onCommit} />);
    const text = screen.getByRole('textbox', { name: 'Primary hex' });
    await user.clear(text);
    await user.type(text, 'not a colour');
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(text).toHaveValue('#673ab7');
  });

  it('accepts a 6-digit hex without the hash and normalises it', async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<ColorField id="primary" label="Primary" value="#673ab7" onCommit={onCommit} />);
    await user.clear(screen.getByRole('textbox', { name: 'Primary hex' }));
    await user.type(screen.getByRole('textbox', { name: 'Primary hex' }), 'FF0000{Enter}');
    expect(onCommit).toHaveBeenCalledWith('#ff0000');
  });

  it('does not commit when the value is unchanged', async () => {
    const onCommit = vi.fn();
    const user = userEvent.setup();
    render(<ColorField id="primary" label="Primary" value="#673ab7" onCommit={onCommit} />);
    await user.click(screen.getByRole('textbox', { name: 'Primary hex' }));
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('disables both inputs when disabled', () => {
    render(<ColorField id="primary" label="Primary" value="#673ab7" disabled onCommit={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Primary hex' })).toBeDisabled();
    expect(screen.getByLabelText('Primary')).toBeDisabled();
  });
});
