import { documentExtensions, type JSONContent } from '@qub/editor-schema';
import type { PublicShareDto } from '@qub/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  ChevronRight,
  Download,
  Lock,
  Clock,
  HardDrive,
  FileText,
  Sparkles,
  ShieldCheck,
  Crown,
  Eye,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
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
    <div className="mx-auto my-6 max-w-[816px] bg-background px-6 py-10 shadow-card sm:px-[96px] sm:py-[96px] rounded-2xl">
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
    <div className="p-4 bg-background rounded-2xl shadow-card m-4">
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

// Curated high-impact background campaigns for WeTransfer advertising experience
const AD_CAMPAIGNS = [
  {
    image: '/qubsuite/ads/welcome-bg-1.png',
    fallback: '/ads/welcome-bg-1.png',
    title: 'Qubators AI Foundry',
    tagline: 'Empowering kingdom entrepreneurs to build world-changing tech innovations.',
    actionText: 'Explore Programs',
    actionHref: 'https://qubators.net',
  },
  {
    image: '/qubsuite/ads/campus-spotlight.jpg',
    fallback: '/ads/campus-spotlight.jpg',
    title: 'Next-Gen Global Builders',
    tagline: 'Join thousands of innovators transforming enterprise digital tools.',
    actionText: 'Learn More',
    actionHref: 'https://qubators.net',
  },
  {
    image: '/qubsuite/ads/aifoundryheader.jpg',
    fallback: '/ads/aifoundryheader.jpg',
    title: 'Experience QubSuite Pro',
    tagline: 'Permanent cloud storage, unlimited file sizes, and private workspaces.',
    actionText: 'Upgrade to Pro',
    actionHref: '/qubsuite/settings',
  },
];

