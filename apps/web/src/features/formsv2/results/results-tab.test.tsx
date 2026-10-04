import type { FormDto, FormResponseDto } from '@qub/shared';
import { DEFAULT_FORM_SETTINGS } from '@qub/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithOps } from '@/features/forms/builder/ops/test-utils';
import { formsService } from '@/services/forms';
import { ResultsTab } from './results-tab';

vi.mock('@/services/forms', () => ({
  formsService: {
    responses: vi.fn(),
    deleteResponse: vi.fn(),
    exportUrl: (id: string) => `/api/forms/${id}/responses/export`,
    uploadUrl: (id: string, fileId: string) => `/api/forms/${id}/uploads/${fileId}`,
  },
}));

beforeEach(() => vi.clearAllMocks());

const FORM_ID = '00000000-0000-4000-8000-000000000900';
const opt = (id: string, label: string) => ({ id, label, kind: 'option', value: null, imageUrl: null, position: 0 });
const base = { description: null, required: false, validation: {}, settings: {}, options: [], rules: [], scoreConfig: null, placeholder: null, defaultValue: null };
const fields = [
  { ...base, id: 'f-welcome', ref: 'welcome', type: 'WELCOME', label: 'Hello there', position: 0 },
  { ...base, id: 'f-colour', ref: 'colour', type: 'MULTIPLE_CHOICE', label: 'Favourite colour', position: 1, options: [opt('red', 'Red'), opt('blue', 'Blue')] },
  { ...base, id: 'f-rating', ref: 'rating', type: 'RATING', label: 'How was it', position: 2, settings: { scaleMax: 5 } },
  { ...base, id: 'f-why', ref: 'why', type: 'SHORT_ANSWER', label: 'Why', position: 3 },
];

function makeForm(capabilities: Partial<FormDto['capabilities']> = { canEdit: true }): FormDto {
  return {
    id: FORM_ID,
    fileId: 'file1',
    publicId: 'pub',
    title: 'Survey',
    revision: 0,
    isPublished: true,
    isTrashed: false,
    acceptingResponses: true,
    settings: { ...DEFAULT_FORM_SETTINGS },
    variables: [],
    fields,
    theme: { primaryColor: '#673ab7' },
    capabilities,
  } as unknown as FormDto;
}

const response = (id: string, submittedAt: string, answers: Record<string, unknown>): FormResponseDto => ({
  id,
  respondent: null,
  email: null,
  submittedAt,
  answers: Object.entries(answers).map(([fieldId, value]) => ({ fieldId, value })) as FormResponseDto['answers'],
  score: null,
  computed: {},
  endingId: null,
});

const R1 = response('r1', '2026-09-28T10:00:00Z', { 'f-colour': 'red', 'f-rating': 5, 'f-why': 'Loved the coffee' });
const R2 = response('r2', '2026-09-27T10:00:00Z', { 'f-colour': 'red', 'f-rating': 3, 'f-why': 'Too slow' });
const R3 = response('r3', '2026-09-26T10:00:00Z', { 'f-colour': 'blue', 'f-rating': { junk: true }, 'f-why': '' });

/** Renders the tab under a query client without retries (the inner provider wins over renderWithOps' default one). */
function renderTab(form: FormDto) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderWithOps(
    <QueryClientProvider client={qc}>
      <ResultsTab />
    </QueryClientProvider>,
    { form },
  );
}

/** Two pages, so the tab has to follow the cursor to summarise every response. */
function mockPages() {
  vi.mocked(formsService.responses).mockImplementation(async (_id, cursor) =>
    cursor ? { items: [R3], nextCursor: null, total: 3 } : { items: [R1, R2], nextCursor: 'c2', total: 3 },
  );
}

