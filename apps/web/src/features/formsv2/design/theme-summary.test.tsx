import type { FormThemeDto } from '@qub/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeSummary } from './theme-summary';

const theme = (extras: FormThemeDto['extras'] = {}): FormThemeDto => ({ primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans', headerImageUrl: null, extras });

describe('ThemeSummary', () => {
  it('shows the resolved accent, font pairing and button shape', () => {
    render(<ThemeSummary theme={theme({ fontPair: 'playfair', buttonRadius: 'sharp' })} disabled={false} onReset={vi.fn()} />);
    expect(screen.getByText('#673ab7')).toBeInTheDocument();
    expect(screen.getByText('Editorial')).toBeInTheDocument();
    expect(screen.getByText('sharp')).toBeInTheDocument();
  });

  it('names the fallbacks when the theme sets neither font nor shape', () => {
    render(<ThemeSummary theme={theme()} disabled={false} onReset={vi.fn()} />);
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('Pill')).toBeInTheDocument();
  });

  it('paints the sample button with the accent and the chosen radius', () => {
    render(<ThemeSummary theme={theme({ buttonRadius: 'rounded' })} disabled={false} onReset={vi.fn()} />);
    expect(screen.getByTestId('theme-summary-button')).toHaveStyle({ background: '#673ab7', borderRadius: '10px' });
  });

  it('resets on request', async () => {
    const onReset = vi.fn();
    const user = userEvent.setup();
    render(<ThemeSummary theme={theme()} disabled={false} onReset={onReset} />);
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('does not let a viewer reset', async () => {
    const onReset = vi.fn();
    const user = userEvent.setup();
    render(<ThemeSummary theme={theme()} disabled onReset={onReset} />);
    const button = screen.getByRole('button', { name: 'Reset to defaults' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onReset).not.toHaveBeenCalled();
  });
});
