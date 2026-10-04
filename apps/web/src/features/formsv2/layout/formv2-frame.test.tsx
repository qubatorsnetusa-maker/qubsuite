import type { ApplyOpsResult, FormDto } from '@qub/shared';
import { applyTx, formSetTx } from '@qub/shared/forms';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/misc';
import { authStore } from '@/lib/auth-store';
import { formsService } from '@/services/forms';
import { FormV2Frame } from './formv2-frame';
import { useFormV2 } from './use-form-v2';

vi.mock('@/services/forms', () => ({ formsService: { get: vi.fn(), applyOps: vi.fn(), publish: vi.fn() } }));
vi.mock('@/hooks/use-auth', () => ({ useCurrentUser: () => ({ id: '00000000-0000-4000-8000-000000000800', name: 'Me' }) }));
vi.mock('@/features/forms/use-form-room', () => ({ useFormRoom: () => [] }));
vi.mock('@/features/sharing/share-dialog', () => ({ ShareDialog: () => null }));
vi.mock('@/components/user-menu', () => ({ UserMenu: () => null }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }) }));

let n = 0;
/** A fresh id per test: the provider keeps one queue store per form for the life of the tab. */
const makeForm = (overrides: Partial<FormDto> = {}): FormDto =>
  ({
    id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    fileId: 'file1',
    publicId: 'pub1',
    revision: 1,
    title: 'Customer survey',
    description: null,
    isPublished: false,
    isTrashed: false,
    acceptingResponses: true,
    responseCount: 0,
    settings: { layout: 'conversational', quiz: { enabled: false, showScore: false } },
    theme: { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans', headerImageUrl: null },
    fields: [],
    variables: [],
    capabilities: { canEdit: true, canTrash: true },
    ...overrides,
  }) as unknown as FormDto;

/** Each tab of the test router can make a builder edit, like the real tabs will. */
function Tab({ name }: { name: string }) {
  const { ops } = useFormV2();
  return (
    <div>
      <h2>{name} tab</h2>
      <button onClick={() => ops.apply(formSetTx(ops.form, { description: `Edited in ${name}` }, 'Edit form description'))}>Make an edit</button>
    </div>
  );
}

function renderRouter(router: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <RouterProvider router={router as never} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function mount(form: FormDto, path = 'content') {
  vi.mocked(formsService.get).mockResolvedValue(form);
  const root = createRootRoute({ component: () => <Outlet /> });
  const layout = createRoute({
    getParentRoute: () => root,
    path: '/formsv2/$formId',
    component: function Layout() {
      const { formId } = layout.useParams();
      return <FormV2Frame formId={formId} />;
    },
  });
  const tabs = ['content', 'workflow', 'share', 'results'].map((p) => createRoute({ getParentRoute: () => layout, path: p, component: () => <Tab name={p} /> }));
  const router = createRouter({ routeTree: root.addChildren([layout.addChildren(tabs)]), history: createMemoryHistory({ initialEntries: [`/formsv2/${form.id}/${path}`] }) });
  renderRouter(router);
  return router;
}

const saved = (form: FormDto, tx: Parameters<typeof applyTx>[1]): ApplyOpsResult => ({ revision: 2, form: { ...applyTx(form, tx), revision: 2 }, assigned: { fields: {}, variables: {} } }) as ApplyOpsResult;

/** Builder sessions only send while their user is the one signed in — must match the mocked useCurrentUser id. */
const signIn = () =>
  authStore.setSession({ accessToken: 't', accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: { id: '00000000-0000-4000-8000-000000000800' } as never });

beforeEach(() => {
  vi.clearAllMocks();
  // The router restores scroll on navigation; jsdom has no scrolling.
  window.scrollTo = vi.fn() as never;
  signIn();
});
// Builder sessions outlive an unmounted frame (they keep sending); whatever a finished test left queued must not
// reach the next test's mock, so from here on it waits forever.
afterEach(() => {
  vi.mocked(formsService.applyOps).mockImplementation(() => new Promise(() => {}));
});

describe('FormV2Frame', () => {
  it('shows the title, save status, the four tabs and the builder actions', async () => {
    const form = makeForm();
    mount(form);
    expect(await screen.findByRole('heading', { name: 'content tab' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Customer survey');
    expect(screen.getByRole('status')).toHaveTextContent('All changes saved');
    for (const tab of ['Content', 'Workflow', 'Share', 'Results']) expect(screen.getByRole('link', { name: tab })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Content' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Preview' }).getAttribute('href')).toMatch(new RegExp(`^/formsv2/${form.id}/preview`));
    expect(screen.getByRole('link', { name: 'Open in classic Forms' })).toHaveAttribute('href', `/forms/${form.id}/edit`);
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  });

  it('keeps undo history and the pending edit when switching tabs', async () => {
    const form = makeForm();
    // The save never completes during the test: the edit stays pending across the tab switch.
    vi.mocked(formsService.applyOps).mockReturnValue(new Promise(() => {}));
    const router = mount(form);
    fireEvent.click(await screen.findByRole('button', { name: 'Make an edit' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');

    fireEvent.click(screen.getByRole('link', { name: 'Workflow' }));
    expect(await screen.findByRole('heading', { name: 'workflow tab' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/formsv2/${form.id}/workflow`);
    expect(screen.getByRole('link', { name: 'Workflow' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
    expect(formsService.applyOps).toHaveBeenCalledTimes(1);
  });

  it('renames through the shared form op', async () => {
    const form = makeForm();
    vi.mocked(formsService.applyOps).mockImplementation(async (_id, tx) => saved(form, tx));
    mount(form);
    const title = await screen.findByLabelText('Title');
    fireEvent.change(title, { target: { value: 'Renamed' } });
    fireEvent.blur(title);
    await vi.waitFor(() => expect(formsService.applyOps).toHaveBeenCalledTimes(1));
    const [, tx] = vi.mocked(formsService.applyOps).mock.calls[0]!;
    expect(tx.ops).toEqual(formSetTx(form, { title: 'Renamed' })!.ops);
  });

  it('publishes only after every pending edit is saved', async () => {
    const form = makeForm();
    let save!: () => void;
    vi.mocked(formsService.applyOps).mockImplementation((_id, tx) => new Promise((resolve) => (save = () => resolve(saved(form, tx)))));
    vi.mocked(formsService.publish).mockResolvedValue({ ...form, revision: 2, isPublished: true });
    mount(form);
    fireEvent.click(await screen.findByRole('button', { name: 'Make an edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    expect(formsService.publish).not.toHaveBeenCalled();
    await act(async () => save());
    await vi.waitFor(() => expect(formsService.publish).toHaveBeenCalledWith(form.id, true));
    expect(await screen.findByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
  });

  it('shows viewers every tab read-only, without Publish or Undo', async () => {
    mount(makeForm({ capabilities: { canEdit: false, canTrash: false } } as Partial<FormDto>), 'results');
    expect(await screen.findByRole('heading', { name: 'results tab' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeDisabled();
    expect(screen.getByText('View only')).toBeInTheDocument();
    for (const tab of ['Content', 'Workflow', 'Share', 'Results']) expect(screen.getByRole('link', { name: tab })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('offers Retry when the form fails to load', async () => {
    const form = makeForm();
    vi.mocked(formsService.get).mockRejectedValueOnce(new Error('Network down')).mockResolvedValue(form);
    const root = createRootRoute({ component: () => <FormV2Frame formId={form.id} /> });
    renderRouter(createRouter({ routeTree: root, history: createMemoryHistory() }));
    fireEvent.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByLabelText('Title')).toHaveValue('Customer survey');
  });
});
