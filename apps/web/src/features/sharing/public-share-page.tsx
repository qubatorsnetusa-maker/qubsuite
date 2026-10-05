import { documentExtensions, type JSONContent } from '@qub/editor-schema';
import type { PublicShareDto } from '@qub/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  ChevronRight,
  Download,
  Lock,
  Eye,
  Shield,
  ArrowUpRight,
  FileText,
  ChevronLeft,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { FileIcon } from '@/components/file-icon';
import { ErrorState, FullPageSpinner } from '@/components/states';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/form-controls';
import { useAuth } from '@/hooks/use-auth';
import { errorMessage } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import { openPath } from '@/services/drive';
import { shareService } from '@/services/notifications';

function DocView({ token, access, fileId }: { token: string; access: string; fileId: string }) {
  const doc = useQuery({ queryKey: ['share', token, 'doc', fileId], queryFn: () => shareService.document(token, access, fileId) });
  const editor = useEditor({ extensions: documentExtensions(), content: (doc.data?.content as JSONContent) ?? undefined, editable: false, immediatelyRender: false }, [doc.data]);
  if (doc.isLoading) return <FullPageSpinner />;
  if (doc.error) return <ErrorState error={doc.error} />;
  return (
    <div className="mx-auto my-6 max-w-[816px] rounded-2xl bg-white px-6 py-10 shadow-2xl sm:px-[96px] sm:py-[96px]">
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
    <div className="m-4 rounded-2xl bg-white p-4 shadow-2xl">
      <div className="mb-2 flex gap-1" role="tablist">
        {meta.data!.sheets.map((s) => (
          <button key={s.id} role="tab" aria-selected={s.id === active} onClick={() => setSheetId(s.id)} className={`rounded px-3 py-1 text-sm ${s.id === active ? 'bg-blue-50 font-medium text-blue-600' : 'hover:bg-slate-100 text-slate-700'}`}>
            {s.name}
          </button>
        ))}
      </div>
      <div className="overflow-auto rounded border border-slate-200 bg-white">
        <table className="border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky top-0 w-10 border border-[#c4c7c5] bg-[#f8f9fa]" />
              {Array.from({ length: maxCol }, (_, c) => (
                <th key={c} className="sticky top-0 min-w-[90px] border border-[#c4c7c5] bg-[#f8f9fa] font-normal text-slate-500">
                  {String.fromCharCode(65 + (c % 26))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRow }, (_, r) => (
              <tr key={r}>
                <td className="border border-[#c4c7c5] bg-[#f8f9fa] text-center text-slate-400">{r + 1}</td>
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
      <p className="mt-2 text-xs text-slate-400">Showing the first 200 rows and 26 columns.</p>
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

  if (initial.isLoading) return <FullPageSpinner />;
  if (initial.error) return <ErrorState error={initial.error} title="This link isn't available" />;
  const d = data!;

  // Password gate screen
  if (d.requiresPassword) {
    return (
      <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-slate-900 select-none">
        <img
          src="/qubsuite/stitch/stitch_bg.jpg"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              'https://lh3.googleusercontent.com/aida-public/AB6AXuAHGUiisTTbrcGOmnIPQ3ZUuulGBV3WA1PH-DP2ikGxer3I0-3kegbkJrBJ7fNdtmUVdomdrN2WupXisxpbxI8lzmigSMkxmP5tJkJ-EG7f-nW1d6JkvP0aqSTHCE32JY6vMErzuXI_e8zYmIJOv05brcHvzei6vl68IZLDPPF461CJgXAilkQhUmsYZJ00QZptyTNA2fXVnj9W_BWrTHdfKiY7uRgWZXVGJWx6Ns8JCbgr0eeKr2fj5Q';
          }}
          alt="Wallpaper background"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/35 via-white/10 to-transparent" />

        <div className="relative z-10 w-full max-w-md p-6">
          <form
            className="rounded-[32px] border border-white/80 bg-white/95 p-8 shadow-2xl backdrop-blur-xl"
            onSubmit={(e) => { e.preventDefault(); unlock.mutate(); }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Lock className="size-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Password Protected</h2>
                <p className="text-xs text-slate-500">Enter the password shared by {d.owner.name}</p>
              </div>
            </div>

            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter transfer password"
              className="mt-6 rounded-xl border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-blue-600"
              autoFocus
              aria-label="Password"
            />
            <FieldError message={unlock.error ? errorMessage(unlock.error) : undefined} />

            <Button
              type="submit"
              className="mt-6 w-full rounded-2xl bg-blue-600 py-6 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-700"
              loading={unlock.isPending}
            >
              Access Transfer
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

  // Compute days remaining for 7-day retention vs Pro storage
  const expiresAt = d.expiresAt || (d.file as any)?.expiresAt;
  const isPermanent = d.isPermanent;
  let expiryLabel = '7-day storage';
  if (isPermanent) {
    expiryLabel = 'PRO Storage';
  } else if (expiresAt) {
    const daysLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
    expiryLabel = daysLeft <= 1 ? '< 24 hours left' : `${daysLeft} days left`;
  }

  const renderInlineViewer = (file: { id: string; fileType: string }) => {
    if (file.fileType === 'DOCUMENT') return <DocView token={token} access={access} fileId={file.id} />;
    if (file.fileType === 'SPREADSHEET') return <SheetView token={token} access={access} fileId={file.id} />;
    if (file.fileType === 'FORM') return <p className="p-8 text-center text-slate-700">Forms are filled in through their respondent link.</p>;
    const url = shareService.downloadUrl(token, access, file.id, true);
    if (file.fileType === 'IMAGE') return <img src={url} alt="" className="mx-auto max-h-[80vh] rounded-2xl shadow-2xl p-4 object-contain" />;
    if (file.fileType === 'PDF') return <iframe src={url} title="PDF" className="h-[82vh] w-full rounded-2xl border-none shadow-2xl bg-white" />;
    if (file.fileType === 'VIDEO') return <video src={url} controls className="mx-auto max-h-[80vh] rounded-2xl shadow-2xl p-4" />;
    if (file.fileType === 'AUDIO') return <audio src={url} controls className="mx-auto mt-16 block" />;
    return null;
  };

  return (
    <div className="relative h-full min-h-screen w-full select-none overflow-x-hidden bg-slate-100 font-sans text-slate-800 antialiased">
      {/* 1. PageBackground - Fullscreen wallpaper background image */}
      <div className="fixed inset-0 z-0 h-full w-full">
        <img
          src="/qubsuite/stitch/stitch_bg.jpg"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              'https://lh3.googleusercontent.com/aida-public/AB6AXuAHGUiisTTbrcGOmnIPQ3ZUuulGBV3WA1PH-DP2ikGxer3I0-3kegbkJrBJ7fNdtmUVdomdrN2WupXisxpbxI8lzmigSMkxmP5tJkJ-EG7f-nW1d6JkvP0aqSTHCE32JY6vMErzuXI_e8zYmIJOv05brcHvzei6vl68IZLDPPF461CJgXAilkQhUmsYZJ00QZptyTNA2fXVnj9W_BWrTHdfKiY7uRgWZXVGJWx6Ns8JCbgr0eeKr2fj5Q';
          }}
          alt="Minimalist contemporary interior overlooking serene landscape"
          className="h-full w-full object-cover object-center"
        />
        {/* Subtle gradient overlay for refined text contrast */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/35 via-white/10 to-transparent" />
      </div>

      {/* 2. Main Container with TopHeader, ContentWorkspace, and MinimalFooter */}
      <div className="relative z-10 flex min-h-screen flex-col justify-between p-6 md:p-8 lg:p-10">
        {/* Top Header */}
        <header className="flex w-full items-center justify-between" data-purpose="site-navigation">
          {/* Brand Logo & Badge Container */}
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Qub Transfer Home" className="group flex items-center gap-2.5 transition-transform duration-200 active:scale-95">
              <img
                src="/qubsuite/stitch/stitch_logo.png"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://lh3.googleusercontent.com/aida/AEtjO1Ws4daFzTtfnLMZcIOmYRPLVz6IyHPvaOROCjLom7WqAJMgyNv_BLOHEZfyb_iCdLGkeqc2SrIfEkEcyyW5aOpLt7FEPbBV4hNNJb19xI9JEV8fN-JdUe_TYG-FrV63ask0MdkBn-WbcM-wK3mH86b5-LOVcXd_01morRk6MntXmUlKVu6Kq8DSCjvjgY-iMa63ZEeZIbkfx01C4is_eD7hvYRhVuSEnQnzpjbasqWphXoPKNrzpx-t_WHc';
                }}
                alt="Qub Transfer Logo"
                className="h-10 w-auto object-contain transition-opacity hover:opacity-90"
              />
            </Link>
            <span className="hidden sm:inline-flex items-center rounded-full bg-slate-900/5 px-2.5 py-1 text-xs font-semibold text-slate-600 backdrop-blur-md border border-slate-900/10">
              Fast Cloud Sharing
            </span>
          </div>

          {/* Right Navigation Actions (Removed Programs & Help as requested, keeping Sign in / Open in Qub) */}
          <nav aria-label="Quick Navigation" className="flex items-center gap-2 sm:gap-4">
            {auth.status === 'authenticated' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => redeem.mutate()}
                loading={redeem.isPending}
                className="rounded-full border border-slate-300/80 bg-white/80 px-5 py-2 text-sm font-semibold text-slate-800 shadow-xs backdrop-blur-sm transition duration-200 hover:border-slate-400 hover:bg-white active:scale-95"
              >
                Open in Qub
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-full border border-slate-300/80 bg-white/80 px-5 py-2 text-sm font-semibold text-slate-800 shadow-xs backdrop-blur-sm transition duration-200 hover:border-slate-400 hover:bg-white active:scale-95"
              >
                <Link to="/login" search={{ redirect: `/share/${token}` }}>
                  Sign in
                </Link>
              </Button>
            )}
          </nav>
        </header>

        {/* Content Workspace */}
        <main className="my-auto grid grid-cols-1 items-center gap-8 py-8 lg:grid-cols-12" data-purpose="transfer-content">
          {/* Floating Download Card - Iconic Left Floating Box */}
          <section aria-labelledby="transfer-heading" className="lg:col-span-6 xl:col-span-5 2xl:col-span-4">
            <div className="relative mx-auto w-full max-w-[440px] rounded-[32px] border border-white/80 bg-white/95 p-8 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.08),0_0_1px_1px_rgba(15,23,42,0.04)] backdrop-blur-md transition-all duration-300 hover:shadow-2xl lg:mx-0">
              {/* Transfer Header Status */}
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500" id="transfer-heading">
                    Ready to download
                  </span>
                </div>

                {/* Pro / Expiry Badge */}
                {isPermanent ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-500/20">
                    <svg className="h-3.5 w-3.5 fill-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path clipRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" fillRule="evenodd" />
                    </svg>
                    <span>PRO Storage</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-500/20">
                    <span>{expiryLabel}</span>
                  </div>
                )}
              </div>

              {/* File Showcase Item */}
              <div className="group mb-7 flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition duration-200 hover:border-slate-200 hover:bg-slate-50" data-purpose="file-item">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-100/70 text-blue-600 transition group-hover:scale-105">
                  <FileIcon
                    type={d.resourceType === 'FOLDER' ? (openFile ? (openFile.fileType as any) : 'FOLDER') : (d.file?.fileType ?? 'OTHER')}
                    size={28}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-bold text-slate-900 tracking-tight" title={fileName}>
                    {fileName}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {formatBytes(fileSize)} <span className="mx-1">•</span> By {d.owner.name}
                  </p>
                </div>
              </div>

              {/* Back button if deep into folder */}
              {openFile && (
                <button
                  onClick={() => setOpenFile(null)}
                  className="mb-4 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Back to folder items</span>
                </button>
              )}

              {/* Folder list when folder link is shared */}
              {d.folder && !openFile && (
                <div className="mb-6 max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {d.folder.items.length} files in folder
                  </p>
                  <div className="divide-y divide-slate-100">
                    {d.folder.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => item.kind === 'file' && setOpenFile({ id: item.id, fileType: item.fileType })}
                        className="flex w-full items-center gap-2.5 px-2 py-2 text-left text-xs hover:bg-white rounded-lg transition-colors group"
                      >
                        <FileIcon type={item.fileType} size={16} />
                        <span className="flex-1 truncate text-slate-700 group-hover:text-slate-900">{item.name}</span>
                        <span className="text-[11px] text-slate-400">{formatBytes(item.size)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons Group */}
              <div className="space-y-3" data-purpose="card-actions">
                {/* Primary Download Button */}
                {downloadUrl ? (
                  <a
                    href={downloadUrl}
                    download={fileName}
                    aria-label={`Download ${fileName}`}
                    className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#1d58fc] py-4 px-6 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-200 hover:bg-[#1648d4] hover:shadow-blue-600/40 active:scale-[0.99] focus:outline-hidden focus:ring-4 focus:ring-blue-500/20"
                  >
                    <Download className="h-5 w-5 transition-transform duration-200 group-hover:translate-y-0.5" />
                    <span>Download File</span>
                  </a>
                ) : (
                  <button
                    onClick={() => redeem.mutate()}
                    className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#1d58fc] py-4 px-6 text-base font-bold text-white shadow-lg shadow-blue-600/30 transition-all duration-200 hover:bg-[#1648d4] hover:shadow-blue-600/40 active:scale-[0.99]"
                  >
                    <span>Save to Qub Drive</span>
                  </button>
                )}

                {/* Secondary Preview Link */}
                {currentFile && ['IMAGE', 'PDF', 'VIDEO', 'AUDIO', 'DOCUMENT', 'SPREADSHEET'].includes(currentFile.fileType) && (
                  <button
                    onClick={() => setShowInlinePreview(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100/80 hover:text-slate-900"
                    type="button"
                  >
                    <Eye className="h-4 w-4 text-slate-500" />
                    <span>Preview without downloading</span>
                  </button>
                )}
              </div>

              {/* Retention & Upsell Notice Banner */}
              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs leading-relaxed text-slate-600">
                <div className="flex items-start gap-2.5">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                  <div>
                    <strong className="font-semibold text-slate-800">Temporary Free Cloud:</strong>{' '}
                    Free files are stored for 7 days. Need permanent storage with custom branding?{' '}
                    <Link to="/register" className="font-bold text-blue-600 underline underline-offset-2 hover:text-blue-700">
                      Get Qub Pro
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Billboard Sponsor Section - Updated with Qubators Global Conference 2026 */}
          <aside aria-label="Sponsored Billboard" className="hidden lg:col-span-6 lg:flex lg:justify-end xl:col-span-7 2xl:col-span-8">
            <div className="max-w-md rounded-3xl border border-white/80 bg-white/85 p-7 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.08),0_0_1px_1px_rgba(15,23,42,0.04)] backdrop-blur-xl transition-all duration-300 hover:shadow-xl">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="rounded-md bg-slate-900/5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Featured Event
                </span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                Qubators Global Conference 2026
              </h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-slate-700">
                A one-day global gathering of tech experts, builders, creators, founders, innovators, investors and emerging leaders shaping the future through technology.
              </p>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
                We believe great tech skills and God's purpose go together. Join us in person in Lagos or online from anywhere. Reserve your spot today.
              </p>
              <div className="mt-5 pt-1">
                <a
                  href="https://www.qubators.org/qgc/register"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1d58fc] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1648d4] active:scale-95"
                >
                  <span>Learn More & Register</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </aside>
        </main>

        {/* Minimal Footer (Removed bottom right copyright watermark as requested) */}
        <footer className="flex flex-col items-center justify-between gap-4 pt-4 sm:flex-row sm:pt-0" data-purpose="page-footer">
          <nav aria-label="Legal & Information" className="flex items-center gap-6 text-xs font-medium text-slate-600/90 drop-shadow-xs">
            <a href="https://qubators.net" className="transition hover:text-slate-900 hover:underline">Terms</a>
            <a href="https://qubators.net" className="transition hover:text-slate-900 hover:underline">Privacy</a>
            <a href="https://qubators.net" className="transition hover:text-slate-900 hover:underline">Cookies</a>
            <a href="https://qubators.net" className="transition hover:text-slate-900 hover:underline">About Qub</a>
          </nav>
        </footer>
      </div>

      {/* Full-Screen Preview Drawer Modal */}
      {showInlinePreview && currentFile && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex h-16 items-center justify-between border-b border-white/10 bg-white/90 px-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <FileIcon type={currentFile.fileType as any} size={20} />
              <span className="font-semibold text-slate-900 truncate max-w-md">{fileName}</span>
            </div>
            <div className="flex items-center gap-3">
              {downloadUrl && (
                <Button asChild size="sm" className="rounded-full bg-blue-600 hover:bg-blue-700 text-white">
                  <a href={downloadUrl} download={fileName}>
                    <Download className="mr-1.5 size-4" /> Download
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInlinePreview(false)}
                className="rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <X className="mr-1 size-4" /> Close preview
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
