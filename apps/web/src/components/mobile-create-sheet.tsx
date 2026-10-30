import { useState, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  FolderPlus,
  FileUp,
  FolderUp,
  Presentation,
  X,
  FileText,
  Table2,
  CheckSquare,
  FileCheck2,
} from 'lucide-react';
import { FileIcon } from '@/components/file-icon';
import { cn } from '@/lib/utils';
import { NewFolderDialog } from '@/features/drive/dialogs';
import { PdfSignDialog } from '@/features/drive/pdf-sign-dialog';
import { useTransfers } from '@/features/drive/transfer-manager';

export interface MobileCreateSheetProps {
  open: boolean;
  onClose: () => void;
  folderId?: string;
}

export function MobileCreateSheet({ open, onClose, folderId }: MobileCreateSheetProps) {
  const navigate = useNavigate();
  const uploads = useTransfers();

  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  const [folderOpen, setFolderOpen] = useState(false);
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const [activePdfName, setActivePdfName] = useState<string>('');
  const [pdfSignOpen, setPdfSignOpen] = useState(false);

  if (!open) return null;

  const handleCreateDoc = () => {
    onClose();
    void navigate({
      to: '/docs/new',
      search: folderId ? { folder: folderId } : undefined,
    } as any);
  };

  const handleCreateSheet = () => {
    onClose();
    void navigate({
      to: '/sheets/new',
      search: folderId ? { folder: folderId } : undefined,
    } as any);
  };

  const handleCreateForm = () => {
    onClose();
    void navigate({
      to: '/forms/new',
      search: folderId ? { folder: folderId } : undefined,
    } as any);
  };

  const handleCreateSlide = () => {
    onClose();
    void navigate({ to: '/slides' as any });
  };

  const handleNewFolder = () => {
    onClose();
    setFolderOpen(true);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Create new item"
      >
        <div
          className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-background p-5 pb-8 shadow-2xl transition-transform animate-in slide-in-from-bottom duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Grab Handle */}
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted/30" />

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Create New</h2>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-hover active:scale-95"
              aria-label="Close sheet"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Quick Storage & File Actions Grid */}
          <div className="grid grid-cols-3 gap-2.5 pb-4 border-b border-border/70">
            <button
              onClick={handleNewFolder}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-surface p-3.5 text-center transition-all hover:bg-hover active:scale-95 border border-border/40"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-blue-100/80 text-blue-600">
                <FolderPlus className="size-6" />
              </div>
              <span className="text-xs font-medium text-foreground">New folder</span>
            </button>

            <button
              onClick={() => {
                onClose();
                fileInput.current?.click();
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-surface p-3.5 text-center transition-all hover:bg-hover active:scale-95 border border-border/40"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-100/80 text-indigo-600">
                <FileUp className="size-6" />
              </div>
              <span className="text-xs font-medium text-foreground">Upload file</span>
            </button>

            <button
              onClick={() => {
                onClose();
                folderInput.current?.click();
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-surface p-3.5 text-center transition-all hover:bg-hover active:scale-95 border border-border/40"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <FolderUp className="size-6" />
              </div>
              <span className="text-xs font-medium text-foreground">Upload folder</span>
            </button>
          </div>

          {/* Qub Suite Applications */}
          <div className="pt-4">
            <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Qub Suite Apps</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCreateDoc}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3 text-left transition-all hover:bg-hover active:scale-98 border border-border/40"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                  <FileIcon type="DOCUMENT" size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">Qub Docs</p>
                  <p className="truncate text-xs text-muted">Text document</p>
                </div>
              </button>

              <button
                onClick={handleCreateSheet}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3 text-left transition-all hover:bg-hover active:scale-98 border border-border/40"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                  <FileIcon type="SPREADSHEET" size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">Qub Sheets</p>
                  <p className="truncate text-xs text-muted">Spreadsheet</p>
                </div>
              </button>

              <button
                onClick={handleCreateForm}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3 text-left transition-all hover:bg-hover active:scale-98 border border-border/40"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-50">
                  <FileIcon type="FORM" size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">Qub Forms</p>
                  <p className="truncate text-xs text-muted">Survey & quiz</p>
                </div>
              </button>

              <button
                onClick={handleCreateSlide}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3 text-left transition-all hover:bg-hover active:scale-98 border border-border/40"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                  <Presentation className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">Qub Slides</p>
                  <p className="truncate text-xs text-muted">Presentation</p>
                </div>
              </button>

              <button
                onClick={() => {
                  onClose();
                  pdfInput.current?.click();
                }}
                className="col-span-2 flex items-center gap-3 rounded-2xl bg-surface p-3 text-left transition-all hover:bg-hover active:scale-98 border border-border/40"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                  <FileIcon type="PDF" size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">Sign & Edit PDF</p>
                  <p className="truncate text-xs text-muted">Upload any PDF to sign, annotate or fill</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file pickers */}
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) uploads.upload(e.target.files, folderId);
          e.target.value = '';
        }}
      />
      <input
        ref={(el) => {
          (folderInput as any).current = el;
          el?.setAttribute('webkitdirectory', '');
        }}
        type="file"
        hidden
        onChange={(e) => {
          if (e.target.files?.length) uploads.uploadFolder(e.target.files, folderId);
          e.target.value = '';
        }}
      />
      <input
        ref={pdfInput}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const objectUrl = URL.createObjectURL(file);
            setActivePdfUrl(objectUrl);
            setActivePdfName(file.name);
            setPdfSignOpen(true);
          }
          e.target.value = '';
        }}
      />

      <NewFolderDialog open={folderOpen} onOpenChange={setFolderOpen} parentId={folderId} />
      {activePdfUrl && (
        <PdfSignDialog
          open={pdfSignOpen}
          onOpenChange={(isOpen) => {
            setPdfSignOpen(isOpen);
            if (!isOpen && activePdfUrl) {
              URL.revokeObjectURL(activePdfUrl);
              setActivePdfUrl(null);
            }
          }}
          pdfUrl={activePdfUrl}
          fileName={activePdfName}
          onSaveSigned={(blob, signedName) => {
            const file = new File([blob], signedName, { type: 'application/pdf' });
            uploads.upload([file], folderId);
          }}
        />
      )}
    </>
  );
}
