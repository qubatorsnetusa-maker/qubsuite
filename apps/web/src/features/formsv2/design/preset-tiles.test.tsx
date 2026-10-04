import { THEME_PRESETS } from '@qub/shared/forms';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PresetTiles } from './preset-tiles';

describe('PresetTiles', () => {
  it('renders one tile per preset', () => {
    render(<PresetTiles activeId={undefined} disabled={false} onPick={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(THEME_PRESETS.length);
    for (const p of THEME_PRESETS) expect(screen.getByRole('button', { name: new RegExp(p.name) })).toBeInTheDocument();
  });

  it('hands the whole preset to onPick', async () => {
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<PresetTiles activeId={undefined} disabled={false} onPick={onPick} />);
    await user.click(screen.getByRole('button', { name: /Midnight/ }));
    expect(onPick).toHaveBeenCalledWith(THEME_PRESETS.find((p) => p.id === 'midnight'));
  });

  it('marks only the active tile pressed', () => {
    render(<PresetTiles activeId="paper" disabled={false} onPick={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Paper/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Qub/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks nothing pressed when no preset is active', () => {
    render(<PresetTiles activeId={undefined} disabled={false} onPick={vi.fn()} />);
    for (const b of screen.getAllByRole('button')) expect(b).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables every tile for a viewer', () => {
    render(<PresetTiles activeId={undefined} disabled onPick={vi.fn()} />);
    for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled();
  });
});
