import type { FormDto, FormServerMessage } from '@qub/shared';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { qk } from '@/services/query-keys';
import { BuilderOpsContext, type BuilderOps } from './builder/ops/builder-ops';
import { useFormRoom } from './use-form-room';

const socket = vi.hoisted(() => ({ onMessage: null as ((m: unknown) => void) | null }));
vi.mock('@/lib/reconnecting-socket', () => ({
  ReconnectingSocket: class {
    constructor(opts: { onMessage(m: unknown): void }) {
      socket.onMessage = opts.onMessage;
    }
    close() {}
  },
}));
vi.mock('@/hooks/use-auth', () => ({ useCurrentUser: () => ({ id: 'me' }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

const FORM = 'form1';
const send = (m: FormServerMessage) => socket.onMessage!(m);

function setup(ops?: Pick<BuilderOps, 'isOwnTx'>) {
  const qc = new QueryClient();
  const invalidate = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{ops ? <BuilderOpsContext.Provider value={{ form: {} as FormDto, ...ops } as BuilderOps}>{children}</BuilderOpsContext.Provider> : children}</QueryClientProvider>
  );
  renderHook(() => useFormRoom(FORM), { wrapper });
  const refetched = () => invalidate.mock.calls.some(([f]) => JSON.stringify(f?.queryKey) === JSON.stringify(qk.forms.one(FORM)));
  return { invalidate, refetched };
}

beforeEach(() => {
  socket.onMessage = null;
});

describe('useFormRoom', () => {
  it('in the builder, refetches for any transaction this tab did not send — including one from my other tab', () => {
    const { invalidate, refetched } = setup({ isOwnTx: (id) => id === 'mine' });
    send({ type: 'formUpdated', by: 'me', txId: 'mine', revision: 2 });
    expect(refetched()).toBe(false);
    send({ type: 'formUpdated', by: 'me', txId: 'other-tab', revision: 3 });
    expect(refetched()).toBe(true);
    invalidate.mockClear();
    send({ type: 'formUpdated', by: 'someone', txId: 'theirs', revision: 4 });
    expect(refetched()).toBe(true);
  });

  it('in the builder, a message without a transaction id keeps the by-user rule', () => {
    const { invalidate, refetched } = setup({ isOwnTx: () => false });
    send({ type: 'formUpdated', by: 'me' });
    expect(refetched()).toBe(false);
    invalidate.mockClear();
    send({ type: 'formUpdated', by: 'someone' });
    expect(refetched()).toBe(true);
  });

  it('outside the builder (responses page) keeps the by-user rule', () => {
    const { invalidate, refetched } = setup();
    send({ type: 'formUpdated', by: 'me', txId: 'x', revision: 2 });
    expect(refetched()).toBe(false);
    invalidate.mockClear();
    send({ type: 'formUpdated', by: 'someone', txId: 'y', revision: 3 });
    expect(refetched()).toBe(true);
  });
});

describe('useFormRoom refetch scope', () => {
  // The responses list (classic Responses page and the v2 Results tab) keeps every loaded page under
  // qk.forms.responses(id); a builder edit elsewhere mustn't refetch all of them, but a new response must. The
  // classic Responses summary (qk.forms.analytics(id, days)) carries question labels, so a remote edit must refresh it.
  function mount() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const formFn = vi.fn(async () => ({ id: FORM }));
    const responsesFn = vi.fn(async () => ({ items: [] }));
    const analyticsFn = vi.fn(async () => ({ fields: [] }));
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    renderHook(
      () => {
        useFormRoom(FORM);
        useQuery({ queryKey: qk.forms.one(FORM), queryFn: formFn });
        useQuery({ queryKey: qk.forms.responses(FORM), queryFn: responsesFn });
        useQuery({ queryKey: [...qk.forms.responses(FORM), { page: 2 }], queryFn: responsesFn });
        useQuery({ queryKey: qk.forms.analytics(FORM, 30), queryFn: analyticsFn });
      },
      { wrapper },
    );
    return { formFn, responsesFn, analyticsFn };
  }

  it('someone else’s builder edit refetches the form and the responses summary, but not the responses pages', async () => {
    const { formFn, responsesFn, analyticsFn } = mount();
    await waitFor(() => expect(responsesFn).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(formFn).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(analyticsFn).toHaveBeenCalledTimes(1));
    send({ type: 'formUpdated', by: 'someone', txId: 'theirs', revision: 2 });
    await waitFor(() => expect(formFn).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(analyticsFn).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 20));
    expect(responsesFn).toHaveBeenCalledTimes(2);
  });

  it('a new response refetches the responses (and the form)', async () => {
    const { formFn, responsesFn } = mount();
    await waitFor(() => expect(responsesFn).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(formFn).toHaveBeenCalledTimes(1));
    send({ type: 'response', responseCount: 1, submittedAt: new Date().toISOString() });
    await waitFor(() => expect(responsesFn).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(formFn).toHaveBeenCalledTimes(2));
  });
});
