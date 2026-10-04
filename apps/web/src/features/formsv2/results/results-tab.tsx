import type { FormDto, FormFieldDto, FormResponseDto } from '@qub/shared';
import { QUESTION_TYPES } from '@qub/shared/forms';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Inbox, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/form-controls';
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { formatDate } from '@/lib/utils';
import { formsService } from '@/services/forms';
import { qk } from '@/services/query-keys';
import { useFormV2 } from '../layout/use-form-v2';
import { BarList, Distribution, percent } from './charts';
import { displayValue, summarizeField, type FieldSummary } from './summarize';

/** Questions shown as columns in the responses table (after "Submitted"). */
const TABLE_QUESTIONS = 3;

/**
 * Results tab: a Summary of every input question and a searchable Responses table with a side panel per response.
 * Data comes from the same responses query (key, service call, cursor paging) as the classic responses page; every
 * page is fetched so the summaries cover all responses. The frame's `useFormRoom` invalidates `['forms', id]` on a
 * new `response` message, which refetches this query, so the tab stays live.
 *
 * Completion rate and average completion time are not shown: the response DTO carries no start time or partial
 * responses to derive them from.
 */
export function ResultsTab() {
  const { form, canEdit } = useFormV2();
  const q = useInfiniteQuery({
    queryKey: qk.forms.responses(form.id),
    queryFn: ({ pageParam }) => formsService.responses(form.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = q;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const total = q.data?.pages[0]?.total ?? 0;
  const questions = useMemo(() => form.fields.filter((f) => QUESTION_TYPES[f.type]?.isInput), [form.fields]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">Results</h2>
        <Button asChild variant="outline" size="sm">
          <a href={formsService.exportUrl(form.id)} download>
            <Download /> Export CSV
          </a>
        </Button>
      </div>

      {q.isLoading && <Skeleton className="h-64 rounded-lg" />}
      {q.isError && !q.data && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && total === 0 && (
        <div className="rounded-lg bg-background shadow-card">
          <EmptyState icon={<Inbox />} title="Waiting for responses" description={form.isPublished ? 'Share the form link to start collecting responses.' : 'Publish the form to start collecting responses.'} />
        </div>
      )}
      {q.data && total > 0 && (
        <Tabs defaultValue="summary">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="responses">Responses</TabsTrigger>
          </TabsList>
          {items.length < total && (
            <p className="mt-3 flex items-center gap-2 text-xs text-muted" role="status">
              {q.isError ? `Showing ${items.length} of ${total} responses — the rest couldn’t be loaded.` : `Loading responses… ${items.length} of ${total}`}
              {q.isError && (
                <Button variant="link" size="sm" className="h-auto text-xs" onClick={() => void (hasNextPage ? fetchNextPage() : q.refetch())}>
                  Retry
                </Button>
              )}
            </p>
          )}
          <TabsContent value="summary" className="mt-4">
            <Summary questions={questions} items={items} total={total} />
          </TabsContent>
          <TabsContent value="responses" className="mt-4">
            <Responses form={form} questions={questions} items={items} canEdit={canEdit} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/** The value each response gave for `fieldId` (undefined when it has no answer), newest response first. */
const answersFor = (items: FormResponseDto[], fieldId: string) => items.map((r) => r.answers.find((a) => a.fieldId === fieldId)?.value);

function Summary({ questions, items, total }: { questions: FormFieldDto[]; items: FormResponseDto[]; total: number }) {
  const latest = items[0]?.submittedAt;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Responses', total.toLocaleString()],
          ['Latest response', latest ? formatDate(latest, true) : '—'],
        ].map(([k, v]) => (
          <div key={k} role="group" aria-label={k} className="rounded-lg bg-background p-3 shadow-card">
            <div className="text-xs text-muted">{k}</div>
            <div className="mt-1 text-lg font-medium">{v}</div>
          </div>
        ))}
      </div>
      {questions.map((f) => (
        <QuestionCard key={f.id} field={f} summary={summarizeField(f, answersFor(items, f.id))} />
      ))}
    </div>
  );
}

function QuestionCard({ field, summary: s }: { field: FormFieldDto; summary: FieldSummary }) {
  const title = field.label || 'Untitled question';
  const skipped = s.total - s.answered;
  return (
    <section className="rounded-lg bg-background p-5 shadow-card" aria-label={title}>
      <h3 className="font-medium">{title}</h3>
      <p className="text-xs text-muted">
        {s.answered} answered{skipped > 0 && ` · ${skipped} skipped`}
      </p>
      <div className="mt-4">
        {s.kind === 'choice' && (
          <BarList
            label={`Answers to ${title}`}
            of={s.answered}
            rows={[...s.options.map((o) => ({ key: o.id, label: o.label, count: o.count })), ...(s.other > 0 ? [{ key: '__other', label: 'Other', count: s.other }] : [])]}
          />
        )}
        {s.kind === 'numeric' && (
          <div className="space-y-4">
            <dl className="flex gap-8 text-sm">
              {(
                [
                  ['Average', s.average],
                  ['Lowest', s.min],
                  ['Highest', s.max],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="text-lg tabular-nums">{v === null ? '—' : k === 'Average' ? v.toFixed(1) : String(v)}</dd>
                </div>
              ))}
            </dl>
            <Distribution buckets={s.buckets} label={`Distribution of answers to ${title}`} />
          </div>
        )}
        {s.kind === 'nps' && (
          <div className="space-y-4">
            <p className="text-sm">
              NPS <strong className="text-2xl tabular-nums">{s.score ?? '—'}</strong>
              <span className="ml-3 text-muted">
                {s.promoters} promoters ({percent(s.promoters, s.answered)}%) · {s.passives} passives ({percent(s.passives, s.answered)}%) · {s.detractors} detractors (
                {percent(s.detractors, s.answered)}%)
              </span>
            </p>
            <Distribution buckets={s.buckets} label={`Distribution of answers to ${title}`} />
          </div>
        )}
        {s.kind === 'text' &&
          (s.latest.length ? (
            <ul className="space-y-1" aria-label={`Latest answers to ${title}`}>
              {s.latest.map((t, i) => (
                <li key={i} className="whitespace-pre-wrap rounded bg-surface px-3 py-2 text-sm">
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No answers yet.</p>
          ))}
        {s.kind === 'other' && <p className="text-sm text-muted">See individual responses for these answers.</p>}
      </div>
    </section>
  );
}

function Responses({ form, questions, items, canEdit }: { form: FormDto; questions: FormFieldDto[]; items: FormResponseDto[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<FormResponseDto | null>(null);
  const open = openId ? (items.find((r) => r.id === openId) ?? null) : null;
  const columns = questions.slice(0, TABLE_QUESTIONS);

  // Same call and refresh as the classic responses page.
  const remove = useMutation({
    mutationFn: (r: FormResponseDto) => formsService.deleteResponse(form.id, r.id),
    onSuccess: () => {
      setConfirm(null);
      setOpenId(null);
      void qc.invalidateQueries({ queryKey: ['forms', form.id] });
    },
  });

  // Every answer rendered as text once per response list, so typing in the search box stays cheap.
  const haystacks = useMemo(() => {
    const byId = new Map(questions.map((f) => [f.id, f]));
    return new Map(
      items.map((r) => {
        const parts = r.answers.map((a) => {
          const f = byId.get(a.fieldId);
          return f ? displayValue(f, a.value) : '';
        });
        return [r.id, [...parts, r.email ?? '', r.respondent?.name ?? ''].join('\n').toLowerCase()];
      }),
    );
  }, [items, questions]);
  const needle = search.trim().toLowerCase();
  const rows = needle ? items.filter((r) => haystacks.get(r.id)?.includes(needle)) : items;

  const cell = (r: FormResponseDto, f: FormFieldDto) => {
    const a = r.answers.find((x) => x.fieldId === f.id);
    return a ? displayValue(f, a.value) : '';
  };

  return (
    <div className="space-y-3">
      <Input type="search" aria-label="Search responses" placeholder="Search responses" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
      <div className="overflow-x-auto rounded-lg bg-background shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Submitted</th>
              {columns.map((f) => (
                <th key={f.id} className="max-w-[16rem] truncate px-4 py-2 font-medium">
                  {f.label || 'Untitled question'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer border-b border-border last:border-0 hover:bg-hover" onClick={() => setOpenId(r.id)}>
                <td className="whitespace-nowrap px-4 py-2">
                  <button type="button" className="text-left hover:underline" aria-label={`Open response from ${formatDate(r.submittedAt, true)}`} onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(r.id);
                    }}
                  >
                    {formatDate(r.submittedAt, true)}
                  </button>
                </td>
                {columns.map((f) => (
                  <td key={f.id} className="max-w-[16rem] truncate px-4 py-2">
                    {cell(r, f)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-muted">No responses match your search.</p>}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        {open && (
          <DialogContent
            title="Response"
            description={`${formatDate(open.submittedAt, true)} · ${open.respondent?.name ?? open.email ?? 'Anonymous'}`}
            className="left-auto right-0 top-0 h-full max-h-none max-w-md translate-x-0 translate-y-0 rounded-none"
          >
            <ResponseDetail form={form} questions={questions} response={open} />
            {canEdit && (
              <Button variant="outline" className="mt-6" onClick={() => setConfirm(open)}>
                <Trash2 /> Delete response
              </Button>
            )}
          </DialogContent>
        )}
      </Dialog>
      <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} title="Delete this response?" description="This can’t be undone." confirmLabel="Delete" destructive loading={remove.isPending} onConfirm={() => confirm && remove.mutate(confirm)} />
    </div>
  );
}

/** Every answer of one response, as the classic page's individual view shows them (files as download links). */
function ResponseDetail({ form, questions, response: r }: { form: FormDto; questions: FormFieldDto[]; response: FormResponseDto }) {
  return (
    <div className="space-y-4">
      {(r.score !== null || Object.keys(r.computed ?? {}).length > 0) && (
        <div className="rounded bg-surface p-3 text-sm">
          {r.score !== null && (
            <p>
              Score: <strong>{r.score}</strong>
            </p>
          )}
          {Object.entries(r.computed ?? {}).map(([k, v]) => (
            <p key={k} className="text-muted">
              {`{{${k}}}`} = <span className="text-foreground">{v === null ? '—' : String(v)}</span>
            </p>
          ))}
        </div>
      )}
      <dl className="space-y-4">
        {questions.map((f) => {
          const a = r.answers.find((x) => x.fieldId === f.id);
          const text = a ? displayValue(f, a.value) : '';
          return (
            <div key={f.id}>
              <dt className="text-sm font-medium">{f.label || 'Untitled question'}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm">
                {a?.files?.length ? (
                  <ul className="space-y-1">
                    {a.files.map((file) => (
                      <li key={file.id}>
                        <a className="text-primary hover:underline" href={formsService.uploadUrl(form.id, file.id)} download>
                          {file.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : text ? (
                  text
                ) : (
                  <span className="text-muted">No answer</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
