import type { ApplyOpsResult, FormDto } from '@qub/shared';
import { addFieldTx, applyTx, createVariableTx, deleteFieldTx, fieldSetTx, formSetTx, type OpTx } from '@qub/shared/forms';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { authStore } from '@/lib/auth-store';
import { formsService } from '@/services/forms';
import { qk } from '@/services/query-keys';
import { BuilderOpsProvider, useBackgroundSave, useBuilderOps } from './builder-ops';
import { memoryStore, type QueueStore } from './queue-store';

vi.mock('@/services/forms', () => ({ formsService: { applyOps: vi.fn(), get: vi.fn() } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }) }));

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const Q = uid(1);
const baseForm = (): FormDto =>
  ({
    id: uid(900),
    revision: 0,
    title: 'T',
    description: null,
    acceptingResponses: true,
    settings: {},
    theme: { primaryColor: '#673ab7', backgroundColor: '#f0ebf8', fontFamily: 'sans', headerImageUrl: null },
    variables: [],
    fields: [{ id: Q, ref: 'q1', type: 'SHORT_ANSWER', label: 'A', description: null, required: false, position: 0, validation: {}, settings: {}, options: [], rules: [], scoreConfig: null, placeholder: null, defaultValue: null }],
    capabilities: { canEdit: true },
  }) as unknown as FormDto;

let latest: ReturnType<typeof useBuilderOps>;
function Probe() {
  latest = useBuilderOps();
  return <p data-testid="label">{latest.form.fields.map((f) => f.label).join(',')}</p>;
}
function mount(form = baseForm(), store: QueueStore = memoryStore()) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(qk.forms.one(form.id), form);
  const view = render(
    <QueryClientProvider client={qc}>
      <BuilderOpsProvider formId={form.id} userId={uid(800)} storeFactory={async () => store}>
        <Probe />
        <input aria-label="Text box" />
      </BuilderOpsProvider>
    </QueryClientProvider>,
  );
  return Object.assign(qc, { unmount: view.unmount });
}
/** Server double: applies each transaction to its own copy of the form, like the real endpoint. */
function fakeServer(start: FormDto) {
  let server = start;
  const sent: OpTx[] = [];
  vi.mocked(formsService.applyOps).mockImplementation(async (_id, tx) => {
    sent.push(tx);
    server = { ...applyTx(server, tx), revision: server.revision + 1 };
    return { revision: server.revision, form: server, assigned: { fields: {}, variables: {} } };
  });
  return sent;
}
/** Builder sessions only send while their user is the one signed in. */
const signIn = (id: string) => authStore.setSession({ accessToken: 't', accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: { id } as never });
const label = () => screen.getByTestId('label').textContent;
const edit = (to: string) => act(() => latest.apply(fieldSetTx(latest.form, Q, { label: to })));
const requiredTx = (n: number): OpTx => ({ txId: uid(n), label: 'Req', ops: [{ kind: 'set', entity: 'field', id: Q, changes: { required: { from: false, to: true } } }] });
const withRequired = (revision: number, title = 'T'): FormDto => ({ ...baseForm(), revision, title, fields: [{ ...baseForm().fields[0]!, required: true }] });

beforeEach(() => {
  vi.clearAllMocks();
  // A refetch (after a rejection) returns the server's form; older than what is shown, it must not take the display back.
  vi.mocked(formsService.get).mockImplementation(async () => baseForm());
  signIn(uid(800));
});
// Builder sessions outlive an unmounted builder (they keep sending); whatever a finished test left queued must not
// reach the next test's server double, so from here on it waits forever.
afterEach(() => {
  vi.mocked(formsService.applyOps).mockImplementation(() => new Promise(() => {}));
});

