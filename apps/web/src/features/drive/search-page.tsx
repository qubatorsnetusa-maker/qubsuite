import type { SearchResultDto } from '@qub/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { FileIcon, FILE_TYPE_LABEL } from '@/components/file-icon';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/form-controls';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { useCurrentUser } from '@/hooks/use-auth';
import { formatRelative } from '@/lib/utils';
import { driveService, openPath } from '@/services/drive';
import { qk } from '@/services/query-keys';

const MODIFIED_DAYS = { today: 1, week: 7, month: 30, year: 365 } as const;

/** Results come from the server (name trigram + document full-text); nothing is filtered in the browser. */
export function SearchPage() {
  const search = useSearch({ from: '/_authenticated/drive/search' });
  const navigate = useNavigate();
  const me = useCurrentUser();
  const params = {
    q: search.q,
    type: search.type as never,
    owner: search.owner ?? 'anyone',
    modifiedAfter: search.modified ? new Date(Date.now() - MODIFIED_DAYS[search.modified] * 86400000) : undefined,
  };
  const q = useInfiniteQuery({
    queryKey: qk.drive.search({ ...params, modifiedAfter: search.modified }),
    queryFn: ({ pageParam, signal }) => driveService.search({ ...params, cursor: pageParam, limit: 50 }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const set = (patch: Record<string, string | undefined>) => void navigate({ to: '/drive/search', search: { ...search, ...patch }, replace: true });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const open = (r: SearchResultDto) => void navigate({ href: openPath({ kind: r.kind, id: r.id, fileType: r.fileType, resourceId: r.resourceId }) });

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        <h1 className="text-[22px]">{search.q ? <>Search results for “{search.q}”</> : 'Search'}</h1>
        <div className="flex flex-wrap gap-2 py-3" role="group" aria-label="Filters">
          <NativeSelect aria-label="Type" value={search.type ?? ''} onChange={(e) => set({ type: e.target.value || undefined })}>
            <option value="">Any type</option>
            {(['FOLDER', 'DOCUMENT', 'SPREADSHEET', 'FORM', 'PDF', 'IMAGE', 'VIDEO', 'AUDIO', 'TEXT', 'ARCHIVE'] as const).map((t) => (
              <option key={t} value={t}>
                {FILE_TYPE_LABEL[t]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Owner" value={search.owner ?? 'anyone'} onChange={(e) => set({ owner: e.target.value })}>
            <option value="anyone">Owned by anyone</option>
            <option value="me">Owned by me</option>
            <option value="not_me">Not owned by me</option>
          </NativeSelect>
          <NativeSelect aria-label="Modified" value={search.modified ?? ''} onChange={(e) => set({ modified: e.target.value || undefined })}>
            <option value="">Any time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="year">This year</option>
          </NativeSelect>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {q.error ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Search />} title="No results" description="Try different keywords or remove filters." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="h-12 border-b border-border text-left font-medium">
                <th className="pl-3 font-medium">Name</th>
                <th className="hidden font-medium md:table-cell">Owner</th>
                <th className="hidden font-medium lg:table-cell">Location</th>
                <th className="font-medium">Modified</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className="h-12 cursor-pointer border-b border-border hover:bg-hover" onClick={() => open(r)} onKeyDown={(e) => e.key === 'Enter' && open(r)} tabIndex={0}>
                  <td className="pl-3">
                    <span className="flex items-center gap-3">
                      <FileIcon type={r.fileType} size={22} />
                      <span className="truncate">{r.name}</span>
                      <span className="sr-only">{FILE_TYPE_LABEL[r.fileType]}</span>
                    </span>
                  </td>
                  <td className="hidden md:table-cell">
                    <span className="flex items-center gap-2 text-muted">
                      <Avatar user={r.owner} size={24} /> {r.owner.id === me.id ? 'me' : r.owner.name}
                    </span>
                  </td>
                  <td className="hidden text-muted lg:table-cell">{r.location?.name ?? '—'}</td>
                  <td className="text-muted">{formatRelative(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.hasNextPage && (
          <div className="py-4 text-center">
            <Button variant="outline" onClick={() => void q.fetchNextPage()} loading={q.isFetchingNextPage}>
              Load more results
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
