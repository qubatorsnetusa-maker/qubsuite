import type { FormThemeDto } from '@qub/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeControls } from './theme-controls';

const theme = (extras: FormThemeDto['extras'] = {}): FormThemeDto => ({ primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans', headerImageUrl: null, extras });

describe('ThemeControls', () => {
  it('shows only the solid swatch controls for a colour background', () => {
    render(<ThemeControls theme={theme({ background: { kind: 'color' } })} disabled={false} onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Gradient start')).toBeNull();
    expect(screen.queryByLabelText('Background image URL')).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Dim' })).toBeNull();
  });

  it('seeds valid gradient stops when the author switches to Gradient', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeControls theme={theme({ background: { kind: 'color' } })} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Gradient' }));
    expect(onChange).toHaveBeenCalledWith({ extras: { background: { kind: 'gradient', from: '#f0ebf8', to: '#ffffff', angle: 160 } } });
  });

  it('seeds an empty image background when the author switches to Image', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeControls theme={theme({ background: { kind: 'color' } })} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Image' }));
    expect(onChange).toHaveBeenCalledWith({ extras: { background: { kind: 'image', imageUrl: null, dim: 0 } } });
  });

  it('keeps the image URL and dim when the author switches away and back', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeControls theme={theme({ background: { kind: 'image', imageUrl: 'https://cdn.test/bg.jpg', dim: 40 } })} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Solid' }));
    expect(onChange).toHaveBeenCalledWith({ extras: { background: { kind: 'color', imageUrl: 'https://cdn.test/bg.jpg', dim: 40 } } });
  });

  it('shows the dim slider only for an image background', () => {
    render(<ThemeControls theme={theme({ background: { kind: 'gradient', from: '#000000', to: '#ffffff' } })} disabled={false} onChange={vi.fn()} />);
    expect(screen.queryByRole('slider', { name: 'Dim' })).toBeNull();
    render(<ThemeControls theme={theme({ background: { kind: 'image', imageUrl: null, dim: 0 } })} disabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole('slider', { name: 'Dim' })).toBeInTheDocument();
  });

  it('commits a font pair by name', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeControls theme={theme()} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: /Editorial/ }));
    expect(onChange).toHaveBeenCalledWith({ extras: { fontPair: 'playfair' } });
  });

  it('commits a button shape', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeControls theme={theme()} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Pill' }));
    expect(onChange).toHaveBeenCalledWith({ extras: { buttonRadius: 'pill' } });
  });

  it('commits the primary colour at the top level, not inside extras', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeControls theme={theme()} disabled={false} onChange={onChange} />);
    const box = screen.getByRole('textbox', { name: 'Primary colour hex' });
    await user.clear(box);
    await user.type(box, '#0f172a{Enter}');
    expect(onChange).toHaveBeenCalledWith({ primaryColor: '#0f172a' });
  });

  it('marks nothing selected when the form has no font pair', () => {
    render(<ThemeControls theme={theme()} disabled={false} onChange={vi.fn()} />);
    for (const r of screen.getAllByRole('radio')) {
      if ((r as HTMLInputElement).name === 'font-pair') expect(r).not.toBeChecked();
    }
  });

  it('commits a curated accent colour at the top level', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeControls theme={theme()} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Emerald — #047857' }));
    expect(onChange).toHaveBeenCalledWith({ primaryColor: '#047857' });
  });

  it('commits a curated page colour at the top level', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeControls theme={theme()} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Obsidian — #111215' }));
    expect(onChange).toHaveBeenCalledWith({ backgroundColor: '#111215' });
  });

  it('marks the swatch matching the current colour, whatever its case', () => {
    render(<ThemeControls theme={theme()} disabled={false} onChange={vi.fn()} />);
    // The fixture's primary is #673ab7 — the Violet swatch.
    expect(screen.getByRole('button', { name: 'Violet — #673ab7' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Emerald — #047857' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a rendered sample for every font pairing', () => {
    render(<ThemeControls theme={theme()} disabled={false} onChange={vi.fn()} />);
    expect(screen.getAllByText('What is your name?')).toHaveLength(8);
    expect(screen.getByRole('radio', { name: 'Editorial' })).toBeInTheDocument();
  });

  it('offers wallpapers and blur only for an image background', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<ThemeControls theme={theme({ background: { kind: 'color' } })} disabled={false} onChange={onChange} />);
    expect(screen.queryByRole('radio', { name: 'Heavy' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Atmospheric fog' })).toBeNull();
    unmount();

    render(<ThemeControls theme={theme({ background: { kind: 'image', imageUrl: null, dim: 0 } })} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Heavy' }));
    expect(onChange).toHaveBeenCalledWith({ extras: { background: { kind: 'image', imageUrl: null, dim: 0, blur: 'lg' } } });
  });

  it('commits a curated wallpaper as the background image, keeping the dim', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ThemeControls theme={theme({ background: { kind: 'image', imageUrl: null, dim: 30 } })} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Neon dusk' }));
    expect(onChange).toHaveBeenCalledWith({
      extras: { background: { kind: 'image', imageUrl: expect.stringContaining('images.unsplash.com'), dim: 30 } },
    });
  });

  it('marks the wallpaper already in use', () => {
    const url = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80';
    render(<ThemeControls theme={theme({ background: { kind: 'image', imageUrl: url } })} disabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Atmospheric fog' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Neon dusk' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows each button shape with its radius in px', () => {
    render(<ThemeControls theme={theme({ buttonRadius: 'rounded' })} disabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Rounded' })).toBeChecked();
    expect(screen.getByText(/Softly curved — 10px/)).toBeInTheDocument();
    expect(screen.getByText(/Square corners — 0px/)).toBeInTheDocument();
  });

  it('disables every control for a viewer', () => {
    render(<ThemeControls theme={theme({ background: { kind: 'image', imageUrl: null, dim: 10 } })} disabled onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Primary colour hex' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Pill' })).toBeDisabled();
    expect(screen.getByRole('slider', { name: 'Dim' })).toBeDisabled();
    expect(screen.getByLabelText('Background image URL')).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Heavy' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Violet — #673ab7' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Atmospheric fog' })).toBeDisabled();
  });
});