describe('BuilderOpsProvider', () => {
  it('shows an edit at once and saves it', async () => {
    const sent = fakeServer(baseForm());
    mount();
    await screen.findByTestId('label');
    edit('B');
    expect(label()).toBe('B');
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    expect(sent).toHaveLength(1);
  });

  it('knows which transactions this tab sent, so the form room can tell them from another tab’s', async () => {
    const sent = fakeServer(baseForm());
    mount();
    await screen.findByTestId('label');
    edit('B');
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    expect(latest.isOwnTx(sent[0]!.txId)).toBe(true);
    expect(latest.isOwnTx(uid(77))).toBe(false);
  });

  it('undoIf undoes a step only while it is the next one to undo', async () => {
    fakeServer(baseForm());
    mount();
    await screen.findByTestId('label');
    const first = requiredTx(51);
    act(() => latest.apply(first));
    edit('B');
    let undone = true;
    act(() => void (undone = latest.undoIf(first.txId)));
    expect(undone).toBe(false);
    expect(label()).toBe('B');
    expect(latest.form.fields[0]!.required).toBe(true);
    act(() => latest.undo());
    expect(label()).toBe('A');
    act(() => void (undone = latest.undoIf(first.txId)));
    expect(undone).toBe(true);
    expect(latest.form.fields[0]!.required).toBe(false);
  });

  it('keeps later pending edits visible when an earlier one is confirmed', async () => {
    let release!: (r: ApplyOpsResult) => void;
    const server = { ...baseForm(), revision: 1, fields: [{ ...baseForm().fields[0]!, label: 'B' }] };
    vi.mocked(formsService.applyOps)
      .mockImplementationOnce(() => new Promise((r) => (release = r)))
      .mockImplementation(async (_id, tx) => ({ revision: 2, form: applyTx(server, tx), assigned: { fields: {}, variables: {} } }));
    mount();
    await screen.findByTestId('label');
    edit('B');
    act(() => latest.apply({ txId: uid(77), label: 'Req', ops: [{ kind: 'set', entity: 'field', id: Q, changes: { required: { from: false, to: true } } }] }));
    await act(async () => release({ revision: 1, form: server, assigned: { fields: {}, variables: {} } }));
    expect(label()).toBe('B');
    expect(latest.form.fields[0]!.required).toBe(true);
  });

  it('undoes a rename to a title the server cleans (the transaction already holds the stored name)', async () => {
    const sent = fakeServer(baseForm());
    mount();
    await screen.findByTestId('label');
    act(() => latest.apply(formSetTx(latest.form, { title: 'Survey: Q3?' }, 'Rename form')));
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    expect(sent[0]!.ops[0]).toMatchObject({ changes: { title: { from: 'T', to: 'Survey Q3' } } });
    expect(latest.form.title).toBe('Survey Q3');
    act(() => latest.undo());
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    expect(toast.error).not.toHaveBeenCalled();
    expect(latest.form.title).toBe('T');
  });

  it('undo sends the inverse and redo re-sends under a new id', async () => {
    const sent = fakeServer(baseForm());
    mount();
    await screen.findByTestId('label');
    edit('B');
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    act(() => latest.undo());
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(label()).toBe('A');
    act(() => latest.redo());
    await vi.waitFor(() => expect(sent).toHaveLength(3));
    expect(label()).toBe('B');
    expect(new Set(sent.map((t) => t.txId)).size).toBe(3);
  });

  it('undo of an unsent edit cancels it without a request', async () => {
    vi.mocked(formsService.applyOps).mockImplementation(() => new Promise(() => {}));
    mount();
    await screen.findByTestId('label');
    edit('B');
    edit('B2'); // second tx waits behind the in-flight first one
    act(() => latest.undo());
    expect(formsService.applyOps).toHaveBeenCalledTimes(1);
    expect(label()).toBe('B');
  });

  it('undo of an edit whose send failed (it may have reached the server) sends the inverse instead of cancelling', async () => {
    const sent: OpTx[] = [];
    let server = baseForm();
    vi.mocked(formsService.applyOps)
      .mockImplementationOnce(async (_id, tx) => {
        sent.push(tx);
        throw new ApiError(0, 'NETWORK_ERROR', 'offline');
      })
      .mockImplementation(async (_id, tx) => {
        sent.push(tx);
        server = { ...applyTx(server, tx), revision: server.revision + 1 };
        return { revision: server.revision, form: server, assigned: { fields: {}, variables: {} } };
      });
    mount();
    await screen.findByTestId('label');
    edit('B');
    await vi.waitFor(() => expect(latest.status).toBe('offline'));
    act(() => latest.undo());
    expect(label()).toBe('A');
    expect(latest.canRedo).toBe(true);
    // The retry (after 1 s) re-sends the edit, then the inverse follows it.
    await vi.waitFor(() => expect(sent).toHaveLength(3), { timeout: 3000 });
    expect(sent[1]!.txId).toBe(sent[0]!.txId);
    expect(sent[2]!.ops[0]).toMatchObject({ changes: { label: { from: 'B', to: 'A' } } });
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    expect(label()).toBe('A');
  });

  it('undoes successive entries while earlier undos are in flight', async () => {
    const sent = fakeServer(baseForm());
    mount();
    await screen.findByTestId('label');
    edit('B');
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    act(() => latest.apply({ txId: uid(71), label: 'Req', ops: [{ kind: 'set', entity: 'field', id: Q, changes: { required: { from: false, to: true } } }] }));
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    act(() => {
      latest.undo();
      latest.undo();
    });
    await vi.waitFor(() => expect(sent).toHaveLength(4));
    expect(sent[2]!.ops[0]).toMatchObject({ changes: { required: { from: true, to: false } } });
    expect(sent[3]!.ops[0]).toMatchObject({ changes: { label: { from: 'B', to: 'A' } } });
    expect(latest.canUndo).toBe(false);
  });

  it('explains a conflicting undo and drops that entry', async () => {
    fakeServer(baseForm());
    mount();
    await screen.findByTestId('label');
    edit('B');
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    vi.mocked(formsService.applyOps).mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'changed', { conflicts: [] }));
    act(() => latest.undo());
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Couldn’t undo “Edit question” — someone else has changed it since.'));
    expect(latest.canRedo).toBe(false);
  });

  it('drops an edit rejected with a bare 409 (no conflict details) and shows the server state', async () => {
    fakeServer(baseForm());
    vi.mocked(formsService.applyOps).mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'changed'));
    mount();
    await screen.findByTestId('label');
    edit('B');
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Someone else changed this since. Your edit (“Edit question”) wasn’t applied.'));
    expect(label()).toBe('A');
    expect(latest.canUndo).toBe(false);
  });

  it('patches assigned keys into the undo stack', async () => {
    // Stateful, like the real endpoint: the builder now keeps sending after the test unmounts it, so a double that
    // failed a later transaction would retry into the next test.
    let server = baseForm();
    vi.mocked(formsService.applyOps).mockImplementation(async (_id, tx) => {
      const op = tx.ops[0]!;
      const form = applyTx(server, tx);
      if (op.kind !== 'create') {
        server = { ...form, revision: server.revision + 1 };
        return { revision: server.revision, form: server, assigned: { fields: {}, variables: {} } };
      }
      server = { ...form, revision: server.revision + 1, fields: form.fields.map((f) => (f.id === op.snapshot.id ? { ...f, ref: 'q9' } : f)) };
      return { revision: server.revision, form: server, assigned: { fields: { [op.snapshot.id]: 'q9' }, variables: {} } };
    });
    mount();
    await screen.findByTestId('label');
    const snapshot = { ...baseForm().fields[0]!, id: uid(2), ref: 'q2', label: 'New' };
    act(() => latest.apply({ txId: uid(70), label: 'Add', ops: [{ kind: 'create', entity: 'field', snapshot, afterId: Q }] }));
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    act(() => latest.undo());
    await vi.waitFor(() => expect(formsService.applyOps).toHaveBeenCalledTimes(2));
    const undoTx = vi.mocked(formsService.applyOps).mock.calls[1]![1];
    expect(undoTx.ops[0]).toMatchObject({ kind: 'delete', expect: { ref: 'q9' } });
  });

  it('leaves Ctrl+Z to the browser inside text inputs', async () => {
    fakeServer(baseForm());
    mount();
    await screen.findByTestId('label');
    edit('B');
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    fireEvent.keyDown(screen.getByLabelText('Text box'), { key: 'z', ctrlKey: true });
    expect(label()).toBe('B');
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(label()).toBe('A');
  });

  it('shows edits restored from storage on top of the confirmed form, sends them first and never cancels them', async () => {
    const store = memoryStore();
    await store.save([{ txId: uid(60), label: 'Edit question', ops: [{ kind: 'set', entity: 'field', id: Q, changes: { label: { from: 'A', to: 'Kept' } } }] }]);
    let release!: (r: ApplyOpsResult) => void;
    vi.mocked(formsService.applyOps).mockImplementationOnce(() => new Promise((r) => (release = r)));
    mount(baseForm(), store);
    await screen.findByTestId('label');
    expect(label()).toBe('Kept');
    expect(toast.info).toHaveBeenCalledWith('Restoring 1 unsaved change…');
    expect(vi.mocked(formsService.applyOps).mock.calls[0]![1].txId).toBe(uid(60));
    expect(latest.canUndo).toBe(false);
    const saved = { ...baseForm(), revision: 1, fields: [{ ...baseForm().fields[0]!, label: 'Kept' }] };
    await act(async () => release({ revision: 1, form: saved, assigned: { fields: {}, variables: {} } }));
    expect(label()).toBe('Kept');
    expect(latest.status).toBe('saved');
  });

  it('never shows an older form than it already has (a response can lag the cached form)', async () => {
    let release!: (r: ApplyOpsResult) => void;
    vi.mocked(formsService.applyOps).mockImplementationOnce(() => new Promise((r) => (release = r)));
    const qc = mount();
    await screen.findByTestId('label');
    act(() => latest.apply(requiredTx(50)));
    // A collaborator's later state (revision 5, which already includes our edit) reaches the cache first.
    act(() => void qc.setQueryData(qk.forms.one(uid(900)), withRequired(5, 'Newer')));
    // Our response: committed at revision 1, form read back at revision 3.
    await act(async () => release({ revision: 1, form: withRequired(3, 'Older'), assigned: { fields: {}, variables: {} } }));
    expect(latest.form.title).toBe('Newer');
    expect(qc.getQueryData<FormDto>(qk.forms.one(uid(900)))!.title).toBe('Newer');
    // A stale refetch landing afterwards doesn't take the display back either.
    act(() => void qc.setQueryData(qk.forms.one(uid(900)), withRequired(4, 'Stale')));
    expect(latest.form.title).toBe('Newer');
  });

  it('takes the response form when it is newer than the transaction’s own revision', async () => {
    let release!: (r: ApplyOpsResult) => void;
    vi.mocked(formsService.applyOps).mockImplementationOnce(() => new Promise((r) => (release = r)));
    mount();
    await screen.findByTestId('label');
    act(() => latest.apply(requiredTx(51)));
    // Committed at revision 1, but a collaborator's revision 2 landed before the form was read back.
    await act(async () => release({ revision: 1, form: withRequired(2, 'Collaborator'), assigned: { fields: {}, variables: {} } }));
    expect(latest.form.title).toBe('Collaborator');
    expect(latest.form.fields[0]!.required).toBe(true);
  });

  it('flush waits for the queue to drain', async () => {
    let release!: (r: ApplyOpsResult) => void;
    vi.mocked(formsService.applyOps).mockImplementationOnce(() => new Promise((r) => (release = r)));
    mount();
    await screen.findByTestId('label');
    act(() => latest.apply(requiredTx(52)));
    let done = false;
    const flushed = latest.flush().then(() => (done = true));
    await act(async () => {});
    expect(done).toBe(false);
    await act(async () => release({ revision: 1, form: withRequired(1), assigned: { fields: {}, variables: {} } }));
    await flushed;
    expect(done).toBe(true);
  });

  it('flush does not report saved when the builder closes with unsaved work', async () => {
    vi.mocked(formsService.applyOps).mockImplementation(() => new Promise(() => {}));
    const qc = mount();
    await screen.findByTestId('label');
    act(() => latest.apply(requiredTx(53)));
    const flushed = latest.flush();
    qc.unmount();
    await expect(flushed).rejects.toThrow('Your changes aren’t saved yet.');
  });

  it('flush fails instead of hanging when saving has stopped', async () => {
    vi.mocked(formsService.applyOps).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'no'));
    mount();
    await screen.findByTestId('label');
    act(() => latest.apply(requiredTx(54)));
    await vi.waitFor(() => expect(latest.status).toBe('failed'));
    await expect(latest.flush()).rejects.toThrow('Your changes aren’t saved yet.');
    expect(latest.readOnly).toBe(true);
  });
});

