import { documentExtensions, type JSONContent } from '@qub/editor-schema';
import type { PublicShareDto } from '@qub/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { EditorContent, useEditor } from '@tiptap/react';
import { ChevronRight, Download, Lock } from 'lucide-react';
import { useState } from 'react';
import { FileIcon } from '@/components/file-icon';
import { QubLogo } from '@/components/logo';
import { ErrorState, FullPageSpinner } from '@/components/states';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/form-controls';
import { useAuth } from '@/hooks/use-auth';
import { errorMessage } from '@/lib/api';
import { formatBytes, formatRelative } from '@/lib/utils';
import { openPath } from '@/services/drive';
import { shareService } from '@/services/notifications';

function DocView({ token, access, fileId }: { token: string; access: string; fileId: string }) {
  const doc = useQuery({ queryKey: ['share', token, 'doc', fileId], queryFn: () => shareService.document(token, access, fileId) });
  const editor = useEditor({ extensions: documentExtensions(), content: (doc.data?.content as JSONContent) ?? undefined, editable: false, immediatelyRender: false }, [doc.data]);
  if (doc.isLoading) return <FullPageSpinner />;
  if (doc.error) return <ErrorState error={doc.error} />;
  return (
    <div className="mx-auto my-6 max-w-[816px] bg-background px-6 py-10 shadow-card sm:px-[96px] sm:py-[96px]">
      <EditorContent editor={editor} />
    </div>
  );
}