export function PublicSharePage() {
  const { token } = useParams({ from: '/share/$token' });
  const auth = useAuth();
  const navigate = useNavigate();
  const initial = useQuery({ queryKey: ['share', token], queryFn: () => shareService.resolve(token), retry: false });
  const [unlocked, setUnlocked] = useState<PublicShareDto | null>(null);
  const [password, setPassword] = useState('');
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([]);
  const [showInlinePreview, setShowInlinePreview] = useState(false);

  const unlock = useMutation({ mutationFn: () => shareService.unlock(token, password), onSuccess: setUnlocked, meta: { silent: true } });
  const redeem = useMutation({
    mutationFn: () => shareService.redeem(token, password || undefined),
    onSuccess: (r) => void navigate({ href: openPath({ kind: r.resourceType === 'FILE' ? 'file' : 'folder', id: r.id, fileType: r.fileType, resourceId: r.resourceId }) }),
  });

  const data = unlocked ?? initial.data;
  const [openFile, setOpenFile] = useState<{ id: string; fileType: string } | null>(null);
  const currentFolder = folderStack.at(-1);
  const sub = useQuery({ queryKey: ['share', token, 'folder', currentFolder?.id], queryFn: () => shareService.folder(token, data!.accessToken!, currentFolder!.id), enabled: !!currentFolder && !!data?.accessToken });

  // Pick ad campaign deterministically based on share token
  const adIndex = (token.charCodeAt(0) || 0) % AD_CAMPAIGNS.length;
  const ad = AD_CAMPAIGNS[adIndex] ?? AD_CAMPAIGNS[0]!;

  if (initial.isLoading) return <FullPageSpinner />;
  if (initial.error) return <ErrorState error={initial.error} title="This link isn’t available" />;
  const d = data!;

  // Password gate screen
  if (d.requiresPassword) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-slate-950">
        <img
          src={ad.image}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = ad.fallback; }}
          alt="Campaign background"
          className="absolute inset-0 h-full w-full object-cover opacity-40 blur-xs"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />

        <div className="relative z-10 w-full max-w-md p-6">
          <form
            className="rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl"
            onSubmit={(e) => { e.preventDefault(); unlock.mutate(); }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400">
                <Lock className="size-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Password Protected</h2>
                <p className="text-xs text-slate-400">Enter the passphrase shared by {d.owner.name}</p>
              </div>
            </div>

            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter transfer password"
              className="mt-6 border-white/10 bg-white/5 text-white placeholder-slate-500 focus:border-blue-500"
              autoFocus
              aria-label="Password"
            />
            <FieldError message={unlock.error ? errorMessage(unlock.error) : undefined} />

            <Button
              type="submit"
              className="mt-6 w-full rounded-xl bg-blue-600 py-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-500 hover:shadow-blue-600/40"
              loading={unlock.isPending}
            >
              Access Files
            </Button>
          </form>
        </div>
      </div>
    );
  }

  const access = d.accessToken!;
  const currentFile = d.file ?? (openFile ? { id: openFile.id, fileType: openFile.fileType as any, size: d.folder?.items?.find((i) => i.id === openFile.id)?.size ?? 0, name: d.folder?.items?.find((i) => i.id === openFile.id)?.name ?? d.name } : null);
  const downloadUrl = currentFile ? shareService.downloadUrl(token, access, currentFile.id, false) : null;
  const fileName = openFile ? (d.folder?.items?.find((i) => i.id === openFile.id)?.name ?? d.name) : d.name;
  const fileSize = currentFile?.size ?? (d.folder ? d.folder.items.reduce((acc, cur) => acc + (cur.size || 0), 0) : 0);

  // Compute days remaining for WeTransfer 7-day policy
  const expiresAt = d.expiresAt || (d.file as any)?.expiresAt;
  const isPermanent = d.isPermanent;
  let expiryLabel = 'Available for 7 days';
  if (isPermanent) {
    expiryLabel = 'Permanent storage (Pro)';
  } else if (expiresAt) {
    const daysLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
    expiryLabel = daysLeft <= 1 ? 'Expires in less than 24 hours' : `Expires in ${daysLeft} days`;
  }

  const renderInlineViewer = (file: { id: string; fileType: string }) => {
    if (file.fileType === 'DOCUMENT') return <DocView token={token} access={access} fileId={file.id} />;
    if (file.fileType === 'SPREADSHEET') return <SheetView token={token} access={access} fileId={file.id} />;
    if (file.fileType === 'FORM') return <p className="p-8 text-center text-white/80">Forms are filled in through their respondent link.</p>;
    const url = shareService.downloadUrl(token, access, file.id, true);
    if (file.fileType === 'IMAGE') return <img src={url} alt="" className="mx-auto max-h-[80vh] rounded-2xl shadow-2xl p-4 object-contain" />;
    if (file.fileType === 'PDF') return <iframe src={url} title="PDF" className="h-[82vh] w-full rounded-2xl border-none shadow-2xl bg-white" />;
    if (file.fileType === 'VIDEO') return <video src={url} controls className="mx-auto max-h-[80vh] rounded-2xl shadow-2xl p-4" />;
    if (file.fileType === 'AUDIO') return <audio src={url} controls className="mx-auto mt-16 block" />;
    return null;
  };

  return (
    <div className="relative min-h-screen w-screen overflow-x-hidden bg-slate-950 font-sans text-slate-100 select-none">
      {/* 1. Large High-Resolution Still Ad Backdrop */}
      <div className="fixed inset-0 z-0">
        <img
          src={ad.image}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = ad.fallback; }}
          alt="Ad presentation backdrop"
          className="h-full w-full object-cover transition-transform duration-1000 ease-out"
        />
        {/* Soft vignette and overlay for high readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/40 to-slate-950/60 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-radial-[at_top_right] from-transparent via-slate-950/30 to-slate-950/80" />
      </div>

      {/* 2. Top Header Bar with Minimalist Brand & Auth */}
      <header className="relative z-20 flex h-20 items-center justify-between px-6 sm:px-10">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <QubLogo />
            <span className="text-xl font-bold tracking-tight text-white drop-shadow-md">Qub Transfer</span>
          </Link>
          <span className="hidden rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-md sm:inline-block">
            Fast Cloud Sharing
          </span>
        </div>

        <div className="flex items-center gap-3">
          {auth.status === 'authenticated' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => redeem.mutate()}
              loading={redeem.isPending}
              className="rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25 border border-white/20"
            >
              Open in Qub Drive
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
            >
              <Link to="/login" search={{ redirect: `/share/${token}` }}>
                Sign in
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* 3. Main Content: WeTransfer Style Layout */}
      <main className="relative z-10 flex min-h-[calc(100vh-5rem)] flex-col lg:flex-row items-center lg:items-start justify-between px-6 py-6 sm:px-12 sm:py-8 gap-8">
        {/* Left Column: WeTransfer Style Download Dialogue Card */}
        <div className="w-full max-w-[430px] shrink-0">
          <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-slate-900/85 p-7 shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:border-white/25">
            {/* Ambient decorative glow */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl" />

            {/* Top Info Badge */}
            <div className="flex items-center justify-between pb-5 border-b border-white/10">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Clock className="size-3.5 text-blue-400" />
                <span>{expiryLabel}</span>
              </div>
              {isPermanent ? (
                <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  <Crown className="size-3" /> PRO
                </span>
              ) : (
                <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                  Temporary 7d
                </span>
              )}
            </div>

            {/* File Presentation */}
            <div className="my-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white shadow-inner border border-white/10">
                  <FileIcon
                    type={d.resourceType === 'FOLDER' ? (openFile ? (openFile.fileType as any) : 'FOLDER') : (d.file?.fileType ?? 'OTHER')}
                    size={28}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-lg font-bold text-white tracking-tight" title={fileName}>
                    {fileName}
                  </h1>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span>{formatBytes(fileSize)}</span>
                    <span>•</span>
                    <span className="truncate">By {d.owner.name}</span>
                  </p>
                </div>
              </div>

              {/* Folder Breadcrumb or back button if viewing inner item */}
              {openFile && (
                <button
                  onClick={() => setOpenFile(null)}
                  className="mt-4 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Back to folder files</span>
                </button>
              )}
            </div>

            {/* Folder Items List (if folder shared and no file opened) */}
            {d.folder && !openFile && (
              <div className="mb-6 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {d.folder.items.length} files included
                </p>
                <div className="divide-y divide-white/5">
                  {d.folder.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => item.kind === 'file' && setOpenFile({ id: item.id, fileType: item.fileType })}
                      className="flex w-full items-center gap-2.5 px-2 py-2 text-left text-xs hover:bg-white/5 rounded-lg transition-colors group"
                    >
                      <FileIcon type={item.fileType} size={16} />
                      <span className="flex-1 truncate text-slate-300 group-hover:text-white">{item.name}</span>
                      <span className="text-[11px] text-slate-500">{formatBytes(item.size)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Main Action: Primary Download Button */}
            {downloadUrl ? (
              <a
                href={downloadUrl}
                download={fileName}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-xl shadow-blue-600/30 transition-all hover:bg-blue-500 hover:shadow-blue-600/50 hover:scale-[1.01] active:scale-[0.99]"
              >
                <Download className="size-5" />
                <span>Download File</span>
              </a>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={() => redeem.mutate()}
                loading={redeem.isPending}
                className="w-full rounded-2xl py-6 text-base font-semibold shadow-xl shadow-blue-600/30"
              >
                <span>Save all to Qub Drive</span>
              </Button>
            )}

            {/* Secondary actions: Inline preview toggle & Pro storage notice */}
            <div className="mt-4 flex flex-col gap-2.5">
              {currentFile && ['IMAGE', 'PDF', 'VIDEO', 'AUDIO', 'DOCUMENT', 'SPREADSHEET'].includes(currentFile.fileType) && (
                <button
                  type="button"
                  onClick={() => setShowInlinePreview(!showInlinePreview)}
                  className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <Eye className="size-3.5 text-slate-400" />
                  <span>{showInlinePreview ? 'Hide preview' : 'Preview without downloading'}</span>
                </button>
              )}

              {/* Free vs Pro Storage Clarification */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] leading-relaxed text-slate-300">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 size-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Temporary Free Cloud:</span> Free files are stored for 7 days. Need permanent storage with custom branding?{' '}
                    <Link to="/register" className="text-blue-400 underline hover:text-blue-300">
                      Get Qub Pro
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: High-Impact Billboard Ad Callout */}
        <div className="relative z-10 hidden lg:flex flex-1 flex-col items-end justify-end self-end pb-8 pr-4 max-w-xl text-right">
          <span className="rounded-full border border-white/20 bg-slate-900/60 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-md">
            Sponsored Billboard
          </span>
          <h2 className="mt-3 text-3xl xl:text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
            {ad.title}
          </h2>
          <p className="mt-2 text-sm xl:text-base text-slate-200/90 drop-shadow-md leading-relaxed">
            {ad.tagline}
          </p>
          <a
            href={ad.actionHref}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/30 hover:shadow-lg"
          >
            <span>{ad.actionText}</span>
            <ExternalLink className="size-4" />
          </a>
        </div>
      </main>

      {/* 4. Full-Screen / Modal Inline Preview Drawer (When toggled on) */}
      {showInlinePreview && currentFile && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-6">
            <div className="flex items-center gap-3">
              <FileIcon type={currentFile.fileType as any} size={20} />
              <span className="font-semibold text-white truncate max-w-md">{fileName}</span>
            </div>
            <div className="flex items-center gap-3">
              {downloadUrl && (
                <Button asChild size="sm" className="rounded-full bg-blue-600 hover:bg-blue-500">
                  <a href={downloadUrl} download={fileName}>
                    <Download className="mr-1.5 size-4" /> Download
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInlinePreview(false)}
                className="rounded-full text-slate-300 hover:text-white hover:bg-white/10"
              >
                Close preview
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            {renderInlineViewer(currentFile)}
          </div>
        </div>
      )}
    </div>
  );
}