describe('BuilderOpsProvider — fix wave', () => {
  const pendingSends = () => {
    const releases: ((r: ApplyOpsResult) => void)[] = [];
    const sent: OpTx[] = [];
    vi.mocked(formsService.applyOps).mockImplementation((_id, tx) => {
      sent.push(tx);
      return new Promise((r) => releases.push(r));
    });
    return { sent, releases };
  };
  const okResult = (revision: number, form: FormDto = baseForm()): ApplyOpsResult => ({ revision, form: { ...form, revision }, assigned: { fields: {}, variables: {} } });

  it('keeps sending queued edits after the builder closes, and updates the cached form', async () => {
    const { sent, releases } = pendingSends();
    const qc = mount();
    await screen.findByTestId('label');
    edit('B');
    act(() => latest.apply(requiredTx(61)));
    expect(sent).toHaveLength(1);
    qc.unmount();
    await act(async () => releases[0]!(okResult(1)));
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]!.txId).toBe(uid(61));
    await act(async () => releases[1]!(okResult(2, withRequired(2))));
    expect(qc.getQueryData<FormDto>(qk.forms.one(uid(900)))!.revision).toBe(2);
  });

  it('reopening the builder picks up the same queue and undo history instead of starting a second one', async () => {
    const { sent, releases } = pendingSends();
    const store = memoryStore();
    const factory = vi.fn(async () => store);
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    qc.setQueryData(qk.forms.one(uid(900)), baseForm());
    const ui = () => (
      <QueryClientProvider client={qc}>
        <BuilderOpsProvider formId={uid(900)} userId={uid(800)} storeFactory={factory}>
          <Probe />
        </BuilderOpsProvider>
      </QueryClientProvider>
    );
    const first = render(ui());
    await screen.findByTestId('label');
    edit('B');
    act(() => latest.apply(requiredTx(62)));
    first.unmount();
    render(ui());
    await screen.findByTestId('label');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(label()).toBe('B');
    expect(latest.form.fields[0]!.required).toBe(true);
    expect(latest.canUndo).toBe(true);
    expect(toast.info).not.toHaveBeenCalledWith(expect.stringMatching(/^Restoring/));
    await act(async () => releases[0]!(okResult(1, { ...baseForm(), fields: [{ ...baseForm().fields[0]!, label: 'B' }] })));
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    await act(async () => releases[1]!(okResult(2, { ...withRequired(2), fields: [{ ...withRequired(2).fields[0]!, label: 'B' }] })));
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    // Each edit went out exactly once.
    expect(sent.map((t) => t.txId)).toEqual([sent[0]!.txId, uid(62)]);
  });

  it('tells pages outside the builder that edits are still being saved, until they are', async () => {
    const { releases } = pendingSends();
    const store = memoryStore();
    const factory = async () => store;
    const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    qc.setQueryData(qk.forms.one(uid(900)), baseForm());
    function Status() {
      const bg = useBackgroundSave(uid(900), uid(800), factory);
      return <p data-testid="bg">{bg?.status ?? 'none'}</p>;
    }
    const builder = render(
      <QueryClientProvider client={qc}>
        <BuilderOpsProvider formId={uid(900)} userId={uid(800)} storeFactory={factory}>
          <Probe />
        </BuilderOpsProvider>
      </QueryClientProvider>,
    );
    await screen.findByTestId('label');
    edit('B');
    builder.unmount();
    render(<Status />);
    expect(screen.getByTestId('bg').textContent).toBe('saving');
    await act(async () => releases[0]!(okResult(1)));
    await vi.waitFor(() => expect(screen.getByTestId('bg').textContent).toBe('none'));
  });

  it('says when the server had to give a new item a different key', async () => {
    vi.mocked(formsService.applyOps).mockImplementation(async (_id, tx) => {
      const op = tx.ops[0]!;
      const form = applyTx(baseForm(), tx);
      if (op.kind !== 'create' || op.entity !== 'variable') throw new Error('unexpected');
      return { revision: 1, form: { ...form, variables: form.variables.map((v) => ({ ...v, key: 'total_2' })) }, assigned: { fields: {}, variables: { [op.snapshot.id]: 'total_2' } } };
    });
    mount();
    await screen.findByTestId('label');
    act(() => latest.apply(createVariableTx(latest.form, { key: 'total', type: 'NUMBER', initialValue: 0, formula: null }).tx));
    await vi.waitFor(() => expect(toast.info).toHaveBeenCalledWith('“total” was taken — saved as “total_2”.'));
  });

  it('points queued edits that were never sent at a key the server just assigned', async () => {
    const { sent, releases } = pendingSends();
    mount();
    await screen.findByTestId('label');
    const { tx: create, fieldId } = addFieldTx(latest.form, 'SHORT_ANSWER', Q);
    act(() => latest.apply(create));
    const ref = latest.form.fields.find((f) => f.id === fieldId)!.ref;
    act(() => latest.apply(deleteFieldTx(latest.form, fieldId)));
    const created = applyTx(baseForm(), create);
    await act(async () =>
      releases[0]!({ revision: 1, form: { ...created, revision: 1, fields: created.fields.map((f) => (f.id === fieldId ? { ...f, ref: 'q9' } : f)) }, assigned: { fields: { [fieldId]: 'q9' }, variables: {} } }),
    );
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(ref).not.toBe('q9');
    expect(sent[1]!.ops.find((op) => op.kind === 'delete')).toMatchObject({ kind: 'delete', id: fieldId, expect: { ref: 'q9' } });
  });

  it('leaves Ctrl+Z alone inside a dialog and in rich-text editors', async () => {
    fakeServer(baseForm());
    mount();
    await screen.findByTestId('label');
    edit('B');
    await vi.waitFor(() => expect(latest.status).toBe('saved'));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.append(button);
    const editor = document.createElement('div');
    Object.defineProperty(editor, 'isContentEditable', { value: true });
    document.body.append(dialog, editor);
    fireEvent.keyDown(button, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
    expect(label()).toBe('B');
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    expect(label()).toBe('A');
    dialog.remove();
    editor.remove();
  });
});

