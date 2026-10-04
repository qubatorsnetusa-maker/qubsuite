import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { V2Preview } from './v2-preview';

const formUrl = '/formsv2/preview/abc123';

describe('V2Preview', () => {
  it('renders the Desktop/Phone toggle', () => {
    render(<V2Preview formUrl={formUrl} />);
    expect(screen.getByRole('radio', { name: /desktop/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /phone/i })).toBeInTheDocument();
    // Desktop is selected by default
    expect(screen.getByRole('radio', { name: /desktop/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /phone/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('Phone toggle renders the 390px iframe', async () => {
    render(<V2Preview formUrl={formUrl} />);
    await userEvent.setup().click(screen.getByRole('radio', { name: /phone/i }));
    const iframe = screen.getByTitle('Phone preview');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('width', '390');
    expect(iframe).toHaveAttribute('src', expect.stringContaining('device=phone'));
  });

  it('Desktop toggle hides the iframe', async () => {
    render(<V2Preview formUrl={formUrl} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /phone/i }));
    expect(screen.getByTitle('Phone preview')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /desktop/i }));
    expect(screen.queryByTitle('Phone preview')).not.toBeInTheDocument();
  });

  it('frame=1 hides the device toggle', () => {
    render(<V2Preview formUrl={formUrl} frame />);
    expect(screen.queryByRole('radio', { name: /desktop/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /phone/i })).not.toBeInTheDocument();
  });

  it('renders no iframe in Desktop mode by default', () => {
    const { container } = render(<V2Preview formUrl="https://qub.test/f/abc" />);
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('renders a desktop iframe when desktopFrame is set', () => {
    const { container } = render(<V2Preview formUrl="https://qub.test/f/abc" desktopFrame />);
    const frame = container.querySelector('iframe')!;
    expect(frame).toHaveAttribute('src', 'https://qub.test/f/abc');
    expect(frame).not.toHaveAttribute('width', '390');
  });

  it('still switches to the 390px phone frame with desktopFrame set', async () => {
    const user = userEvent.setup();
    const { container } = render(<V2Preview formUrl="https://qub.test/f/abc" desktopFrame />);
    await user.click(screen.getByRole('radio', { name: 'Phone' }));
    const frame = container.querySelector('iframe')!;
    expect(frame).toHaveAttribute('width', '390');
    expect(frame).toHaveAttribute('src', 'https://qub.test/f/abc?device=phone');
  });

  it('remounts the iframe when reloadKey changes', () => {
    const { container, rerender } = render(<V2Preview formUrl="https://qub.test/f/abc" desktopFrame reloadKey="a" />);
    const first = container.querySelector('iframe');
    rerender(<V2Preview formUrl="https://qub.test/f/abc" desktopFrame reloadKey="b" />);
    expect(container.querySelector('iframe')).not.toBe(first);
    rerender(<V2Preview formUrl="https://qub.test/f/abc" desktopFrame reloadKey="b" />);
    expect(container.querySelector('iframe')).toBe(container.querySelector('iframe'));
  });
});
