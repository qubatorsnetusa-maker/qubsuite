import type { DriveFileDto, FileType } from '@qub/shared';
import { useQuery } from '@tanstack/react-query';
import { FileCheck2, ArrowLeft, ChevronLeft, ChevronRight, Download, ExternalLink, Info, Maximize, Minus, Plus, Printer, UserPlus, Sparkles, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FileIcon, FILE_TYPE_LABEL } from '@/components/file-icon';
import { Tooltip } from '@/components/ui/misc';
import { cn, formatBytes, formatRelative } from '@/lib/utils';
import { driveService } from '@/services/drive';
import { DetailsPanel } from './details-panel';
import { PdfSignDialog } from './pdf-sign-dialog';
import { isPreviewable, useItemActions } from './item-actions';

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const TEXT_LIMIT = 2_000_000;

function TextBody({ url, zoom }: { url: string; zoom: number }) {
  const text = useQuery({ queryKey: ['preview-text', url], queryFn: async () => (await fetch(url, { credentials: 'include' })).text(), staleTime: 60_000 });
  return (
    <pre className="mx-auto w-full max-w-4xl whitespace-pre-wrap break-words rounded-lg bg-white p-8 font-mono text-[#202124] shadow-pop" style={{ fontSize: `${13 * zoom}px` }}>
      {text.data ?? 'Loading…'}
    </pre>
  );
}

/** Prints the file without leaving Qub: the content is loaded into a hidden frame and printed from there. */
function printFile(file: DriveFileDto) {
  const url = driveService.contentUrl(file.id);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const done = () => setTimeout(() => frame.remove(), 60_000);
  const printFrame = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    done();
  };
  if (file.fileType === 'PDF') {
    frame.onload = printFrame;
    frame.src = url;
    return;
  }
  const doc = frame.contentDocument!;
  doc.open();
  doc.write('<!doctype html><title></title><style>@page{margin:12mm}body{margin:0}img{max-width:100%;max-height:100vh;display:block;margin:auto}pre{white-space:pre-wrap;font:12px monospace}</style><body></body>');
  doc.close();
  if (file.fileType === 'IMAGE') {
    const img = doc.createElement('img');
    img.onload = printFrame;
    img.src = url;
    doc.body.appendChild(img);
  } else {
    void fetch(url, { credentials: 'include' })
      .then((r) => r.text())
      .then((t) => {
        const pre = doc.createElement('pre');
        pre.textContent = t;
        doc.body.appendChild(pre);
        printFrame();
      });
  }
}

function IconButton({ label, onClick, children, pressed, href }: { label: string; onClick?: () => void; children: ReactNode; pressed?: boolean; href?: string }) {
  const cls = cn('flex size-10 items-center justify-center rounded-full text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 [&_svg]:size-5', pressed && 'bg-white/15');
  return (
    <Tooltip content={label}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls} aria-label={label}>
          {children}
        </a>
      ) : (
        <button onClick={onClick} className={cls} aria-label={label} aria-pressed={pressed}>
          {children}
        </button>
      )}
    </Tooltip>
  );
}

/**
 * Full-screen viewer for uploaded files: images (zoom and pan), PDFs, video, audio and text, with print, download,
 * share, "open in new tab", details, and ←/→ to move through the other files in the same listing.
 */
