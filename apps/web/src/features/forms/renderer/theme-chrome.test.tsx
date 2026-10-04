import type { FormThemeDto } from '@qub/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormBackground, FormBrandHeader, FormFooter } from './theme-chrome';

const theme = (extras: FormThemeDto['extras']): FormThemeDto => ({ primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans', headerImageUrl: null, extras });

describe('FormBackground', () => {
  it('renders nothing for a solid background', () => {
    const { container } = render(<FormBackground theme={theme({ background: { kind: 'color' } })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when extras are absent', () => {
    const { container } = render(<FormBackground theme={theme(undefined)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('paints a gradient at the chosen angle', () => {
    const { container } = render(<FormBackground theme={theme({ background: { kind: 'gradient', from: '#000000', to: '#ffffff', angle: 135 } })} />);
    expect(container.firstElementChild).toHaveStyle({ backgroundImage: 'linear-gradient(135deg, #000000, #ffffff)' });
  });

  it('defaults a gradient angle to 160', () => {
    const { container } = render(<FormBackground theme={theme({ background: { kind: 'gradient', from: '#000000', to: '#ffffff' } })} />);
    expect(container.firstElementChild).toHaveStyle({ backgroundImage: 'linear-gradient(160deg, #000000, #ffffff)' });
  });

  // Review Focus 1
  it('renders nothing for a gradient missing a stop, never an invalid gradient', () => {
    const { container } = render(<FormBackground theme={theme({ background: { kind: 'gradient', to: '#ffffff' } })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('paints an image with a dim overlay', () => {
    const { container } = render(<FormBackground theme={theme({ background: { kind: 'image', imageUrl: 'https://cdn.test/bg.jpg', dim: 40 } })} />);
    expect(container.firstElementChild).toHaveStyle({ backgroundImage: 'url(https://cdn.test/bg.jpg)' });
    expect(container.querySelector('[data-testid="form-bg-dim"]')).toHaveStyle({ background: 'rgba(0, 0, 0, 0.4)' });
  });

  it('softens and over-scales a blurred background image', () => {
    render(<FormBackground theme={theme({ background: { kind: 'image', imageUrl: 'https://cdn.test/bg.jpg', blur: 'md' } })} />);
    expect(screen.getByTestId('form-bg-image')).toHaveStyle({ filter: 'blur(10px)', transform: 'scale(1.06)' });
  });

  it('emits no filter for an unblurred background image', () => {
    render(<FormBackground theme={theme({ background: { kind: 'image', imageUrl: 'https://cdn.test/bg.jpg', blur: 'none' } })} />);
    const layer = screen.getByTestId('form-bg-image');
    expect(layer.style.filter).toBe('');
    expect(layer.style.transform).toBe('');
  });

  it('omits the dim layer at dim 0', () => {
    const { container } = render(<FormBackground theme={theme({ background: { kind: 'image', imageUrl: 'https://cdn.test/bg.jpg', dim: 0 } })} />);
    expect(container.querySelector('[data-testid="form-bg-dim"]')).toBeNull();
  });

  it('renders nothing for an image kind with no URL', () => {
    const { container } = render(<FormBackground theme={theme({ background: { kind: 'image', imageUrl: null, dim: 20 } })} />);
    expect(container).toBeEmptyDOMElement();
  });

  // Review Focus 2
  it('refuses a non-http background image URL', () => {
    const { container } = render(<FormBackground theme={theme({ background: { kind: 'image', imageUrl: 'javascript:alert(1)' } })} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('FormBrandHeader', () => {
  it('renders nothing without a logo, brand name or banner', () => {
    const { container } = render(<FormBrandHeader theme={theme({})} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a decorative logo, left by default', () => {
    render(<FormBrandHeader theme={theme({ logoUrl: 'https://cdn.test/logo.png' })} />);
    const img = screen.getByRole('presentation', { hidden: true });
    expect(img).toHaveAttribute('src', 'https://cdn.test/logo.png');
    expect(img).toHaveAttribute('alt', '');
    expect(screen.getByTestId('form-brand-row')).toHaveClass('flex-row');
  });

  it('centres the logo when asked', () => {
    render(<FormBrandHeader theme={theme({ logoUrl: 'https://cdn.test/logo.png', logoAlign: 'center' })} />);
    expect(screen.getByTestId('form-brand-row')).toHaveClass('items-center');
  });

  it('puts the brand block last when aligned right', () => {
    render(<FormBrandHeader theme={theme({ logoUrl: 'https://cdn.test/logo.png', logoAlign: 'right' })} />);
    expect(screen.getByTestId('form-brand-row')).toHaveClass('flex-row-reverse');
  });

  // Review Focus 2
  it('refuses a non-http logo URL', () => {
    const { container } = render(<FormBrandHeader theme={theme({ logoUrl: 'data:text/html,<script>' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sizes the logo to the chosen height, defaulting to 40px', () => {
    render(<FormBrandHeader theme={theme({ logoUrl: 'https://cdn.test/logo.png', logoHeight: 56 })} />);
    expect(screen.getByRole('presentation', { hidden: true })).toHaveStyle({ height: '56px' });
  });

  it('defaults the logo height when unset', () => {
    render(<FormBrandHeader theme={theme({ logoUrl: 'https://cdn.test/logo.png' })} />);
    expect(screen.getByRole('presentation', { hidden: true })).toHaveStyle({ height: '40px' });
  });

  it('shows the brand name and tagline beside the logo', () => {
    render(<FormBrandHeader theme={theme({ logoUrl: 'https://cdn.test/logo.png', brandName: 'Acme Inc.', brandTagline: 'Customer experience' })} />);
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
    expect(screen.getByText('Customer experience')).toBeInTheDocument();
  });

  it('renders the brand name with no logo at all', () => {
    render(<FormBrandHeader theme={theme({ brandName: 'Acme Inc.' })} />);
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
  });

  it('hides the brand name and its tagline when switched off', () => {
    render(<FormBrandHeader theme={theme({ logoUrl: 'https://cdn.test/logo.png', brandName: 'Acme Inc.', brandTagline: 'Customer experience', showBrandName: false })} />);
    expect(screen.queryByText('Acme Inc.')).toBeNull();
    expect(screen.queryByText('Customer experience')).toBeNull();
  });

  it('hides the logo but keeps the brand name when the logo is switched off', () => {
    render(<FormBrandHeader theme={theme({ logoUrl: 'https://cdn.test/logo.png', showLogo: false, brandName: 'Acme Inc.' })} />);
    expect(screen.queryByRole('presentation', { hidden: true })).toBeNull();
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
  });

  it('renders nothing when the logo is switched off and nothing else is set', () => {
    const { container } = render(<FormBrandHeader theme={theme({ logoUrl: 'https://cdn.test/logo.png', showLogo: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the banner at the chosen height', () => {
    render(<FormBrandHeader theme={theme({ headerBannerUrl: 'https://cdn.test/banner.jpg', headerBannerHeight: 200 })} />);
    expect(screen.getByTestId('form-header-banner')).toHaveStyle({ height: '200px' });
  });

  it('defaults the banner height to 120px', () => {
    render(<FormBrandHeader theme={theme({ headerBannerUrl: 'https://cdn.test/banner.jpg' })} />);
    expect(screen.getByTestId('form-header-banner')).toHaveStyle({ height: '120px' });
  });

  it('refuses a non-http banner URL', () => {
    const { container } = render(<FormBrandHeader theme={theme({ headerBannerUrl: 'javascript:alert(1)' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links to the author site with their label, opened safely', () => {
    render(<FormBrandHeader theme={theme({ brandName: 'Acme Inc.', websiteUrl: 'https://acme.test', websiteLabel: 'Back to Acme' })} />);
    const link = screen.getByRole('link', { name: 'Back to Acme' });
    expect(link).toHaveAttribute('href', 'https://acme.test');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('shows the website link on its own, with nothing else branded', () => {
    render(<FormBrandHeader theme={theme({ websiteUrl: 'https://acme.test' })} />);
    expect(screen.getByRole('link', { name: 'Visit website' })).toBeInTheDocument();
  });

  it('falls back to a default link label', () => {
    render(<FormBrandHeader theme={theme({ brandName: 'Acme Inc.', websiteUrl: 'https://acme.test' })} />);
    expect(screen.getByRole('link', { name: 'Visit website' })).toBeInTheDocument();
  });

  // Review Focus 2
  it('refuses a javascript: website URL', () => {
    render(<FormBrandHeader theme={theme({ brandName: 'Acme Inc.', websiteUrl: 'javascript:alert(1)' })} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  describe('headerStyle', () => {
    it('is minimal unless set', () => {
      render(<FormBrandHeader theme={theme({ brandName: 'Acme Inc.' })} />);
      expect(screen.getByTestId('form-brand-header')).toHaveAttribute('data-header-style', 'minimal');
    });

    it('keeps the brand name small and adds no rule when minimal', () => {
      render(<FormBrandHeader theme={theme({ brandName: 'Acme Inc.', headerStyle: 'minimal' })} />);
      expect(screen.getByText('Acme Inc.')).toHaveClass('text-sm');
      expect(screen.getByTestId('form-brand-row')).not.toHaveClass('border-b');
    });

    it('enlarges the brand name and rules off the row when prominent', () => {
      render(<FormBrandHeader theme={theme({ brandName: 'Acme Inc.', brandTagline: 'Customer experience', headerStyle: 'prominent' })} />);
      expect(screen.getByTestId('form-brand-header')).toHaveAttribute('data-header-style', 'prominent');
      expect(screen.getByText('Acme Inc.')).toHaveClass('text-lg');
      expect(screen.getByText('Customer experience')).toHaveClass('text-sm');
      expect(screen.getByTestId('form-brand-row')).toHaveClass('border-b');
    });

    it('still honours the logo alignment when prominent', () => {
      render(<FormBrandHeader theme={theme({ logoUrl: 'https://cdn.test/logo.png', headerStyle: 'prominent', logoAlign: 'right' })} />);
      expect(screen.getByTestId('form-brand-row')).toHaveClass('flex-row-reverse');
    });

    it('lays the banner style over the header image, scrimmed for contrast', () => {
      render(<FormBrandHeader theme={theme({ brandName: 'Acme Inc.', headerStyle: 'banner', headerBannerUrl: 'https://cdn.test/banner.jpg', headerBannerHeight: 200 })} />);
      const header = screen.getByTestId('form-brand-header');
      expect(header).toHaveAttribute('data-header-style', 'banner');
      expect(header).toHaveStyle({ minHeight: '200px' });
      expect(screen.getByTestId('form-header-banner')).toHaveClass('absolute');
      expect(screen.getByTestId('form-header-banner-scrim')).toBeInTheDocument();
      expect(screen.getByTestId('form-brand-row')).toHaveClass('text-white');
    });

    it('falls back to the primary colour when the banner style has no image', () => {
      render(<FormBrandHeader theme={theme({ brandName: 'Acme Inc.', headerStyle: 'banner' })} />);
      expect(screen.getByTestId('form-brand-header')).toHaveStyle({ background: '#673ab7' });
      expect(screen.queryByTestId('form-header-banner')).toBeNull();
      expect(screen.queryByTestId('form-header-banner-scrim')).toBeNull();
    });

    it('centres the banner style even when the logo is aligned right', () => {
      render(<FormBrandHeader theme={theme({ logoUrl: 'https://cdn.test/logo.png', headerStyle: 'banner', logoAlign: 'right' })} />);
      const row = screen.getByTestId('form-brand-row');
      expect(row).toHaveClass('items-center');
      expect(row).not.toHaveClass('flex-row-reverse');
    });

    it('renders nothing for a banner style with nothing branded', () => {
      const { container } = render(<FormBrandHeader theme={theme({ headerStyle: 'banner' })} />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});

describe('FormFooter', () => {
  it('shows Powered by Qub when explicitly enabled', () => {
    render(<FormFooter theme={theme({ showPoweredBy: true })} />);
    expect(screen.getByRole('link', { name: 'Powered by Qub' })).toBeInTheDocument();
  });

  it('renders nothing for empty extras (pre-B1 form)', () => {
    const { container } = render(<FormFooter theme={theme({})} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the author’s footer text alongside it', () => {
    render(<FormFooter theme={theme({ footerText: 'Acme Inc.\nAll rights reserved', showPoweredBy: true })} />);
    expect(screen.getByText(/Acme Inc\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Powered by Qub' })).toBeInTheDocument();
  });

  it('renders nothing when the text is empty and Powered by is off', () => {
    const { container } = render(<FormFooter theme={theme({ footerText: '   ', showPoweredBy: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('keeps the author’s text when Powered by is off', () => {
    render(<FormFooter theme={theme({ footerText: 'Acme Inc.', showPoweredBy: false })} />);
    expect(screen.getByText('Acme Inc.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Powered by Qub' })).toBeNull();
  });
});