function SheetView({ token, access, fileId }: { token: string; access: string; fileId: string }) {
  const meta = useQuery({ queryKey: ['share', token, 'sheet', fileId], queryFn: () => shareService.spreadsheet(token, access, fileId) });
  const [sheetId, setSheetId] = useState<string | null>(null);
  const active = sheetId ?? meta.data?.sheets[0]?.id;
  const cells = useQuery({ queryKey: ['share', token, 'cells', active], queryFn: () => shareService.spreadsheetCells(token, access, fileId, active!), enabled: !!active });
  if (meta.isLoading) return <FullPageSpinner />;
  if (meta.error) return <ErrorState error={meta.error} />;
  const map = new Map((cells.data?.cells ?? []).map((c) => [`${c.row}:${c.col}`, c]));
  const maxRow = Math.max(20, ...(cells.data?.cells ?? []).map((c) => c.row + 2));
  const maxCol = Math.max(8, ...(cells.data?.cells ?? []).map((c) => c.col + 2));
  return (
    <div className="p-4">
      <div className="mb-2 flex gap-1" role="tablist">
        {meta.data!.sheets.map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === active} onClick={() => setSheetId(s.id)} className={`rounded px-3 py-1 text-sm ${s.id === active ? 'bg-primary-soft font-medium' : 'hover:bg-hover'}`}>
            {s.name}
          </button>
        ))}
      </div>
      <div className="overflow-auto rounded border border-border bg-background">
        <table className="border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky top-0 w-10 border border-[#c4c7c5] bg-[#f8f9fa]" />
              {Array.from({ length: maxCol }, (_, c) => (
                <th key={c} className="sticky top-0 min-w-[90px] border border-[#c4c7c5] bg-[#f8f9fa] font-normal text-muted">
                  {String.fromCharCode(65 + (c % 26))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRow }, (_, r) => (
              <tr key={r}>
                <td className="border border-[#c4c7c5] bg-[#f8f9fa] text-center text-muted">{r + 1}</td>
                {Array.from({ length: maxCol }, (_, c) => {
                  const cell = map.get(`${r}:${c}`);
                  return (
                    <td key={c} className="h-[21px] whitespace-nowrap border border-[#e2e3e3] px-1" style={{ textAlign: cell?.dataType === 'NUMBER' ? 'right' : undefined, fontWeight: cell?.style?.bold ? 600 : undefined, background: cell?.style?.background }}>
                      {cell?.formattedValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Showing the first 200 rows and 26 columns.</p>
    </div>
  );
}

export function PublicSharePage() {
  const { token } = useParams({ from: '/share/$token' });
  const auth = useAuth();
  const navigate = useNavigate();
  const initial = useQuery({ queryKey: ['share', token], queryFn: () => shareService.resolve(token), retry: false });
  const [unlocked, setUnlocked] = useState<PublicShareDto | null>(null);
  const [password, setPassword] = useState('');
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const unlock = useMutation({ mutationFn: () => shareService.unlock(token, password), onSuccess: setUnlocked, meta: { silent: true } });
  const redeem = useMutation({
    mutationFn: () => shareService.redeem(token, password || undefined),
    onSuccess: (r) => void navigate({ href: openPath({ kind: r.resourceType === 'FILE' ? 'file' : 'folder', id: r.id, fileType: r.fileType, resourceId: r.resourceId }) }),
  });
  const data = unlocked ?? initial.data;
  const [openFile, setOpenFile] = useState<{ id: string; fileType: string } | null>(null);
  const currentFolder = folderStack.at(-1);
  const sub = useQuery({ queryKey: ['share', token, 'folder', currentFolder?.id], queryFn: () => shareService.folder(token, data!.accessToken!, currentFolder!.id), enabled: !!currentFolder && !!data?.accessToken });

  if (initial.isLoading) return <FullPageSpinner />;
  if (initial.error) return <ErrorState error={initial.error} title="This link isn’t available" />;
  const d = data!;

  const header = (
    <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
      <QubLogo />
      <span className="mx-2 h-6 w-px bg-border" />
      <FileIcon type={d.resourceType === 'FOLDER' ? 'FOLDER' : (d.file?.fileType ?? 'OTHER')} size={22} />
      <h1 className="min-w-0 flex-1 truncate">{d.name}</h1>
      <span className="hidden text-sm text-muted sm:inline">Shared by {d.owner.name}</span>
      {auth.status === 'authenticated' ? (
        <Button variant="secondary" onClick={() => redeem.mutate()} loading={redeem.isPending}>
          Open in Qub
        </Button>
      ) : (
        <Button asChild variant="outline">
          <Link to="/login" search={{ redirect: `/share/${token}` }}>
            Sign in
          </Link>
        </Button>
      )}
    </header>
  );

  if (d.requiresPassword) {
    return (
      <div className="flex h-full flex-col bg-surface-2">
        {header}
        <div className="flex flex-1 items-center justify-center p-4">
          <form className="w-full max-w-sm rounded-xl bg-background p-6 shadow-card" onSubmit={(e) => { e.preventDefault(); unlock.mutate(); }}>
            <Lock className="size-8 text-muted" />
            <h2 className="mt-3 text-lg">This link is password protected</h2>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-4" autoFocus aria-label="Password" />
            <FieldError message={unlock.error ? errorMessage(unlock.error) : undefined} />
            <Button type="submit" className="mt-4 w-full" loading={unlock.isPending}>
              Open
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const access = d.accessToken!;
  const renderFile = (file: { id: string; fileType: string }) => {
    if (file.fileType === 'DOCUMENT') return <DocView token={token} access={access} fileId={file.id} />;
    if (file.fileType === 'SPREADSHEET') return <SheetView token={token} access={access} fileId={file.id} />;
    if (file.fileType === 'FORM') return <p className="p-8 text-center text-muted">Forms are filled in through their respondent link.</p>;
    const url = shareService.downloadUrl(token, access, file.id, true);
    if (file.fileType === 'IMAGE') return <img src={url} alt="" className="mx-auto max-h-[80vh] p-6" />;
    if (file.fileType === 'PDF') return <iframe src={url} title="PDF" className="h-[85vh] w-full" />;
    if (file.fileType === 'VIDEO') return <video src={url} controls className="mx-auto max-h-[80vh] p-6" />;
    if (file.fileType === 'AUDIO') return <audio src={url} controls className="mx-auto mt-10 block" />;
    return (
      <div className="p-10 text-center">
        <Button asChild>
          <a href={shareService.downloadUrl(token, access, file.id)} download>
            <Download /> Download
          </a>
        </Button>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-surface-2">
      {header}
      <main className="min-h-0 flex-1 overflow-y-auto">
        {d.file && renderFile(d.file)}
        {d.folder && (openFile ? (
          <>
            <button onClick={() => setOpenFile(null)} className="m-4 text-sm text-primary hover:underline">
              ← Back to folder
            </button>
            {renderFile(openFile)}
          </>
        ) : (
          <div className="mx-auto max-w-4xl p-4">
            <nav className="mb-3 flex items-center gap-1 text-sm" aria-label="Breadcrumb">
              <button onClick={() => setFolderStack([])} className="rounded px-2 py-1 hover:bg-hover">
                {d.name}
              </button>
              {folderStack.map((f, i) => (
                <span key={f.id} className="flex items-center">
                  <ChevronRight className="size-4 text-subtle" />
                  <button onClick={() => setFolderStack(folderStack.slice(0, i + 1))} className="rounded px-2 py-1 hover:bg-hover">
                    {f.name}
                  </button>
                </span>
              ))}
            </nav>
            <ul className="divide-y divide-border rounded-xl bg-background shadow-card">
              {(currentFolder ? sub.data?.items : d.folder.items)?.map((item) => (
                <li key={item.id}>
                  <button
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-hover"
                    onClick={() => (item.kind === 'folder' ? setFolderStack([...folderStack, { id: item.id, name: item.name }]) : setOpenFile({ id: item.id, fileType: item.fileType }))}
                  >
                    <FileIcon type={item.fileType} size={20} />
                    <span className="flex-1 truncate">{item.name}</span>
                    {item.kind === 'file' && <span className="text-xs text-muted">{formatBytes(item.size)}</span>}
                  </button>
                </li>
              ))}
              {(currentFolder ? sub.data?.items : d.folder.items)?.length === 0 && <li className="p-6 text-center text-sm text-muted">This folder is empty.</li>}
            </ul>
          </div>
        ))}
        {d.file && <p className="pb-6 text-center text-xs text-muted">Updated {formatRelative(d.file.updatedAt)}</p>}
      </main>
    </div>
  );
}
