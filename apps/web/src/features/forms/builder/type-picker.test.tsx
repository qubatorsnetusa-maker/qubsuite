import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TypePicker } from './type-picker';

describe('TypePicker', () => {
  it('groups types and reports the pick', async () => {
    const onPick = vi.fn();
    render(<TypePicker onPick={onPick} trigger={<button>Add question</button>} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add question' }));
    expect(screen.getByText('Rating & scales')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Welcome screen/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /Net Promoter Score/ }));
    expect(onPick).toHaveBeenCalledWith('NPS');
  });
});
