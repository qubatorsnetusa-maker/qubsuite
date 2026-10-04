import type { FormThemeDto } from '@qub/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BrandControls } from './brand-controls';

const theme = (extras: FormThemeDto['extras'] = {}): FormThemeDto => ({ primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans', headerImageUrl: null, extras });

describe('BrandControls', () => {
  it('commits a logo URL on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BrandControls theme={theme()} disabled={false} onChange={onChange} />);
    await user.type(screen.getByLabelText('Logo URL'), 'https://cdn.test/logo.png');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ extras: { logoUrl: 'https://cdn.test/logo.png' } });
  });

  it('clears the logo to null when the box is emptied', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BrandControls theme={theme({ logoUrl: 'https://cdn.test/logo.png' })} disabled={false} onChange={onChange} />);
    await user.clear(screen.getByLabelText('Logo URL'));
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ extras: { logoUrl: null } });
  });

  it('hides the alignment control until there is a logo', async () => {
    render(<BrandControls theme={theme()} disabled={false} onChange={vi.fn()} />);
    expect(screen.queryByRole('radio', { name: 'Centre' })).toBeNull();
    render(<BrandControls theme={theme({ logoUrl: 'https://cdn.test/logo.png' })} disabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Centre' })).toBeInTheDocument();
  });

  it('commits the alignment', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BrandControls theme={theme({ logoUrl: 'https://cdn.test/logo.png' })} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Centre' }));
    expect(onChange).toHaveBeenCalledWith({ extras: { logoAlign: 'center' } });
  });

  it('commits footer text on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BrandControls theme={theme()} disabled={false} onChange={onChange} />);
    await user.type(screen.getByLabelText('Footer text'), 'Acme Inc.');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ extras: { footerText: 'Acme Inc.' } });
  });

  it('toggles Powered by Qub, which is on unless turned off', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BrandControls theme={theme()} disabled={false} onChange={onChange} />);
    const toggle = screen.getByRole('switch', { name: 'Show "Powered by Qub"' });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(onChange).toHaveBeenCalledWith({ extras: { showPoweredBy: false } });
  });

  it('commits the brand name on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BrandControls theme={theme()} disabled={false} onChange={onChange} />);
    await user.type(screen.getByLabelText('Brand name'), 'Acme Inc.');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ extras: { brandName: 'Acme Inc.' } });
  });

  it('keeps the tagline and brand-name toggle hidden until a brand name exists', () => {
    const { unmount } = render(<BrandControls theme={theme()} disabled={false} onChange={vi.fn()} />);
    expect(screen.queryByLabelText('Tagline')).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Show brand name' })).toBeNull();
    unmount();
    render(<BrandControls theme={theme({ brandName: 'Acme Inc.' })} disabled={false} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Tagline')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show brand name' })).toBeChecked();
  });

  it('commits the tagline on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BrandControls theme={theme({ brandName: 'Acme Inc.' })} disabled={false} onChange={onChange} />);
    await user.type(screen.getByLabelText('Tagline'), 'Customer experience');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ extras: { brandTagline: 'Customer experience' } });
  });

  it('toggles the brand name off', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BrandControls theme={theme({ brandName: 'Acme Inc.' })} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('switch', { name: 'Show brand name' }));
    expect(onChange).toHaveBeenCalledWith({ extras: { showBrandName: false } });
  });

  it('offers a right alignment and commits it', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BrandControls theme={theme({ logoUrl: 'https://cdn.test/logo.png' })} disabled={false} onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Right' }));
    expect(onChange).toHaveBeenCalledWith({ extras: { logoAlign: 'right' } });
  });

  it('commits a logo height, defaulting the slider to 40', async () => {
    const onChange = vi.fn();
    render(<BrandControls theme={theme({ logoUrl: 'https://cdn.test/logo.png' })} disabled={false} onChange={onChange} />);
    const slider = screen.getByLabelText('Logo height — 40px');
    fireEvent.change(slider, { target: { value: '56' } });
    expect(onChange).toHaveBeenCalledWith({ extras: { logoHeight: 56 } });
  });

  it('hides the logo size and position controls when the logo is switched off', () => {
    render(<BrandControls theme={theme({ logoUrl: 'https://cdn.test/logo.png', showLogo: false })} disabled={false} onChange={vi.fn()} />);
    expect(screen.queryByRole('radio', { name: 'Centre' })).toBeNull();
    expect(screen.queryByLabelText(/Logo height/)).toBeNull();
    expect(screen.getByLabelText('Logo URL')).toBeInTheDocument();
  });

  it('commits a website URL, then reveals its link text', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<BrandControls theme={theme()} disabled={false} onChange={onChange} />);
    expect(screen.queryByLabelText('Link text')).toBeNull();
    await user.type(screen.getByLabelText('Website URL'), 'https://acme.test');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ extras: { websiteUrl: 'https://acme.test' } });
    unmount();
    render(<BrandControls theme={theme({ websiteUrl: 'https://acme.test' })} disabled={false} onChange={onChange} />);
    expect(screen.getByLabelText('Link text')).toBeInTheDocument();
  });

  it('commits a banner URL and its height', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(<BrandControls theme={theme()} disabled={false} onChange={onChange} />);
    expect(screen.queryByLabelText(/Banner height/)).toBeNull();
    await user.type(screen.getByLabelText('Banner image URL'), 'https://cdn.test/banner.jpg');
    await user.tab();
    expect(onChange).toHaveBeenCalledWith({ extras: { headerBannerUrl: 'https://cdn.test/banner.jpg' } });
    unmount();

    render(<BrandControls theme={theme({ headerBannerUrl: 'https://cdn.test/banner.jpg' })} disabled={false} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Banner height — 120px'), { target: { value: '200' } });
    expect(onChange).toHaveBeenCalledWith({ extras: { headerBannerHeight: 200 } });
  });

  it('starts on the minimal header style and commits another', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BrandControls theme={theme()} disabled={false} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Minimal' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Prominent' }));
    expect(onChange).toHaveBeenCalledWith({ extras: { headerStyle: 'prominent' } });
  });

  it('explains what the chosen header style does', () => {
    const { unmount } = render(<BrandControls theme={theme()} disabled={false} onChange={vi.fn()} />);
    expect(screen.getByText('A compact row above the form.')).toBeInTheDocument();
    unmount();
    render(<BrandControls theme={theme({ headerStyle: 'banner' })} disabled={false} onChange={vi.fn()} />);
    expect(screen.getByText('The brand sits over the banner image, always centred.')).toBeInTheDocument();
  });

  it('hides the logo position control for the banner style, which always centres', () => {
    render(<BrandControls theme={theme({ logoUrl: 'https://cdn.test/logo.png', headerStyle: 'banner' })} disabled={false} onChange={vi.fn()} />);
    expect(screen.queryByRole('radio', { name: 'Centre' })).toBeNull();
    expect(screen.getByLabelText(/Logo height/)).toBeInTheDocument();
  });

  it('disables every control for a viewer', () => {
    render(
      <BrandControls
        theme={theme({ logoUrl: 'https://cdn.test/logo.png', brandName: 'Acme Inc.', websiteUrl: 'https://acme.test', headerBannerUrl: 'https://cdn.test/banner.jpg' })}
        disabled
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Logo URL')).toBeDisabled();
    expect(screen.getByLabelText('Brand name')).toBeDisabled();
    expect(screen.getByLabelText('Tagline')).toBeDisabled();
    expect(screen.getByLabelText('Website URL')).toBeDisabled();
    expect(screen.getByLabelText('Link text')).toBeDisabled();
    expect(screen.getByLabelText('Banner image URL')).toBeDisabled();
    expect(screen.getByLabelText(/Logo height/)).toBeDisabled();
    expect(screen.getByLabelText(/Banner height/)).toBeDisabled();
    expect(screen.getByLabelText('Footer text')).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Show brand name' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Show logo' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Show "Powered by Qub"' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Banner' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Centre' })).toBeDisabled();
  });
});