describe('ResultsTab — summary', () => {
  it('loads every page and shows the response count and per-question summaries', async () => {
    mockPages();
    renderTab(makeForm());
    const colour = await screen.findByRole('list', { name: 'Answers to Favourite colour' });
    expect(formsService.responses).toHaveBeenCalledWith(FORM_ID, 'c2');
    expect(within(screen.getByRole('group', { name: 'Responses' })).getByText('3')).toBeInTheDocument();
    expect(within(colour).getByText('Red').closest('li')).toHaveTextContent('2 · 67%');
    expect(within(colour).getByText('Blue').closest('li')).toHaveTextContent('1 · 33%');
    // The malformed rating is left out: average of 5 and 3.
    expect(screen.getByText('Average')).toBeInTheDocument();
    expect(screen.getByText('4.0')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: '5: 1' })).toBeInTheDocument();
    expect(screen.getByText('Loved the coffee')).toBeInTheDocument();
    // Only input questions get a card.
    expect(screen.queryByText('Hello there')).not.toBeInTheDocument();
  });

  it('links Export CSV to the existing export endpoint', async () => {
    mockPages();
    renderTab(makeForm());
    expect(screen.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('href', `/api/forms/${FORM_ID}/responses/export`);
  });

  it('shows a waiting state when there are no responses', async () => {
    vi.mocked(formsService.responses).mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    renderTab(makeForm());
    expect(await screen.findByText('Waiting for responses')).toBeInTheDocument();
  });

  it('shows an error with a retry action when responses fail to load', async () => {
    vi.mocked(formsService.responses).mockRejectedValue(new Error('boom'));
    renderTab(makeForm());
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('when a later page fails, says so and Retry loads the rest', async () => {
    let failSecond = true;
    vi.mocked(formsService.responses).mockImplementation(async (_id, cursor) => {
      if (!cursor) return { items: [R1, R2], nextCursor: 'c2', total: 3 };
      if (failSecond) throw new Error('boom');
      return { items: [R3], nextCursor: null, total: 3 };
    });
    const user = userEvent.setup();
    renderTab(makeForm());
    expect(await screen.findByText(/Showing 2 of 3 responses/)).toBeInTheDocument();
    const colour = screen.getByRole('list', { name: 'Answers to Favourite colour' });
    expect(within(colour).getByText('Blue').closest('li')).toHaveTextContent('0 · 0%');
    failSecond = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText(/Showing 2 of 3 responses/)).not.toBeInTheDocument());
    expect(within(screen.getByRole('list', { name: 'Answers to Favourite colour' })).getByText('Blue').closest('li')).toHaveTextContent('1 · 33%');
  });
});

describe('ResultsTab — responses', () => {
  async function openResponses() {
    mockPages();
    const user = userEvent.setup();
    renderTab(makeForm());
    await screen.findByRole('list', { name: 'Answers to Favourite colour' });
    await user.click(screen.getByRole('tab', { name: 'Responses' }));
    return user;
  }

  it('lists one row per response with the first questions as columns', async () => {
    await openResponses();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Favourite colour' })).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(4); // header + 3
    expect(within(table).getByText('Too slow')).toBeInTheDocument();
  });

  it('search filters rows on any answer text, including option labels', async () => {
    const user = await openResponses();
    await user.type(screen.getByRole('searchbox', { name: 'Search responses' }), 'blue');
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent('Blue');
    await user.clear(screen.getByRole('searchbox', { name: 'Search responses' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search responses' }), 'nothing matches');
    expect(screen.getByText('No responses match your search.')).toBeInTheDocument();
  });

  it('opening a row shows every answer in a side panel, and deleting it confirms then calls the service', async () => {
    vi.mocked(formsService.deleteResponse).mockResolvedValue(undefined);
    const user = await openResponses();
    await user.click(screen.getAllByRole('button', { name: /Open response from/ })[1]!);
    const panel = screen.getByRole('dialog', { name: 'Response' });
    expect(within(panel).getByText('Why')).toBeInTheDocument();
    expect(within(panel).getByText('Too slow')).toBeInTheDocument();
    expect(within(panel).getByText('Red')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Delete response' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Delete this response?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(formsService.deleteResponse).toHaveBeenCalledWith(FORM_ID, 'r2'));
  });

  it('viewers cannot delete responses', async () => {
    mockPages();
    const user = userEvent.setup();
    renderTab(makeForm({ canEdit: false }));
    await screen.findByRole('list', { name: 'Answers to Favourite colour' });
    await user.click(screen.getByRole('tab', { name: 'Responses' }));
    await user.click(screen.getAllByRole('button', { name: /Open response from/ })[0]!);
    expect(within(screen.getByRole('dialog', { name: 'Response' })).queryByRole('button', { name: 'Delete response' })).not.toBeInTheDocument();
  });
});
