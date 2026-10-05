import { authStore } from '@/lib/auth-store';
import type { FieldAnalyticsDto, FormDto, FormResponseDto } from '@qub/shared';
import { displayAnswer, QUESTION_TYPES } from '@qub/shared/forms';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Download, Inbox, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, ErrorState, FullPageSpinner } from '@/components/states';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { NativeSelect, Switch } from '@/components/ui/form-controls';
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useCurrentUser } from '@/hooks/use-auth';
import { formatDate } from '@/lib/utils';
import { formsService } from '@/services/forms';
import { qk } from '@/services/query-keys';
import { FormTopBar } from './builder-page';
import { useBackgroundSave } from './builder/ops/builder-ops';

const PALETTE = ['#4285f4', '#db4437', '#f4b400', '#0f9d58', '#ab47bc', '#00acc1', '#ff7043', '#9e9d24'];

export function ResponsesPage() {
  const { formId } = useParams({ from: '/_authenticated/forms/$formId/responses' });
  const form = useQuery({ queryKey: qk.forms.one(formId), queryFn: () => formsService.get(formId) });
  if (form.isLoading) return <FullPageSpinner />;
  if (form.error) return <ErrorState error={form.error} />;
  return <Responses form={form.data!} />;
}

function Responses({ form }: { form: FormDto }) {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const analytics = useQuery({ queryKey: qk.forms.analytics(form.id, days), queryFn: () => formsService.analytics(form.id, days) });
  const accepting = useMutation({ mutationFn: (v: boolean) => formsService.update(form.id, { acceptingResponses: v }), onSuccess: (f) => qc.setQueryData(qk.forms.one(form.id), f) });
  const a = analytics.data;
  // Edits made in the builder may still be on their way (they keep saving after leaving it).
  const me = useCurrentUser();
  const saving = useBackgroundSave(form.id, me.id);
  return (
    <div className="flex h-full flex-col" style={{ background: form.theme.backgroundColor }}>
      <FormTopBar form={form} tab="responses" status={saving?.status ?? 'saved'} onRetry={saving?.retry} />
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-[768px] space-y-3">
          <section className="rounded-lg bg-background p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl">{a ? `${a.totalResponses} response${a.totalResponses === 1 ? '' : 's'}` : 'Responses'}</h1>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const token = await authStore.validToken();
                      const res = await fetch(formsService.exportUrl(form.id), {
                        credentials: 'include',
                        headers: token ? { Authorization: `Bearer ${token}`} : {},
                      });
                      if (!res.ok) throw new Error('Export failed');
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${form.title || 'form'} (responses).csv`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch (err) {
                      console.error('Export error:', err);
                    }
                  }}
                >
                  <Download /> Export CSV
                </Button>
                <label className="flex items-center gap-2 text-sm">
                  Accepting responses <Switch checked={form.acceptingResponses} onCheckedChange={(v) => accepting.mutate(v)} disabled={!form.capabilities.canEdit} />
                </label>
              </div>
            </div>
            {a && (
              <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ['Responses', a.totalResponses.toLocaleString()],
                  ['Views', a.views.toLocaleString()],
                  ['Response rate', a.responseRate === null ? '—' : `${Math.round(a.responseRate * 100)}%`],
                  ['Latest', a.lastResponseAt ? formatDate(a.lastResponseAt, true) : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-surface p-3">
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="mt-1 text-lg font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <Tabs defaultValue="summary">
            <TabsList className="rounded-lg bg-background px-2 shadow-card">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="individual">Individual</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="mt-3 space-y-3">
              {analytics.isLoading && <Skeleton className="h-64 rounded-lg" />}
              {analytics.error && <ErrorState error={analytics.error} onRetry={() => void analytics.refetch()} />}
              {a && a.totalResponses === 0 && (
                <div className="rounded-lg bg-background shadow-card">
                  <EmptyState icon={<Inbox />} title="Waiting for responses" description={form.isPublished ? 'Share the form link to start collecting responses.' : 'Publish the form to start collecting responses.'} />
                </div>
              )}
              {a && a.totalResponses > 0 && (
                <>
                  <section className="rounded-lg bg-background p-6 shadow-card">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="font-medium">Responses over time</h2>
                      <NativeSelect value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Time range">
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                        <option value={365}>Last year</option>
                      </NativeSelect>
                    </div>
                    <div className="h-56" role="img" aria-label="Line chart of responses per day">
                      <ResponsiveContainer>
                        <LineChart data={a.trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                          <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} fontSize={11} />
                          <YAxis allowDecimals={false} fontSize={11} width={30} />
                          <ChartTooltip />
                          <Line type="monotone" dataKey="count" stroke={form.theme.primaryColor} strokeWidth={2} dot={false} name="Responses" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                  {a.fields.map((f) => (
                    <FieldSummary key={f.fieldId} f={f} color={form.theme.primaryColor} />
                  ))}
                </>
              )}
            </TabsContent>
            <TabsContent value="individual" className="mt-3">
              <Individual form={form} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function FieldSummary({ f, color }: { f: FieldAnalyticsDto; color: string }) {
  const kind = QUESTION_TYPES[f.type].analyticsKind;
  const pie = kind === 'choice' || kind === 'boolean';
  const horizontal = kind === 'multi';
  return (
    <section className="rounded-lg bg-background p-6 shadow-card">
      <h3 className="font-medium">{f.label || 'Untitled question'}</h3>
      <p className="text-xs text-muted">
        {f.answered} response{f.answered === 1 ? '' : 's'}
        {f.skipped > 0 && ` · ${f.skipped} skipped`}
      </p>
      {f.numeric && (
        <dl className="mt-4 flex flex-wrap gap-6 text-sm">
          {(['average', 'median', 'min', 'max'] as const).map((k) => (
            <div key={k}>
              <dt className="text-xs capitalize text-muted">{k}</dt>
              <dd className="text-lg">{f.numeric![k] ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}
      {f.distribution && f.distribution.length > 0 && (
        <div className="mt-4 grid items-center gap-4 sm:grid-cols-2">
          <div className="h-56" role="img" aria-label={`Chart of answers to ${f.label}`}>
            <ResponsiveContainer>
              {pie ? (
                <PieChart>
                  <Pie data={f.distribution} dataKey="count" nameKey="label" innerRadius={45} outerRadius={85} paddingAngle={1}>
                    {f.distribution.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              ) : (
                <BarChart data={f.distribution} layout={horizontal ? 'vertical' : 'horizontal'}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  {horizontal ? (
                    <>
                      <XAxis type="number" allowDecimals={false} fontSize={11} />
                      <YAxis type="category" dataKey="label" width={90} fontSize={11} />
                    </>
                  ) : (
                    <>
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis allowDecimals={false} fontSize={11} width={30} />
                    </>
                  )}
                  <ChartTooltip />
                  <Bar dataKey="count" fill={color} name="Responses" radius={3} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <table className="text-sm">
            <tbody>
              {f.distribution.map((d, i) => (
                <tr key={d.key}>
                  <td className="py-1 pr-2">
                    <span className="mr-2 inline-block size-3 rounded-sm align-middle" style={{ background: pie ? PALETTE[i % PALETTE.length] : color }} />
                    {d.label}
                  </td>
                  <td className="py-1 text-right tabular-nums">{d.count}</td>
                  <td className="py-1 pl-3 text-right tabular-nums text-muted">{d.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {f.nps && (
        <p className="mt-4 text-sm">
          NPS <strong className="text-lg">{f.nps.score}</strong>
          <span className="ml-3 text-muted">
            {f.nps.promoters} promoters · {f.nps.passives} passives · {f.nps.detractors} detractors
          </span>
        </p>
      )}
      {f.matrix && (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr>
              <th />
              {f.matrix[0]?.distribution.map((c) => <th key={c.key} className="px-2 py-1 font-normal text-muted">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {f.matrix.map((row) => (
              <tr key={row.rowId}>
                <th scope="row" className="py-1 pr-2 text-left font-normal">{row.label}</th>
                {row.distribution.map((c) => <td key={c.key} className="px-2 py-1 text-center tabular-nums">{c.count} <span className="text-xs text-muted">({c.percentage}%)</span></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {f.ranking && (
        <ol className="mt-4 space-y-1 text-sm">
          {f.ranking.map((r) => (
            <li key={r.key} className="flex justify-between rounded bg-surface px-3 py-1.5">
              {r.label} <span className="tabular-nums text-muted">avg. rank {r.averageRank || '—'}</span>
            </li>
          ))}
        </ol>
      )}
      {f.samples && (
        <ul className="mt-4 max-h-60 space-y-1 overflow-y-auto">
          {f.samples.map((s, i) => (
            <li key={i} className="rounded bg-surface px-3 py-2 text-sm">
              {s}
            </li>
          ))}
          {f.samples.length === 0 && <li className="text-sm text-muted">No answers yet.</li>}
        </ul>
      )}
    </section>
  );
}

function Individual({ form }: { form: FormDto }) {
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: qk.forms.responses(form.id),
    queryFn: ({ pageParam }) => formsService.responses(form.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const [index, setIndex] = useState(0);
  const [confirm, setConfirm] = useState<FormResponseDto | null>(null);
  const remove = useMutation({
    mutationFn: (r: FormResponseDto) => formsService.deleteResponse(form.id, r.id),
    onSuccess: () => {
      setConfirm(null);
      void qc.invalidateQueries({ queryKey: ['forms', form.id] });
    },
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  const r = items[index];
  if (q.isLoading) return <Skeleton className="h-64 rounded-lg" />;
  if (!r) return <div className="rounded-lg bg-background p-8 text-center text-sm text-muted shadow-card">No responses yet.</div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg bg-background px-4 py-2 shadow-card">
        <div className="flex items-center gap-1">
          <Button variant="subtle" size="icon-sm" disabled={index === 0} onClick={() => setIndex(index - 1)} aria-label="Previous response">
            <ChevronLeft />
          </Button>
          <span className="text-sm">
            {index + 1} of {total}
          </span>
          <Button
            variant="subtle"
            size="icon-sm"
            disabled={index >= total - 1}
            onClick={async () => {
              if (index + 1 >= items.length && q.hasNextPage) await q.fetchNextPage();
              setIndex(index + 1);
            }}
            aria-label="Next response"
          >
            <ChevronRight />
          </Button>
        </div>
        <span className="text-xs text-muted">
          {formatDate(r.submittedAt, true)} · {r.respondent?.name ?? r.email ?? 'Anonymous'}
        </span>
        {form.capabilities.canEdit && (
          <Button variant="subtle" size="icon-sm" onClick={() => setConfirm(r)} aria-label="Delete response">
            <Trash2 />
          </Button>
        )}
      </div>
      {(r.score !== null || Object.keys(r.computed).length > 0) && (
        <section className="rounded-lg bg-background p-5 text-sm shadow-card">
          {r.score !== null && <p>Score: <strong>{r.score}</strong></p>}
          {Object.entries(r.computed).map(([k, v]) => (
            <p key={k} className="text-muted">{`{{${k}}}`} = <span className="text-foreground">{v === null ? '—' : String(v)}</span></p>
          ))}
        </section>
      )}
      {form.fields
        .filter((f) => QUESTION_TYPES[f.type].isInput)
        .map((f) => {
          const ans = r.answers.find((x) => x.fieldId === f.id);
          return (
            <section key={f.id} className="rounded-lg bg-background p-5 shadow-card">
              <h3 className="text-sm font-medium">{f.label}</h3>
              {ans?.files ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {ans.files.map((file) => (
                    <li key={file.id}>
                      <a className="text-primary hover:underline" href={formsService.uploadUrl(form.id, file.id)} download>
                        {file.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm">{ans ? displayAnswer(f, ans.value) : <span className="text-muted">No answer</span>}</p>
              )}
            </section>
          );
        })}
      <ConfirmDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} title="Delete this response?" description="This can’t be undone." confirmLabel="Delete" destructive loading={remove.isPending} onConfirm={() => confirm && remove.mutate(confirm)} />
    </div>
  );
}
