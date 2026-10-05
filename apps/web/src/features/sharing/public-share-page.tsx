import { documentExtensions, type JSONContent } from '@qub/editor-schema';
import type { PublicShareDto } from '@qub/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  Download,
  Lock,
  Eye,
  ArrowUpRight,
  ChevronLeft,
  X,
  ArrowLeft,
  Monitor,
  Smartphone,
  Calendar,
  Sparkles,
  ExternalLink,
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
    <div className="mx-auto my-6 max-w-5xl rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {meta.data?.sheets.map((s) => (
          <button
            key={s.id}
            onClick={() => setSheetId(s.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${s.id === active ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-auto max-h-[70vh] border border-slate-200 rounded-lg">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="w-10 border border-slate-200 px-2 py-1 text-center font-normal">#</th>
              {Array.from({ length: maxCol }).map((_, c) => (
                <th key={c} className="border border-slate-200 px-3 py-1 font-semibold">
                  {String.fromCharCode(65 + c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRow }).map((_, r) => (
              <tr key={r} className="hover:bg-slate-50/50">
                <td className="border border-slate-200 bg-slate-50 px-2 py-1 text-center font-mono text-slate-400">
                  {r + 1}
                </td>
                {Array.from({ length: maxCol }).map((_, c) => (
                  <td key={c} className="border border-slate-200 px-3 py-1 text-slate-700 min-w-[80px]">
                    {map.get(`${r}:${c}`)?.value ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const [previewDevice, setPreviewDevice] = useState<'computer' | 'mobile'>('computer');
  const [leftTab, setLeftTab] = useState<'media' | 'qgc'>('media');

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
      <div className="min-h-screen w-full flex items-center justify-center bg-[#e8e2dc] p-4 text-neutral-800 selection:bg-[#7b5b53]/20">
        <div className="w-full max-w-md rounded-2xl border border-neutral-200/60 bg-[#fcfbf9] p-8 shadow-xl shadow-neutral-900/5">
          <form
            onSubmit={(e) => { e.preventDefault(); unlock.mutate(); }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7b5b53]/10 text-[#7b5b53]">
                <Lock className="size-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Password Protected</h2>
                <p className="text-xs text-neutral-500">Enter the password shared by {d.owner.name}</p>
              </div>
            </div>

            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter transfer password"
              className="rounded-lg border-neutral-200 bg-white text-neutral-900 placeholder-neutral-400 focus:border-[#7b5b53] focus:ring-[#7b5b53]"
              autoFocus
              aria-label="Password"
            />
            <FieldError message={unlock.error ? errorMessage(unlock.error) : undefined} />

            <Button
              type="submit"
              className="w-full rounded-lg bg-[#7b5b53] py-3 text-sm font-medium text-white shadow-sm transition hover:bg-[#6b4e47] active:scale-[0.99]"
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

  // Expiration calculation: default 7 days retention
  const expiresAt = d.expiresAt || (d.file as any)?.expiresAt;
  const isPermanent = d.isPermanent;
  let formattedExpiry = '7 days retention';
  if (isPermanent) {
    formattedExpiry = 'PRO Permanent Storage';
  } else if (expiresAt) {
    const expDate = new Date(expiresAt);
    formattedExpiry = `Available until ${expDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} • 7 days retention`;
  } else {
    const sevenDaysOut = new Date(Date.now() + 7 * 86400000);
    formattedExpiry = `Available until ${sevenDaysOut.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} • 7 days retention`;
  }

  const fileTypeLabel = currentFile ? (
    currentFile.fileType === 'VIDEO' ? 'Video file' :
    currentFile.fileType === 'IMAGE' ? 'Image file' :
    currentFile.fileType === 'PDF' ? 'PDF document' :
    currentFile.fileType === 'DOCUMENT' ? 'Document' :
    currentFile.fileType === 'SPREADSHEET' ? 'Spreadsheet' :
    currentFile.fileType === 'AUDIO' ? 'Audio file' :
    'File'
  ) : d.folder ? 'Folder archive' : 'File';

  const renderInlineViewer = (file: { id: string; fileType: string }) => {
    if (file.fileType === 'DOCUMENT') return <DocView token={token} access={access} fileId={file.id} />;
    if (file.fileType === 'SPREADSHEET') return <SheetView token={token} access={access} fileId={file.id} />;
    if (file.fileType === 'FORM') return <p className="p-8 text-center text-neutral-700">Forms are filled in through their respondent link.</p>;
    const url = shareService.downloadUrl(token, access, file.id, true);
    if (file.fileType === 'IMAGE') return <img src={url} alt="" className="mx-auto max-h-[80vh] rounded-2xl shadow-2xl p-4 object-contain" />;
    if (file.fileType === 'PDF') return <iframe src={url} title="PDF" className="h-[82vh] w-full rounded-2xl border-none shadow-2xl bg-white" />;
    if (file.fileType === 'VIDEO') return <video src={url} controls className="mx-auto max-h-[80vh] rounded-2xl shadow-2xl p-4" />;
    if (file.fileType === 'AUDIO') return <audio src={url} controls className="mx-auto mt-16 block" />;
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#e8e2dc] text-neutral-800 antialiased selection:bg-[#7b5b53]/20 font-sans">
      {/* BEGIN: TopBar (Back and device toggles removed as requested) */}
      <header className="w-full px-6 py-4 flex items-center justify-end z-20 text-neutral-700 text-sm">
        <div>
          {auth.status === 'authenticated' ? (
            <Button
              variant="secondary"
              size="sm"
              asChild
              className="rounded-full border border-neutral-300/80 bg-white/90 text-xs font-semibold text-neutral-800 shadow-xs hover:bg-white"
            >
              <Link to="/drive">Open in Qub</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="rounded-full border border-neutral-300/80 bg-white/90 text-xs font-semibold text-neutral-800 shadow-xs hover:bg-white"
            >
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </header>
      {/* END: TopBar */}

      {/* BEGIN: CentralWorkspace */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 md:py-8">
        <div
          className={`w-full transition-all duration-300 ${
            previewDevice === 'mobile'
              ? 'max-w-[420px]'
              : 'max-w-[980px]'
          } bg-[#fcfbf9] rounded-2xl shadow-xl shadow-neutral-900/5 overflow-hidden border border-neutral-200/60 min-h-[500px]`}
        >
          <div className={`grid grid-cols-1 ${previewDevice === 'mobile' ? 'grid-cols-1' : 'md:grid-cols-2'} min-h-[500px]`}>
            {/* Left Column: Visual Area (Video thumbnail with play button ONLY for videos; clean still image for others) */}
            <div className="relative w-full h-72 md:h-auto min-h-[320px] overflow-hidden bg-neutral-900 flex items-center justify-center group">
              {/* If it's a video file, load video stream frame #t=1 as thumbnail preview */}
              {currentFile?.fileType === 'VIDEO' ? (
                <>
                  <video
                    src={`${shareService.downloadUrl(token, access, currentFile.id, true)}#t=1`}
                    preload="metadata"
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover object-center brightness-90 transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
              {/* Large Central Play Button for Video Preview */}
              <button
                type="button"
                onClick={() => setShowInlinePreview(true)}
                className="relative z-10 flex size-16 sm:size-20 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white active:scale-95 cursor-pointer group-hover:shadow-blue-500/30"
                title="Play video preview"
              >
                <div className="ml-1 flex items-center justify-center text-[#7b5b53]">
                  <svg className="size-8 sm:size-10 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>

              <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center justify-between text-[11px] text-white/90 drop-shadow-md pointer-events-none">
                <span className="font-medium bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-md">
                  Click to preview
                </span>
                <span className="bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md font-mono">
                  {fileTypeLabel}
                </span>
              </div>
                </>
              ) : currentFile?.fileType === 'IMAGE' ? (
                <>
                  <img
                    src={shareService.downloadUrl(token, access, currentFile.id, true)}
                    alt={fileName}
                    className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20" />
                </>
              ) : (
                <>
                  <img
                    alt="Still Life Studio"
                    className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    src="/stitch/stitch_still_desk.png"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://lh3.googleusercontent.com/aida-public/AB6AXuAc_97Brn-K964kBBetnBDrToqj2ZrmaXC-WpR6uEiri7GdAPPaXa_z1m4CrMsMGsK5k_grbTm0w8wwQTp2QEcBNqOL0jJ7uI86PbvzsmC1w2EMkwtBXgabVIf8KHiAPuEdA5fFyAkaUp6L4xdS_HFD_hsgvyETRP7xTURPvpUEddkeSfeaj2sTZfz55lPZwpIMIin0HLNtOh-A6ktePzlae3oJlxozRf0-LtG2hjn6iHopKknuyB8CRQ';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/20" />
                </>
              )}
            </div>

            {/* Right Column: Clean Off-White Details & Actions */}
            <div className="flex flex-col justify-between p-7 sm:p-10 lg:p-12 bg-[#fcfbf9]">
              {/* Top Section: Status & Titles */}
              <div className="space-y-6">
                {/* Status Pill */}
                <div className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Ready to download
                  </span>
                </div>

                {/* Main File Title & Size */}
                <div className="space-y-1.5">
                  <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 tracking-tight leading-snug break-all">
                    {fileName}
                  </h1>
                  <p className="text-sm font-medium text-neutral-600 flex items-center gap-2">
                    <span>{formatBytes(fileSize)}</span>
                    <span className="text-neutral-300">•</span>
                    <span>{fileTypeLabel}</span>
                  </p>
                </div>

                {/* Sender & Expiry Details */}
                <div className="pt-2 border-t border-neutral-100 space-y-2 text-sm text-neutral-500">
                  <p className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-bold text-neutral-600">
                      {d.owner.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-neutral-700">By {d.owner.name}</span>
                  </p>
                  <p className="flex items-center gap-2 text-xs text-neutral-500">
                    <Calendar className="size-3.5 text-neutral-400" />
                    <span>{formattedExpiry}</span>
                  </p>
                </div>

                {/* Folder items listing if folder */}
                {d.folder && (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-neutral-200/80 bg-neutral-50 p-2">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      {d.folder.items.length} items included
                    </p>
                    <div className="divide-y divide-neutral-100">
                      {d.folder.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => item.kind === 'file' && setOpenFile({ id: item.id, fileType: item.fileType })}
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-white rounded transition"
                        >
                          <FileIcon type={item.fileType} size={14} />
                          <span className="flex-1 truncate text-neutral-700">{item.name}</span>
                          <span className="text-[10px] text-neutral-400">{formatBytes(item.size)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions Section */}
              <div className="pt-8 space-y-3">
                {/* Primary CTA Button matching the stitch brown theme */}
                {downloadUrl ? (
                  <a
                    href={downloadUrl}
                    download={fileName}
                    aria-label={`Download ${fileName}`}
                    className="w-fit min-w-[160px] px-8 py-3.5 bg-[#7b5b53] hover:bg-[#6b4e47] active:scale-[0.99] text-white text-sm font-medium rounded-lg shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="size-4.5" />
                    <span>Download File</span>
                  </a>
                ) : (
                  <button
                    onClick={() => redeem.mutate()}
                    className="w-fit min-w-[160px] px-8 py-3.5 bg-[#7b5b53] hover:bg-[#6b4e47] active:scale-[0.99] text-white text-sm font-medium rounded-lg shadow-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Save to Qub Drive</span>
                  </button>
                )}

                {/* Secondary Preview Link */}
                {currentFile && ['IMAGE', 'PDF', 'VIDEO', 'AUDIO', 'DOCUMENT', 'SPREADSHEET'].includes(currentFile.fileType) && (
                  <button
                    onClick={() => setShowInlinePreview(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors pt-1 px-1 cursor-pointer"
                    type="button"
                  >
                    <Eye className="size-3.5" />
                    <span>Preview file</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* INTEGRATED AD SECTION: Qubators Global Conference 2026 Billboard Banner */}
        <section
          aria-label="Conference Billboard"
          className="w-full max-w-[980px] mt-6 rounded-2xl border border-neutral-200/60 bg-[#fcfbf9] p-6 sm:p-7 shadow-lg shadow-neutral-900/5 backdrop-blur-xl transition hover:shadow-xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <span className="rounded-md bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Featured Billboard
                </span>
                <span className="text-xs text-neutral-400 font-medium">
                  Lagos &amp; Online • 2026
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                Qubators Global Conference 2026
              </h2>
              <p className="text-sm leading-relaxed text-neutral-600">
                A one-day global gathering of tech experts, builders, creators, founders, innovators, investors and emerging leaders shaping the future through technology.
              </p>
              <p className="text-xs leading-relaxed text-neutral-500 pt-0.5">
                We believe great tech skills and God's purpose go together. Join us in person in Lagos or online from anywhere. Reserve your spot today.
              </p>
            </div>

            <div className="shrink-0 flex items-center">
              <a
                href="https://www.qubators.org/qgc/register"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#7b5b53] hover:bg-[#6b4e47] text-white px-6 py-3.5 text-sm font-semibold shadow-sm transition active:scale-95"
              >
                <span>Learn More &amp; Register</span>
                <ArrowUpRight className="size-4" />
              </a>
            </div>
          </div>
        </section>
      </main>
      {/* END: CentralWorkspace */}

      {/* BEGIN: MinimalFooter */}
      <footer className="w-full px-6 py-4 flex flex-col md:flex-row items-center justify-between text-xs text-neutral-500 gap-3 border-t border-neutral-300/40">
        <div className="flex items-center gap-2.5">
          {/* Minimal Brand Identity matching stitch design */}
          <div className="flex items-center gap-1.5 font-semibold text-neutral-700">
            <span className="w-3.5 h-3.5 rounded bg-blue-600 inline-block" />
            <span>Qub Transfer</span>
          </div>
          <span className="text-neutral-300">•</span>
          <span className="text-neutral-500">Fast Cloud Sharing</span>
        </div>

        {/* Security & Policy note mirroring reference screen */}
        <div className="text-center md:text-right text-[11px] text-neutral-400 max-w-xl">
          This file transfer is secured and encrypted. Transfer recipient is responsible for content downloaded in accordance with our terms of service.
        </div>
      </footer>
      {/* END: MinimalFooter */}

      {/* Full-Screen Preview Drawer Modal */}
      {showInlinePreview && currentFile && (
        <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="flex h-16 items-center justify-between border-b border-white/10 bg-white/95 px-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <FileIcon type={currentFile.fileType as any} size={20} />
              <span className="font-semibold text-neutral-900 truncate max-w-md">{fileName}</span>
            </div>
            <div className="flex items-center gap-3">
              {downloadUrl && (
                <Button asChild size="sm" className="rounded-lg bg-[#7b5b53] hover:bg-[#6b4e47] text-white">
                  <a href={downloadUrl} download={fileName}>
                    <Download className="mr-1.5 size-4" /> Download
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInlinePreview(false)}
                className="rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
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
