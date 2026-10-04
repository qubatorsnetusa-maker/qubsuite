import type { FormDto } from '@qub/shared';
import { fieldSetTx } from '@qub/shared/forms';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '@/lib/auth-store';
import { formsService } from '@/services/forms';
import { qk } from '@/services/query-keys';
import { BuilderOpsProvider, useBuilderOps } from './ops/builder-ops';
import { memoryStore } from './ops/queue-store';
import { useDebouncedCommit } from './use-debounced-commit';

vi.mock('@/services/forms', () => ({ formsService: { applyOps: vi.fn(), get: vi.fn() } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }) }));

afterEach(() => vi.useRealTimers());
// Builder sessions only send while their user is the one signed in.
beforeEach(() => authStore.setSession({ accessToken: 't', accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: { id: '00000000-0000-4000-8000-000000000800' } as never }));

describe('useDebouncedCommit', () => {
  it('reset drops the pending change and shows the stored value again', () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    const { result } = renderHook(() => useDebouncedCommit('Title', commit));
    act(() => result.current[1](''));
    expect(result.current[0]).toBe('');
    act(() => result.current[3]());
    expect(result.current[0]).toBe('Title');
    act(() => vi.advanceTimersByTime(400));
    act(() => result.current[2]());
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits once after the pause, with the last value', () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    const { result } = renderHook(() => useDebouncedCommit('', commit));
    act(() => result.current[1]('a'));
    act(() => result.current[1]('ab'));
    act(() => vi.advanceTimersByTime(400));
    expect(commit.mock.calls).toEqual([['ab']]);
  });

  it('commits a pending change when it unmounts before the pause ends', () => {
    vi.useFakeTimers();
    const commit = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCommit('', commit));
    act(() => result.current[1]('abc'));
    unmount();
    expect(commit.mock.calls).toEqual([['abc']]);
    act(() => vi.advanceTimersByTime(1000));
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('commits nothing on unmount when nothing is pending', () => {
    const commit = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCommit('x', commit));
    act(() => result.current[1]('y'));
    act(() => result.current[2]());
    unmount();
    expect(commit.mock.calls).toEqual([['y']]);
  });

  it('keeps a change typed just before the whole builder closes', async () => {
    const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const form = {
      id: uid(900),
      revision: 0,
      fields: [{ id: uid(1), ref: 'q1', type: 'SHORT_ANSWER', label: 'A', description: null, required: false, position: 0, validation: {}, settings: {}, options: [], rules: [], scoreConfig: null, placeholder: null, defaultValue: null }],
      variables: [],
    } as unknown as FormDto;
    vi.mocked(formsService.applyOps).mockReturnValue(new Promise(() => {}));
    const store = memoryStore();
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    qc.setQueryData(qk.forms.one(form.id), form);
    let change!: (v: string) => void;
    function Box() {
      const ops = useBuilderOps();
      const [draft, set] = useDebouncedCommit(ops.form.fields[0]!.label, (v) => ops.apply(fieldSetTx(ops.form, uid(1), { label: v })));
      change = set;
      return <p data-testid="draft">{draft}</p>;
    }
    const view = render(
      <QueryClientProvider client={qc}>
        <BuilderOpsProvider formId={form.id} userId={uid(800)} storeFactory={async () => store}>
          <Box />
        </BuilderOpsProvider>
      </QueryClientProvider>,
    );
    await screen.findByTestId('draft');
    act(() => change('Typed'));
    view.unmount();
    const saved = await store.load();
    expect(saved.flatMap((t) => t.ops)).toEqual([expect.objectContaining({ changes: { label: { from: 'A', to: 'Typed' } } })]);
  });
});
