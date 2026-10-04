import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PipingInput } from './piping-input';

function Harness() {
  const [v, setV] = useState('');
  return <PipingInput aria-label="Question text" value={v} onChange={setV} suggestions={[{ key: 'firstName', label: 'Your name?' }, { key: 'total', label: 'Variable' }]} />;
}

describe('PipingInput', () => {
  it('suggests keys after {{ and inserts the chosen one', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const input = screen.getByRole('combobox', { name: 'Question text' });
    await user.type(input, 'Hi {{{{fi');
    expect(screen.getByRole('option', { name: /firstName/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /total/ })).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(input).toHaveValue('Hi {{firstName}}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
  it('Escape closes the list without inserting', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    const input = screen.getByRole('combobox', { name: 'Question text' });
    await user.type(input, '{{{{');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('{{');
  });
});
