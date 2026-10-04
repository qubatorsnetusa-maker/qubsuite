import type { FormDto } from '@qub/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/misc';
import { FormTopBar } from './builder-page';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));
vi.mock('./use-form-room', () => ({ useFormRoom: () => [] }));
vi.mock('../sharing/share-dialog', () => ({ ShareDialog: () => null }));
vi.mock('../drive/dialogs', () => ({ MoveDialog: () => null }));
// The shared header is exercised elsewhere; here it only shows whether the title is editable and what it was given.
vi.mock('@/components/editor-header', () => ({
  EditorHeader: ({ title, canEdit, readOnlyLabel, actions }: { title: string; canEdit: boolean; readOnlyLabel?: string; actions?: ReactNode }) => (
    <div>
      <input aria-label="Title" defaultValue={title} disabled={!canEdit} />
      {readOnlyLabel}
      {actions}
    </div>
  ),
  SaveIndicator: () => null,
}));

const form = { id: 'f1', fileId: 'file1', publicId: 'p1', title: 'Survey', isPublished: false, isTrashed: false, responseCount: 0, capabilities: { canEdit: true, canTrash: true } } as unknown as FormDto;
const renderBar = (readOnly?: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <FormTopBar form={form} tab="questions" readOnly={readOnly} />
      </TooltipProvider>
    </QueryClientProvider>,
  );

describe('FormTopBar', () => {
  it('lets an editor rename, publish and open the More menu', () => {
    renderBar();
    expect(screen.getByLabelText('Title')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('once editing is revoked, the title is locked and Publish and More are gone', () => {
    renderBar(true);
    expect(screen.getByLabelText('Title')).toBeDisabled();
    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
  });
});
