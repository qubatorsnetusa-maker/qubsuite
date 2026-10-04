import type { FormDto } from '@qub/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/misc';
import { BuilderOpsContext, type BuilderOps } from './builder-ops';

/** Renders builder UI with a stub BuilderOps; `apply` records the transactions the UI produced. */
export function renderWithOps(ui: ReactElement, { form, ...overrides }: { form: FormDto } & Partial<BuilderOps>) {
  const apply = overrides.apply ?? vi.fn();
  const value: BuilderOps = {
    form,
    apply,
    seal: vi.fn(),
    undo: vi.fn(),
    undoIf: vi.fn(() => true),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null,
    status: 'saved',
    retry: vi.fn(),
    flush: () => Promise.resolve(),
    readOnly: false,
    isOwnTx: () => false,
    ...overrides,
  };
  const result = render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <BuilderOpsContext.Provider value={value}>{ui}</BuilderOpsContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return { apply: apply as ReturnType<typeof vi.fn>, ...result };
}
