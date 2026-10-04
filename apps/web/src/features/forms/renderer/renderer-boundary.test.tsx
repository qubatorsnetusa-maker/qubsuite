import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RendererBoundary } from './renderer-boundary';

function Boom(): never {
  throw new Error('secret stack detail');
}

describe('RendererBoundary', () => {
  it('shows a friendly message without leaking the error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <RendererBoundary>
        <Boom />
      </RendererBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong showing this form');
    expect(screen.queryByText(/secret stack detail/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