export function FileViewer({
  file,
  onClose,
  onPrev,
  onNext,
  position,
  closeLabel = 'Close',
}: {
  file: DriveFileDto;
  onClose(): void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: string;
  closeLabel?: string;
}) {
  const actions = useItemActions();
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [signOpen, setSignOpen] = useState(false);
  const [info, setInfo] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const url = driveService.contentUrl(file.id);
  const zoomable = file.fileType === 'IMAGE' || file.fileType === 'TEXT';
  const canPrint = file.capabilities.canDownload && ['IMAGE', 'PDF', 'TEXT'].includes(file.fileType);

  useEffect(() => {
    setZoom(1);
    setFit(true);
  }, [file.id]);

  // Take keyboard focus from the listing behind (so its arrow keys don't move the selection), and give it back.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const step = useCallback((dir: 1 | -1) => {
    setFit(false);
    setZoom((z) => {
      const i = ZOOM_STEPS.findIndex((s) => s >= z - 0.001);
      return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, (i < 0 ? ZOOM_STEPS.length - 1 : i) + dir))]!;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable="true"], [role="menu"]')) return;
      // A dialog opened from the viewer (Share, confirmations) handles its own keys.
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      if (e.key === 'Escape') return onClose();
      if (e.key === 'ArrowLeft' && onPrev) return onPrev();
      if (e.key === 'ArrowRight' && onNext) return onNext();
      if (!zoomable) return;
      if (e.key === '+' || e.key === '=') step(1);
      else if (e.key === '-') step(-1);
      else if (e.key === '0') {
        setZoom(1);
        setFit(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext, step, zoomable]);

  let body: ReactNode;
  switch (file.fileType) {
    case 'IMAGE':
      body = (
        <img
          src={url}
          alt={file.name}
          draggable={false}
          onDoubleClick={() => (fit ? (setFit(false), setZoom(2)) : (setFit(true), setZoom(1)))}
          className={cn('m-auto block select-none shadow-pop', fit ? 'max-h-full max-w-full object-contain' : 'max-w-none cursor-zoom-out')}
          style={fit ? undefined : { width: `${zoom * 100}%` }}
        />
      );
      break;
    case 'PDF':
      body = <iframe src={url} title={file.name} className="size-full rounded-lg bg-white shadow-pop" />;
      break;
    case 'VIDEO':
      body = <video key={file.id} src={url} controls autoPlay className="m-auto max-h-full max-w-full rounded-lg bg-black" />;
      break;
    case 'AUDIO':
      body = (
        <div className="m-auto flex w-full max-w-xl flex-col items-center gap-6 rounded-2xl bg-white/5 p-10">
          <FileIcon type="AUDIO" size={72} />
          <audio key={file.id} src={url} controls autoPlay className="w-full" />
        </div>
      );
      break;
    case 'TEXT':
      body = file.size < TEXT_LIMIT ? <TextBody url={url} zoom={fit ? 1 : zoom} /> : null;
      break;
    default:
      body = null;
  }

  return (
    <div ref={root} tabIndex={-1} className="fixed inset-0 z-50 flex flex-col bg-[#202124] text-white outline-none animate-fade-in" role="dialog" aria-modal="true" aria-label={`Preview of ${file.name}`}>
      <header className="flex h-16 shrink-0 items-center gap-2 px-2 sm:px-4">
        <IconButton label={closeLabel} onClick={onClose}>
          <ArrowLeft />
        </IconButton>
        <FileIcon type={file.fileType} size={24} className="ml-1 shrink-0" />
        <div className="min-w-0 flex-1 pl-2">
          <h1 className="truncate text-[15px] font-medium">{file.name}</h1>
          <p className="truncate text-xs text-white/60">
            {FILE_TYPE_LABEL[file.fileType]} · {formatBytes(file.size)} · Modified {formatRelative(file.updatedAt)}
            {file.owner ? ` by ${file.owner.name}` : ''}
          </p>
        </div>
        {position && <span className="hidden text-xs text-white/60 md:inline">{position}</span>}
        {file.fileType === 'PDF' && (
          <>
            <button
              type="button"
              onClick={() => setSignOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-500 transition-colors"
              title="Fill and sign this PDF"
            >
              <FileCheck2 className="size-4" />
              <span>Sign & Fill</span>
            </button>
          </>
        )}
        <IconButton label="Open in new tab" href={url}>
          <ExternalLink />
        </IconButton>
        {file.capabilities.canShare && (
          <IconButton label="Share" onClick={() => actions.share(file)}>
            <UserPlus />
          </IconButton>
        )}
        {canPrint && (
          <IconButton label="Print" onClick={() => printFile(file)}>
            <Printer />
          </IconButton>
        )}
        {file.capabilities.canDownload && (
          <IconButton label="Download" onClick={() => actions.download([file])}>
            <Download />
          </IconButton>
        )}
        <IconButton label="Details" pressed={info} onClick={() => setInfo((v) => !v)}>
          <Info />
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <div ref={scroller} className={cn('flex size-full overflow-auto px-4 pb-20 pt-2 sm:px-16', file.fileType === 'PDF' && 'pb-4')}>
            {body ?? (
              <div className="m-auto rounded-2xl bg-white p-10 text-center text-[#202124] shadow-pop">
                <FileIcon type={file.fileType} size={64} className="mx-auto" />
                <p className="mt-4 font-medium">No preview available</p>
                <p className="mt-1 text-sm text-[#5f6368]">
                  {file.mimeType} · {formatBytes(file.size)}
                </p>
                {file.capabilities.canDownload && (
                  <button onClick={() => actions.download([file])} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-[#1765cc]">
                    <Download className="size-4" /> Download
                  </button>
                )}
              </div>
            )}
          </div>

          {onPrev && (
            <button onClick={onPrev} className="absolute left-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 sm:left-4" aria-label="Previous file">
              <ChevronLeft className="size-7" />
            </button>
          )}
          {onNext && (
            <button onClick={onNext} className="absolute right-2 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 sm:right-4" aria-label="Next file">
              <ChevronRight className="size-7" />
            </button>
          )}

          {zoomable && body && (
            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/70 px-2 py-1 shadow-pop backdrop-blur" role="toolbar" aria-label="Zoom">
              <button onClick={() => step(-1)} className="rounded-full p-2 hover:bg-white/15" aria-label="Zoom out">
                <Minus className="size-4" />
              </button>
              <span className="w-14 text-center text-xs tabular-nums">{fit ? 'Fit' : `${Math.round(zoom * 100)}%`}</span>
              <button onClick={() => step(1)} className="rounded-full p-2 hover:bg-white/15" aria-label="Zoom in">
                <Plus className="size-4" />
              </button>
              <span className="mx-1 h-4 w-px bg-white/30" />
              <button
                onClick={() => {
                  setZoom(1);
                  setFit(true);
                  scroller.current?.scrollTo({ top: 0, left: 0 });
                }}
                className="rounded-full p-2 hover:bg-white/15"
                aria-label="Fit to screen"
              >
                <Maximize className="size-4" />
              </button>
            </div>
          )}
        </div>
        {info && (
          <div className="w-full max-w-[360px] shrink-0 text-foreground">
            <DetailsPanel item={file} onClose={() => setInfo(false)} />
          </div>
        )}
      </div>
      <PdfSignDialog
        open={signOpen}
        onOpenChange={setSignOpen}
        pdfUrl={url}
        fileName={file.name}
      />
    </div>
  );
}

/** Viewer for a listing: `previewId` is the file in the URL; arrows move through the listing's previewable files. */
export function ListingPreview({ items, previewId, onChange }: { items: { kind: string; id: string; fileType?: FileType; isTrashed?: boolean }[]; previewId: string | undefined; onChange(id: string | undefined): void }) {
  const inList = items.filter(isPreviewable) as unknown as DriveFileDto[];
  const index = inList.findIndex((f) => f.id === previewId);
  // A file that isn't (or is no longer) in the loaded listing is fetched on its own.
  const single = useQuery({ queryKey: ['drive', 'file', previewId], queryFn: () => driveService.file(previewId!), enabled: !!previewId && index < 0 });
  if (!previewId) return null;
  const file = index >= 0 ? inList[index]! : single.data;
  if (!file) return null;
  return (
    <FileViewer
      file={file}
      onClose={() => onChange(undefined)}
      onPrev={index > 0 ? () => onChange(inList[index - 1]!.id) : undefined}
      onNext={index >= 0 && index < inList.length - 1 ? () => onChange(inList[index + 1]!.id) : undefined}
      position={index >= 0 && inList.length > 1 ? `${index + 1} of ${inList.length}` : undefined}
    />
  );
}