describe('BuilderOpsProvider — signing out', () => {
  it('sends nothing more once its user signs out, not even after someone else signs in; the edits stay stored', async () => {
    const store = memoryStore();
    vi.mocked(formsService.applyOps).mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'offline'));
    const qc = mount(baseForm(), store);
    await screen.findByTestId('label');
    edit('B');
    await vi.waitFor(() => expect(latest.status).toBe('offline'));
    qc.unmount();
    // Signed out during the backoff, then another account signs in in this tab.
    act(() => authStore.clear(false));
    act(() => signIn(uid(801)));
    vi.mocked(formsService.applyOps).mockImplementation(async (_id, tx) => ({ revision: 1, form: applyTx(baseForm(), tx), assigned: { fields: {}, variables: {} } }));
    await new Promise((r) => setTimeout(r, 1500)); // past the 1 s retry
    expect(formsService.applyOps).toHaveBeenCalledTimes(1);
    expect((await store.load()).map((t) => t.ops[0])).toEqual([expect.objectContaining({ changes: { label: { from: 'A', to: 'B' } } })]);
    expect(qc.getQueryData<FormDto>(qk.forms.one(uid(900)))!.revision).toBe(0);
  });

  it('ignores the answer to a request that was in flight when its user signed out', async () => {
    let release!: (r: ApplyOpsResult) => void;
    vi.mocked(formsService.applyOps).mockImplementationOnce(() => new Promise((r) => (release = r)));
    const qc = mount();
    await screen.findByTestId('label');
    edit('B');
    qc.unmount();
    act(() => authStore.clear(false));
    await act(async () => release({ revision: 1, form: { ...baseForm(), revision: 1, title: 'Late' }, assigned: { fields: { x: 'q9' }, variables: {} } }));
    expect(qc.getQueryData<FormDto>(qk.forms.one(uid(900)))!.title).toBe('T');
    expect(toast.info).not.toHaveBeenCalled();
  });
});
